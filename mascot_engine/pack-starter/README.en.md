# Uko Starter — free

*Français : `README.md` · Español: `README.es.md`*

Uko, Aituko the robot and Meowuko the cat, free edition: **3 mascots**, **4 states**, 17 hairstyles for Uko,
any colors, light or dark theme. Try them in your app, and keep them in production if you like: that is allowed
(see `LICENSE.md`; the French text of the license prevails).

| | For | File |
|---|---|---|
| **Web engine** | websites and web apps (HTML, React, Vue, Svelte…) | `uko-mascot-engine.js` (zero dependencies) |
| **Rive file** | web, Flutter, iOS, Android, React Native… | `rive/uko.riv`, `rive/aituko.riv`, `rive/meowuko.riv` + "Uko" state machine |

## Starter or full pack

| | Starter (free) | Full pack |
|---|---|---|
| Mascots | Uko, Aituko, Meowuko | same |
| States | `idle` `welcome` `loading` `success` | those 4 + `thinking` `error` `empty` `sleep` `wake` |
| Hairstyles, colors, theme | 17 hairstyles, any colors | same |
| Rive files | 4 states | 9 states |
| Movements: walk, turn around, climb `climb()` | — | yes |
| Gaze: follows the mouse on hover | yes | yes |
| Gaze over the whole page (`follow="page"`, finger on mobile), `lookAt()` | — | yes |
| Commercial use | yes | yes |

**Moving to the full pack**: replace `uko-mascot-engine.js` and the `rive/*.riv` files with the pack's files. Your code does not change.
If your code already asks for a full-pack state or movement (for example `error`, `climb()`, `lookAt()`), Uko stays in its current state
and the console says where to get it: nothing breaks.

Full pack: {{SITE_URL}}/en/#prix

---

## 1. Web engine

```html
<script src="uko-mascot-engine.js"></script>

<uko-mascot state="loading" hair="afro" brand="#FFD6E0" style="width:240px;height:360px"></uko-mascot>
```

Change an attribute and the mascot reacts, with a natural transition:

```js
document.querySelector('uko-mascot').setAttribute('state', 'success');
```

| Attribute | Values | Default |
|---|---|---|
| `state` | `idle` `welcome` `loading` `success` | `idle` |
| `character` | `uko`, `aituko` (robot), `meowuko` (cat) | `uko` |
| `hair` | see the list of hairstyles (Uko) | `dreadlocks` |
| `brand` | color of the face, hands and feet (`#RRGGBB`) | `#FFFFFF` |
| `hair-color` | hair color | `#0B0B0B` |
| `accent` | color of Aituko's antenna | `#FFC93C` |
| `theme` | `auto` (follows `html.dark` / `data-theme`), `system`, `light`, `dark` | `auto` |
| `contrast` | `auto` (colors adjusted for WCAG contrast) or `direct` | `auto` |
| `interactive` | the mascot follows the cursor and reacts to clicks | `true` |
| `one-shot` | `return` (back to idle after welcome or success) or `loop` | `return` |
| `cheeks` | pink cheeks | `true` |

Events: `statechange`, `complete` (`event.detail.state`) and `tap` (`event.detail.zone`: `head`, `hand_L`, `hand_R`, `foot_L`, `foot_R`, `body`; `event.detail.reaction`).

### Touch

Touch the mascot (mouse or finger): the zone touched reacts, with a small effect. Head: boop, giggle, squint; hand: wave, high five; foot: hop, kick, ouch; body: bounce, tickle, surprise.
Several taps in a row: three on the head make it dizzy; three on the body make it burst out laughing; five anywhere make it jump for joy. Asleep, a tap wakes it up.
From your code: `uko.poke('head')` (or `'hand'`, `'foot'`, `'body'`), with a given reaction if you like: `uko.poke('body', 'joy')`. `interactive="false"` turns touch off.

In every background state Uko breathes, shifts its weight and makes small gestures on its own
(looking around, shrugging, checking the progress while loading…): it never freezes.

### React

```jsx
import './uko-mascot-engine.js';

export default function Status({ busy, done }) {
  const state = busy ? 'loading' : done ? 'success' : 'idle';
  return <uko-mascot state={state} hair="boucles" brand="#FFD6E0" style={{ width: 200, height: 300 }} />;
}
```

### JavaScript

```js
const uko = UkoMascot.create('#mascot', { hairStyle: 'afro', brandColor: '#FFE8A3', theme: 'auto' });

uko.startLoading();            // during a request
uko.resolveSuccess();          // … then the celebration
uko.setState('welcome');
uko.setHairStyle('chignon');
uko.setBrandColor('#C9F2E1');
uko.destroy();
```

`UkoMascot.edition` is `"starter"` and `UkoMascot.ORDER` lists the available states.

### Characters

Same skeleton, same states, same life gestures: only the head changes.

```html
<uko-mascot character="aituko" state="loading" brand="#DDE3FF" accent="#3B5BFF"></uko-mascot>
<uko-mascot character="meowuko" state="success" brand="#FFD9B3"></uko-mascot>
```

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
- Size: web engine 298 KB raw, **≈ 89 KB gzip**. Rive files: uko.riv 74 · aituko.riv 72 · meowuko.riv 73 KB. With Rive, also count your platform's runtime (web: `@rive-app/canvas`, ≈ 100 KB gzip of JS + ≈ 760 KB gzip of wasm, loaded once for all mascots).

---

## 2. Rive files (`rive/*.riv`)

- One file per character: `uko.riv`, `aituko.riv`, `meowuko.riv`, about 75 KB each, rigged with bones.
  State machine **`Uko`** and the same inputs in all three: switching characters means switching files.
- While idle and loading, the machine chains small life gestures (looking around, shrugging,
  checking the progress…): Uko never freezes. Plus a blink layer.

| Input | Type | Role |
|---|---|---|
| `state` | Number | `0` idle · `2` loading |
| `welcome` | Trigger | hello |
| `success` | Trigger | celebration (from loading: dedicated transition) |

After a successful load: set `state = 0` **and** fire `success` at the same time.
The numbers are the full pack's (which adds `1` thinking, `3` sleep, and the `error`, `empty` triggers).

**Colors** (data binding): view model `Appearance` with `bodyColor`, `lineColor`, `hairColor` (+ `accentColor` in `aituko.riv`).

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

Examples in `examples/`: web, React, Flutter, iOS (Swift), Android (Kotlin).

---

## License

Free, commercial use included, no resale or redistribution of the files: see `LICENSE.md` (French; it prevails over any translation).
