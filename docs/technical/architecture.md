# Architektúra és rendszerhatárok

## Alkalmazásszerkezet

A rendszer egyetlen Node.js-alkalmazásból és külön tartós PostgreSQL-adatbázisból áll. A böngésző natív ES-modulokat tölt be; nincs React, szerveroldali komponensrendszer vagy kliensoldali csomagoló. A szerver a `node:http` modulra épül, az üzleti logika keretrendszertől független modulokban található. A webes és a háttérfeldolgozó rész ugyanabban az alkalmazásfolyamatban fut, de tartós adatbázis-feladatokon keresztül kapcsolódik.

```text
Böngésző ── HTTPS ── Northflank ingress ── Node.js alkalmazás
                                            ├─ PostgreSQL: fiókok, napló, sor, archívum
                                            ├─ Google: OIDC-hitelesítés
                                            ├─ Cloudinary: védett képek
                                            ├─ Modal: Food-R1 névjavaslatok
                                            ├─ OpenCode: Gemini képelemzés
                                            └─ USDA FoodData Central: referenciaadatok
```

A Northflank végzi a publikus HTTPS-kapcsolat fogadását. Az alkalmazás a konfigurált `APP_ORIGIN` értékét használja kanonikus eredetként. Az ettől eltérő hostra érkező olvasási kéréseket átirányítja, az író kéréseket elutasítja; az állapotellenőrző végpontok a belső hálózatról is használhatók.

## Modulhatárok

| Fájl vagy csoport | Felelősség |
| --- | --- |
| `server.mjs` | HTTP-életciklus, útválasztás, biztonsági fejlécek, indulás és leállás |
| `lib/auth.mjs`, `settings.mjs` | Google-hitelesítés, munkamenetek, tulajdonosi jogosultság, beállítások |
| `lib/api.mjs` | Felhasználói HTTP-műveletek, tulajdonosi szűrés, validálás, tranzakcióhatárok |
| `lib/domain.mjs` | Adatszerződés, tartományi szabályok, adagra vetítés, jelentés |
| `lib/product-label.mjs`, `food-data.mjs`, `food-reference.mjs` | Címkeértelmezés, külső és beépített tápértékforrások |
| `lib/jobs.mjs` | Tartós feladatok felvétele, lease, eredménymentés, törlés |
| `lib/providers.mjs`, `modal-food.mjs`, `photos.mjs` | Szolgáltatói adapterek és képek biztonságos visszaolvasása |
| `lib/database.mjs` | PostgreSQL/SQLite adapter, migrációk és tranzakciók |
| `lib/admin.mjs`, `telemetry.mjs`, `ai-archive.mjs` | Admin API, naplózás, költség és válaszarchívum |
| `lib/profile-stats.mjs`, `weekly-challenges.mjs` | Naplózási statisztikák és jutalmak |
| `lib/geoip.mjs`, `i18n.mjs`, `visitors.mjs` | Országfelismerés, nyelvek és összesített látogatottság |
| `public/` | Kliensfelület, lokalizáció, képelőkészítés, grafikonok, súgók |
| `scripts/modal_foodr1.py` | A külön Modal-alkalmazás GPU-s és HTTP-s része |

A kliens által beküldött összesítések nem hiteles adatok. A szerver újra ellenőrzi az elemzést és maga számítja a tápértékeket. A felület elrejtése sem jogosultsági határ: az API minden védett műveletnél ellenőriz.

## Tartós és átmeneti állapot

A PostgreSQL őrzi a felhasználói állapotot, a feladatsort, a referenciamásolatokat, az archívumot és az összesített látogatási adatokat. A Cloudinary tárolja a képbájtokat. A Modal Volume a modellsúlyokat tárolja, nem a napló képeit. A böngésző memóriájában lévő, még el nem küldött kép nem tartós adat.

A konténer helyi lemezét az alkalmazás nem használja felhasználói adatok végleges tárolására. A statikus arculati elemek, a GeoIP-adatbázis és a lefordított dokumentáció az image részei, ezért új builddel cserélhetők.

## Konzisztencia és párhuzamosság

- Az új étkezés és a feladat létrehozása tranzakciós.
- Azonos feltöltésazonosító és bemeneti lenyomat esetén a kérés idempotens módon a meglévő állapotot adja vissza.
- Szerkesztéskor optimista zárolás működik a `revision` mezővel; elavult írásra `409 Conflict` érkezik.
- A worker lease-t és egyedi lease-tokent használ. Elvesztett lease után a késői eredmény nem írhatja felül az aktuális állapotot.
- A kihívásválasztás, a heti aktivitás és a jogosító mentés tranzakcióban kapcsolódik.

A PostgreSQL lehetővé teszi több alkalmazáspéldány közös állapotát, de a folyamaton belüli feltöltési/párhuzamossági korlátok példányonként értendők. A jelenlegi megoldás nem általános elosztott feladatsor-szolgáltatás. A tényleges terhelési határt külön mérni kell.

## Dokumentáció kiszolgálása

A MkDocs a build során előállítja a `public/technical-docs/` könyvtárat. A szerver ezt a `/docs/` útvonal alatt, kizárólag olvasható statikus tartalomként szolgálja ki. A forrás Markdown és a Python buildeszközök nem kerülnek automatikusan a publikus útvonalra. A futtatókörnyezetben nincs MkDocs-szerver vagy Python-követelmény.

Források: [szerver](https://github.com/ak91hu/yumetrics/blob/main/server.mjs), [modulok](https://github.com/ak91hu/yumetrics/tree/main/lib), [Dockerfile](https://github.com/ak91hu/yumetrics/blob/main/Dockerfile).
