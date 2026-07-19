const AUTHOR_NAME = 'Marc Landry Fangue';
const AUTHOR_EMAIL = 'landryfangue2@gmail.com';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border/60 py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 px-4 text-center sm:px-6 lg:px-8">
        <div className="h-px w-16 bg-gradient-to-r from-transparent via-border to-transparent" />
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50 transition-colors duration-300 hover:text-muted-foreground">
          Créé par {AUTHOR_NAME} ·{' '}
          <a href={`mailto:${AUTHOR_EMAIL}`} className="underline-offset-2 hover:underline">
            {AUTHOR_EMAIL}
          </a>
        </p>
      </div>
    </footer>
  );
}
