import { ringCenterLayout, wrapText, isTemporalRing } from './ring-center';

const measure = (text: string, bold: boolean) => text.length * (bold ? 8 : 7);

describe('the center of a temporal ring (G2, G6)', () => {
    it('is used by rings on a temporal axis', () => {
        const ring = { layout: 'circular', x: { field: 't', type: 'temporal' } } as any;
        expect(isTemporalRing(ring)).toBe(true);
        expect(isTemporalRing({ ...ring, layout: 'linear' })).toBe(false);
        expect(isTemporalRing({ ...ring, x: { field: 'p', type: 'genomic' } })).toBe(false);
    });

    it('wraps the y title', () => {
        expect(wrapText('Influenza A cases per week', 100, measure)).toEqual(['Influenza A', 'cases per week']);
    });

    it('holds the legend with the y title when they fit, otherwise the title alone', () => {
        const content = { titleLines: ['Cases (count)'], legendTitle: 'Year', categories: ['2010', '2011', '2012'] };
        expect(ringCenterLayout(content, 80, measure).legendInCenter).toBe(true);
        const small = ringCenterLayout(content, 40, measure);
        expect(small.legendInCenter).toBe(false);
        expect(small.height).toEqual(15);
    });
});

describe('rings on a temporal axis', () => {
    it('leave the band of their x axis free for its labels', async () => {
        const { GoslingTrackModel } = await import('../../tracks/gosling-track/gosling-track-model');
        const { getTheme } = await import('../utils/theme');
        const ring = (x: object) =>
            new GoslingTrackModel(
                {
                    data: { type: 'csv', url: '' },
                    mark: 'line',
                    layout: 'circular',
                    x,
                    y: { field: 'v', type: 'quantitative' },
                    innerRadius: 60,
                    outerRadius: 200,
                    width: 400,
                    height: 400
                } as any,
                [],
                getTheme()
            ).spec().outerRadius;
        expect(ring({ field: 't', type: 'temporal', axis: 'top' })).toEqual(200 - 45);
        expect(ring({ field: 't', type: 'temporal' })).toEqual(200);
        expect(ring({ field: 'p', type: 'genomic', axis: 'top' })).toEqual(200 - 30);
    });
});
