import type { GameId } from '../types/game';

// Curated free-to-use Unsplash photos (Unsplash License — free for commercial use, no
// attribution required), one per game, reused for the game card, the solo mode card, and the
// multiplayer mode card of that same game. Query params are Unsplash's own resizing API.
const IMAGE_IDS: Record<GameId, string> = {
  rps: '1757364784689-55a620b7ecbd',
  'truth-or-dare': '1746635732312-0083b7f9423f',
  'odd-or-even': '1650024520252-14bdf7a3f312',
  'would-you-rather': '1429743305873-d4065c15f93e',
  '20-questions': '1484069560501-87d72b0c3669',
  'two-truths-one-lie': '1774132120141-8adbc0d67726'
};

export function getGameImageUrl(gameId: GameId, width: 800 | 1200 | 1600 = 1200): string {
  return `https://images.unsplash.com/photo-${IMAGE_IDS[gameId]}?w=${width}&q=80&auto=format&fit=crop`;
}

// Hero background — a lively game-night moment, not tied to any single game.
export const HOME_HERO_IMAGE_URL =
  'https://images.unsplash.com/photo-1466686606061-5b5fd8310160?w=2000&q=80&auto=format&fit=crop';
