# Food-R1 + Haiku: együttműködés és Nutrition5k-próba

**Friss, valós mérés (2026-11-13):** Food-R1 + Haiku adaptive/high, 4096 token; 4 étkezésből 3 menthető, átlagosan 134 kcal abszolút hiba. A négy ismert díjú hívás kb. 5,01 Ft a Modal-kredittel; a pontosság még nem megfelelő. [Eredmények és korlátok](FOOD-R1-HAIKU-LIVE-2026-11-13.md).

## Jelenlegi állapot

2026-11-13: az implementáció és a valós tesztadatok előkészítése kész. A Northflank CLI böngészős bejelentkezése sikeres, a szükséges tesztkulcsok elérhetők. Egy Haiku-kérést az API HTTP 400-as sémahibával elutasított; használati/költségadat nélkül. **Új értékelhető pontosságmérés még nincs.** A felhasználó kérésére a további élő próbát megelőzi a [szakmai módszertani felülvizsgálat](FOOD-PIPELINE-RESEARCH-2026-11-13.md). A felhasználó szerint 29 USD Modal-kredit áll rendelkezésre. A szimulált szoftvertesztek nem pontosságmérések.

A Gemini marad az alkalmazás alapmodellje, amíg az összehasonlítás nem ad használható bizonyítékot. A beépített Haiku `OPENCODE_MODEL=claude-haiku-5-5` beállítással választható. A meglévő adminmodell-beállítás elsőbbséget élvez a környezeti változóval szemben; az éles konfigurációt ez a munka nem módosította.

## Kutatás és implementált feladatmegosztás

Az [OpenCode natív inference API-ja](https://opencode.ai/docs/console/api/inference/) a Claude-modellekhez az Anthropic Messages végpontot használja. A korábbi kód minden modellt a Gemini végpontjára küldött volna: a modellnév puszta átírása nem volt megfelelő integráció. Az új `lib/meal-models.mjs` a Haikuhoz natív képes kérést, JSON-sémát és válasz-/használatiadat-feldolgozást biztosít.

Az [Anthropic Haiku-útmutatója](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5) szerint a gondolkodás alapból aktív és a kimeneti keretet fogyasztja. A vizsgálandó olcsó profil `thinking.type=disabled`, `effort=medium`, legfeljebb 1600 kimeneti token. Nincs eszközhívás, automatikus javítás vagy drágább tartalékmodell. Ez tesztelendő választás, nem igazolt pontossági optimum. A [strukturált válaszok](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) a séma betartását segítik, a képi felismerés helyességét nem bizonyítják.

A Food-R1 továbbra is egyszer kapja meg az eredeti nézeteket, és legfeljebb 20 rövid angol ételnevet javasol. Grammot vagy tápértékbecslést nem örökítünk át. A Haiku ugyanazokat az eredeti képeket látja, a felhasználó által megadott adatokat is megkapja, és az alábbi feladatokat végzi ugyanabban az egy kérésben:

1. Saját vizuális leltárt készít, majd összeveti a segédjavaslatokkal; a segéd által kihagyott ételeket is megtartja.
2. Minden javaslatot `supported`, `uncertain` vagy `rejected` döntéssel minősít; elfogadásnál konkrét összetevőindexre hivatkozik. Elutasított szószból nem keletkezik új összetevő.
3. Saját vizuális és felhasználói bizonyítékból becsüli a mennyiséget. A modellek egyezéséből nem növeli a bizonyosságot és nem szűkíti az adagtartományt.
4. Az alkalmazás a forrásazonosítókat, egységeket, címkéket és tápanyag-összefüggéseket ellenőrzi és kiszámolja az összesítést.

A szerver ellenőrzi a döntéslista teljességét, az egyedi jelöltindexeket és az összetevőhivatkozásokat; hibánál nincs új fizetős kérés. A döntések a használati adatokban, a nyilvános válasz pedig az archívumban megmarad. A belső gondolkodást és aláírását nem archiváljuk. A strukturális ellenőrzés nem képes bizonyítani, hogy egy adott étel valóban látható.

Ez költségtakarékos tervezési hipotézis: két külön feladat, egyszeri bizonyítékátadás, az eredeti kép megőrzése és ellenőrizhető döntések. A két modell együttes pontossági előnyét a páros próba méri; a korábbi két Gemini-eset nem bizonyítja a Haiku képességét.

## Rögzített, kis mintás mérési terv

Adatok: [Google Research Nutrition5k](https://github.com/google-research-datasets/Nutrition5k), CC BY 4.0, Google Research / szerzők. Az összetevőtömegeket lemérték, a kalóriát és makrókat USDA-adatokból számolták; ezek nem laboratóriumi energiamérések.

A `scripts/prepare-nutrition5k.py` a hivatalos RGB- és depth-tesztlisták közös részéből választ. Kizár minden korábbi dokumentált esetet és az azokhoz időbélyeg szerint 600 másodpercen belüli felvételeket; a kiválasztott esetek is legalább ennyire elkülönülnek. Ez a fokozatosan felépített tányérok átfedését csökkenti, teljes függetlenséget nem bizonyít. Szűrés: 3–8 összetevő, 150–1000 g; rögzített SHA-256-sorrend, eltérő energiatartományok és összetevőhalmazok. A kiválasztást a modellválaszok előtt lezártuk.

| Eset | Referencia, kcal | Tömeg, g | Referenciaösszetevők |
| --- | ---: | ---: | --- |
| dish_1558639876 | 68,18 | 215 | répa, sárgadinnye, karfiol |
| dish_1557937157 | 355,25 | 271 | eper, brokkoli, málna, tojás, bacon |
| dish_1562172643 | 734,27 | 457 | tojásfehérje, sült burgonya, bacon |
| dish_1558720236 | 887,82 | 407 | alma, répa, karfiol, mandula |

A mintát eredetileg előkészítettük csak pontos azonosító-kizárással is. Ezt még modellhívás előtt elvetettük, mert korábbi tányérokhoz közeli időbélyegű felvételeket tartalmazott. Az érvényes, időbeli kizárást is alkalmazó manifest: `work/nutrition5k-haiku-v2/cases.json`. A korábbi `work/nutrition5k-haiku` mappa nem mérési eredmény.

Mindegyik tányér két nézetével két ág fut: Haiku önállóan, illetve Food-R1 + ugyanaz a Haiku. Az ágak sorrendjét esetenként váltogatjuk. A referenciaételnevek, tömegek, kalóriák és makrók nem kerülnek a modellbemenetbe. Nincs ismert össztömegű ág, friss Gemini-hívás vagy automatikus ismétlés.

Legfeljebb 8 Haiku- és 4 Food-R1-hívás indul. A benchmark a válaszok után leáll, ha ismeretlen a számlázható használat, az eredmény hibás, a segéd nem volt használható vagy egy hívási ág becsült fizetendő díja 3 Ft fölé kerül. Az alapértelmezett teljes kutatási leállási küszöb 12 Ft. Ezek utólagos leállási szabályok, nem szolgáltatói hard limitek; egy folyamatban lévő hívás költségét nem tudják visszavonni. A felhasználó által kért módon az alkalmazásban nem vezettünk be kérés előtti költségellenőrzést vagy countTokens-hívást.

Jelentett mutatók: kcal-, tömeg- és makró-MAE, bias és RMSE; sikeres/hibás válaszok; azonos tányérokon a segített és önálló ág abszolút kalóriahibájának különbsége. Előre rögzített feltáró ellenőrzés, hogy hány segített eredmény van a referencia ±20%-án belül; ez nem általános „pontossági százalék”. Az összetevők helyességét a visszaadott nevek és a referencia alapján külön kell kézzel ellenőrizni.

## Költségelszámolás

Az [OpenCode árlistája](https://opencode.ai/docs/console/models/#pricing) szerint a Haiku 5.5 100k bemeneti tokenig 0,10 USD bemenet és 0,50 USD kimenet / millió token. A cache-olvasást és -írást külön számoljuk, a 100k feletti díjsávot is kezeljük. A szolgáltató által jelentett `usage.cost` megmarad; a benchmark ezt használja, ha rendelkezésre áll, és mellette külön közli a tokenekből számolt becslést. A hiányzó használat nem nulla költség. Hibás vagy csonka válasz is számlázódhat.

Az 1,76 / 2,37 Ft-os korábbi Gemini-példa nem Haiku-mérés. Haikunál 4500 bemeneti és 1600 kimeneti token 0,00125 USD; 328,16 Ft/USD, 20 USD feltöltés ráosztott díja és feltételezett 27% áfa mellett kb. 0,55 Ft. Képenként eltérhet a tokenfogyasztás.

A Modal erőforrásdíját külön közöljük, a rendelkezésre álló kredit által fedezett és fizetendő rész elkülönül. A [Starter havi 30 USD kreditje](https://modal.com/pricing) nem igazolja az aktuális maradványt: a futtatáshoz számlázásból ellenőrzött pillanatképet kell megadni. A korábbi cold-start mérések Food-R1-erőforrásrésze 3,8–4,0 Ft körül volt, így kredit nélkül a 3 Ft-os teljes cél már a segéden elbukhat. A mért modellidőn alapuló Modal-részből a gateway, tárhely, üresjárat és további indulási többlet hiányozhat; a teljes szolgáltatói számlával egyeztetés szükséges.

## Újrafuttatás

Python-függőségek: Pillow, imageio-ffmpeg. A kis minta letöltése nem indít LLM-hívást:

```powershell
python scripts/prepare-nutrition5k.py --count=4
node scripts/benchmark-food-r1-haiku.mjs work/nutrition5k-haiku-v2/cases.json
```

A meglévő hitelesítési csatornán elérhetővé kell tenni az `OPENCODE_API_KEY`, `MODAL_FOOD_URL`, `MODAL_PROXY_TOKEN_ID`, `MODAL_PROXY_TOKEN_SECRET` változókat; ne kerüljenek verziókezelésbe vagy chatbe. Az ellenőrzött megmaradt kredit megadásával:

```powershell
node scripts/benchmark-food-r1-haiku.mjs work/nutrition5k-haiku-v2/cases.json --run --limit=4 --total-cap-huf=12 --modal-credit-usd=AZ_ELLENORZOTT_OSSZEG
```

Az utolsó érték helyére a tényleges numerikus egyenleg kerüljön. A benchmark közvetlen szolgáltatói hívásai nem hoznak létre felhasználói étkezést az éles adatbázisban. Az eredmény az `outputs/` mappába kerül, képbájtok és kulcsok nélkül, képlenyomatokkal, implementációlenyomatokkal, elutasításokkal és részletes költségekkel. Megszakadt futást ne indíts újra vakon: az elmentett `started` bejegyzés már elküldött, számlázható kérést is jelenthet.

Korlátok: négy eset előszűrésre elég, általános modellváltás igazolására kevés. A nyilvános tesztadat szerepelhetett a modellek tanításában. A magyar konyha, csomagolás-/címkeolvasás, rossz fény és nem ételt ábrázoló képek külön validálást igényelnek. Mérési eredmény nélkül nem állítjuk, hogy a Haiku megtartja a Gemini pontosságát vagy hogy az együttműködés biztosan javít.
