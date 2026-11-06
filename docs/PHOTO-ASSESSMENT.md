# Képalapú ételértékelés: kutatás és a megvalósított módszer

Ellenőrzés: 2026-11-06. Az alábbi módszertan működik a `food-v2-grounded` elemzésben. A saját, lemért étkezéseken végzett pontossági benchmark továbbra is szükséges; a tudományos források eredményeit nem tekintjük a Yumetrics igazolt pontosságának.

## Mit támasztanak alá a források?

1. **Ételazonosítás és tápértékszámítás külön lépésben.** A CVPR 2025 Workshop tanulmánya külön bontja fel az ételt összetevőkre, adagokra és elkészítési információra, majd ezekből becsüli a tápértékeket. Saját vizsgált adathalmazain jobb eredményt közöl az egylépéses lekérdezésnél. Ezt a felbontást vettük át, nem az adott tanulmány pontossági számait. [Khlaisamniang és mtsai., 2025](https://openaccess.thecvf.com/content/CVPR2025W/MTF/html/Khlaisamniang_Decomposing_Food_Images_for_Better_Nutrition_Analysis_A_Nutritionist-Inspired_Two-Step_CVPRW_2025_paper.html).
2. **A tömeg külön probléma a felismeréstől.** A Nutrition5k lemért összetevő-tömegeket, több nézetet és rendelkezésre álló mélységi adatokat tartalmaz. A sima telefonos RGB-fotó nem ilyen mérőrendszer. Ez indokolja a lemért tömeg bekérését, az opcionális második nézetet és a bizonytalanság bemutatását; a második kép nem állít elő valódi mélységmérést. [Nutrition5k, a szerzők adatkészlete és módszertana](https://github.com/google-research-datasets/Nutrition5k).
3. **A tápérték legyen visszakereshető és állapothoz kötött.** Az USDA FoodData Central megkülönbözteti az ételek és adagok adatait. A mennyiségi számítás alapja a 100 g-ra adott tápérték és az ehető rész grammja. A nyers és főtt változat nem felcserélhető. [USDA Foundation Foods dokumentáció](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/), [hivatalos API és CC0 licenc](https://fdc.nal.usda.gov/api-guide/).
4. **Mértékegységek és értelmezés.** A felületen kcal, gramm és nátriumnál mg szerepel. A sóegyenérték a nátrium tömegének 2,5-szerese; a milligramm → gramm átváltást is elvégezzük. [EU 1169/2011, só definíciója](https://eur-lex.europa.eu/eli/reg/2011/1169/oj/eng). Az app nem állít elő hivatalos termékcímkét.

## Konkrétan mi változott?

| Gyakorlat | Megvalósítás |
| --- | --- |
| Vizuális leltár először | Első, strukturált multimodális kérés: az összes étel, köret, öntet és ital; elkészítés, látható/feltételezett összetevők |
| Ehető rész, dupla számolás elkerülése | Az egész látható adag becslése, étel és alapanyagainak párhuzamos számlálása nélkül; külön kezelt olaj/öntet jelzése |
| Nem megfelelő fotó elutasítása | Nem étel vagy `poor` képminőség esetén nincs második tápértékkérés és képfeltöltés |
| Hasznos bemeneti kontextus | Lemért ételtömeg tányér nélkül, ismert tányérátmérő, elfogyasztott százalék, megjegyzés és opcionális második nézet |
| Több nézet ugyanarról az adagról | Maximum két kép; egy étkezés, egyszeres számolás; mindkét kép Cloudinaryba kerül, és mindkettő törölhető |
| Determinisztikus referenciaszámítás | 20, hivatalos USDA API-ból rögzített SR Legacy rekord; a modell a kulcsot javasolja, a tápértékeket a szerver a tényleges rekordból másolja |
| Őszinte visszaesési út | Referencia nélküli összetevőknél külön második AI-hívás, kizárólag 100 g-ra adott tápértékekre; az eredmény `ai`, nem adatbázisérték |
| Ellenőrizhető párosítás | Összetevőnként USDA-link, angol rekordnév, FDC ID, adattípus és letöltési dátum; kézi forráscsere és megerősítés |
| Javítások eredete | Kézi tápérték- vagy névváltoztatáskor `user` forrás; a megváltozott adat nem őrzi meg az USDA-címkét |
| Adag és fogyasztás | Lemért teljes tömegnél arányos felosztás; az elfogyasztott százalékot egyszer alkalmazzuk. A később javított grammok már az elfogyasztott mennyiséget jelentik |
| Bizonytalanság | Összetevőnként alsó/pont/felső tömeg, alternatív azonosítások, képi korlátok és legfeljebb néhány lényegi pontosító kérdés |
| Kézi grammkorrekció | A megadott új tömeg lesz az adag, a tömegforgatókönyv erre az értékre szűkül; az összetétel bizonytalansága ettől nem tűnik el |
| További tápértékek | Rost, cukor, telített zsír, nátrium és számolt sóegyenérték; hiányzó adat `null`, soha nem automatikus nulla |
| Következetesség | Tartományok és mértékegységek ellenőrzése; energia–makró eltérés, 100 g-ot meghaladó fő tápanyagösszeg, cukor > szénhidrát és telített zsír > összes zsír jelzése |
| Visszakövethetőség | Eredeti és javított elemzés külön; modell, promptverzió, kérési lépések tokenhasználata és összesített AI-késleltetés |

Az energia-forgatókönyv számítása: az egyes összetevők 100 g-os energiáját az alsó és felső tömegükkel szorozzuk. Ez nem 95%-os konfidenciaintervallum, és nem tartalmazza a tápértékadat, a téves ételazonosítás vagy a rejtett összetevők minden hibáját. Ismert teljes tömegnél az összetevők szélső tömegeinek összege eltérhet a lemért össztömegtől: a sáv konzervatív adag-forgatókönyv, nem egyetlen biztos recept.

## A referenciatár pontos korlátja

A `lib/food-reference.mjs` 20 konkrét étel adatait tartalmazza. Ez nem teljes ételadatbázis és nem márka-/receptfelismerő. A `scripts/update-food-reference.mjs` a rögzített FDC-azonosítókat a hivatalos API-n keresztül kéri le; a nyilvános, dokumentált DEMO_KEY csak ehhez az explicit fejlesztői frissítéshez kell. Az alkalmazás futás közben nem használ DEMO_KEY-t és nem fogyaszt USDA API-keretet.

A rögzített rekord tápértéke ellenőrizhető adat, de **a fotón szereplő ételhez párosítása AI-javaslat**, amíg a felhasználó nem ellenőrzi. A nyers/főtt állapot egyezését a modell kéri és a felület megmutatja; ezt nem tekintjük géppel bizonyított azonosságnak. Más márka, fűszerezés vagy elkészítés eltérhet. Az USDA szénhidrát-by-difference értékéből kivonjuk a rostot az elérhető szénhidrát közelítéséhez; ezt nem állítjuk az összes termékre alkalmazható laboratóriumi EU-címkeértéknek.

## Adatok és migráció

Az új `analysis_context` mező az eredetileg megadott teljes tömeget, tányérátmérőt, elfogyasztott százalékot és a második nézet meglétét őrzi. Az `analysis` JSON-ban `reportVersion=2`, `summary`, `observations`, `questions`, `imageQuality` és összetevőnként `preparation`, `visibility`, `portionNote`, `alternatives`, `gramsMin`, `gramsMax`, `weightBasis`, `sourceType`, `referenceKey`, `sourceConfirmed`, illetve `saturatedFat` kerül eltárolásra. Az eredeti AI-eredmény változatlanul megmarad.

A `photo.additional` a második kép metaadatait tartalmazza. A képazonosító determinisztikus `-angle` utótagja és az előre mentett kontextus sikertelen feltöltésnél is lehetővé teszi a képek takarítását. A korábbi elemzések külön újrafuttatás és átírás nélkül olvashatók; az új SQL-migráció egy nullable oszlopot ad hozzá.

## Milyen ellenőrzés bizonyítja a működést?

Automatikus tesztek ellenőrzik a referenciaértékek szerveroldali átvételét, a rossz kép és kitalált referenciakulcs elutasítását, az adagtartományt, a lemért tömeg/elfogyasztott százalék egyszeres alkalmazását, a két kép egyszeres számolását, mindkét kép törlését, a forrásjelölés érvénytelenítését kézi módosításkor és a régi rekordok olvashatóságát. A headless Chrome-teszt a teljes folyamatot és a kézi USDA-forrásválasztást is végigjárja.

Ezek szoftver- és folyamatellenőrzések. A tényleges táplálkozási pontossághoz külön, lemért magyar és nemzetközi ételeken végzett vakteszt kell, egységes fotókkal, recepttel, nyers/főtt állapottal és szakértő által ellenőrzött tápértékekkel. Nem vezettünk be kitalált vitaminokat, allergénmentességet, glikémiás indexet, személyre szabott terápiát vagy látszólag objektív „egészségpontszámot”.
