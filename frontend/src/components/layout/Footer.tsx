const AUTHOR_NAME = 'Marc Landry Fangue';
const AUTHOR_EMAIL = 'landryfangue2@gmail.com';

export function Footer() {
  return (
    <div className="fixed bottom-3 right-4 z-40">
      <a
        href={`mailto:${AUTHOR_EMAIL}`}
        aria-label={`Contacter ${AUTHOR_NAME}`}
        className="group flex items-center whitespace-nowrap text-xs"
      >
        <span className="max-w-0 overflow-hidden text-primary opacity-0 transition-all duration-300 ease-out group-hover:mr-2 group-hover:max-w-[220px] group-hover:opacity-100">
          {AUTHOR_EMAIL}
        </span>
        <span className="font-serif italic tracking-wide text-muted-foreground/40 transition-colors duration-300 ease-out group-hover:text-foreground">
          {AUTHOR_NAME}
        </span>
      </a>
    </div>
  );
}
