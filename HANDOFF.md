# Passation — à lire en premier (session suivante)

Dernière mise à jour : 27 septembre 2026. Dépôt : `aada-tech/uko-mascot-source`,
branche de travail **`claude/blissful-babbage-1l5cti`** (tout le travail récent y est, pas encore fusionné dans `main`).

## Où on en est

- **Produit** : Uko, Aituko (robot) et Meowuko (chat), mascottes stickman animées pour apps et sites.
  Moteur web (`mascot_engine/`) + fichiers Rive. Landing : `landing_page/` (FR, traduite EN/ES au build).
- **Décision : tout est gratuit et anonyme.** Pas de paiement (code Stripe supprimé). Mentions légales
  d'éditeur non professionnel : aucun nom, adresse ni SIREN du propriétaire ne doit apparaître, nulle part.
  Site : `https://uko-mascot.pages.dev` (pas de domaine à acheter).
- **Allègement fait** : moteur minifié (58 Ko gzip), landing ≈ 420 Ko sans runtime Rive, exemples sur
  `@rive-app/canvas-lite`. Tests : `npm test`, `npm run test:landing` (voir `README.md`).
- **Marketing prêt** : vidéo 16:9 FR/EN/ES + miniatures (`node marketing/presentation/render.cjs fr en es`),
  textes YouTube et playlist « Créations IA » dans `marketing/presentation/youtube.md`, checklist
  `marketing/LANCEMENT.md`.

## Ce qui reste à faire par le propriétaire / avec un navigateur

1. **Déployer le site** : il faut un e-mail de contact anonyme (ex. Gmail « uko… ») à mettre dans
   `landing_page/legal.config.json` (non commité, copier `legal.config.example.json`), puis
   `node test_and_deploy/publish_site.cjs` et `npx wrangler pages deploy site --project-name uko-mascot`.
2. **YouTube** : uploader les 3 vidéos + miniatures, créer la playlist « Créations IA », coller les textes
   de `youtube.md`. Avec Claude in Chrome, sur la chaîne du propriétaire (ne jamais demander de mot de passe).

## Nouveau chantier : Doberman kawaii « qualité Pixar » en 2.5D dans Rive

Choix validé : **Rive en 2.5D** (pas de vraie 3D : trop lourde pour une app). Objectif : un personnage au rendu
Pixar (volumes, lumière douce), animé avec des déformations souples, **sans membres rigides articulés**,
fichier `.riv` de l'ordre de 100 à 300 Ko images comprises.

Étapes :
1. **Référence** (Nano Banana Pro, compte du propriétaire via Chrome) : Doberman chiot kawaii, style film
   Pixar, grande tête, grands yeux brillants, oreilles souples, corps court, pattes dodues.
   Générer : vue de face pleine (fond uni clair, pattes séparées du corps, bouche fermée), 3/4, et une
   planche d'expressions (yeux ouverts / fermés, bouche fermée / ouverte / sourire).
2. **Découpe en calques** (PNG/WebP transparents, ~512 px max par pièce) : corps, tête, oreille G/D,
   yeux + reflets, paupières, bouches, pattes avant G/D, pattes arrière, queue, ombre au sol.
   Compléter les zones cachées (sous les oreilles, derrière les pattes) pour pouvoir animer.
3. **Rive** (éditeur, compte du propriétaire) : importer les images, **meshes** sur tête, oreilles, corps,
   queue (déformations douces), os + contraintes, artboard `Mascot`, machine à états `Mascot` avec
   propriété `state` (voir `rive_animations/CONTRACT.json` pour les conventions).
4. **3 animations test** : `idle` (respiration, clignement, oreilles et queue qui bougent), `welcome`
   (salut de la patte, tête penchée, sourire), `success` (petit saut joyeux, oreilles qui rebondissent).
5. **Export `.riv`**, vérifier poids et rendu dans le runtime web (`@rive-app/canvas-lite`), montrer une
   capture vidéo au propriétaire pour valider avant d'aller plus loin.

## Règles de travail

- **Nettoyer au fur et à mesure** : tout fichier local qui n'est plus utile (rendus, images intermédiaires,
  builds, caches) est supprimé dès qu'il est livré ou poussé sur GitHub. Le disque du propriétaire ne doit
  pas se remplir.
- Ne rien publier qui identifie le propriétaire. Les secrets ne vont jamais dans un fichier du dépôt.
- Répondre en français, simplement ; l'utilisateur dicte à la voix (tolérer les fautes de transcription).
