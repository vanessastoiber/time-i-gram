import type { GoslingSpec, SingleTrack } from '@gosling-lang/gosling-schema';
import { getRelativeTrackInfo } from './bounding-box';
import { traverseToFixSpecDownstream } from './spec-preprocess';
import { getTheme } from '../core/utils/theme';
import { cartesianToPolar, radianToValue, valueToRadian } from '../core/utils/polar';

/** Start and end angles the compiler assigns to the only track of a circular view. */
function compiledAngles(xType: 'genomic' | 'temporal', clockwise?: boolean) {
    const spec: GoslingSpec = {
        layout: 'circular',
        ...(clockwise === undefined ? {} : { clockwise }),
        tracks: [
            {
                data: { type: 'csv', url: '' },
                mark: 'line',
                x: { field: 'x', type: xType },
                width: 300,
                height: 100
            }
        ]
    } as GoslingSpec;
    traverseToFixSpecDownstream(spec);
    const track = getRelativeTrackInfo(spec, getTheme()).trackInfos[0].track as SingleTrack;
    return [track.startAngle, track.endAngle] as [number, number];
}

describe('circular direction', () => {
    it('keeps genomic circular tracks anticlockwise (upstream behavior)', () => {
        const [startAngle, endAngle] = compiledAngles('genomic');
        expect(startAngle).toBeLessThan(endAngle);
    });

    it('makes temporal circular tracks clockwise by default', () => {
        const [startAngle, endAngle] = compiledAngles('temporal');
        expect(startAngle).toBeGreaterThan(endAngle);
    });

    it('lets `clockwise` override the default in both directions', () => {
        const [gs, ge] = compiledAngles('genomic', true);
        expect(gs).toBeGreaterThan(ge);
        const [ts, te] = compiledAngles('temporal', false);
        expect(ts).toBeLessThan(te);
    });

    it('draws swapped angles as the mirror image, starting at 12 o’clock', () => {
        const at = (x: number, sa: number, ea: number) => cartesianToPolar(x, 100, 1, 0, 0, sa, ea);
        // a quarter of the way: 9 o'clock anticlockwise, 3 o'clock clockwise
        expect(at(25, 0, 360).x).toBeCloseTo(-1);
        expect(at(25, 360, 0).x).toBeCloseTo(1);
        expect(at(0, 360, 0).y).toBeCloseTo(-1);
    });

    it('inverts valueToRadian in both directions', () => {
        for (const [sa, ea] of [
            [0, 360],
            [360, 0],
            [20, 300],
            [300, 20]
        ]) {
            // (on a full circle, 0 and max are the same angle, so test interior values)
            for (const v of [1, 13, 50, 99]) {
                expect(radianToValue(valueToRadian(v, 100, sa, ea), 100, sa, ea)).toBeCloseTo(v);
            }
        }
    });
});
