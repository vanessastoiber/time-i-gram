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

describe('unix time axis track: time coordinate systems', () => {
    it('labels a relative axis with offsets and no center tick', () => {
        const track = createTrack({ timeCoordinates: { kind: 'relative', unit: 'week', anchorLabel: 'the peak' } });
        track._xScale = scaleLinear().domain([-4 * 604800, 10 * 604800]).range([0, 500]);
        track.draw();
        expect(track.axisTexts.map((t: any) => t.text)).toContain('+4 wk');
        expect(track.context.text).toEqual('weeks from the peak');
        expect(countLines(track)).toEqual(track.axisTicks.ticks.length);
    });

    it('labels a period axis by position within the period', () => {
        const track = createTrack({ timeCoordinates: { kind: 'period', unit: 'year', weekBased: false, start: 1 } });
        track._xScale = scaleLinear().domain([946684800, 978307200]).range([0, 500]);
        track.draw();
        expect(track.axisTexts.map((t: any) => t.text).slice(0, 2)).toEqual(['Jan', 'Feb']);
    });
});

describe('unix time axis track: label spacing', () => {
    const DAY = 86400;
    it('draws fewer ticks on a narrow track so that labels do not overlap (M7)', () => {
        const track = createTrack({ timeCoordinates: { kind: 'relative', unit: 'day' } });
        track._xScale = scaleLinear().domain([-3 * DAY, 3 * DAY]).range([0, 380]);
        track.dimensions = [380, 45];
        track.draw();
        const xs = track.axisTexts.map((t: any) => t.x);
        const gaps = xs.slice(1).map((x: number, i: number) => x - xs[i]);
        expect(Math.min(...gaps)).toBeGreaterThan(40); // "+2.5 d" is about 40 px at 12 px
    });
});

describe('unix time axis track: context label (G5)', () => {
    it('is not drawn on circular axes, whose middle is the center of the ring', () => {
        const options = { layout: 'circular', width: 400, height: 400, innerRadius: 100, outerRadius: 180, startAngle: 0, endAngle: 360 };
        const track = createTrack(options);
        track._xScale = scaleLinear().domain([Date.UTC(2010, 0, 1) / 1000, Date.UTC(2010, 11, 31) / 1000]).range([0, 400]);
        track.dimensions = [400, 400];
        track.draw();
        expect(track.context.text).toEqual('');
        // the same axis drawn linearly names the year
        const linear = createTrack();
        linear._xScale = track._xScale;
        linear.draw();
        expect(linear.context.text).toEqual('2010');
    });
});

describe('unix time axis track: labels at the ends (M9)', () => {
    it('keeps the first and last labels inside the axis', () => {
        const track = createTrack();
        // ticks at both ends of the domain: 2000 and 2010
        track._xScale = scaleLinear().domain([946684800, 1262304000]).range([0, 500]);
        track.draw();
        track.axisTexts.forEach((t: any) => {
            const left = t.x - t.anchor.x * t.width;
            expect(left).toBeGreaterThanOrEqual(0);
            expect(left + t.width).toBeLessThanOrEqual(500);
        });
    });
});

describe('unix time axis track: labels of circular axes (M9)', () => {
    it('are placed in the band reserved for the axis, outside the data ring', () => {
        // the compiler gives a circular axis track its own band: 45 px outside the data ring
        const options = { layout: 'circular', width: 400, height: 400, innerRadius: 155, outerRadius: 200, startAngle: 0, endAngle: 360 };
        const track = createTrack(options);
        track._xScale = scaleLinear().domain([Date.UTC(2010, 0, 1) / 1000, Date.UTC(2011, 0, 1) / 1000]).range([0, 400]);
        track.dimensions = [400, 400];
        // the track is placed below a view title: labels are centered on the ring, not on the canvas origin
        track.position = [10, 50];
        track.draw();
        track.axisTexts.forEach((t: any) => {
            const r = Math.hypot(t.x - (10 + 200), t.y - (50 + 200));
            // the data ring ends 45 px (the axis size) inside the outer radius
            expect(r).toBeGreaterThan(200 - 45);
            expect(r).toBeLessThanOrEqual(200);
        });
    });
});
