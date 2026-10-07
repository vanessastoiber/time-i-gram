import { preverseZoomStatus } from './preserve-zoom-status';

/** A HiGlass view with one Gosling track whose x channel has the given type. */
const view = (uid: string, xType: 'genomic' | 'temporal', initialXDomain: [number, number]) => ({
    uid,
    initialXDomain,
    initialYDomain: initialXDomain,
    tracks: {
        center: [{ type: 'combined', contents: [{ type: 'gosling-track', options: { spec: { x: { type: xType } } } }] }]
    }
});

/** Previous config: one view `old` zoomed to [10, 20]. New config: `old` plus a new view linked to it. */
function update(xType: 'genomic' | 'temporal') {
    const prevSpec = { views: [view('old', xType, [10, 20])] };
    const newSpec = {
        views: [view('old', xType, [0, 100]), view('new', xType, [0, 100])],
        zoomLocks: { locksByViewUid: { old: 'L', new: 'L' }, locksDict: {} }
    };
    preverseZoomStatus(newSpec as any, prevSpec as any);
    return newSpec.views[1].initialXDomain;
}

describe('preverseZoomStatus', () => {
    it('gives a new genomic view the current zoom of its linked view (upstream behavior)', () => {
        expect(update('genomic')).toEqual([10, 20]);
    });

    it('keeps the spec domain of temporal views', () => {
        expect(update('temporal')).toEqual([0, 100]);
    });
});
