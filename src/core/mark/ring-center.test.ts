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
