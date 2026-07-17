import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { gameThemes } from '../data/gameThemes';

export function GameModePage() {
  const { gameId } = useParams();
  const game = gameThemes.find(item => item.id === gameId);

  if (!game) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Jeu introuvable</h2>
        <p className="mt-3 text-sm text-muted-foreground">Le jeu demandé n’existe pas. Revenez à l’accueil pour en choisir un autre.</p>
      </motion.div>
    );
  }

  return (
    <motion.main initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="mb-10 rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-foreground">{game.title}</h1>
          <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{game.description}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link to={`/jeu/${gameId}/salon/solo`} className="rounded-3xl border border-border bg-background p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Solo</span>
          <h2 className="mt-4 text-2xl font-semibold text-foreground">Mode Solo</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Entraînez-vous contre l’IA ou devinez un mot aléatoire dans un environnement convivial.</p>
        </Link>

        <Link to={`/jeu/${gameId}/salon/creer`} className="rounded-3xl border border-border bg-background p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Multijoueur</span>
          <h2 className="mt-4 text-2xl font-semibold text-foreground">Mode Multijoueur</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Créez ou rejoignez un salon, invitez vos amis, et jouez en temps réel avec scores partagés.</p>
        </Link>
      </div>
    </motion.main>
  );
}
