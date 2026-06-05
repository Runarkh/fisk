# 🎣 Fiskeguru

Kalkulator for **beste slukvalg** ut fra forholdene akkurat nå. Velg lokasjon på
kart, velg ønsket fiskeart, og få en rangert agn-anbefaling med begrunnelse –
basert på sanntids vær- og lysforhold kombinert med praktisk og teoretisk
fiskekunnskap.

![status](https://img.shields.io/badge/tester-10%20passerer-brightgreen)

## Hva den gjør

1. **🗺️ Velg lokasjon** – klikk i kartet (Leaflet/OpenStreetMap) eller bruk GPS.
2. **🌊 Vanntype** – appen slår opp i OpenStreetMap (Overpass) hva slags vann du
   trykket på og viser hva som finnes i området: **innsjø, elv/bekk, fjord/kystsjø,
   åpent hav** eller **brakkvann** (elvemunning) – og om det er **ferskvann,
   saltvann eller brakkvann**. Artslista filtreres til arter som faktisk hører
   hjemme der.
3. **🌤️ Sanntidsforhold** – henter vær fra [MET Norway (met.no)](https://api.met.no):
   lufttemperatur, skydekke, vind, lufttrykk + trykktrend og nedbør. Sol- og
   lysforhold (solhøyde, soloppgang/-nedgang, gylden time, midnattssol/mørketid)
   beregnes lokalt.
4. **🐟 Velg art** – 12 vanlige norske ferskvanns- og saltvannsarter.
5. **🧠 Anbefaling** – en **aktivitetsindeks (0–100)** for hvor gode forholdene er,
   pluss de 4 beste agnene (score 0–100) med foreslått **størrelse, farge, dybde og
   innspinningsfart**, en forklaring på *hvorfor*, og **tips & triks** – både
   generelle, art-spesifikke og tilpasset forholdene og vanntypen.

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
| **Vanntype / salinitet** | Ferskvann, saltvann og brakkvann har ulike arter. Velger du en art som ikke hører hjemme i vannet (f.eks. gjedde i åpent hav), nedjusteres indeksen kraftig og du får en advarsel. Brakkvann gir egne tips om elvemunning og tidevann. |

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

Serveren binder `0.0.0.0` som standard og skriver ut alle adressene den er nåbar
på ved oppstart – inkludert lokalnett og Tailscale.

### Bruk med Tailscale 🔒

Vil du nå Fiskeguru fra alle enhetene dine (f.eks. mobilen ved vannet)?

**Enkelt (HTTP, over Tailscale-IP):**
```bash
npm start
```
Serveren skriver ut Tailscale-adressen, f.eks. `http://100.x.y.z:3000`. Åpne den
fra en hvilken som helst enhet på tailnettet ditt.

**Best (HTTPS via Tailscale Serve):**
```bash
npm run tailscale
```
Dette setter opp `tailscale serve` og gir deg en ekte HTTPS-adresse
(`https://<maskin>.<tailnet>.ts.net/`). HTTPS er en *sikker kontekst*, så
**GPS-posisjon på mobil og live vær/vanntype fungerer fullt ut** – noe `file://`
og rå HTTP ikke alltid tillater.

> Krever at Tailscale er installert og `tailscale up` er kjørt på maskinen.
> Vil du i tillegg dele utenfor tailnettet, kan du bruke `tailscale funnel ${PORT}`
> (krever at Funnel er aktivert for tailnettet).

### Konfigurasjon

| Miljøvariabel | Default | Beskrivelse |
|---------------|---------|-------------|
| `PORT` | `3000` | Port serveren lytter på. |
| `HOST` | `0.0.0.0` | Nettverksgrensesnitt å binde til. Sett `127.0.0.1` for kun lokalt. |
| `MET_USER_AGENT` | `Fiskeguru/1.0 …` | met.no krever en identifiserende User-Agent. Sett gjerne din egen med kontakt-e-post. |

## Arkitektur

```
server.js              Express: serverer frontend + API, proxy mot met.no + Overpass
src/engine/
  solar.js             Sol-/lysberegning (lokalt, ingen API)
  water.js             Vann-/områdeklassifisering (innsjø/elv/fjord/hav/brakkvann)
  species.js           Artsprofiler m/ salinitet, habitat og tips (norsk fiskekunnskap)
  lures.js             Agnkatalog + fargeregler
  recommend.js         Anbefalingsmotor (aktivitetsindeks + agn-scoring + tips)
public/                Frontend (kart, område, skjema, resultat)
test/                  Tester (node:test) – 23 stk
```

### API

- `GET /api/species` – liste over arter (med salinitet og habitat).
- `GET /api/area?lat=&lon=` – klassifiserer vannet (ferskvann/saltvann/brakkvann,
  innsjø/elv/fjord/hav) via OpenStreetMap, og hvilke arter som passer der.
- `GET /api/conditions?lat=&lon=` – vær + lysforhold for posisjonen.
- `POST /api/recommend` – `{ species, lat, lon, salinity?, waterType?, waterTemp?, waterClarity?, override? }`
  → aktivitetsindeks + rangerte agn + tips. Faller tilbake på manuelle verdier hvis
  met.no/Overpass ikke er tilgjengelig.

> Vanntype-oppslaget bruker [Overpass API](https://overpass-api.de) (OpenStreetMap).
> Svar caches i 24 t for å være snill mot tjenesten.

## Lisens

MIT
