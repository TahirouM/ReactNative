# ClubSport Mobile — application React Native

Application mobile du projet **ClubSport** (club sportif multi-sites), adossée
au projet Next.js du module précédent. Elle ajoute au produit web ce qu'un
navigateur ne peut pas faire : **valider une présence en scannant le QR code
affiché à l'entrée de la salle**, et **trier les séances par distance réelle**.

| | |
|---|---|
| **Projet web source** | [`../nextjs`](../nextjs) — ClubSport (Next.js 16, Prisma, PostgreSQL) |
| **Application web en ligne** | https://clubsport-seven.vercel.app |
| **Option choisie** | **A** — réutilisation du backend Next.js |
| **Expo SDK** | 57 · React Native 0.86.3 · React 19.2 |
| **Navigation** | Expo Router (typed routes) |
| **Cible de test** | iPhone réel dans **Expo Go**, même réseau Wi-Fi que le poste de développement |

---

## 1. Pourquoi cette application doit exister

Le site web de ClubSport fait très bien ce pour quoi il est conçu : présenter
le club, gérer les adhésions, administrer les séances, consulter un planning.
Ce sont des tâches de bureau, faites assis, sans urgence.

L'application mobile ne rejoue pas ces écrans. Elle répond à trois questions
qui ne se posent **qu'en mouvement**, et dont les réponses dépendent d'un
capteur que l'ordinateur n'a pas :

| Question | Ce que le mobile apporte | Capteur |
|---|---|---|
| « Je suis arrivé, comment je signale ma présence ? » | On scanne l'affiche QR posée à l'entrée. Plus de file à l'accueil, plus de coach qui cochera une liste. | **Caméra** |
| « Qu'est-ce qui commence bientôt près d'ici ? » | Les séances sont triées par distance réelle depuis la position du téléphone, pas par ordre alphabétique de salle. | **GPS** |
| « Suis-je vraiment pointé ? » | Un journal local conserve chaque passage, y compris les refus, consultable même hors réseau. | Stockage |

Le pointage par QR code est le cœur du produit mobile, et il est
**volontairement difficile à falsifier** : le membre ne choisit pas la séance
qu'il valide. C'est le code de la borne de la salle, croisé avec la fenêtre
horaire et — quand la permission est accordée — la position du téléphone, qui
détermine la réservation concernée. Un QR photographié puis présenté depuis
chez soi est refusé (`TOO_FAR`) dans les salles qui exigent la proximité.

> **Historique : du NFC au QR code.** La première version lisait une puce NFC.
> Elle imposait un module natif absent d'Expo Go, un development build et, sur
> iOS, un entitlement Apple accordé au cas par cas : le pointage était
> indisponible pour une partie des utilisateurs, et la démonstration dépendait
> d'une chaîne de compilation. La caméra est présente sur tous les téléphones
> et fonctionne dans Expo Go ; côté club, une affiche s'imprime depuis le
> back-office (`/admin/bornes`). L'identifiant de borne, la validation serveur
> et le croisement GPS n'ont pas changé — seule la façon de lire le code a
> changé. La colonne s'appelle encore `nfcTagId` (voir limitations).

---

## 2. Parcours mobile de bout en bout

```
ouverture de l'app
  └─ jeton relu dans le trousseau, validé auprès du serveur (/api/auth/me)
      ├─ jeton absent ou révoqué  → écran de connexion
      └─ session valide           → onglets

Accueil          prochaine séance + raccourci « Pointer » si on est dans les ±30 min
Proches   (GPS)  demande de permission → position → séances triées par distance
                 → détail séance → RÉSERVATION (mutation serveur)
Pointer   (QR)   caméra → lecture du QR de l'affiche → position → validation
                 serveur → succès haptique + visuel → trace locale
Séances          réservations à venir / historique paginé, annulation possible
Profil           adhésion, statistiques, journal des pointages, déconnexion
```

Les huit étapes demandées par le cahier des charges sont couvertes :
ouverture → session → écran principal → action GPS → scan QR → validation
backend → résultat utilisateur → historique.

---

## 3. Démarrage rapide

### Prérequis

- **Node.js ≥ 20.19.4** (voir la limitation connue n° 1 plus bas)
- Le **backend Next.js lancé** sur le port 3005 : `cd ../nextjs && npm run dev`,
  ou en conteneur `docker compose up -d` (voir le README Next.js, § Docker).
  Le téléphone joint le Mac par son IP Wi-Fi : dans les deux cas, c'est le
  port 3005 **de l'hôte** qui est publié.
- Une **base PostgreSQL** peuplée : `cd ../nextjs && npm run db:seed`
- Un **iPhone** sur le même réseau Wi-Fi que le Mac

### Installation

```bash
npm install
```

### Lancement (Expo Go)

```bash
npm start           # puis scanner le QR code avec l'appareil photo de l'iPhone
```

Aucune configuration d'adresse IP n'est nécessaire : l'app déduit l'URL de
l'API depuis l'hôte Metro auquel le téléphone est connecté
(`src/services/config.ts`). L'URL réellement utilisée est affichée en bas de
l'écran de connexion en mode développement.

Pour cibler un autre serveur, créer un fichier `.env` (voir `.env.example`) :

```bash
EXPO_PUBLIC_API_URL="https://clubsport-seven.vercel.app"
```

---

## 4. Environnement de test : Expo Go

**Tout le parcours fonctionne dans Expo Go**, sur un téléphone réel : scan QR
(`expo-camera`), géolocalisation (`expo-location`), stockage sécurisé
(`expo-secure-store`), retours haptiques. Aucun module natif hors du SDK Expo
n'est utilisé, aucune compilation n'est nécessaire.

```bash
npm start      # puis scanner le QR de Metro avec l'appareil photo de l'iPhone
```

> Ne pas confondre les deux QR codes : celui affiché par `npm start` ouvre
> l'app dans Expo Go ; celui de l'affiche de la salle (`/admin/bornes` côté web)
> se scanne **depuis l'onglet Pointer de l'app**.

### Development build — facultative

`expo-dev-client` est installé, ce qui permet de produire une development build
si un module natif hors Expo Go devenait nécessaire :

```bash
npx expo prebuild --clean      # génère le projet iOS
npx expo run:ios --device      # compile et installe sur l'iPhone branché
```

Elle n'est **pas requise** pour ce projet depuis le passage au QR code.

---

## 5. Scénarios de test

### Comptes de démonstration

Mot de passe commun : **`Password123!`**
(remplissables en un toucher depuis l'écran de connexion)

| Compte | Rôle | Ce qu'il démontre |
|---|---|---|
| `membre@clubsport.fr` | MEMBER, adhésion **ACTIVE** | **Compte de la démo** : réserver, pointer, historique |
| `membre.lyon@clubsport.fr` | MEMBER, adhésion ACTIVE | Salles de test lyonnaises |
| `nouveau@clubsport.fr` | MEMBER, **non onboardé** | L'app explique qu'il faut terminer l'inscription sur le web |
| `coach@clubsport.fr` | COACH | Rôle distinct |

> L'état exact dépend du dernier `npm run db:seed` côté Next.js : relancer le
> seed avant une démonstration remet tous les comptes dans cet état.

### Scénario GPS

1. Onglet **Proches** → la permission est demandée **à ce moment-là**, pas au
   lancement de l'app.
2. Accepter → les séances s'affichent triées par distance, la salle la plus
   proche en premier.
3. Faire varier le rayon (2 / 5 / 10 / 25 km) → la liste se recharge.
4. **Tester le refus :** Réglages iOS → ClubSport → Position → « Jamais ».
   Relancer l'app : l'onglet Proches affiche une explication et un bouton
   « Choisir une salle manuellement » — l'app reste utilisable.

### Scénario de scan QR (téléphone réel)

**Le QR de test.** Côté web, se connecter en `admin@clubsport.fr`, ouvrir
**Back-office → Bornes QR** (`/fr/admin/bornes`) et imprimer l'affiche — ou
l'afficher sur un second écran. Chaque affiche encode l'identifiant de borne de
la salle (le texte est aussi imprimé sous le code, pour la saisie manuelle).

| Borne | Salle | Proximité exigée |
|---|---|---|
| `nfc-lyon-demo-entree` | **ClubSport Lyon Démo** | non — **à utiliser en soutenance** |
| `nfc-lyon-part-dieu-entree` | ClubSport Lyon Part-Dieu | non |
| `nfc-lyon-confluence-entree` | ClubSport Lyon Confluence | non |
| `nfc-bastille-entree` | ClubSport Bastille | oui (1 km) |
| `nfc-nation-entree` | ClubSport Nation | oui (1 km) |
| `nfc-montreuil-entree` | ClubSport Montreuil | oui (1 km) |

**Pourquoi la salle Lyon Démo.** Le seed y crée une séance **toutes les 5
minutes, en continu**, déjà réservée pour `membre@`, `membre.lyon@` et un
troisième membre. Il y a donc toujours une séance dans la fenêtre de ±30 min,
à n'importe quelle heure de la soutenance, et la salle n'exige pas la
proximité : le scan fonctionne depuis la salle d'examen.

**Cas nominal.** Connecté en `membre@clubsport.fr` → onglet **Pointer** →
« Scanner le QR code » → la permission caméra est demandée à ce moment-là →
viser l'affiche Lyon Démo. Résultat attendu : vibration, écran de confirmation
(borne reconnue, position, enregistrement serveur), puis la ligne
« 📷 Pointé par QR code » dans l'onglet Séances et une entrée dans le journal
du profil. Côté web, la feuille de présence de la séance passe en `ATTENDED`.

**Cas d'erreur à démontrer** — tous gérés avec un message et un conseil :

| Situation | Code | Comportement |
|---|---|---|
| QR d'une borne inconnue | `UNKNOWN_TAG` | « Borne inconnue » + conseil |
| QR qui n'est pas un code de borne (vide, illisible) | `UNREADABLE_CODE` | Refusé **sans appel serveur** |
| Aucune réservation dans le créneau | `NO_BOOKING` | Explique la règle des ±30 min |
| Téléphone loin d'une salle qui exige la proximité | `TOO_FAR` | Indique la distance mesurée |
| Caméra refusée | `PERMISSION_DENIED` | Explique + propose la saisie du code |
| Session expirée | `UNAUTHENTICATED` | Déconnexion et retour au login |

**Double scan.** La caméra continue d'émettre tant que le QR est dans le
champ. Un verrou (`locked` dans `useCheckIn.ts`) est posé **avant** l'appel
réseau et relâché seulement quand l'utilisateur a vu le résultat : un même QR
ne part qu'une fois.

**Formats acceptés.** L'identifiant nu (`nfc-lyon-demo-entree`, ce que génère
le back-office), ou une URL qui le porte (`?tag=` / `?code=`, ou
`clubsport://check-in?tag=…`) — voir `normalizeScannedValue` dans
`src/features/checkin/qrScanner.ts`.

### Saisie manuelle et mode démonstration

Deux replis, utilisés **en plus** du vrai scan, jamais à sa place :

- **Saisie du code** imprimé sous le QR : utile si la caméra est refusée.
- **Mode démonstration** : remplace uniquement la lecture du QR par un
  identifiant choisi dans la liste des salles **réelles** (`GET /api/sites`,
  rien n'est codé en dur), plus une borne inconnue
  (`nfc-borne-non-enregistree`) pour démontrer le refus. Utile sur simulateur
  iOS (pas de caméra) ou pour montrer un refus qu'aucune affiche ne produit.

**Ce qui reste réel dans les deux cas** : la position GPS, la validation
`POST /api/check-in` (le serveur peut refuser), l'écriture en base, la trace
locale.

**Traçabilité.** Un pointage de démonstration ne peut pas se faire passer pour
un vrai scan : pastille « Simulé » sur l'écran de succès, mention « · simulé »
dans le journal, et **côté serveur** `Booking.checkInMethod` reçoit
`"simulated"` (ou `"manual"`) au lieu de `"qr"`. La valeur est contrainte par
une liste fermée (`qr` / `nfc` / `simulated` / `manual`) : un client qui en
inventerait une reçoit un **400**.

**Erreur réseau.** Couper le Wi-Fi du Mac (ou activer le mode avion sur
l'iPhone) : les écrans affichent un bandeau « Hors ligne » avec la date de la
donnée en cache, au lieu d'un écran vide.

---

## 6. Direction artistique — reprise du web

Les jetons de `src/theme/tokens.ts` sont transposés **un à un** depuis
`../nextjs/src/app/globals.css`. Rien n'est inventé : l'app mobile et le site
doivent se lire comme le même produit.

Référence visuelle commune, telle que le CSS du web la formule : *« le planning
imprimé punaisé dans le hall d'un gymnase, et les lignes peintes au sol d'un
terrain »*.

| Jeton | Valeur | Rôle |
|---|---|---|
| `--paper` → `bg` | `#f4f6fa` | fond papier |
| `--ink` → `text` | `#16202e` | encre gris-bleu (plus juste que le noir sur fond froid) |
| `--ink-soft` → `muted` | `#5a6678` | texte secondaire |
| `--accent` → `brand` | **`#a8560f`** | ocre vernis / laiton — **réservé à l'action** |
| `--court` → `court` | `#1f4e79` | bleu terrain — information |
| `--go` / `--warn` / `--stop` | `#1a6b45` / `#8a5a08` / `#a32b21` | états sémantiques |

**Typographie identique au web :** **Archivo** pour le texte (le web
l'exploite sur son axe de largeur `wdth` pour évoquer les lettrages peints sur
les murs de gymnase ; les polices variables n'étant pas chargeables par axe en
React Native, la hiérarchie est restituée par les graisses 600/700), et **IBM
Plex Mono** là où des caractères doivent s'aligner en colonne — heures, codes
de borne, coordonnées, statistiques. C'est la règle de la classe `.nums` du web.

**Formes reprises du système `ui.tsx` :**

- des blocs **posés** délimités par un filet net, pas des cartes flottantes ;
  l'ombre est réservée aux éléments réellement superposés (aucun ici) ;
- le rayon encode la hiérarchie : 2 px pour les filets, 8 px pour les boutons
  et champs, 12 px pour les blocs, plein rond **uniquement** pour les pastilles
  d'état ;
- la carte de séance reprend le **rail d'heures** du planning : heure à gauche
  en chasse fixe, filet vertical, contenu à droite ;
- l'écran vide a une bordure **en pointillés** sur fond creusé, comme
  `EmptyState` côté web ;
- la statistique met le **chiffre** en avant avec une barre verticale à gauche,
  l'intitulé dessous — et non l'étiquette en capitales au-dessus.

**Deux écarts assumés, et pourquoi :**

1. **Pas d'effet « verre ».** Le web empile surface translucide +
   `backdrop-filter` + ombre douce. React Native n'offre pas de flou
   d'arrière-plan fiable sur une liste défilante, et le coût de rendu serait
   réel. On utilise donc les équivalents **opaques**, exactement ce que le web
   lui-même prévoit dans son `@supports not (backdrop-filter: blur(1px))`.

2. **Le thème sombre est actif sur mobile.** Il est écrit et complet dans le
   CSS du web, mais neutralisé sur le site public (`data-theme="light"` sur
   `<html>`). Une app ouverte dans une salle en soirée en a un besoin que le
   site vitrine n'a pas. Le thème **clair reste le défaut**, conformément à
   l'identité du produit.

---

## 7. Architecture

Règle appliquée : **un écran ne contient pas la logique**. Aucun `fetch`,
aucune URL, aucun en-tête HTTP n'apparaît dans un fichier de `app/`.

```
app/                      routes et orchestration (Expo Router)
├─ _layout.tsx            fournisseurs + garde de navigation selon la session
├─ (auth)/login.tsx       connexion (clavier géré, comptes de démo)
├─ (tabs)/
│  ├─ index.tsx           accueil — action du moment
│  ├─ nearby.tsx          séances proches (GPS, FlatList)
│  ├─ scan.tsx            pointage par QR code (automate à 4 états)
│  ├─ bookings.tsx        réservations + historique paginé
│  └─ profile.tsx         adhésion, journal des pointages, déconnexion
├─ session/[id].tsx       route dynamique — détail + réservation
├─ site/[id].tsx          route dynamique — détail salle
└─ sites.tsx              liste des salles (repli si GPS refusé)

src/
├─ services/              accès API : config.ts, http.ts, clubsport.ts
├─ storage/               secureStore.ts (jeton), cache.ts (hors ligne)
├─ features/
│  ├─ auth/               AuthProvider — cycle de vie de la session
│  ├─ checkin/            qrScanner, useCheckIn, history, simulator
│  └─ location/           useLocation — permission et position
├─ hooks/                 useApiResource — loading/error/empty + cache
├─ components/            Button, Card, Badge, SessionCard, States,
│                         QrScannerView, SimulationPanel
├─ theme/                 jetons de design + thème clair/sombre
├─ types/                 contrats de l'API
└─ utils/                 formatage dates et distances
```

### Décisions structurantes

**La caméra est isolée derrière `qrScanner.ts`.** L'écran ne connaît que deux
choses : « le scan est-il possible ? » (`READY` / `UNDETERMINED` / `DENIED`)
et « voici un identifiant de borne ». Permission, normalisation du contenu
lu et formats acceptés (QR uniquement : un code-barres d'emballage dans le
champ ne déclenche rien) sont traités dans ce module.

**Un seul client HTTP.** `src/services/http.ts` centralise l'ajout du jeton, le
délai d'attente (12 s), la distinction panne réseau / erreur métier / session
expirée, et la notification globale des 401. Un écran n'a jamais à y penser.

**Le cache ne masque jamais une erreur serveur.** Il ne sert de repli que sur
une panne **réseau** (`status === 0`), et l'interface indique alors la date de
la donnée. Une erreur 500 reste une erreur visible.

**Les distances sont calculées côté serveur.** Formule de Haversine dans
`../nextjs/src/lib/format.ts`, déjà utilisée par le web. Le téléphone envoie sa
position, le serveur trie. Une seule implémentation, un seul comportement.

---

## 8. Session et sécurité

| Exigence | Mise en œuvre |
|---|---|
| Récupération de session | `/api/auth/me` valide le jeton au démarrage — un jeton révoqué depuis le web est détecté avant tout affichage |
| Stockage sécurisé | `expo-secure-store` → Keychain iOS / Keystore Android (chiffré par le système, isolé des autres apps) |
| Déconnexion | `POST /api/auth/logout` **supprime la ligne `AuthSession`** : révocation réelle, pas seulement un effacement local |
| 401 géré | Un gestionnaire global efface la session et renvoie au login, depuis n'importe quel appel |
| État non connecté | Garde de navigation dans `app/_layout.tsx`, splash maintenu jusqu'à la décision |
| Aucun secret embarqué | Seule une URL publique vit dans l'app — voir `.env.example` |

Le jeton est un **JWT ne contenant qu'un identifiant de session opaque**
(`sid`). Le rôle et les droits sont relus en base à chaque requête : une
promotion ou une suspension prend effet immédiatement, et un jeton volé cesse
de fonctionner dès la déconnexion. C'est le modèle déjà retenu côté web,
réutilisé tel quel.

### Validation systématiquement côté serveur

Le téléphone ne décide rien. Pour chaque action importante, le serveur
revérifie tout :

- **Réserver** — séance existante et non annulée, pas déjà commencée, adhésion
  `ACTIVE`, pas de double inscription, capacité non dépassée (le tout dans une
  transaction Prisma).
- **Annuler** — la réservation appartient bien à l'appelant ; une présence déjà
  validée n'est pas annulable.
- **Pointer** — le code correspond à une salle, le membre y a une réservation,
  la séance commence dans les ±30 min, et — si la salle l'exige
  (`requiresProximity`) — la position est à moins d'un kilomètre.

---

## 9. Permissions — chacune justifiée

| Permission | Quand elle est demandée | Si refusée |
|---|---|---|
| **Position** (`NSLocationWhenInUseUsageDescription`) | À l'ouverture de l'onglet *Proches*, et nulle part ailleurs | Explication + liste des salles à choisir manuellement |
| **Caméra** (`NSCameraUsageDescription`) | Au toucher de « Scanner le QR code » | Explication + saisie manuelle du code inscrit sous le QR |

Aucune permission n'est demandée au lancement de l'application. Le geste de
l'utilisateur précède toujours la demande, ce qui la rend compréhensible.

Pour le pointage, la position est lue **seulement si la permission est déjà
accordée** (`getIfAlreadyGranted`) : on n'interrompt pas un scan par une
demande système. Sans position, le pointage reste possible dans les salles qui
n'exigent pas la proximité ; la distance est enregistrée quand elle est connue.

---

## 10. Robustesse

| Exigence | Mise en œuvre |
|---|---|
| États UI | `loading` (squelettes), `error` (message + bouton), `empty` (explication + action), `success` |
| Hors ligne | Cache AsyncStorage par écran, bandeau daté, journal des pointages consultable |
| Reprise après redémarrage | Jeton dans le trousseau, position et listes en cache |
| Retour au premier plan | `AppState` rafraîchit le profil — une adhésion réactivée côté web est prise en compte |
| Interruptions | Toute requête est annulable (`AbortController`) ; aucun `setState` après démontage |
| Double scan | Verrou posé avant l'appel réseau, relâché après affichage du résultat — un QR resté dans le champ ne part qu'une fois |

### Performance

- `FlatList` pour les listes longues, avec `initialNumToRender`,
  `maxToRenderPerBatch`, `windowSize` et `removeClippedSubviews`.
- `SessionCard` mémoïsé (`memo`) : le défilement ne re-rend pas les cartes.
- Pagination par curseur sur l'historique — 15 éléments par page.
- **Aucun suivi GPS continu** : lecture ponctuelle à la demande. Un
  `watchPosition` viderait la batterie sans rien apporter ici.
- Requêtes annulées au changement d'écran ou de dépendance.

### Interface pensée pour le doigt

Cibles tactiles ≥ 44 pt · retour visuel au toucher (opacité + échelle) ·
`SafeAreaView` sur tous les écrans · clavier géré
(`KeyboardAvoidingView`, types de clavier adaptés, `returnKeyType`) · thème
clair/sombre suivant le réglage système · libellés d'accessibilité et
`accessibilityRole` sur tous les éléments interactifs.

---

## 11. API consommée

Routes ajoutées au projet Next.js pour cette application (`../nextjs/src/app/api/`) :

| Route | Rôle |
|---|---|
| `POST /api/auth/login` | Connexion mobile → jeton JSON (le web utilise une Server Action + cookie, inexploitable en RN) |
| `GET /api/auth/me` | Validation du jeton, profil, adhésion, statistiques |
| `POST /api/auth/logout` | Révocation serveur de la session |
| `GET /api/sessions/nearby` | **Lecture** — séances triées par distance |
| `GET /api/sites` | Salles du club, distances, identifiants de bornes |
| `GET /api/bookings` | Historique paginé par curseur |
| `POST /api/bookings` | **Mutation** — réservation, règles métier vérifiées |
| `DELETE /api/bookings/[id]` | Annulation |
| `POST /api/check-in` | **Mutation du scan QR** — validation de présence |

`GET /api/sessions/nearby` et `POST /api/check-in` existaient déjà : elles
avaient été écrites lors du projet web en prévision de l'app mobile. Elles ont
été étendues pour accepter l'authentification par jeton **en plus** du cookie
(`src/lib/api-auth.ts`), et le check-in croise le code de borne et le GPS.

Toutes les données affichées viennent de PostgreSQL via Prisma. **Aucune donnée
fictive** dans l'application.

---

## 12. Limitations connues

1. **Node.js 20.17.0 est en dessous du minimum requis** (≥ 20.19.4 pour React
   Native 0.86). Expo affiche un avertissement à chaque démarrage. Le bundle se
   construit et l'app fonctionne — vérifié — mais la mise à jour est
   recommandée : `nvm install 22 && nvm use 22`.

2. **Un QR code se photographie.** C'est la contrepartie du passage au QR. La
   parade est côté serveur : fenêtre de ±30 min et, dans les salles qui
   l'exigent, contrôle de distance (1 km). Les salles de test lyonnaises ont
   `requiresProximity = false` pour permettre la démonstration à distance ; la
   distance y est quand même mesurée et enregistrée.

3. **Le champ s'appelle encore `nfcTagId`.** Côté base (`Site.nfcTagId`) et
   dans le contrat de `POST /api/check-in`. Le renommer imposerait une
   migration et casserait les clients déjà installés, pour un gain purement
   cosmétique : l'identifiant désigne la borne, quelle que soit la façon de le
   lire.

4. **Le détail d'une séance filtre une liste** au lieu d'interroger une route
   dédiée `/api/sessions/[id]`, qui n'existe pas. La liste est bornée à 100
   entrées côté serveur. Choix assumé pour ne pas multiplier les endpoints ;
   à revoir si le catalogue de séances grossit.

5. **Pas de notifications push.** L'énoncé les cite comme piste ; elles
   exigeraient un service externe (Expo Push) et une gestion de jetons
   d'appareil côté serveur, hors du périmètre retenu.

6. **Pas de carte interactive.** `react-native-maps` est installé mais non
   utilisé : l'itinéraire est délégué à l'application Plans du téléphone, plus
   utile qu'une carte incrustée pour se rendre quelque part.

---

## 13. Usage de l'IA

Section exigée par le cahier des charges.

### Outil et tâches confiées

**Claude Code (Anthropic)**, utilisé pour : la génération de la structure Expo
Router, l'écriture des écrans et composants, les routes API ajoutées côté
Next.js, et la rédaction de ce README.

### Propositions de l'IA corrigées ou refusées

**Direction artistique inventée au lieu d'être reprise — corrigé.** La
première version du thème partait d'une palette sombre avec un accent **vert**
(`#12B981`) et les polices système : un choix plausible pour une app de sport,
mais qui n'était **pas celui du produit**. Le système visuel du web
(`globals.css`) est un fond papier clair `#f4f6fa`, une encre gris-bleu
`#16202e` et un accent **ocre/laiton** `#a8560f`, avec Archivo et IBM Plex
Mono. Les deux applications ne se lisaient pas comme le même produit.

Corrigé en transposant les jetons un à un depuis le CSS du web, en installant
les deux polices, et en reprenant les formes de `ui.tsx` (filets nets, rayons
faibles, rail d'heures, bordure en pointillés des écrans vides, barre
verticale des statistiques). Vérifié dans le bundle : la palette web est
présente, l'ancienne est à zéro occurrence.

La leçon est générale : sur un projet qui a déjà une identité, l'IA produit
volontiers un résultat *cohérent avec lui-même* mais déconnecté de l'existant.
Il faut lui donner la source de vérité — ici le fichier de jetons — plutôt que
de la laisser inférer une direction.

**Comptes de démonstration inventés.** La première version de l'écran de
connexion proposait `alex@clubsport.fr`, un compte qui n'existe pas. Vérifié
dans `prisma/seed.ts` puis directement en base : les comptes réels sont
`nouveau@`, `membre@`, `coach@`. Corrigé. Un état de la base différait même du
seed (`membre@` était `SUSPENDED` alors que le seed le crée `ACTIVE`), ce qui a
justifié la note de vérification `psql` au § 5.

**Suppression en masse refusée.** Pour repartir d'un scaffold propre, un
`rm -rf node_modules App.js app.json assets ...` a été bloqué par le garde-fou
de l'environnement. Remplacé par un déplacement vers un dossier temporaire :
réversible, et l'historique Git a été conservé.

**Type de thème trop étroit.** `export type Theme = typeof lightTheme` inférait
`mode: "light"` et rendait le thème sombre non assignable. Corrigé en
`Omit<typeof lightTheme, "mode"> & { mode: "light" | "dark" }`.

**Typage de la barre d'onglets.** Le paramètre `color` passé par Expo Router
est de type `ColorValue`, pas `string` — trois erreurs de compilation
corrigées.

### Partie explicable intégralement

Le parcours de pointage complet (`qrScanner.ts` → `useCheckIn.ts` →
`POST /api/check-in`) : la demande de permission au geste et non au montage,
le verrou anti double scan posé avant l'appel réseau, la normalisation du
contenu lu (identifiant nu ou URL), la taxonomie des erreurs, et le croisement
code de borne + GPS + fenêtre horaire côté serveur comme garde-fou
anti-falsification.

### Limites et bugs rencontrés

- **Authentification mobile absente du backend.** Le web se connecte par
  Server Action + cookie `httpOnly` + `redirect()` : inexploitable depuis React
  Native, qui attend du JSON. Il a fallu ajouter `/api/auth/login`, `/me`,
  `/logout` et une couche `api-auth.ts` acceptant les deux transports — sans
  rien casser du web existant.
- **`localhost` ne désigne pas le Mac depuis l'iPhone.** Résolu en déduisant
  l'hôte depuis le serveur Metro (`Constants.expoConfig.hostUri`) plutôt qu'en
  codant une IP en dur.
- **Avertissement Node persistant** : voir limitation n° 1.

- **Le garde-fou NFC ne fonctionnait pas — corrigé après test sur iPhone**
  (version NFC, avant le passage au QR code).
  La première version encapsulait le `require("react-native-nfc-manager")`
  dans un `try/catch`, en supposant que l'import échouerait dans Expo Go. Faux :
  le code JS du paquet est présent dans `node_modules`, donc le `require`
  RÉUSSIT. L'exception (`Invariant Violation: ... native module that doesn't
  exist`) n'était levée que plus tard, au premier appel de méthode — hors du
  `try/catch` — et remontait comme erreur fatale, écran rouge à l'ouverture de
  l'onglet Pointer. Corrigé en testant `NativeModules.NfcManager`, l'entrée que
  la librairie consomme elle-même : absente dans Expo Go, présente dans un
  development build. Les `catch` reconnaissent en plus le message d'invariant
  pour le classer comme problème d'environnement et non d'appareil.

  Piste écartée au passage : `Constants.executionEnvironment === StoreClient`
  paraissait plus explicite, mais la valeur `storeClient` désigne **à la fois**
  Expo Go et un development build (cf. l'enum d'`expo-constants`). Ce test
  aurait désactivé le NFC précisément là où il fonctionne.

- **`Error: Asset not found: assets/icon.png`.** Le chemin de `app.json` est
  `./assets/images/icon.png` et le fichier existe : l'erreur venait du binaire
  dev build installé sur le téléphone, compilé depuis le scaffold initial qui
  utilisait l'ancien chemin. C'est un cache de build, sans effet sur le
  bundle JS. Résolu en vidant `.expo` et en relançant avec `--clear` ; une
  reconstruction du dev build l'élimine définitivement.

---

## 14. Vérifications effectuées

- `npx tsc --noEmit` — aucune erreur (app mobile et backend Next.js)
- Bundle iOS construit par Metro : **HTTP 200, 6,5 Mo**, aucune erreur
- API testée de bout en bout avec `curl` :
  - connexion → jeton ; `/me` → profil et adhésion ; requête sans jeton → **401**
  - `nearby` → 35 séances triées par distance
  - réservation avec adhésion suspendue → **403 `NO_MEMBERSHIP`**
  - **parcours complet** : réservation (**201**) → pointage QR + GPS (**200**,
    `checkInMethod: "qr"`) → statut `ATTENDED` persisté en base
  - tag inconnu → **404** ; GPS à 588 km → **409 `TOO_FAR`** ; hors créneau →
    **404 `NO_BOOKING`**
- **Mode démonstration** testé contre le vrai serveur :
  - bornes chargées depuis `/api/sites` (3 salles réelles + 1 tag inconnu)
  - tag inconnu simulé → **404 `UNKNOWN_TAG`**
  - borne réelle hors créneau → **404 `NO_BOOKING`**
  - borne réelle + GPS à 392 km → **409 `TOO_FAR`**
  - borne réelle, sur place, séance réservée → **200**, `ATTENDED` en base
  - `method: "simulated"` → enregistré tel quel dans `Booking.checkInMethod`
  - `method: "je-suis-admin"` → **400**, liste de valeurs fermée
- Backend joignable depuis l'IP LAN (prérequis du test sur iPhone réel)

**Restant à faire sur le téléphone** : scanner l'affiche Lyon Démo depuis
l'onglet Pointer dans Expo Go, tester le refus de la caméra et du GPS, et
enregistrer la vidéo ou les captures de démonstration.
