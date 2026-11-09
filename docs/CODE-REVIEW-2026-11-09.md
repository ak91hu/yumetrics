# Teljes kódellenőrzés és hibajavítás – 2026. november 9.

Az alkalmazás Google-belépéssel használható étkezési napló: két fotóból AI-elemzést készít, majd az ellenőrzött és javított összetevőket PostgreSQL-ben tárolja. A profil statisztikákat, jelvényeket és heti kihívásokat mutat; az adminfelület a használatot, látogatottságot, naplókat és AI-költségeket fogja össze.

A vizsgálat kiindulópontja a `8443a94` commit. Több párhuzamos felhasználóval, lassú vagy megszakadó hálózattal és az alkalmazás újraindításakor átfedő feldolgozókkal számoltunk. A feladatfoglalás időkorlátos adatbázis-bejegyzés: csak az azt birtokló feldolgozó indíthatja el az elemzést és mentheti az eredményét.

## Vizsgált kör

Átnéztük a szerver belépési pontját, valamennyi alkalmazásmodult, a böngészős kódot, az adatbázis-migrációkat, a teszteket, a buildet és a telepítési beállításokat. A fő adatútvonalakat végigkövettük: Google → munkamenet → tulajdonosi ellenőrzés; feltöltés → védett képtár → feladatfoglalás → AI → költségnapló; USDA/címke/recept → mennyiség és tápérték → mentés → profil és heti jutalom. A látogatottság adatbázisba írását, az admin jogosultságait, a módosítási előzményeket, az IP-alapú alapnyelvet és a magyar–angol felület kapcsolatát is vizsgáltuk.

A külső függőségeknél a rögzített verziókat és a tényleges `npm audit --omit=dev --json` eredményét ellenőriztük. Az audit nem jelzett ismert sérülékenységet. Ez nem helyettesíti a függőségek vagy a külső szolgáltatók önálló biztonsági auditját.

## Javítandó hibák – mind javítva

1. **P1 – A mentés válasza elveszíthette az időközben beírt adatokat** – [public/app.mjs](../public/app.mjs), `saveMeal`.
   - **Feladat:** Elmenti a szerkesztett étkezést, és frissíti a naplót.
   - **Hiba:** Csak a mentésgomb vált inaktívvá. Ha a felhasználó a válaszig tovább írt, a régebbi változat mentése bezárta az ablakot és törölte a nem mentett állapot jelzését; másik szerkesztőt is bezárhatott.
   - **Javítás:** A válasz a beküldött változathoz és annak szerkesztőjéhez tartozik. Az újabb módosítások megmaradnak, a mentési verziószám frissül, és értesítés jelzi, hogy ezek még mentésre várnak. Ugyanahhoz az étkezéshez egyszerre egy mentés indulhat.
   - **Javítás nélkül:** A felhasználó elveszíthette a mentés közben beírt javításait. A késleltetett böngészős próba a hibát kimutatta; a javítás után a következő mentés is sikeres.

2. **P1 – Késői USDA-válasz másik összetevőt módosíthatott** – [public/app.mjs](../public/app.mjs), összetevőkeresés és forrásválasztás.
   - **Feladat:** A kiválasztott USDA-rekordból tölti ki az adott összetevő tápértékeit.
   - **Hiba:** A válasz csak a sor sorszámát őrizte meg. A sor törlése után a helyére kerülő másik étel kapta meg a régi kérés adatait; az időközben kézzel javított értékeket is felülírhatta.
   - **Javítás:** A válasznak ugyanahhoz a nyitott szerkesztőhöz, élő eredménymezőhöz, legutóbbi kéréshez és változatlan összetevőhöz kell tartoznia. A megváltozott keresőkifejezés régi találatai sem kerülnek vissza.
   - **Javítás nélkül:** Másik étel tápértéke kerülhetett a naplóba. A böngészős teszt külön ellenőrzi a sor eltolódását és a kézi javítás megőrzését.

3. **P1 – Elvesztett feladatfoglalással is indulhatott fizetős AI-hívás** – [lib/jobs.mjs](../lib/jobs.mjs), `processNextJob`.
   - **Feladat:** Letölti a tárolt fotókat, majd elindítja és naplózza az elemzést.
   - **Hiba:** A fotóletöltés alatt lejárt vagy visszavont foglalás ellenére a régi feldolgozó továbbmehetett a fizetős kérésig. A későbbi eredménymentés ellenőrzése ezt a költséget már nem akadályozta meg.
   - **Javítás:** Közvetlenül az elemzés előtt közös tranzakció ellenőrzi és hosszabbítja meg a még érvényes foglalást, majd hozza létre a költségnapló sorát. A rendszeres hosszabbítás sem éleszthet újra lejárt foglalást.
   - **Javítás nélkül:** Fel nem használható elemzésért is fizetni kellett volna. SQLite-on és két PostgreSQL-kapcsolattal is ellenőriztük: lejárt vagy visszavont foglalásnál nulla AI-hívás és nulla új költségnapló-sor keletkezik.

4. **P1 – A törlés válasza bezárhatta az újranyitott szerkesztőt** – [public/app.mjs](../public/app.mjs), törlésmegerősítés.
   - **Feladat:** Törlést kér az eredetileg kiválasztott étkezéshez.
   - **Hiba:** A megerősítő ablak bezárása és egy szerkesztő újbóli megnyitása után a korábbi törlési válasz azt is bezárta, és törölte a nem mentett módosítások jelzését.
   - **Javítás:** A kérés megőrzi az étkezés azonosítóját és az eredeti szerkesztőt. Csak a hozzá tartozó ablakot zárhatja be; másik nézetbe érkező hibáját értesítés jelzi.
   - **Javítás nélkül:** Egy késői válasz az éppen végzett szerkesztést is megszakította volna. A vezérelt böngészős próba a javítás előtt elbukott, utána megőrzi az újranyitott ablakot és annak mezőit.

5. **P2 – Az energiakeret mentése eldobhatta az újabb értéket** – [public/app.mjs](../public/app.mjs), profilbeállítások.
   - **Feladat:** Menti a felhasználó napi energiakeretét.
   - **Hiba:** A válasz feltétel nélkül bezárta a beállításokat, akkor is, ha közben más szám került a mezőbe.
   - **Javítás:** A beküldött mezőértéket és az ablak megnyitásának változatát is ellenőrzi. Az újabb bevitel megmarad, a korábbi állapotlekérés pedig nem írhatja felül a már elfogadott keretet.
   - **Javítás nélkül:** A felhasználó nem tudhatta volna, hogy a legutóbb beírt szám még nincs elmentve. A késleltetett próba külön ellenőrzi a megtartást és az ezt követő sikeres mentést.

6. **P2 – A háttérben frissülő profil eltüntethette a kihívásválasztás eredményét** – [public/profile-ui.mjs](../public/profile-ui.mjs).
   - **Feladat:** Megjeleníti a választott heti kihívást és annak haladását.
   - **Hiba:** A profil olvasása és a kihívás írása ugyanazt a kérésverziót használta. Egy közben induló profilfrissítés miatt a sikeres választás válaszát a felület eldobta, és a választóűrlap maradhatott látható.
   - **Javítás:** A választás végéig a profilfrissítés vár; utána friss adatot kér. A küldés a felület újrarajzolása után is egyszeri marad.
   - **Javítás nélkül:** Az adatbázis már tárolta a választást, miközben a felhasználó újra választani próbált. A böngészős próba késleltetett választással és közben indított háttérfrissítéssel ellenőrzi ezt.

7. **P2 – Az ellentmondó USDA-szénhidrátból csendben nulla lett** – [lib/food-data.mjs](../lib/food-data.mjs), `foodRecord`.
   - **Feladat:** Az USDA összes szénhidrátjából és rostadatából kiszámítja a naplóban használt szénhidrátértéket.
   - **Hiba:** A `2 g` összes szénhidrát és `12 g` rost párosból a negatív különbséget nullára korlátozta, majd használható forrásként adta tovább.
   - **Javítás:** Az ilyen rekordot érthető, fordított 422-es hibaüzenettel elutasítja; másik találatot kell választani.
   - **Javítás nélkül:** Hiányos vagy hibás forrásból látszólag ellenőrzött nulla kerülhetett a számításba. A hibás rekordot külön teszt védi.

8. **P2 – Mentéskor nyers referencia maradhatott főtt ételhez** – [lib/domain.mjs](../lib/domain.mjs), `validateAnalysis`.
   - **Feladat:** Ellenőrzi a mentendő összetevő tápértékforrását.
   - **Hiba:** A mentési út csak az egyező számokat és a grammos egységet vizsgálta. A száraz rizs forrása kifejezetten elkészültnek jelölt összetevőn is ellenőrzöttként maradhatott meg, bár az AI-útvonal már védte ezt az eltérést.
   - **Javítás:** A közös ellenőrzés a katalógusban ismert elkészítési állapot kifejezett eltérését is felismeri. A számok javítható saját adatként megmaradnak, az ellenőrzött forrás és annak megerősítése megszűnik.
   - **Javítás nélkül:** Azonos számok mellett valótlan forrásjelölés maradhatott volna a mentésben. Teszt ellenőrzi az eltérő állapotokat és a helyes referencia megtartását; a régi, állapot nélküli bejegyzések kezelése megmarad.

9. **P2 – A tápanyagok közötti ellentmondások ellenőrzése nem minden forrásnál működött** – [lib/domain.mjs](../lib/domain.mjs), [lib/providers.mjs](../lib/providers.mjs).
   - **Feladat:** Kiszűri az összetevőn belül egymásnak ellentmondó tápértékeket.
   - **Hiba:** Az AI-nál és a címkéknél volt összefüggés-ellenőrzés, a kézi és egyes USDA-adatoknál csak az egyes mezők felső határa számított. Így `90 g` fehérje és `90 g` zsír is menthető volt 100 g ételhez, vagy a cukor a szénhidrátnál jóval nagyobb lehetett.
   - **Javítás:** Az ellenőrzés a közös validálóba került, a külön AI-ellenőrzés megszűnt. Megmaradnak a korábban használt kerekítési tűrések; a milliliteres mennyiséget továbbra sem tekintjük azonos grammos tömegnek.
   - **Javítás nélkül:** A forrásválasztás megkerülhette ugyanazt a számszerű ellenőrzést. A regressziós teszt mindhárom forrástípusra, a tápanyagtömegre, a cukorra, a telített zsírra és a ml-kivételre is kiterjed.

10. **P2 – A böngészős tesztek ideiglenes profiljai felhalmozódtak** – [scripts/browser-check.mjs](../scripts/browser-check.mjs).
    - **Feladat:** Elkülönített Chrome-profillal ellenőrzi az alkalmazást és képernyőképeket ment.
    - **Hiba:** A folyamat leállt, de a saját profilkönyvtára megmaradt. A sok korábbi futásból felhalmozódó fájlok a vizsgálat során ténylegesen megtöltötték a helyi lemezt, és egy angol próba `ENOSPC` hibával leállt.
    - **Javítás:** A teszt a böngésző kilépése után a saját, ellenőrzött helyű profilját is eltávolítja, siker és hiba esetén egyaránt. A képernyőképek és az eredményfájl megmaradnak; a takarítás hibája sikertelen teszteredményt ad.
    - **Javítás nélkül:** Az ismételt ellenőrzések tovább fogyasztották volna a lemezt. A helyhiány megszüntetéséhez kizárólag a régi tesztprofilok újra letölthető Chrome-modellfájljait töröltük; alkalmazás- és felhasználói adatot nem töröltünk.

## Ellenőrzés és korlátok

- **130/130 Node-teszt sikeres**, helyi PostgreSQL-lel, kihagyás nélkül. Az új szerveroldali regressziók a javítás előtt hibáztak; a teljes sor a javítás után sikeres.
- A magyar/mobil és angol/asztali Chrome-folyamat a mentést, keresést, törlést, energiakeretet és kihívásválasztást késleltetett válaszokkal is vizsgálja. Az ellenőrzött szélességek: 320, 390, 768, 1024 és 1440 px. Az összetevők, receptek, címkék, jutalmak, adminnézetek, grafikonok, naplók és súgók korábbi próbái is a sor részei.
- A build és a változtatások formai ellenőrzése külön fut. Nem került be új függőség, adatbázis-migráció vagy automatikus fizetős újrapróbálás. A tárolt étkezések és korábbi forrásrekordok nem kapnak utólag kitalált javítást; az új ellenőrzés a feldolgozási és mentési határon működik.
- Az AI-hívások a tesztekben helyettesített szolgáltatót használnak. Új fizetős képfelismerési pontosságmérés nem történt; annak korábbi eredménye és korlátai az [AI-ellenőrzésben](AI-VALIDATION-2026-11-09.md) olvashatók.
- Az AI-kérés előtti foglalásellenőrzés az igazolt elavult feldolgozást megállítja. Egy már elküldött külső kérés számlázását nem tudja visszavonni, és nem ígér szolgáltatókon átívelő, pontosan egyszeri végrehajtást.

**Értékelés:** a feltárt hibák javítva; a kiadás a teljes ellenőrzéssor után telepíthető. Nem azonosítottunk indokolható függőségtörlést vagy olyan szerkezeti átalakítást, amely ehhez a javításhoz szükséges lenne.

**Nem ellenőrzött:** külső behatolási teszt, tartós nagyterhelés, adatbázis-failover és mentésből visszaállítás; Firefox, Safari és képernyőolvasó. A fordítási katalógus és a statikus élelmiszer-adatok minden sorát nem szerkesztettük újra; a kapcsolataikat és a tesztelt invariánsokat vizsgáltuk.
