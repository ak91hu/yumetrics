# Az ételfelismerés ellenőrzése – 2026. november 9.

Valódi, lemért összetevőket tartalmazó fényképekkel hasonlítottuk össze a `food-v12-every-food` és a `food-v13-verified-views` változatot. A képpár téves elutasítása és az ételnevekbe kerülő technikai szöveg javult. Az adagbecslésben és az ételazonosításban maradtak érdemi hibák; általános pontossági százalékot ebből nem lehet megállapítani.

## Módszer és adatforrás

A [Nutrition5k szerzői adatkészletéből](https://github.com/google-research-datasets/Nutrition5k) négy, a hivatalos tesztfelosztásban szereplő tányért választottunk ki az első modellhívás előtt. A referencia összetevőnként lemért tömeg és az adatkészlet USDA-adatokból számított tápértéke. Nem laboratóriumi energiamérés. Forrás és licenc: Google Research / Nutrition5k szerzői, CC BY 4.0.

Mindegyikhez a `realsense_overhead/{id}/rgb.png` és a `side_angles/{id}/camera_{A|B}.h264` videó első képkockája tartozik. Az almánál B, a többinél A kamerát használtunk. A második kép közelebb mutathatja az ételt; a felülnézeti képen a teljes adag látszik. Mélységi adat nem került a modellhez. A képek és a CSV-k forrása: `https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset/`, ezen belül `imagery/`, `metadata/` és `dish_ids/splits/rgb_test_ids.txt`. Képkocka-kinyerés: `ffmpeg -i camera_A.h264 -frames:v 1 -q:v 2 side.jpg`.

Esetenként két mód futott: csak a képpár, illetve ugyanaz a képpár a lemért össztömeggel. Az összetevők neve és a referencia tápértéke nem került a modellhez. Mindkét változat ugyanazt a `gemini-4-argon` modellt, képeket, 44 tételes referenciakatalógust és 10 000 tokenes kimeneti keretet használta. Menetenként egy AI-hívás történt, automatikus újrapróbálás nélkül. A gondolkodási és mintavételi beállításokat nem módosítottuk.

Ez diagnosztikai összehasonlítás: a v13 javításaihoz már ismertük a v12 hibáit. Nincs külön érintetlen ellenőrző készlet, ismételt futás vagy statisztikai szignifikanciavizsgálat. A négy kaliforniai étkezdei tányér nem képviseli a magyar konyhát és a telefonos fotózás minden helyzetét.

## Eredmények

Az alábbi számok a teljes tányér kcal-értékei; egy tizedesre kerekítve. Az elutasított esetekhez nincs számszerű előrejelzés.

| Eset | Referencia | v12, képpár | v13, képpár | v12, ismert tömeg | v13, ismert tömeg |
|---|---:|---:|---:|---:|---:|
| Alma – `dish_1558641164` | 80,1 | 85,8 | 83,2 | 80,1 | 80,1 |
| Csirke, brokkoli, répa, spenót – `dish_1565811061` | 380,3 | 240,7 | 240,7 | 271,9 | 280,8 |
| Pizza, csirke, ananász, paradicsom – `dish_1566328805` | 927,8 | elutasítva | 809,1 | 791,9 | 798,0 |
| Tojásfehérje, reszelt burgonya, bogyós gyümölcs, édesburgonya – `dish_1561739238` | 274,2 | elutasítva | 142,8 | 174,2 | 197,4 |

| Mutató | v12 | v13 |
|---|---:|---:|
| Elfogadott képpár, tömeg nélkül | 2/4 | 4/4 |
| Elfogadott képpár, ismert tömeggel | 4/4 | 4/4 |
| Átlagos abszolút kcal-hiba, ismert tömeggel, ugyanazon négy eset | 86,1 | 76,5 |
| Átlagos abszolút kcal-hiba, csak a mindkét változatban elfogadott két eset, tömeg nélkül | 72,7 | 71,4 |
| Átlagos abszolút kcal-hiba, minden elfogadott eset, tömeg nélkül | 72,7 (n=2) | 98,2 (n=4) |
| Átlagos abszolút tömeghiba, tömeg nélkül | 25,0 g (n=2) | 30,3 g (n=4) |

A különböző elemszámú utolsó két sort nem szabad közvetlen javulásként vagy romlásként értelmezni. A v13 két nehezebb, korábban elutasított ételt is értékelt. Ismert össztömegnél a tömeghiba nulla, mert a szerver a megadott tömegre arányosít; ez nem az összetevőarányok helyességének bizonyítéka. Mindkét változat inkább alábecsülte az energiát ebben a kis mintában.

## Feltárt hibák és javítások

- **Ételnevek:** a v12 almanevébe belső angol megjegyzések, számítási és forrásleírások kerültek. A névmezők sémája most rövid, konkrét ételnevet kér. A v13 nyolc étkezéselemzésében a nevek tiszták voltak. Ez megfigyelt eredmény, nem minden későbbi válaszra érvényes garancia.
- **Nézőpont:** a modell két valódi felül–oldalnézeti képpárt puszta forgatásnak vagy nagyításnak minősített. Most külön képazonosítókat kap, és a perspektívát, az oldalfalakat, a takarást vizsgálja. Kivágott második nézet csak valódi térbeli többlettel fogadható el. A Google [képfeldolgozási útmutatója](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/image-understanding) is javasolja több kép egyértelmű indexelését.
- **Összetevőarány:** az utasítás külön figyelmeztet, hogy a képfelület nem tömegarány; a levél, a hús, a rétegvastagság és a takart rész eltérő becslést igényel. A csirkés tányér 205 g csirkéjét ismert össztömeg mellett a v12 125 g-nak, a v13 130 g-nak becsülte. Ez csak kis javulás; a hiba továbbra is számottevő.
- **Összetéveszthető ételek:** a v12 a reszelt burgonyát ismert tömeg mellett is káposztának nevezte. A v13 ismert tömeggel felismerte, tömeg nélkül továbbra is káposztának nézte. A képi azonosságot a szerver nem képes pusztán a tápértékek ellenőrzésével bizonyítani.
- **Értékelési hiba:** a Nutrition5k USDA-szénhidrátértéke rostot is tartalmaz, az alkalmazás szénhidrátértéke nem. A mérőeszköz most azonos alapra hozza őket. Ismeretlen rostnál a teljes szénhidrát előrejelzése is ismeretlen marad. A korábbi futást az eltárolt válaszokból újraszámoltuk, új modellhívás nélkül. Az alkalmazás tápértékadatait ez nem változtatja meg.

## Ellenőrző próbák és költség

Négy további valódi szolgáltatói kérés a v13-mal:

| Bemenet | Elvárt és megfigyelt eredmény |
|---|---|
| Alma és másik étkezés pizzás tányérja | Elutasítás: eltérő étkezés |
| Ugyanaz az almafelvétel PNG-ben és újratömörített JPEG-ben | Elutasítás: nincs új nézőpont |
| Fekete és szürke üres képkocka | Elutasítás: nincs felismerhető étel |
| Ellenőrzött, mesterséges italcsomagolás és címke | 330 ml; 40 kcal/100 ml; összesen 132 kcal és 16,5 mg nátrium |

A címkepróba a címkeolvasást, az egységváltást és a só–nátrium számítást ellenőrzi; nem valódi ételfotós pontosságmérés. A négy sikeres ellenőrzés nem bizonyítja minden hibás kép kiszűrését.

A szolgáltató által közölt költség: v12 nyolc hívás **0,24686 USD**, v13 nyolc hívás **0,24382 USD**, négy ellenőrzés **0,09984 USD**, összesen **0,59052 USD**. Az elutasított válaszok is számlázódtak. Ez a konkrét futás költsége, nem általános megtakarítási ígéret. Az értékelő ezentúl az elutasított eredmény szolgáltatói költségét és késleltetését is megőrzi.

A referenciaadatok, az összetevőlisták, a képek SHA-256 lenyomatai, a promptlenyomatok, a szolgáltatói használati adatok és a részletes hibamutatók: [géppel olvasható mérési napló](AI-VALIDATION-2026-11-09.json). Hitelesítési adat és felhasználói fénykép nincs benne. Újrafuttatás a [benchmark eszközzel](BENCHMARK.md); a nem determinisztikus modell új válasza eltérhet.

## Következő, független mérés

A fő fennmaradó kockázat a hasonló külsejű ételek összetévesztése és a sűrű, részben takart összetevők tömegaránya. Ezekre új, előre lezárt, a fejlesztésnél nem használt magyar fotók szükségesek, lemért összetevőkkel, olajjal és készételtömeggel. A biztosan ismert recept vagy az összetevőnként mért grammok már most rögzíthetők; a becslés javítása és a forrásválasztás szerkeszthető. Nem került a programba a négy teszttányérhoz kötött szabály vagy referenciaérték.
