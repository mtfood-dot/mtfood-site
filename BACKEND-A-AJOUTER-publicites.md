# Backend à ajouter dans "MT Food" (Code.gs) — Espaces publicitaires

Ce fichier contient le code à copier-coller dans l'éditeur Apps Script du
projet **"MT Food"**, pour la nouvelle fonctionnalité "espaces publicitaires"
(bannières de restaurants partenaires affichées sur la nouvelle page d'accueil
`index.html`, gérables depuis un nouvel onglet "Publicités" de
`espace-admin.html`). Même méthode que pour les comptes clients : tu copies-
colles toi-même ce bloc, puis tu redéploies comme d'habitude.

## 1. Où coller ce code

Ouvre l'éditeur du projet **"MT Food"**, va à la fin du fichier `Code.gs`, et
colle tout le bloc de la section 3 ci-dessous.

## 2. Routage dans `doGet`

Dans la fonction `doGet(e)`, ta chaîne `if (action === ...) { result = ... }
else if (...) { ... }` se termine par un dernier `else` qui renvoie
`{ success: false, error: 'Action inconnue' }`, puis un seul
`return respond_(result, callback);` tout à la fin (c'est ce `respond_`
commun, avec gestion du JSONP, qu'il faut réutiliser — il n'existe pas de
fonction `respondJson_` dans ce projet).

Trouve la toute dernière branche `else if` existante (juste avant le `else`
final qui dit "Action inconnue") et ajoute tes nouveaux cas **avant** ce
`else` final, en gardant exactement le même style (`result = ...`, pas de
`return` direct) :

```js
  } else if (action === 'getAds') {
    result = getAds_(e);
  } else if (action === 'getAllAds') {
    result = getAllAds_(e);
  } else if (action === 'saveAd') {
    result = saveAd_(e);
  } else if (action === 'deleteAd') {
    result = deleteAd_(e);
  } else {
    result = { success: false, error: 'Action inconnue' };
  }
```

`getAds` est **publique** (pas de mot de passe, appelée par la page d'accueil
pour tout le monde). `getAllAds`, `saveAd` et `deleteAd` sont réservées à
l'admin et réutilisent `findAdminByPassword_` (la même fonction déjà utilisée
par `adminLogin`/`getAllOrders`/etc. — ne pas en recréer une autre).

## 3. Code à coller

```js
/* ============================================================
   ESPACES PUBLICITAIRES (ajouté 04/10/2026)
   Nouvel onglet "Publicites" dans la Google Sheet "MT Food Site" :
   ID | NomRestaurant | ImageURL | LienURL | Texte | Actif | Ordre | Horodatage
   ============================================================ */
var PUBLICITES_SHEET_NAME = 'Publicites';
var PUBLICITES_HEADERS = ['ID','NomRestaurant','ImageURL','LienURL','Texte','Actif','Ordre','Horodatage'];

function getPublicitesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PUBLICITES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PUBLICITES_SHEET_NAME);
    sheet.appendRow(PUBLICITES_HEADERS);
  }
  return sheet;
}

function adRowToObject_(row) {
  return {
    id: row[0],
    nomRestaurant: row[1],
    imageUrl: row[2],
    lienUrl: row[3],
    texte: row[4],
    actif: String(row[5] || '').trim().toLowerCase() === 'oui',
    ordre: Number(row[6]) || 0
  };
}

/* ---- Action publique : getAds (annonces actives, triées par Ordre) ---- */
function getAds_(e) {
  var sheet = getPublicitesSheet_();
  var values = sheet.getDataRange().getValues();
  var ads = [];
  for (var i = 1; i < values.length; i++) {
    var obj = adRowToObject_(values[i]);
    if (obj.actif && obj.id) ads.push(obj);
  }
  ads.sort(function(a, b){ return a.ordre - b.ordre; });
  return { success: true, ads: ads };
}

/* ---- Action admin : getAllAds (toutes les annonces, actives ou non) ---- */
function getAllAds_(e) {
  var password = String(e.parameter.password || '');
  if (!findAdminByPassword_(password)) {
    return { success: false, error: 'Mot de passe incorrect.' };
  }
  var sheet = getPublicitesSheet_();
  var values = sheet.getDataRange().getValues();
  var ads = [];
  for (var i = 1; i < values.length; i++) {
    if (values[i][0]) ads.push(adRowToObject_(values[i]));
  }
  ads.sort(function(a, b){ return a.ordre - b.ordre; });
  return { success: true, ads: ads };
}

/* ---- Action admin : saveAd (crée si id vide, sinon met à jour la ligne) ---- */
function saveAd_(e) {
  var password = String(e.parameter.password || '');
  if (!findAdminByPassword_(password)) {
    return { success: false, error: 'Mot de passe incorrect.' };
  }
  var id = String(e.parameter.id || '').trim();
  var nomRestaurant = String(e.parameter.nomRestaurant || '').trim();
  var imageUrl = String(e.parameter.imageUrl || '').trim();
  var lienUrl = String(e.parameter.lienUrl || '').trim();
  var texte = String(e.parameter.texte || '').trim();
  var actif = String(e.parameter.actif || 'OUI');
  var ordre = Number(e.parameter.ordre || 0);

  if (!nomRestaurant || !imageUrl) {
    return { success: false, error: 'Nom du restaurant et image sont obligatoires.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getPublicitesSheet_();
    var values = sheet.getDataRange().getValues();
    if (id) {
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]) === id) {
          sheet.getRange(i + 1, 2, 1, 6).setValues([[nomRestaurant, imageUrl, lienUrl, texte, actif, ordre]]);
          return { success: true, id: id };
        }
      }
      return { success: false, error: 'Publicité introuvable.' };
    } else {
      var newId = Utilities.getUuid();
      sheet.appendRow([newId, nomRestaurant, imageUrl, lienUrl, texte, actif, ordre, new Date()]);
      return { success: true, id: newId };
    }
  } finally {
    lock.releaseLock();
  }
}

/* ---- Action admin : deleteAd ---- */
function deleteAd_(e) {
  var password = String(e.parameter.password || '');
  if (!findAdminByPassword_(password)) {
    return { success: false, error: 'Mot de passe incorrect.' };
  }
  var id = String(e.parameter.id || '').trim();
  if (!id) return { success: false, error: 'ID manquant.' };
  var sheet = getPublicitesSheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Publicité introuvable.' };
}
```

## 4. Après avoir collé le code

1. `Ctrl+F` → vérifier qu'aucune accolade ne s'est dupliquée (vérifier par
   capture d'écran, bug de saisie déjà rencontré plusieurs fois).
2. Ajouter les 4 lignes de routage de la section 2 dans `doGet`.
3. Enregistrer (Ctrl+S), puis **Déployer → Gérer les déploiements → icône
   crayon → Version "Nouvelle version" → Déployer** (le clic que tu dois faire
   toi-même).
4. Tester directement dans le navigateur :
   `.../exec?action=getAds` (doit renvoyer `{"success":true,"ads":[]}` tant
   qu'aucune pub n'a été ajoutée depuis l'espace admin).
