import * as PIXI from 'pixi.js';
import { scaleLinear } from 'd3-scale';
import type { SingleTrack } from '@gosling-lang/gosling-schema';
import { GoslingTrackModel } from '../../tracks/gosling-track/gosling-track-model';
import { getTheme } from '../utils/theme';
import { drawArea } from './area';
import { drawText } from './text';
import type { Tile } from '@higlass/services';

/** Two series stacked on two time points (Unix seconds). */
const data = [
    { t: 946684800, s: 'a', v: 1 },
    { t: 946684800, s: 'b', v: 2 },
    { t: 949363200, s: 'a', v: 3 },
    { t: 949363200, s: 'b', v: 4 }
];

/** A stacked track (nominal color + quantitative y) on a temporal x axis. */
function stackedTemporalModel(mark: 'area' | 'text') {
    const spec: SingleTrack = {
        data: { type: 'csv-time', url: '' },
        mark,
        x: { field: 't', type: 'temporal' },
        y: { field: 'v', type: 'quantitative' },
        color: { field: 's', type: 'nominal' },
        text: { field: 's', type: 'nominal' },
        width: 100,
        height: 100
    };
    const model = new GoslingTrackModel(spec, data, getTheme());
    // In a running track, `drawMark` injects HiGlass' x scale; do the same here.
    model.setChannelScale('x', scaleLinear().domain([946684800, 949363200]).range([10, 90]));
    return model;
}

const trackMock = () => ({
    dimensions: [100, 100],
    _xScale: scaleLinear().domain([946684800, 949363200]).range([10, 90]),
    textGraphics: [] as PIXI.Text[],
    textsBeingUsed: 0
});

describe('stacked marks on a temporal x axis', () => {
    it('draws a stacked area', () => {
        const tile = { graphics: new PIXI.Graphics(), tileData: {} };
        drawArea({ libraries: { PIXI } } as any, trackMock(), tile as unknown as Tile, stackedTemporalModel('area'));
        expect(tile.graphics.geometry.graphicsData.length).toBeGreaterThan(0);
    });

    it('draws stacked text', () => {
        const track = trackMock();
        const tile = { graphics: new PIXI.Graphics(), tileData: {} };
        drawText({ libraries: { PIXI } } as any, track, tile as unknown as Tile, stackedTemporalModel('text'));
        expect(track.textsBeingUsed).toEqual(data.length);
    });
});
