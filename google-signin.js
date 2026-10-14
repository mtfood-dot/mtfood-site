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

  /* Google ne fournit jamais le téléphone : on le demande une fois après la connexion. */
  function askPhone(clientId, api) {
    return new Promise(function (resolve) {
      var ar = document.documentElement.lang === "ar";
      var T = ar
        ? { title: "أضف رقم هاتفك", text: "نحتاج رقمك ليتصل بك عامل التوصيل وتتابع طلباتك.", ph: "مثال: 0555 xx xx xx", ok: "حفظ ومتابعة", skip: "لاحقا", bad: "أدخل رقم هاتف جزائري صحيح (05 أو 06 أو 07).", fail: "تعذر الحفظ، أعد المحاولة." }
        : { title: "Ajoute ton numéro", text: "Il nous faut ton numéro pour que le livreur puisse te joindre et pour suivre tes commandes.", ph: "Ex : 0555 xx xx xx", ok: "Enregistrer et continuer", skip: "Plus tard", bad: "Entre un mobile algérien valide (05, 06 ou 07).", fail: "Impossible d'enregistrer, réessaie." };
      var st = document.createElement("style");
      st.textContent = ".mtg-ov{position:fixed;inset:0;background:rgba(10,25,50,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;}" +
        ".mtg-box{background:#fff;border-radius:16px;max-width:380px;width:100%;padding:20px;font-family:inherit;box-shadow:0 12px 40px rgba(0,0,0,.3);}" +
        ".mtg-box h3{margin:0 0 6px;font-size:18px;color:#0d2d5a;}.mtg-box p{margin:0 0 12px;font-size:14px;line-height:1.6;color:#4a5b70;}" +
        ".mtg-box input{width:100%;box-sizing:border-box;border:1.5px solid #d5deea;border-radius:10px;padding:12px;font-size:16px;font-family:inherit;}" +
        ".mtg-box button{width:100%;margin-top:10px;border-radius:10px;padding:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;}" +
        ".mtg-go{background:#1d4e9e;color:#fff;border:0;}.mtg-skip{background:#fff;color:#4a5b70;border:1.5px solid #d5deea;}.mtg-box button:disabled{opacity:.6;}" +
        ".mtg-err{color:#b3261e;font-size:13px;font-weight:700;margin-top:8px;min-height:1em;}";
      document.head.appendChild(st);
      var ov = document.createElement("div"); ov.className = "mtg-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
      ov.innerHTML = '<div class="mtg-box"><h3></h3><p></p><input type="tel" inputmode="tel" autocomplete="tel" dir="ltr"><div class="mtg-err"></div><button type="button" class="mtg-go"></button><button type="button" class="mtg-skip"></button></div>';
      var q = function (s) { return ov.querySelector(s); };
      q("h3").textContent = T.title; q("p").textContent = T.text; q("input").placeholder = T.ph; q(".mtg-go").textContent = T.ok; q(".mtg-skip").textContent = T.skip;
      if (ar) ov.setAttribute("dir", "rtl");
      document.body.appendChild(ov);
      q("input").focus();
      function done(v) { ov.remove(); st.remove(); resolve(v || ""); }
      q(".mtg-skip").addEventListener("click", function () { done(""); });
      q(".mtg-go").addEventListener("click", function () {
        var raw = q("input").value.trim(), d = raw.replace(/[\s.\-()]/g, "").replace(/^\+?213/, "").replace(/^0/, "");
        var err = q(".mtg-err"); err.textContent = "";
        if (!/^[567]\d{8}$/.test(d)) { err.textContent = T.bad; return; }
        q(".mtg-go").disabled = true;
        Promise.resolve(api({ action: "clientSetPhone", clientId: clientId, telephone: raw })).then(function (res) {
          if (res && res.success) done(res.telephone || ("0" + d));
          else { err.textContent = (res && res.error) || T.fail; q(".mtg-go").disabled = false; }
        }).catch(function () { err.textContent = T.fail; q(".mtg-go").disabled = false; });
      });
    });
  }

  window.MTGoogle = {
    askPhone: askPhone,
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
