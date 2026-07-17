import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';

export function SoloPlayPage() {
  const { gameId } = useParams();

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <h1 className="text-4xl font-bold text-foreground">Mode solo — {gameId?.replace(/-/g, ' ')}</h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">Entraînez-vous contre l’IA ou devinez un mot généré aléatoirement selon le jeu.</p>
        <div className="mt-8 rounded-3xl border border-border bg-background p-8">
          <p className="text-sm leading-6 text-muted-foreground">Ici sera affichée la mécanique solo spécifique à chaque jeu.</p>
        </div>
      </section>
    </motion.main>
  );
}
