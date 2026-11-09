#!/usr/bin/env python3
"""
Fetch and parse live Serie A injuries, suspensions, and bookings from Fantacalcio.it
and save to mobile/injuries-data.json.
"""

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from bs4 import BeautifulSoup

URL = "https://www.fantacalcio.it/indisponibili-serie-a"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
}

def infer_role(text):
    t = text.lower()
    if re.search(r'\b(portiere|difensore|terzino|centrale|cursore|libero)\b', t):
        return "Difesa"
    elif re.search(r'\b(attaccante|punta|ala|centravanti|bomber|fantasista|seconda punta)\b', t):
        return "Attacco"
    elif re.search(r'\b(centrocampista|mediano|regista|trequartista|mezzala|esterno)\b', t):
        return "Centrocampo"
    return "Altro"

def fetch_injuries():
    req = urllib.request.Request(URL, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"Error fetching {URL}: {e}", file=sys.stderr)
        return None

    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select(".card.team-card")
    if not cards:
        print("Warning: no .team-card elements found, attempting fallback selector", file=sys.stderr)
        cards = [c for c in soup.select("[id^='team-']") if c.get("id") != "team-menu"]

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    result = {
        "source": "Fantacalcio.it (bollettino medico ufficiale Serie A)",
        "last_updated": now_iso,
        "league": "Serie A",
        "teams": {}
    }

    for card in cards:
        team_name_el = card.select_one(".team-name")
        if not team_name_el:
            img = card.find("img", title=True)
            if img:
                team_name = img.get("title").replace("Stemma ", "").strip()
            else:
                continue
        else:
            team_name = team_name_el.get_text(strip=True)

        cols = card.select(".row.row-responsive > .col")
        infortunati = []
        squalificati = []
        diffidati = []

        for col in cols:
            header_text = col.get_text(strip=True).lower()
            cat = "infortunati"
            if "squalificati" in header_text:
                cat = "squalificati"
            elif "diffidati" in header_text:
                cat = "diffidati"

            items = col.select("ul.unstyled > li")
            for li in items:
                name_el = li.select_one(".item-name")
                desc_el = li.select_one(".item-description p")
                if not name_el:
                    continue
                name = name_el.get_text(strip=True)
                desc = desc_el.get_text(strip=True) if desc_el else ""
                role = infer_role(desc)

                entry = {
                    "player": name,
                    "detail": desc,
                    "role": role
                }

                if cat == "infortunati":
                    infortunati.append(entry)
                elif cat == "squalificati":
                    squalificati.append(entry)
                elif cat == "diffidati":
                    diffidati.append(entry)

        totale_assenze = len(infortunati) + len(squalificati)
        attacco = sum(1 for p in infortunati + squalificati if p["role"] == "Attacco")
        difesa = sum(1 for p in infortunati + squalificati if p["role"] == "Difesa")

        result["teams"][team_name] = {
            "team": team_name,
            "totale_assenze": totale_assenze,
            "assenze_attacco": attacco,
            "assenze_difesa": difesa,
            "infortunati": infortunati,
            "squalificati": squalificati,
            "diffidati": diffidati,
            "summary": f"{len(infortunati)} infortunati, {len(squalificati)} squalificati" if totale_assenze > 0 else "Nessuna assenza segnalata"
        }

    return result

def main():
    data = fetch_injuries()
    if not data or not data["teams"]:
        print("Failed to extract injuries data.", file=sys.stderr)
        sys.exit(1)

    target_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "injuries-data.json")
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Successfully saved {len(data['teams'])} teams to {target_path}")

if __name__ == "__main__":
    main()
