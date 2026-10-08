/**
 * Calendar arithmetic for temporal axes: the granularity hierarchy (`TimeUnit`), truncation and offsets,
 * ISO weeks, date strings and durations. Times are Unix epoch seconds; every computation is in UTC.
 */

import type { TimeUnit, TimeValue } from '@gosling-lang/gosling-schema';

export type { TimeUnit, TimeValue };

/** The granularity hierarchy, from fine to coarse. `week` is the ISO week (Monday to Sunday). */
export const TIME_UNITS: readonly TimeUnit[] = [
    'millisecond',
    'second',
    'minute',
    'hour',
    'day',
    'week',
    'month',
    'quarter',
    'year',
    'decade'
];

const DAY = 86400;
const WEEK = 7 * DAY;
/** A mean Gregorian year (365.2425 days), the nominal length of `year` in durations. */
const MEAN_YEAR = 365.2425 * DAY;

/**
 * Length of a unit in seconds. Exact up to `week`; `month`, `quarter`, `year` and `decade` use
 * nominal lengths based on the mean Gregorian year (a month is 30.436875 days).
 */
export const UNIT_SECONDS: Readonly<Record<TimeUnit, number>> = {
    millisecond: 0.001,
    second: 1,
    minute: 60,
    hour: 3600,
    day: DAY,
    week: WEEK,
    month: MEAN_YEAR / 12,
    quarter: MEAN_YEAR / 4,
    year: MEAN_YEAR,
    decade: 10 * MEAN_YEAR
};

/** Whether a unit always has the same length in seconds. */
export function isFixedLengthUnit(unit: TimeUnit): boolean {
    return TIME_UNITS.indexOf(unit) <= TIME_UNITS.indexOf('week');
}

/** Whether `a` is a finer unit than `b`. */
export function isFinerUnit(a: TimeUnit, b: TimeUnit): boolean {
    return TIME_UNITS.indexOf(a) < TIME_UNITS.indexOf(b);
}

/** Unix seconds of a UTC calendar date; month and day may overflow (month 13 is January of the next year). */
function utc(year: number, month: number, day = 1, secondsOfDay = 0): number {
    const date = new Date(Date.UTC(2000, 0, 1));
    // `Date.UTC` maps years 0-99 to 1900-1999, so set the full year explicitly.
    date.setUTCFullYear(year, month - 1, day);
    return date.getTime() / 1000 + secondsOfDay;
}

/** Calendar parts of an instant (UTC); `month` is 1-12. */
export function utcParts(t: number) {
    const date = new Date(t * 1000);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const secondsOfDay = t - utc(year, month, day);
    return { year, month, day, secondsOfDay };
}

export function daysInMonth(year: number, month: number): number {
    return (utc(year, month + 1, 1) - utc(year, month, 1)) / DAY;
}

/** Monday 1969-12-29, the start of the ISO week that contains the Unix epoch. */
const EPOCH_MONDAY = -3 * DAY;

/** The start of the unit that contains `t` (rounds toward the past, also before 1970). */
export function floorTime(t: number, unit: TimeUnit): number {
    switch (unit) {
        case 'millisecond':
            return Math.floor(t * 1000) / 1000;
        case 'second':
        case 'minute':
        case 'hour':
        case 'day':
            return Math.floor(t / UNIT_SECONDS[unit]) * UNIT_SECONDS[unit];
        case 'week':
            return Math.floor((t - EPOCH_MONDAY) / WEEK) * WEEK + EPOCH_MONDAY;
    }
    const { year, month } = utcParts(t);
    switch (unit) {
        case 'month':
            return utc(year, month);
        case 'quarter':
            return utc(year, month - ((month - 1) % 3));
        case 'year':
            return utc(year, 1);
        case 'decade':
            return utc(year - (((year % 10) + 10) % 10), 1);
    }
    return t;
}

/**
 * Move `t` by `n` whole units. Fixed-length units add their length; months, quarters, years and
 * decades move on the calendar and keep the day of the month, clamped to the length of the target month
 * (31 January + 1 month = end of February).
 */
export function offsetTime(t: number, unit: TimeUnit, n: number): number {
    if (isFixedLengthUnit(unit)) return t + n * UNIT_SECONDS[unit];
    const months = n * { month: 1, quarter: 3, year: 12, decade: 120 }[unit as 'month'];
    const { year, month, day, secondsOfDay } = utcParts(t);
    const index = year * 12 + (month - 1) + months;
    const newYear = Math.floor(index / 12);
    const newMonth = index - newYear * 12 + 1;
    return utc(newYear, newMonth, Math.min(day, daysInMonth(newYear, newMonth)), secondsOfDay);
}

/** The start of the unit after the one that contains `t`. */
export function ceilUnitEnd(t: number, unit: TimeUnit): number {
    return offsetTime(floorTime(t, unit), unit, 1);
}

/* ----------------------------- ISO weeks ----------------------------- */

/** ISO week date of an instant: week-year, week (1-53) and weekday (1 = Monday ... 7 = Sunday). */
export function isoWeekDate(t: number) {
    const monday = floorTime(t, 'week');
    const thursday = monday + 3 * DAY;
    const year = utcParts(thursday).year;
    const week = Math.floor((thursday - utc(year, 1)) / WEEK) + 1;
    const weekday = Math.floor((t - monday) / DAY) + 1;
    return { year, week, weekday };
}

/** Number of ISO weeks (52 or 53) in an ISO week-year. */
export function isoWeeksInYear(year: number): number {
    return isoWeekDate(utc(year, 12, 28)).week;
}

/** Monday 00:00 UTC of an ISO week, or `NaN` if the week does not exist in that year. */
export function isoWeekStart(year: number, week: number): number {
    if (!Number.isInteger(week) || week < 1 || week > isoWeeksInYear(year)) return NaN;
    // 4 January is always in week 1
    return floorTime(utc(year, 1, 4), 'week') + (week - 1) * WEEK;
}

/* ----------------------------- Date strings ----------------------------- */

const YEAR = '(\\d{4,})';
const DATE_TIME = new RegExp(
    `^${YEAR}-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2})(?::(\\d{2})(\\.\\d+)?)?(Z|[+-]\\d{2}:?\\d{2})?$`
);

/**
 * The unit a partial date string names, and its first instant; `undefined` if the string is not a
 * partial date. Accepts `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, `YYYY-Qn` and `YYYY-Www` (ISO week).
 */
function parsePartialDate(s: string): { start: number; unit: TimeUnit } | undefined {
    let m: RegExpMatchArray | null;
    if ((m = s.match(new RegExp(`^${YEAR}$`)))) {
        return { start: utc(+m[1], 1), unit: 'year' };
    }
    if ((m = s.match(new RegExp(`^${YEAR}-(\\d{2})$`)))) {
        const month = +m[2];
        if (month < 1 || month > 12) return undefined;
        return { start: utc(+m[1], month), unit: 'month' };
    }
    if ((m = s.match(new RegExp(`^${YEAR}-(\\d{2})-(\\d{2})$`)))) {
        const [year, month, day] = [+m[1], +m[2], +m[3]];
        if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return undefined;
        return { start: utc(year, month, day), unit: 'day' };
    }
    if ((m = s.match(new RegExp(`^${YEAR}-Q([1-4])$`)))) {
        return { start: utc(+m[1], (+m[2] - 1) * 3 + 1), unit: 'quarter' };
    }
    if ((m = s.match(new RegExp(`^${YEAR}-W(\\d{2})$`)))) {
        const start = isoWeekStart(+m[1], +m[2]);
        return isNaN(start) ? undefined : { start, unit: 'week' };
    }
    return undefined;
}

/**
 * Convert a time value to Unix seconds, or `NaN` if it is not a valid time.
 *
 * - A number is Unix seconds.
 * - A partial date (`2010`, `2010-12`, `2010-12-31`, `2010-Q4`, `2015-W53`) denotes the first instant of the
 *   unit it names when used as a start (`bound = "start"`), and the end of that unit, i.e. the first instant
 *   of the next one, when used as an end (`bound = "end"`). So `["2000-01", "2010-12"]` covers January 2000
 *   through December 2010.
 * - A date-time (`2010-01-03T23:00:00Z`, `2010-01-03 23:00`, `…+01:00`) is that exact instant; without a
 *   zone it is read as UTC.
 */
export function parseTimeValue(value: TimeValue, bound: 'start' | 'end' = 'start'): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    const s = value.trim();
    const partial = parsePartialDate(s);
    if (partial) return bound === 'start' ? partial.start : offsetTime(partial.start, partial.unit, 1);
    const m = s.match(DATE_TIME);
    if (!m) return NaN;
    const [, year, month, day, hour, minute, second = '0', fraction = '', zone = 'Z'] = m;
    if (+month < 1 || +month > 12 || +day < 1 || +day > daysInMonth(+year, +month)) return NaN;
    if (+hour > 23 || +minute > 59 || +second > 59) return NaN;
    const local = utc(+year, +month, +day, +hour * 3600 + +minute * 60 + +second + (fraction ? +fraction : 0));
    if (zone === 'Z') return local;
    const sign = zone[0] === '-' ? -1 : 1;
    const digits = zone.slice(1).replace(':', '');
    return local - sign * (+digits.slice(0, 2) * 3600 + +digits.slice(2) * 60);
}

/** Whether a string is a date string accepted by `parseTimeValue`. */
export function isTimeString(value: unknown): value is string {
    return typeof value === 'string' && !isNaN(parseTimeValue(value));
}

/* ----------------------------- Durations ----------------------------- */

/** A length of time: seconds, or a string such as `"3 months"`, `"2 weeks"` or `"-36 mo"`. */
export type DurationValue = number | string;

const UNIT_ALIASES: Record<string, TimeUnit> = {
    ms: 'millisecond',
    s: 'second',
    sec: 'second',
    min: 'minute',
    h: 'hour',
    hr: 'hour',
    d: 'day',
    w: 'week',
    wk: 'week',
    mo: 'month',
    q: 'quarter',
    y: 'year',
    yr: 'year',
    dec: 'decade'
};

/** Read a unit name: singular or plural (`month`, `months`) or a short form (`mo`). */
export function parseUnitName(name: string): TimeUnit | undefined {
    const lower = name.toLowerCase();
    if (UNIT_ALIASES[lower]) return UNIT_ALIASES[lower];
    const singular = lower.endsWith('s') ? lower.slice(0, -1) : lower;
    if ((TIME_UNITS as string[]).includes(lower)) return lower as TimeUnit;
    if ((TIME_UNITS as string[]).includes(singular)) return singular as TimeUnit;
    if (UNIT_ALIASES[singular]) return UNIT_ALIASES[singular];
    return undefined;
}

/** The number and unit of a duration string (`"-36 months"` is `{ value: -36, unit: "month" }`), if valid. */
export function parseDurationParts(value: string): { value: number; unit: TimeUnit } | undefined {
    const m = value.trim().match(/^([+-]?\d+(?:\.\d+)?|[+-]?\.\d+)\s*([a-zA-Z]+)$/);
    const unit = m ? parseUnitName(m[2]) : undefined;
    return m && unit ? { value: +m[1], unit } : undefined;
}

/**
 * Add `n` units to `t` on the calendar: whole units with `offsetTime` (months keep the day of the month),
 * the fraction at the unit's nominal length.
 */
export function addDuration(t: number, unit: TimeUnit, n: number): number {
    const whole = Math.trunc(n);
    return offsetTime(t, unit, whole) + (n - whole) * UNIT_SECONDS[unit];
}

/**
 * Convert a duration to seconds, or `NaN` if it is not valid. A number is seconds. A string is
 * `<number> <unit>`, e.g. `"90 minutes"`, `"1.5 days"`, `"-2 wk"`. Units up to a week have their exact length;
 * a month is 1/12 of a mean Gregorian year (30.436875 days), a quarter 3 months, a year 365.2425 days and a
 * decade 10 years. A duration is a length, not calendar arithmetic.
 */
export function parseDuration(value: DurationValue): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    const parts = parseDurationParts(value);
    return parts ? parts.value * UNIT_SECONDS[parts.unit] : NaN;
}
