# Adminisztráció, naplózás, archívum és költség

## Navigáció és hozzáférés

A `/admin` a Google által ellenőrzött tulajdonosi fióknak érhető el. Az alkalmazás felső sávja csak ennek a fióknak mutatja az Adminisztráció menüpontot. Asztali nézetben csoportosított oldalsáv, mobilon címkézett oldalválasztó vezeti a használatot.

| Csoport | Nézetek |
| --- | --- |
| Áttekintés | Összesítések, látogatottság, AI-használat és költség |
| Napi kezelés | AI-válaszok, étkezések, felhasználók, feldolgozások, működési napló |
| Beállítások és előzmények | Konfiguráció és adminmódosítások naplója |

A szűrők a hash-alapú útvonalban szerepelnek, például `#jobs?state=failed`. A szűrőtörlés az adott nézet alapállapotára visz vissza. A széles és hosszú táblázatok saját görgetést, rögzített fejlécet kapnak. A grafikonok mögött táblázatos adatok is megnyithatók.

## Tartós beállítások

A beállítások az `app_settings` egyetlen rekordjában, revízióval tárolódnak. A mentés teljes validált mezőkészletet és aktuális revíziót kér; ütközésnél a szerver nem írja felül észrevétlenül a másik módosítást. A módosítás auditbejegyzést hoz létre.

- **Hozzáférés és adatgyűjtés:** új regisztráció, új elemzés, látogatásmérés.
- **Használati korlátok:** órás/napi elemzési kvóta, új fiókok alapértelmezett energiakerete.
- **AI-elemzés:** támogatott modellazonosító, válasz tokenkorlátja, várakozási idő.

A kapcsolók nem mind visszamenőlegesek. A regisztráció tiltása mellett a meglévő fiókok továbbra is beléphetnek. Az új alapértelmezett energiakeret nem írja át minden régi felhasználó keretét. A futó AI-kérés nem szakad meg automatikusan attól, hogy közben megváltozik egy adminbeállítás.

A Google-, adatbázis- és szolgáltatói titkok nem ezekben a mezőkben szerkeszthetők: Northflank runtime secretként kezelendők. A konfiguráltsági jelzés csak az elvárt beállítás jelenlétét mutatja; nem bizonyítja a kulcs érvényességét vagy a szolgáltatói keret meglétét.

## Három külön megfigyelhetőségi réteg

| Réteg | Tartalom | Mire nem elég? |
| --- | --- | --- |
| Konténer stdout/stderr | Indulás, leállás, runtime- és adatbázishibák rövid diagnosztikája | Nem teljes étkezési eseménytörténet |
| `app_logs` | Strukturált esemény: szint, kategória, eseménykód, üzenet, idő | Nem teljes HTTP access log |
| `admin_audit` | Adminisztrátori módosítás, szereplő, cél és részletek | Nem AI-pontossági mérés |

A normális indulási INFO-sor vagy a telepítés közbeni 0-s folyamatkilépés önmagában nem hiba. Az `analysis.completed` azt jelenti, hogy ellenőrizhető eredmény készült; nem igazolja annak táplálkozástani pontosságát. Az `analysis.interrupted` megszakadt feldolgozást, a `recognition.fallback` kihagyott Food-R1 segédet jelezhet, miközben az OpenCode-elemzés még sikerülhet.

## AI-válaszarchívum

Az `ai_requests` hívásonként tárol modellt, állapotot, HTTP-státuszt, késleltetést, tokenhasználatot és árazási pillanatképet. A bővített mezők: `request_meta`, `response_text`, `response_meta`, `response_truncated`, `result_analysis`, `reviewed_analysis`, `reviewed_at`, `reviewed_revision`.

Az adminban a Food-R1 és a hozzá tartozó OpenCode-válasz kereshető, egymás mellett összevethető és JSON-ként exportálható. A nyers szöveg HTML-ként nem fut le. Hibás vagy csonka válasz is diagnosztikai alap maradhat. A legutóbbi felhasználói jóváhagyás nem teljes szerkesztési verziótörténet és nem leméréssel igazolt ground truth.

Az archiválás szűri a konfigurációban ismert titkokat, a tipikus tokenmezőket és a képadatot. A belső gondolatmenet nem kerül a megjelenített válaszszövegbe. A megőrzésről és a méretkorlátokról az [adatvédelmi fejezet](privacy.md) ír részletesen.

## Tokenalapú költségbecslés

```text
USD = ((input − cached) × input_rate
       + cached × cached_rate
       + (output + thoughts) × output_rate) / 1 000 000
```

A cached token az input részhalmaza, ezért a normál bemeneti részből le kell vonni. A gondolkodási token a szolgáltatói kimeneti számlálás külön mezője. A hiányos vagy ellentmondó használati adat költsége `null`, nem nulla. A díjszabás a híváskor elmentett pillanatkép; az ismeretlen modellhez vagy régi időszakhoz nem készül kitalált ár.

A kód 2026. november 9-i Gemini 3.8 Flash-pillanatképe 1,50 USD normál bemenetet, 0,15 USD cache-bemenetet és 7,50 USD kimenetet használ millió tokenenként. Ezek a beégetett számítási adatok, nem örök érvényű árígéretek; változáskor a `modelPricing()` és a forrásellenőrzés frissítendő.

## Modal-erőforrás és belső keret

A Modal-becslés a rögzített L40S + 2 CPU + 16 GiB konfiguráció modellbetöltési és elemzési másodperceiből számol. A gateway, platformindulás és más kimaradó erőforrásrészek miatt ez **részösszeg**, nem a Modal-számla teljes másolata.

A belső havi segédkeret alapértéke 15 USD. Függő vagy ismeretlen költségű hívásra 90 másodpercnyi erőforrást tart fenn, és adatbáziszár védi a párhuzamos foglalásokat. A keret elérésekor a segéd kihagyható, az OpenCode tovább működik. A havi fiókkredit és ez a belső keret külön fogalom; a keret más alkalmazást vagy közvetlen Modal-hívást nem fog meg.

A nulla minimum és egyszer használatos konténer kérésmentes GPU-üresjáratot céloz. A 2026. november 10-i ellenőrzéskor a kb. 16,35 GiB modellkötet a szolgáltatói ingyenes tárhelykeretbe fért. Más hívás, nagyobb tárhely vagy eltérő díjszabás megváltoztatja a költséget; a végső számlázási bizonyíték mindig a szolgáltató kimutatása.

Források: [admin API](https://github.com/ak91hu/yumetrics/blob/main/lib/admin.mjs), [telemetria és árképlet](https://github.com/ak91hu/yumetrics/blob/main/lib/telemetry.mjs), [részletes költségjegyzet](https://github.com/ak91hu/yumetrics/blob/main/docs/AI-COSTS.md), [OpenCode árazási forrás](https://opencode.ai/docs/console/models/#pricing).
