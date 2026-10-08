import { compile } from './compile';
import { getTheme } from '../core/utils/theme';
import type { GoslingSpec } from '../index';
import type { HiGlassSpec } from '@gosling-lang/higlass-schema';
import { validateGoslingSpec } from '@gosling-lang/gosling-schema';
import { resolveTemporalSugar } from './temporal-preprocess';

function compiled(spec: GoslingSpec) {
    let result: { hg?: HiGlassSpec; gs?: GoslingSpec } = {};
    compile(spec, (hg, _size, gs) => (result = { hg, gs }), [], getTheme(), {});
    return result as { hg: HiGlassSpec; gs: GoslingSpec };
}

const timeTrack = (extra: object = {}) => ({
    data: { type: 'csv-time', url: '', dateFields: ['date'] },
    mark: 'line',
    x: { field: 'date', type: 'temporal' },
    y: { field: 'v', type: 'quantitative' },
    width: 400,
    height: 100,
    ...extra
});

const genomicTrack = (extra: object = {}) => ({
    data: { type: 'csv', url: '', chromosomeField: 'c', genomicFields: ['p'] },
    mark: 'point',
    x: { field: 'p', type: 'genomic' },
    width: 400,
    height: 100,
    ...extra
});

describe('date strings in temporal domains', () => {
    it('are schema-valid next to numbers', () => {
        const spec = { xDomain: { interval: ['2000-01', 1293840000] }, tracks: [timeTrack()] };
        expect(validateGoslingSpec(spec).state).toEqual('success');
    });

    it('compile a view-level xDomain to Unix seconds, including whole end units', () => {
        const { hg } = compiled({
            xDomain: { interval: ['2000-01', '2010-12'] },
            tracks: [timeTrack()]
        } as GoslingSpec);
        expect(hg.views[0].initialXDomain).toEqual([946684800, 1293840000]);
    });

    it('compile a track-level domain, also before 1970', () => {
        const { hg } = compiled({
            tracks: [
                timeTrack({
                    x: { field: 'date', type: 'temporal', domain: { interval: ['1918-09', '1919-02-15T12:00:00Z'] } }
                })
            ]
        } as GoslingSpec);
        expect(hg.views[0].initialXDomain).toEqual([Date.UTC(1918, 8, 1) / 1000, Date.UTC(1919, 1, 15, 12) / 1000]);
    });

    it('give the same result as the equivalent numbers', () => {
        const a = compiled({ xDomain: { interval: ['2000', '2009'] }, tracks: [timeTrack()] } as GoslingSpec);
        const b = compiled({ xDomain: { interval: [946684800, 1262304000] }, tracks: [timeTrack()] } as GoslingSpec);
        expect(a.hg.views[0].initialXDomain).toEqual(b.hg.views[0].initialXDomain);
    });

    it('are ignored with a warning on a genomic axis, leaving genomic behavior unchanged', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const withStrings = compiled({
            xDomain: { interval: ['2000', '2010'] },
            tracks: [genomicTrack()]
        } as GoslingSpec);
        const without = compiled({ tracks: [genomicTrack()] } as GoslingSpec);
        expect(withStrings.hg.views[0].initialXDomain).toEqual(without.hg.views[0].initialXDomain);
        expect(warn.mock.calls.flat().join(' ')).toMatch(/date strings need a temporal channel/);
        warn.mockRestore();
    });

    it('warn about and ignore unparseable dates', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { gs } = compiled({ xDomain: { interval: ['Jan 2000', '2010'] }, tracks: [timeTrack()] } as GoslingSpec);
        expect(warn.mock.calls.flat().join(' ')).toMatch(/"Jan 2000" is not a date/);
        expect(JSON.stringify(gs)).not.toMatch(/Jan 2000/);
        warn.mockRestore();
    });

    it('leave genomic numeric domains untouched', () => {
        const spec = { xDomain: { chromosome: 'chr1', interval: [1, 1000] }, tracks: [genomicTrack()] } as GoslingSpec;
        const { gs } = compiled(spec);
        expect(JSON.stringify(gs)).toMatch(/"chromosome":"chr1","interval":\[1,1000\]/);
    });
});

describe('durations', () => {
    it('are schema-valid in visibility thresholds and zoomLimits, and invalid strings are not', () => {
        const ok = {
            zoomLimits: ['1 hour', '20 years'],
            tracks: [
                timeTrack({
                    visibility: [{ measure: 'zoomLevel', operation: 'lt', threshold: '3 months', target: 'track' }]
                })
            ]
        };
        expect(validateGoslingSpec(ok).state).toEqual('success');
        const bad = { ...ok, zoomLimits: ['one hour', null] };
        expect(validateGoslingSpec(bad).state).toEqual('warn');
    });

    it('compile visibility thresholds to seconds', () => {
        const { gs } = compiled({
            tracks: [
                timeTrack({
                    visibility: [{ measure: 'zoomLevel', operation: 'lt', threshold: '3 months', target: 'track' }]
                })
            ]
        } as GoslingSpec);
        const track = (gs as any).tracks[0];
        expect(track.visibility[0].threshold).toBeCloseTo(3 * 30.436875 * 86400, 3);
    });

    it('compile zoomLimits to seconds, and numbers keep working', () => {
        const a = compiled({ zoomLimits: ['1 hour', '20 years'], tracks: [timeTrack()] } as GoslingSpec);
        expect(a.hg.views[0].zoomLimits).toEqual([3600, 20 * 365.2425 * 86400]);
        const b = compiled({ zoomLimits: [3600, null], tracks: [timeTrack()] } as GoslingSpec);
        expect(b.hg.views[0].zoomLimits).toEqual([3600, null]);
    });

    it('are dropped with a warning on genomic tracks', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { gs, hg } = compiled({
            zoomLimits: ['1 hour', null],
            tracks: [
                genomicTrack({
                    visibility: [{ measure: 'zoomLevel', operation: 'lt', threshold: '3 months', target: 'track' }]
                })
            ]
        } as GoslingSpec);
        expect((gs as any).tracks[0].visibility).toEqual([]);
        expect(hg.views[0].zoomLimits).toEqual([1, null]);
        expect(warn.mock.calls.flat().join(' ')).toMatch(/durations need a temporal x axis/);
        warn.mockRestore();
    });

    it('apply to overlaid tracks', () => {
        const { gs } = compiled({
            tracks: [
                {
                    ...timeTrack(),
                    alignment: 'overlay',
                    tracks: [
                        {
                            mark: 'line',
                            visibility: [
                                { measure: 'zoomLevel', operation: 'gt', threshold: '2 weeks', target: 'track' }
                            ]
                        },
                        { mark: 'point' }
                    ]
                }
            ]
        } as unknown as GoslingSpec);
        expect((gs as any).tracks[0].overlay[0].visibility[0].threshold).toEqual(14 * 86400);
    });
});

/** The gosling-track (data track) of a compiled HiGlass view. */
const dataTrack = (hg: HiGlassSpec, view = 0) => (hg.views[view].tracks.center as any)[0].contents[0];
/** The time axis track of a compiled HiGlass view. */
const timeAxis = (hg: HiGlassSpec, view = 0) =>
    [...((hg.views[view].tracks as any).top ?? []), ...(hg.views[view].tracks.center as any)[0].contents].find(
        (t: any) => t.type === 'unix-time-track'
    );

describe('period (time coordinate system)', () => {
    const periodTrack = (period: unknown, extra: object = {}) =>
        timeTrack({ x: { field: 'date', type: 'temporal', period, axis: 'top' }, ...extra });

    it('is schema-valid as a unit or an object', () => {
        expect(validateGoslingSpec({ tracks: [periodTrack('year')] }).state).toEqual('success');
        expect(
            validateGoslingSpec({
                tracks: [periodTrack({ unit: 'year', weekBased: true, start: 40, newField: 'season' })]
            }).state
        ).toEqual('success');
        expect(validateGoslingSpec({ tracks: [periodTrack('fortnight')] }).state).toEqual('warn');
    });

    it('maps the x field to coordinates in the fetcher and labels the axis by period', () => {
        const { hg } = compiled({ tracks: [periodTrack({ unit: 'year', newField: 'season' })] } as GoslingSpec);
        const track = dataTrack(hg);
        expect(track.data.x).toEqual('__period_date');
        expect(track.data.timeCoordinates).toEqual({
            system: { kind: 'period', unit: 'year', weekBased: false, start: 1 },
            fields: [{ source: 'date', coord: '__period_date' }],
            keyFields: ['season']
        });
        expect(track.options.spec.x.field).toEqual('__period_date');
        expect(hg.views[0].initialXDomain).toEqual([Date.UTC(2000, 0, 1) / 1000, Date.UTC(2001, 0, 1) / 1000]);
        expect(timeAxis(hg).options.timeCoordinates).toEqual({
            kind: 'period',
            unit: 'year',
            weekBased: false,
            start: 1
        });
    });

    it('names the period field <field>_<unit> by default', () => {
        const { hg } = compiled({ tracks: [periodTrack('week')] } as GoslingSpec);
        expect(dataTrack(hg).data.timeCoordinates.keyFields).toEqual(['date_week']);
    });

    it('splits x/xe intervals and maps both fields', () => {
        const { hg } = compiled({
            tracks: [periodTrack('day', { mark: 'rect', xe: { field: 'end', type: 'temporal' } })]
        } as GoslingSpec);
        const { timeCoordinates, x, xe } = dataTrack(hg).data;
        expect([x, xe]).toEqual(['__period_date', '__period_end']);
        expect(timeCoordinates.interval).toEqual(['date', 'end']);
    });

    it('works in overlaid tracks', () => {
        const { hg } = compiled({
            tracks: [
                {
                    ...periodTrack('year'),
                    alignment: 'overlay',
                    tracks: [{ mark: 'line' }, { mark: 'point' }]
                }
            ]
        } as unknown as GoslingSpec);
        expect(dataTrack(hg).data.timeCoordinates.system.unit).toEqual('year');
        expect(dataTrack(hg).options.spec.x.field).toEqual('__period_date');
    });

    it('ignores an inherited domain silently and warns about its own domain', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const inherited = compiled({
            xDomain: { interval: ['2009', '2012'] },
            tracks: [periodTrack('year')]
        } as GoslingSpec);
        expect(inherited.hg.views[0].initialXDomain).toEqual([
            Date.UTC(2000, 0, 1) / 1000,
            Date.UTC(2001, 0, 1) / 1000
        ]);
        expect(warn).not.toHaveBeenCalled();
        compiled({
            tracks: [
                timeTrack({
                    x: { field: 'date', type: 'temporal', period: 'year', domain: { interval: ['2009', '2012'] } }
                })
            ]
        } as GoslingSpec);
        expect(warn.mock.calls.flat().join(' ')).toMatch(/domain.*on a `period` channel is not supported/);
        warn.mockRestore();
    });

    it('rejects options that do not apply to the unit', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { hg } = compiled({ tracks: [periodTrack({ unit: 'month', start: 5, weekBased: true })] } as GoslingSpec);
        expect(dataTrack(hg).data.timeCoordinates.system).toEqual({
            kind: 'period',
            unit: 'month',
            weekBased: false,
            start: 1
        });
        const messages = warn.mock.calls.flat().join(' ');
        expect(messages).toMatch(/weekBased only applies to years/);
        expect(messages).toMatch(/period.start is not supported for "month"/);
        warn.mockRestore();
    });

    it('is idempotent (compile runs the pass again for responsive specs)', () => {
        const spec = { tracks: [periodTrack('year')] } as GoslingSpec;
        const { gs } = compiled(spec);
        const copy = JSON.parse(JSON.stringify(gs));
        resolveTemporalSugar(copy);
        expect(copy).toEqual(JSON.parse(JSON.stringify(gs)));
    });

    it('leaves absolute temporal and genomic tracks unchanged', () => {
        const { hg } = compiled({ tracks: [timeTrack()] } as GoslingSpec);
        expect(dataTrack(hg).data.timeCoordinates).toBeUndefined();
        expect(dataTrack(hg).data.x).toEqual('date');
        const genomic = compiled({ tracks: [genomicTrack()] } as GoslingSpec);
        expect(dataTrack(genomic.hg).data.timeCoordinates).toBeUndefined();
    });
});

describe('linking across time coordinate systems', () => {
    const view = (x: object, extra: object = {}) => ({
        tracks: [timeTrack({ x: { field: 'date', type: 'temporal', linkingId: 'link', ...x }, ...extra })]
    });
    const lockedViews = (hg: HiGlassSpec) => Object.keys(hg.zoomLocks.locksByViewUid).length;

    it('links views that share a coordinate system', () => {
        const { hg } = compiled({
            views: [view({ period: 'year' }), view({ period: 'year' })]
        } as unknown as GoslingSpec);
        expect(lockedViews(hg)).toEqual(2);
        const absolute = compiled({ views: [view({}), view({})] } as unknown as GoslingSpec);
        expect(lockedViews(absolute.hg)).toEqual(2);
    });

    it('leaves views in another coordinate system out of the link, with a warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { hg } = compiled({ views: [view({ period: 'year' }), view({})] } as unknown as GoslingSpec);
        // each view is alone in its coordinate system, so neither is linked
        expect(lockedViews(hg)).toEqual(0);
        expect(warn.mock.calls.flat().join(' ')).toMatch(
            /linkingId "link" joins views in different coordinate systems \(period \(year\), absolute time\)/
        );
        warn.mockRestore();
    });

    it('keeps every compatible group linked, whatever the order of the views', () => {
        const ring = {
            tracks: [
                timeTrack({
                    layout: 'circular',
                    alignment: 'overlay',
                    x: { field: 'date', type: 'temporal', period: 'year' },
                    tracks: [{ mark: 'line' }, { mark: 'brush', x: { linkingId: 'link' } }]
                })
            ]
        };
        const brushTargets = (hg: HiGlassSpec) =>
            hg.views.flatMap(v =>
                ((v.tracks as any).whole ?? []).filter((t: any) => t.fromViewUid).map((t: any) => t.fromViewUid)
            );
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        for (const order of [
            [view({}), ring, view({ period: 'year' })],
            [ring, view({ period: 'year' }), view({})],
            [view({ period: 'year' }), view({}), ring]
        ]) {
            warn.mockClear();
            const { hg } = compiled({ views: order } as unknown as GoslingSpec);
            const periodView = hg.views[order.findIndex(v => v !== ring && (v.tracks[0].x as any).period)].uid;
            // the ring's brush drives the linear period view
            expect(brushTargets(hg)).toEqual([periodView]);
            // the absolute view, alone in its system, is not locked
            const linked = Object.entries(hg.zoomLocks.locksByViewUid).filter(([, id]) => /^link/.test(id as string));
            expect(linked.map(([uid]) => uid)).toEqual([periodView]);
            // one warning per linkingId
            expect(warn.mock.calls.filter(c => /linkingId "link"/.test(c.join(' '))).length).toEqual(1);
        }
        warn.mockRestore();
    });

    it('distinguishes period options (week-based vs calendar years)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { hg } = compiled({
            views: [view({ period: 'year' }), view({ period: { unit: 'year', weekBased: true } })]
        } as unknown as GoslingSpec);
        expect(lockedViews(hg)).toEqual(0);
        warn.mockRestore();
    });

    it('keeps genomic links unchanged', () => {
        const gview = { tracks: [genomicTrack({ x: { field: 'p', type: 'genomic', linkingId: 'g' } })] };
        const { hg } = compiled({ views: [gview, gview] } as unknown as GoslingSpec);
        expect(lockedViews(hg)).toEqual(2);
    });
});

describe('timeUnit (channel form)', () => {
    const monthly = (extra: object = {}) =>
        timeTrack({
            mark: 'bar',
            x: { field: 'date', type: 'temporal', timeUnit: 'month' },
            y: { field: 'v', type: 'quantitative', aggregate: 'sum' },
            color: { field: 'series', type: 'nominal' },
            ...extra
        });

    it('is schema-valid, with the new aggregates', () => {
        expect(validateGoslingSpec({ tracks: [monthly()] }).state).toEqual('success');
        const transform = { type: 'timeUnit', field: 'date', unit: 'week', newField: 'week', endField: 'weekEnd' };
        expect(validateGoslingSpec({ tracks: [timeTrack({ dataTransform: [transform] })] }).state).toEqual('success');
        expect(
            validateGoslingSpec({
                tracks: [monthly({ x: { field: 'date', type: 'temporal', timeUnit: 'fortnight' } })]
            }).state
        ).toEqual('warn');
    });

    it('binds x and xe (bars) to the unit and moves the aggregate into the binning spec', () => {
        const { hg } = compiled({ tracks: [monthly()] } as GoslingSpec);
        const { options, data } = dataTrack(hg);
        expect(options.spec._timeUnit).toEqual({
            unit: 'month',
            source: 'date',
            field: '__month_date',
            endField: '__month_date_end',
            groupby: ['series'],
            aggregates: [{ field: 'v', op: 'sum' }]
        });
        expect(options.spec.x.field).toEqual('__month_date');
        expect(options.spec.xe).toEqual({ field: '__month_date_end', type: 'temporal' });
        expect(options.spec.y.aggregate).toBeUndefined();
        // the fetcher assigns whole months to tiles, by the raw time field
        expect(data.x).toEqual('date');
        expect(data.timeUnitTiling).toEqual({ source: 'date', units: ['month'], raw: false });
    });

    it('resolves inherited time units and aggregates per overlaid track', () => {
        const { hg } = compiled({
            tracks: [
                {
                    ...monthly({ mark: undefined, color: undefined }),
                    alignment: 'overlay',
                    tracks: [
                        { mark: 'line', color: { field: 'series', type: 'nominal' } },
                        {
                            mark: 'point',
                            x: { field: 'date', type: 'temporal' },
                            y: { field: 'v', type: 'quantitative' }
                        }
                    ]
                }
            ]
        } as unknown as GoslingSpec);
        const { options, data } = dataTrack(hg);
        const [line, point] = options.spec.overlay;
        expect(line._timeUnit.groupby).toEqual(['series']);
        expect(line._timeUnit.aggregates).toEqual([{ field: 'v', op: 'sum' }]);
        expect(point._timeUnit).toBeUndefined();
        expect(options.spec.y.aggregate).toBeUndefined();
        expect(data.timeUnitTiling).toEqual({ source: 'date', units: ['month'], raw: true });
    });

    it('works inside a period when the unit lies within it, and warns otherwise', () => {
        const { hg } = compiled({
            tracks: [monthly({ x: { field: 'date', type: 'temporal', timeUnit: 'month', period: 'year' } })]
        } as GoslingSpec);
        const { options, data } = dataTrack(hg);
        expect(options.spec._timeUnit.source).toEqual('date');
        expect(data.x).toEqual('__period_date');
        expect(data.timeCoordinates.system.unit).toEqual('year');

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const weeks = compiled({
            tracks: [monthly({ x: { field: 'date', type: 'temporal', timeUnit: 'week', period: 'year' } })]
        } as GoslingSpec);
        expect(dataTrack(weeks.hg).options.spec._timeUnit).toBeUndefined();
        expect(warn.mock.calls.flat().join(' ')).toMatch(/timeUnit "week" does not lie within the period \(year\)/);
        warn.mockRestore();
    });

    it('allows quarters only in years that start on a quarter boundary', () => {
        const quarterly = (start: number) =>
            compiled({
                tracks: [
                    monthly({
                        x: { field: 'date', type: 'temporal', timeUnit: 'quarter', period: { unit: 'year', start } }
                    })
                ]
            } as GoslingSpec);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(dataTrack(quarterly(1).hg).options.spec._timeUnit.unit).toEqual('quarter');
        expect(dataTrack(quarterly(10).hg).options.spec._timeUnit.unit).toEqual('quarter');
        expect(warn).not.toHaveBeenCalled();
        // August-July seasons: the quarter July-September straddles the season boundary
        expect(dataTrack(quarterly(8).hg).options.spec._timeUnit).toBeUndefined();
        expect(warn.mock.calls.flat().join(' ')).toMatch(/timeUnit "quarter" does not lie within the period/);
        warn.mockRestore();
    });

    it('is idempotent', () => {
        const { gs } = compiled({ tracks: [monthly()] } as GoslingSpec);
        const copy = JSON.parse(JSON.stringify(gs));
        resolveTemporalSugar(copy);
        expect(copy).toEqual(JSON.parse(JSON.stringify(gs)));
    });

    it('keeps the experimental nominal aggregation when there is no timeUnit', () => {
        const { hg } = compiled({
            tracks: [timeTrack({ y: { field: 'v', type: 'quantitative', aggregate: 'max' } })]
        } as GoslingSpec);
        expect(dataTrack(hg).options.spec.y.aggregate).toEqual('max');
        expect(dataTrack(hg).data.timeUnitTiling).toBeUndefined();
    });
});

describe('granularity transition rules', () => {
    const DAY = 86400;
    const rulesTrack = (rules: unknown, extra: object = {}) =>
        timeTrack({
            mark: 'line',
            x: { field: 'date', type: 'temporal', timeUnit: rules },
            y: { field: 'v', type: 'quantitative', aggregate: 'sum' },
            ...extra
        });
    const RULES = [{ unit: 'day', maxSpan: '3 months' }, { unit: 'week', maxSpan: '2 years' }, { unit: 'month' }];

    it('are schema-valid', () => {
        expect(validateGoslingSpec({ tracks: [rulesTrack(RULES)] }).state).toEqual('success');
        expect(
            validateGoslingSpec({ tracks: [rulesTrack([{ unit: 'none', maxSpan: 3600 }, { unit: 'hour' }])] }).state
        ).toEqual('success');
    });

    it('expand to one overlaid track per rule with zoom-level visibility bands', () => {
        const { hg } = compiled({ tracks: [rulesTrack(RULES)] } as GoslingSpec);
        const { options, data } = dataTrack(hg);
        const overlay = options.spec.overlay;
        expect(overlay.map((o: any) => o._timeUnit.unit)).toEqual(['day', 'week', 'month']);
        const month = 30.436875 * DAY;
        expect(overlay.map((o: any) => o.visibility.map((v: any) => [v.operation, v.threshold]))).toEqual([
            [['lt', 3 * month]],
            [
                ['gtet', 3 * month],
                ['lt', 2 * 365.2425 * DAY]
            ],
            [['gtet', 2 * 365.2425 * DAY]]
        ]);
        // one fetcher serves all units, each unit tile-exact
        expect(data.timeUnitTiling.units).toEqual(['day', 'week', 'month']);
    });

    it('show exactly one rule at any visible span', () => {
        const { hg } = compiled({ tracks: [rulesTrack(RULES)] } as GoslingSpec);
        const overlay = dataTrack(hg).options.spec.overlay;
        const visible = (span: number) =>
            overlay
                .filter((o: any) =>
                    o.visibility.every((v: any) => (v.operation === 'lt' ? span < v.threshold : span >= v.threshold))
                )
                .map((o: any) => o._timeUnit.unit);
        expect(visible(10 * DAY)).toEqual(['day']);
        expect(visible(91.3 * DAY)).toEqual(['day']); // just below 3 months (91.31 days)
        expect(visible(3 * 30.436875 * DAY)).toEqual(['week']); // exactly 3 months
        expect(visible(365 * DAY)).toEqual(['week']);
        expect(visible(3000 * DAY)).toEqual(['month']);
    });

    it('keep user visibility conditions and support raw rows ("none")', () => {
        const userCondition = { measure: 'width', operation: 'gt', threshold: 100, target: 'track' };
        const { hg } = compiled({
            tracks: [
                rulesTrack([{ unit: 'none', maxSpan: '2 days' }, { unit: 'hour' }], { visibility: [userCondition] })
            ]
        } as GoslingSpec);
        const [raw, hourly] = dataTrack(hg).options.spec.overlay;
        expect(raw._timeUnit).toBeUndefined();
        expect(raw.y.aggregate).toBeUndefined();
        expect(raw.visibility[0]).toEqual(userCondition);
        expect(hourly.visibility[0]).toEqual(userCondition);
        expect(dataTrack(hg).data.timeUnitTiling).toEqual({ source: 'date', units: ['hour'], raw: true });
    });

    it('expand inside overlaid tracks and leave brushes alone', () => {
        const { hg } = compiled({
            tracks: [
                {
                    ...rulesTrack(RULES, { mark: undefined }),
                    alignment: 'overlay',
                    tracks: [{ mark: 'line' }, { mark: 'point' }, { mark: 'brush', x: { linkingId: 'b' } }]
                }
            ]
        } as unknown as GoslingSpec);
        const overlay = dataTrack(hg).options.spec.overlay;
        expect(overlay.map((o: any) => `${o.mark}:${o._timeUnit?.unit ?? '-'}`)).toEqual([
            'line:day',
            'line:week',
            'line:month',
            'point:day',
            'point:week',
            'point:month',
            'brush:-'
        ]);
    });

    it('warn about and drop invalid rules', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { hg } = compiled({
            tracks: [
                rulesTrack([
                    { unit: 'day', maxSpan: '1 year' },
                    { unit: 'week', maxSpan: '1 month' },
                    { unit: 'month' },
                    { unit: 'year' }
                ])
            ]
        } as GoslingSpec);
        expect(dataTrack(hg).options.spec.overlay.map((o: any) => o._timeUnit.unit)).toEqual(['day', 'month']);
        const messages = warn.mock.calls.flat().join(' ');
        expect(messages).toMatch(/must be a duration larger than the previous one/);
        expect(messages).toMatch(/only the last rule may omit maxSpan/);
        warn.mockRestore();
    });

    it('is idempotent', () => {
        const { gs } = compiled({ tracks: [rulesTrack(RULES)] } as GoslingSpec);
        const copy = JSON.parse(JSON.stringify(gs));
        resolveTemporalSugar(copy);
        expect(copy).toEqual(JSON.parse(JSON.stringify(gs)));
    });
});

describe('relative (time coordinate system)', () => {
    const WEEK = 7 * 86400;
    const relativeTrack = (relative: unknown, extra: object = {}) =>
        timeTrack({
            x: {
                field: 'date',
                type: 'temporal',
                relative,
                domain: { interval: ['-4 weeks', '30 weeks'] },
                axis: 'top'
            },
            ...extra
        });

    it('is schema-valid with every kind of anchor', () => {
        for (const anchor of [
            '2008-09-15',
            1221436800,
            'first',
            'last',
            { argmax: 'v' },
            { argmin: 'v' },
            { field: 'onset' }
        ]) {
            expect(
                validateGoslingSpec({ tracks: [relativeTrack({ anchor, groupby: 'g', unit: 'week' })] }).state
            ).toEqual('success');
        }
        expect(validateGoslingSpec({ tracks: [relativeTrack({ anchor: { peak: 'v' } })] }).state).toEqual('warn');
    });

    it('maps rows to offsets in the fetcher, takes durations as the domain, and labels offsets', () => {
        const { hg } = compiled({
            tracks: [relativeTrack({ anchor: { argmax: 'v' }, groupby: ['g'], unit: 'week' })]
        } as GoslingSpec);
        const { data, options } = dataTrack(hg);
        expect(data.x).toEqual('__relative_date');
        expect(data.timeCoordinates).toEqual({
            system: { kind: 'relative', unit: 'week', anchorLabel: 'the maximum of v' },
            fields: [{ source: 'date', coord: '__relative_date' }],
            keyFields: [],
            relative: { anchor: { kind: 'argmax', field: 'v' }, groupby: ['g'] }
        });
        expect(options.spec.x.field).toEqual('__relative_date');
        expect(hg.views[0].initialXDomain).toEqual([-4 * WEEK, 30 * WEEK]);
        expect(timeAxis(hg).options.timeCoordinates.kind).toEqual('relative');
    });

    it('resolves a fixed date anchor', () => {
        const { hg } = compiled({ tracks: [relativeTrack({ anchor: '2008-09-15' })] } as GoslingSpec);
        expect(dataTrack(hg).data.timeCoordinates.relative.anchor).toEqual({
            kind: 'fixed',
            time: Date.UTC(2008, 8, 15) / 1000
        });
    });

    it('defaults to one year around the anchor without a domain, with a warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { hg } = compiled({
            tracks: [timeTrack({ x: { field: 'date', type: 'temporal', relative: { anchor: 'first' } } })]
        } as GoslingSpec);
        expect(hg.views[0].initialXDomain).toEqual([-365.2425 * 86400, 365.2425 * 86400]);
        expect(warn.mock.calls.flat().join(' ')).toMatch(/A `relative` axis has no domain/);
        warn.mockRestore();
    });

    it('rejects period + relative and invalid anchors', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const both = compiled({ tracks: [relativeTrack({ anchor: 'first' }, { x: undefined })] } as GoslingSpec);
        expect(dataTrack(both.hg).data.timeCoordinates).toBeUndefined();
        compiled({
            tracks: [
                timeTrack({
                    x: {
                        field: 'date',
                        type: 'temporal',
                        period: 'year',
                        relative: { anchor: 'first' },
                        domain: { interval: [0, 1] }
                    }
                })
            ]
        } as GoslingSpec);
        compiled({ tracks: [relativeTrack({ anchor: 'yesterday' })] } as GoslingSpec);
        const messages = warn.mock.calls.flat().join(' ');
        expect(messages).toMatch(/`period` and `relative` cannot be combined/);
        expect(messages).toMatch(/relative.anchor "yesterday" is not a date/);
        warn.mockRestore();
    });

    it('bins offsets with fixed-length units only', () => {
        const binned = compiled({
            tracks: [
                relativeTrack(
                    { anchor: 'first', unit: 'week' },
                    {
                        x: {
                            field: 'date',
                            type: 'temporal',
                            relative: { anchor: 'first' },
                            timeUnit: 'week',
                            domain: { interval: ['-4 weeks', '30 weeks'] }
                        },
                        y: { field: 'v', type: 'quantitative', aggregate: 'mean' }
                    }
                )
            ]
        } as GoslingSpec);
        const { options, data } = dataTrack(binned.hg);
        expect(options.spec._timeUnit.source).toEqual('__relative_date');
        expect(data.x).toEqual('__relative_date');
        expect(data.timeUnitTiling.source).toEqual('__relative_date');

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const monthly = compiled({
            tracks: [
                timeTrack({
                    x: {
                        field: 'date',
                        type: 'temporal',
                        relative: { anchor: 'first' },
                        timeUnit: 'month',
                        domain: { interval: [0, 1] }
                    }
                })
            ]
        } as GoslingSpec);
        expect(dataTrack(monthly.hg).options.spec._timeUnit).toBeUndefined();
        expect(warn.mock.calls.flat().join(' ')).toMatch(/timeUnit "month" has no fixed length/);
        warn.mockRestore();
    });

    it('links relative views with each other, but not with absolute ones', () => {
        const view = (x: object) => ({
            tracks: [
                timeTrack({
                    x: { field: 'date', type: 'temporal', linkingId: 'link', domain: { interval: [0, 1000] }, ...x }
                })
            ]
        });
        const lockedViews = (hg: HiGlassSpec) => Object.keys(hg.zoomLocks.locksByViewUid).length;
        const both = compiled({
            views: [view({ relative: { anchor: 'first' } }), view({ relative: { anchor: '2008' } })]
        } as unknown as GoslingSpec);
        expect(lockedViews(both.hg)).toEqual(2);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const mixed = compiled({
            views: [view({ relative: { anchor: 'first' } }), view({})]
        } as unknown as GoslingSpec);
        expect(lockedViews(mixed.hg)).toEqual(0);
        expect(warn.mock.calls.flat().join(' ')).toMatch(/relative time, absolute time/);
        warn.mockRestore();
    });
});

describe('relative groupby period', () => {
    it('compiles to a period grouping of the anchors', () => {
        const { hg } = compiled({
            tracks: [
                timeTrack({
                    x: {
                        field: 'date',
                        type: 'temporal',
                        relative: {
                            anchor: { argmax: 'v' },
                            groupby: { period: { unit: 'year', weekBased: true, start: 40, newField: 'season' } }
                        },
                        domain: { interval: ['-20 weeks', '20 weeks'] }
                    }
                })
            ]
        } as GoslingSpec);
        expect(dataTrack(hg).data.timeCoordinates.relative).toEqual({
            anchor: { kind: 'argmax', field: 'v' },
            groupby: [],
            groupPeriod: { system: { kind: 'period', unit: 'year', weekBased: true, start: 40 }, keyField: 'season' }
        });
    });
});

describe('span transform', () => {
    const span = { type: 'span', field: 'start', duration: 'trip_duration', unit: 'second', newField: 'end' };
    const spanTrack = (x: object) =>
        timeTrack({
            mark: 'rect',
            dataTransform: [span],
            x: { field: 'start', type: 'temporal', ...x },
            xe: { field: 'end', type: 'temporal' }
        });

    it('is schema-valid', () => {
        expect(validateGoslingSpec({ tracks: [spanTrack({})] }).state).toEqual('success');
        expect(
            validateGoslingSpec({ tracks: [timeTrack({ dataTransform: [{ ...span, duration: '2 weeks' }] })] }).state
        ).toEqual('success');
    });

    it('leaves absolute axes as they are', () => {
        const { hg } = compiled({ tracks: [spanTrack({})] } as GoslingSpec);
        expect(dataTrack(hg).data.timeCoordinates).toBeUndefined();
        expect(dataTrack(hg).data.xe).toEqual('end');
    });

    it('lets the track map span ends on period axes (the fetcher cannot)', () => {
        const { hg } = compiled({ tracks: [spanTrack({ period: 'day' })] } as GoslingSpec);
        const { timeCoordinates } = dataTrack(hg).data;
        expect(timeCoordinates.fields).toEqual([{ source: 'start', coord: '__period_start' }]);
        expect(timeCoordinates.derived).toEqual([{ source: 'end', coord: '__period_end', start: 'start' }]);
        expect(timeCoordinates.interval).toBeUndefined();
    });
});
