# Publikálható alkalmazásdokumentáció

A nyilvános használati útmutató és módszertan magyar forrása: **[public/help.html](../public/help.html)**. Az angol fordítások a **[lib/translations-en.mjs](../lib/translations-en.mjs)** fájlban vannak. Mindkét változat reszponzív, nyomtatható HTML, bejelentkezés és JavaScript nélkül olvasható.

## A csomag elkészítése

```powershell
npm run build
```

A külön publikálható könyvtár:

```text
dist/documentation/
  index.html
  english.html
  favicon.svg
```

Az `index.html` magyar, az `english.html` angol nyelvű; mindkettő helyben fájlként is megnyitható. Az oldalak kölcsönösen hivatkoznak egymásra. A stíluslap a HTML-ben van, nincs külső betűkészlet vagy képi CDN-függőség. A három fájlt együtt tedd a statikus tárhelyre. A csomag az alkalmazástól külön is működik; nem igényel adatbázist, Google-belépést vagy API-kulcsot.

**Kizárólag ezt a háromfájlos dokumentációs könyvtárat publikáld útmutatóként.** A teljes repó, a `.env`, a `data/`, a `work/` és a tesztkimenetek nem a nyilvános dokumentáció részei. A technikai fejlesztői jegyzetek ettől külön maradnak a `docs/` alatt.

A futó alkalmazásban a magyar útmutató a `/utmutato` és `/help.html`, az angol a `/guide` és `/help-en.html` útvonalakon olvasható. A belépőoldal és a Tudnivalók ablaka a felület nyelvének megfelelő útmutatót nyitja meg. Ezek nyilvános oldalak, nem oldják fel a napló API-jának belépési követelményét.

## Mit tartalmaz?

- A teljes képen látható ehető mennyiségre vonatkozó adagszabályt.
- A használat lépéseit és a magyar konyhai támpontokat.
- A referenciaalapú, fotós és receptből végzett számítás közti különbséget.
- Az azonos össztömeggel számolt kalóriatartomány jelentését és korlátait.
- Az adatforrásokat, mértékegységeket, ismeretlen adatokat és az éles pontosságmérés helyzetét.
- A Google, OpenCode, Cloudinary, Northflank és USDA hozzáférések szerepét/beszerzését.
- A tényleges technikai adatáramlást és a képlinkek jelenlegi hozzáférési módját.

Az oldal nem állít igazolt fotós pontossági százalékot, hatósági jóváhagyást, különleges adatkezelési régiót vagy általános nulla adatvesztési garanciát. A technikai adatfejezet nem helyettesíti az adott üzemeltető saját adatkezelési tájékoztatóját. Egy ilyen szolgáltatói tájékoztatóhoz valós üzemeltetői adatok, megőrzési idők és régióbeállítások szükségesek; kitalált adatokat nem tettünk a dokumentációba.

## Frissítés és közzététel

A `public/help.html` tartalmát módosítsd, majd újra futtasd a buildet. Ellenőrizd a mennyiségi szabály, a számítási változat, az adatforrások és a külső szolgáltatások aktuális működését. A build létrehozza az új statikus csomagot; nem tölti fel külső szolgáltatásra.

Ebben a munkában a csomag előkészítése és ellenőrzése történik. Tényleges külső publikálás nem történt.
