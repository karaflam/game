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
};

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private socketRoom = new Map<string, string>();

  createRoom(socketId: string, name: string, gameId: string) {
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
      wouldYouRatherMismatches: 0
    });
    this.socketRoom.set(socketId, roomId);
    return { roomId, players: [player] };
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

  joinRoom(roomId: string, socketId: string, name: string, gameId: string) {
    if (!this.rooms.has(roomId)) {
      throw new Error('Salle introuvable.');
    }

    const room = this.rooms.get(roomId)!;
    if (room.gameId !== gameId) {
      throw new Error('Ce salon ne correspond pas à ce jeu.');
    }

    if (room.players.some(player => player.id === socketId)) {
      return room.players;
    }

    room.players.push({ id: socketId, name });
    room.scores[socketId] = 0;
    this.socketRoom.set(socketId, roomId);
    return room.players;
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
    this.socketRoom.delete(socketId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    return { roomId, players: room.players };
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

    return {
      roomId,
      voterSocketId: socketId,
      correct,
      lieIndex: state.lieIndex,
      scores: { ...room.scores },
      matchOver: winnerId !== null,
      winnerId
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
