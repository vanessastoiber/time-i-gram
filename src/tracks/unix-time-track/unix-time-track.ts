import type { PIXI } from '@higlass/libraries';
import { scaleUtc } from 'd3-scale';
import { timeAxisTicks, type TimeAxisTicks } from './time-axis-ticks';
import { cartesianToPolar } from '../../core/utils/polar';
import colorToHex from '../../core/utils/color-to-hex';
import * as uuid from 'uuid';

const ZOOM_LEVEL_YEAR = 0;
const ZOOM_LEVEL_WEEK = 1;
const ZOOM_LEVEL_DAY = 2;

const tickHeight = 10;
const textHeight = 10;
const betweenTickAndText = 10;
const betweenCenterTickAndText = 20;

function UnixTimeTrack(HGC: any, ...args: any[]): any {
    if (!new.target) {
        throw new Error('Uncaught TypeError: Class constructor cannot be invoked without "new"');
    }

  // HiGlass Code
  const { PIXI } = HGC.libraries;

  class UnixTimeTrackClass extends HGC.tracks.TiledPixiTrack {
    constructor(params: any[]) {
      super(...params);

      const [context, options] = params;
      const { registerViewportChanged, removeViewportChanged, setDomainsCallback } = context;

      this.uid = uuid.v1();
      this.options = options;
      if (this.options.layout === 'circular') {
        this.pTicksCircular = new PIXI.Graphics();
        this.pMain.addChild(this.pTicksCircular);
      }
    
      this.axisTexts = [];
      this.endpointsTexts = [];
      // Font and colors come from the theme (see `setUnixTimeTrack`), with the previous defaults as fallback.
      this.axisTextFontFamily = this.options.fontFamily ?? 'Arial';
      this.axisTextFontSize = this.options.fontSize ?? 12;
      this.axisTextStyle = {
        fontSize: `${this.axisTextFontSize}px`,
        fontFamily: this.axisTextFontFamily,
        fontWeight: this.options.fontWeight ?? 'normal',
        fill: this.options.color ?? 'black',
      };
      this.tickColor = colorToHex(this.options.tickColor ?? 'black');
      this.timeScale = this._xScale;
      this.context = new PIXI.Text('sample', this.axisTextStyle);
      this.context.anchor.y = 0.4;
      this.context.anchor.x = 0.5;
      this.pMain.addChild(this.context);

      this.zoomText = new PIXI.Text(
        '',
        {
          fontSize: '16px',
          fontFamily: this.axisTextFontFamily,
          fill: 'red',
        },
      );
      
      this.pMain.addChild(this.zoomText);

      this.zoomText.x = 16;
      this.zoomText.y = 120;
    }

    initTile() {
    }

    updateTimeScale() {
      const linearScale = this._xScale.copy();
      const timeScale = scaleUtc()
        .domain(linearScale.domain().map((d: number) => d * 1000))
        .range(linearScale.range());
      this.timeScale = timeScale;
      return timeScale;
    }

    /** Ticks and labels in the axis' time coordinate system (absolute dates, positions in a period, offsets). */
    updateAxisTicks(): TimeAxisTicks {
      const domain = this._xScale.domain() as [number, number];
      // as many ticks as fit along the axis: its width, or the circumference at the labels of a circular axis
      this.axisTicks = timeAxisTicks(domain, this.options.timeCoordinates, 10, this.axisLength(), this.axisTextFontSize * 0.6);
      return this.axisTicks;
    }

    /** Length of the axis along which labels are placed, in px. */
    axisLength(): number {
      const [width, height] = this.dimensions ?? [0, 0];
      if (this.options.layout !== 'circular') return width;
      const { startAngle = 0, endAngle = 360 } = this.options;
      const factor = Math.min(width, height) / Math.min(this.options.width, this.options.height);
      // the radius at which `addCurvedText` places the labels
      const r = (this.options.outerRadius * factor + this.options.innerRadius * factor - 100) / 2.0;
      const length = (2 * Math.PI * Math.max(r, 1) * Math.abs(endAngle - startAngle)) / 360;
      return isFinite(length) ? length : width;
    }

    createAxisTexts() {
      const { ticks, labels } = this.axisTicks as TimeAxisTicks;

      let i = 0;

      while (i < ticks.length) {
        while (this.axisTexts.length <= i) {
          const newText = new PIXI.Text('', this.axisTextStyle);
          this.axisTexts.push(newText);
          this.pMain.addChild(newText);
        }

        this.axisTexts[i].text = labels[i];
        this.axisTexts[i].anchor.y = this.options.layout === 'circular' ? 0.5 : this.options.reverseOrientation ? 0 : 0.5;
        this.axisTexts[i].anchor.x = 0.4;
        i++;
      }

      while (this.axisTexts.length > ticks.length) {
        const lastText = this.axisTexts.pop();
        this.pMain.removeChild(lastText);
        if (this.options.layout === 'circular') {
          this.pTicksCircular.removeChildren();
        }
      }
    }

    addCurvedText(textObj: PIXI.Text, cx: number) {
      const [width, height] = this.dimensions;
      const { startAngle, endAngle } = this.options;
      const factor = Math.min(width, height) / Math.min(this.options.width, this.options.height);
      const innerRadius = this.options.innerRadius * factor -100;
      const outerRadius = this.options.outerRadius * factor;

      const r = (outerRadius + innerRadius) / 2.0;
      const centerPos = cartesianToPolar(cx, width, r, width / 2.0, height / 2.0, startAngle, endAngle);
      textObj.x = centerPos.x;
      textObj.y = centerPos.y;

      textObj.resolution = 4;
      const txtStyle = new HGC.libraries.PIXI.TextStyle(this.pixiTextConfig);
      const metric = HGC.libraries.PIXI.TextMetrics.measureText(textObj.text, txtStyle);

      // scale the width of text label so that its width is the same when converted into circular form
      const tw = ((metric.width / (2 * r * Math.PI)) * width * 360) / Math.abs(endAngle - startAngle);
      // let [minX, maxX] = [cx + tw / 2.0, cx - tw / 2.0]; // Swap the values of minX and maxX
      let [minX, maxX] = [cx - tw / 2.0, cx + tw / 2.0];
      // make sure not to place the label on the origin
      if (minX < 0) {
          const gap = -minX;
          minX = 0;
          maxX += gap;
      } else if (maxX > width) {
          const gap = maxX - width;
          maxX = width;
          minX -= gap;
      }

      const ropePoints: PIXI.Point[] = [];
      // Cause fat font tick labels to be drawn as curved text
      // const baseR = innerRadius + metric.height / 2.0 + 3 + 40;
      // for (let i = maxX; i >= minX; i -= tw / 10.0) {
      //     const p = cartesianToPolar(i, width, baseR, width / 2.0, height / 2.0, startAngle, endAngle);
      //     ropePoints.push(new HGC.libraries.PIXI.Point(p.x, p.y));
      // }

      if (ropePoints.length === 0) {
          return undefined;
      }

      // textObj.updateText();
      const rope = new HGC.libraries.PIXI.SimpleRope(textObj.texture, ropePoints);
      return rope;
  }

    /** Move a label of a linear axis inward if it would extend past an end of the axis (e.g. a tick at the edge). */
    keepLabelInside(text: PIXI.Text) {
      const [start, end] = [this.position[0], this.position[0] + this.dimensions[0]];
      const left = text.x - text.anchor.x * text.width;
      if (left < start) text.x += start - left;
      else if (left + text.width > end) text.x -= left + text.width - end;
    }

    drawTicks(tickStartY: number, tickEndY: number) {
      (this.axisTicks as TimeAxisTicks).ticks.forEach((tick: number, i: number) => {
        const xPos = this.position[0] + this.timeScale(tick * 1000);

        if (this.options.layout === 'circular') {
          const rope = this.addCurvedText(this.axisTexts[i], xPos);
          rope && this.pTicksCircular.addChild(rope);
        } else {
          this.axisTexts[i].x = xPos;
          this.axisTexts[i].y = this.position[1] + tickEndY + betweenTickAndText - 15;
          this.keepLabelInside(this.axisTexts[i]);
          this.pMain.moveTo(xPos, this.position[1] + tickStartY - 10);
          this.pMain.lineTo(xPos, this.position[1] + tickEndY - 5);
        }
      });
    }

    /**
     * The context label under a linear axis: the visible range at a coarser unit, the visible weeks, or what
     * offsets count (see `timeAxisTicks`). Not drawn on circular axes, where the middle of the axis is the
     * center of the ring.
     */
    drawContext(tickStartY: number, tickEndY: number) {
      const center = (+this.timeScale.domain()[1] + +this.timeScale.domain()[0]) / 2;

      const xPos = this.position[0] + this.timeScale(center);
      this.context.text = this.options.layout === 'circular' ? '' : (this.axisTicks as TimeAxisTicks).context;
      this.context.x = xPos;
      this.context.y = this.position[1] + tickEndY + betweenCenterTickAndText;
    }

    draw() {
      const graphics = this.pMain;
      graphics.clear();
      graphics.lineStyle(1, this.tickColor, 1);

      const tickStartY = (this.dimensions[1] - tickHeight - textHeight - betweenTickAndText) / 2;
      const tickEndY = tickStartY + tickHeight;
      if (this.options.layout === 'circular') {
        this.pTicksCircular.removeChildren();
      }

      this.updateTimeScale();
      this.updateAxisTicks();
      this.createAxisTexts();
      this.drawTicks(tickStartY, tickEndY);
      this.drawContext(tickStartY, tickEndY);
    }

    tileToLocalId(tile: any) {
      return tile;
    }

    tileToRemoteId(tile: { split: (arg0: string) => [any, any, any, any]; }) {
      // eslint-disable-next-line no-unused-vars
      const [_, z, x, y] = tile.split('.');
      return `${z}.${x}.${y}`;
    }

    calculateZoomLevel() {
      const [l, r] = this.timeScale.domain();
      const days = (r - l) / (1000 * 60 * 60 * 24);

      if (days > 365) {
        this.zoomLevel = ZOOM_LEVEL_YEAR;
      } else if (days > 14) {
        this.zoomLevel = ZOOM_LEVEL_WEEK;
      } else {
        this.zoomLevel = ZOOM_LEVEL_DAY;
      }
    }

    /* --------------------------- Getter / Setter ---------------------------- */

    zoomed(newXScale: any, newYScale: any) {
      this.xScale(newXScale);
      this.yScale(newYScale);

      this.draw();
    }
  }

  return new UnixTimeTrackClass(args);
};

UnixTimeTrack.config = {
  type: 'unix-time-track',
  datatype: [],
  orientation: '1d-horizontal',
  name: 'UnixTime',
  availableOptions: [
  ],
  defaultOptions: {
    // innerRadius: 340,
    //     outerRadius: 310,
    //     startAngle: 0,
    //     endAngle: 360,
    //     width: 700,
    //     height: 700,
    //     layout: 'linear',
    //     labelPosition: 'none',
    //     labelColor: 'black',
    //     labelTextOpacity: 0.4,
    //     trackBorderWidth: 0,
    //     trackBorderColor: 'black',
    //     tickPositions: 'even',
    //     fontSize: 12,
    //     fontFamily: 'sans-serif', // 'Arial',
    //     fontWeight: 'normal',
    //     color: '#808080',
    //     stroke: '#ffffff',
    //     backgroundColor: 'transparent',
    //     showMousePosition: false
  },
};

export default UnixTimeTrack;