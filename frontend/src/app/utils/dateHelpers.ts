// The server/containers run in UTC, but the business operates in IST (Asia/Kolkata).
// `new Date().toISOString().substring(0,10)` always returns the UTC calendar date, which is
// wrong for anything happening between 00:00-05:29 IST (still "yesterday" in UTC). Use this
// helper anywhere "today's date" needs to be computed, instead of toISOString().
export const getISTDateString = (d: Date = new Date()): string => {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
};
