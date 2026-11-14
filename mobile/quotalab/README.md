# QuotaLab — Football Decision Engine

QuotaLab è un ambiente indipendente, mobile-first, per analisi pre-partita, confronto delle quote e gestione delle schedine. È una nuova implementazione: non importa codice applicativo o dipendenze runtime da MatchMind.

## Funzioni incluse nella versione 0.1

- Import CSV di risultati conclusi; supporta header normalizzati e header comuni di football-data.co.uk (**Date, Div, HomeTeam, AwayTeam, FTHG, FTAG**).
- Controllo rigoroso della data: una stima usa solo partite precedenti alla data dell'evento. Le partite giocate nella stessa data sono escluse.
- Gate dati: almeno 20 partite nella competizione, 5 presenze per squadra e 3 partite nel rispettivo contesto casa/trasferta. Dati insufficienti = nessuna previsione.
- Stima xG trasparente con medie casa/trasferta, smoothing e decadimento temporale; distribuzione Poisson indipendente e matrice dei punteggi.
- Mercati: 1X2, doppia chance, Over/Under 1.5/2.5/3.5, Gol/No Gol e combinazioni 1X2 + Over/Under 2.5 o BTTS calcolate con probabilità congiunte dalla matrice.
- Quote inserite manualmente; overround e probabilità de-vig solo per mercati completi; quota equa, edge e valore atteso.
- Costruttore con filtro vincolante della famiglia di mercato e soglia EV. Le selezioni senza quota valida, campione o margine sufficiente sono escluse.
- Schedina modificabile, una selezione per partita, archivio, registrazione manuale degli esiti e backup JSON.
- PWA installabile con shell offline. I dati restano nel local storage del browser.

## Avvio locale

Serve un server statico locale: i moduli JavaScript non funzionano in modo affidabile aprendo il file direttamente da file://.

```bash
python3 -m http.server 8000 --directory mobile/quotalab
```

Apri http://localhost:8000.

Test del motore (Node.js 20+):

```bash
node --test mobile/quotalab/tests/engine.test.mjs
```

## Formato CSV minimo

```csv
date,competition,home,away,home_goals,away_goals
2025-01-01,serie-a,Inter,Atalanta,2,0
2025-01-02,serie-a,Roma,Lazio,1,1
```

Le righe qui sopra descrivono il formato e non sono dati inclusi nel prodotto.

## Limiti da dichiarare

Questa versione è un baseline trasparente: non è un modello AI addestrato, calibrato o validato come strategia di scommessa. Non importa fixture live, infortuni confermati, formazioni, statistiche giocatori, quote storiche o closing odds. Non include ancora calibrazione, correzione Dixon–Coles, report walk-forward, monitoraggio del modello o integrazione verificata con Sisal.

Le quote sono manuali. Non vengono piazzate o trasmesse scommesse. Gli esiti si registrano manualmente. La probabilità congiunta di selezioni su partite diverse è il prodotto delle probabilità marginali e assume indipendenza, non verificata.

## Dati e privacy

Non servono chiavi API. Non sono presenti analytics o tracker di terze parti. I dati sono salvati nel browser corrente: cancellazione dei dati del sito o cambio dispositivo/browser può far perdere lo workspace. Esporta backup JSON regolarmente. I dati importati restano soggetti alle licenze e ai termini delle fonti originarie.
