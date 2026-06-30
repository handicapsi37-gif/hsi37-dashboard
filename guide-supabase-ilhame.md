# Guide Supabase — Usage quotidien HSI37
*Document personnel — Ilhame*

---

## C'est quoi Supabase ?

C'est la base de données (le "fichier Excel géant") qui stocke tous les adhérents et donateurs du dashboard. Tu y accèdes sur **supabase.com** avec ton compte email.

Projet concerné : **hsi37-dashboard**

---

## 1. Se connecter

1. Va sur https://supabase.com
2. Clique **Sign In**
3. Entre ton email + mot de passe
4. Clique sur le projet **hsi37-dashboard**

---

## 2. Voir les données (en cas de doute ou vérification)

1. Menu gauche → **Table Editor**
2. Clique sur **adherents** ou **donateurs**
3. Tu vois toutes les lignes — tu peux lire mais évite de modifier directement ici (fais-le depuis le dashboard)

---

## 3. Changer le mot de passe d'un compte bureau

À faire quand quelqu'un du bureau a oublié son mot de passe.

1. Menu gauche → **Authentication**
2. Clique **Users**
3. Trouve la personne dans la liste (par email)
4. Clique sur les **3 points** à droite de sa ligne
5. Clique **Send password recovery** → ça lui envoie un email de réinitialisation

> ⚠️ Pour que ça marche, la personne doit avoir accès à son email et pouvoir cliquer le lien reçu.

---

## 4. Si l'email de réinitialisation ne part pas (solution manuelle)

Si la personne n'a pas reçu l'email ou n'y a pas accès :

1. Menu gauche → **Authentication** → **Users**
2. Clique sur l'email de la personne (ouvre sa fiche)
3. Cherche le champ **Password** 
4. Tape un nouveau mot de passe provisoire
5. Clique **Save**
6. Communique le nouveau mot de passe à la personne par téléphone (jamais par email en clair)
7. Dis-lui de le changer dès sa première connexion

---

## 5. Vérifier que la sécurité est active (RLS)

1. Menu gauche → **Authentication** → **Policies**
2. Tu dois voir les tables **adherents** et **donateurs** avec chacune 4 politiques listées
3. Le bouton **Disable RLS** visible = RLS actif (c'est bon)

---

## 6. Ce qu'il ne faut JAMAIS faire sur Supabase

- ❌ Ne jamais supprimer une politique RLS sans en comprendre les conséquences
- ❌ Ne jamais partager les clés qui sont dans ton config.js (SUPABASE_URL et SUPABASE_KEY)
- ❌ Ne jamais coller ces clés dans un chat, un email ou GitHub
- ❌ Ne pas modifier les données directement dans Table Editor sauf urgence

---

## 7. Gestion des colonnes Supabase

### Structure de la table `adherents`

| Colonne | Type | Rôle |
|---|---|---|
| id | uuid | Identifiant technique (généré automatiquement) |
| id_adherent | text | Identifiant lisible HSI-2026-0001 |
| nom | text | Nom de famille |
| prenom | text | Prénom |
| email | text | Adresse e-mail |
| telephone | text | Numéro de téléphone |
| adresse | text | Adresse postale |
| date_adhesion | date | Date d'adhésion |
| montant_cotisation | numeric | Montant payé en € |
| mode_paiement | text | virement / chèque / espèces |
| type_membre | text | Membre actif, bienfaiteur, etc. |
| saison | text | Année de l'adhésion (ex. 2026) |

### Structure de la table `donateurs`

| Colonne | Type | Rôle |
|---|---|---|
| id | uuid | Identifiant technique (généré automatiquement) |
| id_donateur | text | Identifiant lisible HSI-2026-0001 |
| nom | text | Nom de famille |
| prenom | text | Prénom |
| organisme | text | Nom de l'organisme (si don d'une structure) |
| email | text | Adresse e-mail |
| type_don | text | Don financier / Don matériel |
| montant_don | numeric | Montant en € (vide si don matériel) |
| description_don | text | Description du matériel donné |
| date_don | date | Date du don |
| mode_paiement | text | virement / chèque / espèces |

### Structure de la table `cotisations`

**Rôle** : historique des cotisations par année. Chaque adhérent a une ligne par année de cotisation — jamais deux lignes pour la même année.

**Règle** : un adhérent ne peut avoir qu'une seule cotisation par année (contrainte unique sur `adherent_id` + `annee`).

| Colonne | Type | Rôle |
|---|---|---|
| id | uuid | Identifiant technique (généré automatiquement) |
| adherent_id | uuid | Lien vers l'adhérent (clé étrangère → adherents.id) |
| annee | integer | Année de la cotisation (ex. 2026) |
| date_paiement | date | Date du paiement |
| montant | numeric | Montant payé en € |
| mode_paiement | text | virement / chèque / espèces / etc. |
| created_at | timestamp | Date de création de la ligne |

### Structure de la table `dons`

| Colonne | Type | Rôle |
|---|---|---|
| id | uuid | Identifiant technique (généré automatiquement) |
| donateur_id | uuid | Lien vers le donateur (clé étrangère → donateurs.id) |
| annee | integer | Année du don (ex. 2026) |
| date_don | date | Date du don |
| montant | numeric | Montant en € |
| mode_paiement | text | virement / chèque / espèces / etc. |
| type_don | text | Don financier / Don de matériel |
| created_at | timestamp | Date de création de la ligne |

### Structure de la table `evenements`

| Colonne | Type | Rôle |
|---|---|---|
| id | uuid | Identifiant technique (généré automatiquement) |
| nom | text | Nom de l'événement |
| date | date | Date de l'événement |
| lieu | text | Lieu de l'événement |
| prix_unitaire | numeric | Prix par participant en € |
| created_at | timestamp | Date de création de la ligne |

### Structure de la table `participants_evenements`

| Colonne | Type | Rôle |
|---|---|---|
| id | uuid | Identifiant technique (généré automatiquement) |
| evenement_id | uuid | Lien vers l'événement (clé étrangère → evenements.id) |
| nom | text | Nom du participant |
| prenom | text | Prénom du participant |
| email | text | Adresse e-mail |
| telephone | text | Numéro de téléphone |
| quantite | integer | Nombre de places |
| montant | numeric | Montant total payé en € |
| created_at | timestamp | Date de création de la ligne |

### Contraintes de valeurs acceptées

**`mode_paiement`** — valeurs acceptées (tables `adherents`, `cotisations`, `donateurs`, `dons`) :

`virement` · `chèque` · `espèces` · `carte bancaire` · `paypal` · `helloasso` · `payasso`

> ⚠️ Ces valeurs sont en minuscules dans le code. Saisir une variante avec majuscule (ex. "Virement") casserait le pré-remplissage des formulaires.

**`type_don`** — valeurs acceptées (tables `donateurs`, `dons`) :

`Don financier` · `Contribution solidaire` · `Repas événement` · `Don de matériel`

> ⚠️ Ne jamais ajouter ou supprimer une colonne sans en parler d'abord — cela peut casser le dashboard.

### Modifier une colonne : passer en "Allow Nullable"

Certaines colonnes ne sont pas obligatoires (exemple : `organisme` — un donateur peut être une personne, pas forcément une structure). Si Supabase bloque l'enregistrement parce qu'un champ est vide, il faut passer cette colonne en **Allow Nullable** (autoriser les valeurs vides).

**Exemple concret : colonne `organisme` de la table `donateurs`**

1. Aller sur [supabase.com](https://supabase.com) → se connecter → ouvrir le projet `hsi37-dashboard`
2. Menu gauche → **Table Editor** → cliquer sur la table `donateurs`
3. Cliquer sur l'icône **crayon** (modifier) à droite de la colonne `organisme`
4. Cocher la case **Is Nullable** (autoriser valeur vide)
5. Cliquer sur **Save** (enregistrer)

> ⚠️ Ne modifier qu'une colonne à la fois, et toujours vérifier que le dashboard fonctionne après.

---

## 8. Edge Function : envoyer-recu

Une **Edge Function** (fonction serveur — code qui s'exécute côté Supabase, pas dans le navigateur) nommée `envoyer-recu` est utilisée par le dashboard pour envoyer les reçus par e-mail.

### Ce que fait cette fonction
- Elle reçoit les données d'un reçu (adhésion ou don) depuis le dashboard
- Elle génère le PDF du reçu
- Elle l'envoie par e-mail au destinataire

### Expéditeur des e-mails
Tous les e-mails envoyés par cette fonction partent de l'adresse :
**handicapsi37@gmail.com**

C'est l'adresse qui apparaît dans la boîte de réception du destinataire.

### Où la trouver sur Supabase
1. Aller sur [supabase.com](https://supabase.com) → se connecter → ouvrir le projet `hsi37-dashboard`
2. Menu gauche → **Edge Functions**
3. La fonction `envoyer-recu` apparaît dans la liste

### ⚠️ Ne jamais supprimer cette fonction
Sans elle, l'envoi de reçus par e-mail ne fonctionne plus. En cas de problème d'envoi, contacter Ilhame ou relire la documentation technique avant toute modification.

---

## 9. Edge Function : envoyer-invitation

Une Edge Function nommée `envoyer-invitation` permet d'envoyer des e-mails d'invitation en masse depuis le Dashboard (via les cases à cocher).

### Ce que fait cette fonction
- Elle reçoit une liste de destinataires (adhérents, donateurs, participants sélectionnés)
- Elle génère un e-mail HTML personnalisé avec le corps, l'objet et la signature choisis
- Elle envoie l'e-mail à tous les destinataires via l'API Brevo (service d'envoi d'e-mails)
- Elle dédoublonne automatiquement les adresses pour éviter les envois en double

### Expéditeur des e-mails
Tous les e-mails partent de : **handicapsi37@gmail.com**

### Où la trouver sur Supabase
1. Aller sur [supabase.com](https://supabase.com) → se connecter → ouvrir le projet `hsi37-dashboard`
2. Menu gauche → **Edge Functions**
3. La fonction `envoyer-invitation` apparaît dans la liste

### ⚠️ Ne jamais supprimer cette fonction
Sans elle, l'envoi d'invitations par e-mail ne fonctionne plus. En cas de problème, contacter Ilhame avant toute modification.

---

## 10. IDs séquentiels — Format et renumérotation

### Format des identifiants
- **Adhérents** : `HSI-2026-0001`, `HSI-2026-0002`… (préfixe `HSI-` + saison + numéro à 4 chiffres)
- **Donateurs** : `DON-2026-0001`, `DON-2026-0002`… (préfixe `DON-` + année + numéro à 4 chiffres)

Ces colonnes ont une contrainte **UNIQUE** en base — impossible d'avoir deux fois le même ID.

### Import en masse (script Python)
Pour importer de nombreux adhérents ou donateurs depuis un fichier CSV, utiliser le script `import_masse.py` (à la racine du projet) :

```bash
# Simulation (dry-run) — vérifier les IDs sans insérer
python3 import_masse.py --table adherents --fichier nouveaux.csv --dry-run

# Import réel
python3 import_masse.py --table adherents --fichier nouveaux.csv
python3 import_masse.py --table donateurs --fichier nouveaux.csv
```

Le script calcule automatiquement le prochain numéro disponible en base et génère les IDs séquentiels.

---

## 11. Règle anti-régression

Après toute modification importante du dashboard (nouveau formulaire, nouvelle logique de sauvegarde, correction de bug), tester immédiatement dans cet ordre :

1. **Ajouter un adhérent** → vérifier que nom, montant, mode de paiement s'enregistrent
2. **Modifier cet adhérent** → vérifier que les champs se pré-remplissent correctement et que la modification se sauvegarde
3. **Ajouter un donateur** → vérifier que montant et mode de paiement s'enregistrent
4. **Modifier ce donateur** → vérifier que les champs se pré-remplissent et que la modification se sauvegarde

Ne pas passer à la fonctionnalité suivante avant que ces 4 tests passent.

---

## 12. En cas de problème inconnu

Avant de toucher quoi que ce soit : fais une capture d'écran de ce que tu vois et contacte Ilhame (toi-même via Claude Code 😄) ou ouvre une nouvelle conversation Claude en décrivant le problème.

---

## 13. Filtre adhérents par année — fonctionnement technique

Le filtre par année dans l'onglet Adhérents **ne se base pas sur `date_adhesion`**. Il cherche dans la table `cotisations`.

- Un adhérent apparaît pour l'année X s'il possède **au moins une ligne** dans `cotisations` avec `annee = X`.
- Si aucune cotisation n'est enregistrée pour un adhérent, le filtre utilise l'année de `date_adhesion` comme fallback.

**Conséquence pratique** : un adhérent inscrit en 2024 qui renouvelle en 2026 apparaît dans les deux filtres (2024 et 2026) — ce qui est le comportement attendu.

---

## 14. Scripts d'import PayAsso (dossier `scripts/import-payasso/`)

Ces scripts Python lisent un fichier Excel exporté depuis PayAsso et importent les données dans Supabase, avec validation manuelle ligne par ligne.

### `import_adherents.py` — import des adhésions

```bash
python3 scripts/import-payasso/import_adherents.py fichier.xlsx            # dry-run
python3 scripts/import-payasso/import_adherents.py fichier.xlsx --confirmer # écriture réelle
```

**Fonctionnement** :
1. Lit chaque ligne du fichier Excel (Date + Prénom Nom)
2. Recherche un doublon dans `adherents` via fuzzy matching (seuil 85%)
3. Affiche le résultat et demande une réponse :
   - **G** = nouveau adhérent → insère dans `adherents` + cotisations manquantes
   - **I** = doublon confirmé → ajoute uniquement les cotisations manquantes sur la fiche existante
   - **Q** = arrêt propre, comptabilise les lignes sautées
4. Affiche un récapitulatif final (nouveaux / complétés / cotisations créées / skippés)

### `import_dons.py` — import des dons

```bash
python3 scripts/import-payasso/import_dons.py fichier.xlsx            # dry-run
python3 scripts/import-payasso/import_dons.py fichier.xlsx --confirmer # écriture réelle
```

**Fonctionnement** :
1. Lit chaque ligne du fichier Excel PayAsso dons (Nom, Prénom, email, Adresse, Montant, Date, Moyen de paiement)
2. Recherche un doublon dans `donateurs` via fuzzy matching (seuil 85%)
3. Affiche le résultat et demande une réponse :
   - **G** = nouveau donateur → insère dans `donateurs` + insère le don dans `dons`
   - **I** = doublon confirmé → insère uniquement le don sur le donateur existant
   - **Q** = arrêt propre
4. Affiche un récapitulatif final (nouveaux donateurs / existants complétés / dons créés au total)

> ⚠️ Les deux scripts utilisent `secrets_import.py` pour les clés Supabase — ne jamais mettre les clés en dur dans le code.

---

## 15. Règle anti-doublon (fuzzy matching)

Avant toute insertion d'adhérent ou de donateur, les scripts vérifient si la personne existe déjà en base via une **comparaison approximative des noms** (fuzzy matching).

**Seuil** : 85% de ressemblance minimum pour considérer un doublon probable.

**Méthode** :
- Normalisation : minuscules, sans accents, sans tirets
- Test dans les deux sens : "Prénom Nom" et "Nom Prénom" — le score le plus élevé est retenu
- Pour les organismes (noms multi-mots) : comparaison du nom seul en cas d'échec de la comparaison complète

**Règle absolue** : même à 100% de ressemblance, la validation est toujours manuelle. Aucune insertion automatique sans confirmation G / I / Q.

---

*Dernière mise à jour : juin 2026 — V5 cotisations + filtre année + scripts PayAsso + anti-doublon*
