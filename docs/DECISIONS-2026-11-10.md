# Mai döntések és ellenőrzött állapot – 2026. november 10.

Ez az összefoglaló külön kezeli a működő megoldást, az elvégzett méréseket és a tervezett modellpróbákat. A korábbi mérési naplók változatlanok.

## Modellválasztás

**A működő páros változatlan:** Food-R1 8B BF16 a Modalon, ételnévjavaslatokhoz; Gemini 3.8 Flash az OpenCode-on keresztül, az eredeti fotók külön ellenőrzéséhez és a strukturált elemzéshez. A segéd gramm-, kalória- és makrotápanyag-becslése nem kerül át. A számítást a szerver végzi a mennyiségek és a megfelelő címke-/USDA-adatok alapján.

A Food-R1 ételfeladatokra specializált modell. A nyilvános GitHub-előzményben a 2026. június 3-i első kiadás és a június 4-i arXiv-hivatkozás-javítás szerepel; a modellfájlok június 3. óta nem frissültek. Ez korlátozott nyilvános aktivitás, nem bizonyíték a modell pontatlanságára vagy a fejlesztés végleges megszűnésére. [Tanulmány](https://arxiv.org/abs/2606.04986), [kód](https://github.com/hustvl/Food-R1), [modell-előzmények](https://huggingface.co/zy12123/Food-R1/commits/main).

| Megbeszélt jelölt | Bizonyíték és korlát | Döntés |
| --- | --- | --- |
| Qwen2.5-VL-7B-Instruct | Egy 200 ételfotós vizsgálatban a tesztelt nyílt modellek közül a legjobb felismerés; nem közvetlen Food-R1-összehasonlítás. | Régebbi mérési kontroll lehet, nem telepített csere. |
| Qwen3.5-9B | Ugyanott jobb adagbecslés, de több tévesen jelzett étel. | Kipróbálható, itt nem igazolt a fölénye. |
| Qwen3.8-27B | Frissebb, nyílt súlyú képelemző, a jelenlegi 8B-s segédnél nagyobb memóriaigénnyel. | Modalos tesztjelölt, nincs telepítve. |
| Qwen3.8-Flash | Frissebb, API-n hívható multimodális modell. | Nem igazoltan jobb a Gemini 3.8 Flashnél a Yumetrics feladatán; nincs átállás. |
| Doses-AI Boba | A nyilvános modell 0.8B-s. A kedvezőbb 2B-s eredmény másik kiadásé; ahhoz nem találtunk nyilvános súlyletöltést. | Nem keverjük a kiadások eredményeit. |

Források: [ételfelismerési vizsgálat](https://www.mdpi.com/2072-6643/18/21/3582), [Qwen3.8 modell](https://huggingface.co/Qwen/Qwen3.8-27B), [Qwen kiadási napló](https://docs.qwencloud.com/changelog/models), [Boba beszámoló](https://doses.ai/research/milkshake.html).

A [WeirdBench közös táplálkozási tesztjében](https://weirdbench.com/benchmarks/nutrition-prediction) a Gemini 3.8 Flash megelőzi a Qwen3.8-Flasht, de ez 50 étel szöveges összetevőlistájából számol, nem fotós felismerés. Ebből nem következik képelemzési győztes. A frissesség, a specializáció és a paraméterszám önmagában sem pontossági bizonyíték.

Lehetséges következő mérés: ugyanazok a lemért, ismert receptű ételek OpenCode önálló elemzésével, Food-R1-javaslatokkal, majd egy alternatívával. Külön mérendő a kihagyott/téves étel, az adag- és kalóriahiba, az idő és a költség. Ez terv, nem új eredmény. A korábbi kétételes próba sem általános modellfölény-igazolás: [eredeti mérés](FOOD-MODELS-2026-11-10.md).

## Modal-költség és leállás

A GPU és a CPU-s gateway egyszer használatos konténer, minimum és tartalék példány nélkül; kérés után megszűnik. A GPU-függvény `retries=0` beállítású. A gateway 45 másodperces korlátja és hibakezelése a modellhívás konténerét is leállító törlést kér. Minden új elemzés új modellbetöltést igényel. [Beállítások](MODAL.md).

A mai ellenőrzéskor 0 GPU- és 0 gateway-konténer, továbbá körülbelül 16,35 GiB modellfájl volt. A jelenlegi [árlista](https://modal.com/pricing) 1 TiB ingyenes Volume-tárhelyet tartalmaz; a modellkötet belefér. Kérés, külön próba vagy más alkalmazás fogyasztása nélkül az elvárt üresjárati költség **0 USD/nap**. Ez pillanatnyi állapotból számolt érték, nem teljes napos számlázási mérés. Egy egészségellenőrzés rövid CPU-futást indíthat, mások feltöltése is fogyasztás.

A havi 30 USD Starter-kredit és a 15 USD-s belső segédkeret nem azonos. Utóbbi nem teljes fiókra érvényes szolgáltatói költési plafon. Az admin becslése részösszeg, nem számla: [AI-COSTS.md](AI-COSTS.md).

## Pontosság és tartós adatok

A v17 javítja a kész ételt felülíró száraz csomagtömeget, az olvashatatlan terméknév miatt eldobott tápértéket és a más elkészítési állapotú ml-es táblázat téves egységütközését. A korábbi étkezéseket nem írjuk át automatikusan. [Regressziós esetek](CODE-REVIEW-2026-11-10.md).

Az AI-válaszok, verzió-/használati adatok, feldolgozott eredmények és legutóbbi jóváhagyások az adatbázisban maradnak; az adminban kereshetők, összevethetők és exportálhatók. Az archívum képfájlt és belső gondolatmenetet nem tartalmaz; a felismert titkokat eltávolítjuk. Étkezéstörlés után is megmarad, automatikus lejárata jelenleg nincs. A felhasználói jóváhagyás nem méréssel igazolt referencia. [Megőrzés és hozzáférés](ADMIN.md#ai-válaszarchívum).

## Felhasználói felület

Mobilon a felső sáv profilképe nyitja meg a profilt. A feltöltő tetején kamera és képkiválasztó gomb van: egy fotó kötelező, a második opcionális. A beküldés és elkészülés jól látható állapotot kap; a feldolgozási ablak alján egyetlen OK gomb szerepel.

A heti kihívásba a választás előtti, erre a hétre jogosító mentések is beleszámítanak; a már teljesített feltételért azonnal jár a pecsét. Az új mentési napok és recept-/mérésjelölések tartósak. A régi, törölt vagy felülírt események nem állíthatók elő. [Szabályok](WEEKLY-CHALLENGES.md).

Első látogatáskor Magyarországról magyar, máshonnan/ismeretlen címről angol az alapnyelv. A kézi választás elsőbbséget élvez. A DB-IP-hivatkozás a lábléc helyett a nyelvi tájékoztatóban marad. [Forrás és adatkezelés](../lib/geoip/README.md).

## Admin és üzemeltetés

Az Adminisztráció menüpont a jogosult fiók felső sávjában jelenik meg. A szerveroldali tulajdonosi ellenőrzés változatlan. Az admin csoportosított menüt, mobilos oldalválasztót, gyorshivatkozásokat, szűrőtörlést és külön beállításcsoportokat kapott. [Használat](ADMIN.md).

A november 7-i 1-es kilépést hiányzó éles konfiguráció okozta. Az indulási hibaüzenet most a hiányzó beállítások nevét közli, értékeket nem ír ki. Az SSL-figyelmeztetést a PostgreSQL `prefer/require/verify-ca` neveinek jövőbeli jelentésváltozása okozta. Az alkalmazás a jelenlegi szigorú ellenőrzést `verify-full` névvel rögzíti; nem kapcsolja ki a tanúsítvány- vagy gépnévellenőrzést, és nem rejti el általánosan a figyelmeztetéseket. Az explicit libpq-kompatibilitási választás megmarad. Az INFO-sor és a 0-s kilépési kód önmagában nem alkalmazáshiba.
