/**
 * Envoi de notifications push (FCM HTTP v1) depuis Google Apps Script.
 * À COLLER dans le projet Apps Script du backend (ce fichier n'est pas servi par le site).
 *
 * Préparation (une seule fois) :
 * 1. Console Firebase > Paramètres du projet > Comptes de service > « Générer une nouvelle clé privée » (fichier JSON).
 * 2. Apps Script > Paramètres du projet > Propriétés du script : créer FCM_SERVICE_ACCOUNT
 *    avec le contenu complet du JSON.
 * 3. Appeler sendPush_(token, titre, texte, url) là où un évènement se produit, par ex. :
 *    - nouvelle commande  -> tous les jetons des livreurs actifs (role "driver")
 *    - changement de statut -> jeton du client de la commande (role "client")
 *    Les jetons viennent de l'action saveFcmToken déjà appelée par le site.
 */
var FCM_PROJECT_ID = "mt-delivery-489fa";

function getFcmAccessToken_() {
  var sa = JSON.parse(PropertiesService.getScriptProperties().getProperty("FCM_SERVICE_ACCOUNT"));
  var now = Math.floor(Date.now() / 1000);
  var b64 = function (o) { return Utilities.base64EncodeWebSafe(JSON.stringify(o)).replace(/=+$/, ""); };
  var unsigned = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600
  });
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(unsigned, sa.private_key)).replace(/=+$/, "");
  var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + sig }
  });
  return JSON.parse(res.getContentText()).access_token;
}

/** Envoie une notification à un jeton. Retourne false si le jeton est périmé (à supprimer de la feuille). */
function sendPush_(token, title, body, url) {
  var res = UrlFetchApp.fetch("https://fcm.googleapis.com/v1/projects/" + FCM_PROJECT_ID + "/messages:send", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + getFcmAccessToken_() },
    muteHttpExceptions: true,
    payload: JSON.stringify({ message: {
      token: token,
      notification: { title: title, body: body },
      data: { url: url || "/index.html" }
    } })
  });
  var code = res.getResponseCode();
  if (code === 404 || code === 400) return false; // UNREGISTERED / INVALID_ARGUMENT
  return code === 200;
}

/** Test : remplacer par un vrai jeton, lancer une fois depuis l'éditeur. */
function testPush_() {
  Logger.log(sendPush_("COLLER_UN_JETON_ICI", "MT Delivery", "Test de notification", "/index.html"));
}
