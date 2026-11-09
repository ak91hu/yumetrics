# Biztonsági audit és javítások

Időpont: 2026. november 9. Kiinduló változat: `e7ab9f5`.

Az ellenőrzés a Node-alkalmazás forráskódjára, az API-ra, a Google-belépésre, az adminjogosultságra, a fotók tárolására és kiszolgálására, a háttérfeladatokra, az adatbázis-lekérdezésekre, a böngészős megjelenítésre, a függőségekre és az éles futtatási környezetre terjedt ki. A talált hibákat javítottuk; az alábbi következtetéseket kódvizsgálat, automatizált próbák és egy ideiglenes képpel végzett valódi Cloudinary-próba támasztja alá.

## Javított találatok

| Súlyosság | Korábbi működés és kockázat | Javítás |
| --- | --- | --- |
| Magas | Az ételfotók nyilvános `upload` típusú Cloudinary-objektumok voltak. A közvetlen hivatkozás birtokában a kép a napló munkamenete nélkül is megnyitható volt. A nehezen kitalálható azonosító nem helyettesíti a hozzáférés ellenőrzését. | Az új képek `authenticated` típussal kerülnek a képtárba. A böngésző csak az alkalmazás saját képvégpontját kapja meg; az minden lekérésnél ellenőrzi a munkamenetet és a bejegyzés tulajdonosát, illetve az adminjogosultságot. Más felhasználó 404-et, névtelen látogató 401-et kap. A képtár aláírt hivatkozása a szerveren marad. A válasz nem gyorsítótárazható, és más eredetről nem ágyazható be. |
| Közepes | A névtelen belépésindítás új adatbázis-bejegyzést hozott létre minden alkalommal. A callback ismétlése naplóbejegyzéseket is termelhetett. Nem volt külön kéréskorlát. | A belépésindítás IP-címenként legfeljebb 20, a callback 60 kérés tíz perc alatt. A számlálók adatbázisban vannak, ezért több folyamat és újraindítás mellett is érvényesek. A kliens által szabadon megadható `X-Forwarded-For` fejléc nem befolyásolja a korlátot. |
| Közepes | A külső USDA-keresés és adatlekérés a bejelentkezett felhasználónak nem szabott külön sebességkorlátot. Egy fiók kimeríthette a közös szolgáltatói keretet. A feltöltés nagy törzsét a napi AI-korlát ellenőrzése előtt kellett beolvasni. | Fiókonként percenként legfeljebb 30 élelmiszer-adatlekérés, 12 feltöltésindítás és összesen 600 API-kérés engedélyezett. A feltöltési korlátot a törzs beolvasása előtt ellenőrizzük. A meglévő, tartós óránkénti/napi AI-költségkorlát megmarad. A visszautasított kérés 429-et és `Retry-After` fejlécet kap; nem indít szolgáltatói munkát. |
| Közepes | A nagy képfeltöltések egyidejű számát nem korlátoztuk. A méretkorlát külön-külön érvényesült, sok párhuzamos kérés viszont együtt kimeríthette a folyamat memóriáját. | Egy kiszolgálópéldányban legfeljebb két feltöltés futhat, fiókonként egy. Az új, védett képolvasásból legfeljebb tizenkettő futhat egyszerre. A foglalt hely a válasz elküldésekor vagy a kapcsolat lezárásakor felszabadul; túlterheléskor 429 és rövid újrapróbálási idő érkezik. |
| Közepes | Hibás HTTP-kéréscím és a Fetch API által tiltott metódus szerverhibát okozott. A névtelen kérés így 503-as választ és új adatbázis-hibanaplót válthatott ki, amit ismétléssel tárhelyterhelésre lehetett használni. | A hibás cím 400-as, a nem támogatott metódus 405-ös klienshiba. Ezek és a korlát túllépése nem készítenek szerverhibaként naplóbejegyzést. Az engedélyezett metódusokat az `Allow` fejléc közli. |

Az IP-címes számlálókhoz csak a célhoz kötött SHA-256-lenyomat kerül az adatbázisba, nyers IP-cím nem. A számláló lejár; a lejárt sorokat a következő korlátozott kérés törli. A fiókhoz kötött számlálók ugyanebben a táblában, külön célazonosítóval szerepelnek.

## A régi képek áttérése

A szerver induláskor a korábbi képeket is védett tárolásra állítja át. Az átnevezés megtartja a képet és az azonosítóját, felülírást nem enged, a korábbi CDN-másolatok érvénytelenítését pedig kéri a szolgáltatótól. Az adatbázis-frissítés feltételes, így nem ír felül közben megváltozott fotóadatot. Megszakadás után az áttérés folytatható: ha a kép már átkerült, de a helyi állapot mentése nem fejeződött be, a szerver ellenőrzi a védett példányt. A hiányzó, félbemaradt feltöltést hiányzóként őrzi meg; nem talál ki és nem töröl helyette képtartalmat. A háttérelemzés ugyanazt a védett képolvasást használja.

Az audit kezdetekor az éles adatbázisban **nem volt fotóbejegyzés**. Ez nem bizonyítja, hogy korábban sem osztottak meg képhivatkozást; az audit nem állapított meg adatvédelmi incidenst. Korábban letöltött másolatot nem lehet visszavonni. A CDN érvénytelenítése néhány másodperctől néhány percig tarthat. A tárolási mód és az áttérés alapja a [Cloudinary hozzáférés-kezelési dokumentációja](https://cloudinary.com/documentation/control_access_to_media) és a [rename API](https://cloudinary.com/documentation/image_upload_api_reference#rename_method).

## További megerősítések

- Az OpenCode-, Cloudinary- és USDA-kérések nem követnek HTTP-átirányítást. A rögzített szolgáltatói célról nem továbbítható más címre a fotó vagy az aláírt kérés.
- A képolvasás ellenőrzi a pontos HTTPS-gépnevet, a saját képtárat, az útvonalat és a képazonosítót; nem fogad el más portot, URL-ben megadott jelszót, keresési paramétert vagy idegen képtárat. A letöltés méretkorlátja megmaradt.
- A Cloudinary-válaszban kapott képaláírást eltávolítjuk a tárolt hivatkozásból. A kiszolgáláshoz szükséges aláírást a szerver számolja ki.
- A HTTP-fejlécekre 15, a teljes kérésre 60 másodperces várakozási határ érvényes; a fejlécek legfeljebb 16 KiB-osak lehetnek.
- A CSP már nem enged közvetlen Cloudinary-képet a felületen, az `object-src` tiltott. A böngészőablakokat `Cross-Origin-Opener-Policy: same-origin` választja el.

## Ellenőrzött, külön javítást nem igénylő területek

- A Google-belépés egyszer használható state-et, PKCE-t, nonce-ot, a hivatalos Google-könyvtár tokenellenőrzését, ellenőrzött e-mail-címet, valamint issuer- és audience-ellenőrzést használ. Az adminjogot a szerver az ellenőrzött tulajdonosi e-mail-címhez köti; névvel vagy kérésfejléccel nem szerezhető meg.
- A munkamenetek véletlen tokenjeinek csak a hash-e szerepel az adatbázisban. Éles HTTPS-en a süti `__Host-` előtagú, `Secure`, `HttpOnly`, `SameSite=Lax`, gyökérútvonalú. Lejárt vagy letiltott fiók munkamenetét nem fogadjuk el.
- Az étkezések API-lekérdezései és módosításai tulajdonoshoz kötöttek. Az író kérések idegen `Origin` és `Sec-Fetch-Site: cross-site` esetén elutasításra kerülnek. Az SQL-bemenetek kötött paraméterek; az útvonalszűrés rögzített fájllistát használ.
- A felhasználói, AI- és adminadatok HTML-be illesztése escape-eléssel vagy `textContent` használatával történik. Nem találtunk reprodukálható XSS-t, SQL-injekciót, útvonalbejárást vagy adminjogosultság-megkerülést.
- Az `npm audit --omit=dev` 38 függőségnél **0 ismert sérülékenységet** jelzett. A tényleges éles Node-verzió **24.22.2**, amely újabb a [2026. októberi javított 24.22.1 kiadásnál](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases). A futtatókörnyezetet ezért nem cseréltük régebbi verzióra.
- A jelenleg beállított valódi kulcsok és adatbázis-hozzáférés értékei nem szerepeltek a teljes Git-patchtörténetben. A követett környezeti fájlok között csak az üres mintafájl található. Ez a vizsgálat nem azonos minden korábban használt titok teljes körű felderítésével.

## Bizonyítékok és korlátok

A teljes tesztsor **109/109 sikeres**, valódi helyi PostgreSQL-lel, kihagyás nélkül. Tizenhárom új teszt fedi le a két adatbázissal ellenőrzött képhozzáférést és párhuzamos korlátozást, a letiltott munkamenetet, a megszakadt képmigráció folytatását, a hiányzó feltöltést, a képaláírás kezelését, az idegen képhivatkozások elutasítását, az OAuth-korlátot, a szolgáltatói munka előtti visszautasítást, a nagy kérések egyidejű számát és a hibás HTTP-kérések kezelését. A magyar/mobil és angol/asztali teljes böngészőfolyamat öt képernyőszélességen is sikeres. A valódi Cloudinary-próba védett feltöltést, aláírás nélküli elutasítást, szerveroldali olvasást, régi kép áttérését és az áttérés ismétlését ellenőrizte; a tesztképet mindkét tárolási típusból töröltük. Új AI-kérés nem indult.

A vizsgálat nem teljes külső behatolási teszt. Nem végeztünk terheléses/DDoS-próbát az éles oldalon, felhőfiók-szintű jogosultsági auditot vagy mentésből helyreállítási gyakorlatot. Sok külön fiókból vagy IP-címről indított elosztott támadás ellen további szolgáltatói hálózati és számlázási korlátokra is szükség lehet. A korlátokhoz közös PostgreSQL-adatbázis szükséges; az éles alkalmazás ezt használja.
