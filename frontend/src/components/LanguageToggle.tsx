import useLanguage from '../hooks/useLanguage';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
      aria-label={`Switch language, current: ${language.toUpperCase()}`}
      className="font-mono-label inline-flex h-8 items-center justify-center rounded-full border border-border bg-secondary px-3 text-xs font-bold uppercase tracking-wide text-secondary-foreground transition hover:bg-muted"
    >
      {language}
    </button>
  );
}
