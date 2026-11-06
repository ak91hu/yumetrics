# Yumetrics

Magyar, reszponzív ételfotó-elemző és étkezési napló. Kép → OpenCode-on elért Gemini → ellenőrizhető piszkozat → naptár. A képek a saját Cloudinary Free-fiókodban, az étkezések SQLite-ban vagy a hosztolt változat D1-adatbázisában vannak.

## Gyors indítás

Ajánlott: **Node.js 26.13.0 LTS**, a 2026-11-06-án ellenőrzött aktuális LTS. [Hivatalos letöltés](https://nodejs.org/en/download). Nincs külső npm-függőség, telepítés és frontend build nem kell a helyi futtatáshoz.

```powershell
cd C:\Yumetrics
Copy-Item .env.example .env
npm start
```

Megnyitás: **http://127.0.0.1:3000**. Fejlesztéshez `npm run dev` automatikus szerverújraindítással. Az első indulás létrehozza a `data/yumetrics.sqlite` adatbázist és alkalmazza a verziózott migrációkat. A többi indulás megtartja az adatokat.

Kulcsok nélkül megnyitható a felület, a naptár és az elkülönített **Mintaadatok** nézet. A mintanézet nem ír az adatbázisba és nem hív AI-t. Valódi elemzéshez az alábbi négy szolgáltatói érték szükséges.

## OpenCode és Cloudinary beállítása

A `.env` fájlban add meg, majd indítsd újra a szervert:

```dotenv
OPENCODE_API_KEY=ide_kerul_a_kesobb_megadott_kulcs
OPENCODE_MODEL=gemini-3.8-flash
CLOUDINARY_CLOUD_NAME=sajat_cloud_name
CLOUDINARY_API_KEY=sajat_api_key
CLOUDINARY_API_SECRET=sajat_api_secret
```

A kulcsokat soha ne tedd a kliensoldali JavaScriptbe, Gitbe vagy a hosting manifestbe. A Beállítások csak a kapcsolat konfiguráltságát mutatja, a kulcsokat nem küldi a böngészőnek. A konfiguráltság önmagában nem igazolja a kulcs érvényességét vagy a rendelkezésre álló keretet.

### OpenCode

Az „opencode API” alatt az OpenCode Console / korábbi Zen szolgáltatást értelmeztem. A hivatalos, aktuális natív Gemini-végpontot használjuk:

```text
POST https://opencode.ai/inference/google/v1beta/models/gemini-3.8-flash:generateContent
Authorization: Bearer <OPENCODE_API_KEY>
```

A kép `inlineData`, az eredmény JSON-sémával kért strukturált válasz. A válasz külön szerveroldali ellenőrzést is kap. Modellváltás a `OPENCODE_MODEL` beállítással lehetséges az OpenCode által támogatott **Gemini** modellek között. Más modellcsaládhoz más API-formátum és adapter kell; a mostani adapter szándékosan egy konkrét, dokumentált protokollt támogat. [OpenCode modellek](https://opencode.ai/v2/docs/console/models/), [Inference API](https://dev.opencode.ai/v2/docs/console/api/inference).

### Cloudinary Free

1. Hozz létre egy Free Image and Video API-fiókot a [Cloudinaryn](https://cloudinary.com/pricing), és a Dashboardból másold át a cloud name / API key / API secret értékeket.
2. Nincs szükség unsigned upload presetre vagy fizetős kiegészítőre. A szerver a feltöltési és törlési kéréseket SHA-1 aláírással küldi.
3. A képek `yumetrics/<véletlen UUID>` public ID-val kerülnek a képtárba. Az alkalmazás nem ír felül meglévő képet.
4. A Free csomag az ellenőrzéskor havi **25 megosztott kreditet** tartalmazott; ez nem korlátlan tárhely vagy forgalom. A tényleges használatot a Cloudinary Dashboardban kövesd. [Díjcsomagok](https://cloudinary.com/pricing).

A böngésző a fotót legfeljebb 1600 pixeles hosszabbik oldalra méretezi és JPEG-be rajzolja újra. Így a feltöltött változat nem viszi tovább az eredeti EXIF/GPS metaadatokat. Maximum 25 MB-os, 50 megapixeles bemeneti fotó és 4 MB körüli feltöltött változat fogadható el. A HEIC/HEIF megnyithatósága a böngészőtől függ; ha nem támogatott, JPEG-et kér a felület.

**A képek normál Cloudinary `upload` típusú képek:** a véletlen hivatkozás ismeretében megtekinthetők. A napló és API védelme nem jelent külön fotóhozzáférés-vezérlést. Kizárólag fiókhoz kötött képmegosztáshoz authenticated delivery bevezetése szükséges. A fotómegosztásról a feltöltő felület is tájékoztat.

## Használat

- **Étel hozzáadása:** fájlválasztás, drag and drop vagy mobilon kamerás felvétel. Add meg a napot, időt, étkezéstípust és az ismert adagokat.
- **Elemzés:** az AI becslése után a kép Cloudinaryba kerül. Az eredmény először piszkozat, amelyet be kell menteni a naplóba.
- **Ellenőrzés:** módosítható az étel neve, minden összetevő neve, tömege és 100 grammra vonatkozó tápértéke. Az adagváltoztatás azonnal újraszámolja az összesítést. Összetevő hozzáadható és eltávolítható.
- **Naptár:** hónapok között lépkedhetsz, egy nap kiválasztása megnyitja az aznap elmentett ételeket és a napi tápértékeket. A fotóra kattintva később is szerkeszthetők a részletek.
- **Törlés:** először a Cloudinary-kép törlődik CDN-invalidation kéréssel, aztán a naplóbejegyzés. Szolgáltatói hiba esetén a bejegyzés megmarad az újrapróbáláshoz. A CDN és a korábban letöltött másolatok törlése nem azonnali és nem teljesen kontrollálható. [Cloudinary invalidation](https://cloudinary.com/documentation/invalidate_cached_media_assets_on_the_cdn).
- **Napi keret:** a választott energiakeret eszközönkénti localStorage-beállítás. Nem személyre szabott táplálkozási ajánlás. Az étkezések szerveroldalon tárolódnak.

A tápértékek kcal-ban, grammokban és nátriumnál milligrammban szerepelnek. Az ismeretlen rost/cukor/nátrium `null`; az összesítés is ismeretlen marad, ha egy összetevő értéke hiányzik. A szénhidrát az EU-jelölés szerinti emészthető szénhidrát, rost nélkül. Egyetlen fotóból nem mérhető pontosan az adag vagy a rejtett összetevő; a rendszer nem igazol allergénmentességet.

## Mobil és hálózati használat

Az alapbeállítás csak a saját gépen, loopback címen figyel. Ha másik eszközről is eléred, állíts be erős jelszót és a böngészőből használt külső eredetet:

```dotenv
HOST=0.0.0.0
PORT=3000
APP_PASSWORD=egy_hosszu_egyedi_jelszo
APP_ORIGIN=https://naplom.pelda.hu
```

A Node-változat egy személyes napló, egy közös tulajdonossal. Hálózati binding jelszó és APP_ORIGIN nélkül nem indul el. Nyilvános használathoz HTTPS reverse proxy, tartós lemez és az adatbázis mentése szükséges. A beépített szerver nem állít elő TLS-tanúsítványt. A jelszót egyszer kell megadni a belépő felületen; a munkamenet HttpOnly, SameSite=Strict sütit használ, HTTPS-eredetnél Secure jelzővel. A szerver újraindítása kijelentkeztet. A munkamenet legfeljebb 7 napig él; 5 hibás belépés után 15 perces korlát van forráscímenként. Reverse proxy mögött ez a proxy kapcsolati címe, így ez a védelem az összes mögöttes látogatót is érintheti.

Mobilon reszponzív elrendezés, alsó navigáció és natív kamerás fájlválasztás van. Az operációs rendszer kamerajogosultságát a felhasználó kezeli. A naptári napot és az időt az étkezéshez rögzítjük, az IANA-időzónával együtt; későbbi utazás nem helyezi át a régi étkezést másik napra.

## Adatok, mentés és hibakezelés

A pontos adattárolási terv és a modellkutatás: **[docs/RESEARCH.md](docs/RESEARCH.md)**. A táblákat a `drizzle/*.sql` tartalmazza. A Node ugyanazokat a migrációkat SQLite-on alkalmazza, a Sites változat D1-en futtatja.

A SQLite-adatbázis `data/yumetrics.sqlite`, WAL módban. Teljes, egyszerű fájlmentéshez állítsd le a szervert és másold a `data` könyvtárat; futás közben SQLite-kompatibilis backup kell, egyetlen `.sqlite` fájl másolata a WAL mellett nem elég. Visszaállításkor a leállított alkalmazás adatkönyvtárát állítsd vissza. A Cloudinary-képek külön szolgáltatónál vannak, az adatbázismentés nem tartalmazza a képbájtokat. Felhős futtatásnál a `DATABASE_PATH` tartós lemezre mutasson; ephemeral fájlrendszeren a napló elveszhet.

Az eredeti AI-elemzés változatlan marad a felhasználó által javított értékek mellett. Revíziószám akadályozza a másik ablakból történő véletlen felülírást. A műveletazonosító ismételt küldése nem indít új elemzést. 20/óra és 50/nap felhasználónkénti próbálkozási korlát védi az AI-keretet; a bejegyzés törlése nem nullázza a korlátot.

Az elemzés indulásakor bejegyzés készül, így Cloudinary-hiba vagy megszakadt kérés után is megmarad a törléshez szükséges képazonosító. A félbemaradt, sikertelen és még be nem mentett elemzések külön megjelennek. Aktív elemzést 2 percig nem lehet törölni. Hálózati bizonytalanság után érdemes frissíteni és ellenőrizni a piszkozatot, mielőtt új elemzést indítasz. Cloudinary cloud name váltásakor előbb rendezd a régi képek költöztetését/törlését; az app egyetlen aktív Cloudinary-fiókkal működik.

## Hosztolt Sites / Cloudflare-változat

```powershell
npm run build
```

A `dist/server/index.js` szabványos Worker ESM. A build a statikus fájlokat beágyazza, a közös szerverlogikát és a D1-migrációkat a csomagba másolja. Nincs bundler vagy npm-telepítés. A `.openai/hosting.json` a privát Site azonosítóját és a `DB` D1-kötést őrzi; a `r2` szándékosan nincs használva, mert a képeket Cloudinary tárolja.

Sites esetén a környezeti kulcsokat a Site szerveroldali runtime változóiként kell beállítani. A platform kezeli a bejelentkezést; minden olvasás és írás a `oai-authenticated-user-id` alapján tulajdonoshoz kötött. **A Workert kizárólag a Sites hitelesítést végző dispatch mögött használd**, mert a közvetlen, védelem nélküli Worker-origin nem hitelesítené ezeket a fejléceket. Az `APP_PASSWORD`, `HOST`, `PORT` és `DATABASE_PATH` csak a Node-változatra vonatkozik.

A build önmagában nem publikálás. Hosztolt URL csak sikeres, visszaigazolt deployment után tekinthető működőnek. A helyi változat a Sites-kapcsolattól függetlenül fut.

## Ellenőrzés

```powershell
npm test
npm run build
node scripts/browser-check.mjs
```

Az automatikus Node-tesztek lefedik a dátumokat, tápértékszámítást, bemenetellenőrzést, natív Gemini-kérést, Cloudinary-aláírást, az elemzés–piszkozat–javítás–mentés–naptár–törlés folyamatot, tulajdonosi határokat, költségkorlátot, SQLite-újraindítást és HTTP-belépést. A szolgáltatókat ezek a tesztek helyettesítik, nem használnak valódi kulcsot.

2026-11-06-án mind a 12 Node-teszt és a headless Chrome folyamatellenőrzés sikeres volt. A reszponzív felületet 320, 390, 768, 1024 és 1440 pixel szélességen ellenőriztük; az ételkártyák és a mobilos szerkesztő űrlap vízszintes túlfutás nélkül megjelennek. A böngészős teszt a fénykép JPEG-be alakításától a piszkozat ellenőrzésén és az adag javításán át a mentésig, újratöltésig és törlésig végigment. A képernyőképeket vizuálisan is ellenőriztük.

A `browser-check.mjs` telepített Chrome-mal, headless módban ellenőrzi az asztali és mobilfelületet, külön memóriabeli tesztadatbázissal és helyettesített szolgáltatókkal. Windows alapértelmezett Chrome-útvonallal indul; máshol a `CHROME_PATH` környezeti változót állítsd be. Külön, csak a teszthez létrehozott böngészőprofilt használ az `outputs/` alatt; nem nyitja meg a személyes Chrome-profilt. Siker esetén a `outputs/browser-check.json` és a képernyőképek igazolják az eredményt. GPU/renderer-indítási jogosultsághibánál a teszt hibával leáll, és `outputs/chrome-stderr.log` készül. A böngésző sandboxát nem kapcsolja ki.

A valódi API-elemzést és Cloudinary-feltöltést a később megadott saját kulcsokkal lehet véglegesen ellenőrizni. Ezeket a szimulált szolgáltatókkal végzett tesztek nem igazolják.

## Felépítés

```text
public/                 Magyar HTML/CSS/ES-modulos felület
lib/domain.mjs          Közös validáció és adagszámítás
lib/providers.mjs       OpenCode Gemini + aláírt Cloudinary REST
lib/api.mjs             Tulajdonoshoz kötött napló API
server.mjs              Node HTTP + SQLite + személyes belépés
worker/index.mjs        Sites Worker belépési pont
drizzle/                Verziózott SQL-migrációk
scripts/build.mjs       Függőségmentes Worker build
scripts/browser-check.mjs Headless Chrome folyamatellenőrzés
tests/                  Node beépített tesztfuttató
docs/RESEARCH.md         Modellkutatás és adattárolási terv
```

Nincs React/Vue-komponens, UI-könyvtár vagy külső SDK: a jelenlegi böngészők natív ES-moduljait, CSS Gridet, dialog és fájlfeltöltési API-kat használjuk, a szerveren pedig a Node aktuális LTS-ének beépített HTTP/SQLite/crypto eszközeit. Ez megszünteti az elavuló UI-függőségeket; a további karbantartás a Node LTS és a böngészők frissítését igényli. A dekoratív és mintaételfotók az Unsplash CDN-jéről töltődnek, a saját ételfotók Cloudinaryból. A napló külső dekoratív kép nélkül is használható.
