# MT Food (Android)

Coquille Capacitor qui charge `https://food.mtdelivery.dz/`.
Les écrans restent ceux du site : une modification du site apparaît dans l'application sans la republier.

- Identifiant : `dz.mtdelivery.food`.
- Le dossier `android/` est généré à chaque compilation (`npx cap add android`).
- Notifications : placer le `google-services.json` du projet Firebase (contenant `dz.mtdelivery.food`) dans ce dossier ; sans lui, l'application se compile sans notifications.
- Cette branche (`android`) ne doit pas être fusionnée dans `cloudflare`.
