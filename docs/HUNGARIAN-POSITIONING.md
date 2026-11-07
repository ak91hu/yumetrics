# Magyar piaci irány: a saját konyhád mérhető adagjai

Kutatás és termékdöntés, 2026-11-07. A célcsoport a magyar házi ételeket főző/menzán étkező naplózó, akinek a „pörkölt 100 g” általános adat nem írja le a saját receptjét. Ez pozicionálási hipotézis, nem igazolt piaci kizárólagosság vagy felhasználói keresletmérés.

## Miért nem elég az AI-fotó funkció?

A YAZIO saját dokumentációja már leír fotós AI-ételfelismerést, összetevő- és adagjavítást. Ezért a „fotózz és kalóriát kapsz” állítást nem tekintjük egyedi piaci előnynek. [YAZIO, hivatalos funkcióleírás](https://help.yazio.com/hc/en-us/articles/39137901903889-What-is-the-AI-Calorie-Tracking-Feature-and-how-does-it-work).

**A Yumetrics választott megkülönböztetése:** magyar konyhai bizonytalanságok → ismert adatok → visszakövethető tápértékforrás → saját fazék/tepsi lemért kihozatala → teljes képadag. A felület megmutatja, melyik eredmény fotós becslés, össztömeghez arányosított becslés, külön lemért adag vagy saját receptből végzett számítás.

A Nébih naplózási anyaga a név/márka/zsírtartalom mellett az elkészítési módot és sűrítést, valamint a ténylegesen elfogyasztott mennyiséget is kéri. Ebből következik a kontextus gyűjtése; nem vettünk át belőle egységadagokat vagy kalóriaértékeket. [Nébih étkezési napló útmutató](https://portal.nebih.gov.hu/documents/10182/785457/%C3%A9tkez%C3%A9si%2Bnapl%C3%B3.pdf/6bf999c7-a232-48cb-8262-9311a7510102).

## A megvalósított magyar támpontok

| Ételcsoport | Nagy hatású, tisztázandó tényező |
| --- | --- |
| Főzelék és feltét | Rántás/habarás, tejtermék és zsiradék, külön feltét |
| Pörkölt/paprikás | Húsrész, szaft, tejföl és külön köret |
| Rántott fogás | Panír, sütési mód, valóban felszívott olaj |
| Csülök/csontos hús | Csont, elfogyasztott bőr/zsír és visszamaradt szaft |
| Rakott étel/töltött káposzta | Saját rétegek/töltelék, teljes kész tömeg, szelet |
| Lángos | Kész tészta, felszívott olaj és feltét |
| Túrós/mákos/diós tészta | Száraz/főtt tömeg, cukor, tejföl, szalonna |
| Leves/gulyás/halászlé | Lé–szilárd rész, csont, kenyér/tészta |
| Palacsinta/sütemény | Töltelék/szórat, ismert recept vagy címke, adag |

Van „más étel/nem tudom” útvonal is. A fenti kérdések saját terméktervezési következtetések, nem diagnózisok vagy hatóság által jóváhagyott felismerési szabályok. A csoport neve nem indít fix kalóriatábla-helyettesítést. Az AI-javaslat és a felhasználó által megadott csoport külön jelölt.

## Hitelesség a magyar felhasználónak

A kész összetevő automatikusan nem kaphat nyers USDA-referenciát; eltérésnél jelölt becslésre térünk vissza. Az ismeretlen érték nem nulla. A gramm, mg, sóegyenérték és a rost nélküli szénhidrát értelmezését külön kezeljük. A Nébih jelölési tájékoztatója is külön tárgyalja a rostot, poliolokat és a só/nátrium kapcsolatát; ezért a 4/4/9 képlet csak ellenőrzési támpont, nem írja felül a közölt energiaértéket. [Nébih tápértékjelölés](https://portal.nebih.gov.hu/projektek_kijelzo/-/asset_publisher/XZIUSA6aTnU0/content/id/745131/pop_up).

A receptmód a megadott, ételben maradt alapanyagok tápértékösszegét a teljes képadag kész tömege/teljes recept kész tömege arányával szorozza. A víz miatti kihozatalváltozás így a lemért kész tömegben szerepel. A zsiradékveszteséget a felhasználónak kezelnie/megerősítenie kell; automatikus, mindent lefedő tápanyagretenciós faktort nem találunk ki. Ez a FAO receptszámítási szempontjaihoz igazodó, korlátozott receptbecslés, nem teljes laboratóriumi modell. [FAO receptek számítása](https://www.fao.org/4/y4705e/y4705e23.htm).

Nem használjuk az OKOSTÁNYÉR márkajelzést saját minősítésként; nincs dietetikusi vagy Nébih-jóváhagyás állítva. Vitamin, allergénmentesség, betegségspecifikus ajánlás és látszólag objektív egészségpontszám nem következik a fotóból. Magyar tápanyagadatbázis licencét vagy saját elemzési pontosságot sem állítunk bizonyíték nélkül.

## Mi kell az irány igazolásához?

Az elkészült szoftverteszt nem bizonyítja a tényleges ételfotós pontosságot vagy piaci keresletet. Következő kapu: 50–100 külön lemért magyar étkezés, azonos fotókon fotó-only és kontextussal végzett vakteszt, majd a legnagyobb hibájú ételcsoportok javítása. A célcsoporttal végzett használhatósági interjú és visszatérési mérés külön piaci validáció. Futó értékelőeszköz és adatkövetelmények: [BENCHMARK.md](BENCHMARK.md).
