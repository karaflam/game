// Semantic card colors for reveal cards tinted by outcome (e.g. Would You
// Rather's match/mismatch) rather than the neutral theme cardColor. Lives
// outside BurstBadge.tsx (a lazy-loaded three.js scene) so callers can import
// these two hex strings without pulling the whole 3D scene into their main
// bundle — see the lazy() convention every game file follows for scenes.
export const MATCH_CARD_COLOR = '#1E7A46';
export const MISMATCH_CARD_COLOR = '#B23B3B';
