# MT Food Livreur (Android)

Coquille Capacitor qui charge `https://food.mtdelivery.dz/espace-livreur`.
Les écrans restent ceux du site : une modification du site apparaît dans l'application sans la republier.

- Le dossier `android/` n'est pas dans le dépôt : il est généré à chaque compilation (`npx cap add android`).
- La compilation se fait sur GitHub Actions (`.github/workflows/android-livreur.yml`) et produit un APK de test.
- Cette branche (`android`) ne doit pas être fusionnée dans `cloudflare`.
