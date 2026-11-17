# MT Restaurant (Android)

Coquille Capacitor qui charge `https://food.mtdelivery.dz/espace-partenaire`.
Les écrans restent ceux du site : une modification du site apparaît dans l'application sans la republier.

- Identifiant : `dz.mtdelivery.partenaire`.
- Le dossier `android/` est généré à chaque compilation (`npx cap add android`).
- Notifications : placer le `google-services.json` du projet Firebase (contenant `dz.mtdelivery.partenaire`) dans ce dossier ; sans lui, l'application se compile sans notifications.
- Cette branche (`android`) ne doit pas être fusionnée dans `cloudflare`.
