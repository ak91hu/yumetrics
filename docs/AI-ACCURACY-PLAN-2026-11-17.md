# Pontosabb AI-becslés: vizsgálat és megvalósítási terv

Dátum: 2026-11-17. Állapot: **terv, még semmi nincs megvalósítva.** A vizsgálat során kód nem módosult, fizetős AI-hívás nem indult. A vizsgált állapot: `food-v22-required-nutrient-fallback` prompt, `gemini-3.5-flash-lite` alapmodell, MINIMAL gondolkodás, 1600 tokenes kimeneti keret.

Cél: a képen látható étel **összetevőinek és mennyiségének** minél pontosabb meghatározása.

## 1. Összefoglaló

- A pontosságot ma nem az ételfelismerés, hanem a **mennyiségbecslés** korlátozza. A korábbi mérésekben az ételnevek többnyire megfelelőnek tűntek, a grammok viszont nagyot tévedtek.
- Az **élesben futó beállításnak nincs pontosságmérése.** A Flash Lite + MINIMAL gondolkodás + 1600 token költségből lett kiválasztva (`docs/technical/ai.md`), nem mért pontosságból.
- A kódban több olyan hiányosság van, amely **hívásköltség növelése nélkül** javítható: a tányérátmérő nincs felhasználva, a séma mezősorrendje kedvezőtlen, és nincs hely a mennyiségi levezetésnek.
- Az egyetlen beavatkozás, amelynek **mért** hatása van, a fizikai mennyiségi információ (ismert össztömeg). Ezért a skála és a tömeg bevitele a legfontosabb irány.

## 2. Mit mutatnak a meglévő mérések

| Beállítás | Átlagos abszolút kcal-hiba, tömegadat nélkül | Átlagos abszolút kcal-hiba, ismert össztömeggel | Átlagos abszolút tömeghiba | Forrás |
|---|---:|---:|---:|---|
| Gemini 4 Argon, v13, 10 000 token (n=4) | 96,36 kcal | 52,07 kcal | n. a. | `AI-EFFICIENCY-2026-11-09.md` |
| Gemini 3.8 Flash, v14, 10 000 token (n=4) | 88,48 kcal | 52,12 kcal | n. a. | `AI-EFFICIENCY-2026-11-09.md` |
| Food-R1 + Haiku 5.5, adaptive/high, 4096 token (n=3 menthető a 4-ből) | 134,05 kcal | nem mért | 210,33 g | `FOOD-R1-HAIKU-LIVE-2026-11-13.md` |
| **Éles: Flash Lite, MINIMAL, 1600 token, v22** | **nincs mérés** | **nincs mérés** | **nincs mérés** | — |

Értelmezés és korlátok:

- Minden mérés négy Nutrition5k-tányéron készült (kaliforniai menzaétel). Ezek feltáró minták: nem igazolnak általános pontossági százalékot, és a magyar konyháról semmit nem mondanak.
- A sorok nem ugyanazokon a tányérokon készültek, ezért a modellek közötti rangsor ebből nem állapítható meg. A Haiku-sor például nem bizonyítja, hogy a Haiku rosszabb a Geminél.
- Az ismert össztömeg a 3.8 Flash-mérésben 88-ról 52 kcal-ra csökkentette az átlagos hibát (kb. 40%).
- A Haiku-próbában a tömeg két tányéron kb. kétszeres túlbecslés (215 g helyett 440 g; 271 g helyett 465 g), egyen kb. feles alulbecslés (457 g helyett 245 g) volt, helyesnek tűnő ételnevek mellett.
- Visszatérő konkrét hibák: sűrű, részben takart összetevő alulbecslése (205 g csirke helyett 125–130 g), hasonló külsejű ételek összetévesztése (reszelt burgonya ↔ káposzta).

## 3. Feltárt hiányosságok a jelenlegi megoldásban

### 3.1. A tányérátmérő nincs felhasználva

- A felület bekéri (`#context-diameter`, `public/app.mjs:248`), a szerver ellenőrzi (`lib/domain.mjs:125`, 5–60 cm), és a `plateDiameterCm` bekerül a modellnek küldött `context` objektumba.
- A promptban (`lib/providers.mjs:45–57`) a `plateDiameterCm` egyszer sem szerepel. A PORTIONS rész ehelyett ezt mondja: „Do not assume plate size" (`lib/providers.mjs:50`).
- Következmény: a felhasználó által megadott egyetlen fizikai skála úgy érkezik a modellhez, hogy nincs utasítás a használatára. Hogy a modell magától figyelembe veszi-e, azt nem mértük.

### 3.2. A séma mezősorrendje kedvezőtlen

- Az összetevő sémájában a `nutrients` az első mező (`lib/providers.mjs:36`), a `name` és a `grams` csak utána következik.
- Az archivált Haiku-válasz ezt a sorrendet követi: `{"nutrients":{"calories":35,…},"name":"Sárgarépa","grams":110,…` (`outputs/food-r1-haiku-thinking-live-2026-11-13-schema2.json`). A Gemini-útvonal ugyanazt a sémát kapja; ott a kimeneti sorrendet archivált válaszon még ellenőrizni kell.
- A modell tehát előbb írja le a 100 g-ra vonatkozó tápértéket, mint hogy megnevezné az ételt és eldöntené az elkészítési állapotát. A legfelső szinten a `confidence` és az `assumptions` is az `ingredients` előtt áll, vagyis a modell az önértékelést a leltár előtt adja meg.

### 3.3. Nincs hely a mennyiségi levezetésnek

- MINIMAL gondolkodás mellett a modell közvetlenül grammot ír. A sémában nincs olyan mező, ahol a látott méretet, darabszámot vagy térfogatot rögzíthetné, mielőtt tömeget mond.
- A `FOOD-PIPELINE-RESEARCH-2026-11-13.md` által idézett kutatás szerint a részletesebb becslési lépések hatása modellfüggő (Tanabe és Yanai, 2025), ezért ez mérendő hipotézis, nem biztos javítás.

### 3.4. Az adatbázis-egyeztetés csak pontos szóegyezést fogad el

- Az `exactFood` (`lib/free-food-data.mjs:20`) akkor ad találatot, ha a modell `lookupQuery` kifejezésének normalizált szókészlete pontosan megegyezik egyetlen adatbázis-leírással.
- Az USDA-leírások jellemzően hosszú, vesszővel tagolt alakok, ezért a modell szabadon fogalmazott kifejezése várhatóan ritkán egyezik. Ilyenkor a tápérték a modell saját tartalékbecslése (`sourceType: 'ai'`).
- A tényleges találati arányt **nem mértük**. Az éles `usage.foodData.evidence` naplóból (`matched` / `no_verified_match` / `provisional_identity`) kiolvasható.
- A szigorúság szándékos döntés volt (nincs vak tápértékátlagolás, nincs nyers/főtt csere). Ezt a védelmet a lazításnál meg kell tartani.

### 3.5. A darabszámos adagátváltás ritkán érvényesül

- A `portionFromRecord` (`lib/free-food-data.mjs:206`) pontos egyezést kér a mértéknévre (pl. „slice"), pontosan egy illeszkedő adagot fogad el, és csak sikeres adatbázis-találat után fut.
- A 3.4. pont miatt ez a lánc ritkán jut el idáig.

### 3.6. A felhasználói javítások nem hasznosulnak

- A `meals` táblában megvan az eredeti AI-válasz (`original_analysis`) és a felhasználó által jóváhagyott változat (`analysis`) is (`lib/jobs.mjs:91`, `lib/api.mjs:153`).
- Ebből jelenleg sem hibastatisztika, sem felhasználónkénti adagminta nem készül.

### 3.7. A képfelbontás csökkentése nem volt pontosságra mérve

- Az első kép hosszabb oldala legfeljebb 1600 px, a másodiké 2048 px, JPEG 0,92 (`public/photo-preparation.mjs`).
- A nov. 9-i mérések még csökkentés nélküli felbontással készültek. A csökkentés hatását a felismerésre és adagbecslésre nem vizsgáltuk.

## 4. Megvalósítási lépések

A sorrend javasolt végrehajtási sorrend. Minden prompt- vagy sémaváltozás új `PROMPT_VERSION` értéket kap (`lib/domain.mjs:4`), és a `docs/technical/ai.md` frissül.

### 4.1. Alapmérés az éles beállításról

**Miért:** e nélkül egyik további lépés hatása sem állapítható meg.

**Teendő:**
- `scripts/evaluate-nutrition.mjs` futtatása a `work/nutrition5k-haiku-v2/cases.json` készleten, változatlan v22 prompttal.
- Két modell: `OPENCODE_MODEL=gemini-3.5-flash-lite` (éles) és `gemini-3.8-flash` (kontroll).
- Mindkét mód: `photo_only` és `with_context` (ismert össztömeg).
- A készletet érdemes 4-ről legalább 12–20 tányérra bővíteni a `scripts/prepare-nutrition5k.py` segítségével, a korábbi esetek és a 600 másodperces időbeli szomszédaik kizárásával. A kiválasztást az első modellhívás előtt le kell zárni.

**Mérendő:** kcal-, tömeg- és makró-MAE, előjeles hiba (bias), elutasítások száma, hiányzó és téves összetevők (kézi ellenőrzés), tokenek, költség.

**Költség:** fizetős. A Lite tervezési példája kb. 1,76 Ft/hívás, vagyis 20 tányér × 2 mód kb. 70 Ft; a 3.8 Flash drágább (a nov. 9-i mérésben kb. 0,024 USD/hívás 10 000 tokenes kerettel). **A futtatás előtt a tulajdonos jóváhagyása kell.**

**Kész, ha:** az eredmény `outputs/nutrition-evaluation-*.json` fájlban és egy dátumozott `docs/` jelentésben szerepel.

### 4.2. Fizikai skála bevitele

**Miért:** a mennyiségi információ az egyetlen mért hatású javítás; a tányérátmérő ma kihasználatlan (3.1.).

**Teendő a promptban (`lib/providers.mjs`, PORTIONS rész):**
- Ha `context.plateDiameterCm` meg van adva: ez a tányér **külső** átmérője; ebből kell levezetni az ételfoltok méretét. A perem szélessége és a mélység továbbra is becslés.
- Ha nincs megadva: marad a mostani szabály (nincs feltételezett tányérméret), de a modell keressen **ismert méretű tárgyat** a képen (evőeszköz, bankkártya, szabványos doboz vagy palack), és jelölje meg, mit használt.
- A kéz és az ujjak csak durva támpontok; ezt a bizonytalanságban jelezni kell.

**Teendő a sémában:** új mező, pl. `scaleReference` (`plate_diameter` / `known_object` / `none`) és rövid megnevezés. A szerver `none` esetén nem engedhet `high` bizonyosságot (ezt a `lib/providers.mjs:185` sor már részben biztosítja).

**Teendő a felületen (`public/index.html`, `public/app.mjs`):**
- Az össztömeg és a tányérátmérő mező kerüljön feltűnőbb helyre, rövid magyarázattal arról, hogy ez javít a legtöbbet.
- A tányérátmérő legyen felhasználónként megjegyezhető (ugyanaz a tányér többször szerepel).
- A második, oldalnézeti kép kérése legyen hangsúlyosabb; egyképes elemzésnél a mostani megjegyzés megmarad.

**Kockázat:** a rosszul megadott átmérő rendszeres hibát visz be. A modellnek jeleznie kell, ha a megadott átmérő láthatóan ellentmond a képnek.

**Kész, ha:** a 4.1. készleten a `plateDiameterCm`-mel futó ág tömeghibája mérhetően kisebb, mint a nélküle futóé. A Nutrition5k tányérméretét külön kell megállapítani; ha nem ismert megbízhatóan, ezt a lépést saját, lemért fotókon kell mérni.

### 4.3. Sémasorrend és levezetési mező

**Miért:** 3.2. és 3.3.

**Teendő (`lib/providers.mjs`, `ANALYSIS_SCHEMA`, `DATA_ANALYSIS_SCHEMA`):**
- Összetevőn belüli új sorrend: `name` → `foodState` → `visibility` → `alternatives` → `identityUncertain` → `lookupQuery` → `portion` → *méretbizonyíték* → `quantityUnit` → `gramsMin` → `gramsMax` → `grams` → `referenceKey` → `productLabel` → `nutrients`.
- Legfelső szint: `viewCheck` → `imageQuality` → `isFood` → `name` → `dishProfile` → `ingredients` → `assumptions` → `confidence`.
- Új, rövid méretbizonyíték mező, pl. `sizeEvidence`: darabszám, becsült kiterjedés cm-ben (hossz × szélesség × magasság) vagy térfogat ml-ben, és a viszonyítási alap. Rövid, strukturált értékek, nem szabad szöveg.
- A `lib/meal-models.mjs` `strictSchema` függvénye a `required` listát a `properties` kulcssorrendjéből képzi, tehát a Haiku-útvonal követi az új sorrendet. A Gemini-útvonalon ellenőrizni kell, hogy a szolgáltató megtartja-e a kulcssorrendet; ha nem, `propertyOrdering` megadása szükséges.

**Kockázat:**
- A többletmező fogyasztja az 1600 tokenes keretet; összetett étkezésnél nőhet a csonka válaszok száma. Mérni kell a `finishReason` szerinti elutasításokat.
- A Haiku strukturált kimenetének komplexitáskorlátja (legfeljebb 16 uniós mező) miatt a nullázható új mezőket kerülni kell.
- A hatás modellfüggő; romlás is lehetséges.

**Kész, ha:** azonos modellen, képeken és kontextuson a 4.1. alapméréshez képest nem nő az elutasítások száma, és a tömeg-MAE nem romlik. Javulás csak akkor állítható, ha a mérés mutatja.

### 4.4. Modell és gondolkodási keret

**Miért:** az éles beállítás a leggyengébb a kipróbáltak közül, mérés nélkül.

**Teendő:** a 4.1. eredménye alapján döntés. Vizsgálandó ágak ugyanazon a lezárt készleten:
1. Flash Lite, MINIMAL, 1600 token (jelenlegi).
2. Flash Lite, magasabb gondolkodási szint és nagyobb keret.
3. Gemini 3.8 Flash.

**Kockázat:** a 2. és 3. ág túllépheti a 3 Ft-os étkezésenkénti célt. **Ez üzleti döntés, a tulajdonosé.** Köztes megoldás lehet a feltételes útvonal: az erősebb modell csak alacsony bizonyosságú vagy sok összetevős étkezésnél fut; ez viszont második hívást jelent, amit a jelenlegi tervezési elv („egy részletes hívás") kizár.

**Kész, ha:** a döntés a mért hiba és a mért költség alapján dokumentált.

### 4.5. Jelöltalapú adatbázis-egyeztetés

**Miért:** 3.4. és 3.5.

**Előfeltétel:** a tényleges találati arány kiolvasása az éles `usage.foodData.evidence` naplóból. Ha az arány magas, ez a lépés elhagyható.

**Teendő (`lib/free-food-data.mjs`):**
- Pontos egyezés hiányában a szerver gyűjtse össze a legjobb néhány (pl. 5) jelöltet, állapotra (`foodState`) és egységre előszűrve.
- A választás lehetséges módjai:
  - **Determinisztikus pontozás** (szóátfedés, állapotegyezés, adattípus-prioritás) szigorú küszöbbel. Nincs többlethívás, de téves párosítást hozhat.
  - **Modell általi választás** a jelöltek közül, „egyik sem" lehetőséggel. Pontosabb lehet, de második modellhívást igényel.
- Biztonsági korlát: a kiválasztott rekord energiája nem térhet el egy küszöbnél jobban a modell tartalékbecslésétől; nagy eltérésnél a rekord elvetendő, és a bizonyosság alacsony.
- A `portionFromRecord` mértéknév-egyeztetése kapjon szinonimatáblát (pl. slice/piece/each), továbbra is egyetlen egyértelmű adag elfogadásával.

**Kockázat:** a mostani elv („nincs vak tápértékátlagolás, nincs nyers/főtt vagy g/ml csere") nem sérülhet. A forrás és a licenc megőrzése változatlan.

**Kész, ha:** a találati arány nő, és kézi ellenőrzésben a párosítások helyessége nem romlik.

### 4.6. Tanulás a felhasználói javításokból

**Miért:** 3.6.

**Teendő:**
- **Hibastatisztika:** az `original_analysis` és a jóváhagyott `analysis` összevetése összetevőnként (grammeltérés, átnevezés, törlés, hozzáadás). Ez megmutatja a rendszeres torzítást ételcsoportonként. Fontos korlát: a felhasználói javítás nem lemért referencia.
- **Felhasználónkénti adagminta:** visszatérő ételeknél a korábban jóváhagyott tipikus adag felajánlása. A `FOOD-EFFICIENCY-2026-11-13.md` elve érvényes: korábbi grammot ételnév alapján nem másolunk vakon, a mennyiség megerősítendő.
- **Sablonok:** jóváhagyott étkezés újrahasználata modellhívás nélkül.

**Adatvédelem:** a javítások elemzése előtt egyeztetni kell a `docs/legal/PRIVACY-HU.md` és a `GDPR-OPERATIONS.md` tartalmával.

### 4.7. Magyar, lemért tesztkészlet

**Miért:** a magyar ételekre (főzelék, pörkölt, rántott étel, csontos hús, rakott étel, tészta, desszert) semmilyen mérés nincs.

**Teendő:** a `docs/BENCHMARK.md` szerint 50–100 lemért étkezés, ételcsoportonként elosztva, `weighed_components` vagy `weighed_recipe` referenciával, felül- és oldalnézeti telefonos fotóval. Érdemes a tányérátmérőt és az össztömeget is rögzíteni, hogy a 4.2. ágai mérhetők legyenek.

**Szabály:** a készlet egy része maradjon lezárt ellenőrző készlet; a fejlesztésnél használt eseteken mért eredmény nem független bizonyíték.

### 4.8. Képfelbontás ellenőrzése

**Miért:** 3.7.

**Teendő:** ugyanazon a készleten egy ág 1600 px-es, egy ág csökkentés nélküli első képpel. Ha nincs mérhető különbség, a jelenlegi beállítás marad.

## 5. Sorrend és függőségek

| Lépés | Hívásköltséget növel? | Fizetős mérést igényel? | Függ |
|---|---|---|---|
| 4.1. Alapmérés | nem | igen | — |
| 4.2. Fizikai skála | nem | igen (ellenőrzéshez) | 4.1. |
| 4.3. Sémasorrend, levezetés | minimálisan (több kimeneti token) | igen (ellenőrzéshez) | 4.1. |
| 4.4. Modell, gondolkodás | igen | igen | 4.1. |
| 4.5. Jelöltalapú egyeztetés | változattól függ | részben | naplóelemzés |
| 4.6. Javításokból tanulás | nem | nem | adatvédelmi egyeztetés |
| 4.7. Magyar tesztkészlet | nem | igen | fotózás, mérés |
| 4.8. Képfelbontás | esetleg (több képtoken) | igen | 4.1. |

## 6. Nyitott döntések a tulajdonos számára

1. Engedélyezett-e a 4.1. fizetős alapmérés, és mekkora kerettel?
2. Tartható-e a 3 Ft-os étkezésenkénti cél, ha a mérés szerint az erősebb modell érdemben pontosabb?
3. Megengedett-e egy második modellhívás (4.4. feltételes útvonal, 4.5. modell általi választás), vagy marad az egyhívásos elv?
4. Ki készíti el a magyar, lemért tesztkészletet (4.7.)?

## 7. Módszertani szabályok

- Egyszerre egy változtatás, azonos modellen, képeken és kontextuson mérve.
- A referenciaadat (ételnév, gramm, tápérték) soha nem kerül a promptba vagy esetspecifikus szabályba.
- Az elutasított és hibás válaszok költsége és száma is szerepel az eredményben.
- Mérés nélkül egyik lépéshez sem állítunk pontosságjavulást.

Kapcsolódó dokumentumok: [AI-szolgáltatók](technical/ai.md), [benchmark](BENCHMARK.md), [nov. 9-i hatékonysági mérés](AI-EFFICIENCY-2026-11-09.md), [Food-R1 + Haiku élő próba](FOOD-R1-HAIKU-LIVE-2026-11-13.md), [szakmai felülvizsgálat](FOOD-PIPELINE-RESEARCH-2026-11-13.md), [kutatási döntés](FOOD-EFFICIENCY-2026-11-13.md).
