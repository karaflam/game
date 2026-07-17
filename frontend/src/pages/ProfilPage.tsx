import { motion } from 'framer-motion';

export function ProfilPage() {
  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <h1 className="text-4xl font-bold text-foreground">Profil joueur</h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">Cette page affichera bientôt les statistiques du joueur, l’historique de parties et les préférences de thème.</p>
      </section>
    </motion.main>
  );
}
