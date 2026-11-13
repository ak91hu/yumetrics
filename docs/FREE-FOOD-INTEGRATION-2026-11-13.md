# Gemini + ingyenes adatforrások + feltételes Food-R1

Megvalósítva a repositoryban 2026-11-13-án. Új fizetős AI-pontosságmérés nem történt.

**Aktuális alapfolyamat: teljesen automatikus összeállítás**, `food-v22-required-nutrient-fallback`. A felhasználó a kész tápérték-összesítést látja; nincs kötelező forrásválasztás vagy pontosító kérdés. A kézi szerkesztő alapból csukva van, csak külön kérésre nyílik meg. Feltöltés után a folyamatban lévő bejegyzéshez nem nyílik automatikusan szerkesztő; a kész eredmény jelenik meg, amikor minden háttérlépés befejeződött. A naplóba mentés továbbra is felhasználói művelet.

Bizonytalan azonosságnál a fő felismerési hipotézishez is használható pontosan illeszkedő adatbázisrekord. Ez a feltételezett étel összetételét adja, nem bizonyítja a vizuális azonosságot. Az ilyen illesztés `provisional_identity` nyomot kap, a bizonyosság alacsony marad, a forrás nincs felhasználó által megerősítettként jelölve, és a mennyiségi tartomány relatív szélessége nem szűkül. A Food-R1 nyers javaslatai belső naplóban maradnak; a felhasználó összesített bizonytalansági jelzést kap. A jelentés kérdéslistája az új automatikus útvonalon üres.

A v22-es javítás minden összetevőhöz kötelező tartalék tápértékbecslést kér ugyanabban a Gemini-válaszban. Így pontos adatbázistalálat nélkül is elkészülhet egy becsültként jelzett eredmény; az illeszkedő referencia és az eredeti olvasható címke továbbra is elsőbbséget élvez. A kimeneti keret 1600 token maradt, és a javítás nem indít újabb AI-hívást. A hibás vagy hiányos tápértékeket továbbra is elutasítjuk.

A korábbi kézi pontosítást leíró részek az opcionális szerkesztőre vonatkoznak. A vizuális böngészőtesztet a számítógép-vezérlés biztonsági ellenőrzése leállította, mert nem tudta megbízhatóan azonosítani a böngésző aktuális URL-jét. Vizuális sikeres tesztet nem állítunk; a megjelenítőmodul és a teljes feldolgozási/mentési útvonal automatizáltan ellenőrzött.

## Az új útvonal

1. Egyetlen Gemini 3.5 Flash Lite kérés az eredeti fotókkal. A strukturált válasz rövid angol adatbázis-keresőkifejezést, külön ételazonossági bizonytalanságot és opcionálisan látható háztartási adagszámot is ad.
2. Ha egy látható, nem csomagolt összetevő azonossága erősen bizonytalan (`identityUncertain=true`, vagy alacsony bizonyosság mellett alternatívák vannak), a konfigurált Food-R1 legfeljebb egyszer megkapja a fotókat. Széles tömegtartomány, hiányzó tápérték vagy API-kiesés önmagában nem indít segédhívást.
3. Ingyenes adatforrások keresése. Egyértelmű, pontos egyezés esetén az adatbázis tápértéke váltja az AI által becsült értékeket. Az eltérő változatot vagy elkészítési módot nem helyettesítjük automatikusan.
4. Szerveroldali egységellenőrzés, adagszámítás és validálás; tartós, felhasználó által javítható piszkozat.

Nincs újabb Gemini-kérés, fordító-LLM vagy automatikus javítókör. A kérés előtti külön költségellenőrző API-hívás sem került be. A történeti, előzetes Food-R1-es kontroll csak a benchmark explicit `recognitionBefore` opciójával fut; ez nem az éles alapútvonal.

## Bekötött források

| Forrás | Bekötött képesség | Hozzáférés |
| --- | --- | --- |
| USDA FDC/FNDDS | Keresés Foundation/SR Legacy/FNDDS rekordokra, részletes tápérték és háztartási adag | Saját ingyenes `USDA_API_KEY`; futás közben nincs DEMO_KEY. A 44 helyi USDA-referencia kulcs nélkül is működik. |
| Health Canada CNF | Angol étellista, tápérték és adagszorzók | Kulcs nélküli olvasás. A régi API kiadási évét nem azonosítjuk automatikusan a 2026-os letölthető adatkiadással. |
| Svéd Livsmedelsverket | Teljes angol étellista és tápértékrekordok | Kulcs nélküli olvasás, CC BY 4.0 |
| Norvég Matvaretabellen | Angol étel-, tápérték- és adatrekordok a teljes JSON-ból | Kulcs nélküli olvasás, CC BY 4.0 a jelenlegi kiadás szerint |
| Open Food Facts | Érvényes, pontos vonalkódhoz v3.6 termékadatok és modern `nutrition.aggregated_set` | Kulcs nélküli olvasás; User-Agent; ODbL-1.0. Az eredeti, használható címkét nem írja felül. |

A CNF ehetőrész-/hozamadatainak és a svéd osztályozási/alapanyag-végpontoknak a létezését a kutatás dokumentálja, de ezekből még nem számolunk automatikus csontlevonást vagy készre főzési tömeget. A bekötés az igazoltan használható tápérték- és adagadatokra koncentrál. A Ciqual/Fineli/CoFID letöltésekhez nem találtunk ebben a körben minden szempontból igazolt, szükséges új REST API-t; a FatSecret ingyenes US-csomagja nem ad igazolt ingyenes magyar lefedettséget.

## Biztonságos egyeztetés és számítás

- A magyar és angol helyi nevekhez rögzített referenciák használhatók. A külső angol leírások szóalak- és szórend-normalizálás után egyedi, pontos egyezést igényelnek. Fuzzy hasonlóság alapján nem emelünk becslést igazolt adatforrássá. Emiatt a konzervatív első változat egyes valódi találatokat kihagyhat.
- Nyers/főtt/sült állapot, konkrét termékváltozat és g/ml alap egyezése szükséges. A főzési módszerek nem egyenértékűek. Ismeretlen sűrűséggel nincs g/ml váltás.
- USDA és CNF összes szénhidrátjából csak ismert rostadattal számolunk rost nélküli szénhidrátot. A svéd és norvég elérhető szénhidrátból nem vonjuk le újra a rostot.
- OFF esetén ismert szénhidrát-definíció, pontos 100 g vagy 100 ml alap, megfelelő termékállapot és hibajelzés nélküli rekord kell. A modell által olvasott részleges címkével való ellentmondást is kizárjuk. A „<” és becsült tápérték nem lesz pontos szám.
- Az adagszorzó csak megfelelő, egyedi háztartási mértékhez és látható darabszámhoz használható. CNF: a tápértékszorzó × 100 adja az adagtömeget grammban. A vizuális tartomány relatív szélessége megmarad; a tipikus adag nem lesz lemért tömeg. A megadott össztömeg és a használható csomagcímke elsőbbséget élvez.
- Az API-k nem kapnak fotót, fiókazonosítót vagy megjegyzésszöveget. Az USDA csak az angol keresőkifejezést, az OFF a vonalkódot kapja; a többi szolgáltatónál nyilvános katalógusok és konkrét ételazonosítók lekérése történik. Nincs adatfeltöltés a forrásokba.

## Alkalmazáson belüli kézi pontosítás

A piszkozat forráskeresője is az új adaptereket használja. A helyi USDA-nevek magyarul is kereshetők, a külső kereséshez angol ételnév használható. A kereső több adatforrás találatait kínálja; minden találatnál látható a kiadó és az étel állapota. Az automatikus, szigorú egyeztetéstől eltérően itt a részleges egyezés csak felhasználó által kiválasztható jelölt.

Kiválasztáskor a szerver a szolgáltató és az azonosító alapján újra ellenőrzi a teljes rekordot, és eltárolja a hiteles forráspéldányt. A felület a kiválasztott étel nevét, tápértékét, állapotát és forrását frissíti; a mennyiség nem változik. Közben megváltozott vagy bezárt szerkesztőbe nem kerül késői válasz. A mértékegység eltérése és a hiányos rekord kizárja a cserét. Mentéskor a meglévő forrásellenőrzés védi a rekordot a kliensoldali hamisítástól.

Útvonalak: `GET /api/food-sources/search?q=...`, `GET /api/food-sources/{provider}/{id}`. A forrásokhoz legfeljebb 5-5 találat szerepel, így az USDA nem szorítja ki az összes többi szolgáltatót. Az egyidejű azonos katalóguslekérések a tartós cache olvasása alatt is közös kérést használnak. A párhuzamos kérésfoglalás sem lépheti túl a 16-os belső hálózati keretet.

Valódi helyi HTTP-próbában a Northflankon már meglévő USDA-kulccsal az alkalmazás keresője USDA-, CNF- és norvég találatokat adott; a CNF- és USDA-rekord kiválasztása egyaránt HTTP 200 lett. Ez ideiglenes helyi adatbázissal történt, nem éles felhasználói munkamenettel. Külső adatlekérések: 7, AI-hívások: 0. A kulcs nem került fájlba vagy kimenetbe. Jegyzőkönyv: `work/free-food-search-http-2026-11-13.json`.

## Food-R1 és a fennmaradó bizonytalanság

A jelenlegi Food-R1 rövid ételneveket ad, ezért a válasza nem javítja bizonyítottan a tömeget, és nem dönti el automatikusan a Gemini által felsorolt alternatívákat. A javaslatok láthatók a piszkozat megfigyelései között; célzott ételazonosítási kérdés jelenik meg. A tápérték, a mennyiség és az eredeti étellista nem íródik át pusztán a segéd állítása alapján. Egyetértéskor sincs bizonyosságnövelés vagy tartományszűkítés.

Segédhiba, tiltott havi keret vagy hiányzó konfiguráció esetén a Gemini eredménye és a pontosítási kérdés megmarad. Rossz fotó, hibás mennyiség és feldolgozhatatlan válasz nem indít további fizetős javítókérést. A munkafolyamat tulajdonjogát a segéd indítása előtt is ellenőrizzük, így elveszett job-lease után sem indul új fizetős hívás.

## Gyorsítótár, hálózat és tartós források

`FREE_FOOD_APIS=1` az alapérték. A `FREE_FOOD_SOURCES=usda,cnf,slv,matvare,off` szűkíthető; `FREE_FOOD_APIS=0` letiltja az új külső lekéréseket. API-kieséskor nem indul új AI-hívás. Megfelelő referencia nélkül a már meglévő becslés marad, ha érvényes; hiányzó tápértéket nem pótolunk kitalált számmal.

Az adatlekérés közös időkerete 12 másodperc, egy hálózati kérésé legfeljebb 5 másodperc. Legfeljebb 16 új hálózati kérés és 12 feldolgozott összetevő szerepel egy menetben; a többi összetevő meglévő forrását/becslését a normál validálás kezeli. Teljes katalógusok 7 napra, részletek 1 napra, sikertelen lekérések 5 percre kerülnek gyorsítótárba. A válasz legfeljebb 20 MiB; átirányítás és tetszőleges külső célcím nem megengedett.

A folyamaton belüli gyorsítótár mellett tartós PostgreSQL/SQLite cache és atomi szolgáltatói kéréskvóta működik. Az OFF-korlát konzervatívan 14 termékkérés/perc, az USDA automatikus ágáé 1000/óra; az esetleges, más kódból vagy alkalmazásból érkező kéréseket a szolgáltató ugyanazon IP/azonosító alatt szintén beleszámíthatja. A szolgáltató 429-es válasza sikertelen adatlekérésként kezelődik. A CNF/svéd/norvég korlát belső terheléskorlát, nem kiadói korlátlansági ígéret. Az adat-API-kra nincs szolgáltatói díj az itt használt nyílt olvasási hozzáférésnél; a saját infrastruktúra költsége megmarad.

Új migrációk: `drizzle/0012_food_api_cache.sql`, `postgres/0010_food_api_cache.sql`. Az OFF rekordjai külön `off_product_records` táblában maradnak a licencükkel és forrásukkal; más külső rekordok a meglévő `food_records` táblában kapnak `ext-*` azonosítót. A mentési API csak szerveroldalon tárolt rekordot fogad el, a kliens által küldött önkényes `referenceRecord` nem hitelesíti magát. Szerkesztett tápérték esetén a referenciajelölés elvész. A felület a tényleges forrást és licencet mutatja, nem nevez minden adatot USDA-adatnak.

## Ellenőrzés

A teljes végső szoftverteszt: **222 tesztből 200 sikeres, 22 környezetfüggő kihagyás, 0 hiba**. A kihagyások között a külön teszt-PostgreSQL-kapcsolatot igénylő ellenőrzések vannak; a PostgreSQL-élesítést ez nem igazolja. A kiadási és szigorú dokumentációbuild sikeres. A forrásmegjelenítés külön tesztje ellenőrzi a g/ml-szűrést, a tényleges kiadót, a licencet és a HTML-escape-et. A kézi kereső új végpontjaihoz további tesztek igazolják a bejelentkezést, a közös kéréskorlátot, a forrás kiválasztását, a mentést és újratöltést, valamint a párhuzamos kérésösszevonást.

A célzott szoftvertesztek lefedik a szolgáltatói normalizálást, az egység- és forráshibákat, a hiányzó értékek kezelését, a cache-t, az atomi kvótát, az egyetlen alap AI-kérést, a feltételes Food-R1-et, valamint a piszkozat mentését/újratöltését és a hamisított forrás elutasítását.

Valódi ingyenes lekérésből az új CNF-kereső Gouda rekordot és 3 adagot, a svéd adapter marhafaggyú-rekordot adott. Valódi korábbi norvég válaszból az adzukibab normalizálása sikerült. Az USDA DEMO_KEY kizárólag külön kutatási próbájában a zabpehely-rekord normalizálása sikerült. Az OFF staging Nutella-rekordját az adapter a kapott `en:nutrition-data-per-serving-missing-serving-size` minőségi hiba miatt helyesen nem használta fel. Az OFF sikeres átváltását típusos szoftverfixture ellenőrzi; nem állítunk minden termékre használható tápértéket.

Helyi nyers eredmény: `work/free-food-integration-smoke-2026-11-13.json`. **Új fizetős Gemini- vagy Food-R1-hívás: 0.** Ez működési ellenőrzés, nem fotós pontossági benchmark. Az új folyamat 3 Ft alatti költségét és fotós pontosságát még külön kell mérni. A Food-R1 hidegindítás és az aktuális Modal-kredit a kivételág költségét továbbra is befolyásolja; nincs garantált 3 Ft-os maximum.
