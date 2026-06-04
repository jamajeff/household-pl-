# Monthly Review Template — Design

**Date:** 2026-06-04
**Project:** household-pl
**Status:** Approved for implementation planning

## Motivation

The Monthly Review section of each P&L statement is the most-repeated output in the app — written 12× per year, forever, by Jamal or his wife. Today the section presents an essentially blank-page typing surface (a free-form "Key Changes" textarea + 3 generic action items), which creates blank-page tax every month.

This redesign replaces the freeform surface with an opinionated, mostly-auto-filled template that takes ~3 minutes to complete and produces consistent, comparable monthly reviews.

## Template Content

```
Monthly Review — {Month YYYY}

Headline: Net cash flow was {$X,XXX} ({up/down} {$Y,YYY} vs last month).
True consumption burn rate: {XX%} (target: <{NN%}).

Debt:
- Total debt: {$XXX,XXX} ({down/up} {$Y,YYY} vs last month)
- #1 target: {debt name} — paid {$X,XXX} this month, balance now {$X,XXX}
- On track to clear #1 by: {Month YYYY}

Income tiering (the leverage scoreboard):
- Active: {$XX,XXX} ({100%})
- Semi-active: {$X} ({X%})
- Passive: {$X} ({X%})
- One step toward filling the bottom two this month: {freeform}

This month:
- One win: {freeform}
- One thing to watch: {freeform}
- One decision for next month: {freeform}
```

## Design Decisions

These were confirmed through brainstorming:

1. **Render model: Hybrid** — Computed parts render as live read-only text and always reflect current data. Freeform parts are individual inputs. The user cannot break the format; computed values cannot drift.
2. **Debt mechanics: Per-month balance snapshots** — Each `MonthRecord.review` snapshots the target debt's balance and total debt balance at month-end. "Paid this month" derives from `prior snapshot − current snapshot`. "On track to clear" derives from `current balance ÷ paid this month`.
3. **Migration: Replace freeform fields, keep auto-computed blocks** — Drop the `keyChanges` textarea and the 3 generic `actionItems`. Keep the existing Delta Highlights badges and Notable Line Item Changes list (both auto-computed) below the new template.
4. **Burn rate definition: Same as existing** — `totalExpenses ÷ totalRevenue × 100`. "True consumption" is rhetoric, not a new metric. The new addition is a configurable target % stored in Settings.
5. **Storage: Both Settings, app-wide** — `targetBurnRatePct` and `targetDebtId` live on `AppSettings`. Set once on the Settings page; every month's review uses them.

## Data Model Changes

### `ReviewData` (src/types/index.ts)

Replace the existing shape:

```ts
// Before
export interface ReviewData {
  keyChanges: string
  actionItems: [string, string, string]
}

// After
export interface ReviewData {
  targetDebtSnapshot: number | null   // target debt balance at month-end, in cents
  totalDebtSnapshot: number | null    // sum of all debt balances at month-end, in cents
  snapshotTakenAt: string | null      // ISO timestamp of last snapshot
  oneStepIncomeTier: string           // freeform — bottom-two leverage action
  oneWin: string
  oneToWatch: string
  oneDecisionNext: string
}
```

Default for a freshly-created `MonthRecord`:
```ts
{
  targetDebtSnapshot: null,
  totalDebtSnapshot: null,
  snapshotTakenAt: null,
  oneStepIncomeTier: '',
  oneWin: '',
  oneToWatch: '',
  oneDecisionNext: '',
}
```

### `AppSettings` (src/types/index.ts)

Add two fields:

```ts
export interface AppSettings {
  person1Name: string
  person2Name: string
  currencySymbol: string
  targetBurnRatePct: number | null    // e.g., 70 means target <70%
  targetDebtId: string | null         // id of a Debt record from net worth
}
```

Defaults in `DEFAULT_SETTINGS` (src/utils/storage.ts): both fields default to `null`.

## Computations

New helpers live in `src/utils/calculations.ts` (or a sibling utility file if cleaner — implementation plan decides):

| Output | Source |
|--------|--------|
| Headline net cash flow | `MonthMetrics.netCashFlow` |
| Headline delta vs last month | `MonthDelta.netCashFlow`; format as "up $X" or "down $X"; omit clause if no prior month |
| True consumption burn rate | `MonthMetrics.burnRate` |
| Target burn rate display | `AppSettings.targetBurnRatePct`; if `null`, render "(target: set in Settings)" |
| Total debt | This month's `review.totalDebtSnapshot` if set; otherwise `sum(debts.map(d => d.balance))` live, with a subtle "(live)" tag |
| Total debt delta | `prior month.review.totalDebtSnapshot − this month.review.totalDebtSnapshot`; if either is `null`, render "—" |
| #1 target debt name | Lookup `debts.find(d => d.id === settings.targetDebtId)?.label`; if missing, render "set target debt in Settings" |
| #1 target debt balance ("balance now") | This month's `review.targetDebtSnapshot` if set; otherwise looked-up debt's `.balance` live, with a subtle "(live)" tag |
| Paid this month (target debt) | `prior month.review.targetDebtSnapshot − this month.review.targetDebtSnapshot`; if either is `null`, render "—" |
| On track to clear #1 by | `currentBalance ÷ paidThisMonth = monthsRemaining`, rounded up, added to current year-month; if `paidThisMonth ≤ 0`, render "—" |
| Income tier amounts | `MonthMetrics.activeIncome / semiActiveIncome / passiveIncome` |
| Income tier % | `tier ÷ MonthMetrics.totalRevenue × 100`; if `totalRevenue === 0`, render "—" |

## UI Layout

`src/components/review/ReviewSection.tsx` is rebuilt. From top to bottom:

1. **Card header** — "Monthly Review — {Month YYYY}" (unchanged styling)
2. **Headline** block — one line of computed text
3. **True consumption burn rate** block — one line, includes target from settings
4. **Divider**
5. **Debt** block — 3 bullet lines, snapshot button + last-snapshot timestamp, "one step toward filling bottom two" text input
6. **Divider**
7. **Income tiering** block — 3 bullet lines (amount + %)
8. **Divider**
9. **This month** block — 3 text inputs (one win / one to watch / one decision)
10. **Heavy divider**
11. **Delta Highlights** — existing badges, unchanged
12. **Line Item Changes** — existing list, unchanged

Reference mockup: `mockups/monthly-review-mockup.html` in the repo.

## Snapshot UX

The "📸 Snapshot debt balances at month-end" button is the one click per month that captures debt balances into the review. Behavior:

- **Before snapshot taken (`snapshotTakenAt` is null):** Button visible. "Total debt" and target debt "balance now" fall back to live values from the net worth store with a small "(live)" tag. Debt deltas and "paid this month" show "—" with a small hint: "Snapshot to compute paid-this-month and total-debt delta."
- **On click:** Captures the current target debt's `.balance` and `sum(debts.balance)` into `review.targetDebtSnapshot` and `review.totalDebtSnapshot`. Stores `snapshotTakenAt = new Date().toISOString()`.
- **After snapshot:** Shows "Last snapshot: {formatted date}" next to the button. Clicking again re-snapshots (with a confirm dialog: "Overwrite existing snapshot from {date}?").
- **Snapshot is intentionally manual.** No auto-pull from current Debt values, which would drift mid-month. The user takes the snapshot at month-end when balances reflect the closed month.

## Settings Page Changes

`src/components/dashboard/SettingsPage.tsx` gains a new "Targets" section with two fields:

- **Target burn rate (%)** — numeric input, accepts 0–100. Empty value persists as `null`.
- **#1 target debt** — `<select>` dropdown populated from current `Debt[]` (from the net worth store), with a "None" option. Selection stores `debt.id`. If the user later deletes that debt from the Net Worth page, the review surface gracefully falls back to "set target debt in Settings."

Both persist through the existing `useSettings` hook (same localStorage `pl:settings` key).

## Migration

Existing data — months saved under the old `ReviewData` shape (`keyChanges` + `actionItems`) — is handled passively:

- When the new code reads a `MonthRecord` from localStorage, it spreads `review` over the new defaults: any stale `keyChanges` / `actionItems` keys sit unread until the next save.
- On the next save of any month, `setMonth(record)` writes the new shape and the stale keys are dropped.
- New fields (`targetDebtSnapshot`, `totalDebtSnapshot`, `snapshotTakenAt`, the four freeform strings) default to `null` / `""` for existing months.
- **Result for the user:** Opening a pre-existing month shows the new template populated with whatever live data is available — income tiering computes from existing income; debt deltas show "—" until a snapshot is taken. The old freeform notes are not surfaced; the user can re-enter what's relevant.

`ExportedData.version` stays at `1`. Imports tolerate either shape via the same passive read.

## Files Touched

Implementation will modify (or add):

- `src/types/index.ts` — update `ReviewData`, extend `AppSettings`
- `src/utils/storage.ts` — extend `DEFAULT_SETTINGS`
- `src/utils/calculations.ts` (or new sibling) — add `monthsToClearDebt`, `addMonthsToYearMonth`, headline formatter
- `src/components/review/ReviewSection.tsx` — rebuilt
- `src/components/dashboard/SettingsPage.tsx` — add Targets section
- `src/hooks/useMonthData.ts` — adjust `ReviewData` default for new month creation (if applicable)
- `mockups/monthly-review-mockup.html` — already exists, reference only

## Out of Scope

- Year-end roll-up / annual review screen
- Cross-month trend charts of paid-debt or burn rate
- Multiple "target debts" (the design assumes one #1 target at a time, by user request)
- Re-tagging expenses with a "consumption vs wealth-building" axis (rejected during brainstorm — burn rate stays as defined today)
- Active migration of old `keyChanges` text into the new freeform fields (passive drop instead)

## Success Criteria

- Opening a fresh month's statement renders the Monthly Review with all computed lines populated and only the 4 freeform inputs blank.
- Total fill time, given a prior month's snapshot exists, is under 3 minutes.
- Switching `targetDebtId` in Settings immediately updates every month's review surface on next view.
- Months saved before this change still open without error and surface as much computed data as possible.
