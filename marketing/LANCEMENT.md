# Lancer Uko : la checklist

Dans l'ordre. **[toi]** = une action qui demande ton compte, ta carte ou ta signature ; **[Claude]** = je peux le faire
dans le dépôt dès que tu me donnes l'info. Rien n'est encore vendu : on peut tout ajuster jusqu'au jour J.

## 1. Admin et protection de tes données [toi]

- [ ] **Masquer tes infos dans l'annuaire INSEE (Sirene).** Une entreprise individuelle peut demander la
      *non-diffusion* de ses données personnelles (adresse, date et lieu de naissance). Ça se fait sur le
      Guichet unique de l'INPI (formalité de modification, case à cocher), gratuitement.
      ⚠️ Le registre RNE (data.inpi.fr) continue d'afficher ton nom et l'adresse de l'entreprise ; il tronque
      le jour de naissance. Seul le répertoire Sirene respecte entièrement la non-diffusion.
- [ ] **Ne pas afficher ton domicile : une adresse de domiciliation.** C'est la seule vraie parade pour l'adresse,
      à la fois sur le site (mentions légales), sur Stripe et dans le RNE : une société de domiciliation
      (≈ 10 à 30 €/mois) te donne une adresse professionnelle, et tu transfères l'adresse de l'entreprise
      dessus (formalité de modification sur le Guichet unique). Ton **nom** reste public : pour une entreprise
      individuelle, la loi l'impose sur le site.
- [ ] **Médiateur de la consommation** : obligatoire dès que tu vends à des particuliers. Adhérer à un médiateur
      agréé (liste sur economie.gouv.fr, ex. CM2C), puis me donner son nom et son adresse.
- [ ] **E-mail pro** (ex. `contact@ton-domaine`) : gratuit avec Cloudflare Email Routing, redirigé vers ta boîte.
- [ ] **TVA** : en micro-entreprise, en franchise de TVA, la mention est « TVA non applicable, art. 293 B du CGI ».
      À surveiller avec ton comptable : au-delà de 10 000 € par an de ventes à des particuliers d'autres pays de
      l'UE, c'est la TVA du pays de l'acheteur (guichet OSS) ; et certains pays hors UE (ex. Royaume-Uni) ont leurs
      propres règles pour les produits numériques. Si les ventes à l'international décollent, une plateforme
      « Merchant of Record » (Lemon Squeezy, Paddle) gère toutes les taxes, contre ≈ 5 % + 0,50 $ par vente
      (Stripe en Europe : ≈ 1,5 % + 0,25 €).

## 2. Nom de domaine [toi]

- [ ] Me redire **le nom choisi** (il n'est écrit nulle part dans le dépôt).
- [ ] L'acheter chez **Cloudflare Registrar** : prix coûtant (pas de marge), et le site est déjà hébergé chez
      Cloudflare Pages, donc la connexion se fait en deux clics (Pages → Custom domains). Un `.com` coûte
      environ 10 $ par an ; vérifie le prix affiché, il dépend de l'extension.
- [ ] **[Claude]** Remplacer `uko-mascot.pages.dev` partout (`wrangler.toml`, config légale, vidéos) et régénérer
      la carte de fin des vidéos : `node marketing/presentation/render.cjs fr en es --site ton-domaine.com`.

## 3. Stripe [toi, puis Claude]

- [ ] Créer le compte Stripe : pays France, type « entreprise individuelle », ton SIREN, activité « vente de
      contenus numériques (logiciels, animations) », site = ton domaine, libellé bancaire `UKO MASCOT`.
- [ ] **Informations publiques** (reçus) : e-mail pro et adresse de domiciliation, pas ton domicile.
- [ ] **Versements** : ajouter l'IBAN de ton compte Revolut (il doit être à ton nom).
- [ ] Clé **de test** → `npx wrangler pages secret put STRIPE_SECRET_KEY` (jamais dans un fichier), puis un achat
      test avec la carte `4242 4242 4242 4242` : paiement, page de remerciement, téléchargement du ZIP, facture.
- [ ] Clé **live** à la place, puis **[Claude]** ouvrir la vente (`data-sale="open"` sur la section prix).
- [ ] À savoir : la facture PDF envoyée après chaque achat passe par Stripe Invoicing, qui peut avoir un petit
      coût par facture selon ton offre Stripe : vérifie dans le tableau de bord (sinon, on peut la désactiver et
      garder le reçu).
- [ ] Déjà fait : la page de paiement Stripe s'affiche en français, anglais ou espagnol selon la page du visiteur.

## 4. Mentions légales et déploiement [Claude, avec tes infos]

- [ ] Remplir `landing_page/legal.config.json` (jamais commité) : nom, statut, **SIRET** (14 chiffres, sur
      l'avis de situation INSEE ou l'annuaire des entreprises), adresse (domiciliation), e-mail, téléphone,
      mention TVA, médiateur. La publication refuse de partir tant qu'un champ manque.
- [ ] `node test_and_deploy/publish_site.cjs` puis `npx wrangler pages deploy site --project-name uko-mascot`.
- [ ] Vérifier sur un vrai téléphone : chargement, démo, vidéo SubFlow, téléchargement du Starter, achat.
- [ ] Mesure d'audience sans cookies (Cloudflare Web Analytics, gratuit) : à activer dans Cloudflare ; il faudra
      autoriser son script dans la politique de sécurité du site (`publish_site.cjs`).
- [ ] Connu : la page de remerciement et les pages légales sont en français seulement.

## 5. Les mascottes dans l'éditeur Rive [toi + Claude sur ton ordinateur]

- [ ] Ouvrir une session Claude **sur ton ordinateur** (app Claude Desktop ou `claude remote-control`),
      avec l'extension Claude in Chrome, connecté à rive.app : je construis les 3 mascottes dans l'éditeur
      à partir du kit `rive_animations/` et j'exporte les `.riv` (objectif < 40 Ko chacun).
      Pas bloquant pour lancer : les `.riv` actuels marchent et sont testés.

## 6. YouTube [toi pour l'upload]

Tout est prêt dans `marketing/presentation/` (textes : `youtube.md`).

- [ ] Créer la playlist **« Créations IA »** sur ta chaîne (description dans `youtube.md`).
- [ ] Uploader `uko-presentation-fr.mp4` avec sa miniature `uko-thumbnail-fr.jpg`, l'ajouter à la playlist.
- [ ] Uploader la pub verticale `landing_page/media/uko-subflow-ad-fr.mp4` en **Short**, dans la playlist.
- [ ] Versions EN / ES : sur la même chaîne (titres traduits dans `youtube.md`), ou seulement pour la publicité.

## 7. Faire connaître (gratuit d'abord)

À 6,99 €, une vente rapporte ≈ 6,64 € net de frais Stripe. Une pub payante coûte vite plus cher qu'une vente :
on commence par ce qui est gratuit, et on mesure.

| Où | Quoi | Quand |
|---|---|---|
| Product Hunt | lancement « Uko — mascottes animées pour ton app, adaptées par l'IA », vidéo + GIF | un mardi ou mercredi |
| Reddit | r/SideProject, r/webdev (règle « Showoff Saturday » le samedi), r/reactjs, r/FlutterDev : montrer la démo, pas une pub | étalé sur 2 semaines |
| Hacker News | « Show HN: Uko, animated mascots for your app, fitted by your AI » | un matin (heure US) |
| X / Bluesky / LinkedIn | la vidéo de 41 s + le lien du Starter gratuit | jour J, puis un extrait par semaine |
| dev.to / Medium | article « Ajouter une mascotte à son app en 5 minutes avec l'IA » (le prompt, le cas SubFlow) | semaine 1 |
| YouTube Shorts / TikTok / Reels | la pub verticale, puis un Short par état (loading, error, sleep…) | 2 à 3 par semaine |

## 8. Publicité payante (petit test, après le lancement)

- **Budget test : 100 à 150 € sur 2 semaines**, pour apprendre quel message fait télécharger le Starter, pas pour
  être rentable tout de suite.
- **Reddit Ads** (le plus ciblé pour des développeurs) : communautés r/webdev, r/reactjs, r/FlutterDev,
  r/SideProject ; visuel = la vidéo verticale ; objectif = visites du site. ≈ 5 €/jour.
- **YouTube (Google Ads, campagne vidéo)** : la vidéo 16:9 en « in-feed » et la verticale en Shorts ; audiences
  personnalisées sur les recherches « Rive animation », « Lottie », « React components », « Flutter UI ».
  ≈ 5 €/jour.
- Meta (Instagram / Facebook) : moins précis pour viser des développeurs ; seulement si les deux premiers marchent.
- Liens avec `?utm_source=reddit` / `youtube` pour savoir d'où viennent les téléchargements.
- On coupe ce qui ne fait pas télécharger après 1 semaine ; on garde et on augmente doucement ce qui marche.
