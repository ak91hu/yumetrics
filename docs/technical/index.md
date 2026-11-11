# A Yumetrics technikai dokumentációja

A Yumetrics magyar és angol nyelvű, Google-fiókkal használható étkezési napló. Egy étkezéshez egy kötelező és egy opcionális fényképet fogad. Az AI feladata az ételek azonosítása, az összetevők és mennyiségek becslése, valamint a bizonytalanságok megjelölése. A tápanyagok adagra vetítését és összesítését determinisztikus JavaScript-kód végzi. A felhasználó ellenőrzi és külön művelettel menti az eredményt.

Ez a dokumentáció a **2026. november 11-i forrásállapotot** írja le. A megvalósított működést különbözteti meg az üzemeltetési ajánlásoktól és a jövőbeli lehetőségektől. A korábbi mérések nem tekinthetők automatikusan az aktuális modellpáros hitelesítésének.

## A rendszer fő jellemzői

| Terület | Megvalósítás |
| --- | --- |
| Kliens | HTML, CSS, natív JavaScript ES-modulok; reszponzív felület |
| Szerver | Node.js 24+, natív HTTP-szerver és Fetch API |
| Éles adatok | Northflank PostgreSQL; tranzakciók, migrációk, tartós feldolgozási sor |
| Képtárolás | Cloudinary `authenticated` képek, szerveroldali hozzáférés-ellenőrzéssel |
| Hitelesítés | Google OpenID Connect, OAuth authorization code, PKCE |
| Ételnévjavaslatok | Opcionális Food-R1 8B BF16, Modal L40S GPU-n |
| Teljes képelemzés | OpenCode-on elért Gemini 3.8 Flash, strukturált JSON-válasszal |
| Tápértékforrás | Ellenőrzött termékcímke, USDA-referencia vagy jelölt becslés |
| Dokumentáció | MkDocs 1.6.1, helyben kiszolgált statikus HTML és keresőindex |

## Egy étkezés útja

```text
Google-belépés → fénykép és kiegészítő adatok
  → böngészős képelőkészítés → tartós képfeltöltés
  → PostgreSQL-feladat → képek visszaolvasása
  → opcionális Food-R1 ételnévjavaslat
  → OpenCode/Gemini ellenőrzés az eredeti képekkel
  → szerveroldali validálás és tápértékszámítás
  → ellenőrizhető piszkozat → felhasználói javítás és mentés
  → napló, statisztikák, jelvények és heti haladás
```

Az AI-válasz nem válik automatikusan végleges naplóbejegyzéssé. Az étkezés tápértéke a képen látható teljes ehető adagra vonatkozik; két kép ugyanazon adag két nézete, nem két adag.

## Javasolt olvasási sorrend

1. [Architektúra és rendszerhatárok](architecture.md).
2. [Képfeltöltés és kliensoldali állapot](frontend.md), majd a [háttérfeldolgozás állapotgépe](processing.md).
3. [AI és Modal](ai.md), valamint a [tápértékszámítás algoritmusai](nutrition.md).
4. [Adatmodell](database.md), [HTTP API](api.md) és [biztonság](security.md).
5. [Adminisztráció és költségek](administration.md), [üzemeltetés](operations.md), [fejlesztés és ellenőrzés](development.md).

## Pontosság és korlátok

A képből nem mérhető meg közvetlenül az energiatartalom. A hibát az ételazonosítás, a nem látható hozzávalók, az adagbecslés és a forrásválasztás egyaránt befolyásolja. Az AI saját bizonyossági szintje nem kalibrált pontossági százalék. A lemért ehető tömeg, az ismert recept és a megfelelő címkeadat többet segíthet, mint egy újabb, nem ellenőrzött modellbecslés.

A korábbi kis mintás vizsgálatok eredményei a [forrástár mérési dokumentumaiban](https://github.com/ak91hu/yumetrics/tree/main/docs) találhatók. Nincs általános, magyar ételfotókra mért és függetlenül igazolt pontossági állítás. A szoftvertesztek a program viselkedését ellenőrzik; a valódi felismerési hibához külön referenciamérés szükséges.

## Kapcsolódó felületek

- [Alkalmazás](https://yumetrics.app/).
- [Felhasználói útmutató](https://yumetrics.app/utmutato) és [angol útmutató](https://yumetrics.app/guide).
- [Forráskód és README](https://github.com/ak91hu/yumetrics).
- [Adatvédelem, megőrzés és mérési korlátok](privacy.md).

A dokumentáció nyilvános. Kulcsokat, munkameneteket, felhasználói fényképeket és éles naplóbejegyzéseket nem tartalmaz. Az alkalmazás személyes adatai és az adminfelület továbbra is hitelesítést igényelnek.
