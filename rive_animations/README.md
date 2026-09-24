# Construire les mascottes dans l'éditeur Rive

Le fichier `.riv` fait à la main dans l'éditeur Rive devient la **source** de chaque mascotte. Le moteur
web (`mascot_engine/`) ne sert plus que de référence visuelle : on ne génère plus de `.riv` par script.

Pourquoi : les `.riv` actuels (`landing_page/rive/*.riv`, ~137 Ko chacun) sont fabriqués par
`mascot_engine/rive/build_uko_rive.cjs`, qui enregistre le moteur **image par image** (30 images/s, une trentaine
de clips). Un rig fait dans l'éditeur, avec des images clés sur les poses seulement, vise **moins de 40 Ko**,
et reste modifiable par n'importe qui dans l'éditeur.

## Le kit

| Fichier | Contenu |
|---|---|
| `import/uko.svg`, `import/aituko.svg`, `import/meowuko.svg` | Pose de repos, prête à importer : hiérarchie déjà articulée, calques nommés, les 7 expressions |
| `reference/uko-poses.png` | Chaque état joué par le moteur actuel, échantillonné dans le temps : la référence pour animer |
| `reference/<personnage>-expressions.png` | Les 7 visages de chaque personnage |
| `CONTRACT.json` | Ce que chaque `.riv` doit exposer (artboard, machine à états, View Model, événements, budget) |
| `build_rive_kit.cjs` | Régénère le kit depuis le moteur (seulement si le dessin du moteur change) |

`specs/` est l'ancienne proposition (v1) ; elle est remplacée par ce kit et `CONTRACT.json` v2.

### Hiérarchie des SVG

Chaque articulation est un groupe dont l'origine est **sur** l'articulation (translation seule). Tourner un
groupe plie donc le membre au bon endroit, sans rien replacer :

```
root (bassin)
├── tail                       Meowuko
├── thigh_L → shin_L → foot_L  L/R = gauche/droite de l'écran
├── thigh_R → shin_R → foot_R
└── spine
    └── neck
        ├── upperArm_L → foreArm_L → hand_L
        ├── upperArm_R → foreArm_R → hand_R
        └── head (centre de la tête)
            ├── ears/ear_L, ear_R           Meowuko (pivot à la base de l'oreille)
            ├── robot/antenna, bolts, screen Aituko (pivot de l'antenne à sa base)
            ├── head_shape, hair
            ├── faces/face_idle … face_sleep (seul face_idle est visible)
            └── muzzle                       Meowuko (nez, moustaches)
```

Toutes les couleurs sont des attributs explicites (ce que l'import SVG de Rive lit le mieux) :
blanc `#FFFFFF`, trait `#16161D`, joues `#F6A7B7`, accent `#FFC93C`, écran `#1C2033`, LED `#6CF0E0`.

## Étapes dans l'éditeur

1. **Importer.** Nouveau fichier, artboard `Mascot` en 1024 × 1536, glisser `import/uko.svg`. Vérifier que les
   noms de groupes (`thigh_L`, `head`, `face_idle`…) et leurs origines sont conservés. C'est à valider au premier
   import : je n'ai pas pu tester l'éditeur moi-même.
2. **Rig.**
   - Bras et tête : rotation des groupes (FK), ça suffit.
   - Jambes : ajouter une chaîne d'os hanche → genou → cheville avec une contrainte **IK** vers une cible au pied,
     pour que les pieds restent plantés quand le bassin bouge. Placer les os sur les origines des groupes et y
     rattacher les formes.
   - Pas de déformation de sommets (skinning) : des traits droits à bouts ronds se plient proprement par rotation.
3. **Expressions.** Passer le groupe `faces` en **Solo** : une seule expression visible à la fois, l'expression
   active est une valeur qu'on anime (un seul keyframe par changement). Clignement : échelle Y des yeux.
4. **Animations.** Une par entrée de `CONTRACT.json › animations`, en suivant `reference/uko-poses.png`.
   Images clés sur les poses marquantes seulement (souvent 3 à 6 par action), courbes d'accélération plutôt que des
   images intermédiaires. Accessoires (ordinateur de loading, étincelles, bulle, Zzz) : les dessiner dans
   l'éditeur, voir les planches.
5. **Machine à états `Mascot`.** Couches `Body`, `Face`, `Blink`, `Gaze`, `Life`, `Decor` (détail dans le
   contrat). Transitions de `Body` conditionnées par la propriété `state` du View Model. Les actions ponctuelles
   reviennent seules à `Idle` et émettent l'événement `actionDone`. Mixer les transitions (≈ 0,3 s) plutôt que
   d'animer des images de passage.
6. **View Model `Mascot`.** Créer les propriétés du contrat et relier les couleurs par Data Binding (tous les
   remplissages blancs → `bodyColor`, tous les traits → `lineColor`, etc.).
7. **Aituko et Meowuko.** Dupliquer le fichier d'Uko, remplacer le contenu du groupe `head` par celui du SVG du
   personnage (et ajouter la queue) : squelette, animations et machine à états restent les mêmes.
8. **Exporter** `uko.riv`, `aituko.riv`, `meowuko.riv` et garder le fichier source de l'éditeur (`.rev`) :
   c'est lui qu'on modifiera ensuite. Contrôler le poids : `ls -l *.riv` sous 40 Ko.

## Après l'export (côté site)

- Remplacer `landing_page/rive/*.riv` et adapter `landing_page/js/uko-rive-demo.js` au nouveau contrat
  (artboard/machine `Mascot`, propriété `state` au lieu des anciennes entrées).
- Passer au runtime léger `@rive-app/canvas-lite` : aujourd'hui `rive.wasm` (1,9 Mo) + `rive.js` (450 Ko) pèsent
  bien plus lourd que les mascottes elles-mêmes, c'est là que se joue la fluidité sur mobile.
- Retirer l'ancienne chaîne de génération (`mascot_engine/rive/`, `test_rive_parity.cjs`) une fois les nouveaux
  fichiers validés.

## Régénérer le kit

```bash
npm install
UKO_SITE_URL=https://uko-mascot.pages.dev node mascot_engine/build_mascot_engine.js --debug
node rive_animations/build_rive_kit.cjs
# sans Chrome fourni par puppeteer : PUPPETEER_EXECUTABLE_PATH=/chemin/vers/chrome node rive_animations/build_rive_kit.cjs
```
