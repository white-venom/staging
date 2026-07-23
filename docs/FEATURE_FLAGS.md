# Per-Tenant Feature Flags

Superadmin can turn individual features on or off for each tenant independently.
This is a real system backed by a database table — not a hardcoded config file —
so changes take effect immediately (no redeploy, no restart) and every tenant's
flags are managed centrally from the superadmin panel.

## How it works

- **Table:** `tenant_feature_flags` lives in the **master** database (like
  `tenants` and `audit_logs`), keyed by `(tenant_id, feature_key)`. It lives in
  the master DB — not each tenant's own database — specifically so superadmin
  can manage every tenant's flags without opening a connection to each
  tenant's own database.
- **Default is enabled.** Absence of a row for `(tenant_id, feature_key)` means
  the feature is ON. A row only gets written the first time a superadmin
  explicitly flips something off (or back on after that). This means a brand
  new feature — or a brand new tenant — is never silently disabled just
  because no row exists yet.
- **Enforcement lives on the backend**, not just the UI. Each feature's
  registry entry says whether it's `"enforced": "backend"` (a real 403 from
  the API if disabled) or `"enforced": "ui"` (only used for features with no
  server-side action to gate — currently just PDF/Excel export, which
  generates entirely in the browser).
- **Registry:** `backend/app/logic/feature_flags.py`'s `FEATURE_REGISTRY` is
  the single source of truth for what features exist. The superadmin UI reads
  it live from `GET /superadmin/feature-flags/registry` — it does not
  hardcode the list separately.

## Registering a new feature

1. Add one entry to `FEATURE_REGISTRY` in `backend/app/logic/feature_flags.py`:

   ```python
   {
       "key": "your_feature_key",       # snake_case, stable -- never rename once shipped
       "label": "Human-Readable Name",  # shown in the superadmin toggle grid
       "description": "One sentence explaining what turning this off actually does.",
       "category": "Cash Operations",   # groups related flags in the UI
       "enforced": "backend",           # or "ui" if there's truly no backend call to gate
   }
   ```

2. At the backend endpoint(s) that implement the feature, add the check:

   - **Whole endpoint is the feature** (e.g. "set a denomination baseline"):
     add it as a dependency —
     ```python
     @router.post("/staff/denomination-baseline")
     def set_denomination_baseline(
         payload: DenominationBaselineIn,
         db: Session = Depends(get_db),
         current_user=Depends(require_admin),
         _feature=Depends(require_feature("denomination_baseline"))
     ):
     ```
     This raises a clean 403 before the handler body runs at all if the tenant
     has it turned off.

   - **Feature is one branch of a bigger endpoint** (e.g. staff backdating is
     one path inside `submit_collection`, which also handles normal
     same-day entries): call it inline instead, since a dependency would
     block the *whole* endpoint rather than just that one path —
     ```python
     from app.logic.feature_flags import is_feature_enabled

     if not is_feature_enabled(request, "staff_handover"):
         raise HTTPException(status_code=403, detail="Staff-to-staff handover is not enabled for this account.")
     ```
     The endpoint needs a `request: Request` parameter for this form.

3. If the feature also needs client-side gating (hiding a button, not just
   reacting to a 403 after the fact), read the flag from whatever endpoint
   your frontend already calls that resolves the current tenant — e.g.
   `GET /admin-settings/business`'s response includes a `feature_flags` map
   for exactly this reason. Don't add a new fetch just for one flag if an
   existing one already runs on page load.

4. That's it. No frontend change is needed for the flag to appear in the
   superadmin toggle grid — `TenantControlsPanel`'s Feature Flags section
   renders whatever `GET /superadmin/feature-flags/registry` returns.

## Current features

| Key | Category | Enforced | What turning it off does |
|---|---|---|---|
| `staff_backdating` | Cash Operations | Backend | Staff can no longer submit/edit a cash-in or cash-out with a date other than today, even if the tenant's own `staff_can_change_collection_date` setting is on — this is a master switch layered on top of that tenant-level setting. |
| `staff_handover` | Cash Operations | Backend | Staff can no longer hand cash directly to another staff member (Cash Out > Staff). The API rejects `recipient_staff_id`/`from_staff_id` on both create and edit. |
| `virtual_transfer` | Cash Operations | Backend | Admins can no longer credit a retailer or staff member's balance from a bank/portal account without a physical cash movement. |
| `portal_transfer` | Cash Operations | Backend | Admins can no longer move balance directly between two bank accounts. |
| `denomination_baseline` | Staff Tools | Backend | Admins can no longer set a verified physical cash-count snapshot for a staff member. |
| `attendance_tracking` | Staff Tools | Backend | Staff can no longer check in or check out at all (`POST /attendance/check-in` and `/check-out` both 403). |
| `pdf_export` | Reporting | UI only | The PDF/Excel download buttons on ledger and report views are hidden. There is no server-side PDF generation to gate — export happens entirely in the browser — so this one is enforced by hiding the control, not by a 403. |

## Superadmin UI

Superadmin panel → **Tenant Controls** tab → pick a tenant → **Feature Flags**
section. Toggles are grouped by category and save individually (no separate
"Save" button — each toggle takes effect on click). A short amber "UI-only"
badge marks flags that don't have a backend enforcement point, per the table
above.
