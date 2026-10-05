# Backend — recevoir mots de passe / PIN en POST (hors de l'URL)

Les pages (connexion, inscription, mot de passe oublié, espace admin,
espace partenaire, espace livreur) envoient maintenant leurs appels en **POST**
(corps JSON) au lieu d'un GET : mots de passe et PIN ne sont plus dans l'URL
(historique, journaux, partage de lien).

## À faire dans Apps Script (projet « MT Food »)

1. Dans `Code.gs`, trouve la fonction existante :

       function doPost(e) {

   et **renomme-la** (seulement le nom) en :

       function doPostLegacy_(e) {

   (elle continue de gérer la prise de commande et `acceptOrder` / `markDelivered`).

2. Colle ce bloc **à la fin** du fichier :

```javascript
/* ============================================================
   doPost : les actions « normales » passent par doGet (mêmes actions,
   mêmes réponses) ; les anciennes actions POST gardent leur code.
   ============================================================ */
var POST_LEGACY_ACTIONS_ = { acceptOrder: 1, markDelivered: 1, order: 1, createOrder: 1 };

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { body = {}; }
  var action = body && body.action ? String(body.action) : '';
  if (!action || POST_LEGACY_ACTIONS_[action]) return doPostLegacy_(e);

  var params = {};
  Object.keys(body).forEach(function (k) {
    var v = body[k];
    params[k] = (v === null || v === undefined) ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  });
  var out = doGet({ parameter: params, parameters: {}, queryString: '' });
  var txt = '';
  try { txt = out.getContent(); } catch (err) { txt = ''; }
  if (!txt) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Action inconnue' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return out;
}
```

3. **Déployer → Gérer les déploiements → ✏️ sur le déploiement `AKfycbwgXOyX…`
   → Version : Nouvelle version → Déployer.**

## Étape 2 (plus tard, après vérification)
Refuser les mots de passe/PIN reçus en GET (ancienne méthode) pour fermer
définitivement la porte : à faire seulement quand tout fonctionne en POST.
