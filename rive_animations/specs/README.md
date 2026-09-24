# Passage à Rive

Les fichiers livrés ici sont des références de fabrication, pas un `.riv` compilé.

1. Importer `mascot-reference.svg` dans l’éditeur. Les formes sont vectorielles et les couleurs sont des attributs explicites. Le SVG est une frame ; il ne transfère ni les fonctions JavaScript, ni les transitions, ni le comportement des cheveux.
2. Simplifier les bandes de volume des cheveux en courbes de Bézier éditables. Construire les silhouettes face, ±45° et ±90° avec une topologie compatible pour les interpolations. Garder des groupes avant/arrière, l’œil proche/lointain et les mains devant/derrière les accessoires.
3. Créer un rig : racine, bassin, colonne, tête, bras, avant-bras, cuisses, jambes, mains, pieds. Utiliser les poses et timings de `motion-reference.json` comme repères ; les formules procédurales du prototype ne sont pas encodées dans ce JSON.
4. Construire les six actions et leurs transitions. Loading et Sleep persistent ; Welcome/Success/Error/Empty reviennent au neutre. Conserver une intention de résolution reçue pendant LoadingEnter. Wake est une transition de sortie, pas une septième action du pack.
5. Créer le View Model proposé dans `CONTRACT.json`. Relier les couleurs et le choix des cheveux par Data Binding. Faire tourner MainMotion indépendamment des yeux, du clignement et des mouvements secondaires.
6. Tester dans l’éditeur puis dans le runtime réel : retours rapides de requêtes, interruption, reprise après arrière-plan, deux sens de rotation, faibles tailles d’affichage, mouvement réduit. L’orientation des actions autres que Neutral n’est pas encore prévue dans le prototype.
7. Exporter le `.riv` depuis Rive puis vérifier ce fichier dans l’app cible. Aucun export/import dans Rive n’a été validé lors de ce travail.

Sources officielles consultées le 20 septembre 2026 :

- [Import SVG](https://rive.app/docs/editor/assets/svg) : conversion en objets natifs ; attributs de présentation recommandés. Les dégradés linéaires sont supportés, mais pas toutes les fonctions SVG.
- [Data Binding](https://rive.app/docs/editor/data-binding/overview) : propriétés de View Model reliées à la scène.
- [Export runtime](https://rive.app/docs/editor/exporting/exporting-for-runtime) : production du fichier `.riv` dans l’éditeur.

Pour cette mascotte 2D, un rig vectoriel Rive évite d’ajouter une chaîne Blender et des rendus raster. C’est un choix d’architecture adapté au projet, pas une affirmation qu’un outil serait universellement meilleur.
