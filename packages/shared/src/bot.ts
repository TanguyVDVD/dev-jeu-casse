import { armees, contacts, hauteur, largeur, objetEn, type Entree, type Monde } from './monde';
import type { Objet } from './vocab';

export interface MemoireBot { bx: number; by: number; px: number; py: number; jusqua: number; seq: number }
export const memoireBot = (): MemoireBot => ({ bx: 0, by: 0, px: 0, py: 0, jusqua: 0, seq: 0 });

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Bot volontairement simple : va vers ce qui rapporte, sinon pousse un bloc au hasard, dashe au contact. */
export function penser(w: Monde, id: number, mem: MemoireBot): Entree {
  const p = w.joueurs.find((j) => j.id === id);
  const entree: Entree = { seq: ++mem.seq, mx: 0, my: 0, dash: false, agrippe: false };
  if (!p || w.phase === 'decompte' || w.phase === 'fin') return entree;
  const mortels = (Object.keys(w.tagsObjet) as Objet[]).filter((o) => w.tagsObjet[o].includes('MORT'));

  const mortelEn = (x: number, y: number) => { const o = objetEn(w, x, y); return !!o && mortels.includes(o); };

  // le compteur de pas repart de zéro à chaque manche : une échéance trop lointaine est périmée
  if (w.tick >= mem.jusqua || mem.jusqua > w.tick + 120) {
    mem.jusqua = w.tick + 30 + Math.floor(Math.random() * 60);
    mem.px = mem.py = 0;
    const payants = (Object.keys(w.tagsObjet) as Objet[]).filter((o) => w.tagsObjet[o].includes('POINTS'));
    let mieux = Infinity;
    if (payants.length && !p.mort && Math.random() < 0.75)
      for (let y = 0; y < hauteur(w); y++)
        for (let x = 0; x < largeur(w); x++) {
          const o = objetEn(w, x, y);
          const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
          // inutile de viser un trésor mortel ou cerné par ce qui tue
          if (mortelEn(x, y) || DIRS.every(([ax, ay]) => mortelEn(x + ax, y + ay))) continue;
          if (o && payants.includes(o) && d < mieux) { mieux = d; mem.bx = x + 0.5; mem.by = y + 0.5; }
        }
    if (mieux === Infinity) {
      // si quelque chose tue, une fois sur deux on va déranger un bloc MORT
      const tous = w.blocs.filter((b) => b.mot && !b.verrou);
      const tueurs = tous.filter((b) => b.mot === 'MORT');
      const libres = tueurs.length && w.regles.some((r) => r.prop === 'MORT') && Math.random() < 0.5 ? tueurs : tous;
      const b = libres[Math.floor(Math.random() * libres.length)];
      const [dx, dy] = DIRS[Math.floor(Math.random() * 4)];
      if (b) { mem.bx = b.x + 0.5 - dx * 0.95; mem.by = b.y + 0.5 - dy * 0.95; mem.px = dx; mem.py = dy; }
    }
  }

  let dx = mem.bx - p.x, dy = mem.by - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.3 && (mem.px || mem.py)) { dx = mem.px; dy = mem.py; mem.bx += mem.px; mem.by += mem.py; }
  else if (d > 0.15) { dx /= d; dy /= d; }
  else dx = dy = 0;

  // évite ce qui tue : si le prochain pas brûle, on contourne
  if (!p.mort && mortels.length && contacts(w, { ...p, x: p.x + dx * 0.6, y: p.y + dy * 0.6 }).some((o) => mortels.includes(o))) [dx, dy] = [-dy, dx];

  const proie = w.joueurs.find((q) => q !== p && !q.mort && !p.mort && Math.hypot(q.x - p.x, q.y - p.y) < 1.6);
  if (proie && p.dashCd === 0 && !armees(proie).includes('SOLIDE') && Math.random() < 0.15) {
    const n = Math.hypot(proie.x - p.x, proie.y - p.y) || 1;
    dx = (proie.x - p.x) / n; dy = (proie.y - p.y) / n;
    entree.dash = true;
  }
  entree.mx = Math.max(-1, Math.min(1, dx));
  entree.my = Math.max(-1, Math.min(1, dy));
  return entree;
}
