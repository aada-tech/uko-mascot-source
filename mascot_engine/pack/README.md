# Uko — Mascot Pack

*English: `README.en.md` · Español: `README.es.md`*

Trois mascottes stickman vivantes pour ton app, sur le même squelette : **Uko** (17 coiffures), **Aituko** le robot
et **Meowuko** le chat. **9 états**, couleurs libres, thème clair/sombre.
Deux façons de les utiliser :

| | Pour qui | Fichier |
|---|---|---|
| **Moteur web** | sites et apps web (HTML, React, Vue, Svelte…) | `uko-mascot-engine.min.js` (≈ 58 Ko gzip, zéro dépendance) ; `uko-mascot-engine.js` = le même, lisible |
| **Fichier Rive** | web, Flutter, iOS, Android, React Native, Unity… | `rive/uko.riv`, `rive/aituko.riv`, `rive/meowuko.riv` + machine à états « Uko » |

## Ce que tu reçois

- `uko-mascot-engine.min.js` : le moteur web à charger dans ton site ou ton app.
- `uko-mascot-engine.js` : le même code, lisible : pour le comprendre ou le donner à ton assistant de code.
- `rive/uko.riv`, `rive/aituko.riv`, `rive/meowuko.riv` : les mêmes mascottes pour iOS, Android, Flutter, React Native et le web.
- `examples/` : un exemple prêt à ouvrir par plateforme.
- `AI-PROMPT.md` : le prompt pour adapter la mascotte à ton app avec l'IA.

**C'est une base.** Les 9 états, les mouvements et le regard marchent tels quels. Ce qui est propre à ton app
(à quel moment la mascotte réagit, où elle se place, un comportement sur mesure comme grimper sur un formulaire)
se branche avec quelques lignes de code : colle le prompt de `AI-PROMPT.md` dans ton assistant de code
(Claude, ChatGPT, Cursor, Copilot…), il le fait pour toi.

---

## 1. Moteur web

### HTML (Web Component)

```html
<script src="uko-mascot-engine.min.js"></script>

<uko-mascot state="loading" hair="dreadlocks" brand="#FFFFFF" style="width:240px;height:360px"></uko-mascot>
```

Change un attribut, la mascotte réagit (avec une transition naturelle) :

```js
document.querySelector('uko-mascot').setAttribute('state', 'success');
```

| Attribut | Valeurs | Défaut |
|---|---|---|
| `state` | `idle` `welcome` `thinking` `loading` `success` `error` `empty` `sleep` `wake` | `idle` |
| `character` | `uko`, `aituko` (robot), `meowuko` (chat) | `uko` |
| `hair` | voir la liste des coiffures (Uko) | `dreadlocks` |
| `brand` | couleur du visage, des mains et des pieds (`#RRGGBB`) | `#FFFFFF` |
| `hair-color` | couleur des cheveux | `#0B0B0B` |
| `accent` | couleur de l'antenne d'Aituko | `#FFC93C` |
| `theme` | `auto` (suit `html.dark` / `data-theme`), `system`, `light`, `dark` | `auto` |
| `contrast` | `auto` (couleurs ajustées pour le contraste WCAG) ou `direct` | `auto` |
| `interactive` | la mascotte suit le curseur et réagit au clic | `true` |
| `follow` | les yeux suivent la souris : `hover` (au survol), `page` (partout sur la page, et le doigt sur mobile), `none` | `hover` |
| `one-shot` | `return` (revient à idle après welcome/success/error/empty) ou `loop` | `return` |
| `cheeks` | joues roses | `true` |
| `walk` | marche en place | `false` |

Événements : `statechange`, `complete` (`event.detail.state`) et `tap` (`event.detail.zone` : `head`, `hand_L`, `hand_R`, `foot_L`, `foot_R`, `body` ; `event.detail.reaction`).

### Toucher

Touche la mascotte (souris ou doigt) : la zone touchée réagit, avec un petit effet. Tête : boop, fou rire, grimace ; main : coucou, tope-là ; pied : petit saut, coup de pied, aïe ; corps : rebond, chatouilles, surprise.
Plusieurs touches de suite : trois sur la tête, elle a la tête qui tourne ; trois sur le corps, elle rit aux éclats ; cinq n'importe où, elle saute de joie. Endormie, un tap la réveille.
Depuis ton code : `uko.poke('head')` (ou `'hand'`, `'foot'`, `'body'`), avec une réaction précise si tu veux : `uko.poke('body', 'joy')`. `interactive="false"` désactive le toucher.

Regard : quand ce qu'elle regarde (`lookAt`, ou la souris avec `follow="page"`) est loin sur le côté, la mascotte tourne le corps vers lui, et se retourne si elle lui tournait le dos ; un élément à portée de main, elle tend la main vers lui.

### React

```jsx
import './uko-mascot-engine.min.js';

export default function Status({ busy, failed }) {
  const state = failed ? 'error' : busy ? 'loading' : 'idle';
  return <uko-mascot state={state} hair="boucles" brand="#FFD6E0" style={{ width: 200, height: 300 }} />;
}
```

### JavaScript

```js
const uko = UkoMascot.create('#mascot', { hairStyle: 'afro', brandColor: '#FFE8A3', theme: 'auto' });

uko.startLoading();            // pendant une requête
uko.resolveSuccess();          // … puis la célébration
uko.resolveError();            // … ou l'erreur
uko.setState('sleep');         // n'importe quel état
uko.setHairStyle('chignon');
uko.setBrandColor('#C9F2E1');
uko.setTheme('dark');
uko.destroy();
```

Autres méthodes : `climb({ behind, onDone })` (se hisser sur le bord où il se tient : place la ligne de ses pieds sur le bord ; `behind: true` = il grimpe par l'arrière, l'élément cache son corps ; `onto: 0.3` = il grimpe sur un objet bas placé devant lui, dont le dessus est à 30 % de la hauteur de sa boîte : mains sur le dessus, genou, puis debout dessus ; remonte sa boîte d'autant dans `onDone`), `lookAt(élément | { x, y })` (regarder un élément ou un point de la page, `null` pour rendre le regard), `setFollow`, `setCharacter`, `setAccentColor`, `wake`, `startWalk(dir, speed)`, `stopWalk`, `setOrientation`, `setHairColor`, `setLineColor`,
`setCheeks`, `setInteractive`, `setOneShotMode`, `setMaxFps`, `pause`, `resume`, `getState`, `getPose`.

### Personnages

Même squelette, mêmes états, mêmes gestes de vie : seule la tête change.

```html
<uko-mascot character="aituko" state="loading" brand="#DDE3FF" accent="#3B5BFF"></uko-mascot>
<uko-mascot character="meowuko" state="success" brand="#FFD9B3"></uko-mascot>
```

JavaScript : `UkoMascot.create('#m', { character: 'meowuko' })`, `uko.setCharacter('aituko')`, liste dans `UkoMascot.CHARACTERS`.
Les coiffures ne concernent qu'Uko.

### Coiffures

`original` `classique` `tres_court` `degrade` `pixie` `mi_long` `lisse` `ondule` `boucles` `afro` `dreadlocks`
`tresses` `tresses_plaquees` `chignon` `queue_de_cheval` `chauve` `barbe`

Alias anglais acceptés : `bald`, `medium`, `fade`, `cornrows`, `ponytail`, `straight`, `wavy`, `curly`, `beard`.

### Accessibilité et performance

- `prefers-reduced-motion` est respecté (poses fixes, pas d'effets).
- L'animation se met en pause quand l'onglet est caché. `setMaxFps(30)` pour les pages très chargées.
- Hors de l'écran (page défilée, `display: none`), une mascotte ne se redessine que 4 fois par seconde ; ses états et mouvements continuent. Les coiffures détaillées s'allègent toutes seules en petit (moins de ~200 pixels d'écran de large), sans différence visible.
- Poids : moteur web **≈ 58 Ko gzip** (`uko-mascot-engine.min.js`, 175 Ko brut ; la version lisible fait 333 Ko). Fichiers Rive : uko.riv 136 · aituko.riv 134 · meowuko.riv 136 Ko. Côté Rive, compte aussi le runtime de ta plateforme, chargé une fois pour toutes les mascottes ; sur le web, prends `@rive-app/canvas-lite` (≈ 95 Ko gzip de JS + ≈ 360 Ko gzip de wasm) plutôt que `@rive-app/canvas` (≈ 800 Ko gzip de wasm) : il suffit pour ces fichiers.
- Chaque instance est indépendante : autant de mascottes que tu veux sur une page.

---

## 2. Fichiers Rive (`rive/*.riv`)

- Un fichier par personnage : `uko.riv`, `aituko.riv`, `meowuko.riv`, environ 135 Ko chacun. Artboard au nom
  du personnage (1024 × 1536) et machine à états **`Uko`** dans les trois, avec les mêmes entrées :
  changer de personnage revient à changer de fichier.
- Rig à os (corps → bras → avant-bras → main, corps → cuisse → tibia → pied, tête → regard) :
  les animations tournent des os au lieu de déplacer chaque trait.
- 32 animations dans chaque fichier (plus les boucles propres à Aituko et Meowuko), dont 15 gestes de vie (regarder autour, hausser les épaules, pencher la tête,
  se gratter la tête, jeter un œil au chargement, soupirer…). Dans chaque état de fond, la machine
  les enchaîne avec des attentes variées : la mascotte ne reste jamais figée. Plus une couche de clignement
  (et, pour Aituko et Meowuko, l'antenne sur ressort, une oreille qui frémit, la queue).

| Entrée | Type | Rôle |
|---|---|---|
| `state` | Number | état de fond : `0` idle · `1` thinking · `2` loading · `3` sleep (le réveil joue tout seul) |
| `welcome` | Trigger | salut |
| `success` | Trigger | célébration (depuis loading : enchaînement dédié) |
| `error` | Trigger | erreur (depuis loading : enchaînement dédié) |
| `empty` | Trigger | état vide |

Après un chargement réussi : mets `state = 0` **et** déclenche `success` en même temps.

**Couleurs** (data binding) : view model `Appearance` avec `bodyColor`, `lineColor`, `hairColor` (+ `accentColor` dans `aituko.riv`).
Avec le runtime web : `new Rive({ …, autoBind: true })`, puis `rive.viewModelInstance.color('bodyColor').value = 0xFFFFD6E0`.

### Web

```js
import { Rive } from '@rive-app/canvas-lite';

const uko = new Rive({
  src: 'uko.riv', canvas: document.querySelector('canvas'),
  stateMachines: 'Uko', autoplay: true, autoBind: true,
  onLoad: () => uko.resizeDrawingSurfaceToCanvas(),
});
const input = (n) => uko.stateMachineInputs('Uko').find(i => i.name === n);
input('state').value = 2;   // loading
input('success').fire();
```

Exemples complets dans `examples/` : web, React, Flutter, iOS (Swift), Android (Kotlin).

> Rive annonce que les *state machine inputs* seront remplacés à terme par le data binding.
> Ils fonctionnent dans tous les runtimes actuels ; une mise à jour du fichier suivra si nécessaire.

---

## Licence

Usage commercial illimité, sans revente ni redistribution des fichiers : voir `LICENSE.md`.

