/**
 * Date helpers shared by the temporal data fetchers (`csv-time`, `json-time`).
 * All positions on a temporal axis are Unix epoch seconds.
 */

export interface DateOrderOptions {
    /** Read ambiguous dates as day-month-year (e.g. `31.01.2012`). */
    dayFirstDate?: boolean;
    /** Read dates as year-month-day. */
    yearFirstDate?: boolean;
}

type DateOrder = 'ymd' | 'mdy' | 'dmy';

/**
 * Decide the order of the three numeric parts of a date.
 * A four-digit first part is always year-month-day (ISO). Otherwise the explicit
 * `dayFirstDate` / `yearFirstDate` options win; without them, a first part above 12
 * means day-first and anything else is read as US month-day-year.
 */
function detectDateOrder(parts: string[], options: DateOrderOptions): DateOrder | undefined {
    if (parts[0].length === 4) return 'ymd';
    if (options.dayFirstDate) return 'dmy';
    if (options.yearFirstDate) return 'ymd';
    if (parts[2].length !== 4) return undefined;
    const [first, second] = parts.map(Number);
    if (first > 12 && second <= 12) return 'dmy';
    return 'mdy';
}

/**
 * Unix seconds of a UTC calendar date and time, or `NaN` if the date does not exist (e.g. Feb 30).
 */
export function utcSeconds(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
    const date = new Date(Date.UTC(2000, month - 1, day, hour, minute, second));
    // `Date.UTC` maps years 0-99 to 1900-1999, so set the full year explicitly.
    date.setUTCFullYear(year, month - 1, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return NaN;
    return date.getTime() / 1000;
}

/**
 * Extent of the tile grid that the temporal data fetchers report to HiGlass,
 * in Unix seconds: 0001-01-01 to 10000-01-01 (UTC). Rows outside it are never drawn.
 */
export const TIME_MIN_POS = -62135596800;
export const TIME_MAX_POS = 253402300800;

/**
 * Parse a calendar date without a time of day, such as `2012-01-31`, `2012/01/31`, `01/31/2012`,
 * `31.01.2012` or a bare year `2012`, into Unix seconds at UTC midnight.
 * Returns `NaN` if the string is not a valid date.
 */
export function parseDateOnly(value: string, options: DateOrderOptions = {}): number {
    const s = value.trim();
    if (/^\d{4}$/.test(s)) return utcSeconds(+s, 1, 1);
    const parts = s.split(/[-./]/);
    if (parts.length !== 3 || parts.some(p => !/^\d+$/.test(p))) return NaN;
    const order = detectDateOrder(parts, options);
    if (!order) return NaN;
    const [a, b, c] = parts.map(Number);
    const [year, month, day] = order === 'ymd' ? [a, b, c] : order === 'mdy' ? [c, a, b] : [c, b, a];
    return utcSeconds(year, month, day);
}

/** Format Unix seconds as an ISO calendar date (`YYYY-MM-DD`, UTC). */
export function formatIsoDate(seconds: number): string {
    return new Date(seconds * 1000).toISOString().slice(0, 10);
}
