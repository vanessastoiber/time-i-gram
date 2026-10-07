import { brushExtentToPixels } from './brush-track';
import { valueToRadian } from '../../core/utils/polar';

/** The brush's angular extent for pixels [x0, x1], as computed in `draw()` and `cropExtent()`. */
function brushExtent(x0: number, x1: number, width: number, startAngle: number, endAngle: number): [number, number] {
    const toD3Angle = (x: number) => {
        const a = valueToRadian(x, width, startAngle, endAngle) + Math.PI / 2.0;
        return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    };
    return [toD3Angle(x0), toD3Angle(x1)].sort((a, b) => a - b) as [number, number];
}

describe('circular brush', () => {
    it('maps a dragged extent back to the brushed pixels on anticlockwise tracks', () => {
        const [x0, x1] = brushExtentToPixels(brushExtent(20, 60, 100, 0, 360), 100, 0, 360);
        expect(x0).toBeCloseTo(20);
        expect(x1).toBeCloseTo(60);
    });

    it('maps a dragged extent back to the brushed pixels on clockwise tracks (not the mirrored range)', () => {
        // clockwise tracks have swapped angles; the anticlockwise-only formula returned [60, 20], a reversed domain
        const [x0, x1] = brushExtentToPixels(brushExtent(20, 60, 100, 360, 0), 100, 360, 0);
        expect(x0).toBeCloseTo(20);
        expect(x1).toBeCloseTo(60);
    });
});
