import * as PIXI from 'pixi.js';
import { GoslingTrackModel } from '../../tracks/gosling-track/gosling-track-model';
import type { SingleTrack } from '@gosling-lang/gosling-schema';
import { getTheme } from '../utils/theme';
import { drawLinearYAxis } from './axis';

describe('Y Axis', () => {
    const g = new PIXI.Graphics();
    it('Linear', () => {
        const t: SingleTrack = {
            data: { type: 'csv', url: '' },
            mark: 'line',
            x: { field: 'x', type: 'genomic' },
            y: { field: 'y', type: 'quantitative' },
            width: 100,
            height: 100
        };
        const d = [
            { x: 1, y: 2 },
            { x: 11, y: 22 },
            { x: 111, y: 222 }
        ];
        const model = new GoslingTrackModel(t, d, getTheme());
        drawLinearYAxis(
            { libraries: { PIXI } },
            {
                dimensions: [100, 400],
                position: [0, 0],
                pBorder: g
            },
            null,
            model,
            getTheme()
        );
    });

    it('Circular', () => {
        const t: SingleTrack = {
            layout: 'circular',
            startAngle: 0,
            endAngle: 240,
            innerRadius: 10,
            outerRadius: 40,
            data: { type: 'csv', url: '' },
            mark: 'line',
            x: { field: 'x', type: 'genomic' },
            y: { field: 'y', type: 'quantitative', axis: 'right' },
            width: 100,
            height: 100
        };
        const d = [
            { x: 1, y: 2 },
            { x: 11, y: 22 },
            { x: 111, y: 222 }
        ];
        const model = new GoslingTrackModel(t, d, getTheme());
        drawLinearYAxis(
            { libraries: { PIXI } },
            {
                dimensions: [100, 400],
                position: [0, 0],
                pBorder: g
            },
            null,
            model,
            getTheme()
        );
    });
});

describe('Y axis title and range (G1, G2)', () => {
    const header = { height: 32, legendLine: 0, yTitleLine: 1 };
    const draw = (y: object, extra: object = {}) => {
        const g = new PIXI.Graphics();
        const spec = {
            data: { type: 'csv', url: '' },
            mark: 'line',
            x: { field: 'x', type: 'temporal' },
            y: { field: 'y', type: 'quantitative', ...y },
            width: 100,
            height: 100,
            ...extra
        } as SingleTrack;
        const model = new GoslingTrackModel(spec, [{ x: 1, y: 2 }], getTheme());
        drawLinearYAxis({ libraries: { PIXI } }, { dimensions: [100, 100], position: [50, 10], pBorder: g }, null, model, getTheme());
        return g;
    };
    const texts = (g: PIXI.Graphics) => g.children.filter(c => c instanceof PIXI.Text) as PIXI.Text[];

    it('draws the title above its axis, in the header strip', () => {
        const extra = { _headerHeight: 32, _header: header };
        const left = texts(draw({ title: 'Consumption (Wh)' }, extra)).find(t => /Consumption/.test(t.text))!;
        expect(left.text).toEqual('\u2191 Consumption (Wh)');
        expect([left.position.x, left.position.y]).toEqual([52, 10 + 16 + 8]);
        const right = texts(draw({ title: 'Count', axis: 'right' }, extra)).find(t => /Count/.test(t.text))!;
        expect(right.text).toEqual('Count \u2191');
        expect(right.anchor.x).toEqual(1);
        // no header strip (e.g. genomic tracks): no title
        expect(texts(draw({ title: 'Count' })).some(t => /Count/.test(t.text))).toBe(false);
    });

    it('starts the axis below a header strip', () => {
        const labelYs = (g: PIXI.Graphics) => texts(g).map(t => t.position.y);
        expect(Math.min(...labelYs(draw({ domain: [0, 10] })))).toEqual(10);
        expect(Math.min(...labelYs(draw({ domain: [0, 10] }, { _headerHeight: 16 })))).toEqual(10 + 16 + 7);
    });
});
