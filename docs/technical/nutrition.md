# Tápértékszámítás és adatforrások

## Az összetevő mint számítási egység

Minden felismert étel, ital, köret és szósz önálló, névvel ellátott összetevőként jelenhet meg. Az összetevő tárolt mennyiségi mezője történeti okból `grams`; a `quantityUnit` dönti el, hogy a szám **g** vagy **ml** egységű. Milliliterből a program nem képez automatikusan grammot, mert ehhez ismeretlen sűrűséget kellene feltételeznie.

| Mezőcsoport | Jelentés |
| --- | --- |
| `name`, `preparation`, `foodState` | Azonosítás és elkészítési állapot |
| `grams`, `quantityUnit` | Ehető mennyiség g-ban vagy ml-ben |
| `gramsMin`, `gramsMax`, `weightBasis` | Mennyiségi tartomány és eredet |
| `calories`, `protein`, `carbs`, `fat` | Energia és fő makrotápanyagok 100 egységre |
| `fiber`, `sugar`, `sodium`, `saturatedFat` | Opcionális tápanyagok; az ismeretlen érték `null` |
| `sourceType`, `referenceKey`, `productLabel` | Forrás és megőrzött bizonyíték |
| `visibility`, `portionNote`, `alternatives` | Látható/tételezett jelleg és bizonytalanság |

Az energia kcal, a nátrium mg, a többi felsorolt tápanyag g egységű. A nátrium és a só nem azonos adat.

## Determinisztikus adagra vetítés

```text
összetevő_tápanyag = mennyiség × tápanyag_100_azonos_egységre / 100
étkezés_tápanyag = Σ összetevő_tápanyag
```

Példa: 150 g, 200 kcal/100 g alapú étel 300 kcal. Egy 250 ml-es ital 40 kcal/100 ml mellett 100 kcal. A két energia összeadható; a 150 g és a 250 ml nem adható össze egy közös tömegként.

Ha valamely összetevő opcionális tápanyaga ismeretlen, az összesített adat nem állíthatja, hogy a hiányzó rész nulla. Az `analysisReport()` külön felsorolja az ismeretlen tápanyagokat, valamint az ételenkénti és összesített eredményt. A megjelenítési kerekítés nem új tápértékforrás.

## Forrásellenőrzés

### Termékcímke

Az olvasható címke megőrzi az eredeti vonatkoztatási alapot, annak egységét, a termék és a tápanyagok adatait. Nem 100-as alap esetén a program átszámítja az értékeket. A kJ/kcal és a só/nátrium kezelését a címkemodul végzi; a sóból számolt nátrium alapja `nátrium_mg = só_g × 1000 / 2,5`.

A címke csak megfelelő termékhez, egységhez és elkészítési állapothoz kapcsolható. A száraz csomag nettó tömege nem írhatja felül az elkészített étel adagtömegét. Olvashatatlan terméknév mellett a használható címketápérték megmaradhat, a név bizonytalanságának jelzésével. Eltérő elkészítési állapotú ml-es táblázat nem számít automatikusan az aktuális étel egységütközésének.

### USDA-referencia

A beépített katalógus 44 rögzített rekordot tartalmaz. A modell forráskulcsot javasolhat, de a szerver tölti ki és ellenőrzi a tényleges tápértéket. Az élő FoodData Central-kereséshez külön szerveroldali API-kulcs kell; a kiválasztott rekord változatlan másolata az adatbázisban marad.

Az élő rekord kulcsa FDC-azonosítót és a rekordtartalom hash-részletét tartalmazza. A lekérési gyorsítótár 24 órás frissességgel dolgozik; a már mentett forrás nem változik meg egy külső adatfrissítéstől. Nyers és elkészített állapot nem cserélhető fel ellenőrzés nélkül. Egy amerikai referencia magyar ételre való megfelelősége külön szakmai kérdés.

### Becslés és felhasználói adat

Megfelelő címke vagy referencia hiányában a tápérték AI-becslésként jelölt marad. Kézi átírás után a forrás `user` lehet. A referenciajelölés csak akkor marad, ha az értékek ténylegesen egyeznek a tárolt forrással; pusztán egy `referenceKey` elküldése nem igazolja az adatot.

## Teljes tömeg és külön mérések

A teljes ételtömegből levonható a külön lemért nem ehető rész. A maradék ehető tömeg az összetevők arányosítására használható, de önmagában nem mondja meg a hús, köret és zsiradék helyes arányát. Külön lemért összetevő erősebb mennyiségi adat, mint a vizuális becslés.

Ml-es tétel jelenlétében a grammos össztömeg nem osztható szét automatikus sűrűségfeltételezéssel. A két fénykép ugyanazon teljes adagot írja le; nincs kép szerinti mennyiségduplázás vagy automatikus „elfogyasztott százalék”.

## Saját recept

```text
adagarány = képen_látható_adag_g / teljes_kész_étel_g
adag_tápértéke = teljes_recept_tápértéke × adagarány
```

A recepthez a teljes kész étel lemért tömege, az adag tömege és az ételben maradt alapanyagok szükségesek. A felhasználónak jeleznie kell, hogy a veszteségeket figyelembe vette (`lossesAccountedFor=true`). A nyers alapanyagtömegek összege nem helyettesíti a főzés utáni hozamot. A számítás nem tesz hozzá még egyszer egy „kész étel” összetevőt az alapanyagokhoz.

A teljes kész tömeg legfeljebb 50 000 g; az adag legfeljebb 5000 g és nem lehet nagyobb a teljes receptnél. A receptre váltás nem igényel új AI-hívást, az eredeti elemzés megmarad.

## Validálás és bizonytalansági tartomány

Egy elemzés 1–40 összetevőt tartalmazhat; az egyedi mennyiség pozitív és legfeljebb 5000 g/ml. A validálás kiszűri a nem véges számokat, a hibás egységet, az ellentmondó tartományt és a megengedett tápértékhatárok túllépését. A cukor nem lehet lényegesen több a szénhidrátnál, a telített zsír az összes zsírnál. Egyes további eltérések figyelmeztetést adnak.

Ismert ehető össztömegnél az energiatartomány azonos össztömeg mellett változó összetételt vizsgál: az alsó tömeghatárokból kiindulva az alacsonyabb vagy magasabb energiasűrűségű elemeket tölti fel a megengedett határig. Ismeretlen össztömegnél az egyedi adaghatárok adják a forgatókönyveket.

Ez **nem statisztikai konfidenciaintervallum**, és a felismerési hibát nem fedi le garantáltan. Az AI `confidence` mezője sem méréssel kalibrált valószínűség.

Források: [tartományi algoritmusok](https://github.com/ak91hu/yumetrics/blob/main/lib/domain.mjs), [címkék](https://github.com/ak91hu/yumetrics/blob/main/lib/product-label.mjs), [USDA-adapter](https://github.com/ak91hu/yumetrics/blob/main/lib/food-data.mjs), [FoodData Central](https://fdc.nal.usda.gov/).
