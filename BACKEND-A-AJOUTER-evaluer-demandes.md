# Backend à ajouter — « Évaluer » une demande (livreur / partenaire)

Le bouton **Évaluer** (admin → Demandes en attente) ouvre une fiche avec toutes
les informations fournies, puis **Valider** ou **Refuser (motif obligatoire)**.
La validation envoie les accès (lien, identifiant, code, mini-tutoriel) par
**WhatsApp** (message pré-rempli) et par **e-mail** (envoyé par le script si une
adresse est connue). Le refus envoie le motif de la même façon.

Le texte des messages est construit par la page admin (FR/AR) et simplement
transmis au script : rien à maintenir côté Apps Script.

## 1. Code à coller à la fin de `Code.gs`

```js
/* ============================================================
   ÉVALUATION DES DEMANDES (ajouté 07/10/2026)
   ============================================================ */

/* Trouve la ligne d'une demande. kind = 'partner' | 'driver'. */
function reqLocate_(kind, tel) {
  var sheet = kind === 'partner' ? findSheet_('Partenaires') : getLivreursSheetForAdmin_();
  if (!sheet) return null;
  var phoneIdx = kind === 'partner' ? 5 : 2;
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (normalizePhone_(values[i][phoneIdx]) === tel) {
      return { sheet: sheet, row: i + 1, headers: values[0], values: values[i] };
    }
  }
  return null;
}

/* Colonne par son titre ; la crée à droite si elle n'existe pas. */
function reqEnsureCol_(sheet, title) {
  var last = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, last).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === title.toLowerCase()) return i + 1;
  }
  sheet.getRange(1, last + 1).setValue(title);
  return last + 1;
}

function reqCellByTitle_(found, title) {
  for (var i = 0; i < found.headers.length; i++) {
    if (String(found.headers[i]).trim().toLowerCase() === title.toLowerCase()) {
      return String(found.values[i] || '').trim();
    }
  }
  return '';
}

/* Action admin : getRequestDetail — toutes les infos fournies (sans PIN). */
function getRequestDetail_(password, kind, telephone) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;
  var found = reqLocate_(kind, normalizePhone_(telephone));
  if (!found) return { success: false, error: 'Demande introuvable.' };
  var tz = Session.getScriptTimeZone();
  var fields = [];
  for (var j = 0; j < found.headers.length; j++) {
    var label = String(found.headers[j] || '').trim();
    var v = found.values[j];
    if (v === '' || v === null || v === undefined) continue;
    if (/pin|mot de passe|password/i.test(label)) continue;
    if (/^(email|e-mail|motif refus|date décision)$/i.test(label)) continue;
    if (Object.prototype.toString.call(v) === '[object Date]') {
      v = Utilities.formatDate(v, tz, 'dd/MM/yyyy HH:mm');
    }
    fields.push({ label: label || ('Colonne ' + (j + 1)), value: String(v) });
  }
  var pinCol = kind === 'partner' ? 10 : 8;
  return {
    success: true,
    fields: fields,
    email: reqCellByTitle_(found, 'Email'),
    motif: reqCellByTitle_(found, 'Motif refus'),
    hasPin: !!String(found.values[pinCol] || '').trim()
  };
}

function reqRandomPin_() {
  var pin;
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
  } while (/^(\d)\1{3}$/.test(pin) || pin === '1234' || pin === '4321');
  return pin;
}

/* Action admin : decideRequest
   decision = 'accept' | 'refuse'. En cas de refus, motif obligatoire.
   email / subject / body : facultatifs (e-mail envoyé si une adresse valide est connue). */
function decideRequest_(password, kind, telephone, decision, motif, email, subject, body) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;
  if (kind !== 'partner' && kind !== 'driver') return { success: false, error: 'Type invalide.' };
  if (decision !== 'accept' && decision !== 'refuse') return { success: false, error: 'Décision invalide.' };
  motif = String(motif || '').trim();
  if (decision === 'refuse' && !motif) return { success: false, error: 'Le motif du refus est obligatoire.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  var result = { success: true };
  var finalPin = '';
  var found;
  try {
    found = reqLocate_(kind, normalizePhone_(telephone));
    if (!found) return { success: false, error: 'Demande introuvable.' };
    var sheet = found.sheet;
    var statusCol = kind === 'partner' ? 9 : 7;
    var pinCol = kind === 'partner' ? 11 : 9;
    sheet.getRange(found.row, statusCol).setValue(decision === 'accept' ? 'Actif' : 'Refuse');

    var emailValue = String(email || '').trim();
    if (emailValue && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      sheet.getRange(found.row, reqEnsureCol_(sheet, 'Email')).setValue(emailValue);
    } else {
      emailValue = reqCellByTitle_(found, 'Email');
    }
    sheet.getRange(found.row, reqEnsureCol_(sheet, 'Date décision')).setValue(new Date());

    if (decision === 'refuse') {
      sheet.getRange(found.row, reqEnsureCol_(sheet, 'Motif refus')).setValue(motif);
    } else {
      // Un PIN n'est créé que s'il n'existe pas (le livreur garde celui qu'il a choisi).
      var existing = String(sheet.getRange(found.row, pinCol).getValue() || '').trim();
      finalPin = existing;
      if (!existing) {
        var pin = reqRandomPin_();
        var cell = sheet.getRange(found.row, pinCol);
        cell.setNumberFormat('@');
        cell.setValue(pin);
        finalPin = pin;
        result.pin = pin;      // renvoyé à l'admin uniquement, pour le message
      }
    }
  } finally {
    lock.releaseLock();
  }

  result.emailSent = false;
  var to = emailValue;
  if (to && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) && subject && body) {
    try {
      // {PIN} est remplacé ici (le navigateur ne connaît pas encore le PIN généré).
      // Pour un livreur, le PIN n'est jamais écrit dans le message : le corps n'en contient pas.
      var text = String(body).replace('{PIN}', kind === 'partner' ? finalPin : '');
      MailApp.sendEmail({ to: to, subject: String(subject).slice(0, 150), body: text, name: 'MT Delivery' });
      result.emailSent = true;
    } catch (err) {
      result.emailError = String(err && err.message || err);
    }
  }
  return result;
}
```

## 2. Brancher les deux actions dans `doGet`

Dans la chaîne `if (action === ...) result = ...` du dispatcher, ajouter :

```js
if (action === 'getRequestDetail') result = getRequestDetail_(p.password, p.kind, p.telephone);
if (action === 'decideRequest') result = decideRequest_(p.password, p.kind, p.telephone, p.decision, p.motif, p.email, p.subject, p.body);
```

(même forme que les lignes voisines, p. ex. `updatePartnerStatus`).

## 3. Permission e-mail (une seule fois)

L'envoi d'e-mail demande une permission de plus dans `appsscript.json`, dans la
liste `oauthScopes` :

    "https://www.googleapis.com/auth/script.send_mail"

Puis : éditeur Apps Script → lancer une fonction (ex. `autoriserDrive`) → **Autoriser**
→ **Déployer → Gérer les déploiements → Nouvelle version**.
Limite Google : environ 100 e-mails par jour (largement suffisant ici).

## 4. E-mail du partenaire à l'inscription (facultatif)

Le formulaire `devenir-partenaire.html` envoie maintenant `email` dans le `payload`.
Dans `registerPartner_`, juste après `phoneCell.setValue(String(data.telephone));` :

```js
    if (data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) {
      sheet.getRange(lastRow, reqEnsureCol_(sheet, 'Email')).setValue(String(data.email).trim());
    }
```

Pour les livreurs, l'inscription publique passe par l'autre projet Apps Script :
tant qu'il n'enregistre pas `email`, l'adresse peut être saisie à la main dans la fiche
« Évaluer » (elle est ensuite mémorisée).

## 5. Ordre de mise en ligne

1. Coller le code (1, 2, 4), ajouter la permission (3), autoriser, déployer une nouvelle version.
2. Ensuite seulement, fusionner la page `espace-admin.html` (sinon « Évaluer » affichera une erreur).
