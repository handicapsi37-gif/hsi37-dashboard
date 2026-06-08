/* =====================================================
   APP.JS — HSI37 Dashboard
   Phase 0 : Fausses données + affichage du tableau
   Aucun stockage réel, aucune interaction de données.
   ===================================================== */

/* Les données sont chargées depuis Supabase (voir chargerAdherents ci-dessous) */

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
 * Injecte les lignes du tableau à partir des données Supabase.
 * @param {Array} adherents - Tableau d'objets retournés par Supabase
 */
function remplirTableau(adherents) {
  const corps = document.getElementById("corps-tableau");
  if (!corps) return;

  corps.innerHTML = "";

  /* Cas table vide : message accessible dans le tableau */
  if (!adherents || adherents.length === 0) {
    corps.innerHTML = `
      <tr>
        <td colspan="10" class="tableau-message">
          Aucun adhérent enregistré pour l'instant.
        </td>
      </tr>
    `;
    return;
  }

  adherents.forEach(function(adherent) {
    const ligne = document.createElement("tr");

    /* Formatage du montant : nombre Supabase → "xx,xx €" à la française */
    const montant = (adherent.montant_cotisation !== null && adherent.montant_cotisation !== undefined)
      ? Number(adherent.montant_cotisation).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
      : "—";

    ligne.innerHTML = `
      <td class="col-id">${adherent.id_adherent || "—"}</td>
      <td class="col-nom">${adherent.nom || "—"}</td>
      <td>${adherent.prenom || "—"}</td>
      <td class="col-email">
        <a href="mailto:${adherent.email || ""}"
           style="color: var(--bleu-fonce); text-decoration: none;"
           aria-label="Envoyer un e-mail à ${adherent.prenom || ""} ${adherent.nom || ""}">
          ${adherent.email || "—"}
        </a>
      </td>
      <td class="col-telephone">${adherent.telephone || "—"}</td>
      <td>${genererCelluleType(adherent.type_membre)}</td>
      <td>${formaterDate(adherent.date_adhesion)}</td>
      <td>${montant}</td>
      <td>—</td>
      <td class="col-actions">${genererBoutonsActions(adherent.id_adherent || adherent.id)}</td>
    `;

    corps.appendChild(ligne);
  });
}

/**
 * Lit tous les adhérents depuis la table Supabase et met à jour le tableau.
 * Gère les cas : chargement, table vide, erreur réseau.
 */
async function chargerAdherents() {
  const corps = document.getElementById("corps-tableau");

  /* Message de chargement pendant la requête */
  if (corps) {
    corps.innerHTML = `
      <tr>
        <td colspan="10" class="tableau-message">Chargement en cours…</td>
      </tr>
    `;
  }

  const { data, error } = await clientSupabase
    .from("adherents")
    .select("*");

  if (error) {
    /* Erreur réseau ou RLS : message simple sans jargon technique */
    if (corps) {
      corps.innerHTML = `
        <tr>
          <td colspan="10" class="tableau-message tableau-message--erreur" role="alert">
            Impossible de charger les adhérents. Vérifiez votre connexion et réessayez.
          </td>
        </tr>
      `;
    }
    return;
  }

  remplirTableau(data);
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

/* =====================================================
   AUTHENTIFICATION SUPABASE
   ===================================================== */

/* Client Supabase : objet JavaScript qui dialogue avec la base de données.
   Utilise les variables SUPABASE_URL et SUPABASE_KEY définies dans config.js. */
const clientSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* Références aux blocs à afficher ou masquer selon l'état de connexion */
const ecranConnexion    = document.getElementById("ecran-connexion");
const entetePrincipal   = document.querySelector("header");
const contenuPrincipal  = document.querySelector("main");
const piedDePage        = document.querySelector("footer");
const formulaireConnexion = document.getElementById("formulaire-connexion");
const zoneErreur        = document.getElementById("connexion-erreur");
const btnDeconnexion    = document.getElementById("btn-deconnexion");

/* Affiche le tableau de bord, masque l'écran de connexion, puis charge les adhérents */
function afficherTableauDeBord() {
  ecranConnexion.hidden   = true;
  entetePrincipal.hidden  = false;
  contenuPrincipal.hidden = false;
  piedDePage.hidden       = false;
  chargerAdherents();
}

/* Affiche l'écran de connexion et masque le tableau de bord */
function afficherEcranConnexion() {
  ecranConnexion.hidden   = false;
  entetePrincipal.hidden  = true;
  contenuPrincipal.hidden = true;
  piedDePage.hidden       = true;
  /* Vider le mot de passe et effacer l'éventuel message d'erreur */
  document.getElementById("connexion-mdp").value = "";
  zoneErreur.hidden      = true;
  zoneErreur.textContent = "";
}

/* Vérifie si une session Supabase est active au chargement de la page */
async function verifierSession() {
  const { data } = await clientSupabase.auth.getSession();
  if (data.session) {
    afficherTableauDeBord();
  } else {
    afficherEcranConnexion();
  }
}

/* Soumission du formulaire de connexion */
formulaireConnexion.addEventListener("submit", async function(evenement) {
  evenement.preventDefault();
  const email = document.getElementById("connexion-email").value.trim();
  const mdp   = document.getElementById("connexion-mdp").value;

  /* Masquer le message d'erreur précédent avant une nouvelle tentative */
  zoneErreur.hidden      = true;
  zoneErreur.textContent = "";

  const { error } = await clientSupabase.auth.signInWithPassword({ email, password: mdp });

  if (error) {
    /* Message d'erreur en français, sans détail technique */
    zoneErreur.textContent = "E-mail ou mot de passe incorrect.";
    zoneErreur.hidden      = false;
  } else {
    afficherTableauDeBord();
  }
});

/* Déconnexion */
btnDeconnexion.addEventListener("click", async function() {
  await clientSupabase.auth.signOut();
  afficherEcranConnexion();
});

/* ---------- INITIALISATION ---------- */
document.addEventListener("DOMContentLoaded", function() {
  verifierSession(); /* Détermine quel écran afficher et charge les données si connecté */
});
