import { randomBytes, randomInt } from 'node:crypto';
import {
  ARENES, CONFIG, ENTREE_VIDE, creerMonde, instantane, memoireBot, pas, penser, serialiser, statsVides, ticks,
  type Entree, type EtatSalon, type MemoireBot, type MessageClient, type MessageServeur, type Monde, type Stats, type Titre,
} from '@casse/shared';

/** Ce que le salon sait d'une connexion : de quoi lui écrire. */
export interface Lien { envoyer(brut: string): void }

interface Membre {
  c: number; pseudo: string; jeton: string; lien: Lien | null; pret: boolean; victoires: number;
  bot?: MemoireBot; file: Entree[]; derniere: Entree; parti: number; emote: number; complet: boolean;
}

const LETTRES = 'BCDFGHJKLMNPRSTVXZ'; // sans voyelles : pas de gros mots, pas de O/0
const NOMS_BOTS = ['Plomb', 'Bourdon', 'Lézarde', 'Mastic'];
const s = (n: number) => (n > 1 ? 's' : '');

const TITRES: [keyof Stats, string, (n: number) => string][] = [
  ['ecrites', 'Le Législateur', (n) => `${n} loi${s(n)} écrite${s(n)}`],
  ['victimes', 'Le Bourreau', (n) => `${n} victime${s(n)}`],
  ['morts', 'Le Paillasson', (n) => `mort ${n} fois`],
  ['dashs', 'Le Bélier', (n) => `${n} coup${s(n)} d’épaule`],
  ['lances', 'Le Tireur d’élite', (n) => `${n} loi${s(n)} écrite${s(n)} au lancer`],
  ['attrapes', 'Le Pickpocket', (n) => `${n} mot${s(n)} attrapé${s(n)} au vol`],
  ['voles', 'Le Percepteur', (n) => `${n} point${s(n)} volé${s(n)}`],
];

export function attribuerTitres(stats: Record<number, Stats>): Titre[] {
  const titres: Titre[] = [];
  for (const [cle, titre, detail] of TITRES) {
    const [c, max] = Object.entries(stats).reduce<[number, number]>((m, [id, s]) => (s[cle] > m[1] ? [Number(id), s[cle]] : m), [-1, 0]);
    if (c >= 0) titres.push({ c, titre, detail: detail(max) });
  }
  return titres;
}

export class Salon {
  membres: Membre[] = [];
  phase: EtatSalon['phase'] = 'salon';
  monde?: Monde;
  manches = [0, 0, 0, 0];
  private hote = '';
  private numero = 0;
  private pause = 0;
  private versionEnvoyee = -1;
  private stats: Record<number, Stats> = {};

  constructor(readonly code: string) {}

  get vide(): boolean { return !this.membres.some((m) => m.lien); }

  // --- entrées et sorties -------------------------------------------------

  private dire(m: Membre, msg: MessageServeur): void { m.lien?.envoyer(serialiser(msg)); }
  private diffuser(msg: MessageServeur): void {
    const brut = serialiser(msg);
    for (const m of this.membres) m.lien?.envoyer(brut);
  }
  private etat(): void {
    const etat: EtatSalon = {
      code: this.code, phase: this.phase,
      places: this.membres.map((m) => ({ c: m.c, pseudo: m.pseudo, pret: m.pret || !!m.bot, bot: !!m.bot, connecte: !!m.lien || !!m.bot, hote: m.jeton === this.hote, victoires: m.victoires })),
    };
    for (const m of this.membres) this.dire(m, { t: 'salon', etat, moi: m.c });
  }

  private ajouter(pseudo: string, lien: Lien | null, bot: boolean): Membre | null {
    const c = [0, 1, 2, 3].find((k) => !this.membres.some((m) => m.c === k));
    if (c === undefined) return null;
    const m: Membre = {
      c, pseudo, jeton: randomBytes(16).toString('hex'), lien, pret: false, victoires: 0,
      bot: bot ? memoireBot() : undefined, file: [], derniere: ENTREE_VIDE, parti: 0, emote: 0, complet: true,
    };
    this.membres.push(m);
    if (!this.hote && !bot) this.hote = m.jeton;
    return m;
  }

  /** Arrivée ou retour d'un joueur. Renvoie le membre, ou un message d'erreur. */
  entrer(lien: Lien, pseudo: string, jeton?: string): Membre | string {
    const ancien = jeton && this.membres.find((m) => m.jeton === jeton && !m.bot);
    let m: Membre | null;
    if (ancien) { m = ancien; m.lien = lien; m.complet = true; }
    else {
      if (this.phase !== 'salon') return 'Partie en cours : revenez à la fin du match.';
      m = this.ajouter(pseudo, lien, false);
      if (!m) return 'Ce salon est complet.';
    }
    this.dire(m, { t: 'bienvenue', code: this.code, jeton: m.jeton, moi: m.c });
    this.etat();
    if (this.phase === 'match' && this.monde) this.dire(m, this.annonceManche());
    return m;
  }

  sortir(m: Membre): void {
    m.lien = null;
    m.parti = Date.now();
    if (this.phase === 'salon') this.retirer(m);
    else this.etat();
  }

  private retirer(m: Membre): void {
    this.membres = this.membres.filter((k) => k !== m);
    if (m.jeton === this.hote) this.hote = this.membres.find((k) => k.lien)?.jeton ?? '';
    this.etat();
  }

  recevoir(m: Membre, msg: MessageClient): void {
    const hote = m.jeton === this.hote;
    switch (msg.t) {
      case 'i':
        // file bornée : un client qui inonde ne prend pas d'avance, il perd ses vieilles entrées
        if (m.file.length < 8) m.file.push({ seq: msg.s, mx: msg.mx, my: msg.my, dash: msg.d, action: msg.a });
        return;
      case 'emote': {
        const t = Date.now();
        if (t - m.emote < CONFIG.salon.emoteRecharge * 1000) return;
        m.emote = t;
        return this.diffuser({ t: 'emote', c: m.c, n: msg.n });
      }
      case 'couleur':
        if (this.phase !== 'salon' || this.membres.some((k) => k.c === msg.c)) return;
        m.c = msg.c;
        return this.etat();
      case 'pret':
        m.pret = msg.v;
        return this.etat();
      case 'bot': {
        if (!hote || this.phase !== 'salon') return;
        const bots = this.membres.filter((k) => k.bot);
        if (msg.n === 1) this.ajouter(NOMS_BOTS[bots.length % NOMS_BOTS.length], null, true);
        else if (bots.length) this.membres = this.membres.filter((k) => k !== bots[bots.length - 1]);
        return this.etat();
      }
      case 'lancer': {
        if (!hote || this.phase === 'match' || this.membres.length < 2) return;
        const attendus = this.membres.filter((k) => !k.bot && k !== m && k.lien && !k.pret);
        if (this.phase === 'salon' && attendus.length) return this.dire(m, { t: 'erreur', msg: `Pas prêt : ${attendus.map((k) => k.pseudo).join(', ')}` });
        return this.lancer();
      }
      case 'salon':
        if (!hote || this.phase !== 'fin') return;
        this.phase = 'salon';
        for (const k of this.membres) k.pret = false;
        this.membres.filter((k) => !k.lien && !k.bot).forEach((k) => this.retirer(k));
        return this.etat();
    }
  }

  // --- match ---------------------------------------------------------------

  lancer(): void {
    this.phase = 'match';
    this.manches = [0, 0, 0, 0];
    this.numero = 0;
    this.stats = {};
    this.etat();
    this.nouvelleManche();
  }

  private annonceManche(): MessageServeur {
    return { t: 'manche', arene: this.monde!.arene.id, numero: this.numero, manches: this.manches, ids: this.monde!.joueurs.map((j) => j.id) };
  }

  private nouvelleManche(): void {
    const arene = ARENES[this.numero++ % ARENES.length];
    this.monde = creerMonde(arene, this.membres.map((m) => m.c).sort(), randomInt(2 ** 31));
    if (this.numero === 1) this.monde.temps = ticks(CONFIG.manche.aide); // le temps de lire l'aide
    this.versionEnvoyee = -1;
    for (const m of this.membres) { m.file = []; m.derniere = ENTREE_VIDE; }
    this.diffuser(this.annonceManche());
  }

  private finManche(w: Monde): void {
    this.manches[w.vainqueur]++;
    for (const j of w.joueurs) {
      const s = (this.stats[j.id] ??= statsVides());
      for (const k of Object.keys(s) as (keyof Stats)[]) s[k] += j.stats[k];
    }
    this.diffuser({ t: 'finmanche', vainqueur: w.vainqueur, manches: this.manches });
    this.pause = ticks(CONFIG.manche.pause);
  }

  private apresPause(): void {
    const vainqueur = this.manches.findIndex((n) => n >= CONFIG.manche.aGagner);
    if (vainqueur < 0) return this.nouvelleManche();
    this.phase = 'fin';
    const gagnant = this.membres.find((m) => m.c === vainqueur);
    if (gagnant) gagnant.victoires++;
    this.diffuser({ t: 'fin', vainqueur, manches: this.manches, stats: this.stats, titres: attribuerTitres(this.stats) });
    this.etat();
  }

  /** Un pas de serveur (30 Hz). */
  tick(): void {
    if (this.phase === 'salon') return;
    // une place vide est gardée un moment pour la reconnexion, puis libérée
    for (const m of this.membres)
      if (!m.lien && !m.bot && Date.now() - m.parti > CONFIG.reseau.placeGardee * 1000) this.retirer(m);
    if (this.phase !== 'match' || !this.monde) return;
    if (this.membres.length < 2 || !this.membres.some((m) => !m.bot)) {
      this.phase = 'salon';
      this.diffuser({ t: 'erreur', msg: 'Plus assez de joueurs : retour au salon.' });
      return this.etat();
    }
    if (this.pause > 0) { if (--this.pause === 0) this.apresPause(); return; }

    const w = this.monde;
    const entrees: Record<number, Entree> = {};
    for (const m of this.membres) {
      if (m.bot) { entrees[m.c] = penser(w, m.c, m.bot); continue; }
      // sans nouvelle entrée, on prolonge la dernière (sans rejouer dash ni action) ; déconnecté = immobile
      m.derniere = m.file.shift() ?? { ...m.derniere, dash: false, action: false };
      if (m.file.length > 4) { // en retard : on saute des entrées, mais jamais un appui
        const sautees = m.file.splice(0, m.file.length - 2);
        m.file[0] = { ...m.file[0], dash: m.file[0].dash || sautees.some((e) => e.dash), action: m.file[0].action || sautees.some((e) => e.action) };
      }
      entrees[m.c] = m.lien ? m.derniere : ENTREE_VIDE;
    }
    pas(w, entrees);

    // mots et caisses : seulement quand ils changent, tant qu'un mot vole, et une fois par seconde
    const change = w.version !== this.versionEnvoyee || w.mots.some((k) => k.reste > 0) || w.tick % CONFIG.tickHz === 0;
    this.versionEnvoyee = w.version;
    const leger = serialiser(instantane(w, change));
    const complet = this.membres.some((m) => m.complet) ? serialiser(instantane(w, true)) : leger;
    for (const m of this.membres) { m.lien?.envoyer(m.complet ? complet : leger); m.complet = false; }
    w.evts = [];
    if (w.phase === 'fin') this.finManche(w);
  }
}

export class Salons {
  private salons = new Map<string, Salon>();

  get nombre(): number { return this.salons.size; }
  trouver(code: string): Salon | undefined { return this.salons.get(code); }

  creer(): Salon | null {
    if (this.salons.size >= CONFIG.salon.max) return null;
    let code: string;
    do code = Array.from({ length: 4 }, () => LETTRES[randomInt(LETTRES.length)]).join('');
    while (this.salons.has(code));
    const s = new Salon(code);
    this.salons.set(code, s);
    return s;
  }

  tick(): void {
    for (const [code, s] of this.salons) {
      s.tick();
      // en match, la place vide expire d'abord (tick) ; un salon sans personne disparaît
      if (s.vide && (s.phase === 'salon' || !s.membres.some((m) => !m.bot))) this.salons.delete(code);
    }
  }
}
