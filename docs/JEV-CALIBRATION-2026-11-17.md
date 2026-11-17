# Jev-kalibráció és helyességellenőrzés – 2026-11-17

Modell: `jev-1.14.0`. Eszköz: `scripts/calibrate-jev.mjs`, ugyanazzal a jelöltkereséssel (`candidateSearch`) és kérdésekkel (`matchQuestion`, `mealQuestions`, `mealState`), mint az éles folyamat. Eredmény: `lib/jev-calibration.json` (ezt olvassa az alkalmazás). Részletes sorok: `outputs/jev-calibration-details.json` (nem a repóban). A mérés teljes Jev-költsége néhány cent volt.

Módszer: minden küszöb a **kalibráló részhalmazon** dől el. A név hash-e alapján rögzített kb. 30%-os **zárolt ellenőrző részhalmazt** csak jelentjük, azon nem hangolunk.

## θ_item (Q2: adatbázis-tétel)

Adat: Nutrition5k cafe1, mérlegen mért összetevők (CC BY 4.0). A szűrés (legalább 3 előfordulás és összesen legalább 50 g) után 177 összetevő maradt; ebből 155-höz volt jelölt (22-höz nem). Elkészítési állapot és angol leírás egyszerű névszabállyal készült; ez a mérés közelítése.

Két mérce:

1. **Mért energiaegyezés:** a választott rekord 100 g-os energiája legfeljebb max(20 kcal, 20%) mértékben tér el a lemért összetevőétől.
2. **Azonosítás:** ugyanaz az étel, rész és elkészítési állapot (a terv definíciója: „jó adatbázis-tételt választ-e a Jev”). Mind a 115 elfogadott döntést egyenként átnéztük: `calibration/q2-identity-review.json`. Hibás azonosítás nem volt. 5 esetben a tétel nem adott meg altípust (pl. „grilled chicken” → mellfilé), ezek megjegyzéssel szerepelnek. A átnézést Claude végezte; emberi szúrópróba javasolt.

| | Kalibráló (n=107) | Zárolt (n=48) |
|---|---:|---:|
| Elfogadott döntés θ=0,3-nál | 79 (73,8%) | 35 (72,9%) |
| Azonosítás-pontosság | 1,00 | 1,00 |
| Energiaegyezés | 0,82 | 0,97 |
| „Első találat” energiaegyezése (Jev nélkül) | 0,68 | 0,73 |

**Döntés: θ_item = 0,3** (azonosítás, cél 0,95, legalább 20 elfogadott döntés).

- Az energiaegyezés (mind a 155 összetevőn) a küszöbtől szinte független: 0,3-nál 0,87, 0,6-nál 0,86, 0,8-nál 0,85, és csak 0,9-nél éri el a 0,93-at, 17%-os lefedettséggel. Az eltérések okai: a Nutrition5k saját értékei (cézáröntet 44 kcal, a bulgurnál a száraz érték, ecet 0 kcal), az FNDDS „cooked” rekordjaiban hozzáadott zsír, illetve meg nem adott altípus. Ezek nem a Jev hibái. Egy magasabb θ csak eldobná a helyes választásokat: a tétel az AI-tartalékra kerülne, és a Food-R1 is gyakrabban futna.
- A tévesen választott rekord ellen az éles folyamatban az energia-biztonsági korlát véd (eltérés a Luna tartalékbecslésétől: legfeljebb max(80 kcal, 50%)).
- „Egyik sem” arány: 24%. A gyakori okok: a jelöltek közt nincs ugyanaz az étel (pl. „olives” → csak olívaolaj, „chicken thighs” → csak mellfilé), vagy a név túl általános („pork”, „cheese”, „milk”).

## θ_dish (Q1: magyar ételcsoport)

Adat: `calibration/hungarian-dishes.json`, 60 címkézett étel, mind a 10 csoportból, `generic` ételekkel együtt. Ez azonosítási címke, nem tápérték-mérés.

| | Kalibráló (n=39) | Zárolt (n=21) |
|---|---:|---:|
| Pontosság θ=0,3-nál | 1,00 | **0,86** |

**Döntés: θ_dish = 0,3.** A zárolt részhalmazon a 0,9-es cél **nem teljesült**: mindhárom hiba oda esett, és mind „generic” lett:

| Étel | Elvárt | Jev | Bizonyosság |
|---|---|---|---:|
| Vadas marhahús zsemlegombóccal | porkolt | generic | 0,81 |
| Káposztás tészta | teszta | generic | 0,74 |
| Krumplis tészta | teszta | generic | 0,61 |

A hiba iránya biztonságos: a Q1 csak akkor erősít meg, ha a választása egyezik a Luna csoportjával. A „generic” válasz ezért nem ad hamis receptpriort vagy személyes adagszorzót, csak eszkalál. A Q1 előtt kivettük az állapotból a Luna saját csoportcímkéjét (`dishGroupFromImage`), mert a megerősítés különben nem lett volna független.

## Q3, Q4, Q6 (ugyanazon a készleten)

| Kérdés | Pontozott | Döntött | Helyes |
|---|---:|---:|---:|
| Q3 elkészítés (1. tétel) | 29 | 29 | 29 (100%) |
| Q4 rejtett zsiradék | 34 | 31 | 31 (100%) |
| Q6 külön látható összetevők | 41 | 35 | 32 (91%) |

A Q6 eltérései vitatható címkék: feltétes lángos (2×), almás rétes. A Noul-válasz 0,3 és 0,7 között bizonytalan, ilyenkor nincs döntés.

## δ (Food-R1 egyeztetés)

**Kevés adat (`insufficient`, n=6).** A Modal `/estimate` 2026-11-17-én telepítve lett. A helyben elérhető 6 egyedi, lemért Nutrition5k-tányérra élő gyors (Luna + Jev) és Food-R1 becslés készült (`calibration/delta-pairs-nutrition5k.json`). A δ-hoz legalább 20 tányér kell, ezért a kódban 0,25 marad.

| Tányér | Gyors | Food-R1 | Lemért | Relatív eltérés |
|---|---:|---:|---:|---:|
| dish_1558639876 | 104,7 | 132 | 68,2 | 0,21 |
| dish_1557937157 | 544 | 600 | 355,3 | 0,09 |
| dish_1558641320 | 210,9 | 235 | 211,6 | 0,10 |
| dish_1562172643 | 776,6 | 624 | 734,3 | 0,20 |
| dish_1558720236 | 806 | 780,9 | 887,8 | 0,03 |
| dish_1565811139 | 369 | 240 | 902,2 | 0,35 |

Ezen a 6 tányéron a két becslés hat esetből ötben 0,25-ön belül volt. A legnagyobb hiba (902 kcal lemért) mindkét becslésnél alulbecslés, így az átlagolás sem segít rajta. Ez kis minta, nem kalibráció. További tányérok hozzáadása után:

```text
node scripts/collect-delta-pairs.mjs work/nutrition5k-haiku-v2/cases.json work/nutrition5k-haiku/cases.json
node scripts/calibrate-jev.mjs --delta-pairs outputs/delta-pairs.json --write
```

A választás szabálya: a legkisebb δ, amelynél a kérdőképernyő aránya legfeljebb 30%, és a két becslés átlagának hibája nem nagyobb a gyors becslésénél. Legalább 20 lemért tányér kell hozzá. A helyben elérhető 7 Nutrition5k-tányér ehhez kevés, ezért a δ addig `insufficient` marad.

## A Jev helyes működésének további ellenőrzései

- **Élő végpont–végpont (csülökfotó, Luna + USDA + Jev):** 5 tételből 4-nél a Jev által választott adatbázis-rekord számolt. A sült csülökre helyesen „egyik sem” jött (nincs ilyen jelölt), ezért eszkalált az útvonal.
- **Élő gyorsítótár:** ugyanaz az étkezés másodszor 7/7 választ kapott a gyorsítótárból, Jev-hívás nélkül. Egy másik étkezés a közös rizs tételre adott Q2-választ újrahasznosította. A Q2 kulcsa ezért csak az angol leírásból, az állapotból és a jelöltlistából áll.
- **Talált és javított hibák:**
  - Az USDA teljes szöveges keresése a „chive, cooked” kérdésre „Dove, cooked” (galamb) rekordot adott. A Jev ezt elutasította, de a Jev-kiesés esetére írt „első találat” tartalék elfogadta volna. Mostantól egy jelöltnek legalább egy nem általános szóban egyeznie kell.
  - A helyes, de sóváltozatok között megoszló választások alacsony nyers bizonyosságot kaptak. Ezt a változatcsoportos pontozás kezeli.
- **Egységtesztek:** `tests/jev.test.mjs`, `tests/calibration.test.mjs`.
