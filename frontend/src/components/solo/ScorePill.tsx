import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ScorePillProps = {
  player: number;
  machine: number;
  targetScore: number;
  onReset: () => void;
  playerLabel?: string;
  machineLabel?: string;
};

type RaceBarProps = {
  label: string;
  value: number;
  targetScore: number;
  colorClassName: string;
};

function RaceBar({ label, value, targetScore, colorClassName }: RaceBarProps) {
  const percent = Math.min(100, (value / targetScore) * 100);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-foreground">
        <span>{label}</span>
        <span>
          {value} / {targetScore}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colorClassName}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function ScorePill({ player, machine, targetScore, onReset, playerLabel = 'Vous', machineLabel = 'IA' }: ScorePillProps) {
  return (
    <div className="rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground">
      <div className="mb-3 flex items-center justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          Réinitialiser
        </Button>
      </div>
      <div className="space-y-3">
        <RaceBar label={playerLabel} value={player} targetScore={targetScore} colorClassName="bg-primary" />
        <RaceBar label={machineLabel} value={machine} targetScore={targetScore} colorClassName="bg-muted-foreground" />
      </div>
    </div>
  );
}
