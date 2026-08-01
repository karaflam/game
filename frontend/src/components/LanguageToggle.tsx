import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Languages } from 'lucide-react';
import useLanguage from '../hooks/useLanguage';

export default function LanguageToggle() {
  const { language, setLanguage, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const activeLanguage = languages.find(item => item.id === language) ?? languages[0];

  return (
    <div className="relative inline-flex text-left">
      <Button
        variant="secondary"
        size="sm"
        className="inline-flex items-center gap-2"
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">{activeLanguage.label}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {open ? (
        <div className="absolute right-0 left-auto z-50 mt-2 w-40 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="p-2">
            {languages.map(lang => (
              <button
                key={lang.id}
                type="button"
                onClick={() => {
                  setLanguage(lang.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-muted ${
                  language === lang.id ? 'bg-muted' : ''
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
