import { sampleSize } from 'lodash-es';
import { dsvFormat as d3dsvFormat, type DSVRowString } from 'd3-dsv';
import type { CSVTimeData } from '@gosling-lang/gosling-schema';
import { type CommonDataConfig, filterUsingGenoPos } from '../utils';
import { formatIsoDate, parseDateTime, timestampToSeconds, utcSeconds, TIME_MAX_POS, TIME_MIN_POS } from '../time-utils';

type CsvTimeDataConfig = CSVTimeData & CommonDataConfig;

/**
 * HiGlass data fetcher specific for Gosling which ultimately will accept any types of data other than JSON values.
 */
function CSVTimeDataFetcher(HGC: any, ...args: any): any {
    if (!new.target) {
        throw new Error('Uncaught TypeError: Class constructor cannot be invoked without "new"');
    }

    class CSVTimeDataFetcherClass {
        private dataConfig: CsvTimeDataConfig;
        private values: any;
        // Resolves once `this.values` is actually populated. `tilesetInfo()` awaits this
        // before invoking its callback so HiGlass doesn't request tiles against an empty
        // array while the fetch is still in flight (previously the callback fired
        // synchronously, so the first, empty, tile response was cached and nothing
        // re-rendered once the network fetch actually resolved).
        private dataPromise: Promise<void>;
        private hasWarnedUnparseable = false;

        constructor(params: any[]) {
            const [dataConfig] = params;
            this.dataConfig = dataConfig;

            if (!dataConfig.url) {
                console.error('Please provide `values` of the JSON data');
                this.dataPromise = Promise.resolve();
                return;
            }

            this.values = [];
            const separator = this.dataConfig.separator ?? ',';
            this.dataPromise = this.fetchData().then(data => {
                d3dsvFormat(separator).parse(data, (row: DSVRowString<string>) => {
                    const timestampField = this.dataConfig.timestampField;
                    if (timestampField && row[timestampField] !== '' && this.isValidTimestamp(Number(row[timestampField]))) {
                        (row as any)[timestampField] = timestampToSeconds(Number(row[timestampField]), this.dataConfig.timestampUnit);
                        this.values.push(row);
                        return row;
                    }
                    // Convert the start and end columns of an interval individually: numbers are
                    // taken as Unix timestamps, anything else is parsed as a date.
                    const intervalSpec = this.dataConfig.interval ?? [];
                    intervalSpec.forEach(field => {
                        const value = row[field];
                        if (value === undefined || value === '') return;
                        (row as any)[field] = /^-?\d+(\.\d+)?$/.test(value.trim())
                            ? timestampToSeconds(Number(value), this.dataConfig.timestampUnit)
                            : this.parseAndConvertToSeconds(value);
                    });
                    // Interval columns are already converted, so leave them out of `dateFields`.
                    const convertToDate = this.dataConfig.dateFields?.filter(field => !intervalSpec.includes(field));
                    const convertedRow = this.processRow(row, convertToDate?.length ? convertToDate : undefined);
                    this.values.push(convertedRow);
                });
            })
                .catch(error => {
                    console.error(error);
                });
        }

        async fetchData(): Promise<any> {
            const { url } = this.dataConfig;
            return fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.text();
                })
                .catch(error => {
                    console.error(`Error fetching data: ${error}`);
                    return Promise.reject(error);
                });
        }

        isValidTimestamp(value: number) {
            if (isNaN(value)) {
                return false;
            }
            const date = new Date(value);
            return !isNaN(date.getTime());
        }

        isValidTimeFormat(timeString: string) {
        const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
        return timeRegex.test(timeString);
        }

        /** Warn (once per data source) about a date that cannot be parsed; such rows are not drawn. */
        warnUnparseable(value: unknown) {
            if (this.hasWarnedUnparseable) return;
            this.hasWarnedUnparseable = true;
            console.warn(
                `[csv-time] Could not parse the date "${value}" in ${this.dataConfig.url}. ` +
                    'Rows with unparseable dates are not drawn. ' +
                    'Use `dayFirstDate` or `yearFirstDate` if the date order is ambiguous. ' +
                    'Further warnings for this data source are suppressed.'
            );
        }

        createDateFromFields(fields: { year: number; month: number; day: number, hour: number, minute: number, second: number }) {
            const { year = 1970, month = 1, day = 1, hour = 0, minute = 0, second = 0 } = fields;
            const dateStr = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
            return dateStr;
        }

        processRow(row: any, convertToDate?: string[]) {
            try {
                const defaultTimeFormat = { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
        
                if (convertToDate) {
                    switch (convertToDate.length) {
                        case 1:
                            row[convertToDate[0]] = this.parseAndConvertToSeconds(row[convertToDate[0]]);
                            break;
                        case 2:
                            if (this.isValidTimeFormat(row[convertToDate[1]])) {
                                const fullDate = `${row[convertToDate[0]]} ${row[convertToDate[1]]}`;
                                row[convertToDate[0]] = this.parseAndConvertToSeconds(fullDate);
                            // Check if we're dealing with a calendar week format in the second convertToDate field
                            } else if (this.dataConfig.includesCalendarWeek && this.containsCalendarWeek(row[convertToDate[1]])) {
                                const calendarWeekMonday = this.weekToDate(row[convertToDate[0]], row[convertToDate[1]]);
                                row[convertToDate[0]] = (calendarWeekMonday) ? this.parseAndConvertToSeconds(calendarWeekMonday) : NaN;
                            } else {
                                convertToDate.forEach((field, i) => {
                                    row[field] = this.parseAndConvertToSeconds(row[field]);
                                });
                            }
                            break;
                        default:
                            let timeFormat = { ...defaultTimeFormat };
                            for (const field of convertToDate) {
                                if (row[field]) {
                                    timeFormat[field as keyof typeof timeFormat] = row[field];
                                }
                            }
                            row[convertToDate[0]] = utcSeconds(
                                +timeFormat.year,
                                +timeFormat.month,
                                +timeFormat.day,
                                +timeFormat.hour,
                                +timeFormat.minute,
                                +timeFormat.second
                            );
                            if (isNaN(row[convertToDate[0]])) this.warnUnparseable(JSON.stringify(timeFormat));
                            break;
                    }
                }
                return row;
            } catch {
                // skip rows with errors
                return undefined;
            }
        }
        
        /** Parse a date or date-time string into Unix seconds (UTC unless the string has a zone). */
        parseAndConvertToSeconds(date: string): number {
            const seconds = parseDateTime(date, this.dataConfig);
            if (isNaN(seconds)) this.warnUnparseable(date);
            return seconds;
        }

        containsCalendarWeek(date: string): boolean {
            const regex = /\b([1-9]|[1-4][0-9]|5[0-2])\b/g;
            return regex.test(date);
        }

        parseCalendarWeek(date: string): boolean {
            const regex = /\b([1-9]|[1-4][0-9]|5[0-2])\b/g;
            return regex.test(date);
        }
        
        weekToDate(year: string, week: string) {
            const regex = /\b([1-9]|[1-4][0-9]|5[0-2])\b/g;
            const match = week.match(regex);
            const weekNumber = match ? Number(match[0]) : undefined;
            if (weekNumber === undefined) {
                return undefined;
            }
            const date = new Date(Date.UTC(2000, 0, 1 + (weekNumber - 1) * 7));
            date.setUTCFullYear(Number(year));
            if (date.getUTCDay() <= 4)
                date.setUTCDate(date.getUTCDate() - date.getUTCDay() + 1);
            else
                date.setUTCDate(date.getUTCDate() + 8 - date.getUTCDay());

            return formatIsoDate(date.getTime() / 1000);
        }

        tilesetInfo(callback?: any) {
            const TILE_SIZE = 1024;
            const totalLength = TIME_MAX_POS - TIME_MIN_POS;
            const retVal = {
                tile_size: TILE_SIZE,
                max_zoom: Math.ceil(Math.log(totalLength / TILE_SIZE) / Math.log(2)),
                max_width: totalLength,
                min_pos: [TIME_MIN_POS, TIME_MIN_POS],
                max_pos: [TIME_MAX_POS, TIME_MAX_POS]
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

    return new CSVTimeDataFetcherClass(args);
}

CSVTimeDataFetcher.config = {
    type: 'csv-time'
};

export default CSVTimeDataFetcher;
