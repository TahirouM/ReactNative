# ClubSport Mobile — application React Native

Application mobile du projet **ClubSport** (club sportif multi-sites), adossée
au projet Next.js du module précédent. Elle ajoute au produit web ce qu'un
navigateur ne peut pas faire : **valider une présence en approchant le
téléphone d'une borne NFC**, et **trier les séances par distance réelle**.

| | |
|---|---|
| **Projet web source** | [`../nextjs`](../nextjs) — ClubSport (Next.js 16, Prisma, PostgreSQL) |
| **Application web en ligne** | https://clubsport-seven.vercel.app |
| **Option choisie** | **A** — réutilisation du backend Next.js |
| **Expo SDK** | 57 · React Native 0.86.3 · React 19.2 |
| **Navigation** | Expo Router (typed routes) |
| **Cible de test** | iPhone réel, même réseau Wi-Fi que le poste de développement |

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
| « Je suis arrivé, comment je signale ma présence ? » | On approche le téléphone de la borne à l'entrée. Plus de file à l'accueil, plus de coach qui cochera une liste. | **NFC** |
| « Qu'est-ce qui commence bientôt près d'ici ? » | Les séances sont triées par distance réelle depuis la position du téléphone, pas par ordre alphabétique de salle. | **GPS** |
| « Suis-je vraiment pointé ? » | Un journal local conserve chaque passage, y compris les refus, consultable même hors réseau. | Stockage |

Le pointage NFC est le cœur du produit mobile, et il est **volontairement
difficile à falsifier** : le membre ne choisit pas la séance qu'il valide.
C'est le tag physique de la salle, croisé avec la fenêtre horaire et — quand la
permission est accordée — la position du téléphone, qui détermine la
réservation concernée. On ne peut pas pointer depuis chez soi.

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
Pointer   (NFC)  lecture de la carte → position → validation serveur
                 → succès haptique + visuel → trace locale
Séances          réservations à venir / historique paginé, annulation possible
Profil           adhésion, statistiques, journal des pointages, déconnexion
```

Les huit étapes demandées par le cahier des charges sont couvertes :
ouverture → session → écran principal → action GPS → action NFC → validation
backend → résultat utilisateur → historique.

---

## 3. Démarrage rapide

### Prérequis

- **Node.js ≥ 20.19.4** (voir la limitation connue n° 1 plus bas)
- Le **backend Next.js lancé** (`cd ../nextjs && npm run dev`, port 3005)
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

## 4. Les deux environnements de test

L'énoncé demande de savoir expliquer les deux. C'est une distinction
structurante, pas un détail de configuration.

### Expo Go — itération rapide

```bash
npm start
```

**Fonctionne :** navigation, authentification, géolocalisation, réservations,
annulations, historique, thème clair/sombre, états de chargement et d'erreur,
mode hors ligne.

**Ne fonctionne pas : le scan NFC.** `react-native-nfc-manager` est un module
natif ; il n'est pas compilé dans le binaire Expo Go, qui est une application
générique publiée sur l'App Store.

L'app ne plante pas pour autant : le module est chargé **paresseusement** par
un `require()` encapsulé (`src/features/nfc/nfcManager.ts`). Son absence est
détectée et remontée comme l'état `UNSUPPORTED_ENV`, ce qui affiche une
explication et propose la **saisie manuelle du code de borne** — laquelle passe
par exactement la même validation serveur que le scan.

### Development build — obligatoire pour le NFC

```bash
npx expo install --fix         # aligne les versions natives
npx expo prebuild --clean      # génère le projet iOS
npx expo run:ios --device      # compile et installe sur l'iPhone branché
```

Prérequis : Xcode, un compte Apple (un compte gratuit suffit pour un appareil
personnel), et l'iPhone branché en USB au premier lancement.

> **iOS et NFC :** la lecture NFC exige l'entitlement
> `com.apple.developer.nfc.readersession.formats`, déjà déclaré dans
> `app.json`. Sur un compte développeur gratuit, cet entitlement peut être
> refusé à la signature ; il faut alors un compte payant. C'est une contrainte
> de la plateforme, pas du code.

Alternative sans Xcode local, via EAS :

```bash
npx eas build --profile development --platform ios
```

---

## 5. Scénarios de test

### Comptes de démonstration

Mot de passe commun : **`Password123!`**
(remplissables en un toucher depuis l'écran de connexion)

| Compte | Rôle | Adhésion | Ce qu'il démontre |
|---|---|---|---|
| `nouveau@clubsport.fr` | MEMBER | **ACTIVE** | Parcours complet : réserver, pointer |
| `membre@clubsport.fr` | MEMBER | **SUSPENDED** | Refus métier expliqué par le serveur |
| `coach@clubsport.fr` | COACH | ACTIVE | Rôle distinct |

> L'état exact des adhésions dépend du dernier `npm run db:seed`. Vérification :
> `psql -c 'select email, status from "User" u join "Membership" m on m."userId"=u.id;'`

### Scénario GPS

1. Onglet **Proches** → la permission est demandée **à ce moment-là**, pas au
   lancement de l'app.
2. Accepter → les séances s'affichent triées par distance, la salle la plus
   proche en premier.
3. Faire varier le rayon (2 / 5 / 10 / 25 km) → la liste se recharge.
4. **Tester le refus :** Réglages iOS → ClubSport → Position → « Jamais ».
   Relancer l'app : l'onglet Proches affiche une explication et un bouton
   « Choisir une salle manuellement » — l'app reste utilisable.

### Scénario NFC (development build)

**Programmation des cartes fournies.** Écrire un enregistrement **NDEF texte**
contenant exactement l'un de ces identifiants (avec NFC Tools, par exemple) :

| Carte | Salle | Coordonnées |
|---|---|---|
| `nfc-bastille-entree` | ClubSport Bastille | 48.8534, 2.3719 |
| `nfc-nation-entree` | ClubSport Nation | 48.8483, 2.3958 |
| `nfc-montreuil-entree` | ClubSport Montreuil | 48.8624, 2.4433 |

À défaut de NDEF, l'UID matériel de la puce est utilisé comme identifiant de
secours ; il faut alors l'enregistrer dans le champ `nfcTagId` du site
correspondant, côté base.

**Cas nominal.** Réserver une séance qui commence dans moins de 30 minutes,
puis onglet **Pointer** → « Toucher pour scanner » → présenter la carte.
Résultat attendu : vibration de succès, écran de confirmation détaillant les
trois vérifications (borne reconnue, position cohérente, enregistrement
serveur), et apparition de la ligne « 📲 Pointé par NFC » dans l'onglet
Séances.

**Cas d'erreur à démontrer** — tous gérés avec un message et un conseil :

| Situation | Code | Comportement |
|---|---|---|
| Carte non enregistrée | `UNKNOWN_TAG` | « Borne inconnue » |
| Aucune réservation dans le créneau | `NO_BOOKING` | Explique la règle des ±30 min |
| Téléphone loin de la salle | `TOO_FAR` | Indique la distance mesurée |
| Carte vierge | `EMPTY_TAG` | Invite à réessayer |
| Scan interrompu | `FAILED` | Conseille de maintenir le téléphone |
| Annulation par l'utilisateur | `CANCELLED` | Retour silencieux, aucune alerte |
| Session expirée | `UNAUTHENTICATED` | Déconnexion et retour au login |
| Expo Go | `UNSUPPORTED_ENV` | Explique + propose la saisie manuelle |

### Mode démonstration du pointage (sans carte NFC)

Quand le lecteur NFC natif est indisponible — Expo Go, ou development build
compilé sans le plugin — l'écran *Pointer* propose un **mode démonstration**
qui permet de dérouler le parcours métier complet sans carte physique.

**Ce qui est simulé : une seule étape.** Le contact entre la puce et l'antenne
du téléphone. Le mode produit un identifiant de borne, exactement comme
`readTagId()` le ferait.

**Ce qui reste réel : tout le reste.**

| Étape | En mode démo |
|---|---|
| Lecture de la carte | **simulée** (délai de 600 ms, comme un vrai échange NDEF) |
| Position GPS | réelle, lue sur le capteur |
| Validation métier | réelle — `POST /api/check-in`, et **le serveur peut refuser** |
| Écriture en base | réelle — la réservation passe en `ATTENDED` |
| Trace locale | réelle, avec la provenance consignée |

Les bornes proposées viennent de `GET /api/sites` : **aucun identifiant n'est
codé en dur**. Si un administrateur change le tag d'une salle côté web, la
liste suit. Une quatrième entrée synthétique (`nfc-borne-non-enregistree`)
permet de démontrer le refus d'un tag inconnu.

**Traçabilité.** Un pointage de démonstration ne peut pas se faire passer pour
un vrai scan :

- l'écran de succès affiche une pastille **« Simulé »** à côté de
  « Présence validée » ;
- la ligne de preuve indique « identifiant simulé, reconnu » et non
  « carte lue et reconnue » ;
- le journal du profil marque l'entrée « · simulé » ;
- **côté serveur**, `Booking.checkInMethod` reçoit `"simulated"` au lieu de
  `"nfc"` : la feuille de présence du club distingue donc une présence de
  démonstration d'une vraie, définitivement. La valeur est contrainte par une
  liste fermée (`nfc` / `simulated` / `manual`) — un client qui en inventerait
  une reçoit un **400**.

**Garde-fou.** Le mode n'apparaît **que** si le NFC natif est absent
(`canSimulate`). Sur un development build où le lecteur fonctionne, l'app
impose le vrai scan : pas de raccourci qui contournerait un capteur présent.

C'est ce qui distingue ce mode du « NFC simulé sans usage métier » que le
cahier des charges sanctionne : ici la chaîne métier n'est pas simulée, elle
est exercée pour de vrai.

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
Plex Mono** là où des caractères doivent s'aligner en colonne — heures, tags
NFC, coordonnées, statistiques. C'est la règle de la classe `.nums` du web.

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
│  ├─ scan.tsx            pointage NFC (automate à 4 états)
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
│  ├─ nfc/                nfcManager, useCheckIn, history, simulator
│  └─ location/           useLocation — permission et position
├─ hooks/                 useApiResource — loading/error/empty + cache
├─ components/            Button, Card, Badge, SessionCard, States,
│                         SimulationPanel
├─ theme/                 jetons de design + thème clair/sombre
├─ types/                 contrats de l'API
└─ utils/                 formatage dates et distances
```

### Décisions structurantes

**Le module NFC est chargé paresseusement.** Un `import` classique ferait
planter l'app entière dans Expo Go, y compris les écrans sans rapport. Le
`require()` encapsulé permet de traiter l'absence du module comme un état
applicatif affichable.

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
- **Pointer** — le tag correspond à une salle, le membre y a une réservation,
  la séance commence dans les ±30 min, et la position est à moins d'un
  kilomètre.

---

## 9. Permissions — chacune justifiée

| Permission | Quand elle est demandée | Si refusée |
|---|---|---|
| **Position** (`NSLocationWhenInUseUsageDescription`) | À l'ouverture de l'onglet *Proches*, et nulle part ailleurs | Explication + liste des salles à choisir manuellement |
| **NFC** (`NFCReaderUsageDescription`) | Au toucher du bouton de scan | Message distinguant Expo Go / appareil incompatible / NFC coupé |

Aucune permission n'est demandée au lancement de l'application. Le geste de
l'utilisateur précède toujours la demande, ce qui la rend compréhensible.

Pour le pointage, la position est lue **seulement si la permission est déjà
accordée** (`getIfAlreadyGranted`) : on n'interrompt pas un scan par une
demande système. Sans position, le pointage reste possible — le tag physique
prouve déjà la présence.

---

## 10. Robustesse

| Exigence | Mise en œuvre |
|---|---|
| États UI | `loading` (squelettes), `error` (message + bouton), `empty` (explication + action), `success` |
| Hors ligne | Cache AsyncStorage par écran, bandeau daté, journal des pointages consultable |
| Reprise après redémarrage | Jeton dans le trousseau, position et listes en cache |
| Retour au premier plan | `AppState` rafraîchit le profil — une adhésion réactivée côté web est prise en compte |
| Interruptions | Toute requête est annulable (`AbortController`) ; aucun `setState` après démontage |
| Sessions NFC | `cancelTechnologyRequest()` en `finally` — une session laissée ouverte bloquerait les scans suivants |

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
| `POST /api/check-in` | **Mutation NFC** — validation de présence |

`GET /api/sessions/nearby` et `POST /api/check-in` existaient déjà : elles
avaient été écrites lors du projet web en prévision de l'app mobile. Elles ont
été étendues pour accepter l'authentification par jeton **en plus** du cookie
(`src/lib/api-auth.ts`), et le check-in croise désormais NFC et GPS.

Toutes les données affichées viennent de PostgreSQL via Prisma. **Aucune donnée
fictive** dans l'application.

---

## 12. Limitations connues

1. **Node.js 20.17.0 est en dessous du minimum requis** (≥ 20.19.4 pour React
   Native 0.86). Expo affiche un avertissement à chaque démarrage. Le bundle se
   construit et l'app fonctionne — vérifié — mais la mise à jour est
   recommandée : `nvm install 22 && nvm use 22`.

2. **Le NFC ne peut pas être testé dans Expo Go.** Contrainte de plateforme,
   pas du projet. Un development build est nécessaire ; la saisie manuelle du
   code de borne permet de démontrer la validation serveur en attendant.

   Même dans un development build, le scan reste indisponible si le binaire a
   été compilé **avant** l'ajout du plugin `react-native-nfc-manager` : le
   plugin est intégré à la compilation native, pas au bundle JavaScript. Il
   faut alors reconstruire (`npx expo prebuild --clean`, puis
   `npx expo run:ios --device`). L'écran de pointage détecte ce cas et affiche
   la commande à lancer.

3. **Écriture de tags non implémentée.** L'app lit les cartes, elle ne les
   programme pas. L'enregistrement d'une nouvelle borne se fait côté
   administration web (champ `nfcTagId` du site).

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

`src/features/nfc/nfcManager.ts` et le parcours de pointage complet
(`useCheckIn.ts` → `POST /api/check-in`) : le chargement paresseux du module
natif et la raison pour laquelle il est indispensable, l'extraction de
l'identifiant (NDEF texte puis UID en secours), la fermeture de session en
`finally`, la taxonomie des erreurs, et le croisement NFC + GPS côté serveur
comme garde-fou anti-falsification.

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

- **Le garde-fou NFC ne fonctionnait pas — corrigé après test sur iPhone.**
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
  - **parcours complet** : réservation (**201**) → pointage NFC + GPS (**200**,
    `checkInMethod: "nfc"`, distance 0 km) → statut `ATTENDED` persisté en base
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

**Restant à faire sur ton matériel** — ce que je ne peux pas exécuter d'ici :
lancer l'app sur l'iPhone via QR code, produire le development build avec
Xcode, programmer les cartes NFC fournies, et enregistrer la vidéo ou les
captures demandées au § 23 du cahier des charges.
