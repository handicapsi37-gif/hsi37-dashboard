---
name: charte-graphique-hsi37
description: "Charte graphique de l'association HSI37 (Handicap Solidarité pour l'Inclusion 37). À lire et appliquer pour TOUTE création ou modification visuelle des projets HSI37 : Dashboard de gestion des adhérents, carte d'adhérent, reçu d'adhésion, bulletin, documents et courriers. Définit les couleurs officielles, les polices, le logo, et les règles d'usage. Déclencher dès qu'un document, une page, un composant ou un élément visuel HSI37 est créé ou retouché."
---

# Charte graphique HSI37

Identité de l'association : **hsi37** — Handicap Solidarité pour l'Inclusion 37.
Association loi 1901 n° W372020254. Site : https://hsi37.fr
Esprit de la marque : solidaire, accessible, chaleureux, moderne, sérieux.
Contexte handicap : l'ACCESSIBILITÉ prime sur l'esthétique en cas de conflit.

---

## 1. COULEURS OFFICIELLES (codes exacts, à utiliser tels quels)

Palette HSI37 — 4 couleurs officielles :

- Bleu principal : `#3B77B5`  — logo, titres, boutons d'action, aplats principaux, en-têtes
- Jaune/or (accent) : `#F7CD46`  — accents, éléments à mettre en avant, CTA secondaires
- Fond clair : `#FAFBF9`  — fond général, fonds de section, zones de respiration
- Encre (texte) : `#403E3E`  — tout le texte courant principal

Blanc : `#FFFFFF`  — texte sur fond bleu, zones de contraste fort

### Variables CSS recommandées
```css
:root {
  --bleu: #3B77B5;
  --jaune: #F7CD46;
  --fond-clair: #FAFBF9;
  --encre: #403E3E;
  --blanc: #FFFFFF;
}
```

### Règles d'usage des couleurs (ACCESSIBILITÉ — important)
- Contraste texte/fond : viser au minimum WCAG AA (ratio 4.5:1 pour le texte normal).
- Texte courant : toujours `--encre` (#403E3E) sur `--fond-clair` (#FAFBF9) ou blanc.
- Texte sur fond bleu (#3B77B5) : toujours en blanc (#FFFFFF).
- Le jaune #F7CD46 NE PEUT PAS être utilisé pour du texte (contraste insuffisant ~1.8:1).
  Usage autorisé : fond de bouton ou badge avec texte encre (#403E3E) dessus, ou élément décoratif.
- Ne jamais coder une information uniquement par la couleur : toujours doubler d'un
  texte ou d'une icône (ex. statut adhérent = pastille + libellé écrit).

---

## 2. TYPOGRAPHIE

### Polices officielles (gratuites, Google Fonts)
- **Titres** : `Bebas Neue` — sans-serif display, très impactante, toute en capitales.
  Utilisée pour les grands titres uniquement (ex. "DONNEZ UNE SECONDE VIE").
- **Texte courant** : `Montserrat` — sans-serif géométrique, lisible, moderne, accessible.

### Import (pour le web / HTML)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;600&display=swap" rel="stylesheet">
```

### Application CSS
```css
h1, h2, h3, .titre { font-family: 'Bebas Neue', sans-serif; }
body, p, .texte    { font-family: 'Montserrat', sans-serif; }
```

### Règles de typographie
- Bebas Neue : titres uniquement, grandes tailles (≥ 24px) ; ne pas utiliser pour le texte courant.
- Montserrat : texte courant, taille ≥ 16px, poids 400 (normal) et 600 (semi-gras).
- Mots-clés importants dans le texte : peuvent être mis en bleu (`--bleu`)
  pour les valoriser, comme sur les affiches.
- Garder une bonne taille et un bon interlignage (lisibilité = priorité, contexte handicap).
- Le jaune #F7CD46 est un accent dosé : max 1 élément par écran, jamais utilisé en couleur
  dominante sur le dashboard.

---

## 3. LOGO

- Logo principal : "hsi37" en blanc sur fond bleu (#3B77B5), avec la baseline
  "Handicap Solidarité pour l'Inclusion".
- Fichiers disponibles : version carrée 512x512 et version horizontale.
- Toujours laisser de l'espace autour du logo (zone de respiration).
- Ne pas déformer, ne pas changer ses couleurs, ne pas le poser sur un fond qui nuit
  à sa lisibilité.
- Sur fond clair, utiliser la version où le logo reste lisible (fond bleu intégré).

---

## 4. ÉLÉMENTS GRAPHIQUES SIGNATURE (style des affiches)

- **Formes arrondies organiques** : bandeaux en "vague / nuage" (comme les sections
  "NOS ACTIONS" des affiches), souvent en jaune/or ou bleu, pour délimiter les sections.
- **Ligne ondulée fine** jaune/dorée en séparation.
- **Icônes au trait simple et épuré** : fauteuil roulant, déambulateur, sac d'argent (€),
  poignée de main, téléphone, email, web.
- **Mise en page aérée** : beaucoup d'espace blanc, sections clairement délimitées
  par la couleur.
- Coins arrondis pour les cartes, boutons et images.

---

## 5. COORDONNÉES OFFICIELLES (à utiliser dans les documents)

- Association : Handicap Solidarité pour l'Inclusion 37
- Forme : association loi 1901 — n° W372020254
- Siège : 17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps
- Téléphone : 07 43 29 58 30
- Email : handicapsi37@gmail.com
- Site : https://hsi37.fr
- IBAN (dons/cotisations) : FR76 1027 8374 .... .... .... 116
  (ne jamais afficher l'IBAN complet dans un contexte public non maîtrisé)

---

## 6. RÈGLE D'OR
Cohérence avant tout : tout document ou écran HSI37 doit être immédiatement
reconnaissable — bleu dominant, jaune/or en accent, Bebas Neue pour les titres,
Montserrat pour le texte, logo hsi37, formes arrondies, et accessibilité soignée.
En cas de doute entre "joli" et "lisible/accessible", choisir lisible/accessible.
