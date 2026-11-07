# A Yumetrics magyar nyelvű szövegei

Nyelvi átdolgozás: 2026. november 7.

## Hangnem és fogalmazás

A felület közvetlenül, következetesen tegezve szól az olvasóhoz. Segít megérteni a számokat és elvégezni a következő lépést. Kerüljük az erőltetett reklámfordulatokat, a szakzsargont és az ételek erkölcsi minősítését.

- A fontos információ kerüljön a mondat elejére.
- Egy mondat lehetőleg egy gondolatot fejtsen ki. A magyarázatban hétköznapi szavakat használjunk.
- A gomb felirata nevezze meg a műveletet: „Elemzés indítása”, „Módosítások mentése”.
- Hiba esetén derüljön ki, mi történt és mit lehet tenni. A felhasználónak ne szerverkulcsok átírását javasoljuk; a beállítási hibát az üzemeltető tudja javítani.
- A fotós becslést továbbra is becslésnek nevezzük. A közérthetőség nem indokolhat erősebb pontossági állítást.
- A mesterséges intelligencia rövidítését az első részletes magyarázatnál feloldjuk: „mesterséges intelligencia (AI)”. Az USDA szerepét az útmutatóban megmagyarázzuk.
- A mértékegység jele és a szám közé szóköz kerül: „150 g”, „320 kcal”. A százalékjel közvetlenül kapcsolódik: „100%”, toldalékkal „20%-os”. A megjelenített számokat magyar területi beállítással formázzuk.

## Egységes szóhasználat

| Korábbi megfogalmazás | A felületen használt változat |
| --- | --- |
| energia-forgatókönyv | kalóriatartomány, rövid magyarázattal |
| forráspárosítás | annak ellenőrzése, hogy az adat a megfelelő ételhez tartozik-e |
| alapanyag-egyenérték | az adagra jutó alapanyag mennyisége |
| képadag | a képen látható teljes adag |
| sóegyenérték | számított sótartalom; a képlet az útmutatóban szerepel |
| USDA-referencia | USDA-adat; részletesen: az USDA élelmiszer-adatbázisából származó adat |
| AI-önértékelés | az AI saját értékelése, a pontossági korlát magyarázatával |

A technikai azonosítókat, a szolgáltatók neveit és az eredeti adatforrások címeit megőrizzük. A korábban mentett felhasználói megjegyzéseket és elemzéseket nem fogalmazzuk át. Az új AI-válaszok utasítása külön kéri a közérthető, természetes magyar nyelvet; ez önmagában nem garantál hibátlan szöveget.

## A kutatás forrásai

- [DÁP: Felhasználóbarát szövegírás](https://services.gov.hu/design-system/tartalom/felhasznalobarat-szovegiras) – a lényeg kiemelése, hétköznapi szavak, rövid és cselekvő mondatok, világos felépítés. Ezeket az elveket a Yumetrics közvetlen hangneméhez alkalmaztuk.
- [A magyar helyesírás szabályai, 12. kiadás](https://helyesiras.mta.hu/helyesiras/default/akh) – különösen a mértékegységek jelölése (279.), a jelek toldalékolása (275.) és a számok írása (290–294.).
- [Közérthető fogalmazás: Fogalmazz érthetően](https://kozerthetofogalmazas.hu/fogalmazz-erthetoen/) – az olvasó céljához igazodó szöveg, az egyértelmű szóhasználat és az egy gondolat köré szervezett mondatok, bekezdések.

Ez szerkesztési útmutató, nem nyelvészeti vagy hatósági tanúsítás.

## Magyar és angol felület

A magyar feliratokhoz tartozó angol fordítások közös szótára a `lib/translations-en.mjs`. A felület és az API hibaüzenetei ezt használják. A magyar eredeti szövegek fordítási kulcsokként is szolgálnak; változtatásukhoz a megfelelő angol bejegyzést is frissíteni kell.

Az interpolált értékek külön kerülnek a fordított mondatba, ezért a fordítás nem írja át a felhasználó nevét, ételnevét vagy megjegyzését. A HTML-szövegek fordítása a rögzített feliratokat érinti; a dinamikus, korábban megtisztított értékeket csak utána illeszti be. A dinamikus értékek HTML-escape-elése továbbra is a hívó feladata.

A nyelvváltás megtartja a feltöltési mezőket és a fotókat. A részletes szerkesztőben az aktuális beírt értékeket, a recept részleges adatait, a megnyitott részleteket és a látható hibaüzeneteket is visszaállítjuk. A dátumok és számok `hu-HU`, illetve `en-GB` formátumban jelennek meg; a belső dátum-, idő-, tömeg- és étkezéstípus-értékek közösek.

Az új fotóelemzés a beadáskor választott nyelvet a tartós `analysis_context` mezőben kapja meg. Ez az újraindulás után folytatott feladatnál is megmarad. Régebbi bejegyzésekben a hiányzó nyelv magyar alapértéket jelent; az eredeti AI-szövegeket és a felhasználói tartalmakat nem fordítjuk át utólag.

A nyilvános útmutató angol változatát ugyanebből a szótárból állítjuk elő. Mindkét útmutató önálló HTML marad, és JavaScript nélkül is olvasható.
