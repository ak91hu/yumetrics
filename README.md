# Yumetrics

![Yumetrics — your food, in numbers](public/brand-banner.svg)

**[Élő alkalmazás](https://yumetrics.app)** · **[Magyar útmutató](https://yumetrics.app/utmutato)** · **[English guide](https://yumetrics.app/guide)**

Frissítve: 2026. november 9. · AI-módszerváltozat: `food-v15-optional-view`.

Magyar és angol nyelvű étkezési napló Google-belépéssel, fotó alapján becsült tápértékekkel és javítható összetevőkkel. Az első AI-becslés a képen látható **teljes ehető étel és ital 100%-ából** indul ki; a naplóba mentendő mennyiséget a piszkozatban ellenőrizheted és javíthatod. A fotós elemzés nem közvetlen kalóriamérés: a felismerést, a mennyiségi becslést, a tápértékforrást és a számítást külön kezeljük.

## A számítás módszere és az AI szerepe

1. **Fotó és vizuális leltár.** Egy fotó kötelező, a második opcionális. Egy másik szögből készült kép segíthet a felismerés és az adagbecslés pontosításában; csomagolt terméknél az olvasható tápértéktábla is hasznos. Az azonos képtartalmat feltöltés előtt elutasítjuk. A Gemini 3.8 Flash a feltöltött kép vagy képek és a megadott információk alapján javaslatot tesz az ételre, az összetevőkre, az elkészítési állapotra és a g-ban vagy ml-ben megadott ehető mennyiségekre. A köretet, szószt és italt is számba kell vennie. Megkülönbözteti a látható vagy megadott elemeket a feltételezésektől, például a nem látható olajtól. Egyetlen részletes AI-kérés tartalmazza a képek ellenőrzését, a leltárt, az adag- és tápértékbecslést, valamint a végső ellenőrzést.
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

Az egyetlen AI-kérésben az étel-, ital- és édességfelismerés mellett címkeolvasás is történik. Teljes termékfotó + ugyanazon csomag másik oldalán olvasható tápértéktábla is elfogadott képpár. A címke eredeti számai, alapja, termékneve, márkája, nettó mennyisége, olvasható összetevő- és allergénszövege megmarad; a vonalkód ellenőrzőszámát ellenőrizzük, de termékadatbázisból nem találgatunk márkás termékértéket. A szerver átszámítja az adagértékeket 100 g/100 ml alapra, a kJ-t kcal-ra, a sót nátriumra, az amerikai összes szénhidrátot rost nélküli értékre. Az energia- és sóadatok összhangját azonos, 100 g/100 ml-es alapon ellenőrzi. A címkés csomagmennyiséget nem kerekíti a fotós becslés ezredes felbontására. Az olvashatatlan értéket hiányzó adatként (`null`) tároljuk, nem nullaként (`0`). A gramm és ml nem válik egymásba sűrűség nélkül. A címke megváltoztatott tápértéke saját adat lesz, a címkés forrásként megjelölt eredeti pillanatkép nem írható át kliensoldalról.

Bontatlan csomagnál a látható teljes csomagok nettó mennyisége az alapértelmezett adag; felbontott csomagnál a teljes kiszerelésből nem következtetünk a maradékra. A naplózott mennyiséget a felhasználó mentés előtt ellenőrzi és módosíthatja. Az AI-alapú címkeolvasás és a gyártói adatok is korlátosak: [a címke tápértékei átlagos értékek](https://www.fsai.ie/business-advice/labelling/labelling-nutrition-information/nutrition-labelling), nem az adott darab laboreredményei.

## Használat és profil

### Látogatottság, külön analitikai előfizetés nélkül

Az [admin Látogatottság nézete](https://yumetrics.app/admin#visitors) a tényleges oldalmegnyitásokból készít napi és óránkénti grafikonokat, ország-, érkezési forrás-, oldal-, eszköz-, böngésző-, operációsrendszer- és alapnyelvi bontást. A 7, 30 vagy 365 napos nézetben a részletes darabszámok és arányok táblázatban is megnyithatók. Csak a tulajdonosi Google-fiók fér hozzá. Umami-fiók, külső mérőkód vagy új szolgáltatás nem kell hozzá; a meglévő szerver és adatbázis erőforrásait használja.

Ez **oldalmegnyitás-számlálás, nem egyedilátogató-mérés**. Nem használunk új sütit, látogatói azonosítót vagy böngésző-ujjlenyomatot; az IP-cím, teljes hivatkozó, URL-paraméter és étkezési adat nem kerül a statisztikába. A bejelentkezett tulajdonos forgalmát, az ismert robotokat, előtöltéseket és az adatvédelmi tiltást jelző kéréseket kihagyjuk. A mérés az admin Beállítások nézetében szüneteltethető. A napi adat nélküli pont nem bizonyított nulla forgalom; a bekötés előtti időszakról nincs látogatottsági adat. Részletes működés, megőrzés és korlátok: [ADMIN.md](docs/ADMIN.md#a-beépített-látogatottságmérés).

### Naplózás, jelvények és fiók

A **Fiókom → Heti kihívások** résznél hetente egy feladat választható: naplózás három különböző napon, saját receptből számolt étkezés mentése vagy külön lemért, grammban megadott összetevő rögzítése. A választott feladat haladása a kezdőlapon is látszik. Teljesítéskor gyűjthető heti pecsét jár: Ritmustaláló, Receptalkotó vagy Mértékmester. A választás, a részleges haladás és a jutalom a tartós PostgreSQL-adatbázis `weekly_challenges` táblájában marad meg, új AI-hívás nélkül.

A hét hétfőtől vasárnapig, magyarországi idő szerint tart. A háromnapos kihívásnál a mentés tényleges napját számoljuk; a visszadátumozás és az ugyanazon napi ismételt mentés nem ad több napot. Ez a feladat péntekig indítható. A haladás és a megszerzett pecsétek későbbi javítás vagy törlés után is megmaradnak. A következő héten új feladat választható. Részletes szabályok és tárolás: [WEEKLY-CHALLENGES.md](docs/WEEKLY-CHALLENGES.md).

A naplózást ötszintű növényes fejlődés, hat jelvény és egy gördülő hétnapos cél ösztönzi. A fejlődés különböző mentett napokra épül, a régebbi napok is számítanak; az étkezések energiatartalma nem befolyásolja a jutalmat. A kihagyás nem von le fejlődési napot, a törlés vagy dátummódosítás viszont újraszámítja a jelvényeket. A főoldali kártya és a mentés utáni visszajelzés a meglévő profiladatokból működik, új AI-kérés nélkül.

Google-belépés után tölts fel két fotót ugyanarról az egész adagról (felülről és ferdén oldalról), csomagolt terméknél a teljes csomagról és az olvasható címkéről, majd nézd át és mentsd a piszkozatot. A kiegészítő adatokat csak akkor add meg, ha ismered őket. A feldolgozás a fotó tartós feltöltése után a háttérben folytatódik. Az eredmény később is javítható.

A **Fiókom** nézetben mai energiaösszesítés, választható 7/30/365 napos átlagok, étkezésenkénti és étkezéstípus szerinti bontás, valamint megnyitható hétnapos lista segíti az áttekintést. A részletek összecsukhatók, az időszakváltás nem jár AI-kéréssel. A nézet a Google-nevet, e-mail-címet, csatlakozást, mentett étkezéseket, aktív napokat és naplózási sorozatokat mutatja. A 365 napos, zöld aktivitási naptárból megnyithatók az adott nap bejegyzései. Az energia- és makróátlagok csak a ténylegesen naplózott napokra vonatkoznak. Piszkozat, hibás vagy törlés alatt álló elemzés és jövőbeli nap nem növeli a statisztikát; üres naplóhoz nem készülnek mintaadatok.

A felület és az új AI-elemzés magyarul és angolul is használható. A jelvényértesítések és a folyadékmennyiségek szövegei nyelvváltáskor is követik a kiválasztott nyelvet. A nyelvváltás megőrzi a kiválasztott fotókat és a szerkesztés alatt álló adatokat; a saját szövegek és a korábbi elemzések az eredeti nyelvükön maradnak. A mobilos, asztali és billentyűzettel történő használat is támogatott.

Az adminban napi aktivitási és költséggrafikonok, szűrhető működési és hibanapló, valamint hívásonkénti, USD-ben számolt AI-költségbecslés is elérhető. A becslés külön jelzi a hiányos adatokat; az új hívások rekordjai az étkezés törlése után is megmaradnak. Módszer és ellenőrzött árazás: [AI-COSTS.md](docs/AI-COSTS.md).

## Belépés, adattárolás és telepítés

### Tulajdonosi adminfelület

A [kezelőfelület](https://yumetrics.app/admin) kizárólag a Google által ellenőrzött `thisisnotka@gmail.com` fiókkal érhető el, a Fiókom nézetből is. Felhasználók és munkamenetek kezelése, étkezések és feldolgozási hibák megtekintése, részletes statisztikák, tartós alkalmazásbeállítások és változásnapló található itt. A szolgáltatói beállítások jelzéseit az átlagos felhasználó nem kapja meg. Részletek, beállítási határok és ellenőrzés: [ADMIN.md](docs/ADMIN.md). A hat ötletes kulináris jelvény és végleges promptjai: [BADGE-ART.md](docs/BADGE-ART.md).

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
npm run build
```

A PostgreSQL-integrációs tesztekhez külön tesztadatbázis kapcsolatát kell megadni a `TEST_DATABASE_URL` folyamatváltozóban. Az admin PostgreSQL-próbáihoz egy másik, `_admin_test` végű tesztadatbázis kapcsolata szükséges `TEST_ADMIN_DATABASE_URL` néven. A megfelelő változó nélkül az adott PostgreSQL-próbák kimaradnak. A tesztekhez ne használj éles adatbázist. A böngészős ellenőrzés `node scripts/browser-check.mjs` paranccsal fut, headless Chrome-ban. A `TEST_LANGUAGE=hu|en` és `TEST_DEVICE=mobile|desktop` választja ki a nyelvet és a kezelőfelületet.

A tesztek a teljes adagot, a receptszámítást, a tápértékforrások kezelését, a Google-belépési határokat, a felhasználók elkülönítését, az adatmegőrzést, a profil statisztikáit és a mobilos/asztali működést ellenőrzik. Részletes bizonyítékok és a nem ellenőrzött területek: [VERIFICATION.md](docs/VERIFICATION.md).

A legutóbbi review hét javított találatcsoportját, a konkrét hibapéldákat és az ellenőrzés határait a [2026. november 9-i review](docs/REVIEW-2026-11-09.md) rögzíti.

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

A 2026. november 9-i teljes review tíz hibát tárt fel; mindet javítottuk. A javítások megőrzik a lassú válasz közben végzett szerkesztést, védik az összetevők USDA-forrásválasztását, megállítják az elavult feldolgozóból induló AI-kérést, és egységesítik a tápértékek ellenőrzését. A heti kihívás választása, a törlés és az energiakeret mentése is kapott versenyhelyzetet vizsgáló böngészős próbát. Részletek, reprodukciók és korlátok: [teljes review](docs/CODE-REVIEW-2026-11-09.md). Az aktuális ellenőrzés 130 sikeres Node-tesztet tartalmaz, helyi PostgreSQL-lel, kihagyás nélkül; a böngészős próba saját ideiglenes profilja futás után törlődik.

## Mért képelemzési költség és pontosság

A v14 alapmodellje Gemini 3.8 Flash. A végső, négy étkezéses páros mérésben a szolgáltatói költség 24,4%-kal csökkent. A kalóriahiba tömegadat nélkül 96,36-ról 88,48 kcal-ra mérséklődött; ismert össztömegnél lényegében azonos maradt: 52,07 és 52,12 kcal. A nyolc helyzet együttes hibája 74,22-ről 70,30 kcal-ra csökkent. A részmutatók nem mind javultak, a kis minta nem általános pontossági garancia.

A két fényképet továbbra is egyetlen kérés kezeli. A kiválasztott USDA- és címkeértékeket a szerver tölti ki; a modellnek ezeket nem kell újra leírnia. A teljes, elvetett próbákat is tartalmazó mérés 44 új hívása 1,1475516 USD volt. Módszer, pontos részmutatók, képlenyomatok és korlátok: [AI-EFFICIENCY-2026-11-09.md](docs/AI-EFFICIENCY-2026-11-09.md).

## Opcionális második fotó

A v15-ben egy fotóval is elindítható az elemzés. A második képet a magyar és angol feltöltőfelület is opcionálisként jelzi, és elmagyarázza, hogyan segíthet egy másik nézet vagy egy olvasható címke. Egy képnél nem kérünk képpár-ellenőrzést; két feltöltött képnél az azonos adag, eltérő nézőpont és használhatóság ellenőrzése megmarad. Az értékelhetetlen kép, az ismételt vagy hibás második kép továbbra is elutasítható. A korábbi v14-es pontosságmérés kétképes bemenetekkel készült; az egy- és kétképes felismerés pontosságkülönbségét most nem mértük újra.
