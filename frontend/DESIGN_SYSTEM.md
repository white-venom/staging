# CrediiFlow Design System

Reference point: KhataBook — information-dense, easy to scan at a glance, not cluttered, not decorated. Every list screen in this app (ledgers, collections, deposits, staff, retailers) should read like a well-typeset financial statement, not a stack of cards.

This replaces ad-hoc per-screen spacing/decoration choices with fixed tokens. Every new or reworked screen should be built from this table, not from what "looks about right."

## Spacing scale

Four sizes, used by role — do not reach for anything outside this list in a list/table/ledger context:

| Role | Token | Use |
|---|---|---|
| Row internal padding | `px-2 py-2` | A single row in a list (transaction, staff, retailer) |
| Card internal padding | `p-2.5` | A standalone card / stat tile / form section |
| Gap inside a stacked cluster | `gap-0.5` / `space-y-0.5` | Primary label + secondary metadata stacked in one row |
| Gap between sibling cards/sections | `gap-2` / `space-y-2` | Space between cards on a page |

`p-4`, `p-6`, `gap-4`, `gap-6`, `space-y-4`, `space-y-6` are **banned inside list/table/ledger contexts**. They're only acceptable in a modal with a handful of fields or a genuinely empty full-page state — never in anything that repeats.

## Type scale

Every text role maps to exactly one class. Don't invent a new size for "this one label."

| Role | Class | Size |
|---|---|---|
| Primary amount (row-level) | `text-sm font-black font-mono tabular-nums` | 14px |
| Hero total (one per screen, summary card only) | `text-lg font-black font-mono tabular-nums` | 18px |
| Secondary/context amount | `text-xs font-bold font-mono tabular-nums` | 12px |
| Row primary label (name) | `text-xs font-extrabold` | 12px |
| Row secondary metadata (date, note, phone) | `text-[10px] font-bold text-slate-400 dark:text-slate-500` | 10px |
| Section header / card title | `text-[10px] font-black uppercase tracking-wider` | 10px |
| Micro label (field label, stat-tile caption, badge) | `text-[8px]` or `text-[9px] font-black uppercase tracking-wider` | 8-9px |

**Floor: 7px.** Nothing in this app goes below `text-[7px]`. (The `text-[5.5px]` labels found in the audit were a bug, not a design choice — this table is what they should have used.)

## Color system

**Background layers**
- Page: `bg-slate-50 dark:bg-slate-950`
- Card: `bg-white dark:bg-slate-900`
- Inset/nested well inside a card: `bg-slate-50 dark:bg-slate-950/60`

**Borders**
- Card/container border: `border-slate-200 dark:border-slate-800`
- Row divider (between list items, not a per-row card): `border-slate-100 dark:border-slate-800/60`

**Text hierarchy**
- Primary: `text-slate-800 dark:text-slate-100`
- Secondary: `text-slate-500 dark:text-slate-400`
- Muted / label: `text-slate-400 dark:text-slate-500`

**Financial status** (established convention — keep it, don't reinvent per screen)
- Red (`text-red-600` / `bg-red-50` / `border-red-200`, dark: `red-400` / `red-950/20` / `red-900/30`) = **To Take** — money owed *to* the business, debit-direction
- Emerald (mirrored red tokens) = **To Give** — money the business owes, credit-direction
- Blue = neutral/calculated total that isn't inherently a direction (e.g. net cash in hand)
- Slate/gray = settled, zero, or disabled
- Amber is reserved for warnings and offline/connectivity state only — never for a financial direction (this got fixed once already; don't regress it)

## Row/card pattern for list items

This is the KhataBook move: one row = identity on the left, amount on the right, a hairline divider between rows, no shadow, no per-row card border.

```
[dot/badge]  Primary Name                              ₹  12,450
             secondary metadata · date · note
```

- Row container: `flex items-center justify-between gap-2 px-2 py-2 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0`
- **No** `rounded-sm border` wrapper per row, **no** `shadow`. Those belong on the *outer* list container only, once — not on every row inside it.
- Left cluster: `flex-1 min-w-0` — primary name (`text-xs font-extrabold`) stacked with secondary metadata (`text-[10px] text-slate-400`), `gap-0.5` between them.
- **Never truncate the primary name.** If something has to give under space pressure, let the *secondary* line truncate or the name wrap to a second line — not the identity of who the money moved with. (This was a real bug: narration text was clipped behind generous padding elsewhere in the row.)
- Right: amount, `shrink-0`, `text-sm font-black font-mono tabular-nums`, colored per the financial-status rule above, right-aligned.

## What this fixes vs. the earlier "flatten to density-first" pass

The earlier pass removed shadows/gradients/rounded corners and shrank padding ad hoc, screen by screen. That's necessary but not sufficient — it didn't fix inconsistent type sizes across files (`text-[5.5px]` vs `text-[7px]` for the same role), it didn't establish which amount gets `text-sm` vs `text-xs`, and in at least one case it let a `truncate` clip real information while padding sat unused nearby. This document is the fixed reference so those decisions stop being made per-file.
