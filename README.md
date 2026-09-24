# Uko — sources (privé)

Les sources du produit **Uko** : trois mascottes stickman vivantes (Uko, Aituko le robot, Meowuko le chat),
vendues en pack (moteur web + fichiers Rive) avec un Starter gratuit.

- Site : https://uko-mascot.pages.dev
- Vitrine publique : https://github.com/fnnktkygl-code/uko-mascot
- Démo en app réelle : https://subflowapp.vercel.app

> Dépôt **privé**. Il contient le moteur complet et les fichiers du pack payant : ne pas le rendre public,
> ne pas publier ces fichiers ailleurs que via le site.

## Contenu

| Dossier | Rôle |
|---|---|
| `mascot_engine/src/` | Moteur web (squelette à longueurs fixes, états, vie, coiffures, personnages, toucher, regard, mouvements) |
| `mascot_engine/build_mascot_engine.js` | Assemble le moteur : `--debug`, `--publish` (copie dans le site), `--starter` (édition gratuite) |
| `mascot_engine/rive/` | Génère les fichiers `.riv` à partir du moteur (images clés extraites, machine à états « Uko ») |
| `mascot_engine/pack/`, `pack-starter/` | README (FR/EN/ES), licences, exemples et changelog livrés dans les ZIP |
| `mascot_engine/build_pack.cjs` | Construit `Uko-Mascot-Pack-x.y.z.zip` et `Uko-Starter-x.y.z.zip` |
| `landing_page/` | Site (FR source, traduit en EN/ES au build), film, galerie, démos Rive et moteur |
| `functions/` | API Cloudflare Pages : paiement Stripe, vérification, téléchargement du pack |
| `test_and_deploy/` | Build du site, i18n, tests (moteur, personnages, Starter, parité Rive, landing) |
| `characters/` | Planches et vidéo de la famille, générées depuis le moteur |
| `marketing/subflow-ad/` | Captures de SubFlow et montage de la pub et des clips |
| `rive_animations/` | **Kit pour construire les mascottes dans l'éditeur Rive** (SVG à importer, planches, contrat) : voir son README |
| `references/`, `inuko/` | Références de dessin et de mouvement, pistes de personnages |

## Prérequis

Node 20+, Python 3 (serveur local), `ffmpeg` (vidéos), et pour déployer `npx wrangler` (Cloudflare).

```bash
npm install
```

## Construire et tester

```bash
npm run build          # moteur (debug, publié, Starter) → packs ZIP → site/ (brouillon)
npm run build:rive     # les 6 fichiers .riv (après build:engine)
npm test               # personnages, invariants de mouvement, Starter
npm run serve          # site/ sur http://localhost:3350
UKO_BASE_URL=http://localhost:3350/ npm run test:landing   # aussi /en/ et /es/
npm run i18n:check     # chaque texte du site traduit
```

Comparer deux moteurs (aucune régression visuelle sur les poses existantes) :

```bash
node test_and_deploy/compare_engines.cjs <ancien.js> mascot_engine/dist/uko-mascot-engine.js
```

## Déployer le site

```bash
node test_and_deploy/publish_site.cjs          # refuse tant que les mentions légales sont incomplètes
npx wrangler pages deploy site --project-name uko-mascot --branch main
```

## Ce qui n'est jamais commité

- **Secrets** : les clés Stripe sont des secrets Cloudflare (`npx wrangler pages secret put STRIPE_SECRET_KEY`),
  jamais dans un fichier. `.env`, `.dev.vars`, clés et comptes de service sont ignorés.
- **Données personnelles** : `landing_page/legal.config.json` (mentions légales de l'éditeur). Copier
  `legal.config.example.json` et le remplir en local.
- **Builds** : `site/`, `mascot_engine/dist/` (dont les ZIP du pack payant), images extraites, captures vidéo.
  Tout se reconstruit avec les commandes ci-dessus.
- Notes de travail personnelles (`TASKS.md`, `README_AGENT.md`, `INUKO_BRIEF.md`).

## Licence

Tous droits réservés. Le pack et le Starter sont distribués sous leurs licences propres
(`mascot_engine/pack/LICENSE.md`, `mascot_engine/pack-starter/LICENSE.md`).
