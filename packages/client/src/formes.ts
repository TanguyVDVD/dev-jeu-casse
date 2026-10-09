import type { Mot } from '@casse/shared';

export const PAPIER = '#F1E7D3', TRAME = '#DCCFB4', ENCRE = '#1B1714';
export const COULEUR = ['#E2432A', '#2A56C6', '#1E9A68', '#F2B01E'];
export const NOM_FORME = ['rond', 'carré', 'triangle', 'étoile'];

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

const ETOILE: Pt[] = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 0.52 : 1.12, ang = -Math.PI / 2 + (i * Math.PI) / 5;
  return [Math.cos(ang) * r, Math.sin(ang) * r];
});
// une forme par joueur, en plus de la couleur : rond, carré, triangle, étoile
const POLYS: (Pt[] | null)[] = [null, [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]], [[0, -1.1], [1.05, 0.85], [-1.05, 0.85]], ETOILE];

export function tracerForme(c: Ctx, id: number, r: number, x = 0, y = 0): void {
  c.beginPath();
  const poly = POLYS[id];
  if (!poly) c.arc(x, y, r, 0, Math.PI * 2);
  else { poly.forEach(([px, py], i) => (i ? c.lineTo(x + px * r, y + py * r) : c.moveTo(x + px * r, y + py * r))); c.closePath(); }
}

/** La même forme pour le DOM (scores, salon, fil d'événements). */
export function svgForme(id: number): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-1.3 -1.3 2.6 2.6');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', NOM_FORME[id]);
  const poly = POLYS[id];
  const el = document.createElementNS(NS, poly ? 'polygon' : 'circle');
  if (poly) el.setAttribute('points', poly.map((p) => p.join(',')).join(' '));
  else el.setAttribute('r', '1');
  el.setAttribute('fill', COULEUR[id]);
  el.setAttribute('stroke', ENCRE);
  el.setAttribute('stroke-width', '.16');
  svg.append(el);
  return svg;
}

const poly = (c: Ctx, pts: Pt[]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
const disque = (c: Ctx, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
const FLECHE: Pt[] = [[0, -0.5], [0.42, -0.02], [0.16, -0.02], [0.16, 0.5], [-0.16, 0.5], [-0.16, -0.02], [-0.42, -0.02]];
const joueur = (id: number) => (c: Ctx) => { tracerForme(c, id, 0.4); c.fill(); };

/**
 * Une icône par mot, dessinée dans un carré [-0.5, 0.5]. `fond` sert aux évidements.
 * Un mot sans icône retombe sur un simple point : ajouter un mot ne casse rien.
 */
export const ICONES: Partial<Record<Mot, (c: Ctx, fond: string) => void>> = {
  ROUGE: joueur(0), BLEU: joueur(1), VERT: joueur(2), JAUNE: joueur(3),
  TOUS: (c) => { disque(c, -0.24, 0.2, 0.22); c.fillRect(0.04, 0, 0.42, 0.42); poly(c, [[0, -0.5], [0.28, -0.04], [-0.28, -0.04]]); },
  LEADER: (c) => { poly(c, FLECHE); c.fillRect(-0.42, -0.5, 0.84, 0.1); },
  DERNIER: (c) => { poly(c, FLECHE.map(([x, y]) => [x, -y])); c.fillRect(-0.42, 0.4, 0.84, 0.1); },
  LAVE: (c) => { c.beginPath(); c.moveTo(0, -0.5); c.bezierCurveTo(0.55, 0, 0.42, 0.5, 0, 0.5); c.bezierCurveTo(-0.42, 0.5, -0.55, 0, 0, -0.5); c.fill(); },
  MUR: (c) => { for (const [x, y, l] of [[-0.5, -0.45, 0.46], [0.02, -0.45, 0.48], [-0.5, -0.13, 0.2], [-0.24, -0.13, 0.48], [0.3, -0.13, 0.2], [-0.5, 0.19, 0.46], [0.02, 0.19, 0.48]]) c.fillRect(x, y, l, 0.26); },
  CAISSE: (c) => { c.strokeRect(-0.4, -0.4, 0.8, 0.8); c.beginPath(); c.moveTo(-0.4, -0.4); c.lineTo(0.4, 0.4); c.moveTo(0.4, -0.4); c.lineTo(-0.4, 0.4); c.stroke(); },
  COURONNE: (c) => poly(c, [[-0.5, 0.4], [-0.5, -0.32], [-0.25, 0.02], [0, -0.48], [0.25, 0.02], [0.5, -0.32], [0.5, 0.4]]),
  MORT: (c, fond) => {
    disque(c, 0, -0.1, 0.42); c.fillRect(-0.24, 0.16, 0.48, 0.32);
    const encre = c.fillStyle; c.fillStyle = fond;
    disque(c, -0.17, -0.1, 0.12); disque(c, 0.17, -0.1, 0.12); c.fillRect(-0.03, 0.26, 0.06, 0.22);
    c.fillStyle = encre;
  },
  POINTS: (c, fond) => {
    disque(c, 0, 0, 0.46);
    const encre = c.fillStyle; c.fillStyle = fond;
    c.fillRect(-0.07, -0.28, 0.14, 0.56); c.fillRect(-0.28, -0.07, 0.56, 0.14);
    c.fillStyle = encre;
  },
  RAPIDE: (c) => { for (const d of [-0.36, 0.06]) poly(c, [[d, -0.42], [d + 0.2, -0.42], [d + 0.46, 0], [d + 0.2, 0.42], [d, 0.42], [d + 0.26, 0]]); },
  LENT: (c) => { poly(c, [[-0.36, -0.48], [0.36, -0.48], [0, 0]]); poly(c, [[-0.36, 0.48], [0.36, 0.48], [0, 0]]); },
  GEANT: (c) => { c.strokeRect(-0.42, -0.42, 0.84, 0.84); c.fillRect(-0.42, 0.14, 0.28, 0.28); poly(c, [[0.3, -0.3], [0.3, 0.02], [-0.02, -0.3]]); },
  GLISSANT: (c) => { for (const y of [-0.28, 0, 0.28]) { c.beginPath(); c.moveTo(-0.44, y + 0.1); c.quadraticCurveTo(-0.1, y - 0.22, 0.44, y - 0.04); c.stroke(); } },
  INVISIBLE: (c) => { c.save(); c.setLineDash([0.14, 0.1]); c.beginPath(); c.arc(0, 0, 0.4, 0, Math.PI * 2); c.stroke(); c.restore(); },
  // deux flèches qui se croisent
  INVERSE: (c) => { poly(c, [[-0.5, -0.2], [-0.16, -0.5], [-0.16, -0.3], [0.5, -0.3], [0.5, -0.1], [-0.16, -0.1], [-0.16, 0.1]]); poly(c, [[0.5, 0.2], [0.16, 0.5], [0.16, 0.3], [-0.5, 0.3], [-0.5, 0.1], [0.16, 0.1], [0.16, -0.1]]); },
  // deux pièces
  DOUBLE: (c, fond) => { disque(c, -0.14, 0.06, 0.34); const encre = c.fillStyle; c.fillStyle = fond; disque(c, 0.16, -0.06, 0.4); c.fillStyle = encre; disque(c, 0.16, -0.06, 0.32); },
  // un loup de cambrioleur
  VOLEUR: (c, fond) => {
    poly(c, [[-0.5, -0.22], [0.5, -0.22], [0.42, 0.2], [0.1, 0.28], [0, 0.12], [-0.1, 0.28], [-0.42, 0.2]]);
    const encre = c.fillStyle; c.fillStyle = fond; disque(c, -0.22, 0, 0.11); disque(c, 0.22, 0, 0.11); c.fillStyle = encre;
  },
};

export function icone(c: Ctx, mot: Mot, x: number, y: number, taille: number, encre: string, fond: string): void {
  c.save();
  c.translate(x, y); c.scale(taille, taille);
  c.fillStyle = c.strokeStyle = encre; c.lineWidth = 0.11; c.lineJoin = 'round';
  (ICONES[mot] ?? ((k) => disque(k, 0, 0, 0.2)))(c, fond);
  c.restore();
}
