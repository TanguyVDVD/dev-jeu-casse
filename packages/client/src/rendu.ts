import {
  CONFIG, COULEURS, a, armees, demi, estProp, estSujet, hauteur, largeur, libelle, ticks, tuileEn,
  type Bloc, type Joueur, type Monde, type Mot, type Objet, type Prop,
} from '@casse/shared';
import { COULEUR, ENCRE, PAPIER, TRAME, icone, tracerForme } from './formes';

type Ctx = CanvasRenderingContext2D;

export interface Vue {
  w: Monde;
  moi: number;
  pseudos: string[];
  /** positions d'affichage (interpolées / prédites) par couleur */
  pos: Map<number, { x: number; y: number }>;
}

// --- effets : particules, empreintes, bulles, secousse, micro-arrêt ---------

interface Particule { x: number; y: number; vx: number; vy: number; vie: number; r: number; coul: string }
interface Empreinte { x: number; y: number; vie: number; id: number }
interface Flottant { x: number; y: number; texte: string; vie: number; coul: string }

const particules: Particule[] = [];
const empreintes: Empreinte[] = [];
const flottants: Flottant[] = [];
const bulles = new Map<number, { texte: string; vie: number }>();
const blocsVus = new Map<number, { x: number; y: number; pop: number }>();
const dernierePas = new Map<number, number>();
let secousse = 0;
let gel = 0;
let horloge = 0;

export function eclat(x: number, y: number, coul: string, n = 10, force = 4): void {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2, v = force * (0.3 + Math.random());
    particules.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vie: 0.35 + Math.random() * 0.3, r: 0.04 + Math.random() * 0.09, coul });
  }
}
export const secouer = (force: number) => { secousse = Math.max(secousse, force); };
/** Micro-arrêt : l'image se fige quelques millisecondes sur un impact. */
export const geler = (ms: number) => { gel = Math.max(gel, ms / 1000); };
export const bulle = (id: number, texte: string) => { bulles.set(id, { texte, vie: 1.6 }); };
export const flotter = (x: number, y: number, texte: string, coul: string) => { flottants.push({ x, y, texte, vie: 1, coul }); };
export function viderEffets(): void {
  particules.length = empreintes.length = flottants.length = 0;
  bulles.clear(); blocsVus.clear();
}

// --- texte : les mots sont les vedettes --------------------------------------

const largeurs = new Map<string, number>();
/** Mot en Anton, ajusté à `lmax` cases de large, étiré en hauteur s'il a dû rétrécir. */
function mot(c: Ctx, texte: string, x: number, y: number, lmax: number, hauteurCase: number, coul: string): void {
  c.save();
  c.translate(x, y);
  c.scale(0.01, 0.01); // on écrit à l'échelle 100 px = 1 case : pas de police sous 1 px
  c.font = '100px Anton, Impact, sans-serif';
  let l = largeurs.get(texte);
  if (!l) { l = c.measureText(texte).width; if (document.fonts.check('100px Anton')) largeurs.set(texte, l); }
  const corps = Math.min(hauteurCase * 100, (lmax * 100 * 100) / l);
  c.scale(corps / 100, (corps / 100) * Math.min(1.7, (hauteurCase * 100) / corps));
  c.fillStyle = coul; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(texte, 0, 6);
  c.restore();
}

// --- décor -------------------------------------------------------------------

const GRAINS = Array.from({ length: 220 }, (_, i) => [((i * 7919) % 1000) / 1000, ((i * 104729) % 997) / 997, 0.015 + ((i * 31) % 5) * 0.006]);

function fond(c: Ctx, L: number, H: number): void {
  c.fillStyle = PAPIER;
  c.fillRect(-1, -1, L + 2, H + 2);
  c.fillStyle = TRAME;
  for (const [gx, gy, r] of GRAINS) { c.beginPath(); c.arc(gx * L, gy * H, r, 0, 7); c.fill(); }
  // repères de coupe à chaque intersection
  c.strokeStyle = TRAME; c.lineWidth = 0.03;
  c.beginPath();
  for (let y = 1; y < H; y++) for (let x = 1; x < L; x++) { c.moveTo(x - 0.1, y); c.lineTo(x + 0.1, y); c.moveTo(x, y - 0.1); c.lineTo(x, y + 0.1); }
  c.stroke();
}

const hachures = (c: Ctx, x: number, y: number, coul: string, n: number, ep: number) => {
  c.save(); c.beginPath(); c.rect(x, y, 1, 1); c.clip();
  c.strokeStyle = coul; c.lineWidth = ep; c.beginPath();
  for (let i = -n; i <= n; i++) { c.moveTo(x + i / n, y + 1); c.lineTo(x + i / n + 1, y); }
  c.stroke(); c.restore();
};

const DESSIN_TUILE: Record<Exclude<Objet, 'CAISSE'>, (c: Ctx, x: number, y: number, tags: Prop[], t: number) => void> = {
  LAVE: (c, x, y, tags, t) => {
    // trame de points qui ondule ; mortelle = aplat plein, points en réserve
    const plein = tags.includes('MORT');
    if (plein) { c.fillStyle = COULEUR[0]; c.fillRect(x, y, 1, 1); }
    c.fillStyle = plein ? PAPIER : COULEUR[0];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const r = (plein ? 0.045 : 0.075) + 0.035 * Math.sin(t * 2.2 + (x * 4 + i) * 0.6 + (y * 4 + j) * 0.8);
      c.beginPath(); c.arc(x + 0.125 + i * 0.25, y + 0.125 + j * 0.25, r, 0, 7); c.fill();
    }
  },
  MUR: (c, x, y, tags) => {
    if (a(tags, 'solide')) { c.fillStyle = ENCRE; c.fillRect(x, y, 1, 1); hachures(c, x, y, PAPIER, 4, 0.035); }
    else { hachures(c, x, y, ENCRE, 4, 0.03); c.strokeStyle = ENCRE; c.lineWidth = 0.03; c.setLineDash([0.1, 0.08]); c.strokeRect(x + 0.02, y + 0.02, 0.96, 0.96); c.setLineDash([]); }
  },
  COURONNE: (c, x, y, tags, t) => {
    if (tags.includes('POINTS')) { // rayons qui tournent : ça rapporte
      c.save(); c.translate(x + 0.5, y + 0.5); c.rotate(t * 0.8); c.fillStyle = COULEUR[3];
      for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(0, 0); c.lineTo(-0.1, -0.66); c.lineTo(0.1, -0.66); c.fill(); }
      c.restore();
    }
    c.fillStyle = PAPIER; c.strokeStyle = ENCRE; c.lineWidth = 0.05;
    c.beginPath(); c.arc(x + 0.5, y + 0.5, 0.4, 0, 7); c.fill(); c.stroke();
    icone(c, 'COURONNE', x + 0.53, y + 0.53, 0.5, ENCRE, PAPIER);
    icone(c, 'COURONNE', x + 0.5, y + 0.5, 0.5, COULEUR[3], PAPIER);
  },
};

/** Les propriétés d'un objet se lisent sur lui : cadre épais si solide, halo si géant, icônes sinon. */
function marques(c: Ctx, x: number, y: number, tags: Prop[], dense: boolean, enCoin = false): void {
  if (a(tags, 'solide')) { c.strokeStyle = ENCRE; c.lineWidth = 0.07; c.strokeRect(x + 0.035, y + 0.035, 0.93, 0.93); }
  const visibles = tags.filter((t) => t !== 'SOLIDE' && t !== 'GEANT' && t !== 'INVISIBLE');
  if (!visibles.length || (dense && (x + y) % 2)) return;
  visibles.slice(0, 4).forEach((t, i) => {
    const n = Math.min(visibles.length, 4);
    const cx = x + 0.5 + (n > 1 ? (i % 2 ? 0.22 : -0.22) : 0), cy = y + 0.5 + (n > 2 ? (i < 2 ? -0.22 : 0.22) : 0);
    const taille = enCoin ? 0.26 : n > 1 ? 0.34 : 0.5;
    // sur un objet qui a déjà son dessin (la couronne), les marques se rangent sur le bord haut
    if (enCoin) { c.fillStyle = PAPIER; c.strokeStyle = ENCRE; c.lineWidth = 0.03; c.beginPath(); c.arc(x + 0.86 - i * 0.3, y + 0.14, 0.17, 0, 7); c.fill(); c.stroke(); icone(c, t, x + 0.86 - i * 0.3, y + 0.14, taille, ENCRE, PAPIER); return; }
    c.fillStyle = PAPIER; c.beginPath(); c.arc(cx, cy, taille * 0.72, 0, 7); c.fill();
    icone(c, t, cx, cy, taille, ENCRE, PAPIER);
  });
}

function halo(c: Ctx, x: number, y: number): void {
  const g = CONFIG.props.geantObjet;
  c.strokeStyle = ENCRE; c.lineWidth = 0.035; c.setLineDash([0.12, 0.1]);
  c.strokeRect(x - g, y - g, 1 + 2 * g, 1 + 2 * g);
  c.setLineDash([]);
}

// --- blocs -------------------------------------------------------------------

/** Les cases qui font partie d'une phrase active, et les bandes qui les relient. */
function phrases(blocs: Bloc[]): { actifs: Set<number>; bandes: [number, number, number, number][] } {
  const grille = new Map(blocs.map((b) => [`${b.x},${b.y}`, b]));
  const actifs = new Set<number>(), bandes: [number, number, number, number][] = [];
  for (const b of blocs) {
    if (b.mot !== 'EST') continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const s = grille.get(`${b.x - dx},${b.y - dy}`), p = grille.get(`${b.x + dx},${b.y + dy}`);
      if (!s || !p || !estSujet(s.mot) || !estProp(p.mot)) continue;
      [s, b, p].forEach((k) => actifs.add(k.id));
      bandes.push([s.x, s.y, dx ? 3 : 1, dy ? 3 : 1]);
    }
  }
  return { actifs, bandes };
}

function caisse(c: Ctx, x: number, y: number, solide: boolean): void {
  if (solide) { c.fillStyle = ENCRE; c.fillRect(x + 0.14, y + 0.14, 0.8, 0.8); }
  c.fillStyle = TRAME; c.strokeStyle = ENCRE; c.lineWidth = solide ? 0.07 : 0.035;
  c.fillRect(x + 0.1, y + 0.1, 0.8, 0.8); c.strokeRect(x + 0.1, y + 0.1, 0.8, 0.8);
  c.lineWidth = 0.035; c.beginPath();
  c.moveTo(x + 0.1, y + 0.1); c.lineTo(x + 0.9, y + 0.9); c.moveTo(x + 0.9, y + 0.1); c.lineTo(x + 0.1, y + 0.9);
  c.stroke();
}

function caractere(c: Ctx, m: Mot, x: number, y: number, actif: boolean, verrou: boolean, echelle: number): void {
  const est = m === 'EST', sujet = estSujet(m);
  const joueur = COULEURS.indexOf(m as (typeof COULEURS)[number]);
  const papier = joueur >= 0 ? COULEUR[joueur] : sujet ? ENCRE : PAPIER;
  const encre = joueur === 3 ? ENCRE : sujet ? PAPIER : ENCRE;
  c.save();
  c.translate(x + 0.5, y + 0.5);
  c.scale(echelle, echelle);
  const d = est ? 0.36 : 0.44;
  if (!actif) { c.fillStyle = 'rgb(27 23 20 / .3)'; c.fillRect(-d + 0.06, -d + 0.06, d * 2, d * 2); } // ombre dure, pas de flou
  c.fillStyle = papier; c.fillRect(-d, -d, d * 2, d * 2);
  c.strokeStyle = ENCRE; c.lineWidth = sujet ? 0.03 : 0.06; c.strokeRect(-d, -d, d * 2, d * 2);
  if (est) { c.lineWidth = 0.02; c.strokeRect(-d + 0.06, -d + 0.06, d * 2 - 0.12, d * 2 - 0.12); }
  if (!sujet && !est) { c.fillStyle = ENCRE; c.beginPath(); c.moveTo(d - 0.2, -d); c.lineTo(d, -d); c.lineTo(d, -d + 0.2); c.fill(); } // coin corné
  icone(c, m, 0, est ? -0.16 : -0.21, est ? 0.18 : 0.26, encre, papier);
  mot(c, libelle(m), 0, est ? 0.14 : 0.17, est ? 0.56 : 0.8, est ? 0.3 : 0.42, encre);
  if (verrou) { c.fillStyle = encre; for (const [rx, ry] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.arc(rx * (d - 0.08), ry * (d - 0.08), 0.035, 0, 7); c.fill(); } }
  c.restore();
}

// --- joueurs -----------------------------------------------------------------

function tampon(c: Ctx, p: Joueur, x: number, y: number, v: Vue, t: number): void {
  const moi = p.id === v.moi, tags = armees(p);
  if (a(tags, 'invisible') && !moi) return;
  const r = demi(p) * 1.12, coul = COULEUR[p.id];
  c.save();
  c.translate(x, y + (p.mort ? Math.sin(t * 3 + p.id) * 0.06 : 0));
  c.save();
  if (p.etourdi > 0) c.rotate(Math.sin(t * 40) * 0.25);
  if (a(tags, 'invisible') || (p.invul > 0 && Math.floor(t * 14) % 2)) c.globalAlpha = 0.35;
  if (p.mort) {
    c.strokeStyle = coul; c.lineWidth = 0.07; c.setLineDash([0.12, 0.1]);
    tracerForme(c, p.id, r); c.stroke(); c.setLineDash([]);
  } else {
    c.strokeStyle = ENCRE; c.lineWidth = 0.07;
    tracerForme(c, p.id, r, 0.07, 0.07); c.stroke(); // le contour hors registre
    tracerForme(c, p.id, r); c.fillStyle = coul; c.fill();
    c.lineWidth = 0.035; c.stroke();
  }
  for (const s of [-1, 1]) { // deux yeux qui regardent où l'on va
    const ex = s * r * 0.3 + p.fx * r * 0.18, ey = p.fy * r * 0.18 - r * 0.05;
    if (p.mort || p.etourdi > 0) {
      c.strokeStyle = p.mort ? coul : ENCRE; c.lineWidth = 0.04; c.beginPath();
      c.moveTo(ex - 0.06, ey - 0.06); c.lineTo(ex + 0.06, ey + 0.06); c.moveTo(ex + 0.06, ey - 0.06); c.lineTo(ex - 0.06, ey + 0.06); c.stroke();
    } else {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, r * 0.24, 0, 7); c.fill();
      c.fillStyle = ENCRE; c.beginPath(); c.arc(ex + p.fx * r * 0.1, ey + p.fy * r * 0.1, r * 0.12, 0, 7); c.fill();
    }
  }
  c.restore();

  if (p.etourdi > 0) { c.fillStyle = COULEUR[3]; for (let i = 0; i < 3; i++) { const an = t * 9 + i * 2.1; tracerForme(c, 3, 0.09, Math.cos(an) * r, -r - 0.12 + Math.sin(an) * 0.08); c.fill(); } }
  if (moi && p.dashCd > 0) { // recharge du dash
    c.strokeStyle = ENCRE; c.lineWidth = 0.05; c.beginPath();
    c.arc(0, 0, r + 0.14, Math.PI * 0.5, Math.PI * 0.5 + Math.PI * 2 * (1 - p.dashCd / ticks(CONFIG.dash.recharge))); c.stroke();
  }
  // étiquettes : en cours d'armement (anneau + mot qui clignote), puis armées (icônes)
  let rang = 0;
  for (const prop of Object.keys(p.tags) as Prop[]) {
    const reste = p.tags[prop]!;
    if (reste > 0) {
      c.strokeStyle = COULEUR[0]; c.lineWidth = 0.09; c.beginPath();
      c.arc(0, 0, r + 0.24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - reste / ticks(CONFIG.regle.armement))); c.stroke();
      if (Math.floor(t * 10) % 2) { c.fillStyle = ENCRE; c.fillRect(-0.62, -r - 0.78, 1.24, 0.42); mot(c, `${libelle(prop)} !`, 0, -r - 0.57, 1.1, 0.34, PAPIER); }
    } else if (!p.mort) {
      const ix = (rang++ - (armees(p).length - 1) / 2) * 0.32;
      c.fillStyle = PAPIER; c.strokeStyle = ENCRE; c.lineWidth = 0.03;
      c.beginPath(); c.arc(ix, -r - 0.24, 0.15, 0, 7); c.fill(); c.stroke();
      icone(c, prop, ix, -r - 0.24, 0.2, ENCRE, PAPIER);
    }
  }
  const b = bulles.get(p.id);
  if (b) {
    c.fillStyle = PAPIER; c.strokeStyle = ENCRE; c.lineWidth = 0.05;
    c.fillRect(-0.85, -r - 1.05, 1.7, 0.5); c.strokeRect(-0.85, -r - 1.05, 1.7, 0.5);
    mot(c, b.texte, 0, -r - 0.8, 1.5, 0.36, ENCRE);
  }
  c.save(); c.scale(0.01, 0.01); c.font = `700 ${moi ? 24 : 20}px "Courier Prime", monospace`; c.textAlign = 'center'; c.textBaseline = 'top';
  c.lineWidth = 6; c.strokeStyle = PAPIER; c.fillStyle = ENCRE;
  const nom = (moi ? '▼ ' : '') + (v.pseudos[p.id] ?? '');
  c.strokeText(nom, 0, (r + 0.1) * 100); c.fillText(nom, 0, (r + 0.1) * 100);
  c.restore();
  c.restore();
}

// --- l'image -----------------------------------------------------------------

export function dessiner(cv: HTMLCanvasElement, v: Vue, dt: number): void {
  const { w } = v;
  const L = largeur(w), H = hauteur(w);
  const cadre = cv.parentElement!;
  const cell = Math.max(16, Math.floor(Math.min((cadre.clientWidth - 24) / L, (cadre.clientHeight - 24) / H)));
  const dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== L * cell * dpr || cv.height !== H * cell * dpr) {
    cv.width = L * cell * dpr; cv.height = H * cell * dpr;
    cv.style.width = `${L * cell}px`; cv.style.height = `${H * cell}px`;
  }
  if (gel > 0) { gel -= dt; return; } // micro-arrêt : on garde l'image précédente
  horloge += dt;
  const t = horloge;
  const c = cv.getContext('2d')!;
  secousse = Math.max(0, secousse - dt * 1.6);
  const k = cell * dpr;
  c.setTransform(k, 0, 0, k, (Math.random() - 0.5) * secousse * k, (Math.random() - 0.5) * secousse * k);
  fond(c, L, H);

  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    const o = tuileEn(w, x, y) as Exclude<Objet, 'CAISSE'> | undefined;
    if (!o) continue;
    const tags = w.tagsObjet[o];
    if (a(tags, 'invisible')) continue;
    if (tags.includes('GEANT')) halo(c, x, y);
    DESSIN_TUILE[o](c, x, y, tags, t);
    marques(c, x, y, tags, o === 'LAVE', o === 'COURONNE');
  }

  for (let i = empreintes.length - 1; i >= 0; i--) {
    const e = empreintes[i];
    if ((e.vie -= dt) <= 0) { empreintes.splice(i, 1); continue; }
    c.globalAlpha = e.vie * 0.22; c.fillStyle = COULEUR[e.id];
    tracerForme(c, e.id, 0.17, e.x, e.y); c.fill();
  }
  c.globalAlpha = 1;

  const { actifs, bandes } = phrases(w.blocs);
  for (const [bx, by, bl, bh] of bandes) { // la phrase active est « encrée » : une bande relie ses trois blocs
    c.fillStyle = COULEUR[0]; c.fillRect(bx + 0.09, by + 0.09, bl, bh);
    c.fillStyle = ENCRE; c.fillRect(bx, by, bl, bh);
  }
  for (const o of w.ombres) {
    const avance = 1 - o.t / ticks(CONFIG.chute.ombre);
    c.save(); c.translate(o.x + 0.5, o.y + 0.5);
    c.fillStyle = 'rgb(27 23 20 / .28)'; c.beginPath(); c.arc(0, 0, 0.12 + 0.36 * avance, 0, 7); c.fill();
    c.strokeStyle = ENCRE; c.lineWidth = 0.04; c.setLineDash([0.1, 0.1]); c.rotate(t * 2);
    c.beginPath(); c.arc(0, 0, 0.48, 0, 7); c.stroke(); c.setLineDash([]);
    c.restore();
    mot(c, libelle(o.mot), o.x + 0.5, o.y + 0.5, 0.8, 0.26, ENCRE);
  }
  const vus = new Set<number>();
  const neuf = blocsVus.size ? 1 : 0; // un bloc apparu en cours de manche vient de tomber : il rebondit
  for (const b of w.blocs) {
    vus.add(b.id);
    let vu = blocsVus.get(b.id);
    if (!vu) blocsVus.set(b.id, (vu = { x: b.x, y: b.y, pop: neuf }));
    const f = 1 - Math.exp(-dt * 26); // glissement d'une case à l'autre
    vu.x += (b.x - vu.x) * f; vu.y += (b.y - vu.y) * f;
    vu.pop = Math.max(0, vu.pop - dt * 5);
    if (b.mot === null) { if (!a(w.tagsObjet.CAISSE, 'invisible')) { if (w.tagsObjet.CAISSE.includes('GEANT')) halo(c, vu.x, vu.y); caisse(c, vu.x, vu.y, a(w.tagsObjet.CAISSE, 'solide')); marques(c, vu.x, vu.y, w.tagsObjet.CAISSE.filter((k) => k !== 'SOLIDE'), false); } }
    else caractere(c, b.mot, vu.x, vu.y, actifs.has(b.id), b.verrou, 1 + vu.pop * 0.5);
  }
  for (const id of blocsVus.keys()) if (!vus.has(id)) blocsVus.delete(id);

  for (const p of w.joueurs) {
    const pos = v.pos.get(p.id) ?? p;
    const tenu = p.tient >= 0 && blocsVus.get(p.tient);
    if (tenu) { c.strokeStyle = ENCRE; c.lineWidth = 0.09; c.beginPath(); c.moveTo(pos.x, pos.y); c.lineTo(tenu.x + 0.5, tenu.y + 0.5); c.stroke(); }
    if (!p.mort && Math.hypot(p.vx, p.vy) > 1 && t - (dernierePas.get(p.id) ?? 0) > 0.12 && !(a(armees(p), 'invisible'))) {
      dernierePas.set(p.id, t);
      empreintes.push({ x: pos.x, y: pos.y, vie: 1, id: p.id });
    }
  }
  // les vivants par-dessus les fantômes
  for (const p of [...w.joueurs].sort((p1, p2) => Number(p2.mort) - Number(p1.mort))) {
    const pos = v.pos.get(p.id) ?? p;
    tampon(c, p, pos.x, pos.y, v, t);
  }

  for (let i = particules.length - 1; i >= 0; i--) {
    const q = particules[i];
    if ((q.vie -= dt) <= 0) { particules.splice(i, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9;
    c.fillStyle = q.coul; c.beginPath(); c.arc(q.x, q.y, q.r * Math.min(1, q.vie * 4), 0, 7); c.fill();
  }
  for (let i = flottants.length - 1; i >= 0; i--) {
    const f = flottants[i];
    if ((f.vie -= dt) <= 0) { flottants.splice(i, 1); continue; }
    mot(c, f.texte, f.x + 0.03, f.y - (1 - f.vie) * 0.8 + 0.03, 2, 0.5, ENCRE);
    mot(c, f.texte, f.x, f.y - (1 - f.vie) * 0.8, 2, 0.5, f.coul);
  }
  for (const [id, b] of bulles) if ((b.vie -= dt) <= 0) bulles.delete(id);
}

