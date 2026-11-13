# Olcsóbb és megbízhatóbb ételfotó-elemzés: kutatási döntés

2026-11-13. Új fizetős API-hívás, előfizetés vagy éles telepítés nem történt ebben a kutatási körben.

## Döntés

A következő kísérlet tárgya a feladat felbontása legyen: ételazonosítás → adatbázis-találat → adag/egység → szerveroldali számítás. Az állandó, hosszú gondolkodású kétmodellű teljes elemzés a saját négyelemű mintán nem adott megfelelő eredményt. Nem bizonyított, hogy a Food-R1 segítette vagy rontotta a Haikut, mert nem volt önálló Haiku-kontroll.

A Food-R1 megtartása mellett először annak működési pazarlását kell megszüntetni. A második modell feladata a konkrét bizonytalanságok feloldása és a releváns adatbázisjelöltek közti választás legyen. A modell saját magabiztossága vagy két modell egyetértése önmagában nem bizonyíték a helyességre. A gondolkodás csökkentésének pontossági hatását külön kell mérni.

## Miért férhet bele egy évi 7000 Ft-os app?

A felhasználó által említett 7000 Ft/év ár feltételes egységgazdasági példaként szerepel; nem azonosítottunk és nem ellenőriztünk konkrét ilyen előfizetést.

| Használat | Éves bejegyzés | 7000 Ft bevétel bejegyzésenként |
| --- | ---: | ---: |
| Napi 3 | 1095 | 6,39 Ft |
| Napi 5 | 1825 | 3,84 Ft |

A saját mérés kb. 1,25 Ft-os Haiku-része napi három új elemzéssel kb. 1370 Ft/év. A Food-R1 jelenlegi, kredit nélküli erőforrásával együtt kb. 6,02 Ft/étkezés, azaz kb. 6590 Ft/év lenne a számítható részekre. Ezek korábbi árfolyam- és adófeltételezésekből származó példák, nem számlák; az előző két HTTP 400 díja ismeretlen. A második összegben további infrastruktúra és tranzakciós költségek sem teljesek. Lásd a [valós mérési jelentést](FOOD-R1-HAIKU-LIVE-2026-11-13.md).

A lakossági előfizetésből nem vezethető le egy külső API hívásdíja. Az ismétlődő ételsablonok, a vonalkódos és kézi bejegyzések saját rendszerünkben kihagyhatják a modellhívást. A versenytársak belső modelljére, költségére vagy használati gyakoriságára nincs ebből bizonyíték.

## Mit dokumentálnak a szolgáltatók?

- **MyFitnessPal:** fotó után ételjavaslatokból választás, majd adagnagyság/adagszám módosítása; a kimaradt étel adatbázisból hozzáadható. Ez felhasználó által ellenőrzött naplózási folyamat. [Hivatalos útmutató](https://support.myfitnesspal.com/hc/en-us/articles/360045761612-How-to-use-the-Meal-Scanner).
- **Yazio:** a fotóelemzés kezdeti, durva becslés; az összetevők és mennyiségek javíthatók, az étkezés sablonként menthető. A dokumentáció nem igazol konkrét pontossági százalékot vagy belső modellarchitektúrát. [Hivatalos útmutató](https://help.yazio.com/hc/en-us/articles/39137901903889-What-is-the-AI-Calorie-Tracking-Feature-and-how-does-it-work).
- **SnapCalorie API:** 499 USD/hó, benne 10 000 hívás; teljes kihasználtságnál 0,0499 USD/hívás, a korábbi 328,16 Ft/USD példával kb. 16,38 Ft adó előtt. A dokumentáció szerint a lakossági app ugyanazt az elemző végpontot használja. Ez a nyilvános B2B-csomag nem teljesíti a 3 Ft-os célt. [Árazás](https://snapcalorie.github.io/docs/pricing/).
- **Passio:** Starter 99 USD/hó és 1 millió saját számlázási token; a fotós útvonal jelenleg közölt mediánja 5857 ilyen token. Ezek nem OpenCode-tokenek. Teljes keretkihasználás mellett az induló csomag egyszerű leosztása kb. 171 ilyen fotó/hó, kb. 0,58 USD/fotó; nem olcsó induló alternatíva. Nagyobb csomag más gazdaságosságot adhat. A keresés/vonalkód/tápérték-lekérés külön, AI nélküli útvonalat is kap. [Árazás és kalkulátor](https://www.passio.ai/pricing).
- **LogMeal:** a Food AI Engine próba a közzétett feltételek szerint legfeljebb 30 nap vagy 200 lekérdezés; ez potenciális összehasonlítási lehetőség, nem tartós ingyenes infrastruktúra. A külön Nutrition Platform régi csomagárát nem használjuk a képfelismerő API díjaként. [Hivatalos ár- és próbaoldal](https://logmeal.com/food-ai-engine-pricing/).

## Kutatási alap

**DietAI24, Communications Medicine, 2025:** az ételfelismerést FNDDS-adatbázis-visszakereséssel és adatbázisbeli adagokkal kapcsolja össze. ASA24-en és Nutrition5k-n értékelték; a szerzők javulást közölnek a vizsgált összehasonlításokban. A tanulmány csak GPT-modelleket tesztelt: nem igazolja a Food-R1 + Haiku pontosságát vagy a 3 Ft-os költséget. Az adatbázislefedettség, hibás ételkód-választás és az amerikai fogások túlsúlya korlát. A módszertani tanulság a külső tápértékadat és az adagstrukturálás, nem egy eredmény más modellre átvitele. [Tanulmány](https://www.nature.com/articles/s43856-025-01159-0).

**Nutrients, 2026, ételfelismerés/adagbecslés benchmark:** 200 telefonos képen, 870 lemért ételtétellel vizsgálta a modelleket. Az egyező, számszerű becslést kapott tételeken a modellek tömeghibája nem múlta felül az ételazonosság alapján képzett tipikusadag-referenciát. Ez a referencia azonban tökéletes ételazonosságot és a vizsgált adatállomány többi képének adagtömegeit használta: diagnosztikai felső viszonyítás, nem bevethető 35 g-os pontosságú termék. A tanulság: a kép alapján történő grammjóslást önállóan kell ellenőrizni; újabb modell vagy hosszabb válasz nem garantál jobb adagbecslést. [Tanulmány, különösen 2.2 és 4. szakasz](https://www.mdpi.com/2072-6643/18/21/3582).

**USDA FNDDS:** letölthető élelmiszer-, tápérték- és adagadatok. Az adag grammértéke referencia, nem bizonyíték arra, hogy a fotón pont ekkora mennyiség szerepel. Magyar összetett fogásokhoz külön, forrással ellátott receptlefedettség szükséges. [Adattípusok](https://fdc.nal.usda.gov/data-documentation/), [letöltések](https://fdc.nal.usda.gov/download-datasets/).

## A saját rendszer konkrét veszteségei

1. `scripts/modal_foodr1.py`: a GPU-osztálynál `single_use_containers=True`. A négy megőrzött válasz összesen 67,670 s modellbetöltést és 8,089 s inferenciát közöl: a mért idő 89,3%-a betöltés. Ez nem a teljes Modal-számla. Rövid időn belüli újrahasználat/batch csökkentheti az amortizált betöltést. Ritka kéréseknél az üresjárat ezt el is viheti. A Modal a betöltést és az üresjáratot is számlázza; állandó meleg GPU-t ezért nem indítunk automatikusan. [Számlázás](https://modal.com/pricing), [konténer-életciklus és hidegindítás](https://modal.com/docs/guide/cold-start).
2. A Haiku-kérés kb. 11 ezer bemeneti és 3,4–3,6 ezer gondolkodással együtt számolt kimeneti tokent használt. A teljes katalógus, címkeséma és minden jelölt auditja helyett feladatspecifikus, rövid kimenetet kell összevetni az eredetivel. Ez javasolt optimalizálás, még nincs mért megtakarítása vagy pontossága.
3. A három elfogadott válasz átlagos abszolút tömeghibája 210 g volt. A helyes ételnév nem oldotta meg a mennyiséget. A negyedik válaszból hiányzó érvényes tápértékforrást egy nagyobb kereshető adatbázis kezelhetné; a szerver továbbra sem találhat ki értéket.

## Javasolt következő megvalósítás

1. **Útvonalválasztás:** korábban jóváhagyott ételsablon, ismert vonalkód vagy megadott recept esetén helyi adat/keresés és számítás. A sablon új mennyisége továbbra is megerősítendő; ételnév alapján nem másolunk vakon korábbi grammot.
2. **Food-R1:** rövid ételjelöltek és látható darabszám. A GPU újrahasználatát külön forgalomszimuláció alapján állítani, alapjárati állandó konténer nélkül. Az esetleges GPU-snapshot támogatását/kompatibilitását külön ellenőrizni kell; nem feltételezünk ingyenes vagy kész megoldást.
3. **Adatbázis:** név, elkészítési mód, nyers/főtt állapot, szükség esetén helyi recept alapján kevés releváns jelölt; stabil adatbázisazonosító, forrás és adagváltozat megőrzése. A mostani 44 ételes lista már ad támaszt, de nem teljes kereshető FNDDS-alap. A meglévő szerveroldali számítás újrahasznosítható.
4. **Haiku:** az eredeti képből ellenőrizze az ételváltozatot és a releváns jelölteket; rövid, típusos eredmény. Ismeretlen vagy rejtett összetevőt ne alakítson bizonyos ténnyé. Az eredeti gondolkodó profilt kontrollnak megtartani, az olcsóbb beállítás minőségét mérni.
5. **Adag:** látható darab/kanál/szelet és adatbázisbeli adag; csak indokolt esetben egy célzott kérdés az adagról, olajról vagy receptről. Az eredmény szerkeszthető becslésként jelenjen meg. A teljesen automatikus képágat és a felhasználói segítséggel kapott eredményt külön mérni.
6. **Számítás:** kizárólag a kiválasztott forrásértékből és mennyiségből; az ismeretlen érték maradjon ismeretlen. A felhasználó által jóváhagyott étkezést és javítást menteni későbbi újrahasználatra.

## Következő takarékos mérés terve

Előbb offline adategyezési, adagkonverziós és forgalmi költségszimuláció; utána új, lezárt Nutrition5k-tányérokon két ág: eredeti profil és adatbázisos/adagegységes profil. Azonos képek, azonos rendelkezésre álló információ; nincs referenciaátadás. A korábbi négy tányér fejlesztési/regressziós készlet, már nem független sikerminta.

Mérendő: hiányzó/felesleges étel, össztömeg- és összetevőhiba, kcal- és makróhiba, elutasítások, ±20%-on belüli étkezések aránya, minden próbálkozás díja, GPU betöltés/elemzés/üresjárat, megerősítések száma. Az egyképes és kétképes módot, illetve a segítség nélküli és felhasználó által pontosított adagokat külön kell közölni. A 3 Ft-ot étkezésenként kell ellenőrizni, nem csak átlagként; a költségkeret előtti külön fizetős ellenőrző kérés továbbra sem szükséges.

Egyetlen lépéshez sem állítunk még igazolt pontosságjavulást vagy garantált 3 Ft-os teljes költséget. Ezt az új mérésnek kell igazolnia, a kredit nélküli költséggel együtt.
