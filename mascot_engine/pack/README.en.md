# Uko — Mascot Pack

*Français : `README.md` · Español: `README.es.md`*

Three living stick-figure mascots for your app, on the same skeleton: **Uko** (17 hairstyles), **Aituko** the robot
and **Meowuko** the cat. **9 states**, any colors, light/dark theme.
Two ways to use them:

| | For | File |
|---|---|---|
| **Web engine** | websites and web apps (HTML, React, Vue, Svelte…) | `uko-mascot-engine.js` (≈ 96 KB gzip, zero dependencies) |
| **Rive file** | web, Flutter, iOS, Android, React Native, Unity… | `rive/uko.riv`, `rive/aituko.riv`, `rive/meowuko.riv` + "Uko" state machine |

---

## 1. Web engine

### HTML (Web Component)

```html
<script src="uko-mascot-engine.js"></script>

<uko-mascot state="loading" hair="dreadlocks" brand="#FFFFFF" style="width:240px;height:360px"></uko-mascot>
```

Change an attribute and the mascot reacts (with a natural transition):

```js
document.querySelector('uko-mascot').setAttribute('state', 'success');
```

| Attribute | Values | Default |
|---|---|---|
| `state` | `idle` `welcome` `thinking` `loading` `success` `error` `empty` `sleep` `wake` | `idle` |
| `character` | `uko`, `aituko` (robot), `meowuko` (cat) | `uko` |
| `hair` | see the list of hairstyles (Uko) | `dreadlocks` |
| `brand` | color of the face, hands and feet (`#RRGGBB`) | `#FFFFFF` |
| `hair-color` | hair color | `#0B0B0B` |
| `accent` | color of Aituko's antenna | `#FFC93C` |
| `theme` | `auto` (follows `html.dark` / `data-theme`), `system`, `light`, `dark` | `auto` |
| `contrast` | `auto` (colors adjusted for WCAG contrast) or `direct` | `auto` |
| `interactive` | the mascot follows the cursor and reacts to clicks | `true` |
| `follow` | the eyes follow the mouse: `hover` (over the mascot), `page` (anywhere on the page, and the finger on touch screens), `none` | `hover` |
| `one-shot` | `return` (back to idle after welcome/success/error/empty) or `loop` | `return` |
| `cheeks` | pink cheeks | `true` |
| `walk` | walks in place | `false` |

Events: `statechange`, `complete` (`event.detail.state`) and `tap` (`event.detail.zone`: `head`, `hand_L`, `hand_R`, `foot_L`, `foot_R`, `body`; `event.detail.reaction`).

### Touch

Touch the mascot (mouse or finger): the zone touched reacts, with a small effect. Head: boop, giggle, squint; hand: wave, high five; foot: hop, kick, ouch; body: bounce, tickle, surprise.
Several taps in a row: three on the head make it dizzy; three on the body make it burst out laughing; five anywhere make it jump for joy. Asleep, a tap wakes it up.
From your code: `uko.poke('head')` (or `'hand'`, `'foot'`, `'body'`), with a given reaction if you like: `uko.poke('body', 'joy')`. `interactive="false"` turns touch off.

Gaze: when what it looks at (`lookAt`, or the mouse with `follow="page"`) is far to one side, the mascot turns its body towards it, and turns round if it had its back to it; with an element within reach, it reaches out a hand.

### React

```jsx
import './uko-mascot-engine.js';

export default function Status({ busy, failed }) {
  const state = failed ? 'error' : busy ? 'loading' : 'idle';
  return <uko-mascot state={state} hair="boucles" brand="#FFD6E0" style={{ width: 200, height: 300 }} />;
}
```

### JavaScript

```js
const uko = UkoMascot.create('#mascot', { hairStyle: 'afro', brandColor: '#FFE8A3', theme: 'auto' });

uko.startLoading();            // during a request
uko.resolveSuccess();          // … then the celebration
uko.resolveError();            // … or the error
uko.setState('sleep');         // any state
uko.setHairStyle('chignon');
uko.setBrandColor('#C9F2E1');
uko.setTheme('dark');
uko.destroy();
```

Other methods: `climb({ behind, onDone })` (climb onto the edge it stands on: put its feet line on the edge; `behind: true` = it climbs up the far side, the element hides its body; `onto: 0.3` = it climbs onto a low object in front of it whose top is at 30% of its box height: hands on the top, knee, then standing on it; raise its box by as much in `onDone`), `lookAt(element | { x, y })` (look at an element or a point of the page, `null` to give the gaze back), `setFollow`, `setCharacter`, `setAccentColor`, `wake`, `startWalk(dir, speed)`, `stopWalk`, `setOrientation`, `setHairColor`, `setLineColor`,
`setCheeks`, `setInteractive`, `setOneShotMode`, `setMaxFps`, `pause`, `resume`, `getState`, `getPose`.

### Characters

Same skeleton, same states, same life gestures: only the head changes.

```html
<uko-mascot character="aituko" state="loading" brand="#DDE3FF" accent="#3B5BFF"></uko-mascot>
<uko-mascot character="meowuko" state="success" brand="#FFD9B3"></uko-mascot>
```

JavaScript: `UkoMascot.create('#m', { character: 'meowuko' })`, `uko.setCharacter('aituko')`, list in `UkoMascot.CHARACTERS`.
Hairstyles only apply to Uko.

### Hairstyles

`original` `classique` (classic) `tres_court` (very short) `degrade` (fade) `pixie` `mi_long` (medium) `lisse` (straight)
`ondule` (wavy) `boucles` (curls) `afro` `dreadlocks` `tresses` (braids) `tresses_plaquees` (cornrows) `chignon` (bun)
`queue_de_cheval` (ponytail) `chauve` (bald) `barbe` (beard)

English aliases are accepted: `bald`, `medium`, `fade`, `cornrows`, `ponytail`, `straight`, `wavy`, `curly`, `beard`.

### Accessibility and performance

- `prefers-reduced-motion` is respected (still poses, no effects).
- The animation pauses when the tab is hidden. `setMaxFps(30)` for very busy pages.
- Off screen (scrolled away, `display: none`), a mascot redraws only 4 times per second; its states and moves carry on. Detailed hairstyles lighten themselves when small (under ~200 screen pixels wide), with no visible difference.
- Size: web engine 328 KB raw, **≈ 96 KB gzip**. Rive files: uko.riv 136 · aituko.riv 134 · meowuko.riv 136 KB. With Rive, also count your platform's runtime (web: `@rive-app/canvas`, ≈ 100 KB gzip of JS + ≈ 760 KB gzip of wasm, loaded once for all mascots).
- Each instance is independent: put as many mascots on a page as you like.

---

## 2. Rive files (`rive/*.riv`)

- One file per character: `uko.riv`, `aituko.riv`, `meowuko.riv`, about 135 KB each. Artboard named after
  the character (1024 × 1536) and state machine **`Uko`** in all three, with the same inputs:
  switching characters means switching files.
- Bone rig (body → arm → forearm → hand, body → thigh → shin → foot, head → gaze):
  the animations rotate bones instead of moving every line.
- 32 animations in each file (plus Aituko's and Meowuko's own loops), including 15 life gestures (looking around, shrugging, tilting the head,
  scratching the head, glancing at the progress, sighing…). In each background state the machine
  chains them with varied pauses: the mascot never freezes. Plus a blink layer
  (and, for Aituko and Meowuko, the spring antenna, a twitching ear, the tail).

| Input | Type | Role |
|---|---|---|
| `state` | Number | background state: `0` idle · `1` thinking · `2` loading · `3` sleep (waking up plays on its own) |
| `welcome` | Trigger | hello |
| `success` | Trigger | celebration (from loading: dedicated transition) |
| `error` | Trigger | error (from loading: dedicated transition) |
| `empty` | Trigger | empty state |

After a successful load: set `state = 0` **and** fire `success` at the same time.

**Colors** (data binding): view model `Appearance` with `bodyColor`, `lineColor`, `hairColor` (+ `accentColor` in `aituko.riv`).
With the web runtime: `new Rive({ …, autoBind: true })`, then `rive.viewModelInstance.color('bodyColor').value = 0xFFFFD6E0`.

### Web

```js
import { Rive } from '@rive-app/canvas';

const uko = new Rive({
  src: 'uko.riv', canvas: document.querySelector('canvas'),
  stateMachines: 'Uko', autoplay: true, autoBind: true,
  onLoad: () => uko.resizeDrawingSurfaceToCanvas(),
});
const input = (n) => uko.stateMachineInputs('Uko').find(i => i.name === n);
input('state').value = 2;   // loading
input('success').fire();
```

Complete examples in `examples/`: web, React, Flutter, iOS (Swift), Android (Kotlin).

> Rive has announced that *state machine inputs* will eventually be replaced by data binding.
> They work in all current runtimes; an updated file will follow if needed.

---

## License

Unlimited commercial use, no resale or redistribution of the files: see `LICENSE.md` (French; it prevails over any translation).
Support: the address shown on your receipt.
