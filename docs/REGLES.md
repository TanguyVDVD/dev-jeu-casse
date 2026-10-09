# Règles de CASSE

Personne n'a d'arme. On n'agit sur les autres qu'en changeant les lois, et une loi se change en un seul geste : remplacer un mot.

## Les châssis

Chaque arène contient des **châssis** fixes, composés en très grand sur le marbre. Un châssis porte une phrase : `[SUJET] EST [PROPRIÉTÉ]`. `EST` est gravé ; le sujet et la propriété sont deux emplacements qui reçoivent chacun un mot.

- **La Loi d'or** : `[CHOSE] EST POINTS`. `POINTS` est gravé : seul le sujet change, et il n'accepte que des noms de choses. Elle dit à tout moment ce qui rapporte des points.
- **Deux lois libres** (trois dans une grande arène) : n'importe quel sujet, n'importe quelle propriété.

Un châssis est toujours plein. On ne retire jamais un mot, on le **remplace** : il y a toujours autant de lois en vigueur que de châssis, et annuler une loi oblige à en écrire une autre.

## Les mots

Un mot est un objet posé au sol, lisible de loin. On le porte au-dessus de sa tête, à la vue de tous. Quatre familles, reconnaissables à leur forme autant qu'à leur encre :

| Famille | Mots | Forme | Exemplaires |
|---|---|---|---|
| Couleurs | ROUGE, BLEU, VERT, JAUNE (joueurs présents) | étiquette à pointes, à la couleur et à la forme du joueur | 1 |
| Groupes | TOUS, LEADER, DERNIER | pastille aux bouts ronds, encre pleine | 1 |
| Choses | COURONNE, LAVE, CAISSE, MUR (celles que l'arène contient) | plaque rectangulaire, encre pleine | 2 |
| Propriétés | voir le tableau | fiche papier au coin corné | 1 |

Deux exemplaires par chose : la même chose peut rapporter des points dans la Loi d'or et être piégée par une loi libre.

Au début d'une manche, la couleur de chaque joueur est posée à ses pieds. **Qui tient ta couleur peut écrire une loi sur toi** : la protéger, ou voler celle d'un autre, fait partie du jeu.

## Ramasser, poser, lancer

Un seul bouton d'action, en plus du dash :

- **mains vides**, il ramasse le mot le plus proche (portée 1,3 case), y compris un mot en vol ;
- **mot en main**, face à un emplacement compatible, non scellé, à moins de 1,9 case, il **pose** le mot ;
- **sinon**, il **lance** le mot droit devant.

Poser un mot éjecte l'ancien, qui retombe au sol deux cases plus loin. Poser un mot identique à celui en place est refusé. Un mot au sol ne reste jamais couché sur un châssis ni à cheval sur un bord : il glisse juste à côté.

Un mot lancé glisse sur 5 cases et s'arrête contre un mur, une caisse, un bord ou un joueur. S'il passe à moins de 0,9 case d'un emplacement compatible et non scellé, il s'y pose, au nom du lanceur. La visée s'aimante : si un emplacement compatible se trouve à peu près devant (±26°), le mot part droit dessus. N'importe qui peut l'attraper au vol.

On ne porte qu'un mot à la fois, à 90 % de sa vitesse. Un appui un peu trop tôt reste en mémoire 0,2 s. Avant d'appuyer, le jeu montre ce que le bouton va faire : le mot ou l'emplacement visé s'illumine, et la phrase obtenue s'affiche en aperçu.

- **Dash** : ruée de 0,16 s, recharge 1,6 s. Le joueur touché est étourdi 0,5 s, repoussé d'une case, et lâche son mot et la couronne.
- **Couronne** : elle se porte sur la tête. On la ramasse en marchant dessus ; elle n'occupe pas les mains. Si son porteur meurt, elle retourne sur son socle.
- **Caisses** : elles se poussent en marchant, d'une case à la fois. Murs et caisses sont solides par nature.

## Armement et sceau

- Une loi modifiée **s'arme pendant 1 s** (alerte visible et sonore), puis elle agit. L'ancienne loi du châssis cesse dès la pose.
- Le mot posé est **scellé 5 s** : la seconde d'armement, puis 4 s d'effet. Personne ne peut le remplacer pendant ce temps : une loi a toujours le temps d'agir.
- Seul le mot posé est scellé. L'autre mot du châssis reste remplaçable : on retourne une loi contre son auteur en changeant son sujet.
- Le châssis prend la couleur de l'**auteur** du dernier mot posé. Les morts que la loi provoque lui sont attribuées.

## Qui subit une loi

Toute propriété finit sur des joueurs : une phrase a toujours un effet.

| Sujet | Joueurs touchés |
|---|---|
| ROUGE, BLEU, VERT, JAUNE | ce joueur |
| TOUS | tous les joueurs |
| LEADER, DERNIER | le premier, le dernier au score de la manche, **ex æquo compris** (à 0-0, tout le monde est à la fois leader et dernier) |
| COURONNE | celui qui la porte |
| LAVE | ceux qui sont dedans (le centre du joueur dans une case de lave) |
| CAISSE, MUR | ceux qui les touchent |

- Une chose **transmet** sa propriété à qui la touche. Sauf pour POINTS et MORT, l'effet se prolonge 0,75 s après le contact, pour rester visible.
- Un joueur visé par plusieurs lois **cumule** leurs effets (les vitesses se multiplient).
- **MORT l'emporte sur tout** : une lave qui rapporte des points et qui tue ne rapporte rien.

## Les propriétés

| Mot | Effet sur un joueur visé |
|---|---|
| **POINTS** | Il marque 1 point toutes les 0,5 s. Gravé dans la Loi d'or, jamais en mot libre. |
| **MORT** | Il meurt. |
| **LENT** | Sa vitesse est multipliée par 0,55. |
| **RAPIDE** | Sa vitesse est multipliée par 1,5 et son dash se recharge deux fois plus vite. |
| **GÉANT** | Il double de taille et perd 15 % de vitesse. Il bouscule joueurs et caisses en marchant, et ne peut être ni étourdi ni repoussé. |
| **GLISSANT** | Il glisse comme sur de la glace. |
| **INVERSÉ** | Ses commandes de déplacement sont inversées. |
| **INVISIBLE** | Les autres joueurs ne le voient plus. Le mot qu'il porte et la couronne restent visibles. |
| **DOUBLE** | Tous les points qu'il gagne sont doublés. |
| **VOLEUR** | Quand il touche un joueur vivant, il lui prend 2 points, au plus une fois par seconde et par victime. |

Un changement de taille ne coince jamais un joueur : il est ramené sur le sol libre le plus proche.

Tout mot ajouté plus tard doit passer ce test : **son effet se voit sur un joueur dans la seconde.**

## Score

- On marque par la Loi d'or, tant qu'on remplit sa condition.
- L'auteur d'une loi gagne **3 points pour chaque autre joueur qu'elle tue**. Une phrase de départ ou tombée du ciel n'a pas d'auteur.
- Une loi qui condamne aussi son auteur (TOUS EST MORT, LEADER EST MORT quand il est en tête…) ne lui rapporte rien : pas de prime pour un massacre où l'on s'inclut.
- Un score ne descend jamais sous zéro.
- Le plus de points à la fin gagne la manche.

## Mort et fantômes

- Tué **au contact d'une chose** : fantôme pendant 3 s, puis retour à son point de départ avec 1,5 s d'invulnérabilité.
- Tué par une loi qui le vise **par sa couleur ou par un groupe** : fantôme tant que la loi le vise, puis retour 2 s après.
- **Plafond** : une loi ne tient personne mort plus de 6 s. Passé ce délai le joueur revient, et cette loi ne peut plus le tuer tant qu'elle n'a pas été réécrite.
- Un fantôme ne marque pas, ne porte pas la couronne et ne peut pas être étourdi. Il se déplace 20 % plus vite, garde son mot en mourant, et peut ramasser, poser et lancer : c'est ainsi qu'il réécrit la loi qui le tue.

## Mots du ciel

- Chaque arène a une **pioche** de groupes et de propriétés. Toutes les 15 s, le mot suivant qui n'est pas déjà en jeu tombe au sol, annoncé 2 s avant par une ombre.
- **Inertie** : une loi qui n'a pas changé depuis 20 s reçoit un mot du ciel directement dans son emplacement (la plus ancienne d'abord, au plus une toutes les 4 s). Le ciel reprend au besoin un mot qui traîne au sol, qui disparaît dès l'annonce. Pour la Loi d'or, c'est le nom de chose resté au sol le plus longtemps, à défaut celui qu'un joueur garde en main.
- Au plus **8 mots libres** hors des châssis, couleurs non comptées. Au-delà, le groupe ou la propriété resté le plus longtemps sans être touché disparaît (il reviendra par la pioche). Les couleurs et les noms de choses ne disparaissent jamais.

## Match

Manche de 90 s après 3 s de décompte (9 s avant la première, le temps de lire l'aide). Pendant les **15 dernières secondes** (« bouclage »), les points de la Loi d'or comptent double et les sceaux durent deux fois moins longtemps. Égalité en tête : mort subite, le premier seul en tête gagne (30 s max, puis tirage au sort entre ex æquo). Premier à 3 manches. Les arènes tournent.

## Arènes

| Arène | Départ | Personnalité |
|---|---|---|
| **Le Marbre** | COURONNE EST POINTS · LAVE EST MORT · LEADER EST LENT | Ouverte, une seule couronne : on se la vole au dash. Mots simples seulement (MORT, LENT, RAPIDE, GÉANT). |
| **La Rotative** | CAISSE EST POINTS · LAVE EST GLISSANT · DERNIER EST RAPIDE | Moins de caisses que de joueurs, qu'on pousse hors de portée des autres. Introduit GLISSANT, INVERSÉ, DOUBLE. |
| **Le Coffre** | COURONNE EST POINTS · DERNIER EST VOLEUR · COURONNE EST LENT · LAVE EST MORT | Grande arène, trois lois libres. La couronne est dans un coffre à portes étroites ; la troisième loi est sur une île de lave qu'on n'atteint qu'au lancer tant que la lave tue. Introduit INVISIBLE, VOLEUR. |

Toutes les valeurs chiffrées sont dans `packages/shared/src/config.ts`. Les mesures d'équilibrage se relancent avec `npm run mesures`. Captures du jeu : [`docs/captures/`](captures/).
