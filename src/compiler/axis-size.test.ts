import { compile } from './compile';
import { getTheme } from '../core/utils/theme';
import type { GoslingSpec } from '../index';

/** Height of the bottom axis track and of the whole view for a one-track spec with an x axis. */
function compiledAxis(xType: 'genomic' | 'temporal') {
    const spec: GoslingSpec = {
        tracks: [
            {
                data: { type: xType === 'temporal' ? 'csv-time' : 'csv', url: '' },
                mark: 'point',
                x: { field: 'x', type: xType, axis: 'bottom' },
                width: 300,
                height: 100
            }
        ]
    } as GoslingSpec;
    let result: { axisType?: string; axisHeight?: number; totalHeight?: number } = {};
    compile(
        spec,
        (hs, size) => {
            const axis = hs.views[0].tracks.bottom?.[0] as { type: string; height: number } | undefined;
            result = { axisType: axis?.type, axisHeight: axis?.height, totalHeight: size.height };
        },
        [],
        getTheme(),
        {}
    );
    return result;
}

describe('x-axis size', () => {
    it('keeps the upstream 30px genomic axis', () => {
        const { axisType, axisHeight } = compiledAxis('genomic');
        expect(axisType).toEqual('axis-track');
        expect(axisHeight).toEqual(30);
    });

    it('uses a 45px time axis for temporal tracks', () => {
        const { axisType, axisHeight } = compiledAxis('temporal');
        expect(axisType).toEqual('unix-time-track');
        expect(axisHeight).toEqual(45);
    });

    it('reserves the axis height in the layout', () => {
        expect(compiledAxis('temporal').totalHeight! - compiledAxis('genomic').totalHeight!).toEqual(15);
    });
});
