# Northflank: tartós adatok és újraindítható alkalmazás

Frissítve: 2026-11-08. Az alkalmazás és a külön PostgreSQL 17 addon az **ak91hus-team/default** projektben, europe-west régióban fut. Az image a [GitHub-repozitóriumból](https://github.com/ak91hu/yumetrics), Dockerfile alapján épül.

- Elsődleges alkalmazáscím: https://yumetrics.app
- További címek: `www.yumetrics.app` és `http--yumetrics--dmg6gnvmmd7s.code.run`; az alkalmazás a beállított elsődleges címre irányítja át a GET/HEAD kéréseket, az útvonal és paraméterek megtartásával.
- Alkalmazásszolgáltatás: `yumetrics`, 1 példány, nf-compute-20, 512 MB memória.
- Adatbázis: `yumetrics-postgres`, PostgreSQL 17, nf-compute-20, 4 GiB tartós NVMe lemez, TLS, privát hálózat. A sémát az első indítás létrehozta.
- Titkok: `yumetrics-runtime`, kizárólag a Yumetrics alkalmazás futtatásához. A helyi adatbázis helyett az addon írható `POSTGRES_URI` értéke öröklődik `DATABASE_URL` néven. Minden feltöltött változó értéke visszaolvasva ellenőrzött. A titkok nincsenek a Gitben vagy az image-ben.
- Egészség: `/healthz` és `/readyz` HTTPS-en 200; az utóbbi az adatbázist is ellenőrzi.
- Automatikus mentés: heti native dump, vasárnap 02:15 UTC, 7 napos megőrzés. A napi ütemezést a Northflank az aktuális ingyenes csomagban elutasította.

### Google-belépés regisztrált Pages-visszatérő címmel

A Google Console elutasította az automatikus code.run callbacket. A felhasználó által jóváhagyott megoldás egy kicsi, statikus visszatérő oldal a saját GitHub Pages-címen: **https://ak91hu.github.io/yumetrics/oauth.html**. Ezt kell Authorized redirect URI-ként regisztrálni; szükség esetén Authorized domain: `ak91hu.github.io`. A szerveren `GOOGLE_REDIRECT_URI` erre a címre mutat, az `APP_ORIGIN=https://yumetrics.app`. A Pages-oldal rögzített Northflank-visszatérési címéről a szerver az elsődleges domainre irányítja a kérést; a state-, code- és error-paraméterek megmaradnak, így az elsődleges domainen beállított biztonságos süti ellenőrizhető.

A visszatérő oldal nem tölt be külső erőforrást, nem tárol adatot vagy tokent, nem választ átirányítási célt a kérésből. Csak a `state`, `code`, `error` mezőt adja tovább a rögzített Northflank callbacknek, és előtte törli a paramétereket a címsorból. Referrer-tiltás és szigorú CSP védi. A szerver ellenőrzi az eredeti állapotsütit, az egyszer használható adatbázis-state-et, a PKCE-t, a nonce-ot és a Google ID-tokent. A tokenváltásban is ugyanaz a Pages redirect URI szerepel. A GitHub Pages kizárólag statikus közvetítő; a felhasználók, munkamenetek és étkezések a Northflanken maradnak. A valódi belépés sikerét a felhasználó visszaigazolta.

A korábbi GPSART-előkészítésben létrejött tesztadatbázist a felhasználó kérésére megtartottuk. Az ottani titokcsoport szintén megmaradt; az éles alkalmazás ezeket nem használja.

## Választott felépítés

```text
Böngésző → HTTPS → Node alkalmazáspod(ok)
                    ├─ Google OIDC: belépés
                    ├─ Northflank PostgreSQL addon: összes tartós alkalmazásadat
                    ├─ Cloudinary: felhasználói fotók
                    └─ OpenCode: képelemzés
```

A PostgreSQL addon az alkalmazástól külön erőforrás, tartós adatlemezzel. A Northflank PostgreSQL-t, TLS-t, secret group kapcsolatátadást és írható primary kapcsolati URI-t biztosít. Az alkalmazás a `POSTGRES_URI` titkot `DATABASE_URL` alias alatt kapja meg. Az adatbázis maradjon privát hálózaton; az appot HTTPS-en publikáld. [Northflank PostgreSQL útmutató](https://northflank.com/docs/v1/application/databases-and-persistence/deploy-databases-on-northflank/deploy-postgresql-on-northflank).

| Tartós adat | Helye |
| --- | --- |
| Google `sub`, név, email, napi keret | PostgreSQL `users` |
| Munkamenet-token hash, lejárat | PostgreSQL `sessions` |
| Egyszer használható OAuth state, nonce, PKCE verifier | PostgreSQL `oauth_states`, 10 percig |
| Étkezés, elfogyasztott adag, megjegyzés, dátum/időzóna | PostgreSQL `meals` |
| Eredeti AI-eredmény, javított adatok, forrásmásolatok | PostgreSQL `meals` JSON-mezői |
| Modell, promptverzió, használat, hiba, revízió | PostgreSQL `meals` |
| Feldolgozási és törlési sor, állapot, lease | PostgreSQL `analysis_jobs` |
| Óránkénti/napi elemzési próbálkozások | PostgreSQL `analysis_attempts` |
| USDA-rekordok változatlan, kulccsal azonosított másolata | PostgreSQL `food_records` |
| Feltöltött képbájtok, második nézet | Cloudinary |
| Kép public ID, URL, verzió és méretek | PostgreSQL, a `photo` mezőben |

A kész alkalmazás statikus arculati fájljai a konténer részei. Felhasználói adat nem a konténer lemezére íródik. A titkok Northflank runtime secret groupba kerüljenek; a helyi `.env` nem build argument és nem része az image-nek.

## Konkrét telepítési beállítás

1. Válaszd ki a Yumetrics Northflank projektjét és régióját. Hozz létre külön PostgreSQL 17 addont megfelelő tartós tárhellyel; az alkalmazás adatbázisát ne oszd össze más termék tábláival.
2. Kapcsold a primary adatbázis URI-t runtime secret grouphoz `DATABASE_URL` néven. Ne a read replica címét használd. A TLS tanúsítvány ellenőrzését ne kapcsold ki; szükség esetén a szolgáltatói CA-t a Node trust store-jához add.
3. A repóból Dockerfile build, végleges image-ből deployment service. Konténerport `3000`, HTTP, publikus HTTPS domain. Runtime: `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`, `APP_ORIGIN=https://sajat-domain`.
4. Ugyanebbe a secret groupba a Google, OpenCode, Cloudinary és opcionális USDA mezők a `.env.example` szerint. A Google Console-ba pontos éles callback: `https://sajat-domain/auth/google/callback`.
5. Liveness: `GET /healthz`; readiness: `GET /readyz`. A readiness adatbázist is olvas, és Google-konfigurációt kér. Ez nem igazolja a külső kulcsok jogosultságát. Production hiányzó adatbázissal/Google-klienssel vagy HTTP APP_ORIGIN-nel nem indul.
6. Az első indítás tranzakcióban, PostgreSQL advisory lock mellett alkalmazza a sémát. A már naplózott migráció nem fut újra. Több app-pod ugyanazt az írható adatbázist használja; nincs sticky session követelmény. Indulásnak két app-példány gördülő telepítéssel csökkenti a kiesést; a pool példányonként legfeljebb 10 kapcsolat.

Közvetlen primary PostgreSQL-kapcsolatot használj. Ha PgBouncert vezetsz be, a session advisory lock és a sessionbeállítások miatt előbb külön ellenőrizd a pooling módját; transaction poolingra ezt nem állítottuk át.

## Mi történik app-pod leállásakor?

A felhasználói művelet csak adatbázis-commit után kap sikeres választ. `synchronous_commit=on` szerepel a PostgreSQL-kapcsolaton. Az elemzés `202` válasza már feltöltött Cloudinary-fotót és adatbázisba írt feldolgozási feladatot jelent. A worker a Cloudinaryból olvassa vissza a képet, a bájtok nem kerülnek PostgreSQL-be.

Ha elemzés közben áll le az app, a feladat lease-e legfeljebb kb. 90 másodperc után újra felvehető. Szívverés tartja életben; a mentést a lease tokenje védi. Egy korábbi worker késői válasza nem írhatja felül a feladatot átvevő worker eredményét. Három ismételt megszakítás után a feladat hibásként, megőrzött fotókkal látható; kézzel újrapróbálható. A külső AI-hívás a leállás miatt megismétlődhet és újra számlázódhat; szolgáltatói pontosan-egyszer végrehajtást nem állítunk.

Törlésnél előbb tartós törlési feladat készül, aztán a Cloudinary-képek törlődnek, végül az adatbázis-bejegyzés. Megszakadásnál az idempotens törlés folytatódik. A képtár hibájánál a bejegyzés és a képazonosítók megmaradnak, a törlés újrapróbálható.

Az app-pod cseréje nem változtatja meg a munkamenetet, napi keretet vagy a napló tartalmát. A még fel nem töltött, sikeresen vissza nem igazolt böngészős kép ugyanakkor nem tekinthető tartós mentésnek. Részleges feltöltésnél a már tárolt képazonosítókat megőrizzük; hiányzó képet új bejegyzéshez újra ki kell választani.

## Adatbázishiba és mentési terv

Az alkalmazás újraindítása és az adatbázis elvesztése külön esemény. A visszaigazolt adatok app-pod cseréjétől való megőrzése nem jelent általános nulla adatvesztési vagy folyamatos rendelkezésre állási garanciát.

A Northflank PostgreSQL több replikát és Patroni-alapú automatikus failovert támogat; megfelelő régióban zónák közé helyezett replikák is választhatók. Élesben legalább primary és standby, fontos naplónál primary és két standby, külön zónák javasoltak. A replikák száma önmagában nem igazolja a szinkron replikációt: szigorú adatvesztési célhoz a tényleges replikációs/failover beállításokat és a szolgáltatói vállalást is ellenőrizni kell. [Northflank HA](https://northflank.com/docs/v1/application/databases-and-persistence/configure-addons-for-high-availability).

Javasolt mentés a Northflankon: óránkénti snapshot 7 nap megőrzéssel, napi native dump 30 napig, heti native dump 90 napig. A dokumentáció órás/napi/heti ütemezést és megőrzési időt támogat; a native dump letölthető, a snapshot nem. A mentések Northflankon maradjanak. Havi próba-visszaállítást külön addonba végezz, és ellenőrizd a felhasználókat, naplót, forrásokat, feladatokat és Cloudinary-hivatkozásokat. Ne állítsd vissza próbaképpen az éles addonra: az felülírná a tartalmát. [Northflank backup és restore](https://northflank.com/docs/v1/application/databases-and-persistence/backup-restore-and-import-data).

Csak órás mentésből helyreállítva a legutóbbi mentés utáni írások elveszhetnek; ez nem RPO=0. Katasztrófára is nulla adatvesztést előíró üzemhez a Northflankkal egyeztetett szinkron replikáció/WAL-védelem, mért visszaállítási idő és dokumentált szolgáltatási vállalás szükséges. A helyreállítás ideje itt még nincs megmérve. Cloudinaryban a mentési/visszaállítási képességet a tényleges csomag szerint külön ellenőrizd; egy PostgreSQL-dump nem tartalmaz képbájtokat.

## Telepítés utáni bizonyítás

Valódi Google-fiókkal belépés, napikeret mentése, saját fotó feltöltése és egy étkezés naplózása után jegyezd fel az azonosítóját. Indíts app service restartot, majd új image-re redeploymentet ugyanazzal a DATABASE_URL-lel. Ellenőrizd ugyanazt a munkamenetet, étkezést, fotókat, napi keretet és az eredeti/javított elemzést. Folyamatban lévő elemzéssel és törléssel is ismételd meg stagingben. Végül külön addonba visszaállított mentésen is olvasd vissza az adatokat.

A helyi, valódi PostgreSQL-integrációs tesztek ennek alkalmazásfolyamatot cserélő részét ellenőrzik. Valódi éles HTTP-próba: Cloudinary-feltöltés, angol Gemini 4 Argon-elemzés, USDA-keresés, adatbázisba mentés, majd alkalmazás-újraindítás utáni azonos munkamenet, étkezés, napi keret és kép sikeres visszaolvasása. A fotó generált arculati próbakép, a tömeg szintetikus tesztbemenet; ez működési, nem kalóriapontossági vizsgálat. Addon-failover és mentésből visszaállítás még nem volt.

## Saját domain és ingyenes HTTPS

A `yumetrics.app` Name.com DNS-zónát használ. A Northflank domainhitelesítő TXT-rekordját meg kell tartani. A gyökérhez ANAME (üres Host vagy `@`) kell, célja `yumetrics.app.ak91-7vzw.dns.northflank.app`; a `www` CNAME célja `www.yumetrics.app.ak91-7vzw.dns.northflank.app`. Mindkét név a `default/yumetrics` szolgáltatás `http` portjához kapcsolódik. A Name.com parkoló A-rekordja helyett az ANAME használatos.

A TLS-t a Northflank automatikus Let’s Encrypt tanúsítványa és megújítása kezeli, külön Certbot vagy fizetős SSL nem kell. A HTTPS ellenőrzésekor érvényes láncot, megfelelő hostnevet és lejáratot kell látni. Az alkalmazás HTTPS eredetnél HSTS-fejlécet ad. A belső `/healthz` és `/readyz` ellenőrzéseket nem irányítja át. A régi hoston érkező módosító kéréseket elutasítja, a böngészős belépés az elsődleges címen történik; a régi domain munkamenetsütije nem kerül át az új domainre, ezért új bejelentkezés szükséges lehet.
