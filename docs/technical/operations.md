# Telepítés, konfiguráció és helyreállítás

## Build és futtatás

A Northflank a GitHub `main` ágából, a Dockerfile alapján épít. A buildszakasz Node-függőségeket telepít `npm ci --omit=dev` paranccsal. Kizárólag a buildhez Python virtualenvet és a rögzített MkDocs-verziót is telepíti. Az `npm run build` JavaScript-szintaxisellenőrzést, MkDocs strict buildet és a futtatási állományok összeállítását végzi.

A végső image külön `node:24-bookworm-slim` rétegből készül. A `dist/` tartalmát és a Node-függőségeket kapja meg, `node` felhasználóként indul. Pythonra és futó dokumentációs szolgáltatásra nincs szüksége. A `.dockerignore` engedélyezett források listájával zárja ki a helyi titkokat, tesztkimeneteket és munkakönyvtárakat.

Az alap futtatási környezet `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`. A publikus domain az ingress portjához kapcsolódik. A build sikere még nem bizonyítja, hogy pontosan az új Git SHA fut: a szolgáltatás telepített revízióját és a webes végpontot is ellenőrizni kell.

## Konfigurációs mátrix

| Változó | Szerep / feltétel |
| --- | --- |
| `DATABASE_URL` | Éles PostgreSQL-kapcsolat; titok |
| `APP_ORIGIN` | Elsődleges eredet; élesben HTTPS szükséges |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google webes OAuth-kliens |
| `GOOGLE_REDIRECT_URI` | Opcionális, pontosan regisztrált külső vagy közvetlen callback |
| `OPENCODE_API_KEY`, `OPENCODE_MODEL` | Új AI-elemzéshez szükséges hozzáférés és alapmodell |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Fotófeltöltés, védelem, visszaolvasás és törlés |
| `USDA_API_KEY` | Opcionális élő FDC-keresés |
| `MODAL_FOOD_URL` | Opcionális, hitelesített ételnév-felismerő végpont |
| `MODAL_PROXY_TOKEN_ID`, `MODAL_PROXY_TOKEN_SECRET` | A Modal HTTP-proxy hitelesítői |
| `MODAL_MONTHLY_BUDGET_USD` | Belső segédkeret, alapérték 15; 0-val kihagyható |
| `MKDOCS_PYTHON` | Helyi/build Python futtatható fájl; nem runtime titok |

A hiányzó adatbázis-, Google- vagy HTTPS-alapkonfiguráció éles indulást tilt. A hibaüzenet a hibás mező nevét adja meg, nem az értékét. Az OpenCode/Cloudinary hiányától a meglévő napló még elérhető lehet, de új fotós elemzés nem indítható.

A titkok futtatási környezetbe kerüljenek, ne Docker build argumentként. Northflank secret map módosításakor az API teljes mapet is cserélhet; egyetlen kulcs frissítése előtt a konkrét eszköz viselkedését ellenőrizni kell. A dokumentáció nem tartalmaz valós titokértéket.

## Egészség és megfigyelés

- Liveness: `GET /healthz`, a kiszolgáló válaszképességéhez.
- Readiness: `GET /readyz`, valódi adatbázis-olvasással és bejelentkezési konfigurációellenőrzéssel.
- Működési napló: feldolgozási hibák, megszakítások, belépési problémák.
- AI-híváslista: hibás/függő hívás, HTTP-státusz, idő és becsült költség.
- Northflank: telepítési állapot, revízió, runtime stdout/stderr, infrastruktúra-metrikák.

Egy napi rutinellenőrzéshez nem szükséges fizetős képelemzést indítani. A readiness nem bizonyítja a Google valódi belépését, a Modal GPU elindulását vagy a képfelismerés pontosságát; ezeket célzottan, szükség esetén kell tesztelni.

## Gördülő telepítés és kapcsolatok

A migráció advisory lockja megakadályozza az azonos séma párhuzamos módosítását. A pool legfeljebb 10 kapcsolatot használ **példányonként**; a teljes adatbáziskapcsolat-számot a replikák és az egyéb kliensek együtt határozzák meg. A session szintű advisory lock miatt PgBouncer transaction poolingra nem szabad ellenőrzés nélkül átállni.

A leállási jel határidős HTTP-leállítást és runner-leállítást kezdeményez. A futó AI megszakadhat; a tartós feladat ilyenkor kézi újrapróbálásra szorulhat. Egyetlen alkalmazáspéldánynál nem állítunk megszakításmentes rendelkezésre állást.

## Mentés és helyreállítás

Az adatbázis külön tartós addon, de a tartós lemez önmagában nem biztonsági mentés. Üzemeltetési követelmény egy ellenőrzött PostgreSQL-backup/snapshot és visszaállítási próba. A kívánt RPO/RTO nincs automatikusan a kódból meghatározva.

Helyreállításkor az adatbázis mellett a Cloudinary-képekre és a környezeti titkokra is szükség van. A modellsúlyok a rögzített publikus revízióból újra előkészíthetők; a felhasználói fotók nem. Az első visszaállítást elkülönített környezetben kell végezni, hogy a worker ne indítson váratlan éles szolgáltatói műveleteket.

Ellenőrzendő: séma és migrációk, étkezésszámok és kapcsolatok, képhozzáférés, munkamenetkezelés, függő feladatok és a konfigurált külső szolgáltatók. Egy régi image visszatelepítése nem görgeti vissza automatikusan az adatbázissémát; a kompatibilitás külön döntés.

## Gyakori hibák

| Tünet | Első ellenőrzés |
| --- | --- |
| Nem indul a szerver | Hiányzó mezőnevek az indulási üzenetben, adatbázis elérése, migráció |
| 503 readiness | Adatbázis és Google-konfiguráció; nem AI-modellcsere |
| OAuth-hurok vagy sikertelen belépés | Origin, pontos redirect URI, süti, Google-kliens |
| Sikertelen feltöltés | Képméret/formátum, Cloudinary-hozzáférés és kvóta |
| Food-R1 fallback | Modal-végpont, proxy token, belső keret, hidegindítás/időkorlát |
| 409 mentés | Elavult revízió vagy éppen futó művelet |
| Üres látogatottság | DNT/GPC, dokumentumfejléc, botszűrés, mérési kapcsoló |
| 404 `/docs/` | MkDocs build lefutott-e, generált fájl bekerült-e az image-be |

Források: [Dockerfile](https://github.com/ak91hu/yumetrics/blob/main/Dockerfile), [konfigurációs minta](https://github.com/ak91hu/yumetrics/blob/main/.env.example), [Northflank útmutató](https://github.com/ak91hu/yumetrics/blob/main/docs/NORTHFLANK.md), [Modal telepítés](https://github.com/ak91hu/yumetrics/blob/main/docs/MODAL.md).
