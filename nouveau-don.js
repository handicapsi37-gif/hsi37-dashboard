/* =====================================================
   NOUVEAU-DON.JS — HSI37 Dashboard
   Formulaire de saisie d'un nouveau don de matériel
   ===================================================== */

const clientSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let photosSelectionnees = [];

/* ---------- AUTHENTIFICATION ---------- */

async function verifierSession() {
  const { data: { session } } = await clientSupabase.auth.getSession();
  if (!session) {
    document.getElementById('ecran-connexion').removeAttribute('hidden');
    return false;
  }
  afficherInterface();
  return true;
}

function afficherInterface() {
  document.getElementById('ecran-connexion').hidden = true;
  document.querySelector('.entete').removeAttribute('hidden');
  document.getElementById('contenu-principal').removeAttribute('hidden');
}

document.getElementById('formulaire-connexion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('connexion-email').value.trim();
  const mdp   = document.getElementById('connexion-mdp').value;
  const erreur = document.getElementById('connexion-erreur');
  erreur.hidden = true;

  const { error } = await clientSupabase.auth.signInWithPassword({ email, password: mdp });
  if (error) {
    erreur.textContent = 'Email ou mot de passe incorrect.';
    erreur.hidden = false;
    return;
  }
  afficherInterface();
  initialiser();
});

document.getElementById('btn-deconnexion').addEventListener('click', async () => {
  await clientSupabase.auth.signOut();
  window.location.href = 'index.html';
});

/* ---------- DATE : remplir les sélecteurs ---------- */

function remplirSelecteursDate() {
  const selJour   = document.getElementById('date-jour');
  const selAnnee  = document.getElementById('date-annee');

  for (let j = 1; j <= 31; j++) {
    const opt = document.createElement('option');
    opt.value = String(j).padStart(2, '0');
    opt.textContent = j;
    selJour.appendChild(opt);
  }

  const anneeActuelle = new Date().getFullYear();
  for (let a = anneeActuelle; a >= anneeActuelle - 10; a--) {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    selAnnee.appendChild(opt);
  }

  // Pré-remplir avec la date du jour
  const auj = new Date();
  selJour.value  = String(auj.getDate()).padStart(2, '0');
  document.getElementById('date-mois').value = String(auj.getMonth() + 1).padStart(2, '0');
  selAnnee.value = auj.getFullYear();
}

/* ---------- CHARGEMENT DES ADHÉRENTS ---------- */

async function chargerAdherents() {
  const { data, error } = await clientSupabase
    .from('adherents')
    .select('id, nom, prenom')
    .order('nom', { ascending: true });

  if (error || !data) return;

  const sel = document.getElementById('benef-adherent');
  sel.innerHTML = '<option value="">— Sélectionner un adhérent —</option>';
  data.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.nom || ''} ${a.prenom || ''}`.trim();
    sel.appendChild(opt);
  });
}

/* ---------- BASCULEMENT TYPE BÉNÉFICIAIRE ---------- */

document.querySelectorAll('input[name="type-benef"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const estMembre = document.getElementById('radio-membre').checked;
    document.getElementById('bloc-externe').hidden = estMembre;
    document.getElementById('bloc-membre').hidden  = !estMembre;
  });
});

/* ---------- TABLEAU MATÉRIEL ---------- */

let compteurLignes = 0;

function ajouterLigneMateriel(designation = '', qteExp = '', qteRec = '') {
  compteurLignes++;
  const id = compteurLignes;
  const tbody = document.getElementById('corps-materiel');
  const tr = document.createElement('tr');
  tr.dataset.ligneid = id;
  tr.innerHTML = `
    <td>
      <input type="text"
             id="mat-designation-${id}"
             placeholder="Ex : Fauteuil roulant pliant"
             value="${echapper(designation)}"
             aria-label="Désignation du matériel ligne ${id}" />
    </td>
    <td>
      <input type="number"
             id="mat-qte-exp-${id}"
             placeholder="0"
             min="0"
             value="${echapper(String(qteExp))}"
             aria-label="Quantité expédiée ligne ${id}" />
    </td>
    <td>
      <input type="number"
             id="mat-qte-rec-${id}"
             placeholder="0"
             min="0"
             value="${echapper(String(qteRec))}"
             aria-label="Quantité reçue ligne ${id}" />
    </td>
    <td style="text-align:center;">
      <button type="button" class="btn-suppr-ligne"
              onclick="supprimerLigne(${id})"
              aria-label="Supprimer cette ligne">✕</button>
    </td>`;
  tbody.appendChild(tr);
}

function supprimerLigne(id) {
  const tr = document.querySelector(`tr[data-ligneid="${id}"]`);
  if (tr) tr.remove();
}

document.getElementById('btn-ajouter-ligne').addEventListener('click', () => {
  ajouterLigneMateriel();
});

function lireMateriel() {
  const lignes = document.querySelectorAll('#corps-materiel tr');
  const materiel = [];
  lignes.forEach(tr => {
    const id  = tr.dataset.ligneid;
    const des = document.getElementById(`mat-designation-${id}`).value.trim();
    const exp = document.getElementById(`mat-qte-exp-${id}`).value;
    const rec = document.getElementById(`mat-qte-rec-${id}`).value;
    if (des) {
      materiel.push({
        nom: des,
        quantite_expediee: exp ? parseInt(exp, 10) : null,
        quantite_recue:    rec ? parseInt(rec, 10) : null,
      });
    }
  });
  return materiel;
}

/* ---------- GESTION DES PHOTOS ---------- */

const inputPhotos = document.getElementById('input-photos');
const apercuPhotos = document.getElementById('apercu-photos');
const zoneUpload = document.getElementById('zone-upload');

inputPhotos.addEventListener('change', () => {
  Array.from(inputPhotos.files).forEach(ajouterPhoto);
  inputPhotos.value = '';
});

zoneUpload.addEventListener('dragover', (e) => {
  e.preventDefault();
  zoneUpload.classList.add('drag-over');
});
zoneUpload.addEventListener('dragleave', () => zoneUpload.classList.remove('drag-over'));
zoneUpload.addEventListener('drop', (e) => {
  e.preventDefault();
  zoneUpload.classList.remove('drag-over');
  Array.from(e.dataTransfer.files)
    .filter(f => f.type.startsWith('image/'))
    .forEach(ajouterPhoto);
});

function ajouterPhoto(fichier) {
  const index = photosSelectionnees.length;
  photosSelectionnees.push(fichier);

  const url = URL.createObjectURL(fichier);
  const div = document.createElement('div');
  div.className = 'apercu-photo';
  div.dataset.index = index;
  div.innerHTML = `
    <img src="${url}" alt="${echapper(fichier.name)}" />
    <button type="button" class="apercu-photo__suppr"
            onclick="supprimerPhoto(${index})"
            aria-label="Supprimer cette photo">✕</button>`;
  apercuPhotos.appendChild(div);
}

function supprimerPhoto(index) {
  photosSelectionnees[index] = null;
  const div = apercuPhotos.querySelector(`[data-index="${index}"]`);
  if (div) div.remove();
}

/* ---------- UPLOAD PHOTOS VERS SUPABASE STORAGE ---------- */

async function uploaderPhotos(idDon) {
  const photos = photosSelectionnees.filter(Boolean);
  if (photos.length === 0) return [];

  const barre = document.getElementById('barre-progression');
  const remplissage = document.getElementById('barre-remplissage');
  barre.style.display = 'block';

  const urls = [];
  for (let i = 0; i < photos.length; i++) {
    const fichier = photos[i];
    const ext = fichier.name.split('.').pop().toLowerCase();
    const nomFichier = `${Date.now()}-${i}.${ext}`;
    const chemin = `${idDon}/${nomFichier}`;

    const { data, error } = await clientSupabase.storage
      .from('dons-materiel')
      .upload(chemin, fichier, { contentType: fichier.type });

    if (!error && data) {
      const { data: urlData } = clientSupabase.storage
        .from('dons-materiel')
        .getPublicUrl(chemin);
      urls.push(urlData.publicUrl);
    }

    remplissage.style.width = `${Math.round(((i + 1) / photos.length) * 100)}%`;
  }

  barre.style.display = 'none';
  remplissage.style.width = '0%';
  return urls;
}

/* ---------- SOUMISSION DU FORMULAIRE ---------- */

document.getElementById('formulaire-don').addEventListener('submit', async (e) => {
  e.preventDefault();
  masquerMessages();

  const btn = document.getElementById('btn-enregistrer');
  btn.disabled = true;
  btn.textContent = 'Enregistrement…';

  try {
    /* Bénéficiaire */
    const estMembre = document.getElementById('radio-membre').checked;
    const typeBenef = estMembre ? 'Membre HSI37' : document.querySelector('input[name="type-benef"]:checked').value;
    const nomBenef  = estMembre
      ? document.getElementById('benef-adherent').options[document.getElementById('benef-adherent').selectedIndex]?.text || ''
      : document.getElementById('benef-nom-libre').value.trim();
    const adherentId = estMembre ? (document.getElementById('benef-adherent').value || null) : null;

    /* Validation bénéficiaire */
    if (!estMembre && !nomBenef) {
      throw new Error('Veuillez saisir le nom du bénéficiaire.');
    }
    if (estMembre && !adherentId) {
      throw new Error('Veuillez sélectionner un adhérent.');
    }

    /* Date */
    const jour   = document.getElementById('date-jour').value;
    const mois   = document.getElementById('date-mois').value;
    const annee  = document.getElementById('date-annee').value;
    if (!jour || !mois || !annee) {
      throw new Error('Veuillez saisir la date d\'expédition complète.');
    }
    const dateExpedition = `${annee}-${mois}-${jour}`;

    /* Matériel */
    const materiel = lireMateriel();
    if (materiel.length === 0) {
      throw new Error('Veuillez ajouter au moins une ligne de matériel.');
    }

    /* Statut */
    const statut = document.getElementById('statut-don').value;
    if (!statut) {
      throw new Error('Veuillez sélectionner un statut.');
    }

    /* Champs optionnels */
    const ville  = document.getElementById('ville-destination').value.trim() || null;
    const pays   = document.getElementById('pays-destination').value.trim() || null;
    const suivi  = document.getElementById('numero-suivi').value.trim() || null;
    const notes  = document.getElementById('notes-don').value.trim() || null;

    /* INSERT dans dons_materiel */
    const { data: don, error: errInsert } = await clientSupabase
      .from('dons_materiel')
      .insert({
        date_expedition:   dateExpedition,
        beneficiaire_type: typeBenef,
        beneficiaire_nom:  nomBenef || null,
        adherent_id:       adherentId ? parseInt(adherentId, 10) : null,
        ville_destination: ville,
        pays_destination:  pays,
        materiel:          materiel,
        numero_suivi:      suivi,
        notes:             notes,
        statut:            statut,
        photos_urls:       [],
      })
      .select()
      .single();

    if (errInsert) throw new Error('Erreur lors de l\'enregistrement : ' + errInsert.message);

    /* Upload des photos */
    const urlsPhotos = await uploaderPhotos(don.id);

    /* UPDATE photos_urls si des photos ont été uploadées */
    if (urlsPhotos.length > 0) {
      await clientSupabase
        .from('dons_materiel')
        .update({ photos_urls: urlsPhotos })
        .eq('id', don.id);
    }

    /* Redirection avec message de succès */
    sessionStorage.setItem('don-succes', 'Le don a été enregistré avec succès.');
    window.location.href = 'dons-materiel.html';

  } catch (err) {
    afficherErreur(err.message);
    btn.disabled = false;
    btn.innerHTML = `
      <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 24 24" width="16" height="16">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5"
              fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Enregistrer le don`;
  }
});

/* ---------- MESSAGES ---------- */

function afficherErreur(msg) {
  const el = document.getElementById('message-erreur');
  el.textContent = msg;
  el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function masquerMessages() {
  document.getElementById('message-succes').hidden = true;
  document.getElementById('message-erreur').hidden = true;
}

/* ---------- UTILITAIRES ---------- */

function echapper(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------- INITIALISATION ---------- */

async function initialiser() {
  remplirSelecteursDate();
  ajouterLigneMateriel();
  await chargerAdherents();
}

/* ---------- LIRE LE MESSAGE DE SUCCÈS AU RETOUR ---------- */
// (géré par dons-materiel.js via sessionStorage)

/* ---------- INIT ---------- */

(async () => {
  const ok = await verifierSession();
  if (ok) initialiser();
})();
