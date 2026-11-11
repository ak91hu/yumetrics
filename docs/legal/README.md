# Yumetrics – adatvédelmi és felhasználási dokumentumok

Vizsgálati dátum: **2026. november 11.** · Vizsgált alkalmazásverzió: `5ac096fb6fcca62ad39dd22b6e1db93e33b6098f`.

**Állapot: felülvizsgálandó dokumentumtervezet, nem megfelelőségi tanúsítvány és nem hatályba léptetett ÁSZF.** A csomag a tényleges működést és a szükséges változtatásokat külön kezeli. Nem állítja, hogy egy tájékoztató elkészítése önmagában jogszerűvé teszi a jelenlegi adatkezelést. A tervezetek nem kerülnek be automatikusan a webalkalmazás vagy a MkDocs nyilvános jogi menüjébe; a forráskódtárban dokumentumtervezetként olvashatók.

| Dokumentum | Tartalom |
| --- | --- |
| [Magyar adatkezelési tájékoztató](PRIVACY-HU.md) | Adatkörök, célok, jogalapok, szolgáltatók, tárolás, megőrzés, sütik és érintetti jogok |
| [English privacy notice](PRIVACY-EN.md) | A magyar tervezet tartalmilag egyező angol változata |
| [Magyar felhasználási és felelősségi feltételek](TERMS-HU.md) | Korhatár, AI-becslések, egészségügyi korlátok, jogszerű felelősségi rendelkezések |
| [English terms of use](TERMS-EN.md) | A felhasználási feltételek angol változata |
| [Jogi kutatás és megfelelőségi hiányok](LEGAL-REVIEW-2026-11-11.md) | Elsődleges jogforrások, szerepek, szerződések, nemzetközi adattovábbítás, közzétételi feltételek |
| [Belső adatkezelési és incidenskezelési eljárásrend](GDPR-OPERATIONS.md) | Adatkezelési nyilvántartás, megőrzési terv, kérelmek, törlés, incidensek, hatásvizsgálat |

## Megerősített üzemeltetői döntések

- Az üzemeltető és a tervezet szerinti adatkezelő **Kovács Ákos**.
- Nyilvános adatvédelmi kapcsolattartás: **thisisnotka@gmail.com**.
- Az alkalmazás kizárólag **18 éven felülieknek** szól. A korhatár műszaki érvényesítése még hiányzik.
- Az üzemeltető nyilatkozata szerint a **Northflank, Cloudinary, Modal és OpenCode DPA-ját elfogadta**. A konkrét megállapodásokat, mellékleteiket, fiók- és termékkörét e vizsgálat nem ellenőrizte.
- Az üzemeltető nem kíván levelezési címet közzétenni. Címet nem találtunk ki és nem közlünk. A magyar szolgáltatói azonosítási szabályok esetleges címközlési kötelezettségét ettől még rendezni kell; a kívánság önmagában nem teremt jogszabályi kivételt.

## Mi kell a hatályba léptetéshez?

1. Véglegesíteni kell a célonkénti jogalapokat, az érzékeny adatokra alkalmazható feltételt, valamint a bizonyítható hozzájárulás és visszavonás folyamatát. A jelenlegi belépés nem rögzít ilyen hozzájárulást.
2. Meg kell valósítani és ellenőrizni a korhatárkezelést, az elkülönített opcionális AI-összehasonlítási cél kezelését, a megőrzési határidőket és a teljes körű érintetti kérelmek végrehajtását. Az önkiszolgáló felület hiánya önmagában nem jogsértés; a kérelmek tényleges teljesíthetősége nélkülözhetetlen.
3. A szolgáltatói szerződésekből meg kell állapítani az adattovábbítási garanciákat, az OpenCode végfelhasználói alkalmazásba építésének engedélyét, a modelloldali megőrzést és az önálló fejlesztési felhasználás korlátozását.
4. Az üzemeltetőnek el kell fogadnia az eljárásrendet és a megőrzési tervet, el kell végeznie az érdekmérlegelést és a hatásvizsgálati előszűrést; szükség esetén a teljes hatásvizsgálatot is.
5. Magyar adatvédelmi és szolgáltatási jogban jártas szakemberrel célszerű ellenőriztetni a végleges szöveget és a működést. Ezután kell rögzíteni a hatálybalépés dátumát, közzétenni a két nyelvű oldalakat, belinkelni őket belépés és feltöltés előtt, és a Google OAuth hozzájárulási képernyőjén is beállítani az adatvédelmi URL-t.

E dokumentációváltozás nem töröl felhasználói adatot, nem módosítja a megőrzést, nem vezet be új hozzájárulást, és nem változtatja meg a szolgáltatói fiókok beállításait.
