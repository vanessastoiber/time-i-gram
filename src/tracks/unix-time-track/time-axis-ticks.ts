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
    /** Label shown in the middle of the axis, under the ticks (e.g. the year when months are labeled). */
    context: string;
    /** Whether to mark the middle of the axis with a tick: the context of absolute dates applies there. */
    contextTick?: boolean;
}

/** The shortest calendar year, in seconds (yearly ticks are 365 or 366 days apart). */
const SHORTEST_YEAR = 365 * DAY;

const formatContextSecond = utcFormat('%Y %b %d (%I:%M:%S %p)');
const formatContextMinute = utcFormat('%Y %b %d (%I:%M %p)');
const formatContextHour = utcFormat('%Y %b %d (%I %p)');
const formatContextDay = utcFormat('%Y %b %d');
const formatContextWeek = utcFormat('%Y %b');
const formatContextMonth = utcFormat('%Y');

/**
 * Context of absolute ticks: the coarser calendar unit around the tick unit (e.g. the year for month ticks).
 * `tickDelta` is in seconds.
 */
function absoluteContext(date: Date, tickDelta: number) {
    if (tickDelta < UNIT_SECONDS.second) return formatContextSecond(date);
    if (tickDelta < UNIT_SECONDS.minute) return formatContextMinute(date);
    if (tickDelta < UNIT_SECONDS.hour) return formatContextHour(date);
    if (tickDelta < DAY) return formatContextDay(date);
    if (tickDelta < WEEK) return formatContextWeek(date);
    if (tickDelta < SHORTEST_YEAR) return formatContextMonth(date);
    return '';
}

/**
 * Ticks and labels of a time axis with the visible `domain` (seconds) in the time coordinate system `cs`:
 * absolute dates, positions within a period (Jan...Dec, W1...W53, Mon...Sun, 00:00...23:00), or offsets.
 */
export function timeAxisTicks(
    domain: [number, number],
    cs: TimeCoordinateSystem = ABSOLUTE_TIME,
    count = 10
): TimeAxisTicks {
    switch (cs.kind) {
        case 'absolute':
            return absoluteTicks(domain, count);
        case 'period':
            return periodTicks(domain, cs, count);
        case 'relative':
            return relativeTicks(domain, cs, count);
    }
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

function absoluteTicks(domain: [number, number], count: number): TimeAxisTicks {
    const scale = scaleUtc().domain(domain.map(d => d * 1000));
    const dates = scale.ticks(count);
    const format = scale.tickFormat(count);
    const center = new Date(((domain[0] + domain[1]) / 2) * 1000);
    const delta = dates.length > 1 ? (+dates[1] - +dates[0]) / 1000 : Infinity;
    return {
        ticks: dates.map(d => +d / 1000),
        labels: dates.map(d => format(d)),
        context: absoluteContext(center, delta),
        contextTick: true
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
        return {
            ticks: dates.map(d => +d / 1000),
            labels: dates.map(d =>
                isDayStart(d) ? `${weekLabel(+d / 1000)} ${formatWeekday(d)}` : formatWeekdayTime(d)
            ),
            context: ''
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
