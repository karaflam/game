import type { TFunction } from 'i18next';

// The backend only ever sends short, stable error codes over ServerEvents.RoomError (see
// backend/src/roomManager.ts and backend/src/index.ts) — never localized prose — precisely so the
// client can translate them. Every code the backend can throw must have a matching
// `roomErrors.<code>` key in both locale files; translateRoomError falls back to the raw code
// (rather than throwing) so an unmapped code still surfaces something visible instead of crashing.
export function translateRoomError(t: TFunction, code: string): string {
  const key = `roomErrors.${code}`;
  const translated = t(key);
  return translated === key ? code : translated;
}
