# Az alapnyelvhez használt országadatok

Forrás: [DB-IP IP to Country Lite](https://db-ip.com/db/download/ip-to-country-lite), 2026. novemberi kiadás. A `country.mmdb.gz` az eredeti, tömörített MMDB-adatbázis; az adatokat nem módosítottuk.

Letöltés: https://download.db-ip.com/free/dbip-country-lite-2026-11.mmdb.gz

A tömörítetlen adatbázis MD5-ellenőrzőösszege: `5974b336a7409ec854f67eacd52c2061`, megegyezik a forrásoldalon közölt értékkel.

Licenc: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Adatgazda: [DB-IP.com](https://db-ip.com). A belépőoldalon és a napló láblécében szerepel a forráshivatkozás.

Az adatbázis havonta frissül. Frissítéskor az eredeti letöltést kell lecserélni, majd az IPv4-/IPv6-próbákat és a nyelvválasztási teszteket futtatni. A szerver induláskor helyben olvassa be a fájlt; látogatásonként nincs külső kérés, és az alkalmazás nem menti el az IP-címet a nyelvválasztáshoz.

A Northflank nyilvános belépési pontja felülírja az `X-Envoy-External-Address` fejlécet. Éles üzemben ezt használjuk; a kliens által befolyásolható `X-Forwarded-For` fejlécet figyelmen kívül hagyjuk. Helyben a közvetlen kapcsolat IP-címe számít. Forrás: [Northflank hálózati dokumentáció](https://northflank.com/docs/v1/application/network/networking-on-northflank).

Az adatbázis országot becsül, nem anyanyelvet vagy nemzetiséget. VPN, proxy és mobilhálózat esetén a becslés eltérhet a látogató tartózkodási helyétől. Az ismeretlen címhez angol alapnyelv tartozik. A korábban kiválasztott nyelv és az érvényes `?lang=hu` vagy `?lang=en` hivatkozás felülírja az ország szerinti alapbeállítást. A külön magyar és angol útmutató címe továbbra is rögzített nyelvű; az adminfelület magyar.
