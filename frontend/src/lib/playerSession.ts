const TOKEN_KEY = 'game:playerToken';
const PSEUDO_KEY = 'game:pseudo';
const ACTIVE_ROOM_KEY = 'game:activeRoom';

function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getPlayerToken(): string {
  try {
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing) {
      return existing;
    }
    const token = randomToken();
    localStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    return randomToken();
  }
}

export function getStoredPseudo(): string {
  try {
    return localStorage.getItem(PSEUDO_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setStoredPseudo(pseudo: string) {
  try {
    localStorage.setItem(PSEUDO_KEY, pseudo);
  } catch {
    // ignore
  }
}

export type ActiveRoomSession = { gameId: string; roomCode: string };

export function saveActiveRoom(session: ActiveRoomSession) {
  try {
    localStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function getActiveRoom(): ActiveRoomSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ROOM_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed?.gameId === 'string' && typeof parsed?.roomCode === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearActiveRoom() {
  try {
    localStorage.removeItem(ACTIVE_ROOM_KEY);
  } catch {
    // ignore
  }
}
