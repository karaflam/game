import { motion } from 'framer-motion';

export function ClassementPage() {
  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <h1 className="text-4xl font-bold text-foreground">Classement global</h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">Les scores sont affichés ici une fois la partie terminée.</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-background p-6">
            <p className="text-sm leading-6 text-muted-foreground">Aucune donnée pour le moment. Le classement sera mis à jour après les parties multijoueur.</p>
          </div>
          <div className="rounded-3xl border border-border bg-background p-6">
            <p className="text-sm leading-6 text-muted-foreground">Un tableau de top joueurs arrivera ici dès que les scores sont disponibles.</p>
          </div>
        </div>
      </section>
    </motion.main>
  );
}
