# Az alapnyelvhez használt országadatok

Frissítve: 2026. november 9. Ez az adatbázis az első megnyitás alapnyelvéhez és a látogatottság ország szerinti összesítéséhez ad országkódot; nem érinti az ételfelismerést vagy a tápértékszámítást.

Forrás: [DB-IP IP to Country Lite](https://db-ip.com/db/download/ip-to-country-lite), 2026. novemberi kiadás. A `country.mmdb.gz` az eredeti, tömörített MMDB-adatbázis; az adatokat nem módosítottuk.

Letöltés: https://download.db-ip.com/free/dbip-country-lite-2026-11.mmdb.gz

A tömörítetlen adatbázis MD5-ellenőrzőösszege: `5974b336a7409ec854f67eacd52c2061`, megegyezik a forrásoldalon közölt értékkel.

Licenc: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Adatgazda: [DB-IP.com](https://db-ip.com). A belépőoldalon és a napló láblécében szerepel a forráshivatkozás.

Az adatgazda havonta ad ki új állományt; az alkalmazásba csomagolt példány nem frissül automatikusan. A szerver induláskor helyben olvassa be a fájlt; látogatásonként nincs külső kérés, és az alkalmazás nem menti el az IP-címet a nyelvválasztáshoz.

A Northflank nyilvános belépési pontja felülírja az `X-Envoy-External-Address` fejlécet. Éles üzemben ezt használjuk; a kliens által befolyásolható `X-Forwarded-For` fejlécet figyelmen kívül hagyjuk. Helyben a közvetlen kapcsolat IP-címe számít. Forrás: [Northflank hálózati dokumentáció](https://northflank.com/docs/v1/application/network/networking-on-northflank).

Az adatbázis országot becsül, nem anyanyelvet vagy nemzetiséget. VPN, proxy és mobilhálózat esetén a becslés eltérhet a látogató tartózkodási helyétől. Az ismeretlen címhez angol alapnyelv tartozik. A korábban kiválasztott nyelv és az érvényes `?lang=hu` vagy `?lang=en` hivatkozás felülírja az ország szerinti alapbeállítást. A külön magyar és angol útmutató címe továbbra is rögzített nyelvű; az adminfelület magyar.

## A nyelvválasztás sorrendje

1. Érvényes `?lang=hu` vagy `?lang=en` hivatkozás.
2. A `yumetrics_language` sütiben tárolt kézi választás.
3. Magyarország (`HU`) esetén magyar, minden más országnál vagy ismeretlen IP-címnél angol.

Más országban élő magyar közösségekre nem alkalmazunk külön országszabályt. A nyelvválasztó bejelentkezés előtt és a naplóban is elérhető; a váltás megőrzi a kiválasztott képeket és a szerkesztett adatokat. A korábbi AI-eredmények és a felhasználó saját szövegei nem fordulnak át automatikusan.

## Az adatbázis frissítése

1. Töltsd le a választott havi kiadás eredeti `.mmdb.gz` állományát a DB-IP hivatalos oldaláról egy ideiglenes könyvtárba.
2. Ellenőrizd, hogy kicsomagolható, és a tömörítetlen fájl ellenőrzőösszege megegyezik az adatgazda által közölt értékkel. A fenti összeg kizárólag a 2026. novemberi kiadásé.
3. Másold az ellenőrzött, eredeti tömörített fájlt a `lib/geoip/country.mmdb.gz` helyére. Frissítsd ebben a README-ben a kiadást, a letöltési címet és az ellenőrzőösszeget; a licencet és a felületi forráshivatkozásokat tartsd meg.
4. A projekt gyökeréből futtasd az ellenőrzéseket:

```powershell
node --test tests/geoip.test.mjs tests/i18n.test.mjs
npm run build
```

Az IPv4-, IPv6-, IPv4-be ágyazott, helyi és hibás címeket, a megbízható fejléc kezelését, a kézi választás elsőbbségét és a magyar/angol válaszokat külön tesztek ellenőrzik. Telepítés után az alkalmazás újraindításával töltődik be az új adatbázis; a fájl helyi cseréje önmagában nem frissíti az éles szolgáltatást.

Kapcsolódó források: [országfelismerés](../geoip.mjs), [nyelvi elsőbbség](../i18n.mjs), [nyelvi elvek](../../docs/LANGUAGE.md), [alkalmazás és telepítés](../../README.md). A mostani dokumentációfrissítés nem cserélte le az országadatbázist.

A látogatottságmérés csak országonkénti napi számlálót őriz meg, IP-címet vagy látogatói profilt nem. Az eredményt a tulajdonosi admin mutatja; a mérés ott kikapcsolható. A nyelvválasztás ettől függetlenül működik. A mérés módja, szűrései és korlátai: [ADMIN.md](../../docs/ADMIN.md#a-beépített-látogatottságmérés).
