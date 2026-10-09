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

La nuit, dans l'imprimerie du *Journal Officiel*, le règlement de demain attend sur le marbre, composé en gros caractères de bois. Les **Tampons** — quatre tampons encreurs dotés de deux yeux et d'aucun scrupule — s'y promènent. Ils ne savent rien faire d'autre que porter des caractères. Mais ce qui est serré dans un châssis *devient vrai* : celui qui écrit la loi avant le bouclage gagne la une.

Personne ne se bat. On légifère contre son voisin.

**L'annonceur : le Prote** (le chef d'atelier). Voix de greffier pompeux, phrases courtes, jamais d'émotion — c'est ce sérieux qui rend drôle le fait qu'il proclame « ROUGE EST MORT ».
- Loi écrite par un joueur : « PAR DÉCRET » + la phrase, qu'il lit à voix haute. Mot tombé du ciel : « LE CIEL DÉCRÈTE ».
- Dernières 15 s : « BOUCLAGE ! » (l'heure limite d'un journal).
- Balle de match : « ÉDITION DÉCISIVE ».
- Égalité : « MORT SUBITE — on ne boucle pas sur une égalité ».
- Fin de match : une fausse une de journal, avec gros titres attribués aux joueurs.

## 3. Direction graphique : l'affiche de sérigraphie

Référence : affiche d'atelier tirée en peu de couleurs, encre épaisse, légèrement hors registre. Pas de dégradés, pas de lueurs, pas de pixel-art.

**Palette** — un papier, une encre, quatre tons directs (un par joueur). Rien d'autre.

| Rôle | Couleur |
|---|---|
| Papier | `#F1E7D3` |
| Papier ombré (trame, repères) | `#DCCFB4` |
| Encre | `#1B1714` |
| Rouge vermillon — joueur ROUGE, **rond** | `#E2432A` |
| Bleu de Prusse — joueur BLEU, **carré** | `#2A56C6` |
| Vert bouteille — joueur VERT, **triangle** | `#1E9A68` |
| Jaune de chrome — joueur JAUNE, **étoile** | `#F2B01E` |

Chaque joueur est identifiable par sa **forme** autant que par sa teinte (daltonisme) : la forme est rappelée partout où la couleur apparaît (score, fil d'événements, mots ROUGE/BLEU/VERT/JAUNE, bandeau des lois, salon).

**Typographie** (licence SIL OFL, fichiers embarqués dans `packages/client/public/polices/`)
- **Anton** — tous les mots du jeu, annonces, titres. Grotesque étroite très grasse, proche des caractères d'affiche en bois : étroite donc INVISIBLE tient dans un emplacement, grasse donc lisible en plein chaos. Toujours en capitales.
- **Courier Prime** — tout le reste (fil d'événements, salon, aides). La machine à écrire du greffier.

**Personnages** — des tampons vus du dessus : une forme pleine (rond, carré, triangle, étoile) à plat de couleur, doublée d'un contour encre *décalé de 3 px* (le « hors registre », signature visuelle du jeu), deux yeux blancs qui regardent dans la direction de marche. Ils laissent des empreintes d'encre qui s'estompent. Fantôme : simple contour pointillé, sans aplat.

**Mots** — des caractères d'imprimerie qu'on porte sur la tête. Une silhouette par famille, pour les reconnaître sans lire :
- COULEUR : étiquette à deux pointes, à l'aplat du joueur, avec sa forme.
- GROUPE (TOUS, LEADER, DERNIER) : pastille aux bouts ronds, aplat encre.
- CHOSE (COURONNE, LAVE, CAISSE, MUR) : plaque rectangulaire encre à filet intérieur.
- PROPRIÉTÉ : fiche papier à filet épais et coin corné.
- Chaque mot porte son icône à gauche.

**Châssis** — la phrase composée en très grand sur le marbre : cadre à la couleur de l'auteur du dernier mot posé, doublé de son hors-registre. La Loi d'or est en négatif (fond encre, `POINTS` gravé en jaune de chrome). Un mot scellé porte un cachet rond à la couleur de l'auteur, avec son décompte. Une loi qui s'arme clignote en négatif au-dessus d'une barre vermillon qui se vide.

**Décor** — le marbre : papier grenu, repères de coupe (`+`) à chaque intersection. LAVE = trame de points vermillon qui ondule ; MUR = aplat encre hachuré ; CAISSE = carton croisé ; COURONNE = couronne jaune, sur son socle ou sur une tête. Une chose visée par une loi en vigueur change de dessin : elle porte l'icône de chaque propriété, et la lave mortelle devient un aplat plein.

**Animations** — tout est un coup de tampon : les annonces s'écrasent à l'écran avec une légère rotation et une éclaboussure, un mot posé ou tombé rebondit, un mot lancé laisse une traîne, les mots qui tombent s'annoncent par une ombre tramée.

**Écran-titre** — le logo composé en cinq caractères de bois dont le « A » a basculé hors de la ligne, sur papier nu, avec les quatre tampons qui traversent l'écran.

**Logo / favicon** — `packages/client/public/logo.svg` et `favicon.svg` : cinq caractères encre, lettres papier, le A penché et vermillon. Favicon : le seul caractère « C » avec son double hors registre.

## 4. Direction sonore

Un atelier, pas un synthé : tout est percussif, sec, mécanique — synthétisé en WebAudio (bruit filtré + ondes courtes).
- Ramasser un mot : cliquet. Le poser dans un châssis : *clac* de bois. Le lancer : souffle. Pousser une caisse : *clac* sourd. Dash : souffle court.
- Une loi s'arme : trois tics rapprochés qui montent. Elle entre en vigueur : coup de presse grave + cloche de machine à écrire.
- Mort : tampon écrasé. Points : petit *ding* (cadence limitée). Mot qui tombe : sifflement puis choc.
- Musique : une boucle de rotative (grosse caisse + cliquetis) et une basse à deux notes. Trois paliers d'intensité : normal, balle de match (contretemps ajoutés), bouclage (tempo +30 %, cloche sur chaque temps).
