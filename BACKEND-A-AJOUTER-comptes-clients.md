# Backend à ajouter dans "MT Food" (Code.gs) — Comptes clients

Ce fichier contient tout le code à copier-coller dans l'éditeur Apps Script du
projet **"MT Food"** (celui qui gère déjà le menu, les commandes, l'espace
livreur, l'espace partenaire et l'espace admin). Il n'est **pas** actif tant
qu'il n'est pas collé et déployé — les nouvelles pages du site (`connexion.html`,
`inscription.html`, `mot-de-passe-oublie.html`, `espace-client.html`) l'appellent
déjà, mais tombent sur une erreur générique en attendant.

**Pourquoi ce n'est pas fait automatiquement** : l'ajout de code dans l'éditeur
Apps Script en ligne, puis le redéploiement ("Nouvelle version"), demande une
étape de clic que l'outil de navigation refuse de faire seul en production
(voir le point "classificateur de sécurité" déjà documenté). Le plus sûr et le
plus rapide est que tu copies-colles toi-même ce bloc (un copier-coller humain
ne produit pas les bugs de frappe déjà rencontrés avec la saisie automatisée),
puis que tu fasses le redéploiement comme d'habitude.

## 1. Où coller ce code

Ouvre l'éditeur du projet **"MT Food"**, va à la fin du fichier `Code.gs`, et
colle tout le bloc de la section 3 ci-dessous.

## 2. Routage dans `doGet`

Dans la fonction `doGet(e)`, là où les actions existantes sont testées
(`adminLogin`, `getAllOrders`, `livreurLogin`, etc. — cherche avec `Ctrl+F` le
mot `action`), ajoute ces nouveaux cas **en suivant exactement le même modèle
que les actions existantes** (même façon de lire `e.parameter.action`, même
façon de renvoyer la réponse JSON — réutilise la fonction d'envoi de réponse
déjà utilisée par les autres actions, ne la duplique pas) :

```js
if (action === 'clientSignup')        return respondJson_(clientSignup_(e), e);
if (action === 'clientLogin')         return respondJson_(clientLogin_(e), e);
if (action === 'requestPasswordReset')return respondJson_(requestPasswordReset_(e), e);
if (action === 'resetPassword')       return respondJson_(resetPassword_(e), e);
if (action === 'getClientOrders')     return respondJson_(getClientOrders_(e), e);
if (action === 'reorder')             return respondJson_(reorder_(e), e);
if (action === 'validatePromoCode')   return respondJson_(validatePromoCode_(e), e);
```

`respondJson_(obj, e)` est un nom provisoire : remplace-le par le nom de la
fonction que le code utilise déjà pour renvoyer du JSON (probablement quelque
chose comme `ContentService.createTextOutput(...)`, éventuellement avec
gestion du paramètre `callback` pour le JSONP). **Ne crée pas une deuxième
fonction de réponse : réutilise celle qui existe déjà.**

## 3. Code à coller

```js
/* ============================================================
   COMPTES CLIENTS (ajouté 04/10/2026)
   Nouvel onglet "Clients" dans la Google Sheet "MT Food Site" :
   Horodatage | ClientId | Prenom | Nom | Email | Telephone |
   MotDePasseHash | Statut | TokenReset | TokenResetExpiration
   ============================================================ */
var CLIENTS_SHEET_NAME = 'Clients';
var PROMOTIONS_SHEET_NAME = 'Promotions';
var CLIENTS_HEADERS = ['Horodatage','ClientId','Prenom','Nom','Email','Telephone',
                        'MotDePasseHash','Statut','TokenReset','TokenResetExpiration'];

function getClientsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); // script lié à "MT Food Site"
  var sheet = ss.getSheetByName(CLIENTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CLIENTS_SHEET_NAME);
    sheet.appendRow(CLIENTS_HEADERS);
  }
  return sheet;
}

function getPromotionsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PROMOTIONS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PROMOTIONS_SHEET_NAME);
    sheet.appendRow(['Code','Reduction','Conditions','DateDebut','DateFin','Actif']);
  }
  return sheet;
}

/* ---- Normalisation identifiant (email ou téléphone) ---- */
function clientIsEmail_(identifiant) {
  return /@/.test(String(identifiant || ''));
}
function clientNormalizePhone_(phone) {
  // Même logique que le reste du site : retire tout sauf les chiffres,
  // puis le zéro de tête, pour comparer de façon fiable.
  var digits = String(phone || '').replace(/\D/g, '');
  return digits.replace(/^0+/, '');
}

/* ---- Hash du mot de passe (SHA-256 + sel stocké dans les propriétés du script) ---- */
function getClientPwdSalt_() {
  var props = PropertiesService.getScriptProperties();
  var salt = props.getProperty('CLIENT_PWD_SALT');
  if (!salt) {
    salt = Utilities.getUuid();
    props.setProperty('CLIENT_PWD_SALT', salt);
  }
  return salt;
}
function hashClientPassword_(password) {
  var salt = getClientPwdSalt_();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
  return digest.map(function(b){ var v=(b<0?b+256:b).toString(16); return v.length===1?'0'+v:v; }).join('');
}

/* ---- Recherche d'un client par e-mail OU téléphone ---- */
function findClientRow_(identifiant) {
  var sheet = getClientsSheet_();
  var values = sheet.getDataRange().getValues();
  var isEmail = clientIsEmail_(identifiant);
  var normPhone = clientNormalizePhone_(identifiant);
  for (var i = 1; i < values.length; i++) {
    var email = String(values[i][4] || '').trim().toLowerCase();
    var phone = clientNormalizePhone_(values[i][5]);
    if (isEmail && email && email === String(identifiant).trim().toLowerCase()) return { row: i + 1, data: values[i] };
    if (!isEmail && phone && phone === normPhone) return { row: i + 1, data: values[i] };
  }
  return null;
}

/* ---- Action : clientSignup ---- */
function clientSignup_(e) {
  var prenom = String(e.parameter.prenom || '').trim();
  var nom = String(e.parameter.nom || '').trim();
  var identifiant = String(e.parameter.identifiant || '').trim();
  var motDePasse = String(e.parameter.motDePasse || '');

  if (!prenom || !nom || !identifiant || motDePasse.length < 8) {
    return { success: false, error: 'Merci de remplir tous les champs (mot de passe : 8 caractères minimum).' };
  }
  if (findClientRow_(identifiant)) {
    return { success: false, error: 'Un compte existe déjà avec cet e-mail ou ce numéro.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getClientsSheet_();
    var clientId = Utilities.getUuid();
    var isEmail = clientIsEmail_(identifiant);
    var email = isEmail ? identifiant : '';
    var telephone = isEmail ? '' : identifiant;
    var row = [new Date(), clientId, prenom, nom, email, telephone,
               hashClientPassword_(motDePasse), 'Actif', '', ''];
    sheet.appendRow(row);
    // Téléphone : forcer le format texte pour ne pas perdre un zéro de tête
    if (telephone) {
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 6).setNumberFormat('@').setValue(telephone);
    }
    return { success: true, clientId: clientId, email: email, telephone: telephone };
  } finally {
    lock.releaseLock();
  }
}

/* ---- Action : clientLogin ---- */
function clientLogin_(e) {
  var identifiant = String(e.parameter.identifiant || '').trim();
  var motDePasse = String(e.parameter.motDePasse || '');
  if (!identifiant || !motDePasse) {
    return { success: false, error: 'Merci de remplir tous les champs.' };
  }
  var found = findClientRow_(identifiant);
  if (!found) return { success: false, error: 'Identifiant ou mot de passe incorrect.' };
  var data = found.data;
  if (String(data[7] || '').trim() !== 'Actif') {
    return { success: false, error: 'Ce compte est désactivé.' };
  }
  if (data[6] !== hashClientPassword_(motDePasse)) {
    return { success: false, error: 'Identifiant ou mot de passe incorrect.' };
  }
  return { success: true, clientId: data[1], prenom: data[2], nom: data[3], email: data[4], telephone: data[5] };
}

/* ---- Action : requestPasswordReset ----
   IMPORTANT : génère et stocke un code à 6 chiffres, mais ne l'envoie pas
   réellement tant qu'un service d'e-mail (ex. Resend/SendGrid) et/ou de SMS
   (ex. Twilio) n'est pas branché ci-dessous — voir les deux fonctions
   sendResetCodeByEmail_ / sendResetCodeBySms_ plus bas, marquées TODO.
   En attendant, le code généré est visible dans l'onglet "Clients" (colonne
   TokenReset) et dans les journaux d'exécution (Affichage > Journaux
   d'exécution), ce qui permet de tester le parcours complet dès maintenant. */
function requestPasswordReset_(e) {
  var identifiant = String(e.parameter.identifiant || '').trim();
  var canal = String(e.parameter.canal || 'email');
  var found = findClientRow_(identifiant);
  if (!found) {
    // On répond succès même si le compte n'existe pas, pour ne jamais révéler
    // quels e-mails/numéros sont inscrits.
    return { success: true };
  }
  var code = String(Math.floor(100000 + Math.random() * 900000));
  var expiration = new Date(Date.now() + 15 * 60 * 1000); // valable 15 minutes
  var sheet = getClientsSheet_();
  sheet.getRange(found.row, 9).setValue(code);
  sheet.getRange(found.row, 10).setValue(expiration);

  Logger.log('Code de réinitialisation pour ' + identifiant + ' (' + canal + ') : ' + code);
  if (canal === 'sms') {
    sendResetCodeBySms_(found.data[5], code);
  } else {
    sendResetCodeByEmail_(found.data[4], code);
  }
  return { success: true };
}

function sendResetCodeByEmail_(email, code) {
  // TODO : brancher un service d'envoi d'e-mail (ex. Resend, SendGrid).
  // Exemple avec Resend (nécessite une clé API à créer sur resend.com) :
  //
  // UrlFetchApp.fetch('https://api.resend.com/emails', {
  //   method: 'post',
  //   contentType: 'application/json',
  //   headers: { Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY') },
  //   payload: JSON.stringify({
  //     from: 'MT Delivery <no-reply@tondomaine.com>',
  //     to: [email],
  //     subject: 'Ton code de réinitialisation MT Delivery',
  //     text: 'Ton code : ' + code + ' (valable 15 minutes).'
  //   })
  // });
  //
  // En attendant que RESEND_API_KEY soit configurée, cette fonction ne fait
  // qu'écrire dans les journaux (voir requestPasswordReset_ ci-dessus).
}

function sendResetCodeBySms_(telephone, code) {
  // TODO : brancher un service d'envoi de SMS (ex. Twilio, nécessite un compte
  // payant + des identifiants Account SID / Auth Token / numéro expéditeur).
  //
  // var accountSid = PropertiesService.getScriptProperties().getProperty('TWILIO_SID');
  // var authToken = PropertiesService.getScriptProperties().getProperty('TWILIO_TOKEN');
  // UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Messages.json', {
  //   method: 'post',
  //   headers: { Authorization: 'Basic ' + Utilities.base64Encode(accountSid + ':' + authToken) },
  //   payload: { To: '+213' + clientNormalizePhone_(telephone), From: 'TON_NUMERO_TWILIO', Body: 'Code MT Delivery : ' + code }
  // });
}

/* ---- Action : resetPassword ---- */
function resetPassword_(e) {
  var identifiant = String(e.parameter.identifiant || '').trim();
  var code = String(e.parameter.code || '').trim();
  var nouveauMotDePasse = String(e.parameter.nouveauMotDePasse || '');
  if (nouveauMotDePasse.length < 8) {
    return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères.' };
  }
  var found = findClientRow_(identifiant);
  if (!found) return { success: false, error: 'Compte introuvable.' };
  var storedCode = String(found.data[8] || '');
  var expiration = found.data[9];
  if (!storedCode || storedCode !== code) {
    return { success: false, error: 'Code incorrect.' };
  }
  if (expiration && new Date(expiration).getTime() < Date.now()) {
    return { success: false, error: 'Ce code a expiré, merci de refaire une demande.' };
  }
  var sheet = getClientsSheet_();
  sheet.getRange(found.row, 7).setValue(hashClientPassword_(nouveauMotDePasse));
  sheet.getRange(found.row, 9).setValue('');
  sheet.getRange(found.row, 10).setValue('');
  return { success: true };
}

/* ---- Action : getClientOrders ----
   Associe les commandes au client par numéro de téléphone normalisé — la
   seule information fiable disponible aujourd'hui dans l'onglet "Commandes"
   pour un client (les commandes ne connaissent pas encore le ClientId, car
   le formulaire de commande n'est pas encore relié aux comptes). */
function getClientOrders_(e) {
  var clientId = String(e.parameter.clientId || '').trim();
  var sheet = getClientsSheet_();
  var values = sheet.getDataRange().getValues();
  var client = null;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === clientId) { client = values[i]; break; }
  }
  if (!client) return { success: false, error: 'Compte introuvable.' };
  var clientPhone = clientNormalizePhone_(client[5]);
  if (!clientPhone) return { success: true, orders: [] }; // compte créé par e-mail, sans téléphone

  var ordersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Commandes');
  var rows = ordersSheet.getDataRange().getValues();
  var orders = [];
  for (var j = 0; j < rows.length; j++) {
    var rowPhone = clientNormalizePhone_(rows[j][3]);
    if (rowPhone && rowPhone === clientPhone) {
      orders.push({
        numero: rows[j][1],
        date: rows[j][0] instanceof Date ? rows[j][0].toLocaleString('fr-FR') : String(rows[j][0]),
        total: rows[j][8],
        statut: rows[j][9],
        articles: rows[j][7]
      });
    }
  }
  orders.sort(function(a, b){ return new Date(b.date) - new Date(a.date); });
  return { success: true, orders: orders };
}

/* ---- Action : reorder ----
   Reconstruit un panier à partir d'une commande passée, en retrouvant les
   plats par leur nom dans l'onglet "menu" actuel (un plat retiré du menu
   depuis sera simplement ignoré). */
function reorder_(e) {
  var clientId = String(e.parameter.clientId || '').trim();
  var numero = String(e.parameter.numero || '').trim();
  var ordersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Commandes');
  var rows = ordersSheet.getDataRange().getValues();
  var articlesText = '';
  for (var j = 0; j < rows.length; j++) {
    if (String(rows[j][1]) === numero) { articlesText = String(rows[j][7] || ''); break; }
  }
  if (!articlesText) return { success: false, error: 'Commande introuvable.' };

  var menuSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('menu');
  var menuRows = menuSheet.getDataRange().getValues();
  var panier = [];
  var parts = articlesText.split('|');
  for (var k = 0; k < parts.length; k++) {
    var m = parts[k].match(/^\s*(\d+)\s*x\s+(.+?)\s*\(/i);
    if (!m) continue;
    var qty = parseInt(m[1], 10);
    var nom = m[2].trim().toLowerCase();
    for (var r = 1; r < menuRows.length; r++) {
      if (String(menuRows[r][1] || '').trim().toLowerCase() === nom) {
        panier.push({ id: menuRows[r][0], nom: menuRows[r][1], qty: qty });
        break;
      }
    }
  }
  return { success: true, panier: panier };
}

/* ---- Action : validatePromoCode ---- */
function validatePromoCode_(e) {
  var code = String(e.parameter.code || '').trim().toLowerCase();
  if (!code) return { success: false, error: 'Merci d\'entrer un code.' };
  var sheet = getPromotionsSheet_();
  var values = sheet.getDataRange().getValues();
  var now = new Date();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === code) {
      var actif = String(values[i][5] || '').trim().toLowerCase() === 'oui' || values[i][5] === true;
      var debut = values[i][3], fin = values[i][4];
      if (!actif) return { success: false, error: 'Ce code promo n\'est plus actif.' };
      if (debut && now < new Date(debut)) return { success: false, error: 'Ce code promo n\'est pas encore valable.' };
      if (fin && now > new Date(fin)) return { success: false, error: 'Ce code promo a expiré.' };
      return { success: true, reduction: values[i][1], conditions: values[i][2] };
    }
  }
  return { success: false, error: 'Code promo invalide.' };
}
```

## 4. Après avoir collé le code

1. `Ctrl+F` → vérifier qu'aucune accolade ne s'est dupliquée (bug de saisie déjà
   rencontré plusieurs fois dans cet éditeur — vérifier par capture d'écran).
2. Ajouter les 7 lignes de routage de la section 2 dans `doGet`.
3. Enregistrer (Ctrl+S), puis **Déployer → Gérer les déploiements → icône
   crayon → Version "Nouvelle version" → Déployer** (c'est le clic qui doit
   être fait par toi, voir la contrainte déjà documentée).
4. Tester directement dans le navigateur, par exemple :
   `.../exec?action=clientSignup&prenom=Test&nom=Test&identifiant=test@test.com&motDePasse=12345678`
   puis `.../exec?action=clientLogin&identifiant=test@test.com&motDePasse=12345678`
   et supprimer la ligne de test créée dans l'onglet "Clients" après vérification.

## 5. Ce qu'il reste à configurer pour que tout soit pleinement actif

- **Réinitialisation par e-mail** : créer un compte sur un service comme
  [resend.com](https://resend.com) (gratuit pour un petit volume), récupérer
  une clé API, la coller dans **Propriétés du script** (`Project Settings` →
  `Script properties` → ajouter `RESEND_API_KEY`), puis décommenter/compléter
  le code dans `sendResetCodeByEmail_`.
- **Réinitialisation par SMS** : créer un compte [Twilio](https://twilio.com)
  (payant à l'usage), ajouter `TWILIO_SID` et `TWILIO_TOKEN` dans les
  propriétés du script, compléter `sendResetCodeBySms_`.
- **Connexion avec Google** : créer un ID client OAuth sur
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
  le coller dans `CONFIG.GOOGLE_CLIENT_ID` en haut de `connexion.html` et
  `inscription.html`. Une fois fait, dis-le pour que l'intégration complète
  (Google Identity Services + nouvelle action backend `clientLoginGoogle`)
  soit ajoutée.
