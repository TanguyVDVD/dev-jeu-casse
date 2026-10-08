// Produit dist/serveur.cjs (un seul fichier, ws inclus) et dist/public/ (client + fichiers statiques).
import { build } from 'esbuild';
import { cpSync, rmSync } from 'node:fs';

const prod = process.argv.includes('--prod');
rmSync('dist', { recursive: true, force: true });
cpSync('packages/client/public', 'dist/public', { recursive: true });
const commun = { bundle: true, minify: prod, sourcemap: !prod, logLevel: 'info' };
await Promise.all([
  build({ ...commun, entryPoints: ['packages/client/src/main.ts'], outfile: 'dist/public/app.js', format: 'iife', target: 'es2020' }),
  build({ ...commun, entryPoints: ['packages/server/src/index.ts'], outfile: 'dist/serveur.cjs', platform: 'node', format: 'cjs', target: 'node20' }),
]);
