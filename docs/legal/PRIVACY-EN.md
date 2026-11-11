# Yumetrics privacy notice

**Review draft · 11 November 2026 · Not yet in force.** This notice describes the implementation reviewed. Items labelled “to be implemented” or “to be verified” are unresolved requirements, not existing safeguards. See the [document index](README.md) for release conditions. [Magyar változat](PRIVACY-HU.md).

## 1. Who is responsible?

**Kovács Ákos** operates https://yumetrics.app and is the controller of the user diary data. Privacy questions and requests: **[thisisnotka@gmail.com](mailto:thisisnotka@gmail.com)**. The operator has not provided a postal address for publication. Any separate obligation to publish a service-provider address under Hungarian law remains subject to legal review.

The controller determines the purposes and essential means of processing. Being the developer as well, or providing the service free of charge, does not remove that role. Providers may also act as independent controllers for their own account administration, security or legal obligations; not all their processing takes place on Yumetrics' instructions.

## 2. Who may use the application?

Yumetrics is a personal food diary with image-based food recognition, estimated nutrients and optional challenges. The operator intends to offer it **only to people aged 18 or over**. At the review date, sign-in does not include a separate age confirmation or verification step; this must be addressed before implementing the restriction. Collecting a full date of birth or identity document solely to confirm the threshold would generally be disproportionate. If an underage account is identified, access and data handling must be assessed and addressed lawfully in the circumstances.

## 3. What data does the application process?

| Category | Data and source |
| --- | --- |
| Google sign-in | Google account identifier (`sub`), verified email address, name and profile-picture URL; internal user identifier |
| Account and preferences | User-entered daily energy target, language, account status, creation and operational timestamps |
| Food diary | Uploaded food photographs, meal date and time, time zone, meal type, notes, known weight, recipes and other context |
| AI results | Recognised food names and components, estimated quantities and nutrients, assumptions, uncertainties, original and corrected analysis, approval |
| Challenges | Weekly selection, activity dates, recipe and weighing events, progress, completion and rewards |
| Technical data | IP address and HTTP headers when receiving requests; session and sign-in state, rate-limit keys, processing and error logs |
| AI and administration records | Model, timestamp, status, latency, tokens, estimated cost, filtered response, analysis, approval and administrator actions; sometimes linked to a user or meal |
| Correspondence | Contact details and messages you send, and information necessary to handle your request |

We do not receive your Google password. Sign-in does not request access to email or Google Drive files, and we do not persist Google access or refresh tokens. A privacy request sent to the Gmail contact address is nevertheless processed by a separate email service, outside the application's database.

The browser redraws uploaded images without copying the original EXIF/GPS metadata. People, surroundings, names or health information visible in the image may still be identifiable. Please photograph food and avoid including other people, identity documents, medical records or unnecessary personal information.

## 4. Purposes and legal bases

The following legal-basis plan must be finalised against the actual service. Reading this notice or signing in **does not constitute blanket consent to all processing**.

| Purpose | Intended basis and limits |
| --- | --- |
| Account, personal diary, requested image analysis, saving and challenges | GDPR Article 6(1)(b), performance of the requested service, limited to objectively necessary processing. The contractual framework still needs to be finalised. |
| Diary or analysis revealing special-category information | An Article 9 condition is required in addition to an Article 6 basis. The intended approach is **explicit, demonstrable consent** under Article 9(2)(a) before the relevant feature is used. The application does not currently record this consent. |
| Access protection, abuse prevention, necessary troubleshooting and cost control | Article 6(1)(f), the operator's and users' legitimate interests in security, reliability and sustainable operation; a documented balancing assessment and data minimisation are required. This does not itself authorise unrestricted logging of sensitive content. |
| Optional future AI comparison and development evaluation | Separate, withdrawable consent is proposed under Article 6(1)(a), and Article 9(2)(a) where necessary. This purpose must be separated from maintaining the diary; no separate choice currently exists. |
| Local country detection, initial language and limited aggregate measurement | Proposed Article 6(1)(f) balancing assessment, subject to section 9. The final basis and device-storage requirements need verification. |
| Data-subject requests and mandatory breach response | Article 6(1)(c), for the specific obligations in GDPR Articles 12–22 and 33–34. Other correspondence may fall under (b) or (f), depending on its purpose. |

A food photograph is not necessarily health data. A continuing diary, a note or an inference can nevertheless reveal a condition, allergy, health status or religious belief and therefore require special-category safeguards. We do not treat response archiving as automatically qualifying as public-interest scientific research. Proposed legal bases do not retrospectively legitimise any processing previously undertaken without an appropriate basis.

## 5. Where is data stored?

- **Diary and application records:** PostgreSQL hosted through Northflank. At review, both the application and database run in Google Cloud `europe-west2`, **London, United Kingdom**, outside the EEA.
- **Food photographs:** protected Cloudinary assets of type `authenticated`. Exact storage countries and account-specific regional guarantees still require contractual verification; exclusive EEA storage has not been established.
- **AI processing:** images go to the enabled Modal helper and the model accessed through OpenCode. Responses and operational metadata also remain partly in the application's PostgreSQL database.
- **Backups:** weekly database backups with seven-day retention in the current schedule. The precise location of backup objects needs separate verification. Database backups do not contain Cloudinary image bytes.
- **Operator correspondence:** privacy emails are also stored in Gmail. The email account's contractual classification, retention and access safeguards need to be addressed separately.

## 6. Which providers receive data?

| Recipient | Function and data | Location and verification needed |
| --- | --- | --- |
| **Northflank Ltd**, with infrastructure subprocessors | Application, database, backups and platform operation, including the personal data stored there | Live resources in London. Verify applicable DPA, subprocessors, backups and platform logs. [Terms](https://northflank.com/legal/terms) |
| **Cloudinary**, the legal entity named in the account agreement | Protected image storage, retrieval, deletion and cache invalidation | Global service; verify exact regions and transfer safeguards. [DPA](https://cloudinary.com/gdpr/dpa), [subprocessors](https://cloudinary.com/trust/subprocessors) |
| **Modal Labs, Inc.** | Optional Food-R1 food-name recognition; food images and responses | No region is pinned. Asynchronous Functions payloads may be stored in the US for up to seven days. Container shutdown does not mean immediate erasure. [Residency](https://modal.com/docs/guide/data-residency), [retention](https://modal.com/docs/guide/security), [DPA](https://modal.com/legal/dpa) |
| **OpenCode / Anomaly Innovations, Inc.**, and the model provider | Structured analysis of original images, notes, portion information and meal context; currently a Google model | Inference-specific processing location, retention, use restrictions and the Google processing chain are not fully established. [Terms](https://opencode.ai/legal/terms-of-service), [Trust Center](https://trust.opencode.ai/) |
| **Google** | Google sign-in and account details; browser requests for profile images; separately, the operator's Gmail correspondence | Typically an independent controller for account/sign-in services, a role distinct from model processing. [Privacy policy](https://policies.google.com/privacy), [OIDC](https://developers.google.com/identity/openid-connect/openid-connect) |
| **GitHub Pages / GitHub** | The current static Google sign-in relay receives IP addresses, technical request data and temporary OAuth response parameters | Code redemption happens on the application server. GitHub may retain IP information for security. [Pages collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [privacy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) |
| **USDA FoodData Central** | Nutrient searches: food search terms and server-side network information | No user account identifier or image is deliberately sent. Free-text search could contain personal information; please do not enter it. [API](https://fdc.nal.usda.gov/api-guide) |

The DB-IP country database runs **locally**. Visitor IP addresses are not sent to DB-IP in individual country-lookup requests. No external Umami tracking script is installed. The application does not sell advertising data or publicly publish user diaries.

The operator confirmed acceptance of Northflank, Cloudinary, Modal and OpenCode DPAs. This does not establish that the accepted documents cover the relevant account, product, sensitive processing and onward-transfer chain; those details still require verification.

## 7. Transfers outside the EEA

The UK is outside the EEA. Transfers can rely on an applicable EU adequacy decision; the relevant renewal at review is [Commission Decision 2025/2574](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ%3AL_202502574).

For processing in the US or another country without applicable adequacy, appropriate safeguards are needed for the particular recipient and processing, such as applicable Standard Contractual Clauses, a transfer impact assessment and supplementary measures. The EU–US Data Privacy Framework applies only to an actively certified organisation and processing covered by that certification, not automatically to every US provider.

The final description of the specific contractual safeguards is still incomplete. You may request information about applicable safeguards and access to a copy at the privacy email address, subject to the rights of others and protected business information. Consent must not be used as a general substitute for safeguards for routine provider transfers.

## 8. Retention and deletion

| Data | Current implementation |
| --- | --- |
| Account, diary and images | No automatic inactivity expiry. Individual meals can be deleted in the interface; full account deletion currently requires contacting the operator. |
| Cloudinary image associated with a meal | Deletion includes a provider deletion and cache-invalidation request. Failures require retry; this is not immediate physical destruction of every copy. |
| AI response archive, cost records, operational and administrator logs | No general automatic expiry currently exists. **Deleting a meal does not itself delete its AI archive.** This is an unresolved gap, not permission for unlimited retention. |
| Weekly activity and rewards | Later deletion of a meal does not automatically revoke an earned weekly completion. These records must also be considered for account-level erasure. |
| Session | Valid for up to 30 days; logout deletes the current server-side session. Expired records are cleaned during successful sign-in. |
| OAuth state | Valid for 10 minutes and deleted on one-time use; further sign-in operations clean expired unused records. |
| Rate limits | Short validity, generally one or ten minutes; subsequent requests clean expired records. |
| Aggregate page views | A 400-day window; cleanup runs when recording or reporting, not as an independent scheduled task. |
| Database backups | Seven-day retention in the current backup schedule. Deleted records may remain temporarily in restorable backups; earlier erasures must be reapplied after restoration. |

Additional periods in the [operations plan](GDPR-OPERATIONS.md) are **proposals**, not configured deadlines. Provider retention can differ from application retention; the AI provider chain particularly needs clarification. A legal claim can justify retaining only the specific necessary data, separately and for a justified period. It does not justify a blanket multi-year archive of all photographs or meals.

## 9. Cookies, country detection and audience measurement

| First-party cookie over HTTPS | Purpose | Lifetime |
| --- | --- | --- |
| `__Host-yumetrics_session` | Signed-in session; HttpOnly, Secure, SameSite=Lax | 30 days |
| `__Host-yumetrics_oauth` | Linking the sign-in request and response; HttpOnly, Secure, SameSite=Lax | 10 minutes |
| `yumetrics_language` | Remembering Hungarian/English; not an authentication token | 365 days |

The language cookie is created on initial language setup as well. Hungary defaults to Hungarian; other or unknown countries default to English. You can change this manually. Precise location or GPS coordinates are not requested for this purpose. Necessary sign-in cookies and the preference cookie require separate legal assessment; cookieless measurement is not automatically outside privacy law.

For selected pages, the server derives country from the IP address and device, browser, operating system, source group and language from headers, then stores daily aggregate counters. The audience table does not contain a unique visitor identifier, complete browsing journey or raw IP, User-Agent or referrer record. Requests with DNT=1 or GPC=1 are excluded from measurement. Intermediate IP processing, platform logs and small groups mean that not all related data can be assumed anonymous. Hashed network-based rate-limit keys may also be pseudonymous personal data.

## 10. AI, human review and development use

AI identifies food and estimates quantities; the program calculates nutrients from these results. The main model checks the Food-R1 helper's suggestions against the original images. Combining models does not itself establish greater accuracy. Users can correct and approve the result; the original analysis and latest correction may both remain stored.

Archive filtering removes recognised secrets and image bytes but does not generally anonymise personal information. The administrator can access diaries, protected images, responses and corrections for necessary operational tasks; the implementation technically permits this access. Purpose limitation must also be enforced operationally.

The application does not automatically fine-tune models on diary data. Providers' own development uses are a separate contractual matter: OpenCode's public terms may permit this for some unpaid use, while third-party models can have their own retention policies. Account-specific exclusions or restrictions still need to be established.

The application does not make solely automated decisions granting credit, insurance, care or other rights. It does perform automated analysis and activity evaluation, which may be wrong. Introducing a decision with legal or similarly significant effects under GDPR Article 22 would require a new legal assessment.

## 11. Which information is required?

The current account service requires Google sign-in. Image analysis requires at least one photograph; a second photograph, notes, measured weight and other context are optional. Their absence may increase uncertainty. Future comparison-related retention must be separated so that declining it does not exclude users from necessary diary functions. The consequences of declining or withdrawing consent needed for sensitive processing must be explained in the future interface, with an appropriately limited alternative assessed.

## 12. Security

Safeguards include HTTPS, server-side authorisation, hashed sessions, parameterised database queries, upload validation and access-controlled image delivery. Images are not exposed through generally public links. This is not a comprehensive security certification. Zero risk, or the same independently verified encryption arrangements across all providers, cannot be guaranteed. Administrator account protection, secret management, access review and documented incident handling are also required.

## 13. Your rights

Subject to GDPR conditions, you may request access and a copy, rectification, erasure, restriction and portability of data you provided that is processed automatically on consent or contract grounds. You may object to legitimate-interest processing for reasons relating to your situation. You may withdraw consent at any time without affecting the lawfulness of earlier processing. Any statutory limits on these rights must be assessed and explained individually.

Email **thisisnotka@gmail.com**. You do not need to cite legislation or use a specific form. There is currently no self-service full-account deletion or export. That does not remove your rights. Where identity is reasonably in doubt, only proportionate additional verification may be requested; an identity-document copy is not automatically required.

A response is due without undue delay, normally within **one calendar month**. For complex or numerous requests, an extension of up to two additional months is possible, with reasons notified within the first month. Requests are normally free. Any refusal, exceptional fee and available remedies must be explained. See the [Hungarian supervisory authority's guidance](https://naih.hu/erintetti-jogok).

## 14. Complaints and remedies

Contacting us first is not a condition for complaining to a supervisory authority. In Hungary, the authority is the **Hungarian National Authority for Data Protection and Freedom of Information (NAIH)**, 1055 Budapest, Falk Miksa utca 9–11., Hungary; [naih.hu](https://naih.hu/), customer-service email ugyfelszolgalat@naih.hu. Follow the authority's [current contact and filing instructions](https://naih.hu/ugyfelszolgalat-kapcsolat?width=fixed); an ordinary customer-service email may not initiate formal proceedings. Under the GDPR, you may also complain to the competent authority where you habitually reside, work or where the alleged infringement occurred, and seek a judicial remedy.

## 15. Changes and liability

New purposes, providers, material retention changes or new sensitive processing require an updated notice and, where needed, renewed consent before processing. Continuing to use the website does not itself accept a new consent purpose.

AI output is an estimate, not medical advice or a measurement certificate. [Separate terms](TERMS-EN.md) describe its use. This warning does not restrict your privacy rights, supervisory powers or the controller's statutory liability, including the right to compensation under GDPR Article 82.

**The terms exclude the liability of Kovács Ákos, as developer and operator, for loss or damage arising from use of the application to the fullest extent permitted by law. This does not cover liability that cannot lawfully be excluded and does not waive your privacy rights.**
