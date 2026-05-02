/**
 * Public API for the @boost/video package.
 * Consumed by the API for rendering and by the dashboard for template metadata.
 */

export type { VideoProps, BrandPalette } from './types';
export { DEFAULT_BRAND, VIDEO_CONFIG, FONTS } from './types';

export type { TemplateDef, TemplateMeta } from './templates';
export { TEMPLATES, getTemplate, listTemplates } from './templates';

export { renderVideo } from './render';
export type { RenderArgs, RenderResult } from './render';
