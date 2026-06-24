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

### Bleus (couleur dominante)
- Bleu principal : `#2D82C4`  — logo, titres, boutons d'action, aplats principaux
- Bleu clair / icônes : `#5AA9E6`  — survols, éléments secondaires, icônes
- Bleu foncé texte/logo : `#1F4E79`  — texte bleu sur fond clair, liens, contours

### Orange (couleur d'accent — CTA / don)
- Orange : `#F28C28`  — appels à l'action, accent "don", éléments à mettre en avant
- Orange foncé : `#D96F00`  — survol des éléments orange, texte orange sur fond clair

### Neutres
- Gris texte : `#333333`  — texte courant principal
- Gris secondaire : `#666666`  — texte secondaire, légendes
- Fond clair : `#F8F9FA`  — fonds de section, zones de respiration
- Blanc : `#FFFFFF`  — fond principal, texte sur fond bleu

### Variables CSS recommandées
```css
:root {
  --bleu: #2D82C4;
  --bleu-clair: #5AA9E6;
  --bleu-fonce: #1F4E79;
  --orange: #F28C28;
  --orange-fonce: #D96F00;
  --gris-texte: #333333;
  --gris-secondaire: #666666;
  --fond-clair: #F8F9FA;
  --blanc: #FFFFFF;
}
```

### Règles d'usage des couleurs (ACCESSIBILITÉ — important)
- Contraste texte/fond : viser au minimum WCAG AA (ratio 4.5:1 pour le texte normal).
- Pour du TEXTE coloré sur fond clair : utiliser `--bleu-fonce` (#1F4E79) ou
  `--orange-fonce` (#D96F00). NE JAMAIS utiliser l'orange vif #F28C28 ni le bleu clair
  #5AA9E6 pour du texte normal (contraste insuffisant).
- Texte sur fond bleu (#2D82C4 ou #1F4E79) : toujours en blanc.
- L'orange est un ACCENT : à doser, ne pas en faire la couleur dominante. La dominante
  reste le bleu.
- Ne jamais coder une information uniquement par la couleur : toujours doubler d'un
  texte ou d'une icône (ex. statut adhérent = pastille + libellé écrit).

---

## 2. TYPOGRAPHIE

### Polices officielles (gratuites, Google Fonts)
- **Titres** : `Oswald` — sans-serif condensée, grasse, impactante.
  Utilisée pour les grands titres, en majuscules de préférence (ex. "DONNEZ UNE SECONDE VIE").
- **Texte courant** : `Open Sans` — sans-serif très lisible, neutre, accessible.

### Import (pour le web / HTML)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
```

### Application CSS
```css
h1, h2, h3, .titre { font-family: 'Oswald', sans-serif; }
body, p, .texte    { font-family: 'Open Sans', sans-serif; }
```

### Règles de typographie
- Titres : Oswald, gras, lettres larges ; possibilité de majuscules pour l'impact.
- Texte courant : Open Sans régulier, taille confortable (≥ 16px sur écran pour la lisibilité).
- Mots-clés importants dans le texte : peuvent être mis en bleu (`--bleu` ou `--bleu-fonce`)
  pour les valoriser, comme sur les affiches.
- Garder une bonne taille et un bon interlignage (lisibilité = priorité, contexte handicap).

---

## 3. LOGO

- Logo principal : "hsi37" en blanc sur fond bleu (#2D82C4), avec la baseline
  "Handicap Solidarité pour l'Inclusion".
- Fichiers disponibles : version carrée 512x512 et version horizontale.
- Toujours laisser de l'espace autour du logo (zone de respiration).
- Ne pas déformer, ne pas changer ses couleurs, ne pas le poser sur un fond qui nuit
  à sa lisibilité.
- Sur fond clair, utiliser la version où le logo reste lisible (fond bleu intégré).

---

## 4. ÉLÉMENTS GRAPHIQUES SIGNATURE (style des affiches)

- **Formes arrondies organiques** : bandeaux en "vague / nuage" (comme les sections
  "NOS ACTIONS" des affiches), souvent en orange ou bleu, pour délimiter les sections.
- **Ligne ondulée fine** orange/dorée en séparation.
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
reconnaissable — bleu dominant, orange en accent, Oswald pour les titres,
Open Sans pour le texte, logo hsi37, formes arrondies, et accessibilité soignée.
En cas de doute entre "joli" et "lisible/accessible", choisir lisible/accessible.
