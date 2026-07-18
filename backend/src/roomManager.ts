import { truthOrDarePrompts, wouldYouRatherPrompts } from './gamePrompts.js';

export type Player = { id: string; name: string };

const TARGET_SCORES: Record<string, number> = {
  rps: 5,
  'odd-or-even': 5,
  'would-you-rather': 5,
  'two-truths-one-lie': 5,
  'truth-or-dare': 5
};

const TWENTY_Q_MAX_ATTEMPTS = 10;
const TWENTY_Q_MAX_TURNS = 2;

type TruthOrDareState = {
  promptIndex: number;
  activePlayerId: string;
  type: 'action' | 'truth' | null;
  answer: string | null;
};

type WouldYouRatherState = {
  promptIndex: number;
};

type TwoTruthsOneLieState = {
  statements: string[];
  lieIndex: number;
  submitter: string;
};

type TwoTruthsOneLieRoles = {
  submitterId: string;
  voterId: string;
};

type TwentyQuestionsState = {
  turnIndex: number;
  setterId: string;
  guesserId: string;
  word: string | null;
  attemptsRemaining: number;
};

type RoomState = {
  gameId: string;
  players: Player[];
  choices: Map<string, string>;
  gameData: Record<string, any>;
  scores: Record<string, number>;
  usedTruthOrDare: Set<number>;
  usedWouldYouRather: Set<number>;
  wouldYouRatherMismatches: number;
  tokens: Map<string, string>;
  started: boolean;
  // Timestamp since every single player in this room has had zero live connection, or null while
  // at least one of them is still connected. Used only to garbage-collect rooms nobody will ever
  // come back to — never to remove an individual player while anyone else is still around.
  abandonedSince: number | null;
};

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private socketRoom = new Map<string, string>();

  createRoom(socketId: string, name: string, gameId: string, token: string) {
    // A socket can only ever be "in" one room at a time — creating a new one always leaves
    // whichever room this connection was previously occupying.
    const previousRoom = this.leaveRoom(socketId);

    const roomId = generateRoomId();
    const player: Player = { id: socketId, name };
    this.rooms.set(roomId, {
      gameId,
      players: [player],
      choices: new Map(),
      gameData: {},
      scores: { [socketId]: 0 },
      usedTruthOrDare: new Set(),
      usedWouldYouRather: new Set(),
      wouldYouRatherMismatches: 0,
      tokens: new Map([[socketId, token]]),
      started: false,
      abandonedSince: null
    });
    this.socketRoom.set(socketId, roomId);
    return { roomId, players: [player], previousRoom };
  }

  getRoomId(socketId: string) {
    return this.socketRoom.get(socketId) ?? null;
  }

  getGameId(roomId: string) {
    return this.rooms.get(roomId)?.gameId ?? null;
  }

  getPlayers(roomId: string) {
    return this.rooms.get(roomId)?.players ?? [];
  }

  joinRoom(roomId: string, socketId: string, name: string, gameId: string, token: string) {
    if (!this.rooms.has(roomId)) {
      throw new Error('Salle introuvable.');
    }

    const room = this.rooms.get(roomId)!;
    if (room.gameId !== gameId) {
      throw new Error('Ce salon ne correspond pas à ce jeu.');
    }

    if (room.players.some(player => player.id === socketId)) {
      return {
        players: room.players,
        previousSocketId: null as string | null,
        started: room.started,
        scores: { ...room.scores },
        previousRoom: null as { roomId: string; players: Player[] } | null
      };
    }

    // A socket can only ever be "in" one room at a time — joining a different room always
    // leaves whichever room this connection was previously occupying.
    const currentRoomId = this.socketRoom.get(socketId);
    const previousRoom = currentRoomId && currentRoomId !== roomId ? this.leaveRoom(socketId) : null;

    const previousEntry = Array.from(room.tokens.entries()).find(([, tok]) => tok === token);

    if (previousEntry) {
      const [oldSocketId] = previousEntry;
      this.remapPlayerId(room, oldSocketId, socketId);
      room.tokens.delete(oldSocketId);
      room.tokens.set(socketId, token);
      const player = room.players.find(p => p.id === socketId);
      if (player) {
        player.name = name;
      }
      this.socketRoom.set(socketId, roomId);
      room.abandonedSince = null;
      return { players: room.players, previousSocketId: oldSocketId, started: room.started, scores: { ...room.scores }, previousRoom };
    }

    room.players.push({ id: socketId, name });
    room.scores[socketId] = 0;
    room.tokens.set(socketId, token);
    this.socketRoom.set(socketId, roomId);
    room.abandonedSince = null;
    return { players: room.players, previousSocketId: null, started: room.started, scores: { ...room.scores }, previousRoom };
  }

  leaveRoom(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.socketRoom.delete(socketId);
      return null;
    }

    room.players = room.players.filter(player => player.id !== socketId);
    room.choices.delete(socketId);
    delete room.gameData[socketId];
    delete room.scores[socketId];
    room.tokens.delete(socketId);
    this.socketRoom.delete(socketId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    // The player who just left might have been the only one still actually connected, leaving
    // only disconnected ghosts behind — recheck so this room becomes eligible for reaping too.
    const stillHasLivePlayer = room.players.some(player => this.socketRoom.get(player.id) === roomId);
    if (!stillHasLivePlayer && room.abandonedSince === null) {
      room.abandonedSince = Date.now();
    }

    return { roomId, players: room.players };
  }

  markStarted(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.started = true;
    }
  }

  markDisconnected(socketId: string) {
    // The underlying transport closing (tab closed, backgrounded, network drop — any duration)
    // is not something the server can prevent, but it has zero effect on room/game state: no
    // flag flips, nothing is broadcast, the player list looks exactly as it did before. The
    // only two ways a player is ever removed from a room are an explicit "Quitter la partie"
    // (leaveRoom) and creating/joining a different room on the same connection. This is
    // deliberate: on mobile, sharing the room code means leaving the browser entirely, for an
    // unpredictable amount of time, and that must never be visible as a "disconnected" state.
    const roomId = this.socketRoom.get(socketId);
    this.socketRoom.delete(socketId);

    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    // Purely for later garbage collection (reapAbandonedRooms) — never removes a player, never
    // broadcasts anything. Only starts the clock once *every* player in the room has no live
    // connection left; reconnecting anyone (see joinRoom) resets it back to null immediately.
    const stillHasLivePlayer = room.players.some(player => this.socketRoom.get(player.id) === roomId);
    if (!stillHasLivePlayer && room.abandonedSince === null) {
      room.abandonedSince = Date.now();
    }
  }

  /**
   * Deletes rooms where every player has had zero live connection for longer than `thresholdMs`.
   * Never touches a room where at least one player is still connected, no matter how long their
   * companion has been gone. Returns the ids of the rooms that were reaped, for logging only.
   */
  reapAbandonedRooms(thresholdMs: number): string[] {
    const now = Date.now();
    const reaped: string[] = [];

    for (const [roomId, room] of this.rooms.entries()) {
      if (room.abandonedSince !== null && now - room.abandonedSince > thresholdMs) {
        this.rooms.delete(roomId);
        reaped.push(roomId);
      }
    }

    return reaped;
  }

  private remapPlayerId(room: RoomState, oldId: string, newId: string) {
    room.players = room.players.map(player => (player.id === oldId ? { ...player, id: newId } : player));

    if (room.scores[oldId] !== undefined) {
      room.scores[newId] = room.scores[oldId];
      delete room.scores[oldId];
    }

    if (room.choices.has(oldId)) {
      room.choices.set(newId, room.choices.get(oldId)!);
      room.choices.delete(oldId);
    }

    const replaceInObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') {
        return;
      }
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value === oldId) {
          obj[key] = newId;
        } else if (value && typeof value === 'object') {
          replaceInObject(value);
        }
      }
    };
    replaceInObject(room.gameData);
  }

  setGameData(socketId: string, key: string, data: any) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    room.gameData[key] = data;
  }

  getGameData(socketId: string, key: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return room.gameData[key] ?? null;
  }

  clearGameData(socketId: string, key?: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    if (key) {
      delete room.gameData[key];
      return;
    }

    room.gameData = {};
  }

  setOddOrEvenChoice(socketId: string, value: number, prediction: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (!room.players.some(player => player.id === socketId)) {
      throw new Error('Vous n’êtes pas membre de la salle.');
    }

    room.choices.set(socketId, JSON.stringify({ value, prediction }));

    if (room.choices.size < 2) {
      return null;
    }

    const [firstSocket, firstChoiceRaw] = Array.from(room.choices.entries())[0];
    const [secondSocket, secondChoiceRaw] = Array.from(room.choices.entries())[1];

    const firstChoice = JSON.parse(firstChoiceRaw) as { value: number; prediction: string };
    const secondChoice = JSON.parse(secondChoiceRaw) as { value: number; prediction: string };

    room.choices.clear();

    const sum = firstChoice.value + secondChoice.value;
    const parity = sum % 2 === 0 ? 'pair' : 'impair';
    const firstCorrect = firstChoice.prediction === parity;
    const secondCorrect = secondChoice.prediction === parity;
    const bothCorrect = firstCorrect && secondCorrect;
    const bothWrong = !firstCorrect && !secondCorrect;

    if (bothCorrect) {
      room.scores[firstSocket] = (room.scores[firstSocket] ?? 0) + 1;
      room.scores[secondSocket] = (room.scores[secondSocket] ?? 0) + 1;
    } else if (!bothWrong) {
      if (firstCorrect) {
        room.scores[firstSocket] = (room.scores[firstSocket] ?? 0) + 1;
      } else {
        room.scores[secondSocket] = (room.scores[secondSocket] ?? 0) + 1;
      }
    }

    const targetScore = TARGET_SCORES[room.gameId] ?? Infinity;
    const winnerId = room.players.find(player => (room.scores[player.id] ?? 0) >= targetScore)?.id ?? null;

    const outcomeFor = (correct: boolean): 'player' | 'machine' | 'draw' => (bothWrong ? 'draw' : correct ? 'player' : 'machine');

    return {
      roomId,
      entries: [
        {
          socketId: firstSocket,
          yourValue: firstChoice.value,
          yourPrediction: firstChoice.prediction,
          opponentValue: secondChoice.value,
          opponentPrediction: secondChoice.prediction,
          sum,
          parity,
          outcome: outcomeFor(firstCorrect),
          bothCorrect
        },
        {
          socketId: secondSocket,
          yourValue: secondChoice.value,
          yourPrediction: secondChoice.prediction,
          opponentValue: firstChoice.value,
          opponentPrediction: firstChoice.prediction,
          sum,
          parity,
          outcome: outcomeFor(secondCorrect),
          bothCorrect
        }
      ],
      scores: { ...room.scores },
      matchOver: winnerId !== null,
      winnerId
    };
  }

  setRpsChoice(socketId: string, choice: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (!room.players.some(player => player.id === socketId)) {
      throw new Error('Vous n’êtes pas membre de la salle.');
    }

    room.choices.set(socketId, choice);

    if (room.choices.size < 2) {
      return null;
    }

    const [firstSocket, firstChoice] = Array.from(room.choices.entries())[0];
    const [secondSocket, secondChoice] = Array.from(room.choices.entries())[1];

    if (!firstChoice || !secondChoice) {
      room.choices.clear();
      return null;
    }

    room.choices.clear();

    const winner = this.getRpsWinner(firstChoice, secondChoice);
    if (winner === 'first') {
      room.scores[firstSocket] = (room.scores[firstSocket] ?? 0) + 1;
    } else if (winner === 'second') {
      room.scores[secondSocket] = (room.scores[secondSocket] ?? 0) + 1;
    }

    const targetScore = TARGET_SCORES[room.gameId] ?? Infinity;
    const winnerId =
      (room.scores[firstSocket] ?? 0) >= targetScore
        ? firstSocket
        : (room.scores[secondSocket] ?? 0) >= targetScore
          ? secondSocket
          : null;

    return {
      roomId,
      entries: [
        {
          socketId: firstSocket,
          yourMove: firstChoice,
          opponentMove: secondChoice,
          outcome: (winner === 'first' ? 'player' : winner === 'second' ? 'machine' : 'draw') as 'player' | 'machine' | 'draw'
        },
        {
          socketId: secondSocket,
          yourMove: secondChoice,
          opponentMove: firstChoice,
          outcome: (winner === 'second' ? 'player' : winner === 'first' ? 'machine' : 'draw') as 'player' | 'machine' | 'draw'
        }
      ],
      scores: { ...room.scores },
      matchOver: winnerId !== null,
      winnerId
    };
  }

  resetScores(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    for (const player of room.players) {
      room.scores[player.id] = 0;
    }
    room.wouldYouRatherMismatches = 0;

    return { roomId, scores: { ...room.scores } };
  }

  startWouldYouRatherRound(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const index = this.pickIndexExcluding(wouldYouRatherPrompts.length, room.usedWouldYouRather);
    room.usedWouldYouRather.add(index);
    if (room.usedWouldYouRather.size >= wouldYouRatherPrompts.length) {
      room.usedWouldYouRather.clear();
    }

    const state: WouldYouRatherState = { promptIndex: index };
    room.gameData.wouldYouRather = state;

    return { roomId, prompt: wouldYouRatherPrompts[index] };
  }

  setWouldYouRatherChoice(socketId: string, selected: 'left' | 'right') {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (!room.players.some(player => player.id === socketId)) {
      throw new Error('Vous n’êtes pas membre de la salle.');
    }

    if (!room.gameData.wouldYouRather) {
      throw new Error('Aucun dilemme en cours.');
    }

    room.choices.set(socketId, selected);

    if (room.choices.size < 2) {
      return null;
    }

    const [firstSocket, firstChoice] = Array.from(room.choices.entries())[0];
    const [secondSocket, secondChoice] = Array.from(room.choices.entries())[1];

    room.choices.clear();
    delete room.gameData.wouldYouRather;

    const sameChoice = firstChoice === secondChoice;
    if (sameChoice) {
      room.scores[firstSocket] = (room.scores[firstSocket] ?? 0) + 1;
      room.scores[secondSocket] = (room.scores[secondSocket] ?? 0) + 1;
    } else {
      room.wouldYouRatherMismatches += 1;
    }

    // Cooperative game: both players always share the same match score (they gain a point
    // together, or a shared mismatch together), so the team wins or loses together — there is
    // no individual "winner" to single out here.
    const targetScore = TARGET_SCORES[room.gameId] ?? Infinity;
    const teamWon = (room.scores[firstSocket] ?? 0) >= targetScore;
    const teamLost = room.wouldYouRatherMismatches >= targetScore;
    const teamResult: 'win' | 'lose' | null = teamWon ? 'win' : teamLost ? 'lose' : null;

    return {
      roomId,
      entries: [
        { socketId: firstSocket, yourChoice: firstChoice, opponentChoice: secondChoice },
        { socketId: secondSocket, yourChoice: secondChoice, opponentChoice: firstChoice }
      ],
      sameChoice,
      scores: { ...room.scores },
      matchOver: teamResult !== null,
      teamResult
    };
  }

  beginTwoTruthsOneLieMatch(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (room.players.length < 2) {
      throw new Error('Il faut au moins 2 joueurs pour jouer.');
    }

    const [first, second] = room.players;
    const roles: TwoTruthsOneLieRoles = { submitterId: first.id, voterId: second.id };
    room.gameData.twoTruthsOneLieRoles = roles;

    return { roomId, submitterId: roles.submitterId, voterId: roles.voterId };
  }

  getTwoTruthsOneLieState(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const roles = room.gameData.twoTruthsOneLieRoles as TwoTruthsOneLieRoles | undefined;
    if (!roles) {
      return null;
    }

    return { submitterId: roles.submitterId, voterId: roles.voterId };
  }

  submitTwoTruthsOneLie(socketId: string, statements: string[], lieIndex: number) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const roles = room.gameData.twoTruthsOneLieRoles as TwoTruthsOneLieRoles | undefined;
    if (roles && roles.submitterId !== socketId) {
      throw new Error('Ce n’est pas à vous de soumettre pour cette manche.');
    }

    if (room.gameData.twoTruthsOneLie) {
      throw new Error('Une manche est déjà en cours. Attendez le vote avant de soumettre à nouveau.');
    }

    if (!Array.isArray(statements) || statements.length !== 3 || !Number.isInteger(lieIndex) || lieIndex < 0 || lieIndex > 2) {
      throw new Error('Il faut exactement 3 affirmations et indiquer laquelle est le mensonge.');
    }

    const state: TwoTruthsOneLieState = { statements, lieIndex, submitter: socketId };
    room.gameData.twoTruthsOneLie = state;

    return { roomId, statements, submitterId: socketId };
  }

  voteTwoTruthsOneLie(socketId: string, voteIndex: number) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.twoTruthsOneLie as TwoTruthsOneLieState | undefined;
    if (!state) {
      throw new Error('Aucun jeu 2 Vérités 1 Mensonge en cours.');
    }

    const roles = room.gameData.twoTruthsOneLieRoles as TwoTruthsOneLieRoles | undefined;
    if (roles && roles.voterId !== socketId) {
      throw new Error('Ce n’est pas à vous de voter pour cette manche.');
    }

    delete room.gameData.twoTruthsOneLie;

    const correct = voteIndex === state.lieIndex;
    const submitterId = state.submitter;

    if (correct) {
      room.scores[socketId] = (room.scores[socketId] ?? 0) + 1;
    } else {
      room.scores[submitterId] = (room.scores[submitterId] ?? 0) + 1;
    }

    const targetScore = TARGET_SCORES[room.gameId] ?? Infinity;
    const winnerId = room.players.find(player => (room.scores[player.id] ?? 0) >= targetScore)?.id ?? null;
    const matchOver = winnerId !== null;

    let nextSubmitterId: string | null = null;
    let nextVoterId: string | null = null;

    if (!matchOver && roles) {
      nextSubmitterId = roles.voterId;
      nextVoterId = roles.submitterId;
      room.gameData.twoTruthsOneLieRoles = { submitterId: nextSubmitterId, voterId: nextVoterId };
    }

    return {
      roomId,
      voterSocketId: socketId,
      correct,
      lieIndex: state.lieIndex,
      scores: { ...room.scores },
      matchOver,
      winnerId,
      nextSubmitterId,
      nextVoterId
    };
  }

  startTruthOrDare(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (room.players.length < 2) {
      throw new Error('Il faut au moins 2 joueurs pour jouer.');
    }

    const promptIndex = this.pickIndexExcluding(truthOrDarePrompts.length, room.usedTruthOrDare);
    room.usedTruthOrDare.add(promptIndex);
    if (room.usedTruthOrDare.size >= truthOrDarePrompts.length) {
      room.usedTruthOrDare.clear();
    }

    const activeIndex = Math.floor(Math.random() * room.players.length);
    const activePlayer = room.players[activeIndex];

    const state: TruthOrDareState = { promptIndex, activePlayerId: activePlayer.id, type: null, answer: null };
    room.gameData.truthOrDare = state;

    return { roomId, activePlayerId: activePlayer.id, activePlayerName: activePlayer.name };
  }

  chooseTruthOrDareType(socketId: string, type: 'action' | 'truth') {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.truthOrDare as TruthOrDareState | undefined;
    if (!state) {
      throw new Error('Aucune manche Action ou Vérité en cours.');
    }

    if (state.activePlayerId !== socketId) {
      throw new Error('Vous n’êtes pas le joueur actif de cette manche.');
    }

    state.type = type;
    const prompt = truthOrDarePrompts[state.promptIndex];
    const text = type === 'action' ? prompt.dare : prompt.truth;

    return { roomId, type, text };
  }

  submitTruthOrDareAnswer(socketId: string, answer: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.truthOrDare as TruthOrDareState | undefined;
    if (!state) {
      throw new Error('Aucune manche Action ou Vérité en cours.');
    }

    if (state.activePlayerId !== socketId) {
      throw new Error('Vous n’êtes pas le joueur actif de cette manche.');
    }

    if (state.type !== 'truth') {
      throw new Error('Aucune réponse écrite attendue pour une action.');
    }

    state.answer = answer;
    return { roomId, answer };
  }

  validateTruthOrDare(socketId: string, approved: boolean) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.truthOrDare as TruthOrDareState | undefined;
    if (!state) {
      throw new Error('Aucune manche Action ou Vérité en cours.');
    }

    if (!room.players.some(player => player.id === socketId)) {
      throw new Error('Vous n’êtes pas membre de la salle.');
    }

    if (state.activePlayerId === socketId) {
      throw new Error('Vous ne pouvez pas valider votre propre manche.');
    }

    delete room.gameData.truthOrDare;

    if (approved) {
      room.scores[state.activePlayerId] = (room.scores[state.activePlayerId] ?? 0) + 1;
    }

    const targetScore = TARGET_SCORES[room.gameId] ?? Infinity;
    const winnerId = room.players.find(player => (room.scores[player.id] ?? 0) >= targetScore)?.id ?? null;

    return {
      roomId,
      approved,
      activePlayerId: state.activePlayerId,
      scores: { ...room.scores },
      matchOver: winnerId !== null,
      winnerId
    };
  }

  beginTwentyQuestionsMatch(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (room.players.length < 2) {
      throw new Error('Il faut au moins 2 joueurs pour jouer.');
    }

    const [setter, guesser] = room.players;
    const state: TwentyQuestionsState = {
      turnIndex: 1,
      setterId: setter.id,
      guesserId: guesser.id,
      word: null,
      attemptsRemaining: TWENTY_Q_MAX_ATTEMPTS
    };
    room.gameData.twentyQuestions = state;

    return {
      roomId,
      setterId: state.setterId,
      guesserId: state.guesserId,
      attemptsRemaining: state.attemptsRemaining,
      turnIndex: state.turnIndex,
      wordSet: state.word !== null
    };
  }

  setTwentyQuestionsWord(socketId: string, word: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.twentyQuestions as TwentyQuestionsState | undefined;
    if (!state) {
      throw new Error('Aucune manche 20 Questions en cours.');
    }

    if (state.setterId !== socketId) {
      throw new Error('Vous n’êtes pas le meneur de cette manche.');
    }

    state.word = word.trim().toLowerCase();
    return { roomId };
  }

  submitTwentyQuestionsGuess(socketId: string, guess: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.twentyQuestions as TwentyQuestionsState | undefined;
    if (!state) {
      throw new Error('Aucune manche 20 Questions en cours.');
    }

    if (state.guesserId !== socketId) {
      throw new Error('Vous n’êtes pas le devineur de cette manche.');
    }

    if (!state.word) {
      throw new Error('Le mot n’est pas encore défini.');
    }

    return { roomId, guess: guess.trim(), attemptsRemaining: state.attemptsRemaining };
  }

  judgeTwentyQuestionsGuess(socketId: string, correct: boolean, hint?: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.twentyQuestions as TwentyQuestionsState | undefined;
    if (!state) {
      throw new Error('Aucune manche 20 Questions en cours.');
    }

    if (state.setterId !== socketId) {
      throw new Error('Vous n’êtes pas le meneur de cette manche.');
    }

    if (!correct && (!hint || !hint.trim())) {
      throw new Error('Un indice est requis pour aider le devineur.');
    }

    if (!correct) {
      state.attemptsRemaining -= 1;
    }

    const roundOver = correct || state.attemptsRemaining <= 0;

    if (!roundOver) {
      return {
        roomId,
        correct: false,
        hint,
        attemptsRemaining: state.attemptsRemaining,
        roundOver: false,
        turnIndex: state.turnIndex,
        nextSetterId: null as string | null,
        nextGuesserId: null as string | null,
        scores: { ...room.scores },
        matchOver: false,
        isDraw: false,
        winnerId: null as string | null
      };
    }

    const roundScore = correct ? state.attemptsRemaining : 0;
    room.scores[state.guesserId] = (room.scores[state.guesserId] ?? 0) + roundScore;

    const turnIndex = state.turnIndex;
    const matchDone = turnIndex >= TWENTY_Q_MAX_TURNS;

    let nextSetterId: string | null = null;
    let nextGuesserId: string | null = null;

    if (!matchDone) {
      nextSetterId = state.guesserId;
      nextGuesserId = state.setterId;
      room.gameData.twentyQuestions = {
        turnIndex: turnIndex + 1,
        setterId: nextSetterId,
        guesserId: nextGuesserId,
        word: null,
        attemptsRemaining: TWENTY_Q_MAX_ATTEMPTS
      } as TwentyQuestionsState;
    } else {
      delete room.gameData.twentyQuestions;
    }

    let winnerId: string | null = null;
    let isDraw = false;

    if (matchDone) {
      const [p0, p1] = room.players;
      const s0 = room.scores[p0.id] ?? 0;
      const s1 = room.scores[p1.id] ?? 0;
      if (s0 === s1) {
        isDraw = true;
      } else {
        winnerId = s0 > s1 ? p0.id : p1.id;
      }
    }

    return {
      roomId,
      correct,
      hint,
      attemptsRemaining: state.attemptsRemaining,
      roundOver: true,
      turnIndex,
      nextSetterId,
      nextGuesserId,
      scores: { ...room.scores },
      matchOver: matchDone,
      isDraw,
      winnerId
    };
  }

  getTwentyQuestionsState(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const state = room.gameData.twentyQuestions as TwentyQuestionsState | undefined;
    if (!state) {
      return null;
    }

    return {
      setterId: state.setterId,
      guesserId: state.guesserId,
      attemptsRemaining: state.attemptsRemaining,
      turnIndex: state.turnIndex,
      wordSet: state.word !== null
    };
  }

  getRpsState(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return { waiting: room.choices.has(socketId) };
  }

  getOddOrEvenState(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return { waiting: room.choices.has(socketId) };
  }

  getWouldYouRatherState(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const state = room.gameData.wouldYouRather as WouldYouRatherState | undefined;
    if (!state) {
      return { prompt: null as { left: string; right: string } | null, waiting: false };
    }

    return { prompt: wouldYouRatherPrompts[state.promptIndex], waiting: room.choices.has(socketId) };
  }

  getTruthOrDareState(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const state = room.gameData.truthOrDare as TruthOrDareState | undefined;
    if (!state) {
      return null;
    }

    const prompt = truthOrDarePrompts[state.promptIndex];
    const text = state.type ? (state.type === 'action' ? prompt.dare : prompt.truth) : null;
    const activePlayerName = room.players.find(player => player.id === state.activePlayerId)?.name ?? '';

    return {
      activePlayerId: state.activePlayerId,
      activePlayerName,
      type: state.type,
      text,
      answer: state.answer
    };
  }

  private pickIndexExcluding(length: number, excluded: Set<number>): number {
    const all = Array.from({ length }, (_, i) => i);
    const available = all.filter(i => !excluded.has(i));
    const pool = available.length > 0 ? available : all;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private getRpsWinner(firstChoice: string, secondChoice: string): 'first' | 'second' | 'draw' {
    if (firstChoice === secondChoice) {
      return 'draw';
    }

    const beats: Record<string, string> = {
      pierre: 'ciseau',
      feuille: 'pierre',
      ciseau: 'feuille'
    };

    return beats[firstChoice] === secondChoice ? 'first' : 'second';
  }
}
