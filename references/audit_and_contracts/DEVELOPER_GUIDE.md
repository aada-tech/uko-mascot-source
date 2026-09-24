# 📦 Uko Mascot UI Kit — Guide Développeur & Intégration

Bienvenue dans le pack officiel des mascottes **Uko**. Ce kit a été conçu pour permettre aux développeurs, vibe coders et équipes produit d'intégrer des micro-interactions 3D fluides, légères et cohérentes dans leurs applications web et mobiles en quelques secondes.

---

## 💎 Ce que ce package apporte concrètement (Factuel & Vérifié)

1. **Cohérence Visuelle Absolue (12 États Harmonégéniques)** :
   - Chaque mascotte conserve strictement la même morphologie, palette de couleurs et éclairage sur l'ensemble de ses 12 états (Repos, Accueil, Victoire, Réflexion, Erreur 404, Validation, Sommeil, Guidage, Recherche, Chargement, Idée, Sécurité, Au Revoir).
   - Zéro dérive de style entre les poses.

2. **6 Formats Médias Optimisés par État** :
   - `lottie.json` : Format vectoriel JSON standard Bodymovin (Airbnb / LottieFiles). Ultra-léger (~8-14 Ko par animation), résolution infinie sans pixellisation, pilotable par code et réactif aux événements utilisateur.
   - `animated.webp` : Format web moderne 24fps avec transparence alpha subpixel. Léger (~150-250 Ko par animation).
   - `animated.gif` : GIF avec transparence alpha optimisée pour newsletters, Slack, GitHub, Notion.
   - `animated.png` (APNG) : Rendu sans perte avec transparence 8-bit parfait pour iOS, macOS et applications natives.
   - `static.png` / `static.webp` : Rendus statiques haute résolution 512×512 sans fond.
   - `looped_video.mp4` : Boucle vidéo MP4 H.264 compatible tous lecteurs.

3. **Composants Prêts à l'Emploi & Type-Safety TypeScript** :
   - Types stricts pour empêcher toute erreur de frappe sur le nom des états.
   - Autocomplétion intelligente dans VS Code, Cursor et JetBrains.

4. **Optimisation Web Vitals (CLS = 0 & A11y)** :
   - Dimensions et aspect-ratio verrouillés pour éviter tout saut de mise en page (*Cumulative Layout Shift*).
   - Balises `<picture>` avec fallbacks automatiques selon le support du navigateur.
   - Attributs d'accessibilité `alt` et `aria-label` préconfigurés (normes WCAG 2.2).

---

## 🚀 Intégration Rapide

### 1. React & Next.js

```tsx
// components/Mascot.tsx
import React from 'react';

export type MascotState = 
  | '00_idle' | '01_waving' | '02_celebrating' | '03_ai_thinking'
  | '04_error_404' | '05_thumbs_up' | '06_sleeping' | '07_pointing'
  | '08_searching' | '09_loading' | '10_idea' | '11_security' | '12_goodbye';

interface MascotProps {
  mascot?: 'aituko' | 'owluko' | 'luneko' | 'inuko' | 'hatoko' | 'usako';
  state?: MascotState;
  size?: number;
  message?: string;
  className?: string;
}

export const Mascot: React.FC<MascotProps> = ({
  mascot = 'aituko',
  state = '00_idle',
  size = 180,
  message,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {message && (
        <div className="mb-3 px-4 py-2 rounded-2xl bg-white/90 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 text-sm font-medium shadow-sm">
          {message}
        </div>
      )}
      <picture style={{ width: size, height: size }}>
        <source srcSet={`/assets/${state}/animated.webp`} type="image/webp" />
        <img
          src={`/assets/${state}/animated.gif`}
          alt={`${mascot} ${state}`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="object-contain"
          style={{ width: '100%', height: '100%' }}
        />
      </picture>
    </div>
  );
};
```

**Exemple d'utilisation :**
```tsx
<Mascot state="08_searching" size={160} message="Recherche des résultats..." />
```

---

### 2. Vue 3

```vue
<!-- components/Mascot.vue -->
<template>
  <div class="mascot-wrapper" :style="{ width: size + 'px' }">
    <div v-if="message" class="speech-bubble">{{ message }}</div>
    <picture :style="{ width: size + 'px', height: size + 'px' }">
      <source :srcset="`/assets/${state}/animated.webp`" type="image/webp" />
      <img
        :src="`/assets/${state}/animated.gif`"
        :alt="`Mascotte ${state}`"
        :width="size"
        :height="size"
        loading="lazy"
        decoding="async"
        class="mascot-img"
      />
    </picture>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  state?: string;
  size?: number;
  message?: string;
}>();
</script>
```

---

### 3. Flutter

```dart
// lib/widgets/mascot.dart
import 'package:flutter/material.dart';

class UkoMascot extends StatelessWidget {
  final String state;
  final double size;
  final String? message;

  const UkoMascot({
    Key? key,
    this.state = '00_idle',
    this.size = 180.0,
    this.message,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (message != null)
          Container(
            margin: const EdgeInsets.only(bottom: 12.0),
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16.0),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 8.0,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Text(
              message!,
              style: const TextStyle(fontSize: 14.0, fontWeight: FontWeight.w500),
            ),
          ),
        Image.asset(
          'assets/$state/animated.webp',
          width: size,
          height: size,
          fit: BoxFit.contain,
        ),
      ],
    );
  }
}
```

---

### 4. HTML5 / Web Standards

```html
<picture>
  <source srcset="assets/00_idle/animated.webp" type="image/webp">
  <img 
    src="assets/00_idle/animated.gif" 
    alt="AItuko au repos" 
    width="180" 
    height="180"
    loading="lazy"
    decoding="async"
  >
</picture>
```

---

### 5. Intégration Vectorielle Lottie (React, Vue, Flutter, Web)

Les fichiers `lottie.json` permettent une intégration vectorielle ultra-légère (~10 Ko), sans aucune perte de qualité à n'importe quelle échelle, et avec un contrôle total en JavaScript / Dart.

#### A. React & Next.js (`lottie-react`)
```bash
npm install lottie-react
```
```tsx
import React from 'react';
import Lottie from 'lottie-react';
import aitukoIdle from './assets/00_idle/lottie.json';

export const MascotVector = () => {
  return (
    <Lottie 
      animationData={aitukoIdle} 
      loop={true} 
      autoplay={true} 
      style={{ width: 180, height: 180 }} 
    />
  );
};
```

#### B. Vue 3 (`vue3-lottie`)
```bash
npm install vue3-lottie
```
```vue
<template>
  <Vue3Lottie :animationData="aitukoIdle" :height="180" :width="180" :loop="true" />
</template>

<script setup>
import { Vue3Lottie } from 'vue3-lottie';
import aitukoIdle from './assets/00_idle/lottie.json';
</script>
```

#### C. Flutter (`lottie: ^3.1.0`)
```yaml
dependencies:
  lottie: ^3.1.0
```
```dart
import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

Widget buildMascot() {
  return Lottie.asset(
    'assets/00_idle/lottie.json',
    width: 180,
    height: 180,
    fit: BoxFit.contain,
  );
}
```

#### D. Web Component Universel (`@lottiefiles/lottie-player`)
```html
<script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>

<lottie-player
  src="assets/00_idle/lottie.json"
  background="transparent"
  speed="1"
  style="width: 180px; height: 180px;"
  loop
  autoplay
></lottie-player>
```

---

## 📜 Licence Commerciale

Chaque pack acheté inclut une **licence commerciale perpétuelle**. Vous pouvez utiliser ces mascottes dans un nombre illimité d'applications, SaaS, sites web, applications mobiles et supports marketing personnels ou commerciaux, sans redevance ni abonnement.
