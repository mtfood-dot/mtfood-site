// Bannière « Installer l'app » (Android/Chrome + aide iOS), injectée dynamiquement.
(function () {
  var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  function dkey() { var l = document.querySelector('link[rel="manifest"]'); var h = l ? l.getAttribute("href") : ""; return "mtInstallDismissed" + (/livreur/.test(h) ? "Livreur" : /partenaire/.test(h) ? "Partenaire" : ""); }
  function dismissed() { try { return localStorage.getItem(dkey()) === "1"; } catch (e) { return false; } }
  if (standalone || dismissed()) return;

  var style = document.createElement("style");
  style.textContent =
    ".install-bar{display:none;position:fixed;left:12px;right:12px;bottom:12px;z-index:1000;max-width:480px;margin:0 auto;" +
    "background:#0a2647;color:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.3);align-items:center;gap:12px;font-size:14px;font-family:inherit}" +
    ".install-bar.show{display:flex}.install-bar img{width:40px;height:40px;border-radius:10px}" +
    ".install-bar .txt{flex:1;line-height:1.3}.install-bar .txt small{display:block;opacity:.8;font-size:12px}" +
    ".install-bar button{border:0;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px;cursor:pointer}" +
    ".install-bar .go{background:#d4a017;color:#0a2647}.install-bar .no{background:transparent;color:#fff;opacity:.7;padding:9px 6px}";
  document.head.appendChild(style);

  var bar = document.createElement("div");
  bar.className = "install-bar";
  bar.setAttribute("role", "dialog");
  var mf = document.querySelector('link[rel="manifest"]');
  var mh = mf ? mf.getAttribute("href") : "";
  var role = /livreur/.test(mh) ? "livreur" : /partenaire/.test(mh) ? "partenaire" : "";
  var appName = role === "livreur" ? "MT Food Livreur" : role === "partenaire" ? "MT Food Partenaire" : "MT Food";
  var iconSrc = role ? "/icons/" + role + "-192.png" : "/icons/icon-192.png";
  bar.innerHTML = '<img src="' + iconSrc + '" alt="">' +
    '<div class="txt"><b>Installer ' + appName + '</b><small>Accès rapide depuis votre écran d\'accueil</small></div>' +
    '<button class="go" type="button">Installer</button><button class="no" type="button" aria-label="Fermer">✕</button>';
  document.body.appendChild(bar);

  var go = bar.querySelector(".go"), no = bar.querySelector(".no"), hint = bar.querySelector("small");
  var deferred = null;
  function dismiss() { try { localStorage.setItem(dkey(), "1"); } catch (e) {} bar.classList.remove("show"); }
  no.onclick = dismiss;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; bar.classList.add("show"); });
  go.onclick = function () {
    if (!deferred) return dismiss();
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; bar.classList.remove("show"); });
  };
  window.addEventListener("appinstalled", function () { bar.classList.remove("show"); });
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    hint.textContent = "Touchez Partager puis « Sur l'écran d'accueil »";
    go.style.display = "none";
    bar.classList.add("show");
  }
})();
