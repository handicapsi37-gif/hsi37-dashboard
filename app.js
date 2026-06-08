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
 * Accepte la clé courte ("actif") pour les anciennes données
 * ou le libellé complet ("Membre actif") pour les nouvelles données.
 * @param {string} valeur - Clé courte ou libellé complet
 * @returns {string} HTML de la cellule
 */
function genererCelluleType(valeur) {
  /* Chercher d'abord par clé courte, puis par libellé complet */
  let type = typesMembres[valeur];
  if (!type) {
    const entree = Object.entries(typesMembres).find(function([, t]) {
      return t.libelle === valeur;
    });
    if (entree) type = entree[1];
  }
  if (!type) return valeur || "—";

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
 * Ouvre la modale, réinitialise le formulaire et déplace le focus.
 */
function ouvrirModale() {
  elementAvantModale = document.activeElement;

  /* Réinitialiser le formulaire et effacer tous les messages d'erreur */
  formulaire.reset();
  const zoneErreurModale = document.getElementById("modale-erreur");
  if (zoneErreurModale) {
    zoneErreurModale.hidden = true;
    zoneErreurModale.textContent = "";
  }
  document.querySelectorAll(".champ-erreur").forEach(function(el) { el.remove(); });
  document.querySelectorAll(".champ-input--erreur").forEach(function(el) {
    el.classList.remove("champ-input--erreur");
  });

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

/* =====================================================
   AJOUT D'UN ADHÉRENT — VALIDATION ET ENREGISTREMENT
   ===================================================== */

/**
 * Affiche un message d'erreur sous un champ et le marque visuellement.
 * @param {string} idChamp - ID du champ concerné
 * @param {string} message - Message en français
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
 * Valide le formulaire d'ajout.
 * Affiche les erreurs individuelles sous chaque champ invalide.
 * @returns {boolean} true si tout est valide, false sinon
 */
function validerFormulaire() {
  /* Effacer les erreurs du passage précédent */
  document.querySelectorAll(".champ-erreur").forEach(function(el) { el.remove(); });
  document.querySelectorAll(".champ-input--erreur").forEach(function(el) {
    el.classList.remove("champ-input--erreur");
  });

  let valide = true;

  const nom    = document.getElementById("champ-nom").value.trim();
  const prenom = document.getElementById("champ-prenom").value.trim();
  const email  = document.getElementById("champ-email").value.trim();
  const date   = document.getElementById("champ-date").value;
  const type   = document.getElementById("champ-type").value;
  const montant = document.getElementById("champ-montant").value.trim();

  if (!nom) {
    marquerChampErreur("champ-nom", "Le nom est obligatoire.");
    valide = false;
  }
  if (!prenom) {
    marquerChampErreur("champ-prenom", "Le prénom est obligatoire.");
    valide = false;
  }
  if (!date) {
    marquerChampErreur("champ-date", "La date d'adhésion est obligatoire.");
    valide = false;
  }
  if (!type) {
    marquerChampErreur("champ-type", "Le type de membre est obligatoire.");
    valide = false;
  }
  /* Email facultatif mais vérifié si renseigné */
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    marquerChampErreur("champ-email", "L'adresse e-mail n'est pas valide.");
    valide = false;
  }
  /* Montant facultatif mais doit être numérique si renseigné */
  if (montant && isNaN(parseFloat(montant.replace(",", ".")))) {
    marquerChampErreur("champ-montant", "Le montant doit être un nombre (ex : 20 ou 20,50).");
    valide = false;
  }

  return valide;
}

/**
 * Lit les adhérents de la même saison dans Supabase et génère le prochain id_adherent.
 * Format : HSI-AAAA-NNNN, NNNN repart à 0001 chaque année.
 * @param {string} annee - Année sur 4 chiffres (ex : "2026")
 * @returns {Promise<string>} Identifiant unique (ex : "HSI-2026-0001")
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
        /* Extraire le numéro NNNN depuis "HSI-AAAA-NNNN" */
        const parties = adherent.id_adherent.split("-");
        if (parties.length === 3) {
          const numero = parseInt(parties[2], 10);
          if (!isNaN(numero) && numero > maxNumero) {
            maxNumero = numero;
          }
        }
      }
    });
  }

  const nnnn = String(maxNumero + 1).padStart(4, "0");
  return `HSI-${annee}-${nnnn}`;
}

/**
 * Affiche un bandeau de succès au-dessus du tableau, qui disparaît après 5 secondes.
 * @param {string} texte - Message à afficher
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

/* Soumission du formulaire d'ajout : validation → génération ID → insert Supabase */
formulaire.addEventListener("submit", async function(evenement) {
  evenement.preventDefault();

  const zoneErreurModale = document.getElementById("modale-erreur");
  zoneErreurModale.hidden = true;
  zoneErreurModale.textContent = "";

  if (!validerFormulaire()) return;

  /* Lecture des valeurs saisies */
  const nom          = document.getElementById("champ-nom").value.trim();
  const prenom       = document.getElementById("champ-prenom").value.trim();
  const email        = document.getElementById("champ-email").value.trim() || null;
  const telephone    = document.getElementById("champ-telephone").value.trim() || null;
  const adresse      = document.getElementById("champ-adresse").value.trim() || null;
  const dateAdhesion = document.getElementById("champ-date").value;
  const typeMembre   = document.getElementById("champ-type").value;
  const montantBrut  = document.getElementById("champ-montant").value.trim();

  /* Champs générés automatiquement */
  const saison = dateAdhesion.split("-")[0]; /* Année de la date d'adhésion */
  const montantCotisation = montantBrut
    ? parseFloat(montantBrut.replace(",", "."))
    : null;

  /* Génération de l'identifiant HSI-AAAA-NNNN */
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
    email,
    telephone,
    adresse,
    date_adhesion:      dateAdhesion,
    montant_cotisation: montantCotisation,
    type_membre:        typeMembre,
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

  /* Succès : fermer la modale, recharger le tableau, afficher la confirmation */
  fermerModale();
  await chargerAdherents();
  afficherMessageSucces(`Adhérent ajouté : ${prenom} ${nom} (${idAdherent}).`);
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
