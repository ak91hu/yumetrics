# Beépített referenciatár: 44 rekord

Bővítve: 2026-11-07. A tár ellenőrizhető alapanyagokat ad a magyar konyhai számításokhoz, nem rögzített kalóriaértéket egy ismeretlen receptű főzelékhez vagy pörkölthöz. Minden rekord FDC-azonosítót, angol forrásnevet, adattípust, letöltési dátumot, linket és 100 g-ra adott értékeket őriz. A magyar címkék saját fordítások, nem magyar termékek hatósági adatlapjai.

## Az új, magyar konyhában is használható rekordok

| Alapanyag | FDC ID | Állapot / fontos korlát |
| --- | --- | --- |
| Sertéslapocka hússal és zsírral | 167843 / 167844 | Nyers / sütve; nem csülök vagy pörkölt |
| Savanyított tejszín, USDA sour cream | 171257 | Nem konkrét magyar márka vagy igazolt 12/20%-os tejföl |
| Fehér búzaliszt | 169761 | Száraz alapanyag, nem kész rántás/panír |
| Napraforgóolaj | 171025 | Csak az ételben maradt mennyiség |
| Sertészsír | 171401 | Kész zsiradék |
| Vöröshagyma | 170000 / 170001 | Nyers / vízben főtt; utóbbi nem olajon pirított |
| Fejes káposzta | 169975 / 169976 | Nyers / vízben főtt, só nélkül |
| Őrölt fűszerpaprika | 171329 | Száraz fűszer |
| Egész tojás | 171287 | Nyers |
| Burgonya | 170026 | Nyers, héjjal |
| Tojásos tészta | 169755 / 168926 | Száraz / főtt, hozzáadott só nélkül; nem ismeretlen receptű nokedli |
| Zöldborsó | 170420 | Főtt, lecsöpögtetve, só nélkül; nem teljes főzelék |
| Vörös vesebab | 173744 / 175194 | Száraz / főtt, só nélkül |
| Savanyú káposzta | 169279 | Konzerv, lével; nem tetszőleges erjesztett/lecsöpögtetett változat |
| Vaj | 173430 | Sótlan |
| Kristálycukor | 169655 | Kész alapanyag |
| Ivóvíz | 173647 | USDA csapvíz-referencia |
| Fokhagyma | 169230 | Nyers |
| Zsemlemorzsa | 174928 | Száraz, fűszerezetlen; nem olajat felszívott kész panír |

A korábbi 20 rekord teljes adattartalma változatlan maradt. Nincs „rögös túró” névre átkeresztelt cottage cheese és nincs generikus amerikai kolbász magyar házikolbászként feltüntetve. Ha nincs megfelelő rekord, jelölt becslés, saját címke vagy ismert recept szükséges. A kiválasztott állapot és az ételhez párosítás továbbra is ellenőrizendő.

## Az adatátvétel bizonyítéka

Az új 24 rekord a [FoodData Central hivatalos letöltési oldalán](https://fdc.nal.usda.gov/download-datasets/) szereplő **SR Legacy April 2018 JSON** állományból származik. A [közvetlen archívum](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip) SHA-256 értéke a tényleges letöltéskor:

```text
0fe8ae486a2c8eb42cb96413f058deb51863a46c8fb8eeb4b1fb45006dd338ef
```

Az archívumban 7793 rekord volt. Az új rekordok `sourceDownload` mezője ezt a forrást jelöli. A letöltés dátuma nem azt jelenti, hogy a tápértéket 2026-ban újramérték. A kiadvány saját értékeit tároljuk; hiányzó értéket nem pótolunk nullával és nem találunk ki több tizedesnyi pontosságot. A szénhidrát a korábbi alkalmazáskonvenció szerint az USDA carbohydrate-by-difference mínusz rost közelítés. Az USDA adat CC0; az adatforrás feltüntetését kérik. [USDA API és licenc](https://fdc.nal.usda.gov/api-guide/).

A szerver és a kliens a magyar címke mellett a teljes angol leírást és a szükséges párosítási megjegyzést is használja/mutatja. A cél a megfelelő állapotú rekord, nem a legközelebbi hangzású név. Ez a megközelítés a food matching dokumentált szerepéhez igazodik. [FAO/INFOODS food matching útmutató](https://www.fao.org/fileadmin/templates/food_composition/documents/Nutrition_assessment/INFOODSGuidelinesforFoodMatching_version_1_2.pdf).

## Újragenerálás és korlát

Fejlesztői bővítéshez a hivatalos archívumot bontsd ki a helyi `work/` alá, majd a teljes `SRLegacyFoods` JSON-fájlt vagy annak változatlan kiválasztott rekordjait add át:

```powershell
node scripts/update-food-reference.mjs work/usda-selected-raw.json
```

Az új FDC ID-k, magyar címkék és korlátok a script listájában, az állapotok a `lib/hungarian-food.mjs` fájlban szerepelnek. A script validálja az új rekordokat, és a már publikált pillanatképeket megőrzi. Ezt nem automatikus adatfrissítésként használjuk. A változtatást felül kell vizsgálni: egy új fordítás nem bizonyít azonos terméket vagy elkészítést.

Paraméter nélkül a script egy fejlesztői batch API-lekérést használ a dokumentált DEMO_KEY-val. Ennek szűk kérési korlátja van; 429 esetén a script leáll, nem írja felül a katalógust. Az alkalmazás futás közben nem használ DEMO_KEY-t. A kész 44 rekordhoz nincs szükség USDA-kulcsra; az élő kereséshez saját `USDA_API_KEY` kell.

Ettől a bővítéstől nem lett mért fotós pontossági eredmény. A tesztek az adatbetöltést, forrásazonosítót és receptalgebrát ellenőrzik; az ismert alapanyagokból összeállított szoftverpélda nem fizikai ételmérés.
