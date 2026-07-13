# CrediiFlow — How It Actually Works Today

This document explains the real, current implementation — not the intended design. Where the code
does something surprising or inconsistent, it's called out inline and summarized in
**Observed Inconsistencies** at the end. Nothing in this document has been changed as part of writing it.

> **Naming note:** two renames happened this session. Phase 2: the old `Portal` model/table
> (an individual bank account) became `BankAccount`; `portals.py` was split into `portals.py`
> (aggregator endpoints) and `bank_accounts.py` (BankAccount endpoints). Phase 3: the old
> `PortalGroup` (the aggregator) became `Portal` — freed up now that Phase 2 renamed the other
> concept out of the way. So today `Portal` = the aggregator brand (e.g. "PayNearby"), and
> `BankAccount` = one specific bank account under it. Some line-number references below predate
> these renames and may be slightly off.

Stack: FastAPI (Python) + SQLAlchemy 2.0 + Postgres backend, Next.js (TypeScript/React) frontend,
staff-facing app is an offline-first PWA (Dexie/IndexedDB).

---

## 1. Entity Map

Every tenant (e.g. `do-it-services`) has its own **entirely separate physical Postgres database**.
A master database (`master_models.py`) holds the `Tenant` table mapping a subdomain to that
database's name; every request resolves its tenant from the `X-Tenant-ID` header (fallback:
subdomain) in `app/database/db.py:get_db()`. So every model below is **per-tenant** — there is no
tenant_id column anywhere, isolation is the whole database.

| Model | Table | Represents |
|---|---|---|
| `User` | `users` | A Staff or Admin login. Role field (`staff`/`admin`) drives permissions. Has a `virtual_balance` field used only by the Admin↔Staff "virtual" wallet feature (see §2.3). |
| `Retailer` | `retailers` | A shop/merchant the business collects cash from. Carries `opening_to_give`, `opening_to_take`, `balance`. |
| `Store` | `stores` | A physical location belonging to a `Retailer` (a retailer can have multiple stores). |
| `Portal` | `portals` | An aggregator brand (e.g. "PayNearby", "RNFI") — the parent of one or more bank accounts. Carries `opening_to_give`, `opening_to_take`, `balance`. |
| `BankAccount` | `bank_accounts` | One specific bank account under a `Portal` (bank name, account no., IFSC). Also carries its own `opening_to_give/take/balance` — see Observed Inconsistencies, this is a second, semi-independent balance next to the parent portal's. |
| `PortalAdjustment` | `portal_adjustments` | *(added this session)* One row per manual "Adjust Balance" edit on a `Portal`, so the ledger can show *when* and *by how much* an admin manually corrected a balance, instead of silently folding it into a running total. |
| `Collection` | `collections` | **Cash In** — staff collecting money. Source is exactly one of: a `Retailer`/`Store`, another staff (`from_staff_id`, a handover), or the office (`from_office`). |
| `BankDeposit` | `bank_deposits` | **Cash Out / Payout** — staff moving money out of their hand. `deposit_type` is one of `portal`, `retailer`, `staff`, `virtual`, `portal_transfer` (see §2). |
| `Denomination` | `denominations` | The note/coin breakdown (₹500…₹10, coins, online_amount) for exactly one `Collection` OR one `BankDeposit` (1:1, nullable FK both ways). |
| `DenominationBaseline` | `denomination_baselines` | *(added this session)* An admin-verified physical cash-count snapshot for one staff member at a point in time, used as a trusted starting point instead of replaying all history. |
| `Ledger` | `ledgers` | The retailer-facing running-balance journal. **Required, non-nullable `retailer_id`** — Ledger rows only exist for retailers, never for bank accounts/portals (those compute their "ledger" on the fly, see §3). |
| `Attendance` | `attendance` | Staff check-in/out, odometer km + photo, GPS. Unrelated to cash flow except for late-penalty amounts. |
| `BusinessSettings` | `business_settings` | Single-row (`id=1`) global config: edit/delete windows, `staff_can_change_collection_date`, late-penalty threshold, etc. |
| `Tenant` / `SuperAdmin` | *(master DB)* | Tenant registry and the cross-tenant super-admin login. |

**Relationships at a glance:**
- `Collection` → optionally `Retailer` + `Store`, OR `from_staff_id` (another `User`), OR `from_office=True`. Always has `staff_id` (who entered it) and one `Denomination`.
- `BankDeposit` → depending on `deposit_type`: a `BankAccount`, a `Retailer`, a `recipient_staff_id` (another `User`), or both a `BankAccount` and `Retailer` (virtual). Always has `staff_id` (who entered it) and usually one `Denomination`.
- `Ledger` → always a `Retailer`, optionally points back at the `Collection` or `BankDeposit` that generated it.
- A staff-to-staff handover (§2.4) creates **one `Collection` + one `BankDeposit`**, linked by `Collection.mirror_deposit_id → BankDeposit.id`.

---

## 2. Full Transaction Lifecycle

### 2.1 Cash In (Collection) — staff collects from a Store/Retailer

`POST /collections` → `submit_collection()` in `backend/app/routers/collections.py:18-134`.

1. Validates the source: exactly one of `retailer_id`, `from_staff_id`, or `from_office=True` must be set (line 26-45).
2. Recomputes the denomination total server-side (`cash_sum + online_amount`) and **hard-rejects** if it doesn't exactly equal `payload.total_amount` (line 60-66) — this check already existed for creation; a matching check for *updates* was added this session (`app/schemas/collection.py`, `model_validator`).
3. Creates the `Collection` row and its `Denomination` row (line 71-98).
4. If `retailer_id` is set: reads the retailer's **latest `Ledger` row's balance** (or `opening_to_take` if none exists yet), subtracts `total_amount` (collecting cash means the retailer owes less), writes a new `Ledger` row (`transaction_type="credit"`, `description="cash in"`), and sets `retailer.balance` directly (line 100-133).
5. If the collection has an `online_amount` portion (digital/cashless part of a mixed collection) **and** a `bank_account_id` was given, it *also* auto-creates a `BankDeposit` (`deposit_type="portal"`, `payment_mode="online"`) crediting that bank account immediately (line 135-172) — this is the one case where a single Cash-In action writes to two different balances in one request.

**Whose balance changes:** the `Retailer.balance` (down) and, only for the online-amount sub-case, the `BankAccount`/`Portal.balance` (up). Staff's own "balance" is never stored — it's derived on the fly (§3).

### 2.2 Cash Out / Bank Deposit — staff deposits into a Bank Account

`POST /bank-deposits` → `submit_deposit()`, `deposit_type="portal"` branch, `backend/app/routers/deposits.py:19-144`.

1. Creates a `BankDeposit` row (`staff_id` = who's depositing, `bank_account_id` = target, `amount`, `deposit_date`) and its `Denomination` row.
2. `bank_account.balance += amount` and `bank_account.portal.balance += amount` (line 140-148) — depositing reduces what the business is owed by that pool, i.e. moves the bank account's running balance up.

**Linking back to the original Collection(s):** there is **no explicit link**. A `BankDeposit` of type `portal` does not reference which `Collection` row(s) it's "clearing." The connection only exists implicitly through the **denomination-sum invariant** (a deposit's notes must have come from some prior collection's notes) and through the on-the-fly consolidated portal ledger view (`GET /portals/{id}/ledger` in `portals.py`), which reconstructs a chronological statement by walking all of a portal's `Collection`s and `BankDeposit`s together, matching an online collection to its auto-mirrored deposit by date+amount where possible.

**"Un-deposited cash in hand" per staff:** this is never a stored value. It's computed live, client-side, in `frontend/src/app/staff/page.tsx` (the honest-sum walk, §3) by summing every `Collection`'s denominations (add) and every outgoing `BankDeposit`'s denominations (subtract) for that staff.

### 2.3 Admin Virtual Transfer to Retailer

`POST /bank-deposits`, `deposit_type="virtual"` branch, `deposits.py:44-56` (validation) and `149-178+` (bookkeeping). **Admin-only** — a 403 is raised if a non-admin attempts it (line 45-49).

This **reuses `BankDeposit` and `Ledger`**, it is not a separate model. A virtual transfer requires both a `bank_account_id` (source) and `retailer_id` (destination):
1. `bank_account.balance -= amount` (and the parent portal's balance) — the money is treated as having left that bank account's pool.
2. A new `Ledger` row is written for the retailer, crediting them (same direction/effect as a real Cash-In collection) — the retailer's balance moves as if they'd been paid, with **no physical `Collection` or cash ever touched**.
3. `payment_mode == "refund"` reverses both signs (used to undo a virtual transfer).

So: an admin's virtual transfer is functionally "pretend this retailer got paid out of this bank account's balance," recorded entirely through the deposit+ledger tables with `deposit_type="virtual"` as the tag distinguishing it from a real payout.

### 2.4 Staff-to-Staff Handover

This happens on the **receiving** staff's side, as a `Collection` with `from_staff_id` set instead of a `retailer_id` — i.e. the recipient runs "Cash In → From Staff" (`collections.py:182-213`):

1. The `Collection` is created normally for the receiver (`staff_id = current_user.id`, `from_staff_id = <sender>`).
2. The backend **auto-creates a mirrored `BankDeposit`** for the sender: `staff_id = from_staff_id`, `deposit_type="staff"`, `recipient_staff_id = current_user.id`, same `amount` and same denominations.
3. `Collection.mirror_deposit_id` is set to that new `BankDeposit.id` — a real foreign key (added this session; previously the two rows were paired only by matching `staff_id`+`amount`+`date` coincidentally, which silently broke and double-counted as soon as either side was edited — see collections.py update/delete logic at lines 840-910 and deposits.py:461-465 for the FK-first, coincidence-fallback pattern now used everywhere in the *backend*).

Neither side's balance is a stored column that gets decremented — both staff members' "current cash in hand" is derived live the same way as §2.2, walking their own `Collection`s (add) and `BankDeposit`s (subtract, or add if `recipient_staff_id` matches and it's their own dashboard).

---

## 3. Balance / Ledger Computation

**Retailer:** stored as `Retailer.balance`, but it's kept in sync by fully **recomputing from scratch** on every write via `recalculate_balances()` (`backend/app/logic/ledger.py:21-96`) — it re-walks every `Ledger` row for that retailer in chronological order, re-stamping each row's running `balance` and the linked `Collection`/`BankDeposit`'s `balance_snapshot`, then sets `retailer.balance` to the final value. This is O(n) per write (grows with the retailer's full history) but guarantees the stored value never drifts from the ledger.

**BankAccount / Portal:** `balance` is mutated **directly and incrementally** at each call site (`bank_account.balance += amount`, etc.) — there is no recompute-from-scratch step and no persisted per-transaction ledger table. The "ledger" you see in the UI for a portal (`GET /portals/{id}/ledger`, `portals.py`) is **synthesized on every request** by pulling all verified `Collection`s and `BankDeposit`s for that portal's bank_accounts and walking them chronologically starting from `opening_to_take − opening_to_give` — it is not reading from a stored table of line items (except, as of this session, `PortalAdjustment` rows are merged in for manual balance edits).

**Staff "pocket cash":** never stored anywhere. Computed live in the frontend (`frontend/src/app/staff/page.tsx`, `~line 536` onward, mirrored in `admin/components/desktop/OverviewTab.tsx` and `mobile/MobileOverview.tsx`) as an "honest sum": start from a `DenominationBaseline` if one exists (else zero), then add every `Collection`'s notes and every received-handover `BankDeposit`'s notes, subtract every other outgoing `BankDeposit`'s notes. **This session's fix:** when this walk produces a negative count for one denomination (e.g. a deposit paid out more ₹500 notes than were ever collected, because the staff broke smaller notes to make one up), the code now pays off that debt out of the smaller denominations largest-first (like a cashier breaking a note) rather than clamping straight to zero, which used to silently delete the debt while leaving its offsetting surplus untouched and inflating the displayed total.

**Opening balance — what it physically represents, and why it's inconsistent:**
- For a **Retailer**: `opening_to_give`/`opening_to_take` are two numbers an admin sets once (or edits later); `recalculate_balances()` turns their *net* into a single collapsing "Opening Balance" `Ledger` row **always dated `retailer.created_at`** — the day the retailer record itself was created in the system, *not* the day someone actually entered/adjusted the opening figures (`ledger.py:55, 66`). This is why the audit found the opening-balance date wrong.
- For a **Portal**: there's no discrete ledger row at all for the opening figures — `opening_to_give`/`opening_to_take` are just running counters that get incremented by whatever delta an admin enters via "Adjust Balance," and `balance` is nudged by the same delta at the same instant (`portals.py:update_portal`). Until this session, there was no record of *when* each adjustment happened; `PortalAdjustment` now captures that going forward.
- **Why some bank_accounts/retailers show an opening balance and others don't:** the earlier production database reset in this session zeroed `balance` directly via raw SQL (`UPDATE portals SET balance = 0`) but did **not** touch `opening_to_give`/`opening_to_take` on every row uniformly — some groups had those already-zero, others had stale pre-reset values sitting alongside a freshly-zeroed `balance`, producing exactly the "some have it, some don't" pattern observed and manually corrected earlier today.

**Denomination ↔ amount:** as of this session, the relationship is a **hard invariant enforced at the API boundary**, not just a record-keeping breakdown. `app/schemas/collection.py` and `app/schemas/deposit.py` both carry a `model_validator` that rejects any create *or update* where `note_500×500 + note_200×200 + … + coins + online_amount ≠ total_amount/amount`. Before this session that check only existed on collection *creation*; nothing stopped an edit (e.g. the admin "Correction Amount" quick-edit in `WalletTransferTab.tsx`, `handleEdit` at line ~114-122, which spreads the old record and only overwrites `amount`) from silently desyncing the two.

---

## 4. Roles & Permissions

Defined in `backend/app/dependencies.py`:
- `require_admin` — role must be exactly `admin`.
- `require_staff` — role `staff` or `admin` (i.e. "any logged-in operational user," despite the name).
- `require_any_user` — same as `require_staff`, used for read endpoints.

Enforced per-endpoint via FastAPI `Depends(...)`, e.g. `submit_collection` uses `require_staff` (line 23 of `collections.py`), `deposit_type="virtual"`/`"portal_transfer"` explicitly re-check `current_user.role != "admin"` inline (`deposits.py:45, 57`) on top of the base dependency, since both staff and admin pass `require_staff`.

**Editing / deleting:** gated by `BusinessSettings.edit_window_minutes` / `delete_window_minutes` (default 5 minutes, `-1` = unlimited) — checked in `update_collection`/`delete_collection` for non-admins (`collections.py:558-563`); admins are exempt from the time window entirely.

**Backdating:** `BusinessSettings.staff_can_change_collection_date` (`models.py:192`, **defaults to `False`**) gates whether a *non-admin* can change the date on an **edit** (`collections.py:565-568` — if the setting is off, the submitted date is silently discarded and the original is kept). Admins are never gated on edit. For **creation**, the backend itself never gates the date at all (`collections.py:80`, `collection_date=payload.collection_date or ist_today()`) — but the *frontend* Cash-In form only renders the date-picker input when this same setting is true (`frontend/src/app/collection/page.tsx:769`), so with the default (off), staff have no UI path to backdate a new entry even though the API would accept it if asked.

---

## 5. Offline / Sync Behavior (Staff PWA)

`frontend/src/app/utils/sync.ts`. Offline-created entries are written to Dexie (IndexedDB) with `synced: 0`. Sync is attempted:
- On the browser's `online` event (`initializeSyncEngine`, line 12-24).
- On a 2-minute interval added this session inside `staff/page.tsx`'s sync `useEffect`, as a safety net for the `online` event not reliably firing in backgrounded mobile PWAs.

`syncOfflineData()` (line 41-128) loops unsynced collections/deposits, calls the real create API, and only on success flips `synced: 1`. **On failure it does nothing but `console.error` and move to the next item** — the entry stays queued locally (not silently dropped by this function), and will be retried on the next trigger. There is a "Waiting List" UI (added this session) showing these stuck items with a manual delete option, but no visible automatic retry-count or backoff, and no server-side visibility into what's stuck on a device until it either syncs or the user opens that screen.

**Where this becomes real data loss (not yet fully confirmed — see audit thread):** if the device's IndexedDB is cleared (low-storage eviction, PWA reinstall, service-worker cache purge, manual "clear browsing data") before a queued entry ever successfully syncs, that entry is gone with no trace on the server, because it never reached the server in the first place. This is the leading hypothesis for the reported "entered in the evening, missing by morning" symptom, pending a specific example to trace end-to-end.

---

## 6. Reports / PDFs

**Staff daily report** (`frontend/src/app/staff/daily-report/page.tsx`) — **does not reuse the live dashboard's calculation.** It re-implements its own, separate, and older version of the same logic:
- Its own staff-handover dedup filter (line 46-55) still uses the **old amount/staff_id coincidence match**, not the `mirror_deposit_id` FK fix applied to `staff/page.tsx` this session — meaning the exact double-counting bug fixed on the live dashboard is still present in the PDF.
- `openingBalance`/`lastBalance` (line 118-145) are computed as **pure rupee totals only** (`totalInBefore − totalOutBefore`, etc.) — there is no equivalent of the dashboard's "honest sum" note-by-note walk for these two aggregate figures, so no denomination breakdown can be rendered for them even though `renderNotesBreakdown()` (line 148+) works fine per individual line item. This is the exact cause of the reported "opening/last balance denomination missing from PDF."

**BankAccount-group ledger / admin ledger views** (`portals.py:578-830 (now split across portals.py and bank_accounts.py)`, `LedgerTab.tsx`/`MobileLedger.tsx`) — these *do* share the backend's on-the-fly synthesis (§3), so they're closer to a single source of truth than the staff PDF is.

---

## Observed Inconsistencies (for later triage — not fixed here)

1. **Staff daily-report PDF duplicates old, already-fixed logic.** Living proof that the "fix it once in the dashboard" pattern used this session doesn't propagate — the same bug class needs fixing again in `daily-report/page.tsx` (and possibly other report/print views not yet audited).
2. **BankAccount has its own `opening_to_give/take/balance` separate from its parent Portal's.** Two balances that both move independently invite exactly the kind of drift already found in Portal this session; worth confirming intended semantics (does a bank account's own balance ever get read anywhere, or is Portal the only one that matters in practice?).
3. **Opening Balance ledger date is hardcoded to `retailer.created_at`**, not "the day the opening figures were actually entered" — confirmed root cause of a client-reported issue.
4. **Retailer's opening-balance mechanism has no adjustment history** (unlike the new `PortalAdjustment` for portals) — every edit to `opening_to_give/take` just re-dates and re-amounts the same single "Opening Balance" ledger row, so there's no audit trail of *when* an admin changed it.
5. **`staff_can_change_collection_date` silently discards the submitted date on edit** rather than rejecting the request with an error — a staff member who picks a backdate (if they even can) gets no feedback that it didn't take effect.
6. **The staff Cash-In backdate control is UI-gated, not API-gated** — the backend would accept a backdated `collection_date` on creation from anyone, but the frontend hides the input unless the business setting is on, so the restriction lives in the wrong layer and is easy to bypass or forget about.
7. **`WalletTransferTab.tsx`'s "Correction Amount" quick-edit** patches `amount` while reusing the old record's `denominations` wholesale — will now be rejected by this session's new backend validator whenever the entry has real (non-null) denominations, converting a silent-corruption bug into a visible error, but the UI itself hasn't been fixed to either resync denominations or explain the rejection.
8. **`reset_db.py`** imports a top-level `engine` from `app.database.db` that no longer exists (the module moved to per-tenant `get_tenant_engine()`/cached dicts) — this script would crash immediately if run; it's stale, single-tenant-era dead code sitting in the repo.
9. **A dozen-plus one-off `fix_*`/`verify_*`/`dump_*`/`seed_*` scripts live loose in `backend/`'s root** rather than in `scripts/`, several of them (`fix_portal_balances.py`, `dump_details.py`, `seed_retailers.py`, etc.) importing the tenant-ambiguous `SessionLocal` helper (`db.py:76-95`), which defaults to `"do-it-services"` or "whichever tenant query returns first" if no `TEST_TENANT_ID` is set — running one of these against the wrong intent, on the wrong tenant, would be silent and easy to do by accident.
10. **Multi-tenant startup work runs on every backend boot**, not once — `main.py`'s `startup_event()` loops every active tenant doing idempotent `ALTER TABLE` checks (harmless today) each time the container restarts; the comment at `main.py:114-118` documents that a much more dangerous version of this pattern (an unbounded, unlocked historical-data rewrite across all tenants on every boot) existed here before and was only recently moved out to a manual one-off script.
