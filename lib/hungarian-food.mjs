// Original guidance, not a recipe database: dish names never determine fixed nutrient values.
export const HUNGARIAN_DISHES = {
  generic: { label: 'Más étel, vagy nem tudom', hint: 'Az elkészítés és a képen látható teljes ehető tömeg számít.', questions: [] },
  fozelek: { label: 'Főzelék és feltét', hint: 'A főzelék, a sűrítés és a feltét külön számít; a kész főzeléket és az alapanyagait ne számold kétszer.', questions: ['Rántással, habarással vagy saját anyagával sűrítették?', 'Milyen tejtermék és mennyi zsiradék került bele?', 'Mi a feltét, és mennyi látható belőle a képen?'] },
  porkolt: { label: 'Pörkölt vagy paprikás körettel', hint: 'A hús zsírossága, a szaft, a tejföl és a köret aránya receptenként eltér.', questions: ['Milyen húsrészből készült?', 'Volt benne tejföl vagy hozzáadott zsiradék, és mennyi?', 'Mennyi szaft és külön köret látható a képen?'] },
  rantott: { label: 'Rántott hús, sajt vagy zöldség', hint: 'A panír és a felszívott olaj nem olvasható le pontosan a fotóról; nem minden sütéshez használt olaj marad az ételben.', questions: ['Bő olajban, serpenyőben vagy sütőben készült?', 'Mi van a panír alatt, és mennyi az ehető kész tömege?', 'Ismert a felhasznált és a visszamaradt olaj mennyisége?'] },
  csontos: { label: 'Csülök vagy csontos, bőrös hús', hint: 'Csont nélkül számolj. A hús, bőr és zsír nem helyettesíthető automatikusan sovány hússal.', questions: ['Mennyi a képen látható teljes adag csont nélküli tömege?', 'A bőr és a látható zsíros részek is az adagon vannak?', 'A kisült zsiradék és szaft az ételbe került vagy visszamaradt?'] },
  rakott: { label: 'Rakott étel vagy töltött káposzta', hint: 'A rétegek és a töltelék összetételéhez a saját recept és az elkészült étel tömege a legjobb támpont.', questions: ['Mennyi hús, kolbász vagy szalonna, rizs vagy burgonya került a teljes ételbe?', 'Mennyi és milyen zsírtartalmú tejfölt használtál?', 'Mennyi a kész étel és a képen látható teljes szelet tömege?'] },
  langos: { label: 'Lángos és feltétek', hint: 'A lángos mérete, a tészta összetétele, a felszívott olaj és a feltétek mennyisége is változó. Egy lángosnak nincs egységes tápértéke.', questions: ['Mekkora a kész lángos lemért tömege?', 'Mennyi tejföl, sajt vagy más feltét került rá?', 'Van ismert tésztarecept és adat a felszívott olajról?'] },
  teszta: { label: 'Túrós, mákos vagy diós tészta', hint: 'A száraz és a főtt tészta tömege nem cserélhető fel. A cukor, tejföl és szalonna külön összetevő.', questions: ['A tészta megadott tömege száraz vagy főtt?', 'Mennyi túró, tejföl, mák vagy dió került az adagba?', 'Volt rajta cukor, szalonna vagy hozzáadott zsiradék?'] },
  leves: { label: 'Leves, gulyás vagy halászlé', hint: 'A lé és a szilárd rész aránya fontos. A milliliter nem automatikusan ugyanannyi gramm.', questions: ['Mennyi lé és szilárd rész van a képen látható teljes adagban?', 'Volt benne csont, tészta, kenyér vagy tejföl?', 'Ismert a teljes fazék receptje és kész tömege?'] },
  edesseg: { label: 'Palacsinta, sütemény vagy desszert', hint: 'A töltelék, szórat és öntet külön számít; a cukormentes megnevezés nem jelenti azt, hogy energiamentes.', questions: ['Mi és mennyi a töltelék, szórat vagy öntet?', 'Ismert a saját recept vagy a termék tápértékcímkéje?', 'Mennyi a képen látható összes sütemény tömege?'] },
};
export const FOOD_STATES = ['raw', 'prepared', 'as_sold', 'unknown'];
export const REFERENCE_STATES = {
  'fdc-173904':'as_sold', 'fdc-171705':'raw', 'fdc-172183':'raw', 'fdc-169756':'raw',
  'fdc-168878':'prepared', 'fdc-171477':'prepared', 'fdc-171413':'as_sold', 'fdc-170567':'as_sold',
  'fdc-168462':'raw', 'fdc-170457':'raw', 'fdc-169910':'raw', 'fdc-173418':'as_sold',
  'fdc-170903':'as_sold', 'fdc-172688':'as_sold', 'fdc-173424':'prepared', 'fdc-173944':'raw',
  'fdc-170440':'prepared', 'fdc-172421':'prepared', 'fdc-169967':'prepared', 'fdc-175168':'prepared',
  'fdc-167843':'raw', 'fdc-167844':'prepared', 'fdc-171257':'as_sold', 'fdc-169761':'raw',
  'fdc-171025':'as_sold', 'fdc-171401':'as_sold', 'fdc-170000':'raw', 'fdc-170001':'prepared',
  'fdc-169975':'raw', 'fdc-169976':'prepared', 'fdc-171329':'as_sold', 'fdc-171287':'raw',
  'fdc-170026':'raw', 'fdc-169755':'raw', 'fdc-168926':'prepared', 'fdc-170420':'prepared',
  'fdc-173744':'raw', 'fdc-175194':'prepared', 'fdc-169279':'as_sold', 'fdc-173430':'as_sold',
  'fdc-169655':'as_sold', 'fdc-173647':'as_sold', 'fdc-169230':'raw', 'fdc-174928':'as_sold',
};
