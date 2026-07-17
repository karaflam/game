import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ServerEvents, ClientEvents } from './events.js';
import { RoomManager } from './roomManager.js';
import { truthOrDarePrompts, wouldYouRatherPrompts, twentyQuestionsWords } from './gamePrompts.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();

app.use(cors({ origin: 'http://localhost:5173' }));
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

  socket.on(ClientEvents.CreateRoom, () => {
    try {
      const { roomId, players } = roomManager.createRoom(socket.id);
      socket.join(roomId);
      socket.emit(ServerEvents.RoomCreated, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.JoinRoom, ({ roomId }) => {
    try {
      const players = roomManager.joinRoom(roomId, socket.id);
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
      const result = roomManager.setChoice(socket.id, choice);
      if (!result) {
        socket.emit(ServerEvents.Greeting, { type: ServerEvents.Greeting, payload: 'Choix reçu, en attente du second joueur.' });
        return;
      }

      for (const entry of result.result) {
        io.to(entry.socketId).emit(ServerEvents.RpsResult, entry);
      }
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

      for (const entry of result.result) {
        io.to(entry.socketId).emit(ServerEvents.OddOrEvenResult, entry);
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TruthOrDareStart, () => {
    try {
      const roomId = roomManager.getRoomId(socket.id);
      if (!roomId) {
        throw new Error('Vous n’êtes pas dans une salle.');
      }

      const players = roomManager.getPlayers(roomId);
      if (!players.length) {
        throw new Error('Aucun joueur dans la salle.');
      }

      const prompt = truthOrDarePrompts[Math.floor(Math.random() * truthOrDarePrompts.length)];
      const activeIndex = Math.floor(Math.random() * players.length);
      roomManager.setGameData(socket.id, 'truthOrDare', { prompt, activeIndex });

      io.to(roomId).emit(ServerEvents.TruthOrDareUpdate, {
        prompt,
        activePlayer: `Joueur ${activeIndex + 1}`
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TruthOrDareChoice, ({ type }) => {
    try {
      const roomId = roomManager.getRoomId(socket.id);
      if (!roomId) {
        throw new Error('Vous n’êtes pas dans une salle.');
      }

      const roomData = roomManager.getGameData(socket.id, 'truthOrDare');
      if (!roomData) {
        throw new Error('Aucun jeu Action ou Vérité en cours.');
      }

      roomManager.clearGameData(socket.id, 'truthOrDare');
      const message = type === 'action' ? `Action : ${roomData.prompt.dare}` : `Vérité : ${roomData.prompt.truth}`;
      const players = roomManager.getPlayers(roomId);

      for (const playerSocketId of players) {
        const score = playerSocketId === socket.id ? 1 : 0;
        io.to(playerSocketId).emit(ServerEvents.TruthOrDareResult, {
          socketId: socket.id,
          message,
          score
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.WouldYouRatherStart, () => {
    try {
      const roomId = roomManager.getRoomId(socket.id);
      if (!roomId) {
        throw new Error('Vous n’êtes pas dans une salle.');
      }

      const prompt = wouldYouRatherPrompts[Math.floor(Math.random() * wouldYouRatherPrompts.length)];
      roomManager.setGameData(socket.id, 'wouldYouRather', { prompt });
      io.to(roomId).emit(ServerEvents.WouldYouRatherUpdate, { prompt });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.WouldYouRatherChoice, ({ selected }) => {
    try {
      const roomId = roomManager.getRoomId(socket.id);
      if (!roomId) {
        throw new Error('Vous n’êtes pas dans une salle.');
      }

      const promptData = roomManager.getGameData(socket.id, 'wouldYouRather');
      if (!promptData) {
        throw new Error('Aucun jeu Tu Préfères ? en cours.');
      }

      roomManager.clearGameData(socket.id, 'wouldYouRather');
      const message = `Le joueur a choisi : ${promptData.prompt[selected]}.`;
      const players = roomManager.getPlayers(roomId);

      for (const playerSocketId of players) {
        const score = playerSocketId === socket.id ? 1 : 0;
        io.to(playerSocketId).emit(ServerEvents.WouldYouRatherResult, {
          socketId: socket.id,
          message,
          score
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwentyQuestionsStart, () => {
    try {
      const roomId = roomManager.getRoomId(socket.id);
      if (!roomId) {
        throw new Error('Vous n’êtes pas dans une salle.');
      }

      const selected = twentyQuestionsWords[Math.floor(Math.random() * twentyQuestionsWords.length)];
      roomManager.setGameData(socket.id, 'twentyQuestions', {
        answer: selected.answer.toLowerCase(),
        hints: selected.hints,
        attempts: 0
      });

      io.to(roomId).emit(ServerEvents.TwentyQuestionsUpdate, {
        hint: selected.hints[0],
        message: 'Devinez le mot en 20 essais.',
        attempts: 0
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwentyQuestionsGuess, ({ guess }) => {
    try {
      const roomId = roomManager.getRoomId(socket.id);
      if (!roomId) {
        throw new Error('Vous n’êtes pas dans une salle.');
      }

      const gameData = roomManager.getGameData(socket.id, 'twentyQuestions');
      if (!gameData) {
        throw new Error('Aucun jeu 20 Questions en cours.');
      }

      gameData.attempts += 1;
      const answer = gameData.answer as string;
      const players = roomManager.getPlayers(roomId);

      if (guess.toLowerCase().trim() === answer) {
        roomManager.clearGameData(socket.id, 'twentyQuestions');
        for (const playerSocketId of players) {
          const score = playerSocketId === socket.id ? 1 : 0;
          io.to(playerSocketId).emit(ServerEvents.TwentyQuestionsResult, {
            socketId: socket.id,
            message: `Bravo ! Le mot était ${answer}.`,
            score
          });
        }
        return;
      }

      if (gameData.attempts >= 20) {
        roomManager.clearGameData(socket.id, 'twentyQuestions');
        for (const playerSocketId of players) {
          const score = playerSocketId === socket.id ? 0 : 1;
          io.to(playerSocketId).emit(ServerEvents.TwentyQuestionsResult, {
            socketId: socket.id,
            message: `Temps écoulé. Le mot était ${answer}.`,
            score
          });
        }
        return;
      }

      const nextHint = gameData.hints[gameData.attempts % gameData.hints.length];
      io.to(roomId).emit(ServerEvents.TwentyQuestionsUpdate, {
        hint: nextHint,
        message: `Non. Essaie ${gameData.attempts}/20.`,
        attempts: gameData.attempts
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwoTruthsOneLieSubmit, ({ statements }) => {
    try {
      const roomId = roomManager.getRoomId(socket.id);
      if (!roomId) {
        throw new Error('Vous n’êtes pas dans une salle.');
      }

      const lieIndex = Math.floor(Math.random() * statements.length);
      roomManager.setGameData(socket.id, 'twoTruthsOneLie', { statements, lieIndex, submitter: socket.id });
      io.to(roomId).emit(ServerEvents.TwoTruthsOneLiePrompt, {
        statements,
        message: 'Un joueur a soumis 2 vérités et 1 mensonge. Votez pour la phrase mensonge.'
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwoTruthsOneLieVote, ({ voteIndex }) => {
    try {
      const roomId = roomManager.getRoomId(socket.id);
      if (!roomId) {
        throw new Error('Vous n’êtes pas dans une salle.');
      }

      const gameData = roomManager.getGameData(socket.id, 'twoTruthsOneLie');
      if (!gameData) {
        throw new Error('Aucun jeu 2 Vérités 1 Mensonge en cours.');
      }

      roomManager.clearGameData(socket.id, 'twoTruthsOneLie');
      const correct = voteIndex === gameData.lieIndex;
      const submitter = gameData.submitter as string;
      const players = roomManager.getPlayers(roomId);
      const message = correct ? 'Vote correct !' : 'Vote incorrect...';

      for (const playerSocketId of players) {
        const score = playerSocketId === socket.id ? (correct ? 1 : 0) : playerSocketId === submitter ? (correct ? 0 : 1) : 0;
        io.to(playerSocketId).emit(ServerEvents.TwoTruthsOneLieResult, {
          socketId: socket.id,
          message: `${message} La phrase ${gameData.lieIndex + 1} était le mensonge.`,
          score
        });
      }
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
