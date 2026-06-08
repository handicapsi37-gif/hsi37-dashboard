/* =====================================================
   APP.JS — HSI37 Dashboard
   Phase 0 : Fausses données + affichage du tableau
   Aucun stockage réel, aucune interaction de données.
   ===================================================== */

/* ---------- FAUSSES DONNÉES (tableau d'objets) ---------- */
/* Chaque objet représente un adhérent fictif.
   Format ID : HSI-AAAA-NNNN (préfixe + année + numéro 4 chiffres) */

const adherentsFictifs = [
  {
    id: "HSI-2026-0001",
    nom: "Moreau",
    prenom: "Claire",
    email: "claire.moreau@exemple.fr",
    telephone: "06 12 34 56 78",
    typeMembre: "actif",
    dateAdhesion: "2026-01-15",
    montant: "20,00 €",
    statut: "ajour"
  },
  {
    id: "HSI-2026-0002",
    nom: "Benali",
    prenom: "Karim",
    email: "k.benali@exemple.fr",
    telephone: "07 45 67 89 01",
    typeMembre: "bienfaiteur",
    dateAdhesion: "2026-02-03",
    montant: "100,00 €",
    statut: "ajour"
  },
  {
    id: "HSI-2026-0003",
    nom: "Leclerc",
    prenom: "Madeleine",
    email: "madeleine.leclerc@exemple.fr",
    telephone: "02 47 88 12 34",
    typeMembre: "honneur",
    dateAdhesion: "2020-06-10",
    montant: "0,00 €",
    statut: "ajour"
  },
  {
    id: "HSI-2026-0004",
    nom: "Traoré",
    prenom: "Ibrahima",
    email: "i.traore@exemple.fr",
    telephone: "06 78 90 12 34",
    typeMembre: "benevole",
    dateAdhesion: "2025-09-01",
    montant: "10,00 €",
    statut: "expire"
  },
  {
    id: "HSI-2026-0005",
    nom: "Dupuis",
    prenom: "Élodie",
    email: "elodie.dupuis@exemple.fr",
    telephone: "07 23 45 67 89",
    typeMembre: "fondateur",
    dateAdhesion: "2018-03-22",
    montant: "20,00 €",
    statut: "ajour"
  },
  {
    id: "HSI-2026-0006",
    nom: "Mairie de Saint-Pierre-des-Corps",
    prenom: "—",
    email: "contact@mairie-spc.fr",
    telephone: "02 47 44 80 00",
    typeMembre: "droit",
    dateAdhesion: "2018-03-22",
    montant: "0,00 €",
    statut: "ajour"
  },
  {
    id: "HSI-2026-0007",
    nom: "Petit",
    prenom: "François",
    email: "f.petit@exemple.fr",
    telephone: "06 56 78 90 12",
    typeMembre: "actif",
    dateAdhesion: "2025-04-18",
    montant: "20,00 €",
    statut: "expire"
  },
  {
    id: "HSI-2026-0008",
    nom: "Garnier",
    prenom: "Nathalie",
    email: "n.garnier@exemple.fr",
    telephone: "07 89 01 23 45",
    typeMembre: "bienfaiteur",
    dateAdhesion: "2026-03-05",
    montant: "150,00 €",
    statut: "ajour"
  }
];

/* ---------- CONFIGURATION DES TYPES DE MEMBRES ---------- */
/* Libellés et définitions pour les infobulles (bulles d'aide au survol) */

const typesMembres = {
  actif: {
    libelle: "Membre actif",
    definition: "Adhérent à jour de cotisation, participe à la vie de l'association.",
    alignInfBulle: ""
  },
  bienfaiteur: {
    libelle: "Membre bienfaiteur",
    definition: "Verse une cotisation supérieure au tarif normal, apporte un soutien renforcé à l'association.",
    alignInfBulle: "droite"
  },
  honneur: {
    libelle: "Membre d'honneur",
    definition: "Distinction honorifique accordée par l'assemblée, souvent dispensé de cotisation.",
    alignInfBulle: ""
  },
  benevole: {
    libelle: "Membre bénévole",
    definition: "Donne de son temps et de son énergie aux actions de l'association.",
    alignInfBulle: ""
  },
  fondateur: {
    libelle: "Membre fondateur",
    definition: "A participé à la création de l'association HSI37.",
    alignInfBulle: ""
  },
  droit: {
    libelle: "Membre de droit",
    definition: "Siège au sein de l'association en raison de sa fonction (ex. partenaire institutionnel).",
    alignInfBulle: "droite"
  }
};

/* ---------- CONFIGURATION DES STATUTS ---------- */

const statutsConfig = {
  ajour: {
    libelle: "À jour",
    classe: "badge--ajour",
    indicateur: "●" /* Pastille colorée */
  },
  expire: {
    libelle: "Expiré",
    classe: "badge--expire",
    indicateur: "●"
  }
};

/* ---------- FONCTIONS D'AFFICHAGE ---------- */

/**
 * Formate une date ISO (AAAA-MM-JJ) en format français (JJ/MM/AAAA).
 * @param {string} dateIso - Date au format ISO
 * @returns {string} Date au format français
 */
function formaterDate(dateIso) {
  if (!dateIso) return "—";
  const [annee, mois, jour] = dateIso.split("-");
  return `${jour}/${mois}/${annee}`;
}

/**
 * Génère le HTML d'une cellule "Type de membre" avec son infobulle.
 * @param {string} cle - Clé du type (ex : "actif")
 * @returns {string} HTML de la cellule
 */
function genererCelluleType(cle) {
  const type = typesMembres[cle];
  if (!type) return "—";

  /* Classe optionnelle pour décaler l'infobulle si elle risque de sortir à droite */
  const classeAlign = type.alignInfBulle ? ` type-membre--${type.alignInfBulle}` : "";

  return `
    <span class="type-membre${classeAlign}" tabindex="0"
          aria-label="${type.libelle} — ${type.definition}">
      <span class="type-membre__texte">${type.libelle}</span>
      <span class="type-membre__infobulle" role="tooltip">${type.definition}</span>
    </span>
  `.trim();
}

/**
 * Génère le HTML d'un badge de statut.
 * @param {string} cle - Clé du statut (ex : "ajour")
 * @returns {string} HTML du badge
 */
function genererBadge(cle) {
  const statut = statutsConfig[cle];
  if (!statut) return "—";

  return `
    <span class="badge ${statut.classe}">
      <span aria-hidden="true">${statut.indicateur}</span>
      ${statut.libelle}
    </span>
  `.trim();
}

/**
 * Génère le HTML des boutons d'action (modifier, supprimer) pour une ligne.
 * En Phase 0 : visuels uniquement, aucune action réelle.
 * @param {string} id - Identifiant de l'adhérent (pour aria-label)
 * @returns {string} HTML des boutons
 */
function genererBoutonsActions(id) {
  return `
    <button class="btn-icone btn-icone--modifier"
            aria-label="Modifier l'adhérent ${id}"
            title="Modifier"
            type="button">
      <svg aria-hidden="true" focusable="false"
           xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           width="17" height="17">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="btn-icone btn-icone--supprimer"
            aria-label="Supprimer l'adhérent ${id}"
            title="Supprimer"
            type="button">
      <svg aria-hidden="true" focusable="false"
           xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           width="17" height="17">
        <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"
                  fill="none" stroke-linecap="round"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M10 11v6M14 11v6"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
    </button>
  `.trim();
}

/**
 * Construit et injecte toutes les lignes du tableau à partir des fausses données.
 */
function remplirTableau() {
  const corps = document.getElementById("corps-tableau");
  if (!corps) return;

  /* On vide d'abord le corps au cas où la fonction serait appelée plusieurs fois */
  corps.innerHTML = "";

  adherentsFictifs.forEach(function(adherent) {
    const ligne = document.createElement("tr");

    /* Construction des cellules */
    ligne.innerHTML = `
      <td class="col-id">${adherent.id}</td>
      <td class="col-nom">${adherent.nom}</td>
      <td>${adherent.prenom}</td>
      <td class="col-email">
        <a href="mailto:${adherent.email}"
           style="color: var(--bleu-fonce); text-decoration: none;"
           aria-label="Envoyer un e-mail à ${adherent.prenom} ${adherent.nom}">
          ${adherent.email}
        </a>
      </td>
      <td class="col-telephone">${adherent.telephone}</td>
      <td>${genererCelluleType(adherent.typeMembre)}</td>
      <td>${formaterDate(adherent.dateAdhesion)}</td>
      <td>${adherent.montant}</td>
      <td>${genererBadge(adherent.statut)}</td>
      <td class="col-actions">${genererBoutonsActions(adherent.id)}</td>
    `;

    corps.appendChild(ligne);
  });
}

/* ---------- GESTION DE LA MODALE ---------- */
/* La modale (fenêtre superposée) s'ouvre et se ferme visuellement.
   En Phase 0, le formulaire n'enregistre rien. */

const fond = document.getElementById("modale-fond");
const modale = document.getElementById("modale-adherent");
const btnOuvrir = document.getElementById("btn-ajouter");
const btnFermer = document.getElementById("btn-fermer-modale");
const btnAnnuler = document.getElementById("btn-annuler-modale");
const formulaire = document.getElementById("formulaire-adherent");

/* Mémorise l'élément qui avait le focus avant l'ouverture de la modale,
   pour y revenir à la fermeture (bonne pratique d'accessibilité RGAA) */
let elementAvantModale = null;

/**
 * Ouvre la modale et déplace le focus sur la boîte de dialogue.
 */
function ouvrirModale() {
  elementAvantModale = document.activeElement;
  fond.hidden = false;
  /* Délai minimal pour que l'animation CSS s'enclenche correctement */
  requestAnimationFrame(function() {
    modale.focus();
  });
  document.addEventListener("keydown", gererToucheClavier);
}

/**
 * Ferme la modale et rend le focus à l'élément d'origine.
 */
function fermerModale() {
  fond.hidden = true;
  document.removeEventListener("keydown", gererToucheClavier);
  /* Retour du focus à l'élément qui a ouvert la modale */
  if (elementAvantModale) {
    elementAvantModale.focus();
  }
}

/**
 * Focus trap (focus enfermé dans la modale) : empêche de sortir de la modale au clavier.
 * Fermeture par touche Échap (RGAA exigence).
 * @param {KeyboardEvent} evenement
 */
function gererToucheClavier(evenement) {
  /* Fermeture par Échap */
  if (evenement.key === "Escape") {
    fermerModale();
    return;
  }

  /* Focus trap : boucle dans les éléments focusables de la modale */
  if (evenement.key === "Tab") {
    /* Récupère tous les éléments interactifs à l'intérieur de la modale */
    const elementsFocusables = modale.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const premier = elementsFocusables[0];
    const dernier = elementsFocusables[elementsFocusables.length - 1];

    if (evenement.shiftKey) {
      /* Shift+Tab : si on est sur le premier élément, on saute au dernier */
      if (document.activeElement === premier) {
        evenement.preventDefault();
        dernier.focus();
      }
    } else {
      /* Tab : si on est sur le dernier élément, on saute au premier */
      if (document.activeElement === dernier) {
        evenement.preventDefault();
        premier.focus();
      }
    }
  }
}

/**
 * Ferme la modale si l'utilisateur clique sur le fond semi-transparent
 * (en dehors de la boîte de dialogue).
 * @param {MouseEvent} evenement
 */
function gererClicFond(evenement) {
  /* On vérifie que le clic est bien sur le fond, pas sur la modale elle-même */
  if (evenement.target === fond) {
    fermerModale();
  }
}

/* Branchement des écouteurs d'événements (event listeners) */
btnOuvrir.addEventListener("click", ouvrirModale);
btnFermer.addEventListener("click", fermerModale);
btnAnnuler.addEventListener("click", fermerModale);
fond.addEventListener("click", gererClicFond);

/* En Phase 0 : empêche la soumission réelle du formulaire */
formulaire.addEventListener("submit", function(evenement) {
  evenement.preventDefault();
  /* On ferme simplement la modale sans rien enregistrer */
  fermerModale();
});

/* ---------- INITIALISATION ---------- */
/* Remplit le tableau au chargement de la page */
document.addEventListener("DOMContentLoaded", function() {
  remplirTableau();
});
