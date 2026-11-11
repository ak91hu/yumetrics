# Fejlesztés, tesztelés és a dokumentáció karbantartása

## Előfeltételek

- Node.js 24 vagy újabb, npm.
- Python 3.10+ a dokumentáció helyi buildjéhez; a Node alkalmazás éles futásához nem szükséges.
- Fejlesztési PostgreSQL és saját, megfelelően konfigurált Google-kliens az interaktív naplóhoz.
- Chrome/Chromium a külön böngészős ellenőrzéshez.

A SQLite-adapter lehetővé tesz izolált automatizált próbákat, de az éles PostgreSQL-viselkedést nem helyettesíti teljesen. A szolgáltatói kulcsokat tartalmazó `.env` mindig helyi és figyelmen kívül hagyott fájl legyen.

## Helyi indítás PowerShellből

```powershell
npm ci
Copy-Item .env.example .env
# A .env mezőit saját fejlesztési értékekkel töltsd ki.
npm run dev
```

A fejlesztői szerver a helyi `.env` beállításait olvassa. Élesben kizárólag az injektált környezeti változókra támaszkodik. A Google callback, a kliens originje és a lokális cím legyen összhangban.

## MkDocs telepítése és build

```powershell
py -3.11 -m venv work/mkdocs-venv
& work/mkdocs-venv/Scripts/python.exe -m pip install -r scripts/requirements-docs.txt
$env:MKDOCS_PYTHON = (Resolve-Path work/mkdocs-venv/Scripts/python.exe).Path
npm run docs:build
npm run build
```

A Python-verzió választható a támogatott környezetből; a példában 3.11 szerepel. Linuxon használható `python3 -m venv work/mkdocs-venv` és `MKDOCS_PYTHON=$PWD/work/mkdocs-venv/bin/python npm run build`.

A `mkdocs.yml` tartalmazza a navigációt, a témát, a magyar felületet és a magyar/angol keresőnyelvet. A források a `docs/technical/`, a témasablon a `docs/theme/` könyvtárban vannak. A generált `public/technical-docs/` nem verziókezelt állomány; a Docker-build újragenerálja. A végleges alkalmazáscsomagba a lefordított oldalak kerülnek.

Önálló élő előnézet:

```powershell
& $env:MKDOCS_PYTHON -m mkdocs serve --dev-addr 127.0.0.1:8000
```

A Node-szerveren a `/docs/` mutatja a legutolsó generált változatot; a MkDocs fejlesztői előnézetét nem kell élesben futtatni. A meglévő magyar/angol felhasználói útmutató és a `dist/documentation/` önálló útmutatócsomag ettől külön megmarad.

## Tesztrétegek

| Réteg | Mit ellenőriz? |
| --- | --- |
| Node `node:test` | Tartományi számítás, forrásmegőrzés, jogosultság, API, tranzakciók, feladatok |
| SQLite és PostgreSQL | Az adapterek és adatbázis-specifikus zárolások viselkedése |
| Böngészős próba | Valós DOM, interakció, lokalizáció, nézetméret, képelőkészítés, mentés |
| Modal Python-tesztek | Validálás, konténerbeállítás és leállítást kérő hibakezelés |
| MkDocs strict build és útvonaltesztek | Oldalak, belső hivatkozások, publikus kiszolgálás, biztonságos fájlhatár |
| Fizetős referenciamérés | Valódi modellpontosság, tényleges költség és késleltetés |

```powershell
npm test
node scripts/browser-check.mjs
```

A PostgreSQL-tesztekhez a tesztfájlokban jelzett, elkülönített adatbázis-URL-ek szükségesek; az éles adatbázist nem szabad tesztcélra megadni. A böngészős ellenőrzés szimulált szolgáltatókkal dolgozik, saját ideiglenes adatállománnyal. Nem helyettesíti a valódi mobilkamerát vagy az éles Google-belépés végigpróbálását.

## Pontosságmérés és költségfegyelem

A `scripts/evaluate-nutrition.mjs` referenciás mérési eszköz; a [benchmarkleírás](https://github.com/ak91hu/yumetrics/blob/main/docs/BENCHMARK.md) a bemeneteket, mutatókat és költségkezelést dokumentálja. Egy futás valódi szolgáltatói hívásokat indíthat, ezért nem része az általános buildnek vagy a hétköznapi egészségellenőrzésnek.

Az ismert tömeggel és tömeg nélkül mért adaghiba külön mutató. A felismerési hibát nem szabad kedvező összesített kalóriahibával elfedni. A tesztadatokkal végzett promptjavítás után ugyanaz a kis minta már nem független vakteszt. A nyers mérési naplókat és a korábbi dátumozott eredményeket változatlan bizonyítékként kell megőrizni.

## Dokumentációs változtatás ellenőrzése

Új működésnél az érintett technikai fejezet és a README együtt frissítendő. API-módosításnál a metódus, útvonal, státusz, adatszerződés és jogosultság is változhat. Új tábla esetén az adatmodell, migrációlista és helyreállítási következmény dokumentálandó. Új külső szolgáltatóhoz adatkezelési és titokkezelési leírás kell.

A strict build után ellenőrizendő a kereső, mobilos navigáció, a helyi erőforrások és a CSP-konzol. A MkDocs konfigurációja a [hivatalos dokumentációban](https://www.mkdocs.org/user-guide/configuration/) követhető. A külső forrásokra mutató hivatkozások nem jelentenek automatikus szolgáltatói ár- vagy API-kompatibilitási ellenőrzést.

Források: [tesztek](https://github.com/ak91hu/yumetrics/tree/main/tests), [böngészős ellenőrzés](https://github.com/ak91hu/yumetrics/blob/main/scripts/browser-check.mjs), [build](https://github.com/ak91hu/yumetrics/blob/main/scripts/build.mjs), [ellenőrzési napló](https://github.com/ak91hu/yumetrics/blob/main/docs/VERIFICATION.md).
