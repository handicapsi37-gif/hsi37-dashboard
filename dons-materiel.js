/* =====================================================
   DONS-MATERIEL.JS — HSI37 Dashboard
   Gestion de la page dons-materiel.html
   ===================================================== */

const clientSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let tousLesDons = [];
let donCourant = null;

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

/* ---------- CONNEXION ---------- */

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
  chargerDons();
});

/* ---------- DÉCONNEXION ---------- */

document.getElementById('btn-deconnexion').addEventListener('click', async () => {
  await clientSupabase.auth.signOut();
  window.location.href = 'index.html';
});

/* ---------- CHARGEMENT DES DONS ---------- */

async function chargerDons() {
  const { data, error } = await clientSupabase
    .from('dons_materiel')
    .select('*')
    .order('date_expedition', { ascending: false });

  if (error) {
    afficherErreur('Impossible de charger les dons : ' + error.message);
    return;
  }

  tousLesDons = data || [];
  afficherDons(tousLesDons);
}

function afficherDons(dons) {
  const corps = document.getElementById('corps-tableau-dons');

  if (dons.length === 0) {
    corps.innerHTML = '<tr><td colspan="6" class="chargement">Aucun don enregistré.</td></tr>';
    return;
  }

  corps.innerHTML = dons.map(don => {
    const date       = don.date_expedition ? formaterDate(don.date_expedition) : '—';
    const beneficiaire = don.beneficiaire_nom || don.beneficiaire_type || '—';
    const destination  = [don.ville_destination, don.pays_destination].filter(Boolean).join(', ') || '—';
    const materielResume = resumeMateriel(don.materiel);
    const badgeStatut   = creerBadgeStatut(don.statut);

    return `<tr>
      <td>${date}</td>
      <td>${echapper(beneficiaire)}</td>
      <td>${echapper(destination)}</td>
      <td>${echapper(materielResume)}</td>
      <td>${badgeStatut}</td>
      <td>
        <div class="actions-cellule">
          <button class="btn btn--secondaire btn--petit"
                  onclick="ouvrirDetail('${don.id}')"
                  aria-label="Voir le détail de ce don">
            Voir
          </button>
          <button class="btn btn--primaire btn--petit"
                  onclick="genererAttestation('${don.id}')"
                  aria-label="Télécharger l'attestation PDF">
            Attestation PDF
          </button>
          <button class="btn-icone btn-icone--modifier"
                  onclick="window.location.href='nouveau-don.html?id=${don.id}'"
                  title="Modifier" aria-label="Modifier ce don" type="button">
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
                  onclick="demanderSuppression('${don.id}')"
                  title="Supprimer" aria-label="Supprimer ce don" type="button">
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
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ---------- RECHERCHE ET FILTRE ---------- */

function filtrerDons() {
  const recherche = document.getElementById('recherche-dons').value.toLowerCase();
  const statut    = document.getElementById('filtre-statut').value;

  const filtres = tousLesDons.filter(don => {
    const texte = [
      don.beneficiaire_nom,
      don.beneficiaire_type,
      don.ville_destination,
      don.pays_destination,
    ].filter(Boolean).join(' ').toLowerCase();

    const matchRecherche = !recherche || texte.includes(recherche);
    const matchStatut    = !statut || don.statut === statut;

    return matchRecherche && matchStatut;
  });

  afficherDons(filtres);
}

document.getElementById('recherche-dons').addEventListener('input', filtrerDons);
document.getElementById('filtre-statut').addEventListener('change', filtrerDons);

/* ---------- MODALE DÉTAIL ---------- */

function ouvrirDetail(id) {
  donCourant = tousLesDons.find(d => d.id === id);
  if (!donCourant) return;

  document.getElementById('detail-date').textContent =
    donCourant.date_expedition ? formaterDate(donCourant.date_expedition) : '—';

  document.getElementById('detail-statut').innerHTML =
    creerBadgeStatut(donCourant.statut);

  document.getElementById('detail-type-benef').textContent =
    donCourant.beneficiaire_type || '—';

  document.getElementById('detail-nom-benef').textContent =
    donCourant.beneficiaire_nom || '—';

  document.getElementById('detail-ville').textContent =
    donCourant.ville_destination || '—';

  document.getElementById('detail-pays').textContent =
    donCourant.pays_destination || '—';

  document.getElementById('detail-suivi').textContent =
    donCourant.numero_suivi || '—';

  document.getElementById('detail-notes').textContent =
    donCourant.notes || '—';

  const listeMateriel = document.getElementById('detail-materiel');
  const materiel = donCourant.materiel;
  if (materiel && Array.isArray(materiel) && materiel.length > 0) {
    listeMateriel.innerHTML = materiel.map(item => {
      if (typeof item === 'object' && item !== null) {
        const qte  = item.quantite ? `${item.quantite}× ` : '';
        const nom  = item.nom || item.description || JSON.stringify(item);
        return `<li>${echapper(qte + nom)}</li>`;
      }
      return `<li>${echapper(String(item))}</li>`;
    }).join('');
  } else if (materiel && typeof materiel === 'object') {
    listeMateriel.innerHTML = `<li>${echapper(JSON.stringify(materiel))}</li>`;
  } else {
    listeMateriel.innerHTML = '<li>—</li>';
  }

  const photosBloc = document.getElementById('detail-photos-bloc');
  const photosGrille = document.getElementById('detail-photos');
  const photos = donCourant.photos_urls;
  if (photos && Array.isArray(photos) && photos.length > 0) {
    photosGrille.innerHTML = photos.map(url =>
      `<a href="${url}" target="_blank" rel="noopener">
         <img src="${url}" alt="Photo du don" loading="lazy" />
       </a>`
    ).join('');
    photosBloc.hidden = false;
  } else {
    photosBloc.hidden = true;
  }

  document.getElementById('modale-fond-detail').removeAttribute('hidden');
  document.getElementById('modale-detail').focus();
}

function fermerDetail() {
  document.getElementById('modale-fond-detail').hidden = true;
  donCourant = null;
}

document.getElementById('btn-fermer-detail').addEventListener('click', fermerDetail);
document.getElementById('btn-fermer-detail-bas').addEventListener('click', fermerDetail);
document.getElementById('modale-fond-detail').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) fermerDetail();
});

document.getElementById('btn-attestation-pdf').addEventListener('click', () => {
  if (donCourant) genererAttestation(donCourant.id);
});

/* ---------- GÉNÉRATION ATTESTATION PDF ---------- */

async function genererAttestation(id) {
  const don = tousLesDons.find(d => d.id === id);
  if (!don) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const BLEU    = [45, 130, 196];
  const CORAIL  = [242, 140, 40];
  const ENCRE   = [51, 51, 51];
  const GRIS    = [102, 102, 102];
  const BLANC   = [255, 255, 255];
  const BLEU_CL = [235, 244, 251];

  async function chargerBase64(src) {
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
    } catch {
      return null;
    }
  }

  const dateAujourdhui = new Date().toLocaleDateString('fr-FR');
  const dateExp      = don.date_expedition ? formaterDate(don.date_expedition) : '___________';
  const beneficiaire = don.beneficiaire_nom || don.beneficiaire_type || '___________';

  /* ============================================================
     PAGE 1 — ATTESTATION
  ============================================================ */

  /* --- En-tête --- */
  doc.setFillColor(...BLEU);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFillColor(...CORAIL);
  doc.rect(0, 32, 210, 2, 'F');

  const logoData = await chargerBase64('assets/cropped-HSI37-512x512-1.png');
  if (logoData) doc.addImage(logoData, 'PNG', 8, 4, 24, 24);

  doc.setTextColor(...BLANC);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text("HSI37 — Handicap Solidarité pour l'Inclusion 37", 36, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps', 36, 21);
  doc.text('handicapsi37@gmail.com  |  hsi37.fr', 36, 27);

  /* --- Titre --- */
  let y = 46;
  doc.setTextColor(...BLEU);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ATTESTATION DE DON DE MATÉRIEL', 105, y, { align: 'center' });
  y += 3;
  doc.setDrawColor(...CORAIL);
  doc.setLineWidth(0.8);
  doc.line(30, y, 180, y);
  y += 10;

  /* --- Corps officiel --- */
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...ENCRE);
  const texteCorps = "Je soussigné Mohammed Belhaj, président de l'association HSI37, atteste la donation de matériel médicale mentionnée ci-dessous remis au transporteur le " + dateExp + ".";
  const lignesCorps = doc.splitTextToSize(texteCorps, 178);
  doc.text(lignesCorps, 16, y);
  y += lignesCorps.length * 5.8 + 8;

  /* --- Tableau matériel --- */
  const COL = { x: 15, desi: 15, qteExp: 115, qteRec: 162, fin: 195 };
  const ROW_H = 7;

  doc.setFillColor(...BLEU);
  doc.rect(COL.x, y, COL.fin - COL.x, ROW_H, 'F');
  doc.setTextColor(...BLANC);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Désignation', COL.desi + 3, y + 5);
  doc.text('Qté expédiée', (COL.qteExp + COL.qteRec) / 2, y + 5, { align: 'center' });
  doc.text('Qté reçue',   (COL.qteRec  + COL.fin)    / 2, y + 5, { align: 'center' });
  const tableDebut = y;
  y += ROW_H;

  const materiel = don.materiel;
  if (Array.isArray(materiel) && materiel.length > 0) {
    materiel.forEach((item, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(...BLEU_CL);
        doc.rect(COL.x, y, COL.fin - COL.x, ROW_H, 'F');
      }
      doc.setTextColor(...ENCRE);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const nom    = typeof item === 'object' ? (item.nom || item.description || '—') : String(item);
      const qteExp = typeof item === 'object' && item.quantite_expediee != null ? String(item.quantite_expediee) : (item.quantite != null ? String(item.quantite) : '—');
      const qteRec = typeof item === 'object' && item.quantite_recue    != null ? String(item.quantite_recue)    : '—';
      const nomCourt = doc.splitTextToSize(nom, COL.qteExp - COL.desi - 6)[0] || nom;
      doc.text(nomCourt, COL.desi + 3, y + 5);
      doc.text(qteExp,   (COL.qteExp + COL.qteRec) / 2, y + 5, { align: 'center' });
      doc.text(qteRec,   (COL.qteRec  + COL.fin)    / 2, y + 5, { align: 'center' });
      y += ROW_H;
    });
  } else {
    doc.setFillColor(...BLEU_CL);
    doc.rect(COL.x, y, COL.fin - COL.x, ROW_H, 'F');
    doc.setTextColor(...GRIS);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('Aucun article renseigné', 105, y + 5, { align: 'center' });
    y += ROW_H;
  }

  doc.setDrawColor(...BLEU);
  doc.setLineWidth(0.3);
  doc.rect(COL.x, tableDebut, COL.fin - COL.x, y - tableDebut);
  doc.line(COL.qteExp, tableDebut, COL.qteExp, y);
  doc.line(COL.qteRec, tableDebut, COL.qteRec, y);
  y += 7;

  /* --- Numéro de suivi --- */
  if (don.numero_suivi) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    doc.text('N° DE SUIVI TRANSPORTEUR', 16, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...ENCRE);
    doc.setFontSize(10);
    doc.text(String(don.numero_suivi), 81, y);
    y += 9;
  }

  y += 2;

  /* --- Mention gracieux --- */
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...ENCRE);
  const mentionTexte  = 'Matériel donné à titre gracieux par HSI37 au bénéfice de ' + beneficiaire + '.';
  const mentionLignes = doc.splitTextToSize(mentionTexte, 178);
  doc.text(mentionLignes, 16, y);
  y += mentionLignes.length * 5.8 + 12;

  /* --- Lieu et date --- */
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...ENCRE);
  doc.text('Fait le ' + dateAujourdhui + ' à Tours', 16, y);
  y += 18;

  /* --- Bloc signature --- */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BLEU);
  doc.text('Le Président,', 16, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...ENCRE);
  doc.text('Mohammed Belhaj', 16, y);

  /* --- Pied de page P1 --- */
  doc.setFillColor(...BLEU);
  doc.rect(0, 278, 210, 19, 'F');
  doc.setDrawColor(...CORAIL);
  doc.setLineWidth(0.6);
  doc.line(0, 278, 210, 278);
  doc.setTextColor(...BLANC);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('HSI37 — 17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps  |  handicapsi37@gmail.com  |  hsi37.fr', 105, 285, { align: 'center' });
  doc.text('Document généré le ' + dateAujourdhui + ' par le Dashboard HSI37', 105, 291, { align: 'center' });

  /* ============================================================
     PAGE 2 — ANNEXE PHOTOS
  ============================================================ */
  const photos = don.photos_urls;
  if (photos && Array.isArray(photos) && photos.length > 0) {

    const MARQUEUR = '/object/public/dons-materiel/';
    const chemins  = photos.map(url => {
      const idx = url.indexOf(MARQUEUR);
      return idx !== -1 ? url.slice(idx + MARQUEUR.length) : null;
    }).filter(Boolean);

    let urlsSignees = photos;
    if (chemins.length === photos.length) {
      const { data: signedData } = await clientSupabase.storage
        .from('dons-materiel')
        .createSignedUrls(chemins, 300);
      if (signedData) urlsSignees = signedData.map(item => item.signedUrl);
    }

    function enteteAnnexe(titre) {
      doc.setFillColor(...BLEU);
      doc.rect(0, 0, 210, 22, 'F');
      doc.setFillColor(...CORAIL);
      doc.rect(0, 22, 210, 2, 'F');
      doc.setTextColor(...BLANC);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(titre, 105, 14, { align: 'center' });
    }

    function piedAnnexe() {
      doc.setFillColor(...BLEU);
      doc.rect(0, 278, 210, 19, 'F');
      doc.setDrawColor(...CORAIL);
      doc.setLineWidth(0.6);
      doc.line(0, 278, 210, 278);
      doc.setTextColor(...BLANC);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('HSI37 — 17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps  |  handicapsi37@gmail.com  |  hsi37.fr', 105, 285, { align: 'center' });
      doc.text('Document généré le ' + dateAujourdhui + ' par le Dashboard HSI37', 105, 291, { align: 'center' });
    }

    const IMG_W  = 85;
    const IMG_H  = 60;
    const GAP_X  = 15;
    const GAP_Y  = 10;
    const START_X = 15;
    const START_Y = 30;

    doc.addPage();
    enteteAnnexe('ANNEXE PHOTOS');

    for (let i = 0; i < photos.length; i++) {
      if (i > 0 && i % 6 === 0) {
        piedAnnexe();
        doc.addPage();
        enteteAnnexe('ANNEXE PHOTOS (suite)');
      }
      const posPage = i % 6;
      const col = posPage % 2;
      const row = Math.floor(posPage / 2);
      const px  = START_X + col * (IMG_W + GAP_X);
      const py  = START_Y + row * (IMG_H + GAP_Y + 6);

      const photoData = await chargerBase64(urlsSignees[i]);
      if (photoData) {
        doc.addImage(photoData, 'PNG', px, py, IMG_W, IMG_H);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...GRIS);
        doc.text('Photo ' + (i + 1), px + IMG_W / 2, py + IMG_H + 4, { align: 'center' });
      }
    }

    piedAnnexe();
  }

  /* --- Sauvegarde --- */
  const nomFichier = 'attestation-don-' + (don.date_expedition || 'date') + '-' + (don.beneficiaire_nom || 'beneficiaire').replace(/\s+/g, '-') + '.pdf';
  doc.save(nomFichier);
}

/* ---------- SUPPRESSION ---------- */

let donASupprimer = null;

function demanderSuppression(id) {
  donASupprimer = tousLesDons.find(d => d.id === id);
  if (!donASupprimer) return;

  document.getElementById('modale-fond-confirmation').removeAttribute('hidden');
  document.getElementById('modale-confirmation').focus();

  document.getElementById('btn-fermer-confirmation').onclick = fermerConfirmation;
  document.getElementById('btn-annuler-suppression').onclick = fermerConfirmation;
  document.getElementById('btn-confirmer-suppression-don').onclick = supprimerDon;
  document.getElementById('modale-fond-confirmation').onclick =
    e => { if (e.target === e.currentTarget) fermerConfirmation(); };
}

function fermerConfirmation() {
  document.getElementById('modale-fond-confirmation').hidden = true;
  donASupprimer = null;
}

async function supprimerDon() {
  if (!donASupprimer) return;

  const id     = donASupprimer.id;
  const photos = donASupprimer.photos_urls;

  fermerConfirmation();

  if (photos && Array.isArray(photos) && photos.length > 0) {
    const chemins = photos.map(url => {
      const marqueur = '/dons-materiel/';
      const idx = url.indexOf(marqueur);
      return idx !== -1 ? url.slice(idx + marqueur.length) : null;
    }).filter(Boolean);

    if (chemins.length > 0) {
      await clientSupabase.storage.from('dons-materiel').remove(chemins);
    }
  }

  const { error } = await clientSupabase
    .from('dons_materiel')
    .delete()
    .eq('id', id);

  if (error) {
    afficherErreur('Impossible de supprimer le don : ' + error.message);
    return;
  }

  tousLesDons = tousLesDons.filter(d => d.id !== id);
  afficherDons(tousLesDons);

  const el = document.getElementById('message-succes');
  el.textContent = 'Don supprimé avec succès.';
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 4000);
}

/* ---------- UTILITAIRES ---------- */

function formaterDate(dateStr) {
  if (!dateStr) return '—';
  const [annee, mois, jour] = dateStr.split('-');
  return `${jour}/${mois}/${annee}`;
}

function resumeMateriel(materiel) {
  if (!materiel) return '—';
  if (Array.isArray(materiel)) {
    if (materiel.length === 0) return '—';
    const premier = materiel[0];
    const nom = typeof premier === 'object'
      ? (premier.nom || premier.description || 'article')
      : String(premier);
    return materiel.length === 1 ? nom : `${nom} + ${materiel.length - 1} autre(s)`;
  }
  if (typeof materiel === 'object') {
    return Object.values(materiel)[0] || '—';
  }
  return String(materiel);
}

function creerBadgeStatut(statut) {
  const classes = {
    'Préparé': 'badge-statut--prepare',
    'Expédié': 'badge-statut--expedie',
    'Livré':   'badge-statut--livre',
    'Annulé':  'badge-statut--annule',
  };
  const cls = classes[statut] || 'badge-statut--autre';
  return `<span class="badge-statut ${cls}">${echapper(statut || '—')}</span>`;
}

function echapper(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function afficherErreur(msg) {
  const el = document.getElementById('message-erreur');
  el.textContent = msg;
  el.hidden = false;
}

/* ---------- MESSAGE DE SUCCÈS APRÈS CRÉATION ---------- */

function lireMessageSucces() {
  const msg = sessionStorage.getItem('don-succes');
  if (msg) {
    const el = document.getElementById('message-succes');
    el.textContent = msg;
    el.hidden = false;
    sessionStorage.removeItem('don-succes');
    setTimeout(() => { el.hidden = true; }, 5000);
  }
}

/* ---------- INIT ---------- */

(async () => {
  const ok = await verifierSession();
  if (ok) {
    chargerDons();
    lireMessageSucces();
  }
})();
