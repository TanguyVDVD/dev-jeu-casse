// Retrouve l'adresse publique du tunnel rapide dans les journaux de cloudflared.
import { execSync } from 'node:child_process';

let journaux = '';
try { journaux = execSync('docker compose logs tunnel', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
catch { console.error('Impossible de lire les journaux : le jeu est-il lancé (docker compose up -d) ?'); process.exit(1); }
const adresses = journaux.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
if (!adresses) { console.error('Pas encore d’adresse trycloudflare.com dans les journaux. Réessayez dans quelques secondes.'); process.exit(1); }
console.log(`\n  Lien à envoyer à vos amis :  ${adresses[adresses.length - 1]}\n`);
