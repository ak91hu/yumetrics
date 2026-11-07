# Yumetrics

![Yumetrics — your food, in numbers](public/brand-banner.svg)

**[Élő alkalmazás](https://http--yumetrics--dmg6gnvmmd7s.code.run)** · **[Magyar útmutató](https://http--yumetrics--dmg6gnvmmd7s.code.run/utmutato)** · **[English guide](https://http--yumetrics--dmg6gnvmmd7s.code.run/guide)**

Magyar és angol nyelvű étkezési napló kötelező Google-belépéssel, ellenőrizhető tápértékforrásokkal és javítható AI-becsléssel. Magyar konyhai támpontokkal kezeli a rántás/habarás, panír, csont, tejföl és feltét bizonytalanságát. A saját receptből a teljes kész étel és az elfogyasztott adag alapján számol; külön jelzi a fotós és receptalapú eredményt. A támogatott szerver **Node.js 24+ és PostgreSQL**. Élesben a felhasználói képek Cloudinaryban, minden más tartós alkalmazásadat külön **Northflank PostgreSQL addonban** van.

## Helyi indítás

```powershell
npm ci
npm start
```

Cím: **http://127.0.0.1:3000**. A `.env` már létrejött, Git és a Docker build nem tartalmazza. A helyi gépen külön PostgreSQL 17.11 példány indult a `127.0.0.1:54329` címen, külön alkalmazás- és tesztadatbázissal; a helyi `DATABASE_URL` beállítva. A hozzáféréseket a saját `.env` fájlban kell beállítani; a nyilvános repó csak üres mintát tartalmaz. A bejelentkezőoldal konfiguráció nélkül is megjelenik, de a naplóhoz nincs kerülő belépés.

Tiszta gépen állíts be saját fejlesztői PostgreSQL-t vagy használd a `compose.yaml` adatbázisát: adj meg `LOCAL_POSTGRES_PASSWORD` környezeti változót, majd `docker compose up -d database`. A `.env` `DATABASE_URL` mezőjében ugyanaz a jelszó, `127.0.0.1:54329/yumetrics` szerepeljen. Ez fejlesztői adatbázis; élesben a Northflank kapcsolatát használd.

A mostani hordozható helyi PostgreSQL adatai `work/pgdata` alatt vannak. A könyvtár törlése törli ezt a helyi adatbázist is. Új gépindítás után indítás/leállítás:

```powershell
& ./work/postgresql/pgsql/bin/pg_ctl.exe -D ./work/pgdata -l ./work/postgres.log -o '-h 127.0.0.1 -p 54329' -w start
& ./work/postgresql/pgsql/bin/pg_ctl.exe -D ./work/pgdata -m fast -w stop
```

## Google és szolgáltatói kulcsok

**[Minden szükséges kulcs, beszerzési hely és beállítás](docs/API-KEYS.md)**. Az OpenCode-kulcs az AI-hoz kell, a Google OAuth-kliens a belépéshez; nem ugyanaz a hozzáférés. A Northflank-adatbázis kapcsolati URI-ja nem platform-API-token.

A `.env.example` felsorolja a mezőket; a saját `.env` fájlba másold a titkokat. Módosítás után indítsd újra az alkalmazást.

| Mező | Érték |
| --- | --- |
| `DATABASE_URL` | PostgreSQL írható primary URI; élesben Northflank |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Az ehhez az alkalmazáshoz létrehozott Google OAuth webkliens |
| `APP_ORIGIN` | Pontosan a böngészőből használt eredet, végső perjel nélkül |
| `OPENCODE_API_KEY` | OpenCode Console kulcs |
| `OPENCODE_MODEL` | Alapértelmezés: `gemini-4-argon`; natív Gemini-protokoll |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Saját Cloudinary-fiók |
| `USDA_API_KEY` | Opcionális FoodData Central kulcs a bővebb referencia-kereséshez |

A Google Cloud Console-ban hozz létre **Web application** OAuth-klienst, állítsd be a consent screen adatait és a tesztfelhasználókat, amíg az alkalmazás tesztmódban van. Helyi **Authorized redirect URI**:

```text
http://127.0.0.1:3000/auth/google/callback
```

Saját domainnél a HTTPS domain ugyanilyen `/auth/google/callback` végződésű címe kell. A mostani éles telepítés saját domain nélkül, jóváhagyott GitHub Pages-visszatérő oldalt használ: `https://ak91hu.github.io/yumetrics/oauth.html`, szerveroldali `GOOGLE_REDIRECT_URI` beállítással. Az `APP_ORIGIN` és a regisztrált callback egyezzen; a localhost és a 127.0.0.1 külön cím. Csak `openid email profile` scope kell, Gmail/Drive-hozzáférés nem. A Google-jelszót és a Google access/refresh tokent nem tároljuk. [Google OIDC-beállítás](https://developers.google.com/identity/openid-connect/openid-connect).

A munkamenet 30 napos, adatbázisban tárolt, a nyers token helyett SHA-256 hashsel. A süti HttpOnly, SameSite=Lax, HTTPS-en Secure és __Host- előtagú. A felhasználó stabil Google `sub` azonosítóhoz kötött, emailváltozás nem hoz létre másik naplót. A callback egyhasználatú state-et, nonce-ot, PKCE-t és a hivatalos Google-könyvtár ID-token ellenőrzését használja. Korábbi jelszavas vagy ChatGPT-fejléces belépés nincs.

## Étkezés rögzítése

1. Google-belépés után válassz fotót, napot, időpontot; megadhatsz második nézetet, ismert tömeget és elkészítési információt.
2. **A kép először Cloudinaryba kerül**, a feldolgozás tartós adatbázis-feladatként folytatódik. Az ablak bezárható; a piszkozat visszakereshető.
3. Ellenőrizd az ehető grammokat, a nyers/főtt/sült állapotot és az olajat. Csontot/héjat külön megadhatsz levonandó tömegként. A külön lemért, elfogyasztott összetevőket megjelölheted.
4. Válassz megfelelő USDA-referenciát vagy saját termékcímkeértéket. USDA-kulccsal angol névre kereshetsz, majd kiválaszthatod az adott elkészítés rekordját. A forrás ellenőrzött másolata megmarad a naplóban.
5. Mentsd a naplóba. A későbbi javítás az eredeti AI-elemzést nem írja felül. A napi energiakeret is a fiókodban tárolódik.

A beépített referenciatár már **44 USDA-rekordot** tartalmaz magyar konyhai alapanyagokkal és állapotokkal: [források és korlátok](docs/REFERENCE-CATALOG.md).

**Saját fazék/tepsi:** a részleteknél válaszd az „Saját recept megadása” lehetőséget. Add meg a teljes recept ételben maradt alapanyagait, a kész étel és a képen látható teljes adag tömegét. Nyers alapanyaghoz nyers forrást használj; a visszamaradt/elöntött olajat ne számold elfogyasztottnak. A receptmód nem hív új AI-t, és külön, megőrzött alapanyaglistából számol. A megjelenített, adagra jutó alapanyag-mennyiségek eltérhetnek az összetevők főzés utáni tömegétől. Az adagot a „Recept és adag javítása” útvonalon módosítsd.

Az adag mindig a képen látható teljes ehető étel és ital 100%-a. Nincs fogyasztási százalék, az új API-kérések részadagot nem fogadnak el. A számítás `a képen látható teljes adag ehető tömege grammban × tápérték/100 g ÷ 100`. Ismeretlen tápanyag `null`, nem nulla. A fotó és a modell önértékelése nem mért kalóriapontosság. Részletes módszertan: [PHOTO-ASSESSMENT.md](docs/PHOTO-ASSESSMENT.md), kutatási döntések: [RESEARCH.md](docs/RESEARCH.md).

Magyar piaci fókusz és források: [HUNGARIAN-POSITIONING.md](docs/HUNGARIAN-POSITIONING.md). A tényleges pontosság méréséhez külön értékelő parancs készült: [BENCHMARK.md](docs/BENCHMARK.md). Saját mért tesztkészlet nélkül nincs igazolt modellpontossági százalék.

A feltöltés JPEG-re rajzolja újra és legfeljebb 1600 pixelesre méretezi a képet; eredeti EXIF/GPS nincs archiválva. A kép az AI-szolgáltatóhoz és Cloudinaryhoz kerül. A normál Cloudinary delivery URL a link birtokában elérhető; a Google-belépés a naplót és az API-t védi. Ezt a feltöltő is jelzi. Szigorúan privát képhivatkozásokhoz authenticated delivery külön bevezetése kell.

## Tartósság és telepítés

**[Northflank telepítés, adatmodell, mentés és helyreállítás](docs/NORTHFLANK.md)**. A `Dockerfile` stateless Node-konténert épít. Nem használ app-podhoz csatolt SQLite-ot, helyi feltöltéskönyvtárat vagy memóriában tárolt munkamenetet. A `DATABASE_URL` hiánya/hibája nem indít üres tartalékadatbázist.

A korábbi `data/yumetrics.sqlite` fájl megmaradt; a váltáskor nem tartalmazott étkezést. Nem rendelünk korábbi közös naplót automatikusan egy Google-fiókhoz. A SQLite-adapter és a `drizzle/` migrációk csak régi adatok és tesztek támogatására maradtak. Az új éles séma: `postgres/0001_initial.sql`.

A régi `.openai/hosting.json` történeti Sites-azonosító. A korábban publikált Sites-példányt ez a helyi módosítás **nem frissítette és nem migrálta**. A build már Northflank Node-csomagot készít; a régi Worker belépési pont 503-at ad, nem fogad el hitelesítési fejlécet. Ne publikáld a régi csomagot az új alkalmazásként.

## Ellenőrzés

Az alkalmazás magyarul és angolul használható. A nyelvváltó a bejelentkezőoldalon, a felső sávban és az ablakokon belül is elérhető. A választást egy egyéves, a böngészőhöz kötött nyelvi süti őrzi; ez nem bejelentkezési adat. A dátumok és számok a választott nyelvhez igazodnak. A nyelvváltás megtartja a fotókat és a szerkesztés alatt álló adatokat. A korábbi elemzések és a saját szövegek az eredeti nyelvükön maradnak. Az új elemzés nyelvét a tartósan mentett `context.language` rögzíti. Az étkezéstípusok belső értékei továbbra is közösek, a felirataik fordítottak.

```powershell
npm test
npm run build
node scripts/browser-check.mjs
```

A teljes böngészős folyamat külön futtatható angolul és asztali vezérlőkkel is:

```powershell
$env:TEST_LANGUAGE = 'en' # hu vagy en
$env:TEST_DEVICE = 'desktop' # mobile vagy desktop
node scripts/browser-check.mjs
```

Mind a négy nyelv/eszköz párosítást ellenőrizzük; az alapbeállítás magyar/mobil. A tesztadatokhoz és az időzónához nem nyúl a fordítás.

A PostgreSQL-tesztekhez külön tesztadatbázis URL-je kell a `TEST_DATABASE_URL` folyamatváltozóban. Enélkül ez a három integrációs próba kimarad. A jelenlegi gépen az ignored `work/test-db-url` tartalmazza a helyi tesztkapcsolatot:

```powershell
$env:TEST_DATABASE_URL = Get-Content -LiteralPath work/test-db-url -Raw
npm test
```

A tesztek számítást, bemenetellenőrzést, forráshitelességet, Google-belépési határokat, tulajdonosi elkülönítést, revízióütközést és feltöltési/törlési hibákat ellenőriznek. Valódi PostgreSQL-lel külön alkalmazásfolyamatok kényszerített leállítását, munkamenet és adatok megmaradását, feladatfolytatást, lejárt lease visszavételét és párhuzamos költségkorlátot is vizsgálnak.

Publikálható használati útmutató és módszertan: [public/help.html](public/help.html). A build önálló statikus csomagot készít a `dist/documentation` könyvtárban. Közzétételi útmutató: [PUBLISHING.md](docs/PUBLISHING.md). A felület magyar szóhasználata és a nyelvi kutatás forrásai: [LANGUAGE.md](docs/LANGUAGE.md).

A Chrome-teszt kizárólag headless, külön profillal fut, 320/390/768/1024/1440 px szélességen; a személyes böngészőprofilt nem használja. Eredménye és képei: `outputs/`. Külső Google/OpenCode/Cloudinary/USDA hívásokat a tesztek helyettesítenek. A valódi szolgáltatói jogosultságot, a tényleges Northflank failovert és az ételfotós kalóriapontosságot ezek nem bizonyítják.

Az új arculat natív SVG logó, mérőskálával, 100-as számmal és oszlopokkal; nincs ® jel vagy mintaadat-mód. A csülök–saláta dekoráció generált kép; [asset és prompt](docs/ASSETS.md).
