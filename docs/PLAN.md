# Plan par jalons

| Jalon | Contenu | Fini quand |
|---|---|---|
| 0 | `IDENTITE.md`, `REGLES.md`, ce plan | relus |
| 1 | `shared` : vocabulaire, lecture de grille, diff de règles, étiquettes, composants, simulation à pas fixe | tests unitaires verts, dont les 99 combinaisons |
| 2 | `server` : HTTP + WebSocket, salons, validation, limites ; `client` : salon, rendu simple, prédiction/interpolation | deux onglets jouent une manche |
| 3 | Fantômes, chute de mots, disette, 3 arènes, manches/match/mort subite, bot | un match complet à 4 bots se termine |
| 4 | Identité (polices, tampons, blocs), sons WebAudio, secousses, annonces, fil d'événements, une de fin | captures d'écran relues et corrigées |
| 5 | Dockerfile, compose + cloudflared, README | `docker compose up --build` sain, WebSocket vérifié à travers le tunnel |

Un commit par jalon, tests lancés à chaque fois.
