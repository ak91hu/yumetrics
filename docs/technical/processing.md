# A feldolgozás állapotgépe

## Két külön állapottér

A `meals.status` az étkezés felhasználói állapotát, az `analysis_jobs.state` a tartós háttérfeladat állapotát írja le. Egy feladat `kind` mezője `analyze` vagy `delete`. A két táblát a `meal_id` köti össze. Az AI-hívásoknak további, külön életciklusa van az `ai_requests` táblában.

```text
Új feltöltés:
  uploading → queued → running → done
                            └──→ failed

Étkezés:
  analyzing → draft → saved
        └──→ failed

Törlés:
  delete/queued → delete/running → képtári törlés → adatbázis-törlés
```

A részletes, aktuális állapotot az API `status` és `job` mezői adják vissza. A `done` feldolgozás önmagában nem jelenti, hogy a felhasználó mentette az étkezést.

## Feltöltési tranzakció és idempotencia

A `POST /api/analyze` ellenőrzi a munkamenetet, a korlátokat, a metaadatokat és a képeket. A metaadatok, a kontextus és a képek SHA-256-lenyomatából bemeneti hash készül.

Azonos UUID és azonos hash esetén a meglévő bejegyzést adja vissza; eltérő tartalommal újrafelhasznált UUID-ra `409` érkezik. Új kérésnél egy tranzakció foglalja az elemzési próbálkozást, létrehozza az étkezést és az `uploading` feladatot. Ezt követi a Cloudinary-feltöltés. A már létrejött képazonosítók részleges hiba esetén is megmaradnak.

Az utolsó feltöltés után a feladat `queued` állapotúvá válik. A `202` válasz így tartós feladatot és már tárolt képet jelent. Az HTTP-kapcsolat ezután nem tartja nyitva az AI-munkát.

## Feladatfelvétel és lease

A folyamaton belüli runner 2,5 másodperces ütemezéssel és azonnali `wake()` jelzéssel dolgozik. Saját magával nem fut párhuzamosan. A feladatot atomikus adatbázis-módosítás veszi fel; a lease egyedi tokenje az adott végrehajtáshoz tartozik.

A lease kezdetben körülbelül **90 másodpercre** szól, a heartbeat **15 másodpercenként** hosszabbít. A végrehajtó a kritikus lépések és a mentés előtt ellenőrzi, hogy továbbra is ő birtokolja a feladatot. Elvesztett lease esetén a későn érkező eredmény nem válik aktuálissá.

## Költséget okozó megszakítások

Lejárt lease-ű, futás közben megszakadt elemzést a rendszer hibásnak jelöl. **Nem indít automatikusan új AI-elemzést:** a korábbi szolgáltatói kérés már számlázódhatott. A felhasználó dönthet a kézi újrapróbálásról, amely a meglévő, olvasható képekből új hívást indíthat.

A tárolt feladat és az input hash nem jelent szolgáltatói „exactly once” garanciát. Hálózati megszakításnál nem mindig bizonyítható, hogy a szolgáltató feldolgozta-e az előző kérést. A külön napló és a kézi újrapróbálás ezt a bizonytalanságot kezelhetővé teszi, de nem szünteti meg.

## Eredmény mentése

A worker visszaolvassa a védett képeket, meghívja a beállított felismerőket, validálja az elemzést, majd tranzakcióban ment. Az első elemzés `original_analysis` néven is megmarad. A felhasználó által módosított változat ettől elkülönül, a jóváhagyás az archívumhoz is kapcsolódik.

A `PATCH /api/meals/:id` csak szerkeszthető állapotban és megfelelő `revision` mellett működik. A sikeres mentés növeli a revíziót, `saved` állapotot állít be, és ugyanabban a tranzakcióban frissíti a heti aktivitást és kihívást.

## Vonalkódos ág

Ha a feltöltés `barcode` mezőt tartalmaz (böngészőben felismert kód + Open Food Facts 100 g/ml-es értékek + a felhasználó mennyisége), a worker a képek biztonságos tárolása után **AI-hívás nélkül** állítja elő a piszkozatot (`model=barcode/open-food-facts`, `usage.pipeline.path=barcode`).

## Food-R1 eszkalációs feladatsor

Az `escalated` útvonalú elemzés mentésével ugyanabban a tranzakcióban sor kerül a `food_r1_job` táblába, és a bejegyzés `refinement` mezője `pending` lesz. Külön runner dolgozza fel, 5 másodperces ütemezéssel. PostgreSQL-ben `FOR UPDATE SKIP LOCKED` és 240 másodperces lease mellett veszi fel a feladatot, majd a Modal `/estimate` végpontot hívja.

```text
food_r1_job:  queued → running → done
                  ↑        └──→ queued (hiba: 30 s · 2^n, legfeljebb 6 óra; 4. hibánál riasztás)
                  └── 8. hiba után: failed (a gyors eredmény marad)
refinement:   pending → reconciled (|eltérés| ≤ δ, átlag, szélesített sáv)
                      → question → answered (adagcsúszka + elkészítés, személyes prior)
                      → failed / unavailable
```

A pontosított eredmény csak akkor írja felül a piszkozatot, ha a felhasználó még nem szerkesztette vagy mentette (a revízió nem változott). A belső havi Modal-keret elérése nem számít hibának: a feladat 6 óra múlva folytatódik.

## Törlés és leállás

A törlés előbb tartós `delete` feladatot hoz létre. A worker eltávolítja a Cloudinary-képeket, majd az étkezést. Ha a képtár nem érhető el, a bejegyzés és a képazonosítók megmaradnak, hogy a művelet később folytatható legyen. Az AI-archívumot az étkezés törlése nem törli automatikusan.

SIGTERM/SIGINT esetén az alkalmazás leállítja az új feladatok felvételét és lezárja a HTTP-szervert. A folyamat legfeljebb körülbelül 25 másodperces leállási határidőt használ. A tartós sor újraindítás után megmarad; a megszakadt, már futó AI-feladat a fenti óvatos szabály szerint kezelendő.

Források: [API és feltöltés](https://github.com/ak91hu/yumetrics/blob/main/lib/api.mjs), [worker](https://github.com/ak91hu/yumetrics/blob/main/lib/jobs.mjs).
