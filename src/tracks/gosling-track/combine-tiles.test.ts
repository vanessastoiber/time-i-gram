import { combineTemporalTiles, combineTilesUpstream, type CombinableTile } from './combine-tiles';

const tile = (rows: object[]): CombinableTile => ({ tabularData: rows as any, skipRendering: false });

describe('combining tiles for the displace transform (upstream path)', () => {
    it('merges the visible tiles into the first one and skips the others', () => {
        const tiles = [tile([{ uid: 'a' }]), tile([{ uid: 'b' }, { uid: 'a' }])];
        combineTilesUpstream(tiles);
        expect(tiles[0].tabularData).toEqual([{ uid: 'a' }, { uid: 'b' }]);
        expect(tiles.map(t => t.skipRendering)).toEqual([false, true]);
    });

    it('keeps upstream behavior when combining again: the previous combination is merged again', () => {
        const rows = [{ v: 1 }, { v: 2 }];
        const tiles = [tile([rows[0]]), tile([rows[1]])];
        combineTilesUpstream(tiles);
        combineTilesUpstream(tiles);
        // no own-rows bookkeeping and no reset on this path
        expect(tiles[0].ownTabularData).toBeUndefined();
        expect(tiles[0].tabularData).toEqual([rows[0], rows[1], rows[1]]);
    });
});

describe('combining tiles for temporal lines', () => {
    it("merges each tile's own rows once, also when combining again with other visible tiles", () => {
        const shared = { t: 2 };
        const tiles = [tile([{ t: 1 }, shared]), tile([shared, { t: 3 }]), tile([{ t: 4 }])];
        combineTemporalTiles(tiles);
        expect(tiles[0].tabularData.map(r => r.t)).toEqual([1, 2, 3, 4]);
        // the visible tiles change: the first tile gets its own rows back before combining
        combineTemporalTiles(tiles.slice(0, 2));
        expect(tiles[0].tabularData.map(r => r.t)).toEqual([1, 2, 3]);
        expect(tiles.slice(0, 2).map(t => t.skipRendering)).toEqual([false, true]);
        // a single visible tile is drawn with its own rows
        combineTemporalTiles(tiles.slice(1, 2));
        expect(tiles[1].tabularData.map(r => r.t)).toEqual([2, 3]);
        expect(tiles[1].skipRendering).toBe(false);
    });
});

describe('skipped tiles of temporal lines', () => {
    it('drop the models of earlier draws, which hold partial aggregates of their own rows', () => {
        const tiles = [tile([{ t: 1 }]), tile([{ t: 2 }])].map(t => ({ ...t, goslingModels: ['stale'] }));
        combineTemporalTiles(tiles);
        expect(tiles[1].goslingModels).toEqual([]);
        expect(tiles[0].goslingModels).toEqual(['stale']); // rebuilt by the track right after
    });
});
