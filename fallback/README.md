# Yumetrics tartalék bejárat

Tervezett szolgáltatói cím: `https://yumetrics-backup.ak91hu.workers.dev`.

Önálló Cloudflare Worker, amely a meglévő `https://yumetrics.app` alkalmazást közvetíti. A kliens más DNS-nevet és más hálózati belépési pontot használ, a Northflank alkalmazása és adatbázisa változatlan. A főcím, a www-átirányítás és a code.run-átirányítás megmarad. A naplóadatokat nem másoljuk másik adatbázisba.

Ez hálózati/domain-elérési kerülőút, nem a központi szerver kiesését átvészelő teljes másodlagos rendszer. Ha a Northflank vagy a központi adatbázis nem működik, a Worker érthető hibaoldalt ad. A tartalék domain böngészős blokkolása és a teljes internetkapcsolat hibája ellen ez sem ad garanciát.

## Belépés

A külön címen újra be kell jelentkezni Google-lel; a korábbi fiók és az összes adat megmarad. A sütik továbbra is hosthoz kötött, Secure/HttpOnly sütik. A Worker csak az alkalmazás saját sütijeit továbbítja, más szolgáltatás azonosítóit nem. Minden válasz `no-store`; a Worker nem tárol naplóadatot és nem ír kérésnaplót.

A már regisztrált GitHub Pages OAuth-visszatérő cím változatlan. Csak a tartalékról indított bejelentkezés state-je kap `backup.` jelölést. A közös `docs/oauth.js` ezt egy rögzített, megbízható tartalék címre küldi, az eredeti állapotértékkel. A főoldal szokásos belépési útvonala nem változik. Nincs lekérdezésből választható visszatérési cél.

A Worker a saját originjéről érkező módosításokat engedi tovább, és elutasítja az idegen originről érkezőket. Csak egy rögzített upstreamhez kapcsolódhat, ezért nem általános nyílt proxy.

## Telepítés

```text
npx wrangler@4.163.0 deploy --config fallback/wrangler.jsonc
```

A bejelentkezés Cloudflare OAuth-on keresztül történik. Token nem kerül a repóba vagy a konfigurációba. Nincs új fizetős csomag, adatbázis vagy háttérworker. A fiókhoz tartozó Cloudflare-korlátok érvényesek.

Ellenőrzés: `node --test tests/fallback-proxy.test.mjs tests/oauth-bridge.test.mjs`. A tesztek a proxyzást, a sütik szűrését, az origin-védelmet és a teljes, szimulált Google-belépési/kijelentkezési folyamatot is vizsgálják. A valódi Google-fiókkal végzett végső belépést a felhasználó tudja visszaigazolni.
