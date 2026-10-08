# Règles de CASSE

## Lire une phrase

Une règle = trois blocs alignés et contigus `[SUJET] [EST] [PROPRIÉTÉ]`, lus de gauche à droite ou de haut en bas. Jamais à l'envers, jamais en diagonale. Un même bloc peut servir à deux phrases (croisement). Deux phrases identiques ne comptent qu'une fois. Dès qu'un bloc bouge, la grille est relue.

Sans règle, rien ne fait rien : la lave est un décor, on traverse les murs, les caisses et les autres joueurs. Seuls les bords de l'arène et les blocs de mots sont toujours solides.

## Les sujets

| Sujet | Désigne |
|---|---|
| ROUGE, BLEU, VERT, JAUNE | le joueur de cette couleur |
| TOUS | tous les joueurs |
| LEADER | le joueur seul en tête de la manche (égalité en tête : personne) |
| DERNIER | le joueur seul en queue de la manche (égalité en queue : personne) |
| LAVE, MUR, COURONNE | toutes les cases de ce type |
| CAISSE | toutes les caisses (objets posés sur la grille) |

LEADER et DERNIER sont réévalués à chaque pas : la règle change de cible quand le classement change.

## Les effets : sujet × propriété

Les 7 sujets « joueur » ont le même effet (colonne Joueur) ; les 4 sujets « objet » aussi (colonne Objet). Les 99 combinaisons sont donc toutes définies, et toutes testées (`packages/shared/test/matrice.test.ts`).

« Au contact » = la boîte du joueur touche la case de l'objet (marge 0,06 case), donc on est « au contact » d'un objet SOLIDE en s'appuyant dessus.

| Propriété | Joueur EST … | Objet EST … |
|---|---|---|
| **MORT** | Il meurt, et reste fantôme tant que la règle le vise. | Tue au contact. |
| **POINTS** | Gagne 2 pts/s passivement. | Rapporte 4 pts/s au contact. |
| **SOLIDE** | Ne peut plus traverser les autres joueurs ni être traversé ; insensible au dash et aux aimants. | Bloque le passage (joueurs et blocs). Une CAISSE solide se pousse et se tire comme un bloc. |
| **RAPIDE** | Vitesse × 1,5. | Vitesse × 1,5 au contact. |
| **LENT** | Vitesse × 0,55. | Vitesse × 0,55 au contact. |
| **GÉANT** | Taille × 1,6 (ne passe plus dans un couloir d'une case, plus facile à toucher) ; pousse 5 blocs en chaîne au lieu de 3. | Zone de contact élargie de 0,5 case de chaque côté (la solidité, elle, ne grossit pas). |
| **GLISSANT** | Inertie de patinoire. | Patinoire au contact. |
| **AIMANT** | Attire les autres joueurs dans un rayon de 4 cases. | Attire les joueurs dans un rayon de 4 cases. |
| **INVISIBLE** | N'est plus dessiné chez les autres (lui se voit en pointillé ; son dash le trahit). | N'est plus dessiné, mais agit toujours. |

Particularités par objet : LAVE, MUR et COURONNE sont des cases fixes ; la CAISSE est le seul objet déplaçable (si SOLIDE). La COURONNE est une case unique : COURONNE EST POINTS fait un « roi de la colline ».

## Conflits : ordre de priorité

1. **Les contraires s'annulent.** MORT ↔ POINTS et RAPIDE ↔ LENT. Si un même sujet reçoit les deux (par une ou plusieurs phrases : ROUGE EST MORT + TOUS EST POINTS), aucune des deux ne s'applique. Pour la vitesse, les propriétés du joueur et celles des objets qu'il touche sont mises en commun avant l'annulation.
2. **L'invulnérabilité** (1 s après réapparition) bat MORT et le dash.
3. **MORT** bat tout le reste : un fantôme n'a plus aucune propriété, ne marque pas, n'est ni solide ni aimanté.
4. **SOLIDE** est résolu avant le contact : on ne « touche » un objet solide que par son bord.
5. Les autres propriétés se cumulent (GÉANT + GLISSANT + AIMANT…), les vitesses se multiplient.

On n'est jamais coincé : un joueur qui se retrouve dans une case devenue solide (ou sous un bloc tombé) peut toujours en sortir, mais pas y rentrer.

## Garde-fous

- **Armement** : toute propriété qui arrive sur un joueur par une phrase à sujet « joueur » met 1 s à s'armer (avertissement visuel et sonore). Vaut aussi quand LEADER/DERNIER change de tête.
- **Fantôme** : un mort ne marque plus mais pousse, tire et dashe (sans étourdir). Il réapparaît 3 s après sa mort si aucune règle MORT ne le vise ; sur un point d'apparition sûr, avec 1 s d'invulnérabilité.
- **Blocs verrouillés** (rivets) : ni poussés ni tirés ; ils bloquent une chaîne.
- **Chute de mots** : un mot du sac de l'arène tombe toutes les 20 s, annoncé 2 s avant par une ombre.
- **Disette** : 10 s sans aucune règle POINTS → un bloc POINTS tombe.
- **Auteur** : le joueur dont le déplacement de bloc fait apparaître une phrase en est l'auteur. Chaque victime de cette règle lui rapporte 3 pts (sauf lui-même) ; les points qu'elle distribue sont comptés dans ses statistiques. Les règles d'origine de l'arène et celles nées d'une chute n'ont pas d'auteur.

## Actions

- **Pousser** : marcher 0,13 s contre un bloc le fait glisser d'une case ; jusqu'à 3 blocs en chaîne.
- **Agripper** (maintenir) : saisit le bloc en face ; reculer le tire d'une case. Vitesse × 0,75 pendant la prise.
- **Dash** : ruée de 0,16 s, recharge 1,6 s. Le joueur touché est étourdi 0,5 s, repoussé, et lâche son bloc.

## Match

Manche de 90 s après 3 s de décompte. Le plus de points gagne la manche. Égalité en tête : mort subite, le premier seul en tête gagne (30 s max, puis tirage au sort entre ex æquo). Premier à 3 manches. Les arènes tournent.

Toutes les valeurs ci-dessus sont dans `packages/shared/src/config.ts`.
