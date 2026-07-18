import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ServerEvents, ClientEvents } from './events.js';
import { RoomManager } from './roomManager.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend Socket.IO en marche' });
});

io.on(ClientEvents.Connect, socket => {
  console.log(`Client connecté: ${socket.id}`);
  socket.emit(ServerEvents.Greeting, { type: ServerEvents.Greeting, payload: 'Bonjour depuis le backend Socket.IO !' });

  socket.on(ServerEvents.Hello, data => {
    console.log('Message du client:', data);
    socket.emit(ServerEvents.Greeting, {
      type: ServerEvents.Greeting,
      payload: `Salut client ${socket.id}, reçu : ${JSON.stringify(data)}`
    });
  });

  socket.on(ClientEvents.CreateRoom, ({ name, gameId }: { name: string; gameId: string }) => {
    try {
      const { roomId, players } = roomManager.createRoom(socket.id, name, gameId);
      socket.join(roomId);
      socket.emit(ServerEvents.RoomCreated, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.JoinRoom, ({ roomId, name, gameId }: { roomId: string; name: string; gameId: string }) => {
    try {
      const players = roomManager.joinRoom(roomId, socket.id, name, gameId);
      socket.join(roomId);
      io.to(roomId).emit(ServerEvents.RoomUpdate, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.LeaveRoom, () => {
    const room = roomManager.leaveRoom(socket.id);
    if (room) {
      socket.leave(room.roomId);
      io.to(room.roomId).emit(ServerEvents.RoomUpdate, { roomId: room.roomId, players: room.players });
    }
  });

  socket.on(ServerEvents.RpsPlay, ({ choice }) => {
    try {
      const result = roomManager.setRpsChoice(socket.id, choice);
      if (!result) {
        socket.emit(ServerEvents.Greeting, { type: ServerEvents.Greeting, payload: 'Choix reçu, en attente du second joueur.' });
        return;
      }

      for (const entry of result.entries) {
        io.to(entry.socketId).emit(ServerEvents.RpsResult, {
          yourMove: entry.yourMove,
          opponentMove: entry.opponentMove,
          outcome: entry.outcome,
          scores: result.scores,
          matchOver: result.matchOver,
          winnerId: result.winnerId
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.ResetMatchScore, () => {
    try {
      const { roomId, scores } = roomManager.resetScores(socket.id);
      io.to(roomId).emit(ServerEvents.ScoreReset, { scores });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.OddOrEvenPlay, ({ value, prediction }) => {
    try {
      const result = roomManager.setOddOrEvenChoice(socket.id, value, prediction);
      if (!result) {
        socket.emit(ServerEvents.Greeting, { type: ServerEvents.Greeting, payload: 'Choix reçu, en attente du second joueur.' });
        return;
      }

      for (const entry of result.entries) {
        io.to(entry.socketId).emit(ServerEvents.OddOrEvenResult, {
          yourValue: entry.yourValue,
          yourPrediction: entry.yourPrediction,
          opponentValue: entry.opponentValue,
          opponentPrediction: entry.opponentPrediction,
          sum: entry.sum,
          parity: entry.parity,
          outcome: entry.outcome,
          bothCorrect: entry.bothCorrect,
          scores: result.scores,
          matchOver: result.matchOver,
          winnerId: result.winnerId
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TruthOrDareStart, () => {
    try {
      const result = roomManager.startTruthOrDare(socket.id);
      io.to(result.roomId).emit(ServerEvents.TruthOrDareSpin, {
        activePlayerId: result.activePlayerId,
        activePlayerName: result.activePlayerName
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TruthOrDareChoice, ({ type }) => {
    try {
      const result = roomManager.chooseTruthOrDareType(socket.id, type);
      io.to(result.roomId).emit(ServerEvents.TruthOrDareContent, { type: result.type, text: result.text });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TruthOrDareAnswer, ({ answer }) => {
    try {
      const result = roomManager.submitTruthOrDareAnswer(socket.id, answer);
      io.to(result.roomId).emit(ServerEvents.TruthOrDareAnswerSubmitted, { answer: result.answer });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TruthOrDareValidate, ({ approved }) => {
    try {
      const result = roomManager.validateTruthOrDare(socket.id, approved);
      io.to(result.roomId).emit(ServerEvents.TruthOrDareResult, {
        approved: result.approved,
        activePlayerId: result.activePlayerId,
        scores: result.scores,
        matchOver: result.matchOver,
        winnerId: result.winnerId
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.WouldYouRatherStart, () => {
    try {
      const result = roomManager.startWouldYouRatherRound(socket.id);
      io.to(result.roomId).emit(ServerEvents.WouldYouRatherUpdate, { prompt: result.prompt });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.WouldYouRatherChoice, ({ selected }) => {
    try {
      const result = roomManager.setWouldYouRatherChoice(socket.id, selected);
      if (!result) {
        socket.emit(ServerEvents.Greeting, { type: ServerEvents.Greeting, payload: 'Choix reçu, en attente du second joueur.' });
        return;
      }

      for (const entry of result.entries) {
        io.to(entry.socketId).emit(ServerEvents.WouldYouRatherResult, {
          yourChoice: entry.yourChoice,
          opponentChoice: entry.opponentChoice,
          sameChoice: result.sameChoice,
          scores: result.scores,
          matchOver: result.matchOver,
          winnerId: result.winnerId
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwentyQuestionsSetWord, ({ word }) => {
    try {
      roomManager.setTwentyQuestionsWord(socket.id, word);
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwentyQuestionsGuess, ({ guess }) => {
    try {
      const result = roomManager.submitTwentyQuestionsGuess(socket.id, guess);
      io.to(result.roomId).emit(ServerEvents.TwentyQuestionsGuessSubmitted, {
        guess: result.guess,
        attemptsRemaining: result.attemptsRemaining
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.TwentyQuestionsRequestState, () => {
    const state = roomManager.getTwentyQuestionsState(socket.id);
    if (state) {
      socket.emit(ServerEvents.TwentyQuestionsRoundReady, state);
    }
  });

  socket.on(ServerEvents.TwentyQuestionsJudge, ({ correct, hint }) => {
    try {
      const result = roomManager.judgeTwentyQuestionsGuess(socket.id, correct, hint);
      io.to(result.roomId).emit(ServerEvents.TwentyQuestionsRoundResult, {
        correct: result.correct,
        hint: result.hint,
        attemptsRemaining: result.attemptsRemaining,
        roundOver: result.roundOver,
        turnIndex: result.turnIndex,
        nextSetterId: result.nextSetterId,
        nextGuesserId: result.nextGuesserId,
        scores: result.scores,
        matchOver: result.matchOver,
        isDraw: result.isDraw,
        winnerId: result.winnerId
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwoTruthsOneLieSubmit, ({ statements, lieIndex }) => {
    try {
      const roomId = roomManager.getRoomId(socket.id);
      if (!roomId) {
        throw new Error('Vous n’êtes pas dans une salle.');
      }

      if (roomManager.getGameData(socket.id, 'twoTruthsOneLie')) {
        throw new Error('Une manche est déjà en cours. Attendez le vote avant de soumettre à nouveau.');
      }

      if (!Array.isArray(statements) || statements.length !== 3 || !Number.isInteger(lieIndex) || lieIndex < 0 || lieIndex > 2) {
        throw new Error('Il faut exactement 3 affirmations et indiquer laquelle est le mensonge.');
      }

      roomManager.setGameData(socket.id, 'twoTruthsOneLie', { statements, lieIndex, submitter: socket.id });
      io.to(roomId).emit(ServerEvents.TwoTruthsOneLiePrompt, {
        statements,
        submitterId: socket.id,
        message: 'Un joueur a soumis 2 vérités et 1 mensonge. Votez pour la phrase mensonge.'
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwoTruthsOneLieVote, ({ voteIndex }) => {
    try {
      const result = roomManager.voteTwoTruthsOneLie(socket.id, voteIndex);
      io.to(result.roomId).emit(ServerEvents.TwoTruthsOneLieResult, {
        voterSocketId: result.voterSocketId,
        correct: result.correct,
        lieIndex: result.lieIndex,
        scores: result.scores,
        matchOver: result.matchOver,
        winnerId: result.winnerId
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.StartGame, ({ roomId }) => {
    try {
      const ownerRoomId = roomManager.getRoomId(socket.id);
      if (!ownerRoomId || ownerRoomId !== roomId) {
        throw new Error('Impossible de démarrer la partie pour ce salon.');
      }

      const roomPlayers = roomManager.getPlayers(roomId);
      if (roomPlayers.length < 2) {
        throw new Error('Il faut au moins 2 joueurs pour démarrer la partie.');
      }

      io.to(roomId).emit(ServerEvents.GameStarted, { roomId });

      if (roomManager.getGameId(roomId) === '20-questions') {
        const round = roomManager.beginTwentyQuestionsMatch(socket.id);
        io.to(roomId).emit(ServerEvents.TwentyQuestionsRoundReady, {
          setterId: round.setterId,
          guesserId: round.guesserId,
          attemptsRemaining: round.attemptsRemaining,
          turnIndex: round.turnIndex
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.Disconnect, reason => {
    console.log(`Client déconnecté: ${socket.id} (${reason})`);
    const room = roomManager.leaveRoom(socket.id);
    if (room) {
      io.to(room.roomId).emit(ServerEvents.RoomUpdate, { roomId: room.roomId, players: room.players });
    }
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
server.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});
