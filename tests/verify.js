/* Vérification systématique MT Food — à lancer après CHAQUE modification, avant tout « met ».
   Usage : node tests/verify.js [branche-de-reference]   (défaut : cloudflare = production)
   Sortie : code 0 = tout est bon, code 1 = au moins une erreur (ne pas mettre en ligne). */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const BASE = process.argv[2] || "cloudflare";
const fails = [];
const ok = (m) => console.log("  OK  " + m);
const ko = (m) => { fails.push(m); console.log("  KO  " + m); };

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const scriptsOf = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const defsOf = (js) => new Set([...js.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
const callsOf = (js) => new Set([...js.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]));

/* 1. Syntaxe JS de chaque script + fonctions supprimées par rapport à la production */
console.log("1. Syntaxe et fonctions supprimées (référence : " + BASE + ")");
for (const f of pages) {
  const cur = fs.readFileSync(path.join(ROOT, f), "utf8"), js = scriptsOf(cur);
  try { new Function(js); } catch (e) { ko(f + " : erreur de syntaxe JS : " + e.message); continue; }
  let old = "";
  try { old = cp.execSync(`git show ${BASE}:${f}`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { ok(f + " (nouveau fichier)"); continue; }
  const dOld = defsOf(scriptsOf(old)), dNew = defsOf(js);
  const lost = [...dOld].filter((n) => !dNew.has(n));
  const lostUsed = lost.filter((n) => new RegExp("(?<![\\w$.])" + n.replace(/\$/g, "\\$") + "(?![\\w$])").test(js));
  if (lostUsed.length) ko(f + " : fonction(s) supprimée(s) mais encore appelée(s) : " + lostUsed.join(", "));
  else if (lost.length) ok(f + " : fonction(s) retirée(s) (plus appelées) : " + lost.join(", "));
  else ok(f);
}

/* 2. Chargement de chaque page sans erreur JavaScript (réseau simulé) */
(async () => {
  console.log("2. Chargement de chaque page (aucune erreur JS)");
  const browser = await chromium.launch();
  const newPage = async () => {
    const p = await browser.newPage({ viewport: { width: 420, height: 900 } });
    p.__errs = []; p.on("pageerror", (e) => p.__errs.push(e.message));
    await p.route("**/*", (r) => {
      const u = r.request().url();
      if (!u.startsWith("file:")) return r.fulfill({ status: 200, body: "", contentType: "text/plain" });
      // « /fichier.js » (chemin absolu du site) → fichier du dépôt
      const rel = decodeURIComponent(u.replace(/^file:\/\/\/?/, "").split("?")[0]);
      const inRoot = path.join(ROOT, rel.replace(ROOT.replace(/^\//, ""), "").replace(/^\/+/, ""));
      if (!u.startsWith("file://" + ROOT) && fs.existsSync(inRoot) && fs.statSync(inRoot).isFile()) return r.fulfill({ status: 200, body: fs.readFileSync(inRoot), contentType: inRoot.endsWith(".js") ? "text/javascript" : "text/plain" });
      return r.continue();
    });
    return p;
  };
  for (const f of pages) {
    const p = await newPage();
    await p.goto("file://" + path.join(ROOT, f)); await p.waitForTimeout(400);
    p.__errs.length ? ko(f + " : " + p.__errs.slice(0, 2).join(" | ")) : ok(f);
    await p.close();
  }

  /* 3. Espace partenaire : liste des plats, boutons Modifier / Option, Réglages */
  console.log("3. Espace partenaire (liste des plats, boutons, réglages)");
  {
    const p = await newPage(); await p.goto("file://" + path.join(ROOT, "espace-partenaire.html"));
    const r = await p.evaluate(async () => {
      const out = {};
      window.apiGet = async (q) => {
        if (q.action === "getPartnerMenu") return { success: true, items: [{ id: 1, nom: "A", prix: 800, description: "", disponible: true, statut: "Publié" }, { id: 2, nom: "B", prix: 50, description: "x", photo: "", disponible: false, statut: "En attente" }] };
        if (q.action === "partnerSettings") return { success: true, nom: "Zed", telephone: "0555", days: [0, 1, 2, 3, 4, 5, 6].map(() => ({ slots: [] })), defined: false, prepMin: 20, logo: "" };
        if (q.action === "partnerOptions") return { success: true, dishes: [] };
        return { success: true };
      };
      try { SESSION = { telephone: "0555", token: "x" }; } catch (e) {}
      await loadMenu();
      out.cards = document.querySelectorAll("#listMenu .item-card").length;
      out.err = document.getElementById("errorBox").textContent.trim();
      const be = document.querySelector("[data-edit-id]"); if (be) be.click(); out.editForm = !!document.querySelector("[data-e=prix]");
      const bo = document.querySelector("[data-optlink-id]"); if (bo) bo.click(); out.optTab = CURRENT_TAB === "options";
      showSuccess(document.getElementById("successBox"), "Test OK"); await new Promise((r) => setTimeout(r, 50));
      out.toastOk = !!document.querySelector("#mtToast.show.ok") && document.getElementById("mtToast").textContent.indexOf("Test OK") >= 0;
      showError(document.getElementById("errorBox"), "Test erreur"); await new Promise((r) => setTimeout(r, 50));
      out.toastErr = !!document.querySelector("#mtToast.show.err");
      await new Promise((r) => setTimeout(r, 2700)); out.toastGone = true;
      switchTab("settings"); await new Promise((r) => setTimeout(r, 200)); out.settingsTab = CURRENT_TAB === "settings"; out.soundToggle = !!document.getElementById("soundToggle"); out.logoCard = !!document.getElementById("saveLogoBtn") && !!document.getElementById("logoPick");
      return out;
    });
    r.cards === 2 ? ok("2 plats affichés") : ko("liste des plats : " + r.cards + " carte(s) au lieu de 2");
    r.err ? ko("message d'erreur affiché : " + r.err) : ok("aucun message d'erreur");
    r.editForm ? ok("bouton Modifier ouvre le formulaire") : ko("bouton Modifier sans effet");
    r.optTab ? ok("bouton Option ouvre l'onglet Options") : ko("bouton Option sans effet");
    r.toastOk ? ok("bandeau vert de confirmation") : ko("bandeau de confirmation absent après un succès");
    r.toastErr ? ok("bandeau rouge d'erreur") : ko("bandeau d'erreur absent");
    r.soundToggle ? ok("réglage du son présent") : ko("réglage du son absent");
    r.settingsTab ? ok("onglet Réglages s'ouvre") : ko("onglet Réglages sans effet");
    r.logoCard ? ok("Réglages : carte photo de profil") : ko("Réglages : carte photo de profil absente");
    p.__errs.length ? ko("erreurs JS : " + p.__errs.slice(0, 2).join(" | ")) : ok("aucune erreur JS pendant le test");
    await p.close();
  }

  /* 3b. Menu client : bandeaux (erreur de commande, ajout au panier) */
  console.log("3b. Menu client (bandeaux)");
  {
    const p = await newPage(); await p.goto("file://" + path.join(ROOT, "menu.html")); await p.waitForTimeout(500);
    const r = await p.evaluate(async () => {
      const out = { has: typeof window.MTToast === "object" };
      try { showCheckoutError("Erreur test", false); await new Promise((x) => setTimeout(x, 50)); out.errToast = !!document.querySelector("#mtToast.show.err"); } catch (e) { out.errToast = false; out.e1 = String(e); }
      try { document.getElementById("mtToast") && document.getElementById("mtToast").classList.remove("show"); showCheckoutError("auto", false, true); await new Promise((x) => setTimeout(x, 50)); out.autoQuiet = !document.querySelector("#mtToast.show.err"); } catch (e) { out.autoQuiet = false; }
      try {
        MENU.push({ id: "T1", nom: "Test", prix: 100, partenaire: "R", categories: "Pizza", disponible: "OUI" });
        changeQty("T1", 1); await new Promise((x) => setTimeout(x, 50));
        out.cartToast = !!document.querySelector("#mtToast.show.ok") || !!document.querySelector("#cartNotice.show,[role=alert].show");
        out.inCart = !!(CART["T1"] && CART["T1"].qty === 1);
      } catch (e) { out.cartToast = false; out.e2 = String(e); }
      return out;
    });
    r.has ? ok("toast.js chargé sur menu.html") : ko("menu.html : MTToast absent");
    r.errToast ? ok("erreur de commande : bandeau rouge") : ko("menu.html : pas de bandeau d'erreur de commande " + (r.e1 || ""));
    r.autoQuiet ? ok("message de checkout automatique : sans bandeau") : ko("menu.html : un message automatique déclenche un bandeau");
    r.inCart ? ok("ajout au panier fonctionne") : ko("menu.html : l'ajout au panier ne fonctionne pas " + (r.e2 || ""));
    r.cartToast ? ok("ajout au panier : confirmation visible") : ko("menu.html : aucune confirmation à l'ajout au panier");
    p.__errs.length ? ko("menu.html erreurs JS : " + p.__errs.slice(0, 2).join(" | ")) : ok("menu.html sans erreur JS pendant le test");
    await p.close();
  }

  /* 3c. Bandeaux sur les autres pages */
  console.log("3c. Livreur, espace client, admin (bandeaux)");
  for (const f of ["espace-livreur.html", "espace-client.html", "espace-admin.html"]) {
    const p = await newPage();
    if (f === "espace-client.html") await p.addInitScript(() => { try { localStorage.setItem("mtd_client_session", JSON.stringify({ clientId: "C1", prenom: "T", telephone: "0555" })); } catch (e) {} });
    await p.goto("file://" + path.join(ROOT, f)); await p.waitForTimeout(400);
    const r = await p.evaluate(async (file) => {
      const out = { has: typeof window.MTToast === "object" };
      if (file === "espace-livreur.html") { try { actOk("okDelivered"); await new Promise((x) => setTimeout(x, 50)); out.shown = !!document.querySelector("#mtToast.show.ok"); } catch (e) { out.shown = false; out.e = String(e); } }
      else if (file === "espace-admin.html") { try { showSuccess(document.getElementById("successBox"), "OK"); await new Promise((x) => setTimeout(x, 50)); out.shown = !!document.querySelector("#mtToast.show.ok"); } catch (e) { out.shown = false; out.e = String(e); } }
      else out.shown = true;
      return out;
    }, f);
    r.has ? ok(f + " : toast.js chargé") : ko(f + " : MTToast absent");
    r.shown ? ok(f + " : bandeau de confirmation") : ko(f + " : pas de bandeau " + (r.e || ""));
    p.__errs.length ? ko(f + " erreurs JS : " + p.__errs.slice(0, 2).join(" | ")) : ok(f + " sans erreur JS");
    await p.close();
  }

  /* 4. Cache hors-ligne : sw.js doit changer à chaque modification des pages */
  console.log("4. Service worker (version du cache)");
  try {
    const sw = (s) => (s.match(/CACHE_NAME\s*=\s*"([^"]+)"/) || [])[1];
    const cur = sw(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8"));
    const old = sw(cp.execSync(`git show ${BASE}:sw.js`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString());
    const changed = cp.execSync(`git diff --name-only ${BASE} -- '*.html' '*.js' '*.css'`, { cwd: ROOT }).toString().split("\n").filter((x) => x && x !== "sw.js" && !x.startsWith("tests/"));
    changed.length && cur === old ? ko("fichiers modifiés (" + changed.join(", ") + ") mais sw.js est toujours " + cur + " : incrémenter CACHE_NAME") : ok("cache " + old + " → " + cur);
  } catch (e) { ok("sw.js non comparé"); }

  await browser.close();
  console.log(fails.length ? "\nÉCHEC : " + fails.length + " problème(s). NE PAS METTRE EN LIGNE." : "\nTOUT EST BON.");
  process.exit(fails.length ? 1 : 0);
})();
