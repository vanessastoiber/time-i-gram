import type {
    SpanTransform,
    PeriodUnit,
    TimeUnit,
    TimeUnitRule,
    X,
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
import { TIME_UNITS, UNIT_SECONDS, parseDuration, parseTimeValue } from '../core/utils/time-units';
import {
    ABSOLUTE_TIME,
    PERIOD_UNITS,
    describeTimeCoordinates,
    describeAnchor,
    getTrackTimeCoordinates,
    RELATIVE_UNITS,
    type RelativeAnchor,
    type RelativeConfig,
    type RelativeTime,
    periodCoordinates,
    periodKeyField,
    periodReference,
    periodStartRange,
    setTrackTimeCoordinates,
    timeCoordinateSignature,
    type TimeCoordinateSystem,
    type TrackTimeCoordinates,
    TIME_AGGREGATE_OPS,
    getTrackTimeUnit,
    setTrackTimeUnit,
    setTrackTimeUnitTiling,
    unitsWithinPeriod,
    type TimeAggregateOp,
    type TimeUnitBinning
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
    if (isTemporal) expandGranularityRules(track, warn);
    const members: Partial<SingleTrack>[] = IsOverlaidTrack(track) ? [track, ...track.overlay] : [track as SingleTrack];

    // tracks also carry the inherited view-level `xDomain`
    const def = track as CommonTrackDef;
    const { xDomain } = def;
    if (
        xDomain &&
        'interval' in xDomain &&
        (xDomain.interval as (number | string)[]).some(d => typeof d === 'string')
    ) {
        if (isTemporal) resolveViewDef(def, warn);
        else def.xDomain = undefined;
    }

    if (track.zoomLimits) {
        if (track.zoomLimits.some(d => typeof d === 'string') && !isTemporal) {
            warn(
                `zoomLimits ${JSON.stringify(track.zoomLimits)}: durations need a temporal x axis, so they are ignored.`
            );
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
                warn(
                    `${key}.domain ${JSON.stringify(
                        domain.interval
                    )}: date strings need a temporal channel, so the domain is ignored.`
                );
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

    if (isTemporal) {
        resolveTimeCoordinates(track, warn);
        resolveTimeUnits(track, warn);
    }
}

/**
 * Granularity transition rules (`x.timeUnit` as a list of `{ unit, maxSpan }`) are shorthand: the track (or
 * overlaid track) becomes one overlaid copy per rule, with that rule's unit and `visibility` conditions that
 * show it while the visible span is at or above the previous rule's `maxSpan` and below its own.
 * User-defined `visibility` conditions are kept on every copy (conditions are combined with AND).
 */
function expandGranularityRules(track: Track, warn: Warn) {
    const base = track as Partial<SingleTrack>;
    const isOverlay = IsOverlaidTrack(track);
    const members: Partial<SingleTrack>[] = isOverlay ? track.overlay : [{}];
    const hasRules = (x: unknown) =>
        IsChannelDeep(x as ChannelDeep) && Array.isArray((x as { timeUnit?: unknown }).timeUnit);
    if (!hasRules(base.x) && !members.some(m => hasRules(m.x))) return;

    const expanded = members.flatMap(member => {
        const merged = { ...base, ...member } as Partial<SingleTrack>;
        if (merged.mark === 'brush' || !hasRules(merged.x)) return [member];
        const x = merged.x as X & { timeUnit: TimeUnitRule[] };
        const rules = validRules(x.timeUnit, warn);
        const userVisibility = merged.visibility ?? [];
        return rules.map((rule, i) => {
            const bounds: VisibilityCondition[] = [];
            if (i > 0)
                bounds.push({
                    measure: 'zoomLevel',
                    operation: 'gtet',
                    threshold: rules[i - 1].maxSpan!,
                    target: 'track'
                });
            if (rule.maxSpan !== undefined)
                bounds.push({ measure: 'zoomLevel', operation: 'lt', threshold: rule.maxSpan, target: 'track' });
            const copy: Partial<SingleTrack> = {
                ...member,
                x: { ...x, timeUnit: rule.unit === 'none' ? undefined : rule.unit },
                visibility: [...userVisibility, ...bounds]
            };
            if (rule.unit === 'none') {
                // raw rows: aggregates only apply to units
                AGGREGATABLE_CHANNELS.forEach(key => {
                    const channel = merged[key];
                    if (IsChannelDeep(channel) && 'aggregate' in channel && channel.aggregate) {
                        (copy as Record<string, unknown>)[key] = { ...channel, aggregate: undefined };
                    }
                });
            }
            return copy;
        });
    });

    if (IsChannelDeep(base.x) && Array.isArray((base.x as { timeUnit?: unknown }).timeUnit)) {
        base.x = { ...(base.x as X), timeUnit: undefined };
    }
    (track as { overlay: Partial<SingleTrack>[] }).overlay = expanded;
}

/** Rules with `maxSpan`s in seconds, increasing, and only the last one without `maxSpan`. */
function validRules(rules: TimeUnitRule[], warn: Warn): { unit: TimeUnit | 'none'; maxSpan?: number }[] {
    const valid: { unit: TimeUnit | 'none'; maxSpan?: number }[] = [];
    for (const rule of rules) {
        if (rule.unit !== 'none' && !TIME_UNITS.includes(rule.unit)) {
            warn(`timeUnit rule: "${rule.unit}" is not a time unit, so the rule is ignored.`);
            continue;
        }
        const last = valid[valid.length - 1];
        if (last && last.maxSpan === undefined) {
            warn('timeUnit rules: only the last rule may omit maxSpan, so the rules after it are ignored.');
            break;
        }
        const maxSpan = rule.maxSpan === undefined ? undefined : parseDuration(rule.maxSpan);
        if (maxSpan !== undefined && (isNaN(maxSpan) || (last && maxSpan <= last.maxSpan!))) {
            warn(
                `timeUnit rules: maxSpan "${rule.maxSpan}" must be a duration larger than the previous one, so the rule is ignored.`
            );
            continue;
        }
        valid.push({ unit: rule.unit, maxSpan });
    }
    const last = valid[valid.length - 1];
    if (last && last.maxSpan !== undefined) {
        // the last rule applies to every larger span
        last.maxSpan = undefined;
    }
    return valid;
}

const NOMINAL_CHANNELS = ['color', 'row', 'stroke', 'strokeWidth', 'opacity', 'size', 'text'] as const;
const AGGREGATABLE_CHANNELS = ['y', 'ye', 'color', 'size', 'opacity', 'stroke', 'strokeWidth', 'text'] as const;

/**
 * `x.timeUnit` (channel form): for each resolved member of the track with a time unit, write the binning spec
 * (`_timeUnit`) into the member, point `x` (and, for bars and rects, `xe`) at the unit start and end fields
 * that the track computes, and move `aggregate`s from the channels into the binning spec (so the experimental
 * nominal aggregation does not run as well). Inherited channels are copied into the members first.
 * The track gets `_timeUnitTiling`, which makes the data fetcher assign whole units to tiles.
 */
function resolveTimeUnits(track: Track, warn: Warn) {
    const timeCoordinates = getTrackTimeCoordinates(track);
    const system = timeCoordinates?.system ?? ABSOLUTE_TIME;
    const isOverlay = IsOverlaidTrack(track);
    const base = track as Partial<SingleTrack>;
    const targets: Partial<SingleTrack>[] = isOverlay ? track.overlay : [base];

    const units: TimeUnit[] = [];
    let source: string | undefined;
    let raw = false;
    let binnedAny = false;

    targets.forEach(target => {
        const merged = (isOverlay ? { ...base, ...target } : target) as Partial<SingleTrack>;
        if (merged.mark === 'brush') return;
        const x = merged.x;
        if (!IsChannelDeep(x) || x.type !== 'temporal' || !x.field) return;
        const existing = getTrackTimeUnit(target);
        if (existing) {
            // already resolved (the compiler runs this again after a responsive re-fix)
            units.push(existing.unit);
            source = source ?? existing.source;
            return;
        }
        if (!('timeUnit' in x) || !x.timeUnit) {
            raw = true;
            return;
        }

        const unit = x.timeUnit as TimeUnit;
        // units count raw times, except on a relative axis, where they count offsets from the anchor
        const xSource =
            system.kind === 'relative'
                ? x.field
                : timeCoordinates?.fields.find(f => f.coord === x.field)?.source ?? x.field;
        if (!TIME_UNITS.includes(unit)) {
            warn(`timeUnit "${unit}" is not one of ${TIME_UNITS.join(', ')}, so it is ignored.`);
            target.x = { ...x, timeUnit: undefined };
            raw = true;
            return;
        }
        if (system.kind === 'relative' && !RELATIVE_UNITS.includes(unit)) {
            warn(
                `timeUnit "${unit}" has no fixed length, so it cannot count offsets on a relative axis; ` +
                    `use one of ${RELATIVE_UNITS.join(', ')}. The timeUnit is ignored.`
            );
            target.x = { ...x, timeUnit: undefined };
            raw = true;
            return;
        }
        if (system.kind === 'period' && !unitsWithinPeriod(system).includes(unit)) {
            warn(
                `timeUnit "${unit}" does not lie within the ${describeTimeCoordinates(system)}; ` +
                    `use one of ${unitsWithinPeriod(system).join(', ')}. The timeUnit is ignored.`
            );
            target.x = { ...x, timeUnit: undefined };
            raw = true;
            return;
        }

        const field = `__${unit}_${xSource}`;
        const binning: TimeUnitBinning = {
            unit,
            source: xSource,
            field,
            endField: `${field}_end`,
            groupby: [],
            aggregates: []
        };
        NOMINAL_CHANNELS.forEach(key => {
            const channel = merged[key];
            if (
                IsChannelDeep(channel) &&
                channel.type === 'nominal' &&
                channel.field &&
                !binning.groupby.includes(channel.field)
            ) {
                binning.groupby.push(channel.field);
            }
        });
        AGGREGATABLE_CHANNELS.forEach(key => {
            const channel = merged[key];
            if (!IsChannelDeep(channel) || !('aggregate' in channel) || !channel.aggregate || !channel.field) return;
            if (!(TIME_AGGREGATE_OPS as string[]).includes(channel.aggregate)) {
                warn(
                    `aggregate "${channel.aggregate}" is not supported with timeUnit; use ${TIME_AGGREGATE_OPS.join(
                        ', '
                    )}.`
                );
                return;
            }
            binning.aggregates.push({ field: channel.field, op: channel.aggregate as TimeAggregateOp });
            (target as Record<string, unknown>)[key] = { ...channel, aggregate: undefined };
        });

        target.x = { ...x, field, timeUnit: undefined };
        if ((merged.mark === 'bar' || merged.mark === 'rect') && !merged.xe) {
            target.xe = { field: binning.endField, type: 'temporal' };
        }
        setTrackTimeUnit(target, binning);
        units.push(unit);
        source = source ?? xSource;
        binnedAny = true;
    });

    if (isOverlay && binnedAny) {
        // the members now hold their own copies of the inherited time unit and aggregates
        if (IsChannelDeep(base.x)) base.x = { ...base.x, timeUnit: undefined };
        AGGREGATABLE_CHANNELS.forEach(key => {
            const channel = base[key];
            if (IsChannelDeep(channel) && 'aggregate' in channel && channel.aggregate) {
                (base as Record<string, unknown>)[key] = { ...channel, aggregate: undefined };
            }
        });
    }
    if (units.length > 0 && source) {
        setTrackTimeUnitTiling(track, { source, units: Array.from(new Set(units)), raw });
    }
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
                    `${describeTimeCoordinates(memberSystem)}); the second one is drawn in ${describeTimeCoordinates(
                        system
                    )}.`
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
        // span ends are computed per tile by the track, so the track maps them, not the fetcher
        const spans = [...(member.dataTransform ?? (track as Partial<SingleTrack>).dataTransform ?? [])].filter(
            (t): t is SpanTransform => t.type === 'span'
        );
        X_CHANNELS.forEach(key => {
            const channel = member[key];
            if (!IsChannelDeep(channel) || channel.type !== 'temporal' || !channel.field) return;
            const coord = coordinateField(channel.field, system!);
            const span = spans.find(t => t.newField === channel.field);
            if (span) {
                config.derived = config.derived ?? [];
                if (!config.derived.find(f => f.coord === coord))
                    config.derived.push({ source: channel.field, coord, start: span.field });
            } else {
                sourceOf[key] = channel.field;
                if (!config.fields.find(f => f.coord === coord)) config.fields.push({ source: channel.field, coord });
            }
            channel.field = coord;
        });
        if (sourceOf.x && sourceOf.xe) config.interval = [sourceOf.x, sourceOf.xe];

        if (system.kind === 'relative' && !config.relative) {
            const relative = resolveRelative(x as X, () => {});
            if (relative) {
                const { system: _, ...relativeConfig } = relative;
                config.relative = relativeConfig;
            }
            if (!x.domain) {
                warn(
                    'A `relative` axis has no domain, so it shows one year before and after the anchor; set `domain`.'
                );
                x.domain = { interval: DEFAULT_RELATIVE_DOMAIN };
            }
        }

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

/** Default domain of a relative axis without one: one year before and after the anchor. */
const DEFAULT_RELATIVE_DOMAIN: [number, number] = [-UNIT_SECONDS.year, UNIT_SECONDS.year];

/** Validate `x.relative` of one track definition; `undefined` (after a warning) if it is invalid. */
function resolveRelative(x: X, warn: Warn): ({ system: RelativeTime } & RelativeConfig) | undefined {
    const relative = x.relative!;
    const { anchor } = relative;
    let resolved: RelativeAnchor | undefined;
    if (anchor === 'first' || anchor === 'last') resolved = { kind: anchor };
    else if (typeof anchor === 'number' || typeof anchor === 'string') {
        const time = parseTimeValue(anchor, 'start');
        if (!isNaN(time)) resolved = { kind: 'fixed', time };
    } else if (anchor && typeof anchor === 'object') {
        if ('argmax' in anchor) resolved = { kind: 'argmax', field: anchor.argmax };
        else if ('argmin' in anchor) resolved = { kind: 'argmin', field: anchor.argmin };
        else if ('field' in anchor) resolved = { kind: 'field', field: anchor.field };
    }
    if (!resolved) {
        const options = '"first", "last", { argmax }, { argmin } or { field }';
        warn(`relative.anchor ${JSON.stringify(anchor)} is not a date, ${options}, so the axis stays absolute.`);
        return undefined;
    }
    if (relative.unit !== undefined && !TIME_UNITS.includes(relative.unit)) {
        warn(`relative.unit "${relative.unit}" is not a time unit, so the unit is chosen from the visible span.`);
    }
    const unit = relative.unit && TIME_UNITS.includes(relative.unit) ? relative.unit : undefined;
    const system: RelativeTime = { kind: 'relative', unit, anchorLabel: describeAnchor(resolved) };
    const { groupby } = relative;
    if (groupby && typeof groupby === 'object' && !Array.isArray(groupby)) {
        const period = groupby.period;
        const unitName = typeof period === 'string' ? period : period?.unit;
        if (!PERIOD_UNITS.includes(unitName as PeriodUnit)) {
            warn(
                `relative.groupby.period "${unitName}" is not one of ${PERIOD_UNITS.join(
                    ', '
                )}, so all rows form one group.`
            );
            return { system, anchor: resolved, groupby: [] };
        }
        const keyField = typeof period === 'object' ? period.newField : undefined;
        return { system, anchor: resolved, groupby: [], groupPeriod: { system: periodCoordinates(period), keyField } };
    }
    return { system, anchor: resolved, groupby: groupby === undefined ? [] : ([] as string[]).concat(groupby) };
}

/** Validate and normalize `x.period` of one track definition and return its coordinate system. */
function resolveMemberSystem(member: Partial<SingleTrack>, warn: Warn): TimeCoordinateSystem {
    const x = member.x;
    if (IsChannelDeep(x) && 'relative' in x && x.relative) {
        if ('period' in x && x.period) {
            warn('`period` and `relative` cannot be combined on one axis, so `period` is ignored.');
            x.period = undefined;
        }
        return resolveRelative(x as X, warn)?.system ?? ABSOLUTE_TIME;
    }
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

/**
 * Convert both bounds of an interval to seconds; `undefined` (after a warning) if a bound is invalid.
 * A bound is a time value (Unix seconds or a date string) or, for relative axes, a duration: a signed offset
 * such as `"-36 months"` (date strings and durations never look alike).
 */
function resolveInterval(interval: (number | string)[], warn: Warn): [number, number] | undefined {
    const bound = (value: number | string, which: 'start' | 'end') => {
        const time = parseTimeValue(value, which);
        return isNaN(time) ? parseDuration(value) : time;
    };
    const start = bound(interval[0], 'start');
    const end = bound(interval[1], 'end');
    if (isNaN(start) || isNaN(end)) {
        const bad = isNaN(start) ? interval[0] : interval[1];
        warn(
            `interval ${JSON.stringify(
                interval
            )}: "${bad}" is not a date (e.g. "2010", "2010-12", "2010-12-31", "2010-12-31T12:00:00Z"), so the domain is ignored.`
        );
        return undefined;
    }
    return [start, end];
}

/** Convert a duration threshold to seconds; `false` if the condition must be dropped. */
function resolveThreshold(condition: VisibilityCondition, isTemporal: boolean, warn: Warn): boolean {
    if (condition.measure !== 'zoomLevel' || typeof condition.threshold !== 'string') return true;
    if (!isTemporal) {
        warn(
            `visibility threshold "${condition.threshold}": durations need a temporal x axis, so the condition is ignored.`
        );
        return false;
    }
    const seconds = parseDuration(condition.threshold);
    if (isNaN(seconds)) {
        warn(
            `visibility threshold "${condition.threshold}" is not a duration (e.g. "3 months"), so the condition is ignored.`
        );
        return false;
    }
    condition.threshold = seconds;
    return true;
}
