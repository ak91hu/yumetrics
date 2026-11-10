# Food-R1 kipróbálása Modalon

Ez egy külön, hitelesítést igénylő próbatelepítés. Az éles Yumetrics továbbra is a meglévő képelemzőt használja. A Food-R1 felismerését, magyar ételeken mutatott pontosságát és tényleges költségét előbb mérni kell; a válasza nem kerül automatikusan a naplóba.

## Fiók és helyi bejelentkezés

1. Regisztrálj a [Modal oldalán](https://modal.com/signup). A [dokumentáció](https://modal.com/docs/guide) szerint a GPU használatához érvényes fizetési mód szükséges.
2. A projekt mappájában, PowerShellben futtasd:

```powershell
$env:PYTHONUTF8 = '1'
python -m venv work/modal-env
& ./work/modal-env/Scripts/python.exe -m pip install -r scripts/requirements-modal.txt
& ./work/modal-env/Scripts/python.exe -m modal token new --profile yumetrics
```

A legutóbbi parancs böngészős jóváhagyást kér, és a hitelesítést a felhasználói mappa `.modal.toml` fájljába menti. Nem kell tokent a chatbe, a forráskódba vagy az alkalmazás `.env` fájljába másolni. A konfiguráció tartalmát ne oszd meg. A belépés után ezzel listázhatod a profilokat titkok kiírása nélkül:

```powershell
& ./work/modal-env/Scripts/python.exe -m modal profile list
```

## Telepítés és egy fotó elemzése

A helyi gépre csak a Modal kliens és a képellenőrzéshez szükséges Pillow kerül. A nagy modellfájlok és a GPU-függőségek a Modal felhőjében maradnak.

```powershell
& ./work/modal-env/Scripts/python.exe -m unittest discover -s tests -p test_modal_foodr1.py -v
& ./work/modal-env/Scripts/python.exe -m modal deploy scripts/modal_foodr1.py
& ./work/modal-env/Scripts/python.exe -m modal run scripts/modal_foodr1.py --image-path work/etelfoto.jpg --output work/modal-foodr1-result.json
```

A futtatás előtt tegyél egy saját tesztképet a megadott helyre. JPEG, PNG vagy WebP használható, legfeljebb 8 MiB és 20 megapixel méretben. A parancs a hibás képet még a felhőhívás előtt elutasítja, az EXIF szerinti forgatást kezeli, és a hosszabb oldalt legfeljebb 1600 pixelre méretezi. Az első futtatás CPU-n letölti a rögzített modellverziót a tartós Modal Volume-ba, majd GPU-n indítja a felismerést. A későbbi próbák ugyanazokat a modellfájlokat használják.

A JSON az eredeti modellválaszt, a modell verzióját, a tokenek számát, a feldolgozás idejét, a konténer modellbetöltési idejét, a kliens várakozási idejét és a csúcs GPU-memóriahasználatot tartalmazza. Az utóbbi idők nem azonosak a számlázott idővel; a költséget a Modal Usage adataival kell összevetni. A próba angol utasítást használ. Az 512 új tokenes korlát elérését `truncated: true` jelzi; ilyenkor a válasz hiányos lehet, és nem indul automatikus újrapróbálás.

A `modal run` ideiglenes alkalmazásban végzi a próbát; a `modal deploy` tartós, SDK-n keresztül elérhető szolgáltatást hoz létre. A próba nem igényel nyilvános HTTP-végpontot vagy külön végponti API-kulcsot. A telepített osztály később `modal.Cls.from_name("yumetrics-food-r1-trial", "FoodR1")` használatával érhető el hitelesített kliensből; a modell előkészítését az első hívás előtt el kell végezni.

## Erőforrások és költségek

- Egy L40S GPU, 48 GB videómemóriával; ez induló választás, kisebb GPU-ra mérés után érdemes váltani.
- Legalább nulla és legfeljebb egy GPU-konténer alkalmazásonként, tartalék konténer nélkül; az üresjárati leállítás beállítása 2 másodperc. Párhuzamos külön próbafuttatások külön alkalmazásokat hoznak létre, ezért egyszerre csak egy próbát indíts.
- 180 másodperces elemzési és külön 600 másodperces indulási időkorlát. Az előkészítés CPU-n fut, legfeljebb 30 percig.
- Rögzített modellverzió, kizárólag Safetensors-súlyok és helyi modellfájlok; nincs idegen modellkód futtatása. A fotókat nem írjuk a modellkötetbe.

A 2026-11-10-én ellenőrzött [Modal árlista](https://modal.com/pricing) alapján az L40S GPU-rész 0,000542 USD/másodperc, azaz 1,9512 USD/óra. A CPU, a rendszermemória, a tartós tárhely, a betöltés és az esetleges üresjárat további költség. A Starter csomag havi 30 USD kreditje nem automatikus költési plafon. A regisztráció után ellenőrizd a fiókodban az elérhető keretet és a költési beállításokat; a tényleges díjat a Usage oldalon figyeld.

## Ellenőrzés és következő lépés

Helyben a képek ellenőrzése, a forgatás, az átméretezés és a telepítési modul importja tesztelhető GPU és Modal-bejelentkezés nélkül. Felhőben külön ellenőrizni kell a konténer összeállítását, a modell betöltését, egy hideg és egy újabb futtatás válaszát, a leállást és a számlázott költséget. A helyi teszt sikere önmagában nem igazolja a GPU-s működést.

A modell és a kiadott súlyok forrása: [Food-R1 kód](https://github.com/hustvl/Food-R1), [modellfájlok](https://huggingface.co/zy12123/Food-R1). Csak az összehasonlító mérés után érdemes a Yumetrics szolgáltatói rétegébe bekötni: ehhez a meglévő összetevő-, tápérték- és hibakezelési szerződést is teljesítenie kell.

## Első működési próba, 2026-11-10

A telepítés megtörtént a tulajdonos Modal-munkaterületére. Egyetlen GPU-s próbát indítottunk az oldal nyilvános csülökfotójával; az eredmény helyesen nevezte meg a csülköt és a salátát. Az elemzés 12,696 másodpercig tartott, a modellbetöltés 15,590 másodperc volt, a kliens 39,164 másodperc alatt kapott választ. A csúcs GPU-memóriahasználat 16,804 GiB, a bemenet 1606, a kimenet 300 token volt; a válasz nem érte el a tokenkorlátot. A modell első, CPU-s letöltése külön történt.

Ez működési próba, nem pontosságmérés: a fotóhoz nincs lemért tápértékadat. A modell kéretlen táplálkozási tanácsokat is adott, és nem állította elő az alkalmazás teljes összetevőnkénti tápértékszerkezetét. A betöltés során a tokenizer reguláris kifejezésére is figyelmeztetést adott a futtatókönyvtár; ennek hatását nem vizsgáltuk. Éles átállítás nem történt. A tesztalkalmazás befejeződött, az ellenőrzéskor nulla futó konténer maradt.

Négy helyi Python-teszt és három dokumentációs Node-teszt sikeres, az alkalmazás buildje is elkészült. Újabb GPU-s hívást, második fotós próbát vagy összehasonlító mérést a takarékos tesztelés érdekében nem indítottunk.

A próba utáni számlázási pillanatkép körülbelül 0,04 USD mért felhasználást és 0 USD fizetendő díjat mutatott; a kreditek és a hálózati keret fedezték a költséget. A részletes jelentésben az egyetlen L40S-futás 0,02028571 USD volt. A számlázási adatok késleltetve frissülhetnek, a tartós modellkötet pedig a GPU leállása után is megmarad.

## Northflank szerveroldali hitelesítés

A helyi telepítési API-token a felhasználói `.modal.toml` fájlban marad. A Northflank számára külön `yumetrics-northflank` nevű **Modal Proxy Token** készült. Ez a Modal hitelesített HTTP-végpontjainak hívására használható; nem telepítési vagy fiókkezelési jogosultság.

A `default` Northflank-projekt `yumetrics-modal` titokcsoportja a `MODAL_PROXY_TOKEN_ID` és `MODAL_PROXY_TOKEN_SECRET` értékeket tartalmazza. A csoport kizárólag a `yumetrics` szolgáltatás **futtatási környezetéhez** van rendelve, build argumentként nem elérhető. Az értékeket mentés után visszaolvasva ellenőriztük; a meglévő alkalmazástitkok változatlanok maradtak. A tokent tartalmazó helyi átviteli fájlt töröltük.

A későbbi HTTP-bekötéskor a végpontot `requires_proxy_auth=True` beállítással kell védeni, és a szerver a `Modal-Key`, illetve `Modal-Secret` fejlécben küldi a két környezeti értéket. A kulcs nem kerülhet böngészős JavaScriptbe, válaszokba vagy naplóba. A proxy token munkaterületi HTTP-hozzáférést ad, nem egyetlen modellre korlátozott kulcs; RBAC esetén a környezeti társítások tovább szűkíthetők. [Modal hitelesítés](https://modal.com/docs/guide/webhook-proxy-auth).

Ez a hitelesítés előkészítése: a jelenlegi próba továbbra is a Modal SDK-val hívható. A védett HTTP-végpont, az alkalmazás szolgáltatói bekötése és az éles átállítás külön lépés; pusztán a két környezeti változó megléte ezeket nem kapcsolja be. A token Northflankba adásához újabb GPU-s modellhívást nem indítottunk.
