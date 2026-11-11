# Profilstatisztikák, fejlődés és heti kihívások

## A napló statisztikai alapja

A profil összesítései a felhasználó valóban mentett étkezéseire épülnek. A piszkozat, hibás elemzés és törlés alatt álló bejegyzés nem végleges étkezés. Jövőbeli nap nem növeli a tényleges naplózási aktivitást. A napi energia, makrók, étkezéstípusok és időszaki átlagok a mentett, ellenőrzött elemzésből számolódnak.

A profil időzónát kap a klienstől, alapértelmezése `Europe/Budapest`. A naptári nap és az UTC-időbélyeg eltérő fogalom: egy étkezéshez külön dátum/idő/időzóna és létrehozási/módosítási idő tartozik. A szerver validálja az időzónát, és a napi összesítést a megfelelő naptári határokkal készíti.

A 7/30/365 napos energiaátlag csak a ténylegesen naplózott napokra vonatkozik, nem feltétlenül az időszak minden napjára. A hiányzó naplózás ezért nem nulla ételfogyasztást jelent. Az energiakeret egy felhasználói beállítás; nem automatikus, orvosilag személyre szabott ajánlás.

## Aktuális naplóból számolt fejlődés

Az ötszintű növényes fejlődés a különböző mentett napokat számolja. Hat jelvény különböző naplózási mérföldkövekhez tartozik; nem a bevitt vagy elkerült kalória mennyisége jutalmazott. A gördülő hétnapos cél a rendszeres naplózást mutatja. Egy kihagyott nap önmagában nem von le korábban megszerzett aktív napot.

Ezek az aktuális bejegyzésekből újraszámolt statisztikák: törlés vagy dátummódosítás megváltoztathatja az aktív napokat, sorozatot és a hozzájuk kapcsolódó jelvényeket. A felület képei statikus, generált jelvénygrafikák; megjelenítésük nem indít AI-hívást.

## Választható heti feladatok

| Azonosító | Teljesítés feltétele |
| --- | --- |
| `three_days` | Három különböző jogosító mentési nap a héten |
| `recipe` | Saját recepttel mentett étkezés |
| `measured` | Külön lemért, grammos összetevővel mentett étkezés |

A hét hétfőtől vasárnapig tart `Europe/Budapest` szerint. Egy felhasználó egy héthez egy feladatot választ; a táblakulcs `(user_id, week_start)`. A választás után ugyanazon héten nincs szabad feladatcsere. Az ismételt kérésnek nem szabad új jutalmat létrehoznia.

## A választás előtti tevékenység

A mentés a `weekly_activity` táblában az aktuális mentési naphoz rögzíti a naplózást, valamint a recept- és mérésjelölést. A heti haladás így a választás előtti jogosító tevékenységeket is felhasználja. Ha a feltétel már teljesült, a választás azonnal teljesítést és pecsétet adhat.

A régebbi adatállományhoz a még létező mentett étkezésekből visszatöltés is történik. Ebből nem rekonstruálható minden korábban törölt vagy felülírt művelet; a tartós aktivitás bevezetése előtti hiányos történetet a rendszer nem találja ki.

A háromnapos feladat egy napon legfeljebb egy lépést kap. A mentés tényleges napja számít, a bejegyzés dátumának visszaírása nem gyárt korábbi aktivitási napokat. A jövőbeli vagy az adott hétre nem jogosító bejegyzés nem használható a kihívás megkerülésére.

## Tartós jutalom és párhuzamos kérések

A heti teljesítés monoton: a már elért haladás és pecsét utólagos törléssel vagy szerkesztéssel nem csökken. Ez tudatosan eltér az aktuális naplóállapotból számolt általános jelvényektől. A jutalom `completed_at` időpontja és a heti rekord megmarad; a profil csak a legutóbbi pecsétek részlistáját mutatja, de ez nem a tárolt jutalmak számának korlátozása.

A felhasználói mentés és a kihívásfrissítés közös tranzakcióban fut. PostgreSQL esetén a felhasználói sor zárolása is védi az egymással versengő választást/mentést. A tesztek ellenőrzik az ismételt és párhuzamos választást, a másik fióktól való elválasztást, a hétvégi választhatóságot és a törlés utáni megőrzést.

Források: [profilstatisztikák](https://github.com/ak91hu/yumetrics/blob/main/lib/profile-stats.mjs), [heti kihívások](https://github.com/ak91hu/yumetrics/blob/main/lib/weekly-challenges.mjs), [részletes szabályok](https://github.com/ak91hu/yumetrics/blob/main/docs/WEEKLY-CHALLENGES.md).
