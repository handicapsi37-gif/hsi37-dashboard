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

function genererAttestation(id) {
  const don = tousLesDons.find(d => d.id === id);
  if (!don) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const bleuHSI  = [45, 130, 196];
  const corail   = [242, 140, 40];
  const encre    = [51, 51, 51];
  const grisMoyen = [102, 102, 102];

  /* En-tête colorée */
  doc.setFillColor(...bleuHSI);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setFillColor(...corail);
  doc.rect(0, 28, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('HSI37 — Handicap Solidarité pour l\'Inclusion 37', 15, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps  |  handicapsi37@gmail.com  |  hsi37.fr', 15, 22);

  /* Titre */
  doc.setTextColor(...bleuHSI);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('ATTESTATION DE DON DE MATÉRIEL', 105, 44, { align: 'center' });

  doc.setDrawColor(...corail);
  doc.setLineWidth(0.8);
  doc.line(30, 47, 180, 47);

  /* Corps */
  let y = 58;

  function ligne(label, valeur) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grisMoyen);
    doc.text(label.toUpperCase(), 15, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...encre);
    doc.setFontSize(10);
    const lignes = doc.splitTextToSize(valeur || '—', 100);
    doc.text(lignes, 75, y);
    y += Math.max(7, lignes.length * 5.5);
  }

  ligne('Date d\'expédition', don.date_expedition ? formaterDate(don.date_expedition) : '—');
  ligne('Bénéficiaire', don.beneficiaire_nom || don.beneficiaire_type || '—');
  ligne('Ville de destination', don.ville_destination || '—');
  ligne('Pays de destination', don.pays_destination || '—');
  ligne('Numéro de suivi', don.numero_suivi || '—');
  ligne('Statut', don.statut || '—');

  y += 3;
  doc.setDrawColor(...bleuHSI);
  doc.setLineWidth(0.3);
  doc.line(15, y, 195, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...bleuHSI);
  doc.text('MATÉRIEL EXPÉDIÉ', 15, y);
  y += 6;

  const materiel = don.materiel;
  if (Array.isArray(materiel)) {
    materiel.forEach(item => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...encre);
      doc.setFontSize(10);
      let texte;
      if (typeof item === 'object' && item !== null) {
        const qte = item.quantite ? `${item.quantite}×  ` : '';
        texte = qte + (item.nom || item.description || JSON.stringify(item));
      } else {
        texte = String(item);
      }
      doc.text(`• ${texte}`, 20, y);
      y += 6;
    });
  }

  if (don.notes) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...bleuHSI);
    doc.setFontSize(10);
    doc.text('NOTES', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...encre);
    const notesLignes = doc.splitTextToSize(don.notes, 175);
    doc.text(notesLignes, 15, y);
    y += notesLignes.length * 5.5 + 4;
  }

  /* Pied de page */
  doc.setDrawColor(...corail);
  doc.setLineWidth(0.5);
  doc.line(15, 277, 195, 277);
  doc.setFontSize(8);
  doc.setTextColor(...grisMoyen);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Document généré le ${new Date().toLocaleDateString('fr-FR')} par le Dashboard HSI37`,
    105, 283, { align: 'center' }
  );

  const nomFichier = `attestation-don-${don.date_expedition || 'date'}-${(don.beneficiaire_nom || 'beneficiaire').replace(/\s+/g, '-')}.pdf`;
  doc.save(nomFichier);
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
