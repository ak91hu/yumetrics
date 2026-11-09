# Képelemzési pontosság és költség – 2026. november 9.

A végső összehasonlításban a `gemini-3.8-flash` és a `food-v14-lean-evidence` változat 24,4%-kal kisebb szolgáltatói költséget adott. A négy étkezés nyolc vizsgálati helyzetében a kalóriahiba átlaga 74,22-ről 70,30 kcal-ra csökkent. Ez kis, feltáró mérés; nem igazol általános pontossági százalékot vagy minden ételnél javulást.

## Módszer és döntés

A korábbi, `c0ad3cf` commit szerinti Gemini 4 Argon/v13 változatot hasonlítottuk az új megoldáshoz. A [Nutrition5k szerzői adatkészletéből](https://github.com/google-research-datasets/Nutrition5k) származó képekhez összetevőnként lemért tömeg és USDA-ból számolt referencia tartozik, nem laboratóriumi energiamérés. Licenc: CC BY 4.0, Google Research / Nutrition5k szerzői. A referenciaadatokat és az elvárt ételneveket a modell nem kapta meg.

Összesen nyolc különböző étkezés szerepelt a fejlesztési és ellenőrzési próbákban. A végső páros összehasonlítás négy étkezést tartalmaz: két ismert, nehezebb fejlesztési esetet és két új ellenőrző esetet. Mindegyiknél külön futott a képpár önmagában és ugyanaz a képpár a lemért össztömeggel; a csont/héj levonása és a tápértékszámítás szerveroldali. A fényképek azonosságát SHA-256-lenyomatok ellenőrzik.

Az új ellenőrző eseteket az RGB- és mélységi tesztfelosztás közös listájából választottuk, a korábbi esetek kizárásával: 3–8 összetevő, 150–1000 g, az azonosítók SHA-256 szerinti sorrendje. Az első két új eset a rövidített Argon-változat ellenőrzésére szolgált; az azt követő kettőt az első, rájuk indított modellhívás előtt lezártuk. Csak RGB-képet használtunk, mélységi adatot nem. A részletes kiválasztás, azonosítók, referencia-összetevők, képlenyomatok, promptlenyomatok, tokenek és a sikertelen próbák is a [géppel olvasható naplóban](AI-EFFICIENCY-2026-11-09.json) szerepelnek.

## A végső összehasonlítás

Minden érték a teljes adagra vonatkozó kcal. Mindkét változat mind a nyolc végső összehasonlító helyzetre értékelhető eredményt adott.

| Étkezés | Referencia | Régi, képpár | Új, képpár | Régi, ismert tömeg | Új, ismert tömeg |
|---|---:|---:|---:|---:|---:|
| Csirke, brokkoli, répa, spenót | 380,3 | 240,7 | 238,8 | 280,8 | 252,3 |
| Tojásfehérje, reszelt burgonya, gyümölcs | 274,2 | 142,8 | 181,1 | 197,4 | 206,3 |
| Dinnyés-bogyós gyümölcstál | 73,0 | 67,3 | 84,9 | 62,6 | 63,3 |
| Rántotta, görögdinnye, ananász, bogyósok | 286,2 | 177,5 | 178,8 | 307,8 | 289,1 |

| Mutató | Régi | Új |
|---|---:|---:|
| Átlagos abszolút kcal-hiba, tömegadat nélkül, n=4 | 96,36 | 88,48 |
| Átlagos abszolút kcal-hiba, ismert tömeggel, n=4 | 52,07 | 52,12 |
| Együttes átlagos abszolút kcal-hiba, n=8 | 74,22 | 70,30 |
| Nyolc hívás szolgáltatói költsége | 0,258920 USD | 0,1956405 USD |
| Bemeneti tokenek, képekkel együtt | 80 960 | 67 032 |
| Választokenek | 9700 | 7480 |
| Gondolkodási tokenek | 0 | 5199 |
| Bemenet + válasz + gondolkodás | 90 660 | 79 711 |

A két végső új ellenőrző étkezést külön nézve a tömeg nélküli kcal-hiba **57,21-ről 59,66-ra nőtt**, az ismert tömegű hiba **16,00-ról 6,29-re csökkent**. A négy helyzet együttes hibája 36,60-ról 32,98 kcal-ra mérséklődött. A romló részmutatót nem hagytuk el. A mérési kerekítés miatt a táblázatból kézzel számolt átlag kis mértékben eltérhet a teljes pontosságú JSON-adattól.

A reszelt burgonyát az új változat mindkét fejlesztési helyzetben felismerte; a régi csak az ismert tömegű esetben. Ez konkrét megfigyelés, nem általános ételfelismerési pontosság. A különböző gyümölcsfajták felismerését és az összetevők pontos tömegarányát nem tekintjük bizonyítottnak pusztán az egyező összkalóriától. A csirkés tányér ismert tömegű becslése az új változatban rosszabb lett; a takart, sűrű összetevő továbbra is érdemi hibaforrás.

## Mit változtattunk?

- Az új alapmodell Gemini 3.8 Flash. Az adminban továbbra is állítható; a korábbi modellel készült bejegyzések és költségpillanatképek megmaradnak.
- Az ismétlődő belső utasításokat rövidítettük. A magyar és angol kimenet, a 44 referencia neve, leírása, állapota és helyettesítési megkötése, valamint a magyar ételcsoportok érdemi útmutatása megmaradt. A csoportonkénti előre megírt kérdéssorokat elhagytuk; továbbra is legfeljebb egy opcionális kérdés megengedett.
- A modellnek nem kell másodszor leírnia a már kiválasztott USDA- vagy használható címkeadatokat: `nutrients=null`, a számokat a szerver tölti ki. Egyébként teljes `nutrients` objektum kötelező. A hiányzó becslést elutasítjuk, nem helyettesítjük kitalált nullával vagy újabb fizetős kéréssel. A tárolt étkezések formátuma továbbra is v2.
- A képi azonosság ellenőrzése a formára, vágásra, felszínre, pirulásra és elkészítésre is figyelmeztet. A világos szín önmagában nem azonosít egy reszelt ételt; a takart, sűrű részeket sem szabad puszta képfelület alapján könnyű köretnek tekinteni.
- Az admin a Flash ellenőrzött árával is számol, a gondolkodási és cache-tokenek külön kezelésével. Az értékelő a sikertelen hívások költségét is összesíti; a hiányzó költség ismeretlen marad. A környezeti modellválasztás az értékelőben felülírja a helyi `.env` értékét.

Továbbra is egyetlen szolgáltatói kérés készül étkezésenként. A két kép, a felbontás és a 10 000 tokenes válaszkeret nem csökkent; nem adtunk új mintavételi vagy gondolkodási paramétert. A két modell alapértelmezett gondolkodása eltér: a Flash gondolkodási tokenjeit a táblázat és az árösszevetés is tartalmazza. Cache-találatot nem feltételeztünk; a végső páros mérésben nem volt jelentett cache-token.

## Elvetett változatok, ellenőrzések, teljes költség

Az első, mezőnként opcionális tápértéksémát elvetettük: egy nem referenciás összetevőnél hiányos becslést engedett meg. A teljes becslés ezért egy kötelező szerkezetű, önmagában nullázható objektumba került. A rövidebb Argon-utasítás önmagában nem javított megbízhatóan a kalóriahibán; nem ez lett az új alapmodell. Minden változat eredménye és elutasítása megmaradt, a részmutatókat eltérő elfogadási arány mellett nem keverjük össze.

A végső Flash-változat négy valós szolgáltatói ellenőrzése sikeres: eltérő étkezések elutasítása; azonos nézet újratömörített képének elutasítása; üres képpár elutasítása; ellenőrzött mesterséges italcsomagolás és címke helyes 330 ml-es, 132 kcal-os, 16,5 mg nátriumot tartalmazó eredménye. A címkepróba nem valódi ételfotós pontosságmérés.

A teljes mostani vizsgálat **44 új szolgáltatói hívása 1,1475516 USD** volt, az elvetett és elutasított próbákkal együtt. Négy korábbi alapmérési választ újrahasznosítottunk, új számlázás nélkül. Az előre korlátozott keret 1,50 USD; nem fut további automatikus mérés vagy újrapróbálás. Ez fejlesztési mérési költség, nem egy felhasználói étkezés költsége.

## Források, újrafuttatás, korlátok

A [Google képfeldolgozási útmutatója](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/image-understanding) alapján a két képet egyértelműen indexeljük; a felbontást nem csökkentettük. Az árak forrása az [OpenCode hivatalos díjtáblája](https://opencode.ai/docs/console/models/#pricing), ellenőrizve 2026-11-09. A két modell összehasonlítása az aznapi tényleges szolgáltatói költségeket használja, nem jövőbeli vagy minden fotóra érvényes megtakarítási ígéretet.

Újrafuttatáshoz a JSON `cases` mezőjéből készíthető helyi, relatív képútvonalas manifest. A képek és az oldalnézeti videók a Nutrition5k nyilvános tárhelyén érhetők el; az első képkocka kinyerését a [korábbi mérés](AI-VALIDATION-2026-11-09.md) ismerteti. A képlenyomatokat ellenőrizni kell. Futtatás: `node scripts/evaluate-nutrition.mjs manifest.json` ellenőrzéshez, majd `--run` a fizetős méréshez; az `OPENCODE_MODEL` környezeti változóval választható modell. A régi alapváltozat forrása a `c0ad3cf` commit. A használati adatokat a szolgáltatótól kell visszaolvasni; a megismételt válasz és költség eltérhet.

Nincs ismételt mintavétel vagy statisztikai szignifikanciavizsgálat. A képek kaliforniai étkezdéből származnak, nem igazolják a magyar konyha vagy minden telefonos helyzet pontosságát. Az új Flash fotós mérése magyar kimenettel futott; az angol felületet és a nyelvi kéréskezelést helyettesített szolgáltatóval is teszteltük. Szakértő által vakon pontozott ételazonosítási teszt nem történt. A fotó továbbra sem helyettesíti a lemért összetevőt vagy az ismert receptet.
