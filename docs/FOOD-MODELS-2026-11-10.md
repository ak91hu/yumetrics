# Ételspecialista modell választása – 2026. november 10.

**Döntés:** Food-R1 8B, az eredeti BF16-súlyokkal a Modalon, az OpenCode által külön ellenőrzött ételfelismerő segédként. A kisebb Boba helyett a nagyobb, pontosságot előtérbe helyező választás került be. Széles körű, független felhasználói konszenzust egyik vizsgált nyílt ételspecialistánál sem találtunk; ezt nem pótolja a csillagok vagy letöltések száma.

## Kutatás és visszajelzések

| Jelölt | Ellenőrzött tapasztalat és korlát | Döntés |
| --- | --- | --- |
| [Food-R1](https://github.com/hustvl/Food-R1) | Qwen3-VL-alapú, körülbelül 8B paraméteres, több ételfeladatra tanított modell. Másik fejlesztő összehasonlításában 77,0 kcal MAE Nutrition5k-n; kevés felhasználói komment. | A nagyobb, nyílt jelöltek közül ezt tartjuk meg; a tápértékszámait nem vesszük át. |
| [FoodLMM](https://github.com/YuehaoYin/FoodLMM) | Célzott ételfelismerés és szegmentálás, régi PyTorch/Transformers-környezet és [nyitott futtatási kérdések](https://github.com/YuehaoYin/FoodLMM/issues). | Nem adott meggyőzőbb gyakorlati alapot a meglévő Food-R1 cseréjére. |
| [Boba 0,8B](https://huggingface.co/Doses-AI/boba-0.8b-food-GGUF) | Kicsi, Apache 2.0 licencű modell. A nyilvános kártya 112,3 kcal hibát közöl; a kedvezőbb 2B-s reklámeredmény másik modellre vonatkozik. | Takarékos jelölt, de a felhasználó nagyobb, pontosabb modellt kért. |
| [LayaMacro](https://huggingface.co/Aquos06/LayaMacro) | Gyors, bizonytalansági tartományt ad; pozitív [közösségi komment](https://www.reddit.com/r/computervision/comments/1x48nux/opensource_one_meal_photo_calories_macros_with/) érkezett az eljárásra. Nem kereskedelmi licenc és 243 tanult ételnév. | A nyilvános alkalmazás tartós alapjának nem választottuk. |
| [CalorieK](https://huggingface.co/Dralkh/CalorieK) | Közzétett összehasonlítás és korlátok; új fotótípusoknál jelentős hibák. Öt összesített számot adó regressziós modell, nem szabad ételnév-listát készítő LLM. | Önmagában nem teljesíti a külön ételnevekre és összetevőkre vonatkozó igényt. |

A [Boba Reddit-beszélgetésében](https://www.reddit.com/r/SideProject/comments/1stf912/i_built_boba_a_free_ai_calorie_tracker_with_no/) van lelkes érdeklődés és kedvező visszajelzés a használhatóságra, de a sebesség és a rejtett összetevők felismerése kapcsán kritika is. Az [App Store két értékelésből számolt 4,0 pontja](https://apps.apple.com/us/app/boba-local-ai-calorie-tracker/id6762167487) alkalmazásértékelés, és memória miatti összeomlást is említenek. Ezekből nem következik a letölthető 0,8B-s modell igazolt pontossága.

A [CalorieK készítőjének külsőmodell-összehasonlításában](https://huggingface.co/Dralkh/CalorieK#comparison-with-open-source-calorie-vlms-same-protocol) a 8 bites Food-R1 hibája 77,0 kcal volt Nutrition5k-n. Ez külön fejlesztő mérése, nem semleges, magyar ételeken végzett tanúsítás. Az ugyanott Boba néven szereplő 79,5 kcal-os adat az opengvlab/Boba modellre hivatkozik; azonosságát a Doses-AI kiadásával nem igazoltuk, ezért ebből nem állítunk közvetlen előnyt a Doses-AI Boba modelljével szemben. A Food-R1 MM-Food-100K eredményét a szerző nem tekinti új eloszlású tesztnek, mert a tanítóadata kapcsolódik hozzá. A GGUF-eredmény nem bizonyítja minden formátum azonosságát; a telepítés eredeti BF16-súlyokat használ.

## Beépített működés

A Food-R1 csak ételnév-javaslatokat ad. Az OpenCode az eredeti fotókat és a felhasználó megadott adatait is megkapja; a segéd válaszát nem megbízható javaslatként kezeli. A képen nem igazolható jelölteket el kell vetnie, a kimaradt ételeket önállóan fel kell ismernie. A segéd gramm-, kalória- és makrotápanyag-becsléseit nem adjuk tovább.

Étkezésenként legfeljebb egy segédhívás és egy OpenCode-kérés indul. A segéd hibája, hiányos válasza, rossz verziója, időtúllépése vagy a belső havi keret elérése esetén az OpenCode önállóan folytatja. A szerver megőrzi a két hívás külön költségrekordját; a normál felhasználónak nem jelenik meg szolgáltatói állapotjelzés. A fotófeldolgozókról szóló tájékoztatást magyarul és angolul frissítettük.

## Korlátozott páros próba

Két, korábban is vizsgált Nutrition5k-étkezés szerepelt: csirkés saláta és pizza külön csirkével, ananásszal, paradicsommal. Mindkét ágon ugyanaz a két RGB-fotó szerepelt, megadott össztömeg nélkül. A referencia lemért összetevőkből és USDA-adatokból származik, nem laboratóriumi energiamérésből. A modell a referenciaértékeket nem kapta meg.

| Eset | Referencia | OpenCode önmagában | Food-R1 + OpenCode |
| --- | ---: | ---: | ---: |
| Csirkés saláta | 380,32 kcal | 230,8 kcal | 234,9 kcal |
| Pizza és külön köretek | 927,81 kcal | 706,7 kcal | 730,8 kcal |
| Átlagos abszolút hiba | — | 185,32 kcal | 171,22 kcal |

A Food-R1 a salátánál Caesar-öntetet is javasolt; az OpenCode ezt elvetette. A pizzás tányér négy fő elemét a segéd külön felsorolta. A kezdeti segédválasz fölösleges magyarázatot generált; a végleges kód megáll a kész étellistánál. A két végső segédválasz 23 és 17 tokent használt, az elemzés 2,699 és 2,110 másodperc volt, a betöltéssel együtt 20,417 és 19,087 másodperc.

Az OpenCode összes díja a két alapfutásban 0,047787 USD, a két segített futásban 0,0456885 USD volt. A segéd mérhető betöltési és elemzési erőforrásrésze további 0,02384935488 USD. A segített ág ismert részösszege tehát 0,06953785488 USD: az erőforrásköltség nőtt. A Modal ingyenes kerete fedezheti a segéd díját, de ez nem általános költségcsökkenési garancia. A négy OpenCode-futás és a két végső segédhívás ismert részösszege 0,11732485488 USD, a gateway, tárhely és indulási többlet nélkül.

Az alapág is ugyanazt a segédellenőrzési utasítást kapta, üres jelöltlistával; a végleges kód üres lista esetén ezt az utasítást is kihagyja. A segédet egyszer kérdeztük le étkezésenként, a segített ágban ezt a rögzített választ adtuk át, újabb GPU-hívás nélkül. A sorrend alapág, majd segített ág volt, ismételt mintavétel nélkül.

**Korlát:** két ismert étkezés nem bizonyít általános javulást. A modellek ismerhették a nyilvános adatkészletet, a mennyiségbecslés továbbra is jelentős hibaforrás. Magyar fogásokon és saját lemért ételeken külön, előre rögzített vizsgálat szükséges. [Géppel olvasható mérési napló](FOOD-MODELS-2026-11-10.json).
