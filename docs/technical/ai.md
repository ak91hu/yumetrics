# AI-szolgáltatók és Modal

## Szerepek szétválasztása

A képelemzés két eltérő feladatot választ szét. A Food-R1 ételfeladatokra specializált, helyben futtatható vision-language modell; itt rövid ételnév-javaslatokat ad. Az OpenCode-on elért Gemini az eredeti képeket önállóan ellenőrzi, és az alkalmazás adatszerződésének megfelelő teljes elemzést állítja elő. A Food-R1 mennyiségi és tápanyag-becslése nem öröklődik át.

| Tulajdonság | Food-R1 segéd | OpenCode-elemzés |
| --- | --- | --- |
| Modellazonosító | `zy12123/Food-R1`, alkalmazásban `modal/food-r1-8b` | Alapértelmezetten `gemini-3.8-flash` |
| Bemenet | Az étkezés előkészített képei | Eredeti képek, felhasználói kontextus, referenciajegyzék, opcionális névjavaslatok |
| Kimenet | Legfeljebb 20 rövid ételnév | Képminőség, ételnevek, összetevők, mennyiségek, források, feltételezések |
| Kötelező a működéshez? | Nem; hiba vagy keretkorlát esetén kihagyható | Igen, az új fotós elemzéshez |
| Tárolás | Külön hívásrekord és szűrt válasz | Külön hívásrekord, elemzés és jóváhagyott változat |

## Modal-környezet

A `scripts/modal_foodr1.py` külön telepíthető Python-alkalmazás. A rögzített modellrevízió `c70e0d6585b1e81923432df46014d6ce32855e3f`; ez megakadályozza, hogy egy változó `main` ág észrevétlenül megváltoztassa az éles modellt. A súlyok Modal Volume-on találhatók. A GPU-osztály L40S-t, két CPU-magot és 16 GiB rendszermemóriát kér, a modellt BF16 formában tölti be.

A generálás determinisztikus beállítású (`do_sample=False`), legfeljebb **160 új tokennel**. A felismerő saját promptverziója `food-r1-visible-foods-v2`; a válasz modellrevíziót, promptlenyomatot, feldolgozási és modellbetöltési időt is tartalmazhat.

A HTTP-gateway külön, kis CPU-s konténer. Az interneten elérhető végpont Modal proxy-hitelesítést igényel. Az alkalmazás csak a konfigurált, ellenőrzött `*.modal.run/recognize` URL-t hívja. A Northflankhoz a proxy token azonosítója és titka kell; a helyi Modal-telepítési kliens tokenje más jogosultságú, nem az alkalmazás HTTP-hitelesítője.

## Konténer-életciklus és időkorlátok

- GPU és gateway: `min_containers=0`, `buffer_containers=0`, `max_containers=1`.
- Mindkettő `single_use_containers=True`: egy kérés kiszolgálása után a konténer megszűnik.
- GPU: `retries=0`, 90 másodperces végrehajtási és 60 másodperces indulási korlát.
- Gateway: körülbelül 45 másodperces várakozás a modellhívásra; időtúllépésnél vagy hibánál `cancel(terminate_containers=True)` leállítást kér.
- A Node oldali Modal HTTP-kérés 60 másodperces megszakítási jelzést használ.

A különböző időkorlátok nem összeadandó átlagos futásidők. A hideg modellbetöltés a gyakorlatban növelheti a késleltetést. Az egykonténeres korlát és az egyszer használatos működés tudatos költségválasztás, amely nagyobb párhuzamos terhelésnél várakozást vagy segédkihagyást okozhat.

## A segédválasz bizalmi szintje

A Node-adapter ellenőrzi a modellt, a revíziót, a csonkolásjelzést és a JSON alakját. A névlista mérete, a nevek hossza és megengedett karakterei korlátozottak; az ismétlődések eltűnnek. A jelöltek `untrustedRecognitionCandidates` mezőben kerülnek a második modellhez.

A Gemini utasítása külön előírja, hogy a javaslatok tévesek lehetnek: azokat a képekkel kell összevetnie, az alá nem támasztott elemeket el kell vetnie, a kihagyott ételeket pedig önállóan kell keresnie. A felhasználói megjegyzés, a képen látható szöveg és a segédválasz adat, nem magasabb szintű utasítás. Ez csökkenti a hibák átvételét, de nem jelent matematikai prompt injection elleni garanciát.

## OpenCode és strukturált kimenet

A szolgáltatói kérés JSON-választ és JSON Schema szerinti szerkezetet kér. Egyetlen részletes OpenCode-hívás végez képleltárt, adagbecslést, képpár-ellenőrzést, címkeolvasást és végső önellenőrzést. Hiányos válaszra nincs automatikus, külön javító AI-kérés.

A szerver a kimenetet ismét ellenőrzi: az érvényes JSON önmagában kevés. Kötelező mezők, elemszámok, egységek, tápértékhatárok, forrásegyezés és elkészítési állapot is része az ellenőrzésnek. A prompt jelenlegi alkalmazásverziója `food-v17-label-preparation`. Az adminból megadható modellnév csak a meglévő Gemini-kompatibilis szolgáltatói útvonalra vonatkozik; nem telepít másik adaptert.

## Megfigyelhetőség és értékelés

A hívás előtt rögzül az archívum alaprekordja. A válasz után HTTP-státusz, idő, tokenek, árazási pillanatkép, szűrt válasz és feldolgozott eredmény kerülhet hozzá. A képek SHA-256-lenyomata lehetővé teszi az azonos bemenetek összekapcsolását a képbájtok archívumba másolása nélkül.

A modellfrissítéshez ugyanazon, lemért ételekből álló referenciakészleten érdemes vizsgálni a kihagyást, téves felismerést, adaghibát, kalóriahibát, időt és költséget. A gyártói benchmark vagy a modell újabb neve nem helyettesíti ezt. Jelenleg nincs automatikus modelltréning vagy automatikus modellcsere.

Források: [Modal-alkalmazás](https://github.com/ak91hu/yumetrics/blob/main/scripts/modal_foodr1.py), [OpenCode-adapter és schema](https://github.com/ak91hu/yumetrics/blob/main/lib/providers.mjs), [Modal-adapter](https://github.com/ak91hu/yumetrics/blob/main/lib/modal-food.mjs), [Modal életciklus](https://modal.com/docs/guide/cold-start).
