# Tulajdonosi adminfelület

Az `/admin` magyar nyelvű kezelőfelület. A napló Fiókom ablakából is megnyithatod, ha a Google által ellenőrzött `thisisnotka@gmail.com` fiókkal jelentkeztél be. A megjelenített név önmagában nem jogosít hozzáférésre.

A szerver minden adminisztrációs kérésnél a munkamenethez tartozó, adatbázisból visszaolvasott fiókot ellenőrzi. Bejelentkezés nélkül 401-es, más Google-fiókkal 403-as választ ad; a védelem a HTML-oldalra és az API-ra is kiterjed. A kliensoldali profil vagy a kérés fejléceinek módosításával nem lehet adminisztrátori jogosultságot szerezni.

## Mit találsz az egyes nézetekben?

| Nézet | Lehetőségek |
| --- | --- |
| Áttekintés | 7, 30 vagy 365 nap adatai; felhasználók, aktív naplózók, mentett étkezések, becsült AI-költség és feldolgozások. A napi bejegyzések és regisztrációk alakulását vonalgrafikon, az állapotokat és étkezéstípusokat oszlopok szemléltetik. |
| Felhasználók | Keresés, lapozás, a napi energiakeret módosítása, hozzáférés tiltása vagy visszaállítása, valamint kijelentkeztetés minden eszközről. A felhasználó bejegyzései innen külön is megnyithatók. |
| Étkezések | Szűrés felhasználó és állapot szerint; fotók, összetevők, számított értékek, eredeti és javított elemzések, valamint használati adatok megtekintése. |
| AI-használat és költségek | Napi költséggrafikon, modellenkénti és hívásonkénti bontás. A felület jelzi, hány hívás költsége számítható ki, és hol hiányzik adat. |
| Feldolgozások | Elemzések és törlések állapota, próbálkozások száma, hibák és a futó feladat foglalásának lejárata. |
| Működési napló | Indulások, belépések, kijelentkezések és feldolgozási események. Időszak, súlyosság és szöveg szerint szűrhető. |
| Beállítások | Új elemzések és csatlakozások engedélyezése, elemzési korlátok, az új fiókok napi energiakerete, AI-modell, válaszhossz és várakozási idő. |
| Módosítási előzmények | A beállítások és fiókok módosításai: végrehajtó, időpont, érintett adat, korábbi és új érték. A kijelentkeztetéseket is rögzítjük. |

Mobilon a teljes menü több sorban látható. Az időszak- és állapotszűrő módosítása azonnal frissíti a nézetet. A széles táblázatokat oldalirányban görgetheted; a grafikonok napi értékeit táblázatként is megnyithatod.

## A módosítások hatása

A felhasználó letiltásakor megőrizzük a naplóját, de visszavonjuk a munkameneteit, és az új belépést is elutasítjuk. A tulajdonosi fiók ezen a felületen nem tiltható le. Az étkezések adatai az adminban megtekinthetők; a javítás, a törlés és a szolgáltatói költséggel járó újrapróbálás a bejegyzés tulajdonosának naplójából indítható.

A beállítások módosítását és naplózását egyetlen adatbázis-tranzakcióban végezzük. Ha egy másik ablak közben már mentette az alkalmazásbeállításokat, a régi változat mentése 409-es választ kap: az újabb adatokat nem írjuk felül.

Az óránkénti és napi korlátokat a feltöltésnél és a kézi újrapróbálásnál is érvényesítjük, PostgreSQL-en felhasználónkénti zárolással. A napi korlát nem lehet kisebb az óránkéntinél. Az AI-beállításokat minden új elemzés előtt visszaolvassuk. Az elemzések szüneteltetése az új beküldéseket tiltja; az elfogadott feladatokat és a törléseket nem szakítja meg. Ha az új felhasználók csatlakozását kapcsolod ki, a meglévő fiókok és a tulajdonos továbbra is beléphetnek. Az alapértelmezett energiakeret módosítása csak az ezután létrehozott fiókokra vonatkozik.

## Szolgáltatói beállítások és adatok

Az API-kulcsokat, az OAuth-hitelesítési adatokat, az adatbázis-kapcsolatot és a domaineket továbbra is Northflanken kell kezelni. Az adminfelület hivatkozást ad hozzá; a titkos értékeket nem küldi a böngészőnek, és nem írja a változásnaplóba. A kapcsolati jelzések a szükséges beállítások meglétét mutatják, nem a kulcsok érvényességét vagy a szolgáltatói egyenleget. Ezeket az adatokat az átlagos felhasználó nem kapja meg.

A statisztikák a bejegyzések UTC szerinti létrehozási napjára vonatkoznak, nem a felhasználó által módosítható étkezési dátumra. A költségbecslés részletes módszere, forrásai és korlátai az [AI-COSTS.md](AI-COSTS.md) dokumentumban olvashatók. Valódi látogatottsági adatokat nem gyűjtünk.

Az alkalmazásbeállítások az `app_settings`, a módosítási előzmények az `admin_audit`, az AI-hívások az `ai_requests`, a működési napló eseményei az `app_logs` táblába kerülnek. A szükséges PostgreSQL-migrációk: `0002_admin` és `0003_telemetry`; a SQLite-változatok: `0004_admin` és `0005_telemetry`. Induláskor a meglévő, zárolt migrációs folyamat futtatja őket, a mentett étkezések átírása nélkül.

## Ellenőrzés

A tesztsor a `npm test` paranccsal fut. A PostgreSQL-próbákhoz a `TEST_DATABASE_URL`, az adminpróbákhoz külön, `_admin_test` végű adatbázis címe szükséges a `TEST_ADMIN_DATABASE_URL` változóban. Az adminpróbák a saját tesztadatbázisuk alkalmazásbeállításait visszaállítják; éles adatbázison nem futtathatók.

A `scripts/browser-check.mjs` teszt-Google-belépéssel ellenőrzi a napló és az admin működését, a mentéseket, jelvényeket és grafikonokat, öt képernyőszélességen. A magyar szövegek szerkesztési elvei: [LANGUAGE.md](LANGUAGE.md).

## Képek és visszaélések elleni védelem

Az ételfotókhoz az alkalmazáson keresztül csak a bejegyzés tulajdonosa és az admin fér hozzá. A képtárban is védett tárolási típust használunk. A munkamenet visszavonása a képek újabb lekérését is megakadályozza. A belépés, a feltöltés és az élelmiszer-adatlekérés külön kéréskorlátot kapott; ezek a szerveroldali biztonsági korlátok nem kapcsolhatók ki az adminból. A működés és az ellenőrzés részletei: [biztonsági audit](SECURITY-AUDIT-2026-11-09.md).
