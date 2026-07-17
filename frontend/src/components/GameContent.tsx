import type { Socket } from 'socket.io-client';
import type { GameMode, GameTheme } from '../types/game';
import { OddOrEvenGame } from '../games/OddOrEvenGame';
import { RpsGame } from '../games/RpsGame';
import { TruthOrDareGame } from '../games/TruthOrDareGame';
import { TwentyQuestionsGame } from '../games/TwentyQuestionsGame';
import { TwoTruthsOneLieGame } from '../games/TwoTruthsOneLieGame';
import { WouldYouRatherGame } from '../games/WouldYouRatherGame';

type GameContentProps = {
  selectedGame: GameTheme | null;
  mode: GameMode;
  onScore: (player: 'player1' | 'player2') => void;
  gameEnded: boolean;
  socket: Socket | null;
  socketId: string | null;
  roomId: string | null;
};

export function GameContent({ selectedGame, mode, onScore, gameEnded, socket, socketId, roomId }: GameContentProps) {
  if (!selectedGame) {
    return null;
  }

  switch (selectedGame.id) {
    case 'rps':
      return <RpsGame mode={mode} onScore={onScore} gameEnded={gameEnded} socket={socket} socketId={socketId} roomId={roomId} />;
    case 'truth-or-dare':
      return <TruthOrDareGame mode={mode} onScore={onScore} gameEnded={gameEnded} socket={socket} socketId={socketId} roomId={roomId} />;
    case 'odd-or-even':
      return <OddOrEvenGame mode={mode} onScore={onScore} gameEnded={gameEnded} socket={socket} socketId={socketId} roomId={roomId} />;
    case 'would-you-rather':
      return <WouldYouRatherGame mode={mode} onScore={onScore} gameEnded={gameEnded} socket={socket} socketId={socketId} roomId={roomId} />;
    case '20-questions':
      return <TwentyQuestionsGame mode={mode} onScore={onScore} gameEnded={gameEnded} socket={socket} socketId={socketId} roomId={roomId} />;
    case 'two-truths-one-lie':
      return <TwoTruthsOneLieGame mode={mode} onScore={onScore} gameEnded={gameEnded} socket={socket} socketId={socketId} roomId={roomId} />;
    default:
      return null;
  }
}
