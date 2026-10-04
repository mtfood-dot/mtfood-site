# Backend à ajouter dans "MT Food" (Code.gs) — Gestion des zones de livraison

Ce fichier contient le code à copier-coller dans l'éditeur Apps Script du
projet **"MT Food"**, pour pouvoir gérer les zones de livraison (nom, frais)
directement depuis l'espace admin, au lieu de les avoir codées en dur dans
`index.html` et `menu.html`. Même méthode que d'habitude : tu copies-colles
toi-même ce bloc, puis tu redéploies.

**⚠️ Avant de commencer**, comme pour les blocs précédents : vérifie bien que
ce nouveau bloc est **séparé** de tout ce qui l'entoure, avec sa propre
accolade `}` de fermeture à la fin.

**Bon à savoir** : au tout premier appel (`getZones`/`getAllZones`), le code
crée automatiquement un nouvel onglet **"Zones"** dans la Google Sheet
"MT Food Site", et le pré-remplit avec les 3 zones déjà utilisées
aujourd'hui (Meftah Centre 200 DA, Meftah Dehors/Hopital 250 DA, Meftah
Dehors/Souakria 300 DA) — rien ne change pour tes clients tant que tu ne
modifies rien depuis l'admin.

## 1. Où coller ce code

Ouvre l'éditeur du projet **"MT Food"**, va à la fin du fichier `Code.gs`,
et colle tout le bloc de la section 3 ci-dessous.

## 2. Routage dans `doGet`

Trouve la toute dernière branche `else if` existante (juste avant le `else`
final qui dit « Action inconnue ») et ajoute ces 4 nouveaux cas **avant** le
`else` final, en gardant le même style (`result = ...`, pas de `return`
direct) :

```js
  } else if (action === 'getZones') {
    result = getZones_(e);
  } else if (action === 'getAllZones') {
    result = getAllZones_(p.password);
  } else if (action === 'saveZone') {
    result = saveZone_(p.password, p.id, p.nom, p.frais, p.actif, p.ordre);
  } else if (action === 'deleteZone') {
    result = deleteZone_(p.password, p.id);
  } else {
    result = { success: false, error: 'Action inconnue' };
  }
```

`getZones` est **publique** (pas de mot de passe, appelée par `index.html`
et `menu.html` pour tout le monde). `getAllZones`, `saveZone` et
`deleteZone` sont réservées à l'admin.

## 3. Code à coller

```js
/* ============================================================
   ZONES DE LIVRAISON (ajouté 04/10/2026)
   Nouvel onglet "Zones" dans la Google Sheet "MT Food Site" :
   ID | Nom | Frais | Actif | Ordre | Horodatage
   Créé automatiquement et pré-rempli au premier appel.
   ============================================================ */
var ZONES_SHEET_NAME = 'Zones';
var ZONES_HEADERS = ['ID', 'Nom', 'Frais', 'Actif', 'Ordre', 'Horodatage'];

function getZonesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ZONES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ZONES_SHEET_NAME);
    sheet.appendRow(ZONES_HEADERS);
    var now = new Date();
    sheet.appendRow(['centre', 'Meftah Centre', 200, 'OUI', 1, now]);
    sheet.appendRow(['Hopital', 'Meftah Dehors', 250, 'OUI', 2, now]);
    sheet.appendRow(['Souakria', 'Meftah Dehors', 300, 'OUI', 3, now]);
  }
  return sheet;
}

function zoneRowToObject_(row) {
  return {
    id: row[0],
    nom: row[1],
    frais: Number(row[2]) || 0,
    actif: String(row[3] || '').trim().toLowerCase() === 'oui',
    ordre: Number(row[4]) || 0
  };
}

/* ---- Action publique : getZones (zones actives, triées par Ordre) ---- */
function getZones_(e) {
  var sheet = getZonesSheet_();
  var values = sheet.getDataRange().getValues();
  var zones = [];
  for (var i = 1; i < values.length; i++) {
    var obj = zoneRowToObject_(values[i]);
    if (obj.actif && obj.id) zones.push(obj);
  }
  zones.sort(function (a, b) { return a.ordre - b.ordre; });
  return { success: true, zones: zones };
}

/* ---- Action admin : getAllZones (toutes les zones, actives ou non) ---- */
function getAllZones_(password) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;

  var sheet = getZonesSheet_();
  var values = sheet.getDataRange().getValues();
  var zones = [];
  for (var i = 1; i < values.length; i++) {
    if (values[i][0]) zones.push(zoneRowToObject_(values[i]));
  }
  zones.sort(function (a, b) { return a.ordre - b.ordre; });
  return { success: true, zones: zones };
}

/* ---- Action admin : saveZone (crée si id vide, sinon met à jour) ---- */
function saveZone_(password, id, nom, frais, actif, ordre) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;

  id = String(id || '').trim();
  nom = String(nom || '').trim();
  frais = Number(frais) || 0;
  actif = String(actif || 'OUI');
  ordre = Number(ordre) || 0;

  if (!nom) {
    return { success: false, error: 'Le nom de la zone est obligatoire.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getZonesSheet_();
    var values = sheet.getDataRange().getValues();
    if (id) {
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]) === id) {
          sheet.getRange(i + 1, 2, 1, 4).setValues([[nom, frais, actif, ordre]]);
          return { success: true, id: id };
        }
      }
      return { success: false, error: 'Zone introuvable.' };
    } else {
      var newId = Utilities.getUuid();
      sheet.appendRow([newId, nom, frais, actif, ordre, new Date()]);
      return { success: true, id: newId };
    }
  } finally {
    lock.releaseLock();
  }
}

/* ---- Action admin : deleteZone ---- */
function deleteZone_(password, id) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;

  id = String(id || '').trim();
  if (!id) return { success: false, error: 'ID manquant.' };

  var sheet = getZonesSheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Zone introuvable.' };
}
```

## 4. Après avoir collé le code

1. `Ctrl+F` → vérifie qu'aucune accolade ne s'est dupliquée ou n'a disparu.
   Le bloc doit commencer par `/* ====...` et se terminer par le `}` qui
   ferme `function deleteZone_`, sans rien d'autre collé dedans.
2. Modifier les 4 lignes de routage de la section 2 dans `doGet`.
3. Enregistrer (Ctrl+S), puis **Déployer → Gérer les déploiements → icône
   crayon → Version "Nouvelle version" → Déployer**.
4. Tester directement dans le navigateur :
   `.../exec?action=getZones` (doit renvoyer les 3 zones déjà existantes,
   créées automatiquement dans un nouvel onglet "Zones" de la Sheet).
