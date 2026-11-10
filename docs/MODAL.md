# Food-R1 8B és OpenCode együtt

A Modalon a `zy12123/Food-R1` körülbelül 8 milliárd paraméteres ételspecialista modell fut, az eredeti BF16-súlyokkal, rögzített verzióval. Csak rövid ételneveket javasol. Az OpenCode egyetlen elemzőkérése az eredeti fotókból ellenőrzi ezeket, felismeri a kimaradt elemeket, majd előállítja a napló teljes eredményét. A tápértékeket továbbra is az alkalmazás számolja össze a mennyiségek és a forrásadatok alapján.

A választás és a mérések: [modellkutatás](FOOD-MODELS-2026-11-10.md). A segéd gramm-, kalória- és makrotápanyag-becsléseit nem adjuk tovább. A próbában javasolt, nem igazolható Caesar-öntet nem került a végső étkezésbe.

A segéd válaszát és az OpenCode eredményét az alkalmazás tartósan archiválja, külön hívásrekordban. A Modal a rögzített modellrevízió mellett a felismerési prompt verzióját és SHA-256-lenyomatát, valamint a generálási korlátot is visszaadja. Ez segít megkülönböztetni a későbbi változatokat, új GPU-hívás nélkül. Hozzáférés és megőrzés: [AI-válaszarchívum](ADMIN.md#ai-válaszarchívum).

## Kliens és telepítés

```powershell
$env:PYTHONUTF8 = '1'
python -m venv work/modal-env
& ./work/modal-env/Scripts/python.exe -m pip install -r scripts/requirements-modal.txt
& ./work/modal-env/Scripts/python.exe -m modal token new --profile yumetrics
& ./work/modal-env/Scripts/python.exe -m unittest discover -s tests -p test_modal_foodr1.py -v
& ./work/modal-env/Scripts/python.exe -m modal deploy scripts/modal_foodr1.py
```

A böngészős jóváhagyás után a telepítési token a felhasználói mappa `.modal.toml` fájljába kerül. Ne tedd a forrástárba vagy a chatbe. A GPU használatához a Modal [fiókot és érvényes fizetési módot kér](https://modal.com/docs/guide).

A modellfájlok a `yumetrics-food-r1-weights` tartós Volume-ban vannak. Új telepítésnél az első GPU-hívás előtt töltsd le őket CPU-n:

```powershell
& ./work/modal-env/Scripts/python.exe -m modal run scripts/modal_foodr1.py::prepare
```

Külön, fizetős működési próbát ez indít; az eredmény helyi JSON-ba kerül:

```powershell
& ./work/modal-env/Scripts/python.exe -m modal run scripts/modal_foodr1.py --image-path work/etelfoto.jpg --output work/modal-foodr1-result.json
```

## Northflank szerveroldali hitelesítés

A `default/yumetrics` szolgáltatás a `yumetrics-modal` runtime titokcsoportból kapja a konfigurációt:

| Változó | Szerep |
| --- | --- |
| `MODAL_FOOD_URL` | A telepítéskor kiírt HTTPS-cím `/recognize` útvonallal |
| `MODAL_PROXY_TOKEN_ID`, `MODAL_PROXY_TOKEN_SECRET` | Proxy Token a `Modal-Key` és `Modal-Secret` fejléchez |
| `MODAL_MONTHLY_BUDGET_USD` | Belső havi becsült keret, alapértéke 15 USD; nullával kikapcsolható a segéd |

A proxy token végponthívásra használható; nem ad telepítési vagy fiókkezelési jogot. Munkaterületi HTTP-hozzáférést ad, RBAC esetén a környezeti társítások szűkíthetők. A helyi telepítési API-token a gépen marad. A csoport kizárólag a Yumetrics futtatási környezetéhez tartozik; kulcs nem kerül build argumentba, böngészős kódba vagy naplóba. [Modal hitelesítés](https://modal.com/docs/guide/webhook-proxy-auth).

Titokmódosításkor teljes, visszaolvasott térképet kell megőrizni: a Northflank részleges változótérképpel felülírhatja a korábbi kulcsokat. Az értékeket visszaolvasással és a futó konténerben, az értékek kiírása nélkül ellenőrizzük.

## Végpont és hibakezelés

A `GET /health` csak CPU-n ellenőrzi a védett végpontot. A `POST /recognize` JSON-t vár: `{"images":["data:image/jpeg;base64,…"]}`; egy vagy két nézet küldhető. Távoli kép-URL, felhasználói prompt és más mező nem fogadható el. A gateway 12 MiB-os teljes törzskorlátot, képenként 8 MiB-os és 20 megapixeles korlátot alkalmaz, kezeli az EXIF-forgatást, és legfeljebb 1600 pixelesre méretezi a hosszabb oldalt. JPEG, PNG és WebP támogatott.

A modell a kész étellistánál megáll. A 160 új tokenes korlátot elérő, használhatatlan válasz, időtúllépés, hibás verzió vagy hálózati hiba esetén az OpenCode önállóan folytatja, újabb segédhívás nélkül. A gateway 45 másodperc után törli a függő modellhívást és leállítja annak konténerét. A hitelesítés nélküli kérést a Modal a gateway és a GPU előtt elutasítja.

## Költségek

Egy L40S, 48 GB VRAM, két CPU-mag és 16 GiB rendszermemória szerepel a konfigurációban. A kisebb L4-re indított próba kapacitáshiány miatt sorban maradt; a hívást töröltük. Az L40S-en a két végső próba 2,1–2,7 másodperc alatt adott 17–23 tokenes étellistát; hidegindításkor további körülbelül 17–18 másodperc volt a betöltés.

Legfeljebb egy GPU-konténer futhat, minimum és tartalék konténer nincs. A GPU és a külön CPU-s gateway egyaránt `single_use_containers=True` beállítással fut: a [Modal dokumentált működése](https://modal.com/docs/sdk/py/latest/App#cls) szerint minden feldolgozott bemenet után megszűnik a konténer. A GPU-függvényhez `retries=0` tartozik; az üresjárati tartalékbeállítás két másodperc. Időtúllépés és hiba esetén a gateway `terminate_containers=True` paraméterrel törli a modellhívást. Az alkalmazás telepítve és hívható marad, de kérés nélkül nincs fenntartott GPU- vagy gateway-konténer. A közvetlen SDK-próbák külön alkalmazásban is indíthatnak konténert, ezért ezeket egymás után kell futtatni.

Az egyszer használatos konténer minden új képelemzéshez újra betölti a modellt. Ez növelheti a várakozást és a hidegindítás költségét a közvetlenül egymás után érkező kéréseknél; cserébe sikeres válasz után sem marad melegen a GPU. A modellkötet tárhelye ettől még megmarad, és a belső havi keret továbbra sem szolgáltatói költési plafon.

A 2026-11-10-én ellenőrzött [árlista](https://modal.com/pricing) szerint az L40S GPU-rész 0,000542 USD/másodperc. Az admin a mért modellbetöltési és elemzési időre GPU-, CPU- és memóriaköltséget becsül, külön hívásrekordban. Ez részösszeg: a gateway, üresjárat, tárhely és a platform indulási többlete nem szerepel benne. Hiányzó időadatnál a költség ismeretlen, nem nulla. A teljes díjat és a kreditet a Modal számlázásában kell ellenőrizni.

A belső havi keret az adatbázisban megőrzött költségekkel számol; az ismeretlen és folyamatban lévő hívásokra 90 másodpercnyi erőforrásdíjat tart fenn. A foglalásokat közös tranzakciós zárolás védi. A keret felett az OpenCode önállóan folytatja. Ez nem szolgáltatói költési plafon: más alkalmazások és a közvetlen SDK-próbák fogyasztását nem tartalmazza. A Starter havi 30 USD kreditje sem költési plafon.

A két szolgáltatás együtt több erőforrást használhat, mint az OpenCode önmagában. Az ingyenes Modal-keret mérsékelheti a fizetendő összeget, de általános költségcsökkenést a kis próba nem igazol. A tartós modellkötet a GPU leállása után is megmarad.
