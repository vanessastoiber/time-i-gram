/**
 * Time coordinate systems.
 *
 * Every temporal x axis is a linear scale over seconds. Its *time coordinate system* says which seconds a
 * time maps to:
 *
 * - `absolute`: Unix epoch seconds (the default);
 * - `period`: the position within a calendar period (`x.period`), expressed as seconds inside a fixed
 *   reference period, so that all periods share one axis or one revolution;
 * - `relative`: signed seconds from a reference event (`x.relative`).
 *
 * The coordinate system decides how rows are mapped when data is loaded (`applyTimeCoordinates`), how the
 * time axis labels ticks, and which views may be linked: only views with the same system share coordinates.
 */

import type { Period, PeriodUnit, TimeUnit } from '@gosling-lang/gosling-schema';
import { floorTime, isoWeekDate, isoWeekStart, offsetTime, utcParts } from './time-units';

export type TimeCoordinateSystem = AbsoluteTime | PeriodTime;

export interface AbsoluteTime {
    kind: 'absolute';
}

export interface PeriodTime {
    kind: 'period';
    unit: PeriodUnit;
    weekBased: boolean;
    /** Month (1-12), ISO week (1-52), weekday (1-7) or hour (0-23) at which each period begins. */
    start: number;
}

export const ABSOLUTE_TIME: AbsoluteTime = { kind: 'absolute' };

/** Short identifier of a coordinate system: two axes can share coordinates only if their signatures match. */
export function timeCoordinateSignature(cs: TimeCoordinateSystem): string {
    switch (cs.kind) {
        case 'absolute':
            return 'absolute';
        case 'period':
            return `period:${cs.unit}${cs.weekBased ? ':iso-weeks' : ''}:${cs.start}`;
    }
}

/** Human-readable description, used in warnings. */
export function describeTimeCoordinates(cs: TimeCoordinateSystem): string {
    switch (cs.kind) {
        case 'absolute':
            return 'absolute time';
        case 'period': {
            const details = [cs.unit, ...(cs.weekBased ? ['ISO weeks'] : [])];
            if (cs.start !== defaultPeriodStart(cs.unit, cs.weekBased)) details.push(`start ${cs.start}`);
            return `period (${details.join(', ')})`;
        }
    }
}

/* ----------------------------- Period ----------------------------- */

const DAY = 86400;
const WEEK = 7 * DAY;
/** Monday 2001-01-01, the start of the reference week and of the reference week-based year. */
const REF_MONDAY = Date.UTC(2001, 0, 1) / 1000;
/** The reference week-based year always has room for 53 weeks. */
const WEEKS_IN_REF_YEAR = 53;

export const PERIOD_UNITS: readonly PeriodUnit[] = ['year', 'month', 'week', 'day'];

function defaultPeriodStart(unit: PeriodUnit, weekBased: boolean): number {
    return unit === 'day' ? 0 : 1;
}

/** Valid range of `period.start`, or `undefined` if the unit has no start. */
export function periodStartRange(unit: PeriodUnit, weekBased: boolean): [number, number] | undefined {
    switch (unit) {
        case 'year':
            return weekBased ? [1, 52] : [1, 12];
        case 'week':
            return [1, 7];
        case 'day':
            return [0, 23];
        case 'month':
            return undefined;
    }
}

/** The coordinate system of a `period` property (the unit shorthand or the object form). */
export function periodCoordinates(period: PeriodUnit | Period): PeriodTime {
    const p = typeof period === 'string' ? { unit: period } : period;
    const weekBased = p.unit === 'year' && !!p.weekBased;
    return { kind: 'period', unit: p.unit, weekBased, start: p.start ?? defaultPeriodStart(p.unit, weekBased) };
}

/** Name of the field that receives each row's period. */
export function periodKeyField(field: string, period: PeriodUnit | Period): string {
    return (typeof period === 'object' && period.newField) || `${field}_${typeof period === 'string' ? period : period.unit}`;
}

function utc(year: number, month: number, day = 1) {
    const date = new Date(Date.UTC(2000, 0, 1));
    date.setUTCFullYear(year, month - 1, day);
    return date.getTime() / 1000;
}

/**
 * The reference period, `[start, end)` in Unix seconds: the coordinates of every period lie in it.
 * A year is a leap year (so 29 February has a place and dates align across years), a month has 31 days,
 * a week-based year has 53 weeks.
 */
export function periodReference(cs: PeriodTime): [number, number] {
    switch (cs.unit) {
        case 'year': {
            if (cs.weekBased) return [REF_MONDAY, REF_MONDAY + WEEKS_IN_REF_YEAR * WEEK];
            // the reference year contains February 2000
            const startYear = cs.start <= 2 ? 2000 : 1999;
            return [utc(startYear, cs.start), utc(startYear + 1, cs.start)];
        }
        case 'month':
            return [utc(2000, 1), utc(2000, 2)];
        case 'week': {
            const start = REF_MONDAY + (cs.start - 1) * DAY;
            return [start, start + WEEK];
        }
        case 'day': {
            const start = utc(2000, 1) + cs.start * 3600;
            return [start, start + DAY];
        }
    }
}

/** Days from the most recent period start of a week (weekday `start`) to `t`'s day. */
function daysIntoWeek(t: number, start: number) {
    return (isoWeekDate(t).weekday - start + 7) % 7;
}

/** The start (Unix seconds) of the period that contains `t`. */
export function periodStartOf(t: number, cs: PeriodTime): number {
    switch (cs.unit) {
        case 'year': {
            if (cs.weekBased) {
                const { year, week } = isoWeekDate(t);
                return isoWeekStart(week >= cs.start ? year : year - 1, cs.start);
            }
            const { year, month } = utcParts(t);
            return utc(month >= cs.start ? year : year - 1, cs.start);
        }
        case 'month':
            return floorTime(t, 'month');
        case 'week':
            return floorTime(t, 'day') - daysIntoWeek(t, cs.start) * DAY;
        case 'day': {
            const shifted = t - cs.start * 3600;
            return floorTime(shifted, 'day') + cs.start * 3600;
        }
    }
}

/** The start of the period after the one that contains `t`. */
export function periodEndOf(t: number, cs: PeriodTime): number {
    const start = periodStartOf(t, cs);
    switch (cs.unit) {
        case 'year':
            if (cs.weekBased) return isoWeekStart(isoWeekDate(start).year + 1, cs.start);
            return offsetTime(start, 'year', 1);
        case 'month':
            return offsetTime(start, 'month', 1);
        case 'week':
            return start + WEEK;
        case 'day':
            return start + DAY;
    }
}

/** The coordinate of `t` in a period coordinate system: its position within the reference period. */
export function toPeriodCoordinate(t: number, cs: PeriodTime): number {
    if (!isFinite(t)) return NaN;
    const secondsOfDay = t - floorTime(t, 'day');
    const [refStart] = periodReference(cs);
    switch (cs.unit) {
        case 'year': {
            if (cs.weekBased) {
                const { week, weekday } = isoWeekDate(t);
                // weeks before `start` belong to the previous season, which always has room for a week 53
                const weeks = week >= cs.start ? week - cs.start : week + WEEKS_IN_REF_YEAR - cs.start;
                return refStart + weeks * WEEK + (weekday - 1) * DAY + secondsOfDay;
            }
            const { month, day } = utcParts(t);
            const refYear = utcParts(refStart).year + (month >= cs.start ? 0 : 1);
            return utc(refYear, month, day) + secondsOfDay;
        }
        case 'month':
            return refStart + (utcParts(t).day - 1) * DAY + secondsOfDay;
        case 'week':
            return refStart + daysIntoWeek(t, cs.start) * DAY + secondsOfDay;
        case 'day':
            return refStart + (t - periodStartOf(t, cs));
    }
}

const pad = (n: number, width = 2) => (n < 0 ? '-' + String(-n).padStart(width, '0') : String(n).padStart(width, '0'));

/** The period that contains `t`, as a string that sorts chronologically. */
export function periodKey(t: number, cs: PeriodTime): string {
    if (!isFinite(t)) return '';
    const start = periodStartOf(t, cs);
    switch (cs.unit) {
        case 'year': {
            const year = cs.weekBased ? isoWeekDate(start + 3 * DAY).year : utcParts(start).year;
            const shifted = cs.start !== 1;
            return shifted ? `${pad(year, 4)}/${pad((((year + 1) % 100) + 100) % 100)}` : pad(year, 4);
        }
        case 'month': {
            const { year, month } = utcParts(start);
            return `${pad(year, 4)}-${pad(month)}`;
        }
        case 'week': {
            if (cs.start === 1) {
                const { year, week } = isoWeekDate(start);
                return `${pad(year, 4)}-W${pad(week)}`;
            }
            return isoDate(start);
        }
        case 'day':
            return isoDate(start);
    }
}

function isoDate(t: number) {
    const { year, month, day } = utcParts(t);
    return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/* ----------------------------- Mapping rows ----------------------------- */

/**
 * How a data fetcher maps rows into a time coordinate system. Set by the compiler from the tracks' temporal
 * x channels and passed with the data config (`hgTrack.data.timeCoordinates`).
 */
export interface TimeCoordinatesConfig {
    system: TimeCoordinateSystem;
    /** Fields with times (Unix seconds) and the fields that receive their coordinates. */
    fields: { source: string; coord: string }[];
    /** Fields that receive each row's period (period systems). */
    keyFields?: string[];
    /** Source fields of an interval (`x`, `xe`) that is split where it crosses a period boundary. */
    interval?: [string, string];
}

/** Coordinates of a value at the end of an interval: the end of a period is the end of the reference period. */
function toPeriodEndCoordinate(t: number, cs: PeriodTime) {
    const epsilon = 0.001;
    return toPeriodCoordinate(t - epsilon, cs) + epsilon;
}

const MAX_PIECES = 1000;

/**
 * Add the coordinate fields (and, for periods, the period fields) to rows whose time fields are Unix seconds.
 * Source fields are kept. In a period system, an interval that crosses period boundaries is split into one
 * row per period.
 */
export function applyTimeCoordinates<T extends Record<string, unknown>>(
    rows: T[],
    config: TimeCoordinatesConfig
): (T & Record<string, unknown>)[] {
    const { system } = config;
    if (system.kind === 'absolute') {
        return rows.map(row => {
            const copy: Record<string, unknown> = { ...row };
            config.fields.forEach(({ source, coord }) => (copy[coord] = +(row[source] as number)));
            return copy as T;
        });
    }

    const output: T[] = [];
    rows.forEach(row => {
        const mapRow = (overrides: Record<string, number>) => {
            const copy: Record<string, unknown> = { ...row };
            config.fields.forEach(({ source, coord }) => {
                const t = source in overrides ? overrides[source] : +(row[source] as number);
                copy[coord] = toPeriodCoordinate(t, system);
            });
            const keyTime = config.interval && config.interval[0] in overrides ? overrides[config.interval[0]] : undefined;
            const first = config.fields[0] ? +(row[config.fields[0].source] as number) : NaN;
            config.keyFields?.forEach(key => (copy[key] = periodKey(keyTime ?? first, system)));
            return copy;
        };

        const [startField, endField] = config.interval ?? [];
        const start = startField ? +(row[startField] as number) : NaN;
        const end = endField ? +(row[endField] as number) : NaN;
        if (!startField || !endField || !isFinite(start) || !isFinite(end) || end <= start) {
            output.push(mapRow({}) as T);
            return;
        }

        // split the interval at period boundaries
        let pieceStart = start;
        for (let i = 0; i < MAX_PIECES && pieceStart < end; i++) {
            const pieceEnd = Math.min(periodEndOf(pieceStart, system), end);
            const copy = mapRow({ [startField]: pieceStart });
            const endCoord = config.fields.find(f => f.source === endField)?.coord;
            if (endCoord) copy[endCoord] = toPeriodEndCoordinate(pieceEnd, system);
            output.push(copy as T);
            pieceStart = pieceEnd;
        }
    });
    return output;
}

/* ----------------------------- Tracks ----------------------------- */

/** Internal track property, set by `resolveTemporalSugar()`, read by the compiler and the time axis. */
export interface TrackTimeCoordinates extends TimeCoordinatesConfig {
    __brand?: 'TrackTimeCoordinates';
}

/** The time coordinate system of a (resolved) track: `undefined` if the track has no temporal x axis. */
export function getTrackTimeCoordinates(track: object): TrackTimeCoordinates | undefined {
    return (track as { _timeCoordinates?: TrackTimeCoordinates })._timeCoordinates;
}

export function setTrackTimeCoordinates(track: object, config: TrackTimeCoordinates | undefined) {
    (track as { _timeCoordinates?: TrackTimeCoordinates })._timeCoordinates = config;
}

/* ----------------------------- Time units ----------------------------- */

/** Aggregations computed per time unit (`x.timeUnit` with an `aggregate` channel). */
export type TimeAggregateOp = 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max';
export const TIME_AGGREGATE_OPS: readonly TimeAggregateOp[] = ['count', 'sum', 'mean', 'median', 'min', 'max'];

/** Internal spec of `x.timeUnit` on a resolved track, set by `resolveTemporalSugar()`. */
export interface TimeUnitBinning {
    unit: TimeUnit;
    /** Field with the raw times (Unix seconds). */
    source: string;
    /** Fields that receive the coordinates of the start (`x`) and end (`xe`) of each row's unit. */
    field: string;
    endField: string;
    /** Fields of nominal channels: rows are grouped by unit and by these fields. */
    groupby: string[];
    /** Aggregated channels; empty if rows are only truncated. */
    aggregates: { field: string; op: TimeAggregateOp }[];
}

/**
 * Units of the members of a HiGlass track, used to assign rows to tiles so that each unit lies entirely in one
 * tile: a row belongs to the tiles that contain the start of its unit, for any of `units`, or (with `raw`) its
 * own coordinate.
 */
export interface TimeUnitTiling {
    source: string;
    units: TimeUnit[];
    raw: boolean;
}

export function getTrackTimeUnit(track: object): TimeUnitBinning | undefined {
    return (track as { _timeUnit?: TimeUnitBinning })._timeUnit;
}

export function setTrackTimeUnit(track: object, binning: TimeUnitBinning | undefined) {
    (track as { _timeUnit?: TimeUnitBinning })._timeUnit = binning;
}

export function getTrackTimeUnitTiling(track: object): TimeUnitTiling | undefined {
    return (track as { _timeUnitTiling?: TimeUnitTiling })._timeUnitTiling;
}

export function setTrackTimeUnitTiling(track: object, tiling: TimeUnitTiling | undefined) {
    (track as { _timeUnitTiling?: TimeUnitTiling })._timeUnitTiling = tiling;
}

/** Units that lie within a period, i.e. that can be aggregated inside a period coordinate system. */
export function unitsWithinPeriod(cs: PeriodTime): TimeUnit[] {
    const subDay: TimeUnit[] = ['millisecond', 'second', 'minute', 'hour'];
    switch (cs.unit) {
        case 'year':
            return cs.weekBased ? [...subDay, 'day', 'week'] : [...subDay, 'day', 'month', 'quarter'];
        case 'month':
        case 'week':
            return [...subDay, 'day'];
        case 'day':
            return subDay;
    }
}

/** Coordinate of the start of the unit that contains `t` (Unix seconds) in a time coordinate system. */
export function unitStartCoordinate(t: number, unit: TimeUnit, cs: TimeCoordinateSystem): number {
    const start = floorTime(t, unit);
    return cs.kind === 'period' ? toPeriodCoordinate(start, cs) : start;
}

/** Coordinate of the end of the unit that contains `t`. */
export function unitEndCoordinate(t: number, unit: TimeUnit, cs: TimeCoordinateSystem): number {
    const end = offsetTime(floorTime(t, unit), unit, 1);
    return cs.kind === 'period' ? toPeriodEndCoordinate(end, cs) : end;
}

/**
 * Whether a row belongs to the tile `(minX, maxX]`: by the start of its unit (`unit`), or by its own coordinate
 * (`coordField`) when `unit` is undefined.
 */
export function isRowInTile(
    row: Record<string, unknown>,
    [minX, maxX]: [number, number],
    unit: TimeUnit | undefined,
    source: string,
    coordField: string,
    cs: TimeCoordinateSystem
): boolean {
    const value = unit ? unitStartCoordinate(+(row[source] as number), unit, cs) : +(row[coordField] as number);
    return minX < value && value <= maxX;
}

/**
 * The rows of a tile `(minX, maxX]` of a track that aggregates by time unit: rows whose unit starts in the tile,
 * for any unit of the track's members, plus (if a member draws raw rows) rows whose own coordinate is in it.
 * So every unit is aggregated from all of its rows, in exactly one tile.
 */
export function filterByTimeUnits<T extends Record<string, unknown>>(
    rows: T[],
    tile: [number, number],
    config: { x?: string; timeUnitTiling?: TimeUnitTiling; timeCoordinates?: TimeCoordinatesConfig }
): T[] {
    const tiling = config.timeUnitTiling;
    if (!tiling) return rows;
    const cs = config.timeCoordinates?.system ?? ABSOLUTE_TIME;
    const coordField = config.x ?? tiling.source;
    return rows.filter(
        row =>
            (tiling.raw && isRowInTile(row, tile, undefined, tiling.source, coordField, cs)) ||
            tiling.units.some(unit => isRowInTile(row, tile, unit, tiling.source, coordField, cs))
    );
}
