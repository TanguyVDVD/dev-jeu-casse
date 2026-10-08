# Identité

## 1. Le nom

| Candidat | Pour | Contre |
|---|---|---|
| **CASSE** | La *casse* est le meuble à tiroirs où l'imprimeur range ses caractères (d'où « haut de casse / bas de casse »). Et on *casse* les règles. Cinq lettres, se crie facilement. | Peut évoquer « casse-briques » : la baseline lève le doute. |
| COQUILLE | La faute d'impression. Joli, mais trois syllabes et aucun rapport avec l'action. | Mou à l'oral. |
| ERRATUM | Savant, drôle. | Latin, pas très « soirée ». |
| BOURDON | Mot d'atelier (une omission à la composition). | Tout le monde pense à l'insecte. |
| DÉCRET | Colle au ton de l'annonceur. | Accent dans un nom de domaine/dossier, sonne administratif sans le second degré. |

**Choix : CASSE.** Le double sens porte tout le jeu : l'objet (des caractères mobiles qu'on déplace) et le geste (casser la règle des autres). Baseline : **« Les règles sont faites pour être cassées. »**

Vérification : recherche web « Casse » + jeu vidéo / party game (octobre 2026) : aucun jeu connu ne porte ce nom seul. Le genre « casse-briques » existe, pas de titre « Casse ».

## 2. Univers et ton

La nuit, dans l'imprimerie du *Journal Officiel*, le règlement de demain attend sur le marbre, composé en gros caractères de bois. Les **Tampons** — quatre tampons encreurs dotés de deux yeux et d'aucun scrupule — s'y promènent. Ils ne savent rien faire d'autre que pousser des caractères. Mais ce qui est composé sur le marbre *devient vrai* : celui qui écrit la loi avant le bouclage gagne la une.

Personne ne se bat. On légifère contre son voisin.

**L'annonceur : le Prote** (le chef d'atelier). Voix de greffier pompeux, phrases courtes, jamais d'émotion — c'est ce sérieux qui rend drôle le fait qu'il proclame « ROUGE EST MORT ».
- Règle créée : « PAR DÉCRET » + la phrase.
- Règle cassée : « ABROGÉ » + la phrase barrée.
- Dernières 10 s : « BOUCLAGE ! » (l'heure limite d'un journal).
- Balle de match : « ÉDITION DÉCISIVE ».
- Égalité : « MORT SUBITE — on ne boucle pas sur une égalité ».
- Fin de match : une fausse une de journal, avec gros titres attribués aux joueurs.

## 3. Direction graphique : l'affiche de sérigraphie

Référence : affiche d'atelier tirée en peu de couleurs, encre épaisse, légèrement hors registre. Pas de dégradés, pas de lueurs, pas de pixel-art.

**Palette** — un papier, une encre, quatre tons directs (un par joueur). Rien d'autre.

| Rôle | Couleur |
|---|---|
| Papier | `#F1E7D3` |
| Papier ombré (trame, grille) | `#DCCFB4` |
| Encre | `#1B1714` |
| Rouge vermillon — joueur ROUGE, **rond** | `#E2432A` |
| Bleu de Prusse — joueur BLEU, **carré** | `#2A56C6` |
| Vert bouteille — joueur VERT, **triangle** | `#1E9A68` |
| Jaune de chrome — joueur JAUNE, **étoile** | `#F2B01E` |

Chaque joueur est identifiable par sa **forme** autant que par sa teinte (daltonisme) : la forme est rappelée partout où la couleur apparaît (score, fil d'événements, blocs ROUGE/BLEU/VERT/JAUNE, salon).

**Typographie** (licence SIL OFL, fichiers embarqués dans `packages/client/public/polices/`)
- **Anton** — tous les mots du jeu, annonces, titres. Grotesque étroite très grasse, proche des caractères d'affiche en bois : étroite donc INVISIBLE tient sur un bloc, grasse donc lisible en plein chaos. Toujours en capitales.
- **Courier Prime** — tout le reste (fil d'événements, salon, aides). La machine à écrire du greffier.

**Personnages** — des tampons vus du dessus : une forme pleine (rond, carré, triangle, étoile) à plat de couleur, doublée d'un contour encre *décalé de 3 px* (le « hors registre », signature visuelle du jeu), deux yeux blancs qui regardent dans la direction de marche. Ils laissent des empreintes d'encre qui s'estompent. Fantôme : simple contour pointillé, sans aplat.

**Blocs** — des caractères d'imprimerie :
- SUJET : aplat encre, mot couleur papier (ou couleur du joueur pour ROUGE/BLEU/VERT/JAUNE).
- EST : pastille papier à double filet, plus petite : c'est la charnière.
- PROPRIÉTÉ : aplat papier, filet épais, coin corné hachuré.
- Chaque bloc porte une icône au-dessus du mot.
- Phrase active : les trois blocs sont « encrés » (soulignés d'une barre pleine, légèrement soulevés). Bloc orphelin : estompé.
- Bloc verrouillé : quatre rivets aux coins.

**Décor** — le marbre : papier grenu, repères de coupe (`+`) à chaque intersection de la grille. LAVE = trame de points vermillon qui ondule ; MUR = hachures encre ; CAISSE = carton croisé ; COURONNE = couronne jaune. Un objet touché par une règle change de dessin (MORT : têtes de mort dans la trame ; POINTS : étoiles ; SOLIDE : filet épais ; INVISIBLE : simple pointillé pour soi, rien pour… personne : il disparaît vraiment).

**Animations** — tout est un coup de tampon : les annonces s'écrasent à l'écran avec une légère rotation et une éclaboussure, les règles abrogées sont barrées d'un trait, les blocs glissent avec un petit dépassement, les mots qui tombent s'annoncent par une ombre tramée.

**Écran-titre** — le logo composé en cinq caractères de bois dont le « A » a basculé hors de la ligne, sur papier nu, avec les quatre tampons qui traversent l'écran.

**Logo / favicon** — `packages/client/public/logo.svg` et `favicon.svg` : cinq blocs encre, lettres papier, le A penché et vermillon. Favicon : le seul bloc « C » avec son double hors registre.

## 4. Direction sonore

Un atelier, pas un synthé : tout est percussif, sec, mécanique — synthétisé en WebAudio (bruit filtré + ondes courtes).
- Pousser un bloc : *clac* de bois. Agripper : cliquet. Dash : souffle court.
- Règle créée : coup de presse grave + cloche de machine à écrire. Règle cassée : papier déchiré (bruit descendant).
- Armement d'une règle visant un joueur : trois tics rapprochés qui montent.
- Mort : tampon écrasé. Points : petit *ding* (cadence limitée). Mot qui tombe : sifflement puis choc.
- Musique : une boucle de rotative (grosse caisse + cliquetis) et une basse à deux notes. Trois paliers d'intensité : normal, balle de match (contretemps ajoutés), bouclage (tempo +30 %, cloche sur chaque temps).
