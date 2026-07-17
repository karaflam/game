type RoomState = {
  players: string[];
  choices: Map<string, string>;
  gameData: Record<string, any>;
};

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private socketRoom = new Map<string, string>();

  createRoom(socketId: string) {
    const roomId = generateRoomId();
    this.rooms.set(roomId, { players: [socketId], choices: new Map(), gameData: {} });
    this.socketRoom.set(socketId, roomId);
    return { roomId, players: [socketId] };
  }

  getRoomId(socketId: string) {
    return this.socketRoom.get(socketId) ?? null;
  }

  getPlayers(roomId: string) {
    return this.rooms.get(roomId)?.players ?? [];
  }

  joinRoom(roomId: string, socketId: string) {
    if (!this.rooms.has(roomId)) {
      throw new Error('Salle introuvable.');
    }

    const room = this.rooms.get(roomId)!;
    if (room.players.includes(socketId)) {
      return room.players;
    }

    room.players.push(socketId);
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

    room.players = room.players.filter(id => id !== socketId);
    room.choices.delete(socketId);
    delete room.gameData[socketId];
    this.socketRoom.delete(socketId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    return { roomId, players: room.players };
  }

  setChoice(socketId: string, choice: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (!room.players.includes(socketId)) {
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

    const result = this.computeResult(firstSocket, firstChoice, secondSocket, secondChoice);
    return { roomId, result };
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

    if (!room.players.includes(socketId)) {
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

  private computeResult(
    firstSocket: string,
    firstChoice: string,
    secondSocket: string,
    secondChoice: string
  ) {
    if (firstChoice === secondChoice) {
      return [
        { socketId: firstSocket, message: `Égalité (${firstChoice} / ${secondChoice}).`, score: 0 },
        { socketId: secondSocket, message: `Égalité (${firstChoice} / ${secondChoice}).`, score: 0 }
      ];
    }

    const winMap: Record<string, string> = {
      pierre: 'ciseau',
      feuille: 'pierre',
      ciseau: 'feuille'
    };

    if (winMap[firstChoice] === secondChoice) {
      return [
        { socketId: firstSocket, message: `Vous gagnez ! (${firstChoice} bat ${secondChoice}).`, score: 1 },
        { socketId: secondSocket, message: `Vous perdez... (${secondChoice} perd contre ${firstChoice}).`, score: -1 }
      ];
    }

    return [
      { socketId: firstSocket, message: `Vous perdez... (${firstChoice} perd contre ${secondChoice}).`, score: -1 },
      { socketId: secondSocket, message: `Vous gagnez ! (${secondChoice} bat ${firstChoice}).`, score: 1 }
    ];
  }
}
