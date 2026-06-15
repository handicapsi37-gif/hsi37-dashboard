#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Générateur du Mode d'emploi — Dashboard HSI37
Produit : docs/mode-emploi-HSI37.pdf
Usage   : python3 generate_mode_emploi.py
"""

import os
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer,
    PageBreak, HRFlowable, Image
)

# ──────────────────────────────────────────────────────────────────
#  Couleurs officielles HSI37
# ──────────────────────────────────────────────────────────────────
BLEU        = HexColor('#2D82C4')
BLEU_FONCE  = HexColor('#1F4E79')
ORANGE      = HexColor('#F28C28')
GRIS_TEXTE  = HexColor('#333333')
GRIS_SECOND = HexColor('#666666')

# ──────────────────────────────────────────────────────────────────
#  Chemins
# ──────────────────────────────────────────────────────────────────
DIR    = os.path.dirname(os.path.abspath(__file__))
LOGO   = os.path.join(DIR, 'assets', 'hsi37-redim-demi.png')
OUTPUT = os.path.join(DIR, 'docs', 'mode-emploi-HSI37.pdf')

# ──────────────────────────────────────────────────────────────────
#  Dimensions page
# ──────────────────────────────────────────────────────────────────
PW, PH      = A4            # 595 x 842 points
MARGE       = 2.5 * cm
MARGE_HAUT  = 3.0 * cm     # espace réservé à l'en-tête
MARGE_BAS   = 2.0 * cm     # espace réservé au pied de page

ANNEE = datetime.now().year


# ──────────────────────────────────────────────────────────────────
#  En-tête et pied de page (dessinés sur le canvas brut)
# ──────────────────────────────────────────────────────────────────
def entete_pied(canvas_obj, doc):
    canvas_obj.saveState()
    page = doc.page

    # En-tête uniquement à partir de la page 2 (la page de titre n'en a pas)
    if page > 1:
        # Logo petit à gauche
        try:
            canvas_obj.drawImage(
                LOGO,
                MARGE, PH - 2.3 * cm,
                width=3.2 * cm, height=0.9 * cm,
                preserveAspectRatio=True, mask='auto',
            )
        except Exception:
            pass

        # Texte à droite
        canvas_obj.setFont('Helvetica-Bold', 9.5)
        canvas_obj.setFillColor(BLEU)
        canvas_obj.drawRightString(
            PW - MARGE,
            PH - 2.0 * cm,
            "Mode d'emploi — Dashboard HSI37",
        )

        # Filet orange sous l'en-tête
        canvas_obj.setStrokeColor(ORANGE)
        canvas_obj.setLineWidth(1.5)
        canvas_obj.line(MARGE, PH - 2.5 * cm, PW - MARGE, PH - 2.5 * cm)

    # Pied de page sur toutes les pages
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.setFillColor(GRIS_SECOND)
    canvas_obj.drawCentredString(
        PW / 2,
        0.9 * cm,
        f"Page {page}  •  HSI37 — Handicap Solidarité pour l'Inclusion 37",
    )

    canvas_obj.restoreState()


# ──────────────────────────────────────────────────────────────────
#  Styles de texte
# ──────────────────────────────────────────────────────────────────
def creer_styles():
    s = {}

    # Page de titre — grand titre bleu foncé
    s['titre_page'] = ParagraphStyle(
        'titre_page',
        fontName='Helvetica-Bold', fontSize=30,
        textColor=BLEU_FONCE, leading=36,
        alignment=TA_CENTER, spaceAfter=6,
    )
    # Page de titre — sous-titre bleu
    s['sous_titre_page'] = ParagraphStyle(
        'sous_titre_page',
        fontName='Helvetica', fontSize=16,
        textColor=BLEU, leading=22,
        alignment=TA_CENTER, spaceAfter=4,
    )
    # Page de titre — nom association gris
    s['asso_page'] = ParagraphStyle(
        'asso_page',
        fontName='Helvetica', fontSize=13,
        textColor=GRIS_SECOND, leading=18,
        alignment=TA_CENTER, spaceAfter=4,
    )
    # Page de titre — année orange
    s['annee_page'] = ParagraphStyle(
        'annee_page',
        fontName='Helvetica-Bold', fontSize=14,
        textColor=ORANGE, leading=18,
        alignment=TA_CENTER, spaceBefore=8,
    )

    # Titre de section (bleu, gras)
    s['section'] = ParagraphStyle(
        'section',
        fontName='Helvetica-Bold', fontSize=14,
        textColor=BLEU, leading=18,
        alignment=TA_LEFT, spaceBefore=20, spaceAfter=4,
    )
    # Sous-titre de sous-section (bleu foncé, gras)
    s['sous_section'] = ParagraphStyle(
        'sous_section',
        fontName='Helvetica-Bold', fontSize=12,
        textColor=BLEU_FONCE, leading=16,
        alignment=TA_LEFT, spaceBefore=12, spaceAfter=3,
    )

    # Texte courant (noir, 11pt, interligne 17)
    s['corps'] = ParagraphStyle(
        'corps',
        fontName='Helvetica', fontSize=11,
        textColor=GRIS_TEXTE, leading=17,
        alignment=TA_JUSTIFY, spaceAfter=5, spaceBefore=2,
    )
    # Élément de liste avec flèche
    s['liste'] = ParagraphStyle(
        'liste',
        fontName='Helvetica', fontSize=11,
        textColor=GRIS_TEXTE, leading=16,
        alignment=TA_LEFT,
        leftIndent=14, spaceAfter=4, spaceBefore=1,
    )
    # Note / avertissement en italique bleu
    s['note'] = ParagraphStyle(
        'note',
        fontName='Helvetica-Oblique', fontSize=10,
        textColor=BLEU_FONCE, leading=14,
        alignment=TA_LEFT,
        leftIndent=14, rightIndent=14,
        spaceAfter=6, spaceBefore=4,
    )
    # Bloc contact final
    s['contact_titre'] = ParagraphStyle(
        'contact_titre',
        fontName='Helvetica-Bold', fontSize=13,
        textColor=BLEU_FONCE, leading=18,
        alignment=TA_CENTER, spaceAfter=4,
    )
    s['contact_info'] = ParagraphStyle(
        'contact_info',
        fontName='Helvetica', fontSize=12,
        textColor=GRIS_TEXTE, leading=17,
        alignment=TA_CENTER, spaceAfter=2,
    )

    return s


# ──────────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────────
def filet_bleu():
    """Filet fin bleu sous les titres de section."""
    return HRFlowable(
        width='100%', thickness=0.6, color=BLEU,
        spaceAfter=8, spaceBefore=0,
    )

def espacement(hauteur=0.3):
    return Spacer(1, hauteur * cm)

def fleche(texte, style):
    """Ligne de liste avec flèche →"""
    return Paragraph(f"→  {texte}", style)


# ──────────────────────────────────────────────────────────────────
#  Construction du contenu
# ──────────────────────────────────────────────────────────────────
def construire_contenu(s):
    story = []

    # ── PAGE DE TITRE ─────────────────────────────────────────────
    story.append(espacement(4.0))

    try:
        logo = Image(LOGO, width=8 * cm, height=3.5 * cm)
        logo.hAlign = 'CENTER'
        story.append(logo)
    except Exception:
        pass

    story.append(espacement(1.8))
    story.append(Paragraph("Mode d'emploi", s['titre_page']))
    story.append(espacement(0.2))
    story.append(Paragraph("Dashboard de gestion — HSI37", s['sous_titre_page']))
    story.append(espacement(0.4))

    story.append(HRFlowable(
        width='55%', thickness=2, color=ORANGE,
        spaceAfter=14, spaceBefore=10, hAlign='CENTER',
    ))

    story.append(Paragraph(
        "Handicap Solidarité pour l'Inclusion 37",
        s['asso_page'],
    ))
    story.append(Paragraph(f"Année {ANNEE}", s['annee_page']))

    story.append(PageBreak())

    # ── SECTION 1 — SE CONNECTER ──────────────────────────────────
    story.append(Paragraph("1. Se connecter au Dashboard", s['section']))
    story.append(filet_bleu())

    story.append(Paragraph(
        "Pour accéder au Dashboard HSI37, suivez ces étapes dans l'ordre :",
        s['corps'],
    ))
    story.append(espacement(0.15))

    for etape in [
        "Ouvrez votre navigateur internet (Safari sur Mac, ou Chrome).",
        "Dans la barre d'adresse en haut, tapez l'adresse du Dashboard : "
        "<b>https://hsi37-dashboard.pages.dev</b>",
        "Appuyez sur la touche <b>Entrée</b>. La page de connexion s'affiche.",
        "Saisissez votre <b>adresse e-mail</b> dans le premier champ.",
        "Saisissez votre <b>mot de passe</b> dans le second champ.",
        "Cliquez sur le bouton <b>« Se connecter »</b>.",
    ]:
        story.append(fleche(etape, s['liste']))

    story.append(espacement(0.3))

    # ── SECTION 1.1 — MOT DE PASSE OUBLIÉ ───────────────────────
    story.append(espacement(0.4))
    story.append(Paragraph("1.1  Mot de passe oublié", s['sous_section']))
    story.append(espacement(0.15))
    story.append(Paragraph(
        "Si vous avez oublié votre mot de passe, vous pouvez le réinitialiser "
        "directement depuis la page de connexion :",
        s['corps'],
    ))
    story.append(espacement(0.15))
    for etape in [
        "Sur la page de connexion, cliquez sur le lien <b>« Mot de passe oublié ? »</b>.",
        "Saisissez votre <b>adresse e-mail</b> dans le champ qui s'affiche.",
        "Cliquez sur <b>« Envoyer le lien »</b>.",
        "Ouvrez votre boîte mail. Vous recevrez un e-mail de réinitialisation sous quelques minutes.",
        "Cliquez sur le lien dans l'e-mail. Une page s'ouvre pour saisir votre nouveau mot de passe.",
        "Saisissez votre <b>nouveau mot de passe</b> (8 caractères minimum) et confirmez-le.",
        "Cliquez sur <b>« Enregistrer »</b>. Vous pouvez maintenant vous connecter avec ce nouveau mot de passe.",
    ]:
        story.append(fleche(etape, s['liste']))
    story.append(espacement(0.2))
    story.append(Paragraph(
        "⚠️  Vérifiez vos spams si l'e-mail n'arrive pas dans les 5 minutes. "
        "En cas de problème, contactez Ilhame : handicapsi37@gmail.com.",
        s['note'],
    ))
    story.append(espacement(0.4))

    # ── SECTION 2 — PAGE D'ACCUEIL ────────────────────────────────
    story.append(Paragraph("2. La page d'accueil", s['section']))
    story.append(filet_bleu())

    story.append(Paragraph(
        "Après votre connexion, vous arrivez sur la page d'accueil du Dashboard. "
        "Vous y voyez <b>4 grandes tuiles</b> (carrés cliquables) :",
        s['corps'],
    ))
    story.append(espacement(0.2))

    for tuile in [
        "<b>Adhérents</b> — gérer la liste des adhérents, leurs cartes et leurs reçus.",
        "<b>Donateurs</b> — gérer les donateurs et leurs reçus de don.",
        "<b>Documents</b> — générer les bulletins, attestations et courriers.",
        "<b>Signatures email</b> — accéder aux signatures Gmail du bureau.",
    ]:
        story.append(fleche(tuile, s['liste']))

    story.append(espacement(0.3))
    story.append(Paragraph(
        "Cliquez sur la tuile correspondant à ce que vous souhaitez faire.",
        s['corps'],
    ))
    story.append(Paragraph(
        "Pour revenir à la page d'accueil depuis n'importe où : "
        "cliquez sur le bouton <b>« Accueil »</b> (icône maison) en haut de l'écran.",
        s['corps'],
    ))

    # ── SECTION 3 — ADHÉRENTS ─────────────────────────────────────
    story.append(Paragraph("3. Gérer les adhérents", s['section']))
    story.append(filet_bleu())

    story.append(Paragraph("3.1  Voir la liste", s['sous_section']))
    story.append(Paragraph(
        "Cliquez sur la tuile <b>« Adhérents »</b> depuis la page d'accueil. "
        "Le tableau de tous les adhérents s'affiche avec leurs informations.",
        s['corps'],
    ))

    story.append(Paragraph("3.2  Ajouter un nouvel adhérent", s['sous_section']))
    story.append(Paragraph(
        "Cliquez sur le bouton <b>« + Ajouter un adhérent »</b> (en haut à droite). "
        "Un formulaire s'ouvre. Remplissez les champs :",
        s['corps'],
    ))
    story.append(espacement(0.1))
    for champ in [
        "<b>Civilité</b> : Madame ou Monsieur (facultatif).",
        "<b>Nom</b> et <b>Prénom</b> : nom de famille et prénom.",
        "<b>E-mail</b> : adresse e-mail de l'adhérent (facultatif).",
        "<b>Téléphone</b> : numéro de téléphone (facultatif).",
        "<b>Adresse</b> : adresse postale complète.",
        "<b>Date d'adhésion</b> : choisissez le jour, le mois et l'année dans "
        "les trois menus déroulants.",
        "<b>Montant</b> : cotisation en euros (ex : 20).",
        "<b>Type de membre</b> : Membre actif, Membre bienfaiteur, etc.",
        "<b>Mode de paiement</b> : Espèces, Virement, Chèque, etc.",
    ]:
        story.append(fleche(champ, s['liste']))
    story.append(espacement(0.2))
    story.append(Paragraph(
        "Quand tout est rempli, cliquez sur <b>« Enregistrer »</b>. "
        "L'adhérent apparaît aussitôt dans la liste.",
        s['corps'],
    ))

    story.append(Paragraph("3.3  Modifier un adhérent", s['sous_section']))
    story.append(Paragraph(
        "Dans le tableau, repérez la ligne de l'adhérent. "
        "Cliquez sur l'icône <b>crayon ✏</b> sur sa ligne. "
        "Le formulaire s'ouvre avec ses informations. "
        "Modifiez les champs voulus, puis cliquez sur <b>« Enregistrer les modifications »</b>.",
        s['corps'],
    ))

    story.append(Paragraph("3.4  Supprimer un adhérent", s['sous_section']))
    story.append(Paragraph(
        "Cliquez sur l'icône <b>poubelle 🗑</b> de la ligne. "
        "Une fenêtre de confirmation s'ouvre — lisez le message, "
        "puis cliquez sur <b>« Supprimer »</b> si vous êtes sûr(e).",
        s['corps'],
    ))
    story.append(Paragraph(
        "Attention : la suppression est définitive. En cas d'erreur, "
        "contactez Ilhame immédiatement.",
        s['note'],
    ))

    story.append(Paragraph("3.5  Les badges de statut", s['sous_section']))
    story.append(Paragraph(
        "Chaque adhérent affiche un badge coloré pour l'état de sa cotisation :",
        s['corps'],
    ))
    for statut in [
        "<b>Vert — À jour :</b> la cotisation de l'année en cours est réglée.",
        "<b>Rouge — En retard :</b> la cotisation n'a pas été renouvelée.",
    ]:
        story.append(fleche(statut, s['liste']))

    story.append(PageBreak())

    # ── SECTION 4 — CARTE D'ADHÉRENT ─────────────────────────────
    story.append(Paragraph("4. Générer une carte d'adhérent", s['section']))
    story.append(filet_bleu())

    story.append(Paragraph(
        "La carte d'adhérent est un document officiel au nom de l'adhérent. "
        "Pour la générer :",
        s['corps'],
    ))
    story.append(espacement(0.15))
    for etape in [
        "Repérez la ligne de l'adhérent dans le tableau.",
        "Cliquez sur l'icône <b>carte 🪪</b> (ou identité) sur sa ligne.",
        "La carte s'affiche à l'écran, pré-remplie avec ses informations.",
        "Cliquez sur <b>« Télécharger la carte »</b> pour la sauvegarder.",
        "Le fichier se trouve dans votre dossier <b>Téléchargements</b>.",
        "Vous pouvez ensuite l'imprimer ou l'envoyer par e-mail à l'adhérent.",
    ]:
        story.append(fleche(etape, s['liste']))

    # ── SECTION 5 — REÇU D'ADHÉSION ──────────────────────────────
    story.append(Paragraph("5. Générer un reçu d'adhésion", s['section']))
    story.append(filet_bleu())

    story.append(Paragraph(
        "Le reçu officialise le paiement de la cotisation. "
        "Voici comment le générer :",
        s['corps'],
    ))
    story.append(espacement(0.15))
    for etape in [
        "Dans le tableau des adhérents, repérez la ligne de l'adhérent.",
        "Cliquez sur l'icône <b>reçu</b> sur sa ligne.",
        "Une fenêtre s'ouvre. Choisissez le <b>signataire</b> : "
        "président, trésorière ou secrétaire.",
        "Le reçu s'affiche à l'écran, pré-rempli avec toutes les informations.",
        "Cliquez sur <b>« Télécharger le reçu »</b>.",
        "Le fichier se trouve dans votre dossier <b>Téléchargements</b>.",
    ]:
        story.append(fleche(etape, s['liste']))
    story.append(Paragraph(
        "→ Pour envoyer le reçu directement par mail : cliquez sur le bouton "
        "<b>« Envoyer par mail »</b> dans la même fenêtre. "
        "Le reçu est envoyé automatiquement à l'adresse e-mail de l'adhérent, "
        "sans aucune manipulation supplémentaire.",
        s['corps'],
    ))
    story.append(Paragraph(
        "<i>Remarque : l'adresse mail doit être renseignée dans la fiche de l'adhérent "
        "pour que l'envoi fonctionne.</i>",
        s['corps'],
    ))

    # ── SECTION 6 — DONATEURS ─────────────────────────────────────
    story.append(Paragraph("6. Gérer les donateurs", s['section']))
    story.append(filet_bleu())

    story.append(Paragraph("6.1  Accéder à la liste", s['sous_section']))
    story.append(Paragraph(
        "Cliquez sur la tuile <b>« Donateurs »</b> depuis la page d'accueil.",
        s['corps'],
    ))

    story.append(Paragraph("6.2  Ajouter un donateur (personne)", s['sous_section']))
    story.append(Paragraph(
        "Cliquez sur <b>« + Ajouter un donateur »</b>. "
        "Remplissez la civilité, le nom, le prénom, l'e-mail, le téléphone et l'adresse.",
        s['corps'],
    ))

    story.append(Paragraph("6.3  Ajouter un donateur (organisme)", s['sous_section']))
    story.append(Paragraph(
        "Si le donateur est une entreprise ou une association, "
        "remplissez <b>uniquement le champ « Organisme »</b>. "
        "Laissez les champs Civilité, Nom et Prénom vides.",
        s['corps'],
    ))

    story.append(Paragraph("6.4  Don financier", s['sous_section']))
    story.append(Paragraph(
        "Choisissez <b>« Don financier »</b> comme type de don. "
        "Renseignez le <b>montant</b> en euros et le <b>mode de paiement</b>.",
        s['corps'],
    ))

    story.append(Paragraph("6.5  Don de matériel", s['sous_section']))
    story.append(Paragraph(
        "Choisissez <b>« Don de matériel »</b>. "
        "Décrivez le matériel dans le champ <b>Description</b> "
        "(ex : 2 fauteuils roulants pliables, 1 déambulateur).",
        s['corps'],
    ))

    story.append(Paragraph("6.6  Modifier ou supprimer", s['sous_section']))
    story.append(Paragraph(
        "Même principe que les adhérents : "
        "icône <b>crayon ✏</b> pour modifier, icône <b>poubelle 🗑</b> pour supprimer.",
        s['corps'],
    ))

    story.append(Paragraph("6.7  Générer un reçu de don", s['sous_section']))
    story.append(Paragraph(
        "Cliquez sur l'icône reçu sur la ligne du donateur, "
        "choisissez un signataire (président, trésorière ou secrétaire), "
        "puis cliquez sur <b>« Télécharger »</b> pour obtenir le PDF.",
        s['corps'],
    ))
    story.append(Paragraph(
        "→ Pour envoyer le reçu directement par mail : cliquez sur le bouton "
        "<b>« Envoyer par mail »</b>. "
        "Le reçu est envoyé automatiquement à l'adresse e-mail du donateur, "
        "sans aucune manipulation supplémentaire.",
        s['corps'],
    ))
    story.append(Paragraph(
        "<i>Remarque : l'adresse mail doit être renseignée dans la fiche du donateur "
        "pour que l'envoi fonctionne.</i>",
        s['corps'],
    ))

    story.append(Spacer(1, 12))
    story.append(Paragraph("6.8  Ajouter un adhérent avec don", s['sous_section']))
    story.append(Paragraph(
        "Un adhérent peut aussi être donateur. Si la personne verse une cotisation "
        "ET effectue un don (financier ou matériel) au moment de son adhésion, "
        "les deux saisies se font séparément :",
        s['corps'],
    ))
    story.append(Paragraph(
        "① Ajoutez l'adhérent normalement via l'onglet <b>Adhérents</b> "
        "(nom, prénom, cotisation, date d'adhésion, etc.). "
        "Si vous renseignez un montant de don dans le formulaire, "
        "une fiche donateur est <b>créée automatiquement</b> dans l'onglet Donateurs — "
        "aucune saisie supplémentaire n'est nécessaire.",
        s['corps'],
    ))
    story.append(Paragraph(
        "② Si le don arrive <b>après</b> l'adhésion, allez dans l'onglet <b>Donateurs</b> "
        "et ajoutez manuellement une fiche donateur pour cette personne.",
        s['corps'],
    ))
    story.append(Paragraph(
        "Les deux fiches (adhérent et donateur) sont indépendantes : "
        "modifier l'une ne modifie pas l'autre.",
        s['corps'],
    ))
    story.append(Paragraph(
        "<i>Astuce : vous pouvez générer un reçu de don depuis l'onglet Donateurs "
        "et un reçu d'adhésion depuis l'onglet Adhérents — les deux documents "
        "peuvent être envoyés à la même personne.</i>",
        s['corps'],
    ))

    story.append(PageBreak())

    # ── SECTION 7 — DOCUMENTS ─────────────────────────────────────
    # ── SECTION 7 — EXPORTER LES DONNÉES ─────────────────────────
    story.append(Paragraph("7. Exporter les données", s['section']))
    story.append(filet_bleu())
    story.append(Paragraph(
        "Le Dashboard permet d'exporter la liste des adhérents et la liste des donateurs "
        "en fichier CSV (fichier tableur — lisible par Excel ou LibreOffice). "
        "Cette fonction est importante pour deux raisons :",
        s['corps'],
    ))
    story.append(espacement(0.15))
    for raison in [
        "<b>Sauvegarde</b> — conserver une copie locale de vos données en cas de problème technique.",
        "<b>RGPD</b> (Règlement Général sur la Protection des Données — loi européenne sur la vie privée) "
        "— vous devez pouvoir fournir les données d'un adhérent sur demande.",
    ]:
        story.append(fleche(raison, s['liste']))
    story.append(espacement(0.25))
    story.append(Paragraph("7.1  Exporter la liste des adhérents", s['sous_section']))
    story.append(espacement(0.15))
    for etape in [
        "Depuis la page d'accueil, cliquez sur la tuile <b>« Adhérents »</b>.",
        "Au-dessus du tableau, cliquez sur le bouton <b>« ⬇ Exporter CSV »</b>.",
        "Un fichier nommé <b>adherents_HSI37_2026.csv</b> se télécharge automatiquement.",
        "Ouvrez ce fichier avec Excel ou LibreOffice pour consulter ou archiver les données.",
    ]:
        story.append(fleche(etape, s['liste']))
    story.append(espacement(0.25))
    story.append(Paragraph("7.2  Exporter la liste des donateurs", s['sous_section']))
    story.append(espacement(0.15))
    for etape in [
        "Depuis la page d'accueil, cliquez sur la tuile <b>« Donateurs »</b>.",
        "Au-dessus du tableau, cliquez sur le bouton <b>« ⬇ Exporter CSV »</b>.",
        "Un fichier nommé <b>donateurs_HSI37_2026.csv</b> se télécharge automatiquement.",
    ]:
        story.append(fleche(etape, s['liste']))
    story.append(espacement(0.2))
    story.append(Paragraph(
        "💡  Conseil : faites un export chaque mois et sauvegardez les fichiers "
        "dans un dossier Google Drive de l'association.",
        s['note'],
    ))
    story.append(espacement(0.4))

    # ── SECTION 8 — LES DOCUMENTS DE L'ASSOCIATION ───────────────
    story.append(Paragraph("8. Les documents de l'association", s['section']))
    story.append(filet_bleu())

    story.append(Paragraph(
        "Depuis la page d'accueil, cliquez sur la tuile <b>« Documents »</b>. "
        "Vous accédez à tous les documents officiels de l'association.",
        s['corps'],
    ))
    story.append(espacement(0.2))

    docs = [
        ("Bulletin d'adhésion",
         "Cliquez sur « Générer ». Choisissez la version <b>standard</b> "
         "(adhésion uniquement) ou <b>avec don</b> (adhésion + don libre). "
         "Cliquez « Télécharger »."),
        ("Papier à en-tête",
         "Cliquez sur « Télécharger ». Un fichier Word (.docx) se télécharge. "
         "Ouvrez-le dans <b>Pages</b> (Mac) ou <b>Word</b> (PC). "
         "Tapez votre texte sous l'en-tête HSI37."),
        ("Attestation d'adhésion",
         "Disponible depuis le tableau des adhérents — icône <b>✓</b> sur chaque ligne. "
         "Choisissez un signataire, puis téléchargez."),
        ("Relance de cotisation",
         "Apparaît uniquement pour les adhérents dont le badge est "
         "<b>Rouge</b> (en retard). "
         "Cliquez sur l'icône courrier pour télécharger ou envoyer par mail."),
        ("Convocation AG",
         "Cliquez « Générer ». Remplissez la <b>date</b>, l'<b>heure</b>, "
         "le <b>lieu</b> et l'<b>ordre du jour</b> de l'Assemblée Générale. "
         "Téléchargez."),
        ("Procès-verbal AG",
         "Cliquez « Générer ». Remplissez les informations de l'assemblée "
         "et les décisions prises. Téléchargez."),
        ("Courrier libre",
         "Cliquez « Nouveau courrier ». Remplissez le <b>destinataire</b>, "
         "l'<b>objet</b> et le <b>texte</b> du courrier. Téléchargez."),
    ]
    for titre_doc, desc_doc in docs:
        story.append(Paragraph(f"<b>{titre_doc}</b>", s['sous_section']))
        story.append(Paragraph(desc_doc, s['corps']))
        story.append(espacement(0.1))

    # ── SECTION 9 — ENVOYER PAR MAIL ──────────────────────────────
    story.append(Paragraph("9. Envoyer un document par mail", s['section']))
    story.append(filet_bleu())

    story.append(Paragraph(
        "Certains documents peuvent être envoyés directement par e-mail "
        "depuis le Dashboard.",
        s['corps'],
    ))
    story.append(espacement(0.15))
    for etape in [
        "Cliquez sur le bouton <b>« Envoyer par mail »</b>.",
        "Votre messagerie <b>Gmail</b> s'ouvre dans un nouvel onglet.",
        "Le mail est déjà pré-rempli : destinataire, objet et texte.",
        "Vérifiez le contenu et modifiez si besoin.",
        "Cliquez sur <b>« Envoyer »</b> dans Gmail.",
    ]:
        story.append(fleche(etape, s['liste']))

    story.append(PageBreak())

    # ── SECTION 10 — SE DÉCONNECTER ───────────────────────────────
    story.append(Paragraph("10. Se déconnecter", s['section']))
    story.append(filet_bleu())

    story.append(Paragraph(
        "Quand vous avez terminé votre travail, pensez toujours à vous déconnecter.",
        s['corps'],
    ))
    story.append(espacement(0.15))
    for etape in [
        "Cliquez sur <b>« Se déconnecter »</b>, en haut à droite de l'écran.",
        "Vous revenez automatiquement à l'écran de connexion.",
        "<b>Important :</b> déconnectez-vous toujours, "
        "surtout si vous utilisez un ordinateur partagé.",
    ]:
        story.append(fleche(etape, s['liste']))

    # ── SECTION 11 — EN CAS DE PROBLÈME ──────────────────────────
    story.append(Paragraph("11. En cas de problème", s['section']))
    story.append(filet_bleu())

    story.append(Paragraph(
        "Voici les situations les plus courantes et comment les résoudre :",
        s['corps'],
    ))
    story.append(espacement(0.2))

    problemes = [
        (
            "Je ne peux pas me connecter",
            "Vérifiez que votre adresse e-mail et votre mot de passe sont corrects "
            "(attention aux majuscules et aux accents). "
            "Si vous avez oublié votre mot de passe, contactez Ilhame.",
        ),
        (
            "La page ne s'affiche pas",
            "Vérifiez que vous êtes connecté(e) à internet. "
            "Essayez de recharger la page (touche F5 ou Ctrl+R sur PC, "
            "Cmd+R sur Mac). Si le problème persiste, contactez Ilhame.",
        ),
        (
            "J'ai supprimé un adhérent par erreur",
            "Contactez Ilhame immédiatement. La suppression est définitive dans "
            "le Dashboard, mais Ilhame peut retrouver les données.",
        ),
        (
            "Le PDF ne se télécharge pas",
            "Vérifiez que votre navigateur autorise les téléchargements depuis "
            "ce site. Si une notification de téléchargement bloqué apparaît "
            "(en haut à droite du navigateur), cliquez dessus et autorisez.",
        ),
    ]
    for titre_pb, solution in problemes:
        story.append(Paragraph(f"<b>« {titre_pb} »</b>", s['sous_section']))
        story.append(fleche(solution, s['liste']))
        story.append(espacement(0.15))

    # Bloc contact
    story.append(espacement(0.6))
    story.append(HRFlowable(
        width='100%', thickness=1.5, color=ORANGE,
        spaceAfter=14, spaceBefore=6,
    ))
    story.append(Paragraph(
        "Besoin d'aide ? Contactez Ilhame",
        s['contact_titre'],
    ))
    story.append(Paragraph(
        "handicapsi37@gmail.com  •  07 43 29 58 30",
        s['contact_info'],
    ))

    return story


# ──────────────────────────────────────────────────────────────────
#  Génération du PDF
# ──────────────────────────────────────────────────────────────────
def generer_pdf():
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=A4,
        leftMargin=MARGE,
        rightMargin=MARGE,
        topMargin=MARGE_HAUT,
        bottomMargin=MARGE_BAS,
        title="Mode d'emploi — Dashboard HSI37",
        author="HSI37 — Handicap Solidarité pour l'Inclusion 37",
        subject="Guide utilisateur du Dashboard de gestion",
    )

    styles = creer_styles()
    story  = construire_contenu(styles)

    doc.build(story, onFirstPage=entete_pied, onLaterPages=entete_pied)
    print(f"PDF généré avec succès : {OUTPUT}")


if __name__ == "__main__":
    generer_pdf()
