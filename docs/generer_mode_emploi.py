#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère docs/mode-emploi-HSI37.pdf via reportlab."""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY

OUTPUT = "mode-emploi-HSI37.pdf"

JAUNE  = colors.HexColor("#F7CD46")
BLEU   = colors.HexColor("#1A3557")
GRIS   = colors.HexColor("#F5F5F5")
TEXTE  = colors.HexColor("#1A1A1A")

W, H = A4

# ── Styles ──────────────────────────────────────────────────────────────────

base = getSampleStyleSheet()

def style(name, parent="Normal", **kw):
    return ParagraphStyle(name, parent=base[parent], **kw)

S = {
    "titre_page":  style("titre_page",  fontSize=32, textColor=BLEU,
                         fontName="Helvetica-Bold", spaceAfter=10, alignment=TA_CENTER),
    "sous_titre":  style("sous_titre",  fontSize=16, textColor=BLEU,
                         fontName="Helvetica", spaceAfter=6, alignment=TA_CENTER),
    "annee":       style("annee",       fontSize=14, textColor=colors.HexColor("#666666"),
                         fontName="Helvetica", alignment=TA_CENTER),
    "h1":          style("h1",          fontSize=13, textColor=BLEU,
                         fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6,
                         borderPad=4),
    "h2":          style("h2",          fontSize=11, textColor=BLEU,
                         fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4),
    "body":        style("body",        fontSize=10, textColor=TEXTE,
                         fontName="Helvetica", leading=15, spaceAfter=4,
                         alignment=TA_JUSTIFY),
    "fleche":      style("fleche",      fontSize=10, textColor=TEXTE,
                         fontName="Helvetica", leading=15, spaceAfter=3,
                         leftIndent=12),
    "note":        style("note",        fontSize=9,  textColor=colors.HexColor("#555555"),
                         fontName="Helvetica-Oblique", leading=13,
                         borderPad=6, leftIndent=10, rightIndent=10,
                         spaceBefore=4, spaceAfter=6),
    "alerte":      style("alerte",      fontSize=9,  textColor=BLEU,
                         fontName="Helvetica-Bold", leading=13,
                         leftIndent=10, spaceBefore=4, spaceAfter=6),
    "code":        style("code",        fontSize=9,  textColor=colors.HexColor("#333333"),
                         fontName="Courier", leading=13, leftIndent=14,
                         spaceBefore=2, spaceAfter=2),
}

def H(txt): return Paragraph(txt, S["h1"])
def H2(txt): return Paragraph(txt, S["h2"])
def B(txt):  return Paragraph(txt, S["body"])
def F(txt):  return Paragraph(f"→  {txt}", S["fleche"])
def N(txt):  return Paragraph(txt, S["note"])
def A(txt):  return Paragraph(txt, S["alerte"])
def SP(n=6): return Spacer(1, n)
def HR():    return HRFlowable(width="100%", thickness=1, color=JAUNE, spaceAfter=8, spaceBefore=4)

# ── En-tête / pied de page ──────────────────────────────────────────────────

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    pg = doc.page

    if pg == 1:
        # Bandeau titre page 1
        canvas.setFillColor(BLEU)
        canvas.rect(0, h - 3*cm, w, 3*cm, fill=1, stroke=0)
        canvas.setFillColor(JAUNE)
        canvas.rect(0, h - 3*cm - 0.4*cm, w, 0.4*cm, fill=1, stroke=0)
        canvas.setFont("Helvetica-Bold", 11)
        canvas.setFillColor(colors.white)
        canvas.drawCentredString(w/2, h - 1.5*cm, "HSI37 — Handicap Solidarité pour l'Inclusion 37")
    else:
        # Bande bleue fine en haut
        canvas.setFillColor(BLEU)
        canvas.rect(0, h - 1.5*cm, w, 1.5*cm, fill=1, stroke=0)
        canvas.setFillColor(JAUNE)
        canvas.rect(0, h - 1.5*cm - 0.25*cm, w, 0.25*cm, fill=1, stroke=0)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.white)
        canvas.drawString(1.5*cm, h - 1*cm, "Mode d'emploi — Dashboard HSI37")
        canvas.drawRightString(w - 1.5*cm, h - 1*cm,
            f"Page {pg}    HSI37 — Handicap Solidarité pour l'Inclusion 37")

    # Pied de page
    canvas.setFillColor(BLEU)
    canvas.rect(0, 0, w, 0.8*cm, fill=1, stroke=0)
    canvas.setFillColor(JAUNE)
    canvas.rect(0, 0.8*cm, w, 0.15*cm, fill=1, stroke=0)
    if pg > 1:
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.white)
        canvas.drawCentredString(w/2, 0.3*cm, "HSI37 — Handicap Solidarité pour l'Inclusion 37")

    canvas.restoreState()

# ── Construction du document ─────────────────────────────────────────────────

def build():
    from reportlab.platypus import SimpleDocTemplate

    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=2.2*cm, bottomMargin=1.8*cm,
        title="Mode d'emploi — Dashboard HSI37",
        author="HSI37",
    )

    story = []

    # ── PAGE 1 : Titre ──────────────────────────────────────────────────────
    story += [
        SP(80),
        Paragraph("Mode d'emploi", S["titre_page"]),
        SP(10),
        Paragraph("Dashboard de gestion — HSI37", S["sous_titre"]),
        SP(6),
        Paragraph("Handicap Solidarité pour l'Inclusion 37", S["sous_titre"]),
        SP(6),
        Paragraph("Année 2026", S["annee"]),
        PageBreak(),
    ]

    # ── 1. Se connecter ─────────────────────────────────────────────────────
    story += [
        H("1. Se connecter au Dashboard"),
        B("Pour accéder au Dashboard HSI37, suivez ces étapes dans l'ordre :"),
        F("Ouvrez votre navigateur internet (Safari sur Mac, ou Chrome)."),
        F("Dans la barre d'adresse en haut, tapez l'adresse du Dashboard : "
          "<b>https://hsi37-dashboard.pages.dev</b>"),
        F("Appuyez sur la touche Entrée. La page de connexion s'affiche."),
        F("Saisissez votre adresse e-mail dans le premier champ."),
        F("Saisissez votre mot de passe dans le second champ."),
        F("Cliquez sur le bouton « Se connecter »."),
        SP(4),
        H2("1.1 Mot de passe oublié"),
        B("Si vous avez oublié votre mot de passe, vous pouvez le réinitialiser directement "
          "depuis la page de connexion :"),
        F("Sur la page de connexion, cliquez sur le lien « Mot de passe oublié ? »."),
        F("Saisissez votre adresse e-mail dans le champ qui s'affiche."),
        F("Cliquez sur « Envoyer le lien »."),
        F("Ouvrez votre boîte mail. Vous recevrez un e-mail de réinitialisation sous quelques minutes."),
        F("Cliquez sur le lien dans l'e-mail. Une page s'ouvre pour saisir votre nouveau mot de passe."),
        F("Saisissez votre nouveau mot de passe (8 caractères minimum) et confirmez-le."),
        F("Cliquez sur « Enregistrer ». Vous pouvez maintenant vous connecter avec ce nouveau mot de passe."),
        N("■ Vérifiez vos spams si l'e-mail n'arrive pas dans les 5 minutes. En cas de problème, "
          "contactez Ilhame : handicapsi37@gmail.com."),
    ]

    # ── 2. Page d'accueil ───────────────────────────────────────────────────
    story += [
        H("2. La page d'accueil"),
        B("Après votre connexion, vous arrivez sur la page d'accueil du Dashboard. "
          "Vous y voyez 4 grandes tuiles (carrés cliquables) :"),
        F("Adhérents — gérer la liste des adhérents, leurs cartes et leurs reçus."),
        F("Donateurs — gérer les donateurs et leurs reçus de don."),
        F("Documents — générer les bulletins, attestations et courriers."),
        F("Signatures email — accéder aux signatures Gmail du bureau."),
        B("Cliquez sur la tuile correspondant à ce que vous souhaitez faire."),
        B("Pour revenir à la page d'accueil depuis n'importe où : cliquez sur le bouton "
          "« Accueil » (icône maison) en haut de l'écran."),
        PageBreak(),
    ]

    # ── 3. Adhérents ────────────────────────────────────────────────────────
    story += [
        H("3. Gérer les adhérents"),
        H2("3.1 Voir la liste"),
        B("Cliquez sur la tuile « Adhérents » depuis la page d'accueil. Le tableau de tous les "
          "adhérents s'affiche avec leurs informations."),
        B("Pour rechercher un adhérent, tapez son nom, prénom ou e-mail dans la barre de "
          "recherche au-dessus du tableau."),
        B("Pour trier la liste, utilisez le menu déroulant « Trier par... » : vous pouvez trier "
          "par nom, date d'adhésion, statut ou type de membre."),
        H2("3.2 Ajouter un nouvel adhérent"),
        B("Cliquez sur le bouton « + Ajouter un adhérent » (en haut à droite). Un formulaire s'ouvre. "
          "Remplissez les champs :"),
        F("Civilité : Madame ou Monsieur (facultatif)."),
        F("Nom et Prénom : nom de famille et prénom."),
        F("E-mail : adresse e-mail de l'adhérent (facultatif)."),
        F("Téléphone : numéro de téléphone (facultatif)."),
        F("Adresse : adresse postale complète."),
        F("Date d'adhésion : choisissez le jour, le mois et l'année dans les trois menus déroulants."),
        F("Montant : cotisation en euros (ex : 20)."),
        F("Type de membre : Membre actif, Membre bienfaiteur, etc."),
        F("Mode de paiement : Espèces, Virement, Chèque, etc."),
        B("Quand tout est rempli, cliquez sur « Enregistrer ». L'adhérent apparaît aussitôt dans la liste."),
        H2("3.3 Modifier un adhérent"),
        B("Dans le tableau, repérez la ligne de l'adhérent. Cliquez sur l'icône crayon ✏ sur sa ligne. "
          "Le formulaire s'ouvre avec ses informations. Modifiez les champs voulus, puis cliquez sur "
          "« Enregistrer les modifications »."),
        H2("3.4 Supprimer un adhérent"),
        B("Cliquez sur l'icône poubelle de la ligne. Une fenêtre de confirmation s'ouvre — lisez le "
          "message, puis cliquez sur « Supprimer » si vous êtes sûr(e)."),
        A("⚠ Attention : la suppression est définitive. En cas d'erreur, contactez Ilhame immédiatement."),
        H2("3.5 Les badges de statut"),
        B("Chaque adhérent affiche un badge coloré pour l'état de sa cotisation :"),
        F("Vert — À jour : la cotisation de l'année en cours est réglée."),
        F("Rouge — En retard : la cotisation n'a pas été renouvelée."),
        H2("3.6 Filtrer par année"),
        B("Un menu déroulant « Année » au-dessus du tableau permet d'afficher uniquement les "
          "adhérents d'une saison précise (ex : 2025, 2026…). Sélectionnez « Toutes les années » "
          "pour voir l'ensemble de la liste."),
        B("Le filtre par année fonctionne en combinaison avec la recherche par nom et le tri — "
          "vous pouvez les utiliser ensemble."),
    ]

    # ── 3.7 Historique des cotisations (NOUVELLE SECTION) ───────────────────
    story += [
        H2("3.7 Historique des cotisations"),
        B("Chaque ligne du tableau des adhérents affiche un petit bouton indiquant le nombre de "
          "cotisations enregistrées (ex : « 2 cotis. »). Cliquez sur ce bouton pour dérouler "
          "l'historique des cotisations de cet adhérent."),
        B("La ligne dépliable affiche pour chaque année :"),
        F("Année de cotisation"),
        F("Date de paiement"),
        F("Montant (en €)"),
        F("Mode de paiement (espèces, virement, chèque…)"),
        B("Cliquez à nouveau sur le bouton pour refermer l'historique."),
        N("Remarque sur le filtre par année : le filtre « Année » affiche tous les adhérents "
          "ayant cotisé cette année-là — même s'ils ont adhéré une autre année. Par exemple, "
          "un adhérent inscrit en 2024 qui renouvelle sa cotisation en 2026 apparaît dans le "
          "filtre 2026."),
        PageBreak(),
    ]

    # ── 4. Carte d'adhérent ─────────────────────────────────────────────────
    story += [
        H("4. Générer une carte d'adhérent"),
        B("La carte d'adhérent est un document officiel au nom de l'adhérent. Pour la générer :"),
        F("Repérez la ligne de l'adhérent dans le tableau."),
        F("Cliquez sur l'icône carte sur sa ligne."),
        F("La carte s'affiche à l'écran, pré-remplie avec ses informations."),
        F("Cliquez sur « Télécharger la carte » pour la sauvegarder."),
        F("Le fichier se trouve dans votre dossier Téléchargements."),
        F("Vous pouvez ensuite l'imprimer ou l'envoyer par e-mail à l'adhérent."),
        H2("4.1 Envoyer la carte par e-mail"),
        B("Le Dashboard ne peut pas envoyer la carte directement par mail — il faut la télécharger "
          "d'abord, puis l'envoyer manuellement depuis Gmail :"),
        F("Téléchargez la carte (bouton « Télécharger la carte ») — le fichier PNG se sauvegarde "
          "dans votre dossier Téléchargements."),
        F("Sur Mac : ouvrez Gmail dans Safari → Composer → cliquez sur l'icône trombone "
          "(pièce jointe) → sélectionnez le fichier PNG."),
        F("Sur PC : ouvrez Gmail dans Chrome → Composer → cliquez sur l'icône trombone "
          "→ sélectionnez le fichier PNG."),
        F("Ajoutez l'adresse e-mail de l'adhérent dans le champ « À » et cliquez sur Envoyer."),
    ]

    # ── 5. Reçu d'adhésion ──────────────────────────────────────────────────
    story += [
        H("5. Générer un reçu d'adhésion"),
        B("Le reçu officialise le paiement de la cotisation. Voici comment le générer :"),
        F("Dans le tableau des adhérents, repérez la ligne de l'adhérent."),
        F("Cliquez sur l'icône reçu sur sa ligne."),
        F("Une fenêtre s'ouvre. Choisissez le signataire : président, trésorière ou secrétaire."),
        F("Le reçu s'affiche à l'écran, pré-rempli avec toutes les informations."),
        F("Cliquez sur « Télécharger » pour enregistrer le PDF dans votre dossier Téléchargements."),
        F("Ou cliquez sur « ✉ Envoyer par mail » pour envoyer le reçu directement à l'adhérent."),
        N("Remarque : l'adresse mail doit être renseignée dans la fiche de l'adhérent pour que "
          "l'envoi fonctionne."),
        PageBreak(),
    ]

    # ── 6. Donateurs ────────────────────────────────────────────────────────
    story += [
        H("6. Gérer les donateurs"),
        H2("6.1 Accéder à la liste"),
        B("Cliquez sur la tuile « Donateurs » depuis la page d'accueil."),
        B("Pour rechercher un donateur, tapez son nom, prénom ou e-mail dans la barre de "
          "recherche au-dessus du tableau."),
        B("Pour trier la liste, utilisez le menu déroulant « Trier par... » : vous pouvez trier "
          "par nom, date de don ou montant."),
        H2("6.2 Ajouter un donateur (personne)"),
        B("Cliquez sur « + Ajouter un donateur ». Remplissez la civilité, le nom, le prénom, "
          "l'e-mail, le téléphone et l'adresse."),
        H2("6.3 Ajouter un donateur (organisme)"),
        B("Si le donateur est une entreprise ou une association, remplissez uniquement le champ "
          "« Organisme ». Laissez les champs Civilité, Nom et Prénom vides."),
        H2("6.4 Rechercher avant de créer"),
        B("Avant d'ajouter un nouveau donateur, vérifiez toujours s'il existe déjà dans la liste "
          "pour éviter les doublons. Tapez son nom ou e-mail dans la barre de recherche au-dessus "
          "du tableau. Si la fiche existe, utilisez la modification (icône crayon ✏) plutôt que "
          "d'en créer une nouvelle."),
        H2("6.5 Ajouter un don à une fiche existante"),
        B("Si un donateur déjà enregistré refait un don, inutile de créer une nouvelle fiche. "
          "Depuis le tableau, cliquez sur l'icône crayon ✏ de sa ligne. En bas du formulaire, "
          "un bloc « Ajout d'un don » permet de saisir le montant, le mode de paiement et le type "
          "du nouveau don. Cliquez sur « Enregistrer les modifications » — le don s'ajoute à son historique."),
        H2("6.6 Don financier"),
        B("Choisissez « Don financier » comme type de don. Renseignez le montant en euros et le "
          "mode de paiement."),
        H2("6.7 Don de matériel"),
        B("Choisissez « Don de matériel ». Décrivez le matériel dans le champ Description "
          "(ex : 2 fauteuils roulants pliables, 1 déambulateur)."),
        H2("6.8 Modifier ou supprimer"),
        B("Même principe que les adhérents : icône crayon ✏ pour modifier, icône poubelle pour supprimer."),
        H2("6.9 Générer un reçu de don"),
        B("Cliquez sur l'icône reçu sur la ligne du donateur, choisissez un signataire "
          "(président, trésorière ou secrétaire)."),
        F("Cliquez sur « Télécharger » pour enregistrer le PDF dans votre dossier Téléchargements."),
        F("Ou cliquez sur « ✉ Envoyer par mail » pour envoyer le reçu directement au donateur."),
        N("Remarque : l'adresse mail doit être renseignée dans la fiche du donateur pour que "
          "l'envoi fonctionne."),
        H2("6.10 Ajouter un adhérent avec don"),
        B("Un adhérent peut aussi être donateur. Si la personne verse une cotisation ET effectue "
          "un don (financier ou matériel) au moment de son adhésion, les deux saisies se font séparément :"),
        Paragraph("① Ajoutez l'adhérent normalement via l'onglet Adhérents (nom, prénom, cotisation, "
          "date d'adhésion, etc.). Si vous renseignez un montant de don dans le formulaire, une fiche "
          "donateur est créée automatiquement dans l'onglet Donateurs — aucune saisie supplémentaire "
          "n'est nécessaire.", S["body"]),
        Paragraph("② Si le don arrive après l'adhésion, allez dans l'onglet Donateurs et ajoutez "
          "manuellement une fiche donateur pour cette personne.", S["body"]),
        B("Les deux fiches (adhérent et donateur) sont indépendantes : modifier l'une ne modifie pas l'autre."),
        N("Astuce : vous pouvez générer un reçu de don depuis l'onglet Donateurs et un reçu d'adhésion "
          "depuis l'onglet Adhérents — les deux documents peuvent être envoyés à la même personne."),
        H2("6.11 Filtrer par année"),
        B("Un menu déroulant « Année » au-dessus du tableau permet d'afficher uniquement les "
          "donateurs d'une année précise. Sélectionnez « Toutes les années » pour voir l'ensemble "
          "de la liste."),
        PageBreak(),
    ]

    # ── 7. Dons de matériel ─────────────────────────────────────────────────
    story += [
        H("7. Module Dons de matériel"),
        H2("7.1 Référentiel technique"),
        F("Table Supabase : dons_materiel (13 colonnes, RLS activé)."),
        F("Bucket Storage : dons-materiel (privé, sous-dossiers {id_du_don}/)."),
        F("Page historique : dons-materiel.html — liste des dons avec recherche et filtre par statut."),
        F("Page formulaire : nouveau-don.html — saisie d'un don et upload de photos."),
        F("Tuile « Dons de matériel » ajoutée sur index.html (page d'accueil)."),
        H2("7.2 Saisir un nouveau don"),
        B("Depuis la page d'accueil, cliquez sur la tuile « Dons de matériel »."),
        F("Cliquez sur le bouton « + Nouveau don » en haut à droite."),
        F("Remplissez le formulaire : donateur, type de matériel, description, date, statut."),
        F("Cliquez sur « Enregistrer ». Le don apparaît aussitôt dans l'historique."),
        H2("7.3 Uploader des photos"),
        B("Dans le formulaire de saisie d'un don :"),
        F("Faites défiler jusqu'à la section Photos."),
        F("Cliquez sur la zone d'upload ou glissez-déposez vos fichiers."),
        F("Les photos sont stockées dans Supabase Storage (bucket dons-materiel), dans un "
          "sous-dossier propre à chaque don."),
        H2("7.4 Consulter l'historique"),
        F("Cliquez sur la tuile « Dons de matériel » depuis la page d'accueil."),
        F("Le tableau affiche tous les dons enregistrés."),
        F("Utilisez la barre de recherche pour filtrer par nom ou description."),
        F("Utilisez le filtre par statut pour afficher les dons selon leur état."),
        H2("7.5 Attestation PDF"),
        B("Un bouton « Attestation PDF » sera disponible dans la colonne Actions de chaque don "
          "— fonctionnalité à venir."),
        PageBreak(),
    ]

    # ── 8. Événements ───────────────────────────────────────────────────────
    story += [
        H("8. Module Événements"),
        B("Le module Événements permet de gérer les événements organisés par HSI37 (sorties, "
          "ateliers, repas, assemblées générales…) et de suivre les participants."),
        H2("8.1 Créer un événement"),
        B("Depuis la page d'accueil, cliquez sur la tuile « Événements ». Cliquez sur le bouton "
          "« + Nouvel événement ». Remplissez :"),
        F("Nom : intitulé de l'événement (ex : Sortie pique-nique juillet 2026)."),
        F("Date : jour, mois et année de l'événement."),
        F("Lieu : adresse ou nom du lieu."),
        F("Prix unitaire : tarif par participant en euros (laisser vide si gratuit)."),
        B("Cliquez sur « Enregistrer ». L'événement apparaît dans la liste."),
        H2("8.2 Ajouter des participants"),
        B("Cliquez sur l'icône crayon ✏ de l'événement pour l'ouvrir. Dans la section Participants, "
          "cliquez sur « + Ajouter ». Renseignez le nom, le prénom, l'e-mail, le téléphone et le "
          "nombre de places. Le montant total est calculé automatiquement (quantité × prix unitaire). "
          "Cliquez sur « Enregistrer »."),
        H2("8.3 Modifier ou supprimer"),
        B("Pour modifier un événement ou un participant : icône crayon ✏. Pour supprimer : icône "
          "poubelle puis confirmer. La suppression d'un événement supprime aussi tous ses participants."),
        A("⚠ La suppression est définitive. En cas d'erreur, contactez Ilhame immédiatement."),
        H2("8.4 Filtrer par année"),
        B("Un menu déroulant « Année » au-dessus du tableau permet d'afficher uniquement les "
          "événements d'une année précise. Sélectionnez « Toutes les années » pour voir tous "
          "les événements."),
        H2("8.5 Exporter les événements (CSV / PDF)"),
        B("Deux boutons au-dessus du tableau permettent d'exporter la liste complète des événements :"),
        F("« CSV » — exporte un fichier tableur avec tous les événements visibles (nom, date, "
          "lieu, participants, total collecté)."),
        F("« PDF » — génère un rapport PDF de la liste des événements avec en-tête HSI37."),
        H2("8.6 Exporter les participants d'un événement"),
        B("Sur chaque ligne d'événement, un bouton permet d'exporter la liste des participants "
          "de cet événement spécifique :"),
        F("Cliquez sur le bouton à droite de la ligne de l'événement."),
        F("Choisissez CSV ou PDF dans le menu qui apparaît."),
        F("Le fichier se télécharge dans votre dossier Téléchargements."),
        PageBreak(),
    ]

    # ── 9. Exporter ─────────────────────────────────────────────────────────
    story += [
        H("9. Exporter les données"),
        B("Le Dashboard permet d'exporter la liste des adhérents et la liste des donateurs en "
          "fichier CSV (fichier tableur — lisible par Excel ou LibreOffice). Cette fonction est "
          "importante pour deux raisons :"),
        F("Sauvegarde — conserver une copie locale de vos données en cas de problème technique."),
        F("RGPD (Règlement Général sur la Protection des Données — loi européenne sur la vie "
          "privée) — vous devez pouvoir fournir les données d'un adhérent sur demande."),
        H2("9.1 Exporter la liste des adhérents"),
        F("Depuis la page d'accueil, cliquez sur la tuile « Adhérents »."),
        F("Au-dessus du tableau, cliquez sur le bouton « Exporter CSV »."),
        F("Un fichier nommé adherents_HSI37_2026.csv se télécharge automatiquement."),
        F("Ouvrez ce fichier avec Excel ou LibreOffice pour consulter ou archiver les données."),
        B("Ouvrir le fichier dans Google Sheets :"),
        Paragraph("① Allez sur sheets.google.com et connectez-vous avec votre compte Google.", S["body"]),
        Paragraph("② Cliquez sur Fichier → Importer, puis choisissez le fichier CSV téléchargé "
          "depuis votre dossier Téléchargements.", S["body"]),
        Paragraph("③ Choisissez « Remplacer la feuille de calcul » et cliquez sur « Importer les "
          "données ». Le tableau s'affiche immédiatement.", S["body"]),
        H2("9.2 Exporter la liste des donateurs"),
        F("Depuis la page d'accueil, cliquez sur la tuile « Donateurs »."),
        F("Au-dessus du tableau, cliquez sur le bouton « Exporter CSV »."),
        F("Un fichier nommé donateurs_HSI37_2026.csv se télécharge automatiquement."),
        N("Conseil : faites un export chaque mois et sauvegardez les fichiers dans un dossier "
          "Google Drive de l'association."),
        PageBreak(),
    ]

    # ── 10. Documents ───────────────────────────────────────────────────────
    story += [
        H("10. Les documents de l'association"),
        B("Depuis la page d'accueil, cliquez sur la tuile « Documents ». Vous accédez à tous "
          "les documents officiels de l'association."),
        H2("Bulletin d'adhésion"),
        B("Cliquez sur « Générer ». Choisissez la version standard (adhésion uniquement) ou avec "
          "don (adhésion + don libre). Cliquez « Télécharger »."),
        H2("Papier à en-tête"),
        B("Cliquez sur « Télécharger ». Un fichier Word (.docx) se télécharge. Ouvrez-le dans "
          "Pages (Mac) ou Word (PC). Tapez votre texte sous l'en-tête HSI37."),
        H2("Attestation d'adhésion"),
        B("Disponible depuis le tableau des adhérents — icône ✓ sur chaque ligne. Choisissez un "
          "signataire, puis téléchargez."),
        H2("Relance de cotisation"),
        B("Apparaît uniquement pour les adhérents dont le badge est Rouge (en retard). Cliquez sur "
          "l'icône courrier pour télécharger ou envoyer par mail."),
        H2("Convocation AG"),
        B("Cliquez « Générer ». Remplissez la date, l'heure, le lieu et l'ordre du jour de "
          "l'Assemblée Générale. Téléchargez."),
        H2("Procès-verbal AG"),
        B("Cliquez « Générer ». Remplissez les informations de l'assemblée et les décisions prises. "
          "Téléchargez."),
        H2("Courrier libre"),
        B("Cliquez « Nouveau courrier ». Remplissez le destinataire, l'objet et le texte du courrier. "
          "Téléchargez."),
        PageBreak(),
    ]

    # ── 11. Envoyer un document ─────────────────────────────────────────────
    story += [
        H("11. Envoyer un document par mail"),
        B("Certains documents peuvent être envoyés directement par e-mail depuis le Dashboard."),
        F("Cliquez sur le bouton « Envoyer par mail »."),
        F("Votre messagerie Gmail s'ouvre dans un nouvel onglet."),
        F("Le mail est déjà pré-rempli : destinataire, objet et texte."),
        F("Vérifiez le contenu et modifiez si besoin."),
        F("Cliquez sur « Envoyer » dans Gmail."),
    ]

    # ── 12. Invitations ─────────────────────────────────────────────────────
    story += [
        H("12. Envoyer des invitations par e-mail"),
        B("Le Dashboard permet d'envoyer un e-mail groupé à une sélection d'adhérents, de "
          "donateurs et/ou de participants à un événement. L'envoi se fait directement depuis "
          "le Dashboard — pas besoin d'ouvrir Gmail."),
        H2("12.1 Sélectionner les destinataires"),
        B("Dans chaque tableau (Adhérents, Donateurs, Événements → participants), une case à "
          "cocher apparaît en début de chaque ligne :"),
        F("Cochez la case d'une ligne pour sélectionner cette personne."),
        F("Cochez la case dans l'en-tête du tableau pour tout sélectionner / tout désélectionner."),
        F("Le bouton « ✉ Envoyer aux sélectionnés (N) » apparaît en haut dès qu'une personne est "
          "cochée — il affiche le nombre total de destinataires sélectionnés."),
        F("Vous pouvez combiner des sélections depuis plusieurs tableaux (ex : 5 adhérents + "
          "3 donateurs = 8 destinataires)."),
        H2("12.2 Envoyer l'invitation"),
        B("Cliquez sur le bouton « ✉ Envoyer aux sélectionnés ». Une fenêtre s'ouvre :"),
        F("Signataire : choisissez qui signe l'e-mail (La trésorière, Le président ou La secrétaire)."),
        F("Objet : tapez l'objet de votre e-mail."),
        F("Corps du message : rédigez le texte de l'invitation. La signature officielle HSI37 est "
          "ajoutée automatiquement."),
        B("Cliquez sur « Envoyer ». Un message de confirmation s'affiche avec le nombre d'e-mails envoyés."),
        N("Les adresses e-mail en double sont automatiquement filtrées — chaque personne ne reçoit "
          "l'e-mail qu'une seule fois. Les personnes sans adresse e-mail sont ignorées."),
        PageBreak(),
    ]

    # ── 13. Déconnecter ─────────────────────────────────────────────────────
    story += [
        H("13. Se déconnecter"),
        B("Quand vous avez terminé votre travail, pensez toujours à vous déconnecter."),
        F("Cliquez sur « Se déconnecter », en haut à droite de l'écran."),
        F("Vous revenez automatiquement à l'écran de connexion."),
        F("Important : déconnectez-vous toujours, surtout si vous utilisez un ordinateur partagé."),
    ]

    # ── 14. En cas de problème ──────────────────────────────────────────────
    story += [
        H("14. En cas de problème"),
        B("Voici les situations les plus courantes et comment les résoudre :"),
        H2("« Je ne peux pas me connecter »"),
        F("Vérifiez que votre adresse e-mail et votre mot de passe sont corrects (attention aux "
          "majuscules et aux accents). Si vous avez oublié votre mot de passe, contactez Ilhame."),
        H2("« La page ne s'affiche pas »"),
        F("Vérifiez que vous êtes connecté(e) à internet. Essayez de recharger la page "
          "(touche F5 ou Ctrl+R sur PC, Cmd+R sur Mac). Si le problème persiste, contactez Ilhame."),
        H2("« J'ai supprimé un adhérent par erreur »"),
        F("Contactez Ilhame immédiatement. La suppression est définitive dans le Dashboard, "
          "mais Ilhame peut retrouver les données."),
        H2("« Le PDF ne se télécharge pas »"),
        F("Vérifiez que votre navigateur autorise les téléchargements depuis ce site. Si une "
          "notification de téléchargement bloqué apparaît (en haut à droite du navigateur), "
          "cliquez dessus et autorisez."),
        SP(16),
        HR(),
        Paragraph("Besoin d'aide ? Contactez Ilhame", ParagraphStyle(
            "contact", fontName="Helvetica-Bold", fontSize=11,
            textColor=BLEU, alignment=TA_CENTER, spaceBefore=8)),
        Paragraph("handicapsi37@gmail.com    07 43 29 58 30", ParagraphStyle(
            "contact2", fontName="Helvetica", fontSize=10,
            textColor=TEXTE, alignment=TA_CENTER, spaceAfter=4)),
    ]

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ PDF généré : {OUTPUT}")

if __name__ == "__main__":
    import os
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    build()
