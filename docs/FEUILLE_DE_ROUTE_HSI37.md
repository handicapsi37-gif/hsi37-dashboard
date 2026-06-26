# FEUILLE DE ROUTE — Dashboard HSI37

Document de suivi du projet. À garder à côté du mémo terminal/Git.
Objectif : outil interne de gestion des adhérents pour l'association
Handicap Solidarité pour l'Inclusion 37, puis génération de documents.

Principe directeur : UNE fonction à la fois, testée et sauvegardée avant la suivante.
Stack : HTML / CSS / JavaScript simple (vanilla) + Supabase. Maintenance solo.
Coût : 0 €. Règle : pas de données de santé (décision confirmée).

---

## ✅ DÉJÀ FAIT (terminé et sauvegardé)

### Phase 0 — Maquette visuelle
- Maquette du tableau des adhérents, design HSI, badges, infobulles, modale.

### Phase 1 — Fondations
- Base de données Supabase (projet hsi37-dashboard, hébergé à Paris / RGPD).
- Table "adherents" : 12 colonnes (id, created_at, id_adherent, nom, prenom,
  email, telephone, adresse, date_adhesion, montant_cotisation, type_membre, saison).
- Sécurité RLS activée + 4 règles d'accès (lecture/création/modification/suppression
  réservées aux utilisateurs connectés).
- Authentification email + mot de passe, inscription libre désactivée.
- 5 comptes du bureau créés.
- Clés rangées dans config.js (exclu de Git, jamais partagé).

### Phase 2 — Logique complète (l'outil fonctionne de bout en bout)
- Écran de connexion (login) : seul un membre connecté voit le tableau.
- Lecture des vraies données depuis Supabase.
- Création d'un adhérent + génération automatique de l'ID (HSI-2026-0001,
  numéro qui repart à 0001 chaque année).
- Modification d'un adhérent (ID figé, non modifiable).
- Suppression avec fenêtre de confirmation.
- Statut calculé automatiquement, 3 badges :
  Vert "À jour" (saison = année en cours) / Orange "À renouveler" (année précédente)
  / Rouge "En retard" (2 ans ou plus).
- Saisie de la date par 3 menus déroulants (Jour / Mois / Année 2020→en cours).
- Serveur local de développement : localhost:8001

### Phase V2 — Nouvelles fonctionnalités (2026)
- **Module Dons de matériel** : table Supabase `dons_materiel`, bucket Storage privé `dons-materiel`,
  pages `dons-materiel.html` et `nouveau-don.html`, tuile dans le hub, CRUD complet,
  attestation PDF officielle (jsPDF) avec annexe photos.
- **Exports PDF (jsPDF)** : liste adhérents PDF (bouton à côté du CSV) + rapport annuel PDF
  (stats + 3 tableaux) bouton dans le hub.
- **Correction** : compteur "À jour" dans le hub corrigé (`calculerStatut` retourne `"ajour"` sans trait d'union).

### Charte graphique (fait aujourd'hui)
- SKILL.md de charte graphique HSI37 créé (à placer dans les skills du projet
  pour que Claude Code applique la charte automatiquement).
- Couleurs officielles retenues : bleu #2D82C4 (dominant), bleu clair #5AA9E6,
  bleu foncé #1F4E79, orange #F28C28 (accent/don), orange foncé #D96F00,
  gris #333333 / #666666, fond clair #F8F9FA, blanc.
- Polices : Oswald (titres) + Open Sans (texte courant).
- Modèles de référence rassemblés : logo hsi37 (carré + horizontal + cercle bleu),
  bulletin/reçu d'adhésion 2026, affiches recto/verso, carte de visite du président.

NOTE couleurs : sur les affiches l'accent paraît jaune doré (pas orange), et le bleu
de la carte de visite paraît plus clair que #2D82C4. La charte fait foi pour l'instant.
Si besoin d'un calage exact sur les documents réels : récupérer les vrais codes
dans Canva (couleurs + polices) et ajuster le SKILL.md.

---

## 🔜 À VENIR (dans cet ordre)

### 1. HARMONISER LE DASHBOARD sur la charte
Aligner les couleurs/polices du Dashboard actuel sur le SKILL.md
(le Dashboard utilisait des valeurs légèrement différentes : corail au lieu d'orange).

### 2. CARTE D'ADHÉRENT  ← demande du président
Générer une carte depuis une fiche adhérent, à la charte.
S'inspirer de la carte de visite du président (logo cercle bleu + infos à droite,
recto/verso, fond blanc épuré, texte bleu).
À CLARIFIER AVEC LE PRÉSIDENT avant de coder :
- Contenu : logo + nom/prénom + ID (HSI-2026-0001) + type de membre + saison/année
  + date de validité ?
- Recto/verso (comme la carte de visite) ou recto seul ?
- Carte virtuelle (à envoyer/imprimer par l'adhérent) ou à imprimer par le bureau ?
Note technique : génération PDF/image -> nécessitera un petit outil dédié (librairie).

### 3. REÇU D'ADHÉSION (PDF)
Générer le reçu rempli automatiquement depuis une fiche adhérent.
Modèle déjà disponible (reçu 2026). Possibilité d'intégrer la signature
(fichier Signature_.pages fourni).
Contient : montant, nom, date et mode de paiement, mentions légales.

### 4. BULLETIN D'ADHÉSION (modèle vierge à la charte)
Refaire le bulletin 2026 proprement à la charte (garder la version AVEC la ligne "don").
Document vierge à imprimer/diffuser (pas de remplissage automatique).

### 5. PAGE D'ACCUEIL / HUB DE NAVIGATION
Une fois 2-3 fonctions en place, créer un point d'entrée reliant les sections
(Adhérents, Cartes, Reçus, Documents). À faire QUAND il y a plusieurs destinations.

### 6. ENVOI DE MAILS AUTOMATIQUES
Envoyer reçus / cartes / convocations par mail. ÉTAPE LA PLUS LOURDE :
nécessite un service d'envoi d'emails (SMTP, type Brevo) + configuration. En dernier.

### 7. MISE EN LIGNE (pour que les 4 autres membres accèdent depuis leur poste)
Après une Phase 3 courte (sécurité/RGPD/export). Hébergement gratuit
(Cloudflare Pages ou Netlify) -> adresse internet. Puis communiquer
l'adresse + identifiants au bureau.

### 8. DOCUMENTS GÉNÉRAUX (chantier séparé) — SEMI-AUTOMATIQUES
PV d'assemblée générale, convocations, courriers.
Partie "cadre" automatisable (logo, association, date, liste des présents tirée
de la base, structure type) ; partie "contenu" à rédiger à la main.
Les convocations sont les plus automatisables (cadre + liste de diffusion).

### Phase 3 — Finitions (avant la mise en ligne)
- Vérifier l'accessibilité de bout en bout (RGAA/WCAG).
- Ajouter la mention RGPD (information des adhérents).
- Vérifier la solidité du RLS avant exposition publique.
- Prévoir un export des données (fichier de sauvegarde régulier).

---

## 📌 REPORTÉ EN V2 (réservoir d'idées)
- Séparer "date de première adhésion" (figée) et "saison de cotisation" (renouvelée).
- Historique des cotisations année par année + règle de radiation après 3 ans (statuts).
- Distinction adhésion / don (le bulletin prévoit un don facultatif).
- ~~Passer les reçus/documents de PNG à PDF~~ ✅ Fait (jsPDF)
- Paiement en ligne, comptabilité, rôles cloisonnés, gouvernance.

---

## ⚠️ À VÉRIFIER (cohérence des documents officiels)
Sur l'appel aux dons, la signature indique "Ilhame Belhaj, Secrétaire adjointe",
alors que les statuts (juillet 2024) listent "Oumkaltoum Belhaj, Secrétaire".
Vérifier les noms/fonctions à jour avant de figer les documents officiels.

---

## 🧭 POUR REPRENDRE UNE SESSION
1. Ouvrir le Terminal -> cd ~/hsi37-dashboard -> python3 -m http.server 8001
2. Ouvrir localhost:8001/index.html dans le navigateur, se connecter.
3. Lancer Claude Code (taper claude) dans une AUTRE fenêtre Terminal pour coder.
4. Après chaque étape réussie : git status -> git add . -> git commit -m "..."
(voir le MÉMO TERMINAL & GIT pour le détail des commandes)

---

## 🆕 NOUVEAUTÉS À INTÉGRER (demandes récentes du président / d'Ilhame)

### Carte d'adhérent VIRTUELLE "classique"
- Format carte virtuelle (à envoyer / afficher sur téléphone, type carte de membre).
- Modèle de texte + logo à fournir par Ilhame (à intégrer fidèlement).
- Étudier l'ajout d'un QR CODE sur la carte (à définir : le QR mène à quoi ?
  site hsi37.fr ? fiche / vérification d'adhésion ? page de contact ?).
- S'inspirer du style de la carte de visite du président (logo cercle bleu, sobre, bleu/blanc).
- Reste la PRIORITÉ (demande du président).

### Partie DONATEURS (nouvelle section séparée du Dashboard)
- Espace "Donateurs" DISTINCT de la section "Adhérents".
- Un donateur donne SANS forcément adhérer : pas d'ID adhérent, pas de statut de cotisation.
- À cadrer plus tard : table séparée dans Supabase (ex. "donateurs") + champs propres
  (nom, prénom/organisme, email, téléphone, montant du don, date, mode de paiement,
  type de don : argent / matériel médical).
- Lien possible avec l'appel aux dons (matériel médical : fauteuils, déambulateurs...).
- Permettra plus tard de générer des reçus/attestations de don.
- ATTENTION : ajout au modèle de données -> vraie décision à cadrer, ne pas bâcler.

### Signatures (DEUX usages distincts)
1. Signature d'EMAIL Gmail : bloc en bas des mails (logo hsi37 + coordonnées + fonction).
   À refaire proprement à la charte (réutilisable par les membres du bureau).
2. Signature MANUSCRITE : à intégrer dans les reçus et documents officiels
   (fichier Signature_.pages fourni). Pour signer automatiquement reçus/attestations.

