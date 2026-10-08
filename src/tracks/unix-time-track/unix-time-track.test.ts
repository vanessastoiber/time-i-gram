import * as PIXI from 'pixi.js';
import { scaleLinear } from 'd3-scale';
import UnixTimeTrack from './unix-time-track';

/** Minimal stand-in for HiGlass' TiledPixiTrack: a drawing surface, an x scale and a size. */
class FakeTiledPixiTrack {
    pMain = new PIXI.Graphics();
    _xScale = scaleLinear().domain([946684800, 1262304000]).range([0, 500]); // 2000-2010, in seconds
    dimensions = [500, 45];
    position = [0, 0];
    constructor(..._: unknown[]) {}
}

function createTrack(options: Record<string, unknown> = {}) {
    const HGC = { libraries: { PIXI }, tracks: { TiledPixiTrack: FakeTiledPixiTrack } };
    const context = { registerViewportChanged: () => {}, removeViewportChanged: () => {}, setDomainsCallback: () => {} };
    return new (UnixTimeTrack as any)(HGC, context, { layout: 'linear', ...options });
}

/** Number of separate line segments drawn on the track's graphics. */
function countLines(track: any) {
    track.pMain.finishPoly();
    return track.pMain.geometry.graphicsData.length;
}

describe('unix time axis track', () => {
    it('draws one tick per label and no extra center tick when the context label is empty', () => {
        const track = createTrack();
        track.draw();
        expect(track.context.text).toEqual(''); // a decade is shown without a context label
        expect(countLines(track)).toEqual(track.timeScale.ticks().length);
    });

    it('uses the theme font and colors', () => {
        const track = createTrack({ fontFamily: 'Helvetica', fontSize: 9, fontWeight: 'bold', color: '#123456', tickColor: '#ff0000' });
        track.draw();
        const style = track.axisTexts[0].style;
        expect([style.fontFamily, style.fontSize, style.fontWeight, style.fill]).toEqual(['Helvetica', '9px', 'bold', '#123456']);
        expect(track.pMain.geometry.graphicsData[0].lineStyle.color).toEqual(0xff0000);
    });
});
