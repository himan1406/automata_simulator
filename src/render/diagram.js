import { esc } from '../util.js';
import { edges } from '../core/parse.js';

/** Circular-layout SVG state diagram. */
export function diagramSVG(M, active = []) {
  const n = M.states.length;
  if (!n) return '<p class="hint">Add a start state and some transitions.</p>';
  const R = 24, rad = n === 1 ? 0 : Math.max(90, n * 34);
  const W = 2 * rad + 240, H = 2 * rad + 190, cx = W / 2, cy = H / 2 + 8, P = {};
  M.states.forEach((s, i) => {
    const a = -Math.PI / 2 + 2 * Math.PI * i / n;
    P[s] = { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a), a };
  });
  const E = edges(M), has = new Set(E.map(e => e.f + '|' + e.t));
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:560px" role="img" aria-label="State diagram"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="fi"/></marker></defs>`;

  E.forEach(e => {
    const A = P[e.f], B = P[e.t], lab = esc(e.l.join(', '));
    if (e.f === e.t) { // self-loop, pointing away from the circle's centre
      const d = { x: Math.cos(A.a), y: Math.sin(A.a) }, p = { x: -d.y, y: d.x };
      const rot = k => ({ x: d.x * Math.cos(k) - d.y * Math.sin(k), y: d.x * Math.sin(k) + d.y * Math.cos(k) });
      const a1 = rot(-.6), a2 = rot(.6), K = R * 3.4, w = R * 1.3;
      s += `<path class="ed" marker-end="url(#ah)" d="M${A.x + a1.x * R} ${A.y + a1.y * R}C${A.x + d.x * K - p.x * w} ${A.y + d.y * K - p.y * w} ${A.x + d.x * K + p.x * w} ${A.y + d.y * K + p.y * w} ${A.x + a2.x * (R + 3)} ${A.y + a2.y * (R + 3)}"/><text class="lb" x="${A.x + d.x * R * 3.1}" y="${A.y + d.y * R * 3.1}">${lab}</text>`;
      return;
    }
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y;
    const L = Math.hypot(dx, dy) || 1, off = has.has(e.t + '|' + e.f) ? 30 : 12;
    const c = { x: mx - dy / L * off, y: my + dx / L * off };
    const toward = (P1, Q, r) => { const v = Math.hypot(Q.x - P1.x, Q.y - P1.y) || 1; return { x: P1.x + (Q.x - P1.x) / v * r, y: P1.y + (Q.y - P1.y) / v * r }; };
    const s1 = toward(A, c, R), s2 = toward(B, c, R + 3);
    const q = { x: .25 * A.x + .5 * c.x + .25 * B.x, y: .25 * A.y + .5 * c.y + .25 * B.y };
    const lp = toward(q, { x: q.x - dy / L, y: q.y + dx / L }, 12);
    s += `<path class="ed" marker-end="url(#ah)" d="M${s1.x} ${s1.y}Q${c.x} ${c.y} ${s2.x} ${s2.y}"/><text class="lb" x="${lp.x}" y="${lp.y + 4}">${lab}</text>`;
  });

  M.states.forEach(k => {
    const p = P[k], moore = M.type === 'moore';
    if (k === M.start) {
      const t = { x: -Math.sin(p.a), y: Math.cos(p.a) };
      s += `<path class="ed" marker-end="url(#ah)" d="M${p.x + t.x * (R + 38)} ${p.y + t.y * (R + 38)}L${p.x + t.x * (R + 3)} ${p.y + t.y * (R + 3)}"/>`;
    }
    s += `<circle class="nd${active.includes(k) ? ' on' : ''}" cx="${p.x}" cy="${p.y}" r="${R}"/>`;
    if (M.acc.includes(k)) s += `<circle class="nd in" cx="${p.x}" cy="${p.y}" r="${R - 5}"/>`;
    s += `<text class="nm" x="${p.x}" y="${p.y + (moore ? -3 : 4)}">${esc(k)}</text>`;
    if (moore) s += `<text class="ou" x="${p.x}" y="${p.y + 13}">${esc(M.out[k] ?? '–')}</text>`;
  });
  return s + '</svg>';
}
