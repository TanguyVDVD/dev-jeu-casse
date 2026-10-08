# Décisions prises en autonomie

## Conception
- **Rien n'est vrai par défaut.** Même MUR EST SOLIDE est une phrase (souvent verrouillée dans l'arène). Seuls les bords et les blocs de mots sont toujours solides.
- **Effets par catégorie** : tous les sujets « joueur » partagent un effet par propriété, tous les sujets « objet » un autre. 18 comportements à retenir au lieu de 99.
- **Contraires** : MORT ↔ POINTS et RAPIDE ↔ LENT. MORT ↔ POINTS donne une parade : on se sauve de « ROUGE EST MORT » en composant « ROUGE EST POINTS ».
- **LEADER / DERNIER** ne désignent quelqu'un que s'il est *seul* en tête/queue : pas de carnage à 0-0 en début de manche.
- **Armement par étiquette** et non par règle : c'est ce qui couvre le changement de LEADER en cours de route.
- **« Attribue-lui les points »** : interprété comme +3 pts à l'auteur par victime, et comptage des points distribués dans ses statistiques. Reverser à l'auteur les points gagnés par les autres aurait rendu LAVE EST POINTS injouable.
- **Mort subite plafonnée à 30 s**, puis tirage au sort, pour qu'un match se termine toujours.
- **Agripper est un maintien**, pas une bascule : relâcher la touche lâche le bloc.
- **Joueurs traversables par défaut** : à 4 dans une arène 18×11, des corps solides bloqueraient les couloirs ; le dash suffit comme interaction.
- **Boîtes carrées** pour les collisions, quelle que soit la forme dessinée : pas d'accrochage dans les angles.
- **GÉANT sur un objet** n'agrandit que la zone de contact, pas la solidité (sinon les couloirs se ferment au hasard).
- **Disette plafonnée** : le bloc POINTS de secours ne tombe que s’il y a moins de 3 blocs POINTS en jeu, sinon il en pleuvrait un toutes les 10 s.
- **Plafond de 40 blocs de mots** : au-delà, les chutes périodiques sont suspendues (la chute « disette » reste).

## Technique
- **Rendu : Canvas 2D natif, sans bibliothèque.** ~60 blocs et 4 joueurs à l'écran : Pixi/Phaser n'apporteraient que du poids, et le style (aplats, trames, texte) est exactement ce que Canvas 2D fait bien. Menus et HUD en DOM (texte net, polices CSS).
- **Tests : `node:test` via `tsx`**, pas de framework de test en plus.
- **Build : esbuild** produit `dist/serveur.cjs` (un seul fichier, `ws` inclus) et `dist/public/`. L'image finale n'a pas de `node_modules`.
- **Instantanés JSON complets à 30 Hz** ; les blocs ne sont renvoyés que lorsqu'ils changent. Suffisant pour 4 joueurs ; à passer en binaire/delta seulement si le besoin apparaît.
- **Prédiction** : seul le déplacement du joueur local est prédit (même code `shared`), rejoué depuis le dernier accusé. Les poussées de blocs attendent le serveur : le délai de poussée (0,13 s) masque la latence.
- **INVISIBLE est masqué côté client** : la position part quand même sur le réseau. Triche possible en lisant le WebSocket ; acceptable entre amis.
- **Reconnexion** par jeton conservé dans `sessionStorage` ; la place est gardée 60 s en match.
- **Bot** exécuté par le serveur avec le même code que la simulation, pour tester seul (bouton « Essai contre des bots »).
- **Tunnel** : un seul service `cloudflared` ; le mode (rapide ou nommé) se choisit par `TUNNEL_ARGS` dans `.env`, car l'image cloudflared n'a pas de shell pour un `if`.
- **Tactile** : non fait (bonus).
