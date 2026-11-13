# Yumetrics – adatkezelési tájékoztató

**Felülvizsgálati tervezet · 2026. november 11. · Még nem hatályos.** A tényleges működést az alábbiak ismertetik. A „bevezetendő” és „ellenőrizendő” megjelölések megoldatlan feladatot jelentenek, nem már működő garanciát. A hatályba léptetés feltételeit a [dokumentumjegyzék](README.md) tartalmazza. [English version](PRIVACY-EN.md).

## 1. Ki kezeli az adatokat?

A https://yumetrics.app alkalmazás üzemeltetője és a felhasználói napló adatkezelője **Kovács Ákos**. Adatvédelmi kérdések és kérelmek: **[thisisnotka@gmail.com](mailto:thisisnotka@gmail.com)**. Levelezési címet az üzemeltető nem bocsátott rendelkezésre közzétételre. Az esetleges külön szolgáltatói címközlési kötelezettség még jogi ellenőrzést igényel.

Az adatkezelő határozza meg, mire és milyen lényeges eszközökkel használja az alkalmazás az adatokat. E szerepét nem szünteti meg, hogy egyben ő a fejlesztő, vagy hogy a szolgáltatás ingyenes. A szolgáltatók saját fiók-, biztonsági vagy jogszabályi céljaik tekintetében önálló adatkezelők is lehetnek; nem minden adatkezelésük minősül a Yumetrics utasítására végzett adatfeldolgozásnak.

## 2. Kinek szól az alkalmazás?

A Yumetrics személyes étkezési napló, képalapú ételfelismeréssel, becsült tápértékekkel és játékos kihívásokkal. **Kizárólag 18. életévüket betöltött személyek számára kívánjuk működtetni.** A tervezet készítésekor nincs külön életkor-megerősítés vagy ellenőrzés a belépési folyamatban; ezt a szabály bevezetése előtt rendezni kell. Teljes születési dátumot vagy személyi okmányt pusztán a korhatár megerősítése érdekében nem indokolt gyűjteni. Ha kiskorú fiókjáról szereztünk tudomást, az egyedi körülményeket vizsgálva korlátozzuk a hozzáférést és intézkedünk az adatok jogszerű rendezéséről.

## 3. Milyen adatokat kezel az alkalmazás?

| Adatkör | Tartalom és forrás |
| --- | --- |
| Google-belépés | A Google által átadott fiókazonosító (`sub`), ellenőrzött e-mail-cím, név és profilkép-hivatkozás; saját belső felhasználói azonosító |
| Fiók és beállítások | Megadott napi energiakeret, nyelv, fiókállapot, létrehozási és működési időpontok |
| Étkezési napló | Feltöltött ételfotók, étkezési nap és idő, időzóna, étkezéstípus, megjegyzés, ismert tömeg, recept és más kiegészítő adat |
| AI-eredmények | Felismert ételnevek, összetevők, becsült mennyiségek és tápértékek, feltételezések, bizonytalanságok, eredeti és javított elemzés, jóváhagyás |
| Kihívások | Heti választás, aktivitási napok, recept- és mérési események, haladás, teljesítés és jutalom |
| Technikai adatok | IP-cím és HTTP-fejlécek a kérés fogadásakor; munkamenet- és belépési állapot, kéréskorlátozási kulcsok, feldolgozási és hibanaplók |
| AI- és adminnaplók | Modell, időpont, állapot, válaszidő, tokenek, számított költség, szűrt válasz, elemzés, jóváhagyás, adminműveletek; esetenként felhasználóhoz vagy étkezéshez kapcsolva |
| Kapcsolattartás | A megkeresésben önként megadott elérhetőség, üzenet és a kérelem intézéséhez szükséges adatok |

A Google-jelszót nem kapjuk meg. A belépés nem kér hozzáférést a levelekhez vagy a Google Drive fájljaihoz; tartós Google access/refresh tokent nem tárolunk. A Gmail-címre küldött adatvédelmi levél ugyanakkor külön levelezési szolgáltatásban is megjelenik, nem az alkalmazás adatbázisában.

A böngésző a feltöltött képet újrarajzolja; az eredeti EXIF/GPS-metaadatokat nem másolja át. A képen látható személy, lakókörnyezet, név vagy egészségi információ ettől még felismerhető maradhat. Kérjük, ételt fényképezz, és ne tölts fel más személyt, okmányt, orvosi dokumentumot vagy szükségtelen személyes adatot.

## 4. Célok és jogalapok

Az alábbi jogalapi tervet a tényleges működéshez igazítva kell véglegesíteni. A tájékoztató elolvasása vagy a belépés **nem általános hozzájárulás minden adatkezeléshez**.

| Cél | Tervezett jogalap és határ |
| --- | --- |
| Fiók, saját napló, kért képelemzés, mentés és kihívások | GDPR 6. cikk (1) b): a kért szolgáltatás teljesítése, kizárólag az ehhez objektíven szükséges adatokra. A szerződéses kereteket még véglegesíteni kell. |
| Érzékeny információt feltáró napló vagy elemzés | A 6. cikk szerinti jogalap mellett a 9. cikk szerinti feltétel is kell. A tervezett megoldás az érintett **kifejezett, igazolható hozzájárulása** a 9. cikk (2) a) alapján, a megfelelő funkció használata előtt. Ilyen rögzítés jelenleg nincs. |
| Hozzáférés-védelem, visszaélés-megelőzés, szükséges hibafeltárás és költségellenőrzés | 6. cikk (1) f): az üzemeltető és a felhasználók biztonsághoz, megbízható és fenntartható működéshez fűződő jogos érdeke; dokumentált érdekmérlegelés és adattakarékosság szükséges. Nem ad önmagában felhatalmazást érzékeny tartalmak korlátlan naplózására. |
| Opcionális, későbbi AI-összehasonlítás és fejlesztési értékelés | Elkülönített, visszavonható hozzájárulás tervezett a 6. cikk (1) a), szükség esetén a 9. cikk (2) a) alapján. A naplózástól külön kezelendő; jelenleg nincs külön választási lehetőség. |
| Helyi országfelismerés és nyelvi alapbeállítás; korlátozott összesített mérés | 6. cikk (1) f) szerinti érdekmérlegelésre javasolt, a 9. szakasz korlátaival. A végleges jogalap és az eszköztárolási szabályok ellenőrzendők. |
| Érintetti kérelmek és kötelező incidensintézkedések | 6. cikk (1) c), a GDPR 12–22. és 33–34. cikkében előírt konkrét kötelezettségek körében. Egyéb megkeresés megválaszolása a tartalmától függően b) vagy f). |

Egy ételfotó nem szükségképpen egészségügyi adat. A rendszeres napló, a megjegyzés vagy az elemzés azonban feltárhat betegséget, allergiát, egészségi állapotot vagy vallási meggyőződést; ezekre a különleges adatokra szigorúbb szabályok vonatkoznak. Nem állítjuk, hogy az AI-válaszok archiválása automatikusan közérdekű tudományos kutatásnak minősül. A tervezett jogalapok nem teszik visszamenőleg jogszerűvé az esetleg megfelelő alap nélkül kezelt adatokat.

## 5. Hol tárolódnak az adatok?

- **Napló és alkalmazásadatok:** Northflankon üzemeltetett PostgreSQL-adatbázis. A vizsgálatkor az alkalmazás és az adatbázis Google Cloud `europe-west2`, **London, Egyesült Királyság** régióban működik. Ez nem EGT-régió.
- **Ételfotók:** Cloudinary, `authenticated` típusú védett eszközök. A pontos tárolási országokat és a fiókra vonatkozó régiós garanciákat a szerződésből még ellenőrizni kell; EGT-n belüli kizárólagos tárolást nem igazoltunk.
- **AI-feldolgozás:** a képek a bekapcsolt Modal-segédhez és az OpenCode-on elért modellhez kerülnek. A válaszok és működési metaadatok részben az alkalmazás PostgreSQL-adatbázisában is megmaradnak.
- **Biztonsági mentés:** heti adatbázismentés, a jelenlegi ütemezésben hét napos megőrzéssel. A mentési objektumok pontos földrajzi helye külön ellenőrizendő. Az adatbázismentés nem tartalmazza a Cloudinary-képek bájtjait.
- **Üzemeltetői levelezés:** az adatvédelmi címre küldött levelek a Gmailben is tárolódnak. A levelezési fiók szerződéses besorolását, megőrzését és hozzáférésvédelmét külön rendezni kell.

## 6. Mely szolgáltatók kapnak adatot?

| Címzett | Feladat és átadott adatok | Hely és ellenőrizendő feltételek |
| --- | --- | --- |
| **Northflank Ltd**, alvállalkozói infrastruktúrával | Alkalmazás, adatbázis, mentések, technikai üzemeltetés; az itt tárolt személyes adatok | Az élő erőforrások Londonban. A tényleges DPA, alfeldolgozók, mentések és platformnaplók feltételeit ellenőrizni kell. [Jogi feltételek](https://northflank.com/legal/terms) |
| **Cloudinary**, a fiókszerződés szerinti jogi személy | Védett képtárolás, visszaolvasás és törlési/invalidation műveletek | Globális szolgáltatás; pontos régió és továbbítási garanciák ellenőrizendők. [DPA](https://cloudinary.com/gdpr/dpa), [alfeldolgozók](https://cloudinary.com/trust/subprocessors) |
| **Modal Labs, Inc.** | Opcionális Food-R1 ételnév-felismerés; ételfotók és válasz | Nincs régiórögzítés. Az aszinkron Functions-hívások bemenete és kimenete amerikai tárolással járhat, legfeljebb hét napos szolgáltatói megőrzéssel. A konténer leállása nem jelent azonnali adattörlést. [Adatrezidencia](https://modal.com/docs/guide/data-residency), [megőrzés](https://modal.com/docs/guide/security), [DPA](https://modal.com/legal/dpa) |
| **OpenCode / Anomaly Innovations, Inc.**, és az adott modell szolgáltatója | Az eredeti képek, megjegyzések, adag- és étkezési körülmények alapján strukturált elemzés; jelenleg Google-modell | Az inference-termékre és a Google modelloldali kezelésére vonatkozó hely, megőrzés, felhasználási korlát és adattovábbítási lánc nem igazolt teljesen. [Feltételek](https://opencode.ai/legal/terms-of-service), [Trust Center](https://trust.opencode.ai/) |
| **Google** | Google-belépés, fiókadatok átadása; a profilkép böngészős betöltésekor hálózati adatok; külön az üzemeltető Gmail-levelezése | A belépési/fiókszolgáltatásnál jellemzően önálló adatkezelő, nem azonos a modellfeldolgozási szereppel. [Adatvédelmi irányelvek](https://policies.google.com/privacy), [OIDC](https://developers.google.com/identity/openid-connect/openid-connect) |
| **GitHub Pages / GitHub** | A jelenlegi Google-belépés statikus közvetítőoldala: IP-cím, technikai kérésadatok, ideiglenes OAuth-válaszparaméterek | A Google-kód beváltása az alkalmazásszerveren történik. A GitHub saját biztonsági IP-naplózást végezhet. [Pages adatgyűjtés](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [adatvédelem](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) |
| **USDA FoodData Central** | Tápértékkeresés: ételkeresési kifejezés és szerveroldali hálózati adatok | Szándékoltan nem küldünk felhasználói fiókazonosítót vagy képet. A szabad keresőkifejezés tartalmazhat személyes adatot; kérjük, ilyet ne adj meg. [API](https://fdc.nal.usda.gov/api-guide) |
| **Health Canada CNF, svéd Livsmedelsverket, norvég Matvaretabellen, Open Food Facts** | Nyilvános étel-/tápértékadatok szerveroldali lekérése, OFF esetén a felismert vonalkód alapján | Az adat-API-k nem kapnak ételfotót, felhasználói fiókazonosítót vagy a beírt megjegyzést. A szerver hálózati adatait és a lekért rekordazonosítót/vonalkódot látják. Az adatok helyi gyorsítótárba kerülhetnek. |

A DB-IP országadatbázis **helyben** fut: a látogató IP-címét nem továbbítjuk a DB-IP részére egyedi országfelismerési kérésként. Külső Umami-követőkód nincs. Nincs hirdetési értékesítés vagy felhasználói naplók nyilvános közzététele az alkalmazásban.

Az üzemeltető megerősítette a Northflank, Cloudinary, Modal és OpenCode DPA-k elfogadását. Ez nem helyettesíti annak ellenőrzését, hogy az elfogadott szerződés ténylegesen lefedi-e ezt a fiókot, terméket, érzékeny adatkezelést és továbbítási láncot.

## 7. EGT-n kívüli továbbítás

Az Egyesült Királyság az EGT-n kívül van. A megfelelő hatályú uniós megfelelőségi határozat alapján ide történhet továbbítás; a vizsgálatkor irányadó megújítás a [2025/2574 bizottsági határozat](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ%3AL_202502574).

Amerikai vagy más, nem megfelelőnek elismert országba irányuló adatkezelésnél a konkrét címzett és kezelés szerint megfelelő garancia szükséges, például alkalmazható általános szerződési feltételek, továbbítási hatásvizsgálat és kiegészítő intézkedések. Az EU–US Data Privacy Framework csak érvényesen tanúsított szervezetre és a tanúsítás által lefedett adatkezelésre alkalmazható. Nem állítjuk, hogy minden amerikai szolgáltatóra automatikusan kiterjed.

A konkrét szerződéses garanciák végleges leírása még hiányzik. Az alkalmazandó garanciákról és hozzáférhető másolatukról az adatvédelmi e-mail-címen kérhető tájékoztatás, mások jogainak és a védendő üzleti adatoknak a tiszteletben tartásával. A hozzájárulás nem használható a rendszeres szolgáltatói továbbítások általános pótlólagos jogalapjaként.

## 8. Megőrzés és törlés

| Adat | Jelenlegi működés |
| --- | --- |
| Fiók, napló, képek | Nincs automatikus inaktivitási lejárat. Az étkezés a felületen törölhető; teljes fióktörléshez jelenleg az üzemeltetőt kell megkeresni. |
| Étkezéshez tartozó Cloudinary-kép | A törléshez szolgáltatói törlési és gyorsítótár-érvénytelenítési kérés tartozik. Sikertelen törlésnél újrapróbálkozás szükséges; ez nem minden másolat azonnali fizikai megsemmisítése. |
| AI-válaszarchívum, költségrekord, működési és adminnapló | Jelenleg nincs általános automatikus lejárat. **Az étkezés törlése önmagában nem törli a kapcsolódó AI-archívumot.** Ez rendezendő hiányosság, nem korlátlan megőrzési jogosultság. |
| Heti aktivitás és jutalom | Az étkezés utólagos törlése nem vonja vissza automatikusan a már megszerzett heti teljesítést. Fiókszintű törlésnél ezt az adatot is vizsgálni kell. |
| Munkamenet | Legfeljebb 30 napos érvényesség, kijelentkezéskor az aktuális szerveroldali munkamenet törlődik. Lejárt rekordok tisztítása sikeres belépéskor történik. |
| OAuth-állapot | 10 perces érvényesség, felhasználáskor egyszer használatos törlés; a lejárt, fel nem használt rekordokat további belépési műveletek tisztítják. |
| Kéréskorlátozás | Rövid, jellemzően 1 vagy 10 perces érvényesség; a lejárt rekordokat további kérések tisztítják. |
| Összesített látogatásszámok | 400 napos ablak; tisztítás új méréskor és jelentéskéréskor, nem külön időzített feladatként. |
| Adatbázismentés | A jelenlegi mentési ütemezésben hét napos megőrzés. Törölt adat átmenetileg visszaállítható mentésben maradhat; visszaállításkor a korábbi törléseket ismét érvényesíteni kell. |

Az [eljárásrendben](GDPR-OPERATIONS.md) szereplő további időtartamok **javaslatok**, nem már beállított határidők. A szolgáltatók saját megőrzése eltérhet az alkalmazásétól; különösen az AI-szolgáltatói lánc pontosítása szükséges. Jogi igény miatt kizárólag az adott igényhez szükséges adatok, elkülönítetten és indokolt ideig tarthatók meg; ez nem indokolja minden ételfotó vagy napló általános többéves megőrzését.

## 9. Sütik, országfelismerés és látogatottság

| Saját süti HTTPS-en | Cél | Élettartam |
| --- | --- | --- |
| `__Host-yumetrics_session` | Bejelentkezett munkamenet; HttpOnly, Secure, SameSite=Lax | 30 nap |
| `__Host-yumetrics_oauth` | A belépési kérés és válasz összerendelése; HttpOnly, Secure, SameSite=Lax | 10 perc |
| `yumetrics_language` | Magyar/angol nyelv megjegyzése; nem hitelesítési token | 365 nap |

A nyelvi süti az első nyelvbeállításkor is létrejön. Magyarországról magyar, más vagy ismeretlen országból angol az alapnyelv; ezt kézzel felülírhatod. Pontos helyet vagy GPS-koordinátát nem kérünk ehhez. A szükséges belépési sütik és a preferenciát tároló süti jogi értékelését külön kell kezelni; a sütimentes mérésre sem állítható általánosan, hogy adatvédelmi szabályok nem vonatkoznak rá.

A szerver a kijelölt oldalak megnyitásakor az IP-címből országot, a fejlécekből eszköz-, böngésző-, operációsrendszer-, forráscsoport- és nyelvi adatot képez, majd napi összesített számlálókat tárol. Nem készít egyedi látogatói azonosítót, teljes látogatói útvonalat vagy nyers IP-/User-Agent-/referrer-adatsort a látogatottsági táblában. A DNT=1 és GPC=1 jelzést küldő kéréseket a mérés kihagyja. Az IP-cím köztes kezelése, a kapcsolódó platformnaplók és a kis elemszámú csoportok miatt nem állítjuk, hogy minden kapcsolódó adat eleve anonim. A biztonsági korlátozás hash-elt hálózati kulcsa is lehet álneves személyes adat.

## 10. AI, emberi ellenőrzés és fejlesztési felhasználás

Az AI ételt azonosít és mennyiséget becsül; a program ezekből és a megfelelő adatforrásokból tápértéket számol. Az alapértelmezett Gemini-elemzés után erősen bizonytalan ételazonosságnál a Food-R1 további, ellenőrizendő névjavaslatokat adhat. Ezek nem írják át automatikusan az ételt, a mennyiséget vagy a tápértéket. Több modell használata nem bizonyít önmagában nagyobb pontosságot. Az eredményt a felhasználó javíthatja és jóváhagyhatja; az eredeti elemzés és a legutóbbi javítás is megmaradhat.

A válaszarchívum ismert titkokat és képbájtokat szűr, nem általános személyesadat-anonimizáló. Az adminisztrátor hozzáférhet a naplóhoz, a védett képekhez, válaszokhoz és javításokhoz a feladataihoz szükséges körben; az alkalmazás ezt technikailag lehetővé teszi. A hozzáférés célhoz kötöttségét az üzemeltetésben is biztosítani kell.

Az alkalmazás nem végez automatikus modell-finomhangolást a naplóadatokból. A külső szolgáltatók esetleges saját fejlesztési felhasználása külön szerződéses kérdés: az OpenCode nyilvános feltételei bizonyos ingyenes használatnál ezt megengedhetik, a harmadik fél modelljére pedig saját megőrzési szabályok vonatkozhatnak. A fiókra érvényes kizárás vagy korlátozás még igazolandó.

Nincs az alkalmazásban olyan kizárólag automatizált döntés, amely hitelt, biztosítást, ellátást vagy más jogot állapít meg. Van automatizált elemzés és aktivitásértékelés; ezek tévedhetnek. A GDPR 22. cikke szerinti jogi vagy hasonlóan jelentős hatású döntés bevezetése új jogi vizsgálatot igényelne.

## 11. Mely adatok szükségesek?

A jelenlegi fiókos működéshez Google-belépés kell. A képelemzéshez legalább egy kép szükséges; a második kép, megjegyzés, mért tömeg és több kiegészítés opcionális. Ezek nélkül az eredmény bizonytalanabb lehet. A későbbi összehasonlítási célú megőrzést úgy kell elkülöníteni, hogy elutasítása ne zárja ki a szükséges naplófunkciót. Az érzékeny adatok kezeléséhez szükséges hozzájárulás elmaradásának vagy visszavonásának következményeit a bevezetendő felületen külön ismertetni kell; ehhez megfelelően korlátozott alternatívát is vizsgálni kell.

## 12. Adatbiztonság

HTTPS, szerveroldali jogosultság-ellenőrzés, hash-elt munkamenetek, paraméterezett adatbázis-lekérdezések, feltöltésellenőrzés és hozzáféréshez kötött képkiszolgálás védi az adatokat. A képek nem általánosan nyilvános hivatkozással érhetők el. E felsorolás nem teljes körű biztonsági tanúsítás; kockázatmentesség és az összes szolgáltatónál igazolt, azonos titkosítási mód nem garantálható. Szükséges az adminfiókok védelme, a titkok kezelése, a jogosultságok felülvizsgálata és az incidensek dokumentált kezelése is.

## 13. Milyen jogaid vannak?

A GDPR feltételei szerint kérhetsz hozzáférést és másolatot, helyesbítést, törlést, korlátozást, valamint a hozzájáruláson vagy szerződésen alapuló, automatizáltan kezelt, általad rendelkezésre bocsátott adatok hordozható másolatát. Jogos érdeken alapuló kezelés ellen a saját helyzeteddel kapcsolatos okból tiltakozhatsz. Hozzájárulásodat bármikor visszavonhatod; ez a korábbi kezelés jogszerűségét nem érinti. A jogoknak lehetnek törvényi korlátai, amelyeket egyedileg meg kell indokolni.

Írj a **thisisnotka@gmail.com** címre; nem szükséges jogszabályhelyet idézned vagy külön űrlapot használnod. Jelenleg nincs önkiszolgáló teljes fióktörlés vagy adatexport. A felületi hiány nem szünteti meg a jogaidat. Kétség esetén csak az azonosításhoz arányosan szükséges kiegészítő adat kérhető, nem automatikusan okmánymásolat.

Indokolatlan késedelem nélkül, főszabály szerint **egy naptári hónapon belül** választ kell kapnod. Összetett vagy nagyszámú kérelmeknél legfeljebb további két hónapos hosszabbítás lehetséges; erről és az okáról az első hónapon belül értesítést kell küldeni. Az eljárás főszabály szerint díjmentes. Az elutasítást, a kivételes díjat és a jogorvoslatot meg kell indokolni. A részleteket a [NAIH érintetti tájékoztatója](https://naih.hu/erintetti-jogok) ismerteti.

## 14. Panasz és jogorvoslat

Közvetlen megkeresésünk nem előfeltétele a hatósági panasznak. Magyarországon a **Nemzeti Adatvédelmi és Információszabadság Hatóság**, 1055 Budapest, Falk Miksa utca 9–11. jár el; honlap: [naih.hu](https://naih.hu/), ügyfélszolgálati e-mail: ugyfelszolgalat@naih.hu. A hivatalos eljárás megindításának aktuális módját a [NAIH kapcsolati és ügyintézési tájékoztatója](https://naih.hu/ugyfelszolgalat-kapcsolat?width=fixed) szerint válaszd; a sima ügyfélszolgálati e-mail nem feltétlenül indít hatósági eljárást. A GDPR szerint a szokásos tartózkodási hely, munkahely vagy feltételezett jogsértés szerinti illetékes felügyeleti hatósághoz is fordulhatsz, és bírósági jogorvoslatot is kérhetsz.

## 15. Változások és felelősség

Új cél, szolgáltató, lényeges megőrzési változás vagy új érzékeny adatkezelés előtt a tájékoztatót és szükség szerint a hozzájárulást frissíteni kell. Új hozzájárulási célt nem tesz elfogadottá önmagában a weboldal további használata.

Az AI eredménye becslés, nem orvosi tanács vagy mérési bizonyítvány; ennek használati feltételeit [külön dokumentum](TERMS-HU.md) rendezi. Ez a figyelmeztetés nem korlátozza az adatvédelmi jogaidat, a hatóság hatáskörét vagy az adatkezelő jogszabályban előírt felelősségét, ideértve a GDPR 82. cikke szerinti kártérítési jogot.

**A felhasználási feltételek a jogszabály által megengedett legteljesebb mértékben kizárják Kovács Ákos fejlesztő és üzemeltető felelősségét az alkalmazás használatából eredő károkért. Ez nem terjed ki a ki nem zárható felelősségre, és nem jelent lemondást az adatvédelmi jogaidról.**
