/* Bouton WhatsApp flottant — MT Food. Ouvre WhatsApp avec un message déjà écrit (et le numéro de commande s'il est connu). */
(function () {
  var NUM = "213560788497";
  function lang() { try { return localStorage.getItem("mtd_lang") || localStorage.getItem("mtd_suivi_lang") || "fr"; } catch (e) { return "fr"; } }
  function orderNo() {
    try { if (typeof CURRENT_NUMERO !== "undefined" && CURRENT_NUMERO) return String(CURRENT_NUMERO); } catch (e) {}
    try { var m = /[?&]cmd=([^&]+)/.exec(location.search); if (m) return decodeURIComponent(m[1]).slice(0, 20); } catch (e) {}
    return "";
  }
  function href() {
    var ar = lang() === "ar", n = orderNo(), msg;
    if (n) msg = ar ? "مرحبا MT Food، لدي سؤال حول طلبي رقم " + n + "." : "Bonjour MT Food, j'ai une question sur ma commande N° " + n + ".";
    else msg = ar ? "مرحبا MT Food، لدي سؤال." : "Bonjour MT Food, j'ai une question.";
    return "https://wa.me/" + NUM + "?text=" + encodeURIComponent(msg);
  }
  var css = document.createElement("style");
  css.textContent = ".wa-float{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));inset-inline-end:16px;z-index:15;width:54px;height:54px;border-radius:50%;background:#128C7E;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px -6px rgba(38,50,56,.55);-webkit-tap-highlight-color:transparent;}" +
    ".wa-float:active{transform:scale(.96);}.wa-float svg{width:30px;height:30px;fill:#fff;display:block;}" +
    "body:has(.cart-bar.show) .wa-float{bottom:calc(92px + env(safe-area-inset-bottom));}" +
    "@media print{.wa-float{display:none;}}";
  document.head.appendChild(css);
  var a = document.createElement("a");
  a.className = "wa-float"; a.id = "waFloat"; a.target = "_blank"; a.rel = "noopener"; a.href = href();
  a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.03c-.25.69-1.43 1.32-1.98 1.4-.5.08-1.14.11-1.84-.12-.42-.13-.97-.31-1.67-.61-2.94-1.27-4.86-4.23-5-4.43-.15-.2-1.2-1.6-1.2-3.05s.76-2.16 1.03-2.46c.27-.3.59-.37.79-.37l.57.01c.18.01.43-.07.67.51.25.6.84 2.06.92 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.05 1.13 1.01 2.09 1.32 2.39 1.47.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.35.07.12.07.71-.18 1.4z"/></svg>';
  function label() { a.setAttribute("aria-label", lang() === "ar" ? "راسلنا عبر واتساب" : "Nous écrire sur WhatsApp"); }
  label();
  a.addEventListener("click", function () { a.href = href(); label(); });
  function add() { document.body.appendChild(a); }
  if (document.body) add(); else document.addEventListener("DOMContentLoaded", add);
})();
