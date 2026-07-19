const AUTHOR_NAME = 'Marc Landry Fangue';
const AUTHOR_EMAIL = 'landryfangue2@gmail.com';

export function Footer() {
  return (
    <div className="group pointer-events-none fixed bottom-3 right-4 z-40">
      <a
        href={`mailto:${AUTHOR_EMAIL}`}
        aria-label={`Contacter ${AUTHOR_NAME}`}
        className="pointer-events-auto relative block h-4 overflow-hidden text-right text-xs"
      >
        <span className="absolute inset-0 block whitespace-nowrap font-serif italic tracking-wide text-muted-foreground/35 transition-all duration-300 ease-out group-hover:-translate-y-3 group-hover:opacity-0">
          {AUTHOR_NAME}
        </span>
        <span className="absolute inset-0 block translate-y-3 whitespace-nowrap tracking-wide text-primary opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
          {AUTHOR_EMAIL}
        </span>
      </a>
    </div>
  );
}
