# Valódi pontosságmérés magyar étkezéseken

A `scripts/evaluate-nutrition.mjs` az aktuális felismerést egy független, lemért referencia ellen futtatja. **Ehhez a verzióhoz nincs mért pontossági eredmény:** nincs megadott, függetlenül lemért magyar fotós tesztkészlet. A generált csülök-dekoráció és a szoftverteszt képei nem ilyen referenciák.

## Adatkészlet

Használj 50–100 külön étkezést, a magyar ételcsoportok szerint elosztva, különösen főzelék, rántott étel, csontos hús, pörkölt, rakott étel, tészta és desszert. A referenciát mérleggel, ismert recepttel/veszteséggel és ellenőrzött tápértékforrással, szükség esetén dietetikus segítségével állítsd elő. A modell kimenetét ne használd célértéknek. A receptalapú referencia maga is becslés; ezt különböztesd meg a laboreredménytől.

A `work/` alatt hozz létre például `nutrition-benchmark/cases.json` fájlt, és mellé `photos/` könyvtárat. A képek JPEG/PNG/WebP formátumban, 4 MB körüli maximum alatt legyenek; a helyadatokat/EXIF-et előre távolítsd el. A `photos/` útvonal a manifesthez relatív. Egy szerkezeti példa **kitalált számai nem használhatók valódi eredményként**:

```json
{
  "cases": [{
    "id": "fozelek-01",
    "group": "fozelek",
    "image": "photos/fozelek-01.jpg",
    "secondImage": "photos/fozelek-01-angle.jpg",
    "notes": "Saját recept; a feltétet külön mértem.",
    "context": {"dishProfile":"fozelek","totalWeightG":400,"inedibleWeightG":0,"portionScope":"full_image","preparationNotes":"Ismert sűrítés és tejtermék."},
    "reference": {
      "measured": false,
      "method": "weighed_recipe",
      "provenance": "Ezt cseréld le a tényleges mérés/recept és adatforrás leírására.",
      "edibleWeightG":400,
      "calories":400,"protein":20,"carbs":40,"fat":18,
      "fiber":null,"sugar":null,"sodium":null,"saturatedFat":null
    }
  }]
}
```

Csak valódi mérés után állítsd a `measured` értékét `true`-ra és írd át a példaszámokat. Kötelező a referencia eredete. A kód ezt nyilatkozatként ellenőrzi; nem képes bizonyítani a fizikai mérés megtörténtét.

## Futtatás

```powershell
node scripts/evaluate-nutrition.mjs work/nutrition-benchmark/cases.json
node scripts/evaluate-nutrition.mjs work/nutrition-benchmark/cases.json --run --limit=5
```

Az első parancs csak a formátumot/képfájlokat ellenőrzi, nem hív AI-t. A másodiknak `OPENCODE_API_KEY` kell a `.env` fájlban; fizetős modellhívásokat végez. Esetenként két menet: `photo_only` a két kötelező kép, kiegészítő kontextus nélkül; `with_context` ugyanaz a két kép a megadott információval. Mindkét módhoz kötelező két külön képtartalom; az azonos képeket a futtató elutasítja. Egy menet pontosan egy részletes AI-hívásból áll, amely megkapja a képpárt; a válasz tartalmazza a képi ellenőrzéseket és a tápértékeket is. A referencia tápértékeket nem küldjük a modellnek. Az eredmény minden menet után az `outputs/nutrition-evaluation-*.json` fájlba kerül, tehát megszakításnál a már elkészült mérések megmaradnak.

Az összegzés módszerenként és ételcsoportonként közli az esetszámot, elutasításokat, abszolút átlaghibát (MAE), átlagos előjeles hibát (bias) és RMSE-t, külön kcal-ra, ehető tömegre és tápanyagokra. Hiányzó referencia/predikció nem nulla hiba; az adott metrikánál külön `n` van. A sikertelen esetek nem tűnnek el az összes esetszámból. A nulla célértékeket is kezeli; nincs félrevezető, nullával osztott százalékhiba.

Az étel/összetevő azonosságát külön emberi értékelésben vizsgáld az eltárolt `analysis` alapján: hibás nyers/főtt párosítás, hiányzó köret/szósz, dupla számolás, helytelen készétel-bontás. Az automatikus kcal-hiba nem bizonyítja a helyes felismerést, mert egymást kioltó hibák is adhatnak közeli összértéket. Külön értékeld a saját receptből számolt, ismert alapanyagú eseteket; ne keverd őket a fotó-only felismerés mért pontosságával.

Modell-összehasonlításhoz ugyanazon lezárt készletet futtasd több, a szolgáltatónál elérhető Gemini-modellel, az `OPENCODE_MODEL` beállítás módosításával. A promptverzió, modell, a referenciák száma és a teljes katalógus SHA-256 lenyomata az eredményben szerepel; így a forrástár változása is azonosítható. A fájl `complete` és `planned` mezője külön jelzi a félbemaradt futást; a mentés ideiglenes fájlon és átnevezésen át cseréli a korábbi ellenőrzőpontot. Nem állítunk fel bizonyíték nélküli modellrangsort.

A v5 vizsgálatában a referencia is a teljes főképen látható ehető mennyiségre vonatkozzon. Részadagos vagy előtte–utána képek nem illenek a szerződéshez. Ismert tömegnél az energia-forgatókönyv rögzíti az össztömeget; a pontbecslés hibáját ettől függetlenül mérjük.

A v7 eredményeit külön kezeld a korábbi, egyképes `photo_only` futásoktól. A mód neve a fájlformátum kompatibilitása miatt maradt meg; a `promptVersion` jelzi a módszert. A képpár-elfogadást külön is ellenőrizd (azonos adag, eltérő szög, mindkét kép használható), és adj elutasítandó azonos/kivágott/tükrözött képpárokat is a vakteszthez. A v8 egykéréses elemzését a korábbi módszerekkel ugyanazon lezárt, mért készleten kell összehasonlítani; a prompt részletessége önmagában nem bizonyít kisebb hibát.

A v9 tömörített promptját a v8-cal azonos modellen, gondolkodási beállítással, fotókkal és kontextussal hasonlítsd össze. A kalória-/tömeghiba és az elutasítások mellett a mentett `usage.passes` adatokból vizsgáld a `cost`, `promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount` és `cachedContentTokenCount` mezőket, ha a szolgáltató közli őket. Hiányzó költség nem jelent ingyenes kérést. A rövidebb utasításból vagy kompaktabb JSON-ból önmagában ne állíts tényleges megtakarítási százalékot.
