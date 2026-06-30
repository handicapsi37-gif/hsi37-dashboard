#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Import en masse — Dashboard HSI37
Génère les IDs séquentiels à partir du max existant en base, puis insère.

Usage :
  python3 import_masse.py --table adherents --fichier nouveaux.csv
  python3 import_masse.py --table donateurs --fichier nouveaux.csv
  python3 import_masse.py --table adherents --fichier nouveaux.csv --dry-run

Format CSV adhérents (sans colonne id_adherent) :
  nom, prenom, email, telephone, date_adhesion, type_membre, saison,
  montant_cotisation, mode_paiement

Format CSV donateurs (sans colonne id_donateur) :
  nom, prenom, email, type_don, montant_don, date_don, mode_paiement
"""

import argparse
import json
import sys

import pandas as pd
import requests

try:
    from secrets_import import SUPABASE_URL, SUPABASE_SERVICE_KEY
except ImportError:
    print("❌ Fichier 'secrets_import.py' introuvable.")
    print("   Crée-le à la racine du projet avec SUPABASE_URL et SUPABASE_SERVICE_KEY.")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def api_get(table: str, params: dict) -> list:
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()


def api_post(table: str, lignes: list) -> list:
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS,
                      data=json.dumps(lignes))
    r.raise_for_status()
    return r.json()


def lire_max_adherents(saison: str) -> int:
    rows = api_get("adherents", {"select": "id_adherent", "saison": f"eq.{saison}"})
    max_num = 0
    for row in rows:
        parties = (row.get("id_adherent") or "").split("-")
        if len(parties) == 3:
            try:
                max_num = max(max_num, int(parties[2]))
            except ValueError:
                pass
    return max_num


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


def importer_adherents(df: pd.DataFrame, dry_run: bool):
    obligatoires = {"nom", "date_adhesion", "saison"}
    manquantes = obligatoires - set(df.columns)
    if manquantes:
        print(f"❌ Colonnes manquantes dans le CSV : {', '.join(manquantes)}")
        sys.exit(1)

    if "id_adherent" in df.columns:
        print("⚠️  Colonne 'id_adherent' ignorée — elle sera générée automatiquement.")
        df = df.drop(columns=["id_adherent"])

    saisons = df["saison"].astype(str).unique()
    max_par_saison = {s: lire_max_adherents(s) for s in saisons}
    compteurs = dict(max_par_saison)

    ids = []
    for _, row in df.iterrows():
        saison = str(row["saison"])
        compteurs[saison] += 1
        ids.append(f"HSI-{saison}-{compteurs[saison]:04d}")

    df = df.copy()
    df.insert(0, "id_adherent", ids)

    print(f"\n=== IMPORT ADHÉRENTS {'(dry-run)' if dry_run else ''} ===")
    for saison in saisons:
        print(f"  Max existant en base (saison {saison}) : HSI-{saison}-{max_par_saison[saison]:04d}")

    print(f"\nLignes à insérer ({len(df)}) :")
    for _, row in df.iterrows():
        print(f"  {row['id_adherent']:<18} {str(row.get('nom','')):<20} "
              f"{str(row.get('prenom','')):<15} {row.get('date_adhesion','')}")

    if dry_run:
        print("\n→ Dry-run : aucune insertion. Relancer sans --dry-run pour insérer.")
        return

    print("\n→ Insertion en cours…")
    lignes = df.where(pd.notna(df), None).to_dict(orient="records")
    try:
        api_post("adherents", lignes)
        print(f"✅ {len(lignes)} adhérent(s) insérés.")
    except requests.HTTPError as e:
        print(f"❌ Erreur Supabase : {e.response.text}")
        sys.exit(1)


def importer_donateurs(df: pd.DataFrame, dry_run: bool):
    obligatoires = {"nom", "date_don"}
    manquantes = obligatoires - set(df.columns)
    if manquantes:
        print(f"❌ Colonnes manquantes dans le CSV : {', '.join(manquantes)}")
        sys.exit(1)

    if "id_donateur" in df.columns:
        print("⚠️  Colonne 'id_donateur' ignorée — elle sera générée automatiquement.")
        df = df.drop(columns=["id_donateur"])

    df = df.copy()
    df["_annee"] = pd.to_datetime(df["date_don"]).dt.year.astype(str)
    annees = df["_annee"].unique()
    max_par_annee = {a: lire_max_donateurs(a) for a in annees}
    compteurs = dict(max_par_annee)

    ids = []
    for _, row in df.iterrows():
        annee = row["_annee"]
        compteurs[annee] += 1
        ids.append(f"DON-{annee}-{compteurs[annee]:04d}")

    df.insert(0, "id_donateur", ids)
    df = df.drop(columns=["_annee"])

    print(f"\n=== IMPORT DONATEURS {'(dry-run)' if dry_run else ''} ===")
    for annee in annees:
        print(f"  Max existant en base (année {annee}) : DON-{annee}-{max_par_annee[annee]:04d}")

    print(f"\nLignes à insérer ({len(df)}) :")
    for _, row in df.iterrows():
        print(f"  {row['id_donateur']:<18} {str(row.get('nom','')):<20} "
              f"{str(row.get('prenom','')):<15} {row.get('date_don','')}")

    if dry_run:
        print("\n→ Dry-run : aucune insertion. Relancer sans --dry-run pour insérer.")
        return

    print("\n→ Insertion en cours…")
    lignes = df.where(pd.notna(df), None).to_dict(orient="records")
    try:
        api_post("donateurs", lignes)
        print(f"✅ {len(lignes)} donateur(s) insérés.")
    except requests.HTTPError as e:
        print(f"❌ Erreur Supabase : {e.response.text}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Import en masse HSI37 avec IDs séquentiels")
    parser.add_argument("--table", required=True, choices=["adherents", "donateurs"],
                        help="Table cible")
    parser.add_argument("--fichier", required=True,
                        help="Chemin vers le fichier CSV")
    parser.add_argument("--dry-run", action="store_true",
                        help="Simulation : affiche les IDs générés sans insérer")
    args = parser.parse_args()

    try:
        df = pd.read_csv(args.fichier, dtype=str, keep_default_na=False)
        df = df.replace("", None)
    except FileNotFoundError:
        print(f"❌ Fichier introuvable : {args.fichier}")
        sys.exit(1)

    print(f"📂 Fichier chargé : {args.fichier} ({len(df)} ligne(s))")

    if args.table == "adherents":
        importer_adherents(df, args.dry_run)
    else:
        importer_donateurs(df, args.dry_run)


if __name__ == "__main__":
    main()
