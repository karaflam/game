import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PlayerWheel } from '@/components/solo/PlayerWheel';
import { FlipReveal } from '@/components/solo/reveals/FlipReveal';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';
import { soloTruthOrDarePrompts, TRUTH_OR_DARE_CATEGORIES, DEFAULT_TRUTH_OR_DARE_CATEGORY_IDS, type TruthOrDareCategoryId, type TruthOrDarePrompt } from '@/data/soloPrompts';
import { pickRandomIndexFromCandidates } from '@/lib/randomPick';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const CardFlipScene = lazy(() => import('@/three/scenes/CardFlipScene').then(m => ({ default: m.CardFlipScene })));
const PlayerWheelScene = lazy(() => import('@/three/scenes/PlayerWheelScene').then(m => ({ default: m.PlayerWheelScene })));

type Phase = 'idle' | 'spinning' | 'landed' | 'revealing';

function eligibleIndices(prompts: TruthOrDarePrompt[], categories: TruthOrDareCategoryId[]) {
  const active = new Set(categories);
  const indices = prompts.reduce<number[]>((acc, prompt, index) => {
    if (active.has(prompt.category)) {
      acc.push(index);
    }
    return acc;
  }, []);
  return indices.length > 0 ? indices : prompts.map((_, index) => index);
}

export function TruthOrDareSolo() {
  const { t, i18n } = useTranslation();
  const prompts = soloTruthOrDarePrompts[i18n.language === 'en' ? 'en' : 'fr'];
  const PLAYER_NAME = t('solo.truthOrDare.playerName');
  const [phase, setPhase] = useState<Phase>('idle');
  const [categories, setCategories] = useState<TruthOrDareCategoryId[]>(DEFAULT_TRUTH_OR_DARE_CATEGORY_IDS);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(() => new Set());
  const [promptIndex, setPromptIndex] = useState<number>(() => {
    const candidates = eligibleIndices(prompts, DEFAULT_TRUTH_OR_DARE_CATEGORY_IDS);
    return candidates[Math.floor(Math.random() * candidates.length)];
  });
  const [reveal, setReveal] = useState<'truth' | 'dare' | null>(null);
  const { theme } = useTheme();
  const quality = useAdaptiveQuality();

  const prompt = prompts[promptIndex];

  const toggleCategory = (id: TruthOrDareCategoryId) => {
    setCategories(prev => {
      const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
      return next.length > 0 ? next : prev;
    });
  };

  const spin = () => {
    const candidates = eligibleIndices(prompts, categories);
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
            <p className="text-sm font-semibold text-foreground">{t('solo.truthOrDare.categoriesHeading')}</p>
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
                    <span className="block font-semibold text-foreground">{t(`truthOrDareCategories.${category.id}.label`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`truthOrDareCategories.${category.id}.description`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{t('solo.truthOrDare.spinInstruction')}</p>
          <Button type="button" onClick={spin}>
            {t('solo.truthOrDare.spinButton')}
          </Button>
        </>
      ) : null}

      {(phase === 'spinning' || phase === 'landed') && quality === 'fallback2d' ? (
        <PlayerWheel
          players={[PLAYER_NAME]}
          landedOn={PLAYER_NAME}
          spinning={phase === 'spinning'}
          onSpinComplete={handleSpinComplete}
        />
      ) : phase === 'spinning' || phase === 'landed' ? (
        <div className="relative -mx-4 aspect-square w-[calc(100%+2rem)] overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-[24rem] sm:w-full">
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality}>
              <PlayerWheelScene
                players={[PLAYER_NAME]}
                landedOn={PLAYER_NAME}
                spinning={phase === 'spinning'}
                onSpinComplete={handleSpinComplete}
                material={getThemeMaterial(theme)}
              />
            </GameCanvas>
          </Suspense>
        </div>
      ) : null}

      {phase === 'landed' ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">{PLAYER_NAME}{t('solo.truthOrDare.promptSuffix')}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => chooseType('truth')}>
              {t('solo.truthOrDare.truthButton')}
            </Button>
            <Button type="button" variant="outline" onClick={() => chooseType('dare')}>
              {t('solo.truthOrDare.dareButton')}
            </Button>
          </div>
        </div>
      ) : null}

      {phase === 'revealing' && reveal && quality === 'fallback2d' ? (
        <FlipReveal
          cardSize="lg"
          cards={[{ id: 'prompt', content: reveal === 'truth' ? prompt.truth : prompt.dare }]}
          outcomeLabel={reveal === 'truth' ? t('solo.truthOrDare.revealTruth') : t('solo.truthOrDare.revealDare')}
          onComplete={handleRevealComplete}
        />
      ) : phase === 'revealing' && reveal ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleRevealComplete}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleRevealComplete();
            }
          }}
          className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted p-6 text-center"
        >
          <div className="relative h-64 w-48">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <CardFlipScene material={getThemeMaterial(theme)} />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="max-w-sm text-sm font-medium text-foreground">{reveal === 'truth' ? prompt.truth : prompt.dare}</p>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {reveal === 'truth' ? t('solo.truthOrDare.revealTruth') : t('solo.truthOrDare.revealDare')}
          </p>
          <p className="text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : null}
    </div>
  );
}
