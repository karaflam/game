import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ScorePillProps = {
  player: number;
  machine: number;
  targetScore: number;
  onReset: () => void;
};

export function ScorePill({ player, machine, targetScore, onReset }: ScorePillProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
      <div className="flex items-center gap-2 font-semibold">
        <span>Vous {player}</span>
        <span className="text-muted-foreground">—</span>
        <span>IA {machine}</span>
        <span className="text-xs font-normal text-muted-foreground">(premier à {targetScore})</span>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
        <RotateCcw className="h-4 w-4" />
        Réinitialiser
      </Button>
    </div>
  );
}
