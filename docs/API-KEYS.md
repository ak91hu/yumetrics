# Pontosan milyen hozzáférések kellenek?

Ellenőrizve: 2026-11-07. A változónevek a jelenlegi kódhoz tartoznak. Helyben a `C:\Yumetrics\.env` fájlt töltsd ki; Northflankon runtime secret groupba kerüljenek. A titkokat ne másold chatbe vagy kliensoldali JavaScriptbe.

| Szolgáltatás | Mit kell bemásolni? | Honnan? | Mire kell? | Kötelező? |
| --- | --- | --- | --- | --- |
| Google-belépés | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Google Auth Platform → Clients → OAuth webalkalmazás | Azonosítás, automatikus fióklétrehozás | Igen, a napló használatához |
| OpenCode Console | `OPENCODE_API_KEY` | OpenCode Console, a megfelelő workspace API-kulcsa | A Gemini-alapú kép- és tápértékbecslés | Igen, az új fotók elemzéséhez |
| Modal | `MODAL_PROXY_TOKEN_ID`, `MODAL_PROXY_TOKEN_SECRET` | Külön Modal Proxy Token, Northflank runtime secret groupban tárolva | A később bekötendő, hitelesített Modal HTTP-végpont hívása | Előkészített, az éles képelemző még nem használja |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary Console → Product Environment; Settings → API Keys | Képek tartós feltöltése és törlése | Igen, a fotófeltöltéshez |
| Northflank PostgreSQL | `DATABASE_URL` | Az addon Connection details írható primary `POSTGRES_URI` értéke; secret groupban `DATABASE_URL` alias | Felhasználók, napló, munkamenetek, feladatok és források | Igen; ez kapcsolati titok, nem API-kulcs |
| USDA FoodData Central | `USDA_API_KEY` | FoodData Central API key signup | Bővebb Foundation/SR Legacy referenciakeresés | Opcionális; a 44 beépített rekord kulcs nélkül is használható |

## Google

Nyisd meg a [Google Cloud Console](https://console.cloud.google.com/) felületét. Az ehhez az alkalmazáshoz választott projektben hozz létre **Web application** OAuth-klienst, állítsd be az alkalmazás arculatát/consent screenjét és tesztmódban a tesztfelhasználókat. A kapott Client ID és Client secret a két Google-mező. Nem egyszerű Google API-kulcs és nem service account JSON szükséges. [Google web OAuth útmutató](https://developers.google.com/identity/protocols/oauth2/web-server).

Helyi authorized redirect URI pontosan:

```text
http://127.0.0.1:3000/auth/google/callback
```

Az `APP_ORIGIN=http://127.0.0.1:3000` ehhez tartozik. Élesben a saját HTTPS eredet `/auth/google/callback` útvonala kell. Csak `openid email profile` scope-ot kérünk, Gmail/Drive-jogot nem. A regisztráció első sikeres Google-belépéskor történik.

## OpenCode

Jelentkezz be az [OpenCode Console-ba](https://opencode.ai/console), válaszd ki a workspace-t, hozz létre API-kulcsot és ellenőrizd a modellhez rendelkezésre álló keretet/jogosultságot. Az app `OPENCODE_MODEL=gemini-3.8-flash` értékkel, a natív Google `generateContent` protokollon hív. Az aktuális modell és a fiók hozzáférése a szolgáltatónál ellenőrizendő; a kulcs megadása önmagában nem igazolja a keretet. [Hivatalos modelllista](https://opencode.ai/docs/console/models/).

Ehhez a megvalósításhoz külön Google Gemini API-kulcs vagy OpenAI API-kulcs nem kell: az AI-kérés az OpenCode-on keresztül megy. A Google OAuth-azonosítók ettől különálló, belépési adatok.

## Cloudinary

A [Cloudinary Console](https://console.cloudinary.com/) megfelelő Product Environment környezetének cloud name-jét és API key/secret párját másold át. A cloud name környezetazonosító; a secret titkos. A kulcspárok a **Settings → API Keys** oldalon kezelhetők. A szerver aláírt feltöltést/törlést használ, unsigned upload preset nem szükséges. [Cloudinary hivatalos útmutató](https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials).

## Northflank

A külön PostgreSQL addon írható primary kapcsolati URI-ját használd. Az app-podhoz a runtime secret group adja `DATABASE_URL` néven; ne build argumentként add át. Az alkalmazás futásához **Northflank platform-API-token nem szükséges**. CLI-s infrastruktúra-kezeléshez külön platformjogosultság kellhet, de azt nem kell a napló `.env` fájljába írni. [PostgreSQL kapcsolati titkok](https://northflank.com/docs/v1/application/databases-and-persistence/deploy-databases-on-northflank/deploy-postgresql-on-northflank).

## USDA

Igényelj saját kulcsot a [FoodData Central API key signup](https://fdc.nal.usda.gov/api-key-signup/) oldalán. Az `USDA_API_KEY` az angol kereső és a kiválasztott rekord szerveroldali lekéréséhez kell. Futás közben nem használunk DEMO_KEY-t. A szolgáltató kulcsot és kérési korlátot alkalmaz; a meglévő referenciák és a saját receptek ettől függetlenül számolhatók. [USDA API útmutató](https://fdc.nal.usda.gov/api-guide/).

## Mi nem kulcs?

Az `APP_ORIGIN`, `HOST`, `PORT`, `NODE_ENV` és `OPENCODE_MODEL` konfiguráció. Nébih/FAO-források olvasásához nincs API-kulcs; ezek módszertani háttérforrások, az app nem küld nekik ételfotót. Nincs automatikus adatlekérés a KalóriaBázisról és nincs átvett, licenc nélküli magyar tápanyagtábla.

Miután helyben kitöltötted a szükséges mezőket, indítsd újra a szervert. A Beállítások csak konfigurációs állapotot mutat, titkokat nem küld vissza. A Google-belépést és az első valódi elemzést külön kell kipróbálni.

## Google-belépés GitHub Pages-visszatérő oldallal

Az éles beállításban `GOOGLE_REDIRECT_URI=https://ak91hu.github.io/yumetrics/oauth.html`; a Google OAuth-webklienshez ezt a pontos URI-t kell regisztrálni. A helyi `.env` fájlban hagyd üresen a mezőt, hogy a helyi callback maradjon használatban. Az éles APP_ORIGIN értéke https://yumetrics.app, nem a GitHub Pages. Részletek: [Northflank telepítés](NORTHFLANK.md).
