#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Import dons PayAsso → Supabase (HSI37)

Usage :
  python3 import_dons.py fichier.xlsx              # dry-run
  python3 import_dons.py fichier.xlsx --confirmer  # écriture réelle

G = nouveau donateur + nouveau don
I = donateur existant + nouveau don uniquement
Q = arrêt propre
"""
from __future__ import annotations

import argparse
import difflib
import json
import sys
import unicodedata
from datetime import datetime

import pandas as pd
import requests

sys.path.insert(0, "/Users/ilhamemarroki/hsi37-dashboard")
try:
    from secrets_import import SUPABASE_URL, SUPABASE_SERVICE_KEY
except ImportError:
    print("❌ Fichier 'secrets_import.py' introuvable à la racine du projet.")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


# ── Helpers réseau ──────────────────────────────────────────────────────────

def api_get(table: str, params: dict) -> list:
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()


def api_post(table: str, payload: dict) -> dict:
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS,
                      data=json.dumps(payload))
    r.raise_for_status()
    return r.json()[0]


# ── Normalisation / fuzzy ───────────────────────────────────────────────────

def normaliser(texte: str) -> str:
    if not texte:
        return ""
    texte = unicodedata.normalize("NFD", texte.lower())
    texte = "".join(c for c in texte if unicodedata.category(c) != "Mn")
    return " ".join(texte.replace("-", " ").replace("'", " ").split())


def score_similarite(cle: str, nom_ex: str, prenom_ex: str) -> float:
    ordre1 = normaliser(f"{prenom_ex} {nom_ex}")
    ordre2 = normaliser(f"{nom_ex} {prenom_ex}")
    return max(
        difflib.SequenceMatcher(None, cle, ordre1).ratio(),
        difflib.SequenceMatcher(None, cle, ordre2).ratio(),
    )


def trouver_doublon(nom: str, prenom: str, existants: list) -> tuple[dict, float] | None:
    cle = normaliser(f"{prenom} {nom}")
    cle_nom_seul = normaliser(nom)
    meilleur, meilleur_score = None, 0.0
    for ex in existants:
        s = score_similarite(cle, ex.get("nom", ""), ex.get("prenom", ""))
        # Fallback nom-seul uniquement pour les noms multi-mots (organismes, ex: "BJS IT CONSULTING")
        if len(cle_nom_seul.split()) > 1:
            s_nom = difflib.SequenceMatcher(None, cle_nom_seul, normaliser(ex.get("nom", ""))).ratio()
            s = max(s, s_nom)
        if s > meilleur_score:
            meilleur_score = s
            meilleur = ex
    if meilleur_score >= 0.85:
        return meilleur, meilleur_score
    return None


# ── Lecture Excel ───────────────────────────────────────────────────────────

def lire_excel(chemin: str) -> list[dict]:
    df = pd.read_excel(chemin, dtype=str)
    df = df.where(pd.notna(df), None)

    lignes = []
    for _, row in df.iterrows():
        # Adresse concaténée
        parties = [row.get("Adresse"), row.get("Code postal"), row.get("Ville")]
        adresse = ", ".join(p.strip() for p in parties if p and p.strip()) or None

        # Date
        date_brut = row.get("Date") or ""
        try:
            date_don = datetime.strptime(date_brut.strip(), "%d/%m/%Y").date().isoformat()
        except ValueError:
            date_don = None

        lignes.append({
            "nom":           (row.get("Nom") or "").strip() or None,
            "prenom":        (row.get("Prénom") or "").strip() or None,
            "email":         (row.get("Adresse email") or "").strip() or None,
            "adresse":       adresse,
            "montant":       float(row.get("Montant") or 0),
            "date_don":      date_don,
            "mode_paiement": (row.get("Moyen de paiement") or "").strip() or None,
        })
    return lignes


# ── IDs séquentiels ─────────────────────────────────────────────────────────

def lire_max_donateurs(annee: str) -> int:
    rows = api_get("donateurs", {"select": "id_donateur",
                                  "id_donateur": f"like.DON-{annee}-%"})
    max_num = 0
    for row in rows:
        parties = (row.get("id_donateur") or "").split("-")
        if len(parties) == 3:
            try:
                max_num = max(max_num, int(parties[2]))
            except ValueError:
                pass
    return max_num


# ── Insertions ──────────────────────────────────────────────────────────────

def inserer_donateur(ligne: dict, id_donateur: str, dry_run: bool) -> int | None:
    payload = {
        "id_donateur":  id_donateur,
        "nom":          ligne["nom"],
        "prenom":       ligne["prenom"],
        "email":        ligne["email"],
        "adresse":      ligne["adresse"],
        "date_don":     ligne["date_don"],
        "montant_don":  ligne["montant"],
        "type_don":     "Don financier",
        "mode_paiement": ligne["mode_paiement"],
    }
    if dry_run:
        print(f"    [dry-run] POST donateurs : {id_donateur}")
        return None
    result = api_post("donateurs", payload)
    print(f"    ✅ Donateur créé : {id_donateur} (id={result['id']})")
    return result["id"]


def inserer_don(donateur_id: int, ligne: dict, dry_run: bool) -> None:
    annee = int(ligne["date_don"][:4]) if ligne["date_don"] else None
    payload = {
        "donateur_id":   donateur_id,
        "annee":         annee,
        "date_don":      ligne["date_don"],
        "montant":       ligne["montant"],
        "mode_paiement": ligne["mode_paiement"],
        "type_don":      "Don financier",
    }
    if dry_run:
        print(f"    [dry-run] POST dons : {ligne['montant']}€ le {ligne['date_don']}")
        return
    result = api_post("dons", payload)
    print(f"    ✅ Don créé : id={result['id']}  {ligne['montant']}€  {ligne['date_don']}")


# ── Boucle principale ───────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Import dons PayAsso → Supabase")
    parser.add_argument("fichier", help="Chemin vers le fichier Excel")
    parser.add_argument("--confirmer", action="store_true",
                        help="Écriture réelle (sans ce flag : dry-run)")
    args = parser.parse_args()
    dry_run = not args.confirmer

    if dry_run:
        print("⚠️  Mode DRY-RUN — aucune écriture. Ajoutez --confirmer pour insérer.\n")

    try:
        lignes = lire_excel(args.fichier)
    except FileNotFoundError:
        print(f"❌ Fichier introuvable : {args.fichier}")
        sys.exit(1)

    print(f"📂 {len(lignes)} ligne(s) lue(s) depuis {args.fichier}\n")

    existants = api_get("donateurs", {"select": "id,id_donateur,nom,prenom,email"})

    # Compteurs pour récap
    compteurs_annee: dict[str, int] = {}
    nb_nouveaux = 0
    nb_existants_completes = 0
    nb_dons_total = 0
    nb_sautes = 0

    for i, ligne in enumerate(lignes, 1):
        nom    = ligne["nom"] or "?"
        prenom = ligne["prenom"] or "?"
        print(f"─── [{i}/{len(lignes)}] {nom} {prenom}  |  {ligne['montant']}€  {ligne['date_don']}")

        match = trouver_doublon(nom, prenom, existants)
        if match:
            ex, score = match
            print(f"  ~ Doublon probable ({score:.0%}) : {ex['id_donateur']} "
                  f"{ex.get('nom','')} {ex.get('prenom','')}  email={ex.get('email','')}")
        else:
            print("  + Aucun doublon trouvé — sera créé comme nouveau donateur")

        # Choix
        while True:
            choix = input("  G (nouveau) / I (doublon, ajouter don) / Q (arrêt) : ").strip().upper()
            if choix in ("G", "I", "Q"):
                break
            print("  → Entrée invalide, tape G, I ou Q.")

        if choix == "Q":
            nb_sautes += len(lignes) - i
            print("\n→ Arrêt demandé.")
            break

        if choix == "G":
            annee_str = (ligne["date_don"] or "")[:4]
            if annee_str not in compteurs_annee:
                compteurs_annee[annee_str] = lire_max_donateurs(annee_str)
            compteurs_annee[annee_str] += 1
            id_don = f"DON-{annee_str}-{compteurs_annee[annee_str]:04d}"

            donateur_id = inserer_donateur(ligne, id_don, dry_run)

            if not dry_run and donateur_id:
                inserer_don(donateur_id, ligne, dry_run)
                existants = api_get("donateurs", {"select": "id,id_donateur,nom,prenom,email"})
            else:
                inserer_don(-1, ligne, dry_run)

            nb_nouveaux += 1
            nb_dons_total += 1

        elif choix == "I":
            if not match:
                print("  ⚠️  Aucun doublon détecté — impossible de choisir I sans match.")
                continue
            ex, _ = match
            inserer_don(ex["id"] if not dry_run else -1, ligne, dry_run)
            nb_existants_completes += 1
            nb_dons_total += 1

        print()

    print("\n" + "=" * 50)
    print("RÉCAPITULATIF" + (" (dry-run)" if dry_run else ""))
    print("=" * 50)
    print(f"  Nouveaux donateurs créés       : {nb_nouveaux}")
    print(f"  Fiches existantes complétées   : {nb_existants_completes}")
    print(f"  Dons créés au total            : {nb_dons_total}")
    print(f"  Lignes sautées (Q)             : {nb_sautes}")


if __name__ == "__main__":
    main()
