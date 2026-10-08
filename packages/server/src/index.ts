import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { CONFIG, validerMessage, type MessageServeur } from '@casse/shared';
import { Salons, type Salon } from './salon';

const PORT = Number(process.env.PORT ?? 8080);
const PUBLIC = resolve(process.env.PUBLIC_DIR ?? 'dist/public');
const CONNEXIONS_MAX = CONFIG.salon.max * CONFIG.salon.joueurs * 2;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

// Les fichiers sont lus une fois au démarrage : aucun chemin venu du réseau ne touche le disque.
function charger(dossier: string, prefixe = ''): Map<string, { type: string; corps: Buffer }> {
  const fichiers = new Map<string, { type: string; corps: Buffer }>();
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) for (const [k, v] of charger(chemin, `${prefixe}/${nom}`)) fichiers.set(k, v);
    else fichiers.set(`${prefixe}/${nom}`, { type: TYPES[extname(nom)] ?? 'application/octet-stream', corps: readFileSync(chemin) });
  }
  return fichiers;
}
const fichiers = charger(PUBLIC);
const salons = new Salons();

const http = createServer((req, res) => {
  const chemin = (req.url ?? '/').split('?')[0];
  if (chemin === '/healthz') return res.writeHead(200, { 'content-type': 'text/plain' }).end(`ok ${salons.nombre}`);
  const f = (req.method === 'GET' || req.method === 'HEAD') && fichiers.get(chemin === '/' ? '/index.html' : chemin);
  if (!f) return res.writeHead(404, { 'content-type': 'text/plain' }).end('introuvable');
  res.writeHead(200, {
    'content-type': f.type,
    'cache-control': chemin.startsWith('/polices/') ? 'public, max-age=604800' : 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'",
  }).end(req.method === 'HEAD' ? undefined : f.corps);
});

const wss = new WebSocketServer({
  server: http, path: '/ws', maxPayload: CONFIG.reseau.octetsMax,
  // même origine uniquement : une autre page ne peut pas piloter un joueur
  verifyClient: ({ origin, req }: { origin: string; req: IncomingMessage }) => {
    try { return !origin || new URL(origin).host === req.headers.host; } catch { return false; }
  },
});

wss.on('connection', (ws: WebSocket) => {
  if (wss.clients.size > CONNEXIONS_MAX) return ws.close(1013, 'serveur plein');
  let salon: Salon | undefined;
  let membre: Exclude<ReturnType<Salon['entrer']>, string> | undefined;
  let jetons: number = CONFIG.reseau.messagesParSeconde;
  let vu = Date.now();
  const lien = { envoyer: (brut: string) => { if (ws.readyState === ws.OPEN && ws.bufferedAmount < 1 << 20) ws.send(brut); } };
  const dire = (m: MessageServeur) => lien.envoyer(JSON.stringify(m));

  const rejoindre = (s: Salon | null | undefined, pseudo: string, jeton?: string) => {
    if (!s) return dire({ t: 'erreur', msg: 'Salon introuvable (ou serveur plein).' });
    const r = s.entrer(lien, pseudo, jeton);
    if (typeof r === 'string') return dire({ t: 'erreur', msg: r });
    salon = s; membre = r;
  };

  ws.on('message', (donnees, binaire) => {
    // seau à jetons : au-delà du débit autorisé, on coupe
    const t = Date.now();
    jetons = Math.min(CONFIG.reseau.messagesParSeconde, jetons + ((t - vu) / 1000) * CONFIG.reseau.messagesParSeconde) - 1;
    vu = t;
    if (jetons < 0) return ws.close(1008, 'trop de messages');
    if (binaire) return;
    let brut: unknown;
    try { brut = JSON.parse(donnees.toString()); } catch { return; }
    const msg = validerMessage(brut);
    if (!msg) return;
    if (salon && membre) {
      if (msg.t !== 'creer' && msg.t !== 'rejoindre' && msg.t !== 'essai') salon.recevoir(membre, msg);
      return;
    }
    if (msg.t === 'creer') rejoindre(salons.creer(), msg.pseudo);
    else if (msg.t === 'rejoindre') rejoindre(salons.trouver(msg.code), msg.pseudo, msg.jeton);
    else if (msg.t === 'essai') {
      rejoindre(salons.creer(), msg.pseudo);
      if (!salon || !membre) return;
      for (let i = 0; i < 3; i++) salon.recevoir(membre, { t: 'bot', n: 1 });
      salon.recevoir(membre, { t: 'lancer' });
    }
  });
  ws.on('close', () => { if (salon && membre && membre.lien === lien) salon.sortir(membre); });
  ws.on('error', () => ws.terminate());
});

// Pas fixe à 30 Hz, rattrapage borné si le processus a pris du retard.
const PAS_MS = 1000 / CONFIG.tickHz;
let prochain = performance.now();
const horloge = setInterval(() => {
  const t = performance.now();
  if (t - prochain > PAS_MS * 5) prochain = t - PAS_MS;
  while (prochain <= t) { prochain += PAS_MS; salons.tick(); }
}, 4);

http.listen(PORT, () => console.info(`CASSE écoute sur le port ${PORT}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => { clearInterval(horloge); wss.close(); http.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); });
