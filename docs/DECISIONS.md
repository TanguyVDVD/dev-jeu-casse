# Décisions prises en autonomie

L'état d'avant la refonte des lois est conservé sous l'étiquette git `avant-refonte`.

## Vocabulaire

- **Châssis** pour « cadre » : en imprimerie, le châssis est le cadre de métal qui serre la composition. **Loi**, **Loi d'or** et **sceau** sont gardés : le *Journal officiel* publie des lois, et un tampon appose un sceau.
- L'annonceur dit « PAR DÉCRET » pour un joueur, « LE CIEL DÉCRÈTE » pour un mot tombé du ciel. « ABROGÉ » disparaît : on ne retire plus une loi, on la remplace.

## Conception des lois

- **Châssis de 5 cases sur 1**, non solides : on marche dessus. Deux cases par mot, une pour `EST`.
- **« Face à un emplacement »** = à moins de 1,9 case et dans le demi-plan devant soi ; à moins de 0,9 case l'orientation ne compte plus. Entre plusieurs emplacements possibles, le plus proche gagne.
- **Visée aimantée au lancer** : si un emplacement compatible est à ±26° de l'axe et à portée, le mot part droit dessus. Sans cela, viser un emplacement de deux cases à cinq cases de distance au clavier (8 directions) raterait trop souvent.
- **Un mot lancé se pose dans tout emplacement compatible qu'il frôle** (0,9 case), pas seulement celui visé : c'est la règle du cahier des charges, et cela rend les lancers en travers d'un châssis dangereux.
- **L'ancien mot est éjecté dans le prolongement du geste**, à deux cases, en évitant d'abord châssis, lave, murs et caisses ; un mot au sol est toujours recalé entièrement dans l'arène.
- **On garde son mot en mourant** (le dash, lui, le fait lâcher) : un fantôme doit pouvoir finir le geste qui le sauve.
- **La couronne retourne sur son socle quand son porteur meurt** ; après un dash elle tombe sur place, et l'attaquant la prend en marchant dessus. Sinon une couronne tombée dans une lave mortelle bloquait la Loi d'or.
- **LAVE touche le joueur dont le centre est dans une case de lave** ; CAISSE et MUR, celui dont la boîte les frôle (marge 0,08 case). Les bords de l'arène ne sont pas des murs.
- **Moins de caisses que de joueurs** : l'arène en déclare trois, la manche en garde `joueurs − 1`, les plus centrales.
- **Égalité au score = partie entière** : LEADER et DERNIER comparent les points affichés.
- **MORT passe en premier, puis les autres effets une fois toutes les propriétés connues** : DOUBLE vaut pour les points du même pas, quel que soit l'ordre des châssis.
- **Joueurs traversables** (sauf le GÉANT, qui écarte les autres) : à 4 dans une arène 18×11, des corps solides boucheraient les couloirs.

## Règles ajoutées parce que les mesures ou les captures l'exigeaient

- **Plafond de mort : 4 s, puis 4 s de retour** (8 s au plus ; le retour valait 2 s avant un retour de jeu demandant qu'une loi tue 2 s de plus qu'un contact). « Fantôme tant que la loi le vise » ne garantit pas la cible « jamais plus de 12 s mort ». Une loi ne tient donc personne mort plus de 4 s ; ensuite elle l'épargne tant qu'elle n'est pas réécrite (et le bandeau cesse de dire qu'elle le touche).
- **Pas de prime pour une loi qui condamne aussi son auteur.** À 0-0 tout le monde est leader et dernier : TOUS/LEADER/DERNIER EST MORT rapportait 9 points en un geste dès la première seconde, et les bots ouvraient chaque manche ainsi. Viser un adversaire rapporte toujours 3 points.
- **Inertie découplée de la chute périodique.** Tel qu'écrit (« toutes les 15 s, dans la loi inchangée depuis 20 s »), trois lois immobiles attendent 35, 50 et 65 s : la cible des 40 s est intenable. Une loi inchangée depuis 20 s reçoit donc son mot sans attendre, la plus ancienne d'abord, à 4 s d'intervalle au moins.
- **Le ciel peut reprendre un mot qui traîne au sol**, et le retire dès l'annonce : chaque mot n'existant qu'en un exemplaire, il n'y a sinon souvent rien à faire tomber, et un joueur qui ramassait le mot pendant l'ombre annulait la chute (loi restée 56 s inchangée sur 200 manches).
- **La Loi d'or vieillit aussi** : elle reçoit le nom de chose resté au sol le plus longtemps, à défaut celui qu'un joueur garde en main. Chaque arène a assez de noms de choses pour que les lois libres ne puissent pas tous les retenir (vérifié par un test).
- **Mot du ciel au sol : le suivant de la pioche qui n'est pas déjà en jeu.** Si tous y sont, rien ne tombe.
- **Le Marbre ne pose pas TOUS au sol** (il vient par la pioche) et sa couronne n'est plus dans un couloir d'une case, où un GÉANT ne pouvait pas l'atteindre.

## Sensations

- **Décret affiché en haut de l'arène**, 0,95 s, et un décret chasse l'autre : en plein centre et en file d'attente, il cachait la mêlée la moitié du temps avec des bots.
- **Le Prote lit la loi** par la synthèse vocale du navigateur (voix française, grave, rapide), coupée avec `M`. Qualité variable selon le système : à juger en soirée, une ligne à retirer dans `audio.ts` sinon.
- **Leader et dernier marqués par une pastille encre** au-dessus du joueur, sauf quand tout le monde l'est (début de manche).
- **Aide de cinq lignes pendant le décompte de la première manche**, qui dure 20 s ; 7 s avant les manches suivantes (3 s et 9 s ne laissaient pas le temps de lire, retour de jeu).
- **Trois coupures de son indépendantes** (bruitages, musique, voix du Prote), en bas à gauche de l'écran, retenues d'une session à l'autre ; `M` coupe ou rétablit tout. `M` se lit comme une lettre et non comme un emplacement de touche : en AZERTY elle est ailleurs que sur un clavier QWERTY.
- **Écran-titre, salon, une de fin, émotes, musique** : inchangés. Les titres de fin suivent les nouvelles statistiques (lois écrites, lancers réussis, mots attrapés au vol, points volés).

## Bots

- Un bot évalue l'« intérêt » d'un jeu de lois : ce qui lui arrive compte plein, ce qui arrive aux autres compte à l'envers, le leader plus que les autres ; l'accès à ce que désigne la Loi d'or complète le calcul. Il va chercher le mot dont le déplacement vaut le plus, sinon il remplit la condition de la Loi d'or. Chaque propriété porte son `attrait` dans `proprietes.ts`.
- Chemin en largeur sur la grille, en évitant ce qui tue ; un bot GÉANT évite les couloirs d'une case ; un bot INVERSÉ compense.
- Les bots sont plus vifs que des humains (replanification toutes les 0,3 à 0,6 s, aucun raté) : 45 à 50 lois par manche chez eux, à diviser par trois ou quatre autour d'une table.

## Technique

- **Rendu : Canvas 2D natif, sans bibliothèque.** Menus et HUD en DOM (texte net, polices CSS).
- **Tests : `node:test` via `tsx`**, pas de framework en plus.
- **Build : esbuild** produit `dist/serveur.cjs` (un seul fichier, `ws` inclus) et `dist/public/`. L'image finale n'a pas de `node_modules`.
- **Instantanés JSON à 30 Hz.** Joueurs, lois, ombres et couronne à chaque pas ; mots libres et caisses seulement quand ils changent, tant qu'un mot vole, et une fois par seconde.
- **Prédiction des gestes par rejeu.** Le client garde la dernière version des mots reçue du serveur ; à chaque instantané il repart de l'état du serveur et rejoue ses entrées non accusées, gestes compris (même code `shared`). Un geste refusé par le serveur n'est simplement plus rejoué : il s'annule sans code dédié. Mesuré à 100 ms de latence : environ 5 % des gestes annulés, tous sur une course perdue contre un autre joueur ou un sceau.
- **Un appui ne se perd pas** : quand le serveur saute des entrées en retard, il reporte dash et action sur l'entrée suivante.
- **Les caisses ne sont pas prédites** : leur délai de poussée (0,13 s) masque la latence.
- **INVISIBLE est masqué côté client** : la position part quand même sur le réseau. Triche possible en lisant le WebSocket ; acceptable entre amis.
- **Reconnexion** par jeton conservé dans `sessionStorage` ; la place est gardée 60 s en match.
- **Tunnel** : un seul service `cloudflared` ; le mode (rapide ou nommé) se choisit par `TUNNEL_ARGS` dans `.env`, car l'image cloudflared n'a pas de shell pour un `if`.
- **Adresse d’invitation** : le serveur demande son nom d’hôte à cloudflared (`/quicktunnel` sur le port de métriques, interne au réseau compose), l’affiche encadré dans les journaux et le sert sur `/adresse`.
- **Port lié à 127.0.0.1** dans compose : le jeu n’est joignable de l’extérieur que par le tunnel. Pour jouer en réseau local sans tunnel, retirer `127.0.0.1:` dans `docker-compose.yml`.
- **Node 22** dans l’image ; le code tourne aussi sous Node 20 en local.
- **Durcissement** : connexion fermée si aucun salon n’est rejoint en 15 s, ping toutes les 30 s, 5 tentatives de salon par connexion, client qui ne lit plus coupé, conteneur limité à 512 Mo. Pas de limite par adresse IP : derrière le tunnel, toutes les connexions viennent de cloudflared.
- **Codes à 4 lettres** : ~105 000 combinaisons, donc devinables avec de la patience. La limite de tentatives ralentit le balayage, elle ne l’empêche pas ; pire cas : un inconnu occupe une place dans un salon.
- **Tactile** : non fait.
