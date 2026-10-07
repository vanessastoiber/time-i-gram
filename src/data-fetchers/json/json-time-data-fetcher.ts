import { sampleSize } from 'lodash-es';
import type { JsonTimeData } from '@gosling-lang/gosling-schema';
import { type CommonDataConfig, filterUsingGenoPos } from '../utils';
import { parseDateTime, timestampToSeconds, utcSeconds } from '../time-utils';

type CsvTimeDataConfig = JsonTimeData & CommonDataConfig;

// Epoch-second bounds of the synthetic tileset this fetcher reports to HiGlass (~1500 CE to
// ~2030 CE). Shared between `tilesetInfo()` and `tile()` so the two stay consistent.
const MIN_POS_SECONDS = -14831769600;
const MAX_POS_SECONDS = 1893456000;

/**
 * HiGlass data fetcher specific for Gosling which ultimately will accept any types of data other than JSON values.
 */
function JsonTimeDataFetcher(HGC: any, ...args: any): any {
    if (!new.target) {
        throw new Error('Uncaught TypeError: Class constructor cannot be invoked without "new"');
    }

    class JsonTimeDataFetcherClass {
        private dataConfig: CsvTimeDataConfig;
        private values: any;
        // Resolves once `this.values` is actually populated. `tilesetInfo()` awaits this
        // before invoking its callback so HiGlass doesn't request tiles against an empty
        // array while a `url`-based fetch is still in flight (previously the callback fired
        // synchronously, so the first, empty, tile response was cached and nothing
        // re-rendered once the network fetch actually resolved).
        private dataPromise: Promise<void>;
        private hasWarnedUnparseable = false;

        constructor(params: any[]) {
            const [dataConfig] = params;
            this.dataConfig = dataConfig;

            if (!dataConfig.values && !dataConfig.url) {
                console.error('Please provide `values` of the JSON data');
                this.dataPromise = Promise.resolve();
                return;
            }

            if (dataConfig.url) {
                this.values = [];
                this.dataPromise = this.fetchData(dataConfig.url).then(data => {
                    data.forEach((row: any) => this.values.push(this.convertRow(row)));
                })
                    .catch(error => {
                        console.error(error);
                    });
            } else {
                this.values = dataConfig.values.map((row: any) => {
                    try {
                        return this.convertRow(row);
                    } catch {
                        // skip the rows that had errors in them
                        return undefined;
                    }
                });
                this.dataPromise = Promise.resolve();
            }
        }

        async fetchData(url: string): Promise<any> {
            return fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .catch(error => {
                    console.error(`Error fetching data: ${error}`);
                    return Promise.reject(error);
                });
        }

        isValidTimestamp(value: number) {
            const date = new Date(value);
            return !isNaN(date.getTime());
        }

        /** Convert the time fields of one row: a Unix timestamp in `timestampField`, otherwise `dateFields`. */
        convertRow(row: any) {
            const timestampField = this.dataConfig.timestampField;
            const timestamp = timestampField ? row[timestampField] : undefined;
            if (timestampField && timestamp !== '' && timestamp !== null && this.isValidTimestamp(Number(timestamp))) {
                row[timestampField] = timestampToSeconds(Number(timestamp), this.dataConfig.timestampUnit);
                return row;
            }
            return this.processRow(row, this.dataConfig.dateFields);
        }

        createDateFromFields(fields: { year: number; month: number; day: number }) {
            const { year = 1970, month = 1, day = 1 } = fields;
            const dateStr = `${year}-${month}-${day}`;
            return dateStr;
        }

        /**
         * Convert `dateFields` into Unix seconds, stored in the first field. A single field holds a
         * date or date-time (e.g. `2012-01-31`, `2012-01-31T08:00:00Z`, or a year). Several fields
         * are date components and must be named `year`, `month`, `day`, `hour`, `minute`, `second`.
         */
        processRow(row: any, convertToDate?: string[]) {
            try {
                if (convertToDate?.length === 1) {
                    const [field] = convertToDate;
                    const value = row[field];
                    row[field] = parseDateTime(String(value));
                    if (isNaN(row[field])) this.warnUnparseable(value);
                } else if (convertToDate) {
                    const parts = { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
                    for (const field of convertToDate) {
                        if (row[field]) {
                            parts[field as keyof typeof parts] = +row[field];
                        }
                    }
                    row[convertToDate[0]] = utcSeconds(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
                    if (isNaN(row[convertToDate[0]])) this.warnUnparseable(JSON.stringify(parts));
                }
                return row;
            } catch {
                // skip the rows that had errors in them
                return undefined;
            }
        }

        /** Warn (once per data source) about a date that cannot be parsed; such rows are not drawn. */
        warnUnparseable(value: unknown) {
            if (this.hasWarnedUnparseable) return;
            this.hasWarnedUnparseable = true;
            console.warn(
                `[json-time] Could not parse the date in ${JSON.stringify(value)}. ` +
                    'Rows with unparseable dates are not drawn. Further warnings for this data source are suppressed.'
            );
        }

        tilesetInfo(callback?: any) {
            const TILE_SIZE = 1024;
            // Epoch-second bounds covering a wide historical/future date range. `max_width`
            // must equal `max_pos - min_pos` -- HiGlass's tile-grid math (calculateTiles)
            // derives each tile's span from `min_pos` and `max_width`, so if the two disagree
            // (as they previously did: `max_width` was a smaller, unrelated constant) the
            // computed tile grid doesn't actually cover `[min_pos, max_pos]`. Any date whose
            // seconds value falls outside the resulting (wrong) grid is silently treated as
            // having zero visible tiles, so it's never fetched or drawn.
            const minPos = MIN_POS_SECONDS;
            const maxPos = MAX_POS_SECONDS;
            const totalLength = maxPos - minPos;
            const retVal = {
                tile_size: TILE_SIZE,
                max_zoom: Math.ceil(Math.log(totalLength / TILE_SIZE) / Math.log(2)),
                max_width: totalLength,
                min_pos: [minPos, minPos],
                max_pos: [maxPos, maxPos]
            };

            if (callback) {
                this.dataPromise.then(() => callback(retVal));
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
                tilePromises.push(this.dataPromise.then(() => this.tile(z, x, y)));
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

            // filter the data so that visible data is sent to tracks
            let tabularData = filterUsingGenoPos(this.values, [MIN_POS_SECONDS, MAX_POS_SECONDS], this.dataConfig);

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
