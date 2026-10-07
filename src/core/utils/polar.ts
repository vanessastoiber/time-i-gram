export const RADIAN_GAP = 0; //0.04;

/**
 * Convert a value in a single-linear axis to a radian value. Anticlockwise, starts from 12 o'clock.
 * v span from zero to `max`.
 *
 * When `sa > ea`, the same sector is traversed clockwise (from `sa` back to `ea`). The compiler
 * swaps the start and end angles of clockwise tracks (see `clockwise` in the spec).
 */
export function valueToRadian(v: number, max: number, sa: number, ea: number, g?: number) {
    const safeVal = Math.max(Math.min(max, v), 0);
    const gap = g ?? RADIAN_GAP;
    const radExtent = ((ea - sa) / 360) * Math.PI * 2 - gap * 2;
    const radStart = (sa / 360) * Math.PI * 2;
    return -(radStart + (safeVal / max) * radExtent) - Math.PI / 2.0 - gap;
}

/**
 * Inverse of `valueToRadian`: the value in `[0, max]` drawn at `radian` (taken modulo 2π).
 */
export function radianToValue(radian: number, max: number, sa: number, ea: number, g?: number) {
    const gap = g ?? RADIAN_GAP;
    const radExtent = ((ea - sa) / 360) * Math.PI * 2 - gap * 2;
    const radStart = (sa / 360) * Math.PI * 2;
    const valueAt = (r: number) => (max * (-r - Math.PI / 2.0 - gap - radStart)) / radExtent;
    // pick the turn of the circle on which the value falls inside [0, max]
    const candidates = [-2, -1, 0, 1, 2].map(k => valueAt(radian + k * Math.PI * 2));
    const inside = candidates.find(v => v >= -1e-9 && v <= max + 1e-9);
    if (inside !== undefined) return Math.max(Math.min(max, inside), 0);
    return candidates.reduce((a, b) => (Math.min(Math.abs(a), Math.abs(a - max)) <= Math.min(Math.abs(b), Math.abs(b - max)) ? a : b));
}

/**
 * Whether an arc from the radian of a smaller value to the radian of a larger value must be drawn
 * anticlockwise, i.e., whether the track runs anticlockwise (`sa <= ea`) or clockwise (`sa > ea`).
 */
export function isAnticlockwise(sa: number, ea: number) {
    return sa <= ea;
}

/**
 * Convert a position in a cartesian system to a polar coordinate.
 */
export function cartesianToPolar(x: number, max: number, r: number, cx: number, cy: number, sa: number, ea: number) {
    return {
        x: cx + r * Math.cos(valueToRadian(x, max, sa, ea)),
        y: cy + r * Math.sin(valueToRadian(x, max, sa, ea))
    };
}

export function positionToRadian(x: number, y: number, cx: number, cy: number) {
    if (cx <= x) {
        return Math.atan((y - cy) / (x - cx));
    } else {
        return Math.atan((y - cy) / (x - cx)) - Math.PI;
    }
}

/**
 * Calculate a degree in the range of [0, 360) based on two points. Anticlockwise, starts from 12 o'clock.
 */
export function pointsToDegree(x: number, y: number, cx: number, cy: number) {
    return ((Math.atan2(-(y - cy), x - cx) / Math.PI) * 180 + 270) % 360;
}
