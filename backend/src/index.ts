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
  },
  // Lets a socket that reconnects within 2 minutes (default) keep its original socket.id and
  // automatically rejoin the socket.io rooms it was in, with any broadcasts it missed replayed.
  // This is a transport-level safety net for brief interruptions (app-switch, weak signal) —
  // it does not replace the token-based reconnect in RoomManager, which is what handles the
  // "gone for a while" case and restores game-specific state, not just room membership.
  connectionStateRecovery: {}
});

const roomManager = new RoomManager();

// Pure memory hygiene: a room is only ever eligible once EVERY player in it has had zero live
// connection for this long — never while someone is still there, no matter how long their
// companion has been gone. Far longer than any realistic "left the browser to share the code"
// gap, so it never conflicts with that use case; it only reclaims rooms nobody is coming back to.
const ABANDONED_ROOM_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours
const ABANDONED_ROOM_SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

setInterval(() => {
  const reaped = roomManager.reapAbandonedRooms(ABANDONED_ROOM_THRESHOLD_MS);
  if (reaped.length > 0) {
    console.log(`Salons abandonnés nettoyés (${reaped.length}): ${reaped.join(', ')}`);
  }
}, ABANDONED_ROOM_SWEEP_INTERVAL_MS);

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

  socket.on(ClientEvents.CreateRoom, ({ name, gameId, token }: { name: string; gameId: string; token: string }) => {
    try {
      const { roomId, players, previousRoom } = roomManager.createRoom(socket.id, name, gameId, token);

      if (previousRoom) {
        socket.leave(previousRoom.roomId);
        io.to(previousRoom.roomId).emit(ServerEvents.RoomUpdate, {
          roomId: previousRoom.roomId,
          players: previousRoom.players,
          started: previousRoom.started,
          scores: previousRoom.scores
        });
      }

      socket.join(roomId);
      socket.emit(ServerEvents.RoomCreated, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(
    ClientEvents.JoinRoom,
    ({ roomId, name, gameId, token }: { roomId: string; name: string; gameId: string; token: string }) => {
      try {
        const result = roomManager.joinRoom(roomId, socket.id, name, gameId, token);

        if (result.previousRoom) {
          socket.leave(result.previousRoom.roomId);
          io.to(result.previousRoom.roomId).emit(ServerEvents.RoomUpdate, {
            roomId: result.previousRoom.roomId,
            players: result.previousRoom.players,
            started: result.previousRoom.started,
            scores: result.previousRoom.scores
          });
        }

        socket.join(roomId);

        io.to(roomId).emit(ServerEvents.RoomUpdate, {
          roomId,
          players: result.players,
          started: result.started,
          scores: result.scores
        });
      } catch (error) {
        socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
      }
    }
  );

  socket.on(ClientEvents.LeaveRoom, () => {
    const room = roomManager.leaveRoom(socket.id);
    if (room) {
      socket.leave(room.roomId);
      io.to(room.roomId).emit(ServerEvents.RoomUpdate, {
        roomId: room.roomId,
        players: room.players,
        started: room.started,
        scores: room.scores
      });
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
          isDraw: result.isDraw,
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
          teamResult: result.teamResult
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwentyQuestionsSetWord, ({ word }) => {
    try {
      const result = roomManager.setTwentyQuestionsWord(socket.id, word);
      io.to(result.roomId).emit(ServerEvents.TwentyQuestionsWordReady, {});
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
      const result = roomManager.submitTwoTruthsOneLie(socket.id, statements, lieIndex);
      io.to(result.roomId).emit(ServerEvents.TwoTruthsOneLiePrompt, {
        statements: result.statements,
        submitterId: result.submitterId,
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
        winnerId: result.winnerId,
        nextSubmitterId: result.nextSubmitterId,
        nextVoterId: result.nextVoterId
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

      roomManager.markStarted(roomId);
      io.to(roomId).emit(ServerEvents.GameStarted, { roomId });

      if (roomManager.getGameId(roomId) === '20-questions') {
        const round = roomManager.beginTwentyQuestionsMatch(socket.id);
        io.to(roomId).emit(ServerEvents.TwentyQuestionsRoundReady, {
          setterId: round.setterId,
          guesserId: round.guesserId,
          attemptsRemaining: round.attemptsRemaining,
          turnIndex: round.turnIndex,
          wordSet: round.wordSet
        });
      }

      if (roomManager.getGameId(roomId) === 'two-truths-one-lie') {
        const round = roomManager.beginTwoTruthsOneLieMatch(socket.id);
        io.to(roomId).emit(ServerEvents.TwoTruthsOneLieRoundReady, {
          submitterId: round.submitterId,
          voterId: round.voterId
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  // A single, generic resync handshake used by every game instead of one bespoke pair of events
  // each — the client asks "what's going on in my room right now" and gets back exactly the same
  // shape it would have received live, computed by the same per-game getters. Used both right
  // after a (re)join and defensively any time a client suspects it might have missed something.
  socket.on(ClientEvents.RequestGameState, () => {
    const roomId = roomManager.getRoomId(socket.id);
    if (!roomId) {
      return;
    }

    const gameId = roomManager.getGameId(roomId);
    const state =
      gameId === 'rps'
        ? roomManager.getRpsState(socket.id)
        : gameId === 'odd-or-even'
          ? roomManager.getOddOrEvenState(socket.id)
          : gameId === 'would-you-rather'
            ? roomManager.getWouldYouRatherState(socket.id)
            : gameId === 'truth-or-dare'
              ? roomManager.getTruthOrDareState(socket.id)
              : gameId === '20-questions'
                ? roomManager.getTwentyQuestionsState(socket.id)
                : gameId === 'two-truths-one-lie'
                  ? roomManager.getTwoTruthsOneLieState(socket.id)
                  : null;

    if (state) {
      socket.emit(ServerEvents.GameState, { gameId, state });
    }
  });

  socket.on(ClientEvents.Disconnect, reason => {
    console.log(`Client déconnecté: ${socket.id} (${reason})`);
    // Deliberately a no-op on room/game state — see markDisconnected's comment.
    roomManager.markDisconnected(socket.id);
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
server.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});
