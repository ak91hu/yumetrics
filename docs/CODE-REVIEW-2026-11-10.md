# Az ételfelismerés és kalóriaszámítás felülvizsgálata

Áttekintett útvonal: Food-R1-javaslatok → OpenCode-képelemzés → címke/USDA/adag → recept és összesítés → mentéskori forrásellenőrzés → felhasználói megjelenítés. Javításverzió: `food-v17-label-preparation`.

## Javított hibák

1. **Az elkészített étel mennyiségét felülírhatta a száraz csomagtömeg.** A reprodukált esetben 300 g kész ételből 100 g lett; 42 kcal/100 g mellett ez 126 helyett 42 kcal-t eredményezett. Most csak értékesített állapotú terméknél használjuk automatikusan a nettó csomagmennyiséget. Az elkészítés utáni tápérték nem adja meg a kész étel tömegét. A mentéskori ellenőrzés is ezt követi.
2. **A rendszer eldobta az olvasható tápértéket, ha a terméknév nem volt olvasható.** Most megmaradnak a címke számai, az eredeti címke neve továbbra is ismeretlen. Az általános ételnév képi becslésként szerepel, külön figyelmeztetéssel; a modellbizonyosság legfeljebb közepes. Nem találunk ki márkát vagy termékváltozatot.
3. **A száraz por és az elkészített ital eltérő egysége téves elutasítást okozott.** Az elkészített ital 100 ml-es táblázatát nem alkalmazzuk a száraz por grammjaira. Az eredeti táblázat megmarad, a megfelelő állapothoz tartozó önálló becslés AI-forrású marad. Becsült adat hiányában továbbra is elutasítjuk az elemzést; sűrűség nélkül nem váltunk g és ml között.

## Ellenőrzés

A három regressziós próba a javítás előtt hibával végződött, utána sikeres. A teljes tesztsor **157/157 tesztje sikeres**, valódi helyi PostgreSQL-lel és külön admin-tesztadatbázissal, kihagyás nélkül. A próbák szimulált szolgáltatói válaszokat használnak, ezért nem fogyasztanak AI-kreditet.

Az összetevőnkénti és összesített számítás, a receptarányosítás, a nem ehető tömeg levonása, az ismeretlen tápanyagok kezelése és a forrásadatok védelme továbbra is tesztelt. A címke/USDA közölt energiáját nem írjuk felül a 4/4/9 képlettel. A Food-R1 kizárólag neveket javasol; az OpenCode az eredeti fotókat ellenőrzi, a segédmodell gramm- vagy kalóriabecslése nem kerül át.

## Korlátok és források

A régi bejegyzések eredeti eredményét nem írjuk át automatikusan; az esetleg érintett korábbi adagokat kézzel kell ellenőrizni. A pontos aritmetika nem igazolja a fotós felismerés, adagbecslés vagy címkeolvasás pontosságát. Új fizetős képelemzést és új modellpontosság-mérést nem indítottunk; új általános pontossági százalékot nem állítunk. Ez a felülvizsgálat a táplálkozási számításokra összpontosított, nem általános biztonsági audit.

- Az értékesített és elkészített tápérték különbsége: [1169/2011/EU, 31. cikk (3)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011R1169).
- Rostot is tartalmazó összes szénhidrát, specifikus energiafaktorok: [USDA Foundation Foods](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/).
- Energiafaktorok és korlátaik: [FAO](https://www.fao.org/4/Y5022E/y5022e04.htm).
