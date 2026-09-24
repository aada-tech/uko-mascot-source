# Audit de la mascotte — version unifiée

## Résultat et statut

Un seul point d’entrée : `index.html`. Les trois HTML de départ sont conservés à l’identique dans une archive ZIP et retirés du dossier de travail. Le résultat est un **prototype technique consolidé**, pas un pack Rive prêt à vendre.

Six actions sont exposées : accueil, chargement, succès, erreur, résultat vide et sommeil. Le neutre sert de base, le réveil de sortie du sommeil. La marche reste un laboratoire replié, hors pack. Le choix des six actions reprend l’hypothèse annoncée pendant le travail ; aucune réponse explicite n’a été reçue à la question de sélection.

## Fusion et corrections

| Sujet | Constat dans les sources | Traitement |
|---|---|---|
| Coiffures | La branche rotation avait seulement Original/Chauve ; la branche cheveux avait des fonctions déclarées plusieurs fois | Catalogue réuni, une seule implémentation active, couleurs indépendantes restaurées |
| Mi-long | Deux interprétations frontales concurrentes ; la dernière avait perdu les ondulations du tracé manuel | Volume tournant avec raie décentrée et mèches latérales ; les tracés manuels exacts restent dans l’archive |
| Angles | Les boutons 3/4 utilisaient ±0,55, soit ±49,5° | Boutons à ±0,5, soit ±45° ; profils à ±90° |
| Regard | L’œil survivant était celui du mauvais côté au départ | L’œil proche part du côté opposé au sens visuel du regard ; l’œil lointain disparaît au profil |
| Passage par face | Verrou de côté et silhouette de tête provoquaient des discontinuités | Signe de tête cohérent avec le corps, projection du visage continue, contour du crâne interpolé depuis le cercle |
| Pieds | Le signe de projection des pieds pouvait être opposé à celui du visage | Les pieds utilisent le sens visuel du visage |
| Cheveux tournants | Les dessins frontaux n’avaient pas de profondeur | Construction paramétrique autour du crâne ; mèches proches/lointaines rendues devant/derrière la tête |
| Cheveux longs | Mouvement indépendant par `Date.now`, risque de passage sous le sol | Horloge commune, inertie bornée, pointes repliées au contact du sol |
| Cadrage | Le mi-long dépassait à gauche pendant Sleep | Marge fixe autour de la scène, sans changement de caméra pendant l’animation |
| Ralenti/pause | Redémarrage lors du changement de vitesse ; couches avec des horloges différentes | Temps logique partagé pour corps, orientation, regard, cheveux, marche et effets ; pause exacte ; suspension en arrière-plan |
| Accessibilité | Pas de préférence de mouvement réduit | Préférence système et contrôle explicite ; poses statiques et changement d’état toujours possible |
| Réponse rapide | Un résultat reçu pendant LoadingEnter était ignoré | Une intention en attente, remplacée par la plus récente, puis consommée lorsqu’elle est recevable |
| Export | Pas d’export vectoriel portable de la frame | SVG transparent, attributs de présentation et couleurs résolues, JSON de référence pour poses/timings |

Les coiffures sont des adaptations stylisées paramétriques. Ce n’est pas une simulation physique 3D ni une copie fidèle certifiée des seize dessins de référence. Les projections automatiques directes des anciens chemins ont été essayées, inspectées puis rejetées car elles créaient des mèches déformées ; elles ne font pas partie du HTML livré.

## Vérification exécutée

Voir `QA_REPORT.json` et `scripts/qa.cjs`, qui régénèrent les preuves. Navigateur utilisé : Chrome 153 sur ce Mac.

- 770 rendus d’états : dix apparences × sept poses/actions visibles × onze instants.
- 370 rendus d’orientation : dix apparences × trente-sept angles entre −90° et +90°.
- Coordonnées finies, absence de débordement de géométrie dans les états testés et absence d’erreur JavaScript capturée.
- Identité de l’œil proche et un seul œil au profil ; angles exacts et inversion de rotation.
- Entrée et boucle de chargement, résolution vers succès/erreur, résultat précoce mis en attente, sommeil/réveil et retour au neutre.
- Pause figée, ralenti partagé, mouvement réduit stable et changement d’état en mouvement réduit.
- Couleur de cheveux personnalisée conservée lors d’un changement de marque.
- SVG exporté XML valide, sans scripts ni variables CSS non résolues.
- Largeur mobile de 390 px sans débordement horizontal du document.
- Planches des dix apparences à cinq angles et de trois apparences sur les sept poses/actions ; captures desktop/mobile inspectées.

Le coût moyen JavaScript indiqué dans le rapport est une mesure locale de génération/mise à jour, hors garantie sur le temps de peinture GPU, le runtime Rive ou un téléphone peu puissant. Les 1 140 cas sont des échantillons de rendu, pas 1 140 scénarios utilisateur indépendants. La vérification des limites utilise les boîtes géométriques ; elle ne constitue pas une analyse exhaustive des collisions ou des pixels.

## Points à terminer avant commercialisation

1. **Direction artistique des cheveux.** Les volumes sont cohérents pendant la rotation, mais la fidélité de la coiffure Classique et du Mi-long au dessin fourni reste à affiner ; les pointes, l’épaisseur et les masses arrière sont encore simplifiées. Le rendu du dégradé a été rétabli sur les tempes. Les tresses demandent une texture plus caractéristique à très petite taille. Ne pas présenter ces variantes comme des reproductions exactes approuvées.
2. **Catalogue de référence incomplet.** Sept variantes de la planche ne sont pas implémentées : chignon homme, tresses homme, lisse, ondulé, boucles, pixie, queue de cheval. Elles n’ont pas été ajoutées artificiellement sous un nom trompeur. Le pack actuel expose les variantes déjà amorcées dans les branches, plus Chauve et Original.
3. **Angles des actions.** Les rotations concernent le neutre et le laboratoire de marche. Loading, Sleep et les autres actions ne possèdent pas encore de jeu de poses dédié aux profils. Les étendre nécessite aussi de traiter l’occlusion du laptop, de la main près du visage et du support au sol.
4. **Physique.** Le modèle utilise des poses articulées et des corrections de contact ; ce n’est pas un solveur de contraintes ou de dynamique. Les longueurs des membres et les contacts demandent une validation finale du rig Rive, notamment réception du saut et passage sommeil/réveil. L’inertie des cheveux est stylisée et bornée.
5. **Production Rive.** Aucun `.riv` n’a été généré ni testé. Importer le SVG ne transpose pas le code JavaScript : rig, interpolations et machine à états restent à construire dans Rive. Les bandes géométriques des cheveux devront être simplifiées en tracés éditables. Le contrat proposé est dans `rive/CONTRACT.json`.
6. **Validation cible.** Ajouter les essais du `.riv` sur les appareils et runtimes réels, à petite taille, avec changements d’état rapides et préférences d’accessibilité. La validation actuelle porte sur Chrome desktop et une taille de viewport mobile, pas Safari/iOS/Android réels.

La landing page, Stripe et la distribution commerciale ne font pas partie de cette intervention.
