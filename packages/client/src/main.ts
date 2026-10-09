import {
  ARENES, CONFIG, DT, bouger, creerMonde, glisser, libelle, phrase, replique, ticks,
  type Entree, type EtatSalon, type Evt, type Instantane, type Joueur, type MessageClient, type MessageServeur, type Monde,
} from '@casse/shared';
import { PISTES, SONS, battreMusique, couper, estCoupe, lire as lireLoi, musique, reveiller } from './audio';
import { lire, surAppui } from './entrees';
import { COULEUR, ENCRE, svgForme } from './formes';
import { bulle, dessiner, eclat, flotter, geler, secouer, viderEffets } from './rendu';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
/** Crée un élément ; le texte passe toujours par textContent (jamais de HTML venu du réseau). */
function el(tag: string, classe = '', ...enfants: (Node | string)[]): HTMLElement {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  e.append(...enfants);
  return e;
}
const EMOTES = ['HA !', 'OUPS', 'TRAÎTRE !', 'BIEN JOUÉ'];

// --- état ---------------------------------------------------------------------

let ws: WebSocket | undefined;
let session: { code: string; jeton: string; pseudo: string } | null = JSON.parse(sessionStorage.getItem('casse') ?? 'null');
let salon: EtatSalon | undefined;
let moi = -1;
let w: Monde | undefined;
let recopier = replique();
let manches = [0, 0, 0, 0];
let pred: Joueur | undefined; // mon joueur, prédit localement
let predAvant = { x: 0, y: 0 };
let decalage = { x: 0, y: 0 }; // écart visuel absorbé en douceur après une correction du serveur
let attente: Entree[] = []; // entrées envoyées, pas encore accusées
let seq = 0;
let tampons: { t: number; j: Joueur[] }[] = [];
let finRecue = false;
let bouclageAnnonce = false;
let dernierScore = 0;
let adresse = location.origin; // remplacée par l'adresse du tunnel quand le serveur la connaît
let inscrit = false; // le serveur nous a placés dans un salon sur cette connexion

const pseudoDe = (c: number) => salon?.places.find((p) => p.c === c)?.pseudo ?? '?';
const enJeu = () => !!w && (w.phase === 'jeu' || w.phase === 'mortsubite');

function ecran(nom: 'titre' | 'salon' | 'jeu' | 'fin'): void {
  for (const id of ['titre', 'salon', 'jeu', 'fin']) $(id).hidden = id !== nom;
  if (nom !== 'jeu') musique(-1);
}

let minuterieToast = 0;
function toast(texte: string): void {
  $('toast').textContent = texte;
  $('toast').classList.add('vu');
  clearTimeout(minuterieToast);
  minuterieToast = window.setTimeout(() => $('toast').classList.remove('vu'), 3000);
}

/** « ● Zoé » : la forme du joueur accompagne toujours son nom. */
const nom = (c: number) => el('span', 'j', svgForme(c), pseudoDe(c));

// --- réseau -------------------------------------------------------------------

const envoyer = (m: MessageClient) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };

function connecter(premier: MessageClient): void {
  const ancien = ws;
  if (ancien) { ancien.onclose = null; ancien.close(); }
  inscrit = false;
  const socket = (ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`));
  socket.onopen = () => envoyer(premier);
  socket.onmessage = (e) => {
    let m: MessageServeur;
    try { m = JSON.parse(e.data); } catch { return; }
    recevoir(m);
  };
  socket.onclose = () => {
    if (!session) { toast('Connexion au serveur impossible.'); return; }
    toast('Connexion perdue : nouvelle tentative…');
    const s = session;
    setTimeout(() => { if (session === s && ws === socket) connecter({ t: 'rejoindre', ...s }); }, 1200);
  };
}

function recevoir(m: MessageServeur): void {
  switch (m.t) {
    case 'bienvenue':
      inscrit = true;
      session = { code: m.code, jeton: m.jeton, pseudo: session?.pseudo ?? $<HTMLInputElement>('pseudo').value };
      sessionStorage.setItem('casse', JSON.stringify(session));
      history.replaceState(null, '', `?s=${m.code}`);
      return;
    case 'salon':
      salon = m.etat; moi = m.moi;
      if (m.etat.phase === 'match') finRecue = false;
      afficherSalon();
      ecran(m.etat.phase === 'match' ? 'jeu' : m.etat.phase === 'fin' && finRecue ? 'fin' : 'salon');
      return;
    case 'manche': return nouvelleManche(m.arene, m.ids, m.numero, m.manches);
    case 's': return instantane(m);
    case 'finmanche':
      manches = m.manches;
      SONS.manche(); musique(-1);
      panneau(el('p', 'surtitre', 'Manche terminée'), el('h2', '', nom(m.vainqueur)), el('p', '', 'remporte la manche'));
      majScores(true);
      return;
    case 'fin': return afficherFin(m);
    case 'emote': bulle(m.c, EMOTES[m.n]); SONS.emote(m.n); return;
    case 'erreur':
      toast(m.msg);
      if (!inscrit) { session = null; salon = undefined; w = undefined; sessionStorage.removeItem('casse'); history.replaceState(null, '', location.pathname); ecran('titre'); }
  }
}

// --- salon ---------------------------------------------------------------------

function afficherSalon(): void {
  if (!salon) return;
  const hote = salon.places.find((p) => p.c === moi)?.hote ?? false;
  document.body.classList.toggle('hote', hote);
  $('codeSalon').textContent = salon.code;
  $<HTMLInputElement>('lien').value = `${adresse}/?s=${salon.code}`;
  $('places').replaceChildren(...[0, 1, 2, 3].map((c) => {
    const p = salon!.places.find((k) => k.c === c);
    const li = el('li', `place${p ? '' : ' libre'}${c === moi ? ' moi' : ''}`, svgForme(c));
    li.style.setProperty('--c', COULEUR[c]);
    if (!p) {
      li.append(el('span', 'etat', 'Place libre'));
      li.tabIndex = 0; li.setAttribute('role', 'button');
      li.onclick = () => envoyer({ t: 'couleur', c });
      li.onkeydown = (e) => { if (e.key === 'Enter') envoyer({ t: 'couleur', c }); };
      return li;
    }
    const etat = !p.connecte ? 'Déconnecté…' : p.bot ? 'Bot' : p.hote ? 'Hôte' : p.pret ? 'Prêt' : 'Pas prêt';
    li.append(el('span', 'nom', p.pseudo), el('span', `etat${p.pret && !p.bot && !p.hote ? ' pretOui' : ''}`, etat),
      el('span', 'victoires', `${p.victoires} victoire${p.victoires > 1 ? 's' : ''}`));
    return li;
  }));
  const moiPlace = salon.places.find((p) => p.c === moi);
  $('pret').textContent = moiPlace?.pret ? 'Plus prêt' : 'Prêt';
  $('pret').hidden = hote;
  $<HTMLButtonElement>('lancer').disabled = salon.places.length < 2;
}

// --- manche --------------------------------------------------------------------

function panneau(...contenu: Node[]): void {
  $('panneau').replaceChildren(...contenu);
  $('panneau').hidden = contenu.length === 0;
}

/** Les cinq lignes qui précèdent la première manche. */
const AIDE: (string | [string])[][] = [
  ['La ', ['Loi d’or'], ' dit ce qui rapporte des points : remplissez sa condition.'],
  [['Maj'], ' ramasse le mot le plus proche. Vous le portez sur la tête, tout le monde le voit.'],
  ['Face à un châssis, ', ['Maj'], ' pose votre mot à la place de l’ancien : la loi change. Sinon, ', ['Maj'], ' le lance.'],
  ['Une loi neuve s’arme 1 s puis frappe. Le mot posé est scellé 5 s.'],
  [['Espace'], ' : dash, qui fait lâcher mot et couronne. Mort, vous êtes fantôme : réécrivez la loi qui vous tue.'],
];

function nouvelleManche(idArene: string, ids: number[], numero: number, m: number[]): void {
  const arene = ARENES.find((ar) => ar.id === idArene);
  if (!arene) return;
  w = creerMonde(arene, ids, 0);
  recopier = replique();
  manches = m; pred = undefined; attente = []; tampons = []; decalage = { x: 0, y: 0 };
  bouclageAnnonce = false; dernierScore = 0;
  viderEffets();
  $('fil').replaceChildren(el('h3', '', 'Dépêches'));
  lignesLoi.clear();
  signatureLois = '';
  construireScores();
  $('chrono').classList.remove('bouclage');
  const balle = ids.filter((c) => m[c] === CONFIG.manche.aGagner - 1);
  const aide = numero === 1 ? [el('ol', 'mode', ...AIDE.map((ligne) => el('li', '', ...ligne.map((k) => (typeof k === 'string' ? k : el('b', '', k[0]))))))] : [];
  panneau(el('p', 'surtitre', `Manche ${numero}`), el('h2', '', arene.nom), el('p', '', arene.description), ...aide, el('p', 'compte', ''));
  if (balle.length) annoncer('Édition décisive', `Balle de match : ${balle.map(pseudoDe).join(', ')}`, 'long');
  musique(balle.length ? 1 : 0);
  ecran('jeu');
}

function instantane(s: Instantane): void {
  if (!w) return;
  recopier(w, s);
  tampons.push({ t: performance.now(), j: s.j });
  if (tampons.length > 12) tampons.shift();

  // réconciliation : on repart de l'état du serveur et on rejoue les entrées qu'il n'a pas encore vues
  const i = w.joueurs.findIndex((j) => j.id === moi);
  if (i >= 0) {
    const serveur = w.joueurs[i];
    const avant = pred && { x: pred.x, y: pred.y };
    pred = structuredClone(serveur);
    w.joueurs[i] = pred;
    attente = attente.filter((e) => e.seq > serveur.seq);
    // les gestes (ramasser, poser, lancer) sont rejoués avec le reste : si le serveur en refuse un, il disparaît de lui-même
    if (enJeu()) for (const e of attente) { bouger(w, pred, e, false); glisser(w); }
    w.evts = [];
    if (avant) {
      const dx = avant.x - pred.x, dy = avant.y - pred.y;
      if (Math.hypot(dx, dy) < 1.5) { decalage.x += dx; decalage.y += dy; predAvant.x -= dx; predAvant.y -= dy; }
      else decalage = { x: 0, y: 0 };
    } else predAvant = { x: pred.x, y: pred.y };
    if (serveur.score > dernierScore + 0.99) { dernierScore = serveur.score; SONS.points(); }
  }
  for (const e of s.e) evenement(e);
}

/** Un pas client à 30 Hz : lit les commandes, les envoie, et prédit mon déplacement sans attendre. */
function pasClient(): void {
  if (!w || !pred || !enJeu()) { lire(); return; }
  const entree: Entree = { seq: ++seq, ...lire() };
  envoyer({ t: 'i', s: entree.seq, mx: entree.mx, my: entree.my, d: entree.dash, a: entree.action });
  predAvant = { x: pred.x, y: pred.y };
  const portait = pred.porte;
  bouger(w, pred, entree, false);
  glisser(w);
  // le geste est prédit : son bruit n'attend pas le serveur
  if (pred.porte !== portait) { if (pred.porte) SONS.prise(); else if (w.evts.some((e) => e.t === 'loi')) SONS.pose(); else SONS.lance(); }
  w.evts = [];
  attente.push(entree);
  if (attente.length > 90) attente.shift();
}

function positions(alpha: number): Map<number, { x: number; y: number }> {
  const pos = new Map<number, { x: number; y: number }>();
  const tr = performance.now() - CONFIG.reseau.interpolationMs;
  let a = tampons[0], b = tampons[tampons.length - 1];
  for (let i = 0; i < tampons.length - 1; i++) if (tampons[i].t <= tr && tampons[i + 1].t >= tr) { a = tampons[i]; b = tampons[i + 1]; }
  if (a && b) {
    const f = b.t > a.t ? Math.max(0, Math.min(1, (tr - a.t) / (b.t - a.t))) : 1;
    for (const jb of b.j) {
      const ja = a.j.find((j) => j.id === jb.id) ?? jb;
      // téléportation (réapparition) : pas de fondu entre les deux points
      const saut = Math.hypot(jb.x - ja.x, jb.y - ja.y) > 3;
      pos.set(jb.id, saut ? jb : { x: ja.x + (jb.x - ja.x) * f, y: ja.y + (jb.y - ja.y) * f });
    }
  }
  if (pred) pos.set(moi, { x: predAvant.x + (pred.x - predAvant.x) * alpha + decalage.x, y: predAvant.y + (pred.y - predAvant.y) * alpha + decalage.y });
  return pos;
}

// --- annonces plein écran --------------------------------------------------------

const fileAnnonces: [string, string, string][] = [];
let annonceEnCours = false;
function annoncer(sur: string, texte: string, classe = ''): void {
  // une loi chasse l'autre : le décret affiché est toujours le dernier écrit
  if (classe === 'loi') for (let i = fileAnnonces.length - 1; i >= 0; i--) if (fileAnnonces[i][2] === 'loi') fileAnnonces.splice(i, 1);
  if (fileAnnonces.length >= 3) fileAnnonces.shift();
  fileAnnonces.push([sur, texte, classe]);
  if (!annonceEnCours) annonceSuivante();
}
function annonceSuivante(): void {
  const suivante = fileAnnonces.shift();
  annonceEnCours = !!suivante;
  if (!suivante) return $('annonce').replaceChildren();
  const [sur, texte, classe] = suivante;
  $('annonce').replaceChildren(el('div', `tampon ${classe}`, el('small', '', sur), el('strong', '', texte)));
  setTimeout(annonceSuivante, classe.includes('long') ? 1600 : classe.includes('loi') ? 950 : 500);
}

// --- fil d'événements ------------------------------------------------------------

const lignesLoi = new Map<number, { suffixe: HTMLElement; n: number }>();
function depeche(...contenu: (Node | string)[]): HTMLElement {
  const ligne = el('p', 'evenement', ...contenu);
  $('fil').firstElementChild?.after(ligne);
  while ($('fil').children.length > 10) $('fil').lastElementChild!.remove();
  return ligne;
}
const victimes = (n: number) => (n ? ` : ${n} victime${n > 1 ? 's' : ''}` : '');

function evenement(e: Evt): void {
  if (!w) return;
  const ou = (c: number) => w!.joueurs.find((j) => j.id === c) ?? { x: 0, y: 0 };
  switch (e.t) {
    case 'loi': {
      // armement : la nouvelle phrase en grand, lue par le Prote
      const texte = phrase(e);
      annoncer(e.par >= 0 ? 'Par décret' : 'Le ciel décrète', texte, 'loi');
      SONS.arme(); lireLoi(texte);
      const suffixe = el('span', '');
      depeche(e.par >= 0 ? nom(e.par) : 'Le ciel', ' a écrit ', el('b', '', texte), suffixe);
      lignesLoi.set(e.ch, { suffixe, n: 0 });
      if (e.par >= 0) eclat(ou(e.par).x, ou(e.par).y, COULEUR[e.par], 16, 6);
      return;
    }
    case 'active': {
      // elle entre en vigueur : coup de presse, et un marqueur sur chaque joueur touché
      const l = w.lois[e.ch];
      SONS.loiActive(); secouer(0.3); geler(60);
      for (const j of l.touches) { flotter(ou(j).x, ou(j).y - 0.7, `${libelle(l.prop)} !`, COULEUR[j]); eclat(ou(j).x, ou(j).y, ENCRE, 10, 5); }
      if (l.touches.includes(moi)) $('cadre').animate([{ outline: `10px solid ${COULEUR[moi]}` }, { outline: '0 solid transparent' }], { duration: 600 });
      return;
    }
    case 'prise': if (e.j !== moi) SONS.prise(); return;
    case 'lance': if (e.j !== moi) SONS.lance(); return;
    case 'mort': {
      const p = ou(e.j), l = w.lois[e.ch];
      SONS.mort(); eclat(p.x, p.y, COULEUR[e.j], 26, 7); secouer(0.4); geler(90);
      const ligne = lignesLoi.get(e.ch);
      if (ligne) ligne.suffixe.textContent = victimes(++ligne.n);
      const texte = l ? el('b', '', phrase(l)) : 'un accident';
      if (e.par === e.j) depeche(nom(e.j), ' s’est condamné tout seul : ', texte);
      else depeche(nom(e.j), ' succombe à ', texte, ...(e.par >= 0 ? [' — signé ', nom(e.par)] : []));
      if (e.par >= 0 && e.par !== e.j) flotter(ou(e.par).x, ou(e.par).y - 0.6, `+${CONFIG.points.victime}`, COULEUR[e.par]);
      return;
    }
    case 'couronne': SONS.couronne(); eclat(ou(e.j).x, ou(e.j).y, COULEUR[3], 14, 5); return;
    case 'vol':
      SONS.vol();
      flotter(ou(e.b).x, ou(e.b).y - 0.6, `−${e.n}`, COULEUR[e.b]); flotter(ou(e.a).x, ou(e.a).y - 0.6, `+${e.n}`, COULEUR[e.a]);
      return;
    case 'efface': eclat(e.x, e.y, ENCRE, 8, 3); return;
    case 'choc': SONS.choc(); eclat(ou(e.b).x, ou(e.b).y, COULEUR[3], 12, 6); secouer(0.3); geler(70); return;
    case 'dash': SONS.dash(); eclat(ou(e.j).x, ou(e.j).y, ENCRE, 6, 3); return;
    case 'pousse': SONS.pousse(); eclat(e.x + 0.5, e.y + 0.5, ENCRE, 4, 2); return;
    case 'ombre': SONS.ombre(); depeche('Un mot tombe du ciel : ', el('b', '', libelle(e.mot))); return;
    case 'chute': SONS.chute(); secouer(0.25); eclat(e.x, e.y, ENCRE, 14, 5); return;
    case 'respawn': SONS.respawn(); eclat(ou(e.j).x, ou(e.j).y, COULEUR[e.j], 10, 4); return;
    case 'phase':
      if (e.phase === 'jeu') { SONS.go(); panneau(); }
      if (e.phase === 'mortsubite') { annoncer('Mort subite', 'On ne boucle pas sur une égalité', 'long'); SONS.bouclage(); musique(2); }
  }
}

// --- HUD -------------------------------------------------------------------------

const cases = new Map<number, { boite: HTMLElement; pts: HTMLElement; manches: HTMLElement }>();
function construireScores(): void {
  if (!w) return;
  cases.clear();
  const boites = w.joueurs.map((j) => {
    const pts = el('span', 'pts', '0'), m = el('span', 'manches');
    const boite = el('div', 'score', svgForme(j.id), el('div', '', el('div', 'nom', pseudoDe(j.id)), m), pts);
    boite.style.setProperty('--c', COULEUR[j.id]);
    cases.set(j.id, { boite, pts, manches: m });
    return boite;
  });
  const milieu = Math.ceil(boites.length / 2);
  const chrono = el('div');
  chrono.id = 'chrono';
  $('scores').replaceChildren(...boites.slice(0, milieu), chrono, ...boites.slice(milieu));
  majScores(true);
}

let signatureLois = '';
function majScores(forcer = false): void {
  if (!w) return;
  for (const j of w.joueurs) {
    const k = cases.get(j.id);
    if (!k) continue;
    const pts = String(Math.floor(j.score));
    if (k.pts.textContent !== pts) k.pts.textContent = pts;
    k.boite.classList.toggle('mort', j.mort);
    if (forcer) k.manches.replaceChildren(...Array.from({ length: CONFIG.manche.aGagner }, (_, i) => el('i', i < manches[j.id] ? 'g' : '')));
  }
  const chrono = $('chrono');
  const reste = w.phase === 'decompte' ? CONFIG.manche.duree : Math.ceil(w.temps / CONFIG.tickHz);
  const texte = w.phase === 'mortsubite' ? 'MORT SUBITE' : w.phase === 'fin' ? '—' : String(reste);
  if (chrono && chrono.textContent !== texte) chrono.textContent = texte;

  if (w.phase === 'decompte') {
    const compte = $('panneau').querySelector('.compte');
    const n = String(Math.ceil(w.temps / CONFIG.tickHz));
    if (compte && compte.textContent !== n) { compte.textContent = n; SONS.tic(); }
  }
  if (w.phase === 'jeu' && !bouclageAnnonce && w.temps <= ticks(CONFIG.manche.bouclage)) {
    bouclageAnnonce = true;
    annoncer(`${CONFIG.manche.bouclage} secondes`, 'Bouclage !', 'long');
    SONS.bouclage(); musique(2);
    chrono?.classList.add('bouclage');
  }

  // le bandeau des lois : la Loi d'or d'abord, puis chaque loi avec les joueurs qu'elle touche en ce moment
  const signature = w.lois.map((l) => `${l.sujet}${l.prop}${l.auteur}${l.arme > 0}${l.touches}${l.victimes}`).join('|');
  if (signature === signatureLois) return;
  signatureLois = signature;
  $('lois').replaceChildren(el('h3', '', 'En vigueur'), ...w.lois.map((l, ch) => {
    const touches = el('span', 'touches', ...l.touches.map(svgForme));
    const ligne = el('div', `enonce${ch === 0 ? ' or' : ''}${l.arme > 0 ? ' arme' : l.touches.length ? '' : ' vide'}`, el('span', 'phrase', phrase(l)), touches);
    ligne.style.setProperty('--c', l.auteur >= 0 ? COULEUR[l.auteur] : ENCRE);
    if (l.victimes) touches.append(el('small', '', `${l.victimes} †`));
    return ligne;
  }));
}

// --- fin de match : la une -------------------------------------------------------

function afficherFin(m: Extract<MessageServeur, { t: 'fin' }>): void {
  finRecue = true;
  SONS.victoire();
  const hote = document.body.classList.contains('hote');
  const gros = el('h2', '', el('em', '', pseudoDe(m.vainqueur)), ' fait la loi');
  gros.style.setProperty('--c', COULEUR[m.vainqueur]);
  const titres = el('ul', 'titres', ...m.titres.map((t) => {
    const li = el('li', '', el('b', '', t.titre), nom(t.c), el('span', '', ` — ${t.detail}`));
    li.style.setProperty('--c', COULEUR[t.c]);
    return li;
  }));
  const manchesTexte = Object.keys(m.stats).map(Number).sort((a, b) => m.manches[b] - m.manches[a]).flatMap((c) => [nom(c), ` ${m.manches[c]}   `]);
  const soiree = (salon?.places ?? []).flatMap((p) => [nom(p.c), ` ${p.victoires + (p.c === m.vainqueur ? 1 : 0)}   `]);
  const boutons = el('div', 'rangee centre');
  if (hote) {
    const revanche = el('button', '', 'Revanche immédiate'), retour = el('button', 'second', 'Retour au salon');
    revanche.onclick = () => envoyer({ t: 'lancer' });
    retour.onclick = () => envoyer({ t: 'salon' });
    boutons.append(revanche, retour);
  } else boutons.append(el('p', 'aide', 'L’hôte choisit : revanche immédiate ou retour au salon.'));
  $('fin').replaceChildren(el('article', 'une',
    el('p', 'manchette', 'Le Journal officiel de la Casse · édition du soir'), gros,
    el('p', '', 'Manches : ', ...manchesTexte), titres,
    el('p', 'manchette', 'Tableau de la soirée'), el('p', '', ...soiree), boutons));
  ecran('fin');
}

// --- boucle d'affichage ------------------------------------------------------------

let dernier = performance.now();
let accumulateur = 0;
function image(t: number): void {
  const dt = Math.min(0.1, (t - dernier) / 1000);
  dernier = t;
  accumulateur += dt;
  while (accumulateur >= DT) { pasClient(); accumulateur -= DT; }
  const f = Math.exp(-dt * 10);
  decalage.x *= f; decalage.y *= f;
  if (w && !$('jeu').hidden) {
    dessiner($<HTMLCanvasElement>('toile'), { w, moi, pseudos: [0, 1, 2, 3].map(pseudoDe), pos: positions(accumulateur / DT) }, dt);
    majScores();
  }
  battreMusique();
  requestAnimationFrame(image);
}

// --- écran-titre et commandes --------------------------------------------------------

function pseudo(): string | null {
  const champ = $<HTMLInputElement>('pseudo');
  const p = champ.value.trim();
  if (!p) { champ.focus(); toast('Il vous faut un nom.'); return null; }
  localStorage.setItem('casse.pseudo', p);
  session = null; salon = undefined;
  return p;
}
const entrer = (m: (p: string) => MessageClient) => { const p = pseudo(); if (p) { reveiller(); connecter(m(p)); } };

$('entree').onsubmit = (e) => { e.preventDefault(); entrer((p) => ({ t: 'creer', pseudo: p })); };
$('essai').onclick = () => entrer((p) => ({ t: 'essai', pseudo: p }));
$('rejoindre').onclick = () => {
  const code = $<HTMLInputElement>('code').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) return toast('Le code fait 4 lettres.');
  entrer((p) => ({ t: 'rejoindre', code, pseudo: p }));
};
$('pret').onclick = () => envoyer({ t: 'pret', v: !salon?.places.find((p) => p.c === moi)?.pret });
$('plusBot').onclick = () => envoyer({ t: 'bot', n: 1 });
$('moinsBot').onclick = () => envoyer({ t: 'bot', n: -1 });
$('lancer').onclick = () => envoyer({ t: 'lancer' });
$('copier').onclick = async () => {
  const champ = $<HTMLInputElement>('lien');
  try { await navigator.clipboard.writeText(champ.value); toast('Lien copié : envoyez-le à vos amis.'); }
  catch { champ.select(); toast('Copiez le lien sélectionné (Ctrl+C).'); }
};
addEventListener('pointerdown', reveiller);
addEventListener('keydown', reveiller);
surAppui((code) => {
  if (code === 'KeyM') { // tout couper, ou tout rétablir si tout l'est déjà
    const v = !PISTES.every(estCoupe);
    for (const p of PISTES) couper(p, v);
    afficherSon();
    toast(v ? 'Son coupé' : 'Son rétabli');
  }
  const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code);
  if (n >= 0 && !$('jeu').hidden) envoyer({ t: 'emote', n });
});

// bruitages, musique de fond et voix de l'annonceur se coupent séparément
const NOM_PISTE = { sons: 'Bruitages', musique: 'Musique', voix: 'Voix' };
function afficherSon(): void {
  $('son').replaceChildren(...PISTES.map((p) => {
    const b = el('button', estCoupe(p) ? 'coupe' : '', NOM_PISTE[p]);
    b.setAttribute('aria-pressed', String(!estCoupe(p)));
    b.title = `${estCoupe(p) ? 'Rétablir' : 'Couper'} : ${NOM_PISTE[p].toLowerCase()}`;
    b.onclick = () => { reveiller(); couper(p, !estCoupe(p)); afficherSon(); };
    return b;
  }));
}
afficherSon();

$<HTMLInputElement>('pseudo').value = localStorage.getItem('casse.pseudo') ?? '';
const codeUrl = new URLSearchParams(location.search).get('s')?.toUpperCase() ?? '';
if (/^[A-Z]{4}$/.test(codeUrl)) {
  $<HTMLInputElement>('code').value = codeUrl;
  // rechargement de page en cours de partie : on reprend sa place
  if (session?.code === codeUrl) connecter({ t: 'rejoindre', ...session });
  else session = null;
} else session = null;
fetch('/adresse').then((r) => r.json()).then((r: { url?: string }) => { if (typeof r.url === 'string') { adresse = r.url; afficherSalon(); } }).catch(() => { /* pas de tunnel : on garde l'origine */ });
void document.fonts.load('100px Anton');
requestAnimationFrame(image);
