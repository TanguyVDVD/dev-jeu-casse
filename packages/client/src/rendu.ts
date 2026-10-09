import {
  CONFIG, COULEURS, a, demi, emplacement, famille, hauteur, intention, largeur, libelle, phrase, resoudre, ticks, tuileEn,
  type Chose, type Joueur, type Monde, type Mot, type Prop,
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
/** ce qu'on a déjà dessiné (mots, caisses) : position lissée et rebond d'apparition */
const vus = new Map<number, { x: number; y: number; pop: number }>();
const rayons = new Map<number, number>();
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
  bulles.clear(); vus.clear(); rayons.clear();
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

function lave(c: Ctx, x: number, y: number, props: Prop[], t: number): void {
  // trame de points qui ondule ; mortelle = aplat plein, points en réserve
  const plein = props.includes('MORT');
  if (plein) { c.fillStyle = COULEUR[0]; c.fillRect(x, y, 1, 1); }
  c.fillStyle = plein ? PAPIER : COULEUR[0];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const r = (plein ? 0.045 : 0.075) + 0.035 * Math.sin(t * 2.2 + (x * 4 + i) * 0.6 + (y * 4 + j) * 0.8);
    c.beginPath(); c.arc(x + 0.125 + i * 0.25, y + 0.125 + j * 0.25, r, 0, 7); c.fill();
  }
}

function caisse(c: Ctx, x: number, y: number): void {
  c.fillStyle = ENCRE; c.fillRect(x + 0.14, y + 0.14, 0.8, 0.8);
  c.fillStyle = TRAME; c.strokeStyle = ENCRE; c.lineWidth = 0.06;
  c.fillRect(x + 0.08, y + 0.08, 0.8, 0.8); c.strokeRect(x + 0.08, y + 0.08, 0.8, 0.8);
  c.lineWidth = 0.035; c.beginPath();
  c.moveTo(x + 0.08, y + 0.08); c.lineTo(x + 0.88, y + 0.88); c.moveTo(x + 0.88, y + 0.08); c.lineTo(x + 0.08, y + 0.88);
  c.stroke();
}

function couronne(c: Ctx, x: number, y: number, taille: number): void {
  icone(c, 'COURONNE', x + 0.04, y + 0.04, taille, ENCRE, PAPIER);
  icone(c, 'COURONNE', x, y, taille, COULEUR[3], PAPIER);
}

/** Une chose visée par une loi en vigueur change d'apparence : elle porte l'icône de chaque propriété. */
function marques(c: Ctx, x: number, y: number, props: Prop[], petit = false): void {
  props.slice(0, 4).forEach((p, i) => {
    const n = Math.min(props.length, 4);
    const cx = x + 0.5 + (n > 1 ? (i % 2 ? 0.23 : -0.23) : 0), cy = y + 0.5 + (n > 2 ? (i < 2 ? -0.23 : 0.23) : 0);
    const taille = petit || n > 1 ? 0.32 : 0.48;
    c.fillStyle = PAPIER; c.strokeStyle = ENCRE; c.lineWidth = 0.03;
    c.beginPath(); c.arc(cx, cy, taille * 0.72, 0, 7); c.fill(); c.stroke();
    icone(c, p, cx, cy, taille, p === 'MORT' ? COULEUR[0] : ENCRE, PAPIER);
  });
}

// --- mots et châssis -----------------------------------------------------------

const coulDe = (m: Mot) => COULEURS.indexOf(m as (typeof COULEURS)[number]);

/** Un mot libre : une silhouette par famille (pointes, pastille, plaque, fiche cornée), l'icône puis le mot. */
function jeton(c: Ctx, m: Mot, x: number, y: number, echelle = 1): void {
  const f = famille(m), j = coulDe(m);
  const papier = j >= 0 ? COULEUR[j] : f === 'prop' ? PAPIER : ENCRE;
  const encre = f === 'prop' || j === 3 ? ENCRE : PAPIER;
  const l = 0.8, h = 0.31;
  const silhouette = () => {
    c.beginPath();
    if (f === 'couleur') { c.moveTo(-l - 0.06, 0); c.lineTo(-l + 0.16, -h); c.lineTo(l - 0.16, -h); c.lineTo(l + 0.06, 0); c.lineTo(l - 0.16, h); c.lineTo(-l + 0.16, h); }
    else if (f === 'groupe') { c.arc(-l + h, 0, h, Math.PI / 2, -Math.PI / 2); c.arc(l - h, 0, h, -Math.PI / 2, Math.PI / 2); }
    else if (f === 'chose') c.rect(-l, -h, 2 * l, 2 * h);
    else { c.moveTo(-l, -h); c.lineTo(l - 0.2, -h); c.lineTo(l, -h + 0.2); c.lineTo(l, h); c.lineTo(-l, h); }
    c.closePath();
  };
  c.save();
  c.translate(x, y); c.scale(echelle, echelle);
  c.translate(0.06, 0.06); silhouette(); c.fillStyle = 'rgb(27 23 20 / .3)'; c.fill(); c.translate(-0.06, -0.06); // ombre dure, pas de flou
  silhouette(); c.fillStyle = papier; c.fill();
  c.strokeStyle = ENCRE; c.lineWidth = f === 'prop' ? 0.06 : 0.035; c.stroke();
  if (f === 'chose') { c.strokeStyle = PAPIER; c.lineWidth = 0.02; c.strokeRect(-l + 0.05, -h + 0.05, 2 * l - 0.1, 2 * h - 0.1); }
  icone(c, m, -l + 0.32, 0, 0.32, encre, papier);
  mot(c, libelle(m), 0.2, 0, 0.98, 0.42, encre);
  c.restore();
}

const pointilles = (c: Ctx, x: number, y: number, l: number, h: number, coul: string, t: number) => {
  c.save(); c.strokeStyle = coul; c.lineWidth = 0.09; c.setLineDash([0.22, 0.14]); c.lineDashOffset = -t * 1.4;
  c.strokeRect(x, y, l, h); c.restore();
};

/** Un châssis : la phrase en très grand sur le sol, à la couleur de son auteur. */
function chassis(c: Ctx, v: Vue, ch: number, t: number, vise: { ch: number; cote: 0 | 1; mot: Mot } | null): void {
  const { w } = v, l = w.lois[ch], { x, y } = w.arene.chassis[ch], or = ch === 0;
  const auteur = l.auteur >= 0 ? COULEUR[l.auteur] : ENCRE;
  const eclair = l.arme > 0 && Math.floor(t * 9) % 2 === 0; // elle s'arme : le châssis clignote en négatif
  const papier = or !== eclair ? ENCRE : PAPIER, encre = or !== eclair ? PAPIER : ENCRE;
  c.fillStyle = auteur; c.fillRect(x + 0.06, y + 0.06, 5.04, 1.04); // hors registre, à la couleur de l'auteur
  c.fillStyle = papier; c.fillRect(x - 0.06, y - 0.06, 5.04, 1.04);
  c.strokeStyle = l.auteur >= 0 ? auteur : ENCRE; c.lineWidth = 0.09; c.strokeRect(x - 0.06, y - 0.06, 5.04, 1.04);
  c.strokeStyle = ENCRE; c.lineWidth = 0.03; c.strokeRect(x - 0.11, y - 0.11, 5.14, 1.14);
  mot(c, 'EST', x + 2.48, y + 0.5, 0.7, 0.5, encre);
  ([0, 1] as const).forEach((cote) => {
    const m = cote ? l.prop : l.sujet, cx = x + (cote ? 4 : 1) - 0.04, j = coulDe(m);
    const grave = or && cote === 1;
    mot(c, libelle(m), cx, y + 0.48, 1.76, 0.8, grave ? COULEUR[3] : j >= 0 && !eclair ? COULEUR[j] : encre);
    if (grave) return;
    c.strokeStyle = encre; c.lineWidth = 0.02; c.setLineDash([0.08, 0.08]); c.strokeRect(cx - 0.94, y + 0.02, 1.88, 0.92); c.setLineDash([]);
    const sceau = l.sceaux[cote];
    if (sceau > 0) { // scellé : un cachet à la couleur de l'auteur, avec son décompte
      c.strokeStyle = auteur; c.lineWidth = 0.08; c.strokeRect(cx - 0.94, y + 0.02, 1.88, 0.92);
      const sx = cx + (cote ? 0.92 : -0.92), sy = y - 0.04;
      c.fillStyle = ENCRE; c.beginPath(); c.arc(sx + 0.03, sy + 0.03, 0.27, 0, 7); c.fill();
      c.fillStyle = auteur; c.beginPath(); c.arc(sx, sy, 0.27, 0, 7); c.fill();
      c.strokeStyle = PAPIER; c.lineWidth = 0.035; c.beginPath(); c.arc(sx, sy, 0.2, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * sceau) / ticks(CONFIG.loi.sceau)); c.stroke();
      mot(c, String(Math.ceil(sceau / CONFIG.tickHz)), sx, sy, 0.3, 0.3, l.auteur === 3 ? ENCRE : PAPIER);
    }
    if (vise && vise.ch === ch && vise.cote === cote) pointilles(c, cx - 0.98, y - 0.02, 1.96, 1, COULEUR[v.moi], t);
  });
  if (l.arme > 0) { // la barre d'armement se vide
    c.fillStyle = COULEUR[0]; c.fillRect(x - 0.06, y + 1.02, (5.04 * l.arme) / ticks(CONFIG.loi.armement), 0.12);
  }
}

/** L'aperçu : la phrase qu'on obtiendrait, par-dessus tout le reste. */
function apercu(c: Ctx, v: Vue, vise: { ch: number; cote: 0 | 1; mot: Mot }): void {
  const l = v.w.lois[vise.ch], { x, y } = v.w.arene.chassis[vise.ch];
  const apres = vise.cote ? { sujet: l.sujet, prop: vise.mot as Prop } : { sujet: vise.mot as typeof l.sujet, prop: l.prop };
  const ay = y < 1 ? y + 1.55 : y - 0.5;
  c.fillStyle = ENCRE; c.fillRect(x + 0.24, ay - 0.26, 4.6, 0.6);
  c.fillStyle = COULEUR[v.moi]; c.fillRect(x + 0.18, ay - 0.32, 4.6, 0.6);
  mot(c, `→ ${phrase(apres)}`, x + 2.48, ay - 0.02, 4.3, 0.44, v.moi === 3 ? ENCRE : PAPIER);
}

// --- joueurs -----------------------------------------------------------------

function tampon(c: Ctx, p: Joueur, x: number, y: number, v: Vue, t: number, rangs: Map<number, Mot[]>): void {
  const moi = p.id === v.moi;
  const r = rayons.get(p.id) ?? demi(p) * 1.12, coul = COULEUR[p.id];
  const cache = a(p.props, 'invisible') && !moi; // invisible pour les autres : restent le mot porté et la couronne
  c.save();
  c.translate(x, y + (p.mort ? Math.sin(t * 3 + p.id) * 0.06 : 0));
  if (!cache) {
    c.save();
    if (p.etourdi > 0) c.rotate(Math.sin(t * 40) * 0.25);
    if (a(p.props, 'invisible') || (p.invul > 0 && Math.floor(t * 14) % 2)) c.globalAlpha = 0.35;
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
    // ce que les lois lui font : une pastille par propriété ; et son rang, puisque des mots le désignent
    const pastilles: Mot[] = [...(rangs.get(p.id) ?? []), ...(p.mort ? [] : p.props.filter((k) => k !== 'POINTS'))];
    pastilles.forEach((k, i) => {
      const ix = (i - (pastilles.length - 1) / 2) * 0.36, rang = famille(k) === 'groupe';
      c.fillStyle = rang ? ENCRE : PAPIER; c.strokeStyle = ENCRE; c.lineWidth = 0.035;
      c.beginPath(); c.arc(ix, -r - 0.26, 0.17, 0, 7); c.fill(); c.stroke();
      icone(c, k, ix, -r - 0.26, 0.21, rang ? PAPIER : k === 'MORT' ? COULEUR[0] : ENCRE, rang ? ENCRE : PAPIER);
    });
    const b = bulles.get(p.id);
    if (b) {
      c.fillStyle = PAPIER; c.strokeStyle = ENCRE; c.lineWidth = 0.05;
      c.fillRect(-0.85, r + 0.5, 1.7, 0.5); c.strokeRect(-0.85, r + 0.5, 1.7, 0.5);
      mot(c, b.texte, 0, r + 0.75, 1.5, 0.36, ENCRE);
    }
    c.save(); c.scale(0.01, 0.01); c.font = `700 ${moi ? 24 : 20}px "Courier Prime", monospace`; c.textAlign = 'center'; c.textBaseline = 'top';
    c.lineWidth = 6; c.strokeStyle = PAPIER; c.fillStyle = ENCRE;
    const nom = (moi ? '▼ ' : '') + (v.pseudos[p.id] ?? '');
    c.strokeText(nom, 0, (r + 0.1) * 100); c.fillText(nom, 0, (r + 0.1) * 100);
    c.restore();
  }
  if (v.w.couronne?.porteur === p.id) couronne(c, 0, -r * 0.82, 0.62);
  if (p.porte) { // le mot porté, au-dessus de la tête, à la vue de tous (sans sortir de l'arène)
    jeton(c, p.porte, Math.max(0.7 - x, Math.min(largeur(v.w) - 0.7 - x, 0)), Math.max(0.3 - y, -r - 0.82 + Math.sin(t * 6 + p.id) * 0.03), 0.82);
  }
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

  // ce que fera mon bouton d'action, pour le montrer avant l'appui
  const moi = w.joueurs.find((p) => p.id === v.moi);
  const enJeu = w.phase === 'jeu' || w.phase === 'mortsubite';
  const it = moi && enJeu && moi.etourdi === 0 ? intention(w, moi) : null;
  const vise = it && it.t !== 'ramasser' && it.ch >= 0 && moi?.porte ? { ch: it.ch, cote: it.cote, mot: moi.porte } : null;
  const ici = moi ? v.pos.get(moi.id) ?? moi : { x: 0, y: 0 };

  const propsDe = (chose: Chose) => w.lois.filter((l) => l.arme === 0 && l.sujet === chose).map((l) => l.prop);
  const sur = { LAVE: propsDe('LAVE'), MUR: propsDe('MUR'), CAISSE: propsDe('CAISSE'), COURONNE: propsDe('COURONNE') };
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    const o = tuileEn(w, x, y);
    if (o === 'LAVE') { lave(c, x, y, sur.LAVE, t); if ((x + y) % 2 === 0) marques(c, x, y, sur.LAVE.filter((p) => p !== 'MORT' || sur.LAVE.length > 1), true); }
    if (o === 'MUR') { c.fillStyle = ENCRE; c.fillRect(x, y, 1, 1); hachures(c, x, y, PAPIER, 4, 0.035); marques(c, x, y, sur.MUR, true); }
  }
  w.lois.forEach((_, ch) => chassis(c, v, ch, t, vise));

  for (let i = empreintes.length - 1; i >= 0; i--) {
    const e = empreintes[i];
    if ((e.vie -= dt) <= 0) { empreintes.splice(i, 1); continue; }
    c.globalAlpha = e.vie * 0.22; c.fillStyle = COULEUR[e.id];
    tracerForme(c, e.id, 0.17, e.x, e.y); c.fill();
  }
  c.globalAlpha = 1;

  for (const o of w.ombres) {
    const avance = 1 - o.t / ticks(CONFIG.chute.ombre);
    c.save(); c.translate(o.x, o.y);
    c.fillStyle = 'rgb(27 23 20 / .28)'; c.beginPath(); c.ellipse(0, 0, 0.3 + 0.6 * avance, 0.12 + 0.3 * avance, 0, 0, 7); c.fill();
    c.strokeStyle = ENCRE; c.lineWidth = 0.04; c.setLineDash([0.1, 0.1]); c.rotate(t * 2);
    c.beginPath(); c.arc(0, 0, 0.62, 0, 7); c.stroke(); c.setLineDash([]);
    c.restore();
    c.globalAlpha = 0.35 + 0.65 * avance; jeton(c, o.mot, o.x, o.y - (1 - avance) * 1.6, 0.75 + 0.25 * avance); c.globalAlpha = 1;
  }

  // mots et caisses : position lissée, rebond à l'apparition
  const presents = new Set<number>();
  const neuf = vus.size ? 1 : 0;
  const lisse = (id: number, x: number, y: number, raide: number) => {
    presents.add(id);
    let vu = vus.get(id);
    if (!vu) vus.set(id, (vu = { x, y, pop: neuf }));
    const f = 1 - Math.exp(-dt * raide);
    vu.x += (x - vu.x) * f; vu.y += (y - vu.y) * f;
    vu.pop = Math.max(0, vu.pop - dt * 5);
    return vu;
  };
  for (const k of w.caisses) { const vu = lisse(k.id, k.x, k.y, 26); caisse(c, vu.x, vu.y); marques(c, vu.x, vu.y, sur.CAISSE); }
  for (const m of w.mots) {
    if (m.reste > 0) continue;
    const vu = lisse(m.id, m.x, m.y, 30);
    if (it?.t === 'ramasser' && it.id === m.id) { // celui que mon bouton ramasserait
      c.strokeStyle = COULEUR[v.moi]; c.lineWidth = 0.09; c.setLineDash([0.2, 0.12]); c.lineDashOffset = -t * 1.4;
      c.beginPath(); c.ellipse(vu.x, vu.y, 1.02, 0.52, 0, 0, 7); c.stroke(); c.setLineDash([]);
    }
    jeton(c, m.mot, vu.x, vu.y, 1 + vu.pop * 0.5);
  }
  const k0 = w.couronne;
  if (k0 && k0.porteur < 0) { // la couronne attend qu'on marche dessus
    c.fillStyle = PAPIER; c.strokeStyle = ENCRE; c.lineWidth = 0.05;
    c.beginPath(); c.arc(k0.x, k0.y, 0.42 + Math.sin(t * 4) * 0.03, 0, 7); c.fill(); c.stroke();
    couronne(c, k0.x, k0.y, 0.56);
    marques(c, k0.x - 0.5, k0.y - 1.05, sur.COURONNE, true);
  }

  // qui est leader, qui est dernier : marqué en permanence, sauf quand c'est tout le monde
  const rangs = new Map<number, Mot[]>();
  for (const g of ['LEADER', 'DERNIER'] as const) {
    const qui = resoudre(w, g);
    if (qui.length < w.joueurs.length) for (const p of qui) rangs.set(p.id, [...(rangs.get(p.id) ?? []), g]);
  }
  for (const p of w.joueurs) {
    const pos = v.pos.get(p.id) ?? p;
    const cible = demi(p) * 1.12;
    rayons.set(p.id, (rayons.get(p.id) ?? cible) + (cible - (rayons.get(p.id) ?? cible)) * (1 - Math.exp(-dt * 14))); // la taille change sans à-coup
    if (!p.mort && Math.hypot(p.vx, p.vy) > 1 && t - (dernierePas.get(p.id) ?? 0) > 0.12 && !(a(p.props, 'invisible'))) {
      dernierePas.set(p.id, t);
      empreintes.push({ x: pos.x, y: pos.y, vie: 1, id: p.id });
    }
  }
  // les vivants par-dessus les fantômes
  for (const p of [...w.joueurs].sort((p1, p2) => Number(p2.mort) - Number(p1.mort))) {
    const pos = v.pos.get(p.id) ?? p;
    tampon(c, p, pos.x, pos.y, v, t, rangs);
  }
  if (it?.t === 'lancer' && moi) { // la trajectoire du lancer : droit devant, ou aimantée vers l'emplacement
    const but = it.ch >= 0 ? emplacement(w.arene, it.ch, it.cote) : { x: ici.x + it.dx * CONFIG.geste.lancer, y: ici.y + it.dy * CONFIG.geste.lancer };
    c.strokeStyle = COULEUR[v.moi]; c.lineWidth = 0.07; c.setLineDash([0.18, 0.16]); c.lineDashOffset = -t * 2;
    c.beginPath(); c.moveTo(ici.x + it.dx * 0.6, ici.y + it.dy * 0.6); c.lineTo(but.x, but.y); c.stroke(); c.setLineDash([]);
    if (it.ch < 0) { c.beginPath(); c.arc(but.x, but.y, 0.14, 0, 7); c.stroke(); }
  }
  for (const m of w.mots) { // les mots en vol, par-dessus tout le monde
    if (m.reste <= 0) continue;
    presents.add(m.id);
    vus.set(m.id, { x: m.x, y: m.y, pop: 0 });
    c.globalAlpha = 0.25; jeton(c, m.mot, m.x - m.dx * 0.5, m.y - m.dy * 0.5, 0.9); c.globalAlpha = 1;
    jeton(c, m.mot, m.x, m.y, 1.05);
  }
  for (const id of vus.keys()) if (!presents.has(id)) vus.delete(id);
  if (vise) apercu(c, v, vise);

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
