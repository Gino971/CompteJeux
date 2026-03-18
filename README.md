# Compteur

Ce dépôt contient la version autonome (`index.html`) de l'application « Compteur de points ». Les autres fichiers originaux ont été archivés hors projet.

Utilisation rapide :

1. Servir le dossier via HTTP (recommandé) :

```bash
python3 -m http.server 8000
# puis ouvrir http://127.0.0.1:8000/index.html
```

- Notes :
- La page inclut un vérificateur de mots : il utilise `dictionaryapi.dev` en premier lieu et affiche une définition si disponible. Les requêtes directes vers d'autres sites (FFScrabble) ne sont pas effectuées côté client pour éviter les erreurs CORS.
- Le minuteur utilise l'API Web Audio ; un clic utilisateur peut être nécessaire pour activer le son dans certains navigateurs.

Les fichiers originaux ont été sauvegardés séparément et ne sont plus présents à la racine.

ODS (liste de mots) et iPad
 Le vérificateur de mots essaie d'abord de charger la liste `ODS9.txt` située à la racine du projet. Pour que cela fonctionne, servez le dossier via HTTP (ex. `python3 -m http.server 8000`) puis ouvrez `http://127.0.0.1:8000/index.html`.
 Si `ODS9.txt` n'est pas disponible, l'application tente de lire un bloc inline optionnel `<script id="seed-ods" type="application/json">` présent dans la page. Exemple minimal :
 Ouvrir `index.html` directement en `file://` (double-tap sur iPad via l'app Fichiers) ne permettra généralement pas de `fetch('ODS9.txt')` — utilisez l'inline `seed-ods` ou servez le fichier via un petit serveur HTTP sur le réseau pour que la vérification locale ODS fonctionne.
 Si ni `ODS9.txt` ni `seed-ods` ne sont présents, la vérification s'appuie uniquement sur `dictionaryapi.dev` et l'UI affiche « ODS absent — vérification en ligne seulement ».
```html
<script id="seed-ods" type="application/json">{"words":["ABACA","EXEMPLE","MOT"]}</script>
```

- Ouvrir `index.html` directement en `file://` (double-tap sur iPad via l'app Fichiers) ne permettra généralement pas de `fetch('ods8.txt')` — utilisez l'inline `seed-ods` ou servez le fichier via un petit serveur HTTP sur le réseau pour que la vérification locale ODS fonctionne.
- Si ni `ods8.txt` ni `seed-ods` ne sont présents, la vérification s'appuie uniquement sur `dictionaryapi.dev` et l'UI affiche « ODS absent — vérification en ligne seulement ».
