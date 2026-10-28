import argparse, json
from .model import forecast_markets, market_dict

def main():
    parser=argparse.ArgumentParser(prog="matchmind")
    sub=parser.add_subparsers(dest="command",required=True)
    sub.add_parser("demo")
    analyse=sub.add_parser("analyse")
    analyse.add_argument("--home-xg",type=float,required=True)
    analyse.add_argument("--away-xg",type=float,required=True)
    args=parser.parse_args()
    home_xg,away_xg=(1.5,1.1) if args.command=="demo" else (args.home_xg,args.away_xg)
    print(json.dumps({"mode":"illustrative_statistical_baseline","live_data":False,
      "trained_ai":False,"home_xg":home_xg,"away_xg":away_xg,
      "markets":market_dict(forecast_markets(home_xg,away_xg))},indent=2,ensure_ascii=False))

if __name__=="__main__": main()
