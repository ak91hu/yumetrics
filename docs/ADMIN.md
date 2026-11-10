# Tulajdonosi adminfelület

Az `/admin` magyar nyelvű kezelőfelület. A napló felső menüsávjának Adminisztráció pontjából és a Fiókom ablakából is megnyithatod, ha a Google által ellenőrzött `thisisnotka@gmail.com` fiókkal jelentkeztél be. A megjelenített név önmagában nem jogosít hozzáférésre.

A szerver minden adminisztrációs kérésnél a munkamenethez tartozó, adatbázisból visszaolvasott fiókot ellenőrzi. Bejelentkezés nélkül 401-es, más Google-fiókkal 403-as választ ad; a védelem a HTML-oldalra és az API-ra is kiterjed. A kliensoldali profil vagy a kérés fejléceinek módosításával nem lehet adminisztrátori jogosultságot szerezni.

## Mit találsz az egyes nézetekben?

| Nézet | Lehetőségek |
| --- | --- |
| Látogatottság | Oldalmegnyitások napi és óránkénti grafikonja; ország-, forrás-, oldal-, eszköz-, böngésző-, operációsrendszer- és alapnyelvi bontás. 7, 30 vagy 365 nap választható; a teljes bontások darabszámai és arányai táblázatban is megnyithatók. |
| Áttekintés | 7, 30 vagy 365 nap adatai; felhasználók, aktív naplózók, mentett étkezések, becsült AI-költség és feldolgozások. A napi bejegyzések és regisztrációk alakulását vonalgrafikon, az állapotokat és étkezéstípusokat oszlopok szemléltetik. |
| Felhasználók | Keresés, lapozás, a napi energiakeret módosítása, hozzáférés tiltása vagy visszaállítása, valamint kijelentkeztetés minden eszközről. A felhasználó bejegyzései innen külön is megnyithatók. |
| Étkezések | Szűrés felhasználó és állapot szerint; fotók, összetevők, számított értékek, eredeti és javított elemzések, valamint használati adatok megtekintése. |
| AI-használat és költségek | Napi költséggrafikon, modellenkénti és hívásonkénti bontás. A felület jelzi, hány hívás költsége számítható ki, és hol hiányzik adat. |
| AI-válaszok és összehasonlítás | Időszak, modell, állapot és válaszszöveg szerinti keresés. Az egy étkezéshez tartozó hívások, az eredeti válasz és a jóváhagyott javítás összevetése; JSON-export. |
| Feldolgozások | Elemzések és törlések állapota, próbálkozások száma, hibák és a futó feladat foglalásának lejárata. |
| Működési napló | Indulások, belépések, kijelentkezések és feldolgozási események. Időszak, súlyosság és szöveg szerint szűrhető. |
| Beállítások | Látogatottságmérés be- és kikapcsolása, új elemzések és csatlakozások engedélyezése, elemzési korlátok, az új fiókok napi energiakerete, AI-modell, válaszhossz és várakozási idő. |
| Módosítási előzmények | A beállítások és fiókok módosításai: végrehajtó, időpont, érintett adat, korábbi és új érték. A kijelentkeztetéseket is rögzítjük. |

A menü három csoportba rendeződik: Áttekintés, Napi kezelés, Beállítások és előzmények. Asztali nézetben az oldalsáv görgetés közben is elérhető; mobilon az Adminoldal választómezőből nyithatod meg a nézeteket. Az aktív oldal jelölést kap. Az áttekintés gyorshivatkozást ad az AI-válaszokhoz, költségekhez és sikertelen feldolgozásokhoz.

Az időszak- és állapotszűrő azonnal frissít. A Szűrők törlése gomb visszaállítja az adott nézet alapbeállításait és első oldalát. A táblázatok vízszintesen és szükség esetén függőlegesen görgethetők; fejlécük látható marad. A grafikonok értékei táblázatként is megnyithatók. A működési beállítások külön hozzáférési/adatgyűjtési, használati korlát és AI-elemzési csoportban szerepelnek; csak a Beállítások mentése gomb véglegesít.

## A módosítások hatása

A felhasználó letiltásakor megőrizzük a naplóját, de visszavonjuk a munkameneteit, és az új belépést is elutasítjuk. A tulajdonosi fiók ezen a felületen nem tiltható le. Az étkezések adatai az adminban megtekinthetők; a javítás, a törlés és a szolgáltatói költséggel járó újrapróbálás a bejegyzés tulajdonosának naplójából indítható.

A beállítások módosítását és naplózását egyetlen adatbázis-tranzakcióban végezzük. Ha egy másik ablak közben már mentette az alkalmazásbeállításokat, a régi változat mentése 409-es választ kap: az újabb adatokat nem írjuk felül.

Az óránkénti és napi korlátokat a feltöltésnél és a kézi újrapróbálásnál is érvényesítjük, PostgreSQL-en felhasználónkénti zárolással. A napi korlát nem lehet kisebb az óránkéntinél. Az AI-beállításokat minden új elemzés előtt visszaolvassuk. Az elemzések szüneteltetése az új beküldéseket tiltja; az elfogadott feladatokat és a törléseket nem szakítja meg. Ha az új felhasználók csatlakozását kapcsolod ki, a meglévő fiókok és a tulajdonos továbbra is beléphetnek. Az alapértelmezett energiakeret módosítása csak az ezután létrehozott fiókokra vonatkozik.

## Szolgáltatói beállítások és adatok

Az API-kulcsokat, az OAuth-hitelesítési adatokat, az adatbázis-kapcsolatot és a domaineket továbbra is Northflanken kell kezelni. Az adminfelület hivatkozást ad hozzá; a titkos értékeket nem küldi a böngészőnek, és nem írja a változásnaplóba. A kapcsolati jelzések a szükséges beállítások meglétét mutatják, nem a kulcsok érvényességét vagy a szolgáltatói egyenleget. Ezeket az adatokat az átlagos felhasználó nem kapja meg.

A bejegyzésstatisztikák az UTC szerinti létrehozási napra vonatkoznak, nem a felhasználó által módosítható étkezési dátumra. A látogatottság a tényleges oldalmegnyitás UTC szerinti napját és óráját használja. A költségbecslés részletes módszere, forrásai és korlátai az [AI-COSTS.md](AI-COSTS.md) dokumentumban olvashatók.

## A beépített látogatottságmérés

Nincs külön analitikai szolgáltatás, előfizetés, külső mérőkód vagy eseményenkénti szolgáltatói díj. A mérés a meglévő Node-szerver és PostgreSQL erőforrásait használja; a meglévő tárhely költsége ettől nem szűnik meg. Az Umami vagy más mérőszolgáltatás elérhetőségétől nem függ.

A sikeresen kiszolgált belépőoldalt, naplót és két nyelvű útmutatót számoljuk, ha a böngésző oldalnavigációnak jelzi a kérést. Az újratöltés új megnyitás. Az API-k, képek és más fájlok lekérése, a naplón belüli nézetváltás és a fotófeltöltés nem oldalmegnyitás. A tulajdonos bejelentkezett forgalma, az ismert robotok és előtöltések kimaradnak. `DNT: 1` vagy `Sec-GPC: 1` mellett nem rögzítünk látogatottsági számlálót. A hiányos vagy hamis böngészőfejlécek, a hálózati környezet és a nem felismert robotok torzíthatják a mérést.

**Nem egyedilátogató-szám:** nincs látogatói azonosító, új mérési süti, böngésző-ujjlenyomat vagy munkamenetkövetés. Oldalon töltött időt és visszafordulási arányt sem állítunk elő belőle. A regisztrált felhasználók és aktív naplózók adatai a külön alkalmazásstatisztikában maradnak.

Nap és bontási kategória szerint csak összesített számlálók kerülnek a `visitor_stats` táblába. Nyers IP-cím, teljes User-Agent, teljes hivatkozási cím, URL-paraméter, felhasználó- vagy munkamenetazonosító, fotó és étkezési tartalom nem szerepel benne. A bontások külön számlálók, nem kapcsolhatók össze látogatói profilokká. Az ország a helyi DB-IP-adatbázis becslése. A böngésző és az eszköz típusa a kérésből becsült kategória. A forrás ismert kereső vagy közösségi oldal, saját oldal, egyéb külső oldal, illetve közvetlen/nem ismert kategória lehet. A hiányzó hivatkozó nem bizonyít közvetlen érkezést.

A **Beállítások → Látogatottság mérése** kapcsoló a következő oldalmegnyitástól hat. Kikapcsolása megőrzi a korábbi számlálókat, és a módosítás bekerül a változásnaplóba. Új megnyitás vagy a látogatottsági nézet betöltése törli a 400 napos megőrzési ablakon kívüli sorokat. Ha nincs megnyitás és az admin sem töltődik be, a takarítás a következő ilyen műveletkor fut le. A mérés bekötése előtti forgalom nem állítható elő utólag. A rögzített napi adat nélküli pontokat a grafikon hiányzó adatként mutatja, nem bizonyított nulla forgalomként.

A számlálók egyetlen adatbázis-műveletben növekednek; az admin összesítése és bontásai közös lekérdezési pillanatképből készülnek, párhuzamos megnyitások mellett is. A mérés tárolási hibája nem alakítja hibaválasszá a sikeresen elkészült oldalt. Migrációk: PostgreSQL `0005_visitors`, SQLite `0007_visitors`.

Az alkalmazásbeállítások az `app_settings`, a módosítási előzmények az `admin_audit`, az AI-hívások az `ai_requests`, a működési napló eseményei az `app_logs` táblába kerülnek. A szükséges PostgreSQL-migrációk: `0002_admin` és `0003_telemetry`; a SQLite-változatok: `0004_admin` és `0005_telemetry`. Induláskor a meglévő, zárolt migrációs folyamat futtatja őket, a mentett étkezések átírása nélkül.

## AI-válaszarchívum

Az `/admin#ai-responses` kizárólag a tulajdonosi Google-fiókból érhető el. A listában csak rövid hívásadatok szerepelnek; a válaszszöveg megnyitáskor töltődik be. Az egy étkezéshez tartozó legfeljebb tíz hívás együtt látható, JSON-fájlba is menthető. A szöveg egyszerű, HTML-ként nem értelmezett tartalomként jelenik meg.

Az `ai_requests` új mezői a következők:

| Mező | Tartalom |
| --- | --- |
| `request_meta` | Szolgáltató, promptverzió és -lenyomat, sémalenyomat, válaszhosszkorlát, nyelv, elemzési beállítások, ételnévjavaslatok és a bemeneti képek SHA-256-lenyomata. A szabad megjegyzésből csak lenyomat készül. |
| `response_text` | A szolgáltató nyilvános válaszszövege, a felismert titkok és képadatok eltávolítása után. A hibás JSON-választ is megőrizzük. |
| `response_meta` | Válaszazonosító, modellverzió, befejezési ok, válaszlenyomat és a rendelkezésre álló Modal-revízió, promptverzió, generálási és időzítési adatok. |
| `response_truncated` | Méretkorlát, megszakadt olvasás vagy a szolgáltató által jelzett csonkolás. |
| `result_analysis` | Az OpenCode-válasz alkalmazás által ellenőrzött, feldolgozott eredménye. |
| `reviewed_analysis`, `reviewed_at`, `reviewed_revision` | A legutóbbi sikeresen mentett felhasználói változat, időpontja és verziószáma. Ütköző mentés nem írja át. |

Válaszonként legfeljebb 64 KiB szöveget őrzünk meg; a hálózati válasz olvasása 1 MiB-ra korlátozott. Belső gondolatmenet, képfájl, teljes HTTP-kérés, hitelesítési fejléc vagy hozzáférési kulcs nem része az archívumnak. Hálózati hiba esetén válaszszöveg helyett a hiba ténye marad meg. A szűrés nem garantálja a szövegek teljes anonimitását: az elemzés tartalmazhat felhasználói adatot, ezért megosztás előtt az exportot át kell nézni.

A rekordok az adatbázisban maradnak, újraindítás, újratelepítés és étkezéstörlés után is; automatikus archiválási lejárat jelenleg nincs. A tárhelyigény a forgalommal nő, és az archívumról is az adatbázis mentési rendje szerint kell gondoskodni. Az üzemeltetőnek a saját adatkezelési tájékoztatójában is rendeznie kell a megőrzést és a törlési kérelmeket. Az étkezés törlése az archivált válasz vagy javítás törlését nem jelenti.

A gyűjtés a kiadás után érkező válaszokra terjed ki, régi nyers szöveg nem állítható elő utólag. A jóváhagyott javítás nem feltétlenül helyes, lemért referencia; összehasonlításhoz és további mérési esetek kiválasztásához használható. Nincs automatikus modelltréning vagy új, fizetős ellenőrző hívás. Migrációk: PostgreSQL `0007_ai_archive`, SQLite `0009_ai_archive`.

## Ellenőrzés

A tesztsor a `npm test` paranccsal fut. A PostgreSQL-próbákhoz a `TEST_DATABASE_URL`, az adminpróbákhoz külön, `_admin_test` végű adatbázis címe szükséges a `TEST_ADMIN_DATABASE_URL` változóban. Az adminpróbák a saját tesztadatbázisuk alkalmazásbeállításait visszaállítják; éles adatbázison nem futtathatók.

A `scripts/browser-check.mjs` teszt-Google-belépéssel ellenőrzi a napló és az admin működését, a mentéseket, jelvényeket és grafikonokat, öt képernyőszélességen. A magyar szövegek szerkesztési elvei: [LANGUAGE.md](LANGUAGE.md).

## Képek és visszaélések elleni védelem

Az ételfotókhoz az alkalmazáson keresztül csak a bejegyzés tulajdonosa és az admin fér hozzá. A képtárban is védett tárolási típust használunk. A munkamenet visszavonása a képek újabb lekérését is megakadályozza. A belépés, a feltöltés és az élelmiszer-adatlekérés külön kéréskorlátot kapott; ezek a szerveroldali biztonsági korlátok nem kapcsolhatók ki az adminból. A működés és az ellenőrzés részletei: [biztonsági audit](SECURITY-AUDIT-2026-11-09.md).
