# Backend à ajouter dans "MT Food" (Code.gs) — Publicités « À la une » (demandes des partenaires)

Phase 1 du système de publicité : le partenaire demande une mise en avant de
l'un de ses plats, l'administrateur accepte / renvoie pour modification /
refuse, fixe les dates et marque « payé ». Seules les demandes approuvées,
payées, non suspendues et dans leur période s'affichent sur l'accueil.

L'ancien système (feuille `Publicites`, actions `getAds` etc.) **n'est pas
touché** : il continue de fonctionner.

**Rappel** : après chaque bloc collé, vérifie les accolades `}` (capture d'écran
si tu veux que je regarde).

## 1. Code à coller à la fin de `Code.gs`

Trois onglets sont créés automatiquement au premier appel : `Pub_Offres`
(avec 3 offres : 7 / 15 / 30 jours), `Pub_Demandes`, `Pub_Historique`.
**Les prix se changent directement dans l'onglet `Pub_Offres`** (colonne Prix).

```js
/* ============================================================
   PUBLICITÉS « À LA UNE » — demandes partenaires (ajouté 05/10/2026)
   ============================================================ */
var PUB_MAX_SLOTS = 6;            // annonceurs en même temps
var PUB_TZ = 'Africa/Algiers';
var PUB_OFFERS_HEADERS = ['ID','Emplacement','DureeJours','PrixDA','Actif'];
var PUB_REQ_HEADERS = ['ID','Date','Telephone','Restaurant','OffreID','DureeJours','PrixDA',
  'NomPlat','PrixPlat','Texte','ImageURL','LienURL','DebutSouhaite','Statut','CommentaireAdmin',
  'Debut','Fin','Paye','Suspendue','Modifie'];
var PUB_HIST_HEADERS = ['Horodatage','Acteur','DemandeID','Action','AncienStatut','NouveauStatut','Commentaire'];
// Statuts stockés : en_attente, a_modifier, refusee, approuvee
// Etats calculés (jamais stockés) : planifiee, active, expiree, suspendue

function pubSheet_(name, headers, seedRows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    if (seedRows) seedRows.forEach(function (r) { sh.appendRow(r); });
    if (name === 'Pub_Demandes') {
      // dates en texte pour éviter la conversion automatique de Google Sheets
      sh.getRange(2, 13, 1000, 1).setNumberFormat('@');
      sh.getRange(2, 16, 1000, 2).setNumberFormat('@');
    }
  }
  return sh;
}
function pubOffersSheet_() {
  return pubSheet_('Pub_Offres', PUB_OFFERS_HEADERS, [
    ['OFF-7', 'une', 7, 2000, 'OUI'],
    ['OFF-15', 'une', 15, 3500, 'OUI'],
    ['OFF-30', 'une', 30, 6000, 'OUI']
  ]);
}
function pubReqSheet_() { return pubSheet_('Pub_Demandes', PUB_REQ_HEADERS, null); }
function pubHistSheet_() { return pubSheet_('Pub_Historique', PUB_HIST_HEADERS, null); }

function pubToday_() { return Utilities.formatDate(new Date(), PUB_TZ, 'yyyy-MM-dd'); }
function pubNormDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, PUB_TZ, 'yyyy-MM-dd');
  return String(v || '').trim().substring(0, 10);
}
function pubIsDate_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function pubAddDays_(dateStr, n) {
  var d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}
function pubLog_(acteur, id, action, avant, apres, comment) {
  pubHistSheet_().appendRow([new Date(), acteur, id, action, avant || '', apres || '', comment || '']);
}

/* Etat affiché, calculé à partir du statut et des dates */
function pubEtat_(o) {
  if (o.statut !== 'approuvee') return o.statut;
  if (o.suspendue) return 'suspendue';
  var today = pubToday_();
  if (!o.debut || !o.fin) return 'approuvee';
  if (today < o.debut) return 'planifiee';
  if (today > o.fin) return 'expiree';
  return 'active';
}
function pubRowToObject_(r) {
  var o = {
    id: String(r[0]), date: pubNormDate_(r[1]), telephone: String(r[2]), restaurant: String(r[3]),
    offreId: String(r[4]), dureeJours: Number(r[5]) || 0, prixDA: Number(r[6]) || 0,
    nomPlat: String(r[7]), prixPlat: r[8] === '' ? '' : Number(r[8]), texte: String(r[9]),
    imageUrl: String(r[10]), lienUrl: String(r[11]), debutSouhaite: pubNormDate_(r[12]),
    statut: String(r[13]), commentaire: String(r[14] || ''), debut: pubNormDate_(r[15]),
    fin: pubNormDate_(r[16]), paye: String(r[17]).toUpperCase() === 'OUI',
    suspendue: String(r[18]).toUpperCase() === 'OUI'
  };
  o.etat = pubEtat_(o);
  return o;
}

/* Partenaire existant et actif (même clé téléphone que l'unicité des comptes) */
function pubFindPartner_(telephone) {
  var key = accountPhoneKey_(telephone);
  if (!key) return null;
  var sheet = findSheet_('Partenaires');
  if (!sheet) return null;
  var v = sheet.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (accountPhoneKey_(v[i][5]) === key) {
      return { nom: String(v[i][1]), actif: String(v[i][8] || '').trim().toLowerCase() === 'actif' };
    }
  }
  return null;
}

function pubValidate_(p) {
  var nomPlat = String(p.nomPlat || '').trim();
  var texte = String(p.texte || '').trim();
  var imageUrl = String(p.imageUrl || '').trim();
  var lienUrl = String(p.lienUrl || '').trim();
  var debut = String(p.debutSouhaite || '').trim();
  var prixPlat = String(p.prixPlat || '').trim();
  if (nomPlat.length < 2 || nomPlat.length > 60) return { error: 'Nom du plat : 2 à 60 caractères.' };
  if (texte.length > 120) return { error: 'Texte : 120 caractères maximum.' };
  if (!/^https:\/\/\S+$/i.test(imageUrl) || imageUrl.length > 500) return { error: "Le visuel doit être un lien https valide." };
  if (lienUrl && (!/^https:\/\/\S+$/i.test(lienUrl) || lienUrl.length > 500)) return { error: 'Lien de destination invalide (https).' };
  if (!pubIsDate_(debut) || debut < pubToday_()) return { error: 'Date de début souhaitée invalide ou passée.' };
  var pp = '';
  if (prixPlat !== '') {
    pp = Number(prixPlat.replace(',', '.'));
    if (isNaN(pp) || pp < 0 || pp > 100000) return { error: 'Prix du plat invalide.' };
  }
  return { ok: true, nomPlat: nomPlat, texte: texte, imageUrl: imageUrl, lienUrl: lienUrl, debut: debut, prixPlat: pp };
}

function pubFindOffer_(offreId) {
  var v = pubOffersSheet_().getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === offreId && String(v[i][4]).toUpperCase() === 'OUI') {
      return { id: String(v[i][0]), duree: Number(v[i][2]), prix: Number(v[i][3]) };
    }
  }
  return null;
}

/* ---- Public : offres + nombre de places occupées aujourd'hui ---- */
function getPubOffers_(e) {
  var v = pubOffersSheet_().getDataRange().getValues();
  var offers = [];
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][4]).toUpperCase() === 'OUI') {
      offers.push({ id: String(v[i][0]), dureeJours: Number(v[i][2]), prixDA: Number(v[i][3]) });
    }
  }
  var r = pubReqSheet_().getDataRange().getValues();
  var today = pubToday_(), busy = 0;
  for (var j = 1; j < r.length; j++) {
    var o = pubRowToObject_(r[j]);
    if (o.etat === 'active') busy++;
  }
  return { success: true, offers: offers, maxSlots: PUB_MAX_SLOTS, busy: busy,
           format: { largeur: 800, hauteur: 800, formats: 'JPG, PNG, WebP', tailleMaxKo: 500 } };
}

/* ---- Partenaire : envoyer une demande ---- */
function submitPubRequest_(e) {
  var p = e.parameter;
  var partner = pubFindPartner_(p.telephone);
  if (!partner || !partner.actif) return { success: false, error: 'Compte partenaire introuvable ou inactif.' };
  var offer = pubFindOffer_(String(p.offreId || ''));
  if (!offer) return { success: false, error: 'Offre introuvable.' };
  var val = pubValidate_(p);
  if (!val.ok) return { success: false, error: val.error };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = pubReqSheet_();
    var v = sheet.getDataRange().getValues();
    var key = accountPhoneKey_(p.telephone), pending = 0, maxN = 0;
    for (var i = 1; i < v.length; i++) {
      var m = /^PUB-(\d+)$/.exec(String(v[i][0]));
      if (m) maxN = Math.max(maxN, Number(m[1]));
      if (accountPhoneKey_(v[i][2]) === key && (v[i][13] === 'en_attente' || v[i][13] === 'a_modifier')) pending++;
    }
    if (pending >= 3) return { success: false, error: 'Vous avez déjà 3 demandes en cours.' };
    var id = 'PUB-' + ('0000' + (maxN + 1)).slice(-4);
    sheet.appendRow([id, new Date(), String(p.telephone), partner.nom, offer.id, offer.duree, offer.prix,
      val.nomPlat, val.prixPlat, val.texte, val.imageUrl, val.lienUrl, val.debut, 'en_attente', '', '', '', 'NON', 'NON', new Date()]);
    pubLog_('partenaire:' + partner.nom, id, 'envoi', '', 'en_attente', '');
    return { success: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

/* ---- Partenaire : mes demandes ---- */
function getMyPubRequests_(e) {
  var key = accountPhoneKey_(e.parameter.telephone);
  if (!key || !pubFindPartner_(e.parameter.telephone)) return { success: false, error: 'Compte introuvable.' };
  var v = pubReqSheet_().getDataRange().getValues(), list = [];
  for (var i = 1; i < v.length; i++) {
    if (accountPhoneKey_(v[i][2]) === key) list.push(pubRowToObject_(v[i]));
  }
  list.reverse();
  return { success: true, requests: list };
}

/* ---- Partenaire : corriger et renvoyer une demande « à modifier » ---- */
function resubmitPubRequest_(e) {
  var p = e.parameter;
  var key = accountPhoneKey_(p.telephone);
  if (!key || !pubFindPartner_(p.telephone)) return { success: false, error: 'Compte introuvable.' };
  var val = pubValidate_(p);
  if (!val.ok) return { success: false, error: val.error };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = pubReqSheet_();
    var v = sheet.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][0]) === String(p.id) && accountPhoneKey_(v[i][2]) === key) {
        if (v[i][13] !== 'a_modifier') return { success: false, error: 'Cette demande ne peut plus être modifiée.' };
        sheet.getRange(i + 1, 8, 1, 6).setValues([[val.nomPlat, val.prixPlat, val.texte, val.imageUrl, val.lienUrl, val.debut]]);
        sheet.getRange(i + 1, 14).setValue('en_attente');
        sheet.getRange(i + 1, 20).setValue(new Date());
        pubLog_('partenaire:' + v[i][3], p.id, 'renvoi', 'a_modifier', 'en_attente', '');
        return { success: true };
      }
    }
    return { success: false, error: 'Demande introuvable.' };
  } finally {
    lock.releaseLock();
  }
}

/* ---- Public : publicités affichables aujourd'hui sur l'accueil ---- */
function getFeaturedPubs_(e) {
  var v = pubReqSheet_().getDataRange().getValues(), list = [];
  for (var i = 1; i < v.length; i++) {
    var o = pubRowToObject_(v[i]);
    if (o.etat === 'active' && o.paye) {
      list.push({ id: o.id, restaurant: o.restaurant, nomPlat: o.nomPlat, prixPlat: o.prixPlat,
                  texte: o.texte, imageUrl: o.imageUrl, lienUrl: o.lienUrl });
    }
  }
  return { success: true, pubs: list.slice(0, PUB_MAX_SLOTS) };
}

/* ---- Admin : toutes les demandes ---- */
function getAllPubRequests_(e) {
  if (!findAdminByPassword_(String(e.parameter.password || ''))) return { success: false, error: 'Mot de passe incorrect.' };
  var v = pubReqSheet_().getDataRange().getValues(), list = [];
  for (var i = 1; i < v.length; i++) { if (v[i][0]) list.push(pubRowToObject_(v[i])); }
  list.reverse();
  return { success: true, requests: list, maxSlots: PUB_MAX_SLOTS };
}

/* Jour complet (>= PUB_MAX_SLOTS annonceurs) dans la période, sinon '' */
function pubFullDay_(values, selfId, debut, fin) {
  for (var n = 0; n < 400; n++) {
    var day = pubAddDays_(debut, n);
    if (day > fin) break;
    var count = 0;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][13]) !== 'approuvee' || String(values[i][0]) === selfId) continue;
      if (String(values[i][18]).toUpperCase() === 'OUI') continue;
      var d1 = pubNormDate_(values[i][15]), d2 = pubNormDate_(values[i][16]);
      if (d1 && d2 && d1 <= day && day <= d2) count++;
    }
    if (count >= PUB_MAX_SLOTS) return day;
  }
  return '';
}

/* ---- Admin : décider d'une demande (approve | modify | refuse) ---- */
function decidePubRequest_(e) {
  var p = e.parameter;
  if (!findAdminByPassword_(String(p.password || ''))) return { success: false, error: 'Mot de passe incorrect.' };
  var decision = String(p.decision || '');
  var comment = String(p.comment || '').trim();
  if ((decision === 'modify' || decision === 'refuse') && !comment) {
    return { success: false, error: 'Un commentaire est obligatoire.' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = pubReqSheet_();
    var v = sheet.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][0]) !== String(p.id)) continue;
      if (v[i][13] !== 'en_attente') return { success: false, error: 'Déjà traitée.' };
      var row = i + 1;
      if (decision === 'approve') {
        var debut = String(p.debut || '').trim() || pubNormDate_(v[i][12]);
        if (!pubIsDate_(debut)) return { success: false, error: 'Date de début invalide.' };
        if (debut < pubToday_()) debut = pubToday_();
        var fin = pubAddDays_(debut, Number(v[i][5]) - 1);
        var full = pubFullDay_(v, String(v[i][0]), debut, fin);
        if (full) return { success: false, error: 'Emplacement complet le ' + full + ' (' + PUB_MAX_SLOTS + ' annonceurs). Choisissez une autre date.' };
        sheet.getRange(row, 14, 1, 2).setValues([['approuvee', comment]]);
        sheet.getRange(row, 16, 1, 2).setValues([[debut, fin]]);
        sheet.getRange(row, 18).setValue(String(p.paye).toUpperCase() === 'OUI' ? 'OUI' : 'NON');
        pubLog_('admin', v[i][0], 'approbation', 'en_attente', 'approuvee', debut + ' → ' + fin + (comment ? ' | ' + comment : ''));
      } else if (decision === 'modify') {
        sheet.getRange(row, 14, 1, 2).setValues([['a_modifier', comment]]);
        pubLog_('admin', v[i][0], 'renvoi pour modification', 'en_attente', 'a_modifier', comment);
      } else if (decision === 'refuse') {
        sheet.getRange(row, 14, 1, 2).setValues([['refusee', comment]]);
        pubLog_('admin', v[i][0], 'refus', 'en_attente', 'refusee', comment);
      } else {
        return { success: false, error: 'Décision inconnue.' };
      }
      sheet.getRange(row, 20).setValue(new Date());
      return { success: true };
    }
    return { success: false, error: 'Demande introuvable.' };
  } finally {
    lock.releaseLock();
  }
}

/* ---- Admin : marquer payé / non payé ---- */
function setPubPaid_(e) {
  var p = e.parameter;
  if (!findAdminByPassword_(String(p.password || ''))) return { success: false, error: 'Mot de passe incorrect.' };
  var paye = String(p.paye).toUpperCase() === 'OUI' ? 'OUI' : 'NON';
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = pubReqSheet_(), v = sheet.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][0]) === String(p.id)) {
        sheet.getRange(i + 1, 18).setValue(paye);
        pubLog_('admin', v[i][0], paye === 'OUI' ? 'marqué payé' : 'marqué non payé', '', '', '');
        return { success: true };
      }
    }
    return { success: false, error: 'Demande introuvable.' };
  } finally {
    lock.releaseLock();
  }
}

/* ---- Admin : suspendre / réactiver ---- */
function setPubSuspended_(e) {
  var p = e.parameter;
  if (!findAdminByPassword_(String(p.password || ''))) return { success: false, error: 'Mot de passe incorrect.' };
  var on = String(p.suspendue).toUpperCase() === 'OUI' ? 'OUI' : 'NON';
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = pubReqSheet_(), v = sheet.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][0]) === String(p.id)) {
        if (v[i][13] !== 'approuvee') return { success: false, error: 'Seule une publicité approuvée peut être suspendue.' };
        if (on === 'NON') {
          var d1 = pubNormDate_(v[i][15]), d2 = pubNormDate_(v[i][16]);
          var full = d1 && d2 ? pubFullDay_(v, String(v[i][0]), d1, d2) : '';
          if (full) return { success: false, error: 'Emplacement complet le ' + full + ', réactivation impossible.' };
        }
        sheet.getRange(i + 1, 19).setValue(on);
        sheet.getRange(i + 1, 20).setValue(new Date());
        pubLog_('admin', v[i][0], on === 'OUI' ? 'suspension' : 'réactivation', '', '', String(p.comment || ''));
        return { success: true };
      }
    }
    return { success: false, error: 'Demande introuvable.' };
  } finally {
    lock.releaseLock();
  }
}

/* ---- Admin : historique d'une demande (ou tout) ---- */
function getPubHistory_(e) {
  if (!findAdminByPassword_(String(e.parameter.password || ''))) return { success: false, error: 'Mot de passe incorrect.' };
  var v = pubHistSheet_().getDataRange().getValues(), list = [], id = String(e.parameter.id || '');
  for (var i = v.length - 1; i >= 1 && list.length < 200; i--) {
    if (id && String(v[i][2]) !== id) continue;
    list.push({ date: Utilities.formatDate(new Date(v[i][0]), PUB_TZ, 'yyyy-MM-dd HH:mm'), acteur: String(v[i][1]),
      id: String(v[i][2]), action: String(v[i][3]), de: String(v[i][4]), vers: String(v[i][5]), commentaire: String(v[i][6]) });
  }
  return { success: true, history: list };
}
```

## 2. Routage dans `doGet`

Avant le `else` final « Action inconnue » (même style, pas de `return`) :

```js
  } else if (action === 'getPubOffers') {
    result = getPubOffers_(e);
  } else if (action === 'submitPubRequest') {
    result = submitPubRequest_(e);
  } else if (action === 'getMyPubRequests') {
    result = getMyPubRequests_(e);
  } else if (action === 'resubmitPubRequest') {
    result = resubmitPubRequest_(e);
  } else if (action === 'getFeaturedPubs') {
    result = getFeaturedPubs_(e);
  } else if (action === 'getAllPubRequests') {
    result = getAllPubRequests_(e);
  } else if (action === 'decidePubRequest') {
    result = decidePubRequest_(e);
  } else if (action === 'setPubPaid') {
    result = setPubPaid_(e);
  } else if (action === 'setPubSuspended') {
    result = setPubSuspended_(e);
  } else if (action === 'getPubHistory') {
    result = getPubHistory_(e);
  } else {
    result = { success: false, error: 'Action inconnue' };
  }
```

(Remplace juste le `} else {` existant — ne duplique pas le `else` final.)

Ce bloc utilise `accountPhoneKey_`, `findSheet_` et `findAdminByPassword_`, déjà
présents dans ton projet.

## 3. Après avoir collé

1. Vérifier les accolades (`Ctrl+F`).
2. Enregistrer (Ctrl+S), puis **Déployer → Gérer les déploiements → crayon →
   Nouvelle version → Déployer**.
3. Test dans le navigateur : `.../exec?action=getPubOffers` doit renvoyer
   les 3 offres (7 / 15 / 30 jours) et `maxSlots: 6`. Les 3 onglets
   `Pub_Offres`, `Pub_Demandes` (créé à la première demande) et
   `Pub_Historique` apparaissent dans la feuille.

## Règles appliquées

- Statuts stockés : en attente, à modifier, refusée, approuvée. « Planifiée »,
  « active », « expirée » et « suspendue » sont calculées à partir des dates.
- Une demande par plat, 3 demandes en cours maximum par partenaire.
- Approbation refusée si, un jour de la période, 6 annonceurs sont déjà
  approuvés ; le message donne le premier jour complet.
- Début déjà passé à l'approbation : ramené à aujourd'hui, la fin est
  recalculée pour garder la durée payée.
- Sur le site : visible seulement si approuvée **et payée**, non suspendue,
  date du jour entre début et fin.
- Refus et renvoi pour modification : commentaire obligatoire.
- Chaque action est écrite dans `Pub_Historique`.

## Rappel de sécurité

Comme le reste du site, ces actions passent encore par l'URL (mot de passe
admin, téléphone partenaire). Le passage à des sessions sécurisées est prévu
juste après les publicités.
