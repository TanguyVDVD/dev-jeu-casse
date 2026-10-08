# CASSE

*Les règles sont faites pour être cassées.* Party game en ligne, 2 à 4 joueurs, dans le navigateur. Personne n'a d'arme : on pousse des blocs de mots pour réécrire les règles — `LAVE EST MORT`, `COURONNE EST POINTS`, `LEADER EST LENT`.

## Lancer une soirée

1. Installez [Docker Desktop](https://www.docker.com/products/docker-desktop/) et démarrez-le.
2. Dans ce dossier : `docker compose up --build`
3. Attendez le cadre `INVITEZ VOS AMIS : https://….trycloudflare.com` dans le terminal.
4. Ouvrez cette adresse, créez un salon, cliquez **Copier le lien** et envoyez-le à vos amis.
5. Tout le monde clique **Prêt**, vous cliquez **Lancer la partie**.

Adresse perdue ? `npm run lien`, ou `docker compose logs jeu` (PowerShell et bash). Arrêter : `Ctrl+C`, puis `docker compose down`.
L'adresse change à chaque démarrage : c'est un tunnel rapide Cloudflare, sans compte.

Le port 8080 n’est ouvert que sur votre machine (`http://localhost:8080`) : tout le monde, même sur votre Wi-Fi, passe par le lien du tunnel.

## Jouer

| Action | Clavier | Manette |
|---|---|---|
| Se déplacer | flèches, ou les touches à l'emplacement de WASD (ZQSD en AZERTY) | stick gauche / croix |
| Pousser un bloc | marcher dedans | idem |
| Agripper (maintenir) puis reculer pour tirer | `Maj` ou `K` | X, RB ou RT |
| Dash (étourdit, fait lâcher prise) | `Espace` ou `J` | A |
| Émotes | `1` `2` `3` `4` | Y, LB, Start, Select |
| Couper le son | `M` | |

Une phrase = `SUJET` `EST` `PROPRIÉTÉ`, de gauche à droite ou de haut en bas. Le plus de points à la fin des 90 secondes gagne la manche, premier à 3 manches. Mort, on devient fantôme : on ne marque plus mais on peut encore pousser les blocs. Toutes les règles : [docs/REGLES.md](docs/REGLES.md).

Pour essayer seul : bouton **Essai seul contre trois bots** sur l'écran-titre, ou **+ Bot** dans un salon.

## Adresse fixe : tunnel nommé (optionnel)

Il faut un compte Cloudflare et un domaine géré par Cloudflare.

1. Tableau de bord Cloudflare → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel** → type **Cloudflared**. Donnez-lui un nom.
2. À l'étape d'installation, copiez le jeton (la longue chaîne après `--token`). Ne lancez pas la commande proposée.
3. Onglet **Public Hostname** → **Add a public hostname** : choisissez un sous-domaine (ex. `casse.votre-domaine.fr`), type **HTTP**, URL `jeu:8080`.
4. Copiez `.env.example` en `.env` et renseignez :
   ```
   TUNNEL_TOKEN=le-jeton-copié
   TUNNEL_ARGS=run
   URL_PUBLIQUE=https://casse.votre-domaine.fr
   ```
5. `docker compose up --build -d`. Le WebSocket passe par le même nom d'hôte, sans réglage supplémentaire.

Ne partagez jamais le fichier `.env` : le jeton donne le contrôle du tunnel.

## Développement

Node 20 ou plus.

```
npm install
npm run dev          # construit puis sert http://localhost:8080
npm test             # 149 tests (moteur de règles, simulation, salons)
npm run typecheck
npm run simulation   # 4 clients WebSocket jouent un match complet ; --latence 100 pour simuler du délai
```

| Paquet | Rôle |
|---|---|
| `packages/shared` | Vocabulaire, lecture de la grille, composants, simulation à pas fixe, bot, protocole. Aucune dépendance au navigateur. |
| `packages/server` | HTTP + WebSocket sur un seul port, salons, boucle à 30 Hz, validation des entrées. |
| `packages/client` | Canvas 2D, prédiction locale, interpolation, sons WebAudio. |

- Équilibrage : tout est dans [`packages/shared/src/config.ts`](packages/shared/src/config.ts).
- Nouvelle arène : un fichier JSON dans `packages/shared/arenes/` et une ligne dans `arenes.ts`.
- Nouveau mot : son nom dans `vocab.ts`, un composant dans `proprietes.ts`, et (facultatif) une icône dans `packages/client/src/formes.ts`.
- Choix de conception : [docs/DECISIONS.md](docs/DECISIONS.md). Identité : [docs/IDENTITE.md](docs/IDENTITE.md).

Polices Anton et Courier Prime sous licence SIL OFL (textes dans `packages/client/public/polices/`). Aucune autre ressource externe : graphismes dessinés par le code, sons synthétisés.
