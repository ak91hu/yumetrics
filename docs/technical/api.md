# HTTP API és adatszerződések

## Általános szabályok

Az API az alkalmazás eredetén érhető el, jellemzően JSON-nal. A védett útvonalakhoz HttpOnly munkamenetsüti kell; nincs böngészőnek kiadott szolgáltatói API-kulcs vagy általános publikus bearer token. Az író műveletek ellenőrzik az `Origin` és `Sec-Fetch-Site` fejléceket. A JSON-kérésekhez `Content-Type: application/json` szükséges.

Az általános JSON-törzs korlátja 11 400 000 bájt; a profil- és kihívásműveletek lényegesen kisebb, 4096 bájtos keretet használnak. A stream olvasása közben is érvényesül a méretkorlát, nem csak a kliens által megadott `Content-Length` alapján.

## Publikus és hitelesítési útvonalak

| Metódus | Útvonal | Jelentés |
| --- | --- | --- |
| GET | `/` | Bejelentkezési oldal vagy saját napló |
| GET | `/healthz` | Folyamat él: `{ "ok": true }` |
| GET | `/readyz` | Adatbázis olvasható és a Google-konfiguráció jelen van |
| GET | `/api/auth-status` | A bejelentkezés konfiguráltsága, személyes adat nélkül |
| GET | `/auth/google` | OAuth-folyamat indítása |
| GET | `/auth/google/callback` | Egyszer használható Google-válasz feldolgozása |
| POST | `/api/logout` | Aktuális munkamenet törlése és süti lejáratása |
| GET, HEAD | `/utmutato`, `/guide` | Magyar/angol felhasználói útmutató |
| GET, HEAD | `/docs/…` | MkDocs technikai dokumentáció és helyi erőforrásai |

A `/docs` a `/docs/` alakra irányít át. A dokumentáció könyvtáralapú oldal-URL-jei záró perjelet használnak. A readiness nem indít AI-hívást, és nem ellenőrzi a szolgáltatói egyenlegeket.

## Felhasználói útvonalak

| Metódus | Útvonal | Bemenet vagy eredmény |
| --- | --- | --- |
| GET | `/api/status` | Aktuális felhasználó, profilkép, energiakeret, adminjelzés |
| GET | `/api/profile?timezone=Europe/Budapest` | Profil, naplózási összesítések, heti kihívás |
| PATCH | `/api/profile` | `{ "calorieGoal": 2000 }`; 500–10 000 egész kcal |
| POST | `/api/weekly-challenge` | Heti választás: `{ "kind": "three_days" }`, `recipe` vagy `measured` |
| GET | `/api/meals?month=YYYY-MM` | Saját havi bejegyzések és a függő műveletek |
| POST | `/api/analyze` | Képek, UUID, metaadatok és kontextus; rendszerint `202` |
| GET | `/api/meals/:id` | Saját bejegyzés, számított összesítés és jelentés |
| PATCH | `/api/meals/:id` | Teljes szerkeszthető elemzés, metaadatok és aktuális `revision` |
| POST | `/api/meals/:id/retry` | Hibás feldolgozás kézi újrapróbálása |
| DELETE | `/api/meals/:id` | Tartós törlési feladat; `202` |
| GET | `/api/meals/:id/photo/primary` | Tulajdonosnak vagy adminnak kiszolgált kép |
| GET | `/api/meals/:id/photo/additional` | Opcionális második kép |
| GET | `/api/foods/search?q=…` | USDA-keresés, 3–100 karakteres kifejezés |
| GET | `/api/foods/:fdcId` | Kiválasztott USDA-rekord hitelesített másolata |

## Elemzésindítási példa

Az alábbi szerkezeti példa nem végrehajtható képfájl, és nem tartalmaz valódi felhasználói adatot:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "day": "2026-11-11",
  "time": "12:30",
  "timezone": "Europe/Budapest",
  "type": "Ebéd",
  "notes": "A köret főtt rizs.",
  "image": "data:image/jpeg;base64,<érvényes JPEG-bájtok>",
  "context": { "language": "hu" }
}
```

A `secondImage` elhagyható. Ha szerepel, annak is érvényes, eltérő képtartalomnak kell lennie. A szerver a `context.additionalView` értékét a tényleges képekből állapítja meg. A metaadat- és kontextusmezők pontos validálását a `domain.mjs` írja le.

A `meal` objektumban többek között `status`, `job`, `analysis`, `totals`, `report`, `photo`, `revision`, `createdAt` és `updatedAt` szerepel. A `photo` az alkalmazás saját képútvonalait tartalmazza, nem közvetlen Cloudinary-letöltőlinket.

## Admin API

A `/api/admin/` teljes névtere tulajdonosi ellenőrzést végez. Fontos olvasási útvonalak: `overview`, `visitors`, `costs`, `ai-responses`, `logs`, `users`, `meals`, `jobs`, `audit`, `settings`. Egyedi AI-válaszhoz és étkezéshez az azonosítós részletútvonal tartozik. A felhasználók tiltásához, munkameneteik lezárásához és a beállítások módosításához külön író műveletek vannak.

Az adminlisták jellemzően `page` paraméterrel lapoznak; a támogatott szűrők nézetenként eltérnek. A statisztikai napválasztás több helyen 7, 30 vagy 365 napra korlátozott. A beállításmentés teljes, validált mezőkészletet és aktuális konfigurációs revíziót kér.

## Státuszkódok

| Kód | Tipikus jelentés |
| --- | --- |
| 200 | Sikeres olvasás vagy mentés; esetleg már létező elemzési eredmény |
| 202 | A tartós feladat elfogadva, a munka még folyamatban van |
| 303 / 308 | Hitelesítési vagy kanonikus címre történő átirányítás |
| 400 / 415 | Hibás adat, illetve nem megfelelő tartalomtípus |
| 401 / 403 | Hiányzó munkamenet vagy elégtelen jogosultság/idegen eredet |
| 404 | Nem létező vagy az adott felhasználó számára nem látható erőforrás |
| 409 | Revízióütközés, eltérő azonosítóhasználat vagy futó művelet |
| 413 / 429 | Túl nagy kérés, illetve elért kérés-/elemzési korlát |
| 500 / 502 / 503 | Belső, szolgáltatói vagy átmeneti rendelkezésre állási hiba |

A hibaválasz rendszerint `{ "error": "…" }`, `Cache-Control: no-store` fejléccel. A korlátozás `Retry-After` fejlécet is adhat. A közönséges felhasználó számára a belső szolgáltatói hibák részleteit a szerver általánosítja; az admin és a napló részletesebb diagnosztikát kaphat.

Források: [felhasználói útvonalak](https://github.com/ak91hu/yumetrics/blob/main/lib/api.mjs), [adminútvonalak](https://github.com/ak91hu/yumetrics/blob/main/lib/admin.mjs), [adatvalidálás](https://github.com/ak91hu/yumetrics/blob/main/lib/domain.mjs).
