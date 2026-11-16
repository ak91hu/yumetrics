# Vasárnapi emailes heti jelentés

A Fiókom nézetben külön bekapcsolható, magyar vagy angol összesítő a Google-fiók emailcímére. A meglévő fiókok alapból nem kapnak levelet. Az előnézet bejelentkezés után elérhető, SMTP nélkül is. Nincs új AI-hívás: a mentett, javított összetevőkből számolunk.

## Tartalom és időszak

- Vasárnap 20:00, `Europe/Budapest`, a nyári időszámítást követve.
- Hétfő–vasárnap 20:00; a korábbi hét is ugyanilyen határig szerepel. A vasárnap 20:00 utáni étkezések nem részei az összesítőnek. A levél ezt és az adatlefedettséget külön jelzi.
- Napi kalóriák és az előző hét azonos napjai közös skálán; heti összes, naplózott napokra számolt napi átlag, különbség és százalékos változás.
- Naplózott napok és étkezések száma mindkét héten, napi energiakeret, makrotápanyag-átlagok és étkezéstípus szerinti energiagrafikon.
- A hiányzó nap nem nulla. Adat nélküli vagy nulla bázisú előző hétnél nincs kitalált százalék. A trend nem testsúly- vagy egészségi értékelés.
- Piszkozatok és törlésre váró bejegyzések kimaradnak. Üres aktuális héten nincs email.

A grafikonok inline stílusú HTML-táblázatok: nincs külső képszolgáltatás, követőpixel, JavaScript vagy SVG. A meglévő Yumetrics-logó emailhez készített PNG-változata (`public/email-logo.png`) a levélbe ágyazva, külön hálózati képbetöltés nélkül jelenik meg. A Nodemailer `attachDataUrls` beállítása a PNG-adatot inline MIME-képpé alakítja. A webes előnézet ugyanazt a képet adat-URL-ként mutatja, szigorú CSP mellett. Szöveges levélváltozat is készül. Az SMTP-elfogadás nem igazolja a címzetti postaládába kézbesítést.

A fejléc a Yumetrics arculatát követi; a heti összesítés külön zöld kártyán jelenik meg. A trend irányát közérthető mondat magyarázza, a hiányzó napok hatását külön jelöljük. A grafikonoknál a hét napjának neve is látszik, és a korábbi szakkifejezések helyett egyszerű feliratok szerepelnek.

A hétközi előnézet a mai időpontig rögzített étkezéseket és az előző hét ugyaneddig eltelt részét hasonlítja össze. Jövőbeli bejegyzéseket nem számít bele. A vasárnapi küldés továbbra is a fenti, rögzített 20:00-s határt használja.

## Brevo SMTP

A helyi, Gitből kizárt `.env`, élesben a Northflank runtime secret group kapja ezeket:

```dotenv
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<a Brevo SMTP login értéke>
SMTP_PASS=<SMTP-kulcs, nem REST API-kulcs>
SMTP_FROM=Yumetrics <hitelesitett-felado@sajat-domain.hu>
WEEKLY_REPORTS_ENABLED=true
```

A kulcsot ne commitold és ne másold naplóba. A `SMTP_FROM` Brevóban hitelesített feladó legyen, nem a technikai `@smtp-brevo.com` login. Az 587/2525 port kötelező STARTTLS-t, a 465-ös `SMTP_SECURE=true` titkosítást használ. TLS-tanúsítvány-ellenőrzés nem kapcsolható ki.

Forrás: [Brevo SMTP-beállítás](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP), [Nodemailer SMTP](https://nodemailer.com/smtp).

Az emailküldéshez a felhasználó címe és a jelentés tartalma a Brevóhoz kerül. A bekapcsolásnál erről rövid tájékoztatás látható. A titok kitöltése önmagában nem telepíti az új kódot és nem módosítja a Northflank runtime beállításait.

## Tartósság és hibák

Az alkalmazás percenként ellenőrzi az esedékességet, induláskor is. Legfeljebb a legutóbb esedékes hetet pótolja; az utána feliratkozóknak nem küld történeti jelentést. Felhasználónként és hétkezdésenként egy adatbázissor, feltételes atomikus foglalás és ötperces lease védi a párhuzamos futtatást. A kimaradt előző hetek pending sorai elévülnek.

SMTP nem ad pontosan-egyszeri küldési garanciát. Egyértelmű ideiglenes SMTP-elutasításnál, illetve átadás előtti kapcsolati hibánál legfeljebb öt próbálkozás van, növekvő késleltetéssel. A levél pillanatképe és Message-ID-ja újrapróbáláskor azonos. Bizonytalan DATA-hiba, lejárt sending lease vagy elfogadás utáni adatbázishiba esetén **nincs automatikus újraküldés**, nehogy duplán érkezzen. Ezek `smtp_delivery_unknown` állapottal ellenőrizhetők.

A foglaláskor az esedékességet ismét ellenőrizzük, ezért egy párhuzamos folyamat korábban beolvasott listája nem kerülheti meg az újrapróbálási késleltetést. Végleges SMTP-elutasítás nem kerül vissza a sorba. Leállításkor a folyamat befejezi az éppen átadott levelet, és újabbat már nem kezd el.

A küldés előtt újra ellenőrizzük a leiratkozást, tiltást és címváltozást. A HTML/teljes levél csak újrapróbálásig marad az adatbázisban; lezáráskor törlődik. Az állapot, próbálkozásszám, Message-ID és hibakategória megmarad, SMTP-jelszó és nyers szolgáltatói hiba nélkül.

## Végpontok

- `GET/PATCH /api/weekly-report/preferences`: saját beállítás; PATCH törzs `{enabled: boolean, language: "hu"|"en"}`. Bejelentkezés és az API meglévő origin-védelme szükséges.
- `GET /api/weekly-report/preview?lang=hu|en`: saját heti email HTML-előnézete. Nincs küldés; nincs cache és külső erőforrás.
- `GET /email/weekly/unsubscribe?token=...`: megerősítő oldal, nem módosít adatot a levélellenőrző robotok megnyitásától.
- `POST` ugyanoda: leiratkozás, bejelentkezés nélkül, titkos 256 bites tokennel. A List-Unsubscribe / One-Click fejlécek is ezt használják.

Táblák: `weekly_report_preferences`, `weekly_report_deliveries`. Migráció: PostgreSQL `0011_weekly_reports`, SQLite `0013_weekly_reports`.

## Ellenőrzés

`node --test tests/weekly-reports.test.mjs`: időzóna/DST/évhatár, ismeretlen napok, nulla bázis, saját adatok, konkurens foglalás, újraindítás, SMTP retry és bizonytalan átadás, leiratkozás, origin-védelem, lokalizált előnézet. PostgreSQL-hez külön `_test` adatbázis és `TEST_DATABASE_URL` szükséges; enélkül az adott tesztek kimaradnak. A tesztek nem küldenek valódi emailt.
