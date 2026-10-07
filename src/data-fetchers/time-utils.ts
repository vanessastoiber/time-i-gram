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

/** Convert a Unix timestamp in the given unit to Unix seconds. */
export function timestampToSeconds(value: number, unit: 's' | 'ms' = 's'): number {
    return unit === 'ms' ? value / 1000 : value;
}

/** Format Unix seconds as an ISO calendar date (`YYYY-MM-DD`, UTC). */
export function formatIsoDate(seconds: number): string {
    return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/**
 * Seconds since midnight of a time of day such as `7:21`, `16:40:21`, `16:40:21.5` or `7:21:00 PM`,
 * or `NaN` if the string is not a valid time.
 */
export function parseTimeOfDay(value: string): number {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?\s*([AaPp][Mm])?$/.exec(value.trim());
    if (!match) return NaN;
    let hour = +match[1];
    const [minute, second, meridiem] = [+match[2], +(match[3] ?? 0), match[4]?.toUpperCase()];
    if (meridiem) {
        if (hour < 1 || hour > 12) return NaN;
        hour = (hour % 12) + (meridiem === 'PM' ? 12 : 0);
    }
    if (hour > 23 || minute > 59 || second >= 60) return NaN;
    return hour * 3600 + minute * 60 + second;
}

/**
 * Parse a date with an optional time of day into Unix seconds.
 * A string with an explicit zone (`2022-01-01T00:00Z`, `...+01:00`) keeps that zone; every other
 * string is read as UTC so that it lines up with the UTC time axis regardless of the browser's
 * time zone. Formats this parser does not know are handed to `Date.parse`, and the local date and
 * time it returns are read back as UTC. Returns `NaN` if the string cannot be parsed.
 */
export function parseDateTime(value: string, options: DateOrderOptions = {}): number {
    const s = value.trim();
    if (/\d[T ]\d/.test(s) && /(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
        return Date.parse(s) / 1000;
    }
    const [datePart, ...rest] = s.split(/[T\s]+/);
    const timePart = rest.join(' ');
    const day = parseDateOnly(datePart, options);
    if (!isNaN(day)) {
        if (!timePart) return day;
        const time = parseTimeOfDay(timePart);
        if (!isNaN(time)) return day + time;
    }
    // A numeric date that did not parse is invalid (e.g. Feb 30); do not let `Date.parse` roll it over.
    if (/^\d+([-./]\d+){2}$|^\d{4}$/.test(datePart)) return NaN;
    const local = new Date(s);
    if (isNaN(local.getTime())) return NaN;
    return utcSeconds(
        local.getFullYear(),
        local.getMonth() + 1,
        local.getDate(),
        local.getHours(),
        local.getMinutes(),
        local.getSeconds() + local.getMilliseconds() / 1000
    );
}
