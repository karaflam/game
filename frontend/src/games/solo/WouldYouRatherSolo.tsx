import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { soloWouldYouRatherPrompts } from '@/data/soloPrompts';
import { pickRandomItem, pickRandomIndexExcluding } from '@/lib/randomPick';
import useTheme from '@/hooks/useTheme';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import { getThemeMaterial } from '@/three/themeMaterials';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const BadgeBurstScene = lazy(() => import('@/three/scenes/BadgeBurstScene').then(m => ({ default: m.BadgeBurstScene })));

const SIDES = ['left', 'right'] as const;
type Side = (typeof SIDES)[number];

type RoundResult = { playerChoice: Side; machineChoice: Side };

export function WouldYouRatherSolo() {
  const { t, i18n } = useTranslation();
  const prompts = soloWouldYouRatherPrompts[i18n.language === 'en' ? 'en' : 'fr'];
  const [usedIndices, setUsedIndices] = useState<Set<number>>(() => new Set());
  const [dilemmaIndex, setDilemmaIndex] = useState<number>(() => Math.floor(Math.random() * prompts.length));
  const [revealing, setRevealing] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);
  const { theme } = useTheme();
  const quality = useAdaptiveQuality();

  const dilemma = prompts[dilemmaIndex];

  const nextDilemma = () => {
    const currentUsed = new Set(usedIndices);
    currentUsed.add(dilemmaIndex);

    let activeUsed = currentUsed;
    if (activeUsed.size >= prompts.length) {
      activeUsed = new Set();
    }
    const nextIdx = pickRandomIndexExcluding(prompts.length, activeUsed);
    const newUsed = new Set(activeUsed).add(nextIdx);

    setUsedIndices(newUsed);
    setDilemmaIndex(nextIdx);
    setResult(null);
    setRevealing(false);
  };

  const chooseOption = (side: Side) => {
    if (revealing || result) {
      return;
    }
    setResult({ playerChoice: side, machineChoice: pickRandomItem(SIDES) });
    setRevealing(true);
  };

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-background p-8">
      {revealing && result && quality === 'fallback2d' ? (
        <BurstReveal
          icon="neutral"
          headline={t('solo.wouldYouRather.yourChoice', { choice: dilemma[result.playerChoice] })}
          detail={
            result.playerChoice === result.machineChoice
              ? t('solo.wouldYouRather.aiSame', { choice: dilemma[result.machineChoice] })
              : t('solo.wouldYouRather.aiDifferent', { choice: dilemma[result.machineChoice] })
          }
          onComplete={() => setRevealing(false)}
        />
      ) : revealing && result ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setRevealing(false)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              setRevealing(false);
            }
          }}
          className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted p-6 text-center"
        >
          <div className="relative h-40 w-40">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <BadgeBurstScene variant="neutral" material={getThemeMaterial(theme)} />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="max-w-sm text-sm font-semibold text-foreground">{t('solo.wouldYouRather.yourChoice', { choice: dilemma[result.playerChoice] })}</p>
          <p className="text-sm text-muted-foreground">
            {result.playerChoice === result.machineChoice
              ? t('solo.wouldYouRather.aiSame', { choice: dilemma[result.machineChoice] })
              : t('solo.wouldYouRather.aiDifferent', { choice: dilemma[result.machineChoice] })}
          </p>
          <p className="text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t('solo.wouldYouRather.instructions')}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => chooseOption('left')}
              disabled={!!result}
              className="h-auto whitespace-normal px-4 py-3 text-left"
            >
              {dilemma.left}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => chooseOption('right')}
              disabled={!!result}
              className="h-auto whitespace-normal px-4 py-3 text-left"
            >
              {dilemma.right}
            </Button>
          </div>
        </>
      )}

      {!revealing ? (
        <Button type="button" variant="secondary" onClick={nextDilemma}>
          {result ? t('solo.wouldYouRather.nextDilemmaButton') : t('solo.wouldYouRather.newDilemmaButton')}
        </Button>
      ) : null}
    </div>
  );
}
