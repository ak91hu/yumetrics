# Yumetrics – jogi kutatás és megfelelőségi értékelés

Vizsgálat: **2026. november 11.** · Alap: `5ac096f`, a telepítési metaadatok és az alább hivatkozott elsődleges források. **Előkészítő elemzés, nem ügyvédi szakvélemény vagy teljes körű megfelelőségi igazolás.** A szerződéses iratok teljes szövegét és a tényleges üzemeltetési gyakorlat minden elemét nem vizsgáltuk. A jogértelmezési következtetéseket elkülönítjük a kódból bizonyítható tényektől.

## 1. Eredmény és sürgősségi sorrend

A jelenlegi működésre **nem állítható igazolt teljes GDPR-megfelelőség**. A képek hozzáférésvédelme és több technikai védelem megvan; a jogalapok, megőrzés és érintetti eljárások lényeges részei viszont még nem dokumentáltak vagy nem megvalósítottak.

| Prioritás | Megállapítás | A rendezés igazolása |
| --- | --- | --- |
| P0 – jogalap | A napló egészségügyi vagy más különleges adatot feltárhat; nincs kifejezett hozzájárulás-rögzítés. | Adatkörönkénti besorolás, 6. és 9. cikk szerinti alap, szükség esetén előzetes kifejezett hozzájárulás, verziózott bizonyíték és visszavonási út. A meglévő állomány külön felülvizsgálata. |
| P0 – szolgáltatók | A DPA-k elfogadása megerősített, tartalmuk és termékkörük nem ellenőrzött. Az OpenCode-feltételeknél a végfelhasználói használat és saját fejlesztési cél is kérdéses. | Alkalmazandó megállapodások, mellékletek, írásos engedély vagy megfelelő termékfeltétel, modelloldali garanciák és továbbítási értékelés. A nem rendezhető útvonalon adatküldés korlátozása indokolt lehet. |
| P0 – megőrzés | Az AI-archívum és több napló határidő nélkül marad; étkezéstörlés nem töröl AI-archívumot. | Jóváhagyott, indokolt időtartamok, tényleges törlési folyamat és eredményellenőrzés, az archívumot és a szolgáltatókat is beleértve. |
| P1 – érintetti jogok | Nincs önkiszolgáló teljes törlés/export; kész, kipróbált kézi eljárás sem igazolt. | Jogosultság-ellenőrzött hozzáférés/export/törlés, kapcsolt adatokkal és mentés-visszaállítási eljárással. Nem feltétel az önkiszolgáló UI. |
| P1 – korhatár | 18+ üzemeltetői döntés, technikai megerősítés nélkül. | Arányos életkor-megerősítés és kiskorú esetére eljárás; szükségtelen okmánygyűjtés nélkül. |
| P1 – elszámoltathatóság | Nincs lezárt érdekmérlegelés, hatásvizsgálati előszűrés, szolgáltatói és incidensnyilvántartás. | Az eljárásrend elfogadása, kitöltött nyilvántartások, dokumentált felelős és rendszeres ellenőrzés. |
| P1 – tájékoztatás | Nincs hatályos két nyelvű jogi oldal és belépés/feltöltés előtti megfelelő hivatkozás. | Véglegesített, valós működést leíró szöveg, nyilvános URL, OAuth-beállítás és a lényeges változások közlése. |
| P1 – szolgáltatói azonosítás | Az üzemeltető nem kíván címet publikálni. | Ektv.-hatály és szolgáltatói minőség jogi vizsgálata; ha címközlés kötelező, valós, jogszerű székhely/telephely/lakcím feltüntetése. Az e-mail önmagában nem feltétlenül elegendő. |

P0 itt elsőként rendezendő feladatot jelöl, nem automatikusan bizonyított jogsértést vagy adatvédelmi incidenst. E dokumentum nem állítja le a szolgáltatást és nem töröl adatot.

## 2. Ki az adatkezelő, és kizárható-e a felelősség?

**Következtetés:** a felhasználói napló célját és lényeges technikai eszközeit meghatározó üzemeltető adatkezelő lehet akkor is, ha természetes személy, egyedüli fejlesztő és nem kér díjat. A nyilvános, mások számára hozzáférhető alkalmazásra nem alkalmazható automatikusan a kizárólag személyes vagy háztartási tevékenység kivétele. Más tényállásnál külön kell minősíteni egy csak utasításra dolgozó fejlesztőt; a jelenlegi üzemeltetői nyilatkozat viszont Kovács Ákost nevezi meg.

Jogforrás: [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/), 2. cikk (2) c), 4. cikk 7–8., 24. és 28. cikk; [EDPB 07/2020](https://www.edpb.europa.eu/documents/guideline/guidelines-072020-on-the-concepts-of-controller-and-processor-in-the-gdpr_en). A szolgáltatók szerepét célonként kell értékelni, nem általánosan „mindenki adatfeldolgozóként”.

**Teljes felelősségkizárás nem adható jogszerűen.** A GDPR 82. cikke szerinti kártérítési szabályokat és a hatósági hatásköröket egy weboldali nyilatkozat nem írja felül. A felelősség nem automatikus minden hiba miatt: a konkrét jogsértés, kár, okozati összefüggés és a jogszerű mentesülés feltételeit vizsgálni kell. A kötelező polgári jogi korlátok és tisztességtelen fogyasztói feltételek tilalma is számít; lásd [Ptk.](https://njt.jog.gov.hu/jogszabaly/2013-5-00-00), különösen 6:102. és következő §-ok, 6:152. §. Az utóbbi módosításainak pontos hatását a végleges feltételeknél külön jogászi ellenőrzésre kell bocsátani.

A tervezet ezért a szolgáltatás rendeltetését, az AI pontatlanságát, az ellenőrzés szükségességét és a külön garanciák hiányát mondja ki, de nem ígér mentességet a saját kötelezettségek alól.

## 3. Jogalap, érzékeny adat és hozzájárulás

A szerződés teljesítése csak az objektíven szükséges fiók- és naplóműködésre lehet alap, nem bármely, feltételekbe beleírt fejlesztési célra. A biztonsági érdekmérlegelésnél a szükségességet, az észszerű felhasználói elvárást, a kevésbé beavatkozó alternatívát és a korlátozásokat kell rögzíteni.

Az ételfotó önmagában nem minden esetben különleges adat. A betegségről, allergiáról, egészségi állapotról vagy vallásról szóló szöveg és következtetés viszont az lehet. Ekkor **egy 6. cikk szerinti alap és egy 9. cikk szerinti feltétel együttesen szükséges**. A szolgáltatás nem egészségügyi intézményként működik; a 9. cikk (2) h) vagy j) pontja nem alkalmazható pusztán „egészség” vagy „kutatás” elnevezéssel.

A javasolt kifejezett hozzájárulást célhoz és adatkörhöz kell kötni. A bizonyíték tartalmazza a felhasználót, a célt, a szöveg/verzió azonosítóját, időpontot, megerősítő műveletet és visszavonást; nyers IP tárolása nem szükségszerű. Nincs előre bepipált mező. A tájékoztatás megismerése, az ÁSZF elfogadása, az érzékeny adatkezelés és az opcionális fejlesztés négy eltérő kérdés. Az opcionális fejlesztés elutasítása nem zárhatja ki a szükséges naplót. A hozzájárulás önkéntességét a funkció elhagyásának következményeivel és lehetséges alternatíváival együtt kell értékelni.

Forrás: [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/), 5–7. és 9. cikk; [EDPB 05/2020](https://www.edpb.europa.eu/documents/guideline/guidelines-052020-on-consent-under-regulation-2016679_en). A jövőbeli hozzájárulás nem visszamenőleges felmentés: a meglévő állomány célját és jogalapját külön felül kell vizsgálni.

## 4. Sütik, látogatásmérés és ország

A bejelentkezéshez és kért hitelesítéshez szükséges sütik, a kezdeti nyelvi süti és az összesített mérés eltérő értékelést igényelnek. A GDPR jogalapja és a végberendezésen történő tárolás/hozzáférés szabálya két külön vizsgálat. A „nincs analitikai süti” nem azonos azzal, hogy nincs személyesadat-kezelés. A nyers IP köztes feldolgozása és a visszafejthető vagy azonosítóhoz kapcsolható hash is releváns.

A jelenlegi mérés korlátozott, helyi és DNT/GPC-t tiszteletben tartó. Jogos érdek alkalmazhatósága mellett érvelhet a csekély részletesség és az egyedi azonosító hiánya, de ezt dokumentált értékeléssel kell alátámasztani, és a kis csoportokból eredő kockázatot is mérlegelni kell. Nem vezetünk be felesleges általános „mindent elfogadok” sütifalat.

Forrás: [Eht.](https://njt.jog.gov.hu/jogszabaly/2003-100-00-00), 155. §; [NAIH 2025-ös honlap- és sütibeállítási anyag](https://www.naih.hu/files/dr-Kiss-Attila_A-honlapok-adatvedelmi-beallitasai-es-a-sutik_STARII-zarokonferencia.pdf); GDPR 5., 6., 13. és 21. cikk. A magyar szabályok személyi/tárgyi hatályát az alkalmazás konkrét működésére kell alkalmazni.

## 5. Szolgáltatói szerződések és országok

**Kódból és telepítési metaadatból bizonyított:** Londonban futó Northflank/GCP alkalmazás és PostgreSQL; Cloudinary védett képek; Modal Functions aszinkron meghívás régiórögzítés nélkül; OpenCode Google inference; Google OIDC és profilkép; GitHub Pages belépési közvetítő; helyi DB-IP; USDA ételkeresés.

**Üzemeltető által megerősített:** a négy fő szolgáltató DPA-jának elfogadása. **Nem igazolt:** az elfogadott példányok, jogi személyek és termékek teljes köre, minden alfeldolgozó, pontos modelloldali megőrzés, mentési ország, fiókszintű modelltréning-kizárás.

| Vizsgálat | Konkrét teendő |
| --- | --- |
| Northflank | Kérni/archiválni a hatályos DPA-t és alfeldolgozói listát, tisztázni a mentések és platformnaplók helyét és idejét. A nyilvános, 2021-es [általános feltételek](https://northflank.com/legal/terms) nem bizonyítanak minden egyedi garanciát. Régióleképezés: [Northflank dokumentáció](https://northflank.com/docs/v1/application/databases-and-persistence/integrate-with-a-database-provider/integrate-mongodb-atlas-with-northflank). |
| Cloudinary | A [DPA](https://cloudinary.com/gdpr/dpa) és [alfeldolgozói lista](https://cloudinary.com/trust/subprocessors) alapján fiókhoz kötött régió- és továbbítási értékelés kell. A szerződés megszűnésére vonatkozó törlési határidő nem minden egyes képtörlés azonos határideje. Az EU-s tárolási lehetőség puszta létezése nem bizonyítja ennek aktiválását. |
| Modal | A [DPA](https://modal.com/legal/dpa) és a Functions termék tényleges adatkezelése vizsgálandó. Az amerikai platformtárolást nem oldja meg önmagában egy európai GPU-régió. A Server/Endpoint eltérő megőrzését nem lehet automatikusan a mostani Functions-hívásokra alkalmazni. [Rezidencia](https://modal.com/docs/guide/data-residency), [megőrzés](https://modal.com/docs/guide/security). |
| OpenCode | A [2026. november 8-i feltételek](https://opencode.ai/legal/terms-of-service) belső használatra vonatkozó korlátját egyeztetni kell az alkalmazás végfelhasználóinak kiszolgálásával. A DPA ettől külön kérdés. A [Trust Center](https://trust.opencode.ai/) irataiból és a fiókfeltételekből igazolni kell a tartalom saját célú felhasználásának korlátját, az inference-megőrzést és a Google-láncot. A hosted agent 30 napos szabálya nem automatikusan inference-szabály. |
| Google és GitHub | A fogyasztói fiók, profilkép, levelezés és az AI-modell négy külön adatút. A Google OIDC scope nem Gmail-hozzáférés, de a kapcsolati Gmail-fiók saját vizsgálatot igényel. A GitHub-közvetítőre irányuló böngészőkérés külön címzetti kapcsolat. A saját szerverre vitt közvetlen OAuth-callback csökkenthetné ezt az adatutat; itt nem módosítottuk. |

**Nemzetközi továbbítás:** UK esetén a [2025/2574 határozattal](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ%3AL_202502574) megújított GDPR-megfelelőség releváns; a határozat jelenlegi lejárata 2031. december 27., változása követendő. Más országoknál a konkrét címzettre alkalmazható megfelelőség vagy GDPR 46. cikk szerinti garancia, szükség szerint SCC + TIA + kiegészítő intézkedés kell. Az EGT-n kívüli tárolás önmagában nem tiltott, de a DPA önmagában nem teljes nemzetközi adattovábbítási értékelés. Forrás: [Bizottság – adattovábbítás](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/rules-international-data-transfers_en), [megfelelőségi határozatok](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en).

## 6. Megőrzés, jogok és biztonság

A GDPR 5. cikk (1) e) szerinti korlátozott tárolás nem teljesül pusztán azzal, hogy „a felhasználó bármikor írhat”. Célhoz kötött, indokolt határidő és végrehajtható tisztítás kell. Az archivált eredeti és javított elemzés személyes adat maradhat; a titokszűrés nem anonimizálás. A törlési folyamatnak a költségrekordot, naplókat, heti jutalmakat, külső képtárolást és visszaállított mentést is vizsgálnia kell. Nem minden költségadatot kell törölni, ha személyhez már nem köthető, és szükséges aggregált üzemi adatként kezeljük.

A 12–22. cikk szerinti jogok kézzel is teljesíthetők, de kipróbált eljárás, határidőfigyelés, arányos azonosítás és biztonságos átadás szükséges. Az alap határidő egy hónap, nem általánosan „30 nap”. Nem kérhető automatikusan okmánymásolat. A [NAIH](https://naih.hu/erintetti-jogok) és a [Bizottság](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en) útmutatása ezt részletezi.

A technikai védelmek megléte nem bizonyítja a GDPR 32. cikk minden követelményének teljesítését. Ellenőrizendő a szolgáltatói és tulajdonosi MFA, a hozzáférések, titkok, mentés-visszaállítás és törlés. Külső auditot, tanúsítást vagy teljes szolgáltatói titkosítási bizonyítást nem végeztünk.

## 7. Nyilvántartás, DPO és hatásvizsgálat

A 250 fő alatti szervezet kivétele nem általános mentesség a 30. cikk alól: a rendszeres naplókezelés és az esetleges különleges adatok miatt adatkezelési nyilvántartást kell készíteni. Az [eljárásrend](GDPR-OPERATIONS.md) ehhez induló nyilvántartást ad, a hiányzó döntéseket jelölve.

Adatvédelmi tisztviselő kijelölése nem automatikus minden egészséggel összefüggő kis alkalmazásnál. A 37. cikk feltételeit, különösen a főtevékenység, nagymértékű különlegesadat-kezelés és rendszeres, szisztematikus megfigyelés körülményeit dokumentáltan kell vizsgálni. Jelenleg kijelölt DPO-t nem igazoltunk; az üzemeltető e-mailje nem egy igazolt DPO-kinevezés.

A 35. cikk szerinti hatásvizsgálati előszűrés szükséges: AI, tartós étkezési profil, esetleges érzékeny adat, több nemzetközi címzett és pontatlan egészségi következtetés együttes kockázatát kell értékelni. Ha valószínűsíthető a magas kockázat, teljes DPIA kell; fennmaradó magas kockázatnál a 36. cikk szerinti előzetes konzultáció is felmerül. Nem állítjuk pusztán e felsorolásból, hogy a teljes DPIA minden körülmények között kötelező. Forrás: [NAIH hatásvizsgálati lista](https://naih.hu/hatasvizsgalati-lista), [EDPB kockázatértékelés](https://www.edpb.europa.eu/sme/assess-the-risks_en).

## 8. Incidensek és aktuális Northflank-közlemény

A [Northflank 2026. október 30-i biztonsági incidensének november 6-i frissítése](https://status.northflank.com/cmvv0rn5a092f14rutwccodpp) titkokat érintő eseményről számol be; a szolgáltató ekkor nem jelzett bizonyítékot workload-adatok elérésére. A Yumetrics itt vizsgált szolgáltatása és adatbázisa november 7-én jött létre, tehát később. **Ez nem bizonyít Yumetrics-adatszivárgást.** A korábbi integrációs fiókok és esetleg újrahasznált titkok érintettsége külön ellenőrzendő, a szolgáltatói végkövetkeztetéseket követni kell.

Nem történt automatikus kulcsforgatás vagy hatósági bejelentés a közlemény alapján. A szolgáltatói esemény érintettségét, az esetleges személyesadat-incidenst és a kockázatot dokumentáltan kell megítélni. A GDPR 33. cikke szerinti, szükség esetén 72 órán belüli bejelentés az adatkezelő tudomásszerzéséhez kapcsolódik; nem minden hibanapló incidens, és nem minden incidens bejelentésköteles. Minden tényleges személyesadat-incidenst nyilván kell tartani. Magas kockázatnál a 34. cikk szerinti érintetti tájékoztatás is szükséges lehet. Forrás: [EDPB incidensútmutató](https://www.edpb.europa.eu/sme/assess-the-risks/data-breaches_en).

## 9. Magyar szolgáltatói jog és egyéb határok

A GDPR 13. cikke az adatkezelő azonosságát és elérhetőségét írja elő. Ettől külön kérdés a szolgáltatói impresszum: az [Ektv. 4. §](https://njt.jog.gov.hu/jogszabaly/2001-108-00-00) hatálya alá tartozó szolgáltatónál székhelyet, telephelyet, ennek hiányában lakcímet is közzé kell tenni. A „ne adj meg címet” üzemeltetői kérését tiszteletben tartottuk, de ez nem törvényi kivétel. A tényleges szolgáltatói minőséget kell megállapítani; jogszerű üzleti cím lehetősége vizsgálható, kitalált cím vagy önmagában egy postafiók nem automatikus megoldás.

A [2011. évi CXII. törvény](https://njt.jog.gov.hu/jogszabaly/2011-112-00-00) magyar kiegészítő szabályait és a NAIH eljárását is figyelembe kell venni. Formális hatósági eljárást ne kizárólag sima e-mailre irányítsunk: [aktuális NAIH ügyintézés](https://naih.hu/ugyfelszolgalat-kapcsolat?width=fixed).

A fogyasztói/digitális szolgáltatási minősítés, a kötelező panaszkezelés, az AI Act alkalmazhatósága és az esetleges orvostechnikai rendeltetés külön jogi vizsgálatot igényelhet. Ez a csomag nem állít AI Act-, orvostechnikai, fogyasztóvédelmi vagy „minden törvényre” kiterjedő tanúsítást. A szolgáltatást nem indokolt orvosi biztonságot vagy mérés nélküli hiteles kalóriát ígérve hirdetni.

## 10. A vizsgálat bizonyítékai és korlátai

Kód: `lib/auth.mjs`, `api.mjs`, `database.mjs`, `photos.mjs`, `providers.mjs`, `modal-food.mjs`, `ai-archive.mjs`, `telemetry.mjs`, `visitors.mjs`, `request-limits.mjs`, `weekly-challenges.mjs`, `scripts/modal_foodr1.py`; műszaki összefoglaló: [MkDocs adatvédelmi fejezet](../technical/privacy.md).

A szolgáltatói erőforrás-metaadatokat és megőrzési ütemezést olvasási művelettel ellenőriztük; felhasználói naplót, képet vagy AI-választ nem kellett a jogi kutatáshoz letölteni. Titkos szerződések, aláírt mellékletek, szolgáltatói régióigazolások és az összes belső üzemeltetési intézkedés nem állt rendelkezésre. Fizetős AI- vagy GPU-hívás nem történt. A feljegyzés a dátumhoz kötött állapotot írja le; jogszabály- vagy szolgáltatásváltozáskor frissítendő.
