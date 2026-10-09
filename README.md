# CASSE

*Les règles sont faites pour être cassées.* Party game en ligne, 2 à 4 joueurs, dans le navigateur. Personne n'a d'arme : on ramasse des mots et on les pose dans les lois écrites au sol — `LAVE EST MORT`, `COURONNE EST POINTS`, `LEADER EST LENT`. Un geste, une loi changée.

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
| Ramasser un mot, le poser dans un châssis, sinon le lancer | `Maj`, `K` ou `E` | X, RB ou RT |
| Dash (étourdit, fait lâcher mot et couronne) | `Espace` ou `J` | A |
| Prendre la couronne, pousser une caisse | marcher dessus, marcher dedans | idem |
| Émotes | `1` `2` `3` `4` | Y, LB, Start, Select |
| Couper le son | `M` | |

Chaque arène a trois ou quatre **châssis** : des phrases `SUJET EST PROPRIÉTÉ` écrites en grand sur le sol. La **Loi d'or** (`… EST POINTS`) dit ce qui rapporte des points. Remplacer un mot change la loi : elle s'arme une seconde, puis frappe, et le mot posé est scellé 5 secondes. Votre couleur est un mot comme les autres : qui la tient peut écrire une loi sur vous.

Le plus de points à la fin des 90 secondes gagne la manche, premier à 3 manches. Mort, on devient fantôme : on ne marque plus, mais on peut encore déplacer les mots et réécrire la loi qui tue. Toutes les règles et le tableau des effets : [docs/REGLES.md](docs/REGLES.md).

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
npm test             # 139 tests (moteur de lois, gestes, mots du ciel, bots, salons)
npm run typecheck
npm run simulation   # 4 clients WebSocket jouent un match complet ; --latence 100 pour simuler du délai
npm run mesures      # 200 manches à 4 bots par arène, comparées aux cibles d'équilibrage
```

| Paquet | Rôle |
|---|---|
| `packages/shared` | Vocabulaire, moteur de lois (`lois.ts`), composants (`proprietes.ts`), simulation à pas fixe, bot, protocole. Aucune dépendance au navigateur. |
| `packages/server` | HTTP + WebSocket sur un seul port, salons, boucle à 30 Hz, validation des entrées. |
| `packages/client` | Canvas 2D, prédiction locale, interpolation, sons WebAudio. |

- Équilibrage : tout est dans [`packages/shared/src/config.ts`](packages/shared/src/config.ts).
- Nouvelle arène : un fichier JSON dans `packages/shared/arenes/` (carte, châssis et phrases de départ, mots au sol, pioche) et une ligne dans `arenes.ts`.
- Nouveau mot : son nom dans `vocab.ts`, un composant dans `proprietes.ts`, et (facultatif) une icône dans `packages/client/src/formes.ts`. Il doit passer ce test : son effet se voit sur un joueur dans la seconde.
- Choix de conception : [docs/DECISIONS.md](docs/DECISIONS.md). Identité : [docs/IDENTITE.md](docs/IDENTITE.md). Captures : [docs/captures/](docs/captures/).

Polices Anton et Courier Prime sous licence SIL OFL (textes dans `packages/client/public/polices/`). Aucune autre ressource externe : graphismes dessinés par le code, sons synthétisés.
