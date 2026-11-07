# Yumetrics

![Yumetrics — your food, in numbers](public/brand-banner.svg)

**[Élő alkalmazás](https://http--yumetrics--dmg6gnvmmd7s.code.run)** · **[Magyar útmutató](https://http--yumetrics--dmg6gnvmmd7s.code.run/utmutato)** · **[English guide](https://http--yumetrics--dmg6gnvmmd7s.code.run/guide)**

Magyar és angol nyelvű étkezési napló Google-belépéssel, fotó alapján becsült tápértékekkel és javítható összetevőkkel. Az alkalmazás a képen látható **teljes ehető étel és ital 100%-át** tekinti egy adagnak. A fotós elemzés nem közvetlen kalóriamérés: a felismerést, a mennyiségi becslést, a tápértékforrást és a számítást külön kezeljük.

## A számítás módszere és az AI szerepe

1. **Vizuális leltár.** A Gemini 4 Argon a fotó és a megadott információk alapján javaslatot tesz az ételre, az összetevőkre, az elkészítési állapotra és az ehető grammokra. A köretet, szószt és italt is számba kell vennie. Megkülönbözteti a látható vagy megadott elemeket a feltételezésektől, például a nem látható olajtól. Ez az első AI-lépés még nem ad tápértékeket.
2. **Tápértékforrás választása.** Az AI a 44 beépített USDA-rekordból javasolhat az ételhez és annak elkészítéséhez illő forrást. A szerver a referencia értékeit használja, nem az AI által újraírt számokat. Nyers ételhez tartozó referencia nem kerülhet automatikusan elkészült összetevőhöz. A forrás ellenőrizhetősége és az ételhez való helyes párosítása két külön kérdés; a párosítást a felhasználó is ellenőrzi.
3. **Külön AI-becslés a hiányzó adatokhoz.** Csak azokhoz az összetevőkhöz kérünk második AI-választ, amelyekhez nincs megfelelő referencia. Ez az adott elkészített étel **100 grammjára** becsül tápértéket. Az ilyen adat AI-becslésként jelenik meg, nem adatbázisból igazolt értékként. Ha minden összetevőhöz van megfelelő referencia, második AI-hívás nem szükséges.
4. **Mennyiség pontosítása.** Mérleg nélkül a grammok képi becslések. A megadott teljes ételtömegből levonjuk a külön lemért nem ehető részt, majd az összetevőket az így kapott ehető mennyiséghez arányosítjuk. A hús, köret és zsiradék egymáshoz viszonyított aránya ettől még becsült marad. Két fotó ugyanannak az adagnak két nézete; a mennyiséget nem duplázzuk.
5. **Szerveroldali számítás.** Az összetevő ehető grammjait megszorozzuk a 100 grammra megadott tápértékkel, majd elosztjuk százzal. Az összes összetevő eredményét összeadjuk. A végső adagérték tehát ellenőrizhető számítás eredménye, amelynek pontossága a bevitt tömegtől, az étel felismerésétől és a választott forrástól függ.
6. **Felhasználói ellenőrzés.** Az étel neve, mennyisége, elkészítése és tápértékforrása mentés előtt és után is javítható. Választható másik USDA-rekord vagy megadható termékcímke. Az eredeti AI-elemzést, a modell és a prompt verzióját, valamint a mentett javításokat külön őrizzük meg. Értékelhetetlen kép vagy hiányos AI-válasz esetén nem készítünk helyette kitalált eredményt.

```text
Összetevő tápértéke = ehető tömeg (g) × 100 g-ra megadott érték ÷ 100
Teljes adag tápértéke = az összes ehető összetevő tápértékének összege
```

Szemléltető példa: 150 g összetevő 200 kcal/100 g értékkel 300 kcal-t ad az adaghoz. Ezek példaszámok, nem egy konkrét étel forrásadatai. Az energián kívül ugyanígy számoljuk a fehérjét, szénhidrátot és zsírt; további tápanyagot csak akkor közlünk, ha van hozzá adat. Az ismeretlen érték `null`, a felületen „—”, nem nulla.

### Mitől lehet megalapozottabb az eredmény?

| Megadott adat | Mit segít tisztázni? | Mi marad bizonytalan? |
| --- | --- | --- |
| Teljes ételtömeg és külön lemért csont/héj | Az egész adag ehető össztömegét | Az összetevők arányát továbbra is becsüljük |
| Külön lemért összetevők | Az adott összetevő grammjait | Az azonosságot, elkészítést és a tápértékforrást ellenőrizni kell |
| Második fotó, ismert tányérátmérő | A láthatóságot és a képi léptéket | Nem térfogatmérés és nem helyettesíti a mérleget |
| Elkészítés, hozzáadott olaj és szósz | A képről nem egyértelmű összetételt | A nem ismert receptet nem lehet biztosan rekonstruálni |
| Saját recept és lemért kész tömeg | A teljes recept tápértékének adagra osztását | A veszteségeket és az alapanyagok forrásadatait megfelelően kell megadni |

**Saját recept:** a teljes elkészült ételben maradt alapanyagok tápértékét összeadjuk, majd a képen látható adag tömegét a teljes kész étel tömegéhez viszonyítjuk. Ehhez nem kell újabb AI-hívás. A főzés előtti alapanyagtömegek összege nem helyettesíti a kész étel lemért tömegét; a visszamaradt vagy elöntött zsiradékot sem szabad elfogyasztottként számolni.

### A bizonytalanság értelmezése

A kalóriatartomány mennyiségi és összetételi forgatókönyveket mutat. Ismert ehető össztömegnél azonos össztömeg mellett változtatjuk az összetevőarányokat a becsült határaikon belül; ismeretlen össztömegnél az összetevők alsó és felső tömegbecsléseiből indulunk ki. Ez **nem statisztikai konfidenciaintervallum**, és nem garantálja, hogy a valódi érték a két határ közé esik. A téves felismerés, rejtett hozzávaló vagy rossz forráspárosítás további hibát okozhat.

Az AI saját bizonyossági jelzése nem méréssel igazolt pontosság. Nincs közzétett, lemért magyar ételfotókon igazolt Yumetrics-pontossági százalék. A szoftvertesztek a számítást és a működést ellenőrzik; a fotós becslés tényleges hibáját külön, ismert referenciaértékekkel kell megmérni. A napi energiakeret felhasználói beállítás, nem személyre szabott táplálkozási ajánlás.

Részletes módszertan: [PHOTO-ASSESSMENT.md](docs/PHOTO-ASSESSMENT.md). Források és kutatási döntések: [RESEARCH.md](docs/RESEARCH.md), [REFERENCE-CATALOG.md](docs/REFERENCE-CATALOG.md). A pontosságmérés eszköze: [BENCHMARK.md](docs/BENCHMARK.md).

## Használat és profil

Google-belépés után tölts fel fotót az egész adagról, add meg a biztosan ismert adatokat, majd nézd át és mentsd a piszkozatot. A feldolgozás a fotó tartós feltöltése után a háttérben folytatódik. Az eredmény később is javítható.

A **Fiókom** nézet a Google-nevet, e-mail-címet, csatlakozást, mentett étkezéseket, aktív napokat és naplózási sorozatokat mutatja. A 365 napos, zöld aktivitási naptárból megnyithatók az adott nap bejegyzései. Az energia- és makróátlagok csak a ténylegesen naplózott napokra vonatkoznak. Piszkozat, hibás vagy törlés alatt álló elemzés és jövőbeli nap nem növeli a statisztikát; üres naplóhoz nem készülnek mintaadatok.

A felület és az új AI-elemzés magyarul és angolul is használható. A nyelvváltás megőrzi a kiválasztott fotókat és a szerkesztés alatt álló adatokat; a saját szövegek és a korábbi elemzések az eredeti nyelvükön maradnak. A mobilos, asztali és billentyűzettel történő használat is támogatott.

## Belépés, adattárolás és telepítés

Az alkalmazás **Node.js 24+** szerveren fut. Az éles alkalmazás és a külön, tartós lemezes **PostgreSQL 17** adatbázis az `ak91hus-team/default` Northflank-projektben található. A felhasználói fotók Cloudinaryba kerülnek; a fiókok, munkamenetek, étkezések, forrásmásolatok és feldolgozási feladatok Northflanken tárolódnak. Újraindítás és új image-re történő telepítés után az adatok megőrzését éles próbával is ellenőriztük.

A jelenlegi Google OAuth-visszatérő cím: **https://ak91hu.github.io/yumetrics/oauth.html**. A statikus GitHub Pages-oldal csak továbbítja az egyszer használható választ a Northflank szerverének. A state-, nonce-, PKCE- és ID-token-ellenőrzés, valamint a munkamenet létrehozása szerveroldalon történik. A Google-jelszót és az access/refresh tokeneket nem tároljuk; Gmail- vagy Drive-hozzáférést nem kérünk.

A `GOOGLE_REDIRECT_URI` értékének pontosan egyeznie kell a Google-klienshez regisztrált visszatérő címmel. Az `APP_ORIGIN` az alkalmazás éles Northflank HTTPS-alapcíme; a Pages-visszatérő cím használatakor ez a két beállítás szándékosan eltér. Saját domain esetén közvetlen szerveroldali callback is használható.

A titkok kizárólag Northflank futtatási változóként kerülnek az alkalmazásba. A `.env.example` a szükséges mezők mintája; a valódi `.env`, kulcsok és felhasználói adatok nincsenek a Gitben vagy a Docker image-ben. Az adatbázis írható kapcsolati URI-ja addonkapcsolaton keresztül, `DATABASE_URL` néven érkezik.

| Beállítás | Szerepe |
| --- | --- |
| `DATABASE_URL` | A Northflank PostgreSQL írható kapcsolata |
| `APP_ORIGIN` | Az alkalmazás éles HTTPS-alapcíme |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth-webkliens |
| `GOOGLE_REDIRECT_URI` | A Google-nél regisztrált visszatérő cím |
| `OPENCODE_API_KEY`, `OPENCODE_MODEL` | Szerveroldali AI-hozzáférés; alapmodell: `gemini-4-argon` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Képtárolás |
| `USDA_API_KEY` | FoodData Central keresés a beépített referenciákon túl |

A normál Cloudinary-képlink a hivatkozás birtokában megnyitható. A Google-belépés a naplót és az alkalmazás API-ját védi. A képek feltöltéskor újrarajzolt, átméretezett JPEG-ek; eredeti EXIF/GPS-adatot nem archiválunk.

Kulcsok és OAuth-beállítás: [API-KEYS.md](docs/API-KEYS.md). Telepítés, heti mentés, helyreállítás és adatmodell: [NORTHFLANK.md](docs/NORTHFLANK.md).

## Fejlesztés és ellenőrzés

```powershell
npm ci
npm test
npm run build
```

A PostgreSQL-integrációs tesztekhez külön tesztadatbázis kapcsolatát kell megadni a `TEST_DATABASE_URL` folyamatváltozóban; enélkül ezek kimaradnak. A böngészős ellenőrzés `node scripts/browser-check.mjs` paranccsal fut, headless Chrome-ban. A `TEST_LANGUAGE=hu|en` és `TEST_DEVICE=mobile|desktop` választja ki a nyelvet és a kezelőfelületet.

A tesztek a teljes adagot, a receptszámítást, a tápértékforrások kezelését, a Google-belépési határokat, a felhasználók elkülönítését, az adatmegőrzést, a profil statisztikáit és a mobilos/asztali működést ellenőrzik. Részletes bizonyítékok és a nem ellenőrzött területek: [VERIFICATION.md](docs/VERIFICATION.md).

A publikálható útmutató forrása a [public/help.html](public/help.html). A build önálló magyar és angol HTML-csomagot készít a `dist/documentation` könyvtárban. Közzététel: [PUBLISHING.md](docs/PUBLISHING.md). Arculati elemek: [ASSETS.md](docs/ASSETS.md).
