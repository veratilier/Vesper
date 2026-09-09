'use client';
import { useState } from 'react';
export const desireMetrics = [['longing', '想念'], ['tenderness', '温柔'], ['playfulness', '玩心'], ['intensity', '浓度'], ['attachment', '依恋'], ['possessiveness', '占有欲']] as const;
const positions = [{ angle: -35, x: 66, y: 35 }, { angle: 35, x: 294, y: 35 }, { angle: -90, x: 30, y: 151 }, { angle: 90, x: 330, y: 151 }, { angle: -145, x: 65, y: 267 }, { angle: 145, x: 295, y: 267 }];
export function metricValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null; }
export function DesireFlower({ data }: { data: Record<string, unknown> | null }) {
  const [selected, setSelected] = useState(1);
  const value = metricValue(data?.[desireMetrics[selected][0]]);
  return <div className="desire-flower">
    <svg viewBox="0 0 360 310" role="group" aria-label="六瓣心情花，选择花瓣查看数值">
      <g className="desire-flower-breath">
        {desireMetrics.map(([key, label], index) => {
          const number = metricValue(data?.[key]);
          const position = positions[index];
          return <g key={key} transform={`translate(180 153) rotate(${position.angle})`}>
            <g className={`desire-petal${selected === index ? ' selected' : ''}`} style={{ transform: `scale(${number === null ? .65 : .65 + number * .0035})`, opacity: number === null ? .3 : .65 + number * .0035 }} role="button" tabIndex={0} aria-label={`${label} ${number ?? '尚未读取'}`} aria-pressed={selected === index} onClick={() => setSelected(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(index); } }}>
              <image href="/desire-petal.webp" x="-49" y="-133" width="98" height="140" />
              <path className="desire-petal-focus" d="M0 0 C-54 -53 -40 -96 0 -126 C44 -84 48 -44 0 0Z" />
            </g>
          </g>;
        })}
        <circle cx="180" cy="153" r="8" className="desire-flower-heart" />
      </g>
      {desireMetrics.map(([key, label], index) => <g key={key} className={`desire-petal-label${selected === index ? ' selected' : ''}`} onClick={() => setSelected(index)} aria-hidden="true"><text x={positions[index].x} y={positions[index].y} textAnchor="middle">{label}</text><text x={positions[index].x} y={positions[index].y + 19} textAnchor="middle" className="desire-petal-number">{metricValue(data?.[key]) ?? '—'}</text></g>)}
    </svg>
    <div className="desire-selection" aria-live="polite"><span>{desireMetrics[selected][1]} · {value ?? '—'}</span><small>点花瓣，看看此刻的心情</small></div>
  </div>;
}
