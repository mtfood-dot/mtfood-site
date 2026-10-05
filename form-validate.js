/* ============================================================
   MT Delivery — validation commune des formulaires
   ------------------------------------------------------------
   Utilisation (dans le HTML) :
     - data-mtform            sur le conteneur du formulaire (form, section, div)
                              (ajoute la mention « * Champ obligatoire » en bas ;
                               data-note-before="#id" pour la placer avant un élément)
     - data-required          sur chaque champ obligatoire
     - data-rule="..."        règle de format : phone | email | identifier | pin4 |
                              code6 | min8 | url | positive | nonneg | date
     - data-match="#autre"    le champ doit être identique à un autre champ
     - data-error-after="#id" (optionnel) où insérer le message d'erreur
                              ("closest:.classe" = après l'ancêtre le plus proche)
   Dans le JS :
     if (!MTForm.validate(conteneur)) return;   // champs en rouge + focus sur le 1er
     MTForm.fail(champ, "message");              // erreur personnalisée + focus
   Accessibilité : aria-required, aria-invalid, aria-describedby (message
   relié au champ) et role="alert" sur le message.
   ============================================================ */
(function () {
  "use strict";

  var MSG = {
    fr: {
      required: "Ce champ est obligatoire.",
      select: "Choisis une option dans la liste.",
      phone: "Numéro de téléphone invalide (ex : 0555 12 34 56).",
      email: "Adresse e-mail invalide (ex : nom@email.com).",
      identifier: "Entre un e-mail ou un numéro de téléphone valide.",
      pin4: "Le code PIN doit contenir exactement 4 chiffres.",
      code6: "Le code doit contenir 6 chiffres.",
      min8: "8 caractères minimum.",
      url: "Lien invalide : il doit commencer par https://",
      positive: "Entre un nombre supérieur à 0.",
      nonneg: "Entre un nombre positif ou nul.",
      date: "Choisis une date valide (aujourd'hui ou plus tard).",
      match: "Les deux valeurs ne sont pas identiques.",
      note: "* Champ obligatoire"
    },
    ar: {
      required: "هذا الحقل إلزامي.",
      select: "اختر خيارًا من القائمة.",
      phone: "رقم الهاتف غير صالح (مثال: 0555 12 34 56).",
      email: "عنوان البريد الإلكتروني غير صالح (مثال: name@email.com).",
      identifier: "أدخل بريدًا إلكترونيًا أو رقم هاتف صالحًا.",
      pin4: "يجب أن يتكون رمز PIN من 4 أرقام بالضبط.",
      code6: "يجب أن يتكون الرمز من 6 أرقام.",
      min8: "8 أحرف على الأقل.",
      url: "رابط غير صالح: يجب أن يبدأ بـ https://",
      positive: "أدخل رقمًا أكبر من 0.",
      nonneg: "أدخل رقمًا موجبًا أو صفرًا.",
      date: "اختر تاريخًا صالحًا (اليوم أو بعده).",
      match: "القيمتان غير متطابقتين.",
      note: "* حقل إلزامي"
    }
  };

  function lang() { return document.documentElement.lang === "ar" ? "ar" : "fr"; }
  function msg(key) { return (MSG[lang()] || MSG.fr)[key] || MSG.fr[key] || key; }

  var counter = 0;

  /* ---------- style (injecté, utilise la palette de la page si elle existe) ---------- */
  function injectStyle() {
    if (document.getElementById("mt-form-style")) return;
    var st = document.createElement("style");
    st.id = "mt-form-style";
    st.textContent =
      ".mt-req::after{content:' *';color:var(--danger,#c0392b);font-weight:800;}" +
      ".mt-invalid{border-color:var(--danger,#c0392b) !important;background-color:#fff6f5 !important;}" +
      ".mt-invalid:focus{outline:2px solid rgba(192,57,43,.35);outline-offset:1px;}" +
      ".mt-error{margin:5px 0 0;font-size:12px;font-weight:700;line-height:1.45;color:var(--danger,#c0392b);}" +
      ".mt-note{margin:12px 0 0;font-size:12px;line-height:1.5;color:var(--muted,#5b6b82);}";
    document.head.appendChild(st);
  }

  /* ---------- règles ---------- */
  function isPhone(v) {
    var d = String(v).replace(/[\s.\-()]/g, "").replace(/^\+?213/, "").replace(/^0/, "");
    return /^[1-9]\d{7,8}$/.test(d);
  }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  /* Renvoie la clé du message d'erreur, ou "" si le champ est valide. */
  function check(el) {
    var isPwd = el.type === "password";
    var raw = el.value == null ? "" : String(el.value);
    var v = isPwd ? raw : raw.trim();

    if (el.type === "checkbox" || el.type === "radio") return el.checked ? "" : "required";
    if (!v) return el.tagName === "SELECT" ? "select" : "required";

    var rule = el.getAttribute("data-rule") || "";
    if (rule === "phone" && !isPhone(v)) return "phone";
    if (rule === "email" && !isEmail(v)) return "email";
    if (rule === "identifier" && !(v.indexOf("@") >= 0 ? isEmail(v) : isPhone(v))) return "identifier";
    if (rule === "pin4" && !/^\d{4}$/.test(v)) return "pin4";
    if (rule === "code6" && !/^\d{6}$/.test(v)) return "code6";
    if (rule === "min8" && v.length < 8) return "min8";
    if (rule === "url" && !/^https:\/\/\S+$/i.test(v)) return "url";
    if (rule === "positive" && !(Number(v.replace(",", ".")) > 0)) return "positive";
    if (rule === "nonneg" && !(Number(v.replace(",", ".")) >= 0)) return "nonneg";
    if (rule === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "date";
      var min = el.getAttribute("min");
      if (min && v < min) return "date";
    }
    var other = el.getAttribute("data-match");
    if (other) {
      var o = document.querySelector(other);
      if (o && o.value !== el.value) return "match";
    }
    return "";
  }

  /* ---------- erreurs ---------- */
  function errorNodeFor(el) {
    if (!el.id) el.id = "mtf-field-" + (++counter);
    return document.getElementById(el.id + "-error");
  }
  function setError(el, text) {
    var node = errorNodeFor(el);
    if (!node) {
      node = document.createElement("p");
      node.className = "mt-error";
      node.id = el.id + "-error";
      node.setAttribute("role", "alert");
      var anchor = el;
      var sel = el.getAttribute("data-error-after");
      if (sel) { var a = sel.indexOf("closest:") === 0 ? el.closest(sel.slice(8)) : document.querySelector(sel); if (a) anchor = a; }
      else if (el.parentElement && el.parentElement.classList.contains("pwd-wrap")) anchor = el.parentElement;
      anchor.insertAdjacentElement("afterend", node);
    }
    node.textContent = text;
    el.classList.add("mt-invalid");
    el.setAttribute("aria-invalid", "true");
    var ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    if (ids.indexOf(node.id) < 0) ids.push(node.id);
    el.setAttribute("aria-describedby", ids.join(" "));
  }
  function clearError(el) {
    var node = el.id ? document.getElementById(el.id + "-error") : null;
    el.classList.remove("mt-invalid");
    el.removeAttribute("aria-invalid");
    if (node) {
      var ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(function (x) { return x && x !== node.id; });
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" ")); else el.removeAttribute("aria-describedby");
      node.remove();
    }
  }
  function focusField(el) {
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
  }
  function isVisible(el) { return !el.disabled && el.getClientRects().length > 0; }

  /* ---------- API ---------- */
  function validate(root) {
    root = root || document;
    var fields = root.querySelectorAll("[data-required]");
    var first = null;
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (!isVisible(el)) { clearError(el); continue; }
      var key = check(el);
      if (key) { setError(el, msg(key)); if (!first) first = el; }
      else clearError(el);
    }
    if (first) { focusField(first); return false; }
    return true;
  }
  function fail(el, text) {
    setError(el, text);
    focusField(el);
    return false;
  }
  function clearAll(root) {
    (root || document).querySelectorAll(".mt-invalid").forEach(clearError);
  }

  /* ---------- astérisques, aria-required, mention en bas ---------- */
  function labelOf(el) {
    var l = null;
    if (el.id) l = document.querySelector('label[for="' + el.id + '"]');
    if (!l) {
      var field = el.closest(".field, .entry-form-ordre, .form-group");
      if (field) l = field.querySelector("label");
    }
    if (!l && el.previousElementSibling && el.previousElementSibling.tagName === "LABEL") l = el.previousElementSibling;
    return l;
  }
  function refresh(root) {
    injectStyle();
    root = root || document;
    root.querySelectorAll("[data-required]").forEach(function (el) {
      el.setAttribute("aria-required", "true");
      var l = labelOf(el);
      if (l) {
        l.classList.add("mt-req");
        if (!l.getAttribute("for") && el.id && l.tagName === "LABEL") l.setAttribute("for", el.id);
      }
    });
    root.querySelectorAll("[data-mtform]").forEach(function (box) {
      if (box.querySelector(":scope > .mt-note, :scope .mt-note")) return;
      var p = document.createElement("p");
      p.className = "mt-note";
      p.textContent = msg("note");
      var before = box.getAttribute("data-note-before");
      var ref = before ? box.querySelector(before) : null;
      if (ref) ref.parentNode.insertBefore(p, ref); else box.appendChild(p);
    });
  }
  function refreshNotes() {
    document.querySelectorAll(".mt-note").forEach(function (p) { p.textContent = msg("note"); });
  }

  /* Efface l'erreur d'un champ dès que l'utilisateur le modifie. */
  document.addEventListener("input", function (e) { if (e.target.classList && e.target.classList.contains("mt-invalid")) clearError(e.target); }, true);
  document.addEventListener("change", function (e) { if (e.target.classList && e.target.classList.contains("mt-invalid")) clearError(e.target); }, true);

  /* Langue FR/AR : la mention suit la langue de la page. */
  try {
    new MutationObserver(refreshNotes).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  } catch (e) {}

  window.MTForm = { validate: validate, fail: fail, setError: setError, clearError: clearError, clearAll: clearAll, refresh: refresh, todayStr: todayStr };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { refresh(); });
  else refresh();
})();
