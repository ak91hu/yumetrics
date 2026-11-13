# Yumetrics

**Legújabb folyamat:** `food-v21-automatic-result` – automatikus felismerés, ingyenes adatforrás-lekérés, egyeztetés és tápérték-összeállítás. A felhasználó először a kész eredményt látja; az adatforrás-kereső és szerkesztő opcionális, alapból csukott részben érhető el. Nincs kötelező forrásválasztás vagy pontosító kérdés. A fennmaradó bizonytalanságot a végeredmény jelzi.

**Aktuális megvalósítás, 2026-11-13:** Gemini 3.5 Flash Lite az alap, egy elemzőkéréssel. Utána USDA/FNDDS, kanadai CNF, svéd, norvég és Open Food Facts adapterek segítik a forrásegyeztetést, tartós gyorsítótárral és kéréskorlátokkal. Food-R1 csak kifejezetten bizonytalan ételazonosságnál indul, legfeljebb egyszer; nincs második Gemini-hívás. [Működés, beállítás és ellenőrzés](docs/FREE-FOOD-INTEGRATION-2026-11-13.md). Az alábbi korábbi kísérletek történeti eredmények, nem az új folyamat pontosságmérései.

A piszkozat kézi forráskeresője is több adatbázist használ: a találat teljes rekordját a szerver ellenőrzi, a kiválasztott étel neve és tápértéke frissül, a mennyiség megmarad. A meglévő Northflank USDA-kulccsal a helyi alkalmazás HTTP-keresése és forrásválasztása is ellenőrzött, új AI-hívás nélkül. A végső tesztfutás: 197 sikeres, 22 kihagyott, 0 hibás teszt; a build sikeres.

**Friss, valós mérés (2026-11-13):** Food-R1 + Haiku adaptive/high, 4096 token; 4 étkezésből 3 menthető, átlagosan 134 kcal abszolút hiba. A négy ismert díjú hívás kb. 5,01 Ft a Modal-kredittel; a pontosság még nem megfelelő. [Eredmények és korlátok](docs/FOOD-R1-HAIKU-LIVE-2026-11-13.md).

**2026. november 13.:** beépített Food-R1 + Haiku 5.5 jelölt, natív képes API-val és ellenőrizhető segéddöntésekkel. Négy új Nutrition5k-eset előkészítve; új élő pontosságmérés még nincs, a Gemini marad az alapmodell. [Mérési terv és állapot](docs/HAIKU-NUTRITION5K-2026-11-13.md).

**2026. november 12.:** az új alapmodell Gemini 3.5 Flash Lite, étkezésenként egy Food-R1 segédhívással és egy OpenCode-hívással, legfeljebb 1600 kimeneti/gondolkodási tokennel. Cél: 3 Ft alatti elemzés; ez új élő mérés nélkül tervezési becslés. A kérés előtt nincs költségellenőrzés. [Költségterv, módosítások és átállás](docs/AI-COSTS.md).

A 2026. november 10-i döntések, javítások, költségfeltételek és még csak tervezett modellpróbák összefoglalója: [mai döntések és állapot](docs/DECISIONS-2026-11-10.md). Ez történeti összefoglaló; a november 12-i Lite-átállás felülírja az akkori modellválasztást.

![Yumetrics — your food, in numbers](public/brand-banner.svg)

**[Élő alkalmazás](https://yumetrics.app)** · **[Magyar útmutató](https://yumetrics.app/utmutato)** · **[English guide](https://yumetrics.app/guide)** · **[MkDocs technikai dokumentáció](https://yumetrics.app/docs/)**

Frissítve: 2026. november 13. · AI-módszerváltozat: `food-v21-automatic-result`.

Adatvédelmi dokumentáció: [magyar és angol tájékoztató, felhasználási feltételek, jogi kutatás és belső GDPR-eljárásrend](docs/legal/README.md). **Felülvizsgálati tervezetek, nem hatályos ÁSZF vagy megfelelőségi igazolás.** A csomag a tényleges tárolási helyeket és a még rendezendő hozzájárulási, megőrzési, törlési és szolgáltatói szerződéses kérdéseket is bemutatja. Az üzemeltető Kovács Ákos; a tervezett korhatár 18 év. A dokumentálás önmagában nem vezette be a szükséges műszaki folyamatokat.

A [magyar adatkezelési tájékoztató](https://yumetrics.app/adatvedelem) és az [angol változat](https://yumetrics.app/privacy) az alkalmazás betűtípusával és színeivel, mobilon is olvasható oldalon jelenik meg. Az útmutató, a technikai dokumentáció és az adatkezelési tájékoztató közös láblécből érhető el belépés előtt és után. A `/feltetelek` és `/terms` oldalak a kapcsolódó feltételeket mutatják, ugyancsak tervezetként. A HTML-t a dokumentációbuild a `docs/legal/` Markdown-forrásaiból állítja elő; a szöveget ott kell módosítani.

A belépési oldal, a napló és az admin tetején keskeny, sötétzöldből meleg aranybarnába hajló színátmenetes sáv jelzi, hogy az alkalmazás bétatesztelés alatt áll. A napló és a belépési oldal felirata követi a magyar/angol nyelvválasztást; a magyar adminfelületen magyar marad.

Magyar és angol nyelvű étkezési napló Google-belépéssel, fotó alapján becsült tápértékekkel és javítható összetevőkkel. Az első AI-becslés a képen látható **teljes ehető étel és ital 100%-ából** indul ki; a naplóba mentendő mennyiséget a piszkozatban ellenőrizheted és javíthatod. A fotós elemzés nem közvetlen kalóriamérés: a felismerést, a mennyiségi becslést, a tápértékforrást és a számítást külön kezeljük.

## Hogyan működik az alkalmazás?

A Yumetrics az étkezés dokumentálását és az ellenőrizhető számítást kapcsolja össze. A fénykép vizuális bizonyíték, az AI javítható javaslatot készít, a tápértékeket pedig rögzített szabályok számolják. A felhasználó tudja megadni azokat az információkat – például az étel lemért tömegét vagy a hozzáadott olajat –, amelyek a képből nem olvashatók ki megbízhatóan.

### Egy étkezés teljes életútja

1. **Belépés.** A Google igazolja a fiók azonosságát, a szerver helyi munkamenetet hoz létre. A napló több eszközről ugyanazzal a fiókkal érhető el; a Google-jelszó nem kerül az alkalmazáshoz.
2. **Adatrögzítés.** Egy fénykép kötelező, a második opcionális. Telefonon külön kamera- és képkiválasztási lehetőség van. Dátum, étkezéstípus, megjegyzés, ismert tömeg és más kiegészítő adat segítheti az értelmezést.
3. **Képelőkészítés.** A böngésző dekódolja, az első fotót legfeljebb 1600, a második részlet-/címkefotót 2048 pixeles hosszabb oldalra méretezi és JPEG-ként újrarajzolja a képet. Az eredeti EXIF/GPS-metaadatokat nem másolja át. A szerver a formátumot, a méretet és a két kép azonosságát is ellenőrzi.
4. **Tartós feltöltés.** A képek védett Cloudinary-tárolásba, a bejegyzés és a feldolgozási feladat PostgreSQL-be kerül. A `202 Accepted` válasz ezt igazolja; nem jelenti, hogy az AI már elkészült. A háttérfeldolgozás a felugró ablak bezárása után is folytatódik.
5. **Felismerés és ellenőrzés.** Az OpenCode-on elért Gemini 3.5 Flash Lite a fotókból egyetlen strukturált elemzést ad. Bizonytalan ételazonosságnál a konfigurált Food-R1 további névjavaslatokat adhat; ezek ellenőrzendő javaslatok maradnak. Az adat-API-k a megfelelő tápértékforrás kiválasztását segítik további LLM-hívás nélkül.
6. **Számítás és piszkozat.** A szerver ellenőrzi az egységeket, a forrásokat és a számszerű összefüggéseket. Összetevőnként kiszámolja az adagra jutó tápanyagokat és azok összegét. Az elkészült elemzés piszkozat; a felület tetején jól látható jelzés nyitja meg az ellenőrzést.
7. **Javítás és mentés.** Az ételnév, a tömeg, a forrás és a recept módosítható. A végleges mentés külön művelet. A revízióellenőrzés megakadályozza, hogy egy régi böngészőablak észrevétlenül felülírjon újabb adatot.
8. **Napló és visszajelzés.** A mentett étkezésekből naptár, napi összesítés, időszaki átlagok, fejlődés és heti haladás készül. Ezekhez nincs szükség további AI-hívásra.

```text
Fotó + ismert adatok
  → biztonságos képfeltöltés és tartós feladat
  → OpenCode/Gemini képelemzés
  → csak bizonytalan ételazonosságnál: Food-R1-javaslatok
  → helyi referencia / ingyenes adat-API-k, gyorsítótárral
  → szerveroldali validálás és számítás
  → javítható piszkozat → felhasználói mentés
  → saját napló, összesítések és jutalmak
```

### Mit tesz az AI, és mit számol a program?

| Feladat | Felelős |
| --- | --- |
| Látható ételek, elkészítés, adag és nem látható hozzávalók bizonytalansága | AI, a felhasználó által ellenőrizhető javaslatként |
| Food-R1-jelöltek elfogadása vagy elvetése az eredeti fotók alapján | OpenCode/Gemini |
| Címkeadat átalakítása, referenciaérték ellenőrzése | Szerveroldali programkód |
| Tápanyagok adagra vetítése, ételenkénti és teljes összeg | Determinisztikus számítás |
| Saját recept arányosítása lemért kész tömegre | Determinisztikus számítás |
| Végleges név, mennyiség és mentési jóváhagyás | Felhasználó |

A Food-R1 nem kötelező második vélemény minden körülmény között. Hibás segédválasz, időtúllépés vagy belső keretkorlát esetén az önálló OpenCode-elemzés folytatódhat. A fő elemzés hibáját nem fedjük el kitalált ételadatokkal. Megszakadt elemzés után új, számlázható kéréshez kézi újrapróbálás szükséges.

## Technikai felépítés és tartós adatok

| Réteg | Megoldás és feladat |
| --- | --- |
| Böngésző | Natív HTML/CSS/JavaScript ES-modulok; fotó-előkészítés, napló, szerkesztés, nyelvváltás |
| Webszerver | Node.js 24+, natív HTTP-szerver és JSON API, háttérworker ugyanabban a folyamatban |
| Alkalmazásadatok | Northflank PostgreSQL: felhasználók, munkamenetek, étkezések, feladatsor, beállítások, naplók és látogatottság |
| Képek | Cloudinary `authenticated` tárolás; saját, jogosultságot ellenőrző képvégpontok |
| AI | Modal Food-R1 segéd + OpenCode/Gemini; külön naplózott hívások |
| Tápértékadatok | Termékcímke, 44 beépített USDA-referencia, opcionális élő FoodData Central |
| Üzemeltetés | GitHub main → Northflank Docker-build → nem rootként futó Node-image |
| Technikai dokumentáció | MkDocs strict build → statikus `/docs/` oldalak, helyi keresővel |

Az alkalmazáskonténer cseréje nem törli a PostgreSQL-ben és a Cloudinaryban őrzött adatokat. A fotók tényleges bájtjai nem az adatbázisban vannak; a képek és az adatbázis mentését ezért együtt kell megtervezni. A még el nem küldött böngészős kép nem tartós mentés.

A feladatsort lease és egyedi végrehajtási token védi, az azonos beküldés ismétlése input hash alapján felismerhető. Ez nem jelent a külső AI-szolgáltatóknál pontosan egyszeri számlázási garanciát. A részleges hibákat és a megszakításokat megőrizzük; az állapot az adminban visszakereshető.

A napló saját adatai csak a tulajdonosnak és a jogosult adminnak hozzáférhetők. Az átlagos felhasználó nem lát szolgáltatói állapotlistát vagy kulcsokat. A látogatásmérés saját, adatbázisba mentett napi összesítéseket készít, egyedi látogatói profil nélkül; nem egy külső analitikai oldal memóriájára támaszkodik.

### Részletes MkDocs-kézikönyv

A [nyilvános technikai dokumentáció](https://yumetrics.app/docs/) az alkalmazás láblécéből is elérhető. Külön fejezetben tárgyalja az architektúrát, a kliens és szerver adatfolyamát, az állapotgépet, az AI-adaptereket, a tápértékalgoritmusokat, a teljes adatmodellt, a HTTP API-t, a hitelesítést, az adatvédelmet, a kihívásokat, az adminisztrációt, a költségbecslést, a telepítést és az ellenőrzést.

Forrása: [docs/technical](docs/technical/index.md); konfigurációja: [mkdocs.yml](mkdocs.yml). A generált fájlok nem kerülnek Gitbe, minden alkalmazásbuild újra előállítja őket. A MkDocs nem külön éles szolgáltatás, és a dokumentáció olvasása nem indít AI-hívást.

A dokumentációs oldal magyar nyelvű, helyi keresővel, mobilos tartalomjegyzékkel és a kódhoz vezető hivatkozásokkal. A szolgáltatói válaszok archívuma továbbra is kizárólag az adminfelületen érhető el: a nyilvános kézikönyv nem tesz közzé személyes adatot vagy éles naplót.

## A számítás módszere és az AI szerepe

1. **Fotó és vizuális leltár.** Egy fotó kötelező, a második opcionális. Egy másik szögből készült kép segíthet a felismerés és az adagbecslés pontosításában; csomagolt terméknél az olvasható tápértéktábla is hasznos. Az azonos képtartalmat feltöltés előtt elutasítjuk. A Gemini 3.5 Flash Lite a feltöltött kép vagy képek és a megadott információk alapján javaslatot tesz az ételre, az összetevőkre, az elkészítési állapotra és a g-ban vagy ml-ben megadott ehető mennyiségekre. A köretet, szószt és italt is számba kell vennie. Megkülönbözteti a látható vagy megadott elemeket a feltételezésektől, például a nem látható olajtól. Egyetlen részletes AI-kérés tartalmazza a képek ellenőrzését, a leltárt, az adag- és tápértékbecslést, valamint a végső ellenőrzést.
2. **Ellenőrzés és forrásválasztás ugyanabban a válaszban.** Az AI ellenőrzi az adag azonosságát, az eltérő szöget, a képminőséget, a kihagyott/duplázott összetevőket és az elkészítést. A 44 USDA-rekord közül javasolhat megfelelő forrást; a szerver annak rögzített értékeit használja. Nyers referencia nem párosítható elkészített összetevőhöz.
3. **Tápértékek ugyanabban az AI-válaszban.** Minden összetevőhöz az egységének megfelelő 100 g-os vagy 100 ml-es tápérték is érkezik. Olvasható, az adott termékre és állapotra vonatkozó címkénél a szerver az eredeti címkeértékeket alakítja át; egyébként megfelelő USDA-forrást vagy számszerűen ellenőrzött AI-becslést használ. A részleges címkét és a becsült értékeket külön jelzi. Hiányos vagy ellentmondó válaszra nem indít kiegészítő AI-hívást. A megszakadt elemzéshez új, szolgáltatói költséggel járó kérés csak kifejezett kézi újrapróbáláskor indul; azonos feltöltés ismétlése nem küld új kérést.
4. **Mennyiség pontosítása.** Mérleg nélkül a grammok képi becslések. A megadott teljes ételtömegből levonjuk a külön lemért nem ehető részt, majd az összetevőket az így kapott ehető mennyiséghez arányosítjuk. A hús, köret és zsiradék egymáshoz viszonyított aránya ettől még becsült marad. Milliliteres tétel mellett a grammos össztömeget nem osztjuk szét sűrűség feltételezésével; az össztömeget ilyenkor hagyd üresen. Két fotó ugyanannak az adagnak két nézete; a mennyiséget nem duplázzuk.
5. **Szerveroldali számítás.** A g vagy ml mennyiséget az azonos egységre megadott 100-as tápértékkel szorozzuk, majd elosztjuk százzal; sűrűséget nem feltételezünk. Az összes összetevő eredményét összeadjuk. A végső adagérték tehát ellenőrizhető számítás eredménye, amelynek pontossága a bevitt mennyiségtől, az étel felismerésétől és a választott forrástól függ.
6. **Felhasználói ellenőrzés.** Az étel neve, mennyisége, elkészítése és tápértékforrása mentés előtt és után is javítható. Választható másik USDA-rekord vagy megadható termékcímke. Az eredeti AI-elemzést, a modell és a prompt verzióját, valamint a mentett javításokat külön őrizzük meg. Értékelhetetlen kép vagy hiányos AI-válasz esetén nem készítünk helyette kitalált eredményt.

```text
Összetevő tápértéke = mennyiség (g vagy ml) × azonos egységű 100-as tápérték ÷ 100
Teljes adag tápértéke = az összes ehető összetevő tápértékének összege
```

Szemléltető példa: 150 g összetevő 200 kcal/100 g értékkel 300 kcal-t ad az adaghoz. Ezek példaszámok, nem egy konkrét étel forrásadatai. Az energián kívül ugyanígy számoljuk a fehérjét, szénhidrátot és zsírt; további tápanyagot csak akkor közlünk, ha van hozzá adat. Az ismeretlen érték `null`, a felületen „—”, nem nulla.

### Mitől lehet megalapozottabb az eredmény?

| Megadott adat | Mit segít tisztázni? | Mi marad bizonytalan? |
| --- | --- | --- |
| Teljes ételtömeg és külön lemért csont/héj | Az egész adag ehető össztömegét | Az összetevők arányát továbbra is becsüljük |
| Külön lemért összetevők | Az adott összetevő grammjait | Az azonosságot, elkészítést és a tápértékforrást ellenőrizni kell |
| Második fotó, ismert tányérátmérő | A láthatóságot és a képi léptéket | Nem térfogatmérés és nem helyettesíti a mérleget |
| Elkészítés, hozzáadott olaj és szósz | A fotóból nem azonosítható hozzávalókat | A nem ismert receptet nem lehet biztosan rekonstruálni |
| Saját recept és lemért kész tömeg | A teljes recept tápértékének adagra osztását | A veszteségeket és az alapanyagok forrásadatait megfelelően kell megadni |

**Saját recept:** a teljes elkészült ételben maradt alapanyagok tápértékét összeadjuk, majd a képen látható adag tömegét a teljes kész étel tömegéhez viszonyítjuk. Ehhez nem kell újabb AI-hívás. A főzés előtti alapanyagtömegek összege nem helyettesíti a kész étel lemért tömegét; a visszamaradt vagy elöntött zsiradékot sem szabad elfogyasztottként számolni.

### A bizonytalanság értelmezése

A kalóriatartomány mennyiségi és összetételi forgatókönyveket mutat. Ismert ehető össztömegnél azonos össztömeg mellett változtatjuk az összetevőarányokat a becsült határaikon belül; ismeretlen össztömegnél az összetevők alsó és felső tömegbecsléseiből indulunk ki. Ez **nem statisztikai konfidenciaintervallum**, és nem garantálja, hogy a valódi érték a két határ közé esik. A téves felismerés, rejtett hozzávaló vagy rossz forráspárosítás további hibát okozhat.

Az AI azt jelzi, mennyire biztos a saját becslésében; ez nem méréssel igazolt pontosság. Nincs közzétett, lemért magyar ételfotókon igazolt Yumetrics-pontossági százalék. A szoftvertesztek a számítást és a működést ellenőrzik; a fotós becslés tényleges hibáját külön, ismert referenciaértékekkel kell megmérni. A napi energiakeret felhasználói beállítás, nem személyre szabott táplálkozási ajánlás.

Részletes módszertan: [PHOTO-ASSESSMENT.md](docs/PHOTO-ASSESSMENT.md). Források és kutatási döntések: [RESEARCH.md](docs/RESEARCH.md), [REFERENCE-CATALOG.md](docs/REFERENCE-CATALOG.md). A pontosságmérés eszköze: [BENCHMARK.md](docs/BENCHMARK.md).

Az első valódi, négy lemért Nutrition5k-étkezést vizsgáló AI-ellenőrzésben összesen 20 szolgáltatói hívás történt, a régi és az új változat összehasonlításával és négy ellenőrző bemenettel. Az ismert össztömegű négy eset átlagos abszolút kalóriahibája 86,1-ről 76,5 kcal-ra csökkent; tömeg nélkül az elfogadott képpárok száma 2/4-ről 4/4-re nőtt. Ez kis, a javításokhoz is felhasznált diagnosztikai minta, nem független vakteszt vagy magyar étkezésekre igazolt pontosság. A modell egy ételt továbbra is félreismert, és a hús tömegarányát is alábecsülte.

A teljes módszer, a sikertelen esetek, a hibamutatók és a 0,59052 USD szolgáltatói költség: [2026. november 9-i jelentés](docs/AI-VALIDATION-2026-11-09.md), [mérési napló](docs/AI-VALIDATION-2026-11-09.json). Az értékelő az elutasított hívások használati adatait is megőrzi, és a rostot tartalmazó, illetve rost nélküli szénhidrátértékeket azonos alapra hozza. A képpár-ellenőrzés perspektívát és takarást vizsgál, az ételnevekhez külön megfogalmazási szabály tartozik; ezek sem garantálják a helyes felismerést minden képen.

## Csomagolt termékek és italok

A `food-v17-label-preparation` javítás külön kezeli a száraz csomagtömeget és az elkészített étel mennyiségét. Olvashatatlan terméknév mellett is megmaradnak a használható címketápértékek, a név bizonytalanságát pedig külön jelezzük. Hibák, példák és ellenőrzés: [a számítás és felismerés felülvizsgálata](docs/CODE-REVIEW-2026-11-10.md).

Az OpenCode egyetlen kérésében az étel-, ital- és édességfelismerés mellett címkeolvasás is történik. Teljes termékfotó + ugyanazon csomag másik oldalán olvasható tápértéktábla is elfogadott képpár. A címke eredeti számai, alapja, termékneve, márkája, nettó mennyisége, olvasható összetevő- és allergénszövege megmarad; a vonalkód ellenőrzőszámát ellenőrizzük, de termékadatbázisból nem találgatunk márkás termékértéket. A szerver átszámítja az adagértékeket 100 g/100 ml alapra, a kJ-t kcal-ra, a sót nátriumra, az amerikai összes szénhidrátot rost nélküli értékre. Az energia- és sóadatok összhangját azonos, 100 g/100 ml-es alapon ellenőrzi. A címkés csomagmennyiséget nem kerekíti a fotós becslés ezredes felbontására. Az olvashatatlan értéket hiányzó adatként (`null`) tároljuk, nem nullaként (`0`). A gramm és ml nem válik egymásba sűrűség nélkül. A címke megváltoztatott tápértéke saját adat lesz, a címkés forrásként megjelölt eredeti pillanatkép nem írható át kliensoldalról.

Bontatlan csomagnál a látható teljes csomagok nettó mennyisége az alapértelmezett adag; felbontott csomagnál a teljes kiszerelésből nem következtetünk a maradékra. A naplózott mennyiséget a felhasználó mentés előtt ellenőrzi és módosíthatja. Az AI-alapú címkeolvasás és a gyártói adatok is korlátosak: [a címke tápértékei átlagos értékek](https://www.fsai.ie/business-advice/labelling/labelling-nutrition-information/nutrition-labelling), nem az adott darab laboreredményei.

## Használat és profil

### AI-válaszok megőrzése és összehasonlítása

Az [admin AI-válaszok nézete](https://yumetrics.app/admin#ai-responses) a Food-R1 és az OpenCode válaszait, modell- és promptverzióit, a képek SHA-256-lenyomatát, a felhasználási adatokat, az ellenőrzött eredményt és a legutóbbi felhasználói jóváhagyást mutatja. Kereshető, szűrhető, az egy étkezéshez tartozó hívások összevethetők és JSON-fájlba menthetők. Az adatok PostgreSQL-ben, az `ai_requests` táblában maradnak meg, az étkezés törlése után is. A válaszarchívum nem tartalmaz képfájlt vagy belső gondolatmenetet; a felismert titkokat eltávolítjuk. A megőrzés önmagában nem indít új AI-hívást.

A gyűjtés ettől a kiadástól működik; korábban eldobott válasz nem állítható helyre. A jóváhagyott javítás összehasonlítási alap, nem méréssel igazolt referencia. A hozzáférés, méretkorlátok és adatkezelési részletek: [ADMIN.md](docs/ADMIN.md#ai-válaszarchívum).

### Látogatottság, külön analitikai előfizetés nélkül

Az [admin Látogatottság nézete](https://yumetrics.app/admin#visitors) a tényleges oldalmegnyitásokból készít napi és óránkénti grafikonokat, ország-, érkezési forrás-, oldal-, eszköz-, böngésző-, operációsrendszer- és alapnyelvi bontást. A 7, 30 vagy 365 napos nézetben a részletes darabszámok és arányok táblázatban is megnyithatók. Csak a tulajdonosi Google-fiók fér hozzá. Umami-fiók, külső mérőkód vagy új szolgáltatás nem kell hozzá; a meglévő szerver és adatbázis erőforrásait használja.

Ez **oldalmegnyitás-számlálás, nem egyedilátogató-mérés**. Nem használunk új sütit, látogatói azonosítót vagy böngésző-ujjlenyomatot; az IP-cím, teljes hivatkozó, URL-paraméter és étkezési adat nem kerül a statisztikába. A bejelentkezett tulajdonos forgalmát, az ismert robotokat, előtöltéseket és az adatvédelmi tiltást jelző kéréseket kihagyjuk. A mérés az admin Beállítások nézetében szüneteltethető. A napi adat nélküli pont nem bizonyított nulla forgalom; a bekötés előtti időszakról nincs látogatottsági adat. Részletes működés, megőrzés és korlátok: [ADMIN.md](docs/ADMIN.md#a-beépített-látogatottságmérés).

### Naplózás, jelvények és fiók

Az étkezés hozzáadásánál a **Fotó készítése** és a **Kép kiválasztása** gomb egyaránt az ablak tetején érhető el. Mobilon a fényképezés a készülék natív kameráját kéri, lehetőség szerint a hátlapi kamerával; a második, nem kötelező kép is elkészíthető közvetlenül. A natív kamera megnyitásának módját a böngésző és az operációs rendszer határozza meg.

A beküldés azonnal látható feldolgozási állapotot kap, és az ablak bezárása után a napló tetején is követhető. Az elkészült elemzést kiemelt, az átnézésig megmaradó értesítés és a böngészőfül címe jelzi. A feldolgozási ablak alján egyetlen **OK** gomb szerepel; bezárása nem szakítja meg a már beküldött feldolgozást. Mobilon a felső sáv profilképével is megnyithatod a Fiókom nézetet.

A **Fiókom → Heti kihívások** résznél hetente egy feladat választható: naplózás három különböző napon, saját receptből számolt étkezés mentése vagy külön lemért, grammban megadott összetevő rögzítése. A választott feladat haladása a kezdőlapon is látszik. Teljesítéskor gyűjthető heti pecsét jár: Ritmustaláló, Receptalkotó vagy Mértékmester. A választás, a részleges haladás és a jutalom a tartós PostgreSQL-adatbázis `weekly_challenges` táblájában marad meg, új AI-hívás nélkül.

A hét hétfőtől vasárnapig, magyarországi idő szerint tart. A háromnapos kihívásnál a mentés tényleges napját számoljuk; a visszadátumozás és az ugyanazon napi ismételt mentés nem ad több napot. A választás előtti heti mentések is számítanak; ha a feltételek már teljesültek, a pecsét azonnal jár. A háromnapos feladat hétvégén is választható, ha a korábbi mentésekkel és a hátralévő napokkal még teljesíthető. A haladás és a megszerzett pecsétek későbbi javítás vagy törlés után is megmaradnak. A következő héten új feladat választható. Részletes szabályok és tárolás: [WEEKLY-CHALLENGES.md](docs/WEEKLY-CHALLENGES.md).

A naplózást ötszintű növényes fejlődés, hat jelvény és egy gördülő hétnapos cél ösztönzi. A fejlődés különböző mentett napokra épül, a régebbi napok is számítanak; az étkezések energiatartalma nem befolyásolja a jutalmat. A kihagyás nem von le fejlődési napot, a törlés vagy dátummódosítás viszont újraszámítja a jelvényeket. A főoldali kártya és a mentés utáni visszajelzés a meglévő profiladatokból működik, új AI-kérés nélkül.

Google-belépés után tölts fel egy fotót az egész adagról; opcionálisan adj hozzá második nézetet, csomagolt terméknél olvasható címkefotót. Ezután nézd át és mentsd a piszkozatot. A kiegészítő adatokat csak akkor add meg, ha ismered őket. A feldolgozás a fotó tartós feltöltése után a háttérben folytatódik. Az eredmény később is javítható.

A **Fiókom** nézetben mai energiaösszesítés, választható 7/30/365 napos átlagok, étkezésenkénti és étkezéstípus szerinti bontás, valamint megnyitható hétnapos lista segíti az áttekintést. A részletek összecsukhatók, az időszakváltás nem jár AI-kéréssel. A nézet a Google-nevet, e-mail-címet, csatlakozást, mentett étkezéseket, aktív napokat és naplózási sorozatokat mutatja. A 365 napos, zöld aktivitási naptárból megnyithatók az adott nap bejegyzései. Az energia- és makróátlagok csak a ténylegesen naplózott napokra vonatkoznak. Piszkozat, hibás vagy törlés alatt álló elemzés és jövőbeli nap nem növeli a statisztikát; üres naplóhoz nem készülnek mintaadatok.

A felület és az új AI-elemzés magyarul és angolul is használható. A jelvényértesítések és a folyadékmennyiségek szövegei nyelvváltáskor is követik a kiválasztott nyelvet. A nyelvváltás megőrzi a kiválasztott fotókat és a szerkesztés alatt álló adatokat; a saját szövegek és a korábbi elemzések az eredeti nyelvükön maradnak. A mobilos, asztali és billentyűzettel történő használat is támogatott.

Az adminban napi aktivitási és költséggrafikonok, szűrhető működési és hibanapló, valamint hívásonkénti, USD-ben számolt AI-költségbecslés is elérhető. A becslés külön jelzi a hiányos adatokat; az új hívások rekordjai az étkezés törlése után is megmaradnak. Módszer és ellenőrzött árazás: [AI-COSTS.md](docs/AI-COSTS.md).

## Belépés, adattárolás és telepítés

### Tulajdonosi adminfelület

A [kezelőfelület](https://yumetrics.app/admin) kizárólag a Google által ellenőrzött `thisisnotka@gmail.com` fiókkal érhető el, a felső menüsáv Adminisztráció pontjából és a Fiókom nézetből is. Felhasználók és munkamenetek kezelése, étkezések és feldolgozási hibák megtekintése, részletes statisztikák, tartós alkalmazásbeállítások és változásnapló található itt. A szolgáltatói beállítások jelzéseit az átlagos felhasználó nem kapja meg. Részletek, beállítási határok és ellenőrzés: [ADMIN.md](docs/ADMIN.md). A hat ötletes kulináris jelvény és végleges promptjai: [BADGE-ART.md](docs/BADGE-ART.md).

Az alkalmazás **Node.js 24+** szerveren fut. Az éles alkalmazás és a külön, tartós lemezes **PostgreSQL 17** adatbázis az `ak91hus-team/default` Northflank-projektben található. A felhasználói fotók Cloudinaryba kerülnek; a fiókok, munkamenetek, étkezések, forrásmásolatok és feldolgozási feladatok Northflanken tárolódnak. Újraindítás és új image-re történő telepítés után az adatok megőrzését éles próbával is ellenőriztük.

A jelenlegi Google OAuth-visszatérő cím: **https://ak91hu.github.io/yumetrics/oauth.html**. A statikus GitHub Pages-oldal csak továbbítja az egyszer használható választ a Northflank szerverének. A state-, nonce-, PKCE- és ID-token-ellenőrzés, valamint a munkamenet létrehozása szerveroldalon történik. A Google-jelszót és az access/refresh tokeneket nem tároljuk; Gmail- vagy Drive-hozzáférést nem kérünk.

A `GOOGLE_REDIRECT_URI` értékének pontosan egyeznie kell a Google-klienshez regisztrált visszatérő címmel. Az `APP_ORIGIN=https://yumetrics.app` az alkalmazás elsődleges HTTPS-alapcíme; a Pages-visszatérő cím használatakor ez a két beállítás szándékosan eltér. Saját domain esetén közvetlen szerveroldali callback is használható.

A titkok kizárólag Northflank futtatási változóként kerülnek az alkalmazásba. A `.env.example` a szükséges mezők mintája; a valódi `.env`, kulcsok és felhasználói adatok nincsenek a Gitben vagy a Docker image-ben. Az adatbázis írható kapcsolati URI-ja addonkapcsolaton keresztül, `DATABASE_URL` néven érkezik.

| Beállítás | Szerepe |
| --- | --- |
| `DATABASE_URL` | A Northflank PostgreSQL írható kapcsolata |
| `APP_ORIGIN` | Az alkalmazás éles HTTPS-alapcíme |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth-webkliens |
| `GOOGLE_REDIRECT_URI` | A Google-nél regisztrált visszatérő cím |
| `OPENCODE_API_KEY`, `OPENCODE_MODEL` | Szerveroldali AI-hozzáférés; alapmodell: `gemini-3.8-flash` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Képtárolás |
| `USDA_API_KEY` | FoodData Central keresés a beépített referenciákon túl |

A fotók a Cloudinaryban hitelesítést igénylő tárolást használnak. A böngésző a saját alkalmazás `/api/meals/:id/photo/primary` és `/api/meals/:id/photo/additional` útvonalán kéri le őket; a szerver minden kérésnél ellenőrzi a tulajdonosi vagy adminjogot. Közvetlen szolgáltatói képlinket az API nem ad a felhasználónak. A fotók a naplóban csak a tulajdonosuknak és az alkalmazás tulajdonosának érhetők el, bejelentkezés után. A képek feltöltéskor újrarajzolt, átméretezett JPEG-ek; eredeti EXIF/GPS-adatot nem archiválunk.

Kulcsok és OAuth-beállítás: [API-KEYS.md](docs/API-KEYS.md). Telepítés, mentési javaslatok, helyreállítás és adatmodell: [NORTHFLANK.md](docs/NORTHFLANK.md).

## Fejlesztés és ellenőrzés

```powershell
npm ci
npm test
py -3.11 -m venv work/mkdocs-venv
& work/mkdocs-venv/Scripts/python.exe -m pip install -r scripts/requirements-docs.txt
$env:MKDOCS_PYTHON = (Resolve-Path work/mkdocs-venv/Scripts/python.exe).Path
npm run build
```

A PostgreSQL-integrációs tesztekhez külön tesztadatbázis kapcsolatát kell megadni a `TEST_DATABASE_URL` folyamatváltozóban. Az admin PostgreSQL-próbáihoz egy másik, `_admin_test` végű tesztadatbázis kapcsolata szükséges `TEST_ADMIN_DATABASE_URL` néven. A megfelelő változó nélkül az adott PostgreSQL-próbák kimaradnak. A tesztekhez ne használj éles adatbázist. A böngészős ellenőrzés `node scripts/browser-check.mjs` paranccsal fut, headless Chrome-ban. A `TEST_LANGUAGE=hu|en` és `TEST_DEVICE=mobile|desktop` választja ki a nyelvet és a kezelőfelületet.

A tesztek a teljes adagot, a receptszámítást, a tápértékforrások kezelését, a Google-belépési határokat, a felhasználók elkülönítését, az adatmegőrzést, a profil statisztikáit és a mobilos/asztali működést ellenőrzik. Részletes bizonyítékok és a nem ellenőrzött területek: [VERIFICATION.md](docs/VERIFICATION.md).

A korábbi review hét javított találatcsoportját a [2026. november 9-i jelentés](docs/REVIEW-2026-11-09.md), a későbbi címke- és elkészítésjavításokat a [2026. november 10-i felülvizsgálat](docs/CODE-REVIEW-2026-11-10.md) rögzíti. A legfrissebb ellenőrzési eredmények a [VERIFICATION.md](docs/VERIFICATION.md) elején találhatók.

A publikálható útmutató forrása a [public/help.html](public/help.html). A build önálló magyar és angol HTML-csomagot készít a `dist/documentation` könyvtárban. Közzététel: [PUBLISHING.md](docs/PUBLISHING.md). Arculati elemek: [ASSETS.md](docs/ASSETS.md).

## Az első megnyitás nyelve

Magyarországi IP-címről magyarul, más országból vagy ismeretlen helyről angolul indul az oldal. A nyelvválasztóval megadott beállítás megmarad. Az országot a szerver a mellékelt, 2026. novemberi DB-IP-adatbázisból olvassa ki, külső kérés és IP-címek tárolása nélkül. VPN vagy proxy esetén az ország eltérhet a látogató tényleges helyétől. A külön nyelvű útmutatók és a magyar adminfelület nyelve rögzített. Részletek: [nyelvi elvek](docs/LANGUAGE.md), [adatforrás és frissítés](lib/geoip/README.md).

A fotók védett képtári tárolást és munkamenethez kötött kiszolgálást használnak. A belépési próbálkozásokat, feltöltéseket, adatkereséseket és párhuzamos nagy kéréseket korlátozzuk. A 2026. november 9-i vizsgálat eredményei és javításai: [biztonsági audit](docs/SECURITY-AUDIT-2026-11-09.md).

## Ételnevek és ételenkénti tápértékek

Az elemzés minden felismert ételt, italt, köretet és szószt külön névvel sorol fel. Többféle étel ugyanazon a képen közös étkezéshez tartozhat; a két nézetben ismétlődő elemeket egyszer számoljuk. Az étkezés részleteiben a megadott adagra számított energia, fehérje, szénhidrát, zsír, rost, cukor, nátrium és telített zsír ételenként és összesítve is látható. A táblázat a mennyiség vagy a tápérték javításakor frissül, a régebbi mentett bejegyzésekből is elkészül, és az adminban is megtekinthető. Az ismeretlen adat „—” marad; a grammos tömeget és a milliliteres térfogatot külön mutatjuk. Saját receptnél az adagra jutó alapanyagok szerepelnek, a kész étel újbóli hozzáadása nélkül. A fotós felismerés továbbra is becslés, ezért az eredményt mentés előtt ellenőrizni kell.

## Rövid súgók a felületen

A kérdőjeles gombok a második fotóhoz, a lemért mennyiségekhez, az adagra számított tápértékekhez, a szerkesztéshez, a kalóriatartományhoz és az AI saját bizonyossági jelzéséhez adnak magyarázatot. Az admin költségkártyáján külön súgó tisztázza a becslés és a hiányzó adatok jelentését; a látogatottságnál egy másik buborék magyarázza a számlálás korlátait. A lényeges kitöltési útmutatók a súgó megnyitása nélkül is olvashatók.

A súgó érintéssel, kattintással, illetve a gombra lépve Enterrel vagy szóközzel nyitható meg; Escape-pel, a gomb újbóli megnyomásával vagy a buborékon kívülre kattintva bezárható. A buborék a képernyőn belül marad, görgetéskor bezárul. A napló súgói követik a magyar vagy angol nyelvválasztást; az admin magyar marad. Megnyitásuk nem módosítja a kitöltött mezőket és nem indít AI-kérést.

A forrástár két README-je: ez az alkalmazásleírás és a [GeoIP-adatbázis dokumentációja](lib/geoip/README.md). A korábbi vizsgálatok dátumozott dokumentumai a saját ellenőrzésük eredményét őrzik; az aktuális állapotot a [VERIFICATION.md](docs/VERIFICATION.md) legfrissebb bejegyzése írja le.

## Teljes kódellenőrzés

A 2026. november 9-i teljes review tíz hibát tárt fel; mindet javítottuk. A javítások megőrzik a lassú válasz közben végzett szerkesztést, védik az összetevők USDA-forrásválasztását, megállítják az elavult feldolgozóból induló AI-kérést, és egységesítik a tápértékek ellenőrzését. A heti kihívás választása, a törlés és az energiakeret mentése is kapott versenyhelyzetet vizsgáló böngészős próbát. Részletek, reprodukciók és korlátok: [teljes review](docs/CODE-REVIEW-2026-11-09.md). Az akkori ellenőrzés 130 sikeres Node-tesztet tartalmazott, helyi PostgreSQL-lel, kihagyás nélkül; a böngészős próba saját ideiglenes profilja futás után törlődik.

## Mért képelemzési költség és pontosság

A v14 alapmodellje Gemini 3.5 Flash Lite. A végső, négy étkezéses páros mérésben a szolgáltatói költség 24,4%-kal csökkent. A kalóriahiba tömegadat nélkül 96,36-ról 88,48 kcal-ra mérséklődött; ismert össztömegnél lényegében azonos maradt: 52,07 és 52,12 kcal. A nyolc helyzet együttes hibája 74,22-ről 70,30 kcal-ra csökkent. A részmutatók nem mind javultak, a kis minta nem általános pontossági garancia.

Az OpenCode a két fényképet egyetlen kérésben kapja meg. A kiválasztott USDA- és címkeértékeket a szerver tölti ki; a modellnek ezeket nem kell újra leírnia. A teljes, elvetett próbákat is tartalmazó mérés 44 új hívása 1,1475516 USD volt. Módszer, pontos részmutatók, képlenyomatok és korlátok: [AI-EFFICIENCY-2026-11-09.md](docs/AI-EFFICIENCY-2026-11-09.md).

## Opcionális második fotó

A v15-ben egy fotóval is elindítható az elemzés. A második képet a magyar és angol feltöltőfelület is opcionálisként jelzi, és elmagyarázza, hogyan segíthet egy másik nézet vagy egy olvasható címke. Egy képnél nem kérünk képpár-ellenőrzést; két feltöltött képnél az azonos adag, eltérő nézőpont és használhatóság ellenőrzése megmarad. Az értékelhetetlen kép, az ismételt vagy hibás második kép továbbra is elutasítható. A korábbi v14-es pontosságmérés kétképes bemenetekkel készült; az egy- és kétképes felismerés pontosságkülönbségét most nem mértük újra.

## Beküldés utáni visszajelzés

A feltöltés és a háttérelemzés ablakában kiemelt OK gomb is van. Ez az ablakot zárja be; az elemzés folytatódik, az étkezés mentéséhez később külön jóváhagyás kell. Az ellenőrzésre váró eredmények az oldal tetején, görgetés közben is látható, kiemelt jelzésben jelennek meg, „Átnézés és mentés” gombbal. Az OK-val bezárt feldolgozási ablak nem nyílik vissza váratlanul.

A Onesvibe domainazonosító meta tag a bejelentkezés nélküli és a bejelentkezett kezdőlap HTML-fejlécében is szerepel, így a külső ellenőrzéshez nem kell belépés vagy JavaScript.

## Food-R1 és OpenCode együtt

A Food-R1 8B a Modalon rövid ételnév-javaslatokat ad, az OpenCode pedig egyetlen kérésben, az eredeti fotókból ellenőrzi őket és elkészíti a teljes elemzést. A tápértékszámítás és a külön mentés változatlan. Hibás segédválasz vagy a belső havi keret elérése esetén az önálló OpenCode-elemzés folytatódik. A két hívás költsége az adminban külön látszik; a Modal becslése csak a mért modellbetöltési és feldolgozási erőforrásrészt tartalmazza.

A beállításokat, a hitelesített végpontot, a 15 USD-s alapértelmezett belső havi keretet és az automatikus GPU-leállást a [Modal útmutató](docs/MODAL.md) írja le. A [modellkutatás és a két étkezéses páros próba](docs/FOOD-MODELS-2026-11-10.md) alapján a Food-R1 a nagyobb, szabadon futtatható jelöltek közül kapott szerepet. Kevés a független felhasználói visszajelzés; a kis próba nem igazol általános pontossági vagy költségelőnyt. A teljes erőforrásköltség nőhet, az ingyenes Modal-keret mérsékelheti a fizetendő összeget.
