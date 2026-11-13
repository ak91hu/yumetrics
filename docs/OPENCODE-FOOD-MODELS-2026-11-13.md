# OpenCode-modell a Food-R1 mellé: bizonyíték és költség

**Friss, valós mérés (2026-11-13):** Food-R1 + Haiku adaptive/high, 4096 token; 4 étkezésből 3 menthető, átlagosan 134 kcal abszolút hiba. A négy ismert díjú hívás kb. 5,01 Ft a Modal-kredittel; a pontosság még nem megfelelő. [Eredmények és korlátok](FOOD-R1-HAIKU-LIVE-2026-11-13.md).

2026-11-13. Forráskutatás, új fizetős modellhívás nélkül. Követelmény: a Food-R1 megmarad, a második modell eredeti fotókból ellenőriz, az étkezés becsült fizetendő AI-díja legfeljebb 3 Ft. A felhasználó által közölt maradék Modal-kredit 29 USD; nem kutatási költési engedély ennek felhasználására.

## Döntési javaslat

Az első összehasonlításra **Haiku 5.5 és GPT-6 Luna** indokolt; a jelenlegi Gemini Flash Lite kontrollként maradjon. A Haikunál nem indokolt automatikusan kikapcsolni a gondolkodást. A **Qwen3.8 Flash** olcsó tartalékjelölt, de az újonnan ellenőrzött vizuális eredmények alapján nem állítjuk a másik kettő elé. A GLM-5.3 Flash pusztán az ára alapján nem elsődleges választás. Egyik konkrét Food-R1-párosra sem találtunk független igazolást; ez jelöltlista, nem igazolt pontossági rangsor.

A niche követelményt itt konkrét feladatokra bontjuk: magyar fogás és elkészítés azonosítása, kihagyott köretek/italok észrevétele, téves Food-R1-javaslat elutasítása, tömeg/térfogat becslése, címkeolvasás, megfelelő tápértékrekord és bizonytalanság megőrzése. Egy általános képes benchmark ezeknek csak részleges helyettesítője. Egyik olcsó általános modell sem válik ételspecialistává attól, hogy a Food-R1 szövegét megkapja.

## Közvetlen ételfotós bizonyíték

**802 lemért étkezéses előközlés:** [Li, Small Average Error, Wide Individual Error](https://arxiv.org/html/2610.26538v1). A vizsgálatban Haiku 5.5 és GPT-6 Luna is szerepelt, további nagyobb modellekkel. A cél részben elfogyasztott energia, előtte/utána képekkel; nem két, ugyanazt a teljes adagot mutató nézet és nem Food-R1-együttműködés. Egy 100 ételes, feltáró részvizsgálatban a Haiku magasabb reasoning szintje 28,8%-ról 24,6%-ra csökkentette a közölt MAE%-ot, 1,7-szeres díj mellett. Ez indokolja a gondolkodó profil vizsgálatát, nem bizonyítja annak általános fölényét. A szerző szerint egyik rendszer sem érte el az egyéni egyezésre előre kitűzött határt. A Nutrition5k-ra optimalizált Haiku-pipeline más adatokra átvitele romlott: ezért a benchmarkhoz igazított kalibrációt nem visszük át automatikusan a termékbe. Nem lektorált előközlés; modell-, prompt- és célspecifikus eredmények.

**Alkalmazásfejlesztő saját összehasonlítása:** [Soba: Eight AI models compared on carb estimates](https://soba-app.com/accuracy/models/). Az első 200 étel fele Nutrition5k, fele önbevallásos SNAPMe; külön 200-as ellenőrző mintát is közöl. A Gemini Flash-család kedvező szénhidrátbecslési eredményt adott, de a sorrend az új mintán nem volt stabil. A GPT-6 Luna olcsó volt, a szénhidrátbecslése gyengébb több Gemini-beállításnál. A prompt Geminire volt fejlesztve, a fejlesztő maga is Gemini-alapú alkalmazást készít, és eltérő szolgáltatói útvonalakat használtak. Ez hasznos első kézből származó mérés, de nem független, lektorált győzteslista. A szénhidrát-találati arány nem általános ételfelismerési vagy kalóriapontossági százalék; a négyzetesen eltérő referencia-minőséget sem mossuk össze.

## Általános képi bizonyíték

A Roboflow saját, 2026-11-10-i Vision Evals-pillanatképe azonos feladatcsaládokat hasonlít össze. Ezek nem étkezési benchmarkok, és nem a mi gateway-ünkön vagy promptunkkal futottak.

| Modell | Általános képi összesítés | Vizuális reasoning | Következtetés a jelöltválasztáshoz |
| --- | ---: | ---: | --- |
| GPT-6 Luna | 69,7% | 64,2% | Olcsó második ellenőrző jelölt; adagbecslési alkalmasságot külön mérni kell. |
| Haiku 5.5 | 69,6% | 68,9% | Indokolt olcsó jelölt az ellenőrzési feladatra; nem bizonyított ételspecialista. |
| Qwen3.8 Flash | 59,7% | 35,1% | Az ára kedvező, de nem indokolt jobb vizuális ellenőrnek nevezni. |
| GLM-5.3 Flash | 55,8% | 51,0% | A költségelőny nem elég a megbízhatósági ajánláshoz. |

Elsődleges mérési oldalak: [Luna](https://playground.roboflow.com/models/openai/gpt-6-luna), [Haiku](https://playground.roboflow.com/models/anthropic/claude-haiku-5-5), [Qwen](https://playground.roboflow.com/models/qwen/qwen3-8-flash), [GLM](https://playground.roboflow.com/models/z-ai/glm-5-3-flash). A százalékok külön feladathalmazok pontszámai, nem egy konkrét étkezés helyességének valószínűségei; apró összesítési különbségből nem következtetünk győztesre.

## OpenCode-elérhetőség és költség

Forrás: [OpenCode modellkatalógus](https://opencode.ai/console/models), [díjszabás és időszakos kedvezmények](https://opencode.ai/docs/console/models/#pricing), ellenőrizve 2026-11-13. A felsorolt olcsó jelöltekhez a katalógus képbemenetet jelez. Ez nem igazolja a saját workspace jogosultságát, a JSON-séma és a képpár tényleges átadását; azokat implementációs ellenőrzés követi.

| Modell | Bemenet / kimenet, USD / 1M token | 4500 bemenet + 1600 összes kimenet, Ft | 9000 bemenet + 3200 összes kimenet, Ft |
| --- | ---: | ---: | ---: |
| Haiku 5.5 | 0,10 / 0,50 | 0,55 | 1,11 |
| GPT-6 Luna | 0,10 / 0,50 | 0,55 | 1,11 |
| Qwen3.8 Flash | 0,15 / 0,47 | 0,63 | 1,26 |
| GLM-5.3 Flash | 0,15 / 0,50 | 0,65 | 1,30 |
| DeepSeek V4.1 Flash | 0,30 / 1,20 | 1,45 | 2,89 |
| Gemini 3.5 Flash Lite | 0,30 / 2,50 | 2,37 | 4,73 |
| Gemini 3.7 Flash, aktuális kedvezménnyel | 0,75 / 3,75 | 4,15 | 8,29 |
| Claude Sonnet 5.5 | 2 / 10 | 11,06 | 22,12 |

Az értékek számítási példák, nem mérési átlagok vagy maximumok. Nincs feltételezett cache-találat. Az összes kimenetbe a fizetős reasoning is beletartozik. Átváltás: 328,16 Ft/USD, 20 USD feltöltésre ráosztott 4,6% + 0,31 USD díj, feltételezett 27% adó. A számlázás és az árfolyam ettől eltérhet; a modellek képtokenigénye sem azonos.

A Food-R1 becsült bruttó erőforrásköltsége külön tétel; csak a rendelkezésre álló Modal-kredit által ténylegesen fedezett része nem növeli a fizetendő díjat. A creditigény nem nulla erőforrásfogyasztás. Kredit nélkül a korábbi cold start már önmagában túlléphette a 3 Ft-ot. A 3200 tokenes példa nem jelenleg aktivált Haiku-beállítás: a korábbi implementáció 1600-as korlátja még nem változott meg.

## Következő szakmai döntés

Haiku 5.5 gondolkodó profilját és GPT-6 Luna profilját érdemes először ugyanabban a kétmodellű szerepben összevetni. A kimeneti keret maradjon elégséges a teljes összetevőlistára; a 3 Ft-ot nem a szükséges válasz erőszakos csonkításával célozzuk. A Food-R1 válaszát tányéronként egyszer kell lekérni, és a két ellenőrző modellnek pontosan ugyanazt a javaslatlistát adni. A tárolt segédválasz visszajátszása csak a kutatási párosításban megengedett, egyetlen valódi hívás költségének feltüntetésével; a teljes mintafutás minden kísérleti modellhívását külön számolni kell.

A kontrollt és a másik modellt a válaszok értékelése előtt rögzítjük. Külön jelentjük az ételazonosítást, téves hozzáadást, tömeghibát, kalóriát/makrókat, címkehibákat, érvénytelen válaszokat és az egy étkezéshez tartozó összes próbálkozás díját. Magyar, lemért saját fogások nélküli Nutrition5k-eredményből nem állítunk magyar konyhára igazolt niche pontosságot. A kliens/API/séma működése nem helyettesíti a táplálkozási pontosságmérést.
