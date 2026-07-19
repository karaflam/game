import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlayerWheel } from '@/components/solo/PlayerWheel';
import { FlipReveal } from '@/components/solo/reveals/FlipReveal';
import { soloTruthOrDarePrompts, TRUTH_OR_DARE_CATEGORIES, DEFAULT_TRUTH_OR_DARE_CATEGORY_IDS, type TruthOrDareCategoryId } from '@/data/soloPrompts';
import { pickRandomIndexFromCandidates } from '@/lib/randomPick';

type Phase = 'idle' | 'spinning' | 'landed' | 'revealing';

const PLAYER_NAME = 'Vous';

function eligibleIndices(categories: TruthOrDareCategoryId[]) {
  const active = new Set(categories);
  const indices = soloTruthOrDarePrompts.reduce<number[]>((acc, prompt, index) => {
    if (active.has(prompt.category)) {
      acc.push(index);
    }
    return acc;
  }, []);
  return indices.length > 0 ? indices : soloTruthOrDarePrompts.map((_, index) => index);
}

export function TruthOrDareSolo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [categories, setCategories] = useState<TruthOrDareCategoryId[]>(DEFAULT_TRUTH_OR_DARE_CATEGORY_IDS);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(() => new Set());
  const [promptIndex, setPromptIndex] = useState<number>(() => {
    const candidates = eligibleIndices(DEFAULT_TRUTH_OR_DARE_CATEGORY_IDS);
    return candidates[Math.floor(Math.random() * candidates.length)];
  });
  const [reveal, setReveal] = useState<'truth' | 'dare' | null>(null);

  const prompt = soloTruthOrDarePrompts[promptIndex];

  const toggleCategory = (id: TruthOrDareCategoryId) => {
    setCategories(prev => {
      const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
      return next.length > 0 ? next : prev;
    });
  };

  const spin = () => {
    const candidates = eligibleIndices(categories);
    const currentUsed = new Set(usedIndices);
    currentUsed.add(promptIndex);

    let activeUsed = currentUsed;
    if (candidates.every(index => activeUsed.has(index))) {
      activeUsed = new Set();
    }
    const nextIdx = pickRandomIndexFromCandidates(candidates, activeUsed);
    const newUsed = new Set(activeUsed).add(nextIdx);

    setUsedIndices(newUsed);
    setPromptIndex(nextIdx);
    setReveal(null);
    setPhase('spinning');
  };

  const handleSpinComplete = () => {
    setPhase('landed');
  };

  const chooseType = (type: 'truth' | 'dare') => {
    setReveal(type);
    setPhase('revealing');
  };

  const handleRevealComplete = () => {
    setPhase('idle');
  };

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-background p-4 sm:p-8">
      {phase === 'idle' ? (
        <>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Catégories</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TRUTH_OR_DARE_CATEGORIES.map(category => (
                <label
                  key={category.id}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-3 text-sm transition-colors hover:border-primary/40"
                >
                  <input
                    type="checkbox"
                    checked={categories.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block font-semibold text-foreground">{category.label}</span>
                    <span className="block text-xs text-muted-foreground">{category.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Faites tourner la roue pour désigner qui doit relever le défi.</p>
          <Button type="button" onClick={spin}>
            Tourner la roue
          </Button>
        </>
      ) : null}

      {phase === 'spinning' || phase === 'landed' ? (
        <PlayerWheel
          players={[PLAYER_NAME]}
          landedOn={PLAYER_NAME}
          spinning={phase === 'spinning'}
          onSpinComplete={handleSpinComplete}
        />
      ) : null}

      {phase === 'landed' ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">{PLAYER_NAME} doit choisir : Action ou Vérité ?</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => chooseType('truth')}>
              Vérité
            </Button>
            <Button type="button" variant="outline" onClick={() => chooseType('dare')}>
              Action
            </Button>
          </div>
        </div>
      ) : null}

      {phase === 'revealing' && reveal ? (
        <FlipReveal
          cardSize="lg"
          cards={[{ id: 'prompt', content: reveal === 'truth' ? prompt.truth : prompt.dare }]}
          outcomeLabel={reveal === 'truth' ? 'Vérité' : 'Action'}
          onComplete={handleRevealComplete}
        />
      ) : null}
    </div>
  );
}
