# Disciply

Application web de suivi des âmes et du discipolat pour Impact Centre Chrétien.
Elle s'utilise dans le navigateur, sur téléphone comme sur ordinateur, et s'installe sur l'écran d'accueil du téléphone.

## Ce que fait l'application

| Rôle | Ce qu'il voit et fait |
| --- | --- |
| Responsable général | Toute l'église : familles, ouvriers et invitations, toutes les âmes, rapports, archives, réglages (étapes, motifs, cultes) |
| Berger de famille | Sa famille : âmes, affectation aux faiseurs, pointage, transferts, invitation des faiseurs |
| Faiseur de disciples | Ses âmes : Aujourd'hui (à appeler, absents, nouvelles âmes), pointage du dimanche, fiche âme, étapes, notes |

- Connexion par e-mail et mot de passe. Les comptes se créent uniquement par invitation (lien à envoyer par WhatsApp).
- Le tout premier compte, créé sur `/installation`, devient responsable général. Cette page se ferme ensuite.
- Les droits sont vérifiés par le serveur (`firestore.rules`) : un faiseur ne lit que ses âmes, un berger que sa famille.
- Le pointage fonctionne sans réseau et part dès que la connexion revient.
- Mode jour (fond blanc) et mode nuit (fond violet), au choix dans Profil.

## Technique

React 19, TypeScript, Vite, PWA. Firebase : Authentication, Firestore (cache hors ligne), Hosting.
Pas de Cloud Functions : l'application tourne sur l'offre gratuite de Firebase (Spark).

## Lancer en local

Prérequis : Node 22 et Java 21 (pour les émulateurs Firebase).

```bash
npm install
npm run emulators      # terminal 1 : base et connexion locales, sans toucher à la production
npm run dev            # terminal 2 : http://localhost:5173
```

Sans fichier `.env.local`, l'application se branche automatiquement sur les émulateurs.
Ouvre `/installation` pour créer le premier compte responsable.

Tests des règles de sécurité : `npm run test:rules`

## Mise en ligne (première fois)

1. Sur https://console.firebase.google.com, crée un projet (par exemple `disciply-icc`).
2. **Authentication** → Commencer → activer **Adresse e-mail/Mot de passe**. Dans Paramètres → Domaines autorisés, ajouter le domaine du site si tu en utilises un.
3. **Firestore Database** → Créer une base, en mode production, région `europe-west1` (proche du Cameroun).
4. Paramètres du projet → Vos applications → ajouter une **application Web**. Copier la configuration affichée.
5. Paramètres du projet → Comptes de service → **Générer une nouvelle clé privée** (fichier JSON).
6. Dans le dépôt GitHub → Settings → Secrets and variables → Actions, ajouter :
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` (depuis l'étape 4)
   - `FIREBASE_SERVICE_ACCOUNT` : tout le contenu du fichier JSON de l'étape 5
7. Pousser sur `main` : GitHub teste, construit et déploie le site et les règles. L'adresse est `https://<projet>.web.app`.
8. Ouvrir `https://<projet>.web.app/installation` et créer le compte du responsable.

Déploiement manuel possible : `npx firebase login` puis `npm run deploy` (avec un `.env.local` rempli).

## Organisation du code

```
src/
  lib/        firebase, types, accès aux données (api.ts), session, droits par rôle (scope.tsx)
  components/ coquille (menu), feuilles, icônes
  pages/auth/       connexion, invitation, mot de passe oublié, installation
  pages/maker/      Aujourd'hui
  pages/shepherd/   famille, à affecter
  pages/admin/      église, familles, réglages
  pages/common/     âmes, fiche âme, pointage, rapport, équipe, archives, profil
firestore.rules     règles d'accès
tests/rules/        tests des règles
```

## Points à confirmer

- Ordre officiel des 5 étapes (provisoire : Régularité, Famille d'impact, Baptême, Service, PCNC). Modifiable dans Réglages.
- Un seul pointage par dimanche, quel que soit le culte.
