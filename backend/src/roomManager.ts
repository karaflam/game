export type Player = { id: string; name: string };

const TARGET_SCORES: Record<string, number> = {
  rps: 5
};

type RoomState = {
  gameId: string;
  players: Player[];
  choices: Map<string, string>;
  gameData: Record<string, any>;
  scores: Record<string, number>;
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
      scores: { [socketId]: 0 }
    });
    this.socketRoom.set(socketId, roomId);
    return { roomId, players: [player] };
  }

  getRoomId(socketId: string) {
    return this.socketRoom.get(socketId) ?? null;
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

    const firstSum = firstChoice.value + secondChoice.value;
    const firstParity = firstSum % 2 === 0 ? 'pair' : 'impair';
    const firstWon = firstChoice.prediction === firstParity;
    const secondWon = secondChoice.prediction === firstParity;

    if (firstWon === secondWon) {
      return {
        roomId,
        result: [
          { socketId: firstSocket, message: `Égalité (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`, score: 0 },
          { socketId: secondSocket, message: `Égalité (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`, score: 0 }
        ]
      };
    }

    return {
      roomId,
      result: [
        {
          socketId: firstSocket,
          message: firstWon
            ? `Vous gagnez ! (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`
            : `Vous perdez... (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`,
          score: firstWon ? 1 : -1
        },
        {
          socketId: secondSocket,
          message: secondWon
            ? `Vous gagnez ! (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`
            : `Vous perdez... (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`,
          score: secondWon ? 1 : -1
        }
      ]
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

    return { roomId, scores: { ...room.scores } };
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
