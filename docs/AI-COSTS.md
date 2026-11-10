# AI-használat, becsült költségek és működési napló

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
