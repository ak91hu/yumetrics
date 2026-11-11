# Hitelesítés, jogosultságok és biztonsági határok

## Google OpenID Connect

A Google-belépés authorization code folyamatot használ `openid email profile` scope-pal. Az alkalmazás nem kér Gmail- vagy Drive-hozzáférést. A kliens nem kapja meg a Google-kliens titkát.

1. A szerver véletlen `state`, `nonce` és PKCE verifier értéket generál.
2. A state hash-e, a nonce és a verifier tízperces lejárattal adatbázisba kerül.
3. A böngésző HttpOnly állapotsütit kap, és a Google-hoz kerül S256 PKCE challenge-dzsel.
4. Visszatéréskor a süti és a state egyezését időzítési támadásokkal szemben védett összehasonlítás ellenőrzi.
5. A state adatbázisrekordja egyszer használatos törléses visszaolvasással fogy el.
6. A szerver beváltja a kódot, majd ellenőrzi az ID-token aláírását a Google-könyvtárral, valamint az issuert, audience-t, nonce-ot és az ellenőrzött e-mailt.
7. Tranzakcióban létrehozza/frissíti a fiókot és létrehozza a helyi munkamenetet.

A jelenlegi külső GitHub Pages OAuth-közvetítő csak a megengedett válaszparamétereket továbbítja a szervernek. A tokenváltás és az ellenőrzés továbbra is szerveroldali. A `GOOGLE_REDIRECT_URI` pontosan egyezzen a Google-kliens beállításával; közvetlen szerveroldali callback is konfigurálható.

## Helyi munkamenet

A munkamenet véletlen, 32 bájtos érték hexadecimális alakja; az adatbázis csak SHA-256-hashét tárolja. Alapértelmezett élettartama 30 nap. Éles HTTPS-eredetnél a süti `__Host-` előtagot, `Secure`, `HttpOnly`, `SameSite=Lax` és `Path=/` attribútumot kap.

Minden védett kérés ellenőrzi a hash-hez tartozó, még le nem járt munkamenetet és a fiók tiltását. A kijelentkezés az aktuális szerveroldali munkamenetet is törli. Az alkalmazás nem tárol tartós Google access/refresh tokeneket.

## Tulajdonosi hozzáférés

Az étkezési lekérdezések a bejelentkezett felhasználó azonosítójára szűrnek. Más felhasználó étkezési UUID-jának ismerete nem biztosít hozzáférést. A képletöltés külön ellenőrzi a tulajdonost vagy az admint.

Az adminjog a kódban rögzített, Google által ellenőrzött tulajdonosi e-mailhez tartozik (`ADMIN_EMAIL`). Nincs önkiszolgáló szerepkiosztás vagy általános szerephierarchia. A felső menüpont láthatósága csak kényelmi funkció; a HTML- és API-útvonalak szerveroldali ellenőrzése a valódi határ.

## Kéréskorlátok és validálás

| Korlát | Jelenlegi alkalmazásszabály |
| --- | --- |
| Általános API | 600 kérés / 60 másodperc / felhasználó |
| Feltöltés | 12 kérés / 60 másodperc / felhasználó, plusz tartós elemzési kvóta |
| USDA | 30 kérés / 60 másodperc / felhasználó |
| OAuth-indítás/callback | Külön 20/60 próbálkozás tízperces ablakban, hálózati címhez kötve |
| Elemzési alapkvóta | 20 / óra és 50 / nap; adminból módosítható |
| Párhuzamos nagy művelet | Folyamatonként két feltöltés, egy feltöltés felhasználónként; korlátozott párhuzamos képolvasás |

A `request_limits` hash-elt bucketkulcsokat tárol. A kvóta és a párhuzamos beküldés kezelése adatbázis-tranzakciót, illetve egyes műveleteknél felhasználói sorzárat használ. A korlát nem jelent teljes DDoS-védelmet; a hálózati védelmek külön üzemeltetési réteghez tartoznak.

A szerver a képtípust és a bájtok fejlécét, a data URL szerkezetét, a JSON-méretet, a UUID-t, a számok tartományát és a források egyezését is ellenőrzi. SQL-értékek paraméterezetten kerülnek a driverhez. A felület a felhasználói és AI-szövegeket HTML-escape-pel jeleníti meg, beleértve az adminarchívumot is.

## Fejlécek és külső hálózat

A CSP alapja `default-src 'self'`, a futtatható szkriptek forrása `script-src 'self'`. A stílusoknál a meglévő felület inline stílusokat is enged; szkripteknél nincs általános `unsafe-inline` engedély. A szabály tiltja az objektumbeágyazást és a külső keretezést. További fejlécek: `nosniff`, `no-referrer`, `Cross-Origin-Opener-Policy: same-origin`; HTTPS-konfigurációban HSTS.

A MkDocs felülírt témasablonja a szükséges inicializálást helyi JS-fájlba teszi, ezért nem igényli a CSP lazítását. A helyi kereső workerje ugyanarról az eredetről töltődik be. A dokumentáció útvonalkezelője elutasítja a könyvtárból kilépő, ponttal kezdődő és hibásan kódolt útvonalakat, és csak ismert statikus fájltípusokat szolgál ki.

A szolgáltatói adapterek rögzített vagy szigorúan ellenőrzött célcímeket használnak, a képek visszaolvasása host- és útvonalellenőrzött, átirányítás nélkül. Ez fontos SSRF-határ: tetszőleges, felhasználó által megadott képlink nem válik szerveroldali letöltéssé.

## Titkok és ismert határok

A kulcsok Northflank runtime secretként érkeznek. A `.env`, a Modal helyi klienskonfigurációja és a munkakönyvtári naplók nem buildbemenetek és nem publikus dokumentációk. Az archívumszűrés eltávolítja az ismert titkokat és több tipikus tokenalakot, de nem általános személyesadat-anonimizáló: az ételmegnevezések és felhasználói megjegyzések érzékenyek lehetnek.

Források: [hitelesítés](https://github.com/ak91hu/yumetrics/blob/main/lib/auth.mjs), [fejlécek és statikus fájlok](https://github.com/ak91hu/yumetrics/blob/main/lib/http.mjs), [korlátozás](https://github.com/ak91hu/yumetrics/blob/main/lib/request-limits.mjs), [korábbi biztonsági audit](https://github.com/ak91hu/yumetrics/blob/main/docs/SECURITY-AUDIT-2026-11-09.md).
