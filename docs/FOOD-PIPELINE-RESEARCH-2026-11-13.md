# A kétmodellű ételbecslés szakmai felülvizsgálata

**Friss, valós mérés (2026-11-13):** Food-R1 + Haiku adaptive/high, 4096 token; 4 étkezésből 3 menthető, átlagosan 134 kcal abszolút hiba. A négy ismert díjú hívás kb. 5,01 Ft a Modal-kredittel; a pontosság még nem megfelelő. [Eredmények és korlátok](FOOD-R1-HAIKU-LIVE-2026-11-13.md).

Dátum: 2026-11-13. A felhasználó kérése: előbb szakmailag megalapozott módszer, utána takarékos élő teszt. Megmaradt Modal-kredit: a felhasználó közlése szerint 29 USD; ez nem a kutatás elkölthető kerete. Étkezésenkénti fizetendő cél: legfeljebb 3 Ft.

## Következtetés

A Food-R1 ételnévlistájának Haikuhoz továbbítása önmagában nem igazolt pontosságnövelő módszer. A védhető felépítés külön kezeli az ételazonosságot, a mennyiségi bizonyítékot és a tápértékforrást. Ezek után a tápértéket determinisztikus kód számolja. A konkrét Food-R1 + Haiku 5.5 párosra a vizsgált forrásokban nem találtunk független pontossági igazolást.

A módszer szakmai indokoltsága és a konkrét rendszer mért pontossága két külön állítás. Az előbbi kutatással és ellenőrizhető eljárással alapozható meg; az utóbbi csak előre megtervezett mérésből derülhet ki. Négy tányér eredménye legfeljebb előszűrés, nem bizonyít általános pontosságmegőrzést vagy magyar ételekre érvényes alkalmasságot.

## Elsődleges források és következményeik

1. **Khlaisamniang és mtsai., CVPR Workshops 2025:** [Decomposing Food Images for Better Nutrition Analysis](https://openaccess.thecvf.com/content/CVPR2025W/MTF/html/Khlaisamniang_Decomposing_Food_Images_for_Better_Nutrition_Analysis_A_Nutritionist-Inspired_Two-Step_CVPRW_2025_paper.html). A szerzői összefoglaló étel-/összetevőelemzésre és külön táplálkozási számításra bontott eljárást vizsgál Nutrition320 és Gindee121 mintákon. Ez támogatja a feladatok szétválasztását, de nem bizonyítja a mi modellpárosunk fölényét. A teljes PDF lekérése 403-at adott; konkrét táblázati eredményt ezért ebből nem használunk.

2. **Mu és mtsai., ACM BCB 2025:** [Benchmarking and Improving Foundation Model Dietary Estimates from Meal Images](https://pmc.ncbi.nlm.nih.gov/articles/PMC13401436/). A mennyiségi információ hozzáadása javított egyes vizsgált modelleken. Ez alapján a megbízható tömegadat és fizikai skála érdemi bemenet, nem helyettesíthető pusztán újabb ételnévjavaslattal. A szerzők által vizsgált modellek és módszerek nem azonosak a Haiku-profilunkkal.

3. **Wang és mtsai., Current Research in Food Science 2026:** [A comparative study of vision–language models for food ingredient recognition and nutrient estimation](https://pmc.ncbi.nlm.nih.gov/articles/PMC13092701/). A több nézet és a megadott összetevők hatása modellfüggő; a helyes összetevőlista mellett is maradt jelentős tápértékhiba. A többletinformáció egyes modelleken romlást okozott. Következmény: külön kell mérni a felismerést és a tápértéket; a segédhívás haszna nem feltételezhető.

4. **Tanabe és Yanai, Nutrients 2025:** [Reasoning-Driven Food Energy Estimation via Multimodal Large Language Models](https://pmc.ncbi.nlm.nih.gov/articles/PMC11990770/). A térfogati információt és részletesebb becslési lépéseket vizsgáló tanulmányban a hatás nem minden modellnél volt kedvező. A geometriai többlet is hibás lehet. Nálunk két RGB-képből nem állítunk elő igazolt 3D-tömegmérést, és nem tételezünk fel ismert tányérméretet.

5. **Yue és mtsai., 2026-os arXiv-előközlés:** [Improving Image-Based Nutrition Estimation Through Multimodal Food-Item Verification and Recovery](https://arxiv.org/html/2610.11144v1). Külön ellenőrzi az étel szemantikai azonosságát és a mennyiségbecsléshez használható képi régiót. Segít megkülönböztetni a felismerhető ételt a jól becsülhető adagtól. A munka több lépést, szegmentálást és helyreállítást használ; eredményeit nem tulajdonítjuk a mi egyszerű kétkéréses megoldásunknak. A szerzők is megkülönböztetik a vizuális teljességet a tápértékpontosságtól.

6. **Checkpoint-proveniencia:** a [hustvl/Food-R1 szerzői repository](https://github.com/hustvl/Food-R1) a Nutrition5k-t is felsorolja a képzéshez/értékeléshez használt adatok között. A ténylegesen telepített [zy12123/Food-R1 checkpoint](https://huggingface.co/zy12123/Food-R1) modellkártyája az ellenőrzéskor üres volt. A kettő pontos képzési azonosságát és a konkrét tesztazonosítók képzési kizárását nem igazoltuk. Így a Nutrition5k-próba alkalmazásoldali összehasonlítás, nem bizonyítottan ismeretlen adatú általánosítási teszt. A rögzített modellrevízió önmagában nem oldja meg ezt.

## Indokolt feladatmegosztás

**Food-R1: javaslattevő.** Egyetlen hívásban lássa mindkét teljes képet. Rövid, összetevőszintű ételneveket adjon; ne vezessen át bizonyítatlan grammokat vagy kalóriákat a második modellbe. Az összetett, vizuálisan nem szétválasztható ételt nem szabad egyszerre teljes fogásként és minden feltételezett alkotórészként is megszámolni.

**Haiku: képi ellenőrzés és mennyiségi becslés.** Meg kell kapnia az eredeti fotókat. A segédjavaslat nem igazság és nem utasítás. A jelölteket a teljes képi leltárral összevetve fogadja el, hagyja bizonytalannak vagy utasítsa el; a kimaradt ételeket is keresse. A modellek egyezése nem indok magasabb bizonyosságra. A jelenlegi rövid audit ennek nyomon követését segíti, vizuális helyességet nem bizonyít.

**Adagbecslés külön bizonyíték alapján.** Az étel felismerhető lehet akkor is, ha a tömege a takarás vagy a skála hiánya miatt bizonytalan. Elsőbbsége van a felhasználó lemért tömegének vagy a használható csomagolási adatnak. Ezek nélkül megmarad az őszinte adagtartomány; azonosítatlan tányérból nem lesz önkényesen 26 cm-es mérce. Ismert össztömeg mellett az összetevőarányok továbbra is becslések.

**Szerver: forrásválasztás ellenőrzése és aritmetika.** Elsődleges a ténylegesen olvasható címke, majd az azonosságban és elkészítésben megfelelő, verziózott adatbázisrekord. A nyers és főtt állapot, g és ml, EU- és USA-szénhidrátalap nem keverhető. A jelenlegi 44 rekordos katalógus nem fed le minden ételt; a modell becsült tápértékét továbbra is becslésként kell megjelölni. A teszttányérok referenciaadatát tilos a modellpromptba vagy esetspecifikus szabályba visszavezetni.

**Bizonytalanság kezelése.** Rejtett olaj, cukor, szósz és elkészítési mód nem állapítható meg biztosan egy névből. Hiányukat sem bizonyítja, ha nem látszanak. A bizonytalanságot meg kell őrizni, és a felhasználó által megadott receptadat javíthatja; nem szabad kötelezően kitalált összetevőlistával kitölteni.

## Mi hiányzott az első változatból?

- A javaslatok naplózott elfogadása nem volt azonos az ételfelismerési pontosság mérésével. Külön, kézzel ellenőrzött összetevőértékelés kell.
- A gondolkodás kikapcsolását és az 1600 tokenes Haiku-korlátot költségből választottuk, nem saját pontossági bizonyítékból. Ezeket nem szabad kész szakmai optimumként kezelni. A gondolkodási mód és a válaszkeret későbbi összevetése külön kísérlet; ugyanazon páros összehasonlítás két ágában azonosnak kell maradniuk.
- Két modell eredményének egyezése nem független igazolás. Az egyik modell már látja a másik javaslatát, ezért a következtetéseiket nem tekintjük két független megfigyelésnek.
- A pontos azonosítók kizárása kezdetben nem szűrte ki a korábbi tányérhoz közeli fokozatos felvételeket. A v2-es mintában már konzervatív időbeli kizárás is van, de ez sem teljes átfedésbizonyíték.

## A következő élő próba előtt teljesítendő ellenőrzések

1. Lezárt hipotézis: a Food-R1-javaslat segít-e a Haiku önálló ágához képest? A megadott referenciától mért teljesítményt és a segéd hozzáadott értékét külön közöljük.
2. A négy minta képeit a modellválaszok ismerete nélkül kell ellenőrizni, és a célként értékelt látható összetevőket megjelölni. A nem látható, receptben lévő olaj nem ugyanaz az értékelési feladat, mint egy látható alma felismerése. Az összes hivatalos tápértékreferencia változatlanul megmarad.
3. Azonos modellprofil, prompt, képek és kontextus a páros ágakban; csak a segédjavaslat és a hozzá szükséges audit térhet el. A referenciaételnevek és tömegek ne kerüljenek a bemenetbe.
4. Jelenteni kell az összetevő-kihagyást és téves hozzáadást, az adaghiba irányát, a kcal-/makróhibákat, az érvénytelen válaszokat és minden próbálkozás költségét. A sikeres esetek kiválogatásával nem állítható javulás.
5. Négy eset előszűrés. Ha mind a négy használható, a fizetendő díj a célon belül van és nincs durva felismerési hiba, az további validálásra ad alapot; önmagában nem enged általános pontosságállítást vagy bizonyított Gemini-egyenértékűséget.
6. Az első API-hívás sémahibáját fizetős ismétlés nélkül javítjuk és szoftverteszttel ellenőrizzük. A nullázható enumokat típusonkénti `anyOf` ágakra alakítjuk, az engedett értékeket megtartva. Az élő gateway elfogadását ez a helyi ellenőrzés még nem bizonyítja.

## Élő hívások naplója a felülvizsgálat lezárásakor

Egy Haiku API-kérés történt a `dish_1558639876` képpárjával, Food-R1 nélkül. A szolgáltató HTTP 400-at adott a nullázható enum sémaformájára. Használati vagy számlázási adatot nem közölt. Nincs tápértékbecslés, és ebből pontosság nem számítható. Az ismeretlen díjat nem állítjuk nullának. Archívum: `outputs/haiku-live-solo-2026-11-13.json`.

A felhasználó újabb kérése óta további fizetős hívás nem indult. A Northflank-bejelentkezés működik, és a négy szükséges tesztváltozó hozzáférhető; az éles alkalmazás konfigurációját nem módosítottuk.
