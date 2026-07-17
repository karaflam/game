import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function ResultsPage() {
  const navigate = useNavigate();
  const { gameId, roomCode } = useParams();

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Résultats</p>
            <h1 className="mt-3 text-4xl font-bold text-foreground">Classement final</h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">Récapitulatif du salon {roomCode} pour {gameId?.replace(/-/g, ' ') ?? 'le jeu'}.</p>
          </div>
        </div>

        <div className="mt-8 space-y-4 rounded-3xl border border-border bg-background p-6">
          <div className="rounded-3xl bg-surface p-4">
            <p className="text-sm font-semibold text-foreground">1. Joueur A</p>
            <p className="text-sm text-muted-foreground">15 points</p>
          </div>
          <div className="rounded-3xl bg-surface p-4">
            <p className="text-sm font-semibold text-foreground">2. Joueur B</p>
            <p className="text-sm text-muted-foreground">12 points</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => navigate('/')}>Retour à l'accueil</Button>
          <Button variant="secondary" onClick={() => navigate(`/jeu/${gameId}/mode`)}>
            Rejouer
          </Button>
        </div>
      </section>
    </motion.main>
  );
}
