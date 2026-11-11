# Adatvédelem, megőrzés, nyelvek és látogatottság

## Jogi dokumentáció és a megfelelőség állapota

A [két nyelvű adatkezelési és felhasználási tervezetek, jogi kutatás és belső eljárásrend](https://github.com/ak91hu/yumetrics/tree/main/docs/legal) a 2026. november 11-i vizsgálatot rögzítik. Ezek nem hatályba léptetett feltételek és nem teljes GDPR-megfelelőségi igazolás. Az üzemeltető Kovács Ákos, nyilvános adatvédelmi kapcsolata `thisisnotka@gmail.com`. A 18 éves alsó korhatár üzemeltetői döntés; a belépéskor nincs még külön életkor-megerősítés.

Hiányzik a különleges adatok esetére szükséges jogalap és kifejezett hozzájárulás igazolt kezelése, az opcionális tartalmi AI-összehasonlítás külön választása, több napló tényleges lejárata, valamint a teljes körű export/törlés kipróbált eljárása. Az önkiszolgáló felület nem feltétlenül kötelező; az érintetti jogok teljesíthetősége igen. A dokumentumok megírása nem módosítja ezeket a folyamatokat és nem töröl éles adatot.

## Tárolási helyek és szolgáltatói határok

Az alkalmazás és a PostgreSQL az ellenőrzött Northflank-metaadatok szerint Google Cloud `europe-west2`, **London, Egyesült Királyság** régióban fut. A heti adatbázismentés jelenlegi megőrzése hét nap; a mentési objektumok pontos helye külön ellenőrizendő. A Cloudinary-képek EGT-n belüli kizárólagos tárolását nem igazoltuk.

A Modal-megvalósítás aszinkron `spawn` Functions-hívást használ, régiórögzítés nélkül. A szolgáltató dokumentációja amerikai platformtárolást és legfeljebb hét napos bemenet-/kimenetmegőrzést ír le. A `single_use_containers` és a GPU leállása a számítás életciklusát kezeli; nem igazolja a platformon tárolt payload azonnali törlését. A modellfájlokat tartalmazó Volume ettől külön állomány. Forrás: [Modal adatrezidencia](https://modal.com/docs/guide/data-residency), [megőrzés](https://modal.com/docs/guide/security).

Az üzemeltető a Northflank, Cloudinary, Modal és OpenCode DPA-jának elfogadását megerősítette; az alkalmazandó példányokat és mellékleteket nem vizsgáltuk. Az OpenCode inference és a mögöttes Google-modell pontos szerződéses hatálya, megőrzése és továbbítási garanciája még ellenőrizendő. Az Egyesült Királyság EGT-n kívüli ország; a megfelelő uniós megfelelőségi határozat alkalmazható, más továbbításokhoz külön garanciaértékelés kell. A jogi dokumentáció a Google-belépés, Google-profilkép, GitHub Pages-közvetítő és a kapcsolattartó Gmail-fiók adatútját is elkülöníti.

## Milyen adat hová kerül?

| Adat | Tárolás vagy feldolgozó |
| --- | --- |
| Google `sub`, név, ellenőrzött e-mail, profilkép URL | PostgreSQL `users` |
| Munkamenet | HttpOnly süti a kliensben, hash és lejárat az adatbázisban |
| Étkezési metaadat, megjegyzés, elemzés és javítás | PostgreSQL `meals` és AI-archívum |
| Képbájtok | Cloudinary védett tárolás; elemzéskor Modal és OpenCode felé továbbítva |
| Képazonosító és képmetaadat | PostgreSQL; közvetlen kép-URL nem publikus API-eredmény |
| Kéréskorlátozás | Hash-elt bucket és lejárat; OAuth esetén hálózati címhez is kapcsolódhat |
| Látogatottság | Kizárólag napi, dimenziónként összesített számlálók |
| Modellfájlok | Modal Volume; nem a felhasználói fotók archívuma |

A szolgáltatói adatkezelést azok aktuális szerződései és fiókbeállításai határozzák meg. A helyi megvalósításból nem következik automatikusan valamennyi külső szolgáltató „zero retention” vagy tréningmentes működése.

## Képvédelem

A böngészős újrarajzolás nem másolja át az eredeti EXIF/GPS-metaadatot. A Cloudinary-fájl `authenticated` típusú; az alkalmazás tulajdonosi vagy adminellenőrzés után olvassa vissza és saját végpontján adja át. A válasz `private, no-store` és same-origin erőforráspolitikát használ.

A képen látható személy, felirat vagy más érzékeny tartalom ettől még képtartalom marad. A metaadatok elhagyása nem képanonimizálás. Az AI-hívások az elemzéshez szükséges képeket továbbítják a konfigurált szolgáltatókhoz.

## Válaszarchívum és törlés

Az archívum az összehasonlításhoz megőrzi a szűrt AI-választ, a feldolgozott eredményt, a prompt-/schema-/képlenyomatokat, a modell és hívás adatait, valamint a legutóbbi jóváhagyást. Képbájtokat és belső modellgondolatmenetet nem archivál. A válasz olvasási felső korlátja 1 MiB, az archivált szöveg korlátja 64 KiB; a csonkolás külön jelzett.

**Az étkezés törlése nem törli automatikusan a kapcsolódó AI-archívumot és költségrekordot.** A megőrzésnek jelenleg nincs automatikus lejárata. Ez üzemeltetői adatkezelési döntést és szükség esetén külön törlési eljárást igényel; a dokumentáció nem állít be nem létező automatikus fióktörlő folyamatot.

A heti aktivitás és a megszerzett pecsét szándékosan tartós: egy jogosító mentés utólagos törlése nem vonja vissza a heti teljesítést. Ez a közönséges, aktuális naplóállapotból újraszámolt jelvényektől eltérő szabály.

## IP-alapú ország és alapnyelv

A GeoIP-feloldás helyben, a mellékelt DB-IP Country Lite adatbázisból történik; nincs látogatásonkénti külső GeoIP-API-kérés. IPv4 és IPv6 támogatott. Éles Northflank környezetben a szerver az ingress által felülírt `x-envoy-external-address` fejlécet, egyébként a hálózati kapcsolat címét használja. Tetszőleges kliensoldali `X-Forwarded-For` nem megbízható címforrás.

Első látogatáskor `HU` országhoz magyar, más vagy ismeretlen országhoz angol alapnyelv tartozik. Ez **csak Magyarország**, nem a teljes Kárpát-medence nyelvhasználatának felismerése. VPN/proxy, szolgáltatói címkiosztás és az adatbázis kora miatt lehet eltérés.

A kézi `hu`/`en` választás elsőbbséget élvez; a nyelvi süti nem bejelentkezési token. A `?lang=` paraméter is választhat nyelvet. Az útmutatók URL alapján rögzített nyelvűek, az admin és ez a technikai dokumentáció magyar. A korábbi AI-szövegeket és saját megjegyzéseket nyelvváltáskor nem fordítjuk újra AI-val. A DB-IP-hivatkozás a nyelvi tájékoztatóban marad.

## Beépített, összesített látogatásmérés

A mérés szerveroldali, nincs Umami- vagy más külső követőszkript. A `visitor_stats` kulcsa nap + dimenzió + dimenzióérték, az érték pedig megnyitásszám. A dimenziók: oldal, ország, böngésző, operációs rendszer, eszköztípus, forráscsoport, nyelv és UTC-óra.

Nem készül egyedi látogatói azonosító, nyers IP-, teljes User-Agent- vagy teljes referrerrekord. A forrás ismert szolgáltatói csoportokra oszlik; az ismeretlen külső oldal `other`. A külön dimenzióösszesítésekből nem állítható elő pontos felhasználói útvonal vagy tetszőleges többdimenziós keresztbontás.

A számláló csak kijelölt dokumentum-GET kéréseket mér. Kizárja az admin tulajdonost, a DNT/GPC-jelzést küldőket, több bot/headless/prefetch esetet és a nem dokumentumkéréseket. Az aktuális oldaljegyzék a belépés, napló és két útmutató; **a technikai dokumentáció nincs automatikusan a látogatási mérésben**.

A megőrzési ablak 400 nap; a tisztítás rögzítéskor és jelentéskéréskor fut, nem külön cronfeladatként. Ez nem egyedi látogatók, munkamenetek vagy konverziós arányok kimutatása. A fejlécek vagy a botszűrés hiánya/tévedése miatt a megnyitásszám sem teljes forgalmi mérés.

Források: [látogatottság](https://github.com/ak91hu/yumetrics/blob/main/lib/visitors.mjs), [GeoIP](https://github.com/ak91hu/yumetrics/blob/main/lib/geoip.mjs), [DB-IP licenc és frissítés](https://github.com/ak91hu/yumetrics/blob/main/lib/geoip/README.md), [archívumszűrés](https://github.com/ak91hu/yumetrics/blob/main/lib/ai-archive.mjs).
