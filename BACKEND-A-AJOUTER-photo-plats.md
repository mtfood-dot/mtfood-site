# Backend à ajouter — photo d'un plat proposé

Le formulaire « Proposer » de l'espace partenaire envoie maintenant, dans le
`payload` JSON de l'action `proposeMenuItem`, un champ supplémentaire :

    photoData : "data:image/jpeg;base64,...."   (chaîne vide si pas de photo)

Image déjà réduite côté navigateur (900 px max, JPEG), en général 60 à 300 Ko.

## 1. Fonctions à ajouter dans Code.gs

```js
var PHOTOS_FOLDER_NAME_ = 'MT Food - Photos plats';

function getPhotosFolder_() {
  var it = DriveApp.getFoldersByName(PHOTOS_FOLDER_NAME_);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTOS_FOLDER_NAME_);
}

/* Enregistre l'image dans Drive et renvoie une URL publique (ou '' si invalide). */
function saveDishPhoto_(dataUrl) {
  var m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+\/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return '';
  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 1500000) return '';           // garde-fou : 1,5 Mo max
  var ext = m[1] === 'png' ? 'png' : 'jpg';
  var blob = Utilities.newBlob(bytes, 'image/' + m[1], 'plat-' + Date.now() + '.' + ext);
  var file = getPhotosFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';
}
```

## 2. Dans `proposeMenuItem_(telephone, payload)`

- Avant d'écrire la ligne dans l'onglet Menu : `var photoUrl = saveDishPhoto_(payload.photoData);`
- Écrire `photoUrl` dans la colonne **Photo** de la nouvelle ligne (la colonne que le
  site lit déjà dans `menu.html` sous le nom `photo`).
- Rien d'autre à changer : `getPendingMenuItems_` renvoie déjà `photo`, et la page
  admin l'affiche déjà ; `moderateMenuItem_` ne touche pas à cette colonne.

## 3. Autorisation Drive (une seule fois, par le propriétaire du script)

Le script doit être autorisé à utiliser Drive : dans l'éditeur Apps Script,
choisir la fonction `getPhotosFolder_`, cliquer **Exécuter**, puis **Autoriser**.
Ensuite : **Déployer → Gérer les déploiements → modifier → Nouvelle version**
(même déploiement, même adresse /exec).

## 4. Ordre de mise en ligne

1. Backend (ci-dessus) déployé et testé.
2. Ensuite seulement, la page `espace-partenaire.html` (fusion dans `cloudflare`).
   Sans le backend, la photo choisie serait ignorée sans message d'erreur.
