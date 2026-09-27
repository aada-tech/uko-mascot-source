# Uko — Mascot Pack

*Français : `README.md` · English: `README.en.md`*

Tres mascotas de palitos con vida para tu app, sobre el mismo esqueleto: **Uko** (17 peinados), **Aituko** el robot
y **Meowuko** el gato. **9 estados**, colores libres, tema claro/oscuro.
Dos formas de usarlas:

| | Para | Archivo |
|---|---|---|
| **Motor web** | sitios y apps web (HTML, React, Vue, Svelte…) | `uko-mascot-engine.min.js` (≈ 58 KB gzip, cero dependencias); `uko-mascot-engine.js` = el mismo, legible |
| **Archivo Rive** | web, Flutter, iOS, Android, React Native, Unity… | `rive/uko.riv`, `rive/aituko.riv`, `rive/meowuko.riv` + máquina de estados «Uko» |

## Qué recibes

- `uko-mascot-engine.min.js`: el motor web para cargar en tu sitio o tu app.
- `uko-mascot-engine.js`: el mismo código, legible: para entenderlo o dárselo a tu asistente de código.
- `rive/uko.riv`, `rive/aituko.riv`, `rive/meowuko.riv`: las mismas mascotas para iOS, Android, Flutter, React Native y la web.
- `examples/`: un ejemplo listo para abrir por plataforma.
- `AI-PROMPT.md`: el prompt para adaptar la mascota a tu app con IA.

**Es una base.** Los 9 estados, los movimientos y la mirada funcionan tal cual. Lo propio de tu app
(cuándo reacciona la mascota, dónde se coloca, un comportamiento a medida como trepar a un formulario)
se conecta con unas pocas líneas de código: pega el prompt de `AI-PROMPT.md` en tu asistente de código
(Claude, ChatGPT, Cursor, Copilot…) y lo hace por ti.

---

## 1. Motor web

### HTML (Web Component)

```html
<script src="uko-mascot-engine.min.js"></script>

<uko-mascot state="loading" hair="dreadlocks" brand="#FFFFFF" style="width:240px;height:360px"></uko-mascot>
```

Cambia un atributo y la mascota reacciona (con una transición natural):

```js
document.querySelector('uko-mascot').setAttribute('state', 'success');
```

| Atributo | Valores | Por defecto |
|---|---|---|
| `state` | `idle` `welcome` `thinking` `loading` `success` `error` `empty` `sleep` `wake` | `idle` |
| `character` | `uko`, `aituko` (robot), `meowuko` (gato) | `uko` |
| `hair` | ver la lista de peinados (Uko) | `dreadlocks` |
| `brand` | color de la cara, las manos y los pies (`#RRGGBB`) | `#FFFFFF` |
| `hair-color` | color del pelo | `#0B0B0B` |
| `accent` | color de la antena de Aituko | `#FFC93C` |
| `theme` | `auto` (sigue `html.dark` / `data-theme`), `system`, `light`, `dark` | `auto` |
| `contrast` | `auto` (colores ajustados al contraste WCAG) o `direct` | `auto` |
| `interactive` | la mascota sigue el cursor y reacciona al clic | `true` |
| `follow` | los ojos siguen el ratón: `hover` (al pasar por encima), `page` (en toda la página, y el dedo en móvil), `none` | `hover` |
| `one-shot` | `return` (vuelve a idle tras welcome/success/error/empty) o `loop` | `return` |
| `cheeks` | mejillas rosas | `true` |
| `walk` | camina en el sitio | `false` |

Eventos: `statechange`, `complete` (`event.detail.state`) y `tap` (`event.detail.zone`: `head`, `hand_L`, `hand_R`, `foot_L`, `foot_R`, `body`; `event.detail.reaction`).

### Tocar

Toca la mascota (ratón o dedo): la zona tocada reacciona, con un pequeño efecto. Cabeza: boop, risita, mueca; mano: saludo, choca esos cinco; pie: saltito, patada, ay; cuerpo: rebote, cosquillas, sorpresa.
Varios toques seguidos: tres en la cabeza y se marea; tres en el cuerpo y se parte de risa; cinco en cualquier sitio y salta de alegría. Dormida, un toque la despierta.
Desde tu código: `uko.poke('head')` (o `'hand'`, `'foot'`, `'body'`), con una reacción concreta si quieres: `uko.poke('body', 'joy')`. `interactive="false"` desactiva el tacto.

Mirada: cuando lo que mira (`lookAt`, o el ratón con `follow="page"`) está lejos a un lado, la mascota gira el cuerpo hacia ello, y se da la vuelta si le daba la espalda; con un elemento al alcance de la mano, la tiende hacia él.

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

uko.startLoading();            // durante una petición
uko.resolveSuccess();          // … y luego la celebración
uko.resolveError();            // … o el error
uko.setState('sleep');         // cualquier estado
uko.setHairStyle('chignon');
uko.setBrandColor('#C9F2E1');
uko.setTheme('dark');
uko.destroy();
```

Otros métodos: `climb({ behind, onDone })` (subirse al borde sobre el que está: pon la línea de sus pies en el borde; `behind: true` = sube por detrás, el elemento oculta su cuerpo; `onto: 0.3` = trepa a un objeto bajo delante de ella cuya parte superior está al 30 % de la altura de su caja: manos encima, rodilla y de pie encima; sube su caja lo mismo en `onDone`), `lookAt(elemento | { x, y })` (mirar un elemento o un punto de la página, `null` para devolver la mirada), `setFollow`, `setCharacter`, `setAccentColor`, `wake`, `startWalk(dir, speed)`, `stopWalk`, `setOrientation`, `setHairColor`, `setLineColor`,
`setCheeks`, `setInteractive`, `setOneShotMode`, `setMaxFps`, `pause`, `resume`, `getState`, `getPose`.

### Personajes

Mismo esqueleto, mismos estados, mismos gestos de vida: solo cambia la cabeza.

```html
<uko-mascot character="aituko" state="loading" brand="#DDE3FF" accent="#3B5BFF"></uko-mascot>
<uko-mascot character="meowuko" state="success" brand="#FFD9B3"></uko-mascot>
```

JavaScript: `UkoMascot.create('#m', { character: 'meowuko' })`, `uko.setCharacter('aituko')`, lista en `UkoMascot.CHARACTERS`.
Los peinados solo se aplican a Uko.

### Peinados

`original` `classique` (clásico) `tres_court` (muy corto) `degrade` (degradado) `pixie` `mi_long` (media melena) `lisse` (liso)
`ondule` (ondulado) `boucles` (rizos) `afro` `dreadlocks` (rastas) `tresses` (trenzas) `tresses_plaquees` (trenzas pegadas)
`chignon` (moño) `queue_de_cheval` (coleta) `chauve` (calvo) `barbe` (barba)

También se aceptan alias en inglés: `bald`, `medium`, `fade`, `cornrows`, `ponytail`, `straight`, `wavy`, `curly`, `beard`.

### Accesibilidad y rendimiento

- Se respeta `prefers-reduced-motion` (poses fijas, sin efectos).
- La animación se pausa cuando la pestaña está oculta. `setMaxFps(30)` para páginas muy cargadas.
- Fuera de la pantalla (página desplazada, `display: none`), una mascota solo se redibuja 4 veces por segundo; sus estados y movimientos siguen. Los peinados detallados se aligeran solos en tamaño pequeño (menos de ~200 píxeles de pantalla de ancho), sin diferencia visible.
- Peso: motor web **≈ 58 KB gzip** (`uko-mascot-engine.min.js`, 175 KB sin comprimir; la versión legible pesa 333 KB). Archivos Rive: uko.riv 136 · aituko.riv 134 · meowuko.riv 136 KB. Con Rive, cuenta también el runtime de tu plataforma, cargado una vez para todas las mascotas; en la web, usa `@rive-app/canvas-lite` (≈ 95 KB gzip de JS + ≈ 360 KB gzip de wasm) en lugar de `@rive-app/canvas` (≈ 800 KB gzip de wasm): es todo lo que necesitan estos archivos.
- Cada instancia es independiente: pon tantas mascotas como quieras en una página.

---

## 2. Archivos Rive (`rive/*.riv`)

- Un archivo por personaje: `uko.riv`, `aituko.riv`, `meowuko.riv`, unos 135 KB cada uno. Artboard con el
  nombre del personaje (1024 × 1536) y máquina de estados **`Uko`** en los tres, con las mismas entradas:
  cambiar de personaje es cambiar de archivo.
- Rig con huesos (cuerpo → brazo → antebrazo → mano, cuerpo → muslo → tibia → pie, cabeza → mirada):
  las animaciones giran huesos en lugar de mover cada trazo.
- 32 animaciones en cada archivo (más los bucles propios de Aituko y Meowuko), de ellas 15 gestos de vida (mirar alrededor, encogerse de hombros, inclinar la cabeza,
  rascarse la cabeza, mirar la carga, suspirar…). En cada estado de fondo la máquina
  los encadena con pausas variadas: la mascota nunca se queda congelada. Más una capa de parpadeo
  (y, para Aituko y Meowuko, la antena con muelle, una oreja que se mueve, la cola).

| Entrada | Tipo | Función |
|---|---|---|
| `state` | Number | estado de fondo: `0` idle · `1` thinking · `2` loading · `3` sleep (el despertar se reproduce solo) |
| `welcome` | Trigger | saludo |
| `success` | Trigger | celebración (desde loading: transición dedicada) |
| `error` | Trigger | error (desde loading: transición dedicada) |
| `empty` | Trigger | estado vacío |

Tras una carga correcta: pon `state = 0` **y** dispara `success` a la vez.

**Colores** (data binding): view model `Appearance` con `bodyColor`, `lineColor`, `hairColor` (+ `accentColor` en `aituko.riv`).
Con el runtime web: `new Rive({ …, autoBind: true })`, y luego `rive.viewModelInstance.color('bodyColor').value = 0xFFFFD6E0`.

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

Ejemplos completos en `examples/`: web, React, Flutter, iOS (Swift), Android (Kotlin).

> Rive ha anunciado que los *state machine inputs* se sustituirán con el tiempo por el data binding.
> Funcionan en todos los runtimes actuales; si hace falta, llegará una actualización del archivo.

---

## Licencia

Uso comercial ilimitado, sin reventa ni redistribución de los archivos: ver `LICENSE.md` (en francés; prevalece sobre cualquier traducción).
Soporte: la dirección indicada en tu recibo.
