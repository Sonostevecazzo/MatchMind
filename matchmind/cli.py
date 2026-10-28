"""CLI for illustrative analysis and provider synchronisation."""
import argparse
import json
import os
from .model import forecast_markets, market_dict
from .storage import MatchMindStore
from .sync import MatchMindSync, active_season_year
from .providers.api_football import ProviderError


def main():
    parser = argparse.ArgumentParser(prog="matchmind")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("demo", help="run an illustrative statistical example")
    analyse = sub.add_parser("analyse", help="calculate probabilities from supplied expected goals")
    analyse.add_argument("--home-xg", type=float, required=True)
    analyse.add_argument("--away-xg", type=float, required=True)
    sync = sub.add_parser("sync", help="download licensed provider data into the SQLite database")
    sync.add_argument("--league", type=int, default=135)
    sync.add_argument("--season", type=int, default=active_season_year())
    sync.add_argument("--data", choices=("all", "fixtures", "injuries", "odds", "players"), default="all")
    sync.add_argument("--team", type=int, help="team ID (required with --data players)")
    sync.add_argument("--date-from")
    sync.add_argument("--date-to")
    args = parser.parse_args()
    if args.command in {"demo", "analyse"}:
        home_xg, away_xg = (1.5, 1.1) if args.command == "demo" else (args.home_xg, args.away_xg)
        print(json.dumps({"mode": "illustrative_statistical_baseline", "live_data": False,
            "trained_ai": False, "home_xg": home_xg, "away_xg": away_xg,
            "markets": market_dict(forecast_markets(home_xg, away_xg))}, indent=2, ensure_ascii=False))
        return
    if args.data == "players" and not args.team:
        parser.error("--team is required when --data players is selected")
    try:
        store = MatchMindStore()
        with MatchMindSync(store=store) as service:
            if args.data == "fixtures":
                result = service.fixtures(args.league, args.season, date_from=args.date_from, date_to=args.date_to)
            elif args.data == "injuries":
                result = service.injuries(args.league, args.season)
            elif args.data == "odds":
                result = service.odds(args.league, args.season)
            elif args.data == "players":
                result = service.players(args.league, args.season, args.team)
            else:
                result = service.all(args.league, args.season)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ProviderError, ValueError) as exc:
        parser.exit(2, f"MatchMind sync error: {exc}\n")

if __name__ == "__main__":
    main()