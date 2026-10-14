/* Connexion / inscription avec Google par redirection (fonctionne aussi sur iPhone et dans les navigateurs intégrés).
   L'ID client est public. Le jeton Google est vérifié côté serveur (action clientLoginGoogle).
   Dans la console Google, ajouter comme « URI de redirection autorisés » : https://<site>/connexion et https://<site>/inscription */
(function () {
  var K = { nonce: "mtg_nonce", state: "mtg_state", search: "mtg_search" };
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} return null; }
  function rnd() { var a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function redirectUri() { return location.origin + location.pathname.replace(/\.html$/, ""); }
  function payload(jwt) {
    try { var p = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); while (p.length % 4) p += "="; return JSON.parse(decodeURIComponent(escape(atob(p)))); } catch (e) { return null; }
  }

  // Retour de Google : le jeton est dans l'adresse (#id_token=...). On restaure l'adresse d'origine tout de suite,
  // avant que la page ne lise ses paramètres (?next=...).
  var returned = null;
  if (location.hash && /id_token=|error=/.test(location.hash)) {
    var h = new URLSearchParams(location.hash.replace(/^#/, ""));
    var orig = ss(K.search) || "";
    try { history.replaceState(null, "", location.pathname + orig); } catch (e) {}
    if (h.get("id_token") && h.get("state") && h.get("state") === ss(K.state)) {
      var pl = payload(h.get("id_token"));
      if (pl && pl.nonce && pl.nonce === ss(K.nonce)) returned = h.get("id_token");
    }
    ss(K.state, null); ss(K.nonce, null); ss(K.search, null);
  }

  window.MTGoogle = {
    init: function (opts) {
      var btn = document.getElementById(opts.buttonId);
      if (!btn || !opts.clientId) return;
      btn.disabled = false; btn.removeAttribute("title");
      btn.addEventListener("click", function () {
        var nonce = rnd(), state = rnd();
        ss(K.nonce, nonce); ss(K.state, state); ss(K.search, location.search || "");
        var q = new URLSearchParams({
          client_id: opts.clientId, redirect_uri: redirectUri(), response_type: "id_token",
          scope: "openid email profile", nonce: nonce, state: state, prompt: "select_account",
          hl: document.documentElement.lang === "ar" ? "ar" : "fr"
        });
        location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + q.toString();
      });
      if (returned) { var c = returned; returned = null; opts.onCredential(c); }
    }
  };
})();
