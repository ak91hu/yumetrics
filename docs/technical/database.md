# Adatmodell, migrációk és tranzakciók

## Adatbázis-adapter

Élesben a Node `pg` csomaggal kapcsolódik PostgreSQL-hez. A pool példányonként legfeljebb 10 kapcsolatot tart; a kapcsolódási korlát 10 másodperc, az üresjárati kapcsolat 30 másodperc, a SQL statement timeout 30 másodperc. A `synchronous_commit=on` a PostgreSQL tartós commitját kéri; ez nem helyettesíti a külön biztonsági mentést.

A modul egy kis `prepare().bind().first()/all()/run()` felületet biztosít. A fix alkalmazás-SQL-ek `?` helyőrzőit PostgreSQL esetén `$1`, `$2` alakra fordítja. A felhasználói értékeket paraméterként adja át, nem SQL-szövegként illeszti be. A tranzakció külön poolkapcsolatot használ és hiba esetén rollbackel.

A SQLite-adapter a Node beépített `node:sqlite` modulját használja helyi tesztekhez. A tranzakciókat sorosítja, a sémát külön SQLite-migrációk adják. Az éles szerver indulási útvonala PostgreSQL-t használ; üres `DATABASE_URL` mellett nem vált észrevétlenül helyi SQLite-ra.

## Táblák és kapcsolatok

| Tábla | Elsődleges szerep és fontos kulcs |
| --- | --- |
| `users` | UUID; egyedi Google `sub`, név, e-mail, profilkép, energiakeret, tiltás |
| `sessions` | Munkamenet-token SHA-256-hash; felhasználói idegen kulcs és lejárat |
| `oauth_states` | Egyszer használatos state-hash, nonce, PKCE verifier, lejárat |
| `meals` | Étkezési UUID, tulajdonos, dátum/időzóna, JSON-elemzések, képmetaadat, állapot, revízió |
| `analysis_jobs` | Étkezésenként egy feladat; típus, állapot, input hash, lease és próbálkozás |
| `analysis_attempts` | Elfogadott elemzési próbák az órás/napi kvótához |
| `food_records` | FDC-azonosítós, tartalomlenyomatos forráskulcs és változatlan rekordmásolat |
| `app_settings` | Egy konfigurációs rekord JSON-értékkel és revízióval |
| `admin_audit` | Módosító admin, művelet, cél és változási adatok |
| `ai_requests` | Modellhívás, állapot, tokenek, díj, válasz és összehasonlítási metaadat |
| `app_logs` | Szint, kategória, esemény, üzenet, opcionális felhasználó/étkezés és hibakód |
| `request_limits` | Hash-elt korlátkulcs, találatszám és lejárat |
| `visitor_stats` | Napi dimenzióérték-összesítések, egyedi látogatói rekord nélkül |
| `weekly_challenges` | Felhasználó + hét kulcs; választás, haladás, teljesítés |
| `weekly_activity` | Felhasználó + hét + aktivitási nap; recept- és mérésjelölések |
| `schema_migrations` | A már sikeresen alkalmazott migrációk neve |

Az elemzések és több szolgáltatói metaadat JSON-ként szerializált `TEXT` mezőkben szerepelnek. A sémát és az üzleti tartalmat az alkalmazás validálja; nem minden JSON-tulajdonságra létezik SQL CHECK-feltétel.

## Indexek és lekérdezési minták

A felhasználó szerinti naplóolvasást a `meals(user_id,day,time)` index támogatja. További indexek vannak a munkamenetek lejáratán, a feladatsor állapotán/lease-én, a hívások dátumán és étkezésén, a naplóesemények és audit dátumán, valamint az elemzési próbák tulajdonosán és időpontján.

A profil és admin több összesítő lekérdezést végez. A lapozott adminlisták külön darabszámot adnak vissza. Az indexek megléte nem bizonyítja a nagy adatállományon elégséges teljesítményt; növekvő terhelésnél a tényleges SQL-terveket és a pool telítettségét mérni kell.

## Migrációk

A PostgreSQL-séma jelenlegi sorozata `0001_initial`–`0010_food_api_cache`. A migrációs nevek rögzített listája az adapterben található. Induláskor a szerver session szintű advisory lockot kér, tranzakciót nyit, majd csak a még nem naplózott migrációkat futtatja. Siker után commitol és feloldja a lockot; hibánál rollback és indulási leállás történik.

| Migráció | Változás |
| --- | --- |
| `0001_initial` | Fiókok, munkamenetek, étkezések, feldolgozás, USDA-másolatok |
| `0002_admin` | Tiltás, beállítások és audit |
| `0003_telemetry` | AI-hívások és működési események |
| `0004_security` | Tartós kéréskorlátozás |
| `0005_visitors` | Aggregált látogatottság |
| `0006_weekly_challenges` | Heti választás és jutalom |
| `0007_ai_archive` | Bemeneti metaadat, válasz, eredmény és jóváhagyás |
| `0008_weekly_activity` | Választás előtti heti tevékenység megőrzése |
| `0009_low_cost_ai` | Flash Lite alapmodell és 1600 tokenes keret a meglévő AI-beállítások helyett |
| `0010_food_api_cache` | Tartós adat-API-cache, közös kéréskvóták és külön OFF-termékforrások |

A SQLite-fájlok számozása eltér; a `drizzle/` könyvtár és az adapter listája az irányadó. A név nem jelent futás közbeni ORM-használatot: az alkalmazás saját SQL-adapterrel dolgozik.

## SSL és helyreállítási határok

A kapcsolati URI-ban a történetileg szigorúan kezelt `prefer`, `require`, `verify-ca` módokat az alkalmazás `verify-full` névre normalizálja, ha nincs kifejezett `uselibpqcompat=true` választás. Így a jelenlegi tanúsítvány- és gépnévellenőrzés egy későbbi driverfrissítésnél sem gyengül észrevétlenül. Ez nem kapcsolja be a TLS-t egy explicit `sslmode=disable` kapcsolatnál, és nem tesz biztonságossá egy eleve gyenge egyedi beállítást.

A felhasználói fotók külön szolgáltatóban vannak: önmagában egy PostgreSQL-mentés nem tartalmazza a képbájtokat. A megőrzött AI-archívum és a törölt étkezés kapcsolata szándékosan nem olyan idegen kulcs, amely minden törlésnél eltávolítaná a hívásokat.

Források: [adapter és migrációlista](https://github.com/ak91hu/yumetrics/blob/main/lib/database.mjs), [PostgreSQL-séma](https://github.com/ak91hu/yumetrics/tree/main/postgres), [SQLite-séma](https://github.com/ak91hu/yumetrics/tree/main/drizzle).
