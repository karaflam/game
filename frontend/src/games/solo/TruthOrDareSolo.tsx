import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlayerWheel } from '@/components/solo/PlayerWheel';
import { FlipReveal } from '@/components/solo/reveals/FlipReveal';
import { soloTruthOrDarePrompts } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';

type Phase = 'idle' | 'spinning' | 'landed' | 'revealing';

const PLAYER_NAME = 'Vous';

export function TruthOrDareSolo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [prompt, setPrompt] = useState(() => pickRandomItem(soloTruthOrDarePrompts));
  const [reveal, setReveal] = useState<'truth' | 'dare' | null>(null);

  const spin = () => {
    setPrompt(pickRandomItem(soloTruthOrDarePrompts));
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
    <div className="space-y-6 rounded-3xl border border-border bg-background p-8">
      {phase === 'idle' ? (
        <>
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
          <div className="flex gap-3">
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
