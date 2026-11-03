import type { GoslingSpec } from './gosling.schema.js';

export type { GoslingSpec };

/**
 * Render a time-i-gram spec.
 *
 * - `embed(element, spec, options?)` renders into `element` (or the element a CSS selector names)
 *   and resolves to the visualization's API.
 * - `embed(spec, options?)` creates a detached `<div>` with the visualization, for Observable
 *   notebooks; the API is its `value`.
 */
export declare function embed(...args: any[]): Promise<any>;
