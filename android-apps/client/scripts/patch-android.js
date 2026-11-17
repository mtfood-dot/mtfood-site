/* Ajoute au projet Android généré les autorisations (notifications, position) et la configuration Firebase.
   À lancer après « npx cap add android » (le dossier android/ n'est pas dans le dépôt). */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "android", "app", "src", "main");

const manifestPath = path.join(root, "AndroidManifest.xml");
let manifest = fs.readFileSync(manifestPath, "utf8");
const wanted = [
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />'
];
const missing = wanted.filter(l => !manifest.includes(l.match(/android:name="([^"]+)"/)[1]));
if (missing.length) {
  if (!manifest.includes("</manifest>")) throw new Error("AndroidManifest.xml inattendu");
  manifest = manifest.replace("</manifest>", "    " + missing.join("\n    ") + "\n</manifest>");
  fs.writeFileSync(manifestPath, manifest);
}

/* Notifications Firebase : le fichier de configuration doit se trouver dans android/app/ */
const gs = path.join(__dirname, "..", "google-services.json");
if (fs.existsSync(gs)) fs.copyFileSync(gs, path.join(__dirname, "..", "android", "app", "google-services.json"));
else console.warn("google-services.json absent : notifications natives désactivées.");

console.log("Projet Android : " + missing.length + " ligne(s) ajoutée(s) au manifeste.");
