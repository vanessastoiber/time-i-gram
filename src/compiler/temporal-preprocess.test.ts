import { compile } from './compile';
import { getTheme } from '../core/utils/theme';
import type { GoslingSpec } from '../index';
import type { HiGlassSpec } from '@gosling-lang/higlass-schema';
import { validateGoslingSpec } from '@gosling-lang/gosling-schema';

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
        const { hg } = compiled({ xDomain: { interval: ['2000-01', '2010-12'] }, tracks: [timeTrack()] } as GoslingSpec);
        expect(hg.views[0].initialXDomain).toEqual([946684800, 1293840000]);
    });

    it('compile a track-level domain, also before 1970', () => {
        const { hg } = compiled({
            tracks: [timeTrack({ x: { field: 'date', type: 'temporal', domain: { interval: ['1918-09', '1919-02-15T12:00:00Z'] } } })]
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
        const withStrings = compiled({ xDomain: { interval: ['2000', '2010'] }, tracks: [genomicTrack()] } as GoslingSpec);
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
            tracks: [timeTrack({ visibility: [{ measure: 'zoomLevel', operation: 'lt', threshold: '3 months', target: 'track' }] })]
        };
        expect(validateGoslingSpec(ok).state).toEqual('success');
        const bad = { ...ok, zoomLimits: ['one hour', null] };
        expect(validateGoslingSpec(bad).state).toEqual('warn');
    });

    it('compile visibility thresholds to seconds', () => {
        const { gs } = compiled({
            tracks: [
                timeTrack({ visibility: [{ measure: 'zoomLevel', operation: 'lt', threshold: '3 months', target: 'track' }] })
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
                genomicTrack({ visibility: [{ measure: 'zoomLevel', operation: 'lt', threshold: '3 months', target: 'track' }] })
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
                        { mark: 'line', visibility: [{ measure: 'zoomLevel', operation: 'gt', threshold: '2 weeks', target: 'track' }] },
                        { mark: 'point' }
                    ]
                }
            ]
        } as unknown as GoslingSpec);
        expect((gs as any).tracks[0].overlay[0].visibility[0].threshold).toEqual(14 * 86400);
    });
});
