import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { soloWouldYouRatherPrompts } from '@/data/soloPrompts';
import { pickRandomItem, pickRandomIndexExcluding } from '@/lib/randomPick';

const SIDES = ['left', 'right'] as const;
type Side = (typeof SIDES)[number];

type RoundResult = { playerChoice: Side; machineChoice: Side };

export function WouldYouRatherSolo() {
  const [usedIndices, setUsedIndices] = useState<Set<number>>(() => new Set());
  const [dilemmaIndex, setDilemmaIndex] = useState<number>(() => Math.floor(Math.random() * soloWouldYouRatherPrompts.length));
  const [revealing, setRevealing] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);

  const dilemma = soloWouldYouRatherPrompts[dilemmaIndex];

  const nextDilemma = () => {
    const currentUsed = new Set(usedIndices);
    currentUsed.add(dilemmaIndex);

    let activeUsed = currentUsed;
    if (activeUsed.size >= soloWouldYouRatherPrompts.length) {
      activeUsed = new Set();
    }
    const nextIdx = pickRandomIndexExcluding(soloWouldYouRatherPrompts.length, activeUsed);
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
      {revealing && result ? (
        <BurstReveal
          icon="neutral"
          headline={`Vous : « ${dilemma[result.playerChoice]} »`}
          detail={`IA : « ${dilemma[result.machineChoice]} » ${
            result.playerChoice === result.machineChoice ? '— même longueur d’onde !' : '— pas d’accord cette fois.'
          }`}
          onComplete={() => setRevealing(false)}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Tu préfères...</p>

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
          {result ? 'Prochain dilemme' : 'Nouveau dilemme'}
        </Button>
      ) : null}
    </div>
  );
}
