import type { GameId } from '../types/game';

// Downloaded locally (frontend/public/images/games/) from free-to-use Unsplash photos
// (Unsplash License — free for commercial use, no attribution required), one per game, reused
// for the game card, the solo mode card, and the multiplayer mode card of that same game. Served
// straight from /public so no bundler processing is needed, and the app never depends on an
// external host staying up.
export function getGameImageUrl(gameId: GameId): string {
  return `/images/games/${gameId}.jpg`;
}

// Hero background — a lively game-night moment, not tied to any single game.
export const HOME_HERO_IMAGE_URL = '/images/games/hero.jpg';
