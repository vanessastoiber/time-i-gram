import { GoslingTrackModel } from '../../tracks/gosling-track/gosling-track-model';
import { getTheme } from '../utils/theme';
import {
    HEADER_LINE_HEIGHT,
    colorCategories,
    headerHeight,
    headerLayout,
    headerLegend,
    usesTemporalHeader,
    yAxisTitles
} from './temporal-header';

const track = (extra: object = {}) =>
    ({
        data: { url: '', type: 'csv' },
        mark: 'line',
        x: { field: 't', type: 'temporal' },
        y: { field: 'v', type: 'quantitative' },
        width: 400,
        height: 100,
        ...extra
    } as any);
const measure = (text: string) => text.length * 7;

describe('header strip of temporal linear tracks (G1, G6)', () => {
    it('is used by linear tracks on a temporal axis only', () => {
        expect(usesTemporalHeader([track()])).toBe(true);
        expect(usesTemporalHeader([track({ layout: 'circular' })])).toBe(false);
        expect(usesTemporalHeader([track({ x: { field: 'p', type: 'genomic' } })])).toBe(false);
    });

    it('lists color categories once per field and labeled tracks with a constant color', () => {
        const color = { field: 's', type: 'nominal', legend: true, title: 'Vendor', domain: ['A', 'B'] };
        const legend = headerLegend(
            [
                track({ color }),
                track({ mark: 'point', color }),
                track({ mark: 'bar', color: { value: 'red' }, style: { legendLabel: 'Daily total' } }),
                track({ mark: 'bar', color: { value: 'blue' } })
            ],
            spec => colorCategories(spec, [])
        );
        expect(legend.title).toEqual('Vendor');
        expect(legend.entries.map(e => [e.label, e.spec.mark])).toEqual([
            ['A', 'line'],
            ['B', 'line'],
            ['Daily total', 'bar']
        ]);
    });

    it('reads categories from the data, in the order of the domain', () => {
        const spec = track({ color: { field: 's', type: 'nominal' } });
        expect(colorCategories(spec, [{ s: 'x' }, { s: 'y' }, { s: 'x' }])).toEqual(['x', 'y']);
        const withDomain = track({ color: { field: 's', type: 'nominal', domain: ['y', 'z', 'x'] } });
        expect(colorCategories(withDomain, [{ s: 'x' }, { s: 'y' }])).toEqual(['y', 'x']);
        expect(colorCategories(withDomain, [])).toEqual(['y', 'z', 'x']);
    });

    it('merges the categories of members that each draw one series', () => {
        const member = (series: string) =>
            track({ color: { field: 's', type: 'nominal', domain: ['A', 'B', 'C'], legend: series === 'A' }, series });
        const legend = headerLegend([member('A'), member('C')], spec => [(spec as any).series]);
        expect(legend.entries.map(e => e.label)).toEqual(['A', 'C']);
    });

    it('takes one line, or two when the title and the legend do not fit side by side', () => {
        const legend = { title: 'Season', entries: [{ label: '2010', spec: track() }] };
        expect(headerHeight(undefined, { entries: [] }, 400, measure)).toEqual(0);
        expect(headerHeight('Cases', { entries: [] }, 400, measure)).toEqual(HEADER_LINE_HEIGHT);
        expect(headerHeight('Cases', legend, 400, measure)).toEqual(HEADER_LINE_HEIGHT);
        expect(headerHeight('A long track title that fills the track', legend, 300, measure)).toEqual(
            2 * HEADER_LINE_HEIGHT
        );
    });

    it('places y titles under the track title, and the legend where it fits', () => {
        const legend = { title: 'Season', entries: [{ label: '2010', spec: track() }] };
        const y = { left: 'Cases (count)' };
        expect(headerLayout('Flu', y, legend, 400, measure)).toEqual({ height: 32, legendLine: 0, yTitleLine: 1 });
        expect(headerLayout(undefined, y, legend, 400, measure)).toEqual({ height: 16, legendLine: 0, yTitleLine: 0 });
        expect(headerLayout('A title that takes the whole track', y, legend, 300, measure)).toEqual({
            height: 48,
            legendLine: 2,
            yTitleLine: 1
        });
        expect(yAxisTitles([track({ y: { field: 'v', type: 'quantitative', title: 'A' } }), track()])).toEqual({
            left: 'A'
        });
    });

    it('moves the top of the y range below the header', () => {
        const range = (spec: object) => new GoslingTrackModel(spec as any, [{ t: 1, v: 1 }], getTheme()).spec().y;
        expect((range(track()) as any).range).toEqual([0, 100]);
        expect((range(track({ _headerHeight: 16 })) as any).range).toEqual([0, 77]); // header + half a label
    });
});
