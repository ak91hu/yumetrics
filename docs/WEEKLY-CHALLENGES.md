# Választható heti kihívások

A Fiókom nézetben minden héten egy feladat választható. A hét hétfőtől vasárnapig, a szerver által meghatározott `Europe/Budapest` időzóna szerint tart. A választás az adott hétre rögzül; a következő héten ismét lehet választani. A felhasználó böngészőjének órája és időzónája nem módosítja a hét határait.

| Feladat | Teljesítés | Heti pecsét |
| --- | --- | --- |
| Három nap, egy jó ritmus | Három különböző napon sikeresen elmentett étkezés. A mentés tényleges napja számít, naponta legfeljebb egyszer. | Ritmustaláló |
| A hét első saját receptje | Saját receptből, a teljes kész tömeg és az adag alapján számolt étkezés mentése. | Receptalkotó |
| Mérlegre vele! | Legalább egy külön lemért, grammban megadott összetevőt tartalmazó étkezés mentése. | Mértékmester |

Csak a választás után mentett bejegyzés számít, ha a naplódátuma az adott hétre esik, és nem jövőbeli. Az étkezés dátumának átírása vagy több bejegyzés egyidejű mentése nem ad három külön napnyi haladást. A háromnapos kihívás péntekig indítható; szombaton és vasárnap a másik két feladat közül lehet választani. A korábban elindított háromnapos feladatot hétvégén is folytatni lehet.

A teljes étel tömegének megadása nem helyettesíti a külön lemért összetevő jelölését. A milliliterben megadott, külön megmért térfogat sem számít grammban lemért összetevőnek. A saját receptnek át kell mennie a már meglévő receptellenőrzésen; az összetevők, kész tömeg és adag megadása szükséges.

## Haladás és jutalom

A kezdőlapi kártya a választott feladat haladását mutatja; a Fiókom nézetben a részletes szabályok és a heti pecsétek is megnyithatók. A teljesítéskor automatikusan jár a pecsét és megjelenik egy visszajelzés. A legutóbbi 12 pecsét látható a gyűjteményben, az összesített darabszám minden jutalmat tartalmaz.

A sikeres mentéskor rögzített részleges haladás és a megszerzett pecsét későbbi szerkesztés vagy törlés után is megmarad. A következő hét új feladatot és új haladást jelent; a korábbi pecséteket nem töröljük. A korábbi hat mérföldkőjelvény ettől külön működik, és továbbra is a naplóban megmaradt különböző étkezési napokat számolja.

A kihívások nem jutalmaznak alacsony kalóriát vagy fogyást. A választás, a haladás és a jutalmazás nem indít AI-elemzést.

## Tartós tárolás és védelem

Az éles PostgreSQL `weekly_challenges` táblája felhasználónként és hétkezdésenként egy sort tárol: feladattípus, választási időpont, haladás, az utolsó beszámított mentési nap és teljesítési időpont. A részleges eredmény és a jutalom sem böngészőtárban vagy folyamatmemóriában él. Migrációk: PostgreSQL `0006_weekly_challenges`, SQLite `0008_weekly_challenges`.

A profil és a `POST /api/weekly-challenge` kizárólag a bejelentkezett felhasználó saját adatait használja. A szerver ellenőrzi a feladatot és az aktuális hetet; a már rögzített választás nem cserélhető másikra. Az azonos választás ismétlése nem hoz létre új jutalmat. Az étkezés mentése és a haladás rögzítése egy tranzakció; PostgreSQL-en felhasználónkénti sorzár védi a párhuzamos mentéseket és választásokat.

A profil lekérése, egy piszkozat, egy hibás vagy elutasított mentés nem ad haladást. Az API-ból érkező, már ellenőrzött mentési adatok alapján számolunk; a kliens nem küldhet be saját pontszámot vagy teljesítési időt.

## Ellenőrzés

A `tests/weekly-challenges.test.mjs` SQLite-on és PostgreSQL-en vizsgálja a választást, párhuzamos ismétlést, heti váltást, hétvégi korlátot, tulajdonosi határt, tényleges mentési napokat, saját receptet, külön lemért grammos mennyiséget, valamint a részleges haladás és jutalom megőrzését adatbázis-újranyitás után. Külön esetek fedik az évváltást és az óraátállítást.

A böngészős folyamat mindkét nyelven ellenőrzi a három lehetőséget, a nyelvváltáskor megőrzött választást, a mentés utáni haladást, a teljesítési visszajelzést, az újratöltést és a törlés után is megmaradó pecsétet. Képernyőszélességek: 320, 390, 768, 1024 és 1440 px.
