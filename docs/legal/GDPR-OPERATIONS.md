# Yumetrics – belső adatkezelési és incidenskezelési eljárásrend

**Jóváhagyásra váró terv · 2026. november 11.** Felelős: Kovács Ákos üzemeltető/adatkezelő. Kapcsolat: thisisnotka@gmail.com. A dokumentum elkészítése nem kapcsol be automatikus törlést, nem tanúsít működő eljárást, és nem jelent DPO-kinevezést. A kötelezettségek alapja a [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/), különösen az 5., 12–22., 24–25., 28., 30., 32–36. és 44–49. cikk; a [jogi feljegyzés](LEGAL-REVIEW-2026-11-11.md) tartalmazza a további forrásokat és korlátokat.

## 1. Adatkezelési nyilvántartás – induló állomány

Érintettek: látogatók, nagykorú fióktulajdonosok, megkeresők; járulékosan a feltöltésben szereplő más személyek. Utóbbiak adatainak feltöltését kerülni kell. Az esetleg más személytől származó adatnál a GDPR 14. cikk szerinti kötelezettség és kivételei külön vizsgálandók; egy általános tiltás nem old meg minden esetet.

| Művelet/cél | Adatok és érintettek | Jogalapi terv | Tárolás/címzett | Megőrzés |
| --- | --- | --- | --- | --- |
| Fiók és hitelesítés | Fióktulajdonos Google-azonosítója, neve, e-mailje, profilképe, munkamenete | 6(1)b; külön biztonság 6(1)f | `users`, `sessions`, `oauth_states`; Northflank, Google, jelenlegi GitHub-közvetítő | Fiókéletút; technikai lejáratok az alábbi terv szerint |
| Kért étkezési napló és elemzés | Képek, étkezés, megjegyzés, mért adat, recept, eredmény és javítás | 6(1)b; különleges adatnál megfelelő 9. cikk szerinti feltétel is, tervezetten 9(2)a | `meals`, `analysis_jobs`, `food_records`; Northflank, Cloudinary, Modal, OpenCode/modellszolgáltató | Felhasználói döntéshez kötött napló; munkasor rövid határidővel |
| Heti kihívás és jelvény | Választás, aktivitás, haladás, jutalom | 6(1)b a kért funkcióra; érzékeny következtetés kerülendő | `weekly_activity`, `weekly_challenges`; Northflank | Fiókéletút, szükségességi felülvizsgálattal |
| Biztonság és működés | Hibakód, esemény, kvóta, technikai kulcs, szükséges költségmetaadat | 6(1)f, dokumentált érdekmérlegeléssel; különleges tartalom mellőzendő | `request_limits`, `analysis_attempts`, `app_logs`, minimális `ai_requests`, `admin_audit`; platformnaplók | Célonként rövid határidő; nem általános tartalomarchívum |
| Opcionális AI-összehasonlítás | Szűrt válasz, elemzés, legutóbbi jóváhagyás, kapcsolóazonosítók | Bevezetendő 6(1)a és szükség esetén 9(2)a | Tartalmi `ai_requests` mezők; Northflank; admin hozzáférés | Elkülönített, korlátozott megőrzés; jelenleg nincs külön választás vagy lejárat |
| Látogatásmérés és alapnyelv | Kérés fejlécei, köztes IP-feldolgozás, ország, dimenziónkénti számlálók, nyelvsüti | 6(1)f vizsgálandó; eszköztárolási szabály külön | Helyi GeoIP, `visitor_stats`; Northflank; nincs külső Umami | Számlálók 400 nap; nyelvsüti 365 nap |
| Kapcsolattartás és joggyakorlás | Levél, azonosítás, teljesítés bizonyítéka | Cél szerint 6(1)b/f, joggyakorlásnál 6(1)c | Gmail és elkülönítendő kérelemnyilvántartás | Szükségesség szerint; az alábbi javaslat jóváhagyandó |

A táblázat nem állítja, hogy a tervezett jogalap már bizonyított. A végleges nyilvántartáshoz hozzá kell rendelni a konkrét szerződéseket, adattovábbítási garanciákat, megőrzési döntést, technikai intézkedéseket és a legutóbbi felülvizsgálatot. A szolgáltatói fiókazonosítók és titkok ne kerüljenek a nyilvános dokumentációba.

## 2. Jóváhagyandó megőrzési terv

**Az alábbi számok üzemeltetői döntést és szükségességi ellenőrzést igénylő javaslatok, nem jogszabályi általános határidők és nem jelenlegi beállítások.** A megvalósításnak fizikailag is törölnie vagy ténylegesen anonimizálnia kell; a felületi elrejtés és a változatlan hash nem anonimizálás.

| Adatkör | Javaslat | Indok, végrehajtás |
| --- | --- | --- |
| Fiók és személyes napló | A fiók használatáig vagy korábbi törlésig; éves szükségességi felülvizsgálat | A felhasználó saját történeti naplója. Inaktív fiókra külön, előzetesen közölt szabály szükséges; itt nem állítunk be csendes automatikus fióktörlést. |
| Munkamenet és OAuth | Meglévő 30 napos/10 perces érvényesség; lejárt fizikai rekordok legkésőbb 24 órás rendszeres takarítása | Jelenleg csak eseményvezérelt tisztítás van; külön időzítés még nincs. |
| Kvóták és feldolgozási kísérletek | Rate-limit lejárat után legfeljebb 24 óra; kísérletek 7 nap | A napi/órás védelemhez szükséges ablak és rövid hibakeresési tartalék; pontos SQL-függések felülvizsgálandók. |
| Befejezett feldolgozási feladat | 7 nap | Futó és újrapróbálható feladatot nem szabad pusztán idő alapján eltávolítani; a végleges állapot és képtakarítás előfeltétel. |
| Általános működési napló | 30 nap | Tartalommentes diagnosztika; indokolt incidenshez tartozó minimum elkülönített ügyiratba kerülhet. |
| Adminaudit | 180 nap | Visszaélés-felderítés; változásadatok és célazonosítók minimálása szükséges. |
| Opcionális tartalmi AI-archívum | Legfeljebb 90 nap az adott választól; korábbi visszavonás vagy releváns törlés esetén előbb | Összehasonlításra elégséges mintavételt és rövidebb időt is értékelni kell. Új jóváhagyás ne indítsa újra korlátlanul az eredeti válasz határidejét. |
| Személyhez kapcsolt AI-költségmetaadat | Legfeljebb 90 nap; utána személyhez nem köthető összesítés | A költségméréshez jellemzően nem kell az ételfotó, válaszszöveg vagy tartós felhasználói kapcsolat. |
| Összesített látogatottság | Meglévő 400 nap | Több mint egy év összevethető; évente indokolandó, kis csoportok megjelenítése korlátozható. Jelenleg eseményvezérelt tisztítás. |
| Egyszerű támogatási levél | Ügy lezárása után 90 nap | A hasznos technikai tanulság személytelenül megőrizhető; érzékeny mellékletet előbb el kell távolítani. |
| Joggyakorlás bizonyítéka, incidensirat | Ügytípusonként indokolt határidő; éves felülvizsgálat | Csak a teljesítés igazolásához vagy konkrét jogi igényhez szükséges minimum. A teljes napló másolata nem általános jogi archívum. |
| Adatbázismentés | Jelenlegi 7 nap; visszaállításkor törlések ismétlése | A mentés tényleges lejáratát, objektumtárolását és törlési garanciáját a szolgáltatóval igazolni kell. |

Az elfogadott tervet egyszerre kell átvezetni a kódon, konfiguráción, szolgáltatói beállításokon, tájékoztatón és nyilvántartáson. Legyen dátumozott, tartalommentes bizonyíték a takarítás eredményéről; a sikertelen törlést jelezni és újrapróbálni kell. A hozzájárulás visszavonása és az érintetti törlés nem várhat egy 90 napos normál lejáratra.

## 3. Hozzájárulás és 18+ működés – bevezetendő

1. Belépés előtt legyen elérhető a két nyelvű tájékoztató és feltétel. A korhatárt külön, egyszerű megerősítés kezelje; ne kérjünk automatikusan okmánymásolatot.
2. Az esetleges különlegesadat-kezeléshez szükséges kifejezett nyilatkozat előzze meg a releváns funkciót és a külső adatküldést. A szöveg nevezze meg az adatot, célt, címzettkört, megőrzést és visszavonási utat. A hozzájárulás nem általános harmadikországi kivétel.
3. A későbbi tartalmi AI-összehasonlítás külön, alapállapotban kikapcsolt választás legyen. A szükséges személyes napló és az összehasonlítási archívum másolatát technikailag is külön célként kell kezelni. A jelenlegi kód minden megfelelő választ archivál; ez a választás még nincs meg.
4. Rögzítendő a cél/verzió, felhasználó, idő, megerősítő művelet és visszavonás. Visszavonás után új opcionális archiválás nem történhet, és a régi célhoz tartozó tartalomról is dönteni kell. Célonként értékelendő, mi tartható meg más önálló jogalapon; jogalapot nem szabad utólag szabadon cserélgetni.
5. Meglévő felhasználóknál nem elég a feltétel csendes frissítése: a következő érintett művelet előtt rendezni kell a szükséges nyilatkozatot és a korábbi állományt. Kiskorú és visszavonás esetére legyen kipróbált folyamat.

Lehetséges, véglegesítendő mezőszövegek: HU „Betöltöttem a 18. életévemet.” / EN “I am 18 or older.”; HU „Kifejezetten hozzájárulok ahhoz, hogy a naplóm egészségi állapotra utaló adatait a kért naplózás és képelemzés céljából kezeljék.” / EN “I explicitly consent to processing information in my diary that reveals my health status for the diary and image analysis I request.” Ezek csak rövid mezőszövegek; a teljes előzetes tájékoztatás és önkéntességi vizsgálat nélkül nem elegendők.

## 4. Érintetti kérelmek kezelése

**Bemenet:** thisisnotka@gmail.com; nem követelhető kizárólag kötelező űrlap. A normál e-mail-kérelmet is fel kell ismerni. Rögzítsd az ügyazonosítót, beérkezést, kérelmi jogot, érintett fiókot, azonosítási lépést, határidőt, intézkedést, címzetti értesítést és lezárást. Valódi ügyirat csak hozzáférésvédett belső tárolóba kerüljön, ne Gitbe.

1. **Azonosítás:** elsősorban meglévő, ellenőrzött fiókhoz kötött biztonságos megerősítés. Az e-mail-cím puszta állítása nem elég adatcsomag kiadásához. Elveszett fióknál arányos alternatíva kell. Ne kérj Google-jelszót, belépési kódot vagy indokolatlan okmánymásolatot.
2. **Határidő:** indokolatlan késedelem nélkül, legfeljebb egy naptári hónap. Összetett/nagyszámú kérelemnél indokolt, legfeljebb további két hónapos hosszabbításról az első hónapban értesíteni kell. A megkeresést ne hagyd megválaszolatlanul egy belső technikai hiány miatt.
3. **Hozzáférés:** a 15. cikk szerinti adatok és információk másolata. Az AI-következtetések is lehetnek személyes adatok. Más felhasználó adata, titok, token és belső hozzáférési kulcs nem adható ki.
4. **Hordozhatóság:** a 20. cikk feltételeinek megfelelő, az érintett által rendelkezésre bocsátott adatok strukturált, széles körben használt, géppel olvasható formátumban, például JSON/CSV és szükség szerint képfájlok. Az összes AI-következtetés nem automatikusan hordozhatósági adat, de hozzáférési jog alá tartozhat.
5. **Helyesbítés:** a naplómezőn túl vizsgáld az archív javítást és tévesen kapcsolt adatokat. Az eredeti megőrzéséhez külön indok kell; ne írjuk le „javítottként” azt, ami továbbra is téves tényként szerepel.
6. **Törlés/korlátozás/tiltakozás/visszavonás:** célonként és kivételenként értékelendő. A kivételt konkrétan indokold, ne utasíts el mindent általános „jogi okból”. A tiltakozás nem minden jogalapra azonosan alkalmazható.
7. **Átadás és válasz:** biztonságos, időben korlátozott módon; teljes érzékeny napló ne menjen ellenőrizetlen címre. A másolat átadásának bizonyítéka legyen tartalommentes. Elutasításnál ok, hatósági panasz és bírósági jogorvoslat; főszabály szerint díjmentes eljárás.

### Fiókszintű törlés végrehajtási ellenőrzőpontjai

Ez eljárási terv, **nem élesben kipróbált törlőscript**. Adatbázis-kapcsolatok és sorzárak ellenőrzése nélkül tilos általános SQL-t másolni az éles adatbázisra.

- Előbb azonosítsd az összes érintett azonosítót és Cloudinary-eszközt, majd akadályozd meg az új munkamenetet, feltöltést és háttérfeldolgozási visszaírást. A futó Modal/OpenCode-kérés és lease kezelése szükséges; egy későn beérkező válasz ne hozza vissza az adatot.
- Gyűjtsd össze és kezeld a Cloudinary-törlést `invalidate` kéréssel. A visszaigazolást és sikertelen műveleteket kövesd; a törléshez szükséges eszközazonosítót ne veszítsd el a DB-sor túl korai eltávolításával.
- Vizsgáld a `users`, `sessions`, `meals`, `analysis_jobs`, `analysis_attempts`, `ai_requests`, `app_logs`, `admin_audit`, `weekly_challenges`, `weekly_activity` kapcsolatait és a metaadatokban szereplő azonosítókat. **Az `ai_requests` nem tűnik el automatikusan az étkezéssel.** A hash-elt limitkulcsot a tényleges kulcsképzés szerint keresd, ne próbáld nyers UUID-kereséssel teljesnek tekinteni a törlést.
- A személyhez kapcsolható választ, jóváhagyást, eredeti elemzést és képlenyomatot is kezeld. Közös, valóban nem személyes USDA-forrásrekord vagy összevont üzemi költség nem feltétlenül törlendő. Más adminok vagy felhasználók adatai és konkrét jogi megőrzés esetén célzott megoldás kell.
- A külső feldolgozóknak a szerződés szerinti törlési/korlátozási utasítást továbbítsd, és értékeld a GDPR 19. cikk szerinti címzetti értesítést. Az ismert szolgáltatói megőrzési késedelmet ne nevezd azonnali törlésnek.
- Tarts fenn hozzáférésvédett, minimális törlésnyilvántartást a mentési időablakhoz: azonosító, érintett tárolók, törlési idő és újraérvényesítés. Visszaállítás előtt a rendszer ne szolgálhassa ki a korábban törölt adatot; a törlések ismétlése előzze meg az éles forgalmat. A nyilvántartás maga is személyes adat lehet, ezért saját célhoz kötött lejárat kell.
- Ellenőrizd a tulajdonosi API-t és a képelérést, a DB-kapcsolatokat és a sikertelen feladatsort. Értesítsd az érintettet a tényleges eredményről és minden jogszerű kivételről. Teljes törlést csak bizonyított eredmény után állíts.

## 5. Érdekmérlegelés – kitöltendő döntési váz

Külön vizsgálandó a biztonság, hibakeresés/költségmérés, ország/nyelv és látogatásmérés. Egyetlen általános, minden célra kiterjedő lap nem elég.

| Kérdés | Rögzítendő döntés |
| --- | --- |
| Mi a konkrét érdek? | Például jogosulatlan fiókhasználat megakadályozása; ne „bármilyen fejlesztés”. |
| Szükséges-e minden adat? | IP helyett rövid érvényű kulcs; teljes AI-válasz helyett hibakód és összesített költség; megjegyzés elhagyása. |
| Milyen hatás várható? | Érzékeny következtetés, kis csoport, admin belátása, harmadik ország, összekapcsolás. |
| Mit várhat a felhasználó? | Személyes napló védelme igen; korlátlan fejlesztési archívum nem magától értetődő. |
| Milyen garancia van? | Rövid határidő, DNT/GPC, tiltakozási út, minimális hozzáférés, tartalommentes napló. |
| Miért nem elég kevésbé beavatkozó megoldás? | Valós alternatívák és az elvetés oka. |
| Eredmény és felülvizsgálat | Elfogadott/elutasított/szűkített cél, felelős, dátum, következő felülvizsgálat. |

E váz nem előre kitöltött, automatikusan pozitív érdekmérlegelés.

## 6. Hatásvizsgálat, DPO és szolgáltatói ellenőrzés

A DPIA-előszűrés rögzítse a mennyiséget, időtávot, földrajzi kört, adatok érzékenységét, AI-következtetéseket, sérülékeny csoportokat, adatösszekapcsolást, kockázatot és garanciákat. A fő kockázatok: egészségi következtetés, fiók vagy admin kompromittálódása, pontatlan következtetés felhasználása, elhúzódó archívum, nem rendezett szolgáltatói cél és nemzetközi adatút. A [NAIH listájával](https://naih.hu/hatasvizsgalati-lista) is össze kell vetni.

Magas kockázat esetén a teljes DPIA tartalmazza a művelet leírását, szükségességet/arányosságot, kockázatelemzést és intézkedéseket; fennmaradó magas kockázatnál előzetes hatósági konzultáció szükséges lehet. A DPO-kötelezettségről külön, GDPR 37. cikk szerinti döntés készüljön. A kijelölt kapcsolati e-mail önmagában nem DPO.

Szolgáltatónként hozzáférésvédetten megőrzendő: jogi név és szerep, termék/fiók, DPA és elfogadási bizonyíték, alfeldolgozói lista és változáskövetés, adatkör, országok, megőrzés, törlési lehetőség, saját célú felhasználás tilalma/korlátja, incidensértesítés, SCC vagy megfelelő más továbbítási jogcím, szükség szerinti TIA és kiegészítő intézkedések. A nyilvános marketingoldal nem helyettesíti a szerződést. A Gmail-kapcsolattartás besorolását is fel kell venni.

## 7. Adatvédelmi incidens eljárása

**Felelős:** az üzemeltető; elérhető helyettes vagy külső segítség útja még kijelölendő. Az egyfős működés sem függeszti fel a határidőket. Alap: GDPR 4(12), 33–34. cikk; [EDPB](https://www.edpb.europa.eu/sme/assess-the-risks/data-breaches_en).

1. **Észlelés és idő:** rögzítsd a jelzést és a személyesadat-incidensről való tudomásszerzés idejét. Egy HTTP 500, modellhiba vagy leállás nem automatikusan személyesadat-incidens; az adat elvesztése vagy tartós elérhetetlensége is lehet releváns.
2. **Elhatárolás:** minimális szükséges hozzáférés-korlátozás, titokvédelem, bizonyítékmegőrzés. Kulcsforgatást összehangoltan végezz, ne szüntesd meg ellenőrizetlenül a működő adatkapcsolatot. Ne küldj nyers személyes adatot nyilvános hibajegybe vagy további AI-hoz.
3. **Érintettség:** rendszer, időablak, adatkategória, hozzávetőleges érintetti és rekorddarabszám, titkosítás és kulcsok, elérhetetlenség/kiszivárgás/módosítás, várható következmény. A szolgáltatói közlemény és a saját rendszer érintettsége két külön tény.
4. **Kockázat:** személyazonosság-visszaélés, egészségi információ, magánélet, hátrányos következtetés, további hozzáférés. A „kevés felhasználó” nem önálló bizonyíték arra, hogy nincs kockázat.
5. **Hatósági döntés:** ha az incidens valószínűsíthetően kockázattal jár, a tudomásszerzéstől számított, lehetőség szerint 72 órán belüli bejelentés szükséges; késés okát dokumentálni kell. Hiányos információ szakaszosan kiegészíthető. Alacsony kockázatú, be nem jelentett incidensnél is indokolt döntés és nyilvántartás kell.
6. **Érintettek:** valószínűsíthetően magas kockázatnál indokolatlan késedelem nélküli, közérthető tájékoztatás, elérhetőség, következmény és intézkedés, a jogszabályi kivételek egyedi vizsgálatával.
7. **Lezárás:** helyreállítás ellenőrzése, szolgáltatói visszajelzés, javítás, ismétlődés megelőzése, tájékoztató/nyilvántartás frissítése. Törölt adatok ne kerüljenek vissza mentésből.

Incidensirat mezői: ügyazonosító; esemény és tudomásszerzés; forrás/bizonyíték helye; érintett rendszer/adat/időablak; becsült kör; következmény; kockázat és indok; azonnali és végleges intézkedés; bejelentésről és értesítésről döntés, idő és azonosító; felelős; lezárás; felülvizsgálat. A valódi irat ne legyen nyilvános.

A 2026. október 30-i Northflank-esemény saját érintettségi ellenőrzését a [jogi feljegyzés](LEGAL-REVIEW-2026-11-11.md#8-incidensek-és-aktuális-northflank-közlemény) külön tárgyalja; az itt vizsgált november 7-i erőforrások miatt nem állítunk bizonyított Yumetrics-incidenst.

## 8. Közzétételi és rendszeres ellenőrzési feltételek

- A végleges két nyelvű szöveghez tényleges hatálybalépés, adatkezelői elérhetőség és jogszerű szolgáltatói azonosítás tartozzon; a címkérdés rendezendő, hamis adat nem közölhető.
- A belépés és az első adatküldés előtt látható hivatkozás, a profilból elérhető joggyakorlás/visszavonás, az opcionális cél külön választása és a 18+ megerősítés legyen ellenőrizve. A Google OAuth képernyő adatvédelmi URL-jét is frissíteni kell.
- Saját szintetikus tesztfiókkal próbáld ki az engedélyezést, visszavonást, helyesbítést, exportot, teljes törlést és a törölt állapot visszaállítás utáni megőrzését. Fizetős AI-hívás ehhez általában nem szükséges; szolgáltatói adapter tesztkörnyezettel helyettesíthető.
- Ellenőrizd a szolgáltatói MFA-t, a minimális adminhozzáférést, a titokrotáció folyamatát és a mentési helyreállítást. A beállítások meglétét bizonyíték nélkül ne nevezd ellenőrzöttnek.
- Új modell, szolgáltató, ország, cél, tartósabb megőrzés, egészségügyi funkció vagy jelentős növekedés esetén új jogi és kockázati felülvizsgálat kell. Legalább évente legyen a teljes nyilvántartás, negyedévente a hozzáférések és szolgáltatói változások ellenőrzése; ezek javasolt üzemeltetési ütemek.

**Elfogadási mezők:** verzió; jóváhagyó; dátum; elfogadott megőrzési időtartamok; fennmaradó kockázatok; végrehajtott műszaki változat; ellenőrzés bizonyítékai; következő felülvizsgálat. Ezek jelenleg nincsenek kitöltve; a tervezet nem állít megtörtént jóváhagyást.
