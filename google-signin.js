/* Connexion / inscription avec Google (Google Identity Services).
   L'ID client est public. Le jeton Google est vérifié côté serveur (action clientLoginGoogle). */
window.MTGoogle = {
  init: function (opts) {
    var btn = document.getElementById(opts.buttonId);
    if (!btn || !opts.clientId) return;
    var box = document.createElement("div");
    box.id = opts.buttonId + "Box";
    box.style.cssText = "display:flex;justify-content:center;min-height:44px;margin-top:2px;";
    var s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = function () {
      try {
        google.accounts.id.initialize({
          client_id: opts.clientId,
          callback: function (resp) { if (resp && resp.credential) opts.onCredential(resp.credential); },
          ux_mode: "popup"
        });
        btn.parentNode.insertBefore(box, btn);
        btn.style.display = "none";
        var lang = document.documentElement.lang === "ar" ? "ar" : "fr";
        google.accounts.id.renderButton(box, { type: "standard", theme: "outline", size: "large", text: opts.text || "continue_with", shape: "rectangular", locale: lang, width: Math.min(360, Math.max(240, (btn.parentNode.clientWidth || 300))) });
      } catch (e) { /* le bouton Google reste masqué : connexion classique disponible */ }
    };
    document.head.appendChild(s);
  }
};
