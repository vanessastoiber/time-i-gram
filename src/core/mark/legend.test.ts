import * as PIXI from 'pixi.js';
import * as d3Selection from 'd3-selection';
import * as d3Drag from 'd3-drag';

import { GoslingTrackModel } from '../../tracks/gosling-track/gosling-track-model';
import type { SingleTrack } from '@gosling-lang/gosling-schema';
import { getTheme } from '../utils/theme';
import { drawColorLegend } from './legend';

const mockHGC = {
    libraries: {
        PIXI,
        d3Selection,
        d3Drag
    }
};

describe('Color Legend', () => {
    const g = new PIXI.Graphics();
    it('Nominal', () => {
        const t: SingleTrack = {
            data: { type: 'csv', url: '' },
            mark: 'line',
            x: { field: 'x', type: 'genomic' },
            color: { field: 'v', type: 'quantitative', legend: true },
            width: 100,
            height: 100
        };
        const d = [
            { x: 1, y: 2 },
            { x: 11, y: 22 },
            { x: 111, y: 222 }
        ];
        const model = new GoslingTrackModel(t, d, getTheme());
        drawColorLegend(
            mockHGC,
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

    it('Quantitative', () => {
        const t: SingleTrack = {
            layout: 'circular',
            startAngle: 0,
            endAngle: 240,
            innerRadius: 10,
            outerRadius: 40,
            data: { type: 'csv', url: '' },
            mark: 'point',
            x: { field: 'x', type: 'genomic' },
            color: { field: 'v', type: 'nominal', legend: true },
            width: 100,
            height: 100
        };
        const d = [
            { x: 1, v: '2' },
            { x: 11, v: '22' },
            { x: 111, v: '222' }
        ];
        const model = new GoslingTrackModel(t, d, getTheme());
        drawColorLegend(
            mockHGC,
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

describe('Color legend of temporal rings (G6)', () => {
    const legendOf = (xType: string) => {
        const g = new PIXI.Graphics();
        const t = {
            layout: 'circular',
            data: { type: 'csv', url: '' },
            mark: 'line',
            x: { field: 'x', type: xType },
            color: { field: 'year', type: 'nominal', legend: true, title: 'Year', domain: ['2010', '2011', '2012'] },
            width: 100,
            height: 100
        } as SingleTrack;
        const model = new GoslingTrackModel(t, [{ x: 1, year: '2010' }], getTheme());
        drawColorLegend(
            mockHGC,
            { dimensions: [100, 100], position: [0, 0], pBorder: g, displayedLegends: [], gLegend: { selectAll: () => ({ remove: () => {} }) } },
            null,
            model,
            getTheme()
        );
        const texts = g.children.filter(c => c instanceof PIXI.Text) as PIXI.Text[];
        return texts.map(t => [t.text, t.position.y] as [string, number]);
    };

    it('shows its title and compact entries', () => {
        const entries = legendOf('temporal');
        expect(entries.map(([text]) => text)).toEqual(['Year', '2010', '2011', '2012']);
        const genomic = legendOf('genomic');
        // genomic legends stay as they are: no title, the usual spacing
        expect(genomic.map(([text]) => text)).toEqual(['2010', '2011', '2012']);
        const step = (e: [string, number][]) => e[e.length - 1][1] - e[e.length - 2][1];
        expect(step(entries)).toBeLessThan(step(genomic));
    });
});
