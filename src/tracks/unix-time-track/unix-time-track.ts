import { scaleUtc } from 'd3-scale';
import { utcFormat } from 'd3-time-format';
import * as uuid from 'uuid';

const durationSecond = 1000;
const durationMinute = durationSecond * 60;
const durationHour = durationMinute * 60;
const durationDay = durationHour * 24;
const durationWeek = durationDay * 7;
const durationYear = durationDay * 365;

const formatSecond = utcFormat('%Y %b %d (%I:%M:%S %p)');
const formatMinute = utcFormat('%Y %b %d (%I:%M %p)');
const formatHour = utcFormat('%Y %b %d (%I %p)');
const formatDay = utcFormat('%Y %b %d');
const formatWeek = utcFormat('%Y %b');
const formatMonth = utcFormat('%Y');
const formatYear = utcFormat('');

const ZOOM_LEVEL_YEAR = 0;
const ZOOM_LEVEL_WEEK = 1;
const ZOOM_LEVEL_DAY = 2;

function timeFormat(date: number | Date, timeDelta: number) {
  const d = typeof date === 'number' ? new Date(date) : date;
  return (timeDelta < durationSecond ? formatSecond
    : timeDelta < durationMinute ? formatMinute
      : timeDelta < durationHour ? formatHour
        : timeDelta < durationDay ? formatDay
          : timeDelta < durationWeek ? formatWeek
            : timeDelta < durationYear ? formatMonth
              : formatYear)(d);
}

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
      //scene, trackConfig, dataConfig, handleTilesetInfoReceived, animate,
      super(...params);
        // scene,
        // dataConfig,
        // handleTilesetInfoReceived,
        // trackConfig.options,
        // animate,
      // );

      const [context, options] = params;
      const { registerViewportChanged, removeViewportChanged, setDomainsCallback } = context;

      this.uid = uuid.v1();
      this.options = options;
    
      this.axisTexts = [];
      this.endpointsTexts = [];
      this.axisTextFontFamily = 'Arial';
      this.axisTextFontSize = 12;
      this.timeScale = this._xScale;
      this.context = new PIXI.Text(
        'sample',
        {
          fontSize: `${this.axisTextFontSize}px`,
          fontFamily: this.axisTextFontFamily,
          fill: 'black',
        },
      );
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

    createAxisTexts() {
      const ticks = this.timeScale.ticks();
      const tickFormat = this.timeScale.tickFormat();

      let i = 0;

      while (i < ticks.length) {
        const tick = ticks[i];

        while (this.axisTexts.length <= i) {
          const newText = new PIXI.Text(
            tick,
            {
              fontSize: `${this.axisTextFontSize}px`,
              fontFamily: this.axisTextFontFamily,
              fill: 'black',
            },
          );
          this.axisTexts.push(newText);
          this.pMain.addChild(newText);
        }

        this.axisTexts[i].text = tickFormat(tick);
        this.axisTexts[i].anchor.y = 0.5;
        this.axisTexts[i].anchor.x = 0.5;
        i++;
      }

      while (this.axisTexts.length > ticks.length) {
        const lastText = this.axisTexts.pop();
        this.pMain.removeChild(lastText);
      }
    }

    drawTicks(tickStartY: number, tickEndY: number) {
      this.timeScale.ticks().forEach((tick: any, i: string | number) => {
        const xPos = this.position[0] + this.timeScale(tick);

        this.pMain.moveTo(xPos, this.position[1] + tickStartY);
        this.pMain.lineTo(xPos, this.position[1] + tickEndY);

        this.axisTexts[i].x = xPos;
        this.axisTexts[i].y = this.position[1] + tickEndY + betweenTickAndText;
      });
    }

    drawContext(tickStartY: number, tickEndY: number) {
      const ticks = this.timeScale.ticks();
      const center = (+this.timeScale.domain()[1] + +this.timeScale.domain()[0]) / 2;
      const tickDiff = +ticks[1] - +ticks[0];

      const xPos = this.position[0] + this.timeScale(center);
      this.context.text = timeFormat(center, tickDiff);
      this.context.x = xPos;
      this.context.y = this.position[1] + tickEndY + betweenCenterTickAndText;
      if (this.context.text !== ' ') {
        this.pMain.moveTo(xPos, this.position[1] + tickStartY);
        this.pMain.lineTo(xPos, this.position[1] + tickEndY);
      }
    }

    draw() {
      const graphics = this.pMain;
      graphics.clear();
      graphics.lineStyle(1, 0x000000, 1);

      const tickStartY = (this.dimensions[1] - tickHeight - textHeight - betweenTickAndText) / 2;
      const tickEndY = tickStartY + tickHeight;

      this.updateTimeScale();
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

    // calculateVisibleTiles() {
    //   this.calculateZoomLevel();

    //   if ('resolutions' in this.tilesetInfo) {
    //     const sortedResolutions = this.tilesetInfo.resolutions
    //         .map((x: number) => +x)
    //         .sort((a: number, b: number) => b - a);

    //     const xTiles = tileProxy.calculateTilesFromResolution(
    //         sortedResolutions[zoomLevel],
    //         this._xScale,
    //         this.tilesetInfo.min_pos[0],
    //         this.tilesetInfo.max_pos[0]
    //     );

    //     let yTiles: number[] | undefined;
    //     if (Is2DTrack(resolveSuperposedTracks(this.options.spec)[0])) {
    //         // it makes sense only when the y-axis is being used for a genomic field
    //         yTiles = tileProxy.calculateTilesFromResolution(
    //             sortedResolutions[zoomLevel],
    //             this._yScale,
    //             this.tilesetInfo.min_pos[0],
    //             this.tilesetInfo.max_pos[0]
    //         );
    //     }

    //     const tiles = GoslingTrackClass.#tilesToId(xTiles, yTiles, zoomLevel);

    //     this.setVisibleTiles(tiles);
    // } else {
    //     const xTiles = tileProxy.calculateTiles(
    //         zoomLevel,
    //         this.relevantScale(),
    //         this.tilesetInfo.min_pos[0],
    //         this.tilesetInfo.max_pos[0],
    //         this.tilesetInfo.max_zoom,
    //         this.tilesetInfo.max_width
    //     );

    //     let yTiles: number[] | undefined;
    //     if (Is2DTrack(resolveSuperposedTracks(this.options.spec)[0])) {
    //         // it makes sense only when the y-axis is being used for a genomic field
    //         yTiles = tileProxy.calculateTiles(
    //             zoomLevel,
    //             this._yScale,
    //             this.tilesetInfo.min_pos[1],
    //             this.tilesetInfo.max_pos[1],
    //             this.tilesetInfo.max_zoom,
    //             // @ts-expect-error what is max_width1?
    //             this.tilesetInfo.max_width1 ?? this.tilesetInfo.max_width
    //         );
    //     }

    //     const tiles = GoslingTrackClass.#tilesToId(xTiles, yTiles, zoomLevel);
    //     this.setVisibleTiles(tiles);
    // }

    //   const resolution = this.tilesetInfo.resolutions[this.zoomLevel];
    //   // const resolution = 60;
      
    //   const minX = this.tilesetInfo.min_pos[0];
    //   const maxX = this.tilesetInfo.max_pos[0];

    //   const epsilon = 0.000001;
    //   const tileWidth = resolution;

    //   const lowerBound = Math.max(
    //     0,
    //     Math.floor((this.timeScale.domain()[0] - minX) / tileWidth),
    //   );
    //   const upperBound = Math.max(0, Math.ceil(
    //     Math.min(maxX, this.timeScale.domain()[1] - minX - epsilon) / tileWidth,
    //   ));

    //   const tiles = [];
    //   for (let i = lowerBound; i <= upperBound; i++) {
    //     tiles.push(`test.${this.zoomLevel}.${i}.${0}`);
    //   }

    //   this.setVisibleTiles(tiles);
    // }

    calculateZoomLevel() {
      const [l, r] = this.timeScale.domain();
      const days = (r - l) / (1000 * 60 * 60 * 24);

      if (days > 365) {
        this.zoomLevel = ZOOM_LEVEL_YEAR;
        // this.zoomText.text = 'resolution: YEAR';
      } else if (days > 14) {
        this.zoomLevel = ZOOM_LEVEL_WEEK;
        // this.zoomText.text = 'resolution: WEEK';
      } else {
        this.zoomLevel = ZOOM_LEVEL_DAY;
        // this.zoomText.text = 'resolution: DAY';
      }
    }

    /* --------------------------- Getter / Setter ---------------------------- */

    zoomed(newXScale: any, newYScale: any) {
      this.xScale(newXScale);
      this.yScale(newYScale);

      // if (!this.tilesetInfo) {
      //   return;
      // }

      // this.calculateZoomLevel();
      // this.calculateVisibleTiles();

      // this.refreshTiles();

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
  },
};

export default UnixTimeTrack;