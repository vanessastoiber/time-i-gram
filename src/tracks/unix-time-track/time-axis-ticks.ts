import { scaleUtc } from 'd3-scale';
import { utcFormat } from 'd3-time-format';
import { scaleLinear } from 'd3-scale';
import { format } from 'd3-format';
import type { TimeUnit } from '@gosling-lang/gosling-schema';
import {
    ABSOLUTE_TIME,
    WEEKS_IN_REF_YEAR,
    periodReference,
    type PeriodTime,
    type RelativeTime,
    type TimeCoordinateSystem
} from '../../core/utils/time-coordinate-system';
import { DAY, UNIT_SECONDS, WEEK } from '../../core/utils/time-units';

/** Ticks of a time axis: positions (in axis coordinates, i.e. seconds) and labels, plus a context label. */
export interface TimeAxisTicks {
    ticks: number[];
    labels: string[];
    /** Label shown in the middle of the axis, under the ticks: the visible range at a coarser unit (e.g. the
     * years when months are labeled), the visible weeks, or what offsets count. */
    context: string;
}

/** The shortest calendar year, in seconds (yearly ticks are 365 or 366 days apart). */
const SHORTEST_YEAR = 365 * DAY;

const formatYear = utcFormat('%Y');
const formatYearMonth = utcFormat('%Y %b');
const formatDate = utcFormat('%Y %b %-d');
const formatDayOfMonthOnly = utcFormat('%-d');
const formatMonthDayOnly = utcFormat('%b %-d');
const formatMonthOnly = utcFormat('%b');
const formatContextMinute = utcFormat('%Y %b %-d, %H:%M');
const formatContextSecond = utcFormat('%Y %b %-d, %H:%M:%S');

const EN_DASH = '\u2013';

/**
 * Context of absolute ticks: the coarser calendar unit around the tick unit (e.g. the years for month ticks),
 * for the whole visible range `[start, end]` (seconds), e.g. "2022", "2021\u20132022", "2022 May\u2013Jul",
 * "2016 Feb 3\u20134". Empty when the ticks are years. `tickDelta` is in seconds.
 */
function absoluteContext([start, end]: [number, number], tickDelta: number): string {
    const [a, b] = [new Date(start * 1000), new Date(Math.max(start, end - 0.001) * 1000)];
    const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
    const sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth();
    const range = (format: (d: Date) => string) =>
        format(a) === format(b) ? format(a) : `${format(a)} ${EN_DASH} ${format(b)}`;
    if (tickDelta < UNIT_SECONDS.second) return range(formatContextSecond);
    if (tickDelta < UNIT_SECONDS.minute) return range(formatContextMinute);
    if (tickDelta < UNIT_SECONDS.hour) {
        // minute ticks: the visible times, e.g. "2016 Feb 3, 12:35\u201313:35"
        if (formatDate(a) !== formatDate(b)) return range(formatContextMinute);
        return `${formatDate(a)}, ${formatTickTime(a)}${EN_DASH}${formatTickTime(new Date(end * 1000))}`;
    }
    if (tickDelta < DAY) {
        if (sameMonth)
            return formatDate(a) === formatDate(b)
                ? formatDate(a)
                : `${formatDate(a)}${EN_DASH}${formatDayOfMonthOnly(b)}`;
        return sameYear ? `${formatDate(a)} ${EN_DASH} ${formatMonthDayOnly(b)}` : range(formatDate);
    }
    if (tickDelta < WEEK * 4) {
        if (sameMonth) return formatYearMonth(a);
        return sameYear ? `${formatYearMonth(a)}${EN_DASH}${formatMonthOnly(b)}` : range(formatYearMonth);
    }
    if (tickDelta < SHORTEST_YEAR) return sameYear ? formatYear(a) : `${formatYear(a)}${EN_DASH}${formatYear(b)}`;
    return '';
}

/**
 * Ticks and labels of a time axis with the visible `domain` (seconds) in the time coordinate system `cs`:
 * absolute dates, positions within a period (Jan...Dec, W1...W53, Mon...Sun, 00:00...23:00), or offsets.
 *
 * With the axis length `width` (px), the number of ticks is reduced from `count` until neighboring labels do
 * not overlap, assuming `charWidth` px per character (about 0.6 of the font size).
 */
export function timeAxisTicks(
    domain: [number, number],
    cs: TimeCoordinateSystem = ABSOLUTE_TIME,
    count = 10,
    width?: number,
    charWidth = 7
): TimeAxisTicks {
    const ticksFor = (n: number): TimeAxisTicks => {
        switch (cs.kind) {
            case 'absolute':
                return absoluteTicks(domain, n);
            case 'period':
                return periodTicks(domain, cs, n);
            case 'relative':
                return relativeTicks(domain, cs, n);
        }
    };
    if (width === undefined) return ticksFor(count);
    let ticks = ticksFor(count);
    for (let n = count - 1; n >= 1 && !labelsFit(ticks, domain, width, charWidth); n--) ticks = ticksFor(n);
    return ticks;
}

/** Minimum space between two labels, in px. */
const LABEL_GAP = 6;

/** Whether neighboring labels, centered on their ticks, leave at least `LABEL_GAP` px between them. */
function labelsFit({ ticks, labels }: TimeAxisTicks, [min, max]: [number, number], width: number, charWidth: number) {
    const px = (t: number) => ((t - min) / (max - min)) * width;
    return ticks.every(
        (t, i) =>
            i === 0 ||
            px(t) - px(ticks[i - 1]) >= ((labels[i].length + labels[i - 1].length) / 2) * charWidth + LABEL_GAP
    );
}

/** Short unit names of offset labels ("+3 wk"). */
export const SHORT_UNIT_NAMES: Record<TimeUnit, string> = {
    millisecond: 'ms',
    second: 's',
    minute: 'min',
    hour: 'h',
    day: 'd',
    week: 'wk',
    month: 'mo',
    quarter: 'q',
    year: 'y',
    decade: 'dec'
};

const PLURAL_UNIT_NAMES: Record<TimeUnit, string> = {
    millisecond: 'milliseconds',
    second: 'seconds',
    minute: 'minutes',
    hour: 'hours',
    day: 'days',
    week: 'weeks',
    month: 'months',
    quarter: 'quarters',
    year: 'years',
    decade: 'decades'
};

/** Units for offset labels, from coarse to fine (quarters and decades only when asked for). */
const AUTO_RELATIVE_UNITS: TimeUnit[] = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

/** The largest unit of which at least two fit in the visible span. */
function autoRelativeUnit(span: number): TimeUnit {
    return AUTO_RELATIVE_UNITS.find(u => span / UNIT_SECONDS[u] >= 2) ?? 'millisecond';
}

const formatOffset = format('~g');

/** Ticks of a relative axis: nice multiples of the unit, labeled as signed offsets ("-2 wk", "0", "+3 wk"). */
function relativeTicks(domain: [number, number], cs: RelativeTime, count: number): TimeAxisTicks {
    const unit = cs.unit ?? autoRelativeUnit(domain[1] - domain[0]);
    const length = UNIT_SECONDS[unit];
    const steps = scaleLinear()
        .domain([domain[0] / length, domain[1] / length])
        .ticks(count);
    const label = (k: number) =>
        k === 0 ? '0' : `${k > 0 ? '+' : '\u2212'}${formatOffset(Math.abs(k))} ${SHORT_UNIT_NAMES[unit]}`;
    return {
        ticks: steps.map(k => k * length),
        labels: steps.map(label),
        context: cs.anchorLabel ? `${PLURAL_UNIT_NAMES[unit]} from ${cs.anchorLabel}` : ''
    };
}

const formatTickMillisecond = utcFormat('.%L');
const formatTickSecond = utcFormat(':%S');
const formatTickTime = utcFormat('%H:%M');
const formatTickDay = utcFormat('%b %-d');
const formatTickMonth = utcFormat('%b');
const formatTickYear = utcFormat('%Y');

/**
 * Label of an absolute tick at the coarsest unit it starts (as d3's multi-scale format, but with 24-hour times
 * and short month names, which stay readable and short): ".250", ":30", "13:00", "Feb 3", "Feb", "2022".
 */
function formatAbsoluteTick(date: Date): string {
    if (date.getUTCMilliseconds() !== 0) return formatTickMillisecond(date);
    if (date.getUTCSeconds() !== 0) return formatTickSecond(date);
    if (date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0) return formatTickTime(date);
    if (date.getUTCDate() !== 1) return formatTickDay(date);
    if (date.getUTCMonth() !== 0) return formatTickMonth(date);
    return formatTickYear(date);
}

function absoluteTicks(domain: [number, number], count: number): TimeAxisTicks {
    const scale = scaleUtc().domain(domain.map(d => d * 1000));
    const dates = scale.ticks(count);
    const format = formatAbsoluteTick;
    const delta = dates.length > 1 ? (+dates[1] - +dates[0]) / 1000 : Infinity;
    return {
        ticks: dates.map(d => +d / 1000),
        labels: dates.map(d => format(d)),
        context: absoluteContext(domain, delta)
    };
}

const formatMonth = utcFormat('%b');
const formatMonthDay = utcFormat('%b %-d');
const formatMonthDayTime = utcFormat('%b %-d %H:%M');
const formatDayOfMonth = utcFormat('%-d');
const formatDayOfMonthTime = utcFormat('%-d %H:%M');
const formatWeekday = utcFormat('%a');
const formatWeekdayTime = utcFormat('%a %H:%M');
const formatTime = utcFormat('%H:%M');

const isDayStart = (d: Date) => +d % (DAY * 1000) === 0;
const isMonthStart = (d: Date) => isDayStart(d) && d.getUTCDate() === 1;

/** Label of a position within a period: never a year, since every period shares the axis. */
function periodLabel(d: Date, cs: PeriodTime): string {
    switch (cs.unit) {
        case 'year':
            return isMonthStart(d) ? formatMonth(d) : isDayStart(d) ? formatMonthDay(d) : formatMonthDayTime(d);
        case 'month':
            return isDayStart(d) ? formatDayOfMonth(d) : formatDayOfMonthTime(d);
        case 'week':
            return isDayStart(d) ? formatWeekday(d) : formatWeekdayTime(d);
        case 'day':
            return formatTime(d);
    }
}

const WEEK_STEPS = [1, 2, 4, 8, 13, 26];

function periodTicks(domain: [number, number], cs: PeriodTime, count: number): TimeAxisTicks {
    const ticks =
        cs.unit === 'year' && cs.weekBased ? weekBasedTicks(domain, cs, count) : calendarPeriodTicks(domain, cs, count);
    // only positions inside the reference period mean something (zoomed out, the axis extends past it); the end
    // of the period is the start of the next one (on a ring, the same angle as the start)
    const [refStart, refEnd] = periodReference(cs);
    const keep = ticks.ticks.map(t => refStart <= t && t < refEnd);
    return { ...ticks, ticks: ticks.ticks.filter((_, i) => keep[i]), labels: ticks.labels.filter((_, i) => keep[i]) };
}

function calendarPeriodTicks(domain: [number, number], cs: PeriodTime, count: number): TimeAxisTicks {
    const dates = scaleUtc()
        .domain(domain.map(d => d * 1000))
        .ticks(count);
    return { ticks: dates.map(d => +d / 1000), labels: dates.map(d => periodLabel(d, cs)), context: '' };
}

/** Week-based years are labeled by ISO week (W1, W5, ...), and by weekday when zoomed in to a few weeks. */
function weekBasedTicks(domain: [number, number], cs: PeriodTime, count: number): TimeAxisTicks {
    const [refStart] = periodReference(cs);
    const weekOf = (t: number) => Math.floor((t - refStart) / WEEK);
    // slots count weeks since the season start; labels follow seasons of 52 weeks, and the last slot holds
    // week 53 (calendar years) or the last week of a season that has a week 53
    const weekNumber = (offset: number) =>
        offset < WEEKS_IN_REF_YEAR - 1
            ? ((cs.start - 1 + offset) % (WEEKS_IN_REF_YEAR - 1)) + 1
            : cs.start === 1
            ? 53
            : cs.start - 1;
    const weekLabel = (t: number) => `W${weekNumber(weekOf(t))}`;
    const spanWeeks = (domain[1] - domain[0]) / WEEK;

    if (spanWeeks < 6) {
        const dates = scaleUtc()
            .domain(domain.map(d => d * 1000))
            .ticks(count);
        // short labels: the week at its start, the weekday at other midnights, otherwise the time
        const isWeekStart = (t: number) => (t - refStart) % WEEK === 0;
        return {
            ticks: dates.map(d => +d / 1000),
            labels: dates.map(d =>
                isWeekStart(+d / 1000) ? weekLabel(+d / 1000) : isDayStart(d) ? formatWeekday(d) : formatTime(d)
            ),
            // the visible weeks, since most labels are weekdays
            context: [weekLabel(domain[0]), weekLabel(domain[1] - 1)]
                .filter((label, i, labels) => labels.indexOf(label) === i)
                .join('\u2013')
        };
    }

    // ticks on round week numbers (W1, W9, W17, ... for a step of 8), whatever week the period starts with
    const step = WEEK_STEPS.find(s => spanWeeks / s <= count) ?? WEEK_STEPS[WEEK_STEPS.length - 1];
    const ticks: number[] = [];
    for (let offset = 0; offset < WEEKS_IN_REF_YEAR; offset++) {
        const t = refStart + offset * WEEK;
        const week = weekNumber(offset);
        if (t >= domain[0] && t <= domain[1] && (week - 1) % step === 0 && offset !== WEEKS_IN_REF_YEAR - 1)
            ticks.push(t);
    }
    return { ticks, labels: ticks.map(weekLabel), context: '' };
}

/**
 * Labels at the ends of a linear axis are moved inside it (a tick at the edge would cut its label); the indices
 * of end labels that then overlap their neighbor, which are hidden. `boxes` are the labels' extents in px, in
 * axis order.
 */
export function crowdedEnds(boxes: { left: number; width: number }[], gap = 4): number[] {
    const overlaps = (a: { left: number; width: number }, b: { left: number; width: number }) =>
        a.left + a.width + gap > b.left;
    const hidden: number[] = [];
    if (boxes.length > 1 && overlaps(boxes[0], boxes[1])) hidden.push(0);
    const last = boxes.length - 1;
    if (last > 1 && overlaps(boxes[last - 1], boxes[last])) hidden.push(last);
    return hidden;
}
