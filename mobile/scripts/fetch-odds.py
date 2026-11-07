# Fetch and convert Serie A & Serie B odds from football-data.co.uk
from __future__ import annotations
import urllib.request, csv, io, json, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent # points to mobile/
OUTPUT_FILE = ROOT / 'fixtures-odds.json'

URL = 'https://www.football-data.co.uk/fixtures.csv'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; MatchMindOddsBot/1.0; +https://sonostevecazzo.github.io/MatchMind/)'}

def to_float(val):
    if not val: return None
    try:
        f = float(str(val).strip())
        return round(f, 2) if f > 1.0 else None
    except:
        return None

def main():
    print(f'Fetching odds from {URL}...')
    req = urllib.request.Request(URL, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            content = resp.read().decode('utf-8-sig', errors='ignore')
    except Exception as e:
        print(f'Error fetching {URL}: {e}')
        sys.exit(1)

    reader = csv.DictReader(io.StringIO(content))
    matches = []

    for r in reader:
        div = r.get('Div')
        if div not in ('I1', 'I2'):
            continue
        
        d_raw = r.get('Date', '').strip()
        parts = d_raw.split('/')
        iso_date = f'{parts[2]}-{parts[1]}-{parts[0]}' if len(parts) == 3 else d_raw

        comp = 'serie-a' if div == 'I1' else 'serie-b'
        home = r.get('HomeTeam', '').strip()
        away = r.get('AwayTeam', '').strip()
        time_str = r.get('Time', '').strip()

        b365_1 = to_float(r.get('B365H'))
        b365_x = to_float(r.get('B365D'))
        b365_2 = to_float(r.get('B365A'))
        avg_1 = to_float(r.get('AvgH'))
        avg_x = to_float(r.get('AvgD'))
        avg_2 = to_float(r.get('AvgA'))
        max_1 = to_float(r.get('MaxH'))
        max_x = to_float(r.get('MaxD'))
        max_2 = to_float(r.get('MaxA'))

        b365_o25 = to_float(r.get('B365>2.5'))
        b365_u25 = to_float(r.get('B365<2.5'))
        avg_o25 = to_float(r.get('Avg>2.5'))
        avg_u25 = to_float(r.get('Avg<2.5'))

        odds = {
            'bookmaker': 'Bet365 / Media',
            'home': b365_1 or avg_1,
            'draw': b365_x or avg_x,
            'away': b365_2 or avg_2,
            'over25': b365_o25 or avg_o25,
            'under25': b365_u25 or avg_u25,
            'details': {
                'b365': {'home': b365_1, 'draw': b365_x, 'away': b365_2, 'over25': b365_o25, 'under25': b365_u25},
                'avg': {'home': avg_1, 'draw': avg_x, 'away': avg_2, 'over25': avg_o25, 'under25': avg_u25},
                'max': {'home': max_1, 'draw': max_x, 'away': max_2}
            }
        }

        matches.append({
            'division': div,
            'competition': comp,
            'date': iso_date,
            'time': time_str,
            'home': home,
            'away': away,
            'odds': odds
        })

    payload = {
        'updatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'source': 'football-data.co.uk',
        'leagues': ['Serie A (I1)', 'Serie B (I2)'],
        'count': len(matches),
        'matches': matches
    }

    OUTPUT_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'Successfully wrote {len(matches)} fixtures with odds to {OUTPUT_FILE}')

if __name__ == '__main__':
    main()
