import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { gameThemes } from '../data/gameThemes';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/useGameStore';
import { ClientEvents, ServerEvents } from '../lib/socketEvents';
import { RpsMultiplayer } from '../games/multiplayer/RpsMultiplayer';

export function GamePlayPage() {
  const { gameId, roomCode } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const players = useGameStore(state => state.players);
  const game = useMemo(() => (gameId ? gameThemes.find(item => item.id === gameId) : null), [gameId]);
  const [statusMessage, setStatusMessage] = useState('Préparez-vous à jouer.');
  const [prompt, setPrompt] = useState<string | null>(null);
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [guess, setGuess] = useState('');
  const [statements, setStatements] = useState(['', '', '']);

  useEffect(() => {
    if (!socket) return;

    const handleOddOrEvenResult = (data: { socketId: string; message: string; score: number }) => {
      setStatusMessage(data.message);
    };

    const handleTruthOrDareUpdate = (data: { prompt: { truth: string; dare: string }; activePlayer: string }) => {
      setPrompt(null);
      setStatusMessage(`${data.activePlayer} doit choisir Action ou Vérité.`);
    };

    const handleTruthOrDareResult = (data: { socketId: string; message: string; score: number }) => {
      setStatusMessage(data.message);
      setPrompt(null);
    };

    const handleWouldYouRatherUpdate = (data: { prompt: { option1: string; option2: string } }) => {
      setOptionA(data.prompt.option1);
      setOptionB(data.prompt.option2);
      setStatusMessage('Choisissez votre préférence.');
    };

    const handleWouldYouRatherResult = (data: { socketId: string; message: string; score: number }) => {
      setStatusMessage(data.message);
      setOptionA('');
      setOptionB('');
    };

    const handleTwentyQuestionsUpdate = (data: { hint: string; message: string; attempts: number }) => {
      setStatusMessage(`${data.message} Indice : ${data.hint}`);
    };

    const handleTwentyQuestionsResult = (data: { socketId: string; message: string; score: number }) => {
      setStatusMessage(data.message);
      setGuess('');
    };

    const handleTwoTruthsOneLiePrompt = (data: { statements: string[]; message: string }) => {
      setPrompt(data.statements.map((text, index) => `${index + 1}. ${text}`).join('\n'));
      setStatusMessage(data.message);
    };

    const handleTwoTruthsOneLieResult = (data: { socketId: string; message: string; score: number }) => {
      setStatusMessage(data.message);
      setPrompt(null);
    };

    socket.on(ServerEvents.OddOrEvenResult, handleOddOrEvenResult);
    socket.on(ServerEvents.TruthOrDareUpdate, handleTruthOrDareUpdate);
    socket.on(ServerEvents.TruthOrDareResult, handleTruthOrDareResult);
    socket.on(ServerEvents.WouldYouRatherUpdate, handleWouldYouRatherUpdate);
    socket.on(ServerEvents.WouldYouRatherResult, handleWouldYouRatherResult);
    socket.on(ServerEvents.TwentyQuestionsUpdate, handleTwentyQuestionsUpdate);
    socket.on(ServerEvents.TwentyQuestionsResult, handleTwentyQuestionsResult);
    socket.on(ServerEvents.TwoTruthsOneLiePrompt, handleTwoTruthsOneLiePrompt);
    socket.on(ServerEvents.TwoTruthsOneLieResult, handleTwoTruthsOneLieResult);

    return () => {
      socket.off(ServerEvents.OddOrEvenResult, handleOddOrEvenResult);
      socket.off(ServerEvents.TruthOrDareUpdate, handleTruthOrDareUpdate);
      socket.off(ServerEvents.TruthOrDareResult, handleTruthOrDareResult);
      socket.off(ServerEvents.WouldYouRatherUpdate, handleWouldYouRatherUpdate);
      socket.off(ServerEvents.WouldYouRatherResult, handleWouldYouRatherResult);
      socket.off(ServerEvents.TwentyQuestionsUpdate, handleTwentyQuestionsUpdate);
      socket.off(ServerEvents.TwentyQuestionsResult, handleTwentyQuestionsResult);
      socket.off(ServerEvents.TwoTruthsOneLiePrompt, handleTwoTruthsOneLiePrompt);
      socket.off(ServerEvents.TwoTruthsOneLieResult, handleTwoTruthsOneLieResult);
    };
  }, [socket]);

  const handleOddOrEvenPlay = (value: number, prediction: 'pair' | 'impair') => {
    if (!socket) {
      setStatusMessage('Connexion serveur non disponible.');
      return;
    }
    socket.emit(ClientEvents.OddOrEvenPlay, { value, prediction });
    setStatusMessage(`Vous avez choisi ${value} et prédit ${prediction}.`);
  };

  const handleTruthOrDareStart = () => {
    if (!socket) {
      setStatusMessage('Connexion serveur non disponible.');
      return;
    }
    socket.emit(ClientEvents.TruthOrDareStart);
    setStatusMessage('Lancement de Action ou Vérité...');
  };

  const handleTruthOrDareChoice = (type: 'action' | 'truth') => {
    if (!socket) {
      setStatusMessage('Connexion serveur non disponible.');
      return;
    }
    socket.emit(ClientEvents.TruthOrDareChoice, { type });
    setStatusMessage('Votre choix a été envoyé.');
  };

  const handleWouldYouRatherStart = () => {
    if (!socket) {
      setStatusMessage('Connexion serveur non disponible.');
      return;
    }
    socket.emit(ClientEvents.WouldYouRatherStart);
    setStatusMessage('Chargement du dilemme...');
  };

  const handleWouldYouRatherChoice = (selected: 'option1' | 'option2') => {
    if (!socket) {
      setStatusMessage('Connexion serveur non disponible.');
      return;
    }
    socket.emit(ClientEvents.WouldYouRatherChoice, { selected });
    setStatusMessage('Votre choix a été envoyé.');
  };

  const handleTwentyQuestionsStart = () => {
    if (!socket) {
      setStatusMessage('Connexion serveur non disponible.');
      return;
    }
    socket.emit(ClientEvents.TwentyQuestionsStart);
    setStatusMessage('Nouvelle partie 20 Questions lancée...');
  };

  const handleTwentyQuestionsGuess = () => {
    if (!socket || !guess.trim()) {
      setStatusMessage('Entrez un mot avant de valider.');
      return;
    }
    socket.emit(ClientEvents.TwentyQuestionsGuess, { guess });
    setStatusMessage(`Vous avez proposé : ${guess}`);
  };

  const handleTwoTruthsOneLieSubmit = () => {
    if (!socket) {
      setStatusMessage('Connexion serveur non disponible.');
      return;
    }
    const cleaned = statements.map(statement => statement.trim());
    if (cleaned.some(text => !text)) {
      setStatusMessage('Veuillez remplir les trois affirmations.');
      return;
    }
    socket.emit(ClientEvents.TwoTruthsOneLieSubmit, { statements: cleaned });
    setStatusMessage('Submission envoyée. En attente des votes...');
  };

  const handleTwoTruthsOneLieVote = (voteIndex: number) => {
    if (!socket) {
      setStatusMessage('Connexion serveur non disponible.');
      return;
    }
    socket.emit(ClientEvents.TwoTruthsOneLieVote, { voteIndex });
    setStatusMessage('Vote envoyé.');
  };

  if (!game || !gameId || !roomCode) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Jeu introuvable</h2>
        <p className="mt-3 text-sm text-muted-foreground">Retournez à l’accueil pour sélectionner un jeu.</p>
      </motion.div>
    );
  }

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Partie en cours</p>
            <h1 className="mt-3 text-4xl font-bold text-foreground">{game.title} — Salon {roomCode}</h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{players.length} joueur(s) dans la salle.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(`/jeu/${gameId}/salon/${roomCode}/resultats`)}>
              Voir résultats
            </Button>
          </div>
        </div>

        <div className="mt-8">
          {gameId === 'rps' ? (
            <RpsMultiplayer />
          ) : (
            <div className="rounded-3xl border border-border bg-background p-8 space-y-6">
              <div className="rounded-3xl border border-border bg-surface p-4">
                <p className="text-sm text-muted-foreground">{statusMessage}</p>
              </div>

              {gameId === 'odd-or-even' ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[2, 3, 4].map(value => (
                    <Button key={value} onClick={() => handleOddOrEvenPlay(value, 'pair')}>
                      {value} + pair
                    </Button>
                  ))}
                  {[1, 5, 7].map(value => (
                    <Button key={value} onClick={() => handleOddOrEvenPlay(value, 'impair')}>
                      {value} + impair
                    </Button>
                  ))}
                </div>
              ) : gameId === 'truth-or-dare' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={handleTruthOrDareStart}>Lancer Action ou Vérité</Button>
                  <Button variant="secondary" onClick={() => handleTruthOrDareChoice('truth')}>
                    Vérité
                  </Button>
                  <Button variant="secondary" onClick={() => handleTruthOrDareChoice('action')}>
                    Action
                  </Button>
                  {prompt ? <pre className="whitespace-pre-wrap rounded-3xl border border-border bg-surface p-4 text-sm">{prompt}</pre> : null}
                </div>
              ) : gameId === 'would-you-rather' ? (
                <div className="space-y-4">
                  <Button onClick={handleWouldYouRatherStart}>Lancer Tu Préfères ?</Button>
                  {optionA && optionB ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button onClick={() => handleWouldYouRatherChoice('option1')}>{optionA}</Button>
                      <Button onClick={() => handleWouldYouRatherChoice('option2')}>{optionB}</Button>
                    </div>
                  ) : null}
                </div>
              ) : gameId === '20-questions' ? (
                <div className="space-y-4">
                  <Button onClick={handleTwentyQuestionsStart}>Lancer 20 Questions</Button>
                  <div className="flex gap-3">
                    <input
                      value={guess}
                      onChange={event => setGuess(event.target.value)}
                      placeholder="Entrez votre supposition"
                      className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <Button onClick={handleTwentyQuestionsGuess}>Valider</Button>
                  </div>
                </div>
              ) : gameId === 'two-truths-one-lie' ? (
                <div className="space-y-4">
                  <div className="grid gap-3">
                    {statements.map((text, index) => (
                      <input
                        key={index}
                        value={text}
                        onChange={event => setStatements(prev => prev.map((item, idx) => (idx === index ? event.target.value : item)))}
                        placeholder={`Phrase ${index + 1}`}
                        className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    ))}
                  </div>
                  <Button onClick={handleTwoTruthsOneLieSubmit}>Soumettre 2 vérités, 1 mensonge</Button>
                  {prompt ? (
                    <div className="space-y-3">
                      <pre className="whitespace-pre-wrap rounded-3xl border border-border bg-surface p-4 text-sm">{prompt}</pre>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {[0, 1, 2].map(index => (
                          <Button key={index} onClick={() => handleTwoTruthsOneLieVote(index)}>
                            Vote {index + 1}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-3xl border border-border bg-surface p-6 text-sm text-muted-foreground">
                  Ce jeu est en cours de développement. Revenez bientôt pour plus d’options.
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </motion.main>
  );
}
