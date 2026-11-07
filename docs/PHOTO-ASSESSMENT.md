# A megvalósított ételértékelés

Verzió: `food-v5-full-image-portion`, 2026-11-07. A JSON-riport formátuma visszafelé kompatibilis v2; a korábbi étkezések olvashatók. A magyar piaci fókusz és forrásai: [HUNGARIAN-POSITIONING.md](HUNGARIAN-POSITIONING.md).

## A számítás menete

1. A böngésző újrarajzolja a képet JPEG-ként. Legfeljebb két kép adható ugyanarról az adagról; nem két adagként számoljuk.
2. A szerver előre menti az étkezés tulajdonosát, metaadatait, képazonosítóit és a tartós feladatot; majd feltölti a képeket Cloudinaryba. Csak ezután ad elfogadott választ. Az elemző worker innen tölti vissza a képeket.
3. Az első AI-hívás vizuális leltár: látható/feltételezett összetevők, elkészítés, ehető grammok, alsó/felső adag, alternatívák, kérdések, képminőség. Nem megfelelő kép vagy nem étel esetén nincs tápértékbecslés; a feltöltött kép a hibás bejegyzésben megmarad és törölhető.
4. A 44 rögzített USDA-referenciához való párosításnál a szerver a tényleges rekord tápértékét másolja be, az AI nem találhat ki hozzá számokat. Referencia nélküli összetevőknél második hívás ad jelölt AI-becslést, kizárólag 100 g-ra.
5. Ismert teljes tömegnél a szerver levonja a lemért csont/héj tömegét, az ehető összetevőket ehhez arányosítja, és a teljes képen látható ehető mennyiség 100%-ával számol. Az összetevőarányok továbbra is becslések.
6. A felhasználó javíthatja a teljes képadag ehető grammjait és a tápértékeket; a külön lemért összetevőket megjelölheti. A beépített források mellett USDA-kulccsal angol keresésből választhat Foundation/SR Legacy rekordot. A választás nem bizonyítja automatikusan, hogy a fotón ugyanaz az étel van.
7. A szerver mentéskor újra ellenőrzi a forrást a saját rögzített katalógusából/adatbázisából. Kézi tápértékmódosítás elveszi az USDA-címkét. Az eredeti AI-riport külön megmarad.

A v4 a magyar ételcsoportot és az ismert elkészítést is eltárolja. Az AI minden összetevőnél nyers/elkészített/változatlan termék/ismeretlen állapotot ad. A beépített referenciák állapota külön, kézzel ellenőrzött metaadat; eltérésnél a modell által javasolt referenciát nem vesszük át. A második becslési lépés megkapja az elkészítési kontextust is. Ez egy ismert hibatípust kizár, de a fotón látható étel tényleges azonosságát nem bizonyítja.

## Saját recept: teljes fazékból elfogyasztott adag

Az ismert recept rögzítéséhez a felhasználó a teljes ételben maradt alapanyagokat és hozzájuk illő nyers/főtt forrást adja meg, majd a teljes kész tömeget és a képen látható teljes kész adagot. A szerver a receptet újraszámolja: `alapanyagok összes tápanyaga × a teljes képadag kész grammja / teljes recept kész grammja`. Nem a nyers grammok összegével oszt. A képadag a recept egy része lehet, de a képen látható mennyiséget mindig 100%-ban számolja. A `recipe.eatenWeightG` mező történeti neve megmaradt; új receptnél a teljes képadag tömegét jelenti.

A `recipe.ingredients` az eredeti batch mennyiségeket őrzi. Az `analysis.ingredients` az adagra eső alapanyag-egyenértéket tartalmazza, ezért e grammok összege eltérhet az elfogyasztott kész tömegtől. A riport utóbbinak a megadott `recipe.eatenWeightG` értékét mutatja. A receptet csak a saját szerkesztőjében lehet átírni; mentéskor a szerver ismét a batchből számol, a kliens által küldött hamis származtatott érték nem írja felül.

A felhasználónak meg kell erősítenie az ételben maradt mennyiségek és az elöntött zsiradék/szaft kezelését. A kész tömeg a vízváltozást veszi figyelembe; általános tápanyagretenciót nem modellezünk automatikusan. Ez külön jelölt receptbecslés. Az eredeti AI-elemzés nem módosul, nincs új AI-hívás.

**Csülök példa:** 600 g mért teljes képadag, ebből 200 g csont → 400 g ehető mennyiség. A számítás mind a 400 grammra vonatkozik; nem szorozzuk fogyasztási hányaddal. A bőr/zsír aránya és a sütéskori zsiradékveszteség külön bizonytalanság.

## Források és egységek

Az energia kcal, a fehérje/zsír/szénhidrát/rost/cukor/telített zsír gramm, a nátrium mg, minden referencia 100 g-ra vonatkozik. Az adagérték `gramm × referencia / 100`. A nátriumból számolt sóegyenérték `nátrium mg × 2,5 / 1000`, gramm. A 4/4/9 és rostnál 2 kcal/g képlet csak durva következetességi ellenőrzés; nem írja felül a közölt referenciaenergiát.

A szénhidrát az elérhető szénhidrát közelítése: a USDA carbohydrate-by-difference értékéből kivonjuk a rostot. Ez nem minden terméknél azonos a laboratóriumi EU-címkeértékkel. Olyan élő USDA-rekordot, amelynél ehhez nincs adat, nem importálunk automatikusan. Márkás terméknél a saját címke értékeit kell megadni. Az élő rekord import az Atwater specific energiát részesíti előnyben, aztán a kcal energiarekordot, végül az Atwater general értéket; kJ-t nem értelmez kcal-ként.

Ismeretlen opcionális érték `null`. Ha egy összetevőnél ismeretlen, az étkezés és a napi összesítés sem jelzi biztos nullaként. A forrás tartalmazza az FDC ID-t, leírást, adattípust, URL-t és letöltési dátumot. A részletes élő rekord 24 óráig gyorsítótárazott PostgreSQL-ben, tartalmi kulcsa változatlan másolatot azonosít. Új lekérés nem írja át a korábbi napló forrását.

## Mit nem bizonyít a riport?

A `confidence` kizárólag AI-önértékelés; nincs belőle pontossági százalék. Mérleg nélkül a magas önértékelést is legfeljebb közepesként tároljuk. Az energia-forgatókönyv ismeretlen össztömegnél a kisebb/nagyobb adagot mutatja. Ha minden összetevő mért össztömeghez arányosított, az össztömeg rögzített: a szerver a megadott összetevőhatárokon belül a kis/nagy energiasűrűségű elemekhez osztja a fennmaradó tömeget. Ez a rögzített tömegű keverék minimális/maximális energiája a megadott határok mellett; nem konfidenciaintervallum, és nem tartalmaz minden rejtett összetevő- vagy forráshibát. A kézzel megadott grammok a tömegforgatókönyvet szűkítik, az étel összetételének bizonytalanságát nem.

A saját recept pontosabb rögzítéséhez ismert alapanyagok és tényleges készétel-kihozatal szükséges. Mérd az alapanyagokat, az olajat és a kész ételt; kezeld a visszamaradt zsiradékot és a veszteséget. Nyers adatot kész összetevő grammjával ne párosíts. A kihozatalt a felhasználó lemért kész tömege adja, nem egy kitalált átlagfaktor. Általános tápanyagretenció-modell nincs beépítve; bizonytalan összetételt a rendszer nem változtat igazolt receptté.

A szoftvertesztek a képleteket, csontlevonást, forrásellenőrzést, mértékegységeket és a folyamatot bizonyítják. A tényleges fotós kalóriahiba méréséhez a [kutatási terv](RESEARCH.md) szerinti külön vakteszt szükséges. A generált csülökkép dekoráció; nem tesztelési etalon és nem mért étkezés.

A futtatható mérési eszköz: [BENCHMARK.md](BENCHMARK.md). Nem keveri a sikeres eredmények hibáját az elutasított esetekkel, és ismeretlen adatnál külön darabszámot ad. Jelenleg nincs éles mért pontossági eredmény.

## Kompatibilitás

Az új elemzések `portionScope=full_image` jelölést kapnak. A régi `consumedPercent` bemenetből csak a numerikus 100 fogadható el, és ezt sem tároljuk új fogyasztási beállításként. Más részarány 400-as hibát ad a képfeltöltés vagy AI-hívás előtt. A korábban mentett részadagokat nem számoljuk újra; a riport történeti jelzést ad hozzájuk. Régi részadagos, be nem fejezett feladat az új módszerrel nem folytatható féladagként, és megőrzött bejegyzésként hibát jelezhet.
