# AI-szolgáltatók és Modal

## Aktuális folyamat: 2026-11-13

Az aktuális prompt `food-v22-required-nutrient-fallback`. A forráslekérés, egyeztetés és számítás automatikus; a felhasználó csak a kész összesítést kapja. A pontosító kérdések és a Food-R1 nyers jelöltjei nem jelennek meg feldolgozási lépésként. Bizonytalan azonosságnál a fő ételhipotézishez választott, pontosan illeszkedő tápértékforrás feltételes marad, és alacsony bizonyosságot eredményez. A forrás- és szerkesztőfelület opcionális, alapból csukva van. A lentebb részletezett v20-as háttéradapterek továbbra is működnek.

Egy Gemini 3.5 Flash Lite kérés indul, legfeljebb 1600 összes kimeneti/gondolkodási tokennel. Angol adatbázis-keresőkifejezést és külön ételazonossági bizonytalanságot is ad. Erős ételazonossági bizonytalanságnál legfeljebb egy Food-R1-kérés követheti; puszta adagtömeg-bizonytalanság vagy adatbázishiba nem indítja. A segéd ellenőrizetlen névjavaslatai nem írnak felül ételt, grammot vagy tápértéket, és nem indítanak második Gemini-hívást.

Minden összetevőhöz kötelező a tartalék tápértékbecslés ugyanabban az AI-válaszban: a `nutrients` objektum nem lehet `null`, az energia, fehérje, szénhidrát és zsír számérték. A támogatás nélküli kiegészítő tápanyagok továbbra is `null` értékűek. Az eredeti olvasható címke és az elkészítési állapotban, mértékegységben illeszkedő referencia felülírja a becslést. Adatbázistalálat vagy elérhető adatbázis nélkül a tartalék becslésből készül az eredmény, `ai` forrással és becslési figyelmeztetéssel. Hibás vagy hiányos tápértékből nem készül kitalált nulla vagy újabb fizetős javítókérés. A módosítás a következő elemzésekre érvényes; a korábban hiányos AI-választ önmagában nem egészíti ki.

Az USDA/FNDDS, CNF, svéd Livsmedelsverket, norvég Matvaretabellen és Open Food Facts adapterek pontos, egyértelmű egyezést keresnek; nincs vak tápértékátlagolás vagy nyers/főtt, g/ml csere. Az adatlekérési időkeret 12 másodperc, legfeljebb 16 hálózati kérés. Az adatok és a hibák gyorsítótárba kerülnek; a szolgáltatói kvóták több worker között is érvényesülnek PostgreSQL-ben. USDA élőkereséshez saját ingyenes kulcs szükséges, a többi olvasás kulcs nélküli. Az eredeti olvasható termékcímke elsőbbséget élvez.

Migráció: PostgreSQL `0010_food_api_cache`, SQLite `0012_food_api_cache`. A tápértékforrás és licenc megmarad a piszkozatban és mentéskor. Az ODbL-termékrekordok külön `off_product_records` táblában, saját eredettel szerepelnek. A 3 Ft-os cél az új folyamatra még nincs élő LLM-méréssel igazolva; az alkalmi Food-R1 hidegindításának költsége és a tényleges Modal-kredit továbbra is számít.

Az alábbi részek a korábbi profilok és mérések történeti leírásai.

**Korábbi valós mérés (2026-11-13):** Food-R1 + Haiku adaptive/high, 4096 token; 4 étkezésből 3 menthető, átlagosan 134 kcal abszolút hiba. A négy ismert díjú hívás kb. 5,01 Ft a Modal-kredittel; a pontosság még nem megfelelő. Ez kis feltáró minta, a két korábbi API-elutasítás díja ismeretlen. Részletes jegyzőkönyv a repositoryban: `docs/FOOD-R1-HAIKU-LIVE-2026-11-13.md`.

## 2026. november 12. – 3 Ft-os költségcél

**2026. november 13.:** a Food-R1 segéd ismét aktív a **Gemini 3.5 Flash Lite** mellett. Konfigurált Modal-végponttal és proxy kulcsokkal egy Food-R1-hívás és egy OpenCode-hívás indul. A belső havi Modal-keret alapértéke ismét 15 USD; explicit 0 értékkel kikapcsolható. A segéd ételnévjavaslatait a Gemini az eredeti fotókból ellenőrzi. A rendelkezésre álló ingyenes kredit a fizetendő Modal-díjat csökkentheti; a költségnapló továbbra is az erőforrás becsült díját mutatja. Az aktuális kreditmaradványt és a pontosság változását nem mértük.

A promptverzió `food-v18-flash-lite-compact`, a válasz és gondolkodás közös felső kerete **1600 token**, a gondolkodási szint MINIMAL. A Lite nem támogatja a thinkingBudget=0 kikapcsolást; a minimális gondolkodás is számlázódhat. Az admin 1000–1600 közötti keretet fogad el. A referenciák angol ételleírása és elkészítési állapota megmarad, a párhuzamos magyar katalógusleírások és a hosszú csoportútmutatók nem kerülnek minden kérésbe. A szerver továbbra is ellenőrzi az azonosságot, egységeket, elkészítést és tápértékeket.

A szolgáltatói sémából kikerül a summary, observations, questions, preparation és portionNote. A szerver a nevet összefoglalóként, az üres listákat és az ismeretlen elkészítés alapértékét állítja elő; mennyiséget, tápértéket és bizonyosságot nem pótol. Az ételazonosság, bizonytalanság, alternatívák, adagtartomány és címkebizonyíték megmarad. A korábbi részletes válaszok továbbra is olvashatók.

Az első fotó hosszabb oldala legfeljebb 1600 pixel, a második részlet-/címkefotóé 2048 pixel; kisebb képet nem nagyítunk fel. A JPEG-minőség marad 0,92. Apró címkeszöveghez használd a második képet. Ez a bájtméretet csökkenti, önmagában nem bizonyít kevesebb képtokent.

### Költség és korlátok

A lenti 1,76 / 2,37 Ft-os példa csak az OpenCode-részre vonatkozik. A visszakapcsolt Food-R1 becsült erőforrásdíja ehhez hozzáadódik; a ténylegesen fizetendő többlet a Modal-fiók rendelkezésre álló kreditjétől függ. A két hívás összesített 3 Ft-os maximuma továbbra sincs garantálva.

Az [OpenCode árlistája](https://opencode.ai/docs/console/models/#pricing) szerint a Lite bemenete 0,30 USD, cache-bemenete 0,03 USD, kimenete és gondolkodása 2,50 USD / millió token. A 2026-11-12-től indított hívások ezeket az árakat rögzítik. A korábbi árpillanatképeket nem írjuk át. Az új Flash 3.8 hívásokhoz december végéig az aktuális 50%-os kedvezményt számoljuk.

**Tervezési példa**, nem mért új modellfutás: 4500 bemeneti token (képekkel és sémával együtt) + összesen 1600 kimeneti/gondolkodási token = 0,00535 USD, 328,16 Ft/USD mellett **1,76 Ft**. Az OpenCode 4,6%-os és feltöltésenként 0,31 USD fix kezelési díja, az adó és a banki árfolyam külön tétel. Például 20 USD feltöltésnél a ráosztott kezelési díjjal és feltételezett 27% adóval ez kb. **2,37 Ft**. Az adó tényleges kezelése a számlázástól függ.

Nincs kérés előtti költségellenőrzés, countTokens-hívás vagy bemeneti tokenplafon. **A 3 Ft cél, nem garantált maximum.** A kép-/szövegbemenet, ismételt kézi próbálkozás, árfolyam, szolgáltatói díj és a kézzel kiválasztott drágább modell túllépést okozhat. Nincs automatikus javító vagy drágább tartalékmodell-hívás. Csonka válasznál nem mentünk kitalált eredményt. Egy összetett étkezés 1600 tokenben nem mindig fér el; ilyenkor felhasználói pontosítás vagy kézi rögzítés szükséges.

Az admin a meglévő USD-adatok mellett forintbecslést mutat. Az AI_USD_HUF környezeti beállítás alapértéke 328,16, ez tervezési átváltás, nem élő árfolyam és nem történeti könyvelés. Étkezésenként is összesíti a kijelölt időszak hívásait, a hibákat és kézi újrapróbálásokat is; hiányzó használati adat ismeretlen marad. Az azonos beküldés ismétlését a meglévő input-hash/állapotkezelés fogja meg.

### Átállás

A PostgreSQL 0009_low_cost_ai és SQLite 0011_low_cost_ai egyszeri migrációja a korábban elmentett modellt Lite-ra, a keretet 1600-ra állítja; a hozzáférési és felhasználói beállításokat megőrzi. Éles környezetben állítsd OPENCODE_MODEL=gemini-3.5-flash-lite és MODAL_MONTHLY_BUDGET_USD=15 értékre a környezeti beállításokat is. A migráció a következő alkalmazásinduláskor fut le. Az új modellt a helyi tesztek csak szimulálják; éles kompatibilitását, felismerési minőségét és tényleges tokenfogyasztását fizetős próba nélkül nem igazoltuk.

Források: [minimális gondolkodás](https://firebase.google.com/docs/ai-logic/thinking), [OpenCode árak és fizetési díj](https://opencode.ai/docs/console/models/#pricing).

## Opcionális korábbi Food-R1 folyamat


## Szerepek szétválasztása

A képelemzés két eltérő feladatot választ szét. A Food-R1 ételfeladatokra specializált, helyben futtatható vision-language modell; itt rövid ételnév-javaslatokat ad. Az OpenCode-on elért Gemini az eredeti képeket önállóan ellenőrzi, és az alkalmazás adatszerződésének megfelelő teljes elemzést állítja elő. A Food-R1 mennyiségi és tápanyag-becslése nem öröklődik át.

| Tulajdonság | Food-R1 segéd | OpenCode-elemzés |
| --- | --- | --- |
| Modellazonosító | `zy12123/Food-R1`, alkalmazásban `modal/food-r1-8b` | Új alapmodell: `gemini-3.5-flash-lite` |
| Bemenet | Az étkezés előkészített képei | Eredeti képek, felhasználói kontextus, referenciajegyzék, opcionális névjavaslatok |
| Kimenet | Legfeljebb 20 rövid ételnév | Képminőség, ételnevek, összetevők, mennyiségek, források, feltételezések |
| Kötelező a működéshez? | Nem; hiba vagy keretkorlát esetén kihagyható | Igen, az új fotós elemzéshez |
| Tárolás | Külön hívásrekord és szűrt válasz | Külön hívásrekord, elemzés és jóváhagyott változat |

## Modal-környezet

A `scripts/modal_foodr1.py` külön telepíthető Python-alkalmazás. A rögzített modellrevízió `c70e0d6585b1e81923432df46014d6ce32855e3f`; ez megakadályozza, hogy egy változó `main` ág észrevétlenül megváltoztassa az éles modellt. A súlyok Modal Volume-on találhatók. A GPU-osztály L40S-t, két CPU-magot és 16 GiB rendszermemóriát kér, a modellt BF16 formában tölti be.

A generálás determinisztikus beállítású (`do_sample=False`), legfeljebb **160 új tokennel**. A felismerő saját promptverziója `food-r1-visible-foods-v2`; a válasz modellrevíziót, promptlenyomatot, feldolgozási és modellbetöltési időt is tartalmazhat.

A HTTP-gateway külön, kis CPU-s konténer. Az interneten elérhető végpont Modal proxy-hitelesítést igényel. Az alkalmazás csak a konfigurált, ellenőrzött `*.modal.run/recognize` URL-t hívja. A Northflankhoz a proxy token azonosítója és titka kell; a helyi Modal-telepítési kliens tokenje más jogosultságú, nem az alkalmazás HTTP-hitelesítője.

## Konténer-életciklus és időkorlátok

- GPU és gateway: `min_containers=0`, `buffer_containers=0`, `max_containers=1`.
- Mindkettő `single_use_containers=True`: egy kérés kiszolgálása után a konténer megszűnik.
- GPU: `retries=0`, 90 másodperces végrehajtási és 60 másodperces indulási korlát.
- Gateway: körülbelül 45 másodperces várakozás a modellhívásra; időtúllépésnél vagy hibánál `cancel(terminate_containers=True)` leállítást kér.
- A Node oldali Modal HTTP-kérés 60 másodperces megszakítási jelzést használ.

A különböző időkorlátok nem összeadandó átlagos futásidők. A hideg modellbetöltés a gyakorlatban növelheti a késleltetést. Az egykonténeres korlát és az egyszer használatos működés tudatos költségválasztás, amely nagyobb párhuzamos terhelésnél várakozást vagy segédkihagyást okozhat.

## A segédválasz bizalmi szintje

A Node-adapter ellenőrzi a modellt, a revíziót, a csonkolásjelzést és a JSON alakját. A névlista mérete, a nevek hossza és megengedett karakterei korlátozottak; az ismétlődések eltűnnek. A jelöltek `untrustedRecognitionCandidates` mezőben kerülnek a második modellhez.

A Gemini utasítása külön előírja, hogy a javaslatok tévesek lehetnek: azokat a képekkel kell összevetnie, az alá nem támasztott elemeket el kell vetnie, a kihagyott ételeket pedig önállóan kell keresnie. A felhasználói megjegyzés, a képen látható szöveg és a segédválasz adat, nem magasabb szintű utasítás. Ez csökkenti a hibák átvételét, de nem jelent matematikai prompt injection elleni garanciát.

## OpenCode és strukturált kimenet

A szolgáltatói kérés JSON-választ és JSON Schema szerinti szerkezetet kér. Egyetlen részletes OpenCode-hívás végez képleltárt, adagbecslést, képpár-ellenőrzést, címkeolvasást és végső önellenőrzést. Hiányos válaszra nincs automatikus, külön javító AI-kérés.

A szerver a kimenetet ismét ellenőrzi: az érvényes JSON önmagában kevés. Kötelező mezők, elemszámok, egységek, tápértékhatárok, forrásegyezés és elkészítési állapot is része az ellenőrzésnek. A prompt jelenlegi alkalmazásverziója `food-v18-flash-lite-compact`. Az adminból megadható modellnév csak a meglévő Gemini-kompatibilis szolgáltatói útvonalra vonatkozik; nem telepít másik adaptert.

## Megfigyelhetőség és értékelés

A hívás előtt rögzül az archívum alaprekordja. A válasz után HTTP-státusz, idő, tokenek, árazási pillanatkép, szűrt válasz és feldolgozott eredmény kerülhet hozzá. A képek SHA-256-lenyomata lehetővé teszi az azonos bemenetek összekapcsolását a képbájtok archívumba másolása nélkül.

A modellfrissítéshez ugyanazon, lemért ételekből álló referenciakészleten érdemes vizsgálni a kihagyást, téves felismerést, adaghibát, kalóriahibát, időt és költséget. A gyártói benchmark vagy a modell újabb neve nem helyettesíti ezt. Jelenleg nincs automatikus modelltréning vagy automatikus modellcsere.

Források: [Modal-alkalmazás](https://github.com/ak91hu/yumetrics/blob/main/scripts/modal_foodr1.py), [OpenCode-adapter és schema](https://github.com/ak91hu/yumetrics/blob/main/lib/providers.mjs), [Modal-adapter](https://github.com/ak91hu/yumetrics/blob/main/lib/modal-food.mjs), [Modal életciklus](https://modal.com/docs/guide/cold-start).
