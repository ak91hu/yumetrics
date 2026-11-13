# Valós Food-R1 + gondolkodó Haiku próba

2026-11-13. **A mért fizetendő hívásköltség belefért a 3 Ft-os célba a rendelkezésre álló Modal-kredittel; a pontosság ezen a kis mintán nem megfelelő.** Ezért ez a mérés nem indokolja a profil pontos alapmodellként való élesítését.

## Minta és beállítás

Négy előre rögzített [Nutrition5k](https://github.com/google-research-datasets/Nutrition5k) étkezés, mindegyikhez egy felül- és egy oldalnézeti RGB-kép. Az ételtömegeket a készletben lemérték, a tápértéket összetevőadatokból számolták. Licenc: CC BY 4.0, Google Research / Nutrition5k szerzők. A referenciaételneveket, grammokat és tápértékeket egyik modell sem kapta meg. Nem adtunk meg ismert össztömeget vagy tányérméretet.

Food-R1: a rögzített `c70e0d6585b1e81923432df46014d6ce32855e3f` checkpoint, rövid angol ételnévlista, egy hívás tányéronként. Haiku: `claude-haiku-5-5`, **adaptive thinking, high effort, legfeljebb 4096 összes kimeneti/gondolkodási token**, natív Anthropic Messages API az OpenCode-on. A Haiku az eredeti képeket és a segédjavaslatokat is megkapta. Az alkalmazás a válasz forrásait, egységeit és számszerű érvényességét ellenőrizte.

A négy Haiku-elemzés mind valós HTTP 200-as szolgáltatói válasz. A harmadik és negyedik tányér teljes mintabeli szerepét nem változtattuk meg az első eredmények ismeretében. Nincs promptfinomítás az elvárt kalóriákhoz, újramintavétel vagy automatikus válaszjavítás.

## Eredmények

| Étkezés | Referencia, kcal | Menthető becslés, kcal | Előjeles relatív kcal-hiba | Referencia / becsült tömeg | Becsült fizetendő díj |
| --- | ---: | ---: | ---: | ---: | ---: |
| Répa, sárgadinnye, karfiol | 68,18 | 130,90 | +92,0% | 215 / 440 g | 1,26 Ft |
| Tojás, bacon, brokkoli, eper, málna | 355,25 | 428,40 | +20,6% | 271 / 465 g | 1,27 Ft |
| Tojásfehérje, sült burgonya, bacon | 734,27 | 468,00 | −36,3% | 457 / 245 g | 1,24 Ft |
| Alma, répa, karfiol, mandula | 887,82 | **Elutasítva** | — | — | 1,24 Ft |

- **3/4 menthető elemzés**, 1/4 tartalmi validációs hiba. A hibás válasz díját is beleszámoltuk.
- A három menthető válasz átlagos abszolút kalóriahibája **134,05 kcal**, az átlagos abszolút relatív hiba **49,62%**. Ez nem azt jelenti, hogy „50,38%-os pontosságú” a rendszer.
- Az átlagos abszolút tömeghiba **210,33 g**. Mindhárom menthető kalóriabecslés kívül esett a referencia ±20%-án; a második 20,6%-kal tért el.
- A Nutrition5k teljes szénhidrátját nem hasonlítottuk össze hiányos rostadatból kitalált értékkel. A három menthető válasz teljes rostösszege ismeretlen maradt, így az alkalmazás elérhető szénhidrátja nem váltható át megbízhatóan a referencia alapjára.

Az elutasított válasz nem kapott utólag kitalált előrejelzést. Az alma `nutrients=null` értékkel és `referenceKey=null` mellett érkezett, olvasható termékcímke nélkül. Nem volt tehát miből számolni hozzá tápértéket. A szerver helyesen elutasította a teljes elemzést.

## Mit tett hozzá a kétmodellű működés?

A Food-R1 az első tányér sárgadinnyéjét **papayának** nevezte. A Haiku a végső ételnévben sárgadinnyét írt, a segédjavaslatot bizonytalanként kezelte. A kép alapján áttekintett végső ételnevek a többi tányérnál is megfelelőnek tűnnek; ez asszisztensi vizuális ellenőrzés, nem vak dietetikusi értékelés és nem általános 100%-os felismerési állítás.

A helyesnek tűnő ételnevek ellenére az adaghiba jelentős. Az első két tányért túl nagynak, a harmadikat túl kicsinek becsülte. A rántotta, a bacon és a zöldség tömeg-/tápértékhibái részben kiolthatják egymást, ezért az összkalória önmagában nem bizonyítja az összetevők helyes mennyiségét.

Nem futtattunk új Gemini-kontrollt vagy új önálló Haiku-ágat: ez a takarékos vizsgálat a kiválasztott páros referencia elleni teljesítményét méri. **Ebből nem következik, hogy a Food-R1 javított vagy rontott a Haikuhoz képest.** A javaslat kijavításának konkrét példája önmagában nem oksági összehasonlítás.

## Tényleges használat és költség

Az OpenCode mind a négy végső Haiku-válaszhoz közölt díjat, összesen **0,0113263 USD**. Bemenet: hívásonként 10 971–10 984 token; teljes kimenet, gondolkodással együtt: 3401–3555 token. A gondolkodás nincs még egyszer hozzáadva a számlázott kimenethez; belső gondolatmenetet nem mentettünk.

A forintpélda 328,16 Ft/USD átváltást, 20 USD feltöltésre ráosztott 4,6% + 0,31 USD kezelési díjat és feltételezett 27% adót használ. Ezzel a négy elemzés **összesen 5,01 Ft**, átlagosan **1,25 Ft**. Ez szolgáltatói USD-díjból számított forintbecslés, nem banki vagy adószámla.

A négy Food-R1-hívás mért modellbetöltési/elemzési erőforrásrésze **0,0457378272 USD**, kb. **15,01 Ft adó előtt**. A felhasználó által közölt 29 USD megmaradt Modal-kredit ezt a mért részt fedezi. A fizetendő számítás ettől a kreditfedezettől függ. A gateway, tárhely, üresjárat és további platformtöbblet nem szerepel ebben a részösszegben. Kredit nélkül a négy híváspár ugyanezzel a feltételezett adóval kb. **24,07 Ft**, átlagosan kb. **6,02 Ft / étkezés** volna a számítható részekre. Így a 3 Ft-os cél kredit nélkül nem teljesülne.

A teszt előtt/közben **két további Haiku-kérést HTTP 400-as sémahibával elutasított az API**. Ezek nem adtak használati vagy díjadatot, ezért költségük ismeretlen, nem állítjuk őket ingyenesnek. Az 5,01 Ft a négy díjjal rendelkező válasz ismert részösszege; a korábbi elutasítások számlázását a szolgáltatói számlával lehet véglegesíteni. A negyedik tányér tartalmi hibás, de HTTP 200-as válaszának díja viszont már benne van az 5,01 Ft-ban.

## Megvalósítás és hívásszám

Az első API-hiba a nullázható enum formáját érintette. A következő a 16 uniós sémamezőt engedő szolgáltatói korlátot: az eredeti teljes címkeséma 30-at használt. A [Claude strukturáltkimenet-dokumentációja](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#schema-complexity-limits) ezt a komplexitáskorlátot leírja.

A javítás a Haiku címkeátviteli formátumát típusos mezőlistákra alakítja, és az ismeretlen mezőket kihagyással reprezentálja. A szerver a meglévő nullázható címkemodellre alakítja vissza; nem helyettesíti az ismeretlen értékeket nullával egyenértékűnek tűnő numerikus 0-val. Az explicit, ténylegesen olvasott 0 továbbra is megmarad. A fő tápértékmezők teljességi ellenőrzése nem lazult.

Az első tányér Food-R1-válaszát a Haiku-séma javítása után ugyanazon képlenyomatokra visszajátszottuk, új GPU-hívás nélkül. **Összesen négy valódi Food-R1-hívás** történt, nem öt; a visszajátszott eredmény eredeti erőforrásdíját tányéronként egyszer számoltuk. A Haiku-hívások száma négy HTTP 200 és két korábbi HTTP 400. További fizetős próbát nem indítottunk.

A teljes szoftverteszt: **164 sikeres, 22 környezetfüggő kihagyás, 0 hiba**. Ezek az integrációt és validálást ellenőrzik, nem az ételfotós pontosságot. Az éles alapmodell automatikus átállítása nem része ennek a mérésnek.

## Döntés és további munka

A jelenlegi profil a mért hívások költségében megfelelő, de **nem ajánlható igazoltan pontos étkezéselemzőként**. A következő fejlesztési irány a mennyiségi bizonyíték: felhasználó által ismert gramm, olvasható csomagméret, valóban ismert méretű referencia és a bizonytalanság használható jelzése. Egy újabb ételnévmodell vagy a gondolkodási szint emelése nem helyettesíti a fizikai mennyiséget.

A négy ételt nem használjuk egyszerre promptfejlesztésre és változatlan „független” sikermérésre. Javítás után új, lezárt tányérokon és magyar, lemért fogásokon kell mérni. A nyilvános Nutrition5k képzési átfedése a checkpointnál nem zárható ki; a kis minta statisztikai vagy magyar konyhára vonatkozó általánosítást nem támogat.

Géppel olvasható összefoglaló, képlenyomatokkal, implementációlenyomatokkal és költségekkel: [FOOD-R1-HAIKU-LIVE-2026-11-13.json](FOOD-R1-HAIKU-LIVE-2026-11-13.json). Helyi részletes, nyilvános válaszszöveg-archívum: `outputs/food-r1-haiku-thinking-live-2026-11-13-schema2.json`. Az API-kulcsok és képbájtok nincsenek a jelentésben.
