// The server/containers run in UTC, but the business operates in IST (Asia/Kolkata).
// `new Date().toISOString().substring(0,10)` always returns the UTC calendar date, which is
// wrong for anything happening between 00:00-05:29 IST (still "yesterday" in UTC). Use this
// helper anywhere "today's date" needs to be computed, instead of toISOString().
export const getISTDateString = (d: Date = new Date()): string => {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
};

// Parses a raw backend timestamp (created_at) into a Date, treating it as UTC
// when it carries no timezone suffix -- backend timestamps can carry 6-digit
// microseconds (Python's isoformat()), which some Safari/WebKit versions fail
// to parse, so also truncate to milliseconds.
export const getUtcDate = (dateStr: any): Date => {
  if (!dateStr) return new Date();
  let s = String(dateStr).trim().replace(" ", "T").replace(/\.(\d{3})\d+/, ".$1");
  if (!s.endsWith("Z") && !s.includes("+") && !s.includes("GMT")) {
    s = s + "Z";
  }
  return new Date(s);
};

// Build a display date string ("YYYY-MM-DD HH:MM") from the transaction's OWN
// date (collection_date / deposit_date) for the date part + created_at for the
// time part. A backdated entry must show up under the day it claims to
// represent, not the day it was actually keyed in (created_at alone) -- this
// is the fix for the staff-dashboard "today vs previous day" bug (2026-07-18
// audit finding #1): every staff-facing page used to build its date field from
// created_at only, so a backdated entry always showed up as "today". Matches
// the pattern already used in admin/context/AdminContext.tsx.
export const buildDisplayDate = (createdAt: any, transactionDate?: string | null): string => {
  if (!createdAt) return "N/A";
  const d = getUtcDate(createdAt);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(d);
  const datePart = transactionDate || getISTDateString(d);
  return `${datePart} ${timePart}`;
};
