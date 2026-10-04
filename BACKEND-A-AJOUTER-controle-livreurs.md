# Backend à ajouter dans "MT Food" (Code.gs) — Contrôle livreurs avancé

Ce fichier contient le code à copier-coller dans l'éditeur Apps Script du
projet **"MT Food"**, pour donner à l'espace admin un vrai contrôle sur les
livreurs : qui est disponible / en livraison en ce moment, des statistiques
de livraisons par livreur, la possibilité d'ajouter ou modifier un livreur
directement depuis l'admin, et l'assignation manuelle d'une commande à un
livreur précis. Même méthode que d'habitude : tu copies-colles toi-même ce
bloc, puis tu redéploies.

**⚠️ Avant de commencer**, comme pour les blocs précédents : vérifie bien que
ce nouveau bloc est **séparé** de tout ce qui l'entoure, avec sa propre
accolade `}` de fermeture à la fin, et qu'aucune accolade ne s'est dupliquée
ou n'a disparu pendant la frappe/le collage.

## 1. Où coller ce code

Ouvre l'éditeur du projet **"MT Food"**, va à la fin du fichier `Code.gs`
(après le dernier `}` de la dernière fonction, à l'extérieur de toute autre
fonction), et colle tout le bloc de la section 3 ci-dessous.

## 2. Routage dans `doGet`

Trouve la toute dernière branche `else if` existante (juste avant le `else`
final qui dit « Action inconnue » — ce sera `getDashboardStats` si tu as
déjà collé le bloc du dashboard) et ajoute ces 5 nouveaux cas **avant** le
`else` final, en gardant le même style (`result = ...`, pas de `return`
direct) :

```js
  } else if (action === 'createDriver') {
    result = createDriver_(p.password, p.nom, p.telephone, p.zone, p.vehicule);
  } else if (action === 'updateDriver') {
    result = updateDriver_(p.password, p.telephone, p.nom, p.zone, p.vehicule);
  } else if (action === 'getDriversExtended') {
    result = getDriversExtended_(p.password);
  } else if (action === 'getDriverStats') {
    result = getDriverStats_(p.password, p.dateStart, p.dateEnd);
  } else if (action === 'assignOrderToDriver') {
    result = assignOrderToDriver_(p.password, p.numero, p.driverName);
  } else {
    result = { success: false, error: 'Action inconnue' };
  }
```

(Remplace juste le `} else {` existant par les lignes ci-dessus — ne
duplique pas le `else` final.)

## 3. Code à coller

```js
/* ============================================================
   CONTRÔLE LIVREURS AVANCÉ (ajouté 04/10/2026)
   Réutilise la Google Sheet séparée "MT Delivery - Livreurs"
   (constante LIVREURS_SHEET_ID déjà utilisée par livreurLogin_/getDrivers_)
   et l'onglet "Commandes" de la Sheet "MT Food Site".
   ============================================================ */

function getLivreursSheetForAdmin_() {
  var ss = SpreadsheetApp.openById(LIVREURS_SHEET_ID);
  return ss.getSheetByName('livreurs');
}

/* ---- Action admin : createDriver (ajout direct d'un livreur) ---- */
function createDriver_(password, nom, telephone, zone, vehicule) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;

  nom = String(nom || '').trim();
  var tel = normalizePhone_(telephone);
  zone = String(zone || '').trim();
  vehicule = String(vehicule || '').trim();
  if (!nom || !tel) {
    return { success: false, error: 'Nom et téléphone sont obligatoires.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getLivreursSheetForAdmin_();
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (values[i][2] && normalizePhone_(values[i][2]) === tel) {
        return { success: false, error: 'Un livreur avec ce téléphone existe déjà.' };
      }
    }
    sheet.appendRow([new Date(), nom, '', zone, vehicule, 'OUI', 'Actif', '', '']);
    var newRow = sheet.getLastRow();
    sheet.getRange(newRow, 3).setNumberFormat('@').setValue(tel);
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---- Action admin : updateDriver (modifier nom/zone/véhicule) ---- */
function updateDriver_(password, telephone, nom, zone, vehicule) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;

  var tel = normalizePhone_(telephone);
  if (!tel) return { success: false, error: 'Téléphone manquant.' };

  var sheet = getLivreursSheetForAdmin_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][2] && normalizePhone_(values[i][2]) === tel) {
      if (nom) sheet.getRange(i + 1, 2).setValue(String(nom).trim());
      if (zone) sheet.getRange(i + 1, 4).setValue(String(zone).trim());
      if (vehicule) sheet.getRange(i + 1, 5).setValue(String(vehicule).trim());
      return { success: true };
    }
  }
  return { success: false, error: 'Livreur introuvable.' };
}

/* ---- Action admin : getDriversExtended (statut + en-livraison en direct) ---- */
function getDriversExtended_(password) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;

  var sheet = getLivreursSheetForAdmin_();
  var values = sheet.getDataRange().getValues();
  var drivers = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[1]) continue;
    drivers.push({
      nom: row[1],
      telephone: String(row[2] || ''),
      zone: row[3],
      vehicule: row[4],
      statut: row[6],
      pin: !!row[8]
    });
  }

  var busySet = {};
  var cmdSheet = findSheet_('Commandes');
  if (cmdSheet) {
    var cmdValues = cmdSheet.getDataRange().getValues();
    for (var j = 0; j < cmdValues.length; j++) {
      var statutCmd = String(cmdValues[j][9] || '').trim();
      var livreurCmd = String(cmdValues[j][10] || '').trim();
      if (statutCmd === 'En livraison' && livreurCmd) busySet[livreurCmd] = true;
    }
  }

  drivers.forEach(function (d) {
    d.enLivraison = !!busySet[d.nom];
  });

  return { success: true, drivers: drivers };
}

/* ---- Action admin : getDriverStats (livraisons + total DA par livreur, période) ---- */
function getDriverStats_(password, dateStart, dateEnd) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;

  var sheet = findSheet_('Commandes');
  if (!sheet) return { success: false, error: 'Onglet Commandes introuvable' };
  var values = sheet.getDataRange().getValues();

  var start = dateStart ? new Date(dateStart + 'T00:00:00') : null;
  var end = dateEnd ? new Date(dateEnd + 'T23:59:59') : null;

  var driversMap = {};
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[1]) continue;
    var statut = String(row[9] || '').trim().toLowerCase();
    if (statut !== 'livrée' && statut !== 'livree') continue;
    var horodatage = row[0] ? new Date(row[0]) : null;
    if (!horodatage) continue;
    if (start && horodatage < start) continue;
    if (end && horodatage > end) continue;

    var livreur = String(row[10] || '').trim();
    if (!livreur) continue;

    if (!driversMap[livreur]) {
      driversMap[livreur] = { nom: livreur, nbLivraisons: 0, totalDA: 0 };
    }
    driversMap[livreur].nbLivraisons += 1;
    driversMap[livreur].totalDA += Number(row[8]) || 0;
  }

  var drivers = Object.keys(driversMap).map(function (k) { return driversMap[k]; });
  drivers.sort(function (a, b) { return b.totalDA - a.totalDA; });

  return { success: true, drivers: drivers };
}

/* ---- Action admin : assignOrderToDriver (assignation manuelle) ---- */
function assignOrderToDriver_(password, numero, driverName) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;

  numero = String(numero || '').trim();
  driverName = String(driverName || '').trim();
  if (!numero || !driverName) {
    return { success: false, error: 'Numéro de commande et livreur sont obligatoires.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = findSheet_('Commandes');
    if (!sheet) return { success: false, error: 'Onglet Commandes introuvable' };
    var values = sheet.getDataRange().getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][1]) === numero) {
        var statutActuel = String(values[i][9] || '').trim();
        if (statutActuel !== 'En attente') {
          return { success: false, error: 'Seule une commande "En attente" peut être assignée.' };
        }
        sheet.getRange(i + 1, 10).setValue('En livraison');
        sheet.getRange(i + 1, 11).setValue(driverName);
        return { success: true };
      }
    }
    return { success: false, error: 'Commande introuvable.' };
  } finally {
    lock.releaseLock();
  }
}
```

**Note** : `assignOrderToDriver` met à jour directement la commande (statut +
nom du livreur) mais n'envoie pas de notification push au livreur assigné
(contrairement à l'acceptation spontanée depuis `espace-livreur.html`) — le
livreur ne verra la commande que la prochaine fois qu'il consulte "Mes
livraisons". Amélioration possible plus tard si besoin.

## 4. Après avoir collé le code

1. `Ctrl+F` → vérifie qu'aucune accolade ne s'est dupliquée ou n'a disparu.
   Le bloc doit commencer par `/* ====...` et se terminer par le `}` qui
   ferme `function assignOrderToDriver_`, sans rien d'autre collé dedans.
2. Modifier les lignes de routage de la section 2 dans `doGet` (remplacer
   le `} else {` existant juste avant le `else` final).
3. Enregistrer (Ctrl+S), puis **Déployer → Gérer les déploiements → icône
   crayon → Version "Nouvelle version" → Déployer**.
4. Tester directement dans le navigateur (remplace MOT_DE_PASSE par ton
   vrai mot de passe admin) :
   `.../exec?action=getDriversExtended&password=MOT_DE_PASSE`
   Doit renvoyer un JSON avec `success:true` et la liste des livreurs,
   chacun avec un champ `enLivraison` (true/false).
