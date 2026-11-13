# Ingyenes adat-API-k további AI-hívás nélkül

Ellenőrzés: 2026-11-13. Ez kutatás és néhány csak olvasó elérhetőségi próba; éles integráció, fiókregisztráció és AI-inferencia nem történt.

## Javasolt prioritás

1. **USDA FDC/FNDDS teljesebb helyi index + adagadatok** az általános ételekhez. A jelenlegi kódban már van 44 USDA-referencia; ezt kell bővíteni, nem egy újabb teljes elemző modellt hozzáadni.
2. **Canadian Nutrient File (CNF)** adag-, ehetőrész- és hozamadatokhoz, megfelelő ételazonosság esetén.
3. **Open Food Facts (OFF)** pontosan azonosított csomagolt termékhez, elsődlegesen ellenőrzött vonalkóddal.
4. **Svéd Livsmedelsverket** további elkészített ételekhez, alapanyagokhoz és strukturált ételosztályozáshoz; **norvég Matvaretabellen** másodlagos európai lefedettséghez.

Ezek adatlekérések, nem újabb LLM-hívások. A több adatforrás nem jelent automatikusan jobb képfelismerést vagy pontos fotós grammértéket. Az adatforrások közös eredete miatt az egyező számok sem feltétlenül független bizonyítékok.

## 1. USDA FoodData Central / FNDDS

- Ingyenes kulcs; a dokumentált alapkorlát 1000 kérés/óra/IP. A DEMO_KEY próbakulcs 30/óra és 50/nap/IP.
- Ételkeresés és részletes rekord, tápérték, valamint adatfüggően adag- és alapanyagadatok. A teljes adatállomány letölthető, így helyi kereséssel nem kell minden étkezéshez hálózati kérés.
- Adatok: CC0/közkincs. Forrásmegjelölést kérnek.
- Haszon: például a főtt és száraz rizs megkülönböztetése, konkrét adatbázisazonosító és az adott ételhez tartozó háztartási mértékegységek. Az adagadat nem méri meg a képen látható rizst.
- Élő próba: `GET https://api.nal.usda.gov/fdc/v1/food/173904?api_key=DEMO_KEY` → HTTP 200 JSON, benne `foodNutrients`, `foodPortions`, `inputFoods` mezők. Ez elérhetőségi próba, nem e mezők minden ételnél teljes tartalmának igazolása.

[API és korlátok](https://fdc.nal.usda.gov/api-guide/), [letölthető adatok](https://fdc.nal.usda.gov/download-datasets/).

## 2. Health Canada Canadian Nutrient File

- Dokumentált JSON/XML API; a kipróbált ételvégpont kulcs és regisztráció nélkül HTTP 200-at adott. Nyilvánosan dokumentált kvótát nem sikerült igazolni: nem tekintjük korlátlannak.
- `food`, `nutrientamount`, `servingsize` és a dokumentációban szereplő további adatvégpontok. Adagok, átváltási tényezők, ehetetlen részek és elkészítési hozam adatállományai is rendelkezésre állnak, nem minden ételhez feltétlenül teljesen.
- Fontos képlet: a `conversion_factor_value` a **100 g-ra adott tápérték szorzója**, nem közvetlenül gramm. A hozzá tartozó adagtömeg = szorzó × 100 g. A kanadai csésze és egyéb térfogati egységek nem keverhetők más ország definíciójával.
- Élő próba: `https://food-nutrition.canada.ca/api/canadian-nutrient-file/food/?id=109&lang=en&type=json` → HTTP 200, Gouda sajt. Külön sikeres adagos lekérés: `/servingsize/?id=109&lang=en&type=json`; a visszakapott „100ml diced” szorzója 0,5579, azaz 55,79 g referenciatömeg. Ez adatbázisbeli adag, nem egy lefotózott sajt mérése.
- A régebbi hivatalos útmutató engedi a kereskedelmi és nem kereskedelmi felhasználást, forrásmegjelöléssel; a 2026-os letölthető kiadás katalógusa Open Government Licence – Canada licencet jelöl. A régi API és az új letöltés verzióazonosságát külön ellenőrizni kell; nem állítjuk, hogy az API már 2026-os adatokat ad.
- Haszon: a valóban ismert darabszám vagy háztartási adag átváltása, csont/héj és főzési hozam következetes kezelése. A hozamtényező nem egyenlő tápanyag-megmaradási tényezővel.

[API-dokumentáció](https://produits-sante.canada.ca/api/documentation/cnf-documentation-en.html), [felhasználói útmutató és felhasználás](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-compilation-canadian-food-composition-data-users-guide.html), [2026-os letölthető kiadás](https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109?res_page=2).

## 3. Open Food Facts

- Ingyenes olvasás API-kulcs nélkül; az alkalmazást azonosító egyedi User-Agent szükséges. A jelenlegi elsődleges dokumentáció termékolvasásra 15 kérés/perc/IP, keresésre 10 kérés/perc/IP korlátot közöl. Régebbi cikkek magasabb termékkvótájára nem építünk.
- Vonalkódhoz terméknév, változat, kiszerelés, tápérték, összetevőlista és további mezők érhetők el, ha feltöltötték az adatot. Közösségi adat, hiányos vagy hibás is lehet; a magyar termékek reprezentatív lefedettségét nem mértük.
- A pontos termékkód a hasznos belépési pont. Pusztán „joghurt” vagy márkanév alapján nem fogadunk el konkrét termékadatot.
- ODbL, forrásmegjelölés és adatbázis-megosztási feltételekkel; a képek licence különbözik. Az OFF-ból származó adatokat eredetükkel együtt kezeljük, nem olvasztjuk be automatikusan zárt, más licencű adatbázisba. Élesítés előtt az alkalmazás tényleges adatfelhasználását a közzétett feltételekhez kell igazítani.
- Haszon: a képről már felismert vagy külön beolvasott érvényes vonalkód alapján tápértékpontosítás új AI-kérés nélkül. Az aktuális olvasható csomagcímke és az adatbázis eltérése jelzendő.

[Aktuális API-bevezető](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/index.md), [felhasználási feltételek összefoglalója](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api).

## 4. Svéd Livsmedelsverket

- Nyílt JSON API, CC BY 4.0. A hivatalos leírás kb. 2500 élelmiszert és több mint 50 tápanyagot említ, további FoodEx2/LanguaL-osztályozással és alapanyaginformációval.
- A dokumentált végpontok ételt, tápértéket, osztályozást, alapanyagokat és összetevőket is adhatnak. Hasznos az ételváltozatok és feldolgozási állapotok strukturált illesztéséhez; ettől még nem magyar receptadatbázis.
- Élő próba: `https://dataportal.livsmedelsverket.se/livsmedel/api/v1/livsmedel?offset=0&limit=1` → HTTP 200 JSON kulcs nélkül. Publikált számszerű kvótát nem igazoltunk; helyi gyorsítótár indokolt.

[Hivatalos adat- és licencleírás](https://www.livsmedelsverket.se/en/about-us/open-data/food-composition-data), [Swagger](https://dataportal.livsmedelsverket.se/livsmedel/swagger/index.html).

## 5. Norvég Matvaretabellen

- A teljes tábla öt nyilvános JSON-forrással érhető el: ételek, csoportok, tápanyag-definíciók, LanguaL-kódok és források. Angol elnevezések is vannak.
- CC BY 4.0 a jelenlegi 2026-os kiadói feltételek szerint; régebbi katalógusrekordok NLOD-licencet is mutatnak, ezért a verzióval együtt kell megőrizni a licencet.
- A kiadó kifejezetten támogatja a helyi gyorsítótárat, éves frissítéssel. Nem verziózott API, importkor lenyomat és sémaellenőrzés kell.
- Élő próba: `https://www.matvaretabellen.no/api/en/nutrients.json` → HTTP 200 JSON, kulcs nélkül. A teljes ételvégpont dokumentált: `/api/en/foods.json`; ebben a körben a teljes állományt nem töltöttük le.

[API](https://www.matvaretabellen.no/en/api/), [aktuális kiadói licenc](https://www.mattilsynet.no/en/food-and-beverages/matvaretabellen/download-the-norwegian-food-composition-table).

## Egyéb jelöltek és korlátok

- **FatSecret Basic:** dokumentáltan ingyenes, 5000 hívás/nap, de csak US-adat. Premier Free is csak US-hozzáférést ígér, ellenőrzött jogosultsággal. A képfelismerés és NLP külön fizetős kiegészítés; magyar lefedettségét nem számítjuk ingyenesnek. Az adattárolási feltételek miatt nem első választás helyi, nyílt adatindexhez. [Hivatalos csomagok](https://platform.fatsecret.com/api-editions).
- **Ciqual 2025:** 3484 étel, 74 összetevő/tápérték-komponens; ingyenes letölthető adat, nem ebben a körben igazolt nyilvános REST API. Saját helyi kereső mögé hasznos lehet. [Kiadás](https://ciqual.anses.fr/cms/fr/node/19), [licenc és forrásmegjelölés](https://ciqual.anses.fr/cms/en/legal-information).
- **Fineli, CoFID, NEVO:** további ingyenesen letölthető állományok; nem nevezzük automatikusan mindegyiket szabad, korlátlan üzleti API-nak. [Fineli](https://fineli.fi/fineli/en/avoin-data), [CoFID](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid), [NEVO letöltés, elfogadandó feltételekkel](https://www.rivm.nl/en/dutch-food-composition-database/use-of-nevo-online/request-dataset).
- **MealCP:** magyar bolti katalógust is dokumentál, de az új API-kulcsok kiadása jelenleg szünetel, és a fő adatok termékmetaadatok/árak, nem igazolt teljes tápértékek. Jelenleg nem megoldás az azonnal hozzáférhető, ingyenes tápértékpontosításra. [Szolgáltató](https://mealcp.com/).

## Beillesztés a jelenlegi legfeljebb két AI-kérésbe

`Food-R1 → helyi név/elkészítési mód egyeztetés + adatlekérés → meglévő Haiku-kérés kevés releváns jelölttel → szerveroldali számítás`

A magyar–angol elnevezésekhez helyi szinonimaszótár, az új ételhez szükséges rövid angol név pedig a már meglévő felismerési kimenet része lehet. Nem kell külön fordító-LLM. A nyers/főtt/sült állapot, ételváltozat és mértékegység kötelező illesztési feltétel; névegyezés önmagában nem elég.

Vonalkódos terméknél az OFF-lekérés akár kiválthatja az AI-t. Több forrás tápértékét nem átlagoljuk vakon; megőrizzük a kiválasztott rekordot, verziót, egységet, forrást és a szénhidrát/rost definícióját. Hiányzó tápérték nem 0. Gramm és milliliter között csak megfelelő, adott ételre vonatkozó átváltással számolunk. A 100 g-os száraz alapanyag és 100 g készétel nem cserélhető fel.

A források lekérésének nincs LLM-díja; a saját tárhely és futtatás költsége ettől még megmarad. A várható előny az adatbázis- és adagkonverziós hibák csökkentése. A kép alapján ismeretlen mennyiséget és rejtett olajat egyik adat-API sem állapítja meg.

Elérhetőségi eredmények: `work/free-food-api-probes-2026-11-13.json`. Mind a négy ott szereplő próba HTTP 200 JSON-t kapott. Ezt egy külön sikeres CNF-adaglekérés egészítette ki: összesen öt kis adatlekérés, AI-hívás nélkül. Ez nem pontossági benchmark, SLA- vagy teljes lefedettségi garancia.
