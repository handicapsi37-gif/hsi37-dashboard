# RÉCAPITULATIF PROJET — Dashboard HSI37
# Document de transition V1 → V2
# À coller en début de nouvelle conversation pour donner tout le contexte.

---

## 1. IDENTITÉ DU PROJET

**Projet :** Dashboard (tableau de bord) de gestion interne pour l'association HSI37.
**Association :** Handicap Solidarité pour l'Inclusion 37 (HSI37).
**Statut :** Association loi 1901, n° RNA W372020254, créée le 21 juillet 2024.
**Siège :** 17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps.
**Objet :** Collecte, remise en état et distribution de matériel médical d'autonomie
(fauteuils roulants, déambulateurs, cannes) en Indre-et-Loire et au Maroc (partenaire CLIO, Salé).
**Contact :** handicapsi37@gmail.com — 07 43 29 58 30 — hsi37.fr
**Bureau :** Président Mohammed BELHAJ, Trésorière Oum Keltoum BELHAJ, Secrétaire Nawel BELHAJ.
**Mainteneur :** Ilhame (secrétaire adjointe), non-développeuse, maintenance solo via Claude Code + IA.

---

## 2. STACK TECHNIQUE

- **Front :** HTML + CSS + JavaScript vanilla (pas de framework).
- **Base de données :** Supabase (projet hsi37-dashboard, hébergé à Paris, RGPD).
- **Authentification :** Supabase Auth, email + mot de passe, 5 comptes bureau, inscription libre désactivée.
- **Hébergement actuel :** local uniquement (serveur python3, localhost:8001 ou 8002).
- **Hébergement prévu :** Cloudflare Pages ou Netlify (gratuit).
- **Versioning :** Git local, config.js exclu via .gitignore (clés Supabase protégées).
- **Charte graphique :** SKILL.md dans .skills/charte-graphique-hsi37/
- **Coût récurrent :** 0 € (hors domaine hsi37.fr déjà payé).
- **Règle absolue :** pas de données de santé (décision confirmée).

---

## 3. CHARTE GRAPHIQUE (résumé)

### Couleurs officielles
- Bleu principal : #2D82C4 (dominant)
- Bleu clair / icônes : #5AA9E6
- Bleu foncé texte/logo : #1F4E79
- Orange accent : #F28C28 (CTA/don, filets, accents subtils — JAMAIS dominant)
- Orange foncé : #D96F00
- Gris texte : #333333 / Gris secondaire : #666666
- Fond clair : #F8F9FA / Blanc : #FFFFFF

### Polices
- Titres : Oswald (sans-serif condensée, grasse)
- Texte courant : Open Sans (lisible, accessible)

### Logo
- "hsi37" blanc sur fond bleu, baseline "Handicap Solidarité pour l'Inclusion"
- Versions : carrée 512x512 (cropped-HSI37-512x512-1.png), horizontale (hsi37-redim-demi.png)

### Règles documents
- Filet orange fin sous l'en-tête de chaque document
- Filet orange fin au-dessus du pied de page
- Orange = filets et accents UNIQUEMENT, jamais texte courant
- Accessibilité : contrastes WCAG AA, ne jamais coder par la couleur seule

---

## 4. STRUCTURE DES FICHIERS DU PROJET

```
~/hsi37-dashboard/
├── index.html              (Dashboard principal)
├── styles.css              (styles)
├── app.js                  (logique JavaScript)
├── config.js               (clés Supabase — EXCLU de Git, JAMAIS partagé)
├── .gitignore
├── assets/                 (logos et images)
│   ├── cropped-HSI37-512x512-1.png
│   └── hsi37-redim-demi.png
├── docs/                   (documents de référence)
│   ├── FEUILLE_DE_ROUTE_HSI37.md
│   ├── mode-emploi-HSI37.pdf (si généré)
│   └── modeles/            (modèles PDF de référence)
├── signatures/             (5 signatures email HTML du bureau)
└── .skills/
    └── charte-graphique-hsi37/
        └── SKILL.md        (charte graphique)
```

---

## 5. BASE DE DONNÉES SUPABASE

### Table "adherents"
| Colonne | Type | Obligatoire | Notes |
|---------|------|-------------|-------|
| id | bigint auto | oui | ID technique interne |
| created_at | timestamptz | auto | date de création |
| id_adherent | text | oui | format HSI-2026-0001, auto-généré |
| nom | text | oui | |
| prenom | text | oui | |
| email | text | non | |
| telephone | text | non | |
| adresse | text | non | |
| date_adhesion | date | oui | saisie par 3 menus Jour/Mois/Année |
| montant_cotisation | numeric | non | |
| type_membre | text | oui | 6 valeurs : actif, bienfaiteur, honneur, bénévole, fondateur, droit |
| saison | text | oui | année d'adhésion, pilote le statut |
| civilite | text | non | Madame / Monsieur |
| mode_paiement | text | non | Espèces/Virement/Chèque/CB/PayPal/HelloAsso |
| numero_cheque | text | non | visible si chèque |
| banque_cheque | text | non | visible si chèque |

### Table "donateurs"
| Colonne | Type | Obligatoire | Notes |
|---------|------|-------------|-------|
| id | bigint auto | oui | ID technique interne |
| created_at | timestamptz | auto | |
| id_donateur | text | oui | format DON-2026-0001, auto-généré |
| nom | text | non | obligatoire si pas d'organisme |
| prenom | text | non | |
| organisme | text | non | obligatoire si pas de nom |
| email | text | non | |
| telephone | text | non | |
| adresse | text | non | |
| type_don | text | oui | "Don financier" ou "Don de matériel" |
| montant_don | numeric | non | obligatoire si financier |
| description_don | text | non | textarea libre, pour matériel |
| date_don | date | oui | 3 menus Jour/Mois/Année |
| mode_paiement | text | non | |
| civilite | text | non | masqué si organisme |
| numero_cheque | text | non | |
| banque_cheque | text | non | |

### Sécurité Supabase
- RLS activé sur les deux tables.
- 4 politiques par table : lecture/création/modification/suppression réservées à "authenticated".
- Authentification email + mot de passe, inscription libre désactivée.
- 5 comptes bureau créés (auto-confirmés).
- Clés dans config.js : SUPABASE_URL (https://xxx.supabase.co) + SUPABASE_KEY (sb_publishable_...).

---

## 6. FONCTIONNALITÉS V1 — TERMINÉES

### Authentification
- Écran de connexion (email + mot de passe)
- Session persistante (reconnexion auto si session active)
- Bouton "Se déconnecter"
- Dashboard masqué tant qu'on n'est pas connecté

### Hub de navigation (page d'accueil)
- 4 tuiles : Adhérents, Donateurs, Documents, Signatures email
- Navigation : Connexion → Hub → Section → Retour au hub
- Bouton "Retour à l'accueil" dans l'en-tête
- Design responsive (2 colonnes → 1 sur mobile)

### Gestion des adhérents (CRUD complet)
- Tableau dynamique avec colonnes : ID, Nom, Prénom, Email, Téléphone, Type de membre, Date d'adhésion, Montant, Statut, Paiement, Actions
- Créer un adhérent (modale, validation, ID auto HSI-AAAA-NNNN qui repart à 0001/an)
- Modifier (modale pré-remplie, ID non modifiable)
- Supprimer (fenêtre de confirmation intégrée au design HSI)
- Statut calculé automatiquement (jamais stocké) :
  - 🟢 À jour (saison = année en cours)
  - 🟠 À renouveler (année précédente)
  - 🔴 En retard (2 ans ou plus)
- Saisie date par 3 menus déroulants (Jour/Mois/Année, 2020→année en cours)
- Champs conditionnels : n° chèque + banque visibles si mode = chèque
- Infobulles sur les 6 types de membre

### Gestion des donateurs (CRUD complet, section séparée)
- Onglets Adhérents / Donateurs
- Même structure CRUD que les adhérents
- ID auto DON-AAAA-NNNN
- Champs conditionnels selon type de don :
  - Don financier → montant + mode de paiement
  - Don de matériel → description (textarea libre)
- Organisme possible (sans civilité/nom/prénom)
- Infobulle : "Si le donateur est un organisme, remplir uniquement ce champ"

### Carte d'adhérent virtuelle
- Bouton par ligne du tableau adhérents
- Carte générée en HTML/CSS, format carte bancaire (680×428px)
- Logo, nom, ID, type de membre, saison
- Bande bleue en haut, filet orange en bas
- Téléchargement PNG via html2canvas (scale: 2)
- Nom fichier : carte-adherent-HSI-XXXX-YYYY.png

### Reçus (adhésion + don)
- Bouton "Reçu" par ligne (adhérents ET donateurs)
- Menu signataire (président/trésorière/secrétaire) dans la modale du reçu
- Texte adapté selon type :
  - Adhésion : "certifie avoir reçu la somme de X € au titre de l'adhésion annuelle"
  - Don financier : "certifie avoir reçu la somme de X €"
  - Don matériel : "certifie avoir reçu un don de matériel (description)"
- Format nom officiel : Civilité + Prénom + NOM EN MAJUSCULES (ou Organisme)
- Numéro de reçu : REC-ADH-AAAA-NNNN / REC-DON-AAAA-NNNN
- Mention "Fait à Saint-Pierre-des-Corps, le [date du jour]"
- Espace signature
- Téléchargement PNG via html2canvas

### Documents (page Documents dans le hub)
- **Bulletin d'adhésion** : 2 versions (standard / avec don), année dynamique, modes de paiement avec cases à cocher (6 modes), téléchargement PNG
- **Papier à en-tête** : fichier .docx avec en-tête (logo + coordonnées) + filets orange + pied de page (mentions légales), corps vide à remplir dans Pages/Word
- **Attestation d'adhésion** : semi-auto depuis fiche adhérent, menu signataire, téléchargement PNG
- **Relance de cotisation** : visible uniquement sur adhérents orange/rouge, texte de relance pré-rempli, bouton "Envoyer par mail" (mailto: → Gmail pré-rempli), téléchargement PNG
- **Convocation AG** : modale avec champs (date, heure, lieu, ordre du jour), document généré, téléchargement PNG
- **PV d'AG** : modale avec champs (date, heures, lieu, présents, ordre du jour, résolutions), document généré, téléchargement PNG
- **Courrier libre** : modale (destinataire, objet, corps, signataire), document généré sur papier à en-tête, téléchargement PNG

### Signatures email
- 5 signatures HTML : Mohammed (président), Oum Keltoum (trésorière), Nawel (secrétaire), "Spéciale don", "Spéciale recrutement", "Institutionnelle"
- Coordonnées corrigées : 07 43 29 58 30 partout
- Nom complet : "Association HSI37 — Handicap Solidarité pour l'Inclusion 37"
- Mention RUP ("reconnue d'utilité publique") SUPPRIMÉE (HSI37 n'a pas ce statut)

### Mode d'emploi (en cours / à finaliser)
- PDF téléchargeable depuis la page Documents
- 10 sections : connexion, accueil, adhérents, carte, reçu, donateurs, documents, mail, déconnexion, problèmes
- Langage simple, pas de jargon, pour débutants

### Accessibilité (RGAA/WCAG — contexte handicap)
- Contrastes WCAG AA
- Labels liés aux inputs
- Navigation clavier complète, focus visible
- Focus trap dans les modales, fermeture Échap
- Attributs ARIA (role="dialog", aria-modal, aria-selected, aria-label)
- Statut ne repose pas uniquement sur la couleur (texte toujours présent)
- Structure sémantique (table, thead, th scope)

---

## 7. CE QUI RESTE À FAIRE AVANT MISE EN LIGNE

### Phase 3 — Finitions
- Vérification accessibilité de bout en bout
- Mention RGPD (information des adhérents sur leurs données)
- Export des données en fichier de sauvegarde
- Vérification solidité RLS avant exposition publique

### Mise en ligne
- Hébergement sur Cloudflare Pages ou Netlify (gratuit)
- Obtenir une adresse internet (ex: hsi37-dashboard.pages.dev)
- Configurer l'URL de redirection Supabase pour la production
- Communiquer adresse + identifiants au bureau
- Compléter l'adresse dans le mode d'emploi

---

## 8. FEUILLE DE ROUTE V2 (réservoir d'idées priorisé)

### Priorité haute
- Séparer "date de première adhésion" (figée, base de l'ID) et "saison de cotisation" (renouvelée chaque année)
- Historique des cotisations année par année + règle de radiation après 3 ans (Article 7 des statuts)
- Distinction adhésion / don dans le montant (le bulletin prévoit un don facultatif)
- QR code sur la carte d'adhérent (mène vers hsi37.fr)
- Passer les reçus/documents de PNG à PDF (librairie jsPDF ou html2pdf.js)
- Intégrer la signature manuscrite (image) dans les reçus et attestations
- Mot de passe oublié automatique (Niveau 2 avec SMTP, service Brevo recommandé)
- Envoi de mails automatiques (SMTP) au lieu du mailto: actuel

### Priorité moyenne
- Recherche et tri fonctionnels dans les tableaux (pour l'instant visuels uniquement)
- Export des données en CSV/Excel
- Statistiques dans le hub (nombre d'adhérents à jour, donateurs du mois...)
- Page de profil utilisateur (changer son mot de passe)
- Gestion de la saison active (bouton pour basculer d'une année à l'autre)

### Priorité basse / long terme
- Paiement en ligne (Stripe/HelloAsso intégré)
- Comptabilité (journal de caisse, bilan)
- Rôles cloisonnés (président voit tout, secrétaire gère adhérents, trésorier gère finances)
- Gouvernance (PV stockés, registre officiel)
- Import CSV de données existantes
- Upload de pièces justificatives (ATTENTION : pas de données de santé)

---

## 9. CONTRAINTES MÉTHODE (à respecter dans toute nouvelle session)

1. **Validation avant exécution** : reformuler chaque instruction, attendre OK.
2. **Sauvegardes obligatoires** (commit Git) après chaque étape réussie.
3. **config.js JAMAIS dans le chat, JAMAIS sur GitHub** — clés en local uniquement.
4. **Lexique** : définir chaque terme technique entre parenthèses.
5. **Diagnostic avant action** : trouver la CAUSE avant de corriger.
6. **Preuve brute** : demander le texte exact affiché, pas un résumé.
7. **Vérité avant confort** : dire clairement quand quelque chose ne va pas.
8. **Sécurité** : alerter si exposition de mot de passe, token ou donnée sensible.
9. **Ilhame est non-développeuse** : adapter le niveau en permanence.
10. **Claude Code exécute, ce chat cadre** : ici on décide, Claude Code code.

---

## 10. ENVIRONNEMENT DE TRAVAIL

- **Mac** : iMac, utilisateur ilhamemarroki
- **Terminal** : 3 fenêtres en parallèle (serveur / Claude Code / Git)
- **Serveur local** : python3 -m http.server 8001 (ou 8002) depuis ~/hsi37-dashboard
- **Navigateur** : Safari ou Chrome, localhost:800X/index.html
- **Claude Code** : lancé avec `claude` depuis ~/hsi37-dashboard
- **Autre projet** : Ocean Drift Lodge (site vitrine, sur localhost:8000, compte Cloudflare + Netlify existant)
- **Dossier association** : ~/HSI 37/ (classé en 9 catégories numérotées + _DIVERS)

---

## 11. POINTS DE VIGILANCE

- **"Reconnue d'utilité publique"** : FAUX pour HSI37. Ne jamais utiliser cette mention.
- **Données de santé** : JAMAIS stockées. Décision confirmée.
- **Statuts (Article 7)** : cotisations au 1er trimestre pour les anciens, jour d'adhésion pour les nouveaux. Radiation après 3 ans d'impayés.
- **AG en décembre** (Article 11) : convocations 15 jours avant.
- **Numéro officiel** : 07 43 29 58 30 (partout, pas le 06 95 26 44 97).
- **IBAN partiel** : FR76 1027 8374 …. …. …. 116 (ne jamais afficher en entier publiquement).
