import { modelsCacheKey } from './model-cache';

const track = (extra: object = {}) =>
    ({ mark: 'point', x: { field: 'x', type: 'temporal' }, width: 10, height: 10, ...extra } as any);
const inputs = (extra: object = {}) => ({
    tileId: 't.0.1',
    dimensions: [400, 100] as [number, number],
    domain: [0, 100] as [number, number],
    ...extra
});

describe('reusing the track models of a tile', () => {
    it('keeps the same key for temporal tracks while zooming or panning within the same tiles', () => {
        const key = modelsCacheKey([track()], inputs());
        expect(key).toBeDefined();
        expect(modelsCacheKey([track()], inputs({ domain: [10, 50] }))).toEqual(key);
    });

    it('changes the key when the tile, its combination or the track size changes', () => {
        const key = modelsCacheKey([track()], inputs());
        expect(modelsCacheKey([track()], inputs({ tileId: 't.0.2' }))).not.toEqual(key);
        expect(modelsCacheKey([track()], inputs({ combinedTileIds: ['t.0.1', 't.0.2'] }))).not.toEqual(key);
        expect(modelsCacheKey([track()], inputs({ dimensions: [400, 120] }))).not.toEqual(key);
    });

    it('includes the visible domain for rings of lines and areas, which keep only the visible arc', () => {
        const ring = track({ mark: 'line', layout: 'circular' });
        expect(modelsCacheKey([ring], inputs({ domain: [10, 50] }))).not.toEqual(modelsCacheKey([ring], inputs()));
    });

    it('rebuilds the models on every draw for genomic tracks (upstream) and x-scale-dependent transforms', () => {
        expect(modelsCacheKey([track({ x: { field: 'x', type: 'genomic' } })], inputs())).toBeUndefined();
        expect(modelsCacheKey([track({ dataTransform: [{ type: 'displace' }] })], inputs())).toBeUndefined();
        expect(modelsCacheKey([track({ dataTransform: [{ type: 'coverage' }] })], inputs())).toBeUndefined();
        expect(modelsCacheKey([], inputs())).toBeUndefined();
    });
});
