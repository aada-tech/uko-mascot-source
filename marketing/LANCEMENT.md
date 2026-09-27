# Lancer Uko : la checklist

Dans l'ordre. **[toi]** = une action qui demande ton compte, ta carte ou ta signature ; **[Claude]** = je peux le faire
dans le dépôt dès que tu me donnes l'info. Rien n'est encore vendu : on peut tout ajuster jusqu'au jour J.

## 1. Site gratuit et anonyme [Claude + toi]

Décision du 27 septembre 2026 : **tout est gratuit**, pas de paiement. Le site est édité à titre non professionnel :
tes nom, adresse et SIREN n'apparaissent nulle part (mentions légales anonymes, ton identité est connue du seul
hébergeur, LCEN art. 1-1). Tant que rien n'est encaissé (ni vente, ni don, ni publicité), ça reste valable.

- [ ] **[toi]** Un e-mail de contact dédié (ex. une adresse Gmail « uko… » qui ne révèle pas ton nom).
- [ ] **[Claude]** Le mettre dans `landing_page/legal.config.json` (avec le téléphone de Cloudflare), puis
      `node test_and_deploy/publish_site.cjs` et `npx wrangler pages deploy site --project-name uko-mascot`.
- [ ] Vérifier sur un vrai téléphone : démo, vidéos, téléchargement du pack.
- Le domaine reste `uko-mascot.pages.dev` : pas besoin d'acheter un nom tant que c'est gratuit.
- Si un jour on vend : domiciliation + non-diffusion INSEE, et le code de paiement Stripe est dans l'historique git.

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

Le produit est gratuit : le but est le trafic, les téléchargements et les abonnés de la chaîne.

| Où | Quoi | Quand |
|---|---|---|
| Product Hunt | lancement « Uko — mascottes animées pour ton app, adaptées par l'IA », vidéo + GIF | un mardi ou mercredi |
| Reddit | r/SideProject, r/webdev (règle « Showoff Saturday » le samedi), r/reactjs, r/FlutterDev : montrer la démo, pas une pub | étalé sur 2 semaines |
| Hacker News | « Show HN: Uko, animated mascots for your app, fitted by your AI » | un matin (heure US) |
| X / Bluesky / LinkedIn | la vidéo de 41 s + le lien de téléchargement gratuit | jour J, puis un extrait par semaine |
| dev.to / Medium | article « Ajouter une mascotte à son app en 5 minutes avec l'IA » (le prompt, le cas SubFlow) | semaine 1 |
| YouTube Shorts / TikTok / Reels | la pub verticale, puis un Short par état (loading, error, sleep…) | 2 à 3 par semaine |

## 8. Publicité payante (petit test, après le lancement)

- **Budget test : 100 à 150 € sur 2 semaines**, pour apprendre quel message fait télécharger le pack, pas pour
  être rentable tout de suite.
- **Reddit Ads** (le plus ciblé pour des développeurs) : communautés r/webdev, r/reactjs, r/FlutterDev,
  r/SideProject ; visuel = la vidéo verticale ; objectif = visites du site. ≈ 5 €/jour.
- **YouTube (Google Ads, campagne vidéo)** : la vidéo 16:9 en « in-feed » et la verticale en Shorts ; audiences
  personnalisées sur les recherches « Rive animation », « Lottie », « React components », « Flutter UI ».
  ≈ 5 €/jour.
- Meta (Instagram / Facebook) : moins précis pour viser des développeurs ; seulement si les deux premiers marchent.
- Liens avec `?utm_source=reddit` / `youtube` pour savoir d'où viennent les téléchargements.
- On coupe ce qui ne fait pas télécharger après 1 semaine ; on garde et on augmente doucement ce qui marche.
