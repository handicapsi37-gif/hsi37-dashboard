#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Import adhérents PayAsso → Supabase (HSI37)

Usage :
  python3 scripts/import-payasso/import.py <fichier.xlsx>             # dry-run
  python3 scripts/import-payasso/import.py <fichier.xlsx> --confirmer  # écriture réelle
"""

from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import pandas as pd
import requests

# ─── Secrets ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))
try:
    from secrets_import import SUPABASE_URL, SUPABASE_SERVICE_KEY
except ImportError:
    print("❌ secrets_import.py introuvable à la racine du projet.")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

SEUIL_DOUBLON = 0.85   # score minimum pour signaler un doublon probable


# ─── Helpers Supabase ─────────────────────────────────────────────────────────

def api_get(table: str, params: dict) -> list:
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()


def api_post(table: str, lignes: list) -> list:
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=HEADERS,
        data=json.dumps(lignes),
    )
    r.raise_for_status()
    return r.json()


# ─── Normalisation ────────────────────────────────────────────────────────────

def normaliser(texte: str) -> str:
    """Minuscules, sans accents, sans tirets/apostrophes superflus."""
    texte = texte.strip().lower()
    texte = unicodedata.normalize("NFD", texte)
    texte = "".join(c for c in texte if unicodedata.category(c) != "Mn")
    texte = texte.replace("-", " ").replace("'", " ").replace("'", " ")
    return " ".join(texte.split())


def score_similarite(cle_candidat: str, prenom_ex: str, nom_ex: str) -> float:
    """
    Teste les deux ordres (prénom nom / nom prénom) et retourne le meilleur score.
    Nécessaire car PayAsso stocke "Prénom Nom" mais la base peut avoir l'ordre inverse.
    """
    cand = normaliser(cle_candidat)
    ordre1 = normaliser(f"{prenom_ex} {nom_ex}")
    ordre2 = normaliser(f"{nom_ex} {prenom_ex}")
    return max(
        SequenceMatcher(None, cand, ordre1).ratio(),
        SequenceMatcher(None, cand, ordre2).ratio(),
    )


# ─── Étape 1 : Lecture Excel ──────────────────────────────────────────────────

# Textes à ignorer dans les cellules nom (annotations de suivi)
_ANNOTATIONS = {"via pay asso", "via payasso", "via pay-asso", "via payasso adhesion"}

def _cellule(row: pd.Series, i: int) -> str:
    """Retourne la valeur de la cellule i, ou '' si absente/NaN."""
    try:
        v = row.iloc[i]
    except IndexError:
        return ""
    if pd.isna(v):
        return ""
    s = str(v).strip()
    return "" if s in ("nan", "NaT", "None") else s


def lire_excel(chemin: str) -> pd.DataFrame:
    """
    Parse le fichier adhesion.xlsx de PayAsso HSI37.

    Format : pas de vraie en-tête, données sur deux blocs côte à côte.
      Bloc gauche  (col 0 = date, col 1 = prénom nom) — sections 2024 puis 2025.
      Bloc droite  (col 5 = date, col 6 = prénom nom) — section 2026.
    Les marqueurs de section sont des lignes avec l'année seule dans col 0.
    """
    try:
        df_raw = pd.read_excel(chemin, header=None, dtype=str)
    except FileNotFoundError:
        print(f"❌ Fichier introuvable : {chemin}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Erreur lecture Excel : {e}")
        sys.exit(1)

    ANNEES_VALIDES = {"2024", "2025", "2026"}
    lignes = []
    section_gauche = None
    last_date_gauche = None

    for idx in range(len(df_raw)):
        row = df_raw.iloc[idx]
        v0 = _cellule(row, 0)
        v1 = _cellule(row, 1)
        v5 = _cellule(row, 5)
        v6 = _cellule(row, 6)
        v7 = _cellule(row, 7)

        # ── Marqueur de section gauche (ex : ligne avec "2024" seul) ──
        if v0 in ANNEES_VALIDES and not v1:
            section_gauche = v0
            continue

        # ── Bloc gauche (2024 / 2025) ──
        if section_gauche and v1 and normaliser(v1) not in _ANNOTATIONS:
            if v0:
                lignes.append({"date_brute": v0, "prenom_nom": v1})
                last_date_gauche = v0
            else:
                # Pas de date → utilise la dernière date connue de la section
                date_defaut = last_date_gauche if last_date_gauche else f"{section_gauche}-09-24"
                print(f"⚠  Ligne {idx+1} sans date (section {section_gauche}) : «{v1}» → date estimée {date_defaut}")
                lignes.append({"date_brute": date_defaut, "prenom_nom": v1})

        # ── Bloc droite (2026) ──
        if v5 and v6 and normaliser(v6) not in _ANNOTATIONS:
            if v7.upper() == "TEST":
                print(f"⚠  Ligne {idx+1} (droite) ignorée (marquée TEST) : «{v6}»")
                continue
            lignes.append({"date_brute": v5, "prenom_nom": v6})

    df = pd.DataFrame(lignes)
    if df.empty:
        print("❌ Aucune donnée extraite du fichier.")
        sys.exit(1)

    df["prenom_nom"] = df["prenom_nom"].str.strip().str.lower()
    df["date_parsed"] = pd.to_datetime(df["date_brute"], errors="coerce")
    invalides = df["date_parsed"].isna().sum()
    if invalides:
        print(f"⚠  {invalides} ligne(s) avec date non parseable — ignorées.")
        df = df.dropna(subset=["date_parsed"])

    df["annee"] = df["date_parsed"].dt.year.astype(int)
    print(f"📂 {len(df)} lignes valides extraites ({df['annee'].value_counts().sort_index().to_dict()}).")
    return df[["date_parsed", "prenom_nom", "annee"]]


# ─── Étape 2 : Parsing prénom / nom ──────────────────────────────────────────

def parser_prenom_nom(texte: str) -> tuple[str, str, bool]:
    """
    Découpe "Prénom Nom" → (prenom, nom, ambigu).
    Convention : premier mot = prénom, reste = nom.
    ambigu=True si un seul mot ou si le prénom pourrait être composé.
    """
    parties = texte.strip().split()
    if len(parties) == 0:
        return ("", "", True)
    if len(parties) == 1:
        return (parties[0], "", True)
    prenom = parties[0]
    nom = " ".join(parties[1:])
    # Prénom probablement composé si suivi d'un tiret ou majuscule inhabituelle
    ambigu = "-" in prenom or (len(parties) > 2 and parties[1][0].isupper() and len(parties[1]) > 2)
    return (prenom, nom, ambigu)


# ─── Étape 3 : Regroupement par personne ──────────────────────────────────────

def regrouper_par_personne(df: pd.DataFrame) -> list[dict]:
    """
    Regroupe par nom complet normalisé.
    - Déduplique les cotisations par (clé_personne, annee)
    - date_adhesion = date la plus ancienne toutes années confondues
    """
    personnes: dict[str, dict] = {}

    for _, row in df.iterrows():
        prenom_nom = row["prenom_nom"]
        cle = normaliser(prenom_nom)
        annee = int(row["annee"])
        date = row["date_parsed"]

        if cle not in personnes:
            prenom, nom, ambigu = parser_prenom_nom(prenom_nom)
            personnes[cle] = {
                "prenom_nom_original": prenom_nom,
                "prenom": prenom,
                "nom": nom,
                "ambigu": ambigu,
                "cle": cle,
                "cotisations": {},      # annee → date
                "date_adhesion": date,
            }
        else:
            # Met à jour la date d'adhésion si plus ancienne
            if date < personnes[cle]["date_adhesion"]:
                personnes[cle]["date_adhesion"] = date

        # Déduplique par année : garde la date la plus ancienne pour cette année
        cots = personnes[cle]["cotisations"]
        if annee not in cots or date < cots[annee]:
            cots[annee] = date

    return list(personnes.values())


# ─── Étape 4 : Chargement base existante ─────────────────────────────────────

def charger_adherents_existants() -> list[dict]:
    rows = api_get("adherents", {"select": "id,id_adherent,nom,prenom"})
    print(f"🗄  {len(rows)} adhérent(s) existant(s) en base.")
    return rows


# ─── Étape 5 : Détection doublons ────────────────────────────────────────────

def trouver_doublons(
    candidats: list[dict], existants: list[dict]
) -> list[tuple[dict, dict, float]]:
    """
    Pour chaque candidat, cherche dans les existants un nom approchant.
    Seuil : SEUIL_DOUBLON. Retourne tous les matches trouvés.
    """
    doublons = []
    for candidat in candidats:
        cle_candidat = candidat["cle"]
        meilleur_score = 0.0
        meilleur_match = None
        for existant in existants:
            prenom_ex = existant.get("prenom") or ""
            nom_ex = existant.get("nom") or ""
            if not prenom_ex and not nom_ex:
                continue
            score = score_similarite(cle_candidat, prenom_ex, nom_ex)
            if score > meilleur_score:
                meilleur_score = score
                meilleur_match = existant
        if meilleur_score >= SEUIL_DOUBLON and meilleur_match:
            doublons.append((candidat, meilleur_match, meilleur_score))
    return doublons


# ─── Étape 5b : Cotisations existantes d'un adhérent ────────────────────────

def charger_cotisations_existantes(adherent_uuid: str) -> set:
    """Retourne l'ensemble des années déjà enregistrées pour cet adhérent."""
    rows = api_get("cotisations", {"select": "annee", "adherent_id": f"eq.{adherent_uuid}"})
    return {int(r["annee"]) for r in rows}


# ─── Étape 6 : Confirmation interactive ──────────────────────────────────────

def confirmer_doublons(
    doublons: list[tuple[dict, dict, float]],
    tous_candidats: list[dict],
) -> tuple[list[dict], list[tuple[dict, dict]], int]:
    """
    Présente chaque doublon probable et demande une décision.
    Retourne (à_importer_nouveau, à_completer[(candidat, existant)], nb_skippés).

    G = nouveau adhérent (crée une fiche + cotisations)
    I = doublon confirmé → ajoute les cotisations manquantes sur la fiche existante
    Q = arrêter les questions, traiter ce qui est déjà décidé (le reste = skippé)
    """
    if not doublons:
        return tous_candidats, [], 0

    doublons_cles = {d[0]["cle"] for d in doublons}
    sans_doublon = [c for c in tous_candidats if c["cle"] not in doublons_cles]
    a_importer = list(sans_doublon)
    a_completer = []
    nb_skipped = 0

    print(f"\n{'─'*60}")
    print(f"⚠  {len(doublons)} doublon(s) probable(s) détecté(s) (seuil {int(SEUIL_DOUBLON*100)}%)")
    print("   G = nouvelle fiche  |  I = doublon → ajouter cotisations manquantes  |  Q = arrêter ici\n")

    for candidat, existant, score in doublons:
        prenom_ex = existant.get("prenom") or ""
        nom_ex = existant.get("nom") or ""
        id_ex = existant.get("id_adherent") or "?"
        annees_str = ", ".join(str(a) for a in sorted(candidat["cotisations"].keys()))

        print(f"  Fichier  : {candidat['prenom_nom_original']}  (années : {annees_str})")
        print(f"  Existant : {prenom_ex} {nom_ex}  [{id_ex}]  (similarité {score:.0%})")

        while True:
            rep = input("  → [G] Nouvelle fiche / [I] Doublon + cotisations / [Q] Arrêter ici : ").strip().upper()
            if rep == "G":
                a_importer.append(candidat)
                break
            elif rep == "I":
                a_completer.append((candidat, existant))
                break
            elif rep == "Q":
                # Les doublons restants sont comptés comme skippés
                idx_courant = doublons.index((candidat, existant, score))
                nb_skipped = len(doublons) - idx_courant
                print(f"\n  ⏹  Arrêt demandé. {nb_skipped} personne(s) non traitée(s) = skippées.")
                return a_importer, a_completer, nb_skipped
            else:
                print("     Tapez G, I ou Q.")
        print()

    return a_importer, a_completer, nb_skipped


# ─── Étape 7 : Calcul IDs ─────────────────────────────────────────────────────

def lire_max_par_annee(annee: int) -> int:
    """Retourne le numéro de séquence max existant pour HSI-{annee}-XXXX."""
    rows = api_get(
        "adherents",
        {"select": "id_adherent", "saison": f"eq.{annee}"},
    )
    max_num = 0
    for row in rows:
        parties = (row.get("id_adherent") or "").split("-")
        if len(parties) == 3:
            try:
                max_num = max(max_num, int(parties[2]))
            except ValueError:
                pass
    return max_num


# ─── Étapes 8-9 : Insertion ───────────────────────────────────────────────────

def inserer_adherent(personne: dict, id_adherent: str, dry_run: bool):
    """Insère l'adhérent, retourne son UUID Supabase (ou None en dry-run)."""
    saison = personne["date_adhesion"].year
    ligne = {
        "id_adherent":        id_adherent,
        "nom":                personne["nom"] or personne["prenom_nom_original"],
        "prenom":             personne["prenom"] or None,
        "civilite":           None,
        "email":              None,
        "telephone":          None,
        "adresse":            None,
        "date_adhesion":      personne["date_adhesion"].strftime("%Y-%m-%d"),
        "montant_cotisation": 20,
        "mode_paiement":      None,
        "type_membre":        "Membre actif",
        "saison":             str(saison),
    }
    if dry_run:
        return None
    result = api_post("adherents", [ligne])
    return result[0]["id"] if result else None


def inserer_cotisations(
    adherent_uuid: str,
    cotisations: dict,  # annee → date
    dry_run: bool,
) -> int:
    """Insère une cotisation par année, retourne le nombre inséré."""
    lignes = []
    for annee, date in sorted(cotisations.items()):
        lignes.append({
            "adherent_id":  adherent_uuid,
            "annee":        int(annee),
            "date_paiement": date.strftime("%Y-%m-%d"),
            "montant":      20,
            "mode_paiement": None,
        })
    if dry_run or not lignes:
        return len(lignes)
    api_post("cotisations", lignes)
    return len(lignes)


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Import adhérents PayAsso → HSI37 Supabase")
    parser.add_argument("fichier", help="Chemin vers le fichier Excel PayAsso")
    parser.add_argument(
        "--confirmer", action="store_true",
        help="Écriture réelle en base (sans ce flag : dry-run uniquement)"
    )
    args = parser.parse_args()
    dry_run = not args.confirmer

    if dry_run:
        print("\n🔍 MODE DRY-RUN — aucune écriture en base. Ajoutez --confirmer pour insérer.\n")
    else:
        print("\n✏️  MODE ÉCRITURE — les données seront insérées en base.\n")

    # 1. Lecture Excel
    df = lire_excel(args.fichier)

    # 2-3. Parsing et regroupement
    candidats = regrouper_par_personne(df)
    print(f"👥 {len(candidats)} personne(s) distincte(s) trouvée(s) dans le fichier.\n")

    # Signalement des cas ambigus
    ambigus = [c for c in candidats if c["ambigu"]]
    if ambigus:
        print(f"⚠  {len(ambigus)} prénom(s)/nom(s) ambigus (vérification conseillée) :")
        for a in ambigus:
            print(f"   • {a['prenom_nom_original']}  → prénom=«{a['prenom']}» nom=«{a['nom']}»")
        print()

    # 4. Chargement base
    existants = charger_adherents_existants()

    # 5. Détection doublons
    doublons = trouver_doublons(candidats, existants)

    # 6. Confirmation interactive (TOUJOURS, même en dry-run)
    a_importer, a_completer, nb_skipped = confirmer_doublons(doublons, candidats)

    # Calcul des max IDs par année (pour toutes les années de date_adhesion)
    annees_adhesion = {p["date_adhesion"].year for p in a_importer}
    max_par_annee = {a: lire_max_par_annee(a) for a in annees_adhesion}
    compteurs = dict(max_par_annee)

    print(f"\n{'─'*60}")
    print(f"{'DRY-RUN — ' if dry_run else ''}Récapitulatif avant insertion :\n")

    # ── Nouveaux adhérents ──
    nb_cotisations_total = 0
    plan_insertion: list[tuple[dict, str]] = []

    if a_importer:
        print(f"  NOUVEAUX ADHÉRENTS ({len(a_importer)})")
        print(f"  {'ID adhérent':<20} {'Nom':<20} {'Prénom':<15} {'Date adhésion':<14} {'Cotisations'}")
        print(f"  {'─'*20} {'─'*20} {'─'*15} {'─'*14} {'─'*20}")
        for personne in a_importer:
            saison = personne["date_adhesion"].year
            compteurs[saison] += 1
            id_adherent = f"HSI-{saison}-{compteurs[saison]:04d}"
            annees_str = ", ".join(str(a) for a in sorted(personne["cotisations"].keys()))
            nb_cotisations_total += len(personne["cotisations"])
            plan_insertion.append((personne, id_adherent))
            flag = " ⚠" if personne["ambigu"] else ""
            print(
                f"  {id_adherent:<20} {personne['nom'][:19]:<20} "
                f"{personne['prenom'][:14]:<15} "
                f"{personne['date_adhesion'].strftime('%Y-%m-%d'):<14} "
                f"{annees_str}{flag}"
            )

    # ── Cotisations à ajouter sur membres existants ──
    plan_completer: list[tuple[dict, dict]] = []
    if a_completer:
        print(f"\n  COTISATIONS MANQUANTES SUR MEMBRES EXISTANTS ({len(a_completer)})")
        print(f"  {'ID existant':<20} {'Nom existant':<25} {'Années à ajouter'}")
        print(f"  {'─'*20} {'─'*25} {'─'*20}")
        for candidat, existant in a_completer:
            id_ex = existant.get("id_adherent") or "?"
            nom_ex = f"{existant.get('prenom','')} {existant.get('nom','')}".strip()
            # En dry-run on ne peut pas savoir quelles années existent déjà → on affiche tout
            annees_fichier = sorted(candidat["cotisations"].keys())
            annees_str = ", ".join(str(a) for a in annees_fichier)
            nb_cotisations_total += len(annees_fichier)
            plan_completer.append((candidat, existant))
            print(f"  {id_ex:<20} {nom_ex[:24]:<25} {annees_str}")

    print(f"\n  → {len(a_importer)} nouvelle(s) fiche(s) adhérent à créer")
    print(f"  → {len(a_completer)} fiche(s) existante(s) à compléter (cotisations manquantes)")
    print(f"  → ~{nb_cotisations_total} cotisation(s) à créer (max, avant vérif doublons)")
    if nb_skipped:
        print(f"  → {nb_skipped} personne(s) skippée(s) (Q pressé)")

    if dry_run:
        print("\n→ Dry-run terminé. Relancez avec --confirmer pour insérer réellement.")
        return

    # Confirmation finale avant écriture
    print()
    rep = input("Confirmer l'insertion en base ? [oui/non] : ").strip().lower()
    if rep not in ("oui", "o"):
        print("⛔ Import annulé.")
        sys.exit(0)

    # ── Insertion nouveaux adhérents ──
    nb_inseres = 0
    nb_cotisations_crees = 0

    for personne, id_adherent in plan_insertion:
        try:
            uuid = inserer_adherent(personne, id_adherent, dry_run=False)
            nb_inseres += 1
        except requests.HTTPError as e:
            print(f"❌ Erreur insertion adhérent {id_adherent} : {e.response.text}")
            continue
        try:
            nb_cotisations_crees += inserer_cotisations(uuid, personne["cotisations"], dry_run=False)
        except requests.HTTPError as e:
            print(f"⚠  Adhérent {id_adherent} inséré, mais erreur cotisations : {e.response.text}")

    # ── Cotisations manquantes sur membres existants ──
    nb_completes = 0
    for candidat, existant in plan_completer:
        uuid_ex = existant.get("id")
        id_ex = existant.get("id_adherent") or "?"
        try:
            annees_deja = charger_cotisations_existantes(uuid_ex)
        except requests.HTTPError as e:
            print(f"⚠  Impossible de lire les cotisations existantes pour {id_ex} : {e.response.text}")
            continue
        cotisations_a_inserer = {
            a: d for a, d in candidat["cotisations"].items() if a not in annees_deja
        }
        if not cotisations_a_inserer:
            print(f"  ℹ  {id_ex} : toutes les cotisations déjà présentes, rien à ajouter.")
            continue
        try:
            n = inserer_cotisations(uuid_ex, cotisations_a_inserer, dry_run=False)
            nb_cotisations_crees += n
            nb_completes += 1
            annees_str = ", ".join(str(a) for a in sorted(cotisations_a_inserer))
            print(f"  ✅ {id_ex} : {n} cotisation(s) ajoutée(s) ({annees_str})")
        except requests.HTTPError as e:
            print(f"⚠  Erreur cotisations pour {id_ex} : {e.response.text}")

    print(f"\n{'─'*60}")
    print(f"✅ Import terminé.")
    print(f"   {nb_inseres} nouvel(aux) adhérent(s) créé(s)")
    print(f"   {nb_completes} fiche(s) existante(s) complétée(s)")
    print(f"   {nb_cotisations_crees} cotisation(s) créées")
    print(f"   {nb_skipped} personne(s) skippée(s) / non traitée(s)")


if __name__ == "__main__":
    main()
