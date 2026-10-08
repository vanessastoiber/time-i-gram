import type {
    ChannelDeep,
    CommonTrackDef,
    CommonViewDef,
    GoslingSpec,
    SingleTrack,
    Track,
    VisibilityCondition
} from '@gosling-lang/gosling-schema';
import { IsChannelDeep, IsOverlaidTrack } from '@gosling-lang/gosling-schema';
import { getTemporalChannelFromTrack } from '../gosling-schema/validate';
import { parseDuration, parseTimeValue } from '../core/utils/time-units';
import {
    ABSOLUTE_TIME,
    PERIOD_UNITS,
    describeTimeCoordinates,
    getTrackTimeCoordinates,
    periodCoordinates,
    periodKeyField,
    periodReference,
    periodStartRange,
    setTrackTimeCoordinates,
    timeCoordinateSignature,
    type TimeCoordinateSystem,
    type TrackTimeCoordinates
} from '../core/utils/time-coordinate-system';
import { traverseTracksAndViews } from './spec-preprocess';

const X_CHANNELS = ['x', 'xe', 'x1', 'x1e'] as const;

/**
 * Resolve the temporal syntactic sugar of a spec, after `traverseToFixSpecDownstream()`:
 * date strings in time intervals and durations in `visibility` thresholds and `zoomLimits` become seconds.
 * Downstream code (compiler, tracks, fetchers) therefore only sees numbers. Invalid uses are removed with a
 * warning; the returned messages are the same warnings.
 *
 * Idempotent: numbers are kept as they are, so the function can run again after a responsive re-fix.
 */
export function resolveTemporalSugar(spec: GoslingSpec): string[] {
    const messages: string[] = [];
    const warn = (message: string) => {
        messages.push(message);
        console.warn(`[time-i-gram] ${message}`);
    };

    // Tracks first: a view's `xDomain` object is shared by reference with the `x.domain` of its tracks, and
    // only a track knows whether its channel is temporal (strings) or genomic (no strings allowed).
    const views: (CommonViewDef | CommonTrackDef)[] = [spec];
    traverseTracksAndViews(spec, tv => {
        if (IsTrackDef(tv)) resolveTrack(tv as Track, warn);
        else views.push(tv);
    });
    views.forEach(view => resolveViewDef(view, warn));
    return messages;
}

type Warn = (message: string) => void;

/**
 * After `traverseToFixSpecDownstream()`, views hold `tracks` or `views`; tracks hold neither
 * (flattened overlaid tracks keep a `tracks: undefined` key).
 */
function IsTrackDef(tv: CommonViewDef | CommonTrackDef) {
    return !(tv as { tracks?: unknown }).tracks && !(tv as { views?: unknown }).views;
}

/** View-level `xDomain` and `zoomLimits`; strings in a view's `xDomain` are always time values. */
function resolveViewDef(def: CommonViewDef | CommonTrackDef, warn: Warn) {
    const { xDomain } = def;
    if (xDomain && 'interval' in xDomain && !('chromosome' in xDomain)) {
        const resolved = resolveInterval(xDomain.interval, warn);
        if (resolved) xDomain.interval = resolved;
        else def.xDomain = undefined;
    }
}

function resolveTrack(track: Track, warn: Warn) {
    const isTemporal = !!getTemporalChannelFromTrack(track as SingleTrack);
    const members: Partial<SingleTrack>[] = IsOverlaidTrack(track) ? [track, ...track.overlay] : [track as SingleTrack];

    // tracks also carry the inherited view-level `xDomain`
    const def = track as CommonTrackDef;
    const { xDomain } = def;
    if (xDomain && 'interval' in xDomain && (xDomain.interval as (number | string)[]).some(d => typeof d === 'string')) {
        if (isTemporal) resolveViewDef(def, warn);
        else def.xDomain = undefined;
    }

    if (track.zoomLimits) {
        if (track.zoomLimits.some(d => typeof d === 'string') && !isTemporal) {
            warn(`zoomLimits ${JSON.stringify(track.zoomLimits)}: durations need a temporal x axis, so they are ignored.`);
            track.zoomLimits = [1, null];
        } else {
            track.zoomLimits = track.zoomLimits.map(d => {
                if (d === null || typeof d === 'number') return d;
                const seconds = parseDuration(d);
                if (isNaN(seconds)) warn(`zoomLimits: "${d}" is not a duration (e.g. "1 hour"), so it is ignored.`);
                return isNaN(seconds) ? null : seconds;
            }) as [number | null, number | null];
        }
    }

    members.forEach(member => {
        X_CHANNELS.forEach(key => {
            const channel = member[key] as ChannelDeep | undefined;
            if (!IsChannelDeep(channel) || !channel.domain || !('interval' in (channel.domain as object))) return;
            const domain = channel.domain as { interval: (number | string)[] };
            if (!domain.interval.some(d => typeof d === 'string')) return;
            if (channel.type !== 'temporal') {
                warn(`${key}.domain ${JSON.stringify(domain.interval)}: date strings need a temporal channel, so the domain is ignored.`);
                channel.domain = undefined;
                return;
            }
            const resolved = resolveInterval(domain.interval, warn);
            if (resolved) domain.interval = resolved;
            else channel.domain = undefined;
        });

        if (member.visibility) {
            member.visibility = member.visibility.filter(condition => resolveThreshold(condition, isTemporal, warn));
        }
    });

    if (isTemporal) resolveTimeCoordinates(track, warn);
}

/**
 * Determine the time coordinate system of a track from its temporal x channels (`period`, later `relative`),
 * rewrite those channels to the coordinate fields that the data fetcher adds, and store the mapping on the
 * track (`_timeCoordinates`) for the compiler, the fetcher and the time axis.
 * Absolute time needs no mapping, so such tracks are left exactly as they are.
 */
function resolveTimeCoordinates(track: Track, warn: Warn) {
    // already resolved (the compiler runs this again after a responsive re-fix)
    if (getTrackTimeCoordinates(track)) return;
    const members: Partial<SingleTrack>[] = IsOverlaidTrack(track) ? [track, ...track.overlay] : [track as SingleTrack];
    const inheritedDomain = (track as CommonTrackDef).xDomain;

    let system: TimeCoordinateSystem | undefined;
    const config: TrackTimeCoordinates = { system: ABSOLUTE_TIME, fields: [], keyFields: [] };

    members.forEach(member => {
        const x = member.x;
        if (!IsChannelDeep(x) || x.type !== 'temporal') return;
        const memberSystem = resolveMemberSystem(member, warn);
        if (system && timeCoordinateSignature(system) !== timeCoordinateSignature(memberSystem)) {
            warn(
                `Overlaid tracks use different time coordinate systems (${describeTimeCoordinates(system)} and ` +
                    `${describeTimeCoordinates(memberSystem)}); the second one is drawn in ${describeTimeCoordinates(system)}.`
            );
        }
        system = system ?? memberSystem;
        if (system.kind === 'absolute') return;

        if (system.kind === 'period' && x.field && x.period) {
            const keyField = periodKeyField(x.field, x.period);
            if (!config.keyFields!.includes(keyField)) config.keyFields!.push(keyField);
        }

        // rewrite every temporal x channel of this member to its coordinate field
        const sourceOf: Partial<Record<(typeof X_CHANNELS)[number], string>> = {};
        X_CHANNELS.forEach(key => {
            const channel = member[key];
            if (!IsChannelDeep(channel) || channel.type !== 'temporal' || !channel.field) return;
            sourceOf[key] = channel.field;
            const coord = coordinateField(channel.field, system!);
            if (!config.fields.find(f => f.coord === coord)) config.fields.push({ source: channel.field, coord });
            channel.field = coord;
        });
        if (sourceOf.x && sourceOf.xe) config.interval = [sourceOf.x, sourceOf.xe];

        // the x domain of a period axis is the reference period
        if (system.kind === 'period') {
            // `traverseToFixSpecDownstream()` copies the view's `xDomain` into `x.domain`: only warn about own domains
            if (x.domain && JSON.stringify(x.domain) !== JSON.stringify(inheritedDomain)) {
                warn('A `domain` on a `period` channel is not supported; the whole period is shown.');
            }
            x.domain = { interval: periodReference(system) };
        }
    });

    if (system && system.kind !== 'absolute') {
        config.system = system;
        setTrackTimeCoordinates(track, config);
    }
}

/** Name of the field that holds the coordinates of a time field. */
function coordinateField(field: string, system: TimeCoordinateSystem) {
    return `__${system.kind}_${field}`;
}

/** Validate and normalize `x.period` of one track definition and return its coordinate system. */
function resolveMemberSystem(member: Partial<SingleTrack>, warn: Warn): TimeCoordinateSystem {
    const x = member.x;
    if (!IsChannelDeep(x) || !('period' in x) || x.period === undefined) return ABSOLUTE_TIME;
    const period = typeof x.period === 'string' ? { unit: x.period } : { ...x.period };
    if (!PERIOD_UNITS.includes(period.unit)) {
        warn(`period "${period.unit}" is not one of ${PERIOD_UNITS.join(', ')}, so the axis is not wrapped.`);
        x.period = undefined;
        return ABSOLUTE_TIME;
    }
    if (period.weekBased && period.unit !== 'year') {
        warn(`period.weekBased only applies to years, so it is ignored for "${period.unit}".`);
        period.weekBased = undefined;
    }
    if (period.start !== undefined) {
        const range = periodStartRange(period.unit, !!period.weekBased);
        if (!range || !Number.isInteger(period.start) || period.start < range[0] || period.start > range[1]) {
            warn(
                range
                    ? `period.start ${period.start} is outside ${range[0]}-${range[1]} for "${period.unit}", so it is ignored.`
                    : `period.start is not supported for "${period.unit}", so it is ignored.`
            );
            period.start = undefined;
        }
    }
    x.period = period;
    return periodCoordinates(period);
}

/** Convert both bounds of an interval to seconds; `undefined` (after a warning) if a bound is invalid. */
function resolveInterval(interval: (number | string)[], warn: Warn): [number, number] | undefined {
    const start = parseTimeValue(interval[0], 'start');
    const end = parseTimeValue(interval[1], 'end');
    if (isNaN(start) || isNaN(end)) {
        const bad = isNaN(start) ? interval[0] : interval[1];
        warn(`interval ${JSON.stringify(interval)}: "${bad}" is not a date (e.g. "2010", "2010-12", "2010-12-31", "2010-12-31T12:00:00Z"), so the domain is ignored.`);
        return undefined;
    }
    return [start, end];
}

/** Convert a duration threshold to seconds; `false` if the condition must be dropped. */
function resolveThreshold(condition: VisibilityCondition, isTemporal: boolean, warn: Warn): boolean {
    if (condition.measure !== 'zoomLevel' || typeof condition.threshold !== 'string') return true;
    if (!isTemporal) {
        warn(`visibility threshold "${condition.threshold}": durations need a temporal x axis, so the condition is ignored.`);
        return false;
    }
    const seconds = parseDuration(condition.threshold);
    if (isNaN(seconds)) {
        warn(`visibility threshold "${condition.threshold}" is not a duration (e.g. "3 months"), so the condition is ignored.`);
        return false;
    }
    condition.threshold = seconds;
    return true;
}
