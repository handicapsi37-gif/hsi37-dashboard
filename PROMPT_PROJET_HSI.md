# PROMPT PROJET — Dashboard HSI37

> Document de cadrage. Sert de référence unique et de point de départ (Claude Code ou autre).
> Toute exécution suit le protocole : reformuler, valider, attendre OK avant d'agir.

---

## 1. CONTEXTE & DESCRIPTION

**Association** : Handicap Solidarité pour l'Inclusion 37 (HSI37).
**Statut** : association loi 1901, créée le 21 juillet 2024 (récépissé Préfecture Indre-et-Loire).
**N° RNA** (Répertoire National des Associations — identifiant officiel) : **W372020254**.
**Siège** : 17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps.
**Président** : Mohammed Belhaj. **Secrétaire adjointe** : Ilhame Belhaj.
**Contact** : handicapsi37@gmail.com — 07 43 29 58 30 — hsi37.fr.
**Objet** : collecte, remise en état et distribution de matériel médical d'autonomie (fauteuils roulants, déambulateurs, cannes) en Indre-et-Loire et au Maroc (partenaire CLIO, Salé).

**Objectif du projet** : construire un **Dashboard** (tableau de bord — interface centrale de gestion) de **gestion des adhérents**. Outil **unique** : il remplace PayAsso (la plateforme d'adhésion actuelle). Données créées de zéro (pas de reprise/import).

---

## 2. STACK TECHNIQUE (Voie 2 — statique sur-mesure)

- **Front** : HTML + CSS + JavaScript vanilla (sans framework lourd type Next.js). Même logique que les projets statiques déjà maîtrisés.
- **Stockage de données** : à trancher en Phase 1 — base légère gratuite (ex. Cloudflare D1, ou stockage navigateur pour prototype). NB : un Dashboard multi-utilisateurs en ligne exige un stockage **centralisé partagé** (pas du localStorage seul).
- **Hébergement** : gratuit (Cloudflare Pages ou Netlify).
- **Authentification** (connexion sécurisée du bureau) : à cadrer Phase 1.
- **Coût récurrent visé** : 0 € (hors renouvellement domaine hsi37.fr déjà payé).
- **Maintenance** : assurée en solo (Ilhame) via Claude Code + IA. → exigence de **simplicité délibérée** et **documentation** (facteur bus = 1).

---

## 3. PÉRIMÈTRE ACTUEL (mis à jour)

Modules livrés :
- Adhérents : CRUD (créer/lire/modifier/supprimer) complet, statut auto, cartes
  virtuelles, reçus, attestations, relances
- Donateurs : CRUD complet, dons financiers et matériel, reçus
- Événements : gestion, participants, export
- Inventaire : CRUD, photos, prix
- Prêt local : structure posée, formulaire de retour à finir
- Dons de matériel : module séparé (dons-materiel.html), fusion avec Inventaire prévue

Hors périmètre (toujours différé) : encaissement en ligne, comptabilité,
gouvernance avancée.

---

## 4. MODÈLE DE DONNÉES — ADHÉRENT

| Champ | Type | Règle |
|---|---|---|
| ID adhérent | texte auto | format **`HSI-2026-0001`** (préfixe HSI + année saison + n° séquentiel sur 4 chiffres) |
| Nom | texte | obligatoire |
| Prénom | texte | obligatoire |
| E-mail | e-mail | format validé |
| Téléphone | texte | format FR |
| Adresse | texte | — |
| Date d'adhésion | date | obligatoire |
| Montant cotisation | nombre (€) | — |
| Statut | calculé | **automatique** : à jour si date du jour ≤ 31/12 de la saison ; sinon expiré |
| Type de membre | liste fermée | 6 valeurs, voir §5 |

**Saison** : année civile, libellée **`2026`** (puis `2027`…), **modifiable** par le bureau. Référence : « Adhésion HSI 37 année 2026 ». Expiration commune : **31 décembre**.

**Aucune donnée sensible** (santé, type de handicap) → RGPD allégé.

---

## 5. TYPES DE MEMBRE (liste fermée + infobulles)

Menu déroulant. Chaque valeur affiche une **infobulle** (bulle d'aide au survol/clic) avec sa définition :

1. **Membre actif** — adhérent à jour, participe à la vie de l'association.
2. **Membre bienfaiteur** — verse une cotisation supérieure, soutien renforcé.
3. **Membre d'honneur** — distinction honorifique, souvent dispensé de cotisation.
4. **Membre bénévole** — donne de son temps aux actions.
5. **Membre fondateur** — a participé à la création de l'association.
6. **Membre de droit** — siège par sa fonction (ex. partenaire institutionnel).

---

## 6. STATUT — BADGES COULEUR

- 🟢 **À jour** — vert.
- 🔴 **Expiré** — rouge.
*(Statut recalculé automatiquement à chaque ouverture, par rapport au 31/12 de la saison active.)*

---

## 7. IDENTITÉ VISUELLE

Référence unique et à jour : voir `.skills/charte-graphique-hsi37/SKILL.md`.

Couleurs officielles :
- Bleu principal : #3B77B4 — logo, titres, boutons, en-têtes
- Jaune/or (accent) : #F7CD46 — accents uniquement, jamais en texte (contraste ~1.8:1 insuffisant)
- Fond clair : #FAFBFE
- Encre (texte) : #403E3E

Polices : Bebas Neue (titres), Montserrat (texte courant).

Ne pas utiliser les anciennes couleurs #1e79bf, #155a8f, #fe5260, #d63a47, #1a2433,
#f4f6f8 — obsolètes, remplacées par la charte ci-dessus.

---

## 8. ACCESSIBILITÉ (RGAA / WCAG — exigence forte, contexte handicap)

- Contraste texte ≥ **4.5:1** (gros texte/UI ≥ 3:1).
- `<label>` lié à chaque `<input>` de formulaire.
- Attribut `alt` clair sur chaque image.
- Navigation clavier complète, focus visible.
- Compatible lecteurs d'écran (structure sémantique, ARIA si besoin).

---

## 9. RGPD (allégé — pas de données sensibles)

- Données personnelles basiques (identité, contact) : finalité = gestion des adhésions.
- Prévoir : mention d'information, droit d'accès/rectification/suppression (la fonction « supprimer un adhérent » y contribue).
- Export régulier des données en fichier simple (continuité si l'outil tombe).

---

## 10. CONTRAINTES MÉTHODE (impératives)

- **Validation avant exécution** : reformuler chaque instruction, attendre OK.
- **Sauvegardes obligatoires** avant toute modification automatisée (fichiers `-original`).
- **Recommandations d'expert explicites et justifiées**, contrôle total laissé à Ilhame.
- **Lexique** : définir chaque terme technique/anglais entre parenthèses.
- Jamais de token GitHub collé en chat (terminal uniquement).

---

## 11. ÉTAT D'AVANCEMENT (mis à jour)

Fait : Phases 0 à 3 (maquette, stockage Supabase, CRUD, accessibilité, RGPD, export).
En cours : Prêt local (retour + photos), fusion onglets Inventaire/Prêt/Dons matériel.
Reporté : import PayAsso, reçus fiscaux Cerfa (attente rescrit DRFIP 37), CRM.

---

## Commandes Git — fin de session

À fournir systématiquement à la fin de chaque session de travail :

```bash
git add .
git commit -m "feat: [description courte de ce qui a été fait]"
git push origin main
```

Règle : toujours donner ces 3 commandes complètes, prêtes à coller dans le terminal,
avec un message de commit adapté aux modifications de la session.
