// Permanent regression check for the 2026-07-18 audit finding: every staff-facing
// page used to build its "today vs previous day" date field from created_at
// (the real submission instant) instead of collection_date/deposit_date (the
// day the transaction claims to represent), so a backdated entry always showed
// up as "today" on the staff dashboard. Fixed by buildDisplayDate() in
// frontend/src/app/utils/dateHelpers.ts, which every staff-facing page now
// imports instead of re-implementing its own date logic.
//
// Run with: node frontend/scripts/check-date-bucketing.mjs
// No test framework/dependency required -- imports the real source file
// directly (Node's native TypeScript support) and uses the built-in assert module.
import assert from "node:assert/strict";
import { buildDisplayDate, getISTDateString, getUtcDate } from "../src/app/utils/dateHelpers.ts";

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (e) {
    console.log(`[FAIL] ${name}`);
    console.log(`       ${e.message}`);
    process.exitCode = 1;
  }
};

check("Backdated entry displays under its own collection_date, not today's created_at date", () => {
  // Entry actually submitted "today" (created_at) but backdated to collection_date=yesterday.
  const createdAt = "2026-07-18 07:44:00.611902"; // today, IST-naive-UTC as the backend stores it
  const collectionDate = "2026-07-17"; // backdated
  const display = buildDisplayDate(createdAt, collectionDate);
  assert.equal(display, "2026-07-17 13:14", `expected the backdated date (2026-07-17), got: ${display}`);
});

check("Entry with no transaction date falls back to created_at's own IST date (legacy rows)", () => {
  const createdAt = "2026-07-18 07:44:00.611902";
  const display = buildDisplayDate(createdAt, undefined);
  assert.equal(display, "2026-07-18 13:14", `expected fallback to created_at's IST date, got: ${display}`);
});

check("No createdAt at all returns a safe placeholder, never throws", () => {
  assert.equal(buildDisplayDate(null, "2026-07-17"), "N/A");
  assert.equal(buildDisplayDate(undefined, "2026-07-17"), "N/A");
});

check("getUtcDate treats a naive backend timestamp (no timezone suffix) as UTC", () => {
  const d = getUtcDate("2026-07-18 07:44:00.611902");
  assert.equal(d.toISOString().slice(0, 19), "2026-07-18T07:44:00");
});

check("getISTDateString correctly rolls over the IST calendar day at 18:30 UTC", () => {
  const beforeMidnightIST = new Date("2026-07-17T18:29:59.000Z");
  const atMidnightIST = new Date("2026-07-17T18:30:00.000Z");
  assert.equal(getISTDateString(beforeMidnightIST), "2026-07-17");
  assert.equal(getISTDateString(atMidnightIST), "2026-07-18");
});

console.log(`\n${passed}/5 checks passed`);
if (process.exitCode) {
  console.log("REGRESSION DETECTED — see FAIL entries above.");
}
