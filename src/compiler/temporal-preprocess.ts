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
