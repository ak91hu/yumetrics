# Hitelesebb kalóriaszámítás: kutatási döntések

A mai modellválasztási következtetések, költségfeltételek és éles működés összefoglalója: [2026. november 10-i döntések](DECISIONS-2026-11-10.md). A Qwen-modellek összehasonlítási jelöltek; nincs új modellváltás vagy új pontossági mérés.

Frissítve: 2026-11-09. A cél ellenőrizhető számítás és látható bizonytalanság. Saját, lemért magyar étkezéseken végzett modellbenchmark még nincs; ezért nem állítunk mért pontossági százalékot vagy bizonyítottan legpontosabb modellt. Négy valódi Nutrition5k-tányéron és négy külön ellenőrző bemeneten már történt szolgáltatói próba: [módszer, eredmények és fennmaradó hibák](AI-VALIDATION-2026-11-09.md).

A v4 magyar ételcsoportos megkülönböztetése, a piaci összevetés és a Nébih-források: [HUNGARIAN-POSITIONING.md](HUNGARIAN-POSITIONING.md). Az új receptszámítás és a nyers/főtt referenciavédelem működik; a tényleges fotós hibaméréshez készült külön eszköz és adatszerződés: [BENCHMARK.md](BENCHMARK.md). A szükséges hozzáférések beszerzése: [API-KEYS.md](API-KEYS.md).

## A legnagyobb javulást az ehető tömeg és a helyes referencia adja

A FAO receptszámítási módszere ehető részre korrigált alapanyagtömegekből indul. A főzés miatti tömegváltozást, a zsír/víz változását és a tápanyagveszteséget külön kell kezelni. Nyers referencia nem szorozható egyszerűen ugyanannyi gramm készétellel. Ez alapján a Yumetrics külön kéri a nem ehető részt, jelzi az össztömeg becsült felosztását, és szerkeszthetővé teszi az elkészítéshez párosított forrást. [FAO: receptösszetétel számítása](https://www.fao.org/4/y4705e/y4705e23.htm).

A FAO adatminőségi szempontjai között szerepel az étel egyértelmű azonosítása, a minta elkészítése, a nem ehető rész eltávolítása és az adatok kifejezési módjának egyezése. Következtetésünk: egy adatbázisnév vagy sok tizedesjegy önmagában nem teszi hitelessé a fotóhoz rendelt kalóriát. Ezért külön jelöljük a forrás és a párosítás ellenőrzöttségét. [FAO: adatminőség](https://www.fao.org/4/y4705e/y4705e15.htm).

## Miért kétlépéses az AI-feladat?

A 2025-ös CVPR Workshop tanulmány az étel képét összetevőkre, adagra és elkészítési információra bontja, majd külön becsüli a tápértéket. Ezt a feladatbontást használjuk; a szerzők eredményeit nem állítjuk a saját alkalmazásunk pontosságának. [Khlaisamniang és mtsai.](https://openaccess.thecvf.com/content/CVPR2025W/MTF/html/Khlaisamniang_Decomposing_Food_Images_for_Better_Nutrition_Analysis_A_Nutritionist-Inspired_Two-Step_CVPRW_2025_paper.html).

A Nutrition5k lemért komponenseket, több nézetet és mélységi információt tartalmazó kutatási adatkészlet. A két szokásos telefonos fotó ettől eltérő mérési helyzet. A második kép segítség, de nem mélységkamera és nem mérleg. [Nutrition5k, szerzői adatkészlet](https://github.com/google-research-datasets/Nutrition5k).

## Adatforrás és visszakövethetőség

A FoodData Central Foundation Foods alapélelmiszerek adatait és részletes mintaeredetet közöl; az SR Legacy lezárt történeti adattípus, a márkázott termékek pedig külön adatállomány. A források és elkészítések nem automatikusan felcserélhetők. A beépített 44 SR Legacy rekord mellett ezért a felhasználó Foundation/SR Legacy keresésből is választhat megfelelő rekordot. [USDA adattípusok](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/).

A magyar konyhai bővítés 24 új alapanyaga hivatalos USDA-letöltésből került be, nyers/főtt párokkal és a nem egyenértékű helyettesítések megjegyzéseivel. Az archívum azonosítója, ellenőrzőösszege és az összes új FDC ID: [REFERENCE-CATALOG.md](REFERENCE-CATALOG.md). A saját magyar fordítás nem teszi magyar termékadatbázissá az amerikai referenciát.

A hivatalos API keresést és FDC ID szerinti részletes lekérést ad, kulccsal és szolgáltatói korláttal. Az adat CC0. A kulcs csak szerveroldalon szerepel. Az app ellenőrzi a rekordazonosítót, az egységeket és a kötelező tápanyagokat, majd tartós másolatot tárol. A kliens által küldött, kitalált „USDA-forrás” nem válik ellenőrzött adattá. [USDA API és licenc](https://fdc.nal.usda.gov/api-guide/).

## Modellválasztás és tényleges pontosság

A választott alapmodell `gemini-4-argon`, az OpenCode natív Google generateContent útvonalán; a szolgáltató modelllistája ezt a modellazonosítót és protokollt közli. A beállított kulccsal lekért modelllista és egy valódi, kétlépéses képelemzési próba igazolta a hozzáférést. A fejlettebb Gemini 4 Carbon nem szerepelt ezen a szolgáltatói listán. Ez működési ellenőrzés, nem táplálkozási pontossági rangsor. Nincs automatikus fizetős tartalékmodell. [OpenCode modelllista](https://opencode.ai/docs/console/models/).

A Gemini 4 Argon natív multimodális modell: képet is fogad, és összetett vizuális feladatokra készült. A szolgáltatói képességlista alapján sampling paramétert nem küldünk. A gateway a `maxItems` sémamezőt a valódi próbán elutasította, ezért a tömbök hosszát a szerver validálja. [Google DeepMind modellkártya](https://deepmind.google/models/model-cards/gemini-4-argon/), [Google paraméterek](https://firebase.google.com/docs/ai-logic/model-parameters?api=vertex).

A következő, valóban pontosságot igazoló lépés 50–100 lemért, recepttel és elkészítési veszteséggel dokumentált étkezésen végzett vakteszt. Külön csoport: csontos hús, bőrös/zsíros hús, pörkölt/főzelék, öntet, olaj, vegyes tányér és nem étel. Külön értékelendő a fotó-only, össztömeges és külön lemért összetevős változat. Mérendő az adag grammhibája, kcal és makró abszolút hibája, elutasítási arány, téves párosítás, késleltetés és tényleges költség. Egy ismert recept szerinti számítás is tápanyagbecslés, nem bombakaloriméteres mérés.

Megvalósítás és korlátok: [PHOTO-ASSESSMENT.md](PHOTO-ASSESSMENT.md). Az adat- és munkamenettárolás: [NORTHFLANK.md](NORTHFLANK.md).

A v5 az egész képen látható ehető mennyiséget tekinti adagnak; fogyasztási részarányt nem alkalmaz. Mért össztömegnél a sávot is ugyanahhoz a tömeghez köti, az összetevőarányok változtatásával. A nyilvánosan közzétehető dokumentáció külön állomány: [PUBLISHING.md](PUBLISHING.md).
