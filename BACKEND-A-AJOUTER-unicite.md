# Backend à modifier dans "MT Food" (Code.gs) — Un seul compte par téléphone / e-mail

Objectif : empêcher deux comptes avec le même téléphone (partenaires) ou le
même e-mail / téléphone (clients, livreurs), et voir dans l'admin les
doublons déjà présents (ex. deux partenaires avec le numéro `0770328896`).

**À savoir** : Google Sheets n'a pas de « clé primaire » ni de contraintes
d'unicité comme une vraie base de données. On les remplace par une
vérification faite par le code **avant** chaque ajout de ligne (sous verrou,
donc deux inscriptions simultanées ne passent pas toutes les deux).

- **Clients** : déjà protégé (`findClientRow_` dans `clientSignup_`).
- **Livreurs créés depuis l'admin** : déjà protégé (`createDriver_`).
- **Partenaires** (`registerPartner_`) : **pas protégé → étape 2 ci-dessous.**
- **Inscription publique des livreurs** : elle passe par un *autre* projet
  Apps Script (autre URL de déploiement). Voir la note en fin de fichier.

**⚠️ Avant de commencer** : comme pour les blocs précédents, vérifie que
chaque bloc collé a sa propre accolade `}` de fermeture et qu'aucune accolade
ne s'est dupliquée ou n'a disparu.

## 1. Code à coller à la fin de `Code.gs`

```js
/* ============================================================
   UNICITÉ DES COMPTES (ajouté 05/10/2026)
   ============================================================ */

/* Clé de comparaison d'un téléphone : chiffres seulement, sans le 213
   ni le 0 de tête. "0770 32 88 96" et "+213770328896" => "770328896". */
function accountPhoneKey_(phone) {
  var d = String(phone || '').replace(/\D/g, '');
  d = d.replace(/^213/, '').replace(/^0+/, '');
  return d;
}

/* Renvoie le numéro de ligne d'un partenaire déjà inscrit avec ce téléphone, sinon 0. */
function findPartnerDuplicate_(sheet, telephone) {
  var key = accountPhoneKey_(telephone);
  if (!key) return 0;
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (accountPhoneKey_(values[i][5]) === key) return i + 1;
  }
  return 0;
}

/* Action admin : getDuplicates — liste les doublons existants (partenaires, livreurs, clients). */
function getDuplicateAccounts_(password) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;

  var groups = [];

  function scan(type, field, rows, nameIdx, valueIdx, normalize) {
    var map = {};
    for (var i = 1; i < rows.length; i++) {
      var raw = rows[i][valueIdx];
      var key = normalize(raw);
      if (!key) continue;
      if (!map[key]) map[key] = { type: type, field: field, value: String(raw), names: [] };
      map[key].names.push(String(rows[i][nameIdx] || ''));
    }
    Object.keys(map).forEach(function (k) {
      if (map[k].names.length > 1) groups.push(map[k]);
    });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var partners = findSheet_('Partenaires');
  if (partners) scan('partner', 'telephone', partners.getDataRange().getValues(), 1, 5, accountPhoneKey_);

  try {
    var drivers = SpreadsheetApp.openById(LIVREURS_SHEET_ID).getSheetByName('livreurs');
    if (drivers) scan('driver', 'telephone', drivers.getDataRange().getValues(), 1, 2, accountPhoneKey_);
  } catch (err) { /* feuille livreurs inaccessible : on ignore */ }

  var clients = ss.getSheetByName('Clients');
  if (clients) {
    var cv = clients.getDataRange().getValues();
    scan('client', 'telephone', cv, 2, 5, accountPhoneKey_);
    scan('client', 'email', cv, 2, 4, function (v) { return String(v || '').trim().toLowerCase(); });
  }

  return { success: true, duplicates: groups };
}
```

## 2. Bloquer les doublons à l'inscription d'un partenaire

Dans la fonction `registerPartner_`, juste **après** ces lignes :

```js
var sheet = findSheet_('Partenaires');
if (!sheet) {
return { success: false, error: 'Onglet Partenaires introuvable' };
}
```

ajoute ces 3 lignes (avant `sheet.appendRow([`) :

```js
if (findPartnerDuplicate_(sheet, data.telephone)) {
return { success: false, code: 'DUPLICATE', error: 'Un partenaire avec ce numéro de téléphone existe déjà.' };
}
```

(Le verrou `lock.waitLock` est déjà pris juste au-dessus, donc le contrôle et
l'ajout sont atomiques.)

## 3. Routage dans `doGet`

Ajoute ce cas **avant** le `else` final « Action inconnue » (même style :
`result = ...`, pas de `return`) :

```js
  } else if (action === 'getDuplicates') {
    result = getDuplicateAccounts_(p.password);
  } else {
    result = { success: false, error: 'Action inconnue' };
  }
```

(Remplace juste le `} else {` existant — ne duplique pas le `else` final.)

## 4. Après avoir collé

1. `Ctrl+F` → vérifie qu'aucune accolade ne s'est dupliquée ou n'a disparu.
2. Enregistrer (Ctrl+S), puis **Déployer → Gérer les déploiements → icône
   crayon → Version "Nouvelle version" → Déployer**.
3. Test : `.../exec?action=getDuplicates&password=MOT_DE_PASSE` doit renvoyer
   `success:true` et la liste des doublons (au minimum le téléphone
   `0770328896` en double côté partenaires).

## Note — inscription publique des livreurs (autre projet)

`inscription-livreur.html` envoie le formulaire à un autre déploiement Apps
Script. Pour y bloquer aussi les doublons, la même vérification doit être
ajoutée dans la fonction qui reçoit ce formulaire, avant l'ajout de la ligne
(comparer `accountPhoneKey_` du nouveau téléphone avec la colonne
téléphone de la feuille `livreurs`). Il faut ouvrir ce projet-là pour le
faire : à traiter séparément.
