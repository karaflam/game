import { useEffect, useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

type PlayerWheelProps = {
  players: string[];
  landedOn: string;
  spinning: boolean;
  onSpinComplete: () => void;
};

const SPIN_DURATION_S = 2.8;
const MIN_FULL_TURNS = 5;
const LIGHT_COUNT = 24;
const WEDGE_COLORS = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-secondary)', 'var(--color-muted)'];

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 104;

function polarToCartesian(angleDeg: number, radius: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angleRad), y: CENTER + radius * Math.sin(angleRad) };
}

function describeWedge(startAngle: number, endAngle: number) {
  const start = polarToCartesian(endAngle, RADIUS);
  const end = polarToCartesian(startAngle, RADIUS);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

export function PlayerWheel({ players, landedOn, spinning, onSpinComplete }: PlayerWheelProps) {
  const uid = useId();
  const rimGradientId = `wheel-rim-${uid}`;
  const hubGradientId = `wheel-hub-${uid}`;
  const [rotation, setRotation] = useState(0);
  const [spinSeed, setSpinSeed] = useState(0);

  const wedgeAngle = players.length > 0 ? 360 / players.length : 0;

  const targetRotation = useMemo(() => {
    const targetIndex = Math.max(0, players.indexOf(landedOn));
    const wedgeCenter = targetIndex * wedgeAngle + wedgeAngle / 2;
    // Small deterministic-ish jitter within the wedge so it doesn't always stop dead-center,
    // without ever landing close enough to a divider to look ambiguous.
    const jitter = (((spinSeed * 9301 + 49297) % 233280) / 233280 - 0.5) * wedgeAngle * 0.5;
    const base = rotation - (rotation % 360);
    return base + MIN_FULL_TURNS * 360 + (360 - wedgeCenter) + jitter;
  }, [players, landedOn, wedgeAngle, spinSeed, rotation]);

  useEffect(() => {
    if (!spinning) {
      return;
    }
    setSpinSeed(seed => seed + 1);
    setRotation(targetRotation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  useEffect(() => {
    if (!spinning) {
      return;
    }
    const timer = setTimeout(onSpinComplete, SPIN_DURATION_S * 1000);
    return () => clearTimeout(timer);
  }, [spinning, onSpinComplete]);

  if (players.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-center rounded-2xl bg-muted py-8">
      <div className="relative" style={{ width: SIZE, maxWidth: '100%', aspectRatio: '1 / 1' }}>
        {/* Pointer, fixed — the wheel spins underneath it */}
        <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
          <div
            className="h-0 w-0 border-x-[11px] border-t-[18px] border-x-transparent drop-shadow-md"
            style={{ borderTopColor: 'var(--color-accent)' }}
          />
          <div className="mx-auto -mt-1 h-3 w-3 rounded-full border-2 border-card shadow-md" style={{ background: 'var(--color-accent)' }} />
        </div>

        {/* Light-bulb ring, fixed */}
        <svg width="100%" height="100%" className="absolute inset-0" viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {Array.from({ length: LIGHT_COUNT }).map((_, index) => {
            const angle = (360 / LIGHT_COUNT) * index;
            const { x, y } = polarToCartesian(angle, RADIUS + 12);
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r={2.6}
                fill={index % 2 === 0 ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
                className={spinning ? 'animate-pulse' : ''}
                opacity={0.8}
              />
            );
          })}
        </svg>

        {/* Rim */}
        <svg width="100%" height="100%" className="absolute inset-0" viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <defs>
            <radialGradient id={rimGradientId} cx="50%" cy="50%" r="50%">
              <stop offset="85%" stopColor="var(--color-card)" />
              <stop offset="92%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-accent)" />
            </radialGradient>
            <radialGradient id={hubGradientId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--color-card)" />
              <stop offset="100%" stopColor="var(--color-muted)" />
            </radialGradient>
          </defs>
          <circle cx={CENTER} cy={CENTER} r={RADIUS + 8} fill={`url(#${rimGradientId})`} />
        </svg>

        {/* Spinning wedges */}
        <motion.svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute inset-0"
          animate={{ rotate: rotation }}
          initial={false}
          transition={{ duration: SPIN_DURATION_S, ease: [0.1, 0.7, 0.2, 1] }}
          style={{ transformOrigin: '50% 50%' }}
        >
          {players.map((player, index) => {
            const startAngle = index * wedgeAngle;
            const endAngle = startAngle + wedgeAngle;
            const labelAngle = startAngle + wedgeAngle / 2;
            const labelPos = polarToCartesian(labelAngle, RADIUS * 0.62);
            return (
              <g key={`${player}-${index}`}>
                <path
                  d={describeWedge(startAngle, endAngle)}
                  fill={WEDGE_COLORS[index % WEDGE_COLORS.length]}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  transform={`rotate(${labelAngle}, ${labelPos.x}, ${labelPos.y})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill="#ffffff"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={2.5}
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none' }}
                >
                  {player.length > 12 ? `${player.slice(0, 11)}…` : player}
                </text>
              </g>
            );
          })}
          <circle cx={CENTER} cy={CENTER} r={16} fill={`url(#${hubGradientId})`} stroke="var(--color-border)" strokeWidth={1.5} />
        </motion.svg>
      </div>
    </div>
  );
}
