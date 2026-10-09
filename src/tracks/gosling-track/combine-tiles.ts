import { uniqBy } from 'lodash-es';
import type { Datum } from '@gosling-lang/gosling-schema';

/** The parts of a processed tile that combining tiles reads and writes. */
export interface CombinableTile {
    tabularData: Datum[];
    /** The tile's own rows, kept when the rows of all visible tiles are combined into the first tile */
    ownTabularData?: Datum[];
    /** Flag variable that indicate that rendering of this tile should be skipped */
    skipRendering: boolean;
    /** Track models of the tile's last draw */
    goslingModels?: unknown[];
}

/**
 * Upstream Gosling's combination (used for the `displace` transform), unchanged: the rows of the visible tiles
 * are merged into the first one, and the others are skipped. Note that a first tile that was combined before is
 * merged again with its previous combination; this is upstream behavior, kept as is (see
 * docs/upstream-proposals.md).
 */
export function combineTilesUpstream(tiles: (CombinableTile | undefined)[]) {
    if (!tiles[0]) return;
    let merged: Datum[] = [];

    tiles.forEach((tileInfo, i) => {
        if (tileInfo) {
            // Combine data
            merged = [...merged, ...tileInfo.tabularData];

            // Since we merge the data to the first one, skip rendering the rest
            tileInfo.skipRendering = i !== 0;
        }
    });

    const firstTileInfo = tiles[0];
    firstTileInfo.tabularData = merged;

    // Remove duplicated if any. Sparse tiles can have duplications.
    if (firstTileInfo.tabularData[0]?.uid) {
        firstTileInfo.tabularData = uniqBy(firstTileInfo.tabularData, 'uid');
    }
}

/**
 * Undo a previous temporal combination (the visible tiles may have changed since): every tile gets its own rows
 * back and is drawn again.
 */
export function resetTemporalCombination(tiles: (CombinableTile | undefined)[]) {
    tiles.forEach(tileInfo => {
        if (!tileInfo) return;
        tileInfo.skipRendering = false;
        if (tileInfo.ownTabularData) tileInfo.tabularData = tileInfo.ownTabularData;
    });
}

/**
 * Combination for lines and areas on a temporal axis: the first tile gets the rows of all visible tiles, each
 * tile's own rows only (never a previous combination), without duplicates (the time data fetchers return the
 * same row objects in every tile that needs them); the other tiles are skipped and lose their earlier models.
 */
export function combineTemporalTiles(tiles: (CombinableTile | undefined)[]) {
    resetTemporalCombination(tiles);
    if (!tiles[0] || tiles.length <= 1) return;
    const merged = new Set<Datum>();
    tiles.forEach((tileInfo, i) => {
        if (!tileInfo) return;
        tileInfo.ownTabularData = tileInfo.ownTabularData ?? tileInfo.tabularData;
        tileInfo.ownTabularData.forEach(row => merged.add(row));
        tileInfo.skipRendering = i !== 0;
        // a skipped tile is not transformed again, so drop the models of its earlier draws (partial aggregates
        // of its own rows), which mouse events would otherwise still read
        if (tileInfo.skipRendering && tileInfo.goslingModels) tileInfo.goslingModels = [];
    });
    const first = tiles[0];
    first.tabularData = first.tabularData[0]?.uid ? uniqBy(Array.from(merged), 'uid') : Array.from(merged);
}
