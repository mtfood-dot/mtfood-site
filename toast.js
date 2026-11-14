/* MT Food — confirmations visuelles et sonores (toast).
   Utilisation : MTToast.ok("Photo ajoutée"), MTToast.err("Erreur …"), MTToast.info("…").
   - Succès : bandeau vert ~2,5 s + petit « ding » + vibration courte.
   - Erreur : bandeau rouge ~5 s + son grave (reste jusqu'au clic).
   - Un seul bandeau à la fois (le dernier remplace le précédent).
   - Son et vibration coupables : MTToast.setSound(false) (mémorisé sur l'appareil). */
(function () {
  "use strict";
  var KEY = "mt_toast_sound", timer = null, el = null, ctx = null, lastErr = "", lastErrAt = 0;
  function soundOn() { try { return localStorage.getItem(KEY) !== "0"; } catch (e) { return true; } }
  function setSound(on) { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* ignoré */ } }
  function css() {
    if (document.getElementById("mtToastCss")) return;
    var s = document.createElement("style"); s.id = "mtToastCss";
    s.textContent = "#mtToast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,24px);opacity:0;z-index:99999;max-width:min(92vw,420px);padding:13px 18px;border-radius:14px;font-weight:800;font-size:14.5px;line-height:1.4;font-family:inherit;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:opacity .22s,transform .22s;pointer-events:none;display:flex;gap:10px;align-items:center;text-align:start}" +
      "#mtToast.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}#mtToast.ok{background:#15803d}#mtToast.err{background:#b91c1c}#mtToast.info{background:#1e3a8a}" +
      "@media (prefers-reduced-motion:reduce){#mtToast{transition:none}}";
    document.head.appendChild(s);
  }
  function node() {
    if (el && document.body.contains(el)) return el;
    css(); el = document.createElement("div"); el.id = "mtToast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    el.addEventListener("click", hide); document.body.appendChild(el); return el;
  }
  function hide() { if (el) el.classList.remove("show"); clearTimeout(timer); }
  function tone(freqs) {
    if (!soundOn()) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = ctx || new AC(); if (ctx.state === "suspended") ctx.resume();
      var t = ctx.currentTime;
      freqs.forEach(function (f, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
        var s = t + i * 0.12; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.18, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22);
        o.start(s); o.stop(s + 0.24);
      });
    } catch (e) { /* le son est facultatif */ }
  }
  function buzz(p) { if (soundOn()) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignoré */ } } }
  function show(kind, msg, ms) {
    if (!msg) return; var n = node();
    n.className = kind; n.textContent = (kind === "ok" ? "✅ " : kind === "err" ? "⚠️ " : "ℹ️ ") + msg;
    void n.offsetWidth; n.classList.add("show"); clearTimeout(timer); timer = setTimeout(hide, ms);
  }
  window.MTToast = {
    ok: function (m) { show("ok", m, 2500); tone([880, 1175]); buzz(30); },
    err: function (m) {
      var now = Date.now(); if (m === lastErr && now - lastErrAt < 15000) return;   // pas de rafale si le réseau coupe
      lastErr = m; lastErrAt = now; show("err", m, 5000); tone([330, 247]); buzz([60, 40, 60]);
    },
    info: function (m) { show("info", m, 3000); },
    hide: hide, soundOn: soundOn, setSound: setSound
  };
})();
