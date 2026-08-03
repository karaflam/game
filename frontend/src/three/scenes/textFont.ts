import { preloadFont } from 'troika-three-text';
// @fontsource/rajdhani is already a project dependency (used for the app's own UI font).
// Reusing its bundled .woff means the 3D digit/text glyphs load from this app's own
// bundle, not a third-party CDN — no network dependency, no Suspense hang risk.
import rajdhaniLatin500Url from '@fontsource/rajdhani/files/rajdhani-latin-500-normal.woff?url';

export const DRUM_FONT_URL = rajdhaniLatin500Url;

// troika's preloadFont always invokes its second argument once loading finishes
// (it forwards straight to getTextRenderInfo(args, callback)) — omitting it
// throws "callback is not a function" the moment the font resolves.
preloadFont({ font: DRUM_FONT_URL, characters: '0123456789?' }, () => {});
