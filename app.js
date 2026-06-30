/* =====================================================
   APP.JS — HSI37 Dashboard
   Phase 2.5 : Modification et suppression d'adhérents
   ===================================================== */

/* =====================================================
   SÉCURITÉ : les tables Supabase ont le RLS activé.
   Seuls les utilisateurs authentifiés (authenticated) peuvent lire/écrire.
   La clé utilisée est la clé publishable (publique), PAS la clé service_role.
   ===================================================== */

/* ---------- ENVOI DES REÇUS PAR MAIL — via Edge Function Supabase ---------- */

async function envoyerRecuParMail(pdfBlob, nomFichier, emailDestinataire, nomDestinataire, qualiteSignataire, nomSignataire) {
  const base64 = await new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload  = function() { resolve(reader.result.split(',')[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(pdfBlob);
  });

  const signatureHTML = `
    <hr style="border:none;border-top:2px solid #F7CD46;margin:24px 0 16px;">
    <table style="font-family:Open Sans,Arial,sans-serif;font-size:13px;color:#403E3E;">
      <tr>
        <td style="padding-right:16px;vertical-align:top;">
          <img src="https://hsi37-dashboard.pages.dev/assets/hsi37-redim-demi.png"
               alt="Logo HSI37" width="80" style="display:block;">
        </td>
        <td style="vertical-align:top;">
          <strong style="font-size:14px;">${nomSignataire || ''}</strong><br>
          <span style="color:#3B77B4;font-weight:600;">${qualiteSignataire || ''} de l'Association HSI37 — Handicap Solidarité pour l'Inclusion 37</span><br><br>
          📱 07 43 29 58 30<br>
          ✉ handicapsi37@gmail.com<br>
          🌐 www.hsi37.fr<br><br>
          <span style="color:#F7CD46;font-weight:600;">🏷 Soutenez nos actions :</span>
          <a href="https://hsi37.fr/don" style="color:#3B77B4;">Faire un don</a> ou
          <a href="https://hsi37.fr/adhesion" style="color:#3B77B4;">Devenir membre</a>
        </td>
      </tr>
    </table>
  `;

  const contenuHTML = `
    <p>Bonjour${nomDestinataire ? ' ' + nomDestinataire : ''},</p>
    <p>Veuillez trouver ci-joint votre reçu.</p>
    <p>Cordialement,</p>
    ${signatureHTML}
  `;

  const { error } = await clientSupabase.functions.invoke('envoyer-recu', {
    body: {
      emailDestinataire,
      nomDestinataire,
      sujet: "Votre reçu HSI37",
      contenuHTML,
      pdfBase64: base64,
      nomFichierPDF: nomFichier,
    },
  });

  if (error) throw new Error("Erreur Edge Function");
}

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
let donneesAdherents   = [];
let donneesCotisations = [];
let donneesEvenements    = [];
let donneesParticipants  = [];

var selectionAdherents    = new Set();
var selectionDonateurs    = new Set();
var selectionParticipants = new Set();

function mettreAJourBoutonEnvoyer() {
  var total = selectionAdherents.size + selectionDonateurs.size + selectionParticipants.size;
  document.querySelectorAll(".btn-envoyer-selectionnes").forEach(function(btn) {
    btn.hidden = total === 0;
    btn.textContent = total > 0
      ? "✉ Envoyer aux sélectionnés (" + total + ")"
      : "✉ Envoyer aux sélectionnés";
  });
}

var filtreAdherents    = "";
var filtreAnneeAdherents = String(new Date().getFullYear());
var triAdherents     = { colonne: null, sens: "asc" };

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
  return "enretard";
}

function derniereCotisation(adherentId) {
  const cotis = donneesCotisations.filter(function(c) {
    return String(c.adherent_id) === String(adherentId);
  });
  if (!cotis.length) return null;
  return cotis.reduce(function(max, c) {
    if (c.annee !== max.annee) return c.annee > max.annee ? c : max;
    return (c.date_paiement || "") > (max.date_paiement || "") ? c : max;
  }, cotis[0]);
}

function dernierDon(donateurId) {
  const dons = donneesDons.filter(function(d) {
    return String(d.donateur_id) === String(donateurId);
  });
  if (!dons.length) return null;
  return dons.reduce(function(max, d) { return d.annee > max.annee ? d : max; }, dons[0]);
}

function calculerStatutAdherent(adherent) {
  const derniere = derniereCotisation(adherent.id);
  return calculerStatut(derniere ? derniere.annee : adherent.saison);
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

  selectionAdherents.clear();
  var selAll = document.getElementById("sel-all-adherents");
  if (selAll) { selAll.checked = false; selAll.indeterminate = false; }
  mettreAJourBoutonEnvoyer();

  corps.innerHTML = "";

  if (!adherents || adherents.length === 0) {
    corps.innerHTML = `
      <tr>
        <td colspan="12" class="tableau-message">
          Aucun adhérent enregistré pour l'instant.
        </td>
      </tr>
    `;
    return;
  }

  adherents.forEach(function(adherent) {
    const ligne       = document.createElement("tr");
    const derniere    = derniereCotisation(adherent.id);
    const montant     = derniere
      ? Number(derniere.montant).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
      : "—";
    const modePmt     = derniere ? (derniere.mode_paiement || "—") : "—";
    const statut      = calculerStatutAdherent(adherent);

    ligne.innerHTML = `
      <td class="col-select"><input type="checkbox" class="case-selection-adh" data-id="${adherent.id}" aria-label="Sélectionner ${adherent.prenom || ""} ${adherent.nom || ""}"></td>
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
      <td>${modePmt}</td>
      <td>${genererBadge(statut)}</td>
      <td class="col-actions">${genererBoutonsActions(adherent.id_adherent || adherent.id, adherent.id, statut)}</td>
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

  const [resAdh, resCotis] = await Promise.all([
    clientSupabase.from("adherents").select("*"),
    clientSupabase.from("cotisations").select("*")
  ]);

  if (resAdh.error) {
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

  donneesCotisations = resCotis.data || [];
  donneesAdherents   = resAdh.data;
  appliquerFiltreAdherents();
  mettreAJourStats();
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
  document.getElementById("groupe-cheque-adh").hidden = (mode !== "chèque");

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
  const dernCotis = derniereCotisation(adherent.id);
  document.getElementById("champ-montant").value =
    (dernCotis && dernCotis.montant != null)
      ? dernCotis.montant
      : (adherent.montant_cotisation != null ? adherent.montant_cotisation : "");
  const modeVal = (dernCotis && dernCotis.mode_paiement) || adherent.mode_paiement || "";
  document.getElementById("champ-mode-paiement").value = modeVal.toLowerCase().trim();
  document.getElementById("champ-montant-don").value   = "";

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
        mode_paiement:      modePaiement || null,
        type_membre:        typeMembre,
        civilite
      })
      .eq("id", adherentEnCours.id);

    if (error) {
      console.error("[adherent UPDATE] Erreur Supabase:", JSON.stringify(error));
      zoneErreurModale.textContent = "La modification a échoué. Vérifiez votre connexion et réessayez.";
      zoneErreurModale.hidden = false;
      return;
    }

    if (montantCotisation) {
      const aujourdhui   = new Date().toISOString().split("T")[0];
      const anneeEnCours = new Date().getFullYear();

      const cotisExistante = donneesCotisations.find(function(c) {
        return String(c.adherent_id) === String(adherentEnCours.id)
            && Number(c.annee) === anneeEnCours;
      });

      let resCotis;
      if (cotisExistante) {
        resCotis = await clientSupabase
          .from("cotisations")
          .update({ montant: montantCotisation, mode_paiement: modePaiement || null, date_paiement: aujourdhui })
          .eq("adherent_id", adherentEnCours.id)
          .eq("annee", anneeEnCours)
          .select();
      } else {
        resCotis = await clientSupabase
          .from("cotisations")
          .insert([{ adherent_id: adherentEnCours.id, annee: anneeEnCours, date_paiement: aujourdhui, montant: montantCotisation, mode_paiement: modePaiement || null }])
          .select();
      }

      if (resCotis.error || !resCotis.data || resCotis.data.length === 0) {
        afficherMessageErreur(`Adhérent modifié, mais l'enregistrement de la cotisation a échoué.`);
        return;
      }
    }

    if (modePaiement === "chèque") {
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
      mode_paiement:      modePaiement || null,
      type_membre:        typeMembre,
      saison
    };

    const { data: dataInsert, error } = await clientSupabase
      .from("adherents")
      .insert([nouvelAdherent])
      .select("id")
      .single();

    if (error) {
      zoneErreurModale.textContent = "L'enregistrement a échoué. Vérifiez votre connexion et réessayez.";
      zoneErreurModale.hidden = false;
      return;
    }

    if (dataInsert && montantCotisation) {
      const { error: errCotisAjout } = await clientSupabase.from("cotisations").insert([{
        adherent_id:   dataInsert.id,
        annee:         parseInt(anneeSaisie, 10),
        date_paiement: dateAdhesion,
        montant:       montantCotisation,
        mode_paiement: modePaiement || null
      }]);
      if (errCotisAjout) {
        afficherMessageErreur(`Adhérent ajouté (${idAdherent}), mais l'enregistrement de la cotisation a échoué.`);
      }
    }

    fermerModale();
    await chargerAdherents();

    if (modePaiement === "chèque") {
      const nouvelAdherentEnCache = donneesAdherents.find(function(a) { return a.id_adherent === idAdherent; });
      if (nouvelAdherentEnCache) {
        champsChequesAdherents.set(String(nouvelAdherentEnCache.id), { numero_cheque: numeroCheque, banque: banqueAdh });
      }
    }

    if (montantDon && montantDon > 0) {
      const msgErrDon = `Adhérent ajouté (${idAdherent}), mais l'enregistrement du don a échoué — veuillez le saisir manuellement dans le panneau Donateurs.`;

      let donateurExistant = null;
      if (email) {
        const { data: trouvé } = await clientSupabase
          .from("donateurs")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        donateurExistant = trouvé || null;
      }

      if (donateurExistant) {
        const { error: errorDon } = await clientSupabase.from("dons").insert([{
          donateur_id:   donateurExistant.id,
          annee:         parseInt(saison, 10),
          date_don:      dateAdhesion,
          montant:       montantDon,
          mode_paiement: modePaiement || null,
          type_don:      "Don financier"
        }]);
        if (errorDon) { afficherMessageErreur(msgErrDon); return; }
      } else {
        let idDonateur;
        try {
          idDonateur = await genererIdDonateur(saison);
        } catch (_) {
          afficherMessageErreur(msgErrDon);
          return;
        }
        const { error: errorDon } = await clientSupabase.from("donateurs").insert([{
          id_donateur:     idDonateur,
          nom,
          prenom,
          civilite,
          organisme:       null,
          email,
          telephone,
          adresse,
          type_don:        "Don financier",
          montant_don:     montantDon,
          date_don:        dateAdhesion,
          mode_paiement:   modePaiement,
          description_don: null,
          numero_cheque:   null,
          banque_cheque:   null
        }]);
        if (errorDon) { afficherMessageErreur(msgErrDon); return; }
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
const sectionProfil     = document.getElementById("section-profil");

/* Affiche le hub : masque tout sauf le hub */
function afficherHub() {
  hubAccueil.hidden        = false;
  navOnglets.hidden        = true;
  document.getElementById("panneau-adherents").hidden = true;
  document.getElementById("panneau-donateurs").hidden = true;
  document.getElementById("panneau-evenements").hidden = true;
  sectionDocuments.hidden  = true;
  sectionSignatures.hidden = true;
  sectionRgpd.hidden       = true;
  if (sectionProfil) sectionProfil.hidden = true;
  btnRetourAccueil.hidden  = true;
}

/* Navigue vers une section depuis le hub */
function allerVers(vue) {
  hubAccueil.hidden        = true;
  btnRetourAccueil.hidden  = false;
  sectionDocuments.hidden  = true;
  sectionSignatures.hidden = true;
  sectionRgpd.hidden       = true;
  if (sectionProfil) sectionProfil.hidden = true;

  if (vue === "adherents") {
    navOnglets.hidden = false;
    activerOnglet("panneau-adherents");
    chargerAdherents();
  } else if (vue === "donateurs") {
    navOnglets.hidden = false;
    activerOnglet("panneau-donateurs");
    chargerDonateurs();
  } else if (vue === "evenements") {
    navOnglets.hidden = false;
    activerOnglet("panneau-evenements");
    chargerEvenements();
  } else if (vue === "documents") {
    navOnglets.hidden = true;
    document.getElementById("panneau-adherents").hidden = true;
    document.getElementById("panneau-donateurs").hidden = true;
    document.getElementById("panneau-evenements").hidden = true;
    sectionDocuments.hidden = false;
  } else if (vue === "signatures") {
    navOnglets.hidden = true;
    document.getElementById("panneau-adherents").hidden = true;
    document.getElementById("panneau-donateurs").hidden = true;
    document.getElementById("panneau-evenements").hidden = true;
    sectionSignatures.hidden = false;
  } else if (vue === "rgpd") {
    navOnglets.hidden = true;
    document.getElementById("panneau-adherents").hidden = true;
    document.getElementById("panneau-donateurs").hidden = true;
    document.getElementById("panneau-evenements").hidden = true;
    sectionRgpd.hidden = false;
  }
}

function afficherTableauDeBord() {
  ecranConnexion.hidden   = true;
  entetePrincipal.hidden  = false;
  contenuPrincipal.hidden = false;
  piedDePage.hidden       = false;
  afficherHub();
  chargerAdherents();
  chargerDonateurs();
  chargerEvenements();
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
   DÉCONNEXION AUTOMATIQUE APRÈS 30 MIN D'INACTIVITÉ
   ===================================================== */
(function() {
  const DUREE_INACTIVITE = 30 * 60 * 1000; // 30 minutes en millisecondes
  let minuteurInactivite;

  function reinitialiserMinuteur() {
    clearTimeout(minuteurInactivite);
    minuteurInactivite = setTimeout(async function() {
      await clientSupabase.auth.signOut();
      afficherEcranConnexion();
      const zoneErreur = document.getElementById("connexion-erreur");
      if (zoneErreur) {
        zoneErreur.textContent = "Session expirée — veuillez vous reconnecter.";
        zoneErreur.hidden = false;
      }
    }, DUREE_INACTIVITE);
  }

  ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(function(evenement) {
    document.addEventListener(evenement, reinitialiserMinuteur, { passive: true });
  });

  reinitialiserMinuteur();
})();

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
  for (let a = 2024; a <= anneeActuelle; a++) {
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
    "panneau-donateurs": "onglet-donateurs",
    "panneau-evenements": "onglet-evenements"
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
document.getElementById("onglet-evenements").addEventListener("click", function() {
  activerOnglet("panneau-evenements");
  chargerEvenements();
});

/* =====================================================
   SECTION ÉVÉNEMENTS
   ===================================================== */

var filtreEvenements = "";
var filtreAnneeEvenements = String(new Date().getFullYear());

async function chargerEvenements() {
  const [resEv, resPart] = await Promise.all([
    clientSupabase.from("evenements").select("*").order("date", { ascending: false }),
    clientSupabase.from("participants_evenements").select("*")
  ]);

  if (resEv.error) {
    console.error("Erreur chargement événements:", resEv.error);
    return;
  }

  donneesEvenements   = resEv.data  || [];
  donneesParticipants = resPart.data || [];

  remplirTableauEvenements();
  mettreAJourStats();

  const inputRecherche = document.getElementById("recherche-evenements");
  if (inputRecherche && !inputRecherche._listenerEv) {
    inputRecherche._listenerEv = true;
    inputRecherche.addEventListener("input", function() {
      filtreEvenements = this.value.toLowerCase();
      remplirTableauEvenements();
    });
  }
}

function remplirTableauEvenements() {
  const corps = document.getElementById("corps-tableau-evenements");
  if (!corps) return;

  selectionParticipants.clear();
  mettreAJourBoutonEnvoyer();

  const liste = donneesEvenements.filter(function(ev) {
    if (filtreAnneeEvenements && ev.date &&
        new Date(ev.date).getFullYear() !== Number(filtreAnneeEvenements)) return false;
    if (filtreEvenements && !(ev.nom || "").toLowerCase().includes(filtreEvenements)) return false;
    return true;
  });

  if (!liste.length) {
    corps.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1rem;color:#666;">Aucun événement trouvé.</td></tr>';
    return;
  }

  corps.innerHTML = liste.map(function(ev) {
    const participants = donneesParticipants.filter(function(p) {
      return String(p.evenement_id) === String(ev.id);
    });
    const nbParticipants = participants.reduce(function(sum, p) { return sum + (p.quantite || 1); }, 0);
    const total = participants.reduce(function(sum, p) { return sum + (parseFloat(p.montant) || 0); }, 0);
    const date = ev.date ? new Date(ev.date).toLocaleDateString("fr-FR") : "—";
    const prix = ev.prix_unitaire != null ? parseFloat(ev.prix_unitaire).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €" : "—";
    const totalStr = total > 0 ? total.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €" : "0,00 €";

    const lignesParticipants = [
      `<tr class="sous-ligne-participant sous-ligne-entete" data-ev="${ev.id}" hidden>
        <th></th><th class="col-select"></th><th>Nom / Prénom</th><th>Email</th><th>Téléphone</th><th>Quantité</th><th>Montant</th><th>Actions</th>
      </tr>`
    ].concat(participants.map(function(p) {
      const montantP = p.montant != null ? parseFloat(p.montant).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €" : "—";
      return `<tr class="sous-ligne-participant" data-ev="${ev.id}" data-part-id="${p.id}" hidden>
        <td></td>
        <td class="col-select"><input type="checkbox" class="case-selection-part" data-id="${p.id}" data-ev="${ev.id}" aria-label="Sélectionner ${(p.prenom || "")} ${(p.nom || "")}"></td>
        <td>${(p.prenom || "") + " " + (p.nom || "")}</td>
        <td>${p.email || "—"}</td>
        <td>${p.telephone || "—"}</td>
        <td>${p.quantite || 1}</td>
        <td>${montantP}</td>
        <td>
          <button type="button" class="btn-icone btn-modifier-participant"
                  data-ev="${ev.id}" data-part-id="${p.id}"
                  title="Modifier" aria-label="Modifier le participant">
            <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 24 24" width="15" height="15">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                    stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                    stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg>
          </button>
          <button type="button" class="btn-icone btn-supprimer-participant"
                  data-ev="${ev.id}" data-part-id="${p.id}"
                  title="Supprimer" aria-label="Supprimer le participant">
            <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 24 24" width="15" height="15">
              <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"
                        fill="none" stroke-linecap="round"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                    stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
              <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2"
                    fill="none" stroke-linecap="round"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                    stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg>
          </button>
        </td>
      </tr>`;
    })).concat([
      `<tr class="sous-ligne-participant sous-ligne-ajout" data-ev="${ev.id}" hidden>
        <td colspan="8" style="padding:0.4rem 0.75rem;">
          <button type="button" class="btn btn--secondaire btn-ajouter-participant"
                  data-ev="${ev.id}" style="font-size:0.82rem;padding:0.3rem 0.8rem;">
            + Ajouter un participant
          </button>
        </td>
      </tr>`
    ]).join("");

    const btnToggle = `<button type="button" class="btn-toggle-participants" data-ev="${ev.id}" aria-expanded="false">${nbParticipants} participant${nbParticipants > 1 ? "s" : ""} ▼</button>`;

    return `<tr class="ligne-evenement" data-ev="${ev.id}">
      <td>${ev.nom || "—"}</td>
      <td>${date}</td>
      <td>${prix}</td>
      <td>${btnToggle}</td>
      <td>${totalStr}</td>
      <td>
        <button type="button" class="btn-icone btn-modifier-evenement"
                data-ev-id="${ev.id}" title="Modifier" aria-label="Modifier l'événement">
          <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"
               viewBox="0 0 24 24" width="17" height="17">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                  stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                  stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
          </svg>
        </button>
        <button type="button" class="btn-icone btn-supprimer-evenement"
                data-ev-id="${ev.id}" title="Supprimer" aria-label="Supprimer l'événement">
          <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"
               viewBox="0 0 24 24" width="17" height="17">
            <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"
                      fill="none" stroke-linecap="round"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                  stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2"
                  fill="none" stroke-linecap="round"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                  stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
          </svg>
        </button>
        <span style="position:relative;display:inline-block;">
          <button type="button" class="btn-icone btn-export-participants"
                  data-ev-id="${ev.id}" data-ev-nom="${(ev.nom || '').replace(/"/g, '&quot;')}"
                  title="Exporter participants" aria-label="Exporter les participants">
            <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 24 24" width="17" height="17">
              <path d="M12 15V3M12 15l-4-4M12 15l4-4M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"
                    stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="menu-export-participants" data-ev-id="${ev.id}" hidden
               style="position:absolute;right:0;top:100%;z-index:200;background:#fff;
                      border:1px solid #d0d7e2;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.12);
                      min-width:130px;padding:4px 0;">
            <button type="button" class="btn-export-part-csv" data-ev-id="${ev.id}" data-ev-nom="${(ev.nom || '').replace(/"/g, '&quot;')}"
                    style="display:block;width:100%;text-align:left;padding:7px 14px;background:none;
                           border:none;cursor:pointer;font-size:.85rem;color:#403E3E;">
              ⬇ CSV
            </button>
            <button type="button" class="btn-export-part-pdf" data-ev-id="${ev.id}" data-ev-nom="${(ev.nom || '').replace(/"/g, '&quot;')}"
                    style="display:block;width:100%;text-align:left;padding:7px 14px;background:none;
                           border:none;cursor:pointer;font-size:.85rem;color:#403E3E;">
              ⬇ PDF
            </button>
          </div>
        </span>
      </td>
    </tr>${lignesParticipants}`;
  }).join("");

  if (!corps._listenerToggle) {
    corps._listenerToggle = true;
    corps.addEventListener("click", function(e) {

      const btnToggle = e.target.closest(".btn-toggle-participants");
      if (btnToggle) {
        const idEv = btnToggle.dataset.ev;
        const ouvert = btnToggle.getAttribute("aria-expanded") === "true";
        corps.querySelectorAll(`.sous-ligne-participant[data-ev="${idEv}"]`).forEach(function(tr) {
          tr.hidden = ouvert;
        });
        btnToggle.setAttribute("aria-expanded", ouvert ? "false" : "true");
        btnToggle.textContent = ouvert
          ? btnToggle.textContent.replace("▲", "▼")
          : btnToggle.textContent.replace("▼", "▲");
        return;
      }

      const btnModifier = e.target.closest(".btn-modifier-participant");
      if (btnModifier) {
        const participant = donneesParticipants.find(function(p) {
          return String(p.id) === String(btnModifier.dataset.partId);
        });
        ouvrirModaleParticipant(btnModifier.dataset.ev, participant);
        return;
      }

      const btnSupprimer = e.target.closest(".btn-supprimer-participant");
      if (btnSupprimer) {
        supprimerParticipant(btnSupprimer.dataset.partId, btnSupprimer.dataset.ev);
        return;
      }

      const btnAjouter = e.target.closest(".btn-ajouter-participant");
      if (btnAjouter) {
        ouvrirModaleParticipant(btnAjouter.dataset.ev, null);
        return;
      }

      const btnModifierEv = e.target.closest(".btn-modifier-evenement");
      if (btnModifierEv) {
        const ev = donneesEvenements.find(function(e) {
          return String(e.id) === String(btnModifierEv.dataset.evId);
        });
        ouvrirModaleEvenement(ev);
        return;
      }

      const btnSupprimerEv = e.target.closest(".btn-supprimer-evenement");
      if (btnSupprimerEv) {
        supprimerEvenement(btnSupprimerEv.dataset.evId);
        return;
      }

      const btnExportPart = e.target.closest(".btn-export-participants");
      if (btnExportPart) {
        const menu = btnExportPart.nextElementSibling;
        const etaitFerme = !menu || menu.hidden;
        document.querySelectorAll(".menu-export-participants").forEach(function(m) { m.hidden = true; });
        if (menu) menu.hidden = !etaitFerme;
        return;
      }

      const btnCsv = e.target.closest(".btn-export-part-csv");
      if (btnCsv) {
        const parts = donneesParticipants.filter(function(p) {
          return String(p.evenement_id) === String(btnCsv.dataset.evId);
        });
        exporterParticipantsCSV(parts, btnCsv.dataset.evNom);
        document.querySelectorAll(".menu-export-participants").forEach(function(m) { m.hidden = true; });
        return;
      }

      const btnPdf = e.target.closest(".btn-export-part-pdf");
      if (btnPdf) {
        const parts = donneesParticipants.filter(function(p) {
          return String(p.evenement_id) === String(btnPdf.dataset.evId);
        });
        exporterParticipantsPDF(parts, btnPdf.dataset.evNom);
        document.querySelectorAll(".menu-export-participants").forEach(function(m) { m.hidden = true; });
        return;
      }

    });
  }

  if (!corps._listenerChange) {
    corps._listenerChange = true;
    corps.addEventListener("change", function(ev) {
      var cb = ev.target.closest(".case-selection-part");
      if (!cb) return;
      if (cb.checked) selectionParticipants.add(cb.dataset.id);
      else selectionParticipants.delete(cb.dataset.id);
      mettreAJourBoutonEnvoyer();
    });
  }
}

function ouvrirModaleParticipant(idEv, participant) {
  const modeModif = !!participant;

  let modale = document.getElementById("modale-participant");
  if (modale) modale.remove();

  modale = document.createElement("div");
  modale.id = "modale-participant";
  modale.className = "modale-fond";
  modale.setAttribute("role", "dialog");
  modale.setAttribute("aria-modal", "true");
  modale.setAttribute("aria-labelledby", "titre-modale-participant");
  modale.innerHTML = `
    <div class="modale" style="max-width:480px;">
      <div class="modale__entete">
        <h2 class="modale__titre" id="titre-modale-participant">
          ${modeModif ? "Modifier le participant" : "Ajouter un participant"}
        </h2>
        <button type="button" class="modale__fermer" id="btn-fermer-participant" aria-label="Fermer">✕</button>
      </div>
      <form id="formulaire-participant" class="modale__formulaire" novalidate>
        <div class="champ-groupe">
          <label class="champ-label" for="part-nom">Nom <span aria-hidden="true">*</span></label>
          <input type="text" id="part-nom" class="champ-input"
                 value="${modeModif ? (participant.nom || "") : ""}" required>
        </div>
        <div class="champ-groupe">
          <label class="champ-label" for="part-prenom">Prénom</label>
          <input type="text" id="part-prenom" class="champ-input"
                 value="${modeModif ? (participant.prenom || "") : ""}">
        </div>
        <div class="champ-groupe">
          <label class="champ-label" for="part-email">Email</label>
          <input type="email" id="part-email" class="champ-input"
                 value="${modeModif ? (participant.email || "") : ""}">
        </div>
        <div class="champ-groupe">
          <label class="champ-label" for="part-telephone">Téléphone</label>
          <input type="tel" id="part-telephone" class="champ-input"
                 value="${modeModif ? (participant.telephone || "") : ""}">
        </div>
        <div class="champ-groupe">
          <label class="champ-label" for="part-quantite">Quantité</label>
          <input type="number" id="part-quantite" class="champ-input"
                 min="1" step="1" value="${modeModif ? (participant.quantite || 1) : 1}">
        </div>
        <div class="champ-groupe">
          <label class="champ-label" for="part-montant">Montant (€)</label>
          <input type="number" id="part-montant" class="champ-input"
                 min="0" step="1" value="${modeModif ? (participant.montant || "") : ""}">
        </div>
        <div id="erreur-participant" class="message-erreur" role="alert" hidden></div>
        <div class="modale__actions">
          <button type="button" class="btn btn--secondaire" id="btn-annuler-participant">Annuler</button>
          <button type="submit" class="btn btn--primaire">${modeModif ? "Enregistrer" : "Ajouter"}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modale);

  const fermer = function() { modale.remove(); };
  document.getElementById("btn-fermer-participant").addEventListener("click", fermer);
  document.getElementById("btn-annuler-participant").addEventListener("click", fermer);
  modale.addEventListener("click", function(e) { if (e.target === modale) fermer(); });

  document.getElementById("formulaire-participant").addEventListener("submit", async function(e) {
    e.preventDefault();
    const zoneErreur = document.getElementById("erreur-participant");
    zoneErreur.hidden = true;

    const nom = document.getElementById("part-nom").value.trim();
    if (!nom) {
      zoneErreur.textContent = "Le nom est obligatoire.";
      zoneErreur.hidden = false;
      return;
    }

    const payload = {
      evenement_id: idEv,
      nom,
      prenom:    document.getElementById("part-prenom").value.trim()    || null,
      email:     document.getElementById("part-email").value.trim()     || null,
      telephone: document.getElementById("part-telephone").value.trim() || null,
      quantite:  parseInt(document.getElementById("part-quantite").value, 10) || 1,
      montant:   parseFloat(document.getElementById("part-montant").value) || null,
    };

    let erreur;
    if (modeModif) {
      ({ error: erreur } = await clientSupabase
        .from("participants_evenements").update(payload).eq("id", participant.id));
    } else {
      ({ error: erreur } = await clientSupabase
        .from("participants_evenements").insert([payload]));
    }

    if (erreur) {
      zoneErreur.textContent = "Erreur lors de l'enregistrement.";
      zoneErreur.hidden = false;
      return;
    }

    fermer();
    await chargerEvenements();
    const corps = document.getElementById("corps-tableau-evenements");
    if (corps) {
      const btn = corps.querySelector(`.btn-toggle-participants[data-ev="${idEv}"]`);
      if (btn && btn.getAttribute("aria-expanded") === "false") btn.click();
    }
  });

  document.getElementById("part-nom").focus();
}

async function supprimerParticipant(idPart, idEv) {
  if (!confirm("Supprimer ce participant ?")) return;
  const { error } = await clientSupabase
    .from("participants_evenements").delete().eq("id", idPart);
  if (error) {
    alert("Erreur lors de la suppression.");
    return;
  }
  await chargerEvenements();
}

function ouvrirModaleEvenement(evenement) {
  const modeModif = !!evenement;

  let modale = document.getElementById("modale-evenement");
  if (modale) modale.remove();

  modale = document.createElement("div");
  modale.id = "modale-evenement";
  modale.className = "modale-fond";
  modale.setAttribute("role", "dialog");
  modale.setAttribute("aria-modal", "true");
  modale.setAttribute("aria-labelledby", "titre-modale-evenement");
  modale.innerHTML = `
    <div class="modale" style="max-width:480px;">
      <div class="modale__entete">
        <h2 class="modale__titre" id="titre-modale-evenement">
          ${modeModif ? "Modifier l'événement" : "Ajouter un événement"}
        </h2>
        <button type="button" class="modale__fermer" id="btn-fermer-evenement" aria-label="Fermer">✕</button>
      </div>
      <form id="formulaire-evenement" class="modale__formulaire" novalidate>
        <div class="champ-groupe">
          <label class="champ-label" for="ev-nom">Nom <span aria-hidden="true">*</span></label>
          <input type="text" id="ev-nom" class="champ-input"
                 value="${modeModif ? (evenement.nom || "") : ""}" required>
        </div>
        <div class="champ-groupe">
          <label class="champ-label" for="ev-date">Date</label>
          <input type="date" id="ev-date" class="champ-input"
                 value="${modeModif && evenement.date ? evenement.date.split("T")[0] : ""}">
        </div>
        <div class="champ-groupe">
          <label class="champ-label" for="ev-lieu">Lieu</label>
          <input type="text" id="ev-lieu" class="champ-input"
                 value="${modeModif ? (evenement.lieu || "") : ""}">
        </div>
        <div class="champ-groupe">
          <label class="champ-label" for="ev-prix">Prix unitaire (€)</label>
          <input type="number" id="ev-prix" class="champ-input"
                 min="0" step="1"
                 value="${modeModif && evenement.prix_unitaire != null ? evenement.prix_unitaire : ""}">
        </div>
        <div id="erreur-evenement" class="message-erreur" role="alert" hidden></div>
        <div class="modale__actions">
          <button type="button" class="btn btn--secondaire" id="btn-annuler-evenement">Annuler</button>
          <button type="submit" class="btn btn--primaire">${modeModif ? "Enregistrer" : "Ajouter"}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modale);

  const fermer = function() { modale.remove(); };
  document.getElementById("btn-fermer-evenement").addEventListener("click", fermer);
  document.getElementById("btn-annuler-evenement").addEventListener("click", fermer);
  modale.addEventListener("click", function(e) { if (e.target === modale) fermer(); });

  document.getElementById("formulaire-evenement").addEventListener("submit", async function(e) {
    e.preventDefault();
    const zoneErreur = document.getElementById("erreur-evenement");
    zoneErreur.hidden = true;

    const nom = document.getElementById("ev-nom").value.trim();
    if (!nom) {
      zoneErreur.textContent = "Le nom est obligatoire.";
      zoneErreur.hidden = false;
      return;
    }

    const payload = {
      nom,
      date:          document.getElementById("ev-date").value         || null,
      lieu:          document.getElementById("ev-lieu").value.trim()  || null,
      prix_unitaire: parseFloat(document.getElementById("ev-prix").value) || null,
    };

    let erreur;
    if (modeModif) {
      ({ error: erreur } = await clientSupabase
        .from("evenements").update(payload).eq("id", evenement.id));
    } else {
      ({ error: erreur } = await clientSupabase
        .from("evenements").insert([payload]));
    }

    if (erreur) {
      zoneErreur.textContent = "Erreur lors de l'enregistrement.";
      zoneErreur.hidden = false;
      return;
    }

    fermer();
    await chargerEvenements();
  });

  document.getElementById("ev-nom").focus();
}

async function supprimerEvenement(idEv) {
  if (!confirm("Supprimer cet événement et tous ses participants ?")) return;
  const { error } = await clientSupabase
    .from("evenements").delete().eq("id", idEv);
  if (error) {
    alert("Erreur lors de la suppression.");
    return;
  }
  await chargerEvenements();
}

/* =====================================================
   SECTION DONATEURS — CACHE ET ÉTAT
   ===================================================== */

let donneesDonateurs      = [];
let donneesDons           = [];
var filtreDonateurs       = "";
var filtreAnneeDonateurs  = String(new Date().getFullYear());
var triDonateurs          = { colonne: null, sens: "asc" };
let donateurEnCours          = null;
let donateurExistantPourDon  = null;
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

  selectionDonateurs.clear();
  var selAll = document.getElementById("sel-all-donateurs");
  if (selAll) { selAll.checked = false; selAll.indeterminate = false; }
  mettreAJourBoutonEnvoyer();

  corps.innerHTML  = "";

  if (!donateurs || donateurs.length === 0) {
    corps.innerHTML = `
      <tr>
        <td colspan="11" class="tableau-message">
          Aucun donateur enregistré pour l'instant.
        </td>
      </tr>
    `;
    return;
  }

  donateurs.forEach(function(don) {
    const ligne = document.createElement("tr");

    const donsDuDonateur = donneesDons.filter(function(d) {
      return String(d.donateur_id) === String(don.id);
    });
    const totalDons = donsDuDonateur.reduce(function(acc, d) {
      return acc + (Number(d.montant) || 0);
    }, 0);
    const montant = donsDuDonateur.length > 0
      ? totalDons.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
      : "—";
    const btnToggle = donsDuDonateur.length > 0
      ? `<button class="btn-dons-toggle" data-id="${don.id}"
                style="margin-left:8px;font-size:.75rem;padding:2px 6px;border:1px solid #aaa;border-radius:3px;background:#f0f0f0;cursor:pointer;">
           ${donsDuDonateur.length} don${donsDuDonateur.length > 1 ? "s" : ""}
         </button>`
      : "";

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
      <td class="col-select"><input type="checkbox" class="case-selection-don" data-id="${don.id}" aria-label="Sélectionner ${don.prenom || don.organisme || ""} ${don.nom || ""}"></td>
      <td class="col-id">${don.id_donateur || "—"}</td>
      <td class="col-nom">${nomAffiche}</td>
      <td>${prenomOrgAffiche}</td>
      <td>${don.email || "—"}</td>
      <td>${don.type_don || "—"}</td>
      <td>${montant}${btnToggle}</td>
      <td>${don.description_don || "—"}</td>
      <td>${formaterDate(don.date_don)}</td>
      <td>${don.mode_paiement || "—"}</td>
      <td class="col-actions">${genererBoutonsActionsDonateur(don.id_donateur || don.id, don.id)}</td>
    `;
    corps.appendChild(ligne);

    const sousLigne = document.createElement("tr");
    sousLigne.id = `dons-sous-${don.id}`;
    sousLigne.hidden = true;
    const lignesDons = donsDuDonateur
      .slice().sort(function(a, b) { return b.annee - a.annee; })
      .map(function(d) {
        return `<tr>
          <td style="padding:4px 8px;">${d.annee}</td>
          <td style="padding:4px 8px;">${formaterDate(d.date_don)}</td>
          <td style="padding:4px 8px;text-align:right;">${Number(d.montant).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
          <td style="padding:4px 8px;">${d.mode_paiement || "—"}</td>
          <td style="padding:4px 8px;">${d.type_don || "—"}</td>
        </tr>`;
      }).join("");
    sousLigne.innerHTML = `
      <td colspan="10" style="padding:0 16px 12px 32px;background:#f7f8fa;">
        <table style="width:100%;font-size:.85rem;border-collapse:collapse;">
          <thead>
            <tr style="color:#666;">
              <th style="padding:4px 8px;text-align:left;">Année</th>
              <th style="padding:4px 8px;text-align:left;">Date</th>
              <th style="padding:4px 8px;text-align:right;">Montant</th>
              <th style="padding:4px 8px;text-align:left;">Mode</th>
              <th style="padding:4px 8px;text-align:left;">Type</th>
            </tr>
          </thead>
          <tbody>${lignesDons}</tbody>
        </table>
      </td>
    `;
    corps.appendChild(sousLigne);
  });

  corps.addEventListener("click", function(e) {
    const btn = e.target.closest(".btn-dons-toggle");
    if (!btn) return;
    const sl = document.getElementById("dons-sous-" + btn.dataset.id);
    if (sl) sl.hidden = !sl.hidden;
  });
}

/**
 * Lit tous les donateurs depuis Supabase et met à jour le tableau.
 */
async function chargerDonateurs() {
  const corps = document.getElementById("corps-tableau-donateurs");
  if (corps) {
    corps.innerHTML = `
      <tr><td colspan="10" class="tableau-message">Chargement en cours…</td></tr>
    `;
  }

  const [resDon, resDons] = await Promise.all([
    clientSupabase.from("donateurs").select("*"),
    clientSupabase.from("dons").select("*")
  ]);

  if (resDon.error) {
    if (corps) {
      corps.innerHTML = `
        <tr>
          <td colspan="10" class="tableau-message tableau-message--erreur" role="alert">
            Impossible de charger les donateurs. Vérifiez votre connexion et réessayez.
          </td>
        </tr>
      `;
    }
    return;
  }

  donneesDons      = resDons.data || [];
  donneesDonateurs = resDon.data;
  appliquerFiltreDonateurs();
  mettreAJourStats();
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
  const estCheque = mode === "chèque";
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

  donateurExistantPourDon = null;
  document.getElementById("groupe-id-don").hidden              = true;
  document.getElementById("groupe-ajout-don").hidden           = true;
  document.getElementById("zone-recherche-don").hidden         = false;
  document.getElementById("don-recherche").value               = "";
  document.getElementById("don-recherche-resultats").hidden    = true;
  document.getElementById("don-donateur-trouve").hidden        = true;
  document.getElementById("formulaire-don-complet").hidden     = false;
  document.getElementById("modale-don-titre").textContent = "Ajouter un donateur";
  document.querySelector("#formulaire-donateur [type='submit']").textContent = "Enregistrer";
  document.getElementById("btn-fermer-modale-don").setAttribute("aria-label", "Fermer la fenêtre d'ajout de donateur");

  fondDon.hidden = false;
  requestAnimationFrame(function() { modaleDon.focus(); });
  document.addEventListener("keydown", gererToucheDon);
}

document.getElementById("don-recherche").addEventListener("input", function() {
  const q = this.value.trim().toLowerCase();
  const liste = document.getElementById("don-recherche-resultats");
  if (q.length < 2) { liste.hidden = true; return; }

  const resultats = donneesDonateurs.filter(function(d) {
    return (d.nom || "").toLowerCase().includes(q)
        || (d.email || "").toLowerCase().includes(q)
        || (d.organisme || "").toLowerCase().includes(q);
  }).slice(0, 8);

  if (!resultats.length) {
    liste.innerHTML = '<li style="padding:8px 12px;color:#888;">Aucun résultat — créez une nouvelle fiche ci-dessous.</li>';
  } else {
    liste.innerHTML = resultats.map(function(d) {
      const label = [d.prenom, d.nom || d.organisme, d.email ? "(" + d.email + ")" : ""]
        .filter(Boolean).join(" ");
      return `<li data-id="${d.id}"
                  style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #eee;">
                ${label}
              </li>`;
    }).join("");
  }
  liste.hidden = false;
});

document.getElementById("don-recherche-resultats").addEventListener("click", function(e) {
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  donateurExistantPourDon = donneesDonateurs.find(function(d) {
    return String(d.id) === li.dataset.id;
  });
  if (!donateurExistantPourDon) return;

  const nom = [donateurExistantPourDon.prenom,
               donateurExistantPourDon.nom || donateurExistantPourDon.organisme]
    .filter(Boolean).join(" ");
  document.getElementById("don-donateur-trouve-nom").textContent  = nom;
  document.getElementById("don-donateur-trouve").hidden           = false;
  document.getElementById("don-recherche-resultats").hidden       = true;
  document.getElementById("formulaire-don-complet").hidden        = true;
  document.getElementById("groupe-ajout-don").hidden              = false;
  document.getElementById("don-ajout-montant").value              = "";
  document.getElementById("don-ajout-mode").value                 = "";
  document.getElementById("don-ajout-type").value                 = "";
});

document.getElementById("don-nouvelle-fiche").addEventListener("click", function() {
  donateurExistantPourDon = null;
  document.getElementById("don-donateur-trouve").hidden    = true;
  document.getElementById("formulaire-don-complet").hidden = false;
  document.getElementById("groupe-ajout-don").hidden       = true;
  document.getElementById("don-recherche").value           = "";
  document.getElementById("don-recherche-resultats").hidden = true;
});

/**
 * Ouvre la modale en mode MODIFICATION : champs pré-remplis.
 * @param {Object} donateur
 */
async function ouvrirModaleDonModification(donateur) {
  donateurEnCours       = donateur;
  elementAvantModaleDon = document.activeElement;

  if (!donneesDons.length) {
    const { data } = await clientSupabase.from("dons").select("*");
    if (data) donneesDons = data;
  }

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
  const dernDon = dernierDon(donateur.id);
  document.getElementById("don-description").value = donateur.description_don || "";
  const modeValDon = ((dernDon && dernDon.mode_paiement) || donateur.mode_paiement || "").toLowerCase().trim();
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
  console.log("[DEBUG] don-type:", document.getElementById("don-type").value);
  console.log("[DEBUG] groupe-don-montant hidden:", document.getElementById("groupe-don-montant").hidden);
  console.log("[DEBUG] don-montant avant assignation:", document.getElementById("don-montant").value);
  document.getElementById("don-montant").value =
    (dernDon && dernDon.montant != null) ? dernDon.montant
    : (donateur.montant_don != null ? donateur.montant_don : "");
  console.log("[DEBUG] don-montant après assignation:", document.getElementById("don-montant").value);
  document.getElementById("don-mode").value = modeValDon;
  majCiviliteVisibiliteDon();

  document.getElementById("zone-recherche-don").hidden     = true;
  document.getElementById("formulaire-don-complet").hidden  = false;
  document.getElementById("groupe-ajout-don").hidden        = false;
  document.getElementById("don-ajout-montant").value        = "";
  document.getElementById("don-ajout-mode").value           = "";
  document.getElementById("don-ajout-type").value           = "";

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

  if (donateurExistantPourDon) {
    /* ---- DONATEUR EXISTANT : INSERT don uniquement ---- */
    const montantAjout = document.getElementById("don-ajout-montant").value.trim();
    if (!montantAjout) {
      zoneErreur.textContent = "Le montant est obligatoire.";
      zoneErreur.hidden = false;
      return;
    }
    const { error } = await clientSupabase.from("dons").insert([{
      donateur_id:   donateurExistantPourDon.id,
      annee:         new Date().getFullYear(),
      date_don:      new Date().toISOString().split("T")[0],
      montant:       parseFloat(montantAjout.replace(",", ".")),
      mode_paiement: document.getElementById("don-ajout-mode").value || null,
      type_don:      document.getElementById("don-ajout-type").value || null
    }]);
    if (error) {
      zoneErreur.textContent = "L'enregistrement a échoué. Vérifiez votre connexion.";
      zoneErreur.hidden = false;
      return;
    }
    donateurExistantPourDon = null;
    fermerModaleDon();
    await chargerDonateurs();
    afficherSuccesDon("Don ajouté.");
    return;
  }

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

    const montantAjout = document.getElementById("don-ajout-montant").value.trim();
    if (montantAjout && donateurEnCours) {
      await clientSupabase.from("dons").insert([{
        donateur_id:   donateurEnCours.id,
        annee:         new Date().getFullYear(),
        date_don:      new Date().toISOString().split("T")[0],
        montant:       parseFloat(montantAjout.replace(",", ".")),
        mode_paiement: document.getElementById("don-ajout-mode").value || null,
        type_don:      document.getElementById("don-ajout-type").value || null
      }]);
    }

    if (montantDon && typeDon && typeDon.toLowerCase().includes("financier")) {
      const anneeEnCours = annee ? parseInt(annee, 10) : new Date().getFullYear();
      const donExistant = donneesDons.find(function(d) {
        return String(d.donateur_id) === String(donateurEnCours.id)
            && Number(d.annee) === anneeEnCours;
      });
      if (donExistant) {
        await clientSupabase.from("dons")
          .update({ montant: montantDon, mode_paiement: modePaiement || null })
          .eq("donateur_id", donateurEnCours.id)
          .eq("annee", anneeEnCours);
      } else {
        await clientSupabase.from("dons").insert([{
          donateur_id:   donateurEnCours.id,
          annee:         anneeEnCours,
          date_don:      dateDon,
          montant:       montantDon,
          mode_paiement: modePaiement || null,
          type_don:      typeDon
        }]);
      }
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

    const { data: insertedDon, error } = await clientSupabase
      .from("donateurs")
      .insert([{
        id_donateur: idDonateur,
        nom, prenom, civilite, organisme, email, telephone, adresse,
        type_don: typeDon, montant_don: montantDon,
        description_don: description, date_don: dateDon,
        mode_paiement: modePaiement,
        numero_cheque: modePaiement === "Chèque" ? numeroCheque : null,
        banque_cheque: modePaiement === "Chèque" ? banqueCheque : null
      }])
      .select();

    if (error || !insertedDon || !insertedDon[0]) {
      zoneErreur.textContent = "L'enregistrement a échoué. Vérifiez votre connexion et réessayez.";
      zoneErreur.hidden = false;
      return;
    }

    if (montantDon && typeDon && typeDon.toLowerCase().includes("financier")) {
      await clientSupabase.from("dons").insert([{
        donateur_id:   insertedDon[0].id,
        annee:         annee ? parseInt(annee, 10) : new Date().getFullYear(),
        date_don:      dateDon,
        montant:       montantDon,
        mode_paiement: modePaiement || null,
        type_don:      typeDon
      }]);
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
  for (let a = 2024; a <= anneeActuelle; a++) {
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

  const derniereRecuAdh = derniereCotisation(a.id);
  const montantCotis    = derniereRecuAdh ? Number(derniereRecuAdh.montant) : null;
  const cotis = montantCotis != null
    ? montantCotis.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
    : "—";
  const donVal = (a.montant_cotisation != null && Number(a.montant_cotisation) > 0)
    ? Number(a.montant_cotisation)
    : null;
  const donStr = donVal
    ? donVal.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
    : null;
  const totalStr = (donVal && montantCotis != null)
    ? (montantCotis + donVal).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
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
  if (!adherentRecuEnCours && adherentEnCours) adherentRecuEnCours = adherentEnCours;
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
      Télécharger
    `.trim();
  });
});

document.getElementById("btn-mail-recu-adh").addEventListener("click", async function() {
  if (!adherentRecuEnCours) adherentRecuEnCours = adherentEnCours;
  const email = (adherentRecuEnCours && adherentRecuEnCours.email) || "";
  if (!email) {
    alert("Aucune adresse e-mail renseignée pour cet adhérent.");
    return;
  }
  const idAdherent = (adherentRecuEnCours && adherentRecuEnCours.id_adherent) || "recu";
  const nomFichier = `recu-adhesion-${idAdherent}.pdf`;
  const nom = [(adherentRecuEnCours.prenom || ""), (adherentRecuEnCours.nom || "")].join(" ").trim();
  const qualiteAdh = document.getElementById("select-signataire-adh").value || "La trésorière";
  const nomSignAdh = NOMS_SIGNATAIRES[qualiteAdh] || "BELHAJ Oum Keltoum";
  const doc = document.getElementById("recu-adherent-document");
  const imgLogo = document.getElementById("recu-adh-logo");
  const btn = this;
  btn.disabled = true;
  btn.textContent = "Envoi en cours…";
  const srcOriginal = imgLogo.src;
  chargerImageCommeDataUrl("assets/hsi37-redim-demi.png").then(function(dataUrl) {
    imgLogo.src = dataUrl;
    return new Promise(function(resolve) { imgLogo.onload = resolve; imgLogo.onerror = resolve; });
  }).then(function() {
    return html2canvas(doc, { scale: 2, useCORS: false, allowTaint: true, backgroundColor: "#ffffff", logging: false });
  }).then(function(canvas) {
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const mmLarg = 210;
    const mmHaut = (canvas.height / canvas.width) * mmLarg;
    const pdf = new window.jspdf.jsPDF({ orientation: mmHaut > mmLarg ? "portrait" : "landscape", unit: "mm", format: [mmLarg, mmHaut] });
    pdf.addImage(imgData, "JPEG", 0, 0, mmLarg, mmHaut);
    const pdfBlob = pdf.output("blob");
    return envoyerRecuParMail(pdfBlob, nomFichier, email, nom, qualiteAdh, nomSignAdh);
  }).then(function() {
    btn.textContent = "✅ Mail envoyé";
    setTimeout(function() { btn.disabled = false; btn.textContent = "✉ Envoyer par mail"; }, 3000);
  }).catch(function(err) {
    console.error("Erreur envoi reçu :", err);
    btn.textContent = "❌ Échec envoi";
    setTimeout(function() { btn.disabled = false; btn.textContent = "✉ Envoyer par mail"; }, 3000);
  }).finally(function() {
    imgLogo.src = srcOriginal;
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
      Télécharger
    `.trim();
  });
});

document.getElementById("btn-mail-recu-don").addEventListener("click", async function() {
  const email = (donateurRecuEnCours && donateurRecuEnCours.email) || "";
  if (!email) {
    alert("Aucune adresse e-mail renseignée pour ce donateur.");
    return;
  }
  const idDonateur = (donateurRecuEnCours && donateurRecuEnCours.id_donateur) || "recu-don";
  const nomFichier = `recu-don-${idDonateur}.pdf`;
  const nom = [(donateurRecuEnCours.prenom || ""), (donateurRecuEnCours.nom || ""),
               (donateurRecuEnCours.organisme || "")].filter(Boolean).join(" ") || "Donateur";
  const qualiteDon = document.getElementById("select-signataire-don").value || "La trésorière";
  const nomSignDon = NOMS_SIGNATAIRES[qualiteDon] || "BELHAJ Oum Keltoum";
  const doc = document.getElementById("recu-donateur-document");
  const imgLogo = document.getElementById("recu-don-logo");
  const btn = this;
  btn.disabled = true;
  btn.textContent = "Envoi en cours…";
  const srcOriginal = imgLogo.src;
  chargerImageCommeDataUrl("assets/hsi37-redim-demi.png").then(function(dataUrl) {
    imgLogo.src = dataUrl;
    return new Promise(function(resolve) { imgLogo.onload = resolve; imgLogo.onerror = resolve; });
  }).then(function() {
    return html2canvas(doc, { scale: 2, useCORS: false, allowTaint: true, backgroundColor: "#ffffff", logging: false });
  }).then(function(canvas) {
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const mmLarg = 210;
    const mmHaut = (canvas.height / canvas.width) * mmLarg;
    const pdf = new window.jspdf.jsPDF({ orientation: mmHaut > mmLarg ? "portrait" : "landscape", unit: "mm", format: [mmLarg, mmHaut] });
    pdf.addImage(imgData, "JPEG", 0, 0, mmLarg, mmHaut);
    const pdfBlob = pdf.output("blob");
    return envoyerRecuParMail(pdfBlob, nomFichier, email, nom, qualiteDon, nomSignDon);
  }).then(function() {
    btn.textContent = "✅ Mail envoyé";
    setTimeout(function() { btn.disabled = false; btn.textContent = "✉ Envoyer par mail"; }, 3000);
  }).catch(function(err) {
    console.error("Erreur envoi reçu :", err);
    btn.textContent = "❌ Échec envoi";
    setTimeout(function() { btn.disabled = false; btn.textContent = "✉ Envoyer par mail"; }, 3000);
  }).finally(function() {
    imgLogo.src = srcOriginal;
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
document.getElementById("tuile-evenements").addEventListener("click", function() {
  allerVers("evenements");
});
document.getElementById("btn-ajouter-evenement").addEventListener("click", function() {
  ouvrirModaleEvenement(null);
});
document.getElementById("tuile-documents").addEventListener("click", function() {
  allerVers("documents");
});
const cacheSignatures = {};
const FICHIERS_SIGNATURES = [
  "signatures/signature-president.html",
  "signatures/signature-secretaire.html",
  "signatures/signature-tresoriere.html",
  "signatures/signature-institutionnelle.html",
  "signatures/signature-recrutement.html",
  "signatures/signature-dons.html"
];

function prechargerSignatures() {
  FICHIERS_SIGNATURES.forEach(async function(f) {
    if (cacheSignatures[f]) return;
    try {
      const res = await fetch(f);
      if (res.ok) cacheSignatures[f] = await res.text();
    } catch(e) {
      console.warn("[Signature] Pré-chargement échoué :", f, e);
    }
  });
}

document.getElementById("tuile-signatures").addEventListener("click", function() {
  prechargerSignatures();
  allerVers("signatures");
});

document.addEventListener("click", function(e) {
  const btn = e.target.closest(".btn-copier-signature");
  if (!btn) return;
  const fichier = btn.dataset.fichier;
  const labelOriginal = btn.textContent;
  const html = cacheSignatures[fichier];
  if (!html) {
    btn.textContent = "⏳ Chargement…";
    setTimeout(function() { btn.textContent = labelOriginal; }, 2000);
    return;
  }
  try {
    const el = document.createElement("div");
    el.innerHTML = html;
    el.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
    document.body.appendChild(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("copy");
    sel.removeAllRanges();
    document.body.removeChild(el);
    btn.textContent = "✓ Signature copiée !";
  } catch (err) {
    console.error("[Signature] Erreur copie :", err);
    btn.textContent = "❌ Erreur copie";
  }
  setTimeout(function() { btn.textContent = labelOriginal; }, 2000);
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

document.getElementById('btn-mail-relance').addEventListener('click', async function() {
  if (!adherentRelance) return;
  const email = adherentRelance.email || '';
  if (!email) {
    alert('Aucune adresse e-mail renseignée pour cet adhérent.');
    return;
  }
  const annee = anneeEnCours();
  const saisonDerniere = adherentRelance.saison || (annee - 1);
  const nom = `${adherentRelance.prenom || ''} ${adherentRelance.nom || ''}`.trim();
  const sujet = `Renouvellement adhésion HSI37 — Saison ${annee}`;
  const qualiteRelance = "La secrétaire";
  const nomSignRelance = NOMS_SIGNATAIRES[qualiteRelance] || "BELHAJ Nawel";
  const signatureHTMLRelance = `
    <hr style="border:none;border-top:2px solid #F7CD46;margin:24px 0 16px;">
    <table style="font-family:Open Sans,Arial,sans-serif;font-size:13px;color:#403E3E;">
      <tr>
        <td style="padding-right:16px;vertical-align:top;">
          <img src="https://hsi37-dashboard.pages.dev/assets/hsi37-redim-demi.png"
               alt="Logo HSI37" width="80" style="display:block;">
        </td>
        <td style="vertical-align:top;">
          <strong style="font-size:14px;">${nomSignRelance}</strong><br>
          <span style="color:#3B77B4;font-weight:600;">${qualiteRelance} de l'Association HSI37 — Handicap Solidarité pour l'Inclusion 37</span><br><br>
          📱 07 43 29 58 30<br>
          ✉ handicapsi37@gmail.com<br>
          🌐 www.hsi37.fr<br><br>
          <span style="color:#F7CD46;font-weight:600;">🏷 Soutenez nos actions :</span>
          <a href="https://hsi37.fr/don" style="color:#3B77B4;">Faire un don</a> ou
          <a href="https://hsi37.fr/adhesion" style="color:#3B77B4;">Devenir membre</a>
        </td>
      </tr>
    </table>
  `;
  const contenuHTML = `
    <p>Madame, Monsieur,</p>
    <p>Nous vous informons que votre adhésion à l'association <strong>Handicap Solidarité pour l'Inclusion 37</strong> pour la saison <strong>${saisonDerniere}</strong> est arrivée à échéance.</p>
    <p>Nous vous invitons à renouveler votre adhésion pour la saison <strong>${annee}</strong> au montant de <strong>20,00 €</strong>.</p>
    <p>Vous pouvez régler par : espèces, virement (IBAN : FR76 1027 8374 …. …. …. 116), chèque à l'ordre de l'Association Handicap Solidarité pour l'Inclusion 37, carte bancaire, PayPal ou HelloAsso.</p>
    <p>Nous vous remercions pour votre soutien et restons à votre disposition.</p>
    ${signatureHTMLRelance}
  `;
  const btn = document.getElementById('btn-mail-relance');
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';
  try {
    const { data, error } = await clientSupabase.functions.invoke('envoyer-recu', {
      body: {
        emailDestinataire: email,
        nomDestinataire: nom,
        sujet: sujet,
        contenuHTML: contenuHTML
      }
    });
    if (error) throw error;
    btn.textContent = '✅ Mail envoyé';
    setTimeout(() => { btn.disabled = false; btn.textContent = '✉ Envoyer par mail'; }, 3000);
  } catch (err) {
    console.error('Erreur envoi relance :', err);
    btn.textContent = '❌ Échec envoi';
    setTimeout(() => { btn.disabled = false; btn.textContent = '✉ Envoyer par mail'; }, 3000);
  }
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

/* ── Modale invitation (envoi aux sélectionnés) ── */

function ouvrirModaleInvitation() {
  var emails = [];

  selectionAdherents.forEach(function(id) {
    var adh = donneesAdherents.find(function(a) { return String(a.id) === String(id); });
    if (adh && adh.email) emails.push({
      email: adh.email.trim(),
      nom: ((adh.prenom || "") + " " + (adh.nom || "")).trim()
    });
  });
  selectionDonateurs.forEach(function(id) {
    var don = donneesDonateurs.find(function(d) { return String(d.id) === String(id); });
    if (don && don.email) emails.push({
      email: don.email.trim(),
      nom: ((don.prenom || don.organisme || "") + " " + (don.nom || "")).trim()
    });
  });
  selectionParticipants.forEach(function(id) {
    var part = donneesParticipants.find(function(p) { return String(p.id) === String(id); });
    if (part && part.email) emails.push({
      email: part.email.trim(),
      nom: ((part.prenom || "") + " " + (part.nom || "")).trim()
    });
  });

  var vus = new Set();
  var emailsUniques = emails.filter(function(c) {
    var k = c.email.toLowerCase();
    if (!k || vus.has(k)) return false;
    vus.add(k);
    return true;
  });

  var n = emailsUniques.length;
  document.getElementById("inv-compte").textContent = n + " destinataire" + (n > 1 ? "s" : "");
  document.getElementById("formulaire-invitation").dataset.emails = JSON.stringify(emailsUniques);
  document.getElementById("inv-objet").value = "";
  document.getElementById("inv-corps").value = "";
  document.getElementById("inv-signataire").value = "La trésorière";
  document.getElementById("inv-message").hidden = true;
  document.getElementById("invitation-fond").hidden = false;
  document.getElementById("modale-invitation").focus();
}

function fermerModaleInvitation() {
  document.getElementById("invitation-fond").hidden = true;
}

document.getElementById("btn-fermer-invitation").addEventListener("click", fermerModaleInvitation);
document.getElementById("btn-annuler-invitation").addEventListener("click", fermerModaleInvitation);
document.getElementById("invitation-fond").addEventListener("click", function(ev) {
  if (ev.target === this) fermerModaleInvitation();
});

document.querySelectorAll(".btn-envoyer-selectionnes").forEach(function(btn) {
  btn.addEventListener("click", ouvrirModaleInvitation);
});

/* Checkbox "tout sélectionner" — adhérents */
document.getElementById("sel-all-adherents").addEventListener("change", function() {
  var cocher = this.checked;
  document.querySelectorAll(".case-selection-adh").forEach(function(cb) {
    cb.checked = cocher;
    if (cocher) selectionAdherents.add(cb.dataset.id);
    else selectionAdherents.delete(cb.dataset.id);
  });
  mettreAJourBoutonEnvoyer();
});

/* Checkbox "tout sélectionner" — donateurs */
document.getElementById("sel-all-donateurs").addEventListener("change", function() {
  var cocher = this.checked;
  document.querySelectorAll(".case-selection-don").forEach(function(cb) {
    cb.checked = cocher;
    if (cocher) selectionDonateurs.add(cb.dataset.id);
    else selectionDonateurs.delete(cb.dataset.id);
  });
  mettreAJourBoutonEnvoyer();
});

/* Délégation de changement — checkboxes adhérents */
document.getElementById("corps-tableau").addEventListener("change", function(ev) {
  var cb = ev.target.closest(".case-selection-adh");
  if (!cb) return;
  if (cb.checked) selectionAdherents.add(cb.dataset.id);
  else selectionAdherents.delete(cb.dataset.id);
  var total  = document.querySelectorAll(".case-selection-adh").length;
  var coches = document.querySelectorAll(".case-selection-adh:checked").length;
  var selAll = document.getElementById("sel-all-adherents");
  selAll.checked       = coches === total && total > 0;
  selAll.indeterminate = coches > 0 && coches < total;
  mettreAJourBoutonEnvoyer();
});

/* Délégation de changement — checkboxes donateurs */
document.getElementById("corps-tableau-donateurs").addEventListener("change", function(ev) {
  var cb = ev.target.closest(".case-selection-don");
  if (!cb) return;
  if (cb.checked) selectionDonateurs.add(cb.dataset.id);
  else selectionDonateurs.delete(cb.dataset.id);
  var total  = document.querySelectorAll(".case-selection-don").length;
  var coches = document.querySelectorAll(".case-selection-don:checked").length;
  var selAll = document.getElementById("sel-all-donateurs");
  selAll.checked       = coches === total && total > 0;
  selAll.indeterminate = coches > 0 && coches < total;
  mettreAJourBoutonEnvoyer();
});

document.getElementById("formulaire-invitation").addEventListener("submit", async function(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-envoyer-invitation");
  const msg = document.getElementById("inv-message");
  btn.disabled = true;
  btn.textContent = "Envoi en cours…";
  msg.hidden = true;

  const emails         = JSON.parse(this.dataset.emails || "[]");
  const objet_email    = document.getElementById("inv-objet").value.trim();
  const corps_email    = document.getElementById("inv-corps").value.trim();
  const signataire     = document.getElementById("inv-signataire").value;
  const nom_signataire = NOMS_SIGNATAIRES[signataire] || signataire;

  try {
    const res = await fetch(SUPABASE_URL + "/functions/v1/envoyer-invitation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + SUPABASE_KEY,
      },
      body: JSON.stringify({ emails, objet_email, corps_email, signataire, nom_signataire }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur inconnue");

    msg.textContent = `✓ ${data.envoyes} invitation(s) envoyée(s) — ${data.exclus} contact(s) sans email exclus.`;
    msg.className = "modale-succes";
    msg.hidden = false;
  } catch (err) {
    msg.textContent = "Erreur : " + err.message;
    msg.className = "modale-erreur";
    msg.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "✉ Envoyer";
  }
});

document.getElementById('btn-convocation').addEventListener('click', ouvrirModaleConvocation);
document.getElementById('btn-fermer-convocation').addEventListener('click', fermerModaleConvocation);
document.getElementById('btn-annuler-convocation').addEventListener('click', fermerModaleConvocation);
document.getElementById('convocation-fond').addEventListener('click', function(ev) {
  if (ev.target === convocationFond) fermerModaleConvocation();
});

document.getElementById('btn-mail-convocation').addEventListener('click', async function() {
  const { data, error } = await clientSupabase
    .from('adherents')
    .select('email, prenom, nom')
    .not('email', 'is', null)
    .neq('email', '');

  if (error || !data || data.length === 0) {
    alert('Impossible de récupérer les adhérents ou aucun email enregistré.');
    return;
  }

  const emails = data.map(a => a.email).join(', ');
  const annee  = document.getElementById('conv-annee').value || anneeEnCours();
  const sujet  = encodeURIComponent(`Convocation Assemblée Générale HSI37 — ${annee}`);
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(emails)}&su=${sujet}`;
  const texte  = `Emails de tous les adhérents (${data.length}) :\n\n${emails}`;

  const zone = document.createElement('div');
  zone.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border:2px solid #3B77B4;border-radius:8px;padding:24px;max-width:600px;width:90%;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.2);";
  zone.innerHTML = `
    <h3 style="color:#3B77B4;margin:0 0 12px;">📋 Emails adhérents (${data.length})</h3>
    <p style="color:#403E3E;font-size:13px;margin:0 0 8px;">Copiez les adresses ci-dessous et collez-les dans le champ "Cci" de Gmail :</p>
    <textarea readonly style="width:100%;height:120px;font-size:12px;border:1px solid #ccc;border-radius:4px;padding:8px;box-sizing:border-box;">${emails}</textarea>
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
      <button id="btn-ouvrir-gmail" style="background:#3B77B4;color:#fff;border:none;border-radius:4px;padding:8px 16px;cursor:pointer;">✉ Ouvrir dans Gmail</button>
      <button id="btn-copier-emails" style="background:#FAFBFE;color:#403E3E;border:1px solid #ccc;border-radius:4px;padding:8px 16px;cursor:pointer;">📋 Copier</button>
      <button id="btn-fermer-emails" style="background:#FAFBFE;color:#403E3E;border:1px solid #ccc;border-radius:4px;padding:8px 16px;cursor:pointer;">Fermer</button>
    </div>
  `;
  document.body.appendChild(zone);

  document.getElementById('btn-ouvrir-gmail').addEventListener('click', function() {
    window.open(gmailUrl, '_blank');
  });
  document.getElementById('btn-copier-emails').addEventListener('click', function() {
    navigator.clipboard.writeText(emails).then(function() {
      document.getElementById('btn-copier-emails').textContent = '✅ Copié !';
    });
  });
  document.getElementById('btn-fermer-emails').addEventListener('click', function() {
    zone.remove();
  });
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

// --- Profil utilisateur ---
const btnProfil = document.getElementById("btn-profil");
if (btnProfil) {
  btnProfil.addEventListener("click", function() {
    hubAccueil.hidden = true;
    navOnglets.hidden = true;
    document.getElementById("panneau-adherents").hidden = true;
    document.getElementById("panneau-donateurs").hidden = true;
    sectionDocuments.hidden = true;
    sectionSignatures.hidden = true;
    sectionRgpd.hidden = true;
    btnRetourAccueil.hidden = false;

    sectionProfil.hidden = false;

    const session = clientSupabase.auth.getSession();
    session.then(function(res) {
      const email = res?.data?.session?.user?.email || "—";
      document.getElementById("profil-email").textContent = email;
    });
  });
}

const btnSauvegarderProfil = document.getElementById("btn-sauvegarder-profil");
if (btnSauvegarderProfil) {
  btnSauvegarderProfil.addEventListener("click", async function() {
    const mdp = document.getElementById("profil-mdp-nouveau").value;
    const confirm = document.getElementById("profil-mdp-confirm").value;
    const msg = document.getElementById("profil-message");

    if (!mdp || mdp.length < 8) {
      msg.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
      msg.className = "profil__message profil__message--err";
      return;
    }
    if (mdp !== confirm) {
      msg.textContent = "Les deux mots de passe ne correspondent pas.";
      msg.className = "profil__message profil__message--err";
      return;
    }

    const { error } = await clientSupabase.auth.updateUser({ password: mdp });
    if (error) {
      msg.textContent = "Erreur : " + error.message;
      msg.className = "profil__message profil__message--err";
    } else {
      msg.textContent = "✅ Mot de passe mis à jour avec succès.";
      msg.className = "profil__message profil__message--ok";
      document.getElementById("profil-mdp-nouveau").value = "";
      document.getElementById("profil-mdp-confirm").value = "";
    }
  });
}

// --- Stats hub ---
function mettreAJourStats() {
  var total = donneesAdherents.length;
  var aJour = donneesAdherents.filter(function(a) { return calculerStatutAdherent(a) === "ajour"; }).length;
  var expires = total - aJour;
  var totalCotis = donneesCotisations.reduce(function(acc, c) {
    return acc + (Number(c.montant) || 0);
  }, 0);

  var elTotal = document.getElementById("val-total-adherents");
  var elJour = document.getElementById("val-adherents-jour");
  var elExpires = document.getElementById("val-adherents-expires");
  var elCotis = document.getElementById("val-cotisations");
  if (elTotal) elTotal.textContent = total;
  if (elJour) elJour.textContent = aJour;
  if (elExpires) elExpires.textContent = expires;
  if (elCotis) elCotis.textContent = totalCotis.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

  var totalDon = donneesDonateurs.length;
  var totalDons = donneesDonateurs.reduce(function(acc, d) {
    var estMat = (d.type_don || "").toLowerCase().includes("mat");
    return acc + (estMat ? 0 : (Number(d.montant_don) || 0));
  }, 0);

  var elTotalDon = document.getElementById("val-total-donateurs");
  var elDons = document.getElementById("val-dons");
  if (elTotalDon) elTotalDon.textContent = totalDon;
  if (elDons) elDons.textContent = totalDons.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

  var annee = new Date().getFullYear();
  var totalEv = donneesParticipants
    .filter(function(p) {
      var ev = donneesEvenements.find(function(e) { return String(e.id) === String(p.evenement_id); });
      return ev && ev.date && new Date(ev.date).getFullYear() === annee;
    })
    .reduce(function(acc, p) { return acc + (parseFloat(p.montant) || 0); }, 0);
  var elEv = document.getElementById("val-evenements");
  if (elEv) elEv.textContent = totalEv.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// --- Export CSV ---
function exporterCSV(donnees, colonnes, nomsColonnes, nomFichier) {
  var lignes = [nomsColonnes.join(";")];
  donnees.forEach(function(row) {
    var valeurs = colonnes.map(function(col) {
      var v = col === "statut" ? calculerStatut(row.saison) : (row[col] !== null && row[col] !== undefined ? row[col] : "");
      return '"' + String(v).replace(/"/g, '""') + '"';
    });
    lignes.push(valeurs.join(";"));
  });
  var contenu = "﻿" + lignes.join("\r\n");
  var blob = new Blob([contenu], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   EXPORTS PDF — LISTE ADHÉRENTS & RAPPORT ANNUEL
============================================================ */

async function chargerLogoBase64PDF(src) {
  try {
    const resp = await fetch(src);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function exporterListeAdherentsPDF() {
  const { jsPDF } = window.jspdf;
  const doc     = new jsPDF({ unit: 'mm', format: 'a4' });
  const BLEU    = [59, 119, 180];
  const JAUNE   = [247, 205, 70];
  const ENCRE   = [64, 62, 62];
  const BLANC   = [255, 255, 255];
  const BLEU_CL = [232, 241, 250];
  const ROW_H   = 7;
  const Y_MAX   = 270;
  const annee   = new Date().getFullYear();
  const dateExp = new Date().toLocaleDateString('fr-FR');
  const logo    = await chargerLogoBase64PDF('assets/hsi37-redim-demi.png');

  function pdfEnTete(titre) {
    doc.setFillColor(...BLEU);  doc.rect(0, 0, 210, 28, 'F');
    doc.setFillColor(...JAUNE); doc.rect(0, 28, 210, 2, 'F');
    if (logo) doc.addImage(logo, 'PNG', 8, 4, 20, 20);
    doc.setTextColor(...BLANC);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text("HSI37 — Handicap Solidarité pour l'Inclusion 37", 32, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps', 32, 21);
    doc.setTextColor(...BLEU);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(titre, 105, 38, { align: 'center' });
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.7);
    doc.line(30, 41, 180, 41);
  }

  const C = { x: 12, num: 12, nom: 38, prenom: 78, type: 118, statut: 150, date: 174, fin: 198 };

  function enTeteTabAdh(y) {
    doc.setFillColor(...BLEU); doc.rect(C.x, y, C.fin - C.x, ROW_H, 'F');
    doc.setTextColor(...BLANC); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('N° adhérent', C.num + 1,    y + 5);
    doc.text('Nom',         C.nom + 1,    y + 5);
    doc.text('Prénom',      C.prenom + 1, y + 5);
    doc.text('Type',        C.type + 1,   y + 5);
    doc.text('Statut',      C.statut + 1, y + 5);
    doc.text('Adhésion',    C.date + 1,   y + 5);
    return y + ROW_H;
  }

  function bord(yD, yF) {
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.3);
    doc.rect(C.x, yD, C.fin - C.x, yF - yD);
  }

  const statLib = { ajour: 'À jour', arenouveler: 'À renouveler', enretard: 'En retard' };
  const typeLib = k => (typesMembres[k] ? typesMembres[k].libelle : k) || '—';
  const tronc   = (s, mm) => doc.splitTextToSize(String(s || '—'), mm)[0];

  pdfEnTete('Liste des adhérents ' + annee);
  let y = enTeteTabAdh(50);
  let yD = 50;

  donneesAdherents.forEach((a, idx) => {
    if (y > Y_MAX) {
      bord(yD, y);
      doc.addPage();
      pdfEnTete('Liste des adhérents ' + annee);
      y = enTeteTabAdh(50); yD = 50;
    }
    if (idx % 2 === 0) { doc.setFillColor(...BLEU_CL); doc.rect(C.x, y, C.fin - C.x, ROW_H, 'F'); }
    doc.setTextColor(...ENCRE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(tronc(a.id_adherent,        C.nom - C.num - 2),    C.num + 1,    y + 5);
    doc.text(tronc(a.nom,                C.prenom - C.nom - 2), C.nom + 1,    y + 5);
    doc.text(tronc(a.prenom,             C.type - C.prenom - 2),C.prenom + 1, y + 5);
    doc.text(tronc(typeLib(a.type_membre),C.statut - C.type - 2),C.type + 1,  y + 5);
    doc.text(statLib[calculerStatut(a.saison)] || '—',           C.statut + 1, y + 5);
    doc.text(formaterDate(a.date_adhesion),                      C.date + 1,   y + 5);
    y += ROW_H;
  });
  bord(yD, y);

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(...BLEU); doc.rect(0, 278, 210, 19, 'F');
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.5); doc.line(0, 278, 210, 278);
    doc.setTextColor(...BLANC); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Exporté le ' + dateExp + ' — HSI37', 15, 285);
    doc.text('Page ' + p + ' / ' + total, 195, 285, { align: 'right' });
  }

  doc.save('liste-adherents-HSI37-' + annee + '.pdf');
}

async function exporterListeDonnateursPDF() {
  const { jsPDF } = window.jspdf;
  const doc     = new jsPDF({ unit: 'mm', format: 'a4' });
  const BLEU    = [59, 119, 180];
  const JAUNE   = [247, 205, 70];
  const ENCRE   = [64, 62, 62];
  const BLANC   = [255, 255, 255];
  const BLEU_CL = [232, 241, 250];
  const ROW_H   = 7;
  const Y_MAX   = 270;
  const annee   = new Date().getFullYear();
  const dateExp = new Date().toLocaleDateString('fr-FR');
  const logo    = await chargerLogoBase64PDF('assets/hsi37-redim-demi.png');

  function pdfEnTete(titre) {
    doc.setFillColor(...BLEU);  doc.rect(0, 0, 210, 28, 'F');
    doc.setFillColor(...JAUNE); doc.rect(0, 28, 210, 2, 'F');
    if (logo) doc.addImage(logo, 'PNG', 8, 4, 20, 20);
    doc.setTextColor(...BLANC);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text("HSI37 — Handicap Solidarité pour l'Inclusion 37", 32, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps', 32, 21);
    doc.setTextColor(...BLEU);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(titre, 105, 38, { align: 'center' });
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.7);
    doc.line(30, 41, 180, 41);
  }

  const C = { x: 12, id: 12, nom: 32, prenom: 68, email: 104, type: 144, montant: 164, date: 182, fin: 198 };

  function enTeteTab(y) {
    doc.setFillColor(...BLEU); doc.rect(C.x, y, C.fin - C.x, ROW_H, 'F');
    doc.setTextColor(...BLANC); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('ID',            C.id + 1,      y + 5);
    doc.text('Nom',           C.nom + 1,     y + 5);
    doc.text('Prénom / Org',  C.prenom + 1,  y + 5);
    doc.text('Email',         C.email + 1,   y + 5);
    doc.text('Type de don',   C.type + 1,    y + 5);
    doc.text('Total',         C.montant + 1, y + 5);
    doc.text('Dernier don',   C.date + 1,    y + 5);
    return y + ROW_H;
  }

  function bord(yD, yF) {
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.3);
    doc.rect(C.x, yD, C.fin - C.x, yF - yD);
  }

  const tronc = (s, mm) => doc.splitTextToSize(String(s || '—'), mm)[0];

  pdfEnTete('Liste des donateurs ' + annee);
  let y = enTeteTab(50);
  let yD = 50;

  donneesDonateurs.forEach((don, idx) => {
    if (y > Y_MAX) {
      bord(yD, y);
      doc.addPage();
      pdfEnTete('Liste des donateurs ' + annee);
      y = enTeteTab(50); yD = 50;
    }

    const donsDuDonateur = donneesDons.filter(d => String(d.donateur_id) === String(don.id));
    const totalMontant   = donsDuDonateur.reduce((s, d) => s + (Number(d.montant) || 0), 0);
    const dernierDon     = donsDuDonateur.length > 0
      ? donsDuDonateur.reduce((max, d) => (!max || d.date_don > max ? d.date_don : max), null)
      : (don.date_don || null);
    const montantStr     = donsDuDonateur.length > 0
      ? totalMontant.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
      : '—';
    const prenomOrg      = don.prenom || don.organisme || '—';

    if (idx % 2 === 0) { doc.setFillColor(...BLEU_CL); doc.rect(C.x, y, C.fin - C.x, ROW_H, 'F'); }
    doc.setTextColor(...ENCRE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(tronc(don.id_donateur,  C.nom     - C.id      - 2), C.id + 1,      y + 5);
    doc.text(tronc(don.nom,          C.prenom  - C.nom     - 2), C.nom + 1,     y + 5);
    doc.text(tronc(prenomOrg,        C.email   - C.prenom  - 2), C.prenom + 1,  y + 5);
    doc.text(tronc(don.email,        C.type    - C.email   - 2), C.email + 1,   y + 5);
    doc.text(tronc(don.type_don,     C.montant - C.type    - 2), C.type + 1,    y + 5);
    doc.text(tronc(montantStr,       C.date    - C.montant - 2), C.montant + 1, y + 5);
    doc.text(formaterDate(dernierDon),                            C.date + 1,    y + 5);
    y += ROW_H;
  });
  bord(yD, y);

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(...BLEU); doc.rect(0, 278, 210, 19, 'F');
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.5); doc.line(0, 278, 210, 278);
    doc.setTextColor(...BLANC); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Exporté le ' + dateExp + ' — HSI37', 15, 285);
    doc.text('Page ' + p + ' / ' + total, 195, 285, { align: 'right' });
  }

  doc.save('liste-donateurs-HSI37-' + annee + '.pdf');
}

function exporterParticipantsCSV(participants, nomEvenement) {
  const d = new Date();
  const dateStr = d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  const slug = (nomEvenement || 'evenement').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  exporterCSV(
    participants,
    ['nom', 'prenom', 'email', 'montant'],
    ['Nom', 'Prénom', 'Email', 'Montant payé'],
    'participants-' + slug + '-' + dateStr + '.csv'
  );
}

async function exporterParticipantsPDF(participants, nomEvenement) {
  const { jsPDF } = window.jspdf;
  const doc     = new jsPDF({ unit: 'mm', format: 'a4' });
  const BLEU    = [59, 119, 180];
  const JAUNE   = [247, 205, 70];
  const ENCRE   = [64, 62, 62];
  const BLANC   = [255, 255, 255];
  const BLEU_CL = [232, 241, 250];
  const ROW_H   = 7;
  const Y_MAX   = 270;
  const dateExp = new Date().toLocaleDateString('fr-FR');
  const annee   = new Date().getFullYear();
  const logo    = await chargerLogoBase64PDF('assets/hsi37-redim-demi.png');
  const titre   = 'Participants — ' + (nomEvenement || 'Événement');

  function pdfEnTete() {
    doc.setFillColor(...BLEU);  doc.rect(0, 0, 210, 28, 'F');
    doc.setFillColor(...JAUNE); doc.rect(0, 28, 210, 2, 'F');
    if (logo) doc.addImage(logo, 'PNG', 8, 4, 20, 20);
    doc.setTextColor(...BLANC);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text("HSI37 — Handicap Solidarité pour l'Inclusion 37", 32, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps', 32, 21);
    doc.setTextColor(...BLEU);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(titre, 105, 38, { align: 'center' });
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.7);
    doc.line(30, 41, 180, 41);
  }

  const C = { x: 12, nom: 12, prenom: 62, email: 112, montant: 172, fin: 198 };

  function enTeteTab(y) {
    doc.setFillColor(...BLEU); doc.rect(C.x, y, C.fin - C.x, ROW_H, 'F');
    doc.setTextColor(...BLANC); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('Nom',          C.nom     + 1, y + 5);
    doc.text('Prénom',       C.prenom  + 1, y + 5);
    doc.text('Email',        C.email   + 1, y + 5);
    doc.text('Montant payé', C.montant + 1, y + 5);
    return y + ROW_H;
  }

  function bord(yD, yF) {
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.3);
    doc.rect(C.x, yD, C.fin - C.x, yF - yD);
  }

  const tronc = (s, mm) => doc.splitTextToSize(String(s || '—'), mm)[0];

  pdfEnTete();
  let y = enTeteTab(50);
  let yD = 50;

  if (participants.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
    doc.setTextColor(...ENCRE);
    doc.text('Aucun participant enregistré.', 105, y + 5, { align: 'center' });
    y += ROW_H;
  } else {
    participants.forEach(function(p, idx) {
      if (y > Y_MAX) {
        bord(yD, y);
        doc.addPage();
        pdfEnTete();
        y = enTeteTab(50); yD = 50;
      }
      const montantStr = p.montant != null
        ? parseFloat(p.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' : '—';
      if (idx % 2 === 0) { doc.setFillColor(...BLEU_CL); doc.rect(C.x, y, C.fin - C.x, ROW_H, 'F'); }
      doc.setTextColor(...ENCRE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text(tronc(p.nom,      C.prenom  - C.nom     - 2), C.nom     + 1, y + 5);
      doc.text(tronc(p.prenom,   C.email   - C.prenom  - 2), C.prenom  + 1, y + 5);
      doc.text(tronc(p.email,    C.montant - C.email   - 2), C.email   + 1, y + 5);
      doc.text(tronc(montantStr, C.fin     - C.montant - 2), C.montant + 1, y + 5);
      y += ROW_H;
    });
  }
  bord(yD, y);

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(...BLEU); doc.rect(0, 278, 210, 19, 'F');
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.5); doc.line(0, 278, 210, 278);
    doc.setTextColor(...BLANC); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Exporté le ' + dateExp + ' — HSI37', 15, 285);
    doc.text('Page ' + p + ' / ' + total, 195, 285, { align: 'right' });
  }

  const slug = (nomEvenement || 'evenement').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save('participants-' + slug + '-' + annee + '.pdf');
}

async function exporterListeEvenementsPDF() {
  const { jsPDF } = window.jspdf;
  const doc     = new jsPDF({ unit: 'mm', format: 'a4' });
  const BLEU    = [59, 119, 180];
  const JAUNE   = [247, 205, 70];
  const ENCRE   = [64, 62, 62];
  const BLANC   = [255, 255, 255];
  const BLEU_CL = [232, 241, 250];
  const ROW_H   = 7;
  const Y_MAX   = 270;
  const annee   = new Date().getFullYear();
  const dateExp = new Date().toLocaleDateString('fr-FR');
  const logo    = await chargerLogoBase64PDF('assets/hsi37-redim-demi.png');

  function pdfEnTete(titre) {
    doc.setFillColor(...BLEU);  doc.rect(0, 0, 210, 28, 'F');
    doc.setFillColor(...JAUNE); doc.rect(0, 28, 210, 2, 'F');
    if (logo) doc.addImage(logo, 'PNG', 8, 4, 20, 20);
    doc.setTextColor(...BLANC);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text("HSI37 — Handicap Solidarité pour l'Inclusion 37", 32, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps', 32, 21);
    doc.setTextColor(...BLEU);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(titre, 105, 38, { align: 'center' });
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.7);
    doc.line(30, 41, 180, 41);
  }

  const C = { x: 12, nom: 12, date: 80, prix: 108, part: 138, total: 165, fin: 198 };

  function enTeteTab(y) {
    doc.setFillColor(...BLEU); doc.rect(C.x, y, C.fin - C.x, ROW_H, 'F');
    doc.setTextColor(...BLANC); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('Nom',             C.nom   + 1, y + 5);
    doc.text('Date',            C.date  + 1, y + 5);
    doc.text('Prix unitaire',   C.prix  + 1, y + 5);
    doc.text('Participants',    C.part  + 1, y + 5);
    doc.text('Total collecté',  C.total + 1, y + 5);
    return y + ROW_H;
  }

  function bord(yD, yF) {
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.3);
    doc.rect(C.x, yD, C.fin - C.x, yF - yD);
  }

  const tronc = (s, mm) => doc.splitTextToSize(String(s || '—'), mm)[0];

  pdfEnTete('Liste des événements ' + annee);
  let y = enTeteTab(50);
  let yD = 50;

  donneesEvenements.forEach((ev, idx) => {
    if (y > Y_MAX) {
      bord(yD, y);
      doc.addPage();
      pdfEnTete('Liste des événements ' + annee);
      y = enTeteTab(50); yD = 50;
    }

    const parts = donneesParticipants.filter(p => String(p.evenement_id) === String(ev.id));
    const nbPart = parts.reduce((s, p) => s + (p.quantite || 1), 0);
    const total  = parts.reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
    const date   = ev.date ? new Date(ev.date).toLocaleDateString('fr-FR') : '—';
    const prix   = ev.prix_unitaire != null
      ? parseFloat(ev.prix_unitaire).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' : '—';
    const totalStr = total.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';

    if (idx % 2 === 0) { doc.setFillColor(...BLEU_CL); doc.rect(C.x, y, C.fin - C.x, ROW_H, 'F'); }
    doc.setTextColor(...ENCRE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(tronc(ev.nom,   C.date  - C.nom   - 2), C.nom   + 1, y + 5);
    doc.text(tronc(date,     C.prix  - C.date  - 2), C.date  + 1, y + 5);
    doc.text(tronc(prix,     C.part  - C.prix  - 2), C.prix  + 1, y + 5);
    doc.text(String(nbPart),                          C.part  + 1, y + 5);
    doc.text(tronc(totalStr, C.fin   - C.total - 2), C.total + 1, y + 5);
    y += ROW_H;
  });
  bord(yD, y);

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(...BLEU); doc.rect(0, 278, 210, 19, 'F');
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.5); doc.line(0, 278, 210, 278);
    doc.setTextColor(...BLANC); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Exporté le ' + dateExp + ' — HSI37', 15, 285);
    doc.text('Page ' + p + ' / ' + total, 195, 285, { align: 'right' });
  }

  doc.save('liste-evenements-HSI37-' + annee + '.pdf');
}

async function exporterRapportAnnuelPDF() {
  const { jsPDF } = window.jspdf;
  const doc     = new jsPDF({ unit: 'mm', format: 'a4' });
  const BLEU    = [59, 119, 180];
  const JAUNE   = [247, 205, 70];
  const ENCRE   = [64, 62, 62];
  const BLANC   = [255, 255, 255];
  const BLEU_CL = [232, 241, 250];
  const GRIS_CL = [245, 245, 245];
  const ROW_H   = 7;
  const Y_MAX   = 270;
  const annee   = new Date().getFullYear();
  const dateExp = new Date().toLocaleDateString('fr-FR');
  const logo    = await chargerLogoBase64PDF('assets/hsi37-redim-demi.png');

  /* ---- Chargement dons de matériel ---- */
  let donsMateriel = [];
  const { data: dmData } = await clientSupabase
    .from('dons_materiel')
    .select('date_expedition, beneficiaire_nom, beneficiaire_type, ville_destination, pays_destination, statut')
    .order('date_expedition', { ascending: false });
  if (dmData) donsMateriel = dmData;

  /* ---- Helpers ---- */
  function fmt(n) {
    return Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
  }

  function pdfEnTete(titre) {
    doc.setFillColor(...BLEU);  doc.rect(0, 0, 210, 28, 'F');
    doc.setFillColor(...JAUNE); doc.rect(0, 28, 210, 2, 'F');
    if (logo) doc.addImage(logo, 'PNG', 8, 4, 20, 20);
    doc.setTextColor(...BLANC);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text("HSI37 — Handicap Solidarité pour l'Inclusion 37", 32, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps', 32, 21);
    doc.setTextColor(...BLEU);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(titre, 105, 38, { align: 'center' });
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.7);
    doc.line(30, 41, 180, 41);
  }

  function titreSec(titre, y) {
    doc.setFillColor(...BLEU); doc.rect(12, y, 186, 8, 'F');
    doc.setTextColor(...BLANC); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(titre, 105, y + 5.5, { align: 'center' });
    return y + 8;
  }

  function carteStat(x, y, chiffre, label, couleur) {
    const w = 86, h = 30;
    doc.setDrawColor(...(couleur || BLEU)); doc.setLineWidth(0.4);
    doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, w, h, 3, 3, 'FD');
    doc.setTextColor(...(couleur || BLEU));
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
    doc.text(String(chiffre), x + w / 2, y + 17, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(label, x + w / 2, y + 25, { align: 'center' });
  }

  function tronc(s, mm) { return doc.splitTextToSize(String(s || '—'), mm)[0]; }

  function dessinerTableau(cols, donnees, yDepart, getTitreSuite) {
    let y = yDepart;
    let yD = yDepart;

    // En-tête
    doc.setFillColor(...BLEU); doc.rect(cols[0].x, y, cols[cols.length-1].fin - cols[0].x, ROW_H, 'F');
    doc.setTextColor(...BLANC); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    cols.forEach(c => { if (c.label) doc.text(c.label, c.x + 1, y + 5); });
    y += ROW_H;

    donnees.forEach((row, idx) => {
      if (y > Y_MAX) {
        doc.setDrawColor(...BLEU); doc.setLineWidth(0.3);
        doc.rect(cols[0].x, yD, cols[cols.length-1].fin - cols[0].x, y - yD);
        doc.addPage();
        pdfEnTete(getTitreSuite());
        let ny = titreSec(getTitreSuite(), 50);
        doc.setFillColor(...BLEU); doc.rect(cols[0].x, ny, cols[cols.length-1].fin - cols[0].x, ROW_H, 'F');
        doc.setTextColor(...BLANC); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        cols.forEach(c => { if (c.label) doc.text(c.label, c.x + 1, ny + 5); });
        y = ny + ROW_H; yD = ny;
      }
      if (idx % 2 === 0) {
        doc.setFillColor(...BLEU_CL);
        doc.rect(cols[0].x, y, cols[cols.length-1].fin - cols[0].x, ROW_H, 'F');
      }
      doc.setTextColor(...ENCRE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      cols.forEach(c => {
        if (c.valeur) doc.text(tronc(c.valeur(row), c.fin - c.x - 2), c.x + 1, y + 5);
      });
      y += ROW_H;
    });

    doc.setDrawColor(...BLEU); doc.setLineWidth(0.3);
    doc.rect(cols[0].x, yD, cols[cols.length-1].fin - cols[0].x, y - yD);
    return y;
  }

  /* ---- Page 1 : statistiques ---- */
  const totalAdh    = donneesAdherents.length;
  const aJour       = donneesAdherents.filter(a => calculerStatut(a.saison) === 'ajour').length;
  const expires     = totalAdh - aJour;
  const totalCotis  = donneesCotisations.reduce((s, c) => s + (Number(c.montant) || 0), 0);
  const totalDonsF  = donneesDonateurs.reduce((s, d) => {
    const estMat = (d.type_don || '').toLowerCase().includes('mat');
    return s + (estMat ? 0 : (Number(d.montant_don) || 0));
  }, 0);
  const nbDonsMat   = donsMateriel.length;

  pdfEnTete('Rapport annuel ' + annee);

  carteStat(12,  52,  totalAdh,  'Adhérents total',       BLEU);
  carteStat(112, 52,  aJour,     'À jour',                [34, 139, 34]);
  carteStat(12,  90,  expires,   'Expirés',               [200, 50, 50]);
  carteStat(112, 90,  fmt(totalCotis), 'Total cotisations', BLEU);
  carteStat(12,  128, fmt(totalDonsF), 'Total dons financiers',  [180, 100, 0]);
  carteStat(112, 128, nbDonsMat, 'Dons de matériel',      BLEU);

  /* ---- Page 2 : tableau des adhérents ---- */
  doc.addPage();
  pdfEnTete('Rapport annuel ' + annee);
  let y = titreSec('LISTE DES ADHÉRENTS', 50);

  const statLib = { ajour: 'À jour', arenouveler: 'À renouveler', enretard: 'En retard' };
  const typeLib = k => (typesMembres[k] ? typesMembres[k].libelle : k) || '—';

  const colsAdh = [
    { x: 12, fin: 38, label: 'N° adhérent', valeur: a => a.id_adherent },
    { x: 38, fin: 78, label: 'Nom',         valeur: a => a.nom },
    { x: 78, fin: 118,label: 'Prénom',      valeur: a => a.prenom },
    { x: 118,fin: 150,label: 'Type',        valeur: a => typeLib(a.type_membre) },
    { x: 150,fin: 175,label: 'Statut',      valeur: a => statLib[calculerStatut(a.saison)] || '—' },
    { x: 175,fin: 198,label: 'Adhésion',    valeur: a => formaterDate(a.date_adhesion) },
  ];
  dessinerTableau(colsAdh, donneesAdherents, y, () => 'Rapport annuel ' + annee);

  /* ---- Page suivante : dons financiers ---- */
  doc.addPage();
  pdfEnTete('Rapport annuel ' + annee);
  y = titreSec('DONS FINANCIERS REÇUS', 50);

  const donsFin = donneesDonateurs.filter(d => !(d.type_don || '').toLowerCase().includes('mat'));
  const colsDonFin = [
    { x: 12, fin: 36, label: 'Date',       valeur: d => formaterDate(d.date_don) },
    { x: 36, fin: 76, label: 'Nom',        valeur: d => (d.nom || '') + ' ' + (d.prenom || '') },
    { x: 76, fin: 120,label: 'Organisme',  valeur: d => d.organisme },
    { x: 120,fin: 162,label: 'Type de don',valeur: d => d.type_don },
    { x: 162,fin: 198,label: 'Montant',    valeur: d => d.montant_don != null ? fmt(d.montant_don) : '—' },
  ];
  dessinerTableau(colsDonFin, donsFin, y, () => 'Rapport annuel ' + annee);

  /* ---- Page suivante : dons de matériel ---- */
  doc.addPage();
  pdfEnTete('Rapport annuel ' + annee);
  y = titreSec('DONS DE MATÉRIEL ENVOYÉS', 50);

  const colsDonMat = [
    { x: 12, fin: 36, label: 'Date',         valeur: d => formaterDate(d.date_expedition) },
    { x: 36, fin: 100,label: 'Bénéficiaire', valeur: d => d.beneficiaire_nom || d.beneficiaire_type },
    { x: 100,fin: 155,label: 'Destination',  valeur: d => [d.ville_destination, d.pays_destination].filter(Boolean).join(', ') },
    { x: 155,fin: 198,label: 'Statut',       valeur: d => d.statut },
  ];
  dessinerTableau(colsDonMat, donsMateriel, y, () => 'Rapport annuel ' + annee);

  /* ---- Page suivante : événements ---- */
  doc.addPage();
  pdfEnTete('Rapport annuel ' + annee);
  y = titreSec('ÉVÉNEMENTS DE L\'ANNÉE', 50);

  const evenementsAnnee = donneesEvenements.filter(function(ev) {
    return ev.date && new Date(ev.date).getFullYear() === annee;
  });

  const colsEv = [
    { x: 12,  fin: 90,  label: 'Événement',        valeur: ev => ev.nom },
    { x: 90,  fin: 120, label: 'Date',              valeur: ev => formaterDate(ev.date) },
    { x: 120, fin: 158, label: 'Participants',      valeur: ev => {
        const nb = donneesParticipants
          .filter(p => String(p.evenement_id) === String(ev.id))
          .reduce((s, p) => s + (p.quantite || 1), 0);
        return String(nb);
      }
    },
    { x: 158, fin: 198, label: 'Total collecté',   valeur: ev => {
        const total = donneesParticipants
          .filter(p => String(p.evenement_id) === String(ev.id))
          .reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
        return fmt(total);
      }
    },
  ];
  dessinerTableau(colsEv, evenementsAnnee.length ? evenementsAnnee : [{ nom: 'Aucun événement enregistré pour cette année', date: null }], y, () => 'Rapport annuel ' + annee);

  /* ---- Pied de page (2 passes) ---- */
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(...BLEU); doc.rect(0, 278, 210, 19, 'F');
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.5); doc.line(0, 278, 210, 278);
    doc.setTextColor(...BLANC); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Exporté le ' + dateExp + ' — HSI37', 15, 285);
    doc.text('Page ' + p + ' / ' + total, 195, 285, { align: 'right' });
  }

  doc.save('rapport-annuel-HSI37-' + annee + '.pdf');
}

document.addEventListener("click", function(e) {
  if (!e.target.closest(".btn-export-participants") &&
      !e.target.closest(".menu-export-participants")) {
    document.querySelectorAll(".menu-export-participants").forEach(function(m) { m.hidden = true; });
  }
});

document.addEventListener("DOMContentLoaded", function() {
  var btnAdh = document.getElementById("btn-export-adherents");
  if (btnAdh) {
    btnAdh.addEventListener("click", function() {
      var annee = new Date().getFullYear();
      exporterCSV(
        donneesAdherents,
        ["id_adherent","nom","prenom","email","telephone","type_membre","date_adhesion","statut","saison"],
        ["ID","Nom","Prénom","Email","Téléphone","Type de membre","Date d'adhésion","Statut","Saison"],
        "adherents_HSI37_" + annee + ".csv"
      );
    });
  }

  var btnDon = document.getElementById("btn-export-donateurs");
  if (btnDon) {
    btnDon.addEventListener("click", function() {
      var annee = new Date().getFullYear();
      exporterCSV(
        donneesDonateurs,
        ["id_donateur","nom","prenom","organisme","email","type_don","montant_don","description_don","date_don","mode_paiement"],
        ["ID","Nom","Prénom","Organisme","Email","Type de don","Montant","Description","Date du don","Mode de paiement"],
        "donateurs_HSI37_" + annee + ".csv"
      );
    });
  }

  var btnListePDF = document.getElementById("btn-export-adherents-pdf");
  if (btnListePDF) {
    btnListePDF.addEventListener("click", function() { exporterListeAdherentsPDF(); });
  }

  var btnListeDonPDF = document.getElementById("btn-export-donateurs-pdf");
  if (btnListeDonPDF) {
    btnListeDonPDF.addEventListener("click", function() { exporterListeDonnateursPDF(); });
  }

  var btnEv = document.getElementById("btn-export-evenements");
  if (btnEv) {
    btnEv.addEventListener("click", function() {
      var annee = new Date().getFullYear();
      var donnees = donneesEvenements.map(function(ev) {
        var parts = donneesParticipants.filter(function(p) {
          return String(p.evenement_id) === String(ev.id);
        });
        return {
          nom:          ev.nom || "",
          date:         ev.date ? new Date(ev.date).toLocaleDateString("fr-FR") : "",
          prix:         ev.prix_unitaire != null ? ev.prix_unitaire : "",
          participants: parts.reduce(function(s, p) { return s + (p.quantite || 1); }, 0),
          total:        parts.reduce(function(s, p) { return s + (parseFloat(p.montant) || 0); }, 0).toFixed(2)
        };
      });
      exporterCSV(
        donnees,
        ["nom", "date", "prix", "participants", "total"],
        ["Nom", "Date", "Prix unitaire", "Participants", "Total collecté"],
        "evenements_HSI37_" + annee + ".csv"
      );
    });
  }

  var btnEvPDF = document.getElementById("btn-export-evenements-pdf");
  if (btnEvPDF) {
    btnEvPDF.addEventListener("click", function() { exporterListeEvenementsPDF(); });
  }

  var btnRapportPDF = document.getElementById("btn-rapport-annuel-pdf");
  if (btnRapportPDF) {
    btnRapportPDF.addEventListener("click", function() { exporterRapportAnnuelPDF(); });
  }
});

function dateStrExport() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function exporterTableCSV(table, nomFichier, labelErreur) {
  const { data, error } = await clientSupabase.from(table).select('*').order('nom', { ascending: true });
  if (error) throw new Error(labelErreur + ' : ' + error.message);
  const cols = data.length > 0 ? Object.keys(data[0]) : [];
  telechargerFichier(genererCSV(data, cols), nomFichier);
  return { data, cols };
}

document.getElementById("btn-export-adh-csv").addEventListener("click", async function() {
  const btn = this; btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Export…';
  try {
    await exporterTableCSV('adherents', `export-adherents-${dateStrExport()}.csv`, 'Adhérents');
    afficherMessageSuccesDoc('Adhérents exportés avec succès.');
  } catch (e) { afficherMessageErreurDoc('Export échoué : ' + e.message); }
  finally { btn.disabled = false; btn.textContent = orig; }
});

document.getElementById("btn-export-don-csv").addEventListener("click", async function() {
  const btn = this; btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Export…';
  try {
    await exporterTableCSV('donateurs', `export-donateurs-${dateStrExport()}.csv`, 'Donateurs');
    afficherMessageSuccesDoc('Donateurs exportés avec succès.');
  } catch (e) { afficherMessageErreurDoc('Export échoué : ' + e.message); }
  finally { btn.disabled = false; btn.textContent = orig; }
});

document.getElementById("btn-export-ev-csv").addEventListener("click", async function() {
  const btn = this; btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Export…';
  try {
    const { data, error } = await clientSupabase.from('evenements').select('*').order('date', { ascending: false });
    if (error) throw new Error('Événements : ' + error.message);
    const cols = data.length > 0 ? Object.keys(data[0]) : [];
    telechargerFichier(genererCSV(data, cols), `export-evenements-${dateStrExport()}.csv`);
    afficherMessageSuccesDoc('Événements exportés avec succès.');
  } catch (e) { afficherMessageErreurDoc('Export échoué : ' + e.message); }
  finally { btn.disabled = false; btn.textContent = orig; }
});

document.getElementById("btn-export-zip").addEventListener("click", async function() {
  const btn = this; btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Préparation…';
  try {
    const dateStr = dateStrExport();
    const [resAdh, resDon, resEv] = await Promise.all([
      clientSupabase.from('adherents').select('*').order('nom', { ascending: true }),
      clientSupabase.from('donateurs').select('*').order('nom', { ascending: true }),
      clientSupabase.from('evenements').select('*').order('date', { ascending: false })
    ]);
    if (resAdh.error) throw new Error('Adhérents : ' + resAdh.error.message);
    if (resDon.error) throw new Error('Donateurs : ' + resDon.error.message);
    if (resEv.error)  throw new Error('Événements : ' + resEv.error.message);

    const colAdh = resAdh.data.length > 0 ? Object.keys(resAdh.data[0]) : [];
    const colDon = resDon.data.length > 0 ? Object.keys(resDon.data[0]) : [];
    const colEv  = resEv.data.length  > 0 ? Object.keys(resEv.data[0])  : [];

    const zip = new JSZip();
    zip.file(`export-adherents-${dateStr}.csv`,  genererCSV(resAdh.data, colAdh));
    zip.file(`export-donateurs-${dateStr}.csv`,  genererCSV(resDon.data, colDon));
    zip.file(`export-evenements-${dateStr}.csv`, genererCSV(resEv.data,  colEv));

    const blob = await zip.generateAsync({ type: 'blob' });
    const url  = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url; lien.download = `export-HSI37-${dateStr}.zip`;
    document.body.appendChild(lien); lien.click();
    setTimeout(function() { document.body.removeChild(lien); URL.revokeObjectURL(url); }, 200);

    afficherMessageSuccesDoc('Export ZIP généré avec succès (3 fichiers CSV).');
  } catch (e) { afficherMessageErreurDoc('Export échoué : ' + e.message); }
  finally { btn.disabled = false; btn.textContent = orig; }
});

function appliquerFiltreAdherents() {
  var f = filtreAdherents.toLowerCase();
  var liste = donneesAdherents.filter(function(a) {
    if (filtreAnneeAdherents && a.date_adhesion &&
        new Date(a.date_adhesion).getFullYear() !== Number(filtreAnneeAdherents)) return false;
    return (a.nom||"").toLowerCase().includes(f) || (a.prenom||"").toLowerCase().includes(f) || (a.email||"").toLowerCase().includes(f) || (a.telephone||"").toLowerCase().includes(f) || (a.type_membre||"").toLowerCase().includes(f);
  });
  if (triAdherents.colonne) {
    var col = triAdherents.colonne; var sens = triAdherents.sens;
    liste.sort(function(a,b) {
      var va = col==="statut" ? calculerStatut(a.saison) : (a[col]||"");
      var vb = col==="statut" ? calculerStatut(b.saison) : (b[col]||"");
      return sens==="asc" ? (va<vb?-1:va>vb?1:0) : (va>vb?-1:va<vb?1:0);
    });
  }
  remplirTableau(liste);
}

function appliquerFiltreDonateurs() {
  var f = filtreDonateurs.toLowerCase();
  var liste = donneesDonateurs.filter(function(d) {
    if (filtreAnneeDonateurs && d.date_don &&
        new Date(d.date_don).getFullYear() !== Number(filtreAnneeDonateurs)) return false;
    return (d.nom||"").toLowerCase().includes(f) || (d.prenom||"").toLowerCase().includes(f) || (d.organisme||"").toLowerCase().includes(f) || (d.email||"").toLowerCase().includes(f) || (d.type_don||"").toLowerCase().includes(f);
  });
  if (triDonateurs.colonne) {
    var col = triDonateurs.colonne; var sens = triDonateurs.sens;
    liste.sort(function(a,b) {
      var va = a[col]||""; var vb = b[col]||"";
      if (col==="montant_don") { va=Number(va)||0; vb=Number(vb)||0; }
      return sens==="asc" ? (va<vb?-1:va>vb?1:0) : (va>vb?-1:va<vb?1:0);
    });
  }
  remplirTableauDonateurs(liste);
}

/* ---------- FILTRES ANNÉE (options dynamiques) ---------- */
function initialiserFiltresAnnee() {
  var anneeActuelle = new Date().getFullYear();
  ["filtre-annee-adherents", "filtre-annee-donateurs", "filtre-annee-evenements"].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    for (var a = 2024; a <= anneeActuelle; a++) {
      var opt = document.createElement("option");
      opt.value = String(a);
      opt.textContent = String(a);
      if (a === anneeActuelle) opt.selected = true;
      sel.appendChild(opt);
    }
  });
  var spanFooter = document.getElementById("footer-annee");
  if (spanFooter) spanFooter.textContent = String(anneeActuelle);
}

/* ---------- INITIALISATION ---------- */
document.addEventListener("DOMContentLoaded", function() {
  initialiserSelectsDate();
  initialiserSelectsDateDon();
  initialiserFiltresAnnee();
  verifierSession();

  var inputAdh = document.getElementById("recherche-adherents");
  if (inputAdh) inputAdh.addEventListener("input", function() { filtreAdherents=this.value; appliquerFiltreAdherents(); });

  var selAnneeAdh = document.getElementById("filtre-annee-adherents");
  if (selAnneeAdh) selAnneeAdh.addEventListener("change", function() { filtreAnneeAdherents=this.value; appliquerFiltreAdherents(); });

  var inputDon = document.getElementById("recherche-donateurs");
  if (inputDon) inputDon.addEventListener("input", function() { filtreDonateurs=this.value; appliquerFiltreDonateurs(); });

  var selAnneeDon = document.getElementById("filtre-annee-donateurs");
  if (selAnneeDon) selAnneeDon.addEventListener("change", function() { filtreAnneeDonateurs=this.value; appliquerFiltreDonateurs(); });

  var selAnneeEv = document.getElementById("filtre-annee-evenements");
  if (selAnneeEv) selAnneeEv.addEventListener("change", function() { filtreAnneeEvenements=this.value; remplirTableauEvenements(); });

  var theadAdh = document.querySelector("#tableau-adherents thead");
  if (theadAdh) theadAdh.addEventListener("click", function(e) {
    var th = e.target.closest("th[data-colonne]"); if (!th) return;
    var col = th.dataset.colonne;
    triAdherents.sens = triAdherents.colonne===col ? (triAdherents.sens==="asc"?"desc":"asc") : "asc";
    triAdherents.colonne = col;
    theadAdh.querySelectorAll("th[data-colonne]").forEach(function(t){ delete t.dataset.sens; });
    th.dataset.sens = triAdherents.sens;
    var selAdh = document.getElementById("tri-adherents");
    if (selAdh) selAdh.value = "";
    appliquerFiltreAdherents();
  });

  var theadDon = document.querySelector("#tableau-donateurs thead");
  if (theadDon) theadDon.addEventListener("click", function(e) {
    var th = e.target.closest("th[data-colonne]"); if (!th) return;
    var col = th.dataset.colonne;
    triDonateurs.sens = triDonateurs.colonne===col ? (triDonateurs.sens==="asc"?"desc":"asc") : "asc";
    triDonateurs.colonne = col;
    theadDon.querySelectorAll("th[data-colonne]").forEach(function(t){ delete t.dataset.sens; });
    th.dataset.sens = triDonateurs.sens;
    var selDon = document.getElementById("tri-donateurs");
    if (selDon) selDon.value = "";
    appliquerFiltreDonateurs();
  });

  var selectTriAdh = document.getElementById("tri-adherents");
  if (selectTriAdh) selectTriAdh.addEventListener("change", function() {
    var val = this.value;
    if (!val) {
      triAdherents.colonne = null; triAdherents.sens = "asc";
    } else {
      var sep = val.lastIndexOf("-");
      triAdherents.colonne = val.slice(0, sep);
      triAdherents.sens    = val.slice(sep + 1);
    }
    if (theadAdh) theadAdh.querySelectorAll("th[data-colonne]").forEach(function(t){ delete t.dataset.sens; });
    appliquerFiltreAdherents();
  });

  var selectTriDon = document.getElementById("tri-donateurs");
  if (selectTriDon) selectTriDon.addEventListener("change", function() {
    var val = this.value;
    if (!val) {
      triDonateurs.colonne = null; triDonateurs.sens = "asc";
    } else {
      var sep = val.lastIndexOf("-");
      triDonateurs.colonne = val.slice(0, sep);
      triDonateurs.sens    = val.slice(sep + 1);
    }
    if (theadDon) theadDon.querySelectorAll("th[data-colonne]").forEach(function(t){ delete t.dataset.sens; });
    appliquerFiltreDonateurs();
  });
});
