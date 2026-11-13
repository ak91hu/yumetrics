# AI-használat, becsült költségek és működési napló

**Aktuális folyamat, 2026-11-13:** egy Gemini-kérés, utána ingyenes adat-API-k; Food-R1 csak bizonytalan ételazonosságnál, legfeljebb egyszer. Nincs további Gemini-, fordító- vagy javítókérés, és nincs kérés előtti külön költségellenőrző API-hívás. Az új útvonal költségét és fotós pontosságát még nem mértük élő AI-val. A Food-R1 kivételág 3 Ft alatti fizetendő költsége kredit nélkül nem igazolt. [Megvalósítás és korlátok](FREE-FOOD-INTEGRATION-2026-11-13.md). Az alábbi profilok történeti előzmények.

**Friss, valós mérés (2026-11-13):** Food-R1 + Haiku adaptive/high, 4096 token; 4 étkezésből 3 menthető, átlagosan 134 kcal abszolút hiba. A négy ismert díjú hívás kb. 5,01 Ft a Modal-kredittel; a pontosság még nem megfelelő. [Eredmények és korlátok](FOOD-R1-HAIKU-LIVE-2026-11-13.md).

**2026-11-13:** elkészült a Food-R1 + Haiku 5.5 integráció és a kis Nutrition5k-páros próba előkészítése. Új élő mérés még nincs; az alapmodell nem változott. [Módszer, költségelszámolás és futtatás](HAIKU-NUTRITION5K-2026-11-13.md).

## 2026. november 12. – 3 Ft-os költségcél

**2026. november 13.:** a Food-R1 segéd ismét aktív a **Gemini 3.5 Flash Lite** mellett. Konfigurált Modal-végponttal és proxy kulcsokkal egy Food-R1-hívás és egy OpenCode-hívás indul. A belső havi Modal-keret alapértéke ismét 15 USD; explicit 0 értékkel kikapcsolható. A segéd ételnévjavaslatait a Gemini az eredeti fotókból ellenőrzi. A rendelkezésre álló ingyenes kredit a fizetendő Modal-díjat csökkentheti; a költségnapló továbbra is az erőforrás becsült díját mutatja. Az aktuális kreditmaradványt és a pontosság változását nem mértük.

A promptverzió `food-v18-flash-lite-compact`, a válasz és gondolkodás közös felső kerete **1600 token**, a gondolkodási szint MINIMAL. A Lite nem támogatja a thinkingBudget=0 kikapcsolást; a minimális gondolkodás is számlázódhat. Az admin 1000–1600 közötti keretet fogad el. A referenciák angol ételleírása és elkészítési állapota megmarad, a párhuzamos magyar katalógusleírások és a hosszú csoportútmutatók nem kerülnek minden kérésbe. A szerver továbbra is ellenőrzi az azonosságot, egységeket, elkészítést és tápértékeket.

A szolgáltatói sémából kikerül a summary, observations, questions, preparation és portionNote. A szerver a nevet összefoglalóként, az üres listákat és az ismeretlen elkészítés alapértékét állítja elő; mennyiséget, tápértéket és bizonyosságot nem pótol. Az ételazonosság, bizonytalanság, alternatívák, adagtartomány és címkebizonyíték megmarad. A korábbi részletes válaszok továbbra is olvashatók.

Az első fotó hosszabb oldala legfeljebb 1600 pixel, a második részlet-/címkefotóé 2048 pixel; kisebb képet nem nagyítunk fel. A JPEG-minőség marad 0,92. Apró címkeszöveghez használd a második képet. Ez a bájtméretet csökkenti, önmagában nem bizonyít kevesebb képtokent.

### Költség és korlátok

A lenti 1,76 / 2,37 Ft-os példa csak az OpenCode-részre vonatkozik. A visszakapcsolt Food-R1 becsült erőforrásdíja ehhez hozzáadódik; a ténylegesen fizetendő többlet a Modal-fiók rendelkezésre álló kreditjétől függ. A két hívás összesített 3 Ft-os maximuma továbbra sincs garantálva.

Az [OpenCode árlistája](https://opencode.ai/docs/console/models/#pricing) szerint a Lite bemenete 0,30 USD, cache-bemenete 0,03 USD, kimenete és gondolkodása 2,50 USD / millió token. A 2026-11-12-től indított hívások ezeket az árakat rögzítik. A korábbi árpillanatképeket nem írjuk át. Az új Flash 3.8 hívásokhoz december végéig az aktuális 50%-os kedvezményt számoljuk.

**Tervezési példa**, nem mért új modellfutás: 4500 bemeneti token (képekkel és sémával együtt) + összesen 1600 kimeneti/gondolkodási token = 0,00535 USD, 328,16 Ft/USD mellett **1,76 Ft**. Az OpenCode 4,6%-os és feltöltésenként 0,31 USD fix kezelési díja, az adó és a banki árfolyam külön tétel. Például 20 USD feltöltésnél a ráosztott kezelési díjjal és feltételezett 27% adóval ez kb. **2,37 Ft**. Az adó tényleges kezelése a számlázástól függ.

Nincs kérés előtti költségellenőrzés, countTokens-hívás vagy bemeneti tokenplafon. **A 3 Ft cél, nem garantált maximum.** A kép-/szövegbemenet, ismételt kézi próbálkozás, árfolyam, szolgáltatói díj és a kézzel kiválasztott drágább modell túllépést okozhat. Nincs automatikus javító vagy drágább tartalékmodell-hívás. Csonka válasznál nem mentünk kitalált eredményt. Egy összetett étkezés 1600 tokenben nem mindig fér el; ilyenkor felhasználói pontosítás vagy kézi rögzítés szükséges.

Az admin a meglévő USD-adatok mellett forintbecslést mutat. Az AI_USD_HUF környezeti beállítás alapértéke 328,16, ez tervezési átváltás, nem élő árfolyam és nem történeti könyvelés. Étkezésenként is összesíti a kijelölt időszak hívásait, a hibákat és kézi újrapróbálásokat is; hiányzó használati adat ismeretlen marad. Az azonos beküldés ismétlését a meglévő input-hash/állapotkezelés fogja meg.

### Átállás

A PostgreSQL 0009_low_cost_ai és SQLite 0011_low_cost_ai egyszeri migrációja a korábban elmentett modellt Lite-ra, a keretet 1600-ra állítja; a hozzáférési és felhasználói beállításokat megőrzi. Éles környezetben állítsd OPENCODE_MODEL=gemini-3.5-flash-lite és MODAL_MONTHLY_BUDGET_USD=15 értékre a környezeti beállításokat is. A migráció a következő alkalmazásinduláskor fut le. Az új modellt a helyi tesztek csak szimulálják; éles kompatibilitását, felismerési minőségét és tényleges tokenfogyasztását fizetős próba nélkül nem igazoltuk.

Források: [minimális gondolkodás](https://firebase.google.com/docs/ai-logic/thinking), [OpenCode árak és fizetési díj](https://opencode.ai/docs/console/models/#pricing).

## Korábbi konfiguráció és mérések


A jelenlegi Modal-konfiguráció kérés nélkül várhatóan 0 USD/nap: nincs fenntartott konténer, és a körülbelül 16,35 GiB-os modellkötet az [árlista](https://modal.com/pricing) 1 TiB-os ingyenes Volume-keretén belül van. Ez a 2026. november 10-i ellenőrzésből számolt üresjárat, nem napi számlázási mérés. A képelemzés és külön ellenőrző hívás már használhat erőforrást. A napi költség nem a havi 30 USD-kredit automatikus napi felosztása. [Mai döntések és korlátok](DECISIONS-2026-11-10.md).

## Food-R1 segéd a Modalon, v16

A Food-R1 8B és az OpenCode hívásai külön `ai_requests` rekordot kapnak, még a hálózati kérés előtt. A segédnél a rögzített L40S-, két CPU-magos és 16 GiB memóriás konfiguráció mért modellbetöltési és elemzési idejéből számolunk. Ez csak részösszeg: a gateway, az üresjárat, a tárhely és a platform indulási többlete nem szerepel benne. Hiányzó időadatnál a díj ismeretlen, nem nulla. Az ingyenes kredit nem változtatja nullává az erőforrás becsült díját; a fizetendő összeget a Modal számlázása mutatja.

A belső havi keret alapértéke 15 USD. Az ismeretlen és függő hívásokra 90 másodpercnyi erőforrásdíjat tartunk fenn, közös adatbázis-tranzakcióval védve a párhuzamos foglalásokat. A keret nem szolgáltatói költési plafon, más Modal-alkalmazásokat és közvetlen SDK-próbákat nem tartalmaz. Túllépés vagy segédhiba esetén az OpenCode önállóan folytatja. A részletek a [Modal útmutatóban](MODAL.md), a kis páros próba költségkorlátai a [modellkutatásban](FOOD-MODELS-2026-11-10.md) olvashatók. Általános megtakarítást a két szolgáltatás együttműködése nem garantál.

Az admin `/admin#costs` nézete 7/30/365 napra mutatja az AI-hívások számát, a kiszámítható költségrészt USD-ben, az ismert költségű hívások arányát, a napi grafikont, a modellenkénti és hívásonkénti bontást. A grafikon pontos értékei hozzáférhető táblázatban is megnyithatók. Az áttekintés vonalgrafikonon mutatja a bejegyzéseket és regisztrációkat, oszlopokon az állapot- és étkezéstípus-bontást.

## Ellenőrzött díjszabás

Forrás: [OpenCode Console modellek és díjszabás](https://opencode.ai/docs/console/models/#pricing), ellenőrizve 2026-11-09. Az új alapmodell `gemini-3.8-flash`: bemenet **1,50 USD**, gyorsítótárazott bemenet **0,15 USD**, válasz és gondolkodás **7,50 USD** / millió token. A díjhoz 2026-11-09-től van ellenőrzött pillanatkép; korábbi, ismeretlen árú rekordhoz nem találunk ki összeget.

A korábbi vagy az adminban továbbra is választható `gemini-4-argon` díjai, 1 millió tokenre:

| Időszak | Bemenet | Gyorsítótárazott bemenet | Válasz és gondolkodás |
| --- | --- | --- | --- |
| 2026. november 30-ig, a közzétett 50%-os kedvezménnyel | 2 USD | 0,10 USD | 10 USD |
| 2026. december 1-től, a közzétett normál díjjal | 4 USD | 0,20 USD | 20 USD |

A képek tokenjei a szolgáltató által közölt bemenetben szerepelnek. A [Google tokenmezői](https://googleapis.github.io/js-genai/release_docs/classes/types.GenerateContentResponseUsageMetadata.html) alapján a cache a bemenet része, ezért előbb levonjuk, majd a saját árával számoljuk; a gondolkodási tokenek a válasz tokenjein felül kerülnek a kimeneti díjhoz. A [Google a gondolkodás tokenjeit is számlázza](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking).

```text
USD = ((bemenet − cache) × bemeneti egységár
       + cache × cache-egységár
       + (válasz + gondolkodás) × kimeneti egységár) / 1 000 000
```

Más modellhez vagy a Gemini 4 ismert időszakán kívüli régi adathoz nem találunk ki díjat. A hiányzó/hibás kötelező használati adat és az ismeretlen ár nem nulla költség. A felület a részleges összeget és az ismert hívások arányát külön mutatja. Nulla hívásnál nulla összeg, nulla tokent valóban visszaadó hívásnál nulla számított költség szerepel. Az apró összegek sem kerekednek észrevétlenül nullára.

A becslés nem szolgáltatói számla: nem tartalmaz adót, árfolyamváltást vagy az egyenlegfeltöltés kezelési díját. A tényleges összeget az OpenCode számlázásában kell egyeztetni. A díjakat a közlés időpontja szerint rögzítettük; új árváltozáskor a `lib/telemetry.mjs` ellenőrzött díjszabását kell frissíteni. Nincs új fizetős ellenőrző AI-kérés vagy külső követőkód.

## Tartós használati adatok

Minden új AI-kérés előtt létrejön az `ai_requests` rekord. Amikor válasz érkezik, a számszerűen ellenőrzött tokenmennyiségek, a díjszabás másolata, a becsült költség, HTTP-válaszkód és időtartam a tartalmi validáció előtt elmentődnek. Így a csonka, visszautasított vagy hibás elemzés is szerepel, ha a szolgáltató közölt használati adatot. Hálózati megszakadásnál az ismeretlen használat ismeretlen marad. A sikertelen és megszakadt futások elkülönülnek a sikeresektől.

Az `ai_requests` nem függ az étkezés idegen kulcsától: a bejegyzés és fotók törlése után megmarad a használati rekord és az új AI-válaszarchívum is. A válasz szövegét és a jóváhagyott elemzést megőrizzük; a képfájlt, a HTTP-fejléceket és a belső gondolatmenetet nem. A felismert titkokat eltávolítjuk. A számlálóban csak az ismert tokenmezők maradnak meg, a szolgáltató tetszőleges egyéb mezői nem kerülnek bele. A részletes megőrzési szabályok az [admin útmutatójában](ADMIN.md#ai-válaszarchívum) olvashatók.

A korábban megmaradt `meals.usage` adatok induláskor és az admin első lekérésekor egyszer, azonosítóval védetten átkerülnek a használati naplóba. Ezek „Korábbi adat” jelzést kapnak; napjuk a régi bejegyzés létrehozási napja. A változtatás előtt már törölt bejegyzések és a korábban eldobott hibás válaszok utólag nem állíthatók helyre. Párhuzamos import nem hoz létre ismételt rekordokat.

## Működési napló

A Northflank `INFO` indulási sorai és a `Process terminated with exit code 0` üzenet önmagukban nem hibák. A november 7-i 1-es kilépés hiányzó éles konfiguráció miatt történt. Az alkalmazás ilyenkor továbbra sem indul el, de röviden felsorolja a hiányzó beállítások nevét; értékeket és titkokat nem ír ki. A szükséges változók: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, valamint HTTPS-című `APP_ORIGIN`.

A `pg` SSL-figyelmeztetését nem általános naplótiltással kezeljük. Az explicit libpq-kompatibilitást nem kérő URL-ek `prefer`, `require` és `verify-ca` módját a jelenlegi szigorú viselkedésnek megfelelő `verify-full` névre írjuk át a kapcsolat létrehozásakor. A tanúsítvány- és gépnévellenőrzés megmarad; a Northflank titkos változóját nem kell felülírni. [Driverdokumentáció](https://node-postgres.com/features/ssl).

Az `/admin#logs` a szerver indulását és hibáit, belépéseket/kijelentkezéseket, a feldolgozások indulását és sikerét, valamint az elemzési és törlési hibákat mutatja. Időszak, súlyosság és szöveg szerint szűrhető, lapozható. A beállítások változásai közérthető megnevezésekkel, a korábbi és az új értékkel a külön Módosítási előzmények nézetben látszanak.

Az `app_logs` táblában nem tárolunk teljes HTTP-kérést, URL-paramétereket, titkokat vagy nyers szolgáltatói válaszokat. Ez az alkalmazás tartós működési naplója; a konténer összes stdout/stderr sora továbbra is Northflanken érhető el. Adatbázis-kiesés közben az adatbázisba írás nem garantálható, ennek hibája a szerver konzoljára kerül. A használati és naplóvégpontok ugyanazt a tulajdonosi Google-fiókellenőrzést kapják, mint az admin többi része.

## Mért költségcsökkenés

A v14 végső páros mérésében nyolc hívás tényleges költsége 0,258920-ról 0,1956405 USD-re csökkent, a gondolkodási tokenekkel együtt. Ez 24,4% megtakarítás a konkrét mintán. A kisebb költség mellett a pontossági részmutatókat is közöljük: [AI-EFFICIENCY-2026-11-09.md](AI-EFFICIENCY-2026-11-09.md). Az új modell díját az admin is ismeri; az előző kérések saját díjszabás-pillanatképe megmarad.

A fejlesztési benchmark közvetlenül a szolgáltatót hívja. Díját külön, a verziózott mérési napló őrzi; ezek a próbák nem étkezések, ezért nem kerülnek az alkalmazás `ai_requests` naplójába. A szolgáltatói számla a fejlesztési mérések és más, alkalmazáson kívüli hívások miatt is eltérhet az admin étkezéselemzési költségétől.
