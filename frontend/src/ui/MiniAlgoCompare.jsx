import React, { useEffect, useRef } from 'react';
import { ALGO } from '../engine/constants.js';

const CELL = 4;

function MiniMap({ store, leg, algo, active, onPick }) {
  const ref = useRef(null);
  const A = ALGO[algo];
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { w, h, cost } = store.grid;
    c.width = w * CELL; c.height = h * CELL;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#E9EDF2'; ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = cost[y].charCodeAt(x) - 48;
      if (v === 0) { ctx.fillStyle = '#5C6B8A'; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
      else if (v > 1) { ctx.fillStyle = 'rgba(80,150,220,.35)'; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
    }
    if (leg) {
      ctx.fillStyle = A.soft + '.55)';
      for (const idx of leg.explored) ctx.fillRect((idx % w) * CELL, ((idx / w) | 0) * CELL, CELL, CELL);
      ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
      leg.path.forEach(([x, y], i) => (i ? ctx.lineTo(x * CELL + CELL / 2, y * CELL + CELL / 2) : ctx.moveTo(x * CELL + CELL / 2, y * CELL + CELL / 2)));
      ctx.stroke();
      ctx.strokeStyle = A.color; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }, [store, leg, algo]);
  return (
    <button className={'mini-map' + (active ? ' active' : '')} onClick={() => onPick(algo)} style={{ '--c': A.color }}>
      <canvas ref={ref} />
      <div className="mm-label">
        <b style={{ color: A.color }}>{A.name}</b>
        {leg ? <span>فحص <b>{leg.expanded}</b> · خطوات <b>{leg.steps}</b> · تكلفة <b>{leg.cost}</b></span> : <span>—</span>}
      </div>
    </button>
  );
}

// Shows, for the CURRENT leg of the trip, what each path-finding algorithm explored.
export default function MiniAlgoCompare({ store, legInfo, algo, onPick }) {
  if (!legInfo) return null;
  return (
    <div className="mini-compare">
      <div className="mc-title">نفس الرحلة (الخطوة {legInfo.index + 1}/{legInfo.total}) — اضغط على خوارزمية لتبديلها</div>
      <div className="mc-row">
        {['bfs', 'dijkstra', 'astar'].map((a) => <MiniMap key={a} store={store} leg={legInfo.legs[a]} algo={a} active={algo === a} onPick={onPick} />)}
      </div>
    </div>
  );
}
