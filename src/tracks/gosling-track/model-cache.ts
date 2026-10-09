import type { SingleTrack } from '@gosling-lang/gosling-schema';
import { IsChannelDeep } from '@gosling-lang/gosling-schema';

/** Data transforms whose result depends on the current x scale: their models are rebuilt on every draw. */
const SCALE_DEPENDENT_TRANSFORMS = ['displace', 'coverage'];

/** What a tile's track models are computed from, besides the track spec and the tile's rows. */
export interface ModelInputs {
    tileId: string;
    /** The tiles whose rows are combined into this tile (temporal lines), in order */
    combinedTileIds?: string[];
    /** Size of the track (px) */
    dimensions: [number, number];
    /** Visible x domain */
    domain: [number, number];
}

/**
 * Key of the inputs of a tile's track models, so that a temporal track reuses its models while it is zoomed or
 * panned within the same tiles: data transforms, time units and aggregation then run once per tile instead of
 * on every draw. `undefined` means the models are rebuilt on every draw: always for non-temporal tracks (as in
 * upstream Gosling) and for transforms that depend on the x scale. Rings of temporal lines and areas keep only
 * the rows of the visible arc (`rowsInVisibleArc`), so their key includes the visible domain.
 */
export function modelsCacheKey(specs: SingleTrack[], inputs: ModelInputs): string | undefined {
    const isTemporal = specs.length > 0 && specs.every(s => IsChannelDeep(s.x) && s.x.type === 'temporal');
    if (!isTemporal) return undefined;
    if (specs.some(s => s.dataTransform?.some(t => SCALE_DEPENDENT_TRANSFORMS.includes(t.type)))) return undefined;
    const dependsOnDomain = specs.some(s => s.layout === 'circular' && (s.mark === 'line' || s.mark === 'area'));
    return JSON.stringify([
        inputs.tileId,
        inputs.combinedTileIds ?? [],
        inputs.dimensions,
        dependsOnDomain ? inputs.domain : null
    ]);
}
