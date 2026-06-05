# 🎣 Fiskeguru

Kalkulator for **beste slukvalg** ut fra forholdene akkurat nå. Velg lokasjon på
kart, velg ønsket fiskeart, og få en rangert agn-anbefaling med begrunnelse –
basert på sanntids vær- og lysforhold kombinert med praktisk og teoretisk
fiskekunnskap.

![status](https://img.shields.io/badge/tester-10%20passerer-brightgreen)

## Hva den gjør

1. **🗺️ Velg lokasjon** – klikk i kartet (Leaflet/OpenStreetMap) eller bruk GPS.
2. **🌤️ Sanntidsforhold** – henter vær fra [MET Norway (met.no)](https://api.met.no):
   lufttemperatur, skydekke, vind, lufttrykk + trykktrend og nedbør. Sol- og
   lysforhold (solhøyde, soloppgang/-nedgang, gylden time, midnattssol/mørketid)
   beregnes lokalt.
3. **🐟 Velg art** – 12 vanlige norske ferskvanns- og saltvannsarter.
4. **🧠 Anbefaling** – en **aktivitetsindeks (0–100)** for hvor gode forholdene er,
   pluss de 4 beste agnene med foreslått **størrelse, farge, dybde og innspinningsfart**
   – og en forklaring på *hvorfor*.

## Kunnskapen bak

Anbefalingsmotoren er regelbasert og forklarbar. Den vekter blant annet:

| Faktor | Hvordan det påvirker |
|--------|----------------------|
| **Vanntemperatur** | Hver art har et optimalt vindu; kaldt vann → dypere, saktere fiske og kaldtvannsagn (jigg/pilk). Estimeres fra lufttemp + sesong hvis ikke målt. |
| **Lys / tid på døgnet** | Gryning og skumring («gylden time») er rovfiskens beste matvindu. Lyssky arter favoriserer dempet lys; synsjegere liker dagslys. |
| **Skydekke** | Overskyet demper lyset og gjør fisken modigere. |
| **Lufttrykk + trend** | Fallende trykk før en front trigger ofte eting; stigende trykk gir treg fisk. |
| **Vind** | Litt krusning skjuler fiskeren og aktiverer byttefisk; for mye vind gir krevende forhold. |
| **Nedbør** | Lett regn gir ofte godt bett; kraftig regn kan grumse vannet. |
| **Sesong** | Hver art har en hovedsesong. |
| **Vannklarhet** | Styrer fargevalg (naturlig/sølv i klart vann, kontrast/signalfarger i grumsete) og agn-action. |

Artsprofiler ligger i [`src/engine/species.js`](src/engine/species.js),
agnkatalog i [`src/engine/lures.js`](src/engine/lures.js), og selve scoringen i
[`src/engine/recommend.js`](src/engine/recommend.js).

> Anbefalingene er veiledende. Lokalkunnskap og erfaring slår alltid en kalkulator. 🐟

## Kjøre lokalt

```bash
npm install
npm start          # → http://localhost:3000
```

Utvikling med auto-restart: `npm run dev`. Kjør testene: `npm test`.

### Konfigurasjon

| Miljøvariabel | Default | Beskrivelse |
|---------------|---------|-------------|
| `PORT` | `3000` | Port serveren lytter på. |
| `MET_USER_AGENT` | `Fiskeguru/1.0 …` | met.no krever en identifiserende User-Agent. Sett gjerne din egen med kontakt-e-post. |

## Arkitektur

```
server.js              Express: serverer frontend + API, proxy mot met.no
src/engine/
  solar.js             Sol-/lysberegning (lokalt, ingen API)
  species.js           Artsprofiler (norsk fiskekunnskap)
  lures.js             Agnkatalog + fargeregler
  recommend.js         Anbefalingsmotor (aktivitetsindeks + agn-scoring)
public/                Frontend (kart, skjema, resultat)
test/                  Tester (node:test)
```

### API

- `GET /api/species` – liste over arter.
- `GET /api/conditions?lat=&lon=` – vær + lysforhold for posisjonen.
- `POST /api/recommend` – `{ species, lat, lon, waterTemp?, waterClarity?, override? }`
  → aktivitetsindeks + rangerte agn. Faller tilbake på manuelle verdier hvis
  met.no ikke er tilgjengelig.

## Lisens

MIT
