# Modellkutatás és adattárolás

Ellenőrzés: **2026-11-06**. A megállapítások hivatalos szolgáltatói dokumentációból származnak. Saját, lemért ételfotókon végzett modellbenchmark még nincs; a választás ezért gyakorlati kiindulópont, nem bizonyított táplálkozási pontossági rangsor.

## Melyik LLM alkalmas?

**Induló ajánlás: Gemini 3.8 Flash az OpenCode natív Gemini API-ján.** A feladathoz képbemenet, magyar strukturált szövegkimenet és rövid, interaktív válaszidő kell. A Flash modell multimodális képességei és strukturált kimenete megfelelnek ennek. A legújabb általános csúcsmodell neve önmagában nem igazolja, hogy ételadagokra pontosabb lenne. [Gemini 3.8 Flash dokumentáció](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [hivatalos modellkártya](https://deepmind.google/models/model-cards/gemini-3-8-flash/).

| Jelölt | Miért érdemes vizsgálni? | Döntés ehhez az apphoz |
| --- | --- | --- |
| Gemini 3.8 Flash | Képbemenet és strukturált kimenet, mindennapos interaktív használatra szánt Flash modell | Alapértelmezett; a tényleges késleltetést és költséget saját kéréseken mérni kell |
| Gemini 4 Argon | Újabb frontier modell, komplex vizuális és következtetési feladatok vizsgálatához | Kísérleti összehasonlításra, ha a saját OpenCode-fiókban elérhető; nem automatikus, fizetős tartalék |
| Claude Sonnet 5.5 / aktuális képes Claude | Más modellcsalád, dokumentált képbemenettel | Érdemes etalonként összehasonlítani; natív Messages adapter kellene, ezért nincs csendes modellcsere |

A Gemini 4 Argon hivatalos bemutatása kezdetben korlátozott elérést jelölt; a modelllistában való szereplésből nem következik minden fiókra elérhető jogosultság. A Claude dokumentáció képbemenetet támogat, de nem közöl erre a konkrét magyar ételfotós feladatra összehasonlító kalóriapontosságot. [Gemini 4 Argon bemutató](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/), [Claude Vision](https://platform.claude.com/docs/en/build-with-claude/vision).

Az OpenCode aktuális modelllistája a Gemini modelleket natív Google `generateContent` végponttal jelöli, a GPT-modelleket Responses, a Claude-modelleket Messages protokollal. Emiatt a „minden modell ugyanazon chat/completions végponton” megoldás nem megfelelő. A kód a dokumentált Gemini-protokollt és szerveroldali Bearer-hitelesítést használja. [OpenCode modellek és protokollok](https://opencode.ai/v2/docs/console/models/), [Inference API példák](https://dev.opencode.ai/v2/docs/console/api/inference).

## Mit tud és mit nem tud egy fotó?

A fénykép segít az étel nevének, látható összetevőinek és hozzávetőleges adagjának felismerésében. Az olaj, az öntet alatti összetevők, az elkészítési víztartalom és a tömeg gyakran nem azonosítható megbízhatóan. Ezért a felület becslést mond, külön megmutatja a feltételezéseket, és mentés előtt javítható grammokat ad. A modell `high` önértékelése sem kalibrált valószínűség.

A JSON-séma a formátumot segíti, az értékek valódiságát nem bizonyítja. A szerver ellenőrzi a mezőket, mértékegységhez illő tartományokat és a teljes válasz lezárását; a hibás, levágott vagy nem ételt ábrázoló eredményt elutasítja. [Gemini strukturált kimenet](https://ai.google.dev/gemini-api/docs/structured-output), [GenerateContent konfiguráció](https://ai.google.dev/api/generate-content).

## A pontosság következő, mérhető ellenőrzése

Valódi „legalkalmasabb” rangsorhoz 50–100 saját, lemért, recepttel ismert étkezésre van szükség: magyar egytálételek, szószok, vegyes tányérok, kisétkezések és nem ételt ábrázoló negatív példák. Ugyanazzal a fotóval és sémával mérendő a felismerési hibák száma, az adag tömeghibája, a kcal/protein/carb/fat abszolút hibája, a visszautasítások és hibás JSON-ok aránya, a medián/95. percentilis válaszidő és a kérésenkénti tényleges költség. A kis energiatartalmú ételeknél a százalékos hiba önmagában félrevezető lehet.

Az értékelést külön kell futtatni csak fotóval és felhasználó által megadott grammokkal. A költség a kép felbontásától, a kimenettől és a szolgáltató aktuális díjától függ; ezért a kód eltárolja a tokenhasználatot és a késleltetést, de nem talál ki rögzített elemzési árat. A saját API-kulcs megadásakor a szolgáltatói keretet is ellenőrizni kell.

## Miért nem csak LLM-ből származó tápérték?

A `food-v2-grounded` implementáció már külön választja a vizuális leltárt és a tápértékszámítást. A megfelelően párosítható összetevőknél 20 rögzített, hivatalos USDA-rekord tápértékeit használja, egyébként jelölt LLM-becslést kér. A párosítás ellenőrizhető és kézzel javítható; a referenciatár nem teljes ételadatbázis. A részletes kutatás, korlátok és megvalósítás a **[PHOTO-ASSESSMENT.md](PHOTO-ASSESSMENT.md)** dokumentumban található. [USDA API-útmutató](https://fdc.nal.usda.gov/api-guide/), [Foundation Foods dokumentáció](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/).

## Pontosan tárolt adatok

Az étkezés a tartós tárolás egysége; az összetevők egy bounded JSON-tömbben vannak. Ehhez a személyes naplóhoz nem kell önálló recept- vagy hozzávalókatalógus. A tápértékek az adott **elkészített összetevő 100 grammjára** vonatkoznak; a grammok az elfogyasztott/becsült adag tömegét jelentik.

| Adat | Tényleges mező | Miért tároljuk? |
| --- | --- | --- |
| Azonosító, tulajdonos | `id`, `user_id` | Idempotencia, felhasználói adatok elkülönítése |
| Étkezés napja, ideje, időzónája | `day`, `time`, `timezone` | A napló időzónaváltás után is az eredeti napon marad |
| Étkezéstípus és megjegyzés | `type`, `notes` | Reggeli/ebéd/vacsora/kisétkezés, ismert adag és elkészítés |
| Állapot | `status` | `analyzing`, `draft`, `saved`, `failed`; sikertelen művelet ne tűnjön mentett étkezésnek |
| Ételfelismerés | `analysis.name`, `.confidence`, `.assumptions` | Név, minőségi önértékelés, bizonytalan összetevők |
| Összetétel | `analysis.ingredients[].name`, `.grams` | Szerkeszthető név és tömeg, legfeljebb 40 összetevő |
| Energia / 100 g | `calories` | kcal |
| Makrók / 100 g | `protein`, `carbs`, `fat` | gramm; emészthető szénhidrát rost nélkül |
| Egyéb értékek / 100 g | `fiber`, `sugar`, `sodium` | Rost/cukor gramm, nátrium mg; ismeretlennél `null` |
| Eredeti becslés | `original_analysis` | A kézi javítások nem írják felül az AI eredeti állításait |
| Képazonosító | `public_id` | A kép törlése akkor is lehetséges, ha a feltöltési válasz elveszett |
| Kép metaadatai | `photo.publicId`, `.url`, `.width`, `.height`, `.bytes`, `.format`, `.version` | Cloudinary-hivatkozás és méret; képbájtokat nem duplikálunk SQLite-ban |
| Modell és prompt | `model`, `prompt_version` | Utólag azonosítható, melyik modell/beállítás készítette a becslést |
| Használat és idő | `usage`, `latency_ms` | Szolgáltatói tokenadatok, mért kérési késleltetés |
| Hibás művelet | `error` | Kulcsot és nyers szolgáltatói hibát nem tartalmazó állapotüzenet |
| Audit és ütközésvédelem | `created_at`, `updated_at`, `revision` | UTC-műveleti időpontok, másik ablak módosításának felismerése |
| Kérésköltség korlátja | `analysis_attempts.id`, `.user_id`, `.created_at` | Az elemzési próbálkozások száma étkezéstörlés után is megmarad |

A napi és étkezési összesítéseket **számoljuk**, nem tároljuk újra. Képlet: `100 g-ra adott érték × összetevő grammja / 100`; az összetevőket összeadjuk, majd egy tizedesre kerekítünk. Ha az adott tápanyagnál bármelyik összetevő ismeretlen, az étkezési összesítés is `null`. Nem tárolunk mesterséges kalóriapontossági százalékot, kitalált vitaminokat, kikövetkeztetett allergénmentességet, testsúlyt, egészségügyi előzményt vagy GPS-helyzetet.

A v2 már tárolja a tápérték forrását (`reference` / `ai` / `user`), a rögzített referenciakulcsot és a párosítás felhasználói megerősítését. A katalógus a tényleges FDC ID-t, rekordleírást, adattípust és letöltési dátumot tartalmazza; az összetevő tárolja az elkészítést és az adagtartományt is. A fotóhoz párosítás továbbra is becslés, amíg nincs megfelelően ellenőrizve.

## Tárolás, adatvédelem és Free keret

Az SQLite/D1 tárolja a naplót; a Cloudinary Free a képeket. A Cloudinary Free ellenőrzött ajánlata havi 25 kredit, amely a szolgáltatás használatán oszlik meg. A kisebb feltöltött képek csökkentik a tárhelyet és az adatforgalmat. Nincs fizetős automatikus képelemző add-on. [Cloudinary csomagok](https://cloudinary.com/pricing).

A szerver generálja a feltöltési és törlési aláírást; a secret nem jut a böngészőbe. A public ID véletlen és nem tartalmaz nevet vagy emailt. A normál képhivatkozás link birtokában megtekinthető; szigorúan privát képekhez authenticated delivery kell. A törlés CDN-invalidationt is kér, de a CDN-frissülés és a már letöltött másolatok nem vonhatók azonnal vissza. [Feltöltési API](https://cloudinary.com/documentation/upload_images), [Upload/Destroy referencia](https://cloudinary.com/documentation/image_upload_api_reference), [CDN invalidation](https://cloudinary.com/documentation/invalidate_cached_media_assets_on_the_cdn).

Node módban egy személyes napló van, hálózati használatnál jelszóval; Sites módban a platformfelhasználóhoz kötött rekordok vannak. Az email nem a napló tulajdonosi kulcsa. A pontos fotót az AI-szolgáltató és a Cloudinary is megkapja; az eredeti fájlt az alkalmazás nem archiválja. Az adatbázis és a fotók külön mentési tartományok. A kérésnaplók nem kapják meg a fotóbájtokat vagy a hitelesítési kulcsokat.
