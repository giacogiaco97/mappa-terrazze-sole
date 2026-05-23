import { useId } from 'react';
import { dayFraction, type TimelineResult } from '../lib/sun-timeline.js';
import '../styles/sun-timeline.css';

type Props = {
  result: TimelineResult;
  now: Date;
  reference: Date;
  label?: string;
};

const VIEW_W = 100;
const VIEW_H = 10;

export default function SunTimeline({ result, now, reference, label }: Props) {
  const gradId = useId();
  const nowX = dayFraction(now, reference) * VIEW_W;

  return (
    <div className="sun-timeline">
      <svg
        className="sun-timeline__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1="0" y1="0" x2={VIEW_W} y2="0"
          >
            <stop offset="0" className="sun-timeline__stop-start" />
            <stop offset="1" className="sun-timeline__stop-end" />
          </linearGradient>
        </defs>
        {result.segments.map((s, i) => {
          const x0 = dayFraction(s.from, reference) * VIEW_W;
          const x1 = dayFraction(s.to, reference) * VIEW_W;
          const w = Math.max(0, x1 - x0);
          if (w <= 0) return null;
          return (
            <rect
              key={i}
              x={x0}
              y={0}
              width={w}
              height={VIEW_H}
              fill={s.state === 'sun' ? `url(#${gradId})` : undefined}
              className={`sun-timeline__seg sun-timeline__seg--${s.state}`}
            />
          );
        })}
        <line
          x1={nowX}
          x2={nowX}
          y1={-0.5}
          y2={VIEW_H + 0.5}
          className="sun-timeline__now"
        />
      </svg>
      <div className="sun-timeline__ticks" aria-hidden="true">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>24h</span>
      </div>
    </div>
  );
}
