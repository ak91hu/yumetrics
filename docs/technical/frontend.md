# Böngésző, képfeltöltés és felületi állapot

## Kliensoldali felépítés

A `public/app.mjs` kezeli a napló betöltését, a kiválasztott napot, a feltöltést és az eredményértesítéseket. Az `analysis-ui.mjs` az összetevők és a recept szerkesztője; a `profile-ui.mjs` a profil, a fejlődés és a kihívások nézete. A `localization.mjs` végzi a felület nyelvváltását. Az admin külön HTML-, JavaScript- és CSS-fájlokat használ.

A nézetek ugyanazokat a tartományi tápértékszámításokat használják, amelyek a szerveren is elérhetők. A szerver mentéskor ettől függetlenül újravalidál; a kliensben megjelenő eredmény nem jogosít fel ellenőrizetlen adatok tárolására.

## Kép kiválasztása és előkészítése

1. A felhasználó kiválaszt egy fényképet, vagy mobilon a kamera műveletét kéri.
2. A böngésző dekódolja a fájlt. A tényleges HEIC/HEIF-támogatás a böngésző képességétől függ.
3. Az alkalmazás a hosszabb oldalt legfeljebb **2048 pixelre** méretezi, az oldalarányt megtartva.
4. Canvasra rajzolja, majd **0,92-es minőségi paraméterrel JPEG-ként** kódolja újra.
5. Az új JPEG kerül base64 data URL-ként a JSON-kérésbe. Az eredeti fájl metaadatait, EXIF- és GPS-mezőit nem másolja át.

A második kép opcionális; másik nézőpont vagy olvasható termékcímke lehet. Két képnél azonos adagról kell készülnie a felvételeknek. A bájtra azonos képtartalom már a validálásnál elutasítható; a vizuálisan ismétlődő nézet felismerése az AI ellenőrzésének része.

!!! note "A kamera nem kizárólagos rendszerparancs"
    A kamera számára külön fájlbemenet `accept` és `capture="environment"` attribútumot kap. A böngésző és az operációs rendszer dönti el, milyen natív választót nyit meg. Ez nem folyamatos kamerastream és nem garantál azonos viselkedést minden telefonon.

## Beküldés és háttérmunka

A böngésző UUID-t rendel a kéréshez. A szerver a képeket tartósan feltölti, majd `202 Accepted` választ ad. Ez a visszajelzés nem az elemzés elkészültét jelenti. A kliens a napló frissítésével követi a háttérfeladat állapotát; nincs WebSocket vagy külön push-szolgáltatás.

A folyamatjelző ablak OK gombja bezárja az ablakot, miközben a tartós feladat folytatódik. Az elkészült, még nem mentett elemzés az oldal tetején is látható, kiemelt értesítést kap. A felhasználó innen nyithatja meg az ellenőrzést. A végleges mentéshez külön jóváhagyás kell.

A felület megőrzi a szerkesztést lassabb válaszok és nyelvváltás közben. Az elavult profilbetöltések nem írhatják felül az újabb nézetet; a heti teljesítés üzenete ugyanazon héten háttérfrissítés után is megmarad.

## Szerkesztés és eredetjelölés

Az összetevő neve, mennyisége, elkészítése, egysége és tápértéke javítható. A forrásadatok kézi módosítása megszüntetheti az ellenőrzött referencia- vagy címkeeredetet: a program nem hagy rajta hitelesített jelölést egy már eltérő értéksoron. A mentett revízió ütközését a felület jelzi; másik ablak újabb adatait nem írja felül észrevétlenül.

A részletes táblázat összetevőnként és az egész étkezésre mutatja az adatokat. A grammos és milliliteres mennyiségek külön maradnak. Az ismeretlen tápanyagot „—” jelöli; nem helyettesíti nullával.

## Reszponzivitás és hozzáférhetőség

A mobilos felső sávban a Google-profilkép vagy annak monogramos helyettesítője nyitja a profilt. Az adminmenü kizárólag a jogosult fióknál jelenik meg. A széles táblázatok saját görgethető területet kapnak.

A vezérlők címkékkel, szemantikusan megfelelő gombokkal és állapotjelző régiókkal készülnek. A kérdőjeles súgók egérrel, érintéssel és billentyűzettel használhatók; Escape-pel bezárhatók. A grafikonokhoz táblázatos adatok is rendelkezésre állnak. A böngészős teszt több képernyőszélességet vizsgál, de ez nem teljes körű akadálymentességi tanúsítás.

Források: [kliens](https://github.com/ak91hu/yumetrics/blob/main/public/app.mjs), [elemzésszerkesztő](https://github.com/ak91hu/yumetrics/blob/main/public/analysis-ui.mjs), [súgók](https://github.com/ak91hu/yumetrics/blob/main/public/context-help.mjs).
