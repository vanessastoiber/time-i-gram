import { sampleSize } from 'lodash-es';
import type { Assembly, JsonTimeData } from '@gosling-lang/gosling-schema';
import { type CommonDataConfig, filterUsingGenoPos, sanitizeChrName } from '../utils';

type CsvTimeDataConfig = JsonTimeData & CommonDataConfig;

/**
 * HiGlass data fetcher specific for Gosling which ultimately will accept any types of data other than JSON values.
 */
function JsonTimeDataFetcher(HGC: any, ...args: any): any {
    if (!new.target) {
        throw new Error('Uncaught TypeError: Class constructor cannot be invoked without "new"');
    }

    class JsonTimeDataFetcherClass {
        private dataConfig: CsvTimeDataConfig;
        // @ts-ignore
        private tilesetInfoLoading: boolean;
        private chromSizes: any;
        private values: any;
        private assembly: Assembly;

        constructor(params: any[]) {
            const [dataConfig] = params;
            this.dataConfig = dataConfig;
            this.tilesetInfoLoading = false;
            this.assembly = this.dataConfig.assembly;

            if (!dataConfig.values) {
                console.error('Please provide `values` of the JSON data');
                return;
            }
            this.values = dataConfig.values.map((row: any) => {
                try {
                    const timestampField = this.dataConfig.timestampField;
                    if (timestampField && this.isValidTimestamp(row.timestampField)) {
                        return row;
                    }
                    const convertToDate = this.dataConfig.dateFields;
                    // todo add correct typing
                    const timeFormat = {};

                    if (convertToDate) {
                        for (const field of convertToDate) {
                            if (row[field]) {
                                timeFormat[field] = row[field];
                                const date = this.createDateFromFields(timeFormat);
                                const seconds = Date.parse(date) / 1000;
                                row[field] = seconds;
                            }
                        }
                    }
                    return row;
                } catch {
                    // skip the rows that had errors in them
                    return undefined;
                }
            });
        }

        isValidTimestamp(value: number) {
            const date = new Date(value);
            return !isNaN(date.getTime());
        }

        createDateFromFields(fields: any) {
            const { year = 1970, month = 1, day = 1 } = fields;
            const dateStr = `${year}-${month}-${day}`;
            return dateStr;
        }

        tilesetInfo(callback?: any) {
            this.tilesetInfoLoading = false;

            const TILE_SIZE = 1024;
            // TODO: Make dynamic
            const totalLength = 3088269832;
            const retVal = {
                tile_size: TILE_SIZE,
                max_zoom: Math.ceil(Math.log(totalLength / TILE_SIZE) / Math.log(2)),
                max_width: totalLength,
                min_pos: [0, 0],
                max_pos: [totalLength, totalLength]
            };

            if (callback) {
                callback(retVal);
            }

            return retVal;
        }

        fetchTilesDebounced(receivedTiles: any, tileIds: any) {
            const tiles: { [k: string]: any } = {};

            const validTileIds: any[] = [];
            const tilePromises = [];

            for (const tileId of tileIds) {
                const parts = tileId.split('.');
                const z = parseInt(parts[0], 10);
                const x = parseInt(parts[1], 10);
                const y = parseInt(parts[2], 10);

                if (Number.isNaN(x) || Number.isNaN(z)) {
                    console.warn('[Gosling Data Fetcher] Invalid tile zoom or position:', z, x, y);
                    continue;
                }

                validTileIds.push(tileId);
                tilePromises.push(this.tile(z, x, y));
            }

            Promise.all(tilePromises).then(values => {
                values.forEach((value, i) => {
                    const validTileId = validTileIds[i];
                    tiles[validTileId] = value;
                    tiles[validTileId].tilePositionId = validTileId;
                });
                receivedTiles(tiles);
            });

            return tiles;
        }

        tile(z: any, x: any, y: any) {
            const tsInfo = this.tilesetInfo();
            const tileWidth = +tsInfo.max_width / 2 ** +z;

            // get the bounds of the tile
            const minX = tsInfo.min_pos[0] + x * tileWidth;
            const maxX = tsInfo.min_pos[0] + (x + 1) * tileWidth;

            // filter the data so that visible data is sent to tracks
            let tabularData = filterUsingGenoPos(this.values, [minX, maxX], this.dataConfig);

            // sample the data to make it managable for visualization components
            const sizeLimit = this.dataConfig.sampleLength ?? 1000;
            if (sizeLimit < tabularData.length) {
                tabularData = sampleSize(tabularData, sizeLimit);
            }

            return {
                tabularData,
                server: null,
                tilePos: [x, y],
                zoomLevel: z
            };
        }
    }

    return new JsonTimeDataFetcherClass(args);
}

JsonTimeDataFetcher.config = {
    type: 'json-time'
};

export default JsonTimeDataFetcher;
