import { preloadFont } from 'troika-three-text';
// @fontsource/rajdhani is already a project dependency (used for the app's own UI font).
// Reusing its bundled .woff means the 3D digit/text glyphs load from this app's own
// bundle, not a third-party CDN — no network dependency, no Suspense hang risk.
import rajdhaniLatin500Url from '@fontsource/rajdhani/files/rajdhani-latin-500-normal.woff?url';
import rajdhaniLatin700Url from '@fontsource/rajdhani/files/rajdhani-latin-700-normal.woff?url';

export const DRUM_FONT_URL = rajdhaniLatin500Url;
// Bold weight for reveal-card messages (BadgeBurstScene, CardFlipScene) — those
// render arbitrary French sentences, not a fixed small character set, so unlike
// DRUM_FONT_URL's digit-only preload below there's no fixed alphabet to warm.
export const BOLD_FONT_URL = rajdhaniLatin700Url;

// troika's preloadFont always invokes its second argument once loading finishes
// (it forwards straight to getTextRenderInfo(args, callback)) — omitting it
// throws "callback is not a function" the moment the font resolves.
preloadFont({ font: DRUM_FONT_URL, characters: '0123456789?' }, () => {});
preloadFont({ font: BOLD_FONT_URL, characters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZàâäéèêëïîôöùûüçÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ0123456789 ?!.,\'’-' }, () => {});
