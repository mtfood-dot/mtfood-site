/* Ajoute au projet Android généré les autorisations du suivi GPS en arrière-plan.
   À lancer après « npx cap add android » (le dossier android/ n'est pas dans le dépôt). */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "android", "app", "src", "main");

const manifestPath = path.join(root, "AndroidManifest.xml");
let manifest = fs.readFileSync(manifestPath, "utf8");
const wanted = [
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />'
];
const missing = wanted.filter(l => !manifest.includes(l.match(/android:name="([^"]+)"/)[1]));
if (missing.length) {
  if (!manifest.includes("</manifest>")) throw new Error("AndroidManifest.xml inattendu");
  manifest = manifest.replace("</manifest>", "    " + missing.join("\n    ") + "\n</manifest>");
  fs.writeFileSync(manifestPath, manifest);
}

const stringsPath = path.join(root, "res", "values", "strings.xml");
let strings = fs.readFileSync(stringsPath, "utf8");
if (!strings.includes("capacitor_background_geolocation_notification_channel_name")) {
  strings = strings.replace("</resources>",
    '    <string name="capacitor_background_geolocation_notification_channel_name">Suivi de livraison</string>\n</resources>');
  fs.writeFileSync(stringsPath, strings);
}
console.log("Projet Android : " + missing.length + " ligne(s) ajoutée(s) au manifeste.");
