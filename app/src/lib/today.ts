/**
 * The one place in the app that reads the clock.
 *
 * `civil-date.ts` is contractually clock-free and timezone-invariant — its own source scan forbids
 * local getters — and `source-freshness.ts` takes `today` as an argument so every ageing rule is
 * testable at its exact boundary. Neither may call `new Date()`. Something has to, though, or the
 * app could never know what day it is, so that one impure line lives here where it is findable
 * rather than buried in a component or smuggled into a pure module.
 *
 * It reads LOCAL calendar components deliberately, and that is the whole reason it cannot live in
 * `civil-date.ts`. "Today" is the day the reader is living in, not the day it is in UTC; a reader
 * in Tokyo at 08:00 must not be told yesterday's date because UTC has not caught up. Everywhere
 * else in the codebase a date is a civil date being *computed with*, and local getters would be a
 * bug; here the local calendar is precisely the question being asked.
 */

/** Today's local calendar date as `YYYY-MM-DD`. `now` is injectable so tests never read a clock. */
export function todayCivilDate(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
