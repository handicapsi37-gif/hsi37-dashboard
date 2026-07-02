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

## 3. PÉRIMÈTRE DU 1er LIVRABLE

Gestion des adhérents, et **rien d'autre** :
- Créer / modifier / supprimer un adhérent (saisie directe).
- Liste/tableau dynamique des adhérents avec recherche et tri.
- Enregistrement des paiements **reçus** (date, montant, mode : virement / chèque / espèces) — **sans encaissement en ligne**.
- Calcul automatique du statut + badges couleur.
- Identité visuelle HSI.
- Accessibilité (contexte handicap = exigence forte, voir §7).

**Hors périmètre (différé en V2)** : encaissement en ligne (Stripe/CB), comptabilité, gouvernance (PV/AG), génération de documents (carte virtuelle, attestations), upload de pièces, vues cloisonnées par rôle, import CSV.
*(Idées issues des cahiers des charges externes : conservées comme réservoir V2, pas intégrées maintenant.)*

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

## 7. IDENTITÉ VISUELLE (extraite des sources HSI)

Couleurs échantillonnées sur le logo (PDF attestation) + capture du site, **concordantes**.

| Rôle | Code hex | Usage | Contraste sur blanc |
|---|---|---|---|
| **Bleu HSI** (primaire) | `#1e79bf` | aplats, en-têtes, boutons | 4.62 — OK texte |
| **Bleu foncé** (dérivé) | `#155a8f` | texte bleu, liens, survols | 7.26 — excellent |
| **Rose-corail** (accent) | `#fe5260` | accents, fonds de boutons (texte blanc dessus = UI/gros texte uniquement) | 3.19 — UI/gros texte seulement |
| **Corail foncé** (dérivé) | `#d63a47` | texte d'accent sur fond clair | 4.61 — OK texte |
| **Encre** (texte) | `#1a2433` | texte principal | 15.62 — excellent |
| **Gris fond** | `#f4f6f8` | fonds de section, lignes | — |
| **Blanc** | `#ffffff` | fond général | — |

**Logo** : « hsi37 » blanc sur pavé bleu, baseline « Handicap Solidarité pour l'Inclusion ».
**Note accessibilité** : le rose-corail vif `#fe5260` ne passe PAS le seuil texte normal (4.5:1). Pour tout texte coloré, utiliser `#155a8f` (bleu) ou `#d63a47` (corail foncé). Couleurs à ajuster si charte officielle fournie plus tard.

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

## 11. PLAN DE PHASES (proposé, à valider)

- **Phase 0** — Maquette visuelle statique (HTML/CSS) avec fausses données : tableau adhérents, formulaire, badges, infobulles, identité HSI. Valider le design AVANT toute logique.
- **Phase 1** — Fondations : choix stockage + authentification.
- **Phase 2** — Logique CRUD (créer/lire/modifier/supprimer) + calcul statut auto.
- **Phase 3** — Accessibilité finalisée + RGPD + export.
- **V2 (différé)** — paiement en ligne, documents générés, rôles, compta, gouvernance.

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
