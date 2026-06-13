/* =====================================================
   APP.JS — HSI37 Dashboard
   Phase 2.5 : Modification et suppression d'adhérents
   ===================================================== */

/* =====================================================
   SÉCURITÉ : les tables Supabase ont le RLS activé.
   Seuls les utilisateurs authentifiés (authenticated) peuvent lire/écrire.
   La clé utilisée est la clé publishable (publique), PAS la clé service_role.
   ===================================================== */

/* ---------- CONFIGURATION DES TYPES DE MEMBRES ---------- */

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
    indicateur: "●"
  },
  arenouveler: {
    libelle: "À renouveler",
    classe: "badge--arenouveler",
    indicateur: "●"
  },
  enretard: {
    libelle: "En retard",
    classe: "badge--enretard",
    indicateur: "●"
  }
};

/* ---------- CACHE DES DONNÉES SUPABASE ---------- */
/* Conserve les objets complets pour pré-remplir la modale sans requête supplémentaire */
let donneesAdherents = [];

/* ---------- ÉTAT DE LA MODALE ---------- */
/* null = mode ajout ; objet adherent = mode modification */
let adherentEnCours = null;

/* ---------- FONCTIONS D'AFFICHAGE ---------- */

/**
 * Calcule le statut de cotisation à partir de la saison de l'adhérent.
 * Retourne la clé correspondante dans statutsConfig.
 * Jamais stocké : calculé à l'affichage uniquement.
 * @param {string|number} saison - Année de la saison (ex. "2026" ou 2026)
 * @returns {string} Clé de statutsConfig : "ajour" | "arenouveler" | "enretard"
 */
function calculerStatut(saison) {
  const annee = new Date().getFullYear();
  const s = parseInt(saison, 10);
  if (isNaN(s) || s >= annee) return "ajour";
  if (s === annee - 1) return "arenouveler";
  return "enretard";
}

/**
 * Formate une date ISO (AAAA-MM-JJ) en format français (JJ/MM/AAAA).
 * @param {string} dateIso
 * @returns {string}
 */
function formaterDate(dateIso) {
  if (!dateIso) return "—";
  const [annee, mois, jour] = dateIso.split("-");
  return `${jour}/${mois}/${annee}`;
}

/**
 * Génère le HTML d'une cellule "Type de membre" avec son infobulle.
 * Accepte la clé courte ("actif") ou le libellé complet ("Membre actif").
 * @param {string} valeur
 * @returns {string}
 */
function genererCelluleType(valeur) {
  let type = typesMembres[valeur];
  if (!type) {
    const entree = Object.entries(typesMembres).find(function([, t]) {
      return t.libelle === valeur;
    });
    if (entree) type = entree[1];
  }
  if (!type) return valeur || "—";

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
 * @param {string} cle
 * @returns {string}
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
 * Génère les boutons d'action (modifier, supprimer).
 * data-id-technique porte l'UUID Supabase pour la délégation d'événements.
 * @param {string} idAdherent  - Identifiant affiché (HSI-AAAA-NNNN)
 * @param {string} idTechnique - UUID Supabase (clé primaire)
 * @returns {string}
 */
function genererBoutonsActions(idAdherent, idTechnique, statutCle) {
  const btnRelance = (statutCle === 'arenouveler' || statutCle === 'enretard') ? `
    <button class="btn-icone btn-icone--relance"
            aria-label="Relance de cotisation ${idAdherent}"
            title="Relance de cotisation"
            type="button"
            data-id-technique="${idTechnique}">
      <svg aria-hidden="true" focusable="false"
           xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           width="17" height="17">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
              stroke="currentColor" stroke-width="2" fill="none"/>
        <polyline points="22,6 12,13 2,6" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
    </button>
  ` : '';

  return `
    <button class="btn-icone btn-icone--modifier"
            aria-label="Modifier l'adhérent ${idAdherent}"
            title="Modifier"
            type="button"
            data-id-technique="${idTechnique}">
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
            aria-label="Supprimer l'adhérent ${idAdherent}"
            title="Supprimer"
            type="button"
            data-id-technique="${idTechnique}">
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
    <button class="btn-icone btn-icone--carte"
            aria-label="Générer la carte d'adhérent ${idAdherent}"
            title="Générer la carte"
            type="button"
            data-id-technique="${idTechnique}">
      <svg aria-hidden="true" focusable="false"
           xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           width="17" height="17">
        <rect x="2" y="5" width="20" height="14" rx="2"
              stroke="currentColor" stroke-width="2" fill="none"/>
        <line x1="2" y1="10" x2="22" y2="10"
              stroke="currentColor" stroke-width="2"/>
        <line x1="6" y1="15" x2="10" y2="15"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="btn-icone btn-icone--recu-adh"
            aria-label="Générer le reçu d'adhésion ${idAdherent}"
            title="Reçu d'adhésion"
            type="button"
            data-id-technique="${idTechnique}">
      <svg aria-hidden="true" focusable="false"
           xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           width="17" height="17">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <polyline points="14 2 14 8 20 8"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <line x1="16" y1="13" x2="8" y2="13"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="16" y1="17" x2="8" y2="17"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <polyline points="10 9 9 9 8 9"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="btn-icone btn-icone--attestation"
            aria-label="Attestation d'adhésion ${idAdherent}"
            title="Attestation d'adhésion"
            type="button"
            data-id-technique="${idTechnique}">
      <svg aria-hidden="true" focusable="false"
           xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           width="17" height="17">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <polyline points="14 2 14 8 20 8"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <polyline points="9 15 11 17 15 13"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    ${btnRelance}
  `.trim();
}

/**
 * Injecte les lignes du tableau et met à jour le cache donneesAdherents.
 * @param {Array} adherents
 */
function remplirTableau(adherents) {
  const corps = document.getElementById("corps-tableau");
  if (!corps) return;

  /* Mettre à jour le cache local utilisé par les boutons d'action */
  donneesAdherents = adherents || [];

  corps.innerHTML = "";

  if (!adherents || adherents.length === 0) {
    corps.innerHTML = `
      <tr>
        <td colspan="11" class="tableau-message">
          Aucun adhérent enregistré pour l'instant.
        </td>
      </tr>
    `;
    return;
  }

  adherents.forEach(function(adherent) {
    const ligne = document.createElement("tr");

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
      <td>${adherent.mode_paiement || "—"}</td>
      <td>${genererBadge(calculerStatut(adherent.saison))}</td>
      <td class="col-actions">${genererBoutonsActions(adherent.id_adherent || adherent.id, adherent.id, calculerStatut(adherent.saison))}</td>
    `;

    corps.appendChild(ligne);
  });
}

/**
 * Lit tous les adhérents depuis Supabase et met à jour le tableau.
 */
async function chargerAdherents() {
  const corps = document.getElementById("corps-tableau");

  if (corps) {
    corps.innerHTML = `
      <tr>
        <td colspan="11" class="tableau-message">Chargement en cours…</td>
      </tr>
    `;
  }

  const { data, error } = await clientSupabase
    .from("adherents")
    .select("*");

  if (error) {
    if (corps) {
      corps.innerHTML = `
        <tr>
          <td colspan="11" class="tableau-message tableau-message--erreur" role="alert">
            Impossible de charger les adhérents. Vérifiez votre connexion et réessayez.
          </td>
        </tr>
      `;
    }
    return;
  }

  remplirTableau(data);
}

/* =====================================================
   GESTION DE LA MODALE (MODE AJOUT ET MODIFICATION)
   ===================================================== */

const fond     = document.getElementById("modale-fond");
const modale   = document.getElementById("modale-adherent");
const btnOuvrir  = document.getElementById("btn-ajouter");
const btnFermer  = document.getElementById("btn-fermer-modale");
const btnAnnuler = document.getElementById("btn-annuler-modale");
const formulaire = document.getElementById("formulaire-adherent");

let elementAvantModale = null;

/* Cache éphémère des champs chèque adhérents (form-only, non persistés en DB) */
const champsChequesAdherents = new Map();

/**
 * Affiche / masque les champs chèque selon le mode de paiement sélectionné (adhérent).
 */
function majChampsConditionnelsAdherent() {
  const mode = document.getElementById("champ-mode-paiement").value;
  document.getElementById("groupe-cheque-adh").hidden = (mode !== "Chèque");

  const type        = document.getElementById("champ-type").value;
  const valDon      = parseFloat(document.getElementById("champ-montant-don").value) || 0;
  const typeDonneur = (type === "Membre actif" || type === "Membre bienfaiteur");
  /* Afficher si type compatible, ou si une valeur > 0 existe déjà (mode modification) */
  document.getElementById("groupe-don-adherent").hidden = !typeDonneur && valDon <= 0;
}

document.getElementById("champ-mode-paiement").addEventListener("change", majChampsConditionnelsAdherent);
document.getElementById("champ-type").addEventListener("change", majChampsConditionnelsAdherent);

/**
 * Efface les erreurs de validation du formulaire.
 */
function reinitialiserErreursFormulaire() {
  const zoneErreurModale = document.getElementById("modale-erreur");
  if (zoneErreurModale) {
    zoneErreurModale.hidden = true;
    zoneErreurModale.textContent = "";
  }
  document.querySelectorAll(".champ-erreur").forEach(function(el) { el.remove(); });
  document.querySelectorAll(".champ-input--erreur").forEach(function(el) {
    el.classList.remove("champ-input--erreur");
  });
}

/**
 * Ouvre la modale en mode AJOUT : formulaire vide, champ ID masqué.
 */
function ouvrirModaleAjout() {
  adherentEnCours = null;
  elementAvantModale = document.activeElement;

  formulaire.reset();
  reinitialiserErreursFormulaire();
  majChampsConditionnelsAdherent();

  document.getElementById("groupe-id-adherent").hidden = true;
  document.getElementById("modale-titre").textContent = "Ajouter un adhérent";
  document.querySelector("#formulaire-adherent [type='submit']").textContent = "Enregistrer";
  document.getElementById("btn-fermer-modale").setAttribute("aria-label", "Fermer la fenêtre d'ajout d'adhérent");

  fond.hidden = false;
  requestAnimationFrame(function() { modale.focus(); });
  document.addEventListener("keydown", gererToucheClavier);
}

/**
 * Ouvre la modale en mode MODIFICATION : champs pré-remplis, ID affiché en lecture seule.
 * @param {Object} adherent - Objet complet de l'adhérent à modifier
 */
function ouvrirModaleModification(adherent) {
  adherentEnCours = adherent;
  elementAvantModale = document.activeElement;

  formulaire.reset();
  reinitialiserErreursFormulaire();

  /* Afficher et remplir le champ ID en lecture seule */
  document.getElementById("groupe-id-adherent").hidden = false;
  document.getElementById("champ-id-adherent").value = adherent.id_adherent || "";

  /* Pré-remplir les champs modifiables */
  document.getElementById("champ-civilite").value  = adherent.civilite || "";
  document.getElementById("champ-nom").value       = adherent.nom || "";
  document.getElementById("champ-prenom").value    = adherent.prenom || "";
  document.getElementById("champ-email").value     = adherent.email || "";
  document.getElementById("champ-telephone").value = adherent.telephone || "";
  document.getElementById("champ-adresse").value   = adherent.adresse || "";
  if (adherent.date_adhesion) {
    const [a, m, j] = adherent.date_adhesion.split("-");
    document.getElementById("champ-date-annee").value = a || "";
    document.getElementById("champ-date-mois").value  = m || "";
    document.getElementById("champ-date-jour").value  = j || "";
  } else {
    document.getElementById("champ-date-annee").value = "";
    document.getElementById("champ-date-mois").value  = "";
    document.getElementById("champ-date-jour").value  = "";
  }
  document.getElementById("champ-type").value      = adherent.type_membre || "";
  document.getElementById("champ-montant").value   =
    (adherent.montant_cotisation !== null && adherent.montant_cotisation !== undefined)
      ? adherent.montant_cotisation
      : "";
  document.getElementById("champ-mode-paiement").value = adherent.mode_paiement || "";
  document.getElementById("champ-montant-don").value =
    (adherent.montant_don !== null && adherent.montant_don !== undefined)
      ? adherent.montant_don : "";

  const chequeAdh = champsChequesAdherents.get(String(adherent.id)) || {};
  document.getElementById("champ-numero-cheque").value = chequeAdh.numero_cheque || "";
  document.getElementById("champ-banque-adh").value    = chequeAdh.banque        || "";
  majChampsConditionnelsAdherent();

  document.getElementById("modale-titre").textContent = "Modifier un adhérent";
  document.querySelector("#formulaire-adherent [type='submit']").textContent = "Enregistrer les modifications";
  document.getElementById("btn-fermer-modale").setAttribute("aria-label", "Fermer la fenêtre de modification d'adhérent");

  fond.hidden = false;
  requestAnimationFrame(function() { modale.focus(); });
  document.addEventListener("keydown", gererToucheClavier);
}

/**
 * Ferme la modale et remet l'état à "ajout" pour la prochaine ouverture.
 */
function fermerModale() {
  fond.hidden = true;
  adherentEnCours = null;
  document.getElementById("groupe-id-adherent").hidden = true;
  document.removeEventListener("keydown", gererToucheClavier);
  if (elementAvantModale) elementAvantModale.focus();
}

/**
 * Focus trap dans la modale, fermeture par Échap.
 * @param {KeyboardEvent} evenement
 */
function gererToucheClavier(evenement) {
  if (evenement.key === "Escape") {
    fermerModale();
    return;
  }

  if (evenement.key === "Tab") {
    const elementsFocusables = modale.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const premier = elementsFocusables[0];
    const dernier = elementsFocusables[elementsFocusables.length - 1];

    if (evenement.shiftKey) {
      if (document.activeElement === premier) {
        evenement.preventDefault();
        dernier.focus();
      }
    } else {
      if (document.activeElement === dernier) {
        evenement.preventDefault();
        premier.focus();
      }
    }
  }
}

/**
 * Ferme la modale si le clic est sur le fond semi-transparent.
 */
function gererClicFond(evenement) {
  if (evenement.target === fond) fermerModale();
}

btnOuvrir.addEventListener("click", ouvrirModaleAjout);
btnFermer.addEventListener("click", fermerModale);
btnAnnuler.addEventListener("click", fermerModale);
fond.addEventListener("click", gererClicFond);

/* =====================================================
   VALIDATION ET ENREGISTREMENT (AJOUT ET MODIFICATION)
   ===================================================== */

/**
 * Marque un champ en erreur et affiche le message sous le champ.
 * @param {string} idChamp
 * @param {string} message
 */
function marquerChampErreur(idChamp, message) {
  const champ = document.getElementById(idChamp);
  champ.classList.add("champ-input--erreur");
  const msgErreur = document.createElement("span");
  msgErreur.className = "champ-erreur";
  msgErreur.setAttribute("role", "alert");
  msgErreur.textContent = message;
  champ.parentNode.appendChild(msgErreur);
}

/**
 * Valide le formulaire (modes ajout et modification).
 * @returns {boolean}
 */
function validerFormulaire() {
  document.querySelectorAll(".champ-erreur").forEach(function(el) { el.remove(); });
  document.querySelectorAll(".champ-input--erreur").forEach(function(el) {
    el.classList.remove("champ-input--erreur");
  });

  let valide = true;

  const nom     = document.getElementById("champ-nom").value.trim();
  const prenom  = document.getElementById("champ-prenom").value.trim();
  const email   = document.getElementById("champ-email").value.trim();
  const jour    = document.getElementById("champ-date-jour").value;
  const mois    = document.getElementById("champ-date-mois").value;
  const annee   = document.getElementById("champ-date-annee").value;
  const type    = document.getElementById("champ-type").value;
  const montant = document.getElementById("champ-montant").value.trim();

  if (!nom) {
    marquerChampErreur("champ-nom", "Le nom est obligatoire.");
    valide = false;
  }
  if (!prenom) {
    marquerChampErreur("champ-prenom", "Le prénom est obligatoire.");
    valide = false;
  }

  /* Validation date : les trois menus doivent être renseignés et former une date réelle */
  if (!jour || !mois || !annee) {
    if (!jour)  document.getElementById("champ-date-jour").classList.add("champ-input--erreur");
    if (!mois)  document.getElementById("champ-date-mois").classList.add("champ-input--erreur");
    if (!annee) document.getElementById("champ-date-annee").classList.add("champ-input--erreur");
    const errDate = document.createElement("span");
    errDate.className = "champ-erreur";
    errDate.setAttribute("role", "alert");
    errDate.textContent = "La date d'adhésion est obligatoire (jour, mois et année requis).";
    const conteneur = document.querySelector(".date-adhesion__conteneur");
    conteneur.parentNode.insertBefore(errDate, conteneur.nextSibling);
    valide = false;
  } else {
    /* Vérifier que la combinaison jour/mois/année correspond à une date réelle */
    const dateTest = new Date(`${annee}-${mois}-${jour}`);
    const dateValide = !isNaN(dateTest.getTime()) &&
      dateTest.getFullYear() === parseInt(annee, 10) &&
      (dateTest.getMonth() + 1) === parseInt(mois, 10) &&
      dateTest.getDate() === parseInt(jour, 10);
    if (!dateValide) {
      ["champ-date-jour", "champ-date-mois", "champ-date-annee"].forEach(function(id) {
        document.getElementById(id).classList.add("champ-input--erreur");
      });
      const errDate = document.createElement("span");
      errDate.className = "champ-erreur";
      errDate.setAttribute("role", "alert");
      errDate.textContent = "Cette date n'existe pas (ex. le 31 février est invalide).";
      const conteneur = document.querySelector(".date-adhesion__conteneur");
      conteneur.parentNode.insertBefore(errDate, conteneur.nextSibling);
      valide = false;
    }
  }

  if (!type) {
    marquerChampErreur("champ-type", "Le type de membre est obligatoire.");
    valide = false;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    marquerChampErreur("champ-email", "L'adresse e-mail n'est pas valide.");
    valide = false;
  }
  if (montant && isNaN(parseFloat(montant.replace(",", ".")))) {
    marquerChampErreur("champ-montant", "Le montant doit être un nombre (ex : 20 ou 20,50).");
    valide = false;
  }

  return valide;
}

/**
 * Génère le prochain id_adherent pour une saison donnée.
 * @param {string} annee
 * @returns {Promise<string>}
 */
async function genererIdAdherent(annee) {
  const { data, error } = await clientSupabase
    .from("adherents")
    .select("id_adherent")
    .eq("saison", annee);

  if (error) throw new Error("Lecture Supabase échouée");

  let maxNumero = 0;

  if (data && data.length > 0) {
    data.forEach(function(adherent) {
      if (adherent.id_adherent) {
        const parties = adherent.id_adherent.split("-");
        if (parties.length === 3) {
          const numero = parseInt(parties[2], 10);
          if (!isNaN(numero) && numero > maxNumero) maxNumero = numero;
        }
      }
    });
  }

  return `HSI-${annee}-${String(maxNumero + 1).padStart(4, "0")}`;
}

/**
 * Affiche un bandeau de succès au-dessus du tableau (5 secondes).
 * @param {string} texte
 */
function afficherMessageSucces(texte) {
  const zone = document.getElementById("message-succes");
  zone.textContent = texte;
  zone.hidden = false;
  setTimeout(function() {
    zone.hidden = true;
    zone.textContent = "";
  }, 5000);
}

/**
 * Affiche un bandeau d'erreur au-dessus du tableau (7 secondes).
 * @param {string} texte
 */
function afficherMessageErreur(texte) {
  const zone = document.getElementById("message-erreur");
  zone.textContent = texte;
  zone.hidden = false;
  setTimeout(function() {
    zone.hidden = true;
    zone.textContent = "";
  }, 7000);
}

/* Soumission du formulaire : bifurque entre INSERT (ajout) et UPDATE (modification) */
formulaire.addEventListener("submit", async function(evenement) {
  evenement.preventDefault();

  const zoneErreurModale = document.getElementById("modale-erreur");
  zoneErreurModale.hidden = true;
  zoneErreurModale.textContent = "";

  if (!validerFormulaire()) return;

  const nom               = document.getElementById("champ-nom").value.trim();
  const prenom            = document.getElementById("champ-prenom").value.trim();
  const email             = document.getElementById("champ-email").value.trim() || null;
  const telephone         = document.getElementById("champ-telephone").value.trim() || null;
  const adresse           = document.getElementById("champ-adresse").value.trim() || null;
  const jourSaisi         = document.getElementById("champ-date-jour").value;
  const moisSaisi         = document.getElementById("champ-date-mois").value;
  const anneeSaisie       = document.getElementById("champ-date-annee").value;
  const dateAdhesion      = `${anneeSaisie}-${moisSaisi}-${jourSaisi}`;
  const typeMembre        = document.getElementById("champ-type").value;
  const montantBrut       = document.getElementById("champ-montant").value.trim();
  const montantCotisation = montantBrut ? parseFloat(montantBrut.replace(",", ".")) : null;
  const montantDonBrut    = document.getElementById("champ-montant-don").value.trim();
  const montantDon        = montantDonBrut ? parseFloat(montantDonBrut.replace(",", ".")) : null;
  const civilite          = document.getElementById("champ-civilite").value || null;
  const modePaiement      = document.getElementById("champ-mode-paiement").value || null;
  const numeroCheque      = document.getElementById("champ-numero-cheque").value.trim() || null;
  const banqueAdh         = document.getElementById("champ-banque-adh").value.trim() || null;

  if (adherentEnCours) {
    /* ---- MODE MODIFICATION : UPDATE Supabase ---- */
    const { error } = await clientSupabase
      .from("adherents")
      .update({
        nom,
        prenom,
        email,
        telephone,
        adresse,
        date_adhesion:      dateAdhesion,
        montant_cotisation: montantCotisation,
        montant_don:        montantDon,
        type_membre:        typeMembre,
        civilite,
        mode_paiement:      modePaiement
      })
      .eq("id", adherentEnCours.id);

    if (error) {
      zoneErreurModale.textContent = "La modification a échoué. Vérifiez votre connexion et réessayez.";
      zoneErreurModale.hidden = false;
      return;
    }

    if (modePaiement === "Chèque") {
      champsChequesAdherents.set(String(adherentEnCours.id), { numero_cheque: numeroCheque, banque: banqueAdh });
    } else {
      champsChequesAdherents.delete(String(adherentEnCours.id));
    }

    fermerModale();
    await chargerAdherents();
    afficherMessageSucces(`Adhérent modifié : ${prenom} ${nom}.`);

  } else {
    /* ---- MODE AJOUT : INSERT Supabase ---- */
    const saison = anneeSaisie;

    let idAdherent;
    try {
      idAdherent = await genererIdAdherent(saison);
    } catch (_) {
      zoneErreurModale.textContent = "Impossible de générer l'identifiant. Vérifiez votre connexion et réessayez.";
      zoneErreurModale.hidden = false;
      return;
    }

    const nouvelAdherent = {
      id_adherent:        idAdherent,
      nom,
      prenom,
      civilite,
      email,
      telephone,
      adresse,
      date_adhesion:      dateAdhesion,
      montant_cotisation: montantCotisation,
      montant_don:        montantDon,
      type_membre:        typeMembre,
      mode_paiement:      modePaiement,
      saison
    };

    const { error } = await clientSupabase
      .from("adherents")
      .insert([nouvelAdherent]);

    if (error) {
      zoneErreurModale.textContent = "L'enregistrement a échoué. Vérifiez votre connexion et réessayez.";
      zoneErreurModale.hidden = false;
      return;
    }

    fermerModale();
    await chargerAdherents();

    if (modePaiement === "Chèque") {
      const nouvelAdherentEnCache = donneesAdherents.find(function(a) { return a.id_adherent === idAdherent; });
      if (nouvelAdherentEnCache) {
        champsChequesAdherents.set(String(nouvelAdherentEnCache.id), { numero_cheque: numeroCheque, banque: banqueAdh });
      }
    }

    afficherMessageSucces(`Adhérent ajouté : ${prenom} ${nom} (${idAdherent}).`);
  }
});

/* =====================================================
   DÉLÉGATION DES CLICS SUR LE TABLEAU
   Branché une seule fois ; retrouve l'adhérent via data-id-technique et donneesAdherents.
   ===================================================== */

document.getElementById("corps-tableau").addEventListener("click", function(evenement) {
  /* closest() remonte l'arbre DOM même si le clic a touché le SVG interne */
  const btnModifier    = evenement.target.closest(".btn-icone--modifier");
  const btnSupprimer   = evenement.target.closest(".btn-icone--supprimer");
  const btnCarte       = evenement.target.closest(".btn-icone--carte");
  const btnRecuAdh     = evenement.target.closest(".btn-icone--recu-adh");
  const btnAttestation = evenement.target.closest(".btn-icone--attestation");
  const btnRelance     = evenement.target.closest(".btn-icone--relance");

  if (btnModifier) {
    const idTechnique = btnModifier.dataset.idTechnique;
    const adherent = donneesAdherents.find(function(a) { return String(a.id) === idTechnique; });
    if (adherent) ouvrirModaleModification(adherent);
  }

  if (btnSupprimer) {
    const idTechnique = btnSupprimer.dataset.idTechnique;
    const adherent = donneesAdherents.find(function(a) { return String(a.id) === idTechnique; });
    if (adherent) ouvrirConfirmationSuppression(adherent);
  }

  if (btnCarte) {
    const idTechnique = btnCarte.dataset.idTechnique;
    const adherent = donneesAdherents.find(function(a) { return String(a.id) === idTechnique; });
    if (adherent) ouvrirModaleCarte(adherent);
  }

  if (btnRecuAdh) {
    const idTechnique = btnRecuAdh.dataset.idTechnique;
    const adherent = donneesAdherents.find(function(a) { return String(a.id) === idTechnique; });
    if (adherent) ouvrirModaleRecuAdherent(adherent);
  }

  if (btnAttestation) {
    const idTechnique = btnAttestation.dataset.idTechnique;
    const adherent = donneesAdherents.find(function(a) { return String(a.id) === idTechnique; });
    if (adherent) ouvrirModaleAttestation(adherent);
  }

  if (btnRelance) {
    const idTechnique = btnRelance.dataset.idTechnique;
    const adherent = donneesAdherents.find(function(a) { return String(a.id) === idTechnique; });
    if (adherent) ouvrirModaleRelance(adherent);
  }
});

/* =====================================================
   CONFIRMATION DE SUPPRESSION
   ===================================================== */

const confirmationFond   = document.getElementById("confirmation-fond");
const modaleConfirmation = document.getElementById("modale-confirmation");
let adherentASupprimer      = null;
let elementAvantConfirmation = null;

/**
 * Ouvre la fenêtre de confirmation avec le nom et l'ID de l'adhérent concerné.
 * @param {Object} adherent
 */
function ouvrirConfirmationSuppression(adherent) {
  adherentASupprimer = adherent;
  elementAvantConfirmation = document.activeElement;

  document.getElementById("confirmation-adherent-info").textContent =
    `${adherent.prenom || ""} ${adherent.nom || ""} — ${adherent.id_adherent || adherent.id}`.trim();

  confirmationFond.hidden = false;
  requestAnimationFrame(function() { modaleConfirmation.focus(); });
  document.addEventListener("keydown", gererToucheConfirmation);
}

/**
 * Ferme la fenêtre de confirmation sans rien faire.
 */
function fermerConfirmation() {
  confirmationFond.hidden = true;
  adherentASupprimer = null;
  document.removeEventListener("keydown", gererToucheConfirmation);
  if (elementAvantConfirmation) elementAvantConfirmation.focus();
}

/**
 * Focus trap dans la fenêtre de confirmation, Échap = Annuler.
 * @param {KeyboardEvent} evenement
 */
function gererToucheConfirmation(evenement) {
  if (evenement.key === "Escape") {
    fermerConfirmation();
    return;
  }
  if (evenement.key === "Tab") {
    const focusables = modaleConfirmation.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const premier = focusables[0];
    const dernier  = focusables[focusables.length - 1];
    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault();
      dernier.focus();
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault();
      premier.focus();
    }
  }
}

document.getElementById("btn-annuler-confirmation").addEventListener("click", fermerConfirmation);
confirmationFond.addEventListener("click", function(evenement) {
  if (evenement.target === confirmationFond) fermerConfirmation();
});

/* Suppression confirmée : DELETE Supabase → rechargement → message succès */
document.getElementById("btn-confirmer-suppression").addEventListener("click", async function() {
  if (!adherentASupprimer) return;

  const nomComplet = `${adherentASupprimer.prenom || ""} ${adherentASupprimer.nom || ""}`.trim();

  const { error } = await clientSupabase
    .from("adherents")
    .delete()
    .eq("id", adherentASupprimer.id);

  if (error) {
    fermerConfirmation();
    afficherMessageErreur("La suppression a échoué. Vérifiez votre connexion et réessayez.");
    return;
  }

  fermerConfirmation();
  await chargerAdherents();
  afficherMessageSucces(`Adhérent supprimé : ${nomComplet}.`);
});

/* =====================================================
   AUTHENTIFICATION SUPABASE
   ===================================================== */

const clientSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ecranConnexion      = document.getElementById("ecran-connexion");
const entetePrincipal     = document.querySelector("header");
const contenuPrincipal    = document.querySelector("main");
const piedDePage          = document.querySelector("footer");
const formulaireConnexion = document.getElementById("formulaire-connexion");
const zoneErreur          = document.getElementById("connexion-erreur");
const btnDeconnexion      = document.getElementById("btn-deconnexion");

/* ---- Mot de passe oublié ---- */
const btnOubliMdp        = document.getElementById("btn-oubli-mdp");
const blocOubli          = document.getElementById("bloc-oubli");
const oubliEmailInput    = document.getElementById("oubli-email");
const oubliErreur        = document.getElementById("oubli-erreur");
const oubliSucces        = document.getElementById("oubli-succes");
const btnEnvoyerReset    = document.getElementById("btn-envoyer-reset");
const btnRetourConnexion = document.getElementById("btn-retour-connexion");
const divOubli           = document.querySelector(".connexion-oubli");

btnOubliMdp.addEventListener("click", () => {
  formulaireConnexion.hidden = true;
  divOubli.hidden            = true;
  blocOubli.hidden           = false;
  document.getElementById("connexion-titre").textContent = "Mot de passe oublié";
  oubliEmailInput.focus();
});

btnRetourConnexion.addEventListener("click", () => {
  blocOubli.hidden           = true;
  formulaireConnexion.hidden = false;
  divOubli.hidden            = false;
  document.getElementById("connexion-titre").textContent = "Connexion";
  oubliErreur.hidden         = true;
  oubliSucces.hidden         = true;
  oubliEmailInput.value      = "";
});

btnEnvoyerReset.addEventListener("click", async () => {
  const email = oubliEmailInput.value.trim();
  oubliErreur.hidden = true;
  oubliSucces.hidden = true;

  if (!email) {
    oubliErreur.textContent = "Veuillez saisir votre adresse e-mail.";
    oubliErreur.hidden = false;
    oubliEmailInput.focus();
    return;
  }

  btnEnvoyerReset.disabled    = true;
  btnEnvoyerReset.textContent = "Envoi en cours…";

  const { error } = await clientSupabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://hsi37-dashboard.pages.dev/reset-password.html"
  });

  btnEnvoyerReset.disabled    = false;
  btnEnvoyerReset.textContent = "Envoyer le lien";

  if (error) {
    oubliErreur.textContent = "Erreur : " + error.message;
    oubliErreur.hidden = false;
  } else {
    oubliSucces.textContent = `Un e-mail a été envoyé à ${email}. Vérifiez également vos spams.`;
    oubliSucces.hidden = false;
    oubliEmailInput.value = "";
  }
});

/* ---- Éléments hub ---- */
const hubAccueil        = document.getElementById("hub-accueil");
const navOnglets        = document.getElementById("nav-onglets");
const btnRetourAccueil  = document.getElementById("btn-retour-accueil");
const sectionDocuments  = document.getElementById("section-documents");
const sectionSignatures = document.getElementById("section-signatures");
const sectionRgpd       = document.getElementById("section-rgpd");

/* Affiche le hub : masque tout sauf le hub */
function afficherHub() {
  hubAccueil.hidden        = false;
  navOnglets.hidden        = true;
  document.getElementById("panneau-adherents").hidden = true;
  document.getElementById("panneau-donateurs").hidden = true;
  sectionDocuments.hidden  = true;
  sectionSignatures.hidden = true;
  sectionRgpd.hidden       = true;
  btnRetourAccueil.hidden  = true;
}

/* Navigue vers une section depuis le hub */
function allerVers(vue) {
  hubAccueil.hidden        = true;
  btnRetourAccueil.hidden  = false;
  sectionDocuments.hidden  = true;
  sectionSignatures.hidden = true;
  sectionRgpd.hidden       = true;

  if (vue === "adherents") {
    navOnglets.hidden = false;
    activerOnglet("panneau-adherents");
    chargerAdherents();
  } else if (vue === "donateurs") {
    navOnglets.hidden = false;
    activerOnglet("panneau-donateurs");
    chargerDonateurs();
  } else if (vue === "documents") {
    navOnglets.hidden = true;
    document.getElementById("panneau-adherents").hidden = true;
    document.getElementById("panneau-donateurs").hidden = true;
    sectionDocuments.hidden = false;
  } else if (vue === "signatures") {
    navOnglets.hidden = true;
    document.getElementById("panneau-adherents").hidden = true;
    document.getElementById("panneau-donateurs").hidden = true;
    sectionSignatures.hidden = false;
  } else if (vue === "rgpd") {
    navOnglets.hidden = true;
    document.getElementById("panneau-adherents").hidden = true;
    document.getElementById("panneau-donateurs").hidden = true;
    sectionRgpd.hidden = false;
  }
}

function afficherTableauDeBord() {
  ecranConnexion.hidden   = true;
  entetePrincipal.hidden  = false;
  contenuPrincipal.hidden = false;
  piedDePage.hidden       = false;
  afficherHub();
}

function afficherEcranConnexion() {
  ecranConnexion.hidden   = false;
  entetePrincipal.hidden  = true;
  contenuPrincipal.hidden = true;
  piedDePage.hidden       = true;
  document.getElementById("connexion-mdp").value = "";
  zoneErreur.hidden      = true;
  zoneErreur.textContent = "";
}

async function verifierSession() {
  const { data } = await clientSupabase.auth.getSession();
  if (data.session) {
    afficherTableauDeBord();
  } else {
    afficherEcranConnexion();
  }
}

formulaireConnexion.addEventListener("submit", async function(evenement) {
  evenement.preventDefault();
  const email = document.getElementById("connexion-email").value.trim();
  const mdp   = document.getElementById("connexion-mdp").value;

  zoneErreur.hidden      = true;
  zoneErreur.textContent = "";

  const { error } = await clientSupabase.auth.signInWithPassword({ email, password: mdp });

  if (error) {
    zoneErreur.textContent = "E-mail ou mot de passe incorrect.";
    zoneErreur.hidden      = false;
  } else {
    afficherTableauDeBord();
  }
});

btnDeconnexion.addEventListener("click", async function() {
  await clientSupabase.auth.signOut();
  afficherEcranConnexion();
});

/* =====================================================
   INITIALISATION DES MENUS DÉROULANTS DE DATE
   ===================================================== */

/**
 * Peuple les trois selects Jour / Mois / Année du formulaire.
 * À appeler une seule fois au chargement de la page.
 */
function initialiserSelectsDate() {
  const selectJour  = document.getElementById("champ-date-jour");
  const selectMois  = document.getElementById("champ-date-mois");
  const selectAnnee = document.getElementById("champ-date-annee");

  /* --- Jours : 01 à 31 --- */
  selectJour.innerHTML = '<option value="">Jour</option>';
  for (let j = 1; j <= 31; j++) {
    const opt = document.createElement("option");
    opt.value       = String(j).padStart(2, "0");
    opt.textContent = String(j);
    selectJour.appendChild(opt);
  }

  /* --- Mois : noms français, valeurs 01 à 12 --- */
  const moisFr = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  selectMois.innerHTML = '<option value="">Mois</option>';
  moisFr.forEach(function(libelle, index) {
    const opt = document.createElement("option");
    opt.value       = String(index + 1).padStart(2, "0");
    opt.textContent = libelle;
    selectMois.appendChild(opt);
  });

  /* --- Années : 2020 jusqu'à l'année en cours (dynamique) --- */
  const anneeActuelle = new Date().getFullYear();
  selectAnnee.innerHTML = '<option value="">Année</option>';
  for (let a = 2020; a <= anneeActuelle; a++) {
    const opt = document.createElement("option");
    opt.value       = String(a);
    opt.textContent = String(a);
    selectAnnee.appendChild(opt);
  }
}

/* =====================================================
   CARTE D'ADHÉRENT
   ===================================================== */

const carteFond   = document.getElementById("carte-fond");
const modaleCarte = document.getElementById("modale-carte");
let elementAvantCarte = null;

/**
 * Remplit la carte et ouvre la modale.
 * @param {Object} adherent
 */
function ouvrirModaleCarte(adherent) {
  elementAvantCarte = document.activeElement;

  document.getElementById("carte-nom-prenom").textContent =
    (`${adherent.prenom || ""} ${adherent.nom || ""}`).trim() || "—";
  document.getElementById("carte-id").textContent =
    adherent.id_adherent || "—";
  document.getElementById("carte-type").textContent =
    adherent.type_membre || "—";
  document.getElementById("carte-saison").textContent =
    adherent.saison || "—";

  /* Génération du QR code pointant vers hsi37.fr */
  const zoneQr = document.getElementById("carte-qr");
  zoneQr.innerHTML = "";
  new QRCode(zoneQr, {
    text:         "https://hsi37.fr",
    width:        60,
    height:       60,
    colorDark:    "#000000",
    colorLight:   "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  carteFond.hidden = false;
  requestAnimationFrame(function() { modaleCarte.focus(); });
  document.addEventListener("keydown", gererToucheCarte);
}

/**
 * Ferme la modale carte et restitue le focus.
 */
function fermerModaleCarte() {
  carteFond.hidden = true;
  document.getElementById("carte-qr").innerHTML = "";
  document.removeEventListener("keydown", gererToucheCarte);
  if (elementAvantCarte) elementAvantCarte.focus();
}

/**
 * Focus trap dans la modale carte, Échap = fermer.
 * @param {KeyboardEvent} evenement
 */
function gererToucheCarte(evenement) {
  if (evenement.key === "Escape") {
    fermerModaleCarte();
    return;
  }
  if (evenement.key === "Tab") {
    const focusables = modaleCarte.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const premier = focusables[0];
    const dernier  = focusables[focusables.length - 1];
    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault();
      dernier.focus();
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault();
      premier.focus();
    }
  }
}

document.getElementById("btn-fermer-carte").addEventListener("click", fermerModaleCarte);
document.getElementById("btn-fermer-carte-bas").addEventListener("click", fermerModaleCarte);
carteFond.addEventListener("click", function(evenement) {
  if (evenement.target === carteFond) fermerModaleCarte();
});

/**
 * Charge une image depuis une URL relative et la retourne en data URL base64.
 * Contourne le blocage XHR de html2canvas sur les serveurs locaux sans CORS.
 * @param {string} src - Chemin relatif (ex. "assets/logo.png")
 * @returns {Promise<string>} - data URL ou src original en cas d'échec
 */
function chargerImageCommeDataUrl(src) {
  return new Promise(function(resolve) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", src, true);
    xhr.responseType = "blob";
    xhr.onload = function() {
      const reader = new FileReader();
      reader.onloadend = function() { resolve(reader.result); };
      reader.readAsDataURL(xhr.response);
    };
    xhr.onerror = function() { resolve(src); };
    xhr.send();
  });
}

/**
 * Capture la carte via html2canvas et déclenche le téléchargement PNG.
 * Le logo est converti en data URL avant la capture pour éviter SecurityError
 * sur les serveurs locaux qui n'envoient pas d'en-tête CORS.
 */
document.getElementById("btn-telecharger-carte").addEventListener("click", function() {
  const carte          = document.getElementById("carte-adherent");
  const imgLogo        = carte.querySelector(".carte__logo");
  const idAdherent     = document.getElementById("carte-id").textContent.trim();
  const nomFichier     = `carte-adherent-${idAdherent || "HSI37"}.png`;
  const btnTelecharger = this;

  btnTelecharger.disabled = true;
  btnTelecharger.textContent = "Génération…";

  const srcOriginal = imgLogo.src;

  chargerImageCommeDataUrl("assets/hsi37-redim-demi.png").then(function(dataUrl) {
    imgLogo.src = dataUrl;
    return new Promise(function(resolve) {
      imgLogo.onload = resolve;
      imgLogo.onerror = resolve;
    });
  }).then(function() {
    return html2canvas(carte, {
      scale: 2,
      useCORS: false,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false
    });
  }).then(function(canvas) {
    const lien = document.createElement("a");
    lien.download = nomFichier;
    lien.href     = canvas.toDataURL("image/png");
    lien.click();
  }).finally(function() {
    imgLogo.src = srcOriginal;
    btnTelecharger.disabled = false;
    btnTelecharger.innerHTML = `
      <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 24 24" width="16" height="16">
        <path d="M12 15V3M12 15l-4-4M12 15l4-4M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
      Télécharger la carte
    `.trim();
  });
});

/* =====================================================
   NAVIGATION PAR ONGLETS
   ===================================================== */

/**
 * Active l'onglet et le panneau correspondant, masque l'autre.
 * @param {string} idPanneau - "panneau-adherents" | "panneau-donateurs"
 */
function activerOnglet(idPanneau) {
  const config = {
    "panneau-adherents": "onglet-adherents",
    "panneau-donateurs": "onglet-donateurs"
  };

  Object.keys(config).forEach(function(id) {
    const panneau  = document.getElementById(id);
    const onglet   = document.getElementById(config[id]);
    const estActif = id === idPanneau;
    panneau.hidden = !estActif;
    onglet.setAttribute("aria-selected", estActif ? "true" : "false");
    onglet.classList.toggle("onglet--actif", estActif);
  });
}

document.getElementById("onglet-adherents").addEventListener("click", function() {
  activerOnglet("panneau-adherents");
});
document.getElementById("onglet-donateurs").addEventListener("click", function() {
  activerOnglet("panneau-donateurs");
  chargerDonateurs();
});

/* =====================================================
   SECTION DONATEURS — CACHE ET ÉTAT
   ===================================================== */

let donneesDonateurs      = [];
let donateurEnCours       = null;
let elementAvantModaleDon = null;

/* =====================================================
   SECTION DONATEURS — AFFICHAGE DU TABLEAU
   ===================================================== */

/**
 * Génère les boutons modifier / supprimer pour une ligne du tableau donateurs.
 * @param {string} idDonateur  - DON-AAAA-NNNN
 * @param {string} idTechnique - UUID Supabase
 * @returns {string}
 */
function genererBoutonsActionsDonateur(idDonateur, idTechnique) {
  return `
    <button class="btn-icone btn-icone--modifier btn-icone--mod-don"
            aria-label="Modifier le donateur ${idDonateur}"
            title="Modifier"
            type="button"
            data-id-technique="${idTechnique}">
      <svg aria-hidden="true" focusable="false"
           xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="17" height="17">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="btn-icone btn-icone--supprimer btn-icone--sup-don"
            aria-label="Supprimer le donateur ${idDonateur}"
            title="Supprimer"
            type="button"
            data-id-technique="${idTechnique}">
      <svg aria-hidden="true" focusable="false"
           xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="17" height="17">
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
    <button class="btn-icone btn-icone--recu-don"
            aria-label="Générer le reçu de don ${idDonateur}"
            title="Reçu de don"
            type="button"
            data-id-technique="${idTechnique}">
      <svg aria-hidden="true" focusable="false"
           xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="17" height="17">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <polyline points="14 2 14 8 20 8"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <line x1="16" y1="13" x2="8" y2="13"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="16" y1="17" x2="8" y2="17"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <polyline points="10 9 9 9 8 9"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
    </button>
  `.trim();
}

/**
 * Injecte les lignes dans le tableau des donateurs et met à jour le cache.
 * @param {Array} donateurs
 */
function remplirTableauDonateurs(donateurs) {
  const corps = document.getElementById("corps-tableau-donateurs");
  if (!corps) return;

  donneesDonateurs = donateurs || [];
  corps.innerHTML  = "";

  if (!donateurs || donateurs.length === 0) {
    corps.innerHTML = `
      <tr>
        <td colspan="9" class="tableau-message">
          Aucun donateur enregistré pour l'instant.
        </td>
      </tr>
    `;
    return;
  }

  donateurs.forEach(function(don) {
    const ligne = document.createElement("tr");

    const estDonMat = (don.type_don || "").toLowerCase().includes("mat");
    const montant = (!estDonMat && don.montant_don !== null && don.montant_don !== undefined)
      ? Number(don.montant_don).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
      : "—";

    const nomAffiche = don.nom ? don.nom.toUpperCase() : "—";
    let prenomOrgAffiche;
    if (don.prenom && don.organisme) {
      prenomOrgAffiche = `${don.prenom} — <em>${don.organisme}</em>`;
    } else if (don.prenom) {
      prenomOrgAffiche = don.prenom;
    } else if (don.organisme) {
      prenomOrgAffiche = `<em>${don.organisme}</em>`;
    } else {
      prenomOrgAffiche = "—";
    }

    ligne.innerHTML = `
      <td class="col-id">${don.id_donateur || "—"}</td>
      <td class="col-nom">${nomAffiche}</td>
      <td>${prenomOrgAffiche}</td>
      <td>${don.type_don || "—"}</td>
      <td>${montant}</td>
      <td>${don.description_don || "—"}</td>
      <td>${formaterDate(don.date_don)}</td>
      <td>${don.mode_paiement || "—"}</td>
      <td class="col-actions">${genererBoutonsActionsDonateur(don.id_donateur || don.id, don.id)}</td>
    `;
    corps.appendChild(ligne);
  });
}

/**
 * Lit tous les donateurs depuis Supabase et met à jour le tableau.
 */
async function chargerDonateurs() {
  const corps = document.getElementById("corps-tableau-donateurs");
  if (corps) {
    corps.innerHTML = `
      <tr><td colspan="9" class="tableau-message">Chargement en cours…</td></tr>
    `;
  }

  const { data, error } = await clientSupabase.from("donateurs").select("*");

  if (error) {
    if (corps) {
      corps.innerHTML = `
        <tr>
          <td colspan="9" class="tableau-message tableau-message--erreur" role="alert">
            Impossible de charger les donateurs. Vérifiez votre connexion et réessayez.
          </td>
        </tr>
      `;
    }
    return;
  }

  remplirTableauDonateurs(data);
}

/* =====================================================
   SECTION DONATEURS — CHAMPS CONDITIONNELS
   ===================================================== */

/**
 * Affiche / masque montant, mode de paiement et description selon le type de don.
 * Gère aussi les champs chèque conditionnels.
 */
function majCiviliteVisibiliteDon() {
  const organisme = document.getElementById("don-organisme").value.trim();
  document.getElementById("groupe-civilite-don").hidden = organisme.length > 0;

  const avertissement = document.getElementById("avertissement-don-organisme");
  if (avertissement) {
    const civilite = document.getElementById("don-civilite").value.trim();
    const nom      = document.getElementById("don-nom").value.trim();
    const prenom   = document.getElementById("don-prenom").value.trim();
    avertissement.hidden = !(organisme && (civilite || nom || prenom));
  }
}

document.getElementById("don-organisme").addEventListener("input", majCiviliteVisibiliteDon);
document.getElementById("don-nom").addEventListener("input", majCiviliteVisibiliteDon);
document.getElementById("don-prenom").addEventListener("input", majCiviliteVisibiliteDon);

function majChampsConditionnelsDon() {
  const type         = document.getElementById("don-type").value;
  const typeLower    = type.toLowerCase();
  const estFinancier = typeLower.includes("financier");
  const estMateriel  = typeLower.includes("mat");

  document.getElementById("groupe-don-montant").hidden     = !estFinancier;
  document.getElementById("groupe-don-mode").hidden        = !estFinancier;
  document.getElementById("groupe-don-description").hidden = !estMateriel;

  if (estMateriel) {
    document.getElementById("don-montant").value = "";
    document.getElementById("don-mode").value    = "";
  }
  if (estFinancier) {
    document.getElementById("don-description").value = "";
  }

  majChampsChequeDon();
}

function majChampsChequeDon() {
  const mode     = document.getElementById("don-mode").value;
  const estCheque = mode === "Chèque";
  const groupeMode = document.getElementById("groupe-don-mode");
  document.getElementById("groupe-cheque-don").hidden = groupeMode.hidden || !estCheque;
}

document.getElementById("don-type").addEventListener("change", majChampsConditionnelsDon);
document.getElementById("don-mode").addEventListener("change", majChampsChequeDon);

/* =====================================================
   SECTION DONATEURS — MODALE AJOUT / MODIFICATION
   ===================================================== */

const fondDon    = document.getElementById("modale-fond-don");
const modaleDon  = document.getElementById("modale-donateur");
const formulaireDon  = document.getElementById("formulaire-donateur");

/**
 * Réinitialise les erreurs de validation du formulaire donateur.
 */
function reinitialiserErreursDon() {
  const zoneErreur = document.getElementById("modale-don-erreur");
  if (zoneErreur) { zoneErreur.hidden = true; zoneErreur.textContent = ""; }
  document.querySelectorAll("#formulaire-donateur .champ-erreur").forEach(function(el) { el.remove(); });
  document.querySelectorAll("#formulaire-donateur .champ-input--erreur").forEach(function(el) {
    el.classList.remove("champ-input--erreur");
  });
}

/**
 * Ouvre la modale en mode AJOUT : formulaire vide.
 */
function ouvrirModaleDonAjout() {
  donateurEnCours       = null;
  elementAvantModaleDon = document.activeElement;

  formulaireDon.reset();
  reinitialiserErreursDon();
  majChampsConditionnelsDon();
  majCiviliteVisibiliteDon();

  document.getElementById("groupe-id-don").hidden = true;
  document.getElementById("modale-don-titre").textContent = "Ajouter un donateur";
  document.querySelector("#formulaire-donateur [type='submit']").textContent = "Enregistrer";
  document.getElementById("btn-fermer-modale-don").setAttribute("aria-label", "Fermer la fenêtre d'ajout de donateur");

  fondDon.hidden = false;
  requestAnimationFrame(function() { modaleDon.focus(); });
  document.addEventListener("keydown", gererToucheDon);
}

/**
 * Ouvre la modale en mode MODIFICATION : champs pré-remplis.
 * @param {Object} donateur
 */
function ouvrirModaleDonModification(donateur) {
  donateurEnCours       = donateur;
  elementAvantModaleDon = document.activeElement;

  formulaireDon.reset();
  reinitialiserErreursDon();

  document.getElementById("groupe-id-don").hidden  = false;
  document.getElementById("don-id").value          = donateur.id_donateur || "";
  document.getElementById("don-civilite").value    = donateur.civilite || "";
  document.getElementById("don-nom").value         = donateur.nom || "";
  document.getElementById("don-prenom").value      = donateur.prenom || "";
  document.getElementById("don-organisme").value   = donateur.organisme || "";
  document.getElementById("don-email").value       = donateur.email || "";
  document.getElementById("don-telephone").value   = donateur.telephone || "";
  document.getElementById("don-adresse").value     = donateur.adresse || "";
  document.getElementById("don-type").value        = donateur.type_don || "";
  document.getElementById("don-montant").value     =
    (donateur.montant_don !== null && donateur.montant_don !== undefined) ? donateur.montant_don : "";
  document.getElementById("don-description").value    = donateur.description_don || "";
  document.getElementById("don-mode").value            = donateur.mode_paiement || "";
  document.getElementById("don-numero-cheque").value   = donateur.numero_cheque || "";
  document.getElementById("don-banque-cheque").value   = donateur.banque_cheque || "";

  if (donateur.date_don) {
    const [a, m, j] = donateur.date_don.split("-");
    document.getElementById("don-date-annee").value = a || "";
    document.getElementById("don-date-mois").value  = m || "";
    document.getElementById("don-date-jour").value  = j || "";
  } else {
    document.getElementById("don-date-annee").value = "";
    document.getElementById("don-date-mois").value  = "";
    document.getElementById("don-date-jour").value  = "";
  }

  majChampsConditionnelsDon();
  majCiviliteVisibiliteDon();

  document.getElementById("modale-don-titre").textContent = "Modifier un donateur";
  document.querySelector("#formulaire-donateur [type='submit']").textContent = "Enregistrer les modifications";
  document.getElementById("btn-fermer-modale-don").setAttribute("aria-label", "Fermer la fenêtre de modification de donateur");

  fondDon.hidden = false;
  requestAnimationFrame(function() { modaleDon.focus(); });
  document.addEventListener("keydown", gererToucheDon);
}

/**
 * Ferme la modale donateur et restitue le focus.
 */
function fermerModaleDon() {
  fondDon.hidden    = true;
  donateurEnCours   = null;
  document.removeEventListener("keydown", gererToucheDon);
  if (elementAvantModaleDon) elementAvantModaleDon.focus();
}

/**
 * Focus trap + Échap pour la modale donateur.
 * @param {KeyboardEvent} evenement
 */
function gererToucheDon(evenement) {
  if (evenement.key === "Escape") { fermerModaleDon(); return; }
  if (evenement.key === "Tab") {
    const focusables = modaleDon.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const premier = focusables[0];
    const dernier  = focusables[focusables.length - 1];
    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault(); dernier.focus();
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault(); premier.focus();
    }
  }
}

document.getElementById("btn-ajouter-don").addEventListener("click", ouvrirModaleDonAjout);
document.getElementById("btn-fermer-modale-don").addEventListener("click", fermerModaleDon);
document.getElementById("btn-annuler-modale-don").addEventListener("click", fermerModaleDon);
fondDon.addEventListener("click", function(ev) { if (ev.target === fondDon) fermerModaleDon(); });

/* =====================================================
   SECTION DONATEURS — VALIDATION
   ===================================================== */

/**
 * Marque un champ du formulaire donateur en erreur.
 * @param {string} idChamp
 * @param {string} message
 */
function marquerChampErreurDon(idChamp, message) {
  const champ = document.getElementById(idChamp);
  champ.classList.add("champ-input--erreur");
  const msg = document.createElement("span");
  msg.className = "champ-erreur";
  msg.setAttribute("role", "alert");
  msg.textContent = message;
  champ.parentNode.appendChild(msg);
}

/**
 * Valide le formulaire donateur.
 * @returns {boolean}
 */
function validerFormulaireDonateur() {
  document.querySelectorAll("#formulaire-donateur .champ-erreur").forEach(function(el) { el.remove(); });
  document.querySelectorAll("#formulaire-donateur .champ-input--erreur").forEach(function(el) {
    el.classList.remove("champ-input--erreur");
  });

  let valide = true;
  const nom     = document.getElementById("don-nom").value.trim();
  const type    = document.getElementById("don-type").value;
  const jour    = document.getElementById("don-date-jour").value;
  const mois    = document.getElementById("don-date-mois").value;
  const annee   = document.getElementById("don-date-annee").value;
  const montant = document.getElementById("don-montant").value.trim();
  const email   = document.getElementById("don-email").value.trim();

  const organismeVal = document.getElementById("don-organisme").value.trim();
  if (!nom && !organismeVal) { marquerChampErreurDon("don-nom", "Le nom ou l’organisme est obligatoire."); valide = false; }
  if (!type) { marquerChampErreurDon("don-type", "Le type de don est obligatoire."); valide = false; }

  if (type === "Don financier" && !montant) {
    marquerChampErreurDon("don-montant", "Le montant est obligatoire pour un don financier.");
    valide = false;
  }
  if (type === "Don financier" && montant && isNaN(parseFloat(montant.replace(",", ".")))) {
    marquerChampErreurDon("don-montant", "Le montant doit être un nombre (ex : 50 ou 50,50).");
    valide = false;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    marquerChampErreurDon("don-email", "L'adresse e-mail n'est pas valide.");
    valide = false;
  }

  /* Validation de la date */
  if (!jour || !mois || !annee) {
    if (!jour)  document.getElementById("don-date-jour").classList.add("champ-input--erreur");
    if (!mois)  document.getElementById("don-date-mois").classList.add("champ-input--erreur");
    if (!annee) document.getElementById("don-date-annee").classList.add("champ-input--erreur");
    const errDate = document.createElement("span");
    errDate.className = "champ-erreur";
    errDate.setAttribute("role", "alert");
    errDate.textContent = "La date du don est obligatoire (jour, mois et année requis).";
    const conteneur = document.querySelector("#groupe-date-don .date-adhesion__conteneur");
    conteneur.parentNode.insertBefore(errDate, conteneur.nextSibling);
    valide = false;
  } else {
    const dateTest   = new Date(`${annee}-${mois}-${jour}`);
    const dateValide = !isNaN(dateTest.getTime()) &&
      dateTest.getFullYear() === parseInt(annee, 10) &&
      (dateTest.getMonth() + 1) === parseInt(mois, 10) &&
      dateTest.getDate() === parseInt(jour, 10);
    if (!dateValide) {
      ["don-date-jour", "don-date-mois", "don-date-annee"].forEach(function(id) {
        document.getElementById(id).classList.add("champ-input--erreur");
      });
      const errDate = document.createElement("span");
      errDate.className = "champ-erreur";
      errDate.setAttribute("role", "alert");
      errDate.textContent = "Cette date n'existe pas.";
      const conteneur = document.querySelector("#groupe-date-don .date-adhesion__conteneur");
      conteneur.parentNode.insertBefore(errDate, conteneur.nextSibling);
      valide = false;
    }
  }

  return valide;
}

/* =====================================================
   SECTION DONATEURS — GÉNÉRATION ID
   ===================================================== */

/**
 * Génère le prochain id_donateur (DON-AAAA-NNNN) pour une année donnée.
 * @param {string} annee
 * @returns {Promise<string>}
 */
async function genererIdDonateur(annee) {
  const { data, error } = await clientSupabase
    .from("donateurs")
    .select("id_donateur")
    .like("id_donateur", `DON-${annee}-%`);

  if (error) throw new Error("Lecture Supabase échouée");

  let maxNumero = 0;
  if (data && data.length > 0) {
    data.forEach(function(don) {
      if (don.id_donateur) {
        const parties = don.id_donateur.split("-");
        if (parties.length === 3) {
          const n = parseInt(parties[2], 10);
          if (!isNaN(n) && n > maxNumero) maxNumero = n;
        }
      }
    });
  }

  return `DON-${annee}-${String(maxNumero + 1).padStart(4, "0")}`;
}

/* =====================================================
   SECTION DONATEURS — MESSAGES
   ===================================================== */

function afficherSuccesDon(texte) {
  const zone = document.getElementById("message-succes-don");
  zone.textContent = texte;
  zone.hidden = false;
  setTimeout(function() { zone.hidden = true; zone.textContent = ""; }, 5000);
}

function afficherErreurDon(texte) {
  const zone = document.getElementById("message-erreur-don");
  zone.textContent = texte;
  zone.hidden = false;
  setTimeout(function() { zone.hidden = true; zone.textContent = ""; }, 7000);
}

/* =====================================================
   SECTION DONATEURS — SOUMISSION FORMULAIRE
   ===================================================== */

formulaireDon.addEventListener("submit", async function(evenement) {
  evenement.preventDefault();

  const zoneErreur = document.getElementById("modale-don-erreur");
  zoneErreur.hidden = true;
  zoneErreur.textContent = "";

  if (!validerFormulaireDonateur()) return;

  const nom          = document.getElementById("don-nom").value.trim();
  const prenom       = document.getElementById("don-prenom").value.trim() || null;
  const civilite     = document.getElementById("don-civilite").value || null;
  const organisme    = document.getElementById("don-organisme").value.trim() || null;
  const email        = document.getElementById("don-email").value.trim() || null;
  const telephone    = document.getElementById("don-telephone").value.trim() || null;
  const adresse      = document.getElementById("don-adresse").value.trim() || null;
  const typeDon      = document.getElementById("don-type").value;
  const jour         = document.getElementById("don-date-jour").value;
  const mois         = document.getElementById("don-date-mois").value;
  const annee        = document.getElementById("don-date-annee").value;
  const dateDon      = `${annee}-${mois}-${jour}`;
  const montantBrut  = document.getElementById("don-montant").value.trim();
  const montantDon   = montantBrut ? parseFloat(montantBrut.replace(",", ".")) : null;
  const description  = document.getElementById("don-description").value.trim() || null;
  const modePaiement = document.getElementById("don-mode").value || null;
  const numeroCheque = document.getElementById("don-numero-cheque").value.trim() || null;
  const banqueCheque = document.getElementById("don-banque-cheque").value.trim() || null;

  if (donateurEnCours) {
    /* ---- MODE MODIFICATION : UPDATE Supabase ---- */
    const { error } = await clientSupabase
      .from("donateurs")
      .update({
        nom, prenom, civilite, organisme, email, telephone, adresse,
        type_don: typeDon, montant_don: montantDon,
        description_don: description, date_don: dateDon,
        mode_paiement: modePaiement,
        numero_cheque: modePaiement === "Chèque" ? numeroCheque : null,
        banque_cheque: modePaiement === "Chèque" ? banqueCheque : null
      })
      .eq("id", donateurEnCours.id);

    if (error) {
      zoneErreur.textContent = "La modification a échoué. Vérifiez votre connexion et réessayez.";
      zoneErreur.hidden = false;
      return;
    }

    fermerModaleDon();
    await chargerDonateurs();
    afficherSuccesDon(`Donateur modifié : ${prenom ? prenom + " " : ""}${nom}.`);

  } else {
    /* ---- MODE AJOUT : INSERT Supabase ---- */
    let idDonateur;
    try {
      idDonateur = await genererIdDonateur(annee);
    } catch (_) {
      zoneErreur.textContent = "Impossible de générer l'identifiant. Vérifiez votre connexion et réessayez.";
      zoneErreur.hidden = false;
      return;
    }

    const { error } = await clientSupabase
      .from("donateurs")
      .insert([{
        id_donateur: idDonateur,
        nom, prenom, civilite, organisme, email, telephone, adresse,
        type_don: typeDon, montant_don: montantDon,
        description_don: description, date_don: dateDon,
        mode_paiement: modePaiement,
        numero_cheque: modePaiement === "Chèque" ? numeroCheque : null,
        banque_cheque: modePaiement === "Chèque" ? banqueCheque : null
      }]);

    if (error) {
      zoneErreur.textContent = "L'enregistrement a échoué. Vérifiez votre connexion et réessayez.";
      zoneErreur.hidden = false;
      return;
    }

    fermerModaleDon();
    await chargerDonateurs();
    afficherSuccesDon(`Donateur ajouté : ${prenom ? prenom + " " : ""}${nom} (${idDonateur}).`);
  }
});

/* =====================================================
   SECTION DONATEURS — DÉLÉGATION DES CLICS TABLEAU
   ===================================================== */

document.getElementById("corps-tableau-donateurs").addEventListener("click", function(evenement) {
  const btnModifier  = evenement.target.closest(".btn-icone--mod-don");
  const btnSupprimer = evenement.target.closest(".btn-icone--sup-don");
  const btnRecuDon   = evenement.target.closest(".btn-icone--recu-don");

  if (btnModifier) {
    const idTechnique = btnModifier.dataset.idTechnique;
    const donateur = donneesDonateurs.find(function(d) { return String(d.id) === idTechnique; });
    if (donateur) ouvrirModaleDonModification(donateur);
  }

  if (btnSupprimer) {
    const idTechnique = btnSupprimer.dataset.idTechnique;
    const donateur = donneesDonateurs.find(function(d) { return String(d.id) === idTechnique; });
    if (donateur) ouvrirConfirmationSuppressionDon(donateur);
  }

  if (btnRecuDon) {
    const idTechnique = btnRecuDon.dataset.idTechnique;
    const donateur = donneesDonateurs.find(function(d) { return String(d.id) === idTechnique; });
    if (donateur) ouvrirModaleRecuDonateur(donateur);
  }
});

/* =====================================================
   SECTION DONATEURS — CONFIRMATION SUPPRESSION
   ===================================================== */

const confirmationFondDon   = document.getElementById("confirmation-fond-don");
const modaleConfirmDon      = document.getElementById("modale-confirmation-don");
let donateurASupprimer         = null;
let elementAvantConfirmationDon = null;

function ouvrirConfirmationSuppressionDon(donateur) {
  donateurASupprimer          = donateur;
  elementAvantConfirmationDon = document.activeElement;

  document.getElementById("confirmation-don-info").textContent =
    `${donateur.prenom || ""} ${donateur.nom || ""} — ${donateur.id_donateur || donateur.id}`.trim();

  confirmationFondDon.hidden = false;
  requestAnimationFrame(function() { modaleConfirmDon.focus(); });
  document.addEventListener("keydown", gererToucheConfirmationDon);
}

function fermerConfirmationDon() {
  confirmationFondDon.hidden  = true;
  donateurASupprimer          = null;
  document.removeEventListener("keydown", gererToucheConfirmationDon);
  if (elementAvantConfirmationDon) elementAvantConfirmationDon.focus();
}

function gererToucheConfirmationDon(evenement) {
  if (evenement.key === "Escape") { fermerConfirmationDon(); return; }
  if (evenement.key === "Tab") {
    const focusables = modaleConfirmDon.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const premier = focusables[0];
    const dernier  = focusables[focusables.length - 1];
    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault(); dernier.focus();
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault(); premier.focus();
    }
  }
}

document.getElementById("btn-annuler-confirmation-don").addEventListener("click", fermerConfirmationDon);
confirmationFondDon.addEventListener("click", function(ev) {
  if (ev.target === confirmationFondDon) fermerConfirmationDon();
});

document.getElementById("btn-confirmer-suppression-don").addEventListener("click", async function() {
  if (!donateurASupprimer) return;

  const nomComplet = `${donateurASupprimer.prenom || ""} ${donateurASupprimer.nom || ""}`.trim();

  const { error } = await clientSupabase
    .from("donateurs")
    .delete()
    .eq("id", donateurASupprimer.id);

  if (error) {
    fermerConfirmationDon();
    afficherErreurDon("La suppression a échoué. Vérifiez votre connexion et réessayez.");
    return;
  }

  fermerConfirmationDon();
  await chargerDonateurs();
  afficherSuccesDon(`Donateur supprimé : ${nomComplet}.`);
});

/* =====================================================
   SECTION DONATEURS — SÉLECTS DE DATE
   ===================================================== */

/**
 * Peuple les trois selects Jour / Mois / Année du formulaire donateur.
 * IDs distincts de ceux du formulaire adhérent.
 */
function initialiserSelectsDateDon() {
  const selectJour  = document.getElementById("don-date-jour");
  const selectMois  = document.getElementById("don-date-mois");
  const selectAnnee = document.getElementById("don-date-annee");

  selectJour.innerHTML = '<option value="">Jour</option>';
  for (let j = 1; j <= 31; j++) {
    const opt = document.createElement("option");
    opt.value       = String(j).padStart(2, "0");
    opt.textContent = String(j);
    selectJour.appendChild(opt);
  }

  const moisFr = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  selectMois.innerHTML = '<option value="">Mois</option>';
  moisFr.forEach(function(libelle, index) {
    const opt = document.createElement("option");
    opt.value       = String(index + 1).padStart(2, "0");
    opt.textContent = libelle;
    selectMois.appendChild(opt);
  });

  const anneeActuelle = new Date().getFullYear();
  selectAnnee.innerHTML = '<option value="">Année</option>';
  for (let a = 2020; a <= anneeActuelle; a++) {
    const opt = document.createElement("option");
    opt.value       = String(a);
    opt.textContent = String(a);
    selectAnnee.appendChild(opt);
  }
}

/* =====================================================
   REÇU D'ADHÉSION
   ===================================================== */

/* ---- Utilitaires reçus ---- */

function formaterNomRecu(civilite, prenom, nom, organisme) {
  if (organisme) return `de <strong>${organisme}</strong>`;
  const prenomF    = prenom ? prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase() : "";
  const nomF       = nom ? nom.toUpperCase() : "";
  const nomComplet = [prenomF, nomF].filter(Boolean).join(" ");
  if (nomComplet) {
    const prefixe = civilite ? `${civilite} ` : "";
    return `de <strong>${prefixe}${nomComplet}</strong>`;
  }
  return "de —";
}

function dateDuJourFormate() {
  const d  = new Date();
  const jj = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${jj}/${mm}/${d.getFullYear()}`;
}

const recuAdhFond   = document.getElementById("recu-adh-fond");
const modaleRecuAdh = document.getElementById("modale-recu-adh");
let elementAvantRecuAdh = null;
let adherentRecuEnCours = null;

function ouvrirModaleRecuAdherent(adherent) {
  elementAvantRecuAdh = document.activeElement;
  adherentRecuEnCours = adherent;

  const saison = adherent.saison || "—";
  document.getElementById("recu-adh-annee").textContent  = `Saison ${saison}`;
  const suffixeAdh = adherent.id_adherent ? adherent.id_adherent.replace(/^HSI-/, "") : "?";
  document.getElementById("recu-adh-numero").textContent = `REC-ADH-${suffixeAdh}`;
  document.getElementById("recu-adh-fait-a").textContent =
    `Fait à Saint-Pierre-des-Corps, le ${dateDuJourFormate()}`;

  document.getElementById("select-signataire-adh").value = "La trésorière";

  document.getElementById("recu-adh-date").textContent = formaterDate(adherent.date_adhesion);

  const mode       = adherent.mode_paiement || "";
  const chequeInfo = champsChequesAdherents.get(String(adherent.id)) || {};
  const lignMode   = document.getElementById("recu-adh-mode-ligne");
  const lignCheque = document.getElementById("recu-adh-cheque-ligne");

  if (mode) {
    document.getElementById("recu-adh-mode").textContent = mode;
    lignMode.hidden = false;
  } else {
    lignMode.hidden = true;
  }

  if (mode === "Chèque") {
    const numCheque = chequeInfo.numero_cheque || "";
    const banque    = chequeInfo.banque        || "";
    document.getElementById("recu-adh-num-cheque").textContent = numCheque || "—";
    document.getElementById("recu-adh-banque-sep").textContent = banque ? ` — Banque : ${banque}` : "";
    lignCheque.hidden = false;
  } else {
    lignCheque.hidden = true;
  }

  majTexteRecuAdh();

  recuAdhFond.hidden = false;
  requestAnimationFrame(function() { modaleRecuAdh.focus(); });
  document.addEventListener("keydown", gererToucheRecuAdh);
}

function majTexteRecuAdh() {
  if (!adherentRecuEnCours) return;
  const a          = adherentRecuEnCours;
  const signataire = document.getElementById("select-signataire-adh").value;
  const saison = a.saison || "—";

  const cotis = (a.montant_cotisation != null)
    ? Number(a.montant_cotisation).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
    : "—";
  const donVal = (a.montant_don != null && Number(a.montant_don) > 0)
    ? Number(a.montant_don)
    : null;
  const donStr = donVal
    ? donVal.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
    : null;
  const totalStr = (donVal && a.montant_cotisation != null)
    ? (Number(a.montant_cotisation) + donVal).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
    : null;
  const montantCert = totalStr || cotis;

  /* Lignes montant dans le reçu */
  document.getElementById("recu-adh-montant-cotisation").textContent = cotis;
  document.getElementById("recu-adh-don-ligne").hidden   = !donStr;
  document.getElementById("recu-adh-total-ligne").hidden = !totalStr;
  if (donStr) {
    document.getElementById("recu-adh-montant-don").textContent   = donStr;
    document.getElementById("recu-adh-montant-total").textContent = totalStr;
  }

  const donneurHtml = formaterNomRecu(a.civilite || "", a.prenom || "", a.nom || "", "");
  document.getElementById("recu-adh-certification").innerHTML =
    `${signataire} de l’association <strong>Handicap Solidarité pour l’Inclusion 37</strong> ` +
    `certifie avoir reçu la somme de <strong>${montantCert}</strong> ` +
    `au titre de l\'adhésion annuelle de la saison <strong>${saison}</strong> ` +
    `${donneurHtml}.`;

  /* Bloc signature */
  const nomAdh = NOMS_SIGNATAIRES[signataire] || "";
  document.getElementById("recu-adh-sig-qualite").textContent = signataire;
  document.getElementById("recu-adh-sig-nom").textContent     = nomAdh;
}

document.getElementById("select-signataire-adh").addEventListener("change", majTexteRecuAdh);

function fermerModaleRecuAdh() {
  recuAdhFond.hidden  = true;
  adherentRecuEnCours = null;
  document.removeEventListener("keydown", gererToucheRecuAdh);
  if (elementAvantRecuAdh) elementAvantRecuAdh.focus();
}

function gererToucheRecuAdh(evenement) {
  if (evenement.key === "Escape") { fermerModaleRecuAdh(); return; }
  if (evenement.key === "Tab") {
    const focusables = modaleRecuAdh.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const premier = focusables[0];
    const dernier  = focusables[focusables.length - 1];
    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault(); dernier.focus();
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault(); premier.focus();
    }
  }
}

document.getElementById("btn-fermer-recu-adh").addEventListener("click", fermerModaleRecuAdh);
document.getElementById("btn-fermer-recu-adh-bas").addEventListener("click", fermerModaleRecuAdh);
recuAdhFond.addEventListener("click", function(ev) { if (ev.target === recuAdhFond) fermerModaleRecuAdh(); });

document.getElementById("btn-telecharger-recu-adh").addEventListener("click", function() {
  const doc         = document.getElementById("recu-adherent-document");
  const imgLogo     = document.getElementById("recu-adh-logo");
  const idAdherent  = (adherentRecuEnCours && adherentRecuEnCours.id_adherent) || "recu";
  const nomFichier  = `recu-adhesion-${idAdherent}.pdf`;
  const btn         = this;

  btn.disabled = true;
  btn.textContent = "Génération…";

  const srcOriginal = imgLogo.src;

  chargerImageCommeDataUrl("assets/hsi37-redim-demi.png").then(function(dataUrl) {
    imgLogo.src = dataUrl;
    return new Promise(function(resolve) { imgLogo.onload = resolve; imgLogo.onerror = resolve; });
  }).then(function() {
    return html2canvas(doc, { scale: 2, useCORS: false, allowTaint: true, backgroundColor: "#ffffff", logging: false });
  }).then(function(canvas) {
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const mmLarg  = 210;
    const mmHaut  = Math.round((canvas.height / canvas.width) * mmLarg);
    const pdf     = new window.jspdf.jsPDF({
      orientation: mmHaut >= mmLarg ? "portrait" : "landscape",
      unit: "mm",
      format: [mmLarg, mmHaut]
    });
    pdf.addImage(imgData, "JPEG", 0, 0, mmLarg, mmHaut);
    pdf.save(nomFichier);
  }).finally(function() {
    imgLogo.src = srcOriginal;
    btn.disabled = false;
    btn.innerHTML = `
      <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 24 24" width="16" height="16">
        <path d="M12 15V3M12 15l-4-4M12 15l4-4M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
      Télécharger le reçu
    `.trim();
  });
});

/* =====================================================
   REÇU DE DON
   ===================================================== */

const recuDonFond   = document.getElementById("recu-don-fond");
const modaleRecuDon = document.getElementById("modale-recu-don");
let elementAvantRecuDon = null;
let donateurRecuEnCours = null;

function ouvrirModaleRecuDonateur(donateur) {
  console.log("[RECU-DON] type_don =", JSON.stringify(donateur.type_don));
  elementAvantRecuDon = document.activeElement;
  donateurRecuEnCours = donateur;

  const annee = donateur.date_don ? donateur.date_don.split("-")[0] : "—";
  document.getElementById("recu-don-annee").textContent  = `Année ${annee}`;
  const suffixeDon = donateur.id_donateur ? donateur.id_donateur.replace(/^DON-/, "") : "?";
  document.getElementById("recu-don-numero").textContent = `REC-DON-${suffixeDon}`;
  document.getElementById("recu-don-fait-a").textContent =
    `Fait à Saint-Pierre-des-Corps, le ${dateDuJourFormate()}`;

  document.getElementById("select-signataire-don").value = "La trésorière";

  document.getElementById("recu-don-date").textContent = formaterDate(donateur.date_don);

  const mode       = donateur.mode_paiement || "";
  const lignMode   = document.getElementById("recu-don-mode-ligne");
  const lignCheque = document.getElementById("recu-don-cheque-ligne");

  if (mode) {
    document.getElementById("recu-don-mode").textContent = mode;
    lignMode.hidden = false;
  } else {
    lignMode.hidden = true;
  }

  if (mode === "Chèque") {
    const numCheque = donateur.numero_cheque || "";
    const banque    = donateur.banque_cheque  || "";
    document.getElementById("recu-don-num-cheque").textContent = numCheque || "—";
    document.getElementById("recu-don-banque-sep").textContent = banque ? ` — Banque : ${banque}` : "";
    lignCheque.hidden = false;
  } else {
    lignCheque.hidden = true;
  }

  majTexteRecuDon();

  recuDonFond.hidden = false;
  requestAnimationFrame(function() { modaleRecuDon.focus(); });
  document.addEventListener("keydown", gererToucheRecuDon);
}

function majTexteRecuDon() {
  if (!donateurRecuEnCours) return;
  const d            = donateurRecuEnCours;
  const signataire   = document.getElementById("select-signataire-don").value;
  const typeDonLower = (d.type_don || "").trim().toLowerCase();
  const donneurHtml  = formaterNomRecu(d.civilite || "", d.prenom || "", d.nom || "", d.organisme || "");
  const asso = "<strong>Handicap Solidarité pour l’Inclusion 37</strong>";
  let certif = "";
  if (typeDonLower.includes("mat")) {
    const description = d.description_don || "—";
    certif =
      `${signataire} de l’association ${asso} ` +
      `certifie avoir reçu un don de matériel (<strong>${description}</strong>) ` +
      `${donneurHtml}.`;
  } else if (typeDonLower.includes("financier")) {
    const montant = (d.montant_don !== null && d.montant_don !== undefined)
      ? Number(d.montant_don).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
      : "—";
    certif =
      `${signataire} de l’association ${asso} ` +
      `certifie avoir reçu la somme de <strong>${montant}</strong> ` +
      `${donneurHtml}.`;
  } else {
    certif =
      `${signataire} de l’association ${asso} ` +
      `certifie avoir reçu un don ${donneurHtml}.`;
  }
  document.getElementById("recu-don-certification").innerHTML = certif;

  /* Bloc signature */
  const nomDon = NOMS_SIGNATAIRES[signataire] || "";
  document.getElementById("recu-don-sig-qualite").textContent = signataire;
  document.getElementById("recu-don-sig-nom").textContent     = nomDon;
}
document.getElementById("select-signataire-don").addEventListener("change", majTexteRecuDon);

function fermerModaleRecuDon() {
  recuDonFond.hidden  = true;
  donateurRecuEnCours = null;
  document.removeEventListener("keydown", gererToucheRecuDon);
  if (elementAvantRecuDon) elementAvantRecuDon.focus();
}

function gererToucheRecuDon(evenement) {
  if (evenement.key === "Escape") { fermerModaleRecuDon(); return; }
  if (evenement.key === "Tab") {
    const focusables = modaleRecuDon.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const premier = focusables[0];
    const dernier  = focusables[focusables.length - 1];
    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault(); dernier.focus();
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault(); premier.focus();
    }
  }
}

document.getElementById("btn-fermer-recu-don").addEventListener("click", fermerModaleRecuDon);
document.getElementById("btn-fermer-recu-don-bas").addEventListener("click", fermerModaleRecuDon);
recuDonFond.addEventListener("click", function(ev) { if (ev.target === recuDonFond) fermerModaleRecuDon(); });

document.getElementById("btn-telecharger-recu-don").addEventListener("click", function() {
  const doc        = document.getElementById("recu-donateur-document");
  const imgLogo    = document.getElementById("recu-don-logo");
  const idDonateur = (donateurRecuEnCours && donateurRecuEnCours.id_donateur) || "recu-don";
  const nomFichier = `recu-don-${idDonateur}.pdf`;
  const btn        = this;

  btn.disabled = true;
  btn.textContent = "Génération…";

  const srcOriginal = imgLogo.src;

  chargerImageCommeDataUrl("assets/hsi37-redim-demi.png").then(function(dataUrl) {
    imgLogo.src = dataUrl;
    return new Promise(function(resolve) { imgLogo.onload = resolve; imgLogo.onerror = resolve; });
  }).then(function() {
    return html2canvas(doc, { scale: 2, useCORS: false, allowTaint: true, backgroundColor: "#ffffff", logging: false });
  }).then(function(canvas) {
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const mmLarg  = 210;
    const mmHaut  = Math.round((canvas.height / canvas.width) * mmLarg);
    const pdf     = new window.jspdf.jsPDF({
      orientation: mmHaut >= mmLarg ? "portrait" : "landscape",
      unit: "mm",
      format: [mmLarg, mmHaut]
    });
    pdf.addImage(imgData, "JPEG", 0, 0, mmLarg, mmHaut);
    pdf.save(nomFichier);
  }).finally(function() {
    imgLogo.src = srcOriginal;
    btn.disabled = false;
    btn.innerHTML = `
      <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 24 24" width="16" height="16">
        <path d="M12 15V3M12 15l-4-4M12 15l4-4M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
      Télécharger le reçu
    `.trim();
  });
});

/* =====================================================
   BULLETIN D'ADHÉSION VIERGE
   ===================================================== */

const bulletinFond   = document.getElementById("bulletin-fond");
const modaleBulletin = document.getElementById("modale-bulletin");
let elementAvantBulletin = null;

function ouvrirModaleBulletin() {
  elementAvantBulletin = document.activeElement;
  bulletinFond.hidden  = false;
  requestAnimationFrame(function() { modaleBulletin.focus(); });
  document.addEventListener("keydown", gererToucheBulletin);
}

function fermerModaleBulletin() {
  bulletinFond.hidden = true;
  document.removeEventListener("keydown", gererToucheBulletin);
  if (elementAvantBulletin) elementAvantBulletin.focus();
}

function gererToucheBulletin(evenement) {
  if (evenement.key === "Escape") { fermerModaleBulletin(); return; }
  if (evenement.key === "Tab") {
    const focusables = modaleBulletin.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const premier = focusables[0];
    const dernier  = focusables[focusables.length - 1];
    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault(); dernier.focus();
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault(); premier.focus();
    }
  }
}

document.getElementById("btn-bulletin").addEventListener("click", ouvrirModaleBulletin);
document.getElementById("btn-fermer-bulletin").addEventListener("click", fermerModaleBulletin);
document.getElementById("btn-fermer-bulletin-bas").addEventListener("click", fermerModaleBulletin);
bulletinFond.addEventListener("click", function(ev) {
  if (ev.target === bulletinFond) fermerModaleBulletin();
});

/**
 * Génère et télécharge le bulletin d'adhésion vierge au format PNG (scale 2).
 * @param {boolean} avecDon - true = version avec ligne de don libre
 */
function genererBulletin(avecDon) {
  const annee      = new Date().getFullYear();
  const doc        = document.getElementById("bulletin-document");
  const logos      = doc.querySelectorAll(".bulletin__logo");
  const ligneDon   = document.getElementById("bulletin-ligne-don");
  const nomFichier = avecDon
    ? `bulletin-adhesion-don-${annee}.png`
    : `bulletin-adhesion-${annee}.png`;

  /* Injecter l'année courante dans tous les espans dédiés */
  doc.querySelectorAll(".bulletin-annee").forEach(function(el) {
    el.textContent = String(annee);
  });

  /* Afficher ou masquer la ligne don avant capture */
  ligneDon.style.display = avecDon ? "flex" : "none";

  const btnStd   = document.getElementById("btn-bulletin-standard");
  const btnDon   = document.getElementById("btn-bulletin-don");
  const btnActif = avecDon ? btnDon : btnStd;
  btnActif.disabled    = true;
  btnActif.textContent = "Génération…";

  /* Sauvegarder les src originaux de tous les logos */
  const srcsOriginaux = Array.from(logos).map(function(img) { return img.src; });

  chargerImageCommeDataUrl("assets/hsi37-redim-demi.png").then(function(dataUrl) {
    /* Remplacer chaque logo par sa version base64 pour html2canvas */
    const promesses = Array.from(logos).map(function(img) {
      return new Promise(function(resolve) {
        img.src    = dataUrl;
        img.onload  = resolve;
        img.onerror = resolve;
      });
    });
    return Promise.all(promesses);
  }).then(function() {
    return html2canvas(doc, {
      scale: 2,
      useCORS: false,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false
    });
  }).then(function(canvas) {
    const lien    = document.createElement("a");
    lien.download = nomFichier;
    lien.href     = canvas.toDataURL("image/png");
    lien.click();
  }).finally(function() {
    /* Rétablir les src d'origine */
    Array.from(logos).forEach(function(img, i) { img.src = srcsOriginaux[i]; });
    btnActif.disabled = false;
    btnActif.innerHTML = `
      <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 24 24" width="16" height="16">
        <path d="M12 15V3M12 15l-4-4M12 15l4-4M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"
              stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
      Télécharger
    `.trim();
  });
}

document.getElementById("btn-bulletin-standard").addEventListener("click", function() {
  genererBulletin(false);
});

document.getElementById("btn-bulletin-don").addEventListener("click", function() {
  genererBulletin(true);
});

/* =====================================================
   HUB — LISTENERS TUILES ET RETOUR ACCUEIL
   ===================================================== */

document.getElementById("tuile-adherents").addEventListener("click", function() {
  allerVers("adherents");
});
document.getElementById("tuile-donateurs").addEventListener("click", function() {
  allerVers("donateurs");
});
document.getElementById("tuile-documents").addEventListener("click", function() {
  allerVers("documents");
});
document.getElementById("tuile-signatures").addEventListener("click", function() {
  allerVers("signatures");
});
document.getElementById("tuile-aide").addEventListener("click", function() {
  const lien = document.createElement("a");
  lien.href = "docs/mode-emploi-HSI37.pdf";
  lien.download = "mode-emploi-HSI37.pdf";
  lien.click();
});
document.getElementById("tuile-rgpd").addEventListener("click", function() {
  allerVers("rgpd");
});
document.getElementById("btn-retour-accueil").addEventListener("click", function() {
  afficherHub();
});

/* =====================================================
   DOCUMENTS — UTILITAIRES COMMUNS
   ===================================================== */

const NOMS_SIGNATAIRES = {
  'Le président':  'BELHAJ Mohammed',
  'La trésorière': 'BELHAJ Oum Keltoum',
  'La secrétaire': 'BELHAJ Nawel',
};

const MOIS_NOMS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

function dateJourFormate() {
  const d = new Date();
  return `${d.getDate()} ${MOIS_NOMS[d.getMonth()]} ${d.getFullYear()}`;
}

function anneeEnCours() {
  return new Date().getFullYear();
}

/* Initialise un groupe de selects jour/mois/année pour les modales docs */
function initialiserSelectsDateDoc(idJour, idMois, idAnnee) {
  const sJ = document.getElementById(idJour);
  const sM = document.getElementById(idMois);
  const sA = document.getElementById(idAnnee);
  if (!sJ || !sM || !sA) return;

  sJ.innerHTML = '<option value="">J</option>';
  for (let j = 1; j <= 31; j++) {
    const o = document.createElement('option');
    o.value = String(j).padStart(2,'0');
    o.textContent = String(j).padStart(2,'0');
    sJ.appendChild(o);
  }

  sM.innerHTML = '<option value="">M</option>';
  MOIS_NOMS.forEach(function(nom, i) {
    const o = document.createElement('option');
    o.value = String(i + 1).padStart(2,'0');
    o.textContent = nom;
    sM.appendChild(o);
  });

  const annee = anneeEnCours();
  sA.innerHTML = '<option value="">Année</option>';
  for (let a = annee - 1; a <= annee + 3; a++) {
    const o = document.createElement('option');
    o.value = String(a);
    o.textContent = String(a);
    if (a === annee) o.selected = true;
    sA.appendChild(o);
  }
}

/* Initialise les selects heures 00-23 */
function initialiserSelectHeure(idSelect) {
  const s = document.getElementById(idSelect);
  if (!s) return;
  s.innerHTML = '<option value="">HH</option>';
  for (let h = 0; h <= 23; h++) {
    const o = document.createElement('option');
    o.value = String(h).padStart(2,'0');
    o.textContent = String(h).padStart(2,'0');
    if (h === 14) o.selected = true;
    s.appendChild(o);
  }
}

/* Capture un élément html2canvas → télécharge en PNG */
function captureEtTelecharger(idElement, nomFichier, btn, texteOriginelBtn) {
  btn.disabled   = true;
  btn.textContent = 'Génération…';

  const el   = document.getElementById(idElement);
  const imgs = el.querySelectorAll('img.doc-a4__logo');

  chargerImageCommeDataUrl('assets/hsi37-redim-demi.png').then(function(dataUrl) {
    imgs.forEach(function(img) { img.src = dataUrl; });
    return new Promise(function(resolve) { setTimeout(resolve, 80); });
  }).then(function() {
    return html2canvas(el, { scale: 2, useCORS: false, allowTaint: true, backgroundColor: '#ffffff', logging: false });
  }).then(function(canvas) {
    const lien = document.createElement('a');
    lien.download = nomFichier;
    lien.href     = canvas.toDataURL('image/png');
    document.body.appendChild(lien);
    lien.click();
    setTimeout(function() { document.body.removeChild(lien); }, 200);
  }).finally(function() {
    imgs.forEach(function(img) { img.src = 'assets/hsi37-redim-demi.png'; });
    btn.disabled  = false;
    btn.innerHTML = texteOriginelBtn;
  });
}

/* Focus trap générique pour une modale */
function creerFocusTrap(idModale, fnFermer) {
  return function(ev) {
    if (ev.key === 'Escape') { fnFermer(); return; }
    if (ev.key !== 'Tab') return;
    const modale     = document.getElementById(idModale);
    const focusables = Array.from(modale.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusables.length) return;
    const premier = focusables[0];
    const dernier = focusables[focusables.length - 1];
    if (ev.shiftKey) {
      if (document.activeElement === premier) { ev.preventDefault(); dernier.focus(); }
    } else {
      if (document.activeElement === dernier)  { ev.preventDefault(); premier.focus(); }
    }
  };
}

/* =====================================================
   DOCUMENT 2 — ATTESTATION D'ADHÉSION
   ===================================================== */

const attestationFond   = document.getElementById('attestation-fond');
const modaleAttestation = document.getElementById('modale-attestation');
let elementAvantAttestation = null;
let trapAttestation = null;
let adherentAttestation = null;

function ouvrirModaleAttestation(adherent) {
  adherentAttestation    = adherent;
  elementAvantAttestation = document.activeElement;
  peuplerAttestation(adherent, 'La trésorière');

  attestationFond.hidden = false;
  requestAnimationFrame(function() { modaleAttestation.focus(); });
  trapAttestation = creerFocusTrap('modale-attestation', fermerModaleAttestation);
  document.addEventListener('keydown', trapAttestation);
}

function fermerModaleAttestation() {
  attestationFond.hidden = true;
  document.removeEventListener('keydown', trapAttestation);
  if (elementAvantAttestation) elementAvantAttestation.focus();
  adherentAttestation = null;
}

function peuplerAttestation(adherent, qualite) {
  const nomSig  = NOMS_SIGNATAIRES[qualite] || '';
  const civilite = adherent.civilite || '';
  const prenom   = adherent.prenom   || '';
  const nom      = adherent.nom      || '';
  const saison   = adherent.saison   || anneeEnCours();

  document.getElementById('attestation-certification').textContent =
    `Je soussigné(e), ${qualite} ${nomSig}, certifie que ${civilite} ${prenom} ${nom.toUpperCase()} est membre de l'association Handicap Solidarité pour l'Inclusion 37 pour la saison ${saison}.`.trim();
  document.getElementById('attestation-type').textContent    = adherent.type_membre || '—';
  document.getElementById('attestation-numero').textContent  = adherent.id_adherent || adherent.id || '—';
  document.getElementById('attestation-fait-a').textContent  = `Fait à Saint-Pierre-des-Corps, le ${dateJourFormate()}`;
  document.getElementById('attestation-sig-qualite').textContent = qualite;
  document.getElementById('attestation-sig-nom').textContent     = nomSig;
}

document.getElementById('select-signataire-attestation').addEventListener('change', function() {
  if (adherentAttestation) peuplerAttestation(adherentAttestation, this.value);
});

document.getElementById('btn-fermer-attestation').addEventListener('click', fermerModaleAttestation);
document.getElementById('btn-fermer-attestation-bas').addEventListener('click', fermerModaleAttestation);
document.getElementById('attestation-fond').addEventListener('click', function(ev) {
  if (ev.target === attestationFond) fermerModaleAttestation();
});

document.getElementById('btn-telecharger-attestation').addEventListener('click', function() {
  const idAdh = (adherentAttestation && (adherentAttestation.id_adherent || adherentAttestation.id)) || 'HSI37';
  const logos  = document.getElementById('doc-attestation').querySelectorAll('img.doc-a4__logo');
  const btn    = this;
  const label  = btn.innerHTML;

  btn.disabled    = true;
  btn.textContent = 'Génération…';

  chargerImageCommeDataUrl('assets/hsi37-redim-demi.png').then(function(dataUrl) {
    logos.forEach(function(img) { img.src = dataUrl; });
    return new Promise(function(resolve) { setTimeout(resolve, 80); });
  }).then(function() {
    return html2canvas(document.getElementById('doc-attestation'), {
      scale: 2, useCORS: false, allowTaint: true, backgroundColor: '#ffffff', logging: false
    });
  }).then(function(canvas) {
    const lien = document.createElement('a');
    lien.download = `attestation-${idAdh}.png`;
    lien.href     = canvas.toDataURL('image/png');
    document.body.appendChild(lien);
    lien.click();
    setTimeout(function() { document.body.removeChild(lien); }, 200);
  }).finally(function() {
    logos.forEach(function(img) { img.src = 'assets/hsi37-redim-demi.png'; });
    btn.disabled  = false;
    btn.innerHTML = label;
  });
});

/* =====================================================
   DOCUMENT 3 — RELANCE DE COTISATION
   ===================================================== */

const relanceFond   = document.getElementById('relance-fond');
const modaleRelance = document.getElementById('modale-relance');
let elementAvantRelance = null;
let trapRelance = null;
let adherentRelance = null;

function ouvrirModaleRelance(adherent) {
  adherentRelance     = adherent;
  elementAvantRelance  = document.activeElement;
  peuplerRelance(adherent, 'La trésorière');

  relanceFond.hidden = false;
  requestAnimationFrame(function() { modaleRelance.focus(); });
  trapRelance = creerFocusTrap('modale-relance', fermerModaleRelance);
  document.addEventListener('keydown', trapRelance);
}

function fermerModaleRelance() {
  relanceFond.hidden = true;
  document.removeEventListener('keydown', trapRelance);
  if (elementAvantRelance) elementAvantRelance.focus();
  adherentRelance = null;
}

function peuplerRelance(adherent, qualite) {
  const nomSig   = NOMS_SIGNATAIRES[qualite] || '';
  const annee    = anneeEnCours();
  const saisonDerniere = adherent.saison || (annee - 1);

  document.getElementById('relance-lieu-date').textContent   = `Saint-Pierre-des-Corps, le ${dateJourFormate()}`;
  document.getElementById('relance-dest-nom').textContent    = [adherent.civilite, adherent.prenom, (adherent.nom || '').toUpperCase()].filter(Boolean).join(' ');
  document.getElementById('relance-dest-adresse').textContent = adherent.adresse || '';
  document.getElementById('relance-annee-objet').textContent = annee;
  document.getElementById('relance-derniere-saison').textContent = saisonDerniere;
  document.getElementById('relance-annee-corps').textContent    = annee;
  document.getElementById('relance-sig-qualite').textContent    = qualite;
  document.getElementById('relance-sig-nom').textContent        = nomSig;
}

document.getElementById('select-signataire-relance').addEventListener('change', function() {
  if (adherentRelance) peuplerRelance(adherentRelance, this.value);
});

document.getElementById('btn-fermer-relance').addEventListener('click', fermerModaleRelance);
document.getElementById('btn-fermer-relance-bas').addEventListener('click', fermerModaleRelance);
document.getElementById('relance-fond').addEventListener('click', function(ev) {
  if (ev.target === relanceFond) fermerModaleRelance();
});

document.getElementById('btn-mail-relance').addEventListener('click', function() {
  if (!adherentRelance) return;
  const email  = adherentRelance.email || '';
  const annee  = anneeEnCours();
  const sujet  = encodeURIComponent(`Renouvellement adhésion HSI37 — Saison ${annee}`);
  const saisonDerniere = adherentRelance.saison || (annee - 1);
  const corps  = encodeURIComponent(
    `Madame, Monsieur,\n\nNous vous informons que votre adhésion à l'association Handicap Solidarité pour l'Inclusion 37 pour la saison ${saisonDerniere} est arrivée à échéance.\n\nNous vous invitons à renouveler votre adhésion pour la saison ${annee} au montant de 20,00 €.\n\nVous pouvez régler par : espèces, virement (IBAN : FR76 1027 8374 …. …. …. 116), chèque à l'ordre de l'Association Handicap Solidarité pour l'Inclusion 37, carte bancaire, PayPal ou HelloAsso.\n\nNous vous remercions pour votre soutien et restons à votre disposition.\n\nCordialement,\nHSI37`
  );
  window.open(`mailto:${email}?subject=${sujet}&body=${corps}`);
});

document.getElementById('btn-telecharger-relance').addEventListener('click', function() {
  const idAdh = (adherentRelance && (adherentRelance.id_adherent || adherentRelance.id)) || 'HSI37';
  const logos  = document.getElementById('doc-relance').querySelectorAll('img.doc-a4__logo');
  const btn    = this;
  const label  = btn.innerHTML;

  btn.disabled    = true;
  btn.textContent = 'Génération…';

  chargerImageCommeDataUrl('assets/hsi37-redim-demi.png').then(function(dataUrl) {
    logos.forEach(function(img) { img.src = dataUrl; });
    return new Promise(function(resolve) { setTimeout(resolve, 80); });
  }).then(function() {
    return html2canvas(document.getElementById('doc-relance'), {
      scale: 2, useCORS: false, allowTaint: true, backgroundColor: '#ffffff', logging: false
    });
  }).then(function(canvas) {
    const lien = document.createElement('a');
    lien.download = `relance-${idAdh}.png`;
    lien.href     = canvas.toDataURL('image/png');
    document.body.appendChild(lien);
    lien.click();
    setTimeout(function() { document.body.removeChild(lien); }, 200);
  }).finally(function() {
    logos.forEach(function(img) { img.src = 'assets/hsi37-redim-demi.png'; });
    btn.disabled  = false;
    btn.innerHTML = label;
  });
});

/* =====================================================
   DOCUMENT 4 — CONVOCATION AG
   ===================================================== */

const convocationFond   = document.getElementById('convocation-fond');
const modaleConvocation = document.getElementById('modale-convocation');
let elementAvantConvocation = null;
let trapConvocation = null;

function ouvrirModaleConvocation() {
  elementAvantConvocation = document.activeElement;
  initialiserSelectsDateDoc('conv-jour','conv-mois','conv-annee');
  initialiserSelectHeure('conv-heure');

  convocationFond.hidden = false;
  requestAnimationFrame(function() { modaleConvocation.focus(); });
  trapConvocation = creerFocusTrap('modale-convocation', fermerModaleConvocation);
  document.addEventListener('keydown', trapConvocation);
}

function fermerModaleConvocation() {
  convocationFond.hidden = true;
  document.removeEventListener('keydown', trapConvocation);
  if (elementAvantConvocation) elementAvantConvocation.focus();
}

document.getElementById('btn-convocation').addEventListener('click', ouvrirModaleConvocation);
document.getElementById('btn-fermer-convocation').addEventListener('click', fermerModaleConvocation);
document.getElementById('btn-annuler-convocation').addEventListener('click', fermerModaleConvocation);
document.getElementById('convocation-fond').addEventListener('click', function(ev) {
  if (ev.target === convocationFond) fermerModaleConvocation();
});

document.getElementById('btn-mail-convocation').addEventListener('click', function() {
  const annee  = document.getElementById('conv-annee').value || anneeEnCours();
  const sujet  = encodeURIComponent(`Convocation Assemblée Générale HSI37 — ${annee}`);
  const odj    = document.getElementById('conv-odj').value || '';
  const date   = [document.getElementById('conv-jour').value, document.getElementById('conv-mois').value, document.getElementById('conv-annee').value].filter(Boolean).join('/') || '…';
  const heure  = (document.getElementById('conv-heure').value || '…') + 'h' + (document.getElementById('conv-minutes').value || '00');
  const lieu   = document.getElementById('conv-lieu').value || '…';
  const corps  = encodeURIComponent(`Cher(e) adhérent(e),\n\nVous êtes convoqué(e) à l'Assemblée Générale Ordinaire de l'association Handicap Solidarité pour l'Inclusion 37.\n\nDate : ${date}\nHeure : ${heure}\nLieu : ${lieu}\n\nOrdre du jour :\n${odj}\n\nNous comptons sur votre présence.\n\nCordialement,\nHSI37`);
  window.open(`mailto:?subject=${sujet}&body=${corps}`);
});

document.getElementById('formulaire-convocation').addEventListener('submit', function(ev) {
  ev.preventDefault();
  const jour    = document.getElementById('conv-jour').value;
  const mois    = document.getElementById('conv-mois').value;
  const annee   = document.getElementById('conv-annee').value;
  const heure   = document.getElementById('conv-heure').value;
  const minutes = document.getElementById('conv-minutes').value;
  const lieu    = document.getElementById('conv-lieu').value.trim();
  const odj     = document.getElementById('conv-odj').value.trim();
  const qualite = document.getElementById('conv-signataire').value;

  if (!jour || !mois || !annee || !heure || !lieu || !odj) {
    alert('Veuillez remplir tous les champs obligatoires.');
    return;
  }

  const dateFormatee = `${jour}/${mois}/${annee}`;
  const heureFormatee = `${heure}h${minutes}`;

  /* Peupler le div hors-écran */
  document.getElementById('conv-out-date').textContent  = dateFormatee;
  document.getElementById('conv-out-heure').textContent = heureFormatee;
  document.getElementById('conv-out-lieu').textContent  = lieu;
  document.getElementById('conv-out-fait-a').textContent = `Saint-Pierre-des-Corps, le ${dateJourFormate()}`;
  document.getElementById('conv-out-sig-qualite').textContent = qualite;
  document.getElementById('conv-out-sig-nom').textContent     = NOMS_SIGNATAIRES[qualite] || '';

  const liste = document.getElementById('conv-out-odj');
  liste.innerHTML = '';
  odj.split('\n').filter(Boolean).forEach(function(point) {
    const li = document.createElement('li');
    li.textContent = point.replace(/^\d+[\.\-\)]\s*/, '');
    liste.appendChild(li);
  });

  const btn   = this.querySelector('[type="submit"]');
  const label = btn.innerHTML;
  fermerModaleConvocation();
  captureEtTelecharger('doc-convocation', `convocation-AG-${annee}.png`, btn, label);
});

/* =====================================================
   DOCUMENT 5 — PROCÈS-VERBAL AG
   ===================================================== */

const pvFond   = document.getElementById('pv-fond');
const modalePV = document.getElementById('modale-pv');
let elementAvantPV = null;
let trapPV = null;

function ouvrirModalePV() {
  elementAvantPV = document.activeElement;
  initialiserSelectsDateDoc('pv-jour','pv-mois','pv-annee');
  initialiserSelectHeure('pv-heure-debut');
  initialiserSelectHeure('pv-heure-fin');

  pvFond.hidden = false;
  requestAnimationFrame(function() { modalePV.focus(); });
  trapPV = creerFocusTrap('modale-pv', fermerModalePV);
  document.addEventListener('keydown', trapPV);
}

function fermerModalePV() {
  pvFond.hidden = true;
  document.removeEventListener('keydown', trapPV);
  if (elementAvantPV) elementAvantPV.focus();
}

document.getElementById('btn-pv-ag').addEventListener('click', ouvrirModalePV);
document.getElementById('btn-fermer-pv').addEventListener('click', fermerModalePV);
document.getElementById('btn-annuler-pv').addEventListener('click', fermerModalePV);
document.getElementById('pv-fond').addEventListener('click', function(ev) {
  if (ev.target === pvFond) fermerModalePV();
});

document.getElementById('formulaire-pv').addEventListener('submit', function(ev) {
  ev.preventDefault();
  const jour       = document.getElementById('pv-jour').value;
  const mois       = document.getElementById('pv-mois').value;
  const annee      = document.getElementById('pv-annee').value;
  const hDebut     = document.getElementById('pv-heure-debut').value;
  const mDebut     = document.getElementById('pv-minutes-debut').value;
  const hFin       = document.getElementById('pv-heure-fin').value;
  const mFin       = document.getElementById('pv-minutes-fin').value;
  const lieu       = document.getElementById('pv-lieu').value.trim();
  const presents   = document.getElementById('pv-presents').value;
  const representes = document.getElementById('pv-representes').value;
  const president  = document.getElementById('pv-president-seance').value.trim();
  const secretaire = document.getElementById('pv-secretaire-seance').value.trim();
  const odj        = document.getElementById('pv-odj').value.trim();
  const resolutions = document.getElementById('pv-resolutions').value.trim();

  if (!jour || !mois || !annee) { alert('Veuillez indiquer la date de l\'AG.'); return; }

  const dateFormatee   = `${jour}/${mois}/${annee}`;
  const heureDebut     = hDebut ? `${hDebut}h${mDebut}` : '…';
  const heureFin       = hFin   ? `${hFin}h${mFin}`     : '…';

  document.getElementById('pv-out-intro').textContent   = `En date du ${dateFormatee}, à ${heureDebut}, au ${lieu || '…'}.`;
  document.getElementById('pv-out-presents').textContent   = presents || '—';
  document.getElementById('pv-out-representes').textContent = representes || '—';
  document.getElementById('pv-out-bureau').textContent  = `L'assemblée est présidée par ${president || '…'}, assisté(e) de ${secretaire || '…'}.`;
  document.getElementById('pv-out-levee').textContent   = `La séance est levée à ${heureFin}.`;
  document.getElementById('pv-out-president').textContent  = president;
  document.getElementById('pv-out-secretaire').textContent = secretaire;

  const listeOdj = document.getElementById('pv-out-odj');
  listeOdj.innerHTML = '';
  (odj || '').split('\n').filter(Boolean).forEach(function(point) {
    const li = document.createElement('li');
    li.textContent = point.replace(/^\d+[\.\-\)]\s*/, '');
    listeOdj.appendChild(li);
  });

  const divRes = document.getElementById('pv-out-resolutions');
  divRes.innerHTML = '';
  (resolutions || '').split('\n').filter(Boolean).forEach(function(ligne) {
    const p = document.createElement('p');
    p.textContent = ligne;
    divRes.appendChild(p);
  });

  const btn   = this.querySelector('[type="submit"]');
  const label = btn.innerHTML;
  fermerModalePV();
  captureEtTelecharger('doc-pv', `PV-AG-${annee}.png`, btn, label);
});

/* =====================================================
   DOCUMENT 6 — COURRIER LIBRE
   ===================================================== */

const courrierFond   = document.getElementById('courrier-fond');
const modaleCourrier = document.getElementById('modale-courrier');
let elementAvantCourrier = null;
let trapCourrier = null;

function ouvrirModaleCourrier() {
  elementAvantCourrier = document.activeElement;
  courrierFond.hidden  = false;
  requestAnimationFrame(function() { modaleCourrier.focus(); });
  trapCourrier = creerFocusTrap('modale-courrier', fermerModaleCourrier);
  document.addEventListener('keydown', trapCourrier);
}

function fermerModaleCourrier() {
  courrierFond.hidden = true;
  document.removeEventListener('keydown', trapCourrier);
  if (elementAvantCourrier) elementAvantCourrier.focus();
}

document.getElementById('btn-courrier').addEventListener('click', ouvrirModaleCourrier);
document.getElementById('btn-fermer-courrier').addEventListener('click', fermerModaleCourrier);
document.getElementById('btn-annuler-courrier').addEventListener('click', fermerModaleCourrier);
document.getElementById('courrier-fond').addEventListener('click', function(ev) {
  if (ev.target === courrierFond) fermerModaleCourrier();
});

document.getElementById('formulaire-courrier').addEventListener('submit', function(ev) {
  ev.preventDefault();
  const destinataire = document.getElementById('courrier-destinataire').value.trim();
  const objet        = document.getElementById('courrier-objet').value.trim();
  const corps        = document.getElementById('courrier-corps').value.trim();
  const qualite      = document.getElementById('courrier-signataire').value;

  if (!objet || !corps) { alert('L\'objet et le corps du courrier sont obligatoires.'); return; }

  const today = new Date();
  const dateStr = `${today.getDate()} ${MOIS_NOMS[today.getMonth()]} ${today.getFullYear()}`;

  document.getElementById('courrier-out-lieu-date').textContent = `Saint-Pierre-des-Corps, le ${dateStr}`;
  document.getElementById('courrier-out-objet').textContent     = objet;
  document.getElementById('courrier-out-sig-qualite').textContent = qualite;
  document.getElementById('courrier-out-sig-nom').textContent   = NOMS_SIGNATAIRES[qualite] || '';

  const divDest = document.getElementById('courrier-out-destinataire');
  divDest.innerHTML = '';
  if (destinataire) {
    destinataire.split('\n').forEach(function(ligne) {
      const p = document.createElement('p');
      p.textContent = ligne;
      divDest.appendChild(p);
    });
  }

  const divCorps = document.getElementById('courrier-out-corps');
  divCorps.innerHTML = '';
  corps.split('\n').forEach(function(ligne) {
    const p = document.createElement('p');
    p.textContent = ligne || ' ';
    divCorps.appendChild(p);
  });

  const dateFichier = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
  const btn   = this.querySelector('[type="submit"]');
  const label = btn.innerHTML;
  fermerModaleCourrier();
  captureEtTelecharger('doc-courrier', `courrier-HSI37-${dateFichier}.png`, btn, label);
});

/* ---------- PAPIER À EN-TÊTE ---------- */
document.getElementById("btn-papier-entete").addEventListener("click", function() {
  const btn = this;
  btn.disabled = true;
  const texteOriginal = btn.innerHTML;
  btn.textContent = "Chargement…";

  fetch("docs/modeles/papier-entete-HSI37.docx")
    .then(function(r) {
      if (!r.ok) throw new Error("Fichier introuvable");
      return r.blob();
    })
    .then(function(blob) {
      const url  = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href     = url;
      lien.download = "papier-entete-HSI37.docx";
      document.body.appendChild(lien);
      lien.click();
      setTimeout(function() {
        document.body.removeChild(lien);
        URL.revokeObjectURL(url);
      }, 200);
    })
    .catch(function() {
      alert("Impossible de télécharger le fichier. Veuillez contacter l'administrateur.");
    })
    .finally(function() {
      btn.disabled = false;
      btn.innerHTML = texteOriginal;
    });
});

/* =====================================================
   MODALE POLITIQUE DE CONFIDENTIALITÉ (RGPD)
   ===================================================== */

let elementAvantModaleRgpd = null;

function ouvrirModaleRgpd() {
  const fond   = document.getElementById("modale-rgpd-fond");
  const modale = document.getElementById("modale-rgpd");
  elementAvantModaleRgpd = document.activeElement;
  fond.hidden = false;
  modale.focus();
  document.addEventListener("keydown", gererToucheRgpd);
}

function fermerModaleRgpd() {
  document.getElementById("modale-rgpd-fond").hidden = true;
  document.removeEventListener("keydown", gererToucheRgpd);
  if (elementAvantModaleRgpd) elementAvantModaleRgpd.focus();
}

function gererToucheRgpd(evenement) {
  if (evenement.key === "Escape") {
    fermerModaleRgpd();
    return;
  }
  if (evenement.key === "Tab") {
    const modale   = document.getElementById("modale-rgpd");
    const elements = modale.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const premier = elements[0];
    const dernier = elements[elements.length - 1];
    if (evenement.shiftKey) {
      if (document.activeElement === premier) { evenement.preventDefault(); dernier.focus(); }
    } else {
      if (document.activeElement === dernier)  { evenement.preventDefault(); premier.focus(); }
    }
  }
}

document.getElementById("btn-ouvrir-rgpd").addEventListener("click", ouvrirModaleRgpd);
document.getElementById("btn-fermer-rgpd").addEventListener("click", fermerModaleRgpd);
document.getElementById("modale-rgpd-fond").addEventListener("click", function(e) {
  if (e.target === this) fermerModaleRgpd();
});

/* =====================================================
   EXPORT CSV DES DONNÉES
   ===================================================== */

function afficherMessageSuccesDoc(texte) {
  const zone = document.getElementById("message-succes-docs");
  zone.textContent = texte;
  zone.hidden = false;
  setTimeout(function() { zone.hidden = true; zone.textContent = ""; }, 5000);
}

function afficherMessageErreurDoc(texte) {
  const zone = document.getElementById("message-erreur-docs");
  zone.textContent = texte;
  zone.hidden = false;
  setTimeout(function() { zone.hidden = true; zone.textContent = ""; }, 7000);
}

/* Génère un CSV avec BOM UTF-8 et séparateur point-virgule (compatible Excel français) */
function genererCSV(donnees, colonnes) {
  const bom    = '﻿';
  const entete = colonnes.join(';');
  const lignes = donnees.map(function(ligne) {
    return colonnes.map(function(col) {
      const val = ligne[col] !== null && ligne[col] !== undefined ? String(ligne[col]) : '';
      if (val.includes(';') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(';');
  });
  return bom + entete + '\n' + lignes.join('\n');
}

function telechargerFichier(contenu, nomFichier) {
  const blob = new Blob([contenu], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href     = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  setTimeout(function() { document.body.removeChild(lien); URL.revokeObjectURL(url); }, 200);
}

document.getElementById("btn-exporter-donnees").addEventListener("click", async function() {
  const btn          = this;
  btn.disabled       = true;
  const texteOriginal = btn.innerHTML;
  btn.textContent    = 'Export en cours…';

  try {
    const [resAdh, resDon] = await Promise.all([
      clientSupabase.from('adherents').select('*').order('nom', { ascending: true }),
      clientSupabase.from('donateurs').select('*').order('nom', { ascending: true })
    ]);

    if (resAdh.error) throw new Error('Adhérents : ' + resAdh.error.message);
    if (resDon.error) throw new Error('Donateurs : ' + resDon.error.message);

    const d       = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const colAdh = resAdh.data.length > 0 ? Object.keys(resAdh.data[0]) : [];
    const colDon = resDon.data.length > 0 ? Object.keys(resDon.data[0]) : [];

    telechargerFichier(genererCSV(resAdh.data, colAdh), `export-adherents-${dateStr}.csv`);
    /* Délai court pour éviter le blocage du second téléchargement par le navigateur */
    setTimeout(function() {
      telechargerFichier(genererCSV(resDon.data, colDon), `export-donateurs-${dateStr}.csv`);
    }, 400);

    afficherMessageSuccesDoc('Données exportées avec succès.');
  } catch (erreur) {
    afficherMessageErreurDoc('Export échoué : ' + erreur.message);
  } finally {
    btn.disabled    = false;
    btn.innerHTML   = texteOriginal;
  }
});

/* ---------- INITIALISATION ---------- */
document.addEventListener("DOMContentLoaded", function() {
  initialiserSelectsDate();
  initialiserSelectsDateDon();
  verifierSession();
});
