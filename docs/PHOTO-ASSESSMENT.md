# A megvalósított ételértékelés

## Aktuális működés: címkék és g/ml mennyiségek

A jelenlegi folyamat egy AI-kéréssel és két fotóval működik. Ételeknél felül-/oldalnézet, csomagolt terméknél teljes termék + olvasható tápértéktábla az elfogadott képpár. A gramm és a milliliter külön mennyiség; ismeretlen sűrűséget nem feltételezünk. A konkrét termékhez illő, olvasható címke az elsődleges forrás, majd megfelelő USDA-adat vagy AI-becslés következik. A címke eredeti adatai megmaradnak, a szerver a vonatkoztatási alapot és egységeket kezeli. Kis adagalapnál is 100 g/ml-re átszámítva ellenőrzi a kcal/kJ és só/nátrium összhangját; a tizedes kiszerelést ismételt mentéskor is megőrzi. A mentendő mennyiség a piszkozatban kézzel pontosítható. Részletes, aktuális felhasználói leírás: [Használati útmutató](https://yumetrics.app/utmutato).

Az alábbi verziózott leírások a korábbi módszertani döntéseket és a kompatibilitási hátteret is megőrzik; a csak grammos hivatkozások nem jelentik a milliliteres tételek kizárását.

Verzió: `food-v9-compact-prompt`, 2026-11-08. A JSON-riport formátuma visszafelé kompatibilis v2; a korábbi étkezések olvashatók. A magyar piaci fókusz és forrásai: [HUNGARIAN-POSITIONING.md](HUNGARIAN-POSITIONING.md).

## A számítás menete

1. Két kötelező fotó készül ugyanarról a teljes adagról: felülről és ferdén oldalról. A böngésző legfeljebb 2048 pixeles hosszabb oldallal, 0,92 JPEG-minőséggel újrarajzolja őket. Az azonos képtartalmat a kliens és a szerver is elutasítja feltöltés és fizetős modellhívás előtt; a két nézet egy adagnak számít.
2. A szerver előre menti az étkezés tulajdonosát, metaadatait, képazonosítóit és a tartós feladatot; majd feltölti a képeket Cloudinaryba. Csak ezután ad elfogadott választ. Az elemző worker innen tölti vissza a képeket.
3. Pontosan egy AI-kérés kapja meg mindkét eredeti fotót és a megadott kontextust. Egy válaszban adja a képpár ellenőrzését, a látható/feltételezett összetevőket, az elkészítést, az ehető grammokat és határaikat, az alternatívákat, legfeljebb egy opcionális kérdést, a képminőséget, a referenciakulcsokat és minden összetevő 100 g-ra vonatkozó tápértékét.
4. A részletes prompt ugyanebben a kérésben végső ellenőrzést kér az adagmagasságra, a kihagyásra/duplázásra, a nyers/főtt állapotra, az ehető részre és a referenciára. Hiányos ellenőrzés vagy elutasított képpár esetén nincs menthető becslés és nem indul újabb AI-hívás.
5. A 44 rögzített USDA-referenciához való párosításnál a szerver a tényleges rekord tápértékét másolja be, az AI számait figyelmen kívül hagyja. Referencia nélkül ugyanebből a válaszból használja a jelölt 100 g-os becslést. A fizikailag ellentmondó AI-tápanyagösszetételt elutasítja; nincs kiegészítő vagy javító AI-hívás.
6. Ismert teljes tömegnél a szerver levonja a lemért csont/héj tömegét, az ehető összetevőket ehhez arányosítja, és a teljes képen látható ehető mennyiség 100%-ával számol. Az összetevőarányok továbbra is becslések.
7. A felhasználó javíthatja a teljes képadag ehető grammjait és a tápértékeket; a külön lemért összetevőket megjelölheti. A beépített források mellett USDA-kulccsal angol keresésből választhat Foundation/SR Legacy rekordot. A választás nem bizonyítja automatikusan, hogy a fotón ugyanaz az étel van.
8. A szerver mentéskor újra ellenőrzi a forrást a saját rögzített katalógusából/adatbázisából. Kézi tápértékmódosítás elveszi az USDA-címkét. Az eredeti AI-riport külön megmarad.

A v4 a magyar ételcsoportot és az ismert elkészítést is eltárolja. Az AI minden összetevőnél nyers/elkészített/változatlan termék/ismeretlen állapotot ad. A beépített referenciák állapota külön, kézzel ellenőrzött metaadat; eltérésnél a modell által javasolt referenciát nem vesszük át. A tápértékbecslés megkapja az elkészítési kontextust és mindkét fotót is. Ez egy ismert hibatípust kizár, de a fotón látható étel tényleges azonosságát nem bizonyítja.

## Saját recept: teljes fazékból elfogyasztott adag

Az ismert recept rögzítéséhez a felhasználó a teljes ételben maradt alapanyagokat és hozzájuk illő nyers/főtt forrást adja meg, majd a teljes kész tömeget és a képen látható teljes kész adagot. A szerver a receptet újraszámolja: `alapanyagok összes tápanyaga × a teljes képadag kész grammja / teljes recept kész grammja`. Nem a nyers grammok összegével oszt. A képadag a recept egy része lehet, de a képen látható mennyiséget mindig 100%-ban számolja. A `recipe.eatenWeightG` mező történeti neve megmaradt; új receptnél a teljes képadag tömegét jelenti.

A `recipe.ingredients` az eredeti batch mennyiségeket őrzi. Az `analysis.ingredients` az adagra eső alapanyag-egyenértéket tartalmazza, ezért e grammok összege eltérhet az elfogyasztott kész tömegtől. A riport utóbbinak a megadott `recipe.eatenWeightG` értékét mutatja. A receptet csak a saját szerkesztőjében lehet átírni; mentéskor a szerver ismét a batchből számol, a kliens által küldött hamis származtatott érték nem írja felül.

A felhasználónak meg kell erősítenie az ételben maradt mennyiségek és az elöntött zsiradék/szaft kezelését. A kész tömeg a vízváltozást veszi figyelembe; általános tápanyagretenciót nem modellezünk automatikusan. Ez külön jelölt receptbecslés. Az eredeti AI-elemzés nem módosul, nincs új AI-hívás.

**Csülök példa:** 600 g mért teljes képadag, ebből 200 g csont → 400 g ehető mennyiség. A számítás mind a 400 grammra vonatkozik; nem szorozzuk fogyasztási hányaddal. A bőr/zsír aránya és a sütéskori zsiradékveszteség külön bizonytalanság.

## Források és egységek

Az energia kcal, a fehérje/zsír/szénhidrát/rost/cukor/telített zsír gramm, a nátrium mg, a USDA-referenciák 100 g-ra, az italok címkeadatai 100 ml-re is vonatkozhatnak. Az adagérték `g vagy ml mennyiség × azonos egységű 100-as érték / 100`. A nátriumból számolt sóegyenérték `nátrium mg × 2,5 / 1000`, gramm. A 4/4/9 és rostnál 2 kcal/g képlet csak durva következetességi ellenőrzés; nem írja felül a közölt referenciaenergiát.

A szénhidrát az elérhető szénhidrát közelítése: a USDA carbohydrate-by-difference értékéből kivonjuk a rostot. Ez nem minden terméknél azonos a laboratóriumi EU-címkeértékkel. Olyan élő USDA-rekordot, amelynél ehhez nincs adat, nem importálunk automatikusan. Márkás terméknél a saját címke értékeit kell megadni. Az élő rekord import az Atwater specific energiát részesíti előnyben, aztán a kcal energiarekordot, végül az Atwater general értéket; kJ-t nem értelmez kcal-ként.

Ismeretlen opcionális érték `null`. Ha egy összetevőnél ismeretlen, az étkezés és a napi összesítés sem jelzi biztos nullaként. A forrás tartalmazza az FDC ID-t, leírást, adattípust, URL-t és letöltési dátumot. A részletes élő rekord 24 óráig gyorsítótárazott PostgreSQL-ben, tartalmi kulcsa változatlan másolatot azonosít. Új lekérés nem írja át a korábbi napló forrását.

## Mit nem bizonyít a riport?

A `confidence` kizárólag AI-önértékelés; nincs belőle pontossági százalék. Mérleg nélkül, korlátozott képminőségnél, feltételezett összetevőnél vagy AI-tápértékbecslés mellett a magas önértékelést is legfeljebb közepesként tároljuk. Az energia-forgatókönyv ismeretlen össztömegnél a kisebb/nagyobb adagot mutatja. Ha minden összetevő mért össztömeghez arányosított, az össztömeg rögzített: a szerver a megadott összetevőhatárokon belül a kis/nagy energiasűrűségű elemekhez osztja a fennmaradó tömeget. Ez a rögzített tömegű keverék minimális/maximális energiája a megadott határok mellett; nem konfidenciaintervallum, és nem tartalmaz minden rejtett összetevő- vagy forráshibát. A kézzel megadott grammok a tömegforgatókönyvet szűkítik, az étel összetételének bizonytalanságát nem.

A saját recept pontosabb rögzítéséhez ismert alapanyagok és tényleges készétel-kihozatal szükséges. Mérd az alapanyagokat, az olajat és a kész ételt; kezeld a visszamaradt zsiradékot és a veszteséget. Nyers adatot kész összetevő grammjával ne párosíts. A kihozatalt a felhasználó lemért kész tömege adja, nem egy kitalált átlagfaktor. Általános tápanyagretenció-modell nincs beépítve; bizonytalan összetételt a rendszer nem változtat igazolt receptté.

A szoftvertesztek a képleteket, csontlevonást, forrásellenőrzést, mértékegységeket és a folyamatot bizonyítják. A tényleges fotós kalóriahiba méréséhez a [kutatási terv](RESEARCH.md) szerinti külön vakteszt szükséges. A generált csülökkép dekoráció; nem tesztelési etalon és nem mért étkezés.

A futtatható mérési eszköz: [BENCHMARK.md](BENCHMARK.md). Nem keveri a sikeres eredmények hibáját az elutasított esetekkel, és ismeretlen adatnál külön darabszámot ad. Jelenleg nincs éles mért pontossági eredmény.

## Kompatibilitás

Az új elemzések `portionScope=full_image` jelölést kapnak. A régi `consumedPercent` bemenetből csak a numerikus 100 fogadható el, és ezt sem tároljuk új fogyasztási beállításként. Más részarány 400-as hibát ad a képfeltöltés vagy AI-hívás előtt. A korábban mentett részadagokat nem számoljuk újra; a riport történeti jelzést ad hozzájuk. Régi részadagos, be nem fejezett feladat az új módszerrel nem folytatható féladagként, és megőrzött bejegyzésként hibát jelezhet.

A v7 új elemzéseihez két fotó kötelező. A régi egyképes mentett étkezések változatlanul olvashatók és szerkeszthetők. Egyképes félbemaradt elemzés újrapróbálása helyett új bejegyzést kell indítani két képpel; a meglévő adatokat nem töröljük.

## A két nézet szakmai indoka és korlátai

A [Two-view 3D Reconstruction for Food Volume Estimation](https://arxiv.org/abs/1701.03330) különböző nézetekből rekonstruált térfogattal foglalkozik. A Yumetrics itt multimodális modellbecslést használ, kalibrált kamerás 3D-rekonstrukciót nem végez; a cikk hibaarányai nem vihetők át rá. A [Gemini képfeldolgozási dokumentációja](https://ai.google.dev/gemini-api/docs/image-understanding) támogatja több kép együttes bemenetét. Az ismert tányérméret vagy lemért tömeg továbbra is hasznos opcionális támpont: két nézet önmagában nem oldja meg az abszolút lépték és a rejtett olaj/recept bizonytalanságát. Az egykéréses módszer pontosságát is a benchmarkkal kell igazolni.

A v8 háttérfeldolgozója lejárt, futó elemzést nem indít automatikusan újra: a korábbi kérés már eljuthatott az AI-hoz. A bejegyzés hibás állapotba kerül, a képek megmaradnak; új kéréshez kézi újrapróbálás szükséges. A még el nem indult, sorban álló munkák és a képtörlési feladatok továbbra is folytathatók.

## Költségcsökkentés a pontossági követelmények megtartásával

A v9 az ismétlődő utasításokat összevonja, és behúzás nélküli kompakt JSON-t kér, a szöveges mezők közötti ismétlés nélkül. A számokat, egységeket, összetevőket, adagtartományokat és érdemi bizonytalanságokat nem szabad helytakarékosság miatt elhagyni vagy kerekíteni. Mind a 44 referencia teljes neve, leírása, állapota és helyettesítési megkötése, valamint a magyar ételcsoportok útmutatása változatlanul szerepel a kérésben.

A magyar utasítás 15 784-ről 14 710 karakterre rövidült (6,8%). Ez szöveghossz-mérés, nem számlázott token- vagy költségmegtakarítás. A modell, a gondolkodási beállítás, a 10 000 tokenes kimeneti keret, a válaszséma és a két fotó feldolgozása változatlan. A közös prompt a nyelvi kiegészítés és a felhasználói adatok előtt marad; tényleges cache-találatot nem garantálunk. A teljes szolgáltatói `usageMetadata` megmarad, beleértve a gondolkodási/cache-tokeneket és a szolgáltató által közölt költséget. Az éles költség és fotós pontosság összehasonlításához azonos, lemért tesztkészlet szükséges.
