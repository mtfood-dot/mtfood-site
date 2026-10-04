# Backend à ajouter dans "MT Food" (Code.gs) — Dashboard admin avancé

Ce fichier contient le code à copier-coller dans l'éditeur Apps Script du
projet **"MT Food"**, pour enrichir l'onglet « Bilan » de `espace-admin.html` :
évolution des ventes sur 7/30 jours, top 5 clients, et alerte pour les
commandes « À confirmer » restées bloquées trop longtemps. Même méthode que
pour les publicités : tu copies-colles toi-même ce bloc, puis tu redéploies
comme d'habitude.

**⚠️ Avant de commencer**, relis bien la section « Après avoir collé le
code » en bas de ce fichier — un oubli d'accolade fermante a déjà causé un
bug la dernière fois (le bloc des publicités s'était retrouvé collé à
l'intérieur d'une autre fonction). Vérifie bien que ce nouveau bloc est
**séparé** de tout ce qui l'entoure, avec sa propre accolade `}` de
fermeture à la fin.

## 1. Où coller ce code

Ouvre l'éditeur du projet **"MT Food"**, va à la fin du fichier `Code.gs`
(après le dernier `}` de la dernière fonction, à l'extérieur de toute autre
fonction), et colle tout le bloc de la section 3 ci-dessous.

## 2. Routage dans `doGet`

Dans la fonction `doGet(e)`, ta chaîne se termine par un dernier `else` qui
renvoie `{ success: false, error: 'Action inconnue' }`, puis un seul
`return respond_(result, callback);` tout à la fin. Trouve la toute
dernière branche `else if` existante (juste avant ce `else` final — ce
sera `getAds`/`getAllAds`/`saveAd`/`deleteAd` si tu as déjà ajouté le
bloc des publicités) et ajoute ce nouveau cas **avant** le `else` final,
en gardant le même style (`result = ...`, pas de `return` direct) :

```js
  } else if (action === 'getDashboardStats') {
    result = getDashboardStats_(p.password, p.days);
  } else {
    result = { success: false, error: 'Action inconnue' };
  }
```

(Remplace juste le `} else {` existant par les 3 lignes ci-dessus — ne
duplique pas le `else` final.)

## 3. Code à coller

```js
/* ============================================================
   DASHBOARD ADMIN AVANCÉ (ajouté 04/10/2026)
   Évolution des ventes, top clients, alerte commandes bloquées.
   Réutilise l'onglet "Commandes" existant, aucune nouvelle feuille.
   ============================================================ */

/* ---- Action admin : getDashboardStats ---- */
function getDashboardStats_(password, days) {
  var auth = adminLogin_(password);
  if (!auth.success) return auth;

  var nbDays = parseInt(days, 10);
  if (!nbDays || nbDays < 1) nbDays = 30;
  if (nbDays > 90) nbDays = 90;

  var sheet = findSheet_('Commandes');
  if (!sheet) return { success: false, error: 'Onglet Commandes introuvable' };
  var values = sheet.getDataRange().getValues();

  var today = new Date();
  var startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (nbDays - 1));

  var dailyMap = {};
  for (var d = 0; d < nbDays; d++) {
    var dt = new Date(startDate.getTime());
    dt.setDate(dt.getDate() + d);
    var key = Utilities.formatDate(dt, 'GMT+1', 'yyyy-MM-dd');
    dailyMap[key] = { date: key, nbCommandes: 0, totalDA: 0 };
  }

  var clientsMap = {};
  var stuckOrders = [];
  var now = Date.now();
  var STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[1]) continue;
    var statut = String(row[9] || '').trim();
    var horodatage = row[0] ? new Date(row[0]) : null;

    if (statut === 'À confirmer' && horodatage && (now - horodatage.getTime()) > STUCK_THRESHOLD_MS) {
      stuckOrders.push({
        numero: row[1],
        client: row[2],
        telephone: String(row[3] || ''),
        horodatage: Utilities.formatDate(horodatage, 'GMT+1', 'dd/MM HH:mm')
      });
    }

    if (statut === 'Annulée') continue;
    if (!horodatage) continue;

    var dayKey = Utilities.formatDate(horodatage, 'GMT+1', 'yyyy-MM-dd');
    if (dailyMap[dayKey]) {
      dailyMap[dayKey].nbCommandes += 1;
      dailyMap[dayKey].totalDA += Number(row[8]) || 0;
    }

    var tel = String(row[3] || '').trim();
    if (tel) {
      if (!clientsMap[tel]) {
        clientsMap[tel] = { client: String(row[2] || ''), telephone: tel, nbCommandes: 0, totalDA: 0 };
      }
      clientsMap[tel].nbCommandes += 1;
      clientsMap[tel].totalDA += Number(row[8]) || 0;
    }
  }

  var daily = [];
  for (var k = 0; k < nbDays; k++) {
    var dt2 = new Date(startDate.getTime());
    dt2.setDate(dt2.getDate() + k);
    var key2 = Utilities.formatDate(dt2, 'GMT+1', 'yyyy-MM-dd');
    daily.push(dailyMap[key2]);
  }

  var topClients = Object.keys(clientsMap).map(function (k) { return clientsMap[k]; });
  topClients.sort(function (a, b) { return b.nbCommandes - a.nbCommandes || b.totalDA - a.totalDA; });
  topClients = topClients.slice(0, 5);

  stuckOrders.sort(function (a, b) { return a.horodatage < b.horodatage ? -1 : 1; });

  return {
    success: true,
    daily: daily,
    topClients: topClients,
    stuckCount: stuckOrders.length,
    stuckOrders: stuckOrders.slice(0, 10)
  };
}
```

## 4. Après avoir collé le code

1. `Ctrl+F` → vérifie qu'aucune accolade ne s'est dupliquée ou n'a disparu
   (vérifie par capture d'écran si besoin — c'est le bug qu'on a déjà eu).
   Le bloc doit commencer par `/* ====...` et se terminer par le `}` qui
   ferme `function getDashboardStats_`, sans rien d'autre collé dedans.
2. Modifier les 3 lignes de routage de la section 2 dans `doGet` (remplacer
   le `} else {` existant juste avant le `else` final).
3. Enregistrer (Ctrl+S), puis **Déployer → Gérer les déploiements → icône
   crayon → Version "Nouvelle version" → Déployer**.
4. Tester directement dans le navigateur (remplace MOT_DE_PASSE par ton
   vrai mot de passe admin) :
   `.../exec?action=getDashboardStats&password=MOT_DE_PASSE&days=7`
   Doit renvoyer un JSON avec `daily`, `topClients`, `stuckCount`.
