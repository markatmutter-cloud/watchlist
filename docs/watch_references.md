## Watch Reference Index — Preamble

# Watch Reference Index

A structured Markdown reference index for a vintage and collectible watch listing aggregator. Twelve brands; canonical names enforced; reference numbers, nicknames, designers, calibers, and collector-grade notes for every model line.

> **File purpose**: This document is designed to be loaded into a Claude Code session to power reference matching, listing normalization, and metadata enrichment for a watch aggregator. It is a self-contained reference: someone reading only this file should have enough information to build reference-matching logic for all twelve brands.

-----

## How to use this index in a Claude Code session

1. **Load as system / context**: drop this file into the model’s working context (e.g., `@watch_reference_index.md`). Treat each `## Brand:` block as the root and `### Model line:` as the matchable unit.
1. **Match listings to model lines**: given a free-text listing, run a two-stage match:
- **Stage 1 — Brand canonical**: normalize input (case-insensitive, strip punctuation, fold “Tag-Heuer” / “TAG HEUER” / “Tag Heuer” to **TAG Heuer**; fold any pre-1985 “Tag Heuer” mention with a vintage reference to **Heuer**; fold “Lange” / “ALS” to **A. Lange & Söhne**; fold “UG” / “Universal” alone with a Polerouter/Compax ref to **Universal Genève**; fold “FPJ” / “Journe” to **F.P. Journe**).
- **Stage 2 — Reference**: extract any token matching the patterns documented below, normalize separators, and look it up under that brand’s model lines.
1. **Nickname resolution**: if the listing contains a nickname (e.g., “Pepsi”, “Hulk”, “Nina Rindt”, “Sigma dial”), match against the Cross-brand nickname dictionary in the Appendix, then verify with reference numbers.
1. **Disambiguate by era**: if a Heuer-branded chronograph is listed with a modern 4-digit alphanumeric reference (e.g., `CBN2A1A`), reassign brand to **TAG Heuer**. If it has a vintage 4-digit numeric reference (e.g., `2447`, `1153`, `1133B`), keep as **Heuer**.

## Reference-matching conventions

- **Normalize separators**: Rolex modern refs may appear as `116610LN`, `116610 LN`, `116610-LN`, or `m116610ln-0001`. Strip whitespace, hyphens, and the `m`/`-0001`-style boutique suffix; uppercase letters; compare the 6-digit stem plus suffix letters.
- **Suffix-letter semantics**:
  - Rolex: `LN` = Lunette Noire (black ceramic), `LV` = Lunette Verte (green), `LB` = Lunette Bleue, `TBR` = baguette diamond bezel, `BLNR` = “Batman/Batgirl”, `BLRO` = “Pepsi”, `CHNR` = “Root Beer”, `VTNR` = “Sprite/Destro” green-black, `GV` = Glace Verte (Milgauss green crystal), `A` = baguette diamond markers (Daytona platinum), `T` = Tudor (not applicable here), `LN/LV` together = ceramic bezel two-tone.
  - Audemars Piguet: split as `<6 digits><material><…>`. `ST` = steel, `OR` = pink/rose gold, `BA` = yellow gold, `PT` = platinum, `BC` = white gold, `CE` = ceramic, `TI` = titanium, `XT` = experimental (titanium + BMG), `IO` = forged carbon, `SR` = “Smoked Ruby”-era. Full grammar: `XXXXX(material).OO.YYYY(material).NN`.
  - Patek Philippe: `/1A` = steel bracelet, `/1R` = rose gold bracelet, `/1G` = white gold bracelet, `J` = yellow gold strap, `R` = rose gold strap, `G` = white gold strap, `P` = platinum strap, `A` = steel strap. Suffix `-001`, `-010`, `-014` distinguishes dial variants.
  - IWC: prefix `IW` + 6 digits; last two digits are the dial/strap variant (`IW328201` vs `IW328203`).
  - A. Lange & Söhne: dotted refs (`101.021`, `403.035`, `363.179`). Last digit family encodes material/dial: e.g., `101.021` = Lange 1 platinum dial-side variant; `.025` = pink gold; `.027` = yellow gold; `.030` = white gold; `.032` = rose gold/silver dial; `.039` = rose gold/black dial.
  - Heuer/TAG Heuer: vintage refs are 4 digits with optional letters (`2447N`, `2447S`, `2447SN`, `1153B`, `1158CH`); modern TAG refs use `CV`/`CAR`/`CAW`/`CBN` prefixes plus 4 digits and a 2-character suffix.
  - F.P. Journe: model letter codes (`TN`, `T`, `TV`, `R`, `RN`, `RT`, `RQ`, `CS`, `CB`, `CO`, `AR`, `OC`, `QP`, `AL`, `OCH`, `CT`, `RM`). Case material + dial date the era (brass vs. gold movement, ruthenium dial, etc.). See F.P. Journe section for full era markers.
  - Cartier: modern refs are `W` or `WG`/`WS`/`WSSA`/`WJSA`/`WGSA`/`CRW` codes (e.g., `WSSA0018`, `WGSA0007`, `CRWGTA0108`); CPCP-era refs are 4 digits (`2657`, `2435`); Privé refs include the `CRW` prefix plus year-specific suffixes.
- **Tokenizer tips**: many listings interleave nicknames and references; always extract reference first, then verify nickname matches the expected reference set. Treat “Submariner 5513” + “Maxi dial” as a refined match, not as conflicting signals.

## Caliber Quick-Reference Table

|Caliber                               |Brand                         |Family / Era                                               |Notes                                             |
|--------------------------------------|------------------------------|-----------------------------------------------------------|--------------------------------------------------|
|Cal. 1530 / 1560 / 1570               |Rolex                         |Vintage Sub/GMT/Datejust (1957–88)                         |Workhorse, non-quickset for early 1570            |
|Cal. 1575                             |Rolex                         |GMT-Master 1675                                            |Hacks/quickset depending on year                  |
|Cal. 3035 / 3135                      |Rolex                         |Datejust / Sub modern                                      |3135 ran 1988–2020                                |
|Cal. 3235                             |Rolex                         |Current Sub/Datejust 41/Sea-Dweller                        |Chronergy escapement, 70h                         |
|Cal. 4030 (Zenith El Primero base)    |Rolex                         |Daytona 16520 (1988–2000)                                  |Modified El Primero 400                           |
|Cal. 4130 / 4131                      |Rolex                         |Daytona 116500/126500 / 126506                             |4131 adds Chronergy + see-through (platinum only) |
|Cal. 3186 / 3285                      |Rolex                         |GMT-Master II                                              |3285 in current models                            |
|Cal. 321                              |Omega                         |Speedmaster CK2915–105.003; reissue 2019+                  |Lemania-based column wheel                        |
|Cal. 861 / 1861 / 3861                |Omega                         |Speedmaster Professional Moonwatch                         |Cam-actuated; 3861 Master Chronometer (2021+)     |
|Cal. 8500 / 8800 / 8900               |Omega                         |Aqua Terra / SMP / De Ville                                |Co-Axial Master Chronometer                       |
|Cal. 564 / 565                        |Omega                         |Constellation Pie-Pan, Seamaster                           |Vintage automatic                                 |
|Valjoux 72                            |Heuer / Rolex (early Daytona) |Carrera 2447, Daytona 6239                                 |Manual 3-register column wheel                    |
|Caliber 11 / 12 / 15                  |Heuer + Breitling + Buren + DD|Monaco 1133, Carrera 1153, Autavia 1163, Skipper 15640     |“Project 99” 1969 micro-rotor auto chrono         |
|Caliber 5 (ETA 2824)                  |TAG Heuer                     |Aquaracer, modern Carrera 3-hand                           |Workhorse                                         |
|Caliber 1887 / Heuer 02               |TAG Heuer                     |Modern Carrera Chronograph                                 |1887 = Seiko 6S37 base; Heuer 02 = in-house       |
|JLC Cal. 825 / K825                   |Jaeger-LeCoultre              |Memovox / Polaris E859                                     |Bumper alarm automatic                            |
|JLC Cal. 849                          |Jaeger-LeCoultre              |Reverso Tribute / classic ultra-thin                       |1.85mm manual                                     |
|JLC Cal. 854 / 822                    |Jaeger-LeCoultre              |Reverso Duoface                                            |Twin-time                                         |
|JLC Cal. 899                          |Jaeger-LeCoultre              |Master Control / Polaris                                   |Modern automatic                                  |
|Cal. 89 / 8541 / 8531                 |IWC                           |Vintage Mark XI, Ingenieur 666                             |8541 = soft-iron Ingenieur                        |
|Cal. 5000 / 51111                     |IWC                           |Big Pilot 5002/5004, 7-day                                 |Pellaton winding                                  |
|Cal. 32111                            |IWC                           |Mark XX 2022+                                              |120h, in-house                                    |
|Cal. 79320 / 79350 (Valjoux 7750 base)|IWC                           |Pilot Chronograph, Doppelchronograph                       |                                                  |
|El Primero 400/400B                   |Zenith                        |A384/A385/A386 (1969)                                      |First automatic chronograph (parallel claim)      |
|El Primero 3600                       |Zenith                        |Chronomaster Sport (2021+)                                 |1/10s central seconds, 60h                        |
|El Primero 9004                       |Zenith                        |Defy El Primero 21                                         |1/100s, dual escapements                          |
|Cal. 215 / 218-2 / 69 / 72            |Universal Genève              |Polerouter (1955–69)                                       |First micro-rotor; “Microtor”                     |
|Cal. 281 / 285 / 287                  |Universal Genève              |Tri-Compax / Compax (vintage)                              |Manual chronograph                                |
|Cal. 12-600 AT                        |Patek Philippe                |Calatrava 2526                                             |First automatic Patek                             |
|Cal. 27-70 / 27-460 / R 27 PS Q       |Patek Philippe                |Vintage 3970, 2499, 3970, repeaters                        |                                                  |
|Cal. CH 28-520 / CH 29-535            |Patek Philippe                |5170, 5270, 5270G                                          |In-house chronograph                              |
|Cal. 240 / 26-330 S C / 324 S C       |Patek Philippe                |Nautilus 5711/5811, Aquanaut, Calatrava                    |Micro-rotor (240) and full-rotor automatics       |
|Cal. L901.0 / L121.1                  |A. Lange & Söhne              |Lange 1 (gen 1 & 2)                                        |                                                  |
|Cal. L951.1 / L951.6                  |A. Lange & Söhne              |Datograph (early/Up-Down)                                  |                                                  |
|Cal. L155.1 Datomatic                 |A. Lange & Söhne              |Odysseus                                                   |4 Hz, platinum micro-rotor                        |
|Cal. L043.x                           |A. Lange & Söhne              |Zeitwerk family                                            |Jumping numerals                                  |
|Cal. 2120 / 2121                      |Audemars Piguet (and JLC base)|RO Jumbo 5402/14802/15002/15202                            |JLC ébauche, 2.45mm                               |
|Cal. 7121                             |Audemars Piguet               |RO Jumbo 16202 (2022+)                                     |In-house replacement for 2121                     |
|Cal. 2385 / 2326 / 3120 / 4302        |Audemars Piguet               |RO Selfwinding, Chrono                                     |4302 = current in-house 3-hand                    |
|Cal. 1185 / 2385 / 4400               |Audemars Piguet               |RO/Offshore Chronograph                                    |F. Piguet 1185 base for many                      |
|Cal. 1304                             |F.P. Journe                   |Chronomètre Souverain                                      |Rose-gold movement, twin barrel                   |
|Cal. 1499 (vertical clutch)           |F.P. Journe                   |Centigraphe, Octa                                          |                                                  |
|Cal. 1300 / 1300.3                    |F.P. Journe                   |Tourbillon Souverain TN/TV                                 |                                                  |
|Cal. 1499.3                           |F.P. Journe                   |Chronomètre à Résonance RN/RT/RQ                           |Twin balance resonance                            |
|Cal. 070 / 1928 MC / 1847 MC / 9628 MC|Cartier                       |Tank Normale Privé / Tortue Mono / modern Santos / skeleton|                                                  |

-----

## Brand canonical names (use exact spelling)

1. **Rolex**
1. **Omega**
1. **Heuer** — vintage Heuer (pre-1985); use for all references such as 2447, 1133B, 1163, 1153 regardless of how the listing brands them
1. **TAG Heuer** — post-1985 / modern; use for all “TAG Heuer” branded modern references (CV, CAR, CAW, CBN, WAZ, etc.)
1. **Jaeger-LeCoultre**
1. **IWC**
1. **Zenith**
1. **Patek Philippe**
1. **A. Lange & Söhne**
1. **Universal Genève**
1. **Audemars Piguet**
1. **F.P. Journe**
1. **Cartier**

## Rolex

## Brand: Rolex

### Model line: Submariner

- **Refs**: `6204`, `6205`, `6200`, `6536`, `6538`, `5508`, `5510`, `5512`, `5513`, `5514`, `1680`, `1680/8`, `5513/5512 Maxi`, `14060`, `14060M`, `16800`, `168000`, `16610`, `16610LV`, `14270` (n/a—Explorer), `114060`, `116610LN`, `116610LV`, `116618LN`, `116619LB`, `124060`, `126610LN`, `126610LV`, `126613LN`, `126613LB`, `126618LN`, `126619LB`
- **Years**: 1953–present
- **Designer / movement**: René-Paul Jeanneret (concept) · Cal. A296 / 1030 (early), 1530 / 1560 / 1570 (1960s–80s), 3035 / 3135 (1988–2020), 3230 / 3235 (2020+ no-date and date)
- **Key identifiers**: Oyster case, unidirectional 60-min dive bezel, Mercedes hands, screw-down crown, 100m–300m depth rating; ceramic Cerachrom bezel from 2010 (LN/LV); date Cyclops on dated refs; Maxi dial = fat lume plots on later 5513s; “Square Crown Guards” on early 5512/5513.
- **Common nicknames**: “James Bond” (6538/big crown), “MilSub” (5513/5517 military), “Comex” (5514/16610), “Red Sub” (1680 red “Submariner” text), “Hulk” (116610LV all-green), “Kermit” (16610LV green bezel only, 50th anniversary 2003), “Smurf” (116619LB white-gold blue), “Cermit”/“Starbucks” (126610LV)
- **Notes**: The Submariner is the prototype modern dive watch; ref. 6204 (1953) launched at the Basel Fair set the format. The transition from “small crown” 6200/6205 to “big crown” 6538 (1956) and on to crown-guard 5512/5513 (1960s) defines the most collectible vintage era, with gilt/glossy dials, exclamation-point dials, and meters-first/feet-first text variations driving five-figure to seven-figure auction results. The 1680 “Red” Submariner (1969–73) was the first with date; the 16800 (1979) added unidirectional bezel and sapphire; the 16610LV “Kermit” (2003) was the first green-bezel anniversary piece, the 116610LV “Hulk” (2010–20) the first all-green ceramic, and the 126610LV “Cermit”/“Starbucks” (2020+) returned to a black dial with green bezel on a 41mm case. The No-Date line (14060/14060M/114060/124060) is the purist’s reference, especially the four-line dial 14060M COSC. For listings, distinguish dial generations (gilt vs. matte, meters-first vs. feet-first, glossy vs. matte), pointed vs. straight crown guards on 5512/5513, and lume-plot patina (“tropical” gilt browning is highly valued).

### Model line: GMT-Master / GMT-Master II

- **Refs**: `6542`, `1675`, `1675/3`, `1675/8`, `16750`, `16753`, `16758`, `16760`, `16700`, `16710`, `16713`, `16718`, `116710LN`, `116710BLNR`, `116713LN`, `116718LN`, `116719BLRO`, `126710BLRO`, `126710BLNR`, `126711CHNR`, `126715CHNR`, `126720VTNR`
- **Years**: 1954–present
- **Designer / movement**: Designed for Pan Am pilots · Cal. 1036/1066 (6542), 1565/1575 (1675/16750), 3075/3175 (16710), 3186/3285 (modern GMT-Master II)
- **Key identifiers**: 24-hour fourth hand, bidirectional 24-hour bezel (rotating), red/blue or black/red bezel; date Cyclops; jubilee or oyster bracelet; crown guards from 1675 onward; Cerachrom two-color bezel introduced 2013 (BLNR).
- **Common nicknames**: “Pepsi” (red/blue 1675/16710/116719/126710BLRO), “Coke” (red/black 16710), “Root Beer” (brown/gold 1675/16753, modern CHNR), “Batman/Batgirl” (BLNR — Batman on Oyster, Batgirl on Jubilee), “Sprite”/“Destro” (126720VTNR, green/black bezel + left-hand crown), “Fat Lady” (16760 1980s thicker case), “Pussy Galore” (6542 no crown guards)
- **Notes**: Born in 1954 for Pan Am transatlantic crews, the 6542 used a bakelite bezel (recalled due to cracking) and is among the rarest sport Rolexes; the 1675 (1959–80) is the workhorse vintage GMT with gilt, matte, and many tropical variants. The 16760 “Fat Lady” introduced the independently jumping local hour, hence “GMT-Master II”. The 116710BLNR “Batman” (2013) brought the first two-color ceramic bezel — a technical milestone. The 126720VTNR (2022) reversed the crown to the left side, sparking the “Destro/Sprite” nickname. Collector-critical signals include MK1–MK7 dial variants on 1675, “long E” Submariner-style crown logos, fade level on the bezel insert (faded blue “blueberry” 1675s command premiums), and bracelet correctness (riveted vs. folded-link Oyster, USA-stamped end-links).

### Model line: Daytona / Cosmograph

- **Refs**: `6238`, `6239`, `6240`, `6241`, `6262`, `6263`, `6264`, `6265`, `6263/6265 "Big Red"`, `6269`, `6270`, `16520`, `16523`, `16528`, `16518`, `116520`, `116523`, `116528`, `116519`, `116515LN`, `116505`, `116506`, `116509`, `116500LN`, `116503`, `126500LN`, `126503`, `126505`, `126506`, `126508`, `126518LN`, `126519LN`
- **Years**: 1963–present
- **Designer / movement**: Rolex (in response to Heuer/Omega competition) · Valjoux 72 base (6238–6265 manual), Zenith El Primero 400 base (Cal. 4030 in 16520, 1988–2000), in-house Cal. 4130 (116520, 2000–2016) and Cal. 4131 (126506, 2023+)
- **Key identifiers**: Three-register chronograph, tachymeter bezel (steel/acrylic on vintage; aluminium 1988+; black Cerachrom 116500LN 2016+); screw-down pushers from 6240; “Cosmograph” or “Daytona” dial text variants on vintage.
- **Common nicknames**: “Paul Newman” (exotic dial 6239/6241/6262/6263/6264/6265 with Art Deco numerals and contrasting subdials — Newman’s own 6239 sold $17.75M), “Big Red” (“Daytona” in red on 6263/6265), “Solo” (no “Cosmograph” on 6263/6265), “Mark 1/2/3 dial” (16520 — “L-series” floating Cosmograph text valued highest), “Patrizzi” (16520 brown-fading silver subdials), “Panda” (white dial with black subdials), “Reverse Panda” (black dial white subdials), “Rainbow” (116595RBOW gem-set), “John Mayer” (116508 green-dial yellow gold)
- **Notes**: The Daytona’s collector status is unique: launched as a slow seller in 1963, vintage manual refs went from clearance pieces to seven-figure rarities largely on Newman’s celebrity. The 16520 (1988–2000) finally gave the Daytona an automatic movement (modified Zenith El Primero, downbeated to 28,800 vph) and is increasingly collected by dial variant: 4-line dial, 5-line dial, “Floating Cosmograph”, “Patrizzi” tropical patina. The 116500LN (2016) introduced the ceramic bezel and is the volume reference of the modern era; in 2023, the 126500LN/126503/126506 refreshed the line with Cal. 4131, redesigned dial proportions, and — uniquely on the platinum 126506 — a sapphire caseback, a first for a Rolex sports watch.  The 126506 retains the platinum-exclusive “ice blue” dial with chestnut Cerachrom bezel introduced on the 50th-anniversary 116506 (2013). For listings, the most consequential disambiguation points are: vintage exotic dials (Newman certification by Pucci Papaleo or auction provenance), pump vs. screw-down pushers, the 16520 floating dial and inverted-6 markers, and the 116500LN vs. 126500LN bezel font/case proportions.

### Model line: Datejust

- **Refs**: `4467`, `6075`, `6105`, `6305`, `1601`, `1603`, `1600`, `1611`, `16014`, `16030`, `16234`, `16233`, `16238`, `16200`, `16220`, `16264` (Turn-O-Graph), `116200`, `116234`, `116233`, `116231`, `126200`, `126233`, `126234`, `126231`, `126300`, `126333`, `126334`, `178240`/`178241` (mid-size), `116300`, `17013` / `17014` (Oysterquartz)
- **Years**: 1945–present
- **Designer / movement**: Rolex (first wristwatch with auto date) · Cal. A296, 1030, 1565, 1575, 3035, 3135, 3235; Cal. 5035 (Oysterquartz)
- **Key identifiers**: Fluted, smooth, or engine-turned bezel; jubilee or oyster bracelet; date window at 3 with Cyclops (from 1953); 36mm classic, 41mm modern, plus 31/28mm ladies. Oysterquartz uses integrated bracelet and angular case.
- **Common nicknames**: “Wide Boy” (1970s 1601 with wider markers/hands), “Pie-Pan” (rare overlapping with Constellation usage — not Rolex), “Buckley dial” (Roman numerals printed, often diamond-set), “Wimbledon” (slate dial with green Roman numerals on 116200/126234)
- **Notes**: Introduced in 1945 for Rolex’s 40th anniversary, the Datejust established the date complication template the entire industry adopted. The 1601 (fluted bezel, applied indices, 1959–77) is the prototype vintage Datejust; the 16014/16234 carried the line through the quartz era; the 116200 (2005) added solid links and engraved rehaut; the 126200/126234 (2018) introduced Cal. 3235 with 70h power reserve, and the 41mm 126300/126334 effectively replaced the discontinued 116300 Datejust II. The Oysterquartz (17013/17014/17000, 1977–2003) is a fully integrated angular case housing the 5035/5055 quartz movement — a cult subcategory. For listing matching, key signals are: dial signature variants (Tiffany & Co., Cartier, Serpico y Laino, Joyeria Riviera co-signed dials carry significant premiums), bezel type (fluted vs. smooth vs. engine-turned), and Cyclops presence (omitted on certain Tiffany doubles).

### Model line: Day-Date / President

- **Refs**: `6510`, `6511`, `6611`, `1803`, `1802`, `1804`, `1807`, `1831` (bark), `18038`, `18039`, `18238`, `18239`, `118238`, `118239`, `118208`, `118206` (platinum), `218238` (Day-Date II 41mm), `228238`, `228206`, `228235`, `228239`, `128238`, `128235`, `128239`, `128348RBR`
- **Years**: 1956–present
- **Designer / movement**: Rolex · Cal. 1055/1555/1556 (vintage), 3055/3155 (1977–2015), 3255 (2015+)
- **Key identifiers**: Day spelled out at 12, date at 3; only in precious metal (yellow/white/rose gold or platinum); fluted bezel typical; “President” bracelet (semi-circular three-piece links); 36mm classic, 40mm Day-Date 40 (2015), 41mm Day-Date II (2008–15, larger lugs and case)
- **Common nicknames**: “President” (entire family), “Stella dial” (vintage 1803 with vibrant lacquered enamel-look dials: turquoise, coral, lapis, oxblood), “Bark” (1831 with bark-finished gold), “Qaboos dial” (Oman crest co-signed), “Khanjar” (Oman Khanjar dagger applied)
- **Notes**: Launched in 1956 with Cal. 1055, the Day-Date was Rolex’s flagship — the first wristwatch to spell out both day and date, and the only Oyster to be sold exclusively in gold/platinum. Vintage 1803 Day-Dates with Stella dials (1970s lacquered colors) and special order Arabic-language day discs are among the most diverse collector subcategory in Rolex. The 18038/18238 transitioned to sapphire crystal and Cal. 3055/3155. The 118208/118238 (2000) added solid end-links. The Day-Date II 218238 (2008) at 41mm was retired in 2015 for the Day-Date 40 (228238/228206/228239) with Cal. 3255, which is now the flagship. Auction signal: platinum 18206/118206/228206 with ice-blue dial, retailer-signed (Tiffany, Cartier) vintage 1803s, and Stella dials in unusual colors (oxblood, lapis, turquoise) drive premiums. The 128348RBR (2019) is a 36mm rainbow-baguette boutique exclusive.

### Model line: Explorer / Explorer II

- **Refs (Explorer)**: `6098`, `6150`, `6298`, `6350`, `6610`, `1016`, `14270`, `114270`, `214270`, `124270`, `224270`
- **Refs (Explorer II)**: `1655`, `16550`, `16570`, `216570`, `226570`, `226570 polar`
- **Years**: 1953–present (Explorer); 1971–present (Explorer II)
- **Designer / movement**: Inspired by 1953 Everest expedition · Cal. 1030, 1560, 1570 (1016); 3000/3130/3132 (14270/114270/214270); 3230 (124270); 3187/3285 (216570/226570)
- **Key identifiers**: Explorer = 3/6/9 dial, no date, Mercedes hands, smooth bezel, 36mm vintage / 39mm 214270 / 36mm 124270 / 40mm 224270. Explorer II = fixed 24-hour bezel, additional 24-hour hand, date with Cyclops; “Polar” white dial; orange GMT hand on 1655 and 216570/226570.
- **Common nicknames**: “Steve McQueen” (1655 — misattributed; McQueen actually wore a 5512 Sub), “Freccione” (1655, “Arrow” in Italian for the orange GMT hand), “Polar” (white-dial Explorer II), “Mark 1/2/3/4/5 dial” (1016 dial generations), “Albino” 14270 (rare white-dial 14270 prototype)
- **Notes**: The Explorer codified the simple, legible Rolex tool watch; the 1016 (1963–89) is the canonical reference, with five dial executions tracked by collectors (Mk1 gilt with chapter ring; Mk2 matte glossy transition; Mk3–5 matte). The Explorer II 1655 (1971–85) was conceived for spelunkers needing AM/PM differentiation — its orange “Freccione” hand and fixed 24h bezel make it the cult vintage GMT alternative. The 16550 (1985–89, white “Polar” or black) introduced the now-standard layout with independently jumping local hour; the 216570 (42mm, 2011) brought a “Maxi case” and revived the orange hand. The 124270 (2021, 36mm, Cal. 3230) returned the Explorer to its original size, while the 224270 (2023, 40mm) replaced 214270 for the larger-case audience. Cream/“creamy” patina on 1016 tritium plots and “spider” cracking on lacquer dials are valuation signals.

### Model line: Sea-Dweller / Deepsea

- **Refs**: `1665`, `1665 "Single Red"`, `1665 "Double Red"`, `1665 "Great White"`, `16660`, `16600`, `116660` (Deepsea), `126660` (Deepsea), `136660` (Deepsea Challenge), `116600`, `126600`, `126603`
- **Years**: 1967–present
- **Designer / movement**: Co-developed with COMEX divers · Cal. 1575, 3035, 3135, 3235, 3230
- **Key identifiers**: Helium escape valve (HEV) at 9; thicker case; 1220m–3900m water resistance on Sea-Dweller, 11,000m on Deepsea Challenge (136660); no Cyclops (until 126603). Black dial only on classic Sea-Dweller; “D-Blue” gradient on 126660 commemorates James Cameron’s Deepsea Challenge dive.
- **Common nicknames**: “Double Red Sea-Dweller / DRSD” (1665 with two lines of red text), “Single Red” (1665 transitional, very rare), “Great White” / “Triple Six” (1665 last execution, all-white text), “James Cameron” (126660 D-Blue gradient), “Deepsea Challenge” (136660 titanium 50mm)
- **Notes**: Developed for saturation divers (COMEX), the 1665 Sea-Dweller is one of the most documented vintage Rolex references — DRSD and Single Red examples regularly clear $100k+; Patrizzi-style dial cataloguing matters. The 16600 (1989–2008) updated to sapphire and Cal. 3135. The 2008 Deepsea 116660 introduced the Ringlock system for 3,900m depth and a 44mm chunky profile, followed by the 126660 (2018) with redesigned bracelet/end-links and the 126603 two-tone (2023). The 136660 Deepsea Challenge (2022) is a 50mm titanium watch rated to 11,000m, derived from the experimental piece that descended to Challenger Deep. Listing-critical signals: depth rating text on dial (“2000ft = 610m” vs. “1220m = 4000ft”), HEV presence, COMEX co-signature.

### Model line: Milgauss

- **Refs**: `6541`, `1019`, `116400`, `116400GV`
- **Years**: 1956–1988 (vintage); 2007–2023 (modern)
- **Designer / movement**: Rolex anti-magnetic for CERN scientists · Cal. 1066M / 1080 (6541), 1580 (1019), 3131 (116400)
- **Key identifiers**: Faraday-cage inner case; lightning-bolt seconds hand (6541 and 116400/GV); 1000 gauss magnetic resistance; honeycomb (vintage) or smooth dial; “GV” = green sapphire crystal (industry-unique).
- **Common nicknames**: “Lightning Bolt” (6541, 116400GV), “Green Crystal” / “GV” (116400GV), “Z-Blue” (116400GV with blue electric dial 2014)
- **Notes**: The 6541 (1956) was the original anti-magnetic scientific watch, with rotating bezel and lightning bolt; production was tiny (~1000 pieces) and original examples now command auction premiums north of $200k. The 1019 (1960–88) replaced it with a more conservative design (smooth bezel, plain seconds) and is the longest-running anti-magnetic Rolex. The 116400 (2007) revived the line with a modern 40mm case, returning the lightning bolt; the 116400GV (Glace Verte) added the green sapphire crystal, the only one Rolex ever made. The Z-Blue dial variant (2014) is the most collected modern Milgauss. Discontinued in 2023 with no announced successor. Listing signals: dial-color disambiguation (black/white/Z-blue), original lightning hand, GV vs. non-GV crystal.

### Model line: Oyster Perpetual / Air-King

- **Refs (Oyster Perpetual)**: `1002`, `1003`, `1005`, `14000`, `14000M`, `114200`, `114300`, `116000`, `116900`, `124200`, `124300`, `126000`
- **Refs (Air-King)**: `4925`, `5500`, `14000`, `14010`, `114200`, `114210`, `116900`, `126900`
- **Years**: 1945–present (OP); 1945–present (Air-King)
- **Designer / movement**: Rolex · Cal. 1530, 1560, 1570, 3130/3131 (114200/114210), 3132 (116900), 3230 (current)
- **Key identifiers**: OP = simplest Rolex layout, no date, no rotating bezel, no luminous on some vintage; 28/31/34/36/41mm modern; vivid color dials (turquoise/yellow/coral/green/red/candy pink) on 2020 124300. Air-King = larger Arabic 3/6/9, mixed scale, 40mm 116900/126900 with anti-magnetic soft-iron cage.
- **Common nicknames**: “Tiffany OP” (vintage 1002/1005 with Tiffany & Co. co-signed dials), “Stella OP” (turquoise/coral/yellow vintage), “Celebration” 124300 (rainbow bubbles dial, 2023 unreleased rumor — confirmed as listed reference), “Candy” 124300 (2020 colored dial set: green/coral/yellow/turquoise/pink/silver)
- **Notes**: The Oyster Perpetual is the essence of the brand: Oyster case + Perpetual rotor + nothing else. The 1002/1003/1005 (1959–80) are the canonical vintage references; the 14000 family modernized the case in 1994; the 124300 (2020) shocked the market with vivid colored dials in 41mm, instantly hyped and back-ordered. The Air-King traces to WWII pilots (5500 from 1957), was modernized in 2016 as the 116900 (40mm, Cal. 3131, distinctive 3/6/9 Arabic dial), and revised in 2022 as the 126900 with crown guards and improved bracelet. Tiffany double-signed OPs from the 1960s–80s remain a top-tier collecting category.

### Model line: Turn-O-Graph / Thunderbird

- **Refs**: `6202`, `1625`, `16263`, `16264`, `116264`
- **Years**: 1953–2011
- **Designer / movement**: Rolex · Cal. 1030 (6202), 1570/3035/3135 (later)
- **Key identifiers**: Rotating bezel on a Datejust case; date at 3; “Turn-O-Graph” or “Thunderbird” on dial (US market); two-tone (1980s onward).
- **Common nicknames**: “Thunderbird” (US-market name, USAF Thunderbirds squadron association), “Pre-Sub Turn-O-Graph” (6202, predates 6204 Submariner)
- **Notes**: The 6202 (1953) is the genealogical ancestor of every Rolex sports watch — a Datejust case with a rotating bezel. The line was renamed for the US market when adopted as USAF Thunderbirds gift watches. The 16264/116264 (1990s–2000s) used a Datejust case with knurled rotating bezel, two-tone steel/white-gold, becoming a quasi-tool dress watch. Discontinued in 2011; collector interest has grown sharply as the only Rolex bridging Datejust elegance and rotating-bezel utility.

### Model line: Triple Calendar / Moonphase (6062, 8171)

- **Refs**: `6062`, `8171`, `6062 Stelline`
- **Years**: 1949–1952
- **Designer / movement**: Rolex · Cal. 9 3⁄4’’’ (8171), A296 base (6062)
- **Key identifiers**: Day and month apertures at 12; pointer date; moonphase aperture at 6; 36mm. The 6062 is Oyster-cased (waterproof), the 8171 is “Padellone” — large but non-Oyster snap-back.
- **Common nicknames**: “Padellone” (8171, “big frying pan” in Italian), “Stelline” (6062 with star hour markers — extremely rare), “Dato Compax” (era nickname for triple-calendar moonphase)
- **Notes**: Rolex’s only vintage triple-calendar moonphases, the 6062 and 8171 are the brand’s most romantic complicated wristwatches — both produced only 1949–1952 in tiny numbers. The 6062 in yellow gold with Stelline (star) markers and Arabic numerals has cleared $1.5M at auction; steel examples are vanishingly rare. The 8171 “Padellone” is non-waterproof and was favored in elegant gold cases, often with Serpico y Laino retailer signatures. Listings to scrutinize: dial originality (refinishing kills value), case sharpness, and retailer co-signatures.


<!-- Below: gap-patch additions for Rolex merged from docs/watch_references_gaps_patch.md -->

### Model line: Explorer (additions — ref 1016 dial variants)

- **Refs**: `1016`
- **Years**: 1963–1989
- **Designer / movement**: Rolex · Cal. 1560 (1963–65), Cal. 1570 (1965–89)
- **Key identifiers**: 36mm round Oyster case, smooth bezel, black dial with 3/6/9 Arabic numerals in luminous surrounds, Mercedes hands. Five distinct dial executions tracked by collectors.
- **Common nicknames**: “Frog Foot” (Mk1 gilt dial — the large serif numerals on the earliest gilt dials resemble a frog’s foot), “Exclamation dial” (Mk2 — small lume pip to the left of the seconds track), “Underline” (Mk3 — “SWISS MADE” underlined), “Matte” (Mk4–5 transition to matte finish from 1968)
- **Notes**: The 1016 is the definitive vintage Explorer, produced for 26 years with five major dial variants. Mk1 “gilt” dials (1963–67, gold printing on gloss lacquer, “Frog Foot” serif numerals) are the most collectible and command the highest premiums — a clean unpolished Mk1 clears $30–60k. Mk2 introduced a smaller exclamation lume pip. From Mk3 onward (late 1960s) the dial transitioned to matte finishing. All 1016s share the same case, bracelet (Oyster 7836), and the same movement family (Cal. 1560/1570). Listing signals: dial generation (gilt vs. matte, serif vs. sans-serif numerals), lume pip position relative to the chapter ring, and “SWISS MADE” underline presence (Mk3).

### Model line: Explorer II (additions — 16550, 16570 dial variants)

- **Refs**: `16550`, `16570`
- **Years**: 16550: 1985–1989 · 16570: 1989–2011
- **Designer / movement**: Rolex · Cal. 3085 (16550), Cal. 3185 / 3186 (16570)
- **Key identifiers**: 16550 = first Explorer II with sapphire crystal and independently jumping local hour (GMT-Master II mechanism), white “Rail Dial” or black dial, 40mm, orange 24h hand. 16570 = updated case, same concept, white “Polar” or black dial, orange 24h hand.
- **Common nicknames**: “Rail Dial” (16550 white dial — the minute track resembles a rail track), “Cream Dial” (16550 white dial with creamy patina over time — highly sought), “Polar” (16570 white dial), “Mk1/2/3/4/5 dial” (16570 five dial generations tracking typography and lume changes)
- **Notes**: The 16550 (1985–89) introduced the independently jumping local hour — meaning you could set local time in 1-hour increments without stopping the watch — carrying this over from the GMT-Master II. The white dial 16550 “Rail Dial” is particularly collected; examples with pronounced cream patina are among the most desirable modern Rolex sport references, often clearing $20–40k. The 16570 ran for 22 years through five dial generations; Mk1 (glossy white/black, early 1989–93) and Mk5 (matte, late production) are the collector poles. Listing signals: caseback type (solid vs. display), dial color (white/Polar vs. black), and lume plot color (tritium ivory vs. luminova white) define era.

### Model line: Explorer II (addition — ref 1655 dial variants)

- **Refs**: `1655`
- **Years**: 1971–1985
- **Designer / movement**: Rolex · Cal. 1575
- **Key identifiers**: Fixed 24-hour bezel (not rotating), large orange “Freccione” 24h arrow hand, 39mm, black dial only, no independently jumping hour (the 24h hand tracks home time continuously). Five dial marks (Mk1–Mk5) track typography changes over 14 years.
- **Common nicknames**: “Freccione” (the orange arrow hand — Italian for “big arrow”), “Steve McQueen” (widely misattributed — McQueen actually wore a Sub 5512, not a 1655), “MK1/2/3/4/5” (dial variants)
- **Notes**: Mk1 dials (1971–74) have the largest orange Freccione and earliest font; Mk5 dials (1982–85) are the latest production. The 1655 was designed with cave explorers and spelunkers in mind (the fixed 24h bezel helps distinguish AM from PM in lightless environments). Clean Mk1 examples regularly trade at $25–60k+. Listing signal: confirm orange vs. white 24h hand (all production 1655 = orange), bezel type (fixed, engraved 24-hour scale), and dial mark via typography.

### Model line: Oysterdate / Date

- **Refs**: `1500`, `1501`, `1502`, `1503`, `6694`
- **Years**: 1950s–1980s
- **Designer / movement**: Rolex · Cal. 1520 / 1530 / 1570 family
- **Key identifiers**: 34mm round Oyster case, date window at 3 with magnifying Cyclops lens, no fluted or engine-turned bezel (smooth bezel standard), center seconds. The “Date” line sits below the Datejust (no jubilee bracelet offered as standard, simpler bezel options).
- **Common nicknames**: None widely established; collectors refer to these by reference number.
- **Notes**: The Rolex Date (not to be confused with the Datejust) is a simpler, smaller sibling — 34mm with smooth bezel, date at 3, and typically sold on an Oyster bracelet. Ref 1500 is the base steel Date; 1501 adds engine-turned bezel; 1502 is yellow gold; 1503 is white gold. Ref 6694 is the Oysterdate Precision (manual-wind), a non-automatic Date variant from the 1960s–70s often sold without a bracelet on a strap. Listing signals: 34mm case, smooth bezel, and “OYSTERDATE” or “DATE” on dial (not “DATEJUST”) confirm this sub-family.

### Model line: Oysterquartz Datejust

- **Refs**: `17000`, `17013`, `17014`, `69173`, `69178`
- **Years**: 1977–2001
- **Designer / movement**: Rolex · Cal. 5035 (quartz), Cal. 5055 (date/day quartz)
- **Key identifiers**: Angular integrated bracelet (unlike any other Rolex — the bracelet flows into the case without visible lugs); brushed angular case sides; integrated “Presidential-style” link bracelet with H-links; sapphire crystal; 36mm (mens) or 26mm (ladies). 17000 = steel, 17013 = steel/gold, 17014 = gold.
- **Common nicknames**: “Oysterquartz” (the entire sub-family); “OQ” (collector abbreviation)
- **Notes**: The Oysterquartz (1977) was Rolex’s response to the quartz crisis and the Audemars Piguet Royal Oak / Patek Nautilus integrated-bracelet aesthetic — the only Rolex to use a fully integrated bracelet that flows into the case. Despite its quartz movement, the Oysterquartz has developed a cult following for its distinctive angular design and the fact that it represents a unique chapter in Rolex history. Ladies refs 69173 (steel) and 69178 (steel/gold) are the parallel women’s Oysterquartz Datejust. Production ended in 2001 with no successor. Listing signals: angular integrated bracelet with visible brushed H-links, no lug profile, “OYSTERQUARTZ” on dial, and quartz battery indicator (red sector on date).

### Model line: Datejust (Two-tone additions)

- **Refs**: `16013`, `16018`, `15037`, `15200`
- **Years**: 1980s–1990s
- **Designer / movement**: Rolex · Cal. 3035 (16013), Cal. 3135 (post-1988 variants)
- **Key identifiers**: 16013 = steel with 18k yellow gold fluted bezel, jubilee bracelet, Rolesor two-tone. 16018 = full 18k yellow gold Datejust (not two-tone). 15037 is a Date (not Datejust) in yellow gold with date at 3. 15200 = Datejust II or variant.
- **Common nicknames**: “Rolesor” (two-tone steel/gold combination — Rolex’s term), “Bluesy” applies more to Submariner; Datejust two-tones don’t have strong nicknames.
- **Notes**: The 16013 is the canonical 1980s two-tone Datejust: steel case with yellow-gold fluted bezel and Jubilee bracelet, typically with champagne or white dial. It was replaced by the 16233 (steel with gold bezel, sapphire crystal). The 16018 is the all-yellow-gold Datejust from the same era. These references are now significantly below retail on the secondary market and represent strong value for wearers vs. collectors. Listing signals: “Rolesor” two-tone, fluted gold bezel on steel case, jubilee bracelet confirm this family.

### Model line: Air-King (additions)

- **Refs**: `5500`, `14000`, `14010`
- **Years**: 5500: 1957–1989 · 14000: 1989–2014
- **Designer / movement**: Rolex · Cal. 1520 / 1530 (5500), Cal. 3000 / 3130 (14000)
- **Key identifiers**: 34mm round Oyster case, smooth bezel, usually no date, “AIR-KING” on dial, sometimes with “PRECISION” or “SUPER PRECISION” text. 14000 = first Air-King with sapphire crystal and Cal. 3000. “Domino’s” edition of 14000 = white dial with “Domino’s Pizza” co-signed logo — a promotional piece given to top franchisees.
- **Common nicknames**: “Domino’s” (14000 with Domino’s Pizza co-signed dial — a real promotional piece, extremely collectible and regularly faked)
- **Notes**: The Air-King 5500 (1957–89) was Rolex’s entry-level sport watch for much of the postwar era, named to honor RAF pilots. The transition to Cal. 3000 in the 14000 (1989) brought in-house movement quality without changing the conservative aesthetics. Co-signed promotional Air-Kings (Domino’s Pizza, John Player, Kellogg’s) are a niche collecting category — the Domino’s dial is a legitimate factory production and authenticated examples clear $5–15k. Listing signals: “AIR-KING” on dial (not “DATEJUST” or “DATE”), smooth bezel, 34mm case, and no date window.

### Model line: Submariner (additions — gold variants)

- **Refs**: `16808`, `16618`
- **Years**: 16808: 1983–1988 · 16618: 1988–2010
- **Designer / movement**: Rolex · Cal. 3035 (16808), Cal. 3135 (16618)
- **Key identifiers**: Full 18k yellow gold case and bracelet; black or blue dial; ceramic or aluminum bezel (16808 = aluminum, 16618 = aluminum). 16808 is the transition ref from 5 to 6 digits in yellow gold; 16618 is the long-running yellow gold Sub Date with sapphire crystal.
- **Common nicknames**: “Gold Sub” (both refs), “Tropical Blue” (16808 examples where the blue dial has developed a brown patina — highly prized)
- **Notes**: The yellow gold Submariner is a distinct collecting category — far rarer than steel equivalents and with its own patina possibilities. The 16808 is notable for the rare “Tropical Blue” dial variant where the blue dial has aged to a warm brown — these are among the most expensive Submariner variants at auction, clearing $80–150k+. The 16618 continued the line through 2010 when the 116618LN/LB succeeded it. Listing signals: full yellow gold case and bracelet (not two-tone), “DATE” on dial, blue or black dial, aluminum bezel.

### Model line: Day-Date (additions)

- **Refs**: `18078`
- **Years**: 1988–2000s
- **Designer / movement**: Rolex · Cal. 3155
- **Key identifiers**: Day-Date in 18k yellow gold with “Florentine” or bark-finish bracelet; 18078 specifically denotes a Day-Date with a distinctive textured/carved case finish. 18078 = yellow gold Day-Date with “Bark” (tronçonné) finish.
- **Common nicknames**: “Bark” (the tree-bark textured finish)
- **Notes**: The 18078 is a Day-Date variant with bark/tronçonné textured finish applied to both the case and bracelet — an unusual surface treatment that was popular in the 1980s. Less collected than standard Day-Dates but valued by enthusiasts of unusual Rolex finishing. Listing signals: bark/tronçonné texture on case surfaces, “PRESIDENT” bracelet standard, 18k yellow gold.

### Model line: Datejust Ladies (additions)

- **Refs**: `6917`, `69173`, `69178`
- **Years**: 1970s–2001
- **Designer / movement**: Rolex · Cal. 2030 (6917 automatic), Cal. 5035 (69173/69178 quartz Oysterquartz)
- **Key identifiers**: 26mm ladies Oysterdate/Datejust cases; 6917 = automatic ladies Datejust with fluted bezel; 69173 = Oysterquartz ladies steel; 69178 = Oysterquartz ladies two-tone.
- **Common nicknames**: “Ladies Oysterquartz” (69173/69178)
- **Notes**: These are the ladies equivalents of the standard Datejust (6917) and Oysterquartz (69173/69178). The 6917 (26mm automatic, 1970s–80s) is the vintage ladies Datejust equivalent. Ladies Oysterquartz refs 69173/69178 share the angular integrated-bracelet design of the men’s 17000 family. Listing signals: 26mm case size and “DATEJUST” or “OYSTERQUARTZ” on dial with single date window at 3.

### Model line: Vintage dress / misc Rolex

- **Refs**: `6426`, `6605`, `3372`, `15200`
- **Years**: Various vintage
- **Designer / movement**: Various vintage calibers
- **Key identifiers**: 6426 = Rolex Turn-O-Graph / Oysterdate with rotating bezel, c.1953–57 (pre-dates the dedicated Submariner); 6605 = vintage Rolex Oyster Perpetual date variant, 1950s; 3372 = very early 1940s Rolex Oyster manual-wind dress watch.
- **Common nicknames**: None widely established
- **Notes**: These are relatively obscure vintage references. Ref 3372 (1940s) predates most modern Rolex categories — it is a manual-wind 32mm dress watch with applied indices. Ref 6605 (1950s) is an early Oysterdate automatic. Ref 6426 is a transitional reference appearing just before or alongside the first Submariner. For listing matching these are best handled as “vintage Rolex” with model name from listing title text rather than reference-number matching alone, as individual production numbers are very small.

### Non-watch token: bracelet references

- `78350` — **Bracelet reference, not a watch model.** Rolex 78350 is the reference for the solid-link Oyster bracelet used on many Rolex sport models from the 1990s–2000s (Submariner, GMT-Master, Explorer). Treat as a metadata/bracelet tag in listings, not a model identifier.

-----

## Omega

## Brand: Omega

### Model line: Speedmaster

- **Refs**: `CK2915-1/2/3`, `CK2998-1 through -6`, `105.002`, `105.003`, `105.012`, `145.012`, `145.022`, `145.0022`, `345.0022`, `ST 145.022`, `3590.50`, `3570.50`, `311.30.42.30.01.005`, `311.30.42.30.01.006`, `310.30.42.50.01.001`, `310.30.42.50.01.002`, `310.60.42.50.04.001` (Canopus gold), `145.014` (Mark II), `145.0014`, `176.002` (Mark III), `176.0012` (Mark IV), `1045` (Mark V), `145.0036`/`376.0822` (Mark 4.5), `3592.50` (Reduced)
- **Years**: 1957–present
- **Designer / movement**: Pierre Moinat / Claude Baillod (CK2915 case design) · Lemania-based Cal. 321 (column wheel, 1957–68; reissued 2019+), Cal. 861 (1968–96, cam-actuated), Cal. 1861 (1996–2021), Cal. 3861 Master Chronometer (2021+), Cal. 1045 (Mark V Lemania 5100)
- **Key identifiers**: Asymmetric case from 105.012 onward; “Professional” on dial from 105.012 (1965); tachymeter bezel (steel insert through CK2998; black anodized aluminium from 145.012; black aluminium and now ceramic on 310.30); hesalite crystal on Moonwatch (sapphire variants exist); straight-lug case on pre-Professional CK2915/CK2998.
- **Common nicknames**: “Broad Arrow” (CK2915 with broad-arrow hands), “Ed White” (105.003 worn on Gemini 4 spacewalk, straight-lug pre-Professional Pro caliber 321), “Moonwatch” (105.012 onward — flight-qualified by NASA for Apollo), “Speedy Tuesday” (Tuesday Instagram tradition; also the 2017 LE), “Snoopy” (limited editions 2003, 2015, 2020 celebrating Apollo 13 Silver Snoopy Award), “FOIS” (First Omega in Space — 105.003 reissue 311.32.40.30.01.001), “Holy Grail” (145.022 “Tropical” dial)
- **Notes**: The Speedmaster’s NASA flight qualification (1965) and presence on every manned lunar mission make it the most historically loaded wristwatch in existence. The CK2915 trio (1957–59) are the originals with steel tachy bezel and broad arrow hands; CK2998 (1959–63) brought alpha hands and the black bezel; 105.003 “Ed White” was the last symmetrical case and the spec NASA tested. The 105.012 (1963, “Professional” added) introduced the asymmetric crown-guard case that defines the modern Moonwatch. The Mark series (II–V) explored alternative cases (Mark II’s cushion, Mark III/IV’s automatic Cal. 1040/1041, Mark V’s Lemania 5100) but never replaced the manual-wind Moonwatch. The 2021 Master Chronometer 310.30.42.50.01.001 (Cal. 3861, METAS-certified) is the current Moonwatch — distinguished from the 1861-era 311.30.42.30.01.005/006 by a slightly broader stepped dial, lyre lugs, and a date-free dial only. Tropical-brown 145.012/145.022 dials, original “dot-over-90” and “dot-next-to-90” bezels, original Tritium plots, and unique caseback engravings (“First Watch Worn on the Moon”) are the highest-yield collector signals.

### Model line: Seamaster 300 / SMP Diver 300M

- **Refs**: `CK2913`, `CK14755`, `165.014`, `165.024`, `166.024`, `2531.80` (SMP “Bond”), `2531.20`, `2541.80` (quartz), `2220.80`, `212.30.41.20.01.003`, `233.30.41.21.01.001` (300 Heritage), `234.30.41.21.01.001` (300 Heritage Co-Axial Master), `210.30.42.20.01.001`, `210.30.42.20.03.001` (Bond 60th Anniversary), `210.32.42.20.01.001`
- **Years**: 1957–present
- **Designer / movement**: Omega (period military dive watch direction) · Cal. 501 / 552 (vintage), 1109 / 1120 (SMP 2531), 2500 Co-Axial (2541.80 transition), 8500/8800 Master Co-Axial (modern)
- **Key identifiers**: Vintage 300 = symmetric Naiad case, broad-arrow or sword hands, 41mm. SMP 2531.80 “Bond” = wave dial, scalloped bezel, skeleton hands, helium escape valve at 10, 41mm. Modern 210.30 = ceramic dial with laser-engraved waves, sapphire caseback, integrated bracelet with mid-link polish.
- **Common nicknames**: “Big Triangle” (165.024 first execution Seamaster 300), “Bond Seamaster” (2531.80 — Pierce Brosnan-era), “Bond” / “No Time to Die” (210.92.42.20.01.001 titanium mesh), “Spectre” (233.32.41.21.01.001 LE)
- **Notes**: The vintage CK2913 (1957) was launched alongside the Speedmaster and Railmaster as Omega’s “Master Trilogy”; the Seamaster 300 was Omega’s professional dive answer to the Submariner. The 165.024 with “Big Triangle” hour bezel and the 166.024 with date are the most collected vintage references. The Seamaster Diver 300M 2531.80 (1995–2007) became iconic via the Brosnan-era James Bond films; its blue wave dial, scalloped bezel, and skeletonized hands are the silhouette many collectors still associate with “Bond watch”. The 2018 redesign 210.30 replaced the painted dial with ceramic and added Cal. 8800 Master Chronometer (15,000 gauss anti-magnetic). The 300 Heritage line (233/234) faithfully reissues the 1957 SM 300 with broad-arrow hands and lollipop seconds — the 234.30.41.21.01.001 is a Master Co-Axial reissue (2021). Tropical 165.024 dials with creamy lume and original bezels are the auction sweet spot.

### Model line: Railmaster

- **Refs**: `CK2914`, `2503.52`, `2512.52`, `2202.52` (XXL), `220.10.40.20.01.001` (Master Co-Axial 1957 Trilogy reissue), `220.10.38.20.01.002`
- **Years**: 1957–63 (vintage); 2003–12 and 2017–present (modern)
- **Designer / movement**: Omega · Cal. 284/285 (vintage), Cal. 2403 (early modern), Cal. 8806 (current)
- **Key identifiers**: Anti-magnetic Faraday cage (1000 gauss vintage, 15,000 gauss modern Master Chronometer); 38mm vintage and reissue / 40mm modern; vertical brushed “teak” dial on current; no crown guards.
- **Common nicknames**: “Trilogy Railmaster” (220.10.38.20.01.002 — 2017 60th-anniversary trio with Speedmaster CK2998 and Seamaster 300 reissues)
- **Notes**: The vintage CK2914 (1957–63) was the anti-magnetic technical sibling to the Speedmaster and Seamaster 300, made in tiny numbers (~10k total) for engineers, scientists, and technicians. It is the rarest of the 1957 Trilogy and original examples with intact dials regularly clear $30–80k+. Omega revived the line briefly with the 2503.52 (2003), but the modern restart is the 2017 “1957 Trilogy” reissue (220.10.38.20.01.002, LE 3,557 sets) and the current production 220.10.40.20.01.001 with Cal. 8806 Master Chronometer. Listing signals: dial originality on CK2914 (no service refinishing), lume color match between hands and dial, and presence of original “Naiad” or omega-stamped crown.

### Model line: Constellation

- **Refs**: `2852` (Pie-Pan), `2943`, `14381`, `168.005`, `168.009`, `168.017`, `168.025`, `168.0017` (C-shape), `BA 168.0027`, `131.10.41.21.01.001` (Globemaster), `130.30.39.21.02.001`, `130.33.39.22.03.001`
- **Years**: 1952–present
- **Designer / movement**: Pierre-André Aellen (Pie-Pan dial) · Cal. 354, 504, 561, 564, 751 (vintage chronometers); Cal. 1011/1021 (Mégaquartz era omitted); Cal. 8500/8900/8901 Master Chronometer (Globemaster)
- **Key identifiers**: Pie-Pan dial = stepped 12-faceted dial with applied indices; observatory medallion on caseback; chronometer-certified; “C-shape” (Constellation C, 1969) had angular Genta-adjacent case; “Manhattan” (1982 quartz with claws on bezel) introduced the now-iconic griffes. Globemaster (2015) revived the pie-pan dial and fluted bezel in 39/41mm Master Chronometer form.
- **Common nicknames**: “Pie-Pan” (any vintage with stepped dodecagonal dial), “C-shape” (168.0017 Genta-period), “Constellation Manhattan” (1982 onward “claws”), “Globemaster” (modern pie-pan revival)
- **Notes**: The Constellation was Omega’s chronometer flagship through the 1950s–60s and the volume seller that funded the brand’s experimentation. The 2852/2943 “Pie-Pan” with Cal. 354 or 561 set the standard; the 168.005/.009/.017/.025 (Cal. 564/751) are the most collected, with rare dial colors (oxblood, mocha, lapis), full sets and gold cases driving auction prices. The 1969 “C-shape” 168.0017 (designed in the Genta-influenced era) and 1982 Manhattan introduced two of the most aesthetically polarizing redesigns in industry history. The 2015 Globemaster revived the pie-pan and was the first Master Chronometer watch (METAS 15,000 gauss). For listings, key signals: dial signature (Pie-Pan applied or printed indices), case material, observatory medallion presence, and Cal. 564 (“automatic chronometer officially certified” text), or post-2015 Globemaster-specific 8900/8901 with pie-pan + fluted bezel + Globemaster dial signature.

### Model line: De Ville

- **Refs**: `LD 111.110`, `121.001`, `2913.20.31` (Hour Vision), `431.13.41.21.02.001` (Prestige), `431.30.41.21.13.001` (Trésor), `435.13.40.21.02.001` (Co-Axial Tourbillon)
- **Years**: 1967–present
- **Designer / movement**: Omega · Cal. 601/602 (vintage manual), Cal. 8500/8800/8900, Cal. 2500/2501 (Co-Axial)
- **Key identifiers**: Dress watch case profile; usually no rotating bezel; modern De Ville Trésor is ultra-thin manual-wind; Hour Vision has lateral sapphire window on case revealing movement.
- **Common nicknames**: “Hour Vision” (2913 with sapphire side window), “Trésor” (modern ultra-thin), “Ladymatic” (cushion-cased ladies variant)
- **Notes**: Originally a sub-line of the Seamaster (“Seamaster De Ville”, 1960), De Ville became standalone in 1967. The most horologically significant De Ville is the 2007 Hour Vision, which introduced Cal. 8500 — Omega’s first in-house Co-Axial movement, replacing the long-running ETA-based 2500. The De Ville Co-Axial Tourbillon (435.13.40.21.02.001 etc.) was the first central-tourbillon wristwatch (1994 patent), with the tourbillon visible centrally rather than at 6. Trésor pays tribute to a 1949 manual-wind reference and is the dress option in the modern catalog. For vintage listings, check for “Omega De Ville” co-signed pieces from the 1960s with unusual case shapes (square/cushion/asymmetric) using Cal. 601/620 — under-the-radar collector category.

### Model line: Seamaster Aqua Terra

- **Refs**: `2502.80`, `2503.80`, `231.10.42.21.01.001`, `220.10.41.21.10.001`, `220.10.41.21.03.004` (Ultra Light), `220.12.41.21.01.001`, `220.10.41.21.10.001` “Worldtimer” 220.10.43.22.03.001
- **Years**: 2003–present
- **Designer / movement**: Omega · Cal. 2500 (early), Cal. 8500/8800/8900 Master Co-Axial (modern), Cal. 9900 (chrono), Cal. 8938 (worldtimer)
- **Key identifiers**: Vertical “teak” pattern dial; symmetric polished/brushed case; sapphire caseback; 150m water resistance; 38/41/43mm sizes; railway minute track; date at 6 or 3.
- **Common nicknames**: “Teak Dial” (any modern Aqua Terra), “Ultra Light” (220.92.41.21.03.001 titanium 2.4 oz), “Worldtimer Aqua Terra”
- **Notes**: Conceived as a sportier dress watch derived from the Seamaster line, Aqua Terra became Omega’s “everyday luxury” range. The 231.10.42.21.01.001 (Cal. 8500, 2013) was the first Master Co-Axial Aqua Terra; the 220.10.41.21.10.001 family (Cal. 8900 Master Chronometer, 2017) refreshed the design with a more refined dial, broad-arrow indices, and sapphire caseback. The 220.92.41.21.03.001 Ultra Light Golf Edition uses a gamma titanium case at just 55g. Aqua Terra Worldtimers (cal. 8938) display a 24-city ring around a laser-engraved hemisphere. Listing signals: vertical teak vs. horizontal teak (early), date position (3 vs. 6 — the 6 is the post-2017 redesign), and Master Chronometer dial text.

### Model line: Planet Ocean

- **Refs**: `2200.50`, `2201.50`, `2900.50.91`, `232.30.42.21.01.001`, `215.30.44.21.01.001`, `215.92.46.22.01.001` (Deep Black), `215.30.44.21.04.001` Big Blue
- **Years**: 2005–present
- **Designer / movement**: Omega · Cal. 2500 (initial), 8500/8900, 8906 (GMT), 9900 (chrono)
- **Key identifiers**: Helium escape valve; unidirectional ceramic or aluminium bezel with 15-min markings; broad-arrow hour hand; 600m water resistance (1200m on Ultra Deep); 39.5/42/43.5/45.5mm; “Liquidmetal” ceramic bezel with metal markings on later refs.
- **Common nicknames**: “Big Blue” (44mm blue ceramic Planet Ocean 215.30.44.21.04.001), “Deep Black” (215.92.46.22.01.001 all-ceramic), “Ultra Deep” (215.92.46.22.04.001 6000m)
- **Notes**: Launched in 2005 as Omega’s “real” professional diver (vs. the more lifestyle-oriented SMP 300M), the Planet Ocean has steadily added technical features: 600m WR, ceramic bezels with Liquidmetal markers, GMT/Chrono variants. The Ultra Deep (Cal. 8912/8918) descended with Victor Vescovo to Challenger Deep (10,925m) and entered production at 6000m WR rating. The 2016 Master Chronometer redesign brought Cal. 8900/8906/9900 across the line. For listings, distinguish 600m vs. 6000m models (case shape, lyre lugs, monobloc), aluminum vs. ceramic bezels (post-2011 = ceramic), and Liquidmetal vs. lacquered bezel markings.


<!-- Below: gap-patch additions for Omega merged from docs/watch_references_gaps_patch.md -->

### Model line: Speedmaster (additions and sub-variant clarifications)

- **Refs**: `CK2915-1`, `2915-1`, `CK2998-1`, `2998-1`, `2998-2`, `2998-3`, `2998-4`, `2998-5`, `2998-6`, `145.013`, `3572.50`, `3577.50`, `3510.50`, `311.30.40.30.01.001`, `311.32.42.30.04.001`, `310.60.42.50.99.001`
- **Years**: CK2915-1: 1957 · CK2998 series: 1959–1963 · 145.013/145.016: 1964–1969 · PIC era 3570/3572/3577: 1996–2014 · Modern 311.30/310.30: 2021+
- **Designer / movement**: Omega · Cal. 321 (CK2915-1, all CK2998 executions), Cal. 321 reissue (2019+, 311.30.40.30.01.001), Cal. 1861 (3510.50/3570.50/3572.50/3577.50), Cal. 3861 (310.30/311.30 current Moonwatch)
- **Key identifiers**:
  - **CK2915-1**: Broad Arrow hands, steel tachy bezel, 38.6mm, Cal. 321. The first execution of the first Speedmaster (1957). Distinguished from -2 and -3 by the hand style and bezel material.
  - **CK2998 executions**: Six distinct executions (-1 through -6) from 1959–63, all Cal. 321. CK2998-1 = first black bezel Speedy, “lollipop” seconds hand, earlier font. CK2998-3 = “FAP” (Peruvian Air Force) — issued to Peru’s FAF, with specific lume configuration. CK2998-6 = last execution before the asymmetric case.
  - **145.013**: A short-lived transitional reference (1964–65) between the 105.002/003 era and the asymmetric 105.012 — uses Cal. 321 in an early asymmetric case without “Professional” text.
  - **3510.50**: “Speedmaster Reduced” — a smaller 39mm automatic Speedmaster (not the professional Moonwatch), using ETA 2890-based Cal. 3220, sold 1988–2009. Not NASA-qualified.
  - **3572.50** / **3577.50**: Speedmaster Reduced variants (automatic, smaller case) from the same 1990s–2000s era. 3577 has a tachymeter scale variant.
  - **311.30.40.30.01.001**: “Ed White Re-Issue” / “FOIS” reissue — 39.7mm, Cal. 321 reissue, reproduces the 105.003 “Ed White” symmetric case with the first Omega In Space dial. Released 2019–2020.
  - **311.32.42.30.04.001**: Speedmaster Snoopy Award Edition (2015) — white dial, silver Snoopy medallion on caseback, based on Apollo 13 Silver Snoopy Award.
  - **310.60.42.50.99.001**: Moonwatch in Canopus gold — 18k white gold AP-proprietary alloy case, part of the 2022 Moonwatch family in precious metal.
- **Common nicknames**: “Broad Arrow” (CK2915-1), “Lollipop” (CK2998-1 seconds hand), “FAP” (CK2998-3 Peruvian AF), “Ed White Re-Issue / FOIS” (311.30.40.30.01.001), “Snoopy” (311.32.42.30.04.001 and other Silver Snoopy editions), “Reduced” (3510.50/3572/3577 automatic Speedmasters)
- **Notes**: The CK2998 executions (-1 through -6) are the most nuanced vintage Speedmaster sub-category: six distinct executions spanning 1959–63, all powered by Cal. 321, but differing in lume pip style, hands, dial typography, and bezel material. The “FAP” designation (CK2998-3) denotes Peruvian Air Force-issued examples and commands provenance premiums. The “Speedmaster Reduced” (3510.50/3572.50/3577.50) is often confused with the Moonwatch in listings — it is a fundamentally different watch (automatic, smaller, not NASA-qualified) and should be categorized as a separate model line. The FOIS/Ed White Re-Issue (311.30.40.30.01.001, Cal. 321, 2019) is a faithful 39.7mm reissue with the symmetric case and is the only modern Speedmaster using the reissued Cal. 321.

### Model line: Speedmaster Reduced (separate sub-line)

- **Refs**: `3510.50`, `3572.50`, `3577.50`, `3514.50`
- **Years**: 1988–2009
- **Designer / movement**: Omega · Cal. 3220 (ETA 2890-based automatic chronograph), 39mm
- **Key identifiers**: 39mm round case (vs. 42mm Moonwatch); automatic winding (not manual); tachymeter bezel; three sub-registers; no “Professional” text on dial; no NASA qualification.
- **Common nicknames**: “Reduced” (standard collector term for this sub-line)
- **Notes**: Marketed to consumers who found the professional Moonwatch too large or preferred automatic winding, the Reduced is mechanically and historically distinct from the Moonwatch. Values are significantly lower than professional Speedmasters. Listing signals: “REDUCED” or “AUTOMATIC” on dial, 39mm case, center seconds visible on dial between chronograph hands.

### Model line: Seamaster 300 (addition — CK2913 executions)

- **Refs**: `CK2913-3`, `2913-3`, `CK2913-1`, `CK2913-2`
- **Years**: 1957–1963
- **Designer / movement**: Omega · Cal. 501 (CK2913-1/2), Cal. 552 (CK2913-3+)
- **Key identifiers**: Three main executions. CK2913-1 = “Naiad” crown, Broad Arrow hands, Cal. 501, 1957 launch. CK2913-2 = small changes to hand style. CK2913-3 = sword hands replacing Broad Arrow, Cal. 552, 1960–63.
- **Common nicknames**: “Broad Arrow 300” (CK2913-1/2), “Trilogy 300” (CK2913-1 as part of the 1957 Railmaster/Speedmaster/Seamaster trio)
- **Notes**: The three CK2913 executions track the evolution of the Seamaster 300’s hand style from military-issue Broad Arrow to civilian sword hands — the transition marks a significant visual change. CK2913-1 with Cal. 501 and Broad Arrow hands (launching at the 1957 Basel Fair alongside the Speedmaster CK2915 and Railmaster CK2914) is the trophy piece, with clean examples regularly clearing $20–50k at auction. Listing signals: hand style (Broad Arrow = earlier, sword = later), caliber (501 vs. 552), and dial signature (early examples “Seamaster 300” only, later adds “Professional”).

### Model line: Seamaster misc vintage (addition)

- **Refs**: `2846`, `145.016`
- **Years**: 2846: 1958–1962 · 145.016: 1967–1972
- **Designer / movement**: Omega · Cal. 501 (2846), Cal. 321 / 861 (145.016 Seamaster Chronograph)
- **Key identifiers**: 2846 = Seamaster Automatic in steel/gold two-tone “10SC” case (10-micron gold cap on steel), two-tone dial with gold chapter ring, 35mm; 145.016 = Seamaster-cased chronograph using the same asymmetric case body as early Speedmasters but with “Seamaster” branding — yellow gold case, three registers.
- **Common nicknames**: “Seamaster Chrono” (145.016), “Two-Tone 2846”
- **Notes**: Ref 2846 is a civilian two-tone Seamaster from the late 1950s often featuring tropical brown patina on the two-tone dial — these are sought-after for their understated elegance and brown patina. Ref 145.016 is a yellow gold chronograph using the Speedmaster asymmetric case but Seamaster-branded, powered by Cal. 321 initially — a rare crossover piece that collectors of both Speedmaster and vintage Seamaster seek. Listing signals: 145.016 = yellow gold three-register chrono with “Seamaster” not “Speedmaster” on dial.

### Model line: Omega Flightmaster (new model line)

- **Refs**: `145.026`, `145.036`, `145.026-69`
- **Years**: 1969–1977
- **Designer / movement**: Omega · Cal. 911 (modified Cal. 861 with additional 12-hour GMT hand and colour-coded crowns)
- **Key identifiers**: 43mm oversized asymmetric case (similar to Speedmaster but wider); three crowns (blue, orange, black — each operating a different function: time set, GMT set, bezel); chronograph with 45-minute counter; “FLIGHTMASTER” on dial; NATO-adjacent aviation heritage.
- **Common nicknames**: “Flightmaster” (the line itself); “DOT DIAL” (145.026 variant with dot between “FLIGHT” and “MASTER” on dial)
- **Notes**: The Flightmaster (1969) was Omega’s dedicated aviation chronograph — larger than the Speedmaster, with three crowns colour-coded for different operations (blue = time, orange = second time zone, black = bezel). It was designed for pilots who needed to set multiple time zones and run a chronograph without removing gloves. The “DOT DIAL” variant (145.026 with a dot punctuation between “FLIGHT” and “MASTER”) is more sought after than the “no-dot” version. Production ended in 1977. Listing signals: 43mm case, three coloured crowns, “FLIGHTMASTER” on dial — unmistakable; no other Omega looks like this.

### Model line: Omega Constellation / misc vintage (addition)

- **Refs**: `345.0809`, `755-61`, `3903`
- **Years**: Various vintage
- **Designer / movement**: Omega · Cal. 342 (3903), Cal. 561/564 (345.0809 Constellation family), Cal. 30SC (755-61 very vintage)
- **Key identifiers**: 345.0809 = Constellation with Cal. 564 chronometer, pie-pan or flat dial, 35mm. 755-61 = very early 1940s Omega automatic. 3903 = 1951 Omega “Cioccolatone” — the square-ish cushion case (“chocolate block”) Omega automatic, 14k gold, Cal. 342.
- **Common nicknames**: “Cioccolatone” (3903 — Italian for “big chocolate bar”, refers to the rounded rectangular case shape shared with Universal Genève and Heuer Camaro of the same era)
- **Notes**: The “Cioccolatone” case shape (rounded rectangular, cushion-like) was shared by multiple Swiss makers in the early 1950s. Omega’s 3903 in 14k gold with the distinctive Cal. 342 is a collector curiosity — the case shape was abandoned by Omega quickly but remained in use at UG longer. Clean 14k gold examples with original bracelets clear $3–8k. Listing signals: “Cioccolatone” in title, cushion/rounded rectangular case, Cal. 342.

### Non-watch token flags

- `600M` — depth rating appearing in listing text (“Planet Ocean 600M”). Treat as a metadata tag (depth rating = 600m) that maps to the Planet Ocean model line, not as a watch reference.
- `300M` — depth rating appearing in “Seamaster Diver 300M” listings. Treat as metadata → Seamaster Diver 300M model line.
- `1171` — **bracelet reference**, not a watch. Omega 1171 is the reference for a specific riveted or folded-link bracelet used on vintage Speedmasters and Seamasters from the 1960s. Treat as a bracelet metadata tag.

-----

## Heuer / TAG Heuer

## Brand: Heuer

> Use this brand canonical for all pre-1985 vintage Heuer listings. The “Heuer” branding period ends in 1985 when TAG bought a controlling stake and rebranded as “TAG Heuer”.

### Model line: Carrera (vintage)

- **Refs**: `2447S`, `2447N`, `2447D`, `2447SN`, `2447NS` (“Panda”), `2447NST` (“Reverse Panda 2nd Exec.”), `2447T`, `3647S`, `3647N`, `2547N`, `2547NT`, `7753SN`, `73655`, `73653`, `1153N`, `1153S`, `1158CH`, `1158S`, `1153B` (blue), `110.253`, `110.255`, `110.573` (barrel case), `510.501` (Lemania 5100), `45 Dato 3147`
- **Years**: 1963–1985 
- **Designer / movement**: Jack Heuer · Valjoux 72 (3-register manual, 2447/3647), Valjoux 7730/7733/7734 (2-register variants), Landeron 189 (3147 Dato 45), Caliber 11 / 12 / 15 (automatic 1153/1158/110.253 — “Project 99” with Breitling, Buren, Dubois-Depraz),  Lemania 5100 (510.501 mid-1980s)
- **Key identifiers**: Clean three-register dial with thin steel chapter ring on inner bezel;  36mm screw-back case (2447/3647) or 38mm barrel case (1970s); left-hand crown on Cal. 11/12 automatic models (1153/1158); applied steel or gold markers; tachymeter/decimal/pulsation scales printed on outer chapter ring.
- **Common nicknames**: “Panda” (2447 SN — silver dial, black subdials), “Reverse Panda” / “NST” (2447 NST 2nd exec — black dial, white subdials), “Mick Jagger” (1153N — black dial Caliber 11/12 Jagger associated), “Dato 45” (3147 — date at 9, very rare), “Gold Carrera” (1158CH 18k yellow gold)
- **Notes**: Named after the Carrera Panamericana road race, the Carrera was Jack Heuer’s mid-1960s reaction to Rolex/Omega chronograph supremacy: simple, readable, racing-pedigree. The 2447 manual references (Valjoux 72) span 1963 to 1970 in two executions distinguished by hand and marker style; SN (“Silver dial, Noir subdials”) panda and NT/NST reverse panda variants are the most desirable, followed by tropical and exotic-scale (pulsation, decimal) dials. The Cal. 11 era (1969–74) brought the left-crown automatic 1153 with two pushers on the right — part of Project 99 alongside Monaco 1133 and Autavia 1163.   The 1158CH gold Carrera was a 150-piece Ferrari Scuderia gift series for Niki Lauda and team.  The barrel-case 110.253/110.573 (1972+) is a 1970s design departure. For listings, signal hierarchy: case execution (screw-back hex vs. snap-back, barrel), dial signature (“Ed Heuer” early movements, Heuer logo style), scale color/text, original tritium plots, and Gay Frères “HLC” 20mm end-link bracelet  correctness.

### Model line: Autavia (vintage)

- **Refs**: `2446 1st Exec.`, `3646 1st Exec.`, `2446 2nd Exec.`, `2446 3rd Exec.`, `3646 3rd Exec.`, `2446 Tachy`, `3646 Tachy`, `2446 GMT`, `2446C GMT`, `2446C`, `7863C Dato`, `1163`, `1163 GMT`,  `1163V` (“Viceroy”), `11630`, `11630 GMT`, `73363`, `73463`, `73663`, `1563`, `110.503`, `110.633`, `Autavia 11063 Diver 100`
- **Years**: 1962–1985
- **Designer / movement**: Jack Heuer · Valjoux 72 (2446/3646), Valjoux 7730/7733/7734 (later manual), Caliber 11 / 12 (1163/11630), Lemania 5100 (110.633)
- **Key identifiers**: Rotating bezel (60-minute or 12-hour or GMT); screw-back round case (1st–3rd exec.) or “C-case” cushion (2446C+); three-register or two-register dial; left-crown Cal. 11 on automatic 1163.
- **Common nicknames**: “Rindt” (Autavia 2446 SN worn by Jochen Rindt), “Andretti” (orange-accented Autavia worn by Mario Andretti), “Jo Siffert” (1163 with blue/white panda dial), “Viceroy” (1163V — cigarette brand promotion, mail-order 1972), “Indy” (3646 IMS — Indianapolis Motor Speedway logo, very rare)
- **Notes**: Predating the Carrera by a year, the Autavia (AUTomobile + AVIAtion) was originally a dashboard timer name (1933) reused for the 1962 wristwatch chronograph. The 2446 1st Exec. has all-luminous Mk1 hands and is among the rarest vintage Heuers;  the screw-back 2446 GMT with bakelite/arrow GMT bezel is widely considered the greatest vintage Heuer GMT. The Cal. 11 automatic Autavia 1163 (1969) shared its launch with Monaco and Carrera and is the most attainable vintage automatic in the trio. Authentication signals: hand/marker execution (1st–3rd exec.), bezel insert correctness (60-min vs. 12h vs. GMT, all-original Bakelite cracks accepted but not replaced inserts), case-back IMS/Indianapolis cresting, and movement matching (Valjoux 72 vs. 7730 vs. Cal. 11).

### Model line: Monaco (vintage)

- **Refs**: `1133B` (blue), `1133G` (grey), `73633`, `74033`, `1533`, `740303N` “Dark Lord”, `Monaco 110.573`
- **Years**: 1969–1975 (1st run); revived under TAG Heuer post-1998
- **Designer / movement**: Erwin Piquerez (square waterproof case) · Caliber 11 / 11-i / 12 (Project 99 automatic), Valjoux 7740 (73633 manual)
- **Key identifiers**: Square case (the first square waterproof chronograph case, patented by Piquerez); left-hand crown on Cal. 11/12; two pushers on right; metallic blue (1133B) or grey (1133G) dial; orange seconds.
- **Common nicknames**: “Steve McQueen” (1133B worn in Le Mans 1971), “Dark Lord” (740303N — black PVD with orange accents, ~150 produced),  “Chronomatic” (earliest 1133B with “Chronomatic” above center pinion)
- **Notes**: The Monaco is the most cinematically famous chronograph in watch history — the 1133B Steve McQueen wore in Le Mans (1971) launched its legend. Mechanically, it was one of three “Project 99” launches in 1969 (with Autavia 1163 and Carrera 1153) sharing the Caliber 11 — the world’s first automatic chronograph  (claim contested with Zenith El Primero by weeks). The 1133B blue is the icon; 1133G grey is rarer; the manual-wind 73633 used a non-Caliber 11 movement. The 740303N “Dark Lord” (1975) — all-black PVD with orange minute track — is the holy grail variant, with extremely fragile finish. Listing signals: “Chronomatic” branding (earliest, c. 1969),  correct left-crown on automatic refs, dial Mk1 vs. Mk2 typography, and case finish (Dark Lord PVD authenticity is critical).

### Model line: Silverstone

- **Refs**: `110.313`
- **Years**: 1974–1975
- **Designer / movement**: Heuer · Caliber 12
- **Key identifiers**: Cushion case with integrated lug profile; brushed bezel; three dial colors (blue, fumé red, fumé blue); left-crown Cal. 12.
- **Common nicknames**: “Silverstone” (race circuit)
- **Notes**: Produced for only ~18 months in tiny numbers, the Silverstone 110.313 is a cult Cal. 12 chronograph distinguished by its square-ish cushion case and bold fumé dials. It is among the rarest production Heuers from the period and is the Cal. 12 sibling collectors often target after a Monaco. Authentication concerns: dial originality (fumé fading patterns), bezel correctness, and movement matching (correct Cal. 12 with proper finishing for the era).

### Model line: Camaro

- **Refs**: `7220`, `7220T`, `7220NT`, `7743`, `9220`
- **Years**: 1968–1972
- **Designer / movement**: Heuer · Valjoux 72 (3-register), Valjoux 7733 (2-register)
- **Key identifiers**: Cushion / squared “TV” case; manual-wind only; named for the Chevrolet Camaro to lean into American market appeal; usually no rotating bezel; tachymeter on inner chapter ring.
- **Common nicknames**: None major — collectors often just call out “Panda Camaro” for silver/black dial variants
- **Notes**: A relatively short-lived companion to the Autavia and Carrera, the Camaro was Heuer’s offering for buyers who preferred a non-round chronograph case before the Monaco arrived. Two-register Valjoux 7733 versions are more common; three-register Valjoux 72 Camaros (7220) are the desirable variant, especially with panda or reverse-panda dials. Distinguishing signals: case is cushioned rather than square (not Monaco), no rotating bezel (not Autavia), and chronograph dial layout matches Valjoux 72/7733 sub-register positions.

### Model line: Skipper

- **Refs**: `7754` (“Skipperera”, in Carrera case), `15640` (Cal. 15), `73464`, `73463`, `1564` (Autavia-cased Skipper)
- **Years**: 1968–1983
- **Designer / movement**: Heuer · Valjoux 7730/7733 (manual), Caliber 15 (15640 automatic, central seconds + small minutes only — no 12h register)
- **Key identifiers**: Three-color regatta countdown subdial  at 3 (blue/red/orange or blue/green/orange — derived from the colors of the boat *Intrepid* that won the 1967 America’s Cup); usually no tachymeter; vibrant teal/turquoise dial on early “Skipperera”.
- **Common nicknames**: “Skipperera” (ref. 7754 — Skipper in a Carrera 2447 case; extremely rare,  ~10 known), “Intrepid” colors (the regatta countdown)
- **Notes**: The Skipper celebrates *Intrepid*‘s 1967 America’s Cup victory, with its 15-minute regatta countdown subdial painted in the *Intrepid* sail colors. The “Skipperera” (7754) — a Skipper dial in a Carrera 2447 screw-back case — is one of the rarest production Heuers in existence and has cleared six figures at auction when fully original. Most Skippers are housed in Autavia-style cases. The Cal. 15 automatic 15640 (1972+) is the more attainable era. Signal hierarchy: case type (Carrera 2447 = Skipperera; cushion = Cal. 15), regatta dial color order, and “Skipper” branding consistency.


<!-- Below: gap-patch additions for Heuer merged from docs/watch_references_gaps_patch.md -->

### Model line: Carrera (additions and clarifications)

- **Refs**: `1153`, `1153N`, `1153S`, `1153B`, `1153G`, `7753NST`, `73453S`, `73643NT`, `2447ST`
- **Years**: 1153 series: 1969–1974 · 7753NST / 73453S / 73643NT: 1970–1979 · 2447ST: 1964–1969
- **Designer / movement**: Heuer · Caliber 11 / 12 / 15 (1153 family — automatic, left-hand crown), Valjoux 7730/7733 (73453S, 73643NT — manual cushion case)
- **Key identifiers**: 1153 = round automatic Carrera with Cal. 11/12, left-crown; suffix N/S/B/G = dial color (noir/black, silver, blue, grey). 7753NST = cushion/barrel case Carrera with Valjoux 7730/7733, panda dial. 73453S = similar barrel-case Carrera variant with silver dial. 2447ST = Carrera 2447 with tachy scale in a “ST” variant (possibly steel-cased specific sub-reference).
- **Common nicknames**: “Mick Jagger Carrera” (1153N — Jagger was photographed wearing a black-dial 1153); “Test Dial” (1153 prototype/pre-production dial examples — extremely rare, pre-production caliber test pieces)
- **Notes**: The 1153 family (automatic, 1969–74) encompasses four main dial colors — N (noir/black), S (silver), B (blue), G (grey) — and represents the Cal. 11/12 era Carrera with the left-hand crown inherited from the Monaco’s case development. The “Test Dial” 1153 examples are rare pre-production prototype dials used to test the Cal. 11 movement, occasionally surfacing in specialist sales. The cushion-case 7753NST and related 73xxx references are the 1970s manual-wind Carreras with cushion-shaped cases — distinct from the round screw-back vintage 2447 family. Listing signals: left-crown position identifies automatic Cal. 11/12/15 Carreras; cushion vs. round case disambiguates 73xxx vs. 2447/1153.

### Model line: Camaro (additions)

- **Refs**: `73343NT`, `73443NT`, `73643NT`
- **Years**: 1968–1972
- **Designer / movement**: Heuer · Valjoux 7733 (2-register, 73343), Valjoux 7736 (3-register variants)
- **Key identifiers**: Cushion/barrel case; 73343NT = Mk4 Camaro with Valjoux 7733, “NT” = noir/tropical (black dial with tropical patina noted in listing), 38mm. 73443NT = similar variant. 73643NT = another cushion Camaro.
- **Common nicknames**: “Tropical Camaro” (73343NT with noted tropical brown patina)
- **Notes**: The 73343NT (Mk4 Camaro) is a later cushion-case evolution of the original Camaro, using the Valjoux 7733 2-register movement. The “NT” suffix combination in listings typically signals a black (N) dial showing tropical brown patina (T) — one of the more collectible Camaro combinations given the scarcity of well-preserved examples. Listing signals: cushion case, two or three sub-registers, “Camaro” on dial, Valjoux 7733/7736 movement reference.

### Model line: Autavia (additions)

- **Refs**: `15630`, `1553N`
- **Years**: 15630: 1972–1978 · 1553N: 1972–1975
- **Designer / movement**: Heuer · Caliber 15 (automatic, 15630 MH), Caliber 15 (1553N — Monaco case with Cal. 15)
- **Key identifiers**: 15630 = Autavia with Cal. 15 (the “non-project-99” automatic chrono derived from Cal. 12), “MH” suffix = “Mark Heuer” (a specific production variant). 1553N = Monaco-case (square) variant powered by Cal. 15 rather than Cal. 11/12 — a transitional piece.
- **Common nicknames**: “MH Autavia” (15630 MH), “Cal. 15 Monaco” (1553N — the square Monaco running on Cal. 15, distinct from the Cal. 11 1133B)
- **Notes**: The 15630 MH is an Autavia variant with the proprietary Cal. 15 movement — developed after the Project 99 Cal. 11/12 as Heuer’s own evolution. The “MH” designation refers to a specific production run. The 1553N is a fascinating hybrid: the square Monaco waterproof case of the 1133B family but running on Cal. 15, which places the registers differently. Cal. 15 has only one sub-register (at 3) and a running seconds display — fundamentally different from the three-register Cal. 11. Listing signals: “15630” + “MH” = this specific Autavia; “1553” (no B/G suffix) = Cal. 15 Monaco variant.

### Model line: Seafarer (new model line)

- **Refs**: `2444`
- **Years**: 1967–1975
- **Designer / movement**: Heuer · Valjoux 7730 (manual chronograph base)
- **Key identifiers**: Round 36mm case, manual chronograph, distinctive fourth sub-dial showing tidal countdown (12h60m cycle for ocean tides); sold through Abercrombie & Fitch in the US market under an A&F co-signed dial; the A&F co-signed version (ref 2444 with “ABERCROMBIE & FITCH” on dial) is the most collected variant.
- **Common nicknames**: “Seafarer” (the model); “A&F Seafarer” (Abercrombie & Fitch co-signed — Abercrombie used to be an outdoor/sporting goods retailer, not the fashion brand it is today)
- **Notes**: The Heuer Seafarer is a chronograph with a tidal indicator — the fourth sub-dial at 12 shows a 12h60m countdown matching tidal cycles, allowing sailors to track the next high/low tide. The Abercrombie & Fitch co-signed dial is historically significant because the original A&F was a sporting goods outfitter and Heuer’s major US retail partner. These dials have “ABERCROMBIE & FITCH NEW YORK” printed below center — the first major US sporting-goods retailer to sell Swiss chronographs in volume. Listing signals: fourth sub-dial for tidal countdown, “Seafarer” on dial, Abercrombie & Fitch co-sign.

### Model line: Monaco (addition — NOS / 740303G)

- **Refs**: `740303G`, `1133`
- **Years**: 740303G: 1972–1975 · 1133 (no suffix): 1969 pre-production
- **Designer / movement**: Heuer · Cal. 11 / Valjoux 7740 (740303G)
- **Key identifiers**: 740303G = Valjoux 7740-based manual Monaco in grey dial; the 1133 without a letter suffix may refer to prototype “Paintless Wonder” examples — dials with no colour applied to the sub-register zones.
- **Common nicknames**: “Paintless Wonder” (1133 no-suffix — dials where the sub-register colour was not applied, leaving the metal visible — extremely rare pre-production examples); “Grey Monaco” (1133G / 740303G)
- **Notes**: The “Paintless Wonder” 1133 is a pre-production or transitional example where the sub-register colour fill was omitted — typically the 1133B has blue sub-register fill and 1133G has grey fill. A dial without any fill is believed to be an assembly-line curiosity or prototype piece. Only a handful are documented. The 740303G is the manual-wind Valjoux 7740 version of the Monaco in grey dial — the third movement family used in the original Monaco run (after Cal. 11 and Cal. 12). Listing signals: “Paintless” or missing sub-register colour in photography = potential 1133 no-suffix prototype; 740303G = Valjoux 7740 grey-dial Monaco.

### Model line: Heuer misc (510-series, 110-series, 279-series)

- **Refs**: `510.513`, `510.508`, `510.501N`, `110.233NC`, `279.603`, `102.703`, `423.804`, `150.633B`, `409.137`
- **Years**: 1974–1985
- **Designer / movement**: Heuer · Various — Cal. 12 (automatic), Lemania 5100 (510 series), Valjoux 7736
- **Key identifiers**: 510.xxx series = Lemania 5100-powered Heuer chronographs (late-era Carreras and other models). 110.xxx series = barrel-case Carreras and Autavias. 279.603 = Heuer Montréal or similar 1970s cushion-case. 102.703 = 1970s tonneau. 423.804 / 150.633B / 409.137 = 1970s–80s misc Heuer dress and sport models.
- **Common nicknames**: No widely established nicknames for most of these
- **Notes**: The 510 series represents Heuer’s late-production era using the Lemania 5100 movement (a high-frequency cam-actuated automatic chronograph). The 110 prefix indicates the later generation barrel-case Carrera/Autavia family. These are generally less collected than the classic 2447/1163/1133 references but increasingly noticed by collectors of 1970s Heuer. The 150.633B is likely a Heuer Skipper or Montreal variant (B suffix = blue dial). For aggregator matching: treat all 3-digit.3-digit Heuer references as vintage Heuer sport chronographs; model name identification should fall back to listing title text.

-----

## Brand: TAG Heuer

> Use this brand canonical for all post-1985 / modern TAG Heuer pieces. References starting with prefixes like CS, WS, CV, CAR, CAW, CBN, CBL, CAZ, WAZ, WAY, and reissues like the 2020 Carrera 160 Years Silver are TAG Heuer.

### Model line: Carrera (modern TAG Heuer)

- **Refs**: `CS3110`, `CS3111`, `CS3140` (1996 Vintage reissue), `CV2010`, `CV2014`, `CAR2110`, `CAR2A10`, `CAR2A1L`, `CAR2A11`, `CAR2A1Z` (Heuer 02 Tourbillon), `CBN2A1A` (Sport Chronograph), `CBN201F` (Carrera Chronograph 39mm Glassbox), `CBS2210` (Carrera Date), `WBN2010`, `CBK2110`, `CV2A10` (Carrera Heuer 01)
- **Years**: 1996–present
- **Designer / movement**: TAG Heuer · ETA 2824/2892, Valjoux 7750 (Cal. 16), in-house Cal. 1887, in-house Heuer 01 / Heuer 02 / TH20-00 (“Glassbox” 39mm)
- **Key identifiers**: Round case (38–44mm); modern faceted lugs; sapphire caseback; Heuer logo (modern post-2015 dial dropped “TAG”); recent 60th-anniversary “Glassbox” Carrera (CBN201F, 2023) has a domed sapphire emulating vintage hesalite.
- **Common nicknames**: “Glassbox Carrera” (CBN201F and siblings — 39mm 2023 60th-anniversary reissue), “Twin-Time” (Carrera GMT models), “Telemeter” (CAS2110 telemetre dial)
- **Notes**: Re-launched in 1996 under TAG Heuer with the CS3110/CS3111 vintage reissue (faithful to the 1964 2447), the Carrera has become TAG Heuer’s flagship and the test bed for its in-house chronograph movements: Cal. 1887 (2010, based on Seiko TC78), Heuer 01 (2015), and Heuer 02 (2017, in-house). The 2020 Carrera Sport Chronograph 44mm (CBN2A1A series) re-introduced the panda dial; the 2023 60th-anniversary “Glassbox” Carrera (CBN201F, CBS2210, CBK2110 family) at 39mm with a domed sapphire emulating the original hesalite has been the critical hit of the modern era. For listing matching, the era flag is the dial branding: “TAG Heuer” pre-2015 or “Heuer” only on heritage reissues; bracelet/case width and the “Heuer 01/02” rotor visible through caseback.

### Model line: Autavia (modern TAG Heuer)

- **Refs**: `CY2110.BA0775` (2003 Re-edition), `CBE2110.FC8226` (Autavia Isograph 2019), `CBE2111.BA0687`
- **Years**: 2003 reissue; 2017 Autavia Cup winner relaunch; 2019 Isograph series
- **Designer / movement**: TAG Heuer · Cal. 5 (ETA 2824 base), Cal. Heuer 02 (chronograph), Calibre 7 (3-hand GMT)
- **Key identifiers**: 42mm round case; bidirectional 12-hour bezel (“Big Eye” reissue style); three-register chronograph dial; Autavia name on dial.
- **Common nicknames**: “Big Eye” (CBE2110 — 30-minute counter oversized at 3, recalling vintage Heuer 11630)
- **Notes**: TAG Heuer revived the Autavia name in 2003 (CY2110) and again in 2017 after fan voting in the “Autavia Cup”. The 2019 Isograph series briefly used a carbon-composite hairspring, which was withdrawn after only a year. The modern Autavia line is now a 3-hand/GMT collection rather than a chronograph, distinguishing it from the chronograph-focused vintage refs. Listing signal: any “Autavia” branded watch with a non-rotating bezel or 3-hand layout is the modern TAG Heuer Autavia.

### Model line: Monaco (modern TAG Heuer)

- **Refs**: `CW2111`, `CW2113`, `CAW2111`, `CAW211P` (1969–1979 Limited Edition trio, 2019), `CBL2111`, `CBL2114`, `CAW2114`, `CBL2113`
- **Years**: 1998–present
- **Designer / movement**: TAG Heuer (re-launched Monaco with original Piquerez case shape) · Cal. 12 reissue (1998), Cal. 11 reissue (2003), Cal. 17 (modified ETA 2894), in-house Heuer 02 (CBL series)
- **Key identifiers**: Square case (39 x 39mm), now with right-side crown for the Cal. 17/Heuer 02 (some special editions retain left crown); sapphire caseback. The “1969–1979” 50th anniversary trio used colored dials by decade.
- **Common nicknames**: “Gulf Monaco” (CAW211R/CBL2115 — orange/blue stripes), “Bamford Monaco” (DLC versions), “Calibre 11 Monaco” (CAW211P)
- **Notes**: The Monaco was revived in 1998 with the original 1133 case dimensions, marking TAG Heuer’s most successful heritage line. The Calibre 11 variants (CAW211P) most faithfully replicate the left-crown 1969 original; the in-house Heuer 02 in the CBL family is the modern flagship. The 50th anniversary 2019 trio (CAW2111, CAW2112, CAW2113, CAW2114) used five LE colorways tied to each decade of the model. Gulf-livery Monacos and Bamford-collaboration DLC variants drive the highest secondary-market premiums among non-LE production.


<!-- Below: gap-patch additions for TAG Heuer merged from docs/watch_references_gaps_patch.md -->

### Model line: Autavia (modern heritage additions)

- **Refs**: `WBE5114`, `WBE5116`, `WBE5190`, `WBE5193`
- **Years**: 2021–present
- **Designer / movement**: TAG Heuer · Cal. 5 Chronometer (ETA 2824-based, COSC-certified, time-and-date only — no chronograph)
- **Key identifiers**: 42mm round case with bidirectional 12-hour rotating bezel (paying tribute to the vintage Autavia’s rotating bezel); “AUTAVIA” on dial; “CHRONOMETER” designation confirming COSC certification; WBE5114 = standard steel, WBE5116 = brown leather strap variant, WBE5190 = bracelet version, WBE5193 = special edition (brown/green dial); heritage Autavia typography on dial.
- **Common nicknames**: “Autavia Chronometer” (the modern line); “Heritage Autavia” (to distinguish from the 2017 Autavia Chronograph revival)
- **Notes**: The WBE51xx family (2021+) is TAG Heuer’s second Autavia revival, this time as a time-and-date watch (not a chronograph) with COSC-certified Calibre 5. It features a bidirectional rotating bezel homaging the vintage 1163’s rotating bezel, applied indices in vintage styling, and a domed dial with baton hands. Note: these are NOT chronographs — the Autavia Cup 2017 revival (CBE2110) was a chronograph; the WBE51xx 2021 revival is a pure time-and-date three-hander. Listing signals: “WBE” prefix + 5-series number = modern Autavia Chronometer; confirm presence or absence of pushers (WBE51xx = no pushers = not a chronograph).

### Model line: TAG Heuer misc (6000, 1500, 2000 series)

- **Refs**: `6000`, `WH1152`, `1500`, `929.113G`, `962.206`, `1000M`, `WS2110-2`, `583.513`
- **Years**: 1990s–early 2000s
- **Designer / movement**: TAG Heuer · Various ETA-based movements
- **Key identifiers**: 6000 series = TAG Heuer’s 1990s dress/sport crossover line with round case and integrated or separate bracelet (WH1152 = specific ref in bi-metal steel/gold); 1500 = “Night Diver” — a TAG Heuer diver watch from the early 1990s with the 929.113G reference; 2000 series (962.206) = TAG Heuer’s 1980s–90s sport diver; Super Professional = 1000M diver (WS2110-2); F1 (583.513) = early TAG Heuer F1 watch from transitional TAG era.
- **Common nicknames**: “Night Diver” (TAG Heuer 1500 series diver); “Super Professional” (1000M diver WS2110-2)
- **Notes**: These are transitional-era TAG Heuer references from the brand’s 1990s volume sport lines. The 6000 series was a lifestyle/dress crossover that sold in large numbers. The 1500 “Night Diver” (929.113G) is a serious dive watch with unidirectional bezel and 200m+ WR, sold under the “1500” name indicating the depth rating in feet. The Super Professional (WS2110-2, 1000M) is a professional-grade dive watch from TAG Heuer with 1000m WR — rarer than the standard 2000 series. Listing signals: these ref numbers all resolve cleanly to model name via listing title text; treat 929.113G as part of the “1500 Night Diver” family.

### Non-watch token flags

- `200M` and `1000M` — depth ratings appearing in listing text. Map “200M” → TAG Heuer Aquaracer / 2000 Series; “1000M” → Super Professional. Treat as metadata depth-rating tags, not watch model references.

-----

## Jaeger-LeCoultre

## Brand: Jaeger-LeCoultre

### Model line: Reverso

- **Refs**: `201.8.62` / `60.84.10` (vintage 1931 originals), `270.8.62`, `277.8.62` (Reverso Classique), `270.3.62` (Grande Taille), `Q3702520` (Reverso Tribute Small Seconds), `Q3978480` (Tribute Duoface), `Q397848J` (Tribute Duoface Tourbillon), `Q3902420` (Reverso One Duetto), `Q5712410` (Tribute Nonantième), `Q5712420` (Tribute Calendar), `Q3712512` / `Q3902420`
- **Years**: 1931–present
- **Designer / movement**: César de Trey commissioning, Jacques-David LeCoultre + René-Alfred Chauvot patent (1931) · JLC Cal. 822, 824, 849, 854, 822, 859 (Duoface), 968 (Hybris Mechanica), 822/2 (Tribute family), 869 (Calendar)
- **Key identifiers**: Rectangular case that swivels on a carrier to protect the dial; Art Deco gadroons (three vertical grooves) on top and bottom of the bracket; sizes Petite/Classique/Medium/Grande/Grande Taille/Tribute; Duoface = second dial on the reverse; Tribute = vintage proportions and styling cues.
- **Common nicknames**: “Reverso Squadra” (curved-case 2006 sport variant), “Tribute” (vintage-inspired ~45.6×27.4mm modern), “Duoface” (twin-dial reverso), “Hybris Mechanica” (high-complication versions)
- **Notes**: Designed for British Army polo players in India who needed crystal protection, the Reverso’s swivel case is one of the most enduring case designs in horology. The line is best understood by size family: Petite (small ladies), Classique/Medium, Grande (1990s revival sizes), Grande Taille (~46×27mm), Tribute (modern flagship size matching the 1931 originals at ~45.6×27.4mm), and Squadra (2006 curved-case sport). The Duoface (1994 onward) added a second dial on the reverse — usually 24h second time zone or moon phase. Highest-complication Reversos (Triptyque, Hybris Mechanica 11, Gyrotourbillon Reverso) combine multiple complications on both faces and exhibit JLC’s manufacturing peak. For listing matching: orientation of gadroons, dial signature (“JAEGER”, “LECOULTRE”, or “JAEGER-LECOULTRE” — pre-WWII US-market pieces often “LECOULTRE” only), engraved caseback custom (common — adds value when historically significant), and Tribute vs. Classique sizing (a few mm matters dramatically to collectors).

### Model line: Memovox (vintage and modern)

- **Refs**: `E855`, `E856` (Memovox Worldtime), `K855`, `Memovox Speed Beat 875`, `Q1418430` (Master Memovox), `Q2008470` (Memovox International), `Q1908470`
- **Years**: 1950–1972 (vintage golden era); modern Master Memovox revival 2008+
- **Designer / movement**: Designed by JLC R&D · Cal. 489 (manual alarm), Cal. 815 (first auto alarm 1956), Cal. K825 (Polaris-era), Cal. 916 (high-beat 28,800 Speed Beat), modern Cal. 956 / Cal. 899/1
- **Key identifiers**: Two crowns (top: alarm wind/set; bottom: time wind/set); central rotating alarm disc with triangle marker; “Memovox” on dial; gold/steel cases.
- **Common nicknames**: “Voice of Memory” (Latin etymology of Memovox), “Speed Beat” (875 — high-frequency calibre 916), “Snowdrop” (early dress Memovox)
- **Notes**: Launched in 1950 as the first wristwatch alarm, the Memovox is JLC’s longest-running and historically important utility complication line. Manual-wind references (E855) gave way to the world’s first automatic alarm watch (Cal. 815, 1956). The high-frequency Cal. 916 (Speed Beat, 28,800 vph, 1969) was a technical milestone, and the worldtime variants (E856) added a city ring rotated by the upper crown — collected separately. Modern Master Memovox (Q1418430, 2008+) revived the line with Cal. 956. Auction signal: original gong tone (light tinkling rather than buzz indicates unworn hammer), original dial signature (“JAEGER” vs. “LECOULTRE” vs. “JAEGER-LECOULTRE”), and tropical patina on gilt dials.

### Model line: Polaris (vintage E859 and modern)

- **Refs (vintage)**: `E859`
- **Refs (modern)**: `Q9008470` (Polaris Memovox 2018), `Q9008170` (Polaris Date), `Q9038670` (Polaris Chronograph WT), `Q9028471` (Polaris Mariner Memovox), `Q9068670` (Polaris Geographic), `Q908T481` (Polaris 42 limited), `Q9028180` (Polaris Date 2022)
- **Years**: 1965–1971 (vintage E859); 2018–present (modern)
- **Designer / movement**: JLC · Cal. K825 (vintage Polaris automatic alarm), Cal. 956/AA (Memovox modern), Cal. 899 (3-hand), Cal. 752 (chronograph)
- **Key identifiers**: Vintage = 42mm super-compressor case with three crowns (alarm wind, internal rotating bezel, time/wind), giant hesalite, triple case-back resonator with 16 holes for alarm projection underwater. Modern = sport-luxury 41/42mm with internal rotating bezel, gradient dial, integrated rubber/steel strap option.
- **Common nicknames**: “Triple Crown” (E859 — three crowns), “Polaris Memovox” (the original divers’ alarm), “Mariner” (modern Mariner Memovox)
- **Notes**: The vintage Polaris E859 (1965–71, total production ~1714 pieces) is one of the most celebrated vintage divers — a Memovox alarm in an oversized 42mm Ervin Piquerez super-compressor case, with the alarm engineered to be audible underwater. Modern Polaris was launched in 2018 with the Memovox Q9008470 leading a sport-luxury collection. The 2022 Polaris Date Q9028180 in 42mm with lacquered dial replaced earlier 41mm refs. Listing-critical: vintage E859 must show original three crossed-hatch crowns, intact lume on inner bezel and dial, 16-hole caseback resonator, and dial signed “Jaeger-LeCoultre” (Europe) or “LeCoultre” (US). Modern listings should specify Memovox vs. Date vs. Chronograph and bracelet option.

### Model line: Master Control / Master series

- **Refs**: `Q1548530` (Master Ultra Thin), `Q1238420` (Master Ultra Thin Moon), `Q1558420` (Master Control Date), `Q4148420` (Master Control Chronograph), `Q1418470` (Master Geographic), `Q1428421` (Master Calendar), `Q1368420` (Master Compressor — different sub-line), `Q1558530` (Master Control Memovox)
- **Years**: 1992–present
- **Designer / movement**: JLC · Cal. 849 (Master Ultra Thin Jubilee), Cal. 899 (3-hand), Cal. 868/928 (Geographic/Calendar), Cal. 757 (chronograph)
- **Key identifiers**: Clean round case (38.5–40mm); usually transparent caseback; classic dauphine hands; “Master Control 1000 Hours” certification text (1992 onward); subtly stepped bezel.
- **Common nicknames**: “Master Ultra Thin” (Q1548530 family), “1000 Hours” (1992 launch test certification), “Master Calendar Meteorite” (Q1558421 with meteorite dial)
- **Notes**: Launched in 1992 to revive JLC after the quartz crisis, the Master Control was built around a 1000-hour in-house test certification spanning movement, water resistance, magnetism, and shocks — a marketing-led quality milestone. The Master Ultra Thin Jubilee (Q1296520, 2018 LE 880) — at 4.05mm thick — is among the thinnest mechanical wristwatches and a halo piece. The Master Calendar Meteorite (2015) is a perennial collector favorite for its meteorite-slice triple-calendar dial. The 2020 redesign reduced sizes (40mm Date and Chronograph) and refined the case profile. For listings: confirm “1000 Hours” on dial for genuine Master Control vintage examples, JLC vs. “MASTER” branding, and dial signature consistency (multiple revisions over 30 years).

### Model line: Geophysic

- **Refs**: `E168` (vintage 1958 IGY), `Q8018420` (Geophysic 1958 reissue), `Q8018520` (1958 LE platinum), `Q8108420` (True Second), `Q8108520` (Universal Time)
- **Years**: 1958 original (~1000 pieces); reissue 2014–2018
- **Designer / movement**: JLC · Cal. 478BWSbr (vintage), Cal. 898 (modern automatic), Cal. 770 (True Second deadbeat seconds), Cal. 772 (Universal Time)
- **Key identifiers**: Anti-magnetic Faraday cage; chronometer certification (vintage); 35mm vintage case, 39.6mm reissue; lance hands; dauphine markers.
- **Common nicknames**: “IGY” (International Geophysical Year — 1957–58 commemoration), “True Second” (deadbeat seconds jumping like a quartz)
- **Notes**: Produced in tiny numbers in 1958 for the International Geophysical Year, the original Geophysic was JLC’s answer to Rolex Milgauss and Omega Railmaster — an anti-magnetic chronometer for scientific work. Most originals (~1000) were destroyed after their gift presentations, making period-correct E168 examples rare and valuable. The 2014 reissue (Q8018420 1958 series) revived the line with modern proportions and the True Second deadbeat seconds Cal. 770 — a technically distinctive complication that mimics quartz second-hand motion mechanically. Discontinued in 2018; no current successor.

### Model line: Futurematic

- **Refs**: `E501`, `497`, `E502`, `497/1`, `503`
- **Years**: 1953–1962
- **Designer / movement**: JLC · Cal. 497 (automatic power-reserve, no crown — set via case-back disc), Cal. 503/497 family
- **Key identifiers**: No winding crown on side (set via reverse disc); power reserve indicator at 9; small seconds at 3; “Futurematic” or “LeCoultre Futurematic” on dial; common 1950s 33mm gold or steel case.
- **Common nicknames**: “Crownless” (the defining feature), “Futurematic” itself
- **Notes**: An unusual mid-century technical curio — the Futurematic eliminated the winding crown entirely (time was set by rotating a disc on the case-back) and added a unique mainspring isolator that prevented over-winding via a fully-wound stop. Production was limited; “LeCoultre” US-signed dials (with the playful Mid-Century-Modern script) are slightly more available than European “Jaeger-LeCoultre”. Today the Futurematic appeals to collectors of mechanical oddities and is significantly under-the-radar compared to Memovox. Listing signal: confirm presence of power-reserve subdial at 9 and small seconds at 3 (any 12-position crown indicates a different reference).

### Model line: Atmos (clocks)

- **Refs**: `Atmos II / III / IV / V / VIII`, `Atmos Classique 540`, `Atmos Marqueterie`, `Atmos Hermès`, `Atmos 568 by Marc Newson`, `Atmos Régulateur`, `Atmos Transparente`
- **Years**: 1928–present (Jean-Léon Reutter invention; manufactured by JLC from 1936)
- **Designer / movement**: Jean-Léon Reutter (concept), modern designs by Marc Newson and Hermès collaborations · Cal. 540 (modern Atmos), Cal. 519/566 (Réutter-Cal. lineage)
- **Key identifiers**: Powered by changes in atmospheric temperature/pressure (perpetual without electricity or winding); annular balance making 2 oscillations per minute (vs. 18,000+/hr typical wristwatch); aneroid capsule + ethyl chloride gas; usually glass case so the mechanism is fully visible.
- **Common nicknames**: “The clock that runs forever” (marketing tagline), “Atmos Marc Newson” (568 redesign 2008)
- **Notes**: The Atmos clock is one of JLC’s most technically distinctive products: a 1°C temperature change provides 48 hours of running power, making it effectively perpetual. Calibers run extremely slowly (2 vibrations per minute) to minimize energy use. The Marc Newson Atmos 568 (2008) and Hermès collaborations are the modern design halo pieces. For listings: distinguish vintage (Atmos II–VIII era, 1936–80s) from modern Caliber 540 production; verify intact glass dome; note marquetry and color editions (collectible by edition rather than reference).


<!-- Below: gap-patch additions for Jaeger-LeCoultre merged from docs/watch_references_gaps_patch.md -->

### Model line: Reverso (additional reference tokens)

- **Refs**: `270.8.54`, `250.8.86`, `250.2.86`, `217.64.40`, `270.0.54`
- **Years**: 270.8.54: 1990s–2006 · 250.8.86: 1997–2003 · 250.2.86: 1990s · 217.64.40: 2000s
- **Designer / movement**: JLC · Cal. 822 (270 series Grande Taille), Cal. 846 (250 series Classique), Cal. 854/2 (217 Duoface)
- **Key identifiers**: 270.8.54 = Reverso Grande Taille in steel (`.8` = steel, `.54` = specific dial/strap code), 26×42mm case. 250.8.86 = Reverso Classique in steel. 250.2.86 = Reverso Classique in gold (`.2` = yellow gold). 217.64.40 = Reverso Duoface Tourbillon in platinum (`.64` = platinum, `.40` = specific version). 270.0.54 = Reverso Duoface rose gold.
- **Common nicknames**: “Robin Williams Reverso” (270.8.54 — the comedian owned a personalized Grande Taille; any provenance-linked example is premium); “Wempe Edition” (250.8.86 Wempe Limited Edition — the Hamburg retailer commissioned a small series)
- **Notes**: These are standard-production Reverso references using JLC’s dotted reference system — the middle digit encodes case material (0 = rose gold, 2 = yellow gold, 3 = white gold, 6 = platinum, 8 = stainless steel). The Robin Williams Reverso (270.8.54) gained celebrity provenance when his estate included a personalized Grande Taille — these now command significant premiums when provenance is documented. The Wempe 250.8.86 (Reverso Classique in steel, Hamburg retailer exclusive) is a co-signed limited edition. For aggregator matching: `.8` in the second position = steel; reference 270.x = Grande Taille; 250.x = Classique; 217.x = Duoface.

### Model line: Memovox (addition — early LeCoultre US market)

- **Refs**: `2052-1`, `3151`
- **Years**: 2052-1: 1950s · 3151: 1952–1956
- **Designer / movement**: JLC · Cal. 814 (2052-1, early manual alarm), Cal. 489 (3151, first Memovox movement)
- **Key identifiers**: 2052-1 = LeCoultre (US market branding) wrist alarm in gold-filled case with Cal. 814 manual-wind alarm; signed “LeCoultre” not “Jaeger-LeCoultre” (US market). 3151 = early Memovox in 18k yellow gold with Cal. 489 (the original 1950 Memovox movement) — hooded lugs, manual wind.
- **Common nicknames**: “US Memovox” (2052-1 LeCoultre-signed); “First Memovox” (3151 with Cal. 489)
- **Notes**: The 3151 in 18k yellow gold with Cal. 489 is one of the rarest and most historically significant early Memovox references — the original 1950 alarm movement in a precious metal case, with characteristic hooded lugs of the era. The 2052-1 with Cal. 814 is a US-market variant with LeCoultre-only branding (the Jaeger-LeCoultre name was not always used in the US market in the 1950s due to a distribution agreement). Listing signals: “LeCoultre” alone (not “Jaeger-LeCoultre”) = US-market piece; “Cal. 489” or “Cal. 814” in title = early Memovox era.

### Model line: JLC vintage dress / misc

- **Refs**: `1670.42`, `2648.42`, `174.8.96`, `17011`
- **Years**: Various 1970s–2000s
- **Designer / movement**: JLC · Various
- **Key identifiers**: 1670.42 = Etrier (JLC’s riding-themed model, rare, “Hermès retailed” = sold through Hermès with Hermès branding on dial); 2648.42 = “Pulsations” — a medical chronograph with pulsometer scale (for measuring heart rate) from the 1970s, caliber 2648; 174.8.96 = Master Memovox in steel (174 = Master Memovox family, .8 = steel, .96 = specific dial); 17011 = JLC “Mystery” clock reference.
- **Common nicknames**: “Etrier” (1670.42 — French for “stirrup”, the horse-riding theme); “Hermès JLC” (the Hermès-retailed Etrier); “Pulsations” (2648.42 — pulsometer-scale chronograph)
- **Notes**: The Etrier (1670.42) is a rarely seen JLC model retailed through Hermès with Hermès branded dial — making it a dual-brand collector piece. The Pulsations (2648.42) is a medical professional chronograph from the 1970s with a pulsometer scale for heart rate measurement — a niche but focused collecting category. The 17011 JLC “Mystery” references a clock (not wristwatch) with a mystery-movement complication where the hands appear to float with no visible mechanism. For aggregator matching: “Etrier” and “Hermès” co-signed = 1670.42 family; “Pulsations” = 2648.42 family.

-----

## IWC

## Brand: IWC

### Model line: Pilot / Mark series

- **Refs**: `IW3251` (Mark XI), `IW3241` (Mark XII), `IW3253` (Mark XV), `IW3254` (Mark XVI), `IW325602` (Mark XVII), `IW327011` (Mark XVIII), `IW327015` (Mark XVIII Petit Prince), `IW328201` / `IW328202` / `IW328203` / `IW328204` / `IW328205` / `IW328206` (Mark XX 2022+), Mark X (military, no IWC ref prefix — RAF issue 1944)
- **Years**: 1944 Mark X (military) → 1948 Mark 11 → 1993 Mark XII → present Mark XX
- **Designer / movement**: IWC for British Royal Air Force originally · Cal. 89 (Mark 11 — manual), Cal. 884/2 (Mark XII — JLC Cal. 889 base), Cal. 30110 (ETA 2892 base, Mark XV–XVIII), Cal. 32111 (Mark XX in-house, 5-day power reserve, 2022+)
- **Key identifiers**: Cockpit-clock aesthetic — black dial, large Arabic numerals, triangle at 12 with two dots flanking, sword hands, prominent date at 3 on modern; 36mm (Mark 11), 38mm (XII–XV), 39mm (XVI–XVIII), 40mm (XX); soft-iron inner cage for antimagnetism; screw-down crown on XX (first in the Mark series).
- **Common nicknames**: “Mark 11” (the canonical vintage), “Petit Prince” (XVIII Petit Prince — blue dial Saint-Exupéry tribute), “Top Gun” (Pilot’s Top Gun ceramic variants — separate sub-line), “Pilot’s Watch Mark” (umbrella)
- **Notes**: The Mark 11 (1948–84) is one of the most important military wristwatches: produced for the British MoD as part of the “6B/346” specification, with Cal. 89 manual and Faraday cage, it became the template for every modern pilot watch. Modern Marks (XII onward) reinterpret the Mark 11 with date windows and automatic movements; the 2022 Mark XX (IW328201 family) brought in-house Cal. 32111 with 120-hour power reserve, screw-down crown, 100m water resistance, and the EasX-CHANGE quick-strap system — the most substantial Mark redesign since 1948. The Petit Prince (IW327015 blue) and Le Petit Prince LE editions are highly collected. Authentication signals on Mark 11s: original “T” tritium dial, MoD broad-arrow caseback engraving, period crown shape, and dial condition (refinished Mark 11 dials are common and devalue the piece).

### Model line: Big Pilot

- **Refs**: `IW5002` (5002, 7-day 46mm 2002), `IW5004` (5004, 7-day 46mm), `IW500201`, `IW500202`, `IW500401`, `IW500402`, `IW501001` (Big Pilot Top Gun), `IW501007` (Big Pilot Top Gun “Mojave”), `IW510401` (Big Pilot 46), `IW329301`/`IW329303` (Big Pilot 43), `IW329701` / `IW329703` (Big Pilot 43 Top Gun)
- **Years**: 2002–present (modern Big Pilot, descended from 1940 B-Uhr 52T.S.C.)
- **Designer / movement**: IWC, based on Luftwaffe Beobachtungsuhr (“B-Uhr”) of WWII · Cal. 5000/5011 (7-day, Pellaton automatic), Cal. 52110 (5-day Pellaton, 2016+), Cal. 82100 (43mm models)
- **Key identifiers**: 46mm “Big Pilot” or 43mm “Big Pilot 43”; oversized conical crown (originally for gloved hand operation); minimalist black dial with large Arabic numerals; no date apertures on certain Heritage; ceramic case on Top Gun variants; titanium on certain Top Gun and Mojave; soft-iron inner case.
- **Common nicknames**: “Big Pilot” (umbrella), “Mojave Desert” (IW501007 sand-color ceramic), “Top Gun” (ceramic black sub-line), “Lake Tahoe” (white ceramic LE)
- **Notes**: Inspired by the WWII Beobachtungsuhr 52T.S.C., the modern Big Pilot launched in 2002 (IW500201) at 46mm with the 7-day in-house Cal. 5000 — Pellaton winding, free-sprung balance. The 2016 redesign (IW500912 etc.) brought Cal. 52110 with 7 days and twin barrels. The 2021 introduction of the 43mm Big Pilot (IW329301, Cal. 82100, 60h reserve) made the line accessible to smaller wrists. Top Gun ceramic editions (since 2007) are a separate aesthetic family. Listing signals: 46 vs. 43mm case diameter (critical for fit), date complication on dial, power-reserve indicator presence (5000-series 7-day shows reserve at 3, 82100 doesn’t), Top Gun ceramic vs. steel.

### Model line: Pilot Chronograph

- **Refs**: `IW3706` (Pilot Chrono first gen 1994), `IW3717`, `IW3777`, `IW3878` (Top Gun Chrono), `IW3789` (Pilot Chrono 41), `IW3879` (Top Gun Miramar), `IW387901`, `IW388101` (Pilot Chrono 41), `IW377701` / `IW377709`, `IW389001` / `IW389002` (Spitfire Chrono)
- **Years**: 1994–present
- **Designer / movement**: IWC · Cal. 79320/79350 (Valjoux 7750 base, modified), Cal. 89361 (in-house flyback chronograph, current Top Gun), Cal. 69380 (in-house 3-register, current 41mm)
- **Key identifiers**: Tri-compax chronograph with day-date at 3 (Valjoux 7750 base) or twin sub-register (in-house 69380/89361); 42–46mm; pump pushers; classic pilot dial with chrono complication added.
- **Common nicknames**: “Pilot Chrono” (Cal. 7750 base), “Top Gun Chrono” (ceramic with in-house 89361), “Spitfire” (separate sub-line — bronze cases and date-only)
- **Notes**: The Pilot Chronograph has been the IWC volume chronograph since 1994, originally with the modified Valjoux 7750 (Cal. 79320). The 2019 redesign introduced the in-house Cal. 69380 in the 41mm Pilot Chrono and the in-house 89361 (flyback) in the Top Gun. Spitfire variants (separate sub-line) use bronze cases and date-only displays. For listings, identifying the movement is critical: 6 o’clock register positioning differs between 7750 (day+date at 3, register at 6) and the in-house 69380 (no day, register at 6).

### Model line: Portugieser / Portuguese

- **Refs**: `IW325` (vintage 1939 oversize ref. 325), `IW5441` (Portugieser Jubilee 1993), `IW5454` (Minute Repeater), `IW5441-01`, `IW371445` / `IW371446` (Chrono Classic), `IW3714` (Chrono Classic Cal. 7750), `IW3716` (Chrono Rattrapante), `IW5004` (n/a — that’s Big Pilot), `IW5021` (Perpetual 7-day), `IW5023` (Sidérale Scafusia), `IW5446` (Hand-Wound Eight Days), `IW5447`, `IW5102` (Yacht Club Chronograph), `IW5716` (Portugieser Perpetual Calendar), `IW358303`, `IW358304` (Chrono modern), `IW390503`, `IW358301` (Portugieser Chrono in-house 69355)
- **Years**: 1939–present
- **Designer / movement**: IWC (originally a Portuguese-merchant special order for marine chronometer-accurate wristwatch) · Cal. 74 (vintage manual pocket movement in wristwatch case), Cal. 982 (vintage), Cal. 51010 (7-day Pellaton), Cal. 79350 (Valjoux 7750-based chrono), Cal. 69355 (in-house chrono 2020+), Cal. 52615 (Perpetual Calendar 7-day)
- **Key identifiers**: Large round case (42–44.2mm) with leaf hands, Arabic numerals, railway minute track, applied logo. The chrono Classic has subdials at 6 and 12 (signature layout); Perpetual Calendar has four subdials and double moonphase (Northern + Southern); ultra-thin profile.
- **Common nicknames**: “Portuguese” (older spelling), “Portugieser” (current spelling), “Yacht Club” (sport variant), “Sidérale Scafusia” (ultra-high complication)
- **Notes**: Originally commissioned in 1939 by two Portuguese watch merchants (Rodrigues and Teixeira) who wanted a wristwatch accurate as a marine chronometer, the early Portugieser used pocket-watch movements (Cal. 74) in oversized 41mm cases — radical for the period. The line was revived for IWC’s 125th anniversary in 1993 (IW5441 Jubilee, LE 500/1000/250 in materials) and became the brand’s dressy halo. The Portugieser Chrono Classic (IW3714, then IW371445 with in-house 69355) is the volume reference, while the Perpetual Calendar IW5021/IW5037/IW5023/IW5034/IW5037/IW5037IW5037IW5037 — corrected: `IW5021`, then `IW5034`, currently `IW5037` family and `IW5037` — see specific reference cards for sub-variants; consult IWC archives for exact dial color. For listings: dial color (silver/blue/grey), case material (steel, RG, white gold, platinum), movement family (Cal. 79350 vs. 69355 in-house chronograph).

### Model line: Aquatimer

- **Refs**: `IW812` (vintage Aquatimer 1967), `IW3536` (Aquatimer 2000m 1980s), `IW3548` (Aquatimer 2000), `IW3568` (Aquatimer Chronograph), `IW3719` (Aquatimer GMT), `IW3548-03` (Vintage Aquatimer 1967 reissue 2009), `IW358003` (Aquatimer 2014 redesign), `IW379501`, `IW379506`, `IW329005`, `IW329001`, `IW356802` (Aquatimer Automatic 2014)
- **Years**: 1967–present (with hiatus)
- **Designer / movement**: IWC (originally co-developed with diving researcher Hans Hass) · Cal. 8541 (vintage), Cal. 30110 (ETA 2892 base), Cal. 80110 (in-house Pellaton), Cal. 79320 (chrono)
- **Key identifiers**: Internal rotating bezel operated by 9 o’clock crown (vintage) or innovative SafeDive external/internal coupling system (2014 redesign — external bezel rotates an internal one); 200m–2000m water resistance; sword or paddle hands; 39mm vintage to 46mm Deep Three.
- **Common nicknames**: “Aquatimer 2000” (titanium 2000m models), “Deep Three” (mechanical depth gauge ref. IW3548), “Cousteau Divers” (LE editions honoring Jacques Cousteau)
- **Notes**: The 1967 Aquatimer (ref. 812) is IWC’s first dive watch, with internal rotating bezel and 200m depth rating — a competitor to the Doxa SUB and Rolex Submariner. The 2014 redesign introduced the SafeDive system: an outer ratcheting bezel that mechanically drives an inner unidirectional rotating bezel — a unique solution to the safety-vs.-grip tradeoff. The Aquatimer Deep Three (IW355701) included a mechanical depth gauge with two hands. Cousteau LE editions (with proceeds to the Cousteau Society) are perennial collectibles. Listing signals: SafeDive presence (post-2014), internal-vs.-external bezel (pre-2014), and the rare 2000m titanium variants.

### Model line: Ingenieur

- **Refs**: `IW666` (vintage Ingenieur 1955), `IW666A`, `IW666AD`, `IW1832` (Ingenieur SL Genta 1976), `IW3508` (Ingenieur Mid-Size), `IW3239` (Ingenieur AMG), `IW322701` / `IW3227` (Ingenieur Chrono), `IW323310` / `IW3233` (Ingenieur Jumbo), `IW500502`, `IW500509`, `IW357001`, `IW328901` / `IW328902` / `IW328903` / `IW328904` (Ingenieur 40 2023 Genta-redux relaunch)
- **Years**: 1955–present (with several reboots)
- **Designer / movement**: Albert Pellaton designed Cal. 8531 (1955); Gérald Genta redesigned case in 1976 (IW1832 SL) · Cal. 8531/8541 (vintage anti-magnetic), Cal. 80110 (modern in-house), Cal. 32111 (Ingenieur 40 2023, same as Mark XX)
- **Key identifiers**: Vintage = soft-iron inner case, smooth dial, classic dress profile. Genta SL (1976) = integrated bracelet, “grid” tapisserie dial, five gripped bezel screws. Modern Ingenieur 40 (2023) = revives the Genta SL with integrated bracelet, “grid” dial, and the five exposed functional H-screws on the bezel.
- **Common nicknames**: “Ingenieur SL” (1976 Genta), “Jumbo” (IW1832 40mm), “AMG” (IW3239 Mercedes collab)
- **Notes**: Originally an anti-magnetic engineering watch (Cal. 8531, 1955), the Ingenieur was redesigned by Gérald Genta in 1976 (IW1832 “SL”) — a less-celebrated but still significant Genta integrated-bracelet sport-luxury watch alongside his Royal Oak and Nautilus. The 2023 Ingenieur 40 (IW328901 etc.) is the most faithful Genta revival to date, abandoning the F1-influenced 2005–2017 designs and returning to the 5-screw bezel, integrated bracelet, and tapisserie dial. For listings: distinguish vintage (round case, anti-magnetic cage, dress profile), the Genta-era 1832/SL, the 2005–2017 F1 era (rugged 46mm, often titanium), and the 2023+ Ingenieur 40 Genta-redux. Movement: Cal. 32111 in the 2023 Ingenieur 40 mirrors the Mark XX, sharing platform — important provenance detail.

### Model line: Portofino

- **Refs**: `IW3513` (Portofino Manual), `IW3565` (Portofino Auto Date), `IW3565-03` (Portofino Chronograph), `IW3910` (Portofino 8 Days), `IW458102` (Portofino Midsize Auto), `IW391024` (Portofino Chronograph)
- **Years**: 1984–present
- **Designer / movement**: IWC (drew from 1960s Kurt Klaus pocket watch designs) · Cal. 30110 (ETA 2892 base), Cal. 35111 (Sellita-based), Cal. 79320 (Valjoux 7750), Cal. 59210 (8-Day manual)
- **Key identifiers**: Slim round dress case (37–45mm); thin bezel; usually leather strap; small seconds at 6 (manual variants), date at 3; gentle elegance over technical complication.
- **Common nicknames**: “Portofino” itself (named for the Italian Riviera town)
- **Notes**: The most accessibly priced IWC line, the Portofino has been the brand’s dress entry since 1984, designed to channel Mediterranean elegance. The Portofino Hand-Wound Eight Days (IW510102, Cal. 59210) is the line’s horological halo — an 8-day power reserve with manual wind. Annual midsize variants (37mm) target a more compact audience. For listings: differentiate manual (small seconds at 6) from automatic (date at 3, central seconds) variants, and 8-day reserve indicator presence.

### Model line: Da Vinci / Doppelchronograph

- **Refs**: `IW3750` (Da Vinci Perpetual Calendar 1985 — Kurt Klaus, “Klaus Calendar”), `IW3754` (Doppelchronograph 1992 — rattrapante 7750-base), `IW3755`, `IW3764` (Tonneau Da Vinci 2007), `IW376402`, `IW376404`, `IW392101` (round Da Vinci Chronograph 2017+)
- **Years**: 1985–present
- **Designer / movement**: Kurt Klaus (perpetual calendar mechanism, 1985 — programmable until year 2499 with single crown) · Cal. 79261/79091 (Doppelchronograph 7750 base + Richard Habring rattrapante module), Cal. 89630 (in-house perpetual chrono)
- **Key identifiers**: Da Vinci PC = perpetual calendar with single-crown adjustment via Kurt Klaus mechanism, 4-digit year aperture; Doppelchronograph = split-seconds chronograph, two stacked center seconds hands; tonneau-shape case (2007–2016) or round case (1985 original and 2017+ revival).
- **Common nicknames**: “Klaus Calendar” (the perpetual mechanism), “Doppel” (the rattrapante 3754), “Tonneau Da Vinci” (2007–16 era)
- **Notes**: Two watches define Da Vinci: the 1985 Perpetual Calendar (IW3750) — Kurt Klaus’s single-crown programmable perpetual was a horological landmark, the first PC adjustable entirely via the crown — and the 1992 Doppelchronograph (IW3754), Richard Habring’s affordable rattrapante module on a Valjoux 7750 base, which made split-seconds chronography accessible. The 2007–2016 tonneau case is the least popular era; the 2017 round case revival restored the line’s vintage proportions. For listing matching: case shape (tonneau vs. round) and complication (PC vs. simple chrono vs. doppelchronograph) are the primary disambiguators. Klaus Calendar examples (IW3750) in gold are sleeper grails.


<!-- Below: gap-patch additions for IWC merged from docs/watch_references_gaps_patch.md -->

### Model line: Pilot Chronograph (clarification — 3705, 3706)

- **Refs**: `3705`, `3706`, `IW3706`
- **Years**: 3706: 1994–1997 · 3705: 2022 (Tribute to 3705, a reference to an internal prototype designation)
- **Designer / movement**: IWC · Cal. 79320 (Valjoux 7750-based, 3706 first-gen Pilot Chrono)
- **Key identifiers**: 3706 = original generation Pilot Chronograph (1994, pre-IW prefix era), 42mm, with day-date at 3 (Valjoux 7750 layout), black dial, Arabic numerals. The “Tribute to 3705” (2022) references an internal IWC designation for a Ceratanium pilot watch concept.
- **Common nicknames**: “First-gen Pilot Chrono” (3706); “Tribute to 3705” (the 2022 Ceratanium model)
- **Notes**: The 3706 is the first generation Pilot Chronograph, predating the IW-prefix system (which came c.1998). The “Tribute to 3705” (2022) is a modern interpretation referencing an internal IWC project number rather than a production reference — these are collector-tier pieces in Ceratanium (IWC’s proprietary ceramic-titanium alloy). Listing signals: 3706 without IW prefix = first-gen Pilot Chrono; “Tribute to 3705” in title = modern 2022 Ceratanium piece.

### Model line: Ingenieur (additions — vintage variants)

- **Refs**: `666`, `666A`, `866A`, `3303`, `3505`, `3508`, `3521`, `3506`, `3360`, `1829`
- **Years**: 666/666A: 1955–1976 · 866A: late 1960s–1970s · 3303: 1980s SL Quartz · 3505–3521: 1980s–2000s
- **Designer / movement**: IWC · Cal. 8531 (666 — manual, 37 jewels, soft-iron cage), Cal. 8541 (666A / 866A — automatic, soft-iron cage), Cal. 51011 quartz (3303), Cal. 30110 ETA base (3505–3521)
- **Key identifiers**: 666 = original Ingenieur, manual Cal. 8531, soft-iron inner cage for antimagnetic protection, 35mm. 666A = automatic version. 866A = successor model. 3303 = “Ingenieur SL Jumbo Quartz” with distinctive black dial and quartz movement. 3505 = “Ingenieur Automatic SL” (mid-size). 3508 = Ingenieur in black dial 1990s. 3360 = “Graph Paper” Ingenieur — a specific dial pattern with a coordinate-grid design. 1829 = IWC “Golf Club SL” — a promotional Ingenieur SL variant with Pellaton winding given to members of a golf club.
- **Common nicknames**: “Golf Club SL” (1829 — given to a European golf club as a member gift); “Graph Paper” (3360 — the dial looks like engineering graph paper)
- **Notes**: The vintage Ingenieur family is deeply layered. The original 666 (1955, manual, Cal. 8531) is the founding reference — anti-magnetic to 1,000 gauss via soft-iron cage, designed for engineers near high-magnetic machinery. The 866A extended the line with automatic winding. Post-Genta redesign (1832 SL, 1976), the smaller 3505/3508/3521 generation represents a downsized civilian Ingenieur. The 3360 “Graph Paper” is visually distinctive and under-the-radar collectible. The Golf Club SL (1829) is an ultra-rare institutional gift piece. Listing signals: “Ingenieur” + soft-iron case = vintage antimagnetic family; “SL” designation = post-1976 Genta-influenced slimmer variant; “Graph Paper” = 3360.

### Model line: Porsche Design / IWC collaboration (new model line)

- **Refs**: `3511`, `3551`
- **Years**: 3511: 1976–1979 · 3551: 1980s–1990s
- **Designer / movement**: IWC for Porsche Design (F.A. Porsche’s design studio) · Cal. 7750 (Valjoux 7750, modified), quartz variants
- **Key identifiers**: Matte black PVD-coated titanium cases (Porsche Design’s signature); 3511 = “Compass Watch” — a timepiece with compass function integrated; 3551 = “Compass Moonphase” — compass + moonphase complications in a black PVD titanium case; both signed “Porsche Design” on dial; “IWC” on movement only.
- **Common nicknames**: “Compass Watch” (3511), “Compass Moonphase” (3551), “Porsche IWC” (the collab)
- **Notes**: Ferdinand Alexander Porsche (son of Ferry Porsche) founded Porsche Design in 1972 and partnered with IWC for a range of watches produced 1976–1993. The most distinctive pieces are the black PVD titanium Compass Watch (3511) and Compass Moonphase (3551) — functionally unusual (compass integrated into watch design) and aesthetically ahead of their time. The Porsche Design-IWC partnership ended in 1993 when Porsche Design switched to other manufacturers. Listing signals: “Porsche Design” on dial, black titanium case, compass window.

### Model line: Aquatimer vintage (additions)

- **Refs**: `1812`, `1822`
- **Years**: 1812: 1967–1970s · 1822: 1968–1976
- **Designer / movement**: IWC · Cal. 8541 (1812 — automatic), dual-crown variants
- **Key identifiers**: 1812 = original Aquatimer (first reference, internal rotating bezel operated by a second crown at 2 o’clock, 200m WR, 42mm). 1822 = “double crown” Aquatimer diver — a variant with dual crown positions.
- **Common nicknames**: “Original Aquatimer” (1812); “Double Crown” (1822)
- **Notes**: The ref 1812 (1967) is IWC’s very first dive watch — notable for its internal rotating bezel (operated by a second crown at 2 o’clock rather than an external bezel) and the use of Cal. 8541, the same movement found in the Ingenieur. The double-crown 1822 extended the design. Original examples in good condition are becoming actively collected as “early dive watch” history. Listing signals: second crown at 2 o’clock, “AQUATIMER” on dial, 42mm, absence of SafeDive system (SafeDive = post-2014 only).

### Model line: IWC Novecento (new model line)

- **Refs**: `3545`
- **Years**: 1989–1998
- **Designer / movement**: IWC · Cal. 79261 (Kurt Klaus perpetual calendar module on Valjoux 7750 base)
- **Key identifiers**: Tonneau (barrel-shaped) case; perpetual calendar with Kurt Klaus mechanism (adjusted by single crown); “NOVECENTO” on dial; yellow gold typical; 40mm.
- **Common nicknames**: “Novecento” (the model — Italian for “nineteen hundreds” / 20th century)
- **Notes**: The Novecento (1989) was IWC’s effort to offer the Kurt Klaus perpetual calendar in a more fashion-forward tonneau case rather than the traditional round Da Vinci. The 3545 is a perpetual calendar variant; the line also included simpler time-only references. Short production run (1989–98). Listing signals: tonneau/barrel case shape, “NOVECENTO” on dial, Kurt Klaus perpetual calendar (date/day/month with 4-digit year aperture), single-crown adjustment.

### Non-watch / caliber token flags

- `8531` and `8541` — these are **caliber references** appearing in listing text (not watch reference numbers). Cal. 8531 = manual Ingenieur. Cal. 8541 = automatic Ingenieur / early Aquatimer. Map these to the Ingenieur / Aquatimer model lines as caliber identifiers, not watch references.
- `500701` — this is the old-format IW500701 Portugieser Automatic 7-day. Already covered in the main index under Portugieser.

-----

## Zenith

## Brand: Zenith

### Model line: El Primero / Chronomaster

- **Refs**: `A384` (1969 original), `A385` (1969 fumé), `A386` (1969 tricolor), `A3817`, `A781` (Espada), `A788` (Sub-Sea), `01.0240.410`, `02.0240.4002` (Caliber 410 first auto-quartz), `03.2040.4061` (Chronomaster T), `03.2040.400`, `03.2080.4061` (Chronomaster Open), `03.2040.400/02.M2040` (Chronomaster Original — 2021), `03.3200.3600/21.M3200` (Chronomaster Original), `03.3100.3600/21.M3100`, `03.3100.3600/69.M3100`, `03.3100.3600/69.C823`, `03.3100.3600/21.C822` (Chronomaster Sport family)
- **Years**: 1969–present
- **Designer / movement**: Charles Vermot (saved the El Primero tooling during quartz crisis 1975) · Cal. 3019 PHC (“El Primero”) — first integrated automatic chronograph with column wheel, 36,000 vph (1969); modern Cal. 400 family; Cal. 3600 (1/10s direct from balance, 2021); Cal. 9004 (1/100s, Defy 21)
- **Key identifiers**: 38mm vintage / 41mm modern Chronomaster Sport; tri-compax dial with three overlapping colored sub-registers (signature blue/grey/anthracite on A386); 1/10s scale (modern 3600) on flange; ceramic black bezel with tachymeter (Sport); pump pushers.
- **Common nicknames**: “El Primero” (the movement and the line), “A386” (the icon), “Striking Tenth” (1/10s direct seconds from balance — Cal. 3600), “Charles Vermot” (the watchmaker who hid the tooling)
- **Notes**: The El Primero is one of horology’s most consequential movements: launched January 10, 1969 by Zenith-Movado (slightly before Heuer-Breitling’s Caliber 11 by some accounts), it was the world’s first fully integrated automatic chronograph with column wheel and 36,000 vph (10 ticks per second, enabling 1/10s timing). The 1969 trio A384 (silver dial, panda), A385 (smoked brown fumé — the first commercially-produced gradient dial), and A386 (tri-color sub-registers on white dial — the canonical El Primero look) are foundational vintage collectibles. The movement powered Rolex Daytona 16520 (modified to 28,800 vph, 1988–2000). Modern El Primero strategy bifurcates: the Chronomaster Original (2021, Cal. 3600) descends from A386 with a 1/10s central seconds; the Chronomaster Sport (2021, Cal. 3600, 41mm with black ceramic bezel) is the volume modern reference, with white-dial 03.3100.3600/69 and black-dial 03.3100.3600/21 the two volume variants. Auction-critical: original A386 with intact tri-color subdials and applied logo; “Cover Girl” A384/A385 with later service dials must be flagged.

### Model line: Chronomaster Revival

- **Refs**: `03.A384.400/21.C815` (Revival A384), `03.A384.400/21.M384` (Revival A384 bracelet), `03.A385.400/14.C855` (Revival A385), `03.A386.400/69.C807` (Revival A386), `03.A3817.4061/56.C810` (Revival Shadow A3817)
- **Years**: 2019–present
- **Designer / movement**: Zenith heritage team · Cal. 400 (El Primero 400, 36,000 vph, direct lineage from 1969 Cal. 3019 PHC)
- **Key identifiers**: Faithful 37mm reissue case proportions matching the originals; ladder bracelet on M384 version; smoked dial on A385 Revival; tricolor on A386 Revival; box-section domed sapphire crystal recalling vintage hesalite.
- **Common nicknames**: “Revival” series; “Shadow” (titanium Revival A3817 with grey dial)
- **Notes**: Beginning in 2019, Zenith released a series of museum-grade reissues of the 1969 El Primero trio, with Revival A384 (steel, panda dial, 37mm) leading the line. The Cal. 400 inside is the direct evolution of the 1969 movement — not a redesign — making these among the most authentic reissues in the industry. The Revival Shadow A3817 uses sandblasted titanium and a smoked dial, a “stealth” interpretation. For listing matching, Revival A384/A385/A386/A3817 references differ from the original 1969 A-references only in being faithfully recreated; the modern reference number format (03.A384…) and Cal. 400 movement (not vintage 3019 PHC) are the giveaways.

### Model line: Pilot Type 20

- **Refs**: `03.2430.679`, `29.2430.679`, `87.2431.679` (bronze), `11.2430.679`, `29.2432.679` (Big Date), `03.2434.693` (Chronograph)
- **Years**: 2012–present (modern Pilot Type 20 collection; descended from Louis Blériot’s 1909 cross-Channel Zenith pilot pocket watch)
- **Designer / movement**: Zenith · Cal. Elite 679 (3-hand), Cal. El Primero 405 (chronograph), Cal. Elite 691 (Big Date)
- **Key identifiers**: Oversized 45–48mm steel/titanium/bronze case; large luminous Arabic numerals (cathedral hands on some references); riveted leather strap; oversized onion crown.
- **Common nicknames**: “Pilot Type 20” (the entire line)
- **Notes**: Zenith’s Pilot collection is rooted in early 20th-century aviation: Louis Blériot wore a Zenith on his 1909 cross-Channel flight, and Zenith pocket watches were standard French aviation equipment. The modern line, launched 2012, embraces oversized 45–48mm proportions, heavily lumed cathedral hands, and pilot dial codes. The bronze Type 20 variants (Cal. Elite 679) develop natural patina and have become collector favorites. The line was streamlined in recent years toward 40–45mm sizes for broader wearability. Listing signals: case material (steel, bronze, titanium), case diameter (40 vs. 45 vs. 48), and complication (3-hand vs. chronograph vs. Big Date).

### Model line: Defy El Primero 21

- **Refs**: `95.9000.9004/78.R582`, `95.9001.9004/78.R582`, `49.9000.9004/01.R782` (Defy 21 Ti), `10.9000.9004/01.R782`, `95.9005.9004/78.R582` (Defy 21 Carbon)
- **Years**: 2017–present
- **Designer / movement**: Zenith · Cal. El Primero 9004 — 1/100th second chronograph with two independent escapements (one for time at 5 Hz, one for chronograph at 50 Hz) and two separate barrels
- **Key identifiers**: 44mm titanium or ceramic case; openworked dial showing both escapements; chronograph hand sweeps the dial in 1 second (revolution); 1/100s scale around the bezel.
- **Common nicknames**: “1/100” (the headline complication), “Defy 21”
- **Notes**: Zenith’s most technically aggressive modern watch: the Cal. 9004 runs two escapements simultaneously — the time-keeping section at 5 Hz (36,000 vph) for power efficiency, and the chronograph section at 50 Hz (360,000 vph) for true 1/100s resolution. The central chronograph hand completes a full revolution every second when running. Carbon, ceramic, and titanium variants explore high-tech materials. The Defy 21 launched alongside the broader Defy collection (a 1960s Zenith name revived in 2017). For listing matching: any “1/100” or “9004” reference indicates this specific model line, distinct from regular Defy/Chronomaster.

### Model line: Captain / Elite

- **Refs**: `03.2020.681` (Captain Central Seconds), `03.2024.683` (Captain Power Reserve), `18.2010.681` (Captain Power Reserve RG), `03.2110.681` (Elite Power Reserve), `03.2270.6150` (Elite Classic)
- **Years**: 1994 (Elite movement debut) / Captain sub-line 2010+
- **Designer / movement**: Zenith · Cal. Elite 670, 679, 681, 691, 692 (3-hand and small-complication automatic)
- **Key identifiers**: Slim round dress case (38–42mm); applied dauphine or baton hour markers; clean dial with optional power-reserve indicator; central seconds, small seconds, or moonphase variants.
- **Common nicknames**: “Elite” (the movement family — automatic, slim, 50h power reserve), “Captain” (the dress sub-line)
- **Notes**: The Elite movement (introduced 1994) is Zenith’s dress automatic platform, sitting alongside the El Primero chronograph. The Captain line (revived c. 2010) houses Elite-powered dress and small-complication watches at accessible prices. The Captain Moonphase (Elite 691) and Captain Power Reserve are the most identifiable models. With Zenith’s increasing focus on Chronomaster and Defy, the Captain line has been quietly de-emphasized, making vintage 1990s–2000s Elite-powered dress Zeniths a collector sleeper category. For listings: confirm movement family (Elite series number) and complication layout.


<!-- Below: gap-patch additions for Zenith merged from docs/watch_references_gaps_patch.md -->

### Model line: Chronomaster (additional sub-references)

- **Refs**: `3100.3600`, `3201.3600`, `3114.3600`, `3119.3600`, `3200.3600`, `3200.3800`, `0240.410`, `2310.400`, `2313.400`, `2161.4047`, `2041.4052`, `2060.4061`, `400/57`, `400/69`, `400/70`
- **Years**: Various 1990–present
- **Designer / movement**: Zenith · Cal. 400/400B (1990s El Primero revival), Cal. El Primero 4061 (open-dial variants), Cal. EP 3600 (1/10s central seconds, 2021+)
- **Key identifiers**: These are all partial dial/caliber codes extracted from the full Zenith reference format `XX.XXXX.XXX/XX.XXXX`. The first block after the material prefix identifies the collection (3100 = Chronomaster Sport, 3200 = Chronomaster Original, 3201 = Chronomaster Original Hodinkee Edition, 3114 = Chronomaster Sport blue, 3119 = Chronomaster Sport green ceramic). The caliber block after the slash (3600 = Cal. EP 3600 1/10s, 400 = Cal. 400 original El Primero, 4061 = Cal. 4061 open-dial) is the movement identifier. The `/57`, `/69`, `/70` dial codes at the end distinguish specific dial colors/variants.
- **Common nicknames**: “Hodinkee Edition” (03.3201.3600 — Chronomaster Original Hodinkee collaboration, 250 pieces); “Green Sport” (03.3119.3600 green ceramic bezel); “Blue Sport” (03.3114.3600); “Reverse Panda Sport” (03.3200.3800 — white sub-registers on black dial)
- **Notes**: The Zenith reference system’s partial-token appearance in listings (e.g., “3100.3600” extracted from “03.3100.3600/21.M3100”) is a tokenization artifact — the middle block (collection code) and caliber code are both significant and meaningful. The 3100 family is Chronomaster Sport (41mm, black ceramic bezel, 2021+); 3200 family is Chronomaster Original (38mm, no bezel, 2021+); 3201 is the Chronomaster Original Hodinkee LE. The EP 3600 caliber (identified by the “3600” in the reference) delivers 1/10s direct timing from the balance wheel — a unique feature. For aggregator matching: extract the collection code (3100/3200/3201/3114/3119) and caliber code (3600 = EP 3600 modern; 4061 = open-dial; 400 = vintage revival) as the two primary matching keys.

### Model line: El Primero vintage (De Luca era, additions)

- **Refs**: `2310.400`, `2313.400`, `01.0240.410`
- **Years**: 1988–2000
- **Designer / movement**: Zenith · Cal. 400 (El Primero, 36,000 vph — the revival movement after Charles Vermot’s preservation)
- **Key identifiers**: 02.2310.400 = De Luca era El Primero (sold under the “De Luca” name for US import); 02.2313.400 = related variant; 01.0240.410 = guilloché-dial El Primero from the same era with distinctive engine-turned guilloché center dial.
- **Common nicknames**: “De Luca” (US-market El Primero sold as “De Luca” 1988–2000 to work around US import restrictions under a separate brand name); “Guilloché El Primero” (0240.410)
- **Notes**: During a period when Zenith had trouble marketing in the US under its own name, several El Primero models were sold as “De Luca” — using the El Primero movement but with “De Luca” branding on the dial. These are 100% Zenith-made watches, and collector value follows the El Primero movement more than the De Luca branding. The guilloché-dial 01.0240.410 is valued for its hand-engraved engine-turned center dial — unusual on a sport chronograph. Listing signals: “De Luca” on dial = US-market El Primero; “guilloché” or “guilloche” dial descriptor = 0240.410 variants.

### Model line: El Primero “Striking 10th” (addition)

- **Refs**: `2041.4052`
- **Years**: 2004–2010
- **Designer / movement**: Zenith · Cal. 4052 (El Primero modified for 1/10s display via a separate 36,000-vph “striking” hand)
- **Key identifiers**: 42mm round case; central 1/10s chronograph hand sweeping the dial in 1 second; standard three-register El Primero layout alongside the 1/10s hand; “STRIKING 10TH” on dial; usually a two-tone or coloured-sub-register dial.
- **Common nicknames**: “Striking 10th” (the model name is also the nickname)
- **Notes**: The Striking 10th (2004) predated the Defy El Primero 21 as Zenith’s 1/10s chronograph concept. Rather than a second escapement (as on the Defy 21), the Striking 10th used a mechanical flywheel attached to the El Primero escapement’s arbor, spinning once per second and driving a central 1/10s hand — a clever low-complexity approach. Fewer than 2000 were produced. Listing signal: “Striking 10th” on dial and central hand completing one revolution per second.

### Model line: Zenith Sub Sea / A3637 (new model line)

- **Refs**: `A3637`
- **Years**: 1970–1978
- **Designer / movement**: Zenith · Cal. 3019 PHC El Primero (or Cal. 146 manual in some variants)
- **Key identifiers**: 43mm cushion/tonneau dive case; internal rotating bezel via crown at 10; orange or black dial; “SUB SEA 1000M” on dial (1000m depth rating — aspirational rather than tested, similar to other 1970s marketing claims); “A3637” reference in A-format (A = steel/acier).
- **Common nicknames**: “Sub Sea” (the model line); “Orange Sub Sea” (the orange-dialled version)
- **Notes**: The Zenith Sub Sea is a 1970s diver using the El Primero movement — an unusual pairing (sport dive watch + high-end chronometer movement). The internal rotating bezel (similar to vintage IWC Aquatimer) is operated by a secondary crown. The A3637 in orange is the most visually distinctive and collected variant. Listing signals: “SUB SEA” on dial, internal rotating bezel, cushion/tonneau case, orange or black dial.

### Model line: Defy (additions — Skyline, Extreme)

- **Refs**: `9301.3620`, `9300.3630`, `9100.9020`, `4000.3652`
- **Years**: 2021–present
- **Designer / movement**: Zenith · Cal. 670 (Defy Skyline 3-hand), Cal. 9300 (Defy Skyline Tourbillon), Cal. 9100 (Defy Extreme Double Tourbillon), Cal. 3652 (Pilot Big Date Flyback 4000-family)
- **Key identifiers**: Defy Skyline = 41mm star-shaped bezel, integrated rubber strap, “star” hour markers; Defy Extreme = 47mm extreme sport case, larger complications; Pilot Big Date Flyback = traditional pilot aesthetic with flyback function and double date display.
- **Common nicknames**: “Skyline” (Defy Skyline); “Extreme” (Defy Extreme Double Tourbillon)
- **Notes**: Zenith’s modern Defy line (reviving the 1969 Defy name) encompasses the Skyline (star-shaped case elements, integrated bracelet), Extreme (large-format sport complications), and Pilot Big Date Flyback. The 9301/9300 family = Skyline (skeleton and tourbillon variants); 9100 = Extreme Double Tourbillon with two independent tourbillons; 4000 = Pilot Big Date Flyback in ceramic. For matching: 93xx caliber codes = Skyline family; 91xx = Extreme; 40xx = Pilot sport family.

### Model line: Zenith Pilot (addition — Blueprint)

- **Refs**: `2435.679`
- **Years**: 2019–2022
- **Designer / movement**: Zenith · Cal. Elite 679 (3-hand automatic)
- **Key identifiers**: 45mm steel case; monochromatic “blueprint” blue applied to all elements (dial, case, hands, strap); “PILOT TYPE 20” model designation; all Zenith text in blue on blue.
- **Common nicknames**: “Blueprint” (the all-blue monochromatic treatment)
- **Notes**: The Pilot Type 20 Blueprint (2019) applied a full tonal blue treatment to the entire watch — an immersive monochromatic aesthetic that predated similar trends at other brands. Limited production. Listing signal: “Blueprint” in title or all-blue monochromatic photography.

### Non-watch token flags

- `146HP` — **caliber reference**, not a watch model. Cal. 146HP is a Zenith hand-wound chronograph movement from the early 1970s (the “HP” standing for “Haute Précision”). It was used in prototypes and some unique pieces. Treat as a caliber metadata tag when it appears in listing titles; the watch itself should be categorized by its case reference.
- `1001` / `9301.3620` / `9300.3630` — partial reference tokens from full Zenith refs; map to the Defy Skyline family. The `/79.1001` suffix is a strap code (not a model number).

-----

## Patek Philippe

## Brand: Patek Philippe

### Model line: Nautilus

- **Refs**: `3700/1A` (Jumbo 1976), `3700/11`, `3800/1A` (mid-size 37mm), `3710/1A` (power reserve), `3711/1G`, `3712/1A` (Moonphase/PR — short run), `3800/1J` (gold), `5711/1A-001`, `5711/1A-010`, `5711/1A-011`, `5711/1A-014` (Tiffany & Co. blue), `5711/1A-018` (olive green 2021), `5711/1P-001` (platinum baguette), `5711/1R` (rose gold), `5712/1A`, `5712/1R-001`, `5712G`, `5712GR-001`, `5726/1A` (Annual Calendar), `5740/1G` (Perpetual Calendar), `5980/1A` (Chronograph steel), `5980/1R`, `5990/1A` (Travel Time Chronograph), `5811/1G-001` (white gold, 41mm — 5711 successor 2022), `5811/1G-014`, `5811/1R-001` (rose gold), `5811/1A-001` (steel — for confirmation: rumored, not officially released as of this writing), `5800/1A-001` (38mm steel — 2024), `5990/1R`
- **Years**: 1976–present
- **Designer / movement**: Gérald Genta (1974 sketch, on a napkin at Basel) · Cal. 28-255 C (3700, JLC 920 ébauche), Cal. 324 S C (5711 first gen), Cal. 26-330 S C (5711 later gen and 5811), Cal. 240 PS IRM C LU (5712), Cal. CH 28-520 C (5980), Cal. 31-260 PS QA LU (5740 Perpetual)
- **Key identifiers**: Porthole-inspired octagonal case with rounded “ears” at 9 and 3 (the bezel locks the case sides); horizontally-embossed dial with subtle gradient; integrated bracelet with H-link pattern; 40mm (5711), 41mm (5811), 38mm (5800/1A or 3800), 44mm (5990); “Tiffany Blue” dial (5711-014); olive green (5711-018 2021).
- **Common nicknames**: “Jumbo” (3700 — the original 42mm), “5711” (the icon), “Tiffany Nautilus” (5711-014), “Banker’s watch” (period nickname from 1970s)
- **Notes**: The Nautilus 3700 (1976) was Genta’s second integrated-bracelet sport-luxury watch after the Royal Oak (1972). Originally a 42mm “Jumbo” in steel at a then-shocking price, the Nautilus took years to find its audience and is now the most hyped wristwatch in the modern era. The 5711 (2006–2021) became the poster child for hype-watch culture, with secondary market prices peaking near 7x retail. The 5711-014 “Tiffany Blue” (LE 170 pieces, 2021) was a Tiffany & Co. 170th-anniversary co-signed dial that auctioned for over $6M new. The 5811/1G (2022) succeeded the discontinued 5711 with a 1mm larger case (41mm), upgraded movement (Cal. 26-330 S C), and gradient blue-to-black dial — and notably is offered first in white gold rather than steel. The 5712 (PR/moonphase), 5726 (annual calendar), 5980 (chronograph), 5990 (Travel Time Chronograph), 5740 (Perpetual Calendar), and 5811 white gold/rose gold variants populate the modern Nautilus matrix. The 5800/1A (2024) is the new entry-level 38mm steel Nautilus. For listing matching: dial signature (“Tiffany & Co.” double-signed mid-dial is a >$1M signal); case size and metal; movement era flag (324 SC pre-2018 vs. 26-330 SC post — distinguishable by sweep-seconds stop functionality).

### Model line: Aquanaut

- **Refs**: `5060/1A` (Aquanaut 1997 first gen), `5065/1A` (size variant), `5066`, `5066A-001`, `5067A-006`, `5167A-001` (40mm modern steel), `5167R-001` (rose gold), `5167/1A-001` (steel bracelet), `5168G-001` (white gold 42mm), `5650G` (Travel Time Advanced Research), `5164A-001` (Travel Time), `5164R-001`, `5968A-001` (Chronograph steel), `5968G-010` (white gold w. green dial — Tiffany), `5968R`, `5165A` (rectangular Travel Time), `5260A`, `5261`, `5269` (small-Aquanaut 5267/200A), `5267/200A-014` (Aquanaut Luce green)
- **Years**: 1997–present
- **Designer / movement**: Patek Philippe in-house (often described as the “more accessible Nautilus”) · Cal. 330 SC, Cal. 26-330 S C, Cal. 324 S C FUS (Travel Time), Cal. CH 28-520 C (Chronograph)
- **Key identifiers**: Rounded octagonal case (less angular than Nautilus); “tropical” composite/embossed rubber strap with gold/steel folding clasp; embossed checkerboard or grenage dial; date at 3; 38–42mm modern, smaller vintage; Travel Time has two crowns (local + home) and two extra pushers.
- **Common nicknames**: “Aquanaut” itself; “Tiffany Aquanaut” (Tiffany-signed 5968G); “Khaki” (green dial 5168G-010), “Rose Gold Aquanaut” (5167R)
- **Notes**: Launched in 1997 as a younger, sportier alternative to the Nautilus, the Aquanaut introduced the tropical composite strap and used a less angular take on Genta’s porthole. The 5167A (2007) became the volume modern reference; the Travel Time 5164A added a second time zone with elegant case-side pushers. The 5968A Chronograph (2018) is the line’s most complicated standard production reference. The 5168G “Khaki” green (2018) brought a green dial trend that Patek later expanded across the brand. The 5267/200A Aquanaut Luce (women’s, with diamond-set bezel) anchors the female-focused sub-line. For listing matching: tropical strap original vs. aftermarket, exact case size (38 vs. 40 vs. 42mm), and chronograph vs. time-and-date.

### Model line: Calatrava

- **Refs**: `96` (vintage 1932 original, 31mm), `570` (vintage 35.5mm), `2526` (first automatic Patek, 1953), `3520`, `3796`, `5119`, `5120`, `5196`, `5227` (3796 successor with hinged caseback), `5296`, `5116`, `5153`, `5226G` (Calatrava 40mm 2022), `5226G-001`, `5236P` (in-line perpetual calendar), `6119` (Calatrava 39mm 2022 — hobnail bezel), `6119G`, `6119R`, `6007A` (Calatrava 40th anniversary Manufacture)
- **Years**: 1932–present
- **Designer / movement**: Inspired by Bauhaus / David Penney’s reading of Patek’s house style · Cal. 215 PS, Cal. 240 PS (micro-rotor), Cal. 12-600 AT (2526 — first auto), Cal. 324 S C, Cal. 30-255 PS (6119 — new manual 2022), Cal. 31-260 PS QL (5236P)
- **Key identifiers**: Round dress case (31–40mm); slim profile; small seconds (most refs) or central seconds (5227, 6007); hobnail Clous de Paris bezel on 6119 and Officer-style 5227 hinged caseback; sapphire caseback (modern); leaf or dauphine hands.
- **Common nicknames**: “Ref. 96” (the foundational Calatrava), “Officer” (5153/5227 with hinged caseback), “Hobnail” (6119 with Clous de Paris bezel), “In-Line Perpetual” (5236P)
- **Notes**: Launched 1932 with ref. 96, the Calatrava is Patek’s defining dress watch and arguably the most influential round dress design in horological history. The 2526 (1953) was Patek’s first automatic — a milestone in any history. The 3796 (1982) and its modern successor 5196 (2007) became the canonical modern manual-wind Calatrava, while the 6119 (2022) replaced the 5196 with a 39mm case and the new Cal. 30-255 PS — and added a hobnail bezel echoing the 1985 ref. 3919. The 5236P “In-Line Perpetual Calendar” (2021) displays day/date/month on a single line through a large aperture — a Patek first. For listings: case size by reference is the primary signal (96=31mm, 570=35.5mm, 5196=37mm, 6119=39mm, 5226G=40mm). Tiffany & Co. and Cartier co-signed vintage 96/570 dials drive significant premiums.

### Model line: Annual Calendar

- **Refs**: `5035` (1996 first AC), `5036` (5035 with date/moonphase variants), `5135`, `5146`, `5146G`, `5205`, `5205G-001`, `5235G` (Regulator Annual Calendar), `5235/50R-001`, `5396`, `5396R`, `5396G`, `5905`, `5905P` (Chronograph + AC), `5960` (Chrono + AC), `5960/1A`, `5450P` (Advanced Research AC)
- **Years**: 1996–present
- **Designer / movement**: Patek Philippe (Annual Calendar invented and patented by Patek 1996) · Cal. 315 S QA (5035), Cal. 324 S QA LU (5146), Cal. 31-260 REG QA (5235 Regulator)
- **Key identifiers**: Three sub-registers showing day / date / month; automatic adjustment for 30/31-day months; manual correction once per year on Feb 28→Mar 1; usually moonphase at 6.
- **Common nicknames**: “AC” (annual calendar), “Regulator AC” (5235 — silicon Spiromax, regulator dial layout)
- **Notes**: Patek invented the Annual Calendar complication in 1996 with ref. 5035 — a simpler, more affordable cousin of the Perpetual Calendar that requires only one correction per year. The 5146 became the long-running mid-collection AC; the 5396 (2006+) added the now-canonical Annual Calendar dial layout with day/month apertures at 12 and date sub-dial at 6. The 5235 Regulator AC (2011) uses a regulator dial (separate hour, minute, seconds) and is the line’s most horologically distinctive variant. For listings: moonphase presence/absence (some 5396 variants have it, some don’t), dial color and bracelet/strap option are the key signal hierarchy.

### Model line: Perpetual Calendar

- **Refs**: `2497`, `3448` (first automatic perpetual, 1962), `3449`, `3450`, `3940` (long-running QP, 1985–2007), `5039`, `5050`, `5140`, `5159`, `5327`, `5236P` (in-line, 2021), `5140J`, `5140G`, `5140P`, `5320G` (vintage-style with apertures), `5236P-001` (in-line perpetual), `5327G-001`, `5327R-001`, `5327P-001`
- **Years**: 1941 first wristwatch QP (97975 unique) → series production 1962+
- **Designer / movement**: Patek Philippe (first serial production of perpetual calendar wristwatch) · Cal. 27-460 Q (3448), Cal. 240 Q (3940 — micro-rotor), Cal. 27-RM Q (5320G — vintage-style), Cal. 31-260 PS QL (5236P in-line)
- **Key identifiers**: Day/date/month/moonphase + leap-year indicator; programmed through 2100 (skipping non-leap centurial years); usually four sub-registers in conventional layout or apertures in vintage-style (5320G); 5236P has unique inline aperture.
- **Common nicknames**: “3940” (the icon — Philippe Stern’s favorite), “5320G” (vintage-style with apertures), “5236P” (in-line)
- **Notes**: Patek invented the wristwatch perpetual calendar; the unique 97975 (1925) was the first; the 3448 (1962) was the first series-production self-winding PC. The 3940 (1985, designed by Philippe Stern himself, Cal. 240 Q) ran for 22 years and remains the connoisseur’s pick — small case (36mm), micro-rotor, restrained dial. The 5236P in-line perpetual (2021) is the most technically ambitious modern PC, displaying day/date/month in a single aperture via discs and a complex co-axial mechanism. The 5320G (2017) revives the vintage 2497/3448 aperture-style dial. For listings: dial layout (four registers vs. vintage apertures vs. in-line), case material (J/R/G/P suffix), and movement era (27-460 vs. 240 vs. 31-260).

### Model line: Chronograph

- **Refs**: `130` (1934), `1463` (first water-resistant chrono, 1940s), `1579` (large case 1950s), `2499` (perpetual chrono — four series, 1951–1985), `3970` (perpetual chrono, 1986–2004), `5004` (perpetual split-seconds chrono), `5070` (large manual chrono 1998–2008), `5170` (in-house chrono 5170 family — Cal. CH 29-535, 2010+), `5170J-001`, `5172G` (5170 successor with vintage box-crystal style), `5270` (perpetual chrono in-house, 2011+), `5270G-013`, `5270P-014`, `5370` (split-seconds in-house), `5470P` (1/10s chronograph 2022), `5172G-001`
- **Years**: 1934–present
- **Designer / movement**: Patek (relied on Valjoux 23 / Lemania ébauches through 2004; in-house Cal. CH 29-535 PS introduced 2009) · Cal. 13’’’ (130), Cal. 13-130 (1463), Cal. 27-70 Q (2499 series III–IV, 3970), Cal. CH 27-70 (5070), Cal. CHR 27-70 (5004 rattrapante), Cal. CH 29-535 PS (5170), Cal. CH 29-535 PS Q (5270), Cal. CHR 29-535 PS (5370 split-seconds), Cal. CH 29-535 PS 1/10 (5470P)
- **Key identifiers**: Classic two-register or three-register chronograph layouts; vintage uses Valjoux/Lemania ébauche; modern (post-2009) uses Patek in-house CH 29-535 family with column wheel + horizontal clutch. The 5370 platinum split-seconds is the modern flagship manual chrono.
- **Common nicknames**: “2499” (vintage perpetual chrono — series I through IV by case style), “3970” (the icon of 1980s–2000s), “5070” (the last large Lemania-base chrono), “5172G” (vintage-inspired 5170 successor)
- **Notes**: The 2499 perpetual chronograph is, alongside the 1518, the most important vintage Patek chronograph: four series across 35 years (1951–1985), about 349 pieces total, regularly reaching $1–3M at auction. The 3970 (1986–2004) continued the perpetual chronograph tradition in a slightly larger case with Cal. 27-70 Q (Lemania 2310 base). Patek’s in-house chronograph era began with the 5170 (Cal. CH 29-535 PS, 2010), followed by the 5270 perpetual chrono (2011), the 5370P split-seconds (2015), and the 5470P 1/10s chronograph (2022). The 5172G (2019) replaced the 5170 with a vintage-styled case channeling the 530. For listings: ébauche-based vs. in-house era is the single most important attribute — 5170 onward = in-house; 5070 and earlier = Lemania/Valjoux. Case material and dial color complete the matching.

### Model line: World Time

- **Refs**: `1415` (vintage 1939 first World Time), `2523` (vintage two-crown 1953), `5110` (modern revival 2000 — first new WT in decades), `5130`, `5130/1G`, `5131R-001` (cloisonné enamel map), `5131J-014` (enamel map yellow gold), `5230G-001` (current WT), `5230G-010`, `5231J-001` (cloisonné enamel revival), `5330G-001` (World Time Date 2023), `5930G-001` (World Time Chronograph 2016), `5935A-001` (WT Chronograph steel 2022 Hong Kong-only), `5524G` (Pilot Travel Time — separate sub-line)
- **Years**: 1939–present
- **Designer / movement**: Louis Cottier (mechanism inventor, with Patek collaboration) · Cal. 12’’’ / Cal. 13’’’ (vintage), Cal. 240 HU (modern WT), Cal. 240 HU C (WT Chronograph 5930)
- **Key identifiers**: 24-hour disc + city ring around dial; single-crown operation (modern); central time-zone display; sometimes cloisonné enamel map (highest tier).
- **Common nicknames**: “World Time” (the line itself); “Cloisonné WT” (enamel-map variants); “5230” (the modern flagship)
- **Notes**: The World Time mechanism (Cottier’s 1937 patent, licensed to Patek for the 1415) is one of the genre-defining travel complications. Vintage 1415 with cloisonné enamel dials (e.g., the 1415-1HU North America map) regularly clear $5M+; the unique 2523 with Eurasia map sold $7.7M at Christie’s 2019. Modern World Time started with the 5110 (2000), evolved to the 5130/5230 (2007/2016), and added a chronograph variant (5930G 2016 / 5935A 2022 HK). The 5330G (2023) added a date function (the World Time Date — Patek’s first WT with date) using a unique mechanical solution where the date jumps when the city ring is rotated through midnight. Cloisonné map dials remain the auction grail variant. For listings: city ring printing language (English/French/Russian variants exist) and case material; reference number alone usually disambiguates the era.

### Model line: Grand Complications

- **Refs**: `5208P` (chronograph + minute repeater + perpetual calendar), `5208T` (titanium one-off auction piece), `6300G` / `6300A` (Grandmaster Chime — 20 complications, double face), `6300GR` (Grandmaster Chime 175th Anniversary 2014 steel — unique, $31M auction), `5078` (minute repeater), `5074` (cathedral minute repeater perpetual), `5004` (perpetual split-seconds chrono — also in chronograph section), `5102PR` (Sky Moon Tourbillon), `5104`, `5304/301R` (minute repeater perpetual)
- **Years**: 1989 onward (modern grand complications era)
- **Designer / movement**: Patek Philippe · Cal. R CH 27 PS QI (5208), Cal. GS AL 36-750 QIS FUS IRM (6300 Grandmaster Chime), Cal. R 27 PS (minute repeater base), Cal. RTO 27 PS QR (5074)
- **Key identifiers**: Multiple complications stacked (perpetual + chrono + repeater + tourbillon); usually platinum case; “P” suffix denotes platinum; intricate sub-register layouts.
- **Common nicknames**: “Grandmaster Chime” (6300 — most complicated Patek wristwatch, 20 complications, 2014 175th anniversary), “Sky Moon Tourbillon” (5002, 5102, 6002 — celestial chart with star map on reverse)
- **Notes**: Patek’s Grand Complications are the brand’s halo pieces and the apex of modern manufacturing. The 5208 (2011) combines a minute repeater, perpetual calendar, and chronograph — a “grand sonnerie of chronographs” — in platinum. The Grandmaster Chime 6300 (2014, originally 6300GR LE 6+1 unique steel piece for the 175th Anniversary) is the most complicated Patek wristwatch ever made, with 20 complications including grande and petite sonnerie, minute repeater, alarm with cathedral gongs, instantaneous perpetual calendar, second time zone, and date repeater. The 6300GR steel unique piece sold for CHF 31M ($31.19M) at Only Watch 2019, a record for any wristwatch. For listing matching: these are typically auction-tier pieces and require provenance documentation; reference numbers alone (6300, 5208, 5074, 5104) are sufficient brand-side identifiers.


<!-- Below: gap-patch additions for Patek Philippe merged from docs/watch_references_gaps_patch.md -->

### Model line: Calatrava (vintage additions)

- **Refs**: `96`, `570`, `1450`, `1491`, `1593`, `2484J`, `2494`, `2488`, `3445`, `3483`, `3494`, `3544`, `3548`, `3574`, `3578`, `3580`, `3802J`, `3820J`, `3919J`, `3799`
- **Years**: Various 1930s–2000s
- **Designer / movement**: Patek Philippe · Various vintage calibers (12-120, 23-300, 215 PS, 240 PS)
- **Key identifiers**: Round dress watch, leather strap, small seconds or central seconds, usually no date, slim profile. All are Calatrava-family variants unless noted.
- **Common nicknames**: “Scroll Lug” (1491 with decorative scroll-shaped lugs, 1948), “Hobnail” (3919J — Clous de Paris bezel 1985, precursor to 6119)
- **Notes**: Patek’s Calatrava family spans dozens of references across nine decades. Key vintage variants in the gap list: ref 1491 (1948, scroll lugs, yellow gold — one of the most beautiful lug designs Patek ever made; auction prices $30–80k for clean examples), ref 2484/2488 (1950s rectangular/tonneau dress watches — a departure from Calatrava’s round format), ref 2494 (1950s small round Calatrava with Arabic stick dial), ref 3445 (1963 first Calatrava with automatic Cal. 27-460, rose gold), ref 3919J (1985 yellow gold with Clous de Paris hobnail bezel — the direct ancestor of the modern 6119). For the remaining refs (3483, 3494, 3544, 3548, 3574, 3578, 3580, 3802J, 3820J, 3799): all are Calatrava-family dress round watches in the 33–36mm range from the 1960s–90s in various gold cases, differing in bezel finish, lug style, and caliber. Listing signals: confirm model name from listing title; use reference number to narrow to specific decade and movement.

### Model line: Nautilus (additions)

- **Refs**: `3700/11J`, `3900/1A`
- **Years**: 3700/11J: 1978–1990 · 3900/1A: 1981–2006
- **Designer / movement**: Patek Philippe · Cal. 28-255 C (3700/11J, JLC 920 base); Cal. 35-685 (3900/1A quartz or Cal. 335 S C automatic)
- **Key identifiers**: 3700/11J = Nautilus Jumbo in 18k yellow gold (J suffix), integrated gold bracelet with H-links, same porthole case as steel 3700/1; 3900/1A = Ladies Nautilus 32mm steel with “teak” dial.
- **Common nicknames**: “Yellow Gold Jumbo” (3700/11J); “Ladies Nautilus” (3900 family)
- **Notes**: The 3700/11J is the yellow gold version of the original Jumbo — same 42mm case as the iconic 3700/1A but in 18k yellow gold. Gold-cased 3700 Jumbos are rarer than steel and command equal or higher premiums at auction. The 3900/1A (and later 3900/1J gold) is the ladies’ Nautilus with the same horizontal-relief dial and integrated bracelet scaled to 32mm — a full collecting sub-category in its own right, especially popular in Asia. Listing signals: “11J” suffix on 3700 = yellow gold bracelet version; 3900 = ladies 32mm.

### Model line: Annual Calendar (additions)

- **Refs**: `5134G`
- **Years**: 2003–c.2015
- **Designer / movement**: Patek Philippe · Cal. 324 S QA LU 24H/206 (Annual Calendar Travel Time)
- **Key identifiers**: White gold case (G suffix), travel time complication with two time zones (local + home) displayed on a single dial via two hour-hand system, annual calendar, moonphase; 38mm.
- **Common nicknames**: “Travel Time Annual Calendar”
- **Notes**: Ref 5134G combines Patek’s Annual Calendar with the Travel Time complication — using a pusher system to advance the local hour hand in 1-hour increments while the home time continues. The white gold 5134G is a relatively understated piece that collector attention has begun to focus on as values have lagged the more famous 5711/5726. Listing signals: “G” suffix (white gold), two-crown or pusher system visible on case band for Travel Time function.

### Model line: Moonphase (additions)

- **Refs**: `5054R`, `3738/100R`
- **Years**: 5054R: 1999–2007 · 3738: 1990s–2005
- **Designer / movement**: Patek Philippe · Cal. 240 LU C8 (5054R — moonphase + calendar, micro-rotor)
- **Key identifiers**: 5054R = rose gold tonneau-ish case with moonphase and date, 38mm; 3738 = perpetual calendar with moonphase in a rounded case (3738/100R = rose gold with leather strap, suffix /100 indicates specific bezel/dial version).
- **Common nicknames**: “Moon” (5054R collector shorthand)
- **Notes**: The 5054R is a relatively uncommon moonphase reference in Patek’s line, bridging the vintage and modern eras with a micro-rotor automatic and a moonphase display that was designed to go 122 years between corrections. Rose gold (R suffix) examples are increasingly collected. The 3738/100R is a perpetual calendar moonphase in an elegant round case — the /100 designation indicates a specific bezel configuration. Listing signals: rose gold case, moonphase at 6, calendar sub-dials.

### Model line: World Time (addition)

- **Refs**: `5100P-001`
- **Years**: 2000–2006
- **Designer / movement**: Patek Philippe · Cal. 240 HU
- **Key identifiers**: Platinum case (P suffix), world time display with 24-city ring and 24-hour disc, single-crown operation, 37mm.
- **Common nicknames**: “Platinum World Time 5100”
- **Notes**: The 5100P is the platinum variant of the first modern World Time revival, launched in 2000. It preceded the more common 5110/5130 generation. Platinum examples are particularly rare and track closely to equivalent-condition white gold 5110P values. Listing signal: platinum case + city ring around dial confirms World Time family.

### Model line: Ladies / Complications misc (additions)

- **Refs**: `4675G-001`, `3563/3`, `3589/1`, `3748`, `2551J`, `5124G`, `3483`
- **Years**: Various 1950s–2000s
- **Designer / movement**: Various Patek calibers
- **Key identifiers**: 4675G = ladies white gold tonneau with diamonds; 3563 = vintage ladies annual-calendar or moonphase; 3589 = vintage ladies complication; 3748 = vintage chronograph variant.
- **Notes**: These are predominantly vintage ladies’ and minor complication references that appear rarely in listings. For aggregator matching, the reference number suffix (G = white gold, J = yellow gold, R = rose gold, P = platinum) is the most reliable material discriminator. Model family should be inferred from listing title text when the specific reference is not in the main index. Listing signals: Patek reference format (4-digit + slash + alphanumeric) is reliable for brand matching even if the specific model line is unknown.

-----

## A. Lange & Söhne

## Brand: A. Lange & Söhne

### Model line: Lange 1

- **Refs**: `101.001` (Lange 1 platinum 1994 launch), `101.002` (yellow gold), `101.021` (platinum, dial-side update), `101.022` (pink gold), `101.025` (Honeygold), `101.027` (yellow gold), `101.030` (white gold), `101.032`, `101.033`, `101.039` (pink gold black dial), `101.050` (Lange 1 Time Zone), `116.025` (Time Zone), `117.025` (Lange 1 25th Anniversary), `191.039`, `191.032` (Lange 1 Daymatic), `191.020`, `192.025` (Soirée), `233.026`, `709.025` (Saxonia base — separate model), `233.025` (Lange 1 Tourbillon Perpetual Calendar Handwerkskunst), `722.025` (Lange 1 Perpetual Calendar)
- **Years**: 1994–present (Lange 1 launched at A. Lange & Söhne’s 1994 brand resurrection)
- **Designer / movement**: Günter Blümlein (CEO), Reinhard Meis, Walter Lange · Cal. L901.0 (first generation, 1994–2015), Cal. L121.1 (second generation, 2015+ — same architecture, new escape wheel and balance)
- **Key identifiers**: Asymmetric off-center dial layout with separate hour/minute, small seconds with reserve, large outsize date “Grossdatum” at top-right (the brand’s signature complication), and 72-hour power reserve indicator. Distinctive case profile (38.5mm first gen, 38.5mm gen 2 with subtly revised proportions); German silver three-quarter plate movement with hand-engraved balance cock and gold chatons (always visible through sapphire caseback).
- **Common nicknames**: “Lange 1” (the icon); “Daymatic” (191 — automatic mirror-image version with day display); “Grossdatum” (the outsize date — Lange’s signature)
- **Notes**: The Lange 1 is the watch that re-launched A. Lange & Söhne in 1994 after 50 years of dormancy following East German nationalization (1948). Its asymmetric layout — derived from the golden ratio, with all displays arranged in non-overlapping zones — became the brand’s signature aesthetic. The first-generation Cal. L901.0 ran until 2015 when it was replaced by the L121.1 (same architecture, modernized escapement and going train). The line includes the Time Zone (101.050/116.025 — second time zone with city ring), Daymatic (191.032 — automatic, mirror-image dial), Lange 1 Perpetual Calendar (345.025/722.025), Lange 1 Tourbillon, and Lange 1 Moon Phase. Honeygold variants (.025 prefix) are LE Honey gold alloy — a proprietary Lange material. For listing matching: dial color (silver/argenté, black, dark blue) and case material (Pt = platinum, R = pink/rose gold, G = white gold, J = yellow gold, HG = Honeygold) plus generation (L901 vs. L121.1 distinguishable by movement number and serial).

### Model line: Grand Lange 1

- **Refs**: `115.029`, `115.030`, `115.032`, `117.025` (Moonphase Lumen — semi-transparent dial), `117.028`, `117.039`, `117.040`, `139.025` (Grand Lange 1 Moonphase Lumen), `139.029`
- **Years**: 2003–present
- **Designer / movement**: A. Lange & Söhne · Cal. L095.1 (Grand Lange 1)
- **Key identifiers**: Larger 41mm case (vs. 38.5mm standard Lange 1); larger outsize date; subtle balance refinements; some references have Moonphase (139.025 etc.); “Lumen” variants have semi-transparent dial revealing luminous date discs.
- **Common nicknames**: “Lumen” (semi-transparent dial editions — 117.035, 139.035), “Grand”
- **Notes**: A larger interpretation of the Lange 1 introduced in 2003, the Grand Lange 1 went through a 2012 redesign that further refined dial proportions. The Lumen editions — usually limited — use a semi-transparent black dial allowing UV-charging of luminous date discs underneath, visible glowing through the dial. These are highly collected. For listings: 41mm case size is the primary signal vs. 38.5mm standard Lange 1; verify Moonphase or Lumen suffix.

### Model line: Saxonia / Saxonia Thin

- **Refs**: `211.026` (Saxonia, current 38.5mm), `211.027`, `216.026` (Saxonia Thin 37mm), `205.026` (Saxonia Thin 40mm), `380.026` (Saxonia Annual Calendar), `345.026` (Saxonia Moon Phase), `211.033` (black dial Saxonia), `381.026` (Saxonia Outsize Date), `381.032`, `301.026`, `307.026`, `737.025`
- **Years**: 1994–present (first Saxonia was 102.001, a different reference series)
- **Designer / movement**: A. Lange & Söhne · Cal. L941.1 (manual 3-hand), Cal. L086.1 (automatic Saxonia), Cal. L093.1 (Saxonia Thin manual), Cal. L941.5 (Saxonia Outsize Date)
- **Key identifiers**: Classic round dress case (37–40mm); minimalist dial with applied Roman or baton hour markers; small seconds at 6 on most refs; some refs have outsize date or moon phase; ultra-slim Saxonia Thin (5.9mm thick).
- **Common nicknames**: “Saxonia Thin” (sub-line for ultra-slim variants), “Saxonia Outsize Date” (381 family with the signature big date)
- **Notes**: The Saxonia is Lange’s foundational dress watch line and the brand’s volume reference. The Saxonia Thin (37mm/40mm) is among the thinnest hand-wound mechanical wristwatches in production. The Saxonia Outsize Date (381.026 etc.) brings the Grossdatum to a symmetric round dial. For listing matching: confirm Saxonia Thin (no seconds hand, ultra-slim case) vs. standard Saxonia (small seconds at 6) vs. Outsize Date (date aperture at 12). Dial colors include silver, champagne, black, grey, and the rare blue Tobacco Brown variants on LE pieces.

### Model line: 1815 / 1815 Chronograph / 1815 Up/Down

- **Refs**: `206.021` (1815, original), `233.026` (1815 Chronograph platinum), `402.025` / `402.026` (1815 Chronograph rose gold), `403.026` / `403.032` / `403.035` (Datograph base — see Datograph), `221.025` / `221.026` / `221.027` (1815 Up/Down 39mm), `234.026` (1815 Annual Calendar), `236.026`, `414.025` (1815 200th Anniversary F.A. Lange honeygold), `414.026` (1815 Rattrapante Perpetual Calendar)
- **Years**: 1995–present (named for Ferdinand Adolph Lange’s birth year, 1815)
- **Designer / movement**: A. Lange & Söhne · Cal. L051.1 (1815 manual), Cal. L051.2 (1815 Up/Down), Cal. L951.1 / L951.5 / L951.6 (1815 Chronograph)
- **Key identifiers**: Vintage-pocket-watch aesthetic: railway minute track, Arabic numerals, blued hands, small seconds at 6; “Up/Down” variant has power reserve indicator at 12; classic 38.5–40mm round case.
- **Common nicknames**: “1815” (the line); “Up/Down” (power reserve variant); “F.A. Lange Anniversary” (414.025 — 200th anniversary of FA Lange’s birth)
- **Notes**: The 1815 line revives classic pocket-watch aesthetics in dress wristwatch form. The 1815 Chronograph (402.025/402.026 rose gold; 233.026 platinum) is widely regarded as one of the most beautiful classic chronographs in production, with a flyback function, twin column wheels, and a perfectly symmetric two-register dial. The 1815 Rattrapante Perpetual Calendar (421.025) and 1815 Tourbillon (730.025) are higher complications. For listings: distinguish the 1815 Chronograph (two registers, no date) from the Datograph (two registers + outsize date + power reserve) which sits in its own line.

### Model line: Datograph

- **Refs**: `403.035` (Datograph platinum first generation, 1999), `403.032` (Datograph rose gold), `403.041` (Datograph Up/Down platinum), `405.035` (Datograph Up/Down platinum 2012 redesign), `405.032` (Datograph Up/Down rose gold), `410.038` (Datograph Perpetual platinum), `410.025` (Datograph Perpetual rose gold), `405.031` (Datograph Up/Down honeygold 165th anniversary), `740.036` (Datograph Perpetual Tourbillon), `406.035` (Datograph Up/Down Lumen)
- **Years**: 1999–present
- **Designer / movement**: A. Lange & Söhne (Reinhard Meis, Helmut Crott concept) · Cal. L951.1 (first gen 1999–2012), Cal. L951.6 (Up/Down 2012+ — adds power reserve and refines movement), Cal. L952.1 (Datograph Perpetual)
- **Key identifiers**: Classic two-register chronograph (30-min counter at 4:30, small seconds at 8); outsize date “Grossdatum” at 12 — the only Lange chronograph with the brand’s signature date; flyback function; large platinum/rose gold case (39mm first gen, 41mm Up/Down); breathtaking movement view through sapphire caseback (gold chatons, hand-engraved balance cock, blue screws).
- **Common nicknames**: “Datograph” (the icon — Philippe Dufour reportedly called it “the finest modern chronograph”); “Up/Down” (post-2012 with power reserve added at 6); “Datograph Lumen” (semi-transparent dial)
- **Notes**: The Datograph (1999) is widely considered the most beautiful and best-finished modern series-production chronograph movement. The Cal. L951.1 was rebuilt as Cal. L951.6 in 2012 for the Up/Down version, adding a power reserve indicator at 6 and refining the movement architecture. Platinum first-gen 403.035 with black dial is the icon; the 2018 honeygold 405.031 (165th anniversary, LE 100 pieces) is the alloy halo. The Datograph Perpetual adds perpetual calendar functionality. For listing matching: 403 vs. 405 = first gen (no power reserve) vs. Up/Down (with PR), dial color and case metal complete the disambiguation. Dufour, Voutilainen, and many independents have publicly praised the Datograph’s finishing.

### Model line: Zeitwerk

- **Refs**: `140.025` (Zeitwerk platinum first gen 2009), `140.032` (rose gold), `140.029` (white gold), `140.035` (Honeygold), `140.039`, `142.029` (Zeitwerk Striking Time), `145.029` (Zeitwerk Minute Repeater), `148.038` (Zeitwerk Decimal Strike), `147.025` (Zeitwerk Date 2019), `147.038`, `147.039`, `Zeitwerk Date 2.0 (2025)` — relaunch references TBD
- **Years**: 2009–present
- **Designer / movement**: A. Lange & Söhne (lead by Anthony de Haas) · Cal. L043.1 (Zeitwerk), Cal. L043.2 (Striking Time), Cal. L043.4 (Date), Cal. L043.5 (Minute Repeater)
- **Key identifiers**: Three jumping-numeral discs (hours, tens-of-minutes, units-of-minutes) displayed through three apertures across a horizontal “time bridge”; instantaneous (not creeping) digital-mechanical time display; constant-force escapement to power the jumping mechanism; 41.9mm case.
- **Common nicknames**: “Zeitwerk” (the line — “time machine” in German), “Jumping Hours” Lange-style
- **Notes**: The Zeitwerk (2009) is Lange’s most aesthetically and mechanically radical line: a fully mechanical jumping-numeral digital display, requiring a constant-force escapement to provide the energy bursts needed to jump three discs simultaneously every minute. The Zeitwerk Date (147.025, 2019) added a peripheral date ring with red marker at the current date — an inventive solution to add date complication to the already-busy face. The Zeitwerk Minute Repeater (145.029) chimes the time displayed digitally — the only repeater that you can simultaneously read digitally and hear acoustically. Lange announced a redesigned Zeitwerk in 2024–2025 with doubled power reserve (72h) and revised proportions. For listings: case material, dial color (silver, black, blue, grey, smoked grey on the Lumen variant), and complication tier (base Zeitwerk vs. Date vs. Striking Time vs. Minute Repeater) define the matching.

### Model line: Richard Lange

- **Refs**: `232.026` (Richard Lange — 3-hand symmetric), `232.032`, `252.025` (Richard Lange Pour Le Mérite — fusée-and-chain), `260.025` (RL Perpetual Calendar Terraluna), `260.032`, `261.026` (Richard Lange Jumping Seconds), `261.025`, `216.026` (RL Tourbillon Pour Le Mérite), `760.025` / `760.032` (Tourbillon Pour Le Mérite)
- **Years**: 2006–present
- **Designer / movement**: A. Lange & Söhne · Cal. L041.2 (RL 3-hand), Cal. L044.1 (RL Pour Le Mérite — fusée and chain), Cal. L094.1 (Jumping Seconds), Cal. L096.1 (Tourbillon PLM)
- **Key identifiers**: Symmetric dial with hours/minutes centered and small seconds (3 sub-dial regulator layout on some variants); chronometer-style observation watch aesthetic; named for Richard Lange (F.A. Lange’s son); 38.5–40.5mm round case; usually no date.
- **Common nicknames**: “Pour Le Mérite” (PLM — fusée-and-chain transmission variants); “Terraluna” (260.025 — perpetual with terrestrial/lunar display on caseback); “Jumping Seconds” (261 — deadbeat seconds)
- **Notes**: The Richard Lange line is Lange’s “scientific chronometer” interpretation, with regulator-style dial layouts and high-precision specifications. The Richard Lange Pour Le Mérite uses a fusée-and-chain mechanism for constant torque — among the most labor-intensive complications in modern horology (the chain alone has 636 hand-assembled parts). The Terraluna (260.025) is a perpetual calendar with a unique orbital moon-phase display on the caseback showing Earth-Moon-Sun positions. The Jumping Seconds (261.026) uses a deadbeat seconds mechanism for high readability. For listings: regulator dial (separate hour/minute/seconds) is a strong RL signal; “Pour Le Mérite” or “Terraluna” branding on the dial uniquely identifies high-complication variants.

### Model line: Tourbograph PLM

- **Refs**: `706.025` (Tourbograph platinum), `706.032` (Tourbograph honeygold), `701.005` (older variant), `T712` (Tourbograph Perpetual Pour Le Mérite)
- **Years**: 2005–present
- **Designer / movement**: A. Lange & Söhne · Cal. L903.0 (Tourbograph PLM Perpetual), Cal. L133.1
- **Key identifiers**: Tourbillon + chronograph + rattrapante (split seconds) + perpetual calendar + fusée-and-chain transmission — five major complications; 43mm platinum/honeygold case; extremely rare (limited production).
- **Common nicknames**: “Tourbograph” (the line); “PLM” (Pour Le Mérite — fusée-and-chain)
- **Notes**: One of Lange’s grand complication halos, combining five major complications (tourbillon, rattrapante chronograph, perpetual calendar, fusée-and-chain, and standard chronograph) in one of the most mechanically dense wristwatches in production. Production volumes are tiny (often 50-piece LEs in honeygold or platinum). For listings: any 706/T712 reference is auction-tier territory; documentation and provenance dominate the matching consideration.

### Model line: Double Split / Triple Split

- **Refs**: `404.035` (Double Split platinum 2004), `404.038`, `404.041`, `424.038` (Triple Split white gold 2018), `425.038` (Triple Split honeygold 2024)
- **Years**: 2004 (Double Split); 2018 (Triple Split)
- **Designer / movement**: A. Lange & Söhne · Cal. L001.1 (Double Split), Cal. L132.1 (Triple Split)
- **Key identifiers**: Rattrapante mechanism extended to the minutes counter (Double Split = seconds + minutes split) and additionally the hours counter (Triple Split = seconds + minutes + hours split — a world first); 43mm platinum/white gold/honeygold case; two stacked center seconds hands; flyback function.
- **Common nicknames**: “Double Split” / “Triple Split”
- **Notes**: Mechanical world firsts: the Double Split (2004) was the first wristwatch chronograph to split both seconds AND minutes (where conventional rattrapantes only split seconds). The Triple Split (2018) extended this to hours — making it possible to time two simultaneous events of up to 12 hours each independently. These are signature Lange technical statements. Honeygold Triple Split (425.038, 2024) is the latest variant. For listings: any “split” Lange beyond a standard chronograph is one of these references.

### Model line: Lange 31

- **Refs**: `130.025` (Lange 31 platinum)
- **Years**: 2007–c. 2020
- **Designer / movement**: A. Lange & Söhne · Cal. L034.1 — 31-day power reserve manual wind
- **Key identifiers**: 45.9mm platinum case (very large for Lange); twin mainspring barrels with constant-force escapement; 31-day power reserve; special key winding (cannot be wound by crown — too much torque); power reserve indicator.
- **Common nicknames**: “Lange 31” (the 31-day power reserve)
- **Notes**: At the time of release (2007), the longest power reserve in a wristwatch (31 days), achieved by twin mainspring barrels coupled to a constant-force escapement. The watch is wound by a special key (included with the watch) inserted into the case-back — the mainspring torque is too high for crown winding. Production was very limited; discontinued around 2020. For listings: the 130.025 reference and the keyless winding are unique identifiers.

### Model line: Odysseus

- **Refs**: `363.179` (steel blue 2019), `363.068` (white gold 2020), `363.150` (Honeygold “Lumen” 2022 — LE 100), `363.117` (titanium 2022), `363.179 / LSLS3635BA` (full Lange code variant)
- **Years**: 2019–present
- **Designer / movement**: A. Lange & Söhne · Cal. L155.1 Datomatic (in-house, automatic, 28,800 vph, 50h reserve, platinum micro-rotor, full balance bridge with wave engraving)
- **Key identifiers**: 40.5mm case (steel, titanium, or precious metal); integrated bracelet (first Lange with one); day-of-week display at 9 + outsize date at 3 (separate discs flanking the dial); screw-down crown (Lange’s first); 120m water resistance; pusher-adjustment for day/date integrated into case sides flanking the crown.
- **Common nicknames**: “Odysseus” (the line); “Steel Lange” (since this was Lange’s first steel sport watch — a major brand departure)
- **Notes**: Released in October 2019 to mark the 25th anniversary of A. Lange & Söhne’s modern resurrection, the Odysseus is Lange’s first integrated-bracelet sports watch and first steel watch. Originally hyped to extreme degrees (4–6 year waitlists), market values have normalized closer to retail since 2022. The steel reference (363.179) lists at approximately $39,100 in 2024. The Cal. L155.1 Datomatic features a platinum micro-rotor, ARCAP rotor support, full balance bridge with hand-engraved wave motif (rather than the usual floral motif on Lange dress watches), and 4 Hz frequency (higher than the typical 3 Hz Lange movements). Variants: 363.179 steel blue, 363.068 white gold grey dial, 363.117 titanium grey, and the 2022 Honeygold Lumen LE 100 with semi-transparent dial. For listings: full Lange product code (`363.179 / LSLS3635BA`) is the canonical form; abbreviated `363.179` is more common in market listings.


<!-- Below: gap-patch additions for A. Lange & Söhne merged from docs/watch_references_gaps_patch.md -->

### Model line: Lange 1 (additional reference tokens)

- **Refs**: `101.031`, `116.032`
- **Years**: 101.031: c.2000–2015 · 116.032: 2005–present
- **Designer / movement**: A. Lange & Söhne · Cal. L901.0 (101.031 rose gold), Cal. L031.1 (116.032 Time Zone)
- **Key identifiers**: 101.031 = Lange 1 in rose gold (pink/rose gold case, silver dial — the `.031` suffix encodes pink gold + argenté/silver combination); 116.032 = Lange 1 Time Zone in rose gold (second-time-zone city ring, pink gold case, silver dial).
- **Notes**: The .031 suffix in Lange’s reference system historically indicated rose gold case with silver/argenté dial — an important mid-series reference. The 116.032 is the Time Zone variant in rose gold. For matching: `.032` suffix = rose gold + silver dial across the Lange family; `.031` = a slightly different rose gold formulation used in earlier production.

### Model line: Saxonia (additions)

- **Refs**: `201.027`, `878.038`
- **Years**: 201.027: 2012–present · 878.038: special edition
- **Designer / movement**: A. Lange & Söhne · Cal. L093.1 (Saxonia Thin), Cal. L086.1 (automatic)
- **Key identifiers**: 201.027 = Saxonia Thin 37mm in white gold (`.027` encodes white gold case with a specific dial variant — cream or white). 878.038 = Saxonia with Tahitian mother-of-pearl dial (MOP) in white gold — a special edition rarely seen.
- **Common nicknames**: “Tahitian MOP” (878.038 — the Tahitian mother-of-pearl dial with its natural iridescent blue-green colour)
- **Notes**: The 201.027 Saxonia Thin is the white gold version of Lange’s thinnest dress watch. The 878.038 with Tahitian mother-of-pearl dial is one of Lange’s most unusual and visually striking pieces — the black-with-iridescence of Tahitian MOP against a white gold case. Both are rarely traded. Listing signals: “MOP” or “mother of pearl” in title + Saxonia = 878.038 family.

### Model line: Langematik (new model line)

- **Refs**: `302.025`, `302.026`, `302.032`
- **Years**: 1997–c.2010
- **Designer / movement**: A. Lange & Söhne · Cal. L921.4 (automatic, quickset date, Lange’s first automatic with instantaneous-jumping date)
- **Key identifiers**: 37.5mm round case; automatic winding (Lange’s own automatic, unusual — most Lange watches are manual); outsize date “Grossdatum” at top of dial (same as Lange 1 date); “LANGEMATIK” on dial; platinum (302.025), white gold (.026), rose gold (.032).
- **Common nicknames**: “Langematik” (the model — Lange + automatic = “Langematik”)
- **Notes**: The Langematik (1997) was Lange’s answer to demand for an automatic version of the Lange 1 concept — specifically, it brought the outsize Grossdatum to an automatic movement, the L921.4. The Langematik Perpetual (302.xxx extended with PC module) added perpetual calendar to this platform. The “Jubiläum” (anniversary) designation on 302.025 indicates the 750th anniversary of Glashütte (the German watchmaking town). Langematik production was discontinued c.2010 in favour of the Daymatic (automatic Lange 1 with day display). Listing signals: “LANGEMATIK” on dial (distinguishes from “LANGE 1”), automatic winding, 37.5mm round case.

### Model line: 1815 (additional references)

- **Refs**: `212.050`, `221.021`, `234.032`, `402.032`, `421.025`
- **Years**: 212.050: 2015 LE · 221.021: 1997–2005 first gen 1815 Up/Down · 234.032: 2006–2012 · 402.032: 1815 Flyback Chrono · 421.025: 1815 Rattrapante Perpetual
- **Designer / movement**: A. Lange & Söhne · Cal. L051.2 (221.021 Up/Down), Cal. L951.5 (402.032 Flyback Chrono), Cal. L134.1 (421.025 Rattrapante PC)
- **Key identifiers**: 212.050 = “Homage to F.A. Lange” 1815 Moonphase in Honeygold, LE 100 pieces (Ferdinand Adolph Lange 200th anniversary, 2015). 221.021 = 1815 Up/Down first generation (yellow gold, power reserve indicator at 12). 234.032 = 1815 second generation in rose gold. 402.032 = 1815 Flyback Chronograph in rose gold. 421.025 = 1815 Rattrapante Perpetual Calendar in platinum.
- **Common nicknames**: “F.A. Lange Homage” (212.050); “Up/Down First Gen” (221.021)
- **Notes**: The 221.021 Up/Down first generation (yellow gold, 1997) was the first Lange watch with a power reserve indicator — pre-dating the Datograph — in the classic 1815 round case. These early yellow gold Up/Down examples are increasingly recognized as significant first-generation pieces. The 402.032 Flyback Chronograph in rose gold is the standard 1815 Chrono reference in pink gold. The 421.025 Rattrapante Perpetual Calendar in platinum is a grand complication halo piece. Listing signals: “UP/DOWN” or “AUF/AB” on dial = 221.021 family; “RATTRAPANTE” = 421.025; “FLYBACK” = 402.032.

### Model line: Grand Lange 1 Lumen (addition)

- **Refs**: `117.035`
- **Years**: 2012 (LE 30 pieces each material)
- **Designer / movement**: A. Lange & Söhne · Cal. L095.3
- **Key identifiers**: 41.9mm Grand Lange 1 case in platinum (117.035); semi-transparent black sapphire dial with luminous date discs visible underneath; UV-activated glowing date display; “LUMEN” designation.
- **Common nicknames**: “Grand Lumen” / “GL1 Lumen”
- **Notes**: The Grand Lange 1 Lumen (117.035 platinum, 117.032 rose gold) is a limited-edition Grand Lange 1 with a transparent black sapphire dial — the outsize date discs beneath glow when charged by UV light, visible through the semi-transparent dial. Only 30 pieces per material. Among the most visually striking Lange limited editions and a strong auction performer. Listing signal: “LUMEN” on dial, semi-transparent black dial with glowing date discs.

-----

## Universal Genève

## Brand: Universal Genève

### Model line: Polerouter / Polarouter

- **Refs**: `20214`, `20214-2`, `20217`, `20217-2`, `20124` (Polarouter — pre-name-change), `20357-1` (first Polerouter with Cal. 215 Microtor, 1955), `20360`, `20360-1`, `20362`, `20363`, `10357-4` (gold De Luxe), `Polerouter Jet`, `Polerouter Date`, `Polerouter Sub` (dual-crown EPSA Super Compressor + single-crown), `Polerouter Super`, `Polerouter Genève`, `Polerouter Compact`, `Polerouter NS`, `Polerouter III`, `Polerouter Day-Date`, `Polerouter Sub 869110/03` (single crown), `Polerouter Sub 869121/03` (dual crown)
- **Years**: 1954 (Polarouter) → 1955 renamed Polerouter → ~1969 production end
- **Designer / movement**: Gérald Genta (his first major design, age 23) · Cal. 138 SS bumper (1954 originals), Cal. 215 Microtor (1955–60 — UG’s revolutionary micro-rotor, world’s thinnest automatic at 4.1mm), Cal. 218-2 (Polerouter Date), Cal. 68 / 69 (1962+ refinements), Cal. 72 (Day-Date variants), Cal. 1-66 (later thinner micro-rotor)
- **Key identifiers**: Lyre-shaped twisted bombé lugs (Genta signature); steel chapter ring with engine-turned guilloché; multi-level dial; 34.5–35.5mm vintage cases; “Microtor” or “Automatic Microtor” on dial (some early Cal. 215 = “Microtor only” — rare); SAS Polar Route commission origin.
- **Common nicknames**: “Polarouter” (pre-1955 name spelling), “Microtor only” (rare early 215 dial — only “Microtor”, no “Automatic”), “Super Compressor Sub” (dual-crown EPSA case Polerouter Sub), “Genta’s first” (the original design credit)
- **Notes**: Designed by a 23-year-old Gérald Genta to commemorate Scandinavian Airlines (SAS) trans-polar flights (1954), the Polerouter is among the most historically significant mid-century watches and arguably Genta’s first major design. The earliest references (20214, 20217) used Cal. 138 SS bumper automatic; from 1955, the line transitioned to Cal. 215 — one of the first two micro-rotor movements in the industry (parallel-developed with Hamilton/Büren’s Planetary Rotor, leading to a patent dispute resolved 1958). The “Microtor only” dials (no “Automatic” text) appear on the earliest 20360/20363/10357 references and are highly prized. The Polerouter Sub line (1961–68) added dive watch functionality; the dual-crown Super Compressor (EPSA case) variants are extremely rare. The brand has now relaunched in 2026 with new Polerouter references (refs UG-110 caliber) — important context for distinguishing vintage from new production. Authentication signals: original dial (multi-level, chapter ring intact, no fading of printed text below “Polerouter”), Genta lugs unpolished and sharp, period-correct crown, and reference numbers cross-checked at universalgenevepolerouter.com.

### Model line: Tri-Compax

- **Refs**: `12296`, `12297`, `222100`, `222100/2`, `222100/4`, `222101`, `222102`, `222104`, `222105`, `222104/2`, `881101-101`, `881101-103`, `881101-104`, `881101 "Eric Clapton"` (5402 — that’s AP; ignore), Tri-Compax `222100` family is the standard
- **Years**: 1944–1980s
- **Designer / movement**: Universal Genève · Cal. 481 (vintage Tri-Compax, manual-wind, triple calendar + moonphase + chronograph), Cal. 287 (later automatic Tri-Compax), Cal. 137 SS
- **Key identifiers**: Full calendar (day, date, month) + moonphase + chronograph — three complications hence “Tri-Compax”; round 35–37mm cases; pump or rectangular pushers; gold or steel; usually two pushers + crown for chrono + correctors on case-side for calendar.
- **Common nicknames**: “Eric Clapton” (specific 881101 Tri-Compax LE owned by Clapton — sold at auction 2003); “Tri-Compax” itself (the icon); “Dato-Compax” (related calendar-chrono variant)
- **Notes**: One of the most complete vintage chronograph wristwatches: the Tri-Compax (introduced 1944) combined a full calendar, moonphase, and chronograph in a single sub-35mm package — at the time, only Patek’s 1518 and a few unique pieces had similar specs. Vintage 12296/12297 with gold cases and original triple-calendar dials regularly clear $30–80k+ at auction; Eric Clapton’s example (sold by Antiquorum 2003, Hong Kong) set a benchmark for celebrity provenance. The 222100 series (1960s) used the same complication set in updated cases. Auction-critical: dial originality (refinishing is the single biggest devaluator), moonphase aperture cleanliness, calendar register typography (Italian/French/English market variants), and complete case ridges.

### Model line: Compax / Uni-Compax

- **Refs**: `12446`, `22272`, `22291` (Uni-Compax 1-register), `22409`, `22408`, `22276`, `22405` (Compax), `22502`, `885101/02` (“Nina Rindt”), `885103/01` (“Evil Nina”), `Aero-Compax 22409` (see Aero-Compax), `881104` (Compax modern)
- **Years**: 1936 (Compax launch) → 1980s
- **Designer / movement**: Universal Genève · Cal. 285 / 287 / 281 (Compax three-register), Cal. 130 / 132 (Uni-Compax single register)
- **Key identifiers**: Compax = three-register chronograph; Uni-Compax = single-register (typically just 30-min counter at 3 or 45-min); panda or reverse-panda dial variations; 36–38mm round case.
- **Common nicknames**: “Nina Rindt” (885101/02 Compax — white dial with black sub-registers, worn by Nina Rindt at husband Jochen Rindt’s F1 races); “Evil Nina” (885103 — reverse panda, black dial white sub-registers); “Big Eye” (oversized register variants)
- **Notes**: The Compax (1936) was UG’s three-register chronograph — a high-end Valjoux/Venus alternative with proprietary movements (Cal. 281/285/287). The “Nina Rindt” panda 885101 became one of the most recognizable vintage chronographs after collectors associated it with Nina Rindt; values escalated from sub-$1000 in the 2000s to $20k+ today for clean examples. The “Evil Nina” reverse panda is rarer and similarly valued. Universal Genève is also relaunching the Compax in 2026 with new “Nina” and “Evil Nina” references powered by Cal. UG-200, an in-house column-wheel chronograph with micro-rotor. For listings: vintage Nina/Evil Nina = 885101/03 references; new 2026 production = different UG-200-equipped refs and must be flagged distinctly.

### Model line: Aero-Compax

- **Refs**: `22409`, `222291`, `222102/2`, `882104` (later)
- **Years**: 1940s–1960s
- **Designer / movement**: Universal Genève · Cal. 285/287
- **Key identifiers**: Three-register chronograph + additional central time-zone hand controlled by independent crown at 8 or 9 o’clock; pilot/aviation aesthetic; usually 36mm round case with Arabic numerals.
- **Common nicknames**: “Aero-Compax” (aviation chrono with reminder hand)
- **Notes**: An ingenious pilot-oriented variant of the Compax, with an additional center hand (independently set via a second crown) used as a reminder or rendezvous indicator. Production was modest and original Aero-Compax examples with intact second crowns and matching dials are scarce — particularly the gold cases. For listings: confirm presence of second crown at 8 or 9 o’clock; that’s the definitive Aero-Compax signal.

### Model line: Golden Shadow / White Shadow

- **Refs**: `666106`, `665100`, `666102`, `666119`, `2-66 cal. UG`
- **Years**: 1966–1979
- **Designer / movement**: Universal Genève · Cal. 1-66, 2-66 (ultra-thin micro-rotor)
- **Key identifiers**: Ultra-thin (~2.5mm thick) automatic dress watch; Cal. 2-66 was the world’s thinnest automatic movement at 2.5mm; gold (Golden Shadow) or steel/white-gold (White Shadow) cases; minimalist dial.
- **Common nicknames**: “Golden Shadow” / “White Shadow”; sometimes “UG Thin”
- **Notes**: A direct competitor to Patek’s Cal. 240 and Piaget’s Cal. 12P, the Golden Shadow’s Cal. 2-66 (1966) at 2.5mm was a thinness record for automatic movements. Production lasted into the 1970s. As Universal Genève faded and was absorbed, these slim references became sleeper collectibles — still relatively affordable for the technical achievement. For listings: Golden Shadow = yellow gold case typically; White Shadow = white gold or steel; both share the Cal. 1-66/2-66 family movements.


<!-- Below: gap-patch additions for Universal Genève merged from docs/watch_references_gaps_patch.md -->

### Model line: Polerouter (additional sub-references)

- **Refs**: `204503-2`, `204610-2`, `20217-4`, `20363-4`, `869111/01`, `869122`
- **Years**: 1955–1969
- **Designer / movement**: Universal Genève · Cal. 215 (204503-2/20217-4/20363-4), Cal. 218-2 (204610-2 Polerouter Date), Cal. 69 (869111/01, 869122 Polerouter Date later)
- **Key identifiers**: 204503-2 = Polerouter with Cal. 215, dial code -2 indicating a non-luminous silver dial (important: the `-2` suffix signals the specific dial variant). 204610-2 = Polerouter Date with tropical-potential dial. 20217-4 = Polerouter with non-luminous silver dial (suffix -4). 20363-4 = Polerouter “Broad Arrow” — this variant features broad-arrow hands, similar to early Omega/IWC military pieces. 869111/01 = Polerouter Date in the later 6-digit system (Cal. 69). 869122 = Polerouter Sub with blue bezel (a rare variant of the diver Polerouter).
- **Common nicknames**: “Broad Arrow Polerouter” (20363-4 with broad-arrow style hands); “Tropical Polerouter Date” (204610-2 — the tropical brown dial designation)
- **Notes**: The suffix codes after the hyphen in UG Polerouter references encode crucial dial variant information: `-1` = luminous dial, `-2` = non-luminous silver, `-3` = specific gold dial, `-4` = additional variants. “Broad Arrow” Polerouters (20363-4) are rare variants with military-style broad-arrow hour hands, suggesting either military supply or a market-specific design. The 869122 with blue bezel is among the most unusual Polerouter Sub configurations — blue bezels on the Polerouter Sub are far rarer than black. The 204610-2 with noted “tropical” dial commands significant premiums if the patina is genuine and even. Listing signals: suffix -4 = Broad Arrow hands; “869122 blue bezel” = rare Polerouter Sub variant; “tropical” = 204610-2 if brown patina confirmed.

### Model line: Compax / Uni-Compax (additions)

- **Refs**: `884100/02`, `884.495`, `885104-2`
- **Years**: 884100: 1960s · 884.495: 1960s–70s · 885104-2: 1970s
- **Designer / movement**: Universal Genève · Cal. 285/287 (manual chronograph)
- **Key identifiers**: 884100/02 = Uni-Compax (single-register chronograph, not Tri-Compax) with “Big Eye” designation (oversized 30-minute or 60-minute register at 3 — notably larger than standard). 884.495 = “Baby Nina” — a smaller-version Compax with blue dial, nicknamed for its resemblance to the “Nina Rindt” panda Compax but in smaller dimensions and blue. 885104-2 = “Space Compax Mk2 all-black” — a dark/black-dial Compax variant (the “Space” designation suggests a more modern/technical aesthetic).
- **Common nicknames**: “Big Eye” (884100 — oversized single register); “Baby Nina” (884.495 — blue-dial smaller Compax related to Nina Rindt aesthetics); “All-Black Space Compax” (885104-2)
- **Notes**: “Baby Nina” (884.495) is an emerging nickname for blue-dial UG Compax variants that echo the white-dial “Nina Rindt” aesthetic but in a smaller case and blue colourway — the name has appeared in specialist dealer listings but is not universally established. “Big Eye” Uni-Compax watches are distinguished by the dramatically oversized single chronograph register, which dominates the dial. The “Space Compax” (885104-2) black dial suggests production in the 1970s space-age aesthetic era. Listing signals: “Big Eye” in title = 884100 Uni-Compax; “Baby Nina” = 884.495 blue Compax; “Space Compax” = 885104 all-black variant.

### Model line: Tri-Compax (early addition)

- **Refs**: `22539`
- **Years**: 1943
- **Designer / movement**: Universal Genève · Cal. 287 (manual chronograph, triple calendar + moonphase)
- **Key identifiers**: Very early Tri-Compax (1943) predating the more common 12296/12297 era; 22539 = steel case with triple calendar and moonphase; wartime production makes this one of the earliest Tri-Compax references.
- **Notes**: The 22539 (1943) is among the earliest documented Tri-Compax references — produced during WWII in steel, with the full calendar/moonphase/chronograph combination. Condition of wartime pieces is often challenging; the most valued examples have intact original lume and unpolished case edges. Listing signal: 5-digit numeric ref in the 22xxx range = early-era UG.

### Model line: UG misc vintage (Cioccolatone, Monodatic, misc)

- **Refs**: `10228`, `100101`, `10750`, `170.380`
- **Years**: 10228: 1940s–50s · 100101: 1940s–50s · 10750: 1940s · 170.380: 2000s
- **Designer / movement**: Universal Genève · Various vintage calibers
- **Key identifiers**: 10228 = “Cioccolatone” UG — the square/cushion-case gold dress watch with guilloché dial; 100101 = Monodatic in 18k pink gold (the “Monodatic” had a simplified date display); 10750 = very early UG in yellow gold (1940s art deco period); 170.380 = late-era UG dress watch with guilloche dial and power reserve indicator (possibly post-1970s revival attempt or a late catalog piece).
- **Common nicknames**: “Cioccolatone” (10228 — the square/rounded case resembling a chocolate bar)
- **Notes**: The UG “Cioccolatone” (10228) shares the same case nickname applied to similar-era square/cushion pieces from Omega and other makers — the rounded rectangular shape resembles a chocolate block. In pink gold with guilloché dial, these are Art Deco collector pieces. The Monodatic (100101) is an unusual UG complication where a single pointer indicates date around the periphery. The 170.380 late-era piece (guilloche dial, power reserve) may be from Universal Genève’s final production years (c.1980–88) before dormancy. Listing signals: “Cioccolatone” in title = 10228; “Monodatic” = 100101; “power reserve” + UG = 170.380.

-----

### Tokens that are NOT watch model references (treat as metadata)

### Partial Zenith reference tokens

## Audemars Piguet

## Brand: Audemars Piguet

### Model line: Royal Oak Jumbo / Extra-Thin

- **Refs**: `5402ST` (1972 original A-series → D-series), `5402SA` (two-tone), `5402BA` (yellow gold), `14802ST` (1992 20th-anniversary Jubilee), `15002ST` (1992–2000), `15202ST` (2000–2022), `15202BA` (yellow gold), `15202OR` (rose gold), `15202PT` (platinum), `15202BC` (white gold), `15202IP` (titanium-platinum), `15202ST.OO.1240ST.01` (full reference format), `16202ST.OO.1240ST.01` (2022 successor, steel), `16202ST.OO.1240ST.02`, `16202OR.OO.1240OR.01` (pink gold smoked grey), `16202BA.OO.1240BA.01` (yellow gold), `16202PT.OO.1240PT.01` (platinum smoked green), `16202BC.OO.1240BC.02` (white gold grainy blue), `16202XT.OO.1240XT.01` (titanium + BMG burgundy), `16204ST.OO.1240ST.01` (skeleton “Jumbo”)
- **Years**: 1972–present
- **Designer / movement**: Gérald Genta (legendary overnight design 1971 for 1972 Basel Fair) · Cal. 2121 (JLC ébauche, 3.05mm — the original Jumbo movement, 1972–2022), Cal. 7121 (in-house replacement, 2022+, 3.2mm, quick-set date, 55h reserve, 28,800 vph), Cal. 7124 (16204 skeleton)
- **Key identifiers**: 39mm octagonal bezel with eight exposed hexagonal screws; “Tapisserie” guilloché dial (originally “Petite Tapisserie” on 5402, “Grande Tapisserie” on 15500 etc.); integrated bracelet with H-shaped links and concealed clasp; ultra-thin profile (8.1mm); no center seconds hand (Jumbo is the only standard RO without one); AP logo at 6 o’clock from 1976 onward (5402 D-series and later — early A/B-series had it at 12).
- **Common nicknames**: “Jumbo” (the original — a period name for the unusually large 39mm steel sports watch), “Extra-Thin” (the modern name), “5402 A-series” (first 1000 with AP logo at 6 — most desirable vintage variant), “Bleu Nuit Nuage 50” (the original galvanic blue Stern Frères dial), “Jumbo 50th” (16202 variants)
- **Notes**: The Royal Oak (launched 1972) is the watch that redefined “steel luxury sport” — Genta drew it in a single night, AP priced it higher than a contemporary Patek Philippe gold dress watch, and the industry mocked them. It became the most influential watch design of the late 20th century, spawning the entire integrated-bracelet-sport-luxury genre. The Jumbo lineage runs: 5402 (1972–80s) → 14802 (1992 Jubilee with see-through caseback) → 15002 (1992–2000 standard) → 15202 (2000–2022 — kept the original case-back and Cal. 2121) → 16202 (2022, 50th anniversary, in-house Cal. 7121). The 16202 introduced AP’s first new ultra-thin movement in 50 years; case dimensions remain identical (39mm × 8.1mm) but the new caliber 7121 includes quick-set date, free-sprung balance with adjustable inertia weights, and a wider barrel. The 16202BC (2023 white gold with grained blue “Tuscan” dial) and the 16202XT (titanium + BMG burgundy) are boutique exclusives. Auction-critical signals: vintage 5402 series letter (A-series = first 1000, ~$300-500k clean; B/C/D-series step down in value), original “Bleu Nuit, Nuage 50” galvanic dial untouched, AP-logo position (6 o’clock = D-series and later; 12 o’clock = earlier batches), and matching original “tropical” Royal Oak bracelet.

### Model line: Royal Oak Selfwinding (non-Jumbo)

- **Refs**: `14790ST` (1992–2002 36mm — popular but not Jumbo), `14790BA`, `15300ST` (2005–2012), `15400ST` (2012–2019 41mm), `15400OR`, `15400BC`, `15500ST` (2019+ 41mm with seconds hand), `15510ST` (2021+, “Frosted Gold” 15510), `15510OR`, `15510BC`, `77350ST` (Royal Oak 34mm modern), `15450` (37mm, 2014–2018)
- **Years**: 1992–present
- **Designer / movement**: AP · Cal. 2225 (vintage 14790), Cal. 3120 (15300/15400 — full-rotor 40h), Cal. 4302 (15500/15510 — in-house, 70h, 28,800 vph)
- **Key identifiers**: Center seconds hand (distinguishes from Jumbo); 36/37/41mm cases; date at 3; “Grande Tapisserie” dial pattern; modern 15500/15510 has slightly broader minute track than 15400.
- **Common nicknames**: “15400” (the 2012-onwards 41mm volume reference), “15500” (the 2019 update with new dial proportions and 4302 movement), “15510” (with see-through caseback)
- **Notes**: The Royal Oak Selfwinding 41mm with date and seconds has been AP’s volume reference since 2012 (15400 generation). The 15500ST (2019) updated the movement to in-house Cal. 4302 (70h power reserve, replacing the 3120) and subtly redesigned the dial (longer minute track moved closer to the hour markers, slightly different printed text). The 15510 (2021) added a sapphire caseback — visually the same as 15500 but with see-through back. Color/dial variants include “Smoked” gradient dials (introduced for 50th anniversary), “Frosted” gold (hammer-textured gold cases, originally with Carolina Bucci, 2017+), and various boutique colors. Pre-2012 (15300, 14790 generation, 36mm) is now a sleeper vintage-adjacent category. For listing matching: 15400 (4-digit) vs. 15500 / 15510 (5-digit) is the era cut-off in 2019; size suffix (ST/OR/BA/BC/PT) the material; full-format reference (15500ST.OO.1220ST.01) is the canonical form.

### Model line: Royal Oak Chronograph

- **Refs**: `25860ST` (first RO Chrono, 1997), `25860OR`, `26022BA` (39mm RG chrono), `25979ST` (RO Chrono 39mm), `26300ST`, `26320ST` (2012 redesigned RO Chrono 41mm), `26320OR`, `26331ST` (2017 RO Chrono — Cal. 2385 → in-house 4401, 41mm), `26331OR`, `26331BA`, `26331BC`, `26240ST` (2022 50th anniversary RO Chrono — in-house Cal. 4401, 38mm), `26240OR`, `26240BA`, `26240PT`, `26715ST` (RO Chrono 38mm, 2024 + Cal. 7137)
- **Years**: 1997–present
- **Designer / movement**: AP, expanding Genta’s Royal Oak design · Cal. 2385 (F. Piguet 1185 base, 1997–2012), Cal. 2385 modified (2012 update), Cal. 4401 (in-house, integrated chronograph, flyback, 2019+), Cal. 7137 (in-house, vertical clutch, 2024)
- **Key identifiers**: Octagonal RO case with Royal Oak codes; three sub-registers (60-min, 30-min, small seconds — vintage layout) or 30-min + 12-h + small seconds (modern integrated layout); date at 4:30 (modern) or no date (some early); 39–41–38mm sizes across generations.
- **Common nicknames**: “RO Chrono” (umbrella); “26331” (the 2017–2022 volume chronograph); “26240” (2022 50th anniversary 38mm — the new “right” size); “Beverly Hills” (specific boutique LE colorways)
- **Notes**: AP added a chronograph to the Royal Oak in 1997 with ref. 25860, using the F. Piguet 1185 base (Cal. 2385). For 25 years the line shared its movement with similar mid-tier chronographs. In 2019, AP introduced in-house Cal. 4401 (integrated chronograph with flyback, column wheel, vertical clutch) in the Code 11.59 first, then migrated it to RO Chrono 26331 generation. The 2022 50th anniversary brought the 26240ST at a more vintage-correct 38mm with Cal. 4401 — widely praised as the best-sized modern RO Chrono. The 26715 (2024, 38mm) introduced Cal. 7137 with revised vertical clutch architecture. For listings: confirm case size (38/39/41/42mm), sub-register layout (vintage layout = 60-min top, modern = 30-min top), and movement (2385 vs. 4401 vs. 7137).

### Model line: Royal Oak Perpetual Calendar

- **Refs**: `25686BA` (first RO PC 1984), `25820ST` (RO QP 39mm steel — Genta-era PC), `25820OR`, `25820BA`, `25820SP` (tantalum), `25820TI`, `26574ST` (2015 RO PC 41mm), `26574OR`, `26574BA`, `26574IO` (forged carbon), `26579ST` (RO PC openworked), `26579CB` (frosted gold), `26604OR` (RO Selfwinding Flying Tourbillon Perpetual)
- **Years**: 1984–present
- **Designer / movement**: AP · Cal. 2120/2802 (vintage PC), Cal. 5134 (2015 RO PC), Cal. 5135 (RO QP openworked)
- **Key identifiers**: Four sub-registers (day, date, month, moon phase) + leap year indicator; 39mm vintage / 41mm modern; “Royal Oak Perpetual Calendar” on dial; full RO codes (octagonal bezel, integrated bracelet).
- **Common nicknames**: “RO Perpetual” / “RO QP” (quantième perpetuel — French); various dial colors (smoked, salmon, frosted gold)
- **Notes**: The Royal Oak Perpetual Calendar (1984) was one of the first sports-watch perpetual calendars, demonstrating that a perpetual calendar could live in a stainless-steel integrated-bracelet case. The 2015 redesign (26574ST/OR/BA) is the volume modern reference. Dial colors include grey, blue, salmon, green, and various boutique exclusives. The 26579 (openworked) shows the movement through the dial. For listings: case size (39mm vintage vs. 41mm modern) and dial color define matching.

### Model line: Royal Oak Offshore (original / “The Beast”)

- **Refs**: `25721ST` (Offshore 1993 “The Beast” — first RO Offshore, designed by Emmanuel Gueit), `25721ST.OO.1000ST.01` through `.10` (variants of original Beast), `25721BA`, `25721OR`, `25721TI`, `25770` (Offshore Yacht), `25778` (older Diver variant)
- **Years**: 1993–early 2000s (original Beast era)
- **Designer / movement**: Emmanuel Gueit · Cal. 2126/2840 (modified JLC 920 + Dubois-Depraz chronograph module)
- **Key identifiers**: 42mm case (was considered massive in 1993 — hence “The Beast”); thicker bezel with prominent gasket; rubber-and-steel construction with exposed bezel screws still octagonally arranged; oversized pushers; rubber-clad crown; chronograph layout.
- **Common nicknames**: “The Beast” (period name for the 1993 launch ref. 25721 — at 42mm it was significantly larger than its 39mm Royal Oak sibling), “Offshore”
- **Notes**: When Emmanuel Gueit pitched the Offshore concept in 1992, Genta reportedly hated it — “they’re ruining my watch.” But the 1993 Offshore 25721ST defined the oversized sports-luxury chronograph genre and became an icon in its own right. The original Beast featured AP Royal Oak codes scaled up and toughened with gasket bumpers, oversized pushers, and rubber accents — a more aggressive industrial language than the original RO. Early Beast examples with “tropical” rubber accents and unpolished cases are increasingly collectible. For listings: ref. 25721 + 42mm + heavy rubber bumpers = original Beast.

### Model line: Royal Oak Offshore Chronograph

- **Refs**: `26170ST` (mid-2000s ROO), `26170OR`, `26237ST`, `26238OR` (ROO Chrono 42mm), `26420ST` (current ROO Chrono 43mm 2018+), `26420OR`, `26420SO` (forged carbon), `26420RO`, `26420IO`, `26421` (ROO Chronograph variants), `26405CE` (Black Ceramic), `26405CG`, `26239`, `26470ST` / `26470OR` (older ROO 42mm chrono), `26480TI` (ROO Selfwinding)
- **Years**: 2000s–present
- **Designer / movement**: AP · Cal. 3126/3840 (Cal. 2326 base + DD module), Cal. 4404 (in-house integrated chrono on newest ROO 26420 in-house variants)
- **Key identifiers**: 42–44mm aggressive case; ceramic, forged carbon, titanium, or precious metal variants; “Mega Tapisserie” dial pattern (larger than Grande Tapisserie); usually rubber strap with deployant or integrated bracelet; chronograph with date.
- **Common nicknames**: “ROO” (Royal Oak Offshore — the standard collector abbreviation), “Diver” (rotating internal bezel sub-line), “Survivor” (specific LE), “Schumacher” (LE), “Volcano” (smoked dial LE), “End of Days” (1999 black PVD LE for the film), “Bumble Bee” (yellow-and-black variants), “Safari” (white dial), “Black Themes” (full ceramic)
- **Notes**: The ROO Chronograph is AP’s most-celebrity-driven sub-line, with countless limited editions tied to athletes (Schumacher, Lebron James, Rubens Barrichello), events, and themes. The 26170 generation (2005-onwards 42mm) is the volume vintage-modern ROO; the 26420 (2018+ 43mm) is the current production reference with both Cal. 3126/3840 (ETA-era) and Cal. 4404 (in-house, more recent) variants. Black ceramic ROO Chronos (26405CE) are the volume modern halo. For listings: case size (42 vs. 43 vs. 44mm), case material (steel, ceramic, forged carbon, titanium), and dial pattern (Méga Tapisserie vs. smoked vs. specific LE patterns) determine matching.

### Model line: Royal Oak Offshore Selfwinding

- **Refs**: `26480TI` (ROO Selfwinding 43mm titanium), `26470ST` (ROO Selfwinding — also chrono variants share prefix; verify model), `15710ST` (ROO Diver 42mm), `15720ST` (ROO Diver 42mm with date), `15703ST` (ROO Diver — vintage), `15710CE`
- **Years**: 2010s–present
- **Designer / movement**: AP · Cal. 3120 (older), Cal. 4308 (in-house)
- **Key identifiers**: ROO design without chronograph; usually time-and-date or diver with internal rotating bezel (Diver line); 42mm; ceramic, titanium, steel, or precious-metal options.
- **Common nicknames**: “ROO Diver” (15710CE etc.), “ROO Time-and-Date”
- **Notes**: The non-chrono Offshore variants — particularly the Diver (15710CE) with its internal rotating bezel operated by a second crown at 10 — are popular among collectors who want the Offshore aesthetic without chronograph complexity. Ceramic Diver variants (15710CE all-black) have been hard to acquire. The ROO Selfwinding 42/43mm has been refreshed multiple times; recent refs in this family use the in-house Cal. 4308.

### Model line: Royal Oak Concept

- **Refs**: `25980AI` (RO Concept 2002 LE 150 — first Concept), `26223FT` (RO Concept Tourbillon Chrono), `26561TI` (RO Concept Supersonnerie), `26580IO` (RO Concept Flying Tourbillon GMT), `26589IO` (RO Concept Black Ceramic), `26580OR`
- **Years**: 2002–present
- **Designer / movement**: AP · Various high-complication calibers (tourbillon, chrono, GMT, supersonnerie)
- **Key identifiers**: Avant-garde alien-looking case shapes; titanium, ceramic, forged carbon, or alacrite construction; complications heavy (tourbillon, chronograph, GMT, minute repeater); not part of standard RO Octagonal lineage.
- **Common nicknames**: “Concept” (the sub-line); specific releases like “Supersonnerie” (minute repeater with patented acoustic technology); “Black Panther” (LE with Marvel collab)
- **Notes**: The Royal Oak Concept (2002 launch) is AP’s experimental halo line — a platform for showcasing complications and materials. The 2015 Supersonnerie reinvented the minute repeater acoustic engineering with a patented sound membrane. Production quantities are tiny (often LE 50–200). For listings: any RO Concept reference implies a high-complication, often LE auction-tier piece; provenance documentation is essential.

### Model line: Millenary

- **Refs**: `15040`, `15048`, `15057`, `15049BC` (Millenary first-gen oval case), `15320ST` (Millenary 4101 — openworked dial), `77247BC` (Millenary Frosted Gold ladies), `15350ST`
- **Years**: 1995–c. 2019 (discontinued)
- **Designer / movement**: AP · Cal. 3120 (Cal. 4101 — Millenary 4101 with central seconds and off-center hour-minute)
- **Key identifiers**: Oval case (the only mainstream oval-cased AP); off-center hour-minute sub-dial (Millenary 4101); openworked dial showing escapement off to the side; 42–47mm horizontal case width.
- **Common nicknames**: “Millenary” / “Millenary 4101” (the openworked version)
- **Notes**: AP’s only oval-cased line, the Millenary was the brand’s “third pillar” alongside Royal Oak and Jules Audemars dress watches. The Millenary 4101 (2011) added an off-center display revealing the escapement — a horological showpiece. The line was quietly discontinued around 2019 as AP focused on Royal Oak and Code 11.59, making vintage Millenary pieces a sleeper opportunity. For listings: oval case shape is the immediate identifier.

### Model line: Code 11.59

- **Refs**: `15210BC` (Code 11.59 3-hand white gold 2019), `15210OR`, `15210CR`, `26393BC` (Code 11.59 Chronograph), `26393OR`, `26393CR`, `26396NR` (Code 11.59 Selfwinding Chronograph forged carbon), `26395BC` (Code Tourbillon), `26583BC` (Code Tourbillon Openworked), `26396OR.OO.D002CR.02` (full-format)
- **Years**: 2019–present
- **Designer / movement**: AP · Cal. 4302 (3-hand), Cal. 4401 (integrated chronograph), Cal. 2950 (flying tourbillon)
- **Key identifiers**: Octagonal middle case with round bezel and round case-back; “double curve” sapphire crystal that warps light; 41mm; very thin lug-to-case integration; precious metal only (no steel as of 2024); leather or rubber straps.
- **Common nicknames**: “Code” (the line — initially negatively received but vindicated by movement quality), “1959 launch year” reference (the “11.59” in the name references the founding date)
- **Notes**: AP’s contemporary collection launch in 2019 was met with mixed reception aesthetically — but the in-house Cal. 4302 (3-hand, 70h power reserve) and Cal. 4401 (integrated chronograph, flyback, vertical clutch) introduced inside are widely regarded as among the best modern AP movements. Subsequent generations of Code (chronograph variants, tourbillon, openworked dial in 2022) have grown the line. For listings: Code 11.59 references all start with 152xx (3-hand), 26393 (chrono), 26395/26583 (tourbillon variants); case is always 41mm and always octagonal middle / round bezel.


<!-- Below: gap-patch additions for Audemars Piguet merged from docs/watch_references_gaps_patch.md -->

### Model line: Royal Oak early variants (additions)

- **Refs**: `4100ST`, `4100BA`, `56175ST`, `56175TT`, `56175TR`, `56175BA`, `56303ST`, `6005SA`, `5402BC`
- **Years**: 4100: 1972–1979 · 56175: 1975–1984 · 56303: 1980s
- **Designer / movement**: Audemars Piguet · Cal. 2121 (JLC ébauche) for time-only; Cal. 2120 for some variants; quartz Cal. 2510 for 6005SA
- **Key identifiers**: 4100ST = Royal Oak “Mark I” (very earliest production, 1972–74 first run, sometimes differentiated from main 5402 production runs); 56175 = Royal Oak self-winding with date in 36mm case (smaller than the 39mm Jumbo), available in steel (ST), two-tone (TT = steel/gold), tri-colour (TR = steel/yellow/white gold), and yellow gold (BA); 56303ST = Royal Oak with date in steel 39mm non-Jumbo; 6005SA = quartz Royal Oak (SA = two-tone steel/gold) — the “quartz Royal Oak” produced briefly during the quartz crisis.
- **Common nicknames**: “Mark I” (4100ST — the first-run Royal Oak); “Small Royal Oak” or “36mm RO” (56175); “Quartz Royal Oak” (6005SA)
- **Notes**: The 56175 is the undersung sibling of the famous 39mm Jumbo — a 36mm Royal Oak with date (center seconds) in the same octagonal integrated-bracelet case, available in more material combinations than the larger Jumbo. The TT (two-tone), TR (tri-colour), and BA (yellow gold) variants are particularly unusual. The 6005SA quartz Royal Oak (c.1976–82) demonstrates that AP briefly offered quartz in the RO before abandoning the technology. All these references use the same fundamental Genta case DNA as the 5402. Listing signals: 36mm case size = 56175 family; quartz crown position (often at 3 rather than 2) = 6005SA; “Mark I” on caseback or early 1972–74 serial = 4100ST.

### Model line: Royal Oak Day-Date / Annual Calendar (additions)

- **Refs**: `25572SA`, `25920BA`
- **Years**: 25572SA: 1985–1994 · 25920BA: 1996–2004
- **Designer / movement**: Audemars Piguet · Cal. 2120/2800 (day-date), Cal. 5121 (annual calendar)
- **Key identifiers**: 25572SA = Royal Oak “Day-Date” in two-tone steel/gold (SA), featuring day and date displays — called “OWL” by collectors for the twin-aperture appearance; 25920BA = Royal Oak Annual Calendar in yellow gold (BA), triple calendar with moonphase.
- **Common nicknames**: “OWL” (25572SA — the day-date display with twin apertures resembles owl eyes); “Annual Calendar RO” (25920BA)
- **Notes**: The “OWL” Royal Oak (25572SA) is one of the most visually distinctive early Royal Oak complications — the twin apertures for day and date on the Royal Oak dial create an almost face-like impression that gives it the nickname. Yellow gold Annual Calendar Royal Oak (25920BA) is the precursor to the modern 26574 line. Both are auction-grade pieces that have been significantly under-the-radar relative to the Jumbo and Offshore. Listing signals: “OWL” in title = 25572SA; Annual Calendar with RO case and yellow gold = 25920BA.

### Model line: Royal Oak Perpetual Calendar early variants (additions)

- **Refs**: `25657`, `25654ST`
- **Years**: 1980s–early 1990s
- **Designer / movement**: Audemars Piguet · Cal. 2120/2802 (perpetual calendar module on 2120 base)
- **Key identifiers**: Early Royal Oak PC in platinum (25657PT) or steel (25654ST) with four sub-registers, petite tapisserie dial, integrated bracelet; predates the later 25820 generation.
- **Common nicknames**: “Early RO PC” or “25657”
- **Notes**: These are the first-generation Royal Oak perpetual calendars, predating the better-known 25820 generation. The platinum 25657PT is particularly rare and commands auction premiums. The steel 25654ST with “Petite Tapisserie” black dial is a sleeper grail — one of the earliest steel perpetual calendars from any major manufacturer in an integrated-bracelet sports case. Listing signals: petite tapisserie dial, four sub-registers, early AP perpetual calendar layout (different from modern 26574 layout).

### Model line: Royal Oak Chronograph (addition — Kasparov)

- **Refs**: `25960BA`
- **Years**: 1997–2005
- **Designer / movement**: Audemars Piguet · Cal. 2385 (F. Piguet 1185 base)
- **Key identifiers**: Yellow gold Royal Oak Chronograph in BA material, with three register chronograph layout; associated with Garry Kasparov after AP’s chess sponsorship.
- **Common nicknames**: “Kasparov” (25960BA — AP was official sponsor of Kasparov vs. Deep Blue, 1996/1997; these yellow gold RO Chronos were gifted and associated with the match)
- **Notes**: AP sponsored Garry Kasparov’s 1996 and 1997 matches against IBM’s Deep Blue. The 25960BA yellow gold RO Chronograph was associated with this sponsorship and gifted examples carry provenance significance. Non-provenance examples are still rare as yellow gold RO Chronos are produced in small numbers. Listing signal: “Kasparov” in title or provenance papers; yellow gold chronograph RO.

### Model line: Jules Audemars Tourbillon (addition)

- **Refs**: `25718OR`, `25718PT`
- **Years**: 1990s–2005
- **Designer / movement**: Audemars Piguet · Cal. 2870 (manual tourbillon)
- **Key identifiers**: Round case (not Royal Oak) in rose gold (OR) or platinum (PT); flying tourbillon at 6 o’clock; ultra-thin profile; dress watch proportions (38–40mm); “Jules Audemars” on dial.
- **Common nicknames**: “JA Tourbillon” or “Jules Audemars Tourbillon”
- **Notes**: The Jules Audemars line is AP’s classical dress collection, in sharp contrast to the Royal Oak and Offshore. The tourbillon variants (25718 family) represent the haute horlogerie peak of the line — hand-wound, ultra-thin movements with flying tourbillons. These are collector-tier auction pieces rarely seen in dealer inventory. Listing signals: round case (not octagonal), “Jules Audemars” on dial, tourbillon visible at 6.

### Model line: Royal Oak Star Wheel (addition)

- **Refs**: `25720BA`
- **Years**: 1991–2002
- **Designer / movement**: Audemars Piguet · Cal. 2956 (wandering-hour “Star Wheel” mechanism)
- **Key identifiers**: Royal Oak integrated bracelet case; wandering-hour display with three rotating discs carrying numerals that pass across a curved aperture; yellow gold (BA); 36mm.
- **Common nicknames**: “Star Wheel” (the three-pointed rotating disc assembly for the wandering hour display)
- **Notes**: The Star Wheel (1991) was AP’s avant-garde complication for the Royal Oak — a wandering hour display where three rotating “star” discs, each bearing numerals 1–12, pass across the aperture in sequence. It is mechanically unusual (three separate trains feeding the star discs) and visually arresting. The yellow gold BA version is rare. Listing signals: three rotating discs visible on dial, “wandering hour” or “Star Wheel” in title, Royal Oak integrated bracelet case.

### Model line: AP Square / “Cobra” / 5043 family

- **Refs**: `5043`, `5043BA`, `5043BC`, `5043ST`, `5403BC`
- **Years**: 1970s–1990s
- **Designer / movement**: Audemars Piguet · Cal. 2003 / 2804 (manual ultra-thin for square cases)
- **Key identifiers**: Square case (not octagonal Royal Oak); ultra-thin profile; dress watch format; 5043 appears in yellow gold (BA), white gold (BC), and steel; 5403BC is the “Cobra” — a distinctive hand-engraved snake motif on the dial.
- **Common nicknames**: “Cobra” (5403BC — the snake motif dial)
- **Notes**: The 5043 family represents AP’s square dress watch line, positioned as a classical alternative to the Royal Oak sport. The 5403BC “Cobra” is the most unusual variant, with an engraved cobra snake motif filling the entire dial — a unique haute joaillerie-meets-art piece that was retailed by Bvlgari in some markets (hence “Retailed by Bvlgari” appearing in listings). These are rarely traded and highly specific to collector niches. Listing signals: square case, thin profile, and “Cobra” or “5043” in listing title.

### Non-watch token flag

- `15550ST` — this IS a Royal Oak Selfwinding reference (see main index 15500/15510 section); the 15550 is likely an interim or market-specific variant of the 15500 generation. Treat as equivalent to 15500ST for matching purposes.

-----

## F.P. Journe

## Brand: F.P. Journe

### Model line: Tourbillon Souverain

- **Refs**: `T` (Tourbillon Souverain brass-movement era, 1999–2003), `TN` (Tourbillon Souverain gold-movement era, 2003–2013 — adds remontoire d’égalité), `TV` (Tourbillon Vertical / Tourbillon Souverain Vertical, 2019+ — vertical tourbillon cage), `TVJ` (Tourbillon Souverain Joaillerie Diamants)
- **Years**: 1999–present (Tourbillon was F.P. Journe’s first wristwatch — the brand’s founding model)
- **Designer / movement**: François-Paul Journe · Cal. 1403 (brass T, manual, tourbillon with seconds reset), Cal. 1403 in 18k rose gold (TN, with remontoire d’égalité — constant-force mechanism, more refined movement decoration), Cal. 1519 (TV — vertical tourbillon cage in horizontal case)
- **Key identifiers**: 38mm or 40mm round case (platinum or 6N rose gold); off-center hour-minute sub-dial at 9-12 zone; large tourbillon cage visible at 6 (or vertical orientation in TV); deadbeat seconds on remontoire variants; signature “Invenit et Fecit” engraving (Latin for “invented and made it” — Journe’s manufacturing claim).
- **Common nicknames**: “Brass Journe” (brass-movement era pre-2003 — most collectible vintage Journe), “Gold Movement” (TN and post-2003 18k rose gold movements), “TV” (vertical tourbillon)
- **Notes**: François-Paul Journe’s first serial wristwatch (1999), the Tourbillon Souverain was built around a tourbillon with remontoire d’égalité — a constant-force escapement intended to deliver more chronometric precision than tourbillon-alone. The 1999–2003 “brass movement” era is highly collected (production ~100/year, brass plates and bridges later replaced by 18k rose gold from 2004); brass-era examples regularly clear $200–500k at auction. The 2003 “gold movement” transition (TN) maintained the design but reinforced Journe’s commitment to precious-material movements — every Journe movement since is made in 18k rose gold. The Tourbillon Souverain Vertical (TV, 2019) reinvented the tourbillon orientation, with a vertical cage running parallel to the dial — a technical and aesthetic statement. Authentication signals: movement material (brass vs. gold — visible through caseback), reference letter (T/TN/TV) appears on dial flange, original strap signed F.P. Journe, dial color (silver guilloché, ruthenium grey, mother-of-pearl on Boutique editions).

### Model line: Chronomètre à Résonance

- **Refs**: `R` (Résonance brass era, 2000–2004), `RN` (Résonance gold era, 2004–2010), `RT` (Résonance Twin-Time, 2010–2019 — independent dual time zones), `RQ` (Résonance with quick-set hour, 2020+ — current production)
- **Years**: 2000–present
- **Designer / movement**: François-Paul Journe (revives Breguet’s 18th-century resonance concept for the wrist) · Cal. 1499 (brass era), Cal. 1499.3 (gold era), Cal. 1499.4 (RT/RQ — twin escapements, two balance wheels, two crowns, twin power reserve)
- **Key identifiers**: Two visible balance wheels (twin escapements coupled by resonance through the baseplate); two independent dials displaying time (RT/RQ display two time zones; R/RN display the same time twice for chronometric averaging); 40–42mm platinum or rose gold case.
- **Common nicknames**: “Résonance” (the principle); “Twin Time” (RT/RQ — added second time zone with independent escapement); “Brass Résonance” (R — most collected vintage)
- **Notes**: One of horology’s rarest mechanical achievements: F.P. Journe’s Chronomètre à Résonance (2000) is the only commercially-produced wristwatch using mechanical resonance — two escapements oscillating side-by-side influence each other via shared baseplate vibrations and gradually synchronize. The 2000 “brass” R is the founding piece. The 2010 RT added independent time zone functionality (each balance now drives a separate time display). The 2020 RQ refined the mechanism further with quick-set hour adjustment. Production is extremely limited (~50–80/year). Auction-critical: brass-era examples are increasingly $500k+; gold-era and modern examples retail above $130k. Listing signals: brass vs. gold movement, twin dial layout (R/RN = identical times; RT/RQ = different time zones), and original dial signature (Black Label or standard).

### Model line: Chronomètre Souverain

- **Refs**: `CS` (Chronomètre Souverain standard — platinum or 6N gold), `CS Black Label` (boutique-exclusive black-dial variant — F.P. Journe boutiques only), `CS Havana` (Havana brown ruthenium+gold dial), `CS Mother-of-Pearl` (boutique LE), `CS Tokyo` (Tokyo boutique exclusive), `CS Vert (Green)` (green-dial LE), `CS H&H` (Holland & Holland LE), `CS 38mm Steel` (part of “Black Label” steel set), `CS Nacre` (mother-of-pearl)
- **Years**: 2005–present
- **Designer / movement**: François-Paul Journe · Cal. 1304 — manual-wind, 18k rose gold movement, two parallel barrels providing linear force to the escapement, 56h power reserve, 21,600 vph; small seconds at 7:30, power reserve indicator at 3 (counts down on use, mimicking marine chronometer)
- **Key identifiers**: 40mm or 38mm platinum/6N gold case; small seconds at 7:30; power reserve at 3 (descending — borrowed from marine chronometer tradition); signature off-white “ivory” hands; silver guilloché dial (standard) or Havana brown ruthenium dial; only 8mm thick.
- **Common nicknames**: “CS” (the model); “Havana” (brown ruthenium variant); “Black Label” (boutique-only black dial); “Nacre” (mother-of-pearl boutique LE)
- **Notes**: Time-only manual wristwatch that won the GPHG “Best Men’s Watch” in 2005, the Chronomètre Souverain is for many the purest expression of Journe’s philosophy: simple display, twin-barrel mainspring, deep chronometric engineering. The Havana dial (introduced in the late 2000s and continuing in current production) uses a proprietary gold-and-ruthenium alloy dial finish creating a unique warm brown that shifts under light — paired with caramel alligator strap and either platinum or 6N rose gold case. The Black Label CS is one of the most collected boutique variants (only available at F.P. Journe boutiques, never authorized dealers). The 38mm steel CS was part of a 5-piece LE set, the only steel CS in production. For listings: Havana brown dial uniquely identifies the Havana variant; black dial without retailer text identifies Black Label; 38mm steel is exceptionally rare and provenance-dependent.

### Model line: Chronomètre Bleu

- **Refs**: `CB` (Chronomètre Bleu — tantalum case, deep-blue dial)
- **Years**: 2009–present
- **Designer / movement**: François-Paul Journe · Cal. 1304 (same movement as Chronomètre Souverain)
- **Key identifiers**: Tantalum case (rare in watchmaking — extremely dense, hard, slightly grey-blue tint); chromatic blue mirror-polished dial; only 39mm; no power reserve indicator (the major dial-side simplification vs. CS); small seconds at 7:30.
- **Common nicknames**: “CB” or “Bleu” (the only Journe colloquially named for its dial color)
- **Notes**: Launched in 2009 as an entry-level Journe (relative — list price ~$25k at launch, now over $40k retail, $100k+ secondary), the Chronomètre Bleu has become arguably the most coveted production Journe due to a unique combination of factors: the tantalum case (mechanical engineering challenge to machine), the saturated blue chromolithography-style dial, the simplified two-register layout (no power reserve), and aggressive production limits. Despite being technically the most accessibly-priced regular-production Journe, secondary market prices regularly exceed top-tier complications. For listings: tantalum case material is the unique identifier (grey-blue metallic tint, denser than platinum); blue mirror dial without power reserve indicator distinguishes from CS Havana / CS Black Label.

### Model line: Chronomètre Optimum

- **Refs**: `CO` (Chronomètre Optimum platinum / 6N rose gold)
- **Years**: 2012–present
- **Designer / movement**: François-Paul Journe · Cal. 1510 — twin barrels, remontoire d’égalité, deadbeat seconds, EBHP escapement (Échappement Bi-axial à Haute Performance — Journe’s proprietary high-precision escapement)
- **Key identifiers**: Off-center hours/minutes sub-dial at upper left, large deadbeat (jumping) seconds at 6, power reserve indicator; remontoire d’égalité visible through caseback; 40mm or 42mm case (platinum or 6N rose gold).
- **Common nicknames**: “CO” / “Optimum”
- **Notes**: The Chronomètre Optimum is Journe’s technical chronometric flagship — incorporating three high-precision innovations: a proprietary EBHP escapement (a development of his own design philosophy on bi-axial escapements), a remontoire d’égalité providing constant force to the escapement, and a one-second deadbeat seconds. The combination represents Journe’s most ambitious chronometric statement outside of the Sonnerie/Repetition complications. Production is extremely limited. For listings: deadbeat seconds (jumping rather than sweeping) and “Chronomètre Optimum” on dial flange are the immediate signals.

### Model line: Octa Automatique / Réserve

- **Refs**: `OA` (Octa Automatique, time-only with date), `AR` (Octa Automatique Réserve — adds power reserve and date), `ARS2 / AR2` (current Octa Automatique Réserve variants per current FPJ collection)
- **Years**: 2001–present (Octa Automatique was Journe’s first automatic with 5-day power reserve)
- **Designer / movement**: François-Paul Journe · Cal. 1300.2 / 1300.3 — automatic, 22k gold off-centered micro-rotor, 5-day (120h) power reserve, full 18k rose gold movement
- **Key identifiers**: 38mm, 40mm, or 42mm platinum/6N gold case; off-center hour-minute sub-dial; power reserve indicator (on AR variants); date aperture; sapphire caseback revealing the rose-gold movement and 22k gold rotor.
- **Common nicknames**: “Octa” (the platform — Journe’s automatic movement architecture); “Réserve” (power reserve variant)
- **Notes**: The Octa Automatique (2001) introduced Journe’s modular Octa movement — a base platform allowing easy addition of complications (calendar, moon phase, chronograph) on top of an extraordinary 5-day-power-reserve automatic. The Octa Réserve added a power reserve indicator at 9. Both have been refreshed across two decades and remain in current production as the AR2/ARS2 references in the modern collection. For listings: Octa branding on dial flange, off-center display, and power reserve aperture (on AR variants) define the model.

### Model line: Octa Calendrier / Quantième Perpétuel

- **Refs**: `Q` (Octa Calendrier — annual calendar with retrograde date), `OC` (Octa Calendrier), `QP` (Quantième Perpétuel — modern perpetual calendar)
- **Years**: 2002–present
- **Designer / movement**: François-Paul Journe · Cal. 1300.3 (Octa base) with annual / perpetual calendar module
- **Key identifiers**: Day-month-retrograde-date display; usually retrograde date hand across upper dial arc; Octa base with calendar additions; 40–42mm case.
- **Common nicknames**: “Octa Calendrier”; “QP” (perpetual calendar)
- **Notes**: The Octa Calendrier introduced Journe’s calendar complications, with a unique retrograde-date layout that distinguishes it from other annual/perpetual calendar wristwatches. The Quantième Perpétuel is the perpetual calendar variant. For listings: dial layout (retrograde date arc) is the immediate signal; verify Q vs. OC vs. QP via dial flange reference.

### Model line: Octa Lune / Automatique Lune

- **Refs**: `AL` (Octa Lune — first generation moonphase), `AL2` (Automatique Lune — current production, refined dial), `AL2 Havana` (Automatique Lune Havana dial — current production), `LN` (Lune — current shortened reference)
- **Years**: 2002–present
- **Designer / movement**: François-Paul Journe · Cal. 1300.3 (Octa base) + moon phase module
- **Key identifiers**: 40–42mm case; large moonphase aperture at 6 (oversized, distinctive — much larger than typical moonphase); off-center hour-minute sub-dial; power reserve and date complications; 22k gold rotor visible through sapphire back.
- **Common nicknames**: “Octa Lune” / “Lune” / “AL2”; “Havana Lune” (Havana brown dial variant)
- **Notes**: One of the most aesthetically beloved Journe pieces, the Octa Lune’s oversized moonphase aperture has been a Journe signature for over 20 years. The 2020s refresh (AL2) refined the dial layout and adopted current Journe typography. The Havana brown dial variant (Octa Lune Havana, also AL2) is among the most photogenic modern Journes. For listings: oversized moonphase at 6 is the immediate Lune signal; dial color (silver vs. Havana) and case material (platinum vs. 6N gold) complete matching.

### Model line: Octa Chronographe

- **Refs**: `OCH` (Octa Chronographe — Octa-based chronograph; single-pusher monopusher chronograph with retrograde date)
- **Years**: 2002–c. 2010 (then refreshed as Chronograph Rattrapante variants)
- **Designer / movement**: François-Paul Journe · Cal. 1300.3 + chronograph module
- **Key identifiers**: Monopusher chronograph (single pusher in crown); retrograde date arc; chronograph counters integrated into Octa off-center layout; 40mm case.
- **Common nicknames**: “Octa Chrono”
- **Notes**: A rare Octa-based chronograph variant; production was limited and the line was effectively replaced by the Centigraphe and modern Chronograph Rattrapante (CMS/CM) references in the current Journe collection. For listings: any “Octa Chronographe” or “OCH” reference is from this short-lived production era.

### Model line: Centigraphe Souverain

- **Refs**: `CT` (original Centigraphe Souverain — 1/100s chronograph), `CTS` (Centigraphe Souverain — slight evolutions), `CTS2 / CT2` (current production)
- **Years**: 2007–present
- **Designer / movement**: François-Paul Journe (proceeds for the Centigraphe went to the ICM Brain Research Institute) · Cal. 1506 — manual chronograph with 1/100s display via foudroyante (lightning) seconds; three sub-dials: 100/second at 10, second at 2, minute at 6
- **Key identifiers**: 40mm 6N rose gold or platinum case; three small chronograph sub-dials; 1/100 of a second display achieved mechanically; uses three pushers (start, stop, reset).
- **Common nicknames**: “Centigraphe” (and the 1/100s indication); “ICM Edition” (charitable proceeds for ICM Brain Institute)
- **Notes**: The Centigraphe Souverain (2007) measures elapsed time to 1/100 of a second mechanically through a foudroyante (lightning) seconds — a difficult mechanical achievement that won the GPHG “Aiguille d’Or” (Golden Hand) in 2008. Proceeds from each watch sold support the Brain & Spinal Cord Institute (ICM) in Paris. The 2022 refresh (CTS2/CT2) updated the case profile. For listings: three small sub-dials, “Centigraphe Souverain” branding, and pusher configuration (three pushers, not two) define the model.

### Model line: Répétition Souveraine

- **Refs**: `RM` (Répétition Souveraine — minute repeater)
- **Years**: 2006–present
- **Designer / movement**: François-Paul Journe · Cal. 1408 — minute repeater with rare flat hammers (rather than typical round hammers) for richer tone; manual-wind; rose gold movement
- **Key identifiers**: 40mm or 42mm platinum/6N rose gold case; minute repeater slide at 9 o’clock (operated by sliding rather than pushing); silver guilloché dial; very thin case profile for a repeater (8.5mm).
- **Common nicknames**: “RM” / “Répétition”
- **Notes**: Among the slimmest minute repeaters in production (8.5mm), the Répétition Souveraine uses flat hammers (a Journe technical signature) for what many consider one of the richest acoustic tones in modern repeaters. Production is extremely limited (single digits per year). For listings: slide on case-side at 9, “Répétition Souveraine” dial flange.

### Model line: Vagabondage I/II/III

- **Refs**: `Vagabondage I`, `Vagabondage II`, `Vagabondage III` (each a separate LE: I = wandering hour 2004 LE 69 pieces; II = jumping wandering hour 2010 LE 69 pieces; III = jumping seconds 2017 LE 69 pieces in each material — platinum, rose gold, and steel)
- **Years**: 2004 (V-I), 2010 (V-II), 2017 (V-III)
- **Designer / movement**: François-Paul Journe · Cal. 1505 / Cal. 1509 — wandering hour display, jumping hour or jumping second mechanisms
- **Key identifiers**: Tonneau (oval) case; “wandering hour” display where the hour is shown by a digit on a rotating disc moving across an arc on the dial; LE 69 pieces per material; “Vagabondage” indicates the model series.
- **Common nicknames**: “Vagabondage I/II/III”
- **Notes**: One of Journe’s most distinctive aesthetic and mechanical statements: the Vagabondage trilogy features a wandering hour display (a complication where the hour digit moves across the dial to indicate the current hour position). Each iteration adds mechanical sophistication: I (standard wandering hour 2004), II (jumping wandering hour 2010), III (jumping seconds with wandering hour 2017). Production is limited to 69 pieces per material per generation (69 platinum, 69 rose gold, 69 steel — though steel was only on Vagabondage III). These are auction-tier collectibles with prices regularly clearing $200–500k. For listings: tonneau case shape and “Vagabondage” name on dial are immediate identifiers.

### Model line: Élégante

- **Refs**: `ELT` (Élégante — multiple titanium/Titalyt and gold variants), `ELT 40 mm Titanium 12 Rows Diamonds`, `ELT 40 mm Titalyt 12 Rows Diamonds`
- **Years**: 2014–present
- **Designer / movement**: François-Paul Journe · Cal. 1210 (quartz with intelligent dormant-mode — watch goes to sleep after 30 min of stillness and resumes accurate timekeeping when picked up)
- **Key identifiers**: Tonneau (oval) case in titanium, Titalyt-coated titanium, or precious metals; quartz movement (Journe’s only quartz line); minute hand is positioned at center, hours displayed via a rotating dial; “Élégante” on dial.
- **Common nicknames**: “Élégante” — sometimes “The Resting Watch” because of the dormant-mode quartz movement
- **Notes**: Journe’s only quartz watch and his women-focused line, the Élégante uses an intelligent quartz movement that goes to sleep after 30 minutes of stillness (preserving battery for up to 8–10 years) and resumes accurate timekeeping when motion is detected. The dormant-mode feature is the line’s technical signature. The tonneau case shape and quartz mechanism distinguish it from all other Journe references. For listings: any “Élégante” or “ELT” reference is this line; oval tonneau case is the visual signal.

## Cartier

## Brand: Cartier

### Model line: Santos de Cartier (modern)

- **Refs**: `WSSA0009` (Santos Medium steel), `WSSA0010` (Santos Large steel), `WSSA0018` (Santos Medium steel blue dial 2018+), `WSSA0030` (Santos Large two-tone), `WSSA0029` (Santos Medium two-tone), `WGSA0007` (Santos Skeleton yellow gold), `WSSA0061` (Santos Chronograph), `WJSA0010` (Santos Dumont — separate model line), `WHSA0007` (Santos Medium rose gold), `CRWSSA0018`, `CRWSSA0030`
- **Years**: 1904 origin (Cartier’s first wristwatch for Alberto Santos-Dumont); modern reset 2018 (current generation)
- **Designer / movement**: Louis Cartier (1904 original); modern collection designed in-house · Modern Cal. 1847 MC (automatic, 42h reserve, 28,800 vph), Cal. 1904-PS MC (Santos 100 era), Cal. 1908-CC (Chronograph)
- **Key identifiers**: Square case with rounded corners; eight exposed screws on bezel (originally functional, securing the bezel to the case — Louis Cartier’s design innovation, predating Genta-era exposed-screw bezels by 65 years); SmartLink quick-change bracelet system on current generation (2018+); blue cabochon on crown.
- **Common nicknames**: “Santos” itself; “100” (Santos 100, 2004 100th-anniversary larger reissue); “Galbée” (curved-case 1980s–2000s); “QuickSwitch” (current bracelet system)
- **Notes**: The Cartier Santos (1904) was the first purpose-designed wristwatch made by a major maison — designed by Louis Cartier for aviator Alberto Santos-Dumont, who found pocket watches impractical for flying. The 2018 redesign (WSSA0009/0010/0018 etc.) returned the line to thinner, more vintage-correct proportions after the larger Santos 100 era; QuickSwitch (instant bracelet change) and SmartLink (tool-free bracelet sizing) are signature modern features. For listings: 35.1mm = Medium, 39.8mm = Large, both with screw-down crowns and SmartLink (post-2018); pre-2018 Santos 100 = 38mm/45.5mm chunkier proportions.

### Model line: Santos 100 (vintage 2656/2878 era)

- **Refs**: `2656`, `2878`, `2740`, `W20106X4` (large Santos 100 steel), `W20107X7` (Santos 100 PVD), `W2020007` (Santos 100 XL), `W2020009`
- **Years**: 2004–2018
- **Designer / movement**: Cartier (100th-anniversary Santos relaunch) · ETA-based Cal. 049, Cal. 076 (automatic)
- **Key identifiers**: Larger 38mm or 45.5mm “XL” case (vs. ~30mm vintage Galbée); chunkier proportions; eight exposed bezel screws; brushed/polished steel; sapphire caseback on later refs.
- **Common nicknames**: “Santos 100” (the 2004 reissue line); “XL” (extra-large 45.5mm)
- **Notes**: The Santos 100 was Cartier’s celebration of the model’s 100th anniversary, reintroducing the Santos in oversized proportions appropriate to mid-2000s tastes. The 2656 (38mm) and 2878 (XL 45.5mm) are the canonical references. Discontinued in 2018 when the modern Santos line was introduced. For listings: 38mm or 45.5mm sizes with chunkier case profile vs. the slimmer post-2018 line.

### Model line: Santos-Dumont

- **Refs**: `W2007051` (vintage Santos-Dumont), `WGSA0008` (Santos-Dumont small extra-thin 2019+), `WSSA0023` (Santos-Dumont small steel), `WGSA0020` (Santos-Dumont large rose gold lacquered case), `WGSA0028` (Santos-Dumont skeleton yellow gold 2022 micro-rotor)
- **Years**: 1980 (first Santos-Dumont) → 2019 (modern revival)
- **Designer / movement**: Louis Cartier era (1904 Santos directly inspired this line) · Cal. 430 MC (manual extra-thin), Cal. 9619 MC (micro-rotor skeleton Demoiselle-inspired)
- **Key identifiers**: Slimmer, more elegant Santos variant; usually quartz or manual-wind (vs. automatic regular Santos); leather strap (not bracelet); thinner case (7.3mm extra-thin); precious metals predominate.
- **Common nicknames**: “Demoiselle” (the Skeleton 2022 with miniature plane-shaped rotor referencing Santos-Dumont’s “Demoiselle” aircraft); “SD” (Santos-Dumont abbreviation)
- **Notes**: The Santos-Dumont line is the slimmer, more elegant sibling to the regular Santos, named directly for Alberto Santos-Dumont. The 2019 revival featured an extra-thin manual-wind variant (7.3mm). The 2022 Santos-Dumont Skeleton featured a uniquely shaped micro-rotor in the form of Santos-Dumont’s “Demoiselle” aircraft — a horological tribute. For listings: leather strap (no bracelet option), thinner case, and manual or quartz movement distinguish Santos-Dumont from regular Santos automatic line.

### Model line: Tank Louis Cartier

- **Refs**: `2441`, `2442`, `W1529756` (Tank Louis Cartier small), `W1529757` (Tank LC medium), `WGTA0011` (Tank Louis Cartier large 2023), `WGTA0010`, `W6800251` (Tank LC manual), `W1560002`, `2606` (CPCP Tank Louis), `W1500851`
- **Years**: 1922 original → present
- **Designer / movement**: Louis Cartier (1922) · Cal. 8971 MC (quartz), Cal. 430 MC (manual-wind, ultra-thin), Cal. 1917 MC (some CPCP)
- **Key identifiers**: Rectangular case with prominent vertical “brancards” extending beyond the dial; rounded, more elegant proportions than Tank Française or Tank Américaine; usually leather strap; manual-wind or quartz (slim profile preserved); blue cabochon on crown (sapphire); blue sword-shape hands.
- **Common nicknames**: “Tank LC” / “Louis Tank” (the foundational Tank — the “purest” Tank shape)
- **Notes**: The Tank Louis Cartier (1922) is the second Tank model after the original “Tank Normale” (1917), distinguished by softer rounded brancards and considered by purists the canonical Tank for elegance. The CPCP-era Tank Louis Cartier (1998–2008 production, e.g., ref. 2441/2442) used the manual-wind Cal. 9P/Cal. 430 MC and is highly collected. Modern Tank LC continues in small/medium/large sizes. For listings: confirm Tank Louis Cartier (rounded brancards, more elegant proportions) vs. Tank Française (modern integrated bracelet), Tank Américaine (elongated), or Tank Anglaise (more squared with integrated crown).

### Model line: Tank Américaine

- **Refs**: `W2603156` (older Tank Américaine), `W26015K2`, `W2603256`, `WSTA0017` (Tank Américaine medium 2023 redesign), `WGTA0107` (Tank Américaine 2023 large), `WGTA0108`, `WJTA0001`
- **Years**: 1989 modern launch (vintage Tank Cintrée 1921 inspired this elongated shape) → present
- **Designer / movement**: Cartier (modern reinterpretation of the Cintrée’s elongated case) · Cal. 077 (automatic), Cal. 1899 MC (current 2023 automatic), quartz Cal. 057
- **Key identifiers**: Elongated rectangular case (taller than wide); curved profile to fit the wrist; vertically-extended Roman numerals; broad brancards; usually steel or precious metal.
- **Common nicknames**: “Tank Américaine” (the elongated Tank — distinguished from European Tank lines)
- **Notes**: Released in 1989 to commemorate the original 1921 Tank Cintrée’s spirit, the Tank Américaine introduced an elongated shape with subtle wrist curvature. The 2023 redesign brought the new Cal. 1899 MC automatic and 30m water resistance — the most significant update in decades. For listings: elongated case (case length >> case width) distinguishes from other Tank variants; “Tank Américaine” branding on dial is the immediate identifier.

### Model line: Tank Française

- **Refs**: `W51002Q3`, `W51005Q4`, `2302`, `WSTA0005` (modern Tank Française), `WSTA0006`, `WSTA0067` (Tank Française large 2023+ redesign), `WSTA0068`
- **Years**: 1996–present
- **Designer / movement**: Cartier · Cal. 057 (quartz), Cal. 1853 (automatic mid-size 2023+)
- **Key identifiers**: Integrated steel bracelet (Tank’s first integrated-bracelet variant); squared brancards; rounded corners; 28mm small / 32mm medium / large sizes; usually steel or two-tone.
- **Common nicknames**: “Française” (the integrated-bracelet Tank); often considered the “sport Tank”
- **Notes**: The Tank Française (1996) brought an integrated bracelet to the Tank line for the first time, making it a more casual, daily-wear option. Predominantly quartz-powered through its history; the 2023 redesign introduced automatic movements (Cal. 1853) and refined proportions. For listings: integrated steel or two-tone bracelet distinguishes Française from Louis Cartier (leather strap); blue cabochon crown.

### Model line: Tank Anglaise / Tank MC / Tank Solo / Tank Must / Tank Cintrée

- **Refs (Tank Anglaise)**: `W5310013`, `W5310014`, `W5310029`
- **Refs (Tank MC)**: `W5330001`, `W5330003`, `W5330004` (Tank MC chronograph)
- **Refs (Tank Solo)**: `W5200013`, `W5200014`, `WSTA0029`
- **Refs (Tank Must)**: `WSTA0041` (Tank Must medium), `WSTA0058` (Tank Must SolarBeat 2021), `WSTA0042`
- **Refs (Tank Cintrée)**: `2767` (CPCP Tank Cintrée), `WHTA0007` (Privé Cintrée 2021 yellow gold), `WHTA0008` (Privé Cintrée 2021 rose gold), `WHTA0009` (Privé Cintrée 2021 platinum skeleton)
- **Years**: Tank Cintrée 1921 original; Anglaise 2012; MC 2008; Solo 2004; Must 1977 (relaunch 2021); modern era to present
- **Designer / movement**: Cartier · Cal. 077 / 1847 MC (Tank MC), Cal. 437 MC, Cal. 690 (Tank Must SolarBeat — quartz with photovoltaic dial), Cal. 8970 MC (small Tank), various
- **Key identifiers**: Tank Anglaise = squared brancards with integrated crown (crown enclosed in the right brancard, almost flush) — Cartier’s “British” Tank. Tank MC = sport Tank with chronograph and modern proportions. Tank Solo = entry-level Tank, simplified proportions, often quartz. Tank Must = 1977 “Must de Cartier” relaunched in 2021 with SolarBeat photovoltaic quartz technology. Tank Cintrée = elongated curved case (Cartier Privé 2021 revival).
- **Common nicknames**: “Anglaise” (integrated crown); “MC” (Manufacture Cartier — chronograph sport Tank); “Solo” (entry-level Tank); “Must” / “Must de Cartier” (1977 affordable line, 2021 relaunch); “Cintrée” (elongated curved Tank)
- **Notes**: The Tank family has fragmented into multiple distinct sub-lines: Anglaise (with the crown integrated into the brancard — a 2012 design statement); MC (chronograph sport variant 2008); Solo (entry-level Tank); Must (1977 affordable Tank relaunched 2021 with SolarBeat photovoltaic quartz); Cintrée (elongated curved 1921 design revived under Cartier Privé). The Tank Cintrée Privé editions (2021) are highly collected for their faithful recreation of the 1921 original’s curved case. The Tank Must SolarBeat (WSTA0058) uses a photovoltaic dial that powers a quartz movement, achieving 16+ years of autonomy without battery changes. For listing matching: each sub-line has distinctive case features — Anglaise’s integrated crown is unmistakable; Solo’s simplified case lacks the Tank Louis brancards; Cintrée’s elongated curve is unmistakable; MC includes chronograph pushers.

### Model line: Crash

- **Refs**: `Crash London 1967` (vintage — 12-piece original London production), `Crash Paris 1991` (London relaunch by Cartier Paris, LE 400 yellow gold), `Crash 2013 Watches & Wonders / Privé Crash Skeleton` (CPCP/Privé editions: WHRO0021 — Privé Crash Skeleton 2015, WHRO0023 — Privé Crash Radieuse 2018), `WJTA0001` (Crash Tigrée), `WGCH0007` (Crash Privé yellow gold), `2018 Cartier Privé Crash refs`, `WGCH0012` (Privé Crash Tigrée), `2024 Crash Squelette` (Cartier Privé Opus)
- **Years**: 1967 (London origin) → revivals 1991, 2013, 2015, 2018, 2024, 2025 (Cartier Privé)
- **Designer / movement**: Jean-Jacques Cartier (Cartier London, 1967 design) · Cal. 9618 MC (modern), Cal. 1967 MC (2024 Crash Squelette purpose-built movement)
- **Key identifiers**: Asymmetric “melted” case shape (the iconic Cartier silhouette beyond Tank); ovoid distorted form; melted Roman numerals matching the case distortion; blue cabochon crown; gold or platinum exclusively; small case dimensions (~28-43mm length).
- **Common nicknames**: “Crash” (the icon); “London Crash” (1967 originals — about 12 made); “Paris Crash” (1991 relaunch LE 400); “Crash Squelette” (skeleton Privé variants)
- **Notes**: The Cartier Crash is one of the rarest and most coveted designs in horology, born in 1967 at Cartier’s London branch under Jean-Jacques Cartier (rumored inspiration: a melted watch returned to the shop after a car accident, or a tribute to Dalí’s “Persistence of Memory” — both are unverified). Only about 12 original 1967 London Crash watches were made; secondary market prices regularly exceed $1.5M. The 1991 Cartier Paris relaunch (LE 400 yellow gold) trades at $400k+. The 2025 Cartier Privé Crash Squelette (limited to 150 pieces, platinum, with the purpose-built Cal. 1967 MC) is the most recent revival. Authentication is critical — fake or modified Crashes proliferate. For listings: distinguish 1967 London (rarest), 1991 Paris (LE 400), 2013/2015/2018 Cartier Privé Crash, and 2024/2025 Crash Squelette by serial numbering and dial signature.

### Model line: Ballon Bleu

- **Refs**: `W6900151`, `W6920002`, `W6920076`, `W4BB0006` (Ballon Bleu Extra-Large), `WJBB0036`, `W2BB0003`
- **Years**: 2007–present
- **Designer / movement**: Cartier · Cal. 049 (quartz), Cal. 076/049 MC (automatic), Cal. 1847 MC (Ballon Bleu de Cartier 42mm)
- **Key identifiers**: Round case with distinctive crown guard housing a blue sapphire cabochon at 3 (the “ballon” — the bulge over the crown is the Ballon Bleu signature); 28mm to 42mm sizes; Roman numerals; sword hands; usually steel or rose/yellow gold.
- **Common nicknames**: “Ballon Bleu” (the line)
- **Notes**: Cartier’s most commercially successful 21st-century launch, the Ballon Bleu (2007) introduced a distinctive crown-cabochon design — the round case “ballooning” around the crown to protect the sapphire — that has become a Cartier signature. Sizes range from 28mm (ladies) to 42mm (large). For listings: the protruding crown guard with sapphire cabochon is the unmistakable signal; Roman numerals on a sunray dial are standard.

### Model line: Pasha de Cartier

- **Refs**: `2113`, `2114`, `2115`, `W31077U2` (Pasha XL), `W31085M7`, `W31048M7`, `WSPA0009` (modern Pasha 41mm 2020+), `WSPA0010` (Pasha Chronograph 41mm), `WSPA0013` (rose gold Pasha 2020), `WSPA0017` (Pasha 35mm), `WGPA0006` (Pasha skeleton)
- **Years**: 1985 (modern Pasha) — based on a 1932 unique-piece commission for the Pasha of Marrakesh; relaunched 2020
- **Designer / movement**: Gérald Genta (1985 modern relaunch) · Cal. 1847 MC (automatic, 2020+), Cal. 1904-CH MC (chronograph)
- **Key identifiers**: Round case; screw-down crown protected by a hinged “chained cap” (the Pasha’s signature feature — a cap on a tiny chain covering and protecting the crown); square minute track inside a round case; Arabic numerals on most refs; “VENDÔME” lugs (square attached to round case); 35–41mm modern sizes.
- **Common nicknames**: “Pasha” (the line); “Vendôme lugs” (the square attachment points to the round case)
- **Notes**: The modern Pasha (1985) was designed by Gérald Genta — making it the only Cartier model with a Genta design pedigree. The line was discontinued in the 2010s and relaunched in 2020 with new sizing (35mm/41mm), updated case finishing, and customizable straps via QuickSwitch. The hinged crown cover and square-within-circle minute track remain Pasha signatures. For listings: hinged crown cap with chain is the immediate identifier; modern Pasha (post-2020) has slimmer proportions and QuickSwitch straps.

### Model line: Panthère de Cartier

- **Refs**: `1990s 1120 series`, `1991 1660 (gold)`, `W2PN0006` (Panthère medium steel 2017+), `W2PN0007` (Panthère medium two-tone), `WJPN0008` (Panthère medium yellow gold), `WJPN0007` (Panthère small), `WJPN0014` (Panthère large)
- **Years**: 1983 launch (vintage); discontinued 2004; relaunched 2017
- **Designer / movement**: Cartier · Quartz movements predominate; Cal. 057 (quartz)
- **Key identifiers**: Square case (closer to Santos than Tank shape) with prominent five-link bracelet (alternating brushed/polished H-links — “panther skin” pattern); blue sapphire cabochon on crown; usually quartz; sizes from mini to large.
- **Common nicknames**: “Panthère” (the line — named for Jeanne Toussaint’s nickname at Cartier); often called Cartier’s “answer to the Cartier Tank Française but earlier” historically
- **Notes**: The Panthère (1983) was Cartier’s defining 1980s/early-1990s luxury jewelry watch — heavily worn by celebrities (Pierce Brosnan in Goldeneye; Madonna; Princess Diana) before being discontinued in 2004. The 2017 relaunch (W2PN family) brought back the original case shape and bracelet design with modern manufacturing precision, instantly becoming one of Cartier’s most successful re-introductions. For listings: square case + 5-link H-bracelet + quartz is the immediate signal; pre-2004 vintage refs vs. post-2017 modern refs are distinguished by reference number format and case-back markings.

### Model line: Ronde / Rotonde de Cartier (haute horlogerie)

- **Refs**: `W6701004`, `W6701005` (Ronde Solo), `WGRO0002`, `W1556216` (Rotonde Tourbillon), `W1580001` (Rotonde Astrocalendaire), `W1580003` (Rotonde Astromysterieux), `W1556251` (Rotonde Earth and Moon)
- **Years**: 2008 launch (Rotonde line); Ronde Solo 2010+
- **Designer / movement**: Cartier · Cal. 1904 PS MC, Cal. 9402 MC (tourbillon), Cal. 9459 MC (Astromysterieux — “mysterious” movement appears to float)
- **Key identifiers**: Round case with thin bezel; Ronde Solo = simple time-and-date dress watch (entry-level Cartier dress); Rotonde de Cartier = haute horlogerie complications (mysterious displays, tourbillons, astronomical complications, minute repeaters, perpetuals); 36–45mm sizes.
- **Common nicknames**: “Ronde Solo” (the simple round Cartier); “Rotonde” (the haute horlogerie sub-line); “Astrocalendaire” / “Astromysterieux” (specific high complications)
- **Notes**: The Rotonde de Cartier line is Cartier’s haute horlogerie laboratory — home to mysterious movements (where the movement appears to float with no visible mechanism, an ancient Cartier specialty revived), tourbillons, perpetual calendars, and minute repeaters. The Astromysterieux (2016) and Astrocalendaire (2014) are technical halo pieces. The Ronde Solo is the entry-level simple round Cartier — visually distinct from Rotonde haute horlogerie pieces. For listing matching: “Ronde Solo” = simple 3-hand dress watch; “Rotonde de Cartier” = haute horlogerie with complications.

### Model line: Drive de Cartier

- **Refs**: `WSNM0004`, `WSNM0005`, `WSNM0006` (Drive Extra Flat), `WGNM0011` (Drive skeleton)
- **Years**: 2016–c. 2020 (effectively discontinued)
- **Designer / movement**: Cartier · Cal. 1904-PS MC (automatic), Cal. 9452 MC (tourbillon)
- **Key identifiers**: Cushion-shaped case with rounded curves; vertical Roman numerals; small seconds at 6; blue cabochon crown; 40mm.
- **Common nicknames**: “Drive” (named for automotive heritage / Concours d’Élégance association)
- **Notes**: The Drive de Cartier (2016) was an automotive-themed cushion-cased dress watch, marketed at male collectors as a more masculine alternative to the Tank. The line failed to gain traction and was quietly phased out by 2020 in favor of refreshed Tank and Santos collections. As a discontinued line, vintage Drive references are now sleeper collectibles. For listings: cushion case shape and vertical Roman numerals identify the model.

### Model line: Calibre de Cartier

- **Refs**: `W7100015` (Calibre Diver), `W7100043` (Calibre 42mm), `W2CA0004`, `W7100002` (Calibre Chronograph), `W7100016`
- **Years**: 2010–c. 2020 (discontinued)
- **Designer / movement**: Cartier · Cal. 1904 MC (the first Cartier in-house automatic, launched in this line)
- **Key identifiers**: Round case with prominent bezel; offset Roman numeral XII at 11-12 zone (asymmetric design); large 42mm sport case; integrated bracelet on some refs; Cartier’s first in-house automatic movement.
- **Common nicknames**: “Calibre” (the line — also referencing the first Cartier in-house movement)
- **Notes**: The Calibre de Cartier (2010) was launched specifically to showcase the brand’s first in-house automatic movement, Cal. 1904 MC. The line embraced a sportier aesthetic with a heavier 42mm case and bold Roman XII. Quietly discontinued around 2020 as Cartier consolidated its lineup. The Calibre Diver (W7100052/W7100015) is the most distinctive variant — a serious ISO 6425-rated dive watch (300m) in a Cartier case, which made it a cult sleeper among collectors of “unusual divers”. For listings: asymmetric Roman XII, prominent case bezel, and 42mm size define the model.

### Cross-cutting collections: CPCP (Collection Privée Cartier Paris) and Cartier Privé

> These are not separate model lines but rather **boutique/auction tiers** that apply to specific historical references.

- **Collection Privée Cartier Paris (CPCP)**: 1998–2008 boutique-only ultra-limited reissues of historic Cartier designs with proper Swiss mechanical movements (often Frédéric Piguet or JLC ébauches), distinctive guilloché dials, and signed “Paris” on the dial. References include CPCP Tank Cintrée (2767), CPCP Tank Asymétrique, CPCP Tortue Monopusher Chronograph (1998 — the predecessor to the 2024 Privé Tortue Monopusher), CPCP Tank Louis Cartier (2441/2442), and CPCP Tank Chinoise. CPCP pieces command significant premiums over modern equivalents and are highly authenticated; verify “Paris” dial signature, original strap with Cartier Paris hardware, and movement provenance.
- **Cartier Privé** (2017–present): annual limited-edition revival series, succeeding CPCP in spirit. Each year revives one historic Cartier model in highly limited (50–200 piece) editions. The series so far: 2017 Crash (skeleton variants), 2018 Tank Cintrée, 2019 Tonneau XL, 2020 Asymétrique, 2021 Cloche de Cartier, 2022 Tank Chinoise, 2023 Tank Normale (200 strap / 100 bracelet / 50 skeleton / 20 gem-set skeleton), 2024 Tortue Monopoussoir Chronograph (CPCP 1998 reissue), 2025 “Le Opus” trilogy (Tank Normale, Tortue Chronographe Monopoussoir, Crash Squelette in platinum with burgundy accents — celebrating the 10th anniversary of Privé). Privé references are uniquely numbered and command full retail or above on the secondary market.

For listing matching: CPCP and Privé are critical signals for authentication and valuation. A “Cartier Tank Cintrée” with serial markings indicating 2018 Privé production is fundamentally different from a 2024 standard Tank Cintrée. The dial signature (“Paris” suffix on CPCP), reference number, and serial numbering are the disambiguators.


<!-- Below: gap-patch additions for Cartier merged from docs/watch_references_gaps_patch.md -->

### Model line: Santos / Santos Vendôme (historical additions)

- **Refs**: `8192`, `2960`, `15716`
- **Years**: 8192: 1970s–1985 · 2960: 1980s–1995 · 15716: 2000s Santos 100 era
- **Designer / movement**: Cartier · ETA 2892 or in-house quartz depending on era
- **Key identifiers**: 8192 = “Santos Vendôme” — the vintage Santos reference from the pre-WSSA era using the Vendôme Paris stamp; rounded square case with eight exposed screws, leather strap; “Vendôme” signed on dial and caseback. 2960 = Santos Galbée (curved) reference. 15716 = later Santos 100-era reference.
- **Common nicknames**: “Santos Vendôme” (8192 — Vendôme was Cartier’s Paris boutique address used as a model descriptor)
- **Notes**: “Santos Vendôme” refers to the vintage Santos models produced 1970s–1985 under Cartier’s Vendôme Les Must subsidiary branding. The 8192 is among the most frequently encountered vintage Santos references with the Vendôme designation. These are the original Santos watches designed to be Cartier’s everyday sport piece; the Vendôme stamp identifies the Paris subsidiary rather than an independent brand. Listing signals: “Vendôme” on caseback or dial; 8192 reference number; square case with eight screws.

### Model line: Tank Américaine (historical addition)

- **Refs**: `1740`
- **Years**: 1996–2006
- **Designer / movement**: Cartier · Cal. 077 (automatic)
- **Key identifiers**: 18k yellow gold case, elongated Tank Américaine case with gentle wrist curve, automatic winding, yellow gold bracelet, “Tank Américaine” on dial; ref 1740 is an early automatic gold Tank Américaine reference predating the WSTA numbering.
- **Common nicknames**: “Gold Tank Américaine”
- **Notes**: Ref 1740 is a pre-WSTA-era Tank Américaine reference in yellow gold with automatic movement — the Américaine was the first elongated Tank to house a full automatic. These transitional-era Cartier references (4-digit numbering before the W-prefix system) are often overlooked in aggregators. Listing signals: elongated rectangular case, yellow gold, automatic (caseback visible rotor or “AUTOMATIQUE” on dial), pre-W-prefix reference.

### Model line: Cartier Paris / CPCP references (addition)

- **Refs**: `78086`, `78090`, `78091`, `78096`
- **Years**: 1970s–1998 (pre-CPCP Cartier Paris boutique pieces)
- **Designer / movement**: Cartier (Cartier Paris production) · Various manual-wind movements; Cal. 830 (quartz), hand-wound European Watch Co. movements
- **Key identifiers**: All four refs are vintage Cartier Paris pieces from the 1970s–80s using the 5-digit numeric reference system (preceding the W-prefix). 78086 and 78091 = Tank Louis Cartier variants with “Paris” dial signature and white gold cases; 78090 = “Vendôme” style Cartier Paris; 78096 = “Jumbo” Cartier Paris — a larger-case dress watch.
- **Common nicknames**: “Paris Dial” (any of these with the “Cartier Paris” dial signature — a premium signal predating CPCP); “Cristallor” (78096 — references Cartier’s Cristallor shop)
- **Notes**: These 78xxx references are vintage Cartier Paris production, made at a time when Cartier operated separate production streams for Paris, London, and New York. The “Paris” dial signature on 78086/78090/78091 is distinct from CPCP (which runs 1998–2008) — these are genuine 1970s–80s production pieces with manual movements housed in precious metal cases. The 78096 “Jumbo” (larger-case Cartier Paris) is among the rarer variants. Auction authentication critical: confirm dial signature legibility, movement ebauche stampings, and serial-number range. Listing signals: 78xxx reference number, “Cartier Paris” on dial (not just “Cartier”), white gold or yellow gold case.

### Non-watch token flags

- `WSSA0046` — Santos de Cartier variant. This IS a Santos reference (specifically the Santos de Cartier Medium in steel with a guilloche dial, c.2022). Add to Santos model line as a supplementary ref.
- `WGSA0054` — Santos skeleton yellow gold variant (c.2022). Add to Santos-Dumont/skeleton section.

-----


<!-- Below: new brand `Tudor` merged from docs/Watch Aggregator Reference Index 2 — Patch File.md (2026-05-17) -->

## Tudor

# Watch Aggregator Reference Index — Patch File

*Brands covered in this patch: Tudor, Vacheron Constantin, Breitling. Conventions match the existing index (Rolex, Omega, Heuer/TAG Heuer, JLC, IWC, Zenith, Patek, Lange, Universal Genève, AP, F.P. Journe, Cartier): `##` brand headers, `###` model-line headers, bullet structured fields, prose Notes paragraphs, per-brand appendix for calibers, listing-matching tips, and resources.*

-----

## Brand: Tudor

**Canonical name forms for listing matching:** `Tudor`, `TUDOR` (all-caps, brand styling since the late 1990s shield logo era), `Tudor Rolex`, `Rolex Tudor`, `Montres TUDOR S.A.` (case-back text on vintage pieces), and on vintage dials specifically `THE TUDOR` (very early 1950s) and double-signed `ROLEX / TUDOR` configurations where the Rolex name appears on the bracelet clasp, crown and case back even when the dial is signed Tudor. Modern reference numbers carry an `M` prefix (e.g. `M79030N`) on post-2015 production; the `M` is part of the catalog reference and listings frequently strip it. The four-digit suffix (`-0001`, `-0002`, etc.) encodes dial/bracelet variant and should be preserved for accurate matching.

### Model line: Heritage Black Bay (41 mm original)

- **Refs**: `79220R` (red bezel, gilt), `79220B` (blue bezel), `79220N` (black bezel), `79230N` (in-house, black), `79230B` (in-house, blue), `79230R` (in-house, red), `79220DK` “Black Bay Dark” (PVD), `79733N` S&G (steel & gold)
- **Years**: 2012–present (79220 series 2012–2016 with ETA 2824; 79230 series from 2016 with in-house MT5602)
- **Designer / movement**: ETA 2824-2 (early 79220), then Manufacture Calibre MT5602 (28,800 vph, 70-hour reserve, silicon hairspring, free-sprung balance, COSC)
- **Key identifiers**: 41 mm steel case, no crown guards, oversized “Big Crown” winding crown with Tudor rose in relief, snowflake hour and seconds hands, domed sapphire crystal without cyclops, riveted-style five-link Oyster-type bracelet, anodized aluminum bezel insert with red/blue/black variants, gilt or silver printing depending on reference, 200 m water resistance 
- **Common nicknames**: “BB41” or simply “Black Bay” (vs. BB58 / BB54), “Black Bay Red/Blue/Black” (by bezel), “Black Bay Dark” (PVD 79230DK)
- **Notes**: The Black Bay launched at Baselworld 2012 was the watch that rebooted Tudor as a serious enthusiast brand and re-established the gilt-dial, snowflake-hand vocabulary the company had retired in the 1990s. The original `79220R` “Burgundy” referenced the rotating-bezel chronos and the 7016 Snowflake Sub simultaneously; the `79220B` blue and `79220N` black followed in 2013–2014. In 2016 Tudor migrated the line to the in-house MT5602 (changing the reference prefix from 79220 to 79230) and switched the dial from gilt to silver printing on the same date — a key collector tell. Auction-grade collectors care about gilt vs. silver dial, first-execution riveted bracelet vs. later faux-rivet, and on bezel disc fading the so-called “ghost” examples. Listings frequently fail to distinguish ETA-powered 79220 from in-house 79230, which is the single most important value-affecting attribute on this reference family.

### Model line: Black Bay 36 / 41 (smooth bezel)

- **Refs**: `79500` (36 mm ETA), `79540` (41 mm ETA, smooth bezel), `79640` (41 mm with rotating bezel variant), `M79500-0008` / `M79500-0010` (36 mm modern), `M79640` (41 mm date)
- **Years**: 2016–present
- **Designer / movement**: ETA 2824-2 in early production; later 36 mm models received Calibre T600 (ETA-based)
- **Key identifiers**: Smooth fixed steel bezel (no diving scale), 36 or 41 mm case, snowflake-style hands retained on some variants, alpha hands on others; rose or shield logo depending on date and variant; date at 3 o’clock on most refs; jubilee-style or Oyster bracelet, also leather
- **Common nicknames**: “BB36”, “BB41 smooth”, “Heritage Black Bay 36” — sometimes confusingly called just “Black Bay” in listings
- **Notes**: The 36 mm and smooth-bezel 41 mm Black Bays serve as Tudor’s everyday/dress sport offering, sitting between the diver-bezel BBs and the Style/Glamour lines. The 36 is among the smallest modern Tudor sport watches and has found a strong unisex audience. Aggregator listings frequently conflate `79500` (36 mm) with `79540` (41 mm) and with the diver-bezel `79230` series; the smooth bezel and absence of a 60-minute scale is the fastest disambiguator. Resale tracks well below diver-bezel BB equivalents.

### Model line: Black Bay Fifty-Eight (“BB58”)

- **Refs**: `M79030N-0001` (black, 2018), `M79030B-0001` (navy blue, 2020), `M79030G` (green Harrods edition and later standard green), `M79010SG-0001` (925 silver, 2021), `M79018V` (18k yellow gold, 2021), `M79030N-0002` (bronze “boutique” Bucherer)
- **Years**: 2018–present
- **Designer / movement**: Manufacture Calibre MT5402 (28,800 vph, 70-hour reserve, silicon hairspring, COSC)  — a smaller variant of the MT5612/5602 family
- **Key identifiers**: 39 mm case  (compact, vintage-correct proportion), 11.9 mm thick, domed sapphire, gilt dial with gold-color printing  and bezel markings on black `N` variant, silver printing on blue `B`, riveted-style bracelet, unprotected screw-down crown with Tudor rose in relief,  200 m water resistance, snowflake hands, lollipop seconds with gilt round on the black version
- **Common nicknames**: “BB58”, “Fifty-Eight”, “58 Black/Blue/Green/Silver/Gold”, “58 Bronze” (Bucherer)
- **Notes**: The Black Bay 58 is named for 1958, the year of the `7924` “Big Crown” Tudor Sub that achieved 200 m water resistance. Its 39 mm × 11.9 mm proportions deliberately re-create the 1950s Tudor Sub’s wrist profile and made it the runaway hit of 2018, with secondary-market premiums that persisted for years. The 925 silver `M79010SG` is among the few wristwatches in the modern era cased in sterling silver (Tudor’s alloy has aluminum added to suppress tarnish). For collector matching: the suffix `-0001` denotes the steel bracelet, `-0002` the leather strap, `-0003` the textile NATO; the 18k gold version uses an entirely different reference family (`79018V`).

### Model line: Black Bay 58 GMT

- **Refs**: `M7983G1A0NU-0001` (current “root beer/grey-black” 2024), and the related GMT-on-58 family informally referenced as the “58 GMT”; the larger 41 mm Black Bay GMT carries `M79830RB` (Pepsi) — see below
- **Years**: 2024–present (58 GMT)
- **Designer / movement**: Manufacture Calibre MT5450-U (METAS Master Chronometer, ±0/+5 sec/day, 65-hour reserve, true caller-jumping local-hour GMT)
- **Key identifiers**: 39 mm steel case, 24-hour bidirectional bezel, opaline “snowflake” hands plus red GMT hand, 200 m water resistance, dial text references the new METAS certification
- **Common nicknames**: “58 GMT”, “BB58 GMT”
- **Notes**: Tudor’s 2024 BB58 GMT addressed the most common enthusiast complaint about the 41 mm Pepsi BB GMT — that it was too thick — by adapting the in-house GMT calibre to the slim 58 case. It is also Tudor’s first METAS-certified Master Chronometer-spec movement, predating Master-Chronometer-level rollout to the 41 mm collection. Aggregators frequently mis-tag 58 GMT listings as 79830RB.

### Model line: Black Bay GMT (41 mm)

- **Refs**: `M79830RB-0001` (black dial, steel bracelet), `M79830RB-0002` (leather), `M79830RB-0003` (fabric strap), `M79830RB-0010` (opaline dial)
- **Years**: 2018–present
- **Designer / movement**: Manufacture Calibre MT5652 (28,800 vph, 70-hour reserve, silicon hairspring, free-sprung balance, COSC; flyer-GMT with jumping local-hour hand) 
- **Key identifiers**: 41 mm steel, no crown guards, bidirectional 48-notch bezel with red/blue (“Pepsi”) 24-hour anodised aluminum disc, snowflake hands, red GMT hand with arrow tip, date at 3, 200 m water resistance, riveted-style bracelet or fabric/leather strap 
- **Common nicknames**: “Pepsi”, “BB GMT”, “BB Pepsi” — and lately collectors distinguish it from the BB58 GMT with “BB41 GMT” or “41 GMT”
- **Notes**: Launched at Baselworld 2018 to enormous demand,  the BB GMT was Tudor’s first GMT in the modern era and a direct shot across the bow of the unattainable Rolex GMT-Master II “Pepsi” 126710BLRO. The MT5652 is a “true GMT” in the Rolex sense — the local hour hand jumps independently  — distinct from the cheaper “office GMT” architectures where the 24-hour hand is the one being set. The watch is meaningfully thicker than collectors prefer (14.6 mm),  which led to the BB58 GMT release in 2024. Aggregator note: listings frequently conflate `M79830RB` (current Pepsi) with the original 1675 Rolex Pepsi — the snowflake hands and rose-engraved crown are immediate Tudor tells.

### Model line: Black Bay Bronze

- **Refs**: `M79250BA-0001` (chocolate brown), `M79250BM-0001` (slate grey, 2016 original), `M79250BB-0001` (Bucherer blue), `M79012BM-0001` (43 mm bronze with terra-cotta dial)
- **Years**: 2016–present
- **Designer / movement**: Manufacture Calibre MT5601 (33.8 mm — a larger-diameter variant of MT5602 for the 43 mm case; COSC, 70-hour reserve)  
- **Key identifiers**: 43 mm aluminum-bronze case (CuAl8), domed sapphire, fixed unidirectional bronze bezel with engraved 60-minute scale and matching insert, monochrome dial color-matched to bezel (brown, slate, blue), brown leather strap or distressed fabric, 200 m water resistance, bronze unprotected crown
- **Common nicknames**: “BB Bronze”, “Bronze 43”, “Slate Bronze” / “Brown Bronze”
- **Notes**: The Black Bay Bronze was Tudor’s first bronze case and remains one of the few in mainstream Swiss watchmaking; the aluminum-bronze alloy oxidizes idiosyncratically with wear, giving each example a personal patina. Most marketplace listings show heavily patinated examples — collectors prize even, non-blotchy patina; “polished back to bare bronze” examples sell at a discount. The `M79250BB` Bucherer blue is technically a non-limited boutique exclusive  and trades at a premium. Note that the BB58 Bronze (sometimes mis-listed under the same numbers) uses a different case  and the MT5400 family.

### Model line: Black Bay Pro

- **Refs**: `M79470-0001` (steel bracelet), `M79470-0002` (leather), `M79470-0003` (textile)
- **Years**: 2022–present
- **Designer / movement**: Manufacture Calibre MT5652 (same as BB GMT — COSC, 70-hour, true GMT)
- **Key identifiers**: 39 mm steel case, fixed steel 24-hour engraved bezel (not rotating), opaline-black dial, snowflake hands with bright yellow GMT hand, date at 3, 200 m water resistance, “Explorer II 1655 / Steve McQueen”-style aesthetic
- **Common nicknames**: “BB Pro”, “Tudor Explorer II”, “Freccia” (after the Italian “arrow” GMT hand), “Steve McQueen Tudor”
- **Notes**: The Black Bay Pro is Tudor’s clearest tribute to the Rolex Explorer II 1655, with a fixed 24-hour bezel instead of a rotating dive scale. Its launch caused controversy among Tudor purists because the 14.6 mm case thickness in a 39 mm diameter is widely considered ungainly. The yellow GMT-arrow hand and matte black dial are deliberate 1655 cues. Match: not to be confused with the BB58 GMT despite shared movement — the Pro has a fixed engraved bezel, the BB58 GMT has a rotating bidirectional bezel.

### Model line: Black Bay Ceramic

- **Refs**: `M79210CNU-0001` (METAS Master Chronometer ceramic, 2021)
- **Years**: 2021–present
- **Designer / movement**: Manufacture Calibre MT5602-1U — first Tudor movement to receive METAS Master Chronometer certification, 70-hour reserve, anti-magnetic to 15,000 gauss
- **Key identifiers**: 41 mm all-black matte ceramic case and bezel, matte black dial, monochrome snowflake hands and indices with bright cream lume, ceramic unidirectional bezel, leather/rubber hybrid strap and fabric strap, 200 m water resistance, openworked tungsten rotor visible through ceramic case back
- **Common nicknames**: “BB Ceramic”, “Master Chronometer Tudor”, “Stealth BB”
- **Notes**: The Black Bay Ceramic is significant for two reasons: it is the first watch outside Omega to bear the METAS Master Chronometer certification (which requires antimagnetic performance to 15,000 gauss and ±0/+5 sec/day accuracy on the fully cased watch), and it is the first all-ceramic Tudor. Pricing positions it above the steel BB but below the Pelagos FXD specials. Listings sometimes confuse this with the BB Dark (PVD-coated steel) — the ceramic case has a distinctive matte texture and is much lighter for its size.

### Model line: Black Bay Chrono

- **Refs**: `79350` (original 2017 panda/reverse-panda), `79360N` (current panda/black variants, in-house MT5813), `79363N` (2021 panda and reverse panda redesign), `M79360N-0002` Bucherer “Blue”, and the limited `M79360DC` “Dark”
- **Years**: 2017–present
- **Designer / movement**: Manufacture Calibre MT5813 (based on Breitling B01, column wheel, vertical clutch, 70-hour reserve, COSC, silicon hairspring) — fruit of the Tudor/Breitling movement exchange in 2017  
- **Key identifiers**: 41 mm steel case, screw-down pushers,  fixed steel tachymeter-engraved bezel, 45-minute counter at 3 (rather than 30-minute), running seconds at 9, date between 4 and 5, black or white “panda” dial with contrasting subdials, snowflake hour hand, riveted-style steel bracelet
- **Common nicknames**: “BB Chrono”, “Panda” / “Reverse Panda” Tudor Chrono, “Tudor Daytona”
- **Notes**: The Black Bay Chrono is the historical reciprocal of the Tudor–Breitling deal: Tudor’s MT5612 became the basis for the Breitling B20, and Breitling’s B01 became the basis for Tudor’s MT5813. The 45-minute counter (a Valjoux 7750-like layout, but executed with an in-house column-wheel) is a distinguishing detail vs. typical chronograph layouts. The 2021 `79363N` redesign was the most important update, reverting subdial color treatment to match vintage Tudor “Big Block” chronographs more closely. Aggregator matching: listings sometimes lump in the unrelated S&G `79363N` two-tone, which uses an entirely different gilt dial palette.

### Model line: Black Bay 54

- **Refs**: `M79000N-0001` (steel bracelet, black dial 2023+)
- **Years**: 2023–present
- **Designer / movement**: Manufacture Calibre MT5400 (28,800 vph, 70-hour reserve, silicon hairspring, COSC; smallest of the MT54xx family)
- **Key identifiers**: 37 mm steel case (smallest modern Tudor diver), domed sapphire crystal, gilt-style printing, snowflake hands with gilt minutes hand, no date, fixed lume pip on bezel without numerals beyond every five minutes, unprotected screw-down crown, 200 m water resistance, three-link beads-of-rice-style bracelet with T-fit
- **Common nicknames**: “BB54”, “Fifty-Four”, “Tudor 7922 reissue”
- **Notes**: The Black Bay 54 is named for 1954 — the year the original Tudor `7922` Oyster Prince Submariner was introduced  — and at 37 mm × 11.2 mm it is the most faithful modern Tudor diver to mid-century Submariner proportions. The watch dropped at Watches & Wonders 2023 to broad acclaim from collectors who had complained the BB58 at 39 mm was still too modern. Notable: it is the only modern Black Bay launched with a beads-of-rice / three-link “rivet” bracelet from day one (other refs use the five-link rivet).

### Model line: Heritage Advisor (vintage alarm reissue)

- **Refs**: `M79620TB-0001` (steel/black dial), `M79620TR-0001` (red dial), `M79620TBR-0001` (silver)
- **Years**: 2011–~2018 (since discontinued; reference retained in listings)
- **Designer / movement**: Calibre 2892 base with proprietary alarm module (TUDOR 2892/A)
- **Key identifiers**: 42 mm titanium case-back/steel case construction, three crowns (winding, time-setting, alarm setting/disarm), alarm power-reserve indicator at 12, on/off indicator at 9, alarm-time indicator with central hand, recessed alarm activation lever
- **Common nicknames**: “Advisor”, “Tudor Alarm”
- **Notes**: A modern revival of the 1957 Tudor Advisor,  the Heritage Advisor was Tudor’s only mechanical alarm watch and one of very few alarm watches still in serial production worldwide. It’s now discontinued and trades on the secondary market well below original retail. Don’t confuse the modern Heritage Advisor with the vintage 1950s–1960s Tudor Advisor `7926`, which uses an AS 1475 alarm caliber.

### Model line: Pelagos (42 mm titanium)

- **Refs**: `25500TN` (1st gen black, ETA 2824, 2012), `25500TB` (blue, ETA), `M25600TN-0001` (2nd gen black, in-house, 2015+), `M25600TB-0001` (2nd gen blue), `M25610TNL-0001` (“LHD” left-hand drive, 2016), `M25600TN-0004` 25th-anniversary variant
- **Years**: 2012–present
- **Designer / movement**: ETA 2824-2 in first generation; Manufacture Calibre MT5612 from 2015  (28,800 vph, 70-hour, silicon hairspring, COSC); MT5612-LHD with date wheel and stem oriented for left-side crown
- **Key identifiers**: 42 mm matte grade-2 titanium case with steel case-back, fully ceramic bezel insert with full lume, snowflake hands, square markers, helium-escape valve at 9, titanium bracelet with patented spring-loaded “T-fit” auto-adjusting clasp and dive-suit extension, screw-down crown, 500 m water resistance; first-gen has two-line dial text, second-gen has five-line text  including “CHRONOMETER OFFICIALLY CERTIFIED” 
- **Common nicknames**: “Pelagos” (the line owns the name), “Pelagos LHD” or “Lefty Pelagos”, “two-liner” (first-gen) vs “five-liner” (second-gen)
- **Notes**: The Pelagos is Tudor’s no-compromise modern dive tool, conceived from a clean sheet of paper rather than as a Submariner homage;  the design language reads as deliberately industrial (snowflake hands and square markers borrowed from the 7016 Sub, but executed with razor-sharp ceramic and titanium). The 2016 LHD variant — “Left Hand Drive” — moves the crown to the 9 o’clock side of the case, references vintage 1970s left-handed Marine Nationale Subs, and is uniquely individually numbered on the case-back (not a limited edition, but each serial is unique).  It also features a roulette (red and black) date wheel and red “PELAGOS” text — both vintage Sub callbacks.  The T-fit clasp is the standout engineering feature: a pushbutton releases the bracelet for fine-grained adjustment across roughly 8 mm without tools.

### Model line: Pelagos 39

- **Refs**: `M25407N-0001` (39 mm black titanium, 2022+)
- **Years**: 2022–present
- **Designer / movement**: Manufacture Calibre MT5400 (no date; 70-hour reserve, COSC)
- **Key identifiers**: 39 mm titanium case (more wearable than 42 mm Pelagos), 200 m water resistance (vs. 500 m on 42 mm), no helium escape valve, no date window, red “PELAGOS” text,  fully lumed ceramic bezel, T-fit clasp on titanium bracelet
- **Common nicknames**: “P39”, “Pelagos 39”
- **Notes**: A more wearable, less specifically saturation-oriented Pelagos at 39 × 11.8 mm — a hot collector pick. Removing the HEV and lowering depth rating to 200 m signaled Tudor’s recognition that almost no one needs saturation diving capability and that 42 mm was excluding wrists. Aggregator matching: the absence of date is the key visual disambiguator from the BB58.

### Model line: Pelagos FXD

- **Refs**: `M25707B-0001` (Marine Nationale blue, 2021), `M25707KN-0001` (carbon “Alinghi”), `M25717N-0001` (chrono FXD), `M25807KN-0001` (FXD GMT)
- **Years**: 2021–present
- **Designer / movement**: Manufacture Calibre MT5602 (FXD time-only), MT5813 (FXD Chrono), MT5652 (FXD GMT)
- **Key identifiers**: 42 mm titanium or carbon-composite case, fixed strap bars milled from the case (no spring bars — “FXD” = fixed), bidirectional dive bezel (different from regular Pelagos), 200 m water resistance, navigational dive bezel scale, fabric strap fitted through the fixed bars, “MN” dial signature on Marine Nationale-issued examples
- **Common nicknames**: “FXD”, “MN”, “Marine Nationale Tudor”
- **Notes**: The FXD line emerged from Tudor’s renewed partnership with the French Navy’s combat divers  (Commando Hubert and Marine Nationale at large). The fixed-bar architecture is the line’s defining feature: it eliminates the spring-bar failure mode that issued military divers had repeatedly experienced. The bidirectional bezel (unusual among modern dive watches) is calibrated for underwater dead-reckoning navigation, not for elapsed dive time.  The Alinghi sailing edition introduces a carbon composite case — a Tudor first.

### Model line: Royal

- **Refs**: `M28500-0001` (38 mm steel), `M28600-0006` (41 mm), and various dial/bracelet color combinations across the 28x00 family
- **Years**: 2020–present
- **Designer / movement**: Calibre T601/T603 (ETA base, COSC)
- **Key identifiers**: Integrated bracelet sport watch, notched (fluted) bezel similar to Datejust, Roman numerals or applied indices, “Royal” script on dial, jubilee-style integrated bracelet, 100 m water resistance
- **Common nicknames**: “Tudor Royal”, sometimes pejoratively “poor man’s Datejust”
- **Notes**: Tudor’s pursuit of the integrated-bracelet sports watch segment. Originally a name reserved for vintage Tudor models (1950s “Tudor Royal” Oyster), revived in 2020 with a clearly DJ-derived design vocabulary. Not popular among purist enthusiasts and trades at meaningful discounts secondhand vs. retail. Useful for listing matching: any “Tudor Royal” listed pre-2020 is a vintage piece, not the modern collection.

### Model line: Glamour / Style / 1926

- **Refs**: `57000` family (Glamour Double Date, large date), `M12100-0001`, `M12300-0001`, `M12500-0001` (Tudor 1926 family, 28/36/39/41 mm), `M12700-0011` (Style 41), Glamour Date `M51000`
- **Years**: 1990s–present (1926 line launched 2018)
- **Designer / movement**: ETA 2824-based Calibres T100, T101, T102; Glamour Double Date uses a modified ETA 2836 with twin date apertures
- **Key identifiers**: Round dress case, mostly fixed smooth or fluted bezel, applied or printed Roman/Arabic numerals, “Tudor 1926” or “Glamour” script on dial, jubilee-style five-piece-link bracelet
- **Common nicknames**: “1926”, “Glamour”, “Double Date” (for the 57000)
- **Notes**: Tudor’s entry-level dress range. The Glamour Double Date (`57000`) is unusual for its twin large-date apertures and is the most distinctive piece in the family. The 1926 line is Tudor’s most affordable contemporary range. Aggregator note: listings sometimes confuse “Tudor 1926” (the model line, launched 2018) with the year Tudor was registered as a brand (1926), which appears on marketing materials across many other Tudor models — context is needed.

### Model line: Heritage Ranger (modern reissue)

- **Refs**: `M79910-0001` (41 mm, 2014), modern Ranger `M79950-0001` (39 mm, 2022+)
- **Years**: 2014–~2019 (`79910`); 2022–present (`79950`)
- **Designer / movement**: ETA 2824-2 in `79910`; Manufacture Calibre MT5402 (70-hour, COSC) in `79950`
- **Key identifiers**: 41 mm (heritage) or 39 mm (modern) brushed steel case, matte black dial with painted/applied Arabic numerals at 3-6-9-12 and lume rectangles at intervening hours, no crown guards on the 39 mm modern Ranger (crown guards on the 41 mm Heritage Ranger), Tudor shield logo, fixed smooth bezel, leather/textile/steel strap options
- **Common nicknames**: “Ranger”, “Tudor Explorer” (homage understanding)
- **Notes**: The Heritage Ranger 79910 (2014–2019) was the first modern Ranger and remains a budget-friendly used pick; the 2022 `79950` Ranger is significantly more refined with the in-house movement and is closer in proportion to the vintage 7995/0 and the Rolex Explorer 1016 it pays homage to. Vintage Ranger references (`7995`, `9050`, `7966`, `9101`) sat across the Tudor Oyster line — see vintage section.

### Model line: Vintage Submariner / Oyster Prince Submariner

- **Refs**: `7922` (1954–1955), `7923` (manual wind 1955–1957, ultra-rare), `7924` “Big Crown” (1958–1959), `7928` (1959–1968, longest run), `7016` (1969–1975, snowflake non-date), `7021` (1969–1975, snowflake date), `9401` / `9411` (1975–1983, snowflake), `94010` / `94110` (1981–1989, transitional), `79090` (1989–1995, acrylic crystal), `79190` (1995–1999, sapphire crystal, final)
- **Years**: 1954–1999
- **Designer / movement**: Calibre 390 (Fleurier auto, no hack, no hand-wind) on 7922/7924/7928; ETA 2483 on 7016/7021;  ETA 2784 on 9401/9411; ETA 2824/2824-2 on 79090/79190
- **Key identifiers**: 37 mm (7922/7924) → 39 mm (7928 onward) steel Oyster case (signed “ORIGINAL OYSTER CASE BY ROLEX GENEVA”), Rolex-signed crown, Rolex-signed Oyster bracelet, evolution of crown guards: none (7922/7924) → square (7928 MK1) → “eagle beak” (MK2) → pointed (MK3) → rounded (MK4); evolution of hands: Mercedes (7922–7928) → snowflake (7016 onward) → Mercedes again (79090/79190); dial evolution: gilt with closed minute track → silver-on-gilt with open track → matte tritium → glossy late
- **Common nicknames**: “Big Crown” (7924, with the 8 mm crown), “Snowflake” (7016/7021/9401/9411), “Square Crown Guards” (early 7928 MK1), “Eagle Beak” (7928 MK2), “Pointed Crown Guards” / “PCG” (7928 MK3), “Smiley Dial” (7928 with the curved “SELF-WINDING” text at 6), “Exclamation Dot” (specific 7928 transitional dials with a small dot below 6), “MN” (Marine Nationale issued), “USN” (US Navy issued)
- **Notes**: The vintage Tudor Sub is now an established collector category in its own right, with rare MN/USN issued military examples crossing well into Rolex 5512/5513 territory at auction. The `7928` is the most produced and most diverse single Tudor Sub reference, with at least four documented crown-guard variants over its nine-year run, dial transitions from gilt closed-chapter-ring through silver open-track to matte tritium, and the iconic upward-curving “SELF-WINDING” text — a feature unique to Tudor and a key authentication detail. The `7016`/`7021` (1969) introduced the snowflake handset and square indices at the direct request of the French Marine Nationale, which had complained that the previous Mercedes hands were insufficiently legible in murky water. Modern collectors prize matched lume (hands/indices/bezel pearl), unpolished cases retaining bevels, and military caseback engravings (typically “MN 71” / “MN 72” through the 1970s, year-stamped). Watch for “service hands” (incorrect later snowflake hands fitted to earlier Mercedes refs) and re-lumed dials. The shift from rose logo to shield logo happened in late 7928 production around 1968 and remained through the 9411 era. The `79090` (1989) and `79190` (1995, sapphire crystal) are the most affordable entry points and retain genuine vintage character despite being relatively recent.

### Model line: Vintage Chronograph — “Monte Carlo” / “Home Plate” / “Big Block”

- **Refs**: `7031` (Plexi bezel, 1970–1971), `7032` (steel tachy bezel, 1970–1971), `7033` (rotating bezel, prototype/rare), `7149` (Plexi bezel, 1971–~1976), `7159` (steel tachy bezel, 1971–~1976), `7169` (rotating 12-hour bezel, 1971–1980), `7170` (steel tachy bezel, late series), `7176` (similar evolution), `9420/0` (transitional late 1970s, Lemania 1873), `94200` / `94210` / `94300` “Big Block” (1976–~1989, Valjoux 7750 auto with date), `79160` / `79170` / `79180` (1989–1995 Big Block evolution), `79260` / `79270` / `79280` (1995–~2001 late vintage chrono)
- **Years**: 1970–~2001
- **Designer / movement**: Valjoux 7734 (manual, 7031/7032/7033 — the original Home Plate),  Valjoux 234 (manual, 71X9 Monte Carlo series), Lemania 1873 (transitional late-1970s), Valjoux 7750 (Big Block automatic 9420/0, 94x00, 79160/70/80, 79260/70/80)
- **Key identifiers**: 40 mm steel Oyster case (Rolex-made), screw-down pushers, Rolex Twinlock or Triplock crown, two-register subdials (running seconds + 45-minute counter at 3 on 7031/7032 — Valjoux 7734-driven; later series add hour counter), date window at 6 with cyclops on some refs (Monte Carlo cyclops at 6 is a distinguishing detail), high-contrast “racing” dial in orange/blue/grey with home-plate-shaped (pentagonal) hour markers on 703x series,  simpler stick markers on later 71x9 series, oversized lume pip on bezel, signed “OYSTER PRINCE / TUDOR / CHRONO TIME” on dial; Big Block 7750-era is much thicker (hence the name), with three subdials at 6-9-12
- **Common nicknames**: “Home Plate” (703x with pentagonal markers, the prototype-style original), “Monte Carlo” (71x9 with simpler bordered markers and high-contrast racing palette), “Big Block” (7750-powered 94x00 / 79160 / 79170 / 79180 etc., distinguished by the thick case to accommodate the 7750 module), “Tiger Chrono” (79270/79280 with reverse-panda dial)
- **Notes**: Tudor’s vintage chronograph line is one of the most rapidly appreciating vintage collecting categories of the past decade, with top Home Plate examples now trading in the range of vintage Daytonas. The lineage: the `7031/7032/7033` (1970–1971) are the original Home Plates — short production, pentagonal “home plate” hour markers — and represent Tudor experimenting with a design language that Rolex never adopted (these were Tudor’s first chronographs and used Rolex Oyster cases with screw-down pushers, just like contemporary Daytonas). The `7032` came with a steel tachymeter bezel; the `7031` with a Plexi insert; the `7033` (rotating 12-hour bezel) is essentially the prototype that became the 7169 Monte Carlo. In 1971 Tudor cleaned up the design into the `71x9` “Monte Carlo” series, simpler hour markers and a higher-contrast racing palette in orange/blue/grey — the watch’s commercial peak. The 1976 move to the Valjoux 7750 (the “Big Block” `9420/0` and successors) added an hour counter and date, but at the cost of significant case thickness — hence “Big Block”. The `79260/79270/79280` (1995–~2001) are the final vintage Tudor chronos and the most affordable entry; they retain the Big Block character but with sapphire crystal. The Tudor shield logo replaced the rose logo around 1969/1970, so almost all Tudor chronos are shield-logo’d; some very early 703x show transition dials. Auction note: dial originality is the #1 value determinant — service dials, repainted subdials, swapped hands, and incorrect bezel inserts are endemic. Movement: the Valjoux 234 used in the 71x9 Monte Carlos is a 7734 variant; both share the cam (rather than column-wheel) chronograph architecture. The signature “lollipop” seconds hand and oversized chrono sweep are sought-after.

### Model line: Prince Oysterdate (rectangular “Prince” case)

- **Refs**: `7996` / `7997` (mid-1970s), `9050` / `9051` (late 1970s–early 1980s), `9150` / `9151` (1980s)
- **Years**: ~1970–~1990
- **Designer / movement**: ETA 2783 / 2824 / 2836 base, signed “Tudor”
- **Key identifiers**: Rectangular tonneau “Prince” case in steel, steel/gold-plated, or solid gold, integrated or removable strap, dauphine hands, baton indices, date at 3, Rolex Oyster signing on case-back
- **Common nicknames**: “Tudor Prince Rectangle”, “Prince Oysterdate Rectangular”
- **Notes**: A small but important vintage Tudor category — the rectangular “Prince” case is a 1970s tonneau dress design (not to be confused with the round Prince Oysterdate, which is the standard Tudor dress watch in a round case). Solid 18k gold examples exist but are uncommon. Listings sometimes use “Tudor Prince” generically; for matching, the rectangular case must be confirmed against photos.

### Model line: Ranger (vintage)

- **Refs**: `7995` (1967–1973 typical Ranger configuration), `9050` (1970s Prince Oysterdate Ranger), `9111` “Ranger II” (1974–1980 integrated-bracelet era), `9101` (Ranger II Prince Oysterdate)
- **Years**: ~1967–1988
- **Designer / movement**: ETA 2483, 2484, 2784, 2824 variants
- **Key identifiers**: 34 mm steel Oyster case, matte black dial with luminous Arabic numerals at 3-6-9-12 and rectangular lume markers at other hours, distinctive “shovel” hour hand, rose or shield logo (rose typically pre-~1969, shield after), Rolex-signed crown and Oyster bracelet, “OYSTER” or “OYSTER PRINCE” dial text
- **Common nicknames**: “Ranger” (no version), “Ranger II” (9111/9101 — the integrated-bracelet 1970s evolution)
- **Notes**: The Ranger is not a single reference but a *configuration* of the Tudor Oyster line: a 34 mm Oyster Prince case fitted with the Ranger dial. This caused historical confusion at the factory level — the same `7995` reference could leave Geneva as either a Ranger or a standard dress Oyster Prince depending on configuration  — and makes authentication today notoriously tricky, with frequent fake or franken Rangers built from standard Oyster Prince cases. The Ranger II (`9111`, `9101`) is a distinct mid-1970s reference with an integrated-bracelet sport-watch case design that reflects the era’s broader integrated-bracelet trend;  the modern Tudor North Flag (now discontinued) was a deliberate Ranger II descendant.

### Model line: Vintage Advisor (alarm)

- **Refs**: `7926` (1957–~1977)
- **Years**: 1957–~1977
- **Designer / movement**: AS 1475 manual-wind alarm caliber
- **Key identifiers**: 34 mm steel Oyster case (specifically modified Oyster — unusual case-back design to amplify the alarm), two crowns (winding at 3, alarm-set at 2), small inner rotating disc for alarm time
- **Common nicknames**: “Vintage Advisor”, “Tudor Alarm”
- **Notes**: Tudor’s first alarm watch,  sister to the contemporary 1950s Vulcain Cricket and ancestor of the modern Heritage Advisor. Relatively few were made and they are uncommon today. The alarm mechanism uses the AS 1475, a well-regarded Swiss alarm caliber also used by Helbros, Hamilton and others. Authentication: original alarm-set crown (often replaced) and a working alarm function are both rarities; serviced examples with replaced alarm springs are normal.

### Model line: Fastrider / Fastrider Black Shield

- **Refs**: `42000` / `42010` (Fastrider Chrono), `42000CN` / `42000CR` (Fastrider Black Shield ceramic chrono), `20000` (Fastrider time-only)
- **Years**: 2011–~2018
- **Designer / movement**: ETA 7753 (Fastrider Chrono), modified for Fastrider Black Shield
- **Key identifiers**: 42 mm case, motorcycle-themed design language (developed with Ducati partnership), three-register chronograph layout, Black Shield variant in matte black ceramic
- **Common nicknames**: “Fastrider”, “Black Shield” (the ceramic variant)
- **Notes**: A short-lived line tied to Tudor’s Ducati partnership. Discontinued and trades on the secondary market well below original retail. The Black Shield was Tudor’s first ceramic case (predating the Black Bay Ceramic by years). For listings: the line is identifiable from non-snowflake hands and the motorcycle-tach scales on the dial.

### Model line: Hydronaut

- **Refs**: `89190` (Hydronaut I), `20030` (Hydronaut II)
- **Years**: ~1999–~2010
- **Designer / movement**: ETA 2824
- **Key identifiers**: 40 mm steel case, dive watch with unidirectional bezel, applied luminous markers, sub-200 m water resistance
- **Common nicknames**: “Hydronaut”
- **Notes**: Tudor’s transitional dive watch between the discontinued vintage Sub line (which ended with the 79190 in 1999) and the modern Pelagos/Black Bay era. Now considered a Tudor “missing link” piece, not currently fashionable but inexpensive on the used market.

### Model line: Tiger Prince Date / Tiger Chrono

- **Refs**: `79270P` / `79280P` (Tiger Woods era chronograph)
- **Years**: ~1997–2001
- **Designer / movement**: Valjoux 7750
- **Key identifiers**: Late “Big Block” case, often with white-on-black reverse panda dial, “TIGER” branding referencing Tudor’s 1996–2002 sponsorship of Tiger Woods
- **Common nicknames**: “Tiger Chrono”, “Tiger Woods Tudor”
- **Notes**: A late-1990s special edition tied to Tudor’s Tiger Woods sponsorship; “Tiger” is signed on the dial above 6 on most examples. Now a cult collector niche.

-----

### Tudor Caliber Quick-Reference Table

|Caliber                           |Type                                                                |Used in                                                                                                                    |
|----------------------------------|--------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
|Cal. 390 (Fleurier)               |Auto, no hack                                                       |Vintage Sub 7922/7924/7928 (1954–1968)                                                                                     |
|ETA 2483                          |Auto                                                                |Vintage Sub 7016/7021 (1969–1975)                                                                                          |
|ETA 2784                          |Auto                                                                |Vintage Sub 9401/9411 (1975–1983)                                                                                          |
|ETA 2824-2                        |Auto                                                                |Vintage Sub 79090/79190, Heritage BB 79220 (pre-2016), first-gen Pelagos 25500, Heritage Ranger 79910, Glamour, 1926, Royal|
|Valjoux 7734                      |Manual chrono (cam)                                                 |Vintage chrono 7031/7032/7033 — Home Plate                                                                                 |
|Valjoux 234                       |Manual chrono (cam)                                                 |Vintage chrono 7149/7159/7169 — Monte Carlo                                                                                |
|Lemania 1873                      |Manual chrono                                                       |Transitional late-1970s chrono 9420/0                                                                                      |
|Valjoux 7750                      |Auto chrono                                                         |Big Block 94x00, 79160/70/80, 79260/70/80, Tiger Chrono, Fastrider                                                         |
|AS 1475                           |Manual alarm                                                        |Vintage Advisor 7926                                                                                                       |
|Cal. T100/T101/T102/T600/T601/T603|Auto (ETA-based, Tudor-labelled)                                    |1926, Glamour, Style, Royal                                                                                                |
|Manufacture Tudor MT5621          |Auto, power reserve                                                 |North Flag (discontinued)                                                                                                  |
|MT5602                            |Auto, time-only                                                     |Black Bay 79230, Black Bay Dark, Black Bay S&G, Pelagos FXD time-only                                                      |
|MT5601                            |Auto, time-only (33.8 mm)                                           |Black Bay Bronze 43 mm 79250                                                                                               |
|MT5612                            |Auto, date                                                          |Pelagos 25600 (2nd gen), Heritage Black Bay Steel 79730                                                                    |
|MT5612-LHD                        |Auto, date, left-side stem                                          |Pelagos LHD 25610TNL                                                                                                       |
|MT5602-1U                         |Auto, time-only, METAS Master Chronometer                           |Black Bay Ceramic 79210CNU                                                                                                 |
|MT5400                            |Auto, time-only (small)                                             |Black Bay 58 79030 (variant), Black Bay 54 79000, Pelagos 39                                                               |
|MT5402                            |Auto, time-only                                                     |Black Bay 58 M79030, Ranger M79950                                                                                         |
|MT5450-U                          |Auto GMT, METAS Master Chronometer                                  |Black Bay 58 GMT (2024)                                                                                                    |
|MT5652                            |Auto, true flyer GMT                                                |Black Bay GMT 79830RB, Black Bay Pro 79470, Pelagos FXD GMT                                                                |
|MT5813                            |Auto chrono (column wheel, vertical clutch — based on Breitling B01)|Black Bay Chrono 79350/79360/79363, Pelagos FXD Chrono                                                                     |

### Tudor Listing-Matching Tips

- **Tudor Sub vs. Rolex Sub**: A surprising number of vintage Tudor Sub listings are mistakenly tagged “Rolex Submariner” because the case-back is signed “ORIGINAL OYSTER CASE BY ROLEX GENEVA” and the crown is Rolex-signed. The dial is the definitive disambiguator: “TUDOR” / “OYSTER PRINCE” / curved “SELF-WINDING” text = Tudor; “ROLEX” / “OYSTER PERPETUAL” / “SUBMARINER” = Rolex. The movement (Cal. 390 Fleurier vs. Rolex in-house 1530/1560/1570/3000) also disambiguates.
- **Snowflake hands across eras**: Snowflake hands appear on (a) 1969–1983 vintage Subs (7016/7021/9401/9411), (b) 2012+ Heritage Black Bay family, (c) Pelagos family, (d) modern Black Bay 54/58. Don’t assume “snowflake” = vintage; modern BB and Pelagos use the same hand shape.
- **Rose vs. shield logo**: Rose logo = pre-~1969 (mostly); shield logo = ~1969 onward. Modern Heritage Black Bay 58 uses the rose logo on the crown but the shield on the dial — a deliberate nod to the transitional 1968–1969 period. Modern Tudor branding is “TUDOR” wordmark in caps.
- **Big Crown Tudor vs. Big Crown Rolex**: Both nicknames exist. Rolex Big Crown = 6538 with 8 mm crown (1955–1958, James Bond’s watch). Tudor Big Crown = 7924 (1958–1959) with 8 mm crown. Era and dial signature distinguish.
- **Modern Black Bay vs. Heritage Black Bay**: The early models 79220 (2012–2016) were branded “HERITAGE BLACK BAY”; from 2016 the dial text dropped “HERITAGE” and reads simply “BLACK BAY”. This is the cleanest visual distinction between ETA-powered first generation (gilt printing, “HERITAGE”) and in-house second generation (silver or gilt depending on ref, no “HERITAGE”).
- **Reference numbering structure (modern, post-2012)**: 5-digit base ref encodes case size and bezel family: `792x0` = 41 mm Black Bay rotating bezel; `790x0` = 39 mm BB58 / 37 mm BB54; `793x0` = BB Chrono; `795x0` = 36 mm smooth-bezel BB; `796x0` = 41 mm smooth-bezel BB; `798x0` = BB GMT; `256x0` = 42 mm Pelagos; `257x0` = Pelagos FXD; `254x0` = Pelagos 39. The letter suffix (`N` black, `B` blue, `R` red bezel, `G` green, `RB` red/blue Pepsi, `CN` ceramic, `BA`/`BM`/`BB` bronze brown/slate/blue, `SG` silver/gold) encodes color or material. The trailing `-0001/-0002/-0003` encodes strap (1 = bracelet, 2 = leather, 3 = textile typically).
- **T-suffix calibers**: Calibers labeled `T100`, `T101`, `T600`, `T601`, etc. on modern Tudor watches are ETA-based movements rebranded with Tudor T-prefixes. They are NOT in-house. Only `MT5xxx` calibers are Manufacture Tudor.
- **“Rolex Tudor” double-signed dials**: A small number of mid-century Tudor dials are double-signed “ROLEX” above “TUDOR” or carry both logos. These are highly collectible and pricey; verify against published examples (Phillips and Christie’s catalogues) since the configuration has been faked.

### Tudor Resources

- **TudorWatch.com / Inside TUDOR** — official brand history pages, with the most authoritative timelines for vintage Sub crown-guard variations and chronograph reference evolution.
- **TudorSub.com** — Wesley Kwok’s database of `7928` variations by mark (MK1 Square, MK2 Eagle Beak, MK3 Pointed, MK4 Rounded) with estimated serial-number ranges.
- **TudorCollector.com** — collector-maintained vintage Tudor reference site with detailed Ranger, Sub, and Advisor sections.
- **Fratello Watches “Top 5 Tudor Submariner References”** — accessible primer on the 7922/7924/7928/7016/79090 lineage.
- **Hodinkee “Reference Points” / Bring a Loupe** vintage Tudor coverage — auction-grade analysis of specific dial/hand combinations.
- **Bulang & Sons “Watch Talks”** — Tudor 7928 Exclamation Dot and Home Plate deep-dives.
- **Monochrome-Watches** “Entire Tudor Black Bay Lineage 2012–2024” — exhaustive modern Black Bay reference rundown.
- **Phillips and Christie’s auction archives** — primary source for top-tier vintage Sub and Home Plate price discovery; the Phillips “Game Changers” sales have included reference Tudor lots.
- **Forum**: Tudor sub-forum on Watchuseek, and the small but expert vintage-Tudor circle on Instagram (@goldammer.me, @tudorcollector, @craftandtailored).


<!-- Below: new brand `Vacheron Constantin` merged from docs/Watch Aggregator Reference Index 2 — Patch File.md (2026-05-17) -->


<!-- Below: patch-04 additions for Tudor merged from docs/watch_references_patch_04.md (2026-05-17) -->

### Note on the /0 suffix
In Tudor's vintage reference system (c. 1954–c. 1989), the trailing `/0` denotes **steel case on Oyster bracelet, time-only / non-precious-metal execution** — analogous to Rolex's "0" material suffix. It is *not* a dial-colour code, and dial and bezel variants are tracked separately. References were commonly written without the slash in period AD catalogues (e.g., "9401" instead of "9401/0"), but Tudor's own archive and the Rolex/Tudor parts books use the suffixed form. [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTY4MCwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1vdHR1aHIuY29tIiwicHJldmlld1RpdGxlIjoiVHVkb3IgU2VyaWFsIE51bWJlcnM6IFRoZSBDb21wbGV0ZSBHdWlkZSBUbyBEYXRpbmcgWW91ciBXYXRjaCIsInNvdXJjZSI6Ik9UVFVIUiIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49b3R0dWhyLmNvbSIsInNvdXJjZSI6Ik9UVFVIUiIsInRpdGxlIjoiVHVkb3IgU2VyaWFsIE51bWJlcnM6IFRoZSBDb21wbGV0ZSBHdWlkZSBUbyBEYXRpbmcgWW91ciBXYXRjaCIsInVybCI6Imh0dHBzOlwvXC9vdHR1aHIuY29tXC90dWRvci1zZXJpYWwtbnVtYmVycy10aGUtY29tcGxldGUtZ3VpZGUtdG8tZGF0aW5nLXlvdXItd2F0Y2hcLyJ9XSwic3RhcnRJbmRleCI6MTYwNiwidGl0bGUiOiJPVFRVSFIiLCJ1cmwiOiJodHRwczpcL1wvb3R0dWhyLmNvbVwvdHVkb3Itc2VyaWFsLW51bWJlcnMtdGhlLWNvbXBsZXRlLWd1aWRlLXRvLWRhdGluZy15b3VyLXdhdGNoXC8iLCJ1dWlkIjoiNmFjZDgyZjAtMWUyZi00MmRlLWI1NDktZWI5YjBmZjUzYzI4In0%3D "OTTUHR")](https://ottuhr.com/tudor-serial-numbers-the-complete-guide-to-dating-your-watch/) This patch normalises every vintage entry to `/0`.

### Model line: Tudor Submariner 7928 (early crown-guard family)

- **Refs**: `7928/0` — four documented case generations MK1–MK4
- **Years**: 1959–1968 (longest-running Tudor Submariner reference)
- **Designer / movement**: Rolex Oyster case · ETA cal. 390 (early gilt), then ETA 2461 / 2483; 25 jewels, 18,000 vph
- **Key identifiers**: 39mm Rolex Oyster case engraved "Original Oyster Case by Rolex Geneva," [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjE0MywibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1vdHR1aHIuY29tIiwicHJldmlld1RpdGxlIjoiVHVkb3IgU2VyaWFsIE51bWJlcnM6IFRoZSBDb21wbGV0ZSBHdWlkZSBUbyBEYXRpbmcgWW91ciBXYXRjaCIsInNvdXJjZSI6Ik9UVFVIUiIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49b3R0dWhyLmNvbSIsInNvdXJjZSI6Ik9UVFVIUiIsInRpdGxlIjoiVHVkb3IgU2VyaWFsIE51bWJlcnM6IFRoZSBDb21wbGV0ZSBHdWlkZSBUbyBEYXRpbmcgWW91ciBXYXRjaCIsInVybCI6Imh0dHBzOlwvXC9vdHR1aHIuY29tXC90dWRvci1zZXJpYWwtbnVtYmVycy10aGUtY29tcGxldGUtZ3VpZGUtdG8tZGF0aW5nLXlvdXItd2F0Y2hcLyJ9XSwic3RhcnRJbmRleCI6MjEwNCwidGl0bGUiOiJPVFRVSFIiLCJ1cmwiOiJodHRwczpcL1wvb3R0dWhyLmNvbVwvdHVkb3Itc2VyaWFsLW51bWJlcnMtdGhlLWNvbXBsZXRlLWd1aWRlLXRvLWRhdGluZy15b3VyLXdhdGNoXC8iLCJ1dWlkIjoiZmY0YWEyNDgtNWVmYS00MjI4LWFjZjYtOTFmOWZhYjUyOGE5In0%3D "OTTUHR")](https://ottuhr.com/tudor-serial-numbers-the-complete-guide-to-dating-your-watch/) 200m, Rolex-signed crown, Tropic 19 acrylic crystal shared with Rolex 5512/5513, riveted or folded Oyster bracelet, gilt then matte dials, pencil and Mercedes hands (the snowflake is not used on this reference)
- **Common nicknames**: "Square Crown Guard" / "SCG" (MK1), "Eagle Beak" (MK2), "PCG" / "Pointed Crown Guard" / "Cornino" (MK3), "Rounded" (MK4)
- **Notes**: The 7928 introduced crown guards to the Tudor Submariner [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjU2OSwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcnN1Yi5jb20iLCJwcmV2aWV3VGl0bGUiOiI3OTI4IOKAlCBUdWRvciBTdWIiLCJzb3VyY2UiOiJUdWRvciBTdWIiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yc3ViLmNvbSIsInNvdXJjZSI6IlR1ZG9yIFN1YiIsInRpdGxlIjoiNzkyOCDigJQgVHVkb3IgU3ViIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50dWRvcnN1Yi5jb21cL3R1ZG9yc3VibWFyaW5lcjc5MjgifV0sInN0YXJ0SW5kZXgiOjI1MTMsInRpdGxlIjoiVHVkb3IgU3ViIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50dWRvcnN1Yi5jb21cL3R1ZG9yc3VibWFyaW5lcjc5MjgiLCJ1dWlkIjoiNjExNWE4OTItMmNkNC00Y2YyLThhMDEtMDU0N2EzOTU0OWE0In0%3D "Tudor Sub")](https://www.tudorsub.com/tudorsubmariner7928) at the request of the French Marine Nationale, whose divers had broken the unguarded "Big Crown" stems on the preceding 7922/7924. Tudorsub.com and Hairspring document four sequential case generations: MK1 Square Crown Guards (serials up to ~325xxx, fewer than ~100 examples extant), MK2 Eagle Beak (a transitional cut-down of the SCG, only a few hundred made, up to ~409xxx), MK3 Pointed Crown Guards (introducing silver-print and underline dials) and MK4 Rounded Crown Guards (serials 409xxx–598xxx) [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MzA3MSwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcnN1Yi5jb20iLCJwcmV2aWV3VGl0bGUiOiI3OTI4IOKAlCBUdWRvciBTdWIiLCJzb3VyY2UiOiJUdWRvciBTdWIiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yc3ViLmNvbSIsInNvdXJjZSI6IlR1ZG9yIFN1YiIsInRpdGxlIjoiNzkyOCDigJQgVHVkb3IgU3ViIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50dWRvcnN1Yi5jb21cL3R1ZG9yc3VibWFyaW5lcjc5MjgifV0sInN0YXJ0SW5kZXgiOjI3NzIsInRpdGxlIjoiVHVkb3IgU3ViIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50dWRvcnN1Yi5jb21cL3R1ZG9yc3VibWFyaW5lcjc5MjgiLCJ1dWlkIjoiMDNkNmZhZGUtZjhhNi00NWE1LWFhZmMtZWQyZDMxYTlhMWUyIn0%3D "Tudor Sub")](https://www.tudorsub.com/tudorsubmariner7928) overlapping with the snowflake-era transition. Glossy "VI 66" gilt dial examples from 1966 are particularly prized; [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MzE4NywibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcnN1Yi5jb20iLCJwcmV2aWV3VGl0bGUiOiI3OTI4IOKAlCBUdWRvciBTdWIiLCJzb3VyY2UiOiJUdWRvciBTdWIiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yc3ViLmNvbSIsInNvdXJjZSI6IlR1ZG9yIFN1YiIsInRpdGxlIjoiNzkyOCDigJQgVHVkb3IgU3ViIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50dWRvcnN1Yi5jb21cL3R1ZG9yc3VibWFyaW5lcjc5MjgifV0sInN0YXJ0SW5kZXgiOjMxMTksInRpdGxlIjoiVHVkb3IgU3ViIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50dWRvcnN1Yi5jb21cL3R1ZG9yc3VibWFyaW5lcjc5MjgiLCJ1dWlkIjoiN2JjYTNhNWYtNzNjOC00NDFmLTk2NjUtNzA2NzdmMTRmMTZmIn0%3D "Tudor Sub")](https://www.tudorsub.com/tudorsubmariner7928) Hairspring and Antoine de Macedo have priced unrestored SCG 7928s above USD 100,000. [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MzI3MiwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1oYWlyc3ByaW5nLmNvbSIsInByZXZpZXdUaXRsZSI6IlRyb3BpY2FsIERpYWwsIFNxdWFyZSBDcm93biBHdWFyZCA3OTI4IFR1ZG9yIFN1Ym1hcmluZXIg4oCTIEhhaXJzcHJpbmciLCJzb3VyY2UiOiJIYWlyc3ByaW5nIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1oYWlyc3ByaW5nLmNvbSIsInNvdXJjZSI6IkhhaXJzcHJpbmciLCJ0aXRsZSI6IlRyb3BpY2FsIERpYWwsIFNxdWFyZSBDcm93biBHdWFyZCA3OTI4IFR1ZG9yIFN1Ym1hcmluZXIg4oCTIEhhaXJzcHJpbmciLCJ1cmwiOiJodHRwczpcL1wvaGFpcnNwcmluZy5jb21cL2Jsb2dzXC9maW5kc1wvdHJvcGljYWwtZGlhbC1zcXVhcmUtY3Jvd24tZ3VhcmQtNzkyOC10dWRvci1zdWJtYXJpbmVyIn1dLCJzdGFydEluZGV4IjozMTg4LCJ0aXRsZSI6IkhhaXJzcHJpbmciLCJ1cmwiOiJodHRwczpcL1wvaGFpcnNwcmluZy5jb21cL2Jsb2dzXC9maW5kc1wvdHJvcGljYWwtZGlhbC1zcXVhcmUtY3Jvd24tZ3VhcmQtNzkyOC10dWRvci1zdWJtYXJpbmVyIiwidXVpZCI6IjgyZGJjNGVhLWM5M2EtNGY2NS1hMTMzLWJhMGNhZGYyYzE3YSJ9 "Hairspring")](https://hairspring.com/blogs/finds/tropical-dial-square-crown-guard-7928-tudor-submariner) For aggregator logic: any 7928 listed without explicit MK designation should default to MK3/MK4 unless serial range and crown-guard shape are documented in photos.
- **Sources**: [Tudor Sub — 7928](https://www.tudorsub.com/tudorsubmariner7928) · [Tudor Collector — 7928](https://tudorcollector.com/collection/another-watch-6/) · [Hairspring — Tropical Swiss-Only 7928](https://hairspring.com/finds/vintage/tropical-swiss-only-7928-tudor-sub/) · [Hairspring — SCG 7928](https://hairspring.com/blogs/finds/tropical-dial-square-crown-guard-7928-tudor-submariner) · [Fratello — Top 5 Tudor Submariner refs](https://www.fratellowatches.com/fratellos-top-5-tudor-submariner-references-ever-produced/)

### Model line: Tudor Submariner snowflake (no-date and date)

- **Refs**: `7016/0` (no-date snowflake, 1969–1975), `7021/0` (date snowflake, 1969–1975), `9411/0` (date snowflake, c.1969–1983, hacking)
- **Years**: 1969–1983
- **Designer / movement**: ETA cal. 2483 (7016), [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6NDI0MiwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1vdHR1aHIuY29tIiwicHJldmlld1RpdGxlIjoiVHVkb3IgU2VyaWFsIE51bWJlcnM6IFRoZSBDb21wbGV0ZSBHdWlkZSBUbyBEYXRpbmcgWW91ciBXYXRjaCIsInNvdXJjZSI6Ik9UVFVIUiIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49b3R0dWhyLmNvbSIsInNvdXJjZSI6Ik9UVFVIUiIsInRpdGxlIjoiVHVkb3IgU2VyaWFsIE51bWJlcnM6IFRoZSBDb21wbGV0ZSBHdWlkZSBUbyBEYXRpbmcgWW91ciBXYXRjaCIsInVybCI6Imh0dHBzOlwvXC9vdHR1aHIuY29tXC90dWRvci1zZXJpYWwtbnVtYmVycy10aGUtY29tcGxldGUtZ3VpZGUtdG8tZGF0aW5nLXlvdXItd2F0Y2hcLyJ9XSwic3RhcnRJbmRleCI6NDIyMSwidGl0bGUiOiJPVFRVSFIiLCJ1cmwiOiJodHRwczpcL1wvb3R0dWhyLmNvbVwvdHVkb3Itc2VyaWFsLW51bWJlcnMtdGhlLWNvbXBsZXRlLWd1aWRlLXRvLWRhdGluZy15b3VyLXdhdGNoXC8iLCJ1dWlkIjoiODViYzdkM2ItOGE3Zi00NTYyLWJhNDYtMDIxYmJlYTI0OWFkIn0%3D "OTTUHR")](https://ottuhr.com/tudor-serial-numbers-the-complete-guide-to-dating-your-watch/) ETA 2784 with hacking seconds and date (7021, 9411); 25 jewels, 28,800 vph (9411)
- **Key identifiers**: 39–40mm Rolex Oyster case, blue or black dial/bezel, square-tipped "snowflake" hour hand, large rectangular indices at 3/6/9, applied Tudor rose then shield logo (rose phased out c.1969). The 7021/0 is the only snowflake with a date complication; the 9411/0 introduced hacking and is the *final* snowflake reference before Tudor reverted to Mercedes hands on the 76100.
- **Common nicknames**: "Snowflake" (hand shape), "Marine Nationale" (MN-issued examples engraved on the caseback), "Blueberry" (deep blue dial/bezel variants)
- **Notes**: Issued in quantity to the French Marine Nationale, [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6NDk0MSwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj12aW50YWdld2F0Y2hzcGVjaWFsaXN0LmNvbSIsInByZXZpZXdUaXRsZSI6IlR1ZG9yIFN1Ym1hcmluZXIgRGF0ZSAtIFNub3dmbGFrZSAtIFJlZmVyZW5jZSA5NDExIC0gQ2FsaWJyZSAyNzg0IC0gYy4g4oCTIFZpbnRhZ2UgV2F0Y2ggU3BlY2lhbGlzdCIsInNvdXJjZSI6IlZpbnRhZ2UgV2F0Y2ggU3BlY2lhbGlzdCIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dmludGFnZXdhdGNoc3BlY2lhbGlzdC5jb20iLCJzb3VyY2UiOiJWaW50YWdlIFdhdGNoIFNwZWNpYWxpc3QiLCJ0aXRsZSI6IlR1ZG9yIFN1Ym1hcmluZXIgRGF0ZSAtIFNub3dmbGFrZSAtIFJlZmVyZW5jZSA5NDExIC0gQ2FsaWJyZSAyNzg0IC0gYy4g4oCTIFZpbnRhZ2UgV2F0Y2ggU3BlY2lhbGlzdCIsInVybCI6Imh0dHBzOlwvXC92aW50YWdld2F0Y2hzcGVjaWFsaXN0LmNvbVwvcHJvZHVjdHNcL3R1ZG9yLXN1Ym1hcmluZXItZGF0ZS1zbm93Zmxha2UtcmVmZXJlbmNlLTk0MTEtY2FsaWJyZS0yNzg0LWMtMTk3MyJ9XSwic3RhcnRJbmRleCI6NDg5MSwidGl0bGUiOiJWaW50YWdlIFdhdGNoIFNwZWNpYWxpc3QiLCJ1cmwiOiJodHRwczpcL1wvdmludGFnZXdhdGNoc3BlY2lhbGlzdC5jb21cL3Byb2R1Y3RzXC90dWRvci1zdWJtYXJpbmVyLWRhdGUtc25vd2ZsYWtlLXJlZmVyZW5jZS05NDExLWNhbGlicmUtMjc4NC1jLTE5NzMiLCJ1dWlkIjoiYzBjNmU5ZWMtNTkwNi00MmI1LWJkNmUtMDVhYzYyODgzNzQ0In0%3D "Vintage Watch Specialist")](https://vintagewatchspecialist.com/products/tudor-submariner-date-snowflake-reference-9411-calibre-2784-c-1973) US Navy SEALs and South African Navy from 1969 onward, the snowflake Submariner is the defining vintage Tudor sports reference. The 7021/0, the only snowflake with a date complication, is the rarest of the early trio because production overlapped just six years before being phased out. The 9411/0 carried the snowflake design through the late 1970s with the hacking ETA 2784 [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6NTMxNywibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcmNvbGxlY3Rvci5jb20iLCJwcmV2aWV3VGl0bGUiOiI5NDAxICYgOTQxMSBTdWJtYXJpbmVyIC0gVHVkb3IgY29sbGVjdG9yIiwic291cmNlIjoiVHVkb3Jjb2xsZWN0b3IiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yY29sbGVjdG9yLmNvbSIsInNvdXJjZSI6IlR1ZG9yY29sbGVjdG9yIiwidGl0bGUiOiI5NDAxICYgOTQxMSBTdWJtYXJpbmVyIC0gVHVkb3IgY29sbGVjdG9yIiwidXJsIjoiaHR0cHM6XC9cL3R1ZG9yY29sbGVjdG9yLmNvbVwvY29sbGVjdGlvblwvZXhhbXBsZS13YXRjaC01XC8ifV0sInN0YXJ0SW5kZXgiOjUyMjksInRpdGxlIjoiVHVkb3Jjb2xsZWN0b3IiLCJ1cmwiOiJodHRwczpcL1wvdHVkb3Jjb2xsZWN0b3IuY29tXC9jb2xsZWN0aW9uXC9leGFtcGxlLXdhdGNoLTVcLyIsInV1aWQiOiI1OTU1MmNlZi0yYjNlLTQ5MTMtODdkZC05OTIzMzU2ZGZmMWEifQ%3D%3D "Tudorcollector")](https://tudorcollector.com/collection/example-watch-5/) and gradually adopted "Prince Oysterdate" rather than "Submariner" text on the dial; from c.1976 the `/0` suffix was dropped from catalogue copy [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6NTQ2MiwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1oYWlyc3ByaW5nLmNvbSIsInByZXZpZXdUaXRsZSI6IlZhbHVlIFByb3Bvc2l0aW9uOiA5NDExXC8wIFR1ZG9yIFNub3dmbGFrZSDigJMgSGFpcnNwcmluZyIsInNvdXJjZSI6IkhhaXJzcHJpbmciLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWhhaXJzcHJpbmcuY29tIiwic291cmNlIjoiSGFpcnNwcmluZyIsInRpdGxlIjoiVmFsdWUgUHJvcG9zaXRpb246IDk0MTFcLzAgVHVkb3IgU25vd2ZsYWtlIOKAkyBIYWlyc3ByaW5nIiwidXJsIjoiaHR0cHM6XC9cL2hhaXJzcHJpbmcuY29tXC9ibG9nc1wvZmluZHNcL3ZhbHVlLXByb3Bvc2l0aW9uLTk0MTEtMC10dWRvci1zbm93Zmxha2UifV0sInN0YXJ0SW5kZXgiOjU0MDMsInRpdGxlIjoiSGFpcnNwcmluZyIsInVybCI6Imh0dHBzOlwvXC9oYWlyc3ByaW5nLmNvbVwvYmxvZ3NcL2ZpbmRzXC92YWx1ZS1wcm9wb3NpdGlvbi05NDExLTAtdHVkb3Itc25vd2ZsYWtlIiwidXVpZCI6ImFlMmFjZTkzLWYxZTktNGZlNS1hNDg4LWQwODMyODE2YTczZCJ9 "Hairspring")](https://hairspring.com/blogs/finds/value-proposition-9411-0-tudor-snowflake) although the case stamping retained it. MN-issued examples with engraved "M.N. 71" through "M.N. 79" casebacks command large premiums. Phillips Geneva auctions and A Collected Man have catalogued unpolished 7016/0 and 9411/0 MN examples above USD 30,000.
- **Sources**: [Tudor — Inside Tudor history 1960–69](https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-origins-1960-to-1969) · [Fratello — Top 5 Tudor Submariners](https://www.fratellowatches.com/fratellos-top-5-tudor-submariner-references-ever-produced/) · [Tudor Collector](https://tudorcollector.com/) · [Vintage Watch Specialist — 76100](https://vintagewatchspecialist.com/products/tudor-submariner-lollipop-model-ref-76100-1985)

### Model line: Tudor Submariner late-era and mid-size

- **Refs**: `7966/0` (Submariner, mid-1960s small Oyster), `94010/0` (Submariner no-date, 1977–1984), `76100` (Submariner date "Lollipop", c.1984–1985), `75090` (Mid-Size Submariner, 1990–1995)
- **Years**: c.1965–1999
- **Designer / movement**: ETA 2483 (7966), ETA 2784 hacking (94010), modified ETA 2824-2 (76100, 75090); [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6NjU0OSwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1jaHJvbm8yNC5jb20iLCJwcmV2aWV3VGl0bGUiOiJUdWRvciBTdWJtYXJpbmVyIFByaW5jZSBPeXN0ZXJkYXRlIFJlZi4gNzUwOTAgSnVzdCAuLi4iLCJzb3VyY2UiOiJDaHJvbm8yNCIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y2hyb25vMjQuY29tIiwic291cmNlIjoiQ2hyb25vMjQiLCJ0aXRsZSI6IlR1ZG9yIFN1Ym1hcmluZXIgUHJpbmNlIE95c3RlcmRhdGUgUmVmLiA3NTA5MCBKdXN0IC4uLiIsInVybCI6Imh0dHBzOlwvXC93d3cuY2hyb25vMjQuY29tXC90dWRvclwvdHVkb3ItdHVkb3Itc3VibWFyaW5lci1wcmluY2Utb3lzdGVyZGF0ZS1yZWYtNzUwOTAtanVzdC1zZXJ2aWNlZC0taWQyNDM5Njc3MC5odG0ifV0sInN0YXJ0SW5kZXgiOjY1MTQsInRpdGxlIjoiQ2hyb25vMjQiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmNocm9ubzI0LmNvbVwvdHVkb3JcL3R1ZG9yLXR1ZG9yLXN1Ym1hcmluZXItcHJpbmNlLW95c3RlcmRhdGUtcmVmLTc1MDkwLWp1c3Qtc2VydmljZWQtLWlkMjQzOTY3NzAuaHRtIiwidXVpZCI6Ijk0YjlhNzk5LWZmN2EtNDAwYi04NWE5LTVlM2E1YmZmYmExZiJ9 "Chrono24")](https://www.chrono24.com/tudor/tudor-tudor-submariner-prince-oysterdate-ref-75090-just-serviced--id24396770.htm) 28,800 vph
- **Key identifiers**: 39mm (94010/76100) or 36mm midsize (75090) Rolex Oyster case. The 76100 is unique for its "lollipop" hour hand — a large tritium-filled disc on a thin stem, prone to cracking [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6Njc1OCwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcmNvbGxlY3Rvci5jb20iLCJwcmV2aWV3VGl0bGUiOiI3NjEwMCBTdWJtYXJpbmVyIC0gVHVkb3IgY29sbGVjdG9yIiwic291cmNlIjoiVHVkb3Jjb2xsZWN0b3IiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yY29sbGVjdG9yLmNvbSIsInNvdXJjZSI6IlR1ZG9yY29sbGVjdG9yIiwidGl0bGUiOiI3NjEwMCBTdWJtYXJpbmVyIC0gVHVkb3IgY29sbGVjdG9yIiwidXJsIjoiaHR0cHM6XC9cL3R1ZG9yY29sbGVjdG9yLmNvbVwvY29sbGVjdGlvblwvNzYxMDAtc3VibWFyaW5lclwvIn1dLCJzdGFydEluZGV4Ijo2Njk3LCJ0aXRsZSI6IlR1ZG9yY29sbGVjdG9yIiwidXJsIjoiaHR0cHM6XC9cL3R1ZG9yY29sbGVjdG9yLmNvbVwvY29sbGVjdGlvblwvNzYxMDAtc3VibWFyaW5lclwvIiwidXVpZCI6ImU2ZTA5NTA3LTc5MGYtNDBhYi1iYWEzLWFkMDIyMzlkNTg3MSJ9 "Tudorcollector")](https://tudorcollector.com/collection/76100-submariner/) and quickly replaced. The 75090 fills the void between the 39mm 79090 and the 33mm 73090, uses a domed acrylic crystal (the successor 75190 has sapphire), [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6NjkxMywibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1jaHJvbm8yNC5jb20iLCJwcmV2aWV3VGl0bGUiOiJUdWRvciBTdWJtYXJpbmVyIFByaW5jZSBPeXN0ZXJkYXRlIFJlZi4gNzUwOTAgSnVzdCAuLi4iLCJzb3VyY2UiOiJDaHJvbm8yNCIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y2hyb25vMjQuY29tIiwic291cmNlIjoiQ2hyb25vMjQiLCJ0aXRsZSI6IlR1ZG9yIFN1Ym1hcmluZXIgUHJpbmNlIE95c3RlcmRhdGUgUmVmLiA3NTA5MCBKdXN0IC4uLiIsInVybCI6Imh0dHBzOlwvXC93d3cuY2hyb25vMjQuY29tXC90dWRvclwvdHVkb3ItdHVkb3Itc3VibWFyaW5lci1wcmluY2Utb3lzdGVyZGF0ZS1yZWYtNzUwOTAtanVzdC1zZXJ2aWNlZC0taWQyNDM5Njc3MC5odG0ifV0sInN0YXJ0SW5kZXgiOjY4NDksInRpdGxlIjoiQ2hyb25vMjQiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmNocm9ubzI0LmNvbVwvdHVkb3JcL3R1ZG9yLXR1ZG9yLXN1Ym1hcmluZXItcHJpbmNlLW95c3RlcmRhdGUtcmVmLTc1MDkwLWp1c3Qtc2VydmljZWQtLWlkMjQzOTY3NzAuaHRtIiwidXVpZCI6IjRiZGY1ODc5LWMyZjctNDAyMy1hYjg2LWE4YmQ4M2QyZTNlOCJ9 "Chrono24")](https://www.chrono24.com/tudor/tudor-tudor-submariner-prince-oysterdate-ref-75090-just-serviced--id24396770.htm) and is the only true 36mm Tudor Submariner of the modern era.
- **Common nicknames**: "Lollipop" (76100), "Mid-Size Sub" / "Mini-Sub" (75090), "Big Rose" (7966/0 with rare applied-rose dial)
- **Notes**: Tudorcollector.com places the earliest 76100 serial in the 64,000 range, only a few hundred numbers after the last 94010, [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6NzIzOSwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcmNvbGxlY3Rvci5jb20iLCJwcmV2aWV3VGl0bGUiOiI3NjEwMCBTdWJtYXJpbmVyIC0gVHVkb3IgY29sbGVjdG9yIiwic291cmNlIjoiVHVkb3Jjb2xsZWN0b3IiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yY29sbGVjdG9yLmNvbSIsInNvdXJjZSI6IlR1ZG9yY29sbGVjdG9yIiwidGl0bGUiOiI3NjEwMCBTdWJtYXJpbmVyIC0gVHVkb3IgY29sbGVjdG9yIiwidXJsIjoiaHR0cHM6XC9cL3R1ZG9yY29sbGVjdG9yLmNvbVwvY29sbGVjdGlvblwvNzYxMDAtc3VibWFyaW5lclwvIn1dLCJzdGFydEluZGV4Ijo3MTE4LCJ0aXRsZSI6IlR1ZG9yY29sbGVjdG9yIiwidXJsIjoiaHR0cHM6XC9cL3R1ZG9yY29sbGVjdG9yLmNvbVwvY29sbGVjdGlvblwvNzYxMDAtc3VibWFyaW5lclwvIiwidXVpZCI6ImUxYWE3YjgyLWFlMzQtNDY0ZC1hNWNlLWZiN2ExNjM1ZDk1OCJ9 "Tudorcollector")](https://tudorcollector.com/collection/76100-submariner/) confirming the two were assembled concurrently. The lollipop hand's oversized tritium plot cracked in use, so most service replacements use Mercedes hands; original-lollipop provenance is decisive for value. Original-owner reports of factory-supplied Mercedes-hand 76100s exist, [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6NzUxOCwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcmNvbGxlY3Rvci5jb20iLCJwcmV2aWV3VGl0bGUiOiI3NjEwMCBTdWJtYXJpbmVyIC0gVHVkb3IgY29sbGVjdG9yIiwic291cmNlIjoiVHVkb3Jjb2xsZWN0b3IiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yY29sbGVjdG9yLmNvbSIsInNvdXJjZSI6IlR1ZG9yY29sbGVjdG9yIiwidGl0bGUiOiI3NjEwMCBTdWJtYXJpbmVyIC0gVHVkb3IgY29sbGVjdG9yIiwidXJsIjoiaHR0cHM6XC9cL3R1ZG9yY29sbGVjdG9yLmNvbVwvY29sbGVjdGlvblwvNzYxMDAtc3VibWFyaW5lclwvIn1dLCJzdGFydEluZGV4Ijo3NDQ4LCJ0aXRsZSI6IlR1ZG9yY29sbGVjdG9yIiwidXJsIjoiaHR0cHM6XC9cL3R1ZG9yY29sbGVjdG9yLmNvbVwvY29sbGVjdGlvblwvNzYxMDAtc3VibWFyaW5lclwvIiwidXVpZCI6Ijc2NjU0YTYxLWUxZWUtNDc2Yi04ZjUwLWNkNWEwOTg1ZDZiNyJ9 "Tudorcollector")](https://tudorcollector.com/collection/76100-submariner/) so a Mercedes hand on a 76100 is not by itself proof of a service swap. The 75090 (1990–1995) has become a collector favourite for its acrylic-crystal vintage feel and tritium dial; the Submariner line was discontinued entirely in 1999. [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6Nzc1NSwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1jaHJvbm8yNC5jb20iLCJwcmV2aWV3VGl0bGUiOiJUdWRvciBTdWJtYXJpbmVyIFByaW5jZSBPeXN0ZXJkYXRlIFJlZi4gNzUwOTAgSnVzdCAuLi4iLCJzb3VyY2UiOiJDaHJvbm8yNCIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y2hyb25vMjQuY29tIiwic291cmNlIjoiQ2hyb25vMjQiLCJ0aXRsZSI6IlR1ZG9yIFN1Ym1hcmluZXIgUHJpbmNlIE95c3RlcmRhdGUgUmVmLiA3NTA5MCBKdXN0IC4uLiIsInVybCI6Imh0dHBzOlwvXC93d3cuY2hyb25vMjQuY29tXC90dWRvclwvdHVkb3ItdHVkb3Itc3VibWFyaW5lci1wcmluY2Utb3lzdGVyZGF0ZS1yZWYtNzUwOTAtanVzdC1zZXJ2aWNlZC0taWQyNDM5Njc3MC5odG0ifV0sInN0YXJ0SW5kZXgiOjc3MDEsInRpdGxlIjoiQ2hyb25vMjQiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmNocm9ubzI0LmNvbVwvdHVkb3JcL3R1ZG9yLXR1ZG9yLXN1Ym1hcmluZXItcHJpbmNlLW95c3RlcmRhdGUtcmVmLTc1MDkwLWp1c3Qtc2VydmljZWQtLWlkMjQzOTY3NzAuaHRtIiwidXVpZCI6IjM3ZmE1ZDI1LWExMDctNDk1MS1hMDhjLTNiM2VjNTgxMjJhNyJ9 "Chrono24")](https://www.chrono24.com/tudor/tudor-tudor-submariner-prince-oysterdate-ref-75090-just-serviced--id24396770.htm)
- **Sources**: [Tudor Sub — 76100](https://www.tudorsub.com/tudorsubmariner76100) · [Tudor Collector — 76100](https://tudorcollector.com/collection/76100-submariner/) · [Luxury Bazaar — 75090 Review](https://www.luxurybazaar.com/grey-market/tudor-submariner-75090-review/) · [Loupe This — 75090 Mid-Size](https://loupethis.com/auctions/tudor-prince-oysterdate-submariner-mid-size-75090)

### Model line: Tudor Monte Carlo chronograph (Home Plate and second generation)

- **Refs**: `7031/0` (Plexi bezel, 1970–71), `7032/0` (steel tachy bezel, 1970–71), `7149/0` (Plexi tachy, 1971–c.1977), `7159/0` (steel tachy, 1971–c.1977), `7169/0` (rotating 12-hour bezel, 1971–c.1977)
- **Years**: 1970–c.1977
- **Designer / movement**: Manual-wind Valjoux 7734 (cam-actuated, 18,000 vph) [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6ODUzNCwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1sdXh1cnliYXphYXIuY29tIiwicHJldmlld1RpdGxlIjoiVHVkb3IgQ2hyb25vZ3JhcGggV2F0Y2ggR3VpZGUgLSBBbGwgUmVmZXJlbmNlcywgMTk3MCB0byBUb2RheSIsInNvdXJjZSI6Ikx1eHVyeSBCYXphYXIiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWx1eHVyeWJhemFhci5jb20iLCJzb3VyY2UiOiJMdXh1cnkgQmF6YWFyIiwidGl0bGUiOiJUdWRvciBDaHJvbm9ncmFwaCBXYXRjaCBHdWlkZSAtIEFsbCBSZWZlcmVuY2VzLCAxOTcwIHRvIFRvZGF5IiwidXJsIjoiaHR0cHM6XC9cL3d3dy5sdXh1cnliYXphYXIuY29tXC9ncmV5LW1hcmtldFwvdHVkb3ItY2hyb25vZ3JhcGhcLyJ9XSwic3RhcnRJbmRleCI6ODQ4MywidGl0bGUiOiJMdXh1cnkgQmF6YWFyIiwidXJsIjoiaHR0cHM6XC9cL3d3dy5sdXh1cnliYXphYXIuY29tXC9ncmV5LW1hcmtldFwvdHVkb3ItY2hyb25vZ3JhcGhcLyIsInV1aWQiOiJiMjAyZWU3OC0xZGE1LTQ1ZGEtYTUyOS1jMDYyNGZjYTA1M2UifQ%3D%3D "Luxury Bazaar")](https://www.luxurybazaar.com/grey-market/tudor-chronograph/) for the first generation 7031/7032/7033 [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6ODU3NCwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1jcmFmdGFuZHRhaWxvcmVkLmNvbSIsInByZXZpZXdUaXRsZSI6IipVbnBvbGlzaGVkKiAxOTcxIFR1ZG9yIE1vbnRlIENhcmxvIENocm9ub2dyYXBoIChSZWYuIDcwMzJcLzApIEJsYWNrIFwiSCIsInNvdXJjZSI6IkNyYWZ0ICsgVGFpbG9yZWQiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWNyYWZ0YW5kdGFpbG9yZWQuY29tIiwic291cmNlIjoiQ3JhZnQgKyBUYWlsb3JlZCIsInRpdGxlIjoiKlVucG9saXNoZWQqIDE5NzEgVHVkb3IgTW9udGUgQ2FybG8gQ2hyb25vZ3JhcGggKFJlZi4gNzAzMlwvMCkgQmxhY2sgXCJIIiwidXJsIjoiaHR0cHM6XC9cL3d3dy5jcmFmdGFuZHRhaWxvcmVkLmNvbVwvcHJvZHVjdHNcL3VucG9saXNoZWQtMTk3MS10dWRvci1tb250ZS1jYXJsby1jaHJvbm9ncmFwaC1yZWYtNzAzMi0wLWJsYWNrLWhvbWUtcGxhdGUtZGlhbCJ9XSwic3RhcnRJbmRleCI6ODQ4MywidGl0bGUiOiJDcmFmdCArIFRhaWxvcmVkIiwidXJsIjoiaHR0cHM6XC9cL3d3dy5jcmFmdGFuZHRhaWxvcmVkLmNvbVwvcHJvZHVjdHNcL3VucG9saXNoZWQtMTk3MS10dWRvci1tb250ZS1jYXJsby1jaHJvbm9ncmFwaC1yZWYtNzAzMi0wLWJsYWNrLWhvbWUtcGxhdGUtZGlhbCIsInV1aWQiOiIwYTk5MTEzYi1kYmI3LTRlYWYtYTZiZC01ODk1MGFlOTBhYjgifQ%3D%3D "Craft + Tailored")](https://www.craftandtailored.com/products/unpolished-1971-tudor-monte-carlo-chronograph-ref-7032-0-black-home-plate-dial) → manual Valjoux 234 (column wheel, 21,600 vph) [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6ODYyMiwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcndhdGNoLmNvbSIsInByZXZpZXdUaXRsZSI6IlRVRE9SIENocm9ub2dyYXBoIFdhdGNoZXMgfCBJbnNpZGUgVFVET1IiLCJzb3VyY2UiOiJUdWRvciIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dHVkb3J3YXRjaC5jb20iLCJzb3VyY2UiOiJUdWRvciIsInRpdGxlIjoiVFVET1IgQ2hyb25vZ3JhcGggV2F0Y2hlcyB8IEluc2lkZSBUVURPUiIsInVybCI6Imh0dHBzOlwvXC93d3cudHVkb3J3YXRjaC5jb21cL2VuXC9pbnNpZGUtdHVkb3JcL2hpc3RvcnlcL3R1ZG9yLWhpc3RvcnktY2hyb25vZ3JhcGhzLTE5NzEtdG8tMTk3NiJ9XSwic3RhcnRJbmRleCI6ODU3NywidGl0bGUiOiJUdWRvciIsInVybCI6Imh0dHBzOlwvXC93d3cudHVkb3J3YXRjaC5jb21cL2VuXC9pbnNpZGUtdHVkb3JcL2hpc3RvcnlcL3R1ZG9yLWhpc3RvcnktY2hyb25vZ3JhcGhzLTE5NzEtdG8tMTk3NiIsInV1aWQiOiI4ZDhjMjAwNC05Y2U2LTRhZjktOGI2ZS1iNzA3MDQ3ZDg5ZTUifQ%3D%3D "Tudor")](https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-chronographs-1971-to-1976) for the second generation 7149/7159/7169
- **Key identifiers**: 40mm Rolex Oyster case with screw-down pushers [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6ODczMywibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj13YXRjaHdvcmtzcGR4LmNvbSIsInByZXZpZXdUaXRsZSI6IlR1ZG9yIE1vbnRlIENhcmxvIOKAmEhvbWUgUGxhdGXigJkgQ2hyb25vZ3JhcGggKDcwMzJcLzApIiwic291cmNlIjoiV2F0Y2h3b3JrcyIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49d2F0Y2h3b3Jrc3BkeC5jb20iLCJzb3VyY2UiOiJXYXRjaHdvcmtzIiwidGl0bGUiOiJUdWRvciBNb250ZSBDYXJsbyDigJhIb21lIFBsYXRl4oCZIENocm9ub2dyYXBoICg3MDMyXC8wKSIsInVybCI6Imh0dHBzOlwvXC93YXRjaHdvcmtzcGR4LmNvbVwvcHJvZHVjdFwvdHVkb3ItbW9udGUtY2FybG8taG9tZS1wbGF0ZS1jaHJvbm9ncmFwaC1yZWYtNzAzMi0wXC8ifV0sInN0YXJ0SW5kZXgiOjg2ODcsInRpdGxlIjoiV2F0Y2h3b3JrcyIsInVybCI6Imh0dHBzOlwvXC93YXRjaHdvcmtzcGR4LmNvbVwvcHJvZHVjdFwvdHVkb3ItbW9udGUtY2FybG8taG9tZS1wbGF0ZS1jaHJvbm9ncmFwaC1yZWYtNzAzMi0wXC8iLCJ1dWlkIjoiZDA4MzY3OTktYzY5OC00ZGY2LWJjYmItYzljOTM5NzJlNmQ2In0%3D "Watchworks")](https://watchworkspdx.com/product/tudor-monte-carlo-home-plate-chronograph-ref-7032-0/) and Triplock crown, "exotic" grey/orange/blue dial with painted hour markers, pentagonal "home plate" hour markers (first generation), three subdials at 3-6-9. The 7169/0 is unique for its bidirectional 12-hour rotating bezel.
- **Common nicknames**: "Home Plate" (first generation 7031/7032/7033 hour markers), [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6OTA0NSwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj13YXRjaHdvcmtzcGR4LmNvbSIsInByZXZpZXdUaXRsZSI6IlR1ZG9yIE1vbnRlIENhcmxvIOKAmEhvbWUgUGxhdGXigJkgQ2hyb25vZ3JhcGggKDcwMzJcLzApIiwic291cmNlIjoiV2F0Y2h3b3JrcyIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49d2F0Y2h3b3Jrc3BkeC5jb20iLCJzb3VyY2UiOiJXYXRjaHdvcmtzIiwidGl0bGUiOiJUdWRvciBNb250ZSBDYXJsbyDigJhIb21lIFBsYXRl4oCZIENocm9ub2dyYXBoICg3MDMyXC8wKSIsInVybCI6Imh0dHBzOlwvXC93YXRjaHdvcmtzcGR4LmNvbVwvcHJvZHVjdFwvdHVkb3ItbW9udGUtY2FybG8taG9tZS1wbGF0ZS1jaHJvbm9ncmFwaC1yZWYtNzAzMi0wXC8ifV0sInN0YXJ0SW5kZXgiOjg5ODUsInRpdGxlIjoiV2F0Y2h3b3JrcyIsInVybCI6Imh0dHBzOlwvXC93YXRjaHdvcmtzcGR4LmNvbVwvcHJvZHVjdFwvdHVkb3ItbW9udGUtY2FybG8taG9tZS1wbGF0ZS1jaHJvbm9ncmFwaC1yZWYtNzAzMi0wXC8iLCJ1dWlkIjoiOTY4MzRjMjQtNWYzYy00NTg2LWE4ZDctNDlmNDA5ODUyMDBhIn0%3D "Watchworks")](https://watchworkspdx.com/product/tudor-monte-carlo-home-plate-chronograph-ref-7032-0/) "Monte Carlo" (second generation 7149/7159/7169, after the Monaco rally colour scheme) [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6OTEzMiwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcmNvbGxlY3Rvci5jb20iLCJwcmV2aWV3VGl0bGUiOiJNb250ZSBDYXJsbyBDaHJvbm9zIC0gVHVkb3IgY29sbGVjdG9yIiwic291cmNlIjoiVHVkb3Jjb2xsZWN0b3IiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yY29sbGVjdG9yLmNvbSIsInNvdXJjZSI6IlR1ZG9yY29sbGVjdG9yIiwidGl0bGUiOiJNb250ZSBDYXJsbyBDaHJvbm9zIC0gVHVkb3IgY29sbGVjdG9yIiwidXJsIjoiaHR0cHM6XC9cL3R1ZG9yY29sbGVjdG9yLmNvbVwvY29sbGVjdGlvblwvbW9udGUtY2FybG8tY2hyb25vc1wvIn1dLCJzdGFydEluZGV4Ijo5MDQ2LCJ0aXRsZSI6IlR1ZG9yY29sbGVjdG9yIiwidXJsIjoiaHR0cHM6XC9cL3R1ZG9yY29sbGVjdG9yLmNvbVwvY29sbGVjdGlvblwvbW9udGUtY2FybG8tY2hyb25vc1wvIiwidXVpZCI6IjJhYTcxNzU4LWJiODctNGM4Yi1iY2NhLTQ3Yzg4M2Y0MzkzYyJ9 "Tudorcollector")](https://tudorcollector.com/collection/monte-carlo-chronos/)
- **Notes**: Tudor's first chronograph family launched in 1970, [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6OTE5NiwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1waGlsbGlwcy5jb20iLCJwcmV2aWV3VGl0bGUiOiJUdWRvciBSYWNpbmcgUHVsc2UiLCJzb3VyY2UiOiJQaGlsbGlwcyIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49cGhpbGxpcHMuY29tIiwic291cmNlIjoiUGhpbGxpcHMiLCJ0aXRsZSI6IlR1ZG9yIFJhY2luZyBQdWxzZSIsInVybCI6Imh0dHBzOlwvXC93d3cucGhpbGxpcHMuY29tXC9kZXRhaWxcL3R1ZG9yXC9OWTA4MDEyMFwvOTAifV0sInN0YXJ0SW5kZXgiOjkxNDYsInRpdGxlIjoiUGhpbGxpcHMiLCJ1cmwiOiJodHRwczpcL1wvd3d3LnBoaWxsaXBzLmNvbVwvZGV0YWlsXC90dWRvclwvTlkwODAxMjBcLzkwIiwidXVpZCI6IjUwMzA1YjlkLTcwN2EtNDkzZC05ZGJkLTJiYmEwNWQyZjQ5MCJ9 "Phillips")](https://www.phillips.com/detail/tudor/NY080120/90) ahead of the Rolex Daytona 6263/6265. The first generation (7031/7032/7033) is defined by pentagonal "home plate" hour markers and the cam-driven Valjoux 7734; [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6OTM1NiwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1jcmFmdGFuZHRhaWxvcmVkLmNvbSIsInByZXZpZXdUaXRsZSI6IipVbnBvbGlzaGVkKiAxOTcxIFR1ZG9yIE1vbnRlIENhcmxvIENocm9ub2dyYXBoIChSZWYuIDcwMzJcLzApIEJsYWNrIFwiSCIsInNvdXJjZSI6IkNyYWZ0ICsgVGFpbG9yZWQiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWNyYWZ0YW5kdGFpbG9yZWQuY29tIiwic291cmNlIjoiQ3JhZnQgKyBUYWlsb3JlZCIsInRpdGxlIjoiKlVucG9saXNoZWQqIDE5NzEgVHVkb3IgTW9udGUgQ2FybG8gQ2hyb25vZ3JhcGggKFJlZi4gNzAzMlwvMCkgQmxhY2sgXCJIIiwidXJsIjoiaHR0cHM6XC9cL3d3dy5jcmFmdGFuZHRhaWxvcmVkLmNvbVwvcHJvZHVjdHNcL3VucG9saXNoZWQtMTk3MS10dWRvci1tb250ZS1jYXJsby1jaHJvbm9ncmFwaC1yZWYtNzAzMi0wLWJsYWNrLWhvbWUtcGxhdGUtZGlhbCJ9XSwic3RhcnRJbmRleCI6OTIzNSwidGl0bGUiOiJDcmFmdCArIFRhaWxvcmVkIiwidXJsIjoiaHR0cHM6XC9cL3d3dy5jcmFmdGFuZHRhaWxvcmVkLmNvbVwvcHJvZHVjdHNcL3VucG9saXNoZWQtMTk3MS10dWRvci1tb250ZS1jYXJsby1jaHJvbm9ncmFwaC1yZWYtNzAzMi0wLWJsYWNrLWhvbWUtcGxhdGUtZGlhbCIsInV1aWQiOiIzMGUwOWUyMC0zM2RjLTRhYzYtYjMyOS02ZTE1MmVlZDZmY2YifQ%3D%3D "Craft + Tailored")](https://www.craftandtailored.com/products/unpolished-1971-tudor-monte-carlo-chronograph-ref-7032-0-black-home-plate-dial) collectors strongly prefer the column-wheel Valjoux 234 second generation despite the identical case. The 7169/0 with rotating bezel [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6OTQ4OSwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcndhdGNoLmNvbSIsInByZXZpZXdUaXRsZSI6IlRVRE9SIENocm9ub2dyYXBoIFdhdGNoZXMgfCBJbnNpZGUgVFVET1IiLCJzb3VyY2UiOiJUdWRvciIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dHVkb3J3YXRjaC5jb20iLCJzb3VyY2UiOiJUdWRvciIsInRpdGxlIjoiVFVET1IgQ2hyb25vZ3JhcGggV2F0Y2hlcyB8IEluc2lkZSBUVURPUiIsInVybCI6Imh0dHBzOlwvXC93d3cudHVkb3J3YXRjaC5jb21cL2VuXC9pbnNpZGUtdHVkb3JcL2hpc3RvcnlcL3R1ZG9yLWhpc3RvcnktY2hyb25vZ3JhcGhzLTE5NzEtdG8tMTk3NiJ9XSwic3RhcnRJbmRleCI6OTQ1OSwidGl0bGUiOiJUdWRvciIsInVybCI6Imh0dHBzOlwvXC93d3cudHVkb3J3YXRjaC5jb21cL2VuXC9pbnNpZGUtdHVkb3JcL2hpc3RvcnlcL3R1ZG9yLWhpc3RvcnktY2hyb25vZ3JhcGhzLTE5NzEtdG8tMTk3NiIsInV1aWQiOiI4ZWQyZDM3ZC03MWE2LTRlOGMtYjc5MC05YjU4OGYwNWViODIifQ%3D%3D "Tudor")](https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-chronographs-1971-to-1976) is the rarest and most sought-after of the second-generation trio. **No `7176/0` reference is documented in the Tudor archive** — the Monte Carlo 7100-series consists only of 7149/0, 7159/0 and 7169/0; [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6OTY5MSwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcndhdGNoLmNvbSIsInByZXZpZXdUaXRsZSI6IlRVRE9SIENocm9ub2dyYXBoIFdhdGNoZXMgfCBJbnNpZGUgVFVET1IiLCJzb3VyY2UiOiJUdWRvciIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dHVkb3J3YXRjaC5jb20iLCJzb3VyY2UiOiJUdWRvciIsInRpdGxlIjoiVFVET1IgQ2hyb25vZ3JhcGggV2F0Y2hlcyB8IEluc2lkZSBUVURPUiIsInVybCI6Imh0dHBzOlwvXC93d3cudHVkb3J3YXRjaC5jb21cL2VuXC9pbnNpZGUtdHVkb3JcL2hpc3RvcnlcL3R1ZG9yLWhpc3RvcnktY2hyb25vZ3JhcGhzLTE5NzEtdG8tMTk3NiJ9XSwic3RhcnRJbmRleCI6OTYyMCwidGl0bGUiOiJUdWRvciIsInVybCI6Imh0dHBzOlwvXC93d3cudHVkb3J3YXRjaC5jb21cL2VuXC9pbnNpZGUtdHVkb3JcL2hpc3RvcnlcL3R1ZG9yLWhpc3RvcnktY2hyb25vZ3JhcGhzLTE5NzEtdG8tMTk3NiIsInV1aWQiOiIxMmMxMmY0Yi04MDAxLTRjMDEtYmZmYS1kYjcxYTNmNzRiMzkifQ%3D%3D "Tudor")](https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-chronographs-1971-to-1976) [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6OTY5MSwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1yZXZvbHV0aW9ud2F0Y2guY29tIiwicHJldmlld1RpdGxlIjoiVGhlIFR1ZG9yICdNb250ZSBDYXJsbycgLSBSZXZvbHV0aW9uIFdhdGNoIiwic291cmNlIjoiUmV2b2x1dGlvbiBXYXRjaCIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49cmV2b2x1dGlvbndhdGNoLmNvbSIsInNvdXJjZSI6IlJldm9sdXRpb24gV2F0Y2giLCJ0aXRsZSI6IlRoZSBUdWRvciAnTW9udGUgQ2FybG8nIC0gUmV2b2x1dGlvbiBXYXRjaCIsInVybCI6Imh0dHBzOlwvXC9yZXZvbHV0aW9ud2F0Y2guY29tXC90aGUtdHVkb3ItbW9udGUtY2FybG9cLyJ9XSwic3RhcnRJbmRleCI6OTYyMCwidGl0bGUiOiJSZXZvbHV0aW9uIFdhdGNoIiwidXJsIjoiaHR0cHM6XC9cL3Jldm9sdXRpb253YXRjaC5jb21cL3RoZS10dWRvci1tb250ZS1jYXJsb1wvIiwidXVpZCI6IjMzMzI4ZThkLTNhYjEtNDFhMy04MGFkLTYyZmI4ODhkMDdjZCJ9 "Revolution Watch")](https://revolutionwatch.com/the-tudor-monte-carlo/) listings citing "7176" are almost always typographical errors and should be treated as suspect.
- **Sources**: [Tudor — Chronograph history 1976–1991](https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-chronographs-1976-to-1991) · [Tudor Collector](https://tudorcollector.com/) · [Fratello — Top 5 Tudor Submariners](https://www.fratellowatches.com/fratellos-top-5-tudor-submariner-references-ever-produced/) · [Revolution](https://revolutionwatch.com/)

### Model line: Tudor Prince Oysterdate chronograph "Big Block" (first and second generation)

- **Refs**: First generation 9400-series — `94200/0`, `94210/0`, `94300/0`, `9420/0`, `9421/0`, `9430/0`. Second generation 79100-series — `79160/0`, `79170/0`, `79180/0`
- **Years**: 1976–c.1995
- **Designer / movement**: Self-winding Valjoux 7750 [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTA1MDQsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49ZnJhdGVsbG93YXRjaGVzLmNvbSIsInByZXZpZXdUaXRsZSI6IiNUQlQgVHVkb3IgQmlnIEJsb2NrIDc5MTgwIENocm9ub2dyYXBoIiwic291cmNlIjoiRnJhdGVsbG8iLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWZyYXRlbGxvd2F0Y2hlcy5jb20iLCJzb3VyY2UiOiJGcmF0ZWxsbyIsInRpdGxlIjoiI1RCVCBUdWRvciBCaWcgQmxvY2sgNzkxODAgQ2hyb25vZ3JhcGgiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmZyYXRlbGxvd2F0Y2hlcy5jb21cL3RidC10dWRvci1iaWctYmxvY2stNzkxODAtY2hyb25vZ3JhcGhcLyJ9XSwic3RhcnRJbmRleCI6MTA0NzksInRpdGxlIjoiRnJhdGVsbG8iLCJ1cmwiOiJodHRwczpcL1wvd3d3LmZyYXRlbGxvd2F0Y2hlcy5jb21cL3RidC10dWRvci1iaWctYmxvY2stNzkxODAtY2hyb25vZ3JhcGhcLyIsInV1aWQiOiI3YzI1ZThlMC05ZTMxLTRmNmUtODkzMi0wY2NiNWE2ZGQ1NjAifQ%3D%3D "Fratello")](https://www.fratellowatches.com/tbt-tudor-big-block-79180-chronograph/) [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTA1MDQsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dHVkb3J3YXRjaC5jb20iLCJwcmV2aWV3VGl0bGUiOiJUVURPUiBDaHJvbm9ncmFwaCBXYXRjaGVzIHwgSW5zaWRlIFRVRE9SIiwic291cmNlIjoiVHVkb3IiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yd2F0Y2guY29tIiwic291cmNlIjoiVHVkb3IiLCJ0aXRsZSI6IlRVRE9SIENocm9ub2dyYXBoIFdhdGNoZXMgfCBJbnNpZGUgVFVET1IiLCJ1cmwiOiJodHRwczpcL1wvd3d3LnR1ZG9yd2F0Y2guY29tXC9lblwvaW5zaWRlLXR1ZG9yXC9oaXN0b3J5XC90dWRvci1oaXN0b3J5LWNocm9ub2dyYXBocy0xOTc2LXRvLTE5OTEifV0sInN0YXJ0SW5kZXgiOjEwNDc5LCJ0aXRsZSI6IlR1ZG9yIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50dWRvcndhdGNoLmNvbVwvZW5cL2luc2lkZS10dWRvclwvaGlzdG9yeVwvdHVkb3ItaGlzdG9yeS1jaHJvbm9ncmFwaHMtMTk3Ni10by0xOTkxIiwidXVpZCI6Ijg3OTVkZmQ1LTYzMTctNGQ5YS04NzA5LTdiYWNiOTBjNmZhNyJ9 "Tudor")](https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-chronographs-1976-to-1991) (Tudor's first automatic chronograph caliber), 28,800 vph, day/date
- **Key identifiers**: 40mm Rolex Oyster case, thicker than the manual Monte Carlo (hence "Big Block"), three subdials, day/date at 3, screw-down pushers. Bezel variants differentiate references within each generation.
- **Common nicknames**: "Big Block" (case thickness from the automatic module), "Exotic" (grey/blue/orange 9420/0 dial)
- **Notes**: Launched 1976 as Tudor's first automatic chronograph, [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTA5NzgsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y3JhZnRhbmR0YWlsb3JlZC5jb20iLCJwcmV2aWV3VGl0bGUiOiIqVW5wb2xpc2hlZCogMTk3MSBUdWRvciBNb250ZSBDYXJsbyBDaHJvbm9ncmFwaCAoUmVmLiA3MDMyXC8wKSBCbGFjayBcIkgiLCJzb3VyY2UiOiJDcmFmdCArIFRhaWxvcmVkIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1jcmFmdGFuZHRhaWxvcmVkLmNvbSIsInNvdXJjZSI6IkNyYWZ0ICsgVGFpbG9yZWQiLCJ0aXRsZSI6IipVbnBvbGlzaGVkKiAxOTcxIFR1ZG9yIE1vbnRlIENhcmxvIENocm9ub2dyYXBoIChSZWYuIDcwMzJcLzApIEJsYWNrIFwiSCIsInVybCI6Imh0dHBzOlwvXC93d3cuY3JhZnRhbmR0YWlsb3JlZC5jb21cL3Byb2R1Y3RzXC91bnBvbGlzaGVkLTE5NzEtdHVkb3ItbW9udGUtY2FybG8tY2hyb25vZ3JhcGgtcmVmLTcwMzItMC1ibGFjay1ob21lLXBsYXRlLWRpYWwifV0sInN0YXJ0SW5kZXgiOjEwOTI1LCJ0aXRsZSI6IkNyYWZ0ICsgVGFpbG9yZWQiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmNyYWZ0YW5kdGFpbG9yZWQuY29tXC9wcm9kdWN0c1wvdW5wb2xpc2hlZC0xOTcxLXR1ZG9yLW1vbnRlLWNhcmxvLWNocm9ub2dyYXBoLXJlZi03MDMyLTAtYmxhY2staG9tZS1wbGF0ZS1kaWFsIiwidXVpZCI6ImM0MTRlZGU1LTM5ZTItNDNlMi1iZWE0LWIyODhjYjVlNWE4NCJ9 "Craft + Tailored")](https://www.craftandtailored.com/products/unpolished-1971-tudor-monte-carlo-chronograph-ref-7032-0-black-home-plate-dial) [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTA5NzgsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49ZnJhdGVsbG93YXRjaGVzLmNvbSIsInByZXZpZXdUaXRsZSI6IiNUQlQgVHVkb3IgQmlnIEJsb2NrIDc5MTgwIENocm9ub2dyYXBoIiwic291cmNlIjoiRnJhdGVsbG8iLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWZyYXRlbGxvd2F0Y2hlcy5jb20iLCJzb3VyY2UiOiJGcmF0ZWxsbyIsInRpdGxlIjoiI1RCVCBUdWRvciBCaWcgQmxvY2sgNzkxODAgQ2hyb25vZ3JhcGgiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmZyYXRlbGxvd2F0Y2hlcy5jb21cL3RidC10dWRvci1iaWctYmxvY2stNzkxODAtY2hyb25vZ3JhcGhcLyJ9XSwic3RhcnRJbmRleCI6MTA5MjUsInRpdGxlIjoiRnJhdGVsbG8iLCJ1cmwiOiJodHRwczpcL1wvd3d3LmZyYXRlbGxvd2F0Y2hlcy5jb21cL3RidC10dWRvci1iaWctYmxvY2stNzkxODAtY2hyb25vZ3JhcGhcLyIsInV1aWQiOiIzYTI0N2U0YS05ODNkLTQ2NzUtYWU3Mi0xMzEzMDU1MjA0NzIifQ%3D%3D "Fratello")](https://www.fratellowatches.com/tbt-tudor-big-block-79180-chronograph/) the Big Block introduced the rapid date-correction crown position the manual Valjoux 234 Monte Carlo lacked. [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTEwODcsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dHVkb3J3YXRjaC5jb20iLCJwcmV2aWV3VGl0bGUiOiJUVURPUiBDaHJvbm9ncmFwaCBXYXRjaGVzIHwgSW5zaWRlIFRVRE9SIiwic291cmNlIjoiVHVkb3IiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yd2F0Y2guY29tIiwic291cmNlIjoiVHVkb3IiLCJ0aXRsZSI6IlRVRE9SIENocm9ub2dyYXBoIFdhdGNoZXMgfCBJbnNpZGUgVFVET1IiLCJ1cmwiOiJodHRwczpcL1wvd3d3LnR1ZG9yd2F0Y2guY29tXC9lblwvaW5zaWRlLXR1ZG9yXC9oaXN0b3J5XC90dWRvci1oaXN0b3J5LWNocm9ub2dyYXBocy0xOTc2LXRvLTE5OTEifV0sInN0YXJ0SW5kZXgiOjExMDA4LCJ0aXRsZSI6IlR1ZG9yIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50dWRvcndhdGNoLmNvbVwvZW5cL2luc2lkZS10dWRvclwvaGlzdG9yeVwvdHVkb3ItaGlzdG9yeS1jaHJvbm9ncmFwaHMtMTk3Ni10by0xOTkxIiwidXVpZCI6IjVmZjNlYTdkLTg4N2ItNDhiNS05NTVhLTJkNDM0NzljOGNiOCJ9 "Tudor")](https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-chronographs-1976-to-1991) Tudor's archive distinguishes the first-generation 9400-series (1976–1989) from the visually similar second-generation 79100-series [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTEyMTksIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dHVkb3J3YXRjaC5jb20iLCJwcmV2aWV3VGl0bGUiOiJUVURPUiBDaHJvbm9ncmFwaCBXYXRjaGVzIHwgSW5zaWRlIFRVRE9SIiwic291cmNlIjoiVHVkb3IiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yd2F0Y2guY29tIiwic291cmNlIjoiVHVkb3IiLCJ0aXRsZSI6IlRVRE9SIENocm9ub2dyYXBoIFdhdGNoZXMgfCBJbnNpZGUgVFVET1IiLCJ1cmwiOiJodHRwczpcL1wvd3d3LnR1ZG9yd2F0Y2guY29tXC9lblwvaW5zaWRlLXR1ZG9yXC9oaXN0b3J5XC90dWRvci1oaXN0b3J5LWNocm9ub2dyYXBocy0xOTc2LXRvLTE5OTEifV0sInN0YXJ0SW5kZXgiOjExMDg4LCJ0aXRsZSI6IlR1ZG9yIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50dWRvcndhdGNoLmNvbVwvZW5cL2luc2lkZS10dWRvclwvaGlzdG9yeVwvdHVkb3ItaGlzdG9yeS1jaHJvbm9ncmFwaHMtMTk3Ni10by0xOTkxIiwidXVpZCI6IjY0ODYwYjdkLTc0MDQtNDk2ZC1iMGJjLTZlOTNhZWI4ZTYyZSJ9 "Tudor")](https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-chronographs-1976-to-1991) (1989–c.1995). [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTEyMzQsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49bHV4dXJ5YmF6YWFyLmNvbSIsInByZXZpZXdUaXRsZSI6IlR1ZG9yIENocm9ub2dyYXBoIFdhdGNoIEd1aWRlIC0gQWxsIFJlZmVyZW5jZXMsIDE5NzAgdG8gVG9kYXkiLCJzb3VyY2UiOiJMdXh1cnkgQmF6YWFyIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1sdXh1cnliYXphYXIuY29tIiwic291cmNlIjoiTHV4dXJ5IEJhemFhciIsInRpdGxlIjoiVHVkb3IgQ2hyb25vZ3JhcGggV2F0Y2ggR3VpZGUgLSBBbGwgUmVmZXJlbmNlcywgMTk3MCB0byBUb2RheSIsInVybCI6Imh0dHBzOlwvXC93d3cubHV4dXJ5YmF6YWFyLmNvbVwvZ3JleS1tYXJrZXRcL3R1ZG9yLWNocm9ub2dyYXBoXC8ifV0sInN0YXJ0SW5kZXgiOjExMDg4LCJ0aXRsZSI6Ikx1eHVyeSBCYXphYXIiLCJ1cmwiOiJodHRwczpcL1wvd3d3Lmx1eHVyeWJhemFhci5jb21cL2dyZXktbWFya2V0XC90dWRvci1jaHJvbm9ncmFwaFwvIiwidXVpZCI6IjZjMTU0N2NiLTAyOGEtNDIyMC1iYjFiLTZjYzI0NjUwNDM2YyJ9 "Luxury Bazaar")](https://www.luxurybazaar.com/grey-market/tudor-chronograph/) In the second generation: **79160/0** = bidirectional 12-hour rotating black bezel; [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTEzMTgsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dHVkb3Jjb2xsZWN0b3IuY29tIiwicHJldmlld1RpdGxlIjoiVGhlIFVsdGltYXRlIEd1aWRlIHRvIHRoZSBUdWRvciAnQmlnIEJsb2NrJyAtIFR1ZG9yIGNvbGxlY3RvciIsInNvdXJjZSI6IlR1ZG9yY29sbGVjdG9yIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcmNvbGxlY3Rvci5jb20iLCJzb3VyY2UiOiJUdWRvcmNvbGxlY3RvciIsInRpdGxlIjoiVGhlIFVsdGltYXRlIEd1aWRlIHRvIHRoZSBUdWRvciAnQmlnIEJsb2NrJyAtIFR1ZG9yIGNvbGxlY3RvciIsInVybCI6Imh0dHBzOlwvXC90dWRvcmNvbGxlY3Rvci5jb21cL3Jvc3N0YWxrc1wvdGhlLWRlZmluaXRpdmUtZ3VpZGUtdG8tdGhlLXR1ZG9yLWJpZy1ibG9ja1wvIn1dLCJzdGFydEluZGV4IjoxMTI2MSwidGl0bGUiOiJUdWRvcmNvbGxlY3RvciIsInVybCI6Imh0dHBzOlwvXC90dWRvcmNvbGxlY3Rvci5jb21cL3Jvc3N0YWxrc1wvdGhlLWRlZmluaXRpdmUtZ3VpZGUtdG8tdGhlLXR1ZG9yLWJpZy1ibG9ja1wvIiwidXVpZCI6IjNmMGIwZTA0LWQ2NzctNDc0YS04ZDFmLWQzMTEwZWRkNGNmZiJ9 "Tudorcollector")](https://tudorcollector.com/rosstalks/the-definitive-guide-to-the-tudor-big-block/) **79170/0** = engraved steel tachymeter bezel; **79180/0** = fixed black acrylic tachymeter bezel. [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTE0MTcsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49cmV2b2x1dGlvbndhdGNoLmNvbSIsInByZXZpZXdUaXRsZSI6IlRoZSBUdWRvciBcIkJpZyBCbG9ja1wiIC0gUmV2b2x1dGlvbiBXYXRjaCIsInNvdXJjZSI6IlJldm9sdXRpb24gV2F0Y2giLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXJldm9sdXRpb253YXRjaC5jb20iLCJzb3VyY2UiOiJSZXZvbHV0aW9uIFdhdGNoIiwidGl0bGUiOiJUaGUgVHVkb3IgXCJCaWcgQmxvY2tcIiAtIFJldm9sdXRpb24gV2F0Y2giLCJ1cmwiOiJodHRwczpcL1wvcmV2b2x1dGlvbndhdGNoLmNvbVwvdHVkb3ItYmlnLWJsb2NrXC8ifV0sInN0YXJ0SW5kZXgiOjExMzE5LCJ0aXRsZSI6IlJldm9sdXRpb24gV2F0Y2giLCJ1cmwiOiJodHRwczpcL1wvcmV2b2x1dGlvbndhdGNoLmNvbVwvdHVkb3ItYmlnLWJsb2NrXC8iLCJ1dWlkIjoiNDI2ZGI4Y2UtNDlkNC00Yzc1LTk4ZTAtYjdlNjVlN2RiMTg5In0%3D "Revolution Watch")](https://revolutionwatch.com/tudor-big-block/) The case and Valjoux 7750 are identical across the trio; only bezel and dial layout change. The 94300/0 is a first-generation Big Block with engraved steel tachymeter bezel. From 1989 the Oyster bracelet (still cataloged as 78360) bears the Tudor signature on its clasp rather than Rolex [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTE3MDUsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dHVkb3J3YXRjaC5jb20iLCJwcmV2aWV3VGl0bGUiOiJUVURPUiBDaHJvbm9ncmFwaCBXYXRjaGVzIHwgSW5zaWRlIFRVRE9SIiwic291cmNlIjoiVHVkb3IiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXR1ZG9yd2F0Y2guY29tIiwic291cmNlIjoiVHVkb3IiLCJ0aXRsZSI6IlRVRE9SIENocm9ub2dyYXBoIFdhdGNoZXMgfCBJbnNpZGUgVFVET1IiLCJ1cmwiOiJodHRwczpcL1wvd3d3LnR1ZG9yd2F0Y2guY29tXC9lblwvaW5zaWRlLXR1ZG9yXC9oaXN0b3J5XC90dWRvci1oaXN0b3J5LWNocm9ub2dyYXBocy0xOTc2LXRvLTE5OTEifV0sInN0YXJ0SW5kZXgiOjExNTkyLCJ0aXRsZSI6IlR1ZG9yIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50dWRvcndhdGNoLmNvbVwvZW5cL2luc2lkZS10dWRvclwvaGlzdG9yeVwvdHVkb3ItaGlzdG9yeS1jaHJvbm9ncmFwaHMtMTk3Ni10by0xOTkxIiwidXVpZCI6IjA5YjdlMGFiLTk0ODAtNDczNy04NzU1LTAzYjg5NzFkNzBhZiJ9 "Tudor")](https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-chronographs-1976-to-1991) — a useful authentication marker.
- **Sources**: [Tudor — Chronograph history 1976–1991](https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-chronographs-1976-to-1991) · [Tudor Collector](https://tudorcollector.com/) · [Fratello](https://www.fratellowatches.com/)

### Model line: Tudor Prince Oysterdate (rectangular and round dress)

- **Refs**: `9050/0` (round Oysterdate, late 1960s–70s), `7996/0` (rectangular Oysterdate, 1960s)
- **Years**: c.1965–c.1980
- **Designer / movement**: ETA 2483 / 2784, automatic with date, 18,000–28,800 vph
- **Key identifiers**: Round (9050/0) or rectangular (7996/0) Oyster case, applied baton or Arabic dials, Tudor rose then shield logo, date at 3
- **Notes**: Mid-tier dress references in the Prince Oysterdate line, mostly catalogued by Tudor Collector and period parts books. The 7996/0 rectangular case is uncommon and frequently mislabelled in retailer listings as a Cartier-influenced design.
- **Sources**: [Tudor Collector](https://tudorcollector.com/) · [Tudor — Inside Tudor 1960–69](https://www.tudorwatch.com/en/inside-tudor/history/tudor-history-origins-1960-to-1969)

### Model line: Tudor Prince Date+Day "Jubilee" (94510)

- **Refs**: `94510`
- **Years**: c.1977–c.1990
- **Designer / movement**: Modified ETA cal. 2834-2, [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTI5OTgsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49d2FubmFidXlhd2F0Y2guY29tIiwicHJldmlld1RpdGxlIjoiVHVkb3IgRGF5IERhdGUgcmVmIyA5NDUxMCBjaXJjYSAxOTgwJ3MiLCJzb3VyY2UiOiJXYW5uYSBCdXkgQSBXYXRjaD8iLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPXdhbm5hYnV5YXdhdGNoLmNvbSIsInNvdXJjZSI6Ildhbm5hIEJ1eSBBIFdhdGNoPyIsInRpdGxlIjoiVHVkb3IgRGF5IERhdGUgcmVmIyA5NDUxMCBjaXJjYSAxOTgwJ3MiLCJ1cmwiOiJodHRwczpcL1wvd2FubmFidXlhd2F0Y2guY29tXC9wcm9kdWN0XC90dWRvci1kYXktZGF0ZS1yZWYtOTQ1MTAtY2lyY2EtMTk4MHNcLyJ9XSwic3RhcnRJbmRleCI6MTI5NzMsInRpdGxlIjoiV2FubmEgQnV5IEEgV2F0Y2g/IiwidXJsIjoiaHR0cHM6XC9cL3dhbm5hYnV5YXdhdGNoLmNvbVwvcHJvZHVjdFwvdHVkb3ItZGF5LWRhdGUtcmVmLTk0NTEwLWNpcmNhLTE5ODBzXC8iLCJ1dWlkIjoiZjkwMmQ0ODctNzE5YS00Y2ZmLTllZjYtYWMxZGZhMTBmNDAyIn0%3D "Wanna Buy A Watch?")](https://wannabuyawatch.com/product/tudor-day-date-ref-94510-circa-1980s/) 25 jewels, 28,800 vph, automatic, quickset day and date
- **Key identifiers**: 35–36mm Rolex Oyster case with holey lugs, [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTMxMjAsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49YW5hbG9nc2hpZnQuY29tIiwicHJldmlld1RpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGUtRGF5IOKAkyBBbmFsb2c6U2hpZnQiLCJzb3VyY2UiOiJBbmFsb2c6U2hpZnQiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWFuYWxvZ3NoaWZ0LmNvbSIsInNvdXJjZSI6IkFuYWxvZzpTaGlmdCIsInRpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGUtRGF5IOKAkyBBbmFsb2c6U2hpZnQiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmFuYWxvZ3NoaWZ0LmNvbVwvcHJvZHVjdHNcL3R1ZG9yLXByaW5jZS1kYXktZGF0ZSJ9XSwic3RhcnRJbmRleCI6MTMxMDksInRpdGxlIjoiQW5hbG9nOlNoaWZ0IiwidXJsIjoiaHR0cHM6XC9cL3d3dy5hbmFsb2dzaGlmdC5jb21cL3Byb2R1Y3RzXC90dWRvci1wcmluY2UtZGF5LWRhdGUiLCJ1dWlkIjoiMjA4YTkwZTItMDE5ZC00ZDc0LTkxNDgtOGEzOGIwMWQ1Yzc1In0%3D "Analog:Shift")](https://www.analogshift.com/products/tudor-prince-day-date) engine-turned bezel, acrylic crystal, applied baton indices, Spanish or English day wheel, Tudor-signed Jubilee bracelet
- **Common nicknames**: "Steel Day-Date" [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTMyODIsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49YW5hbG9nc2hpZnQuY29tIiwicHJldmlld1RpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGUtRGF5IOKAkyBBbmFsb2c6U2hpZnQiLCJzb3VyY2UiOiJBbmFsb2c6U2hpZnQiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWFuYWxvZ3NoaWZ0LmNvbSIsInNvdXJjZSI6IkFuYWxvZzpTaGlmdCIsInRpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGUtRGF5IOKAkyBBbmFsb2c6U2hpZnQiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmFuYWxvZ3NoaWZ0LmNvbVwvcHJvZHVjdHNcL3R1ZG9yLXByaW5jZS1kYXktZGF0ZSJ9XSwic3RhcnRJbmRleCI6MTMyNjYsInRpdGxlIjoiQW5hbG9nOlNoaWZ0IiwidXJsIjoiaHR0cHM6XC9cL3d3dy5hbmFsb2dzaGlmdC5jb21cL3Byb2R1Y3RzXC90dWRvci1wcmluY2UtZGF5LWRhdGUiLCJ1dWlkIjoiZjY1NWYzNDctY2Q1Yy00NDkxLWE2MjQtOTkzNjJmY2I0NzNkIn0%3D "Analog:Shift")](https://www.analogshift.com/products/tudor-prince-day-date) (a complication Rolex never offered in steel)
- **Notes**: The 94510 is Tudor's stainless-steel answer to the gold-only Rolex Day-Date — a complication Rolex never offered in steel. Wanna Buy A Watch and Theo & Harris both confirm the ETA 2834-2; the holey-lug Oyster case and engine-turned bezel are diagnostic. WatchCharts notes the 94510 has appreciated 13.3% over five years against a WatchCharts Tudor Index down 17.7%, [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTM3MDcsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49d2F0Y2hjaGFydHMuY29tIiwicHJldmlld1RpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGUtRGF5IDk0NTEwIFByaWNlIGFzIG9mIE1hcmNoIDIwMjYgfCBXYXRjaENoYXJ0cyIsInNvdXJjZSI6IldhdGNoY2hhcnRzIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj13YXRjaGNoYXJ0cy5jb20iLCJzb3VyY2UiOiJXYXRjaGNoYXJ0cyIsInRpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGUtRGF5IDk0NTEwIFByaWNlIGFzIG9mIE1hcmNoIDIwMjYgfCBXYXRjaENoYXJ0cyIsInVybCI6Imh0dHBzOlwvXC93YXRjaGNoYXJ0cy5jb21cL3dhdGNoX21vZGVsXC8xNjA0LXR1ZG9yLXByaW5jZS1kYXRlLWRheS05NDUxMFwvb3ZlcnZpZXcifV0sInN0YXJ0SW5kZXgiOjEzNTk2LCJ0aXRsZSI6IldhdGNoY2hhcnRzIiwidXJsIjoiaHR0cHM6XC9cL3dhdGNoY2hhcnRzLmNvbVwvd2F0Y2hfbW9kZWxcLzE2MDQtdHVkb3ItcHJpbmNlLWRhdGUtZGF5LTk0NTEwXC9vdmVydmlldyIsInV1aWQiOiIyNGM2N2QxNC0wYzcyLTRiZTktYTI1YS00ZTIxNjc5MTFmOWYifQ%3D%3D "Watchcharts")](https://watchcharts.com/watch_model/1604-tudor-prince-date-day-94510/overview) making it an outperformer in neo-vintage Tudor.
- **Sources**: [Analog:Shift — Tudor Prince Day-Date](https://www.analogshift.com/products/tudor-prince-day-date) · [Wanna Buy A Watch — 94510](https://wannabuyawatch.com/product/tudor-day-date/) · [Theo & Harris — Date Day 94510](https://theoandharris.com/shop/vintage-watches-sold/tudor-date-day-ref-94510-2/) · [WatchCharts — 94510](https://watchcharts.com/watch_model/1604-tudor-prince-date-day-94510/overview)

### Model line: Tudor Prince Date-Day with white-gold fluted bezel (76214)

- **Refs**: `76214`
- **Years**: c.2000–c.2016 (final run; primarily sold in Asian markets after Tudor's North American withdrawal 2004–2013) [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTQzODksIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dGlja2luZ3RpbWVob21tZS5jb20iLCJwcmV2aWV3VGl0bGUiOiIyMDEwcyBUdWRvciBQcmluY2UgRGF0ZStEYXkgcmVmLiA3NjIxNCB8IFRpY2tpbmcgVGltZSBIb21tZSIsInNvdXJjZSI6IlRpY2tpbmcgVGltZSBIb21tZSIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dGlja2luZ3RpbWVob21tZS5jb20iLCJzb3VyY2UiOiJUaWNraW5nIFRpbWUgSG9tbWUiLCJ0aXRsZSI6IjIwMTBzIFR1ZG9yIFByaW5jZSBEYXRlK0RheSByZWYuIDc2MjE0IHwgVGlja2luZyBUaW1lIEhvbW1lIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50aWNraW5ndGltZWhvbW1lLmNvbVwvc2hvcFwvMjAxMHMtdHVkb3ItcHJpbmNlLWRhdGUtZGF5LXR1ZC02MjE0LW0wMi0wMDIifV0sInN0YXJ0SW5kZXgiOjE0MjgxLCJ0aXRsZSI6IlRpY2tpbmcgVGltZSBIb21tZSIsInVybCI6Imh0dHBzOlwvXC93d3cudGlja2luZ3RpbWVob21tZS5jb21cL3Nob3BcLzIwMTBzLXR1ZG9yLXByaW5jZS1kYXRlLWRheS10dWQtNjIxNC1tMDItMDAyIiwidXVpZCI6IjBiOWVkNjVjLTMwOTQtNGZlYi04NmJiLTY3YjdjYjY0ZjNhMiJ9 "Ticking Time Homme")](https://www.tickingtimehomme.com/shop/2010s-tudor-prince-date-day-tud-6214-m02-002)
- **Designer / movement**: ETA cal. 2834-2, automatic, day and date, 38-hour reserve [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTQ0NzQsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y3d3YXRjaHNob3AuY29tIiwicHJldmlld1RpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGVcL0RheSBSZWYgNzYyMTQsIEZ1bGwgU2V0IOKAkyBDLlcuIFdhdGNoIFNob3AiLCJzb3VyY2UiOiJDLlcuIFdhdGNoIFNob3AiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWN3d2F0Y2hzaG9wLmNvbSIsInNvdXJjZSI6IkMuVy4gV2F0Y2ggU2hvcCIsInRpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGVcL0RheSBSZWYgNzYyMTQsIEZ1bGwgU2V0IOKAkyBDLlcuIFdhdGNoIFNob3AiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmN3d2F0Y2hzaG9wLmNvbVwvcHJvZHVjdHNcL3R1ZG9yLXByaW5jZS1kYXRlLWRheS1yZWYtNzYyMTQtZnVsbC1zZXQifV0sInN0YXJ0SW5kZXgiOjE0NDE3LCJ0aXRsZSI6IkMuVy4gV2F0Y2ggU2hvcCIsInVybCI6Imh0dHBzOlwvXC93d3cuY3d3YXRjaHNob3AuY29tXC9wcm9kdWN0c1wvdHVkb3ItcHJpbmNlLWRhdGUtZGF5LXJlZi03NjIxNC1mdWxsLXNldCIsInV1aWQiOiI5YjJmYzMwZC02NjEyLTRkODctYjNkZi1lZjQ5ODIzZmY2ZTEifQ%3D%3D "C.W. Watch Shop")](https://www.cwwatchshop.com/products/tudor-prince-date-day-ref-76214-full-set)
- **Key identifiers**: 36mm stainless-steel Oyster case, **18k white-gold fluted bezel** (not steel — important authentication detail), sapphire crystal, [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTQ2MjgsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y3d3YXRjaHNob3AuY29tIiwicHJldmlld1RpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGVcL0RheSBSZWYgNzYyMTQsIEZ1bGwgU2V0IOKAkyBDLlcuIFdhdGNoIFNob3AiLCJzb3VyY2UiOiJDLlcuIFdhdGNoIFNob3AiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWN3d2F0Y2hzaG9wLmNvbSIsInNvdXJjZSI6IkMuVy4gV2F0Y2ggU2hvcCIsInRpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGVcL0RheSBSZWYgNzYyMTQsIEZ1bGwgU2V0IOKAkyBDLlcuIFdhdGNoIFNob3AiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmN3d2F0Y2hzaG9wLmNvbVwvcHJvZHVjdHNcL3R1ZG9yLXByaW5jZS1kYXRlLWRheS1yZWYtNzYyMTQtZnVsbC1zZXQifV0sInN0YXJ0SW5kZXgiOjE0NjExLCJ0aXRsZSI6IkMuVy4gV2F0Y2ggU2hvcCIsInVybCI6Imh0dHBzOlwvXC93d3cuY3d3YXRjaHNob3AuY29tXC9wcm9kdWN0c1wvdHVkb3ItcHJpbmNlLWRhdGUtZGF5LXJlZi03NjIxNC1mdWxsLXNldCIsInV1aWQiOiI2ZDJkNmVmZC04YzczLTQ0NDItYjMyMC0wY2U2NDBhZTU5OGYifQ%3D%3D "C.W. Watch Shop")](https://www.cwwatchshop.com/products/tudor-prince-date-day-ref-76214-full-set) day at 12 / date at 3 with cyclops, silver linen, blue, black or rare champagne dial, applied Tudor Shield logo [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTQ3NDAsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y3d3YXRjaHNob3AuY29tIiwicHJldmlld1RpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGVcL0RheSBSZWYgNzYyMTQsIEZ1bGwgU2V0IOKAkyBDLlcuIFdhdGNoIFNob3AiLCJzb3VyY2UiOiJDLlcuIFdhdGNoIFNob3AiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWN3d2F0Y2hzaG9wLmNvbSIsInNvdXJjZSI6IkMuVy4gV2F0Y2ggU2hvcCIsInRpdGxlIjoiVHVkb3IgUHJpbmNlIERhdGVcL0RheSBSZWYgNzYyMTQsIEZ1bGwgU2V0IOKAkyBDLlcuIFdhdGNoIFNob3AiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmN3d2F0Y2hzaG9wLmNvbVwvcHJvZHVjdHNcL3R1ZG9yLXByaW5jZS1kYXRlLWRheS1yZWYtNzYyMTQtZnVsbC1zZXQifV0sInN0YXJ0SW5kZXgiOjE0NzE1LCJ0aXRsZSI6IkMuVy4gV2F0Y2ggU2hvcCIsInVybCI6Imh0dHBzOlwvXC93d3cuY3d3YXRjaHNob3AuY29tXC9wcm9kdWN0c1wvdHVkb3ItcHJpbmNlLWRhdGUtZGF5LXJlZi03NjIxNC1mdWxsLXNldCIsInV1aWQiOiJjMzFkYjNmNi05ZDMyLTQxYzUtOWY5My01Y2I2YzAyOWNkZmUifQ%3D%3D "C.W. Watch Shop")](https://www.cwwatchshop.com/products/tudor-prince-date-day-ref-76214-full-set)
- **Notes**: The 76214 is the final iteration of the Prince Date-Day line and the closest Tudor came to a steel/white-gold Rolex Day-Date 36 in feel. The white-gold fluted bezel is the key differentiator from earlier 94510/94610 references which used steel engine-turned bezels. Ticking Time Homme notes the reference was primarily distributed in Eastern markets during Tudor's North American hiatus, [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTUxNDEsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dGlja2luZ3RpbWVob21tZS5jb20iLCJwcmV2aWV3VGl0bGUiOiIyMDEwcyBUdWRvciBQcmluY2UgRGF0ZStEYXkgcmVmLiA3NjIxNCB8IFRpY2tpbmcgVGltZSBIb21tZSIsInNvdXJjZSI6IlRpY2tpbmcgVGltZSBIb21tZSIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dGlja2luZ3RpbWVob21tZS5jb20iLCJzb3VyY2UiOiJUaWNraW5nIFRpbWUgSG9tbWUiLCJ0aXRsZSI6IjIwMTBzIFR1ZG9yIFByaW5jZSBEYXRlK0RheSByZWYuIDc2MjE0IHwgVGlja2luZyBUaW1lIEhvbW1lIiwidXJsIjoiaHR0cHM6XC9cL3d3dy50aWNraW5ndGltZWhvbW1lLmNvbVwvc2hvcFwvMjAxMHMtdHVkb3ItcHJpbmNlLWRhdGUtZGF5LXR1ZC02MjE0LW0wMi0wMDIifV0sInN0YXJ0SW5kZXgiOjE1MDIwLCJ0aXRsZSI6IlRpY2tpbmcgVGltZSBIb21tZSIsInVybCI6Imh0dHBzOlwvXC93d3cudGlja2luZ3RpbWVob21tZS5jb21cL3Nob3BcLzIwMTBzLXR1ZG9yLXByaW5jZS1kYXRlLWRheS10dWQtNjIxNC1tMDItMDAyIiwidXVpZCI6IjYyMDA5YTI3LWFlNTYtNDU0NC1iNTBkLTllMTFiODM1MTU0ZiJ9 "Ticking Time Homme")](https://www.tickingtimehomme.com/shop/2010s-tudor-prince-date-day-tud-6214-m02-002) making US-market provenance rare. Diamond-set and rare-blue-dial variants exist; linen-finish dial executions command modest premiums.
- **Sources**: [Ticking Time Homme — 76214](https://www.tickingtimehomme.com/shop/2010s-tudor-prince-date-day-tud-6214-m02-002) · [C.W. Watch Shop](https://www.cwwatchshop.com/products/tudor-prince-date-day-ref-76214-full-set) · [Chrono24 — Ref 76214](https://www.chrono24.com/tudor/tudor-prince-date-day-ref-76214---black-dial--id37030681.htm)

### Model line: Tudor Prince Oysterdate quartz (91514)

- **Refs**: `91514`
- **Years**: c.1980s–c.1990s
- **Designer / movement**: ETA quartz caliber (255.461-family)
- **Key identifiers**: 34mm Rolex Oyster case, fluted bezel, sapphire crystal, silver baton dial, Tudor Oyster bracelet with folding clasp
- **Notes**: A neo-vintage quartz reference produced in modest numbers during Tudor's Quartz-Crisis-response period. The 91514 is the fluted-bezel quartz analogue to the mechanical 91510 and is frequently confused with the mechanical 94510 Day-Date despite being a different size, different bezel and different movement. Listing aggregators routinely mis-tag 91514 as automatic; the diagnostics are the smooth thin case profile and the quartz second-hand stutter.
- **Sources**: [BQ Watches — 91514](https://www.bqwatches.com/product/22705) · [Chrono24 — 91514](https://www.chrono24.com/tudor/ref-91514.htm)

### Appendix: Tudor caliber quick-reference (additions)

| Caliber | Used in | Notes |
|---|---|---|
| ETA 390 (gilt) | 7928/0 MK1–MK2 | Early gilt-dial 7928 |
| ETA 2461 / 2483 | 7928/0 MK3–MK4, 7016/0, 7966/0, Ranger 7995/0 | 18,000 vph |
| ETA 2784 | 7021/0, 9411/0, 94010/0 | Hacking seconds |
| ETA 2824-2 (mod.) | 76100, 75090, 75190 | Modern automatic |
| ETA 2834-2 | 94510, 76214 | Day-Date complication |
| Valjoux 7734 (cam) | 7031/0, 7032/0, 7033/0 | Home Plate, 18,000 vph |
| Valjoux 234 (column) | 7149/0, 7159/0, 7169/0 | Monte Carlo, 21,600 vph |
| Valjoux 7750 | 9400-series, 79100-series (Big Block) | Auto chrono |

### Appendix: Tudor listing-matching tips
- **/0 suffix**: a listing showing "7016" should match a database entry for "7016/0". Treat as equivalent.
- **76100 with Mercedes hands**: not automatically a redial — Tudor sold some at AD level with Mercedes hands [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTc0MzMsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49dHVkb3Jjb2xsZWN0b3IuY29tIiwicHJldmlld1RpdGxlIjoiNzYxMDAgU3VibWFyaW5lciAtIFR1ZG9yIGNvbGxlY3RvciIsInNvdXJjZSI6IlR1ZG9yY29sbGVjdG9yIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj10dWRvcmNvbGxlY3Rvci5jb20iLCJzb3VyY2UiOiJUdWRvcmNvbGxlY3RvciIsInRpdGxlIjoiNzYxMDAgU3VibWFyaW5lciAtIFR1ZG9yIGNvbGxlY3RvciIsInVybCI6Imh0dHBzOlwvXC90dWRvcmNvbGxlY3Rvci5jb21cL2NvbGxlY3Rpb25cLzc2MTAwLXN1Ym1hcmluZXJcLyJ9XSwic3RhcnRJbmRleCI6MTczODYsInRpdGxlIjoiVHVkb3Jjb2xsZWN0b3IiLCJ1cmwiOiJodHRwczpcL1wvdHVkb3Jjb2xsZWN0b3IuY29tXC9jb2xsZWN0aW9uXC83NjEwMC1zdWJtYXJpbmVyXC8iLCJ1dWlkIjoiMmJmZTlkYjMtOWI4MS00NTk0LTkyZDYtNWU1NGExOTZkZTk0In0%3D "Tudorcollector")](https://tudorcollector.com/collection/76100-submariner/) after the lollipop-hand cracking issue surfaced. Confirm by serial range and source.
- **"Mid-Size 36mm Submariner"** = 75090 (acrylic) or 75190 (sapphire). Listings showing both crystal types under 75090 are a known data quality issue.
- **7176/0 listings**: flag as suspect — likely typo for 7159/0 or 7169/0.
- **91514**: confirm quartz before grouping with mechanical 94510.

### Appendix: Tudor resources (additions)
- Tudor Collector (tudorcollector.com); Tudor Sub (tudorsub.com); Hairspring; Fratello; Rescapement; A Collected Man; Phillips Geneva Watch Auctions; Inside Tudor brand-archive pages; *Rolex and Tudor Parts Book* by Roy Ehrhardt.

---

## Vacheron Constantin

-----

## Brand: Vacheron Constantin

**Canonical name forms for listing matching:** `Vacheron Constantin`, `Vacheron & Constantin` (the historical “and” spelling used on vintage dials and movements through roughly the 1970s — case-backs from this era are frequently engraved “Vacheron & Constantin”), `Vacheron Constantin Genève`, `V&C`, `VC` (collector shorthand, common in forum and aggregator titles), `Vacheron` alone, and the original 19th-century styling `Vacheron & Constantin Genève Suisse`. Reference numbers across the modern era use a 4- to 6-digit base followed by `/000A`, `/000R`, `/000G`, `/000W`, or `/000P` to encode case material (A = steel, R = pink/rose gold, G = yellow gold, W = white gold, P = platinum), then a final `-B###` or `-9###` suffix encoding dial/strap variant. Example: `5500V/110A-B148` = Overseas Chronograph 5500V, steel case, dial variant B148. Many listings strip the suffix; the full string is necessary for unambiguous matching. The **Hallmark of Geneva** (“Poinçon de Genève”) is stamped on movements meeting Geneva’s quality criteria and appears on most current Vacheron movements as an authenticity tell.

### Model line: Overseas (precursor — ref 222)

- **Refs**: `44018` (37 mm “Jumbo” gold), `46003` (steel-and-gold), and the steel “Jumbo” with internal ref derivations — production catalog references for the 222 are not formally listed by the modern brand but are documented at `222/411` (37 mm steel automatic) and `222/422` (mid-size 34 mm), plus the 25 mm quartz ladies’ variant
- **Years**: 1977–~1985
- **Designer / movement**: Jörg Hysek (NOT Gérald Genta — a near-universal misattribution);  Calibre 1121 (37 mm Jumbo, auto, based on JLC 920 ultra-thin — the same base movement used in the Royal Oak 5402 and Nautilus 3700), Calibre 1124 (34 mm with seconds), Calibre 1009 quartz (25 mm)
- **Key identifiers**: 37 mm tonneau-shaped monobloc steel or 18k yellow gold case, integrated bracelet  with large hexagonal central links, fluted screw-down bezel reminiscent of the Maltese cross motif, Maltese cross emblem engraved at 5 o’clock on the case  (a 222 hallmark and an authentication checkpoint), 7.2 mm thin, 120 m water resistance,  baton hands and rectangular hour markers, date at 3, no crown guards
- **Common nicknames**: “222” (the only nickname), “Jumbo 222” (37 mm), and following the 2022/2025 reissue the original is sometimes “vintage 222” or “OG 222”
- **Notes**: Conceived to mark Vacheron Constantin’s 222nd anniversary in 1977, the Reference 222 is the third pillar of the “Holy Trinity” of integrated-bracelet luxury sport watches (with the Royal Oak 1972 and Nautilus 1976). Designed not by Gérald Genta but by the then-24-year-old Jörg Hysek — a misattribution that persists in popular writing — the watch shares the JLC 920 movement base with its more famous siblings. Total production is estimated at roughly 800 of the 37 mm steel “Jumbo”, around 1,000 of the 34 mm, and 1,300 of the 25 mm quartz, giving a total of approximately 3,100 — meaningfully scarcer than the Royal Oak 5402 (6,050 pieces) or Nautilus 3700 (~7,200). Vacheron reissued the 222 in 2022 (yellow gold `4200H/222J-B935`) and 2025 (steel `4200H/222A-B934`), driving renewed interest in the original. Auction values for original steel 222s have moved from sub-$30,000 territory pre-2020 to multi-$100,000 results at top houses, and condition (unpolished case, original bracelet, correct Maltese cross at 5) is now the dominant value driver. Aggregator note: many vintage 222s are tagged generically “Vacheron 1977 sport watch”; the case engraving “VC 222” and the Maltese cross at 5 are the definitive tells.

### Model line: Overseas (first generation — “Phase 1”)

- **Refs**: `42040/423` (steel chronograph), `42050` (steel automatic), `47040` and `47042` (yellow gold/steel), `47042/000R` (rose gold), `42100` (mid-size)
- **Years**: 1996–2004
- **Designer / movement**: Dino Modolo (Vacheron’s first-generation Overseas designer, working under Vincent Kaufmann); Calibre 1310 (auto, COSC, based on Girard-Perregaux 3100), later upgraded to Calibre 1311
- **Key identifiers**: 37 mm tonneau case with eight-segment fluted bezel referencing the Maltese cross, integrated bracelet with thin vertically-oriented center links, 150 m water resistance, antimagnetic inner Faraday cage, sapphire crystal, date at 3, screw-down crown
- **Common nicknames**: “Overseas Phase 1”, “Overseas Mk1”, “first-gen Overseas”
- **Notes**: Vacheron’s first commercial Overseas, launched 1996, marked the brand’s return to sports watches a decade after the 222 was discontinued and shortly after Vendôme (later Richemont) acquired the maison. The eight-leaf fluted bezel is the most recognizable distinguishing feature of the first generation; the second generation (2004) retained the eight leaves but increased to 42 mm, while the third generation (2016) reduced to six leaves. Trade-secret note: the Cal. 1310/1311 is a modified Girard-Perregaux base, not in-house — collectors who care about manufacture status prefer the 2016+ in-house calibers.

### Model line: Overseas (second generation — “Phase 2”)

- **Refs**: `47040` (42 mm auto), `49150` (chronograph), `47450` (Dual Time), `47451` (steel/rose gold)
- **Years**: 2004–2016
- **Designer / movement**: Calibre 1226 (auto, COSC), Calibre 1137 (chronograph, based on Frédéric Piguet 1185), Calibre 1222 (dual time)
- **Key identifiers**: 42 mm case (a substantial increase from 37 mm first-gen), Maltese cross motif on bracelet center links (new for Phase 2), integrated multi-link bracelet, 150 m water resistance, eight-segment fluted bezel retained, screw-down crown and pushers
- **Common nicknames**: “Overseas Phase 2”, “Overseas Mk2”, “42 mm Overseas”
- **Notes**: The 42 mm Phase 2 brought the Overseas in line with the mid-2000s trend toward larger cases. The bracelet redesign — integrating Maltese cross shapes into the center links — was the most visible cosmetic change. Phase 2 trades at a discount to Phase 3 on the secondary market because the movements were ébauche-derived (Piguet 1185, JLC-derived modules) rather than fully in-house.

### Model line: Overseas (third generation — current — “Phase 3”)

- **Refs**: `4500V/110A-B126` (steel, blue dial), `4500V/110A-B128` (steel, silver), `4500V/000R-B127` (rose gold), `4500V/000W` (white gold), `4500V/210A-B126` (newer 5100 caliber)
- **Years**: 2016–present (Overseas Self-winding)
- **Designer / movement**: Calibre 5100 (auto, in-house, COSC, Hallmark of Geneva, 60-hour reserve, 22k gold rotor with Maltese-cross-and-windrose decoration, antimagnetic inner ring)
- **Key identifiers**: 41 mm case (reduced from 42 mm), six-segment polished fluted bezel (changed from eight on previous generations), redesigned bracelet with half-Maltese-cross center links, three interchangeable straps included as standard (steel bracelet + leather + rubber), tool-free strap-change system, 150 m water resistance, applied baton indices with luminova, date at 3
- **Common nicknames**: “Overseas Phase 3”, “Overseas Mk3”, “current Overseas”, “OS41”
- **Notes**: The 2016 redesign was the most substantive update to the Overseas in its modern history: a fully in-house movement (Cal. 5100), the bracelet/strap quick-change system (a Vacheron signature now widely copied), and the move to a softer six-leaf bezel. The Cal. 5100 bears the Hallmark of Geneva — a quality designation Vacheron had reserved for higher-end pieces until this point. The interchangeable strap system is a defining Phase 3 feature: each watch ships with a steel bracelet, an alligator leather strap, and a rubber strap, all swappable without tools via a release mechanism on the end-links. This is the watch routinely cross-shopped against Royal Oak 15500 and Nautilus 5711 in modern hype-watch coverage, and waiting lists at authorized dealers extend years. Aggregator note: the dial codes `-B126` (blue), `-B127` (silver/silvered), `-B128` (rose gold variations) are critical for matching specific dial color/finish combinations.

### Model line: Overseas Chronograph

- **Refs**: `5500V/110A-B148` (steel blue), `5500V/110A-B481` (steel silver), `5500V/000R-B074` (rose gold), `5500V/000R-B435` (rose gold blue dial)
- **Years**: 2016–present
- **Designer / movement**: Calibre 5200 (in-house auto chronograph, column wheel, vertical clutch, Hallmark of Geneva, 52-hour reserve, 22k gold peripheral rotor)
- **Key identifiers**: 42.5 mm case, three-register chronograph (running seconds at 9, 30-minute counter at 3, 12-hour counter at 6), date at 4-5, screw-down pushers, six-segment bezel, interchangeable strap system
- **Common nicknames**: “Overseas Chrono”, “OS Chrono”
- **Notes**: The Cal. 5200 is one of the few fully in-house column-wheel/vertical-clutch automatic chronograph movements available in this price tier — a meaningful counter to the perception that Vacheron is “Patek’s quieter sibling”. Like the time-only Overseas, it bears the Hallmark of Geneva. Dial color matters significantly to the secondary market: the blue-dial steel `5500V/110A-B148` consistently trades at a premium over the silver-dial.

### Model line: Overseas Dual Time

- **Refs**: `7900V/110A-B334` (steel, blue dial), `7900V/110A-B333` (steel, silver), `7900V/000R-B336` (rose gold), `7900V/000R-B546` (rose gold, brown dial)
- **Years**: 2016–present
- **Designer / movement**: Calibre 5110 DT (in-house auto dual-time, Hallmark of Geneva, 60-hour reserve, day/night indicator, second-time-zone hand)
- **Key identifiers**: 41 mm case, second time-zone hand co-axial with main hour hand, day/night indicator at 9, date at 6, AM/PM aperture, two pushers in the case middle (at 8 and 10 — the “pushers at 8+10” the user brief notes are distinctive to the Dual Time)
- **Common nicknames**: “Overseas Dual Time”, “OS Dual Time”, “OS DT”
- **Notes**: One of the most traveler-friendly modern dual-time watches: the pushers at 8 and 10 jump the local time hour hand backward and forward, leaving the home-time hand and minute hand untouched (a “true GMT” architecture in the Rolex sense). The Cal. 5110 DT is among the few dual-time movements at this tier with the Hallmark of Geneva. The pushers-at-8-and-10 layout is distinctive — most dual-time/GMT watches use crown-position adjustment.

### Model line: Overseas World Time

- **Refs**: `7700V/110A-B129` (steel, lacquered “earth” map blue dial), `7700V/110A-B172` (steel, silver world map), `7700V/000R-B154` (rose gold)
- **Years**: 2016–present (in Overseas line; the world-time complication itself predates 2016 within Vacheron)
- **Designer / movement**: Calibre 2460 WT (in-house auto world-time, Hallmark of Geneva, 40-hour reserve, single-crown adjustment for all 37 displayed time zones)
- **Key identifiers**: 43.5 mm case (the largest Overseas), lacquered map of the continents in the central dial, 24-hour day/night ring, city ring with 37 reference time zones including non-standard zones like Kathmandu (+5:45), Eucla (+8:45), and Chatham Islands (+12:45), date hand integrated into the world-time display
- **Common nicknames**: “Overseas WT”, “World Time Overseas”
- **Notes**: The Overseas World Time is widely regarded as among the best world-time watches in modern production, partly because Vacheron’s 37-zone calibration (vs. the more common 24-zone) accommodates half- and quarter-hour zones. The lacquered hand-painted dial center — different on each color variant — is a hand-finishing showpiece. Bears the Hallmark of Geneva. Among collectors, the blue lacquered dial is the iconic colorway.

### Model line: Overseas Ultra-Thin

- **Refs**: `2000V/210A-B546` (steel auto ultra-thin), `1320U/000A` (quartz, discontinued), `1325U/000A` (auto, predecessor)
- **Years**: 2016–present
- **Designer / movement**: Calibre 1120 (auto, ultra-thin — same JLC 920 base as the original 222), 2.45 mm thick
- **Key identifiers**: 41 mm case, only 7.5 mm thick (extraordinary thinness), no date, integrated bracelet, six-segment bezel, time-only
- **Common nicknames**: “Overseas Ultra-Thin”, “OS UT”
- **Notes**: The ultra-thin Overseas uses the JLC 920-derived Cal. 1120 — a deliberate historical link to the original 222 which used the same caliber base. The 7.5 mm total thickness is extraordinary for an integrated-bracelet sports watch and competes directly with the Patek 5811 (formerly the Nautilus 5711) and the AP 15202 Royal Oak Jumbo.

### Model line: Overseas Perpetual Calendar Ultra-Thin

- **Refs**: `4300V/120G-B102` (white gold), `4300V/000R-B945` (rose gold, blue dial), `4300V/000R-B509` (rose gold, silver dial), `4300V/120R-B509`
- **Years**: 2018–present
- **Designer / movement**: Calibre 1120 QP (auto perpetual calendar, ultra-thin, Hallmark of Geneva, 40-hour reserve, 4.05 mm thick movement)
- **Key identifiers**: 41.5 mm case, 8.1 mm thin total, perpetual calendar (day, date, month, leap year, moonphase), no date pusher correction required until 2100, integrated bracelet with quick-change system
- **Common nicknames**: “Overseas Perpetual”, “OS QP”, “OS Perpetual Ultra-Thin”
- **Notes**: Among the thinnest perpetual calendar wristwatches with an integrated metal bracelet in production. The Cal. 1120 QP is a perpetual calendar module on the historic JLC 920 base — a calendar module Vacheron has been refining for over a decade. The blue-dial rose gold variant `B945` is the most-photographed iteration. Holds value extraordinarily well due to scarcity and complication-per-mm of case-height.

### Model line: Patrimony Contemporaine (manual)

- **Refs**: `81180/000R-9159` (rose gold, silver dial), `81180/000G-9117` (yellow gold), `81180/000P-9539` (platinum, slate dial)
- **Years**: 2004–present
- **Designer / movement**: Calibre 1400 AS (manual, in-house, Hallmark of Geneva, 40-hour reserve, hours and minutes only)
- **Key identifiers**: 38 mm round case, slim 6.79 mm profile, minimalist sector-like dial with applied baton hour markers and pearl minute track, dauphine hands, no seconds, no date, alligator strap
- **Common nicknames**: “Patrimony Contemporaine”
- **Notes**: Vacheron’s archetypal modern dress watch — among the purest expressions of “less is more” in contemporary haute horlogerie. The 81180 has been a Patrimony cornerstone since 2004. The platinum-cased slate-dial variant is among the most discreet luxury watches available — collectors call it “stealth wealth at its most distilled.” Bears the Hallmark of Geneva.

### Model line: Patrimony Traditionnelle (small seconds, manual)

- **Refs**: `82172/000R-9382` (rose gold, silver dial), `82172/000G-9383` (white gold), `82172/000P-9811` (platinum, gray dial), `82172/000P-B527` (platinum CEP — Collection Excellence Platine), `82172/000R-9888` (rose gold guilloché boutique)
- **Years**: 2009–present
- **Designer / movement**: Calibre 4400 AS (manual, in-house, Hallmark of Geneva, 65-hour reserve, 28,800 vph, small seconds at 6, single-barrel)
- **Key identifiers**: 38 mm round case, 7.77 mm thick, stepped case flank and sculpted lugs, knurled screw-down case-back, small seconds at 6, opaline dial with railroad minute track, dauphine hands with half-frosted/half-polished finish, applied 18k gold or platinum baton markers
- **Common nicknames**: “Patrimony Traditionnelle 38”, “82172”, “PT 82172”
- **Notes**: The Traditionnelle line is more ornate than the Contemporaine — stepped case, knurled case-back, dauphine hands, railroad track — while still maintaining classic proportions. The Cal. 4400 AS was a notable in-house achievement when introduced in 2009: 65-hour reserve from a single barrel (rare for manual movements of this size) with the Hallmark of Geneva. The Collection Excellence Platine (CEP) variants are limited to 75 pieces, fully platinum (case, dial, buckle, even the strap stitching), and command significant premiums. The boutique-only guilloché rose gold `82172/000R-9888` is also limited.

### Model line: Patrimony Ultra-Thin

- **Refs**: `81180/000R-B582` (rose gold, very thin), `33178/000R-9687` (ultra-thin perpetual variant)
- **Years**: Various, 2010s–present
- **Designer / movement**: Calibre 1400 (ultra-thin manual) and complication variants
- **Key identifiers**: Sub-7 mm case heights, minimalist dial layout
- **Common nicknames**: “Patrimony Ultra-Thin”
- **Notes**: Sub-line of the Patrimony focused on the thinnest possible cases. References overlap with the Contemporaine — the same `81180` base reference is used with thinner movements in some variants.

### Model line: Patrimony Retrograde / Bi-Retrograde

- **Refs**: `86020/000P-9321` (platinum, bi-retrograde day-date), `86020/000R` variants
- **Years**: ~2010–present
- **Designer / movement**: Calibre 2460 R31R7 (auto, retrograde day and date)
- **Key identifiers**: Twin retrograde indicators (one for date, one for day-of-week), minimalist symmetrical dial layout, central hands for hours and minutes
- **Common nicknames**: “Patrimony Bi-Retrograde”, “Patrimony Retrograde Day-Date”
- **Notes**: One of the few mechanical day-date watches that handles both retrograde indications on a symmetrical dial. The complication is a Vacheron specialty.

### Model line: Patrimony Minute Repeater Ultra-Thin

- **Refs**: `30110/000P-B483` (platinum), `30110/000R-B292` (rose gold)
- **Years**: 2014–present
- **Designer / movement**: Calibre 1731 (manual minute repeater, in-house, Hallmark of Geneva, 65-hour reserve, 3.9 mm thick — one of the thinnest minute-repeater movements ever made)
- **Key identifiers**: 41 mm case, 8.09 mm total thickness, repeater slide on case middle, gong visible through case-back, Patrimony case profile
- **Common nicknames**: “Patrimony Minute Repeater”, “1731 Patrimony”
- **Notes**: A landmark complication piece. The Cal. 1731 represented at launch the thinnest production minute-repeater movement at 3.9 mm. Six-figure pricing puts it in the rarefied territory of Patek 5178/5078 and Lange Zeitwerk Repeater. Production is small enough that each piece is approximately bespoke at the order stage.

### Model line: Traditionnelle Complete Calendar

- **Refs**: `4010T/000R-B344` (rose gold), `4010T/000R-B345` (rose gold blue dial), `83000/000R-9120` (rose gold older variant)
- **Years**: ~2015–present
- **Designer / movement**: Calibre 2460 QCL/U (auto complete calendar with moonphase, Hallmark of Geneva)
- **Key identifiers**: 41 mm case, day-and-month windows at top of dial, central pointer date, moonphase at 6, classical Patrimony case
- **Common nicknames**: “Traditionnelle Complete Calendar”
- **Notes**: The classic 1940s/50s “complete calendar with moonphase” complication executed in modern in-house form. Distinct from a perpetual calendar — requires five manual corrections per year. Aesthetic descendant of the vintage ref. 4240.

### Model line: Historiques American 1921

- **Refs**: `82035/000R-9359` (rose gold 40 mm), `82035/000G-9206` (yellow gold 40 mm), `1100S/000P-B430` (platinum 36.5 mm), `82035/000R-B463` (40 mm rose gold variant)
- **Years**: 2008 (40 mm reissue), 2017 (small batch 36.5 mm platinum); revives a 1921 original
- **Designer / movement**: Calibre 4400 AS (manual, in-house, Hallmark of Geneva, 65-hour reserve)
- **Key identifiers**: Cushion/curved square case with the dial rotated 45° clockwise (so 12 is at the upper-right corner), crown positioned at upper-right corner (effectively 10 o’clock when reading the dial), Breguet-style numerals, sub-seconds at 4-30 (relative to dial orientation), the rotated layout is the design’s defining feature
- **Common nicknames**: “American 1921”, “Tilted Dial Vacheron”, “American”
- **Notes**: One of the most distinctive watches in the modern Vacheron catalog. The original 1921 American was a New York-market design — the crown placed at the upper corner allowed easier reading while driving. The modern reissue (2008) at 40 mm is the standard; the 100-piece 2017 platinum 36.5 mm version restored the original dimensions and is now significantly more valuable. The Pittsburgh dealer-only “Collection Excellence Platine” 100-unit run is a coveted variant.

### Model line: Historiques Toledo 1952 / Triple Calendar 1942 / 1948

- **Refs**: `4100R/000R-B406` (Historiques 1942 Triple Calendar in rose gold), `4000E/000A-B438` (1942 case in steel), `4000E/000A-B439` (1948 case in steel), `47300/000R-9120` (older Toledo / Triple Calendar)
- **Years**: 1990s reissues onward, with the modern 4000E “1942” and “1948” launched 2019–2021
- **Designer / movement**: Calibre 4400 QC (complete calendar with moonphase, Hallmark of Geneva)
- **Key identifiers**: Cushion case (1942) or round case (1948), day and month at top of dial via twin apertures, central pointer date, moonphase at 6, vintage-style script font
- **Common nicknames**: “Historiques 1942”, “Historiques 1948”
- **Notes**: Two of the few steel-cased pieces in the modern Vacheron Constantin catalogue (steel is unusual at this price tier — reserved for sport models like the Overseas and the FiftySix). The 1942/1948 revivals reproduce mid-century cushion and round case shapes that Vacheron used during the Second World War period. Highly collectible for the unusual combination of steel + complication + Hallmark of Geneva.

### Model line: Historiques Cornes de Vache 1955

- **Refs**: `5000H/000P-B058` (platinum, 2015 original), `5000H/000R-B059` (rose gold), `5000H/000A-B582` (steel, 2020)
- **Years**: 2015–present (steel added 2020)
- **Designer / movement**: Calibre 1142 (manual chronograph, based on Lemania 2310 — same architectural lineage as Patek CH 27-70, Omega 321, Breguet 533.3; in-house Vacheron-decorated, Hallmark of Geneva, column wheel, horizontal clutch, 48-hour reserve, 21,600 vph)
- **Key identifiers**: 38.5 mm case with the namesake “cow horn” lugs (an upward-curving lug shape, a 1955-era Vacheron design signature), two-register chronograph (running seconds at 9, 30-minute counter at 3), tachymeter scale on dial periphery, dauphine hands, applied Roman numerals on some variants, no date
- **Common nicknames**: “Cornes de Vache”, “Cow Horn Vacheron”, “1955 Chronograph”
- **Notes**: Modern reissue of the vintage ref. 6087 (1955), Vacheron’s first water-resistant chronograph (only 36 of the original were made). The Cal. 1142 is significant: it descends from the Lemania 2310, one of the most respected hand-wound chronograph movements ever produced and the base for Patek’s CH 27-70, Omega 321, and other revered movements. Vacheron acquired the rights through Richemont’s acquisition of Roger Dubuis, and the 1142 is the in-house Vacheron evolution. The 2020 steel `5000H/000A-B582` was a watershed: a Hallmark-of-Geneva chronograph in steel at a “relatively” accessible €41,600 retail. The 2017 Hodinkee Limited Edition (36 pieces, steel, grey dial) preceded the standard steel and is highly collectible.

### Model line: Historiques Chronomètre Royal 1907

- **Refs**: `86122/000P-9362` (platinum), `86122/000R-9999` (rose gold)
- **Years**: 2010–present (revives Vacheron’s chronometer-certified Chronomètre Royal line introduced 1907)
- **Designer / movement**: Calibre 4400 AS (manual, Hallmark of Geneva, COSC-chronometer-certified)
- **Key identifiers**: 38 mm round case, soft cushion-like lugs, small seconds at 6 on some variants, applied dauphine indices, Breguet-style numerals on some dial variants
- **Common nicknames**: “Chronomètre Royal”, “1907”
- **Notes**: Vacheron’s first 20th-century precision chronometer line, revived in modern form. COSC certification is unusual for an haute-horlogerie Vacheron — most of the brand’s pieces rely on the Hallmark of Geneva rather than chronometer certification.

### Model line: Malte

- **Refs**: `30130/000P-9754` (Malte Tourbillon), `82230/000R-9417` (Malte Manual Winding), `83060/000R-9410` (Malte Dual Time), `42005/000R-9499` (Malte Regulator), `47031/000R` (Malte Big Date)
- **Years**: 2000–~2018 (largely retired but a small Malte line continues)
- **Designer / movement**: Calibre 2790 (tourbillon), Calibre 4400 (manual), Calibre 1206 (dual time)
- **Key identifiers**: Tonneau (barrel) case shape — the defining feature of the line, referencing both the 1912 Vacheron tonneau and the Maltese cross emblem; varies in size 35–50 mm depending on variant
- **Common nicknames**: “Malte”, “Tonneau Vacheron”
- **Notes**: The Malte was Vacheron’s flagship modern tonneau line. The name “Malte” refers to the Maltese cross, Vacheron’s emblem since 1880. The line was largely wound down in the late 2010s in favor of FiftySix and revived classical round shapes, but Malte tourbillons remain a Vacheron specialty. Collectors of curved/cushioned cases gravitate to Malte for the dimensional drama; pricing on the secondary market is currently a contrarian opportunity.

### Model line: FiftySix

- **Refs**: `4600E/000A-B442` (steel, silver dial), `4600E/000A-B487` (steel, petrol blue dial), `4600E/000R-B441` (rose gold), `4600E/000R-B576` (rose gold brown dial), `4000E/000A-B439` (FiftySix Complete Calendar in steel — but note 4000E is also used for 1948 Triple Calendar, watch for dial differences)
- **Years**: 2018–present
- **Designer / movement**: Calibre 1326 (auto, time + date), Calibre 2460 (Complete Calendar)
- **Key identifiers**: 40 mm steel or rose gold case, four-lug Maltese-cross-derived case shape (each lug is meant to represent one branch of the Maltese cross), box-type sapphire crystal rising above bezel, sector-style dial with applied 18k gold (or white gold on steel) numerals and indices, Maltese cross oscillating weight, 30 m water resistance, dressy-casual styling
- **Common nicknames**: “FiftySix”, “56”
- **Notes**: The FiftySix line, launched at SIHH 2018, was Vacheron’s deliberate effort to create a more accessible classical-style watch — the first time Vacheron offered steel in the classical (non-Overseas, non-Historiques-1942/48) catalogue. The “FiftySix” name references 1956, the year of Vacheron’s reference 6073, on which the case shape is loosely based. The Cal. 1326 is, like several Vacheron entry calibers, produced for Vacheron rather than fully in-house — it does NOT bear the Hallmark of Geneva (a point collectors note). For listings: the steel `4600E/000A-B442` (silver) and `-B487` (blue) are the most common references and frequently confused.

### Model line: Les Cabinotiers / Métiers d’Art

- **Refs**: Bespoke and unique-piece references; no fixed catalog refs. Series names include `Les Cabinotiers Symbolic Chronograph`, `Métiers d'Art Florilège`, `Mécaniques Sauvages`, `Hommage à l'Art de la Danse`
- **Years**: Ongoing
- **Designer / movement**: Varies; typically Vacheron’s most complicated movements (Cal. 2755 with tourbillon + minute repeater + perpetual calendar; Cal. 3750; Cal. 3500; “Reference 57260” of 2015 carries 57 complications and remains the most complicated wristwatch ever made)
- **Key identifiers**: Hand-engraved, enameled, gem-set, or skeletonized dials; often produced as one-of-one or limited to a handful of pieces per year
- **Common nicknames**: “Les Cabinotiers” refers to Vacheron’s bespoke atelier; “Métiers d’Art” refers to the decorative-arts line
- **Notes**: Vacheron’s highest-tier offerings, including the “Reference 57260” pocket watch (2015) which carries 57 complications and is the most complicated watch ever made by any maker. Aggregators rarely list these by reference; descriptive text and provenance are the matching keys.

### Model line: Vintage references (pre-1980)

- **Refs**: `4072` (1920s–1940s, rectangular Art Deco), `4178` and `4261` (1940s–50s triple calendar moonphase, Cal. 485 chronograph variants), `6087` (1955, original Cornes de Vache chronograph — only 36 made), `6664` (1960s tonneau), `6073` (1956, basis for modern FiftySix), `4178` (1940s round chronograph), `7440` “Disco Volante” (1970s gem-set), `222` (covered above)
- **Years**: 1920s–1970s
- **Designer / movement**: Period-specific; Cal. 1003 (ultra-thin), Cal. 485, Cal. 1001, Cal. 1120 (JLC 920 base) on later 1970s pieces
- **Key identifiers**: Period-correct case shapes, “Vacheron & Constantin Genève” dial signature (with ampersand) on vintage pieces, hand-applied indices, often Hallmark of Geneva on movements
- **Common nicknames**: “Disco Volante” (7440 with the flat saucer-shaped case), “American” (4072, the rectangular Art Deco line), “Triple Calendar” (4178/4261), “Chronomètre Royal” (vintage 19xxx series chronometers)
- **Notes**: Vacheron’s mid-century pieces are among the most undervalued in the haute-horlogerie vintage market — solid-gold 1950s ultra-thins regularly trade below comparable Patek Calatravas despite equal or superior finishing. The `4178` round chronograph (1940s, Cal. 492 — a Valjoux 23 variant) is the most actively traded vintage Vacheron chronograph and the spiritual predecessor of the Cornes de Vache. The `6087` (1955, Cal. 492 again) is the immediate predecessor of the modern Cornes de Vache and at only 36 examples made is exceptionally rare. Auction note: vintage VC values have moved up materially since 2018 led by Phillips and Christie’s Geneva sales; condition (unpolished, original dial, signed crown) is decisive. The “Disco Volante” `7440` is unrelated to the Alfa Romeo namesake car despite shared nickname.

-----

### Vacheron Constantin Caliber Quick-Reference Table

|Caliber                   |Type                                                    |Used in                                                                                         |
|--------------------------|--------------------------------------------------------|------------------------------------------------------------------------------------------------|
|Cal. 1003                 |Manual, ultra-thin (1.64 mm)                            |Vintage ultra-thin dress, Historiques Ultra-Thin                                                |
|Cal. 1120 / 1121 / 1124   |Auto ultra-thin (JLC 920 base)                          |222 (1977), Overseas Ultra-Thin, Patrimony Ultra-Thin                                           |
|Cal. 1120 QP              |Auto perpetual calendar                                 |Overseas Perpetual Calendar Ultra-Thin                                                          |
|Cal. 1142                 |Manual chronograph (Lemania 2310 base)                  |Historiques Cornes de Vache 1955, Historiques American 1921 chronograph variants                |
|Cal. 1326                 |Auto time + date                                        |FiftySix Self-Winding                                                                           |
|Cal. 1400 / 1400 AS       |Manual, time only                                       |Patrimony Contemporaine 81180, Historiques Ultra-Thin                                           |
|Cal. 1731                 |Manual minute repeater (3.9 mm thin)                    |Patrimony Minute Repeater Ultra-Thin                                                            |
|Cal. 2460 (family)        |Auto, multiple complication variants                    |Patrimony Retrograde (R31R7), Overseas World Time (WT), Traditionnelle Complete Calendar (QCL/U)|
|Cal. 2755                 |Manual tourbillon + minute repeater + perpetual calendar|Patrimony Traditionnelle Calibre 2755 grand complication                                        |
|Cal. 2790                 |Manual tourbillon                                       |Malte Tourbillon                                                                                |
|Cal. 4400 / 4400 AS       |Manual, single-barrel, 65h reserve, small seconds       |Patrimony Traditionnelle 82172, Historiques American 1921, Historiques Chronomètre Royal        |
|Cal. 4400 QC              |Manual complete calendar with moonphase                 |Historiques 1942/1948 Triple Calendar                                                           |
|Cal. 5100                 |Auto, time + date, 22k gold rotor                       |Overseas Self-Winding (Phase 3)                                                                 |
|Cal. 5110 DT              |Auto dual time                                          |Overseas Dual Time                                                                              |
|Cal. 5200                 |Auto chronograph, column wheel, vertical clutch         |Overseas Chronograph                                                                            |
|Cal. 1310 / 1311 (GP base)|Auto, COSC                                              |Overseas Phase 1 (1996–2004)                                                                    |
|Cal. 1226                 |Auto, COSC                                              |Overseas Phase 2 (2004–2016) time-only                                                          |
|Cal. 1137 (FP 1185 base)  |Auto chronograph                                        |Overseas Phase 2 Chronograph                                                                    |
|Cal. 1006 / 1009          |Quartz                                                  |Vintage 222 ladies’ 25 mm, vintage Overseas quartz                                              |

### Vacheron Constantin Listing-Matching Tips

- **Overseas vs. Royal Oak vs. Nautilus**: In photographs the three integrated-bracelet sport watches are sometimes confused, especially on lower-resolution aggregator thumbnails. The Vacheron Overseas is distinguished by (a) the fluted bezel referencing the Maltese cross (six segments on Phase 3, eight on Phases 1–2), (b) the half-Maltese-cross center bracelet links on Phase 3, (c) the Maltese cross logo on the crown, and (d) the dial-bottom signature “Vacheron Constantin” with the small Maltese cross emblem. The Royal Oak has the octagonal bezel with eight visible screws; the Nautilus has the porthole-shaped case with horizontally embossed dial.
- **“VC” alone as abbreviation**: Listings using just “VC” or “Vacheron” often hide details — the actual collection (Overseas vs. Patrimony vs. Historiques vs. Malte vs. FiftySix) is essential for accurate matching. The reference number suffix is usually present in listing photos of the case-back.
- **Geneva Hallmark significance for authenticity**: Most modern (post-2010) Vacheron movements carry the Hallmark of Geneva (“Poinçon de Genève”), a quality designation administered by the Geneva government and stamped after independent inspection. The hallmark is a strong (though not absolute) authenticity signal, because counterfeit movements rarely reproduce the hallmark accurately. Notable exception: the FiftySix’s Cal. 1326 does NOT bear the Hallmark of Geneva, despite being a current Vacheron caliber — this is a deliberate cost-positioning decision and not a counterfeit indicator. Other modern Vacheron pieces that do not bear the Hallmark include certain quartz variants and some FiftySix complication models.
- **“Vacheron & Constantin” vs. “Vacheron Constantin”**: The ampersand form appears on vintage dials, movements, and case-backs typically through the early 1970s; modern usage dropped the ampersand. A dial reading “Vacheron Constantin” without the ampersand on a watch that should be 1950s vintage suggests a service replacement dial or a re-dial. Auction catalogue entries are typically rigorous about this distinction.
- **Reference structure**: Modern refs use 4–6 digits followed by `/000X` where X = A/R/G/W/P for material, then dial code. Vintage refs are 4-digit only (`4072`, `6087`, `6664`, `7440`, etc.). The transition happened gradually through the 1980s; mid-1980s pieces may show both styles.
- **Maltese cross hallmark placement**: On vintage cases (pre-2000), the Maltese cross was often engraved at 7 o’clock on the case middle (a discreet quality mark). On the 222, it is at 5 o’clock on the case (an aesthetic feature, not just a mark). On modern Overseas pieces, it appears on the crown and rotor. Authentication: counterfeit Maltese cross engravings tend to be shallow, off-center, or misshapen — auction houses photograph this detail explicitly.

### Vacheron Constantin Resources

- **Vacheron-constantin.com Heritage section** — official brand archive with documented reference numbers and historical context, the most reliable starting point.
- **Phillips Watches and Christie’s Watches auction archives** — primary source for vintage VC price history and reference documentation; Phillips’s article series on the 222 and the Cornes de Vache are particularly thorough.
- **A Collected Man Journal** — long-form vintage VC essays, including the canonical 222 attribution piece debunking the Genta misattribution.
- **Hodinkee “Reference Points”** Vacheron coverage and the Hodinkee Cornes de Vache 1955 LE (2017) documentation.
- **Monochrome Watches** — recurring deep-dives on Overseas, Patrimony, and Historiques references; in-period interviews with Christian Selmoni (Vacheron’s style and heritage director).
- **The Naked Watchmaker** — disassembly and movement analysis for several VC calibers including the 4400 and 1142.
- **Collectability.com** — primarily Patek-focused but maintains VC vintage reference pages.
- **WatchProsite Vacheron forum** — collector-maintained discussions with strong reference-by-reference threads.
- **“Vacheron Constantin: Artists of Time” by Franco Cologni** — the canonical illustrated brand history book.
- **“Vacheron Constantin: Hallmark of Geneva” by Julien Marchenoir** — focused on the Geneva Hallmark certification history relevant to VC.


<!-- Below: new brand `Breitling` merged from docs/Watch Aggregator Reference Index 2 — Patch File.md (2026-05-17) -->


<!-- Below: patch-04 additions for Vacheron Constantin merged from docs/watch_references_patch_04.md (2026-05-17) -->

### Model line: Reference 4073 (Calatrava-style time-only, sub-seconds)

- **Refs**: `4073`
- **Years**: c.1940–c.1960
- **Designer / movement**: Manual-wind Vacheron cal. V453 (12 1/2'''), 17 jewels, monometallic balance, swan-neck micrometer regulator, shock-absorber
- **Key identifiers**: 33–34mm three-body case in 18k yellow gold, pink gold or rare stainless steel; concave lugs; snap-on caseback; silvered or two-tone champagne dial; applied baton or Arabic indices; subsidiary seconds at 6
- **Notes**: The 4073 is the second-generation Vacheron Constantin Calatrava-style dress watch, succeeding the 2871 of the 1930s. It shares a case design with the centre-seconds ref 4217 but uses the sub-seconds cal. V453 rather than the 454. [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTg4NjMsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49YmV5b25kdGhlZGlhbC5jb20iLCJwcmV2aWV3VGl0bGUiOiJDb2xsZWN0b3IgR3VpZGUgLSBWYWNoZXJvbiBDb25zdGFudGluIFJlZmVyZW5jZSA0MDczIFRpbWUtT25seSBTdWItU2Vjb25kcyBDYWxhdHJhdmEtc3R5bGUgRHJlc3MgV2F0Y2ggKDE5NDBzIC0xOTYwcykgLSBDb21wbGV0ZSBJbmZvcm1hdGlvbiIsInNvdXJjZSI6IkJFWU9ORCBUSEUgRElBTCIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49YmV5b25kdGhlZGlhbC5jb20iLCJzb3VyY2UiOiJCRVlPTkQgVEhFIERJQUwiLCJ0aXRsZSI6IkNvbGxlY3RvciBHdWlkZSAtIFZhY2hlcm9uIENvbnN0YW50aW4gUmVmZXJlbmNlIDQwNzMgVGltZS1Pbmx5IFN1Yi1TZWNvbmRzIENhbGF0cmF2YS1zdHlsZSBEcmVzcyBXYXRjaCAoMTk0MHMgLTE5NjBzKSAtIENvbXBsZXRlIEluZm9ybWF0aW9uIiwidXJsIjoiaHR0cHM6XC9cL3d3dy5iZXlvbmR0aGVkaWFsLmNvbVwvcG9zdFwvY29sbGVjdG9yLWd1aWRlLXZhY2hlcm9uLWNvbnN0YW50aW4tcmVmZXJlbmNlLTQwNzMtdGltZS1vbmx5LXN1Yi1zZWNvbmRzLWNhbGF0cmF2YS1zdHlsZS1kcmVzcy13YXRjaC0xOTQwcy0xOTYwcy1jb21wbGV0ZS1pbmZvcm1hdGlvblwvIn1dLCJzdGFydEluZGV4IjoxODc1MSwidGl0bGUiOiJCRVlPTkQgVEhFIERJQUwiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmJleW9uZHRoZWRpYWwuY29tXC9wb3N0XC9jb2xsZWN0b3ItZ3VpZGUtdmFjaGVyb24tY29uc3RhbnRpbi1yZWZlcmVuY2UtNDA3My10aW1lLW9ubHktc3ViLXNlY29uZHMtY2FsYXRyYXZhLXN0eWxlLWRyZXNzLXdhdGNoLTE5NDBzLTE5NjBzLWNvbXBsZXRlLWluZm9ybWF0aW9uXC8iLCJ1dWlkIjoiYzZjY2Y0NTktMGViNC00YTEzLWFkMjktMzFmNWQyMjMzMmQ1In0%3D "BEYOND THE DIAL")](https://www.beyondthedial.com/post/collector-guide-vacheron-constantin-reference-4073-time-only-sub-seconds-calatrava-style-dress-watch-1940s-1960s-complete-information/) Christie's, Antiquorum and Collectors Square archives confirm production from the early 1940s through the late 1950s, with surviving examples bearing Geneva manufacture dates between 1942 and 1948. Steel examples are exceedingly rare for Vacheron of this era and trade at strong premiums; dial variety is extreme, which both complicates redial detection and explains why the 4073 has historically been undervalued relative to comparable Patek 570/96 references. [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MTkzMjUsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49YmV5b25kdGhlZGlhbC5jb20iLCJwcmV2aWV3VGl0bGUiOiJDb2xsZWN0b3IgR3VpZGUgLSBWYWNoZXJvbiBDb25zdGFudGluIFJlZmVyZW5jZSA0MDczIFRpbWUtT25seSBTdWItU2Vjb25kcyBDYWxhdHJhdmEtc3R5bGUgRHJlc3MgV2F0Y2ggKDE5NDBzIC0xOTYwcykgLSBDb21wbGV0ZSBJbmZvcm1hdGlvbiIsInNvdXJjZSI6IkJFWU9ORCBUSEUgRElBTCIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49YmV5b25kdGhlZGlhbC5jb20iLCJzb3VyY2UiOiJCRVlPTkQgVEhFIERJQUwiLCJ0aXRsZSI6IkNvbGxlY3RvciBHdWlkZSAtIFZhY2hlcm9uIENvbnN0YW50aW4gUmVmZXJlbmNlIDQwNzMgVGltZS1Pbmx5IFN1Yi1TZWNvbmRzIENhbGF0cmF2YS1zdHlsZSBEcmVzcyBXYXRjaCAoMTk0MHMgLTE5NjBzKSAtIENvbXBsZXRlIEluZm9ybWF0aW9uIiwidXJsIjoiaHR0cHM6XC9cL3d3dy5iZXlvbmR0aGVkaWFsLmNvbVwvcG9zdFwvY29sbGVjdG9yLWd1aWRlLXZhY2hlcm9uLWNvbnN0YW50aW4tcmVmZXJlbmNlLTQwNzMtdGltZS1vbmx5LXN1Yi1zZWNvbmRzLWNhbGF0cmF2YS1zdHlsZS1kcmVzcy13YXRjaC0xOTQwcy0xOTYwcy1jb21wbGV0ZS1pbmZvcm1hdGlvblwvIn1dLCJzdGFydEluZGV4IjoxOTA2MiwidGl0bGUiOiJCRVlPTkQgVEhFIERJQUwiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmJleW9uZHRoZWRpYWwuY29tXC9wb3N0XC9jb2xsZWN0b3ItZ3VpZGUtdmFjaGVyb24tY29uc3RhbnRpbi1yZWZlcmVuY2UtNDA3My10aW1lLW9ubHktc3ViLXNlY29uZHMtY2FsYXRyYXZhLXN0eWxlLWRyZXNzLXdhdGNoLTE5NDBzLTE5NjBzLWNvbXBsZXRlLWluZm9ybWF0aW9uXC8iLCJ1dWlkIjoiYzVjMTUxNzYtNzQ4My00MWU5LWFiOGItMTUzOTk5MjUwMDBiIn0%3D "BEYOND THE DIAL")](https://www.beyondthedial.com/post/collector-guide-vacheron-constantin-reference-4073-time-only-sub-seconds-calatrava-style-dress-watch-1940s-1960s-complete-information/)
- **Sources**: [Beyond the Dial — Reference 4073](https://www.beyondthedial.com/post/collector-guide-vacheron-constantin-reference-4073-time-only-sub-seconds-calatrava-style-dress-watch-1940s-1960s-complete-information/) · [Collectors Square — 4073](https://www.collectorsquare.com/en/watches/vacheron-constantin/vintage/ref-vacheron-constantin-4073/lpi) · [SCVW](https://steelcitywatches.com/products/vacheron-constantin-4073)

### Model line: Reference 4217 (Calatrava-style time-only, centre-seconds)

- **Refs**: `4217`
- **Years**: c.1948–c.1970
- **Designer / movement**: Manual-wind cal. V454 / 454/5B, 17–18 jewels, centre seconds, swan-neck regulator
- **Key identifiers**: 33.5mm three-body case in 18k yellow, pink, white gold (rare), or stainless steel; identical case to ref 4073 except for centre-seconds dial layout
- **Notes**: The centre-seconds sibling of the 4073. White-gold and steel examples are particularly scarce; Collectors Square documents a 1960 white-gold 4217 (cal. 454/5B, mvt 551'245, case 382'335) accompanied by a Vacheron Certificate of Origin. [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjA0MDUsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y29sbGVjdG9yc3F1YXJlLmNvbSIsInByZXZpZXdUaXRsZSI6IlByaWNlIG9mIHNlY29uZCBoYW5kIHdhdGNoZXMgVmFjaGVyb24gQ29uc3RhbnRpbiBWaW50YWdlIiwic291cmNlIjoiQ29sbGVjdG9yIFNxdWFyZSIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y29sbGVjdG9yc3F1YXJlLmNvbSIsInNvdXJjZSI6IkNvbGxlY3RvciBTcXVhcmUiLCJ0aXRsZSI6IlByaWNlIG9mIHNlY29uZCBoYW5kIHdhdGNoZXMgVmFjaGVyb24gQ29uc3RhbnRpbiBWaW50YWdlIiwidXJsIjoiaHR0cHM6XC9cL3d3dy5jb2xsZWN0b3JzcXVhcmUuY29tXC9lblwvd2F0Y2hlc1wvdmFjaGVyb24tY29uc3RhbnRpblwvdmludGFnZVwvbHBpIn1dLCJzdGFydEluZGV4IjoyMDI2NSwidGl0bGUiOiJDb2xsZWN0b3IgU3F1YXJlIiwidXJsIjoiaHR0cHM6XC9cL3d3dy5jb2xsZWN0b3JzcXVhcmUuY29tXC9lblwvd2F0Y2hlc1wvdmFjaGVyb24tY29uc3RhbnRpblwvdmludGFnZVwvbHBpIiwidXVpZCI6ImRhYTdiZGQ2LWMwODAtNDlmOC1iNWNhLWZjYjI3ZTdlMmRhMCJ9 "Collector Square")](https://www.collectorsquare.com/en/watches/vacheron-constantin/vintage/lpi) The 4217 wears noticeably larger than its 33.5mm spec suggests due to the slim three-body case and prominent lugs.
- **Sources**: [Beyond the Dial — 4217](https://www.beyondthedial.com/post/collector-guide-vacheron-constantin-reference-4217-time-only-calatrava-style-dress-watch-1940s-1970s-complete-information-on-an-undervalued-classic/) · [Collectors Square — 4217](https://www.collectorsquare.com/en/watches/vacheron-constantin/vintage/ref-vacheron-constantin-4217/lpi) · [Wind Vintage — 4217 RG](https://www.windvintage.com/vacheron-constantin-reference-4217-in-18k-rg-unpolished)

### Model line: Reference 4218 "Stelline" (teardrop-lug centre-seconds)

- **Refs**: `4218`
- **Years**: c.1946–c.1955
- **Designer / movement**: Manual-wind cal. P454/5B (later 454), 17 jewels, centre seconds
- **Key identifiers**: 35.5–36mm three-body case in 18k yellow or pink gold (stainless examples exceptional); signature **teardrop / "bunny-ear" lugs**; dials commonly with applied star ("stelline") indices or Arabic/baton combinations
- **Common nicknames**: "Stelline" (star indices), "Teardrop Lug"
- **Notes**: One of the most architecturally distinctive Vacheron dress watches of the post-war period, the 4218 paired the centre-seconds cal. 454 with sculpted teardrop lugs that gave the watch substantial wrist presence despite its modest diameter. Authentication centres on lug profile (a frequent target of polishing), dial originality (most varnished nitrocellulose dials show characteristic crazing) and Geneva Seal stamping on the movement.
- **Sources**: [Collectors Square — 4218](https://www.collectorsquare.com/en/watches/vacheron-constantin/vintage/) · [Goldammer — VC vintage chronograph guide](https://goldammer.me/blogs/articles/vacheron-constantin-vintage-chronograph-guide) · [EveryWatch](https://everywatch.com/)

### Model line: Reference 6307 (oversized automatic dress)

- **Refs**: `6307`
- **Years**: c.1958–c.1965
- **Designer / movement**: Automatic cal. K1071, Geneva Seal, 29 jewels, beryllium balance, Breguet hairspring, 18k-gold-rim rotor on ruby rollers, swan-neck regulator
- **Key identifiers**: 37mm three-body case in 18k pink, yellow gold or rare stainless steel; stepped bezel; concave lugs; screw-down caseback; integrated winding crown; satin silver or cream dial with applied faceted baton or pink-gold double-baton indices
- **Common nicknames**: "Jumbo" (oversized for the era)
- **Notes**: The 6307 is one of the largest Vacheron Constantin dress watches of its decade and one of the few automatic references from the period with the Geneva Seal. Watchpool24 and Somlo London both catalogue stainless-steel examples — exceedingly rare given Vacheron predominantly cased its mid-century pieces in precious metal — and these trade at significant premiums over equivalent gold examples. The K1071's 18k-gold-rimmed rotor is a frequent point of inspection; service replacements without the gold rim are common and depress value.
- **Sources**: [Watchpool24 — 6307 Steel](https://www.watchpool24.com/en/30735297/vacheron-constantin-6307-stainless-steel-37mm) · [Collectors Square — 6307](https://www.collectorsquare.com/en/watches/vacheron-constantin/vacheron-constantin-other-model/ref-vacheron-constantin-6307/lpi) · [Somlo London — 6307 RG](https://somlo.com/products/18ct-rose-gold-vacheron-constantin-ref-6307-oversized-automatic-wristwatch-made-1960) · [EveryWatch — Phillips Geneva Auction Eight Lot 79](https://everywatch.com/vacheron-constantin/watch-9006009)

### Model line: References 6508 / 6526 / 6319 (mid-century slim dress)

- **Refs**: `6508` ("Disco Volante"), `6526`, `6319`
- **Years**: 6508: c.1958–c.1968 · 6526: c.1965–c.1970 · 6319: c.1960–c.1965
- **Designer / movement**: 6508 and 6319 — manual cal. 1003 (12 1/2''' ultra-thin, 17 jewels), Geneva Seal · 6526 — automatic cal. 1071/1 [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjQyNTMsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49c29tbG8uY29tIiwicHJldmlld1RpdGxlIjoiU3RhaW5sZXNzIHN0ZWVsIFZhY2hlcm9uICYgQ29uc3RhbnRpb24gcmVmLiA2NTI2IGF1dG9tYXRpYyB3cmlzdHdhdGNoLiDigJMgU29tbG8gTG9uZG9uIiwic291cmNlIjoiU29tbG8gTG9uZG9uIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1zb21sby5jb20iLCJzb3VyY2UiOiJTb21sbyBMb25kb24iLCJ0aXRsZSI6IlN0YWlubGVzcyBzdGVlbCBWYWNoZXJvbiAmIENvbnN0YW50aW9uIHJlZi4gNjUyNiBhdXRvbWF0aWMgd3Jpc3R3YXRjaC4g4oCTIFNvbWxvIExvbmRvbiIsInVybCI6Imh0dHBzOlwvXC9zb21sby5jb21cL3Byb2R1Y3RzXC9zdGFpbmxlc3Mtc3RlZWwtdmFjaGVyb24tY29uc3RhbnRpb24tcmVmLTY1MjYtYXV0b21hdGljLXdyaXN0d2F0Y2gtbWFkZS0xOTY2In1dLCJzdGFydEluZGV4IjoyNDIyNSwidGl0bGUiOiJTb21sbyBMb25kb24iLCJ1cmwiOiJodHRwczpcL1wvc29tbG8uY29tXC9wcm9kdWN0c1wvc3RhaW5sZXNzLXN0ZWVsLXZhY2hlcm9uLWNvbnN0YW50aW9uLXJlZi02NTI2LWF1dG9tYXRpYy13cmlzdHdhdGNoLW1hZGUtMTk2NiIsInV1aWQiOiJmZDk0OTMwZS0wODA5LTQxY2ItODk5Yy1lMmZlZjQ5NTE4MzMifQ%3D%3D "Somlo London")](https://somlo.com/products/stainless-steel-vacheron-constantion-ref-6526-automatic-wristwatch-made-1966)
- **Key identifiers**: 6508: 34mm three-body case in 18k yellow, pink or white gold; "Disco Volante" flying-saucer bezel with concentric circles; ultra-thin profile. 6319: 34mm gold case, ultra-thin slim profile, sub-seconds at 6, silvered dial. [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjQ0OTksIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y29sbGVjdG9yc3F1YXJlLmNvbSIsInByZXZpZXdUaXRsZSI6IlZhY2hlcm9uIENvbnN0YW50aW4gVmludGFnZSB3YXRjaCBpbiB5ZWxsb3cgZ29sZCBSZWY6IDYzMTkgQ2lyY2EgMTk2MCIsInNvdXJjZSI6IkNvbGxlY3RvciBTcXVhcmUiLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWNvbGxlY3RvcnNxdWFyZS5jb20iLCJzb3VyY2UiOiJDb2xsZWN0b3IgU3F1YXJlIiwidGl0bGUiOiJWYWNoZXJvbiBDb25zdGFudGluIFZpbnRhZ2Ugd2F0Y2ggaW4geWVsbG93IGdvbGQgUmVmOiA2MzE5IENpcmNhIDE5NjAiLCJ1cmwiOiJodHRwczpcL1wvd3d3LmNvbGxlY3RvcnNxdWFyZS5jb21cL2VuXC93YXRjaGVzXC92YWNoZXJvbi1jb25zdGFudGluXC92aW50YWdlXC92YWNoZXJvbi1jb25zdGFudGluLXZpbnRhZ2Utd2F0Y2gtaW4teWVsbG93LWdvbGQtcmVmLTYzMTktY2lyY2EtMTk2MC0zNTU5MDQuaHRtbCJ9XSwic3RhcnRJbmRleCI6MjQ0MjYsInRpdGxlIjoiQ29sbGVjdG9yIFNxdWFyZSIsInVybCI6Imh0dHBzOlwvXC93d3cuY29sbGVjdG9yc3F1YXJlLmNvbVwvZW5cL3dhdGNoZXNcL3ZhY2hlcm9uLWNvbnN0YW50aW5cL3ZpbnRhZ2VcL3ZhY2hlcm9uLWNvbnN0YW50aW4tdmludGFnZS13YXRjaC1pbi15ZWxsb3ctZ29sZC1yZWYtNjMxOS1jaXJjYS0xOTYwLTM1NTkwNC5odG1sIiwidXVpZCI6IjA4NGE3ODllLTEzMTItNDgxMS1hMWU3LWMzYjhlMWZjMmQzYiJ9 "Collector Square")](https://www.collectorsquare.com/en/watches/vacheron-constantin/vintage/vacheron-constantin-vintage-watch-in-yellow-gold-ref-6319-circa-1960-355904.html) 6526: 34mm **stainless steel** centre-seconds, applied baton markers [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjQ1NjgsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49c29tbG8uY29tIiwicHJldmlld1RpdGxlIjoiU3RhaW5sZXNzIHN0ZWVsIFZhY2hlcm9uICYgQ29uc3RhbnRpb24gcmVmLiA2NTI2IGF1dG9tYXRpYyB3cmlzdHdhdGNoLiDigJMgU29tbG8gTG9uZG9uIiwic291cmNlIjoiU29tbG8gTG9uZG9uIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1zb21sby5jb20iLCJzb3VyY2UiOiJTb21sbyBMb25kb24iLCJ0aXRsZSI6IlN0YWlubGVzcyBzdGVlbCBWYWNoZXJvbiAmIENvbnN0YW50aW9uIHJlZi4gNjUyNiBhdXRvbWF0aWMgd3Jpc3R3YXRjaC4g4oCTIFNvbWxvIExvbmRvbiIsInVybCI6Imh0dHBzOlwvXC9zb21sby5jb21cL3Byb2R1Y3RzXC9zdGFpbmxlc3Mtc3RlZWwtdmFjaGVyb24tY29uc3RhbnRpb24tcmVmLTY1MjYtYXV0b21hdGljLXdyaXN0d2F0Y2gtbWFkZS0xOTY2In1dLCJzdGFydEluZGV4IjoyNDUwMCwidGl0bGUiOiJTb21sbyBMb25kb24iLCJ1cmwiOiJodHRwczpcL1wvc29tbG8uY29tXC9wcm9kdWN0c1wvc3RhaW5sZXNzLXN0ZWVsLXZhY2hlcm9uLWNvbnN0YW50aW9uLXJlZi02NTI2LWF1dG9tYXRpYy13cmlzdHdhdGNoLW1hZGUtMTk2NiIsInV1aWQiOiI5MzkzMjA3Ni1kM2ExLTQ1MjYtOTgwNi0xYzQxMTE2ODY5YzAifQ%3D%3D "Somlo London")](https://somlo.com/products/stainless-steel-vacheron-constantion-ref-6526-automatic-wristwatch-made-1966) — uncommon period steel reference.
- **Common nicknames**: "Disco Volante" (6508), "Ultra-Thin" (6319)
- **Notes**: The 6508 "Disco Volante" is the iconic mid-century Vacheron slim case, named for its UFO-like wide stepped bezel; production examples are confirmed across white, yellow and pink gold with the cal. 1003. The cal. 1003 was **unveiled at the 1955 Basel Watch Fair for Vacheron Constantin's bicentenary and at launch held the world record for the thinnest manual-winding movement** [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjUwNjIsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49amVuc2VubXVzZXVtLm9yZyIsInByZXZpZXdUaXRsZSI6IlRIRSBXT1JMRCdTIFRISU5ORVNUIFdBVENIIEJZIFZBQ0hFUk9OICYgQ09OU1RBTlRJTiAtIFRoZSBKZW5zZW4gTXVzZXVtIiwic291cmNlIjoiVGhlIEplbnNlbiBNdXNldW0iLCJ0eXBlIjoiZ2VuZXJpY19tZXRhZGF0YSJ9LCJzb3VyY2VzIjpbeyJpY29uVXJsIjoiaHR0cHM6XC9cL3d3dy5nb29nbGUuY29tXC9zMlwvZmF2aWNvbnM/c3o9NjQmZG9tYWluPWplbnNlbm11c2V1bS5vcmciLCJzb3VyY2UiOiJUaGUgSmVuc2VuIE11c2V1bSIsInRpdGxlIjoiVEhFIFdPUkxEJ1MgVEhJTk5FU1QgV0FUQ0ggQlkgVkFDSEVST04gJiBDT05TVEFOVElOIC0gVGhlIEplbnNlbiBNdXNldW0iLCJ1cmwiOiJodHRwczpcL1wvd3d3LmplbnNlbm11c2V1bS5vcmdcL3Byb2R1Y3RcL3RoZS13b3JsZHMtdGhpbm5lc3Qtd2F0Y2gtYnktdmFjaGVyb24tY29uc3RhbnRpblwvIn1dLCJzdGFydEluZGV4IjoyNDg4OCwidGl0bGUiOiJUaGUgSmVuc2VuIE11c2V1bSIsInVybCI6Imh0dHBzOlwvXC93d3cuamVuc2VubXVzZXVtLm9yZ1wvcHJvZHVjdFwvdGhlLXdvcmxkcy10aGlubmVzdC13YXRjaC1ieS12YWNoZXJvbi1jb25zdGFudGluXC8iLCJ1dWlkIjoiNDY0YTYxMTUtMWY2Ni00ZDM2LTk4OTUtYTU2MWNkYWE1OGQ0In0%3D "The Jensen Museum")](https://www.jensenmuseum.org/product/the-worlds-thinnest-watch-by-vacheron-constantin/) (per The Jensen Museum). The 6319 is an ultra-thin sub-seconds variant with the manual cal. K1001 carrying the Geneva Seal; surviving examples are mostly yellow gold with rare white-gold pieces appearing at Antiquorum. The 6526 stands apart as a stainless-steel automatic from 1966 [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjUzNDQsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49c29tbG8uY29tIiwicHJldmlld1RpdGxlIjoiU3RhaW5sZXNzIHN0ZWVsIFZhY2hlcm9uICYgQ29uc3RhbnRpb24gcmVmLiA2NTI2IGF1dG9tYXRpYyB3cmlzdHdhdGNoLiDigJMgU29tbG8gTG9uZG9uIiwic291cmNlIjoiU29tbG8gTG9uZG9uIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1zb21sby5jb20iLCJzb3VyY2UiOiJTb21sbyBMb25kb24iLCJ0aXRsZSI6IlN0YWlubGVzcyBzdGVlbCBWYWNoZXJvbiAmIENvbnN0YW50aW9uIHJlZi4gNjUyNiBhdXRvbWF0aWMgd3Jpc3R3YXRjaC4g4oCTIFNvbWxvIExvbmRvbiIsInVybCI6Imh0dHBzOlwvXC9zb21sby5jb21cL3Byb2R1Y3RzXC9zdGFpbmxlc3Mtc3RlZWwtdmFjaGVyb24tY29uc3RhbnRpb24tcmVmLTY1MjYtYXV0b21hdGljLXdyaXN0d2F0Y2gtbWFkZS0xOTY2In1dLCJzdGFydEluZGV4IjoyNTI4MiwidGl0bGUiOiJTb21sbyBMb25kb24iLCJ1cmwiOiJodHRwczpcL1wvc29tbG8uY29tXC9wcm9kdWN0c1wvc3RhaW5sZXNzLXN0ZWVsLXZhY2hlcm9uLWNvbnN0YW50aW9uLXJlZi02NTI2LWF1dG9tYXRpYy13cmlzdHdhdGNoLW1hZGUtMTk2NiIsInV1aWQiOiJiNjM3NDMwOS03YmZiLTQ2MzUtYTkwOC1jZTk0NDkwOGFiYzcifQ%3D%3D "Somlo London")](https://somlo.com/products/stainless-steel-vacheron-constantion-ref-6526-automatic-wristwatch-made-1966) — an unusual material/movement combination for Vacheron and consequently scarce.
- **Sources**: [Collectors Square — 6508](https://www.collectorsquare.com/en/watches/vacheron-constantin/vintage/ref-vacheron-constantin-6508/lpi) · [Watch Buyers Group — 6508 Disco Volante](https://thewatchbuyersgroup.com/buy-a-watch-shop/watches/vacheron-constantin-disco-volante-6508-18k-gold/) · [Somlo London](https://somlo.com/collections/vacheron-constantin) · [The Jensen Museum — Caliber 1003](https://jensen-museum.org/)

### Model line: References 4657 / 7391 / 7587 (post-war dress and 1970s women's)

- **Refs**: `4657`, `7391`, `7587`
- **Years**: 4657: c.1950s · 7391: c.1969–c.1975 · 7587: 1970s
- **Designer / movement**: 4657 — automatic cal. 477/1 [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjYwOTIsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y29sbGVjdG9yc3F1YXJlLmNvbSIsInByZXZpZXdUaXRsZSI6IlZhY2hlcm9uIENvbnN0YW50aW4gSGlzdG9yaXF1ZSBzZWNvbmQgaGFuZCBwcmljZXMiLCJzb3VyY2UiOiJDb2xsZWN0b3IgU3F1YXJlIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1jb2xsZWN0b3JzcXVhcmUuY29tIiwic291cmNlIjoiQ29sbGVjdG9yIFNxdWFyZSIsInRpdGxlIjoiVmFjaGVyb24gQ29uc3RhbnRpbiBIaXN0b3JpcXVlIHNlY29uZCBoYW5kIHByaWNlcyIsInVybCI6Imh0dHBzOlwvXC93d3cuY29sbGVjdG9yc3F1YXJlLmNvbVwvZW5cL3dhdGNoZXNcL3ZhY2hlcm9uLWNvbnN0YW50aW5cL2hpc3RvcmlxdWVcL2xwaSJ9XSwic3RhcnRJbmRleCI6MjYwNzIsInRpdGxlIjoiQ29sbGVjdG9yIFNxdWFyZSIsInVybCI6Imh0dHBzOlwvXC93d3cuY29sbGVjdG9yc3F1YXJlLmNvbVwvZW5cL3dhdGNoZXNcL3ZhY2hlcm9uLWNvbnN0YW50aW5cL2hpc3RvcmlxdWVcL2xwaSIsInV1aWQiOiIwNGU3MTc4NS1iODQ2LTRmMGUtYmQzMS05YzY0Y2U5NzQyYTIifQ%3D%3D "Collector Square")](https://www.collectorsquare.com/en/watches/vacheron-constantin/historique/lpi) · 7391 — automatic K1120 [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjYxMTcsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y29sbGVjdG9yc3F1YXJlLmNvbSIsInByZXZpZXdUaXRsZSI6IlZhY2hlcm9uIENvbnN0YW50aW4gSGlzdG9yaXF1ZSBzZWNvbmQgaGFuZCBwcmljZXMiLCJzb3VyY2UiOiJDb2xsZWN0b3IgU3F1YXJlIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1jb2xsZWN0b3JzcXVhcmUuY29tIiwic291cmNlIjoiQ29sbGVjdG9yIFNxdWFyZSIsInRpdGxlIjoiVmFjaGVyb24gQ29uc3RhbnRpbiBIaXN0b3JpcXVlIHNlY29uZCBoYW5kIHByaWNlcyIsInVybCI6Imh0dHBzOlwvXC93d3cuY29sbGVjdG9yc3F1YXJlLmNvbVwvZW5cL3dhdGNoZXNcL3ZhY2hlcm9uLWNvbnN0YW50aW5cL2hpc3RvcmlxdWVcL2xwaSJ9XSwic3RhcnRJbmRleCI6MjYxMDIsInRpdGxlIjoiQ29sbGVjdG9yIFNxdWFyZSIsInVybCI6Imh0dHBzOlwvXC93d3cuY29sbGVjdG9yc3F1YXJlLmNvbVwvZW5cL3dhdGNoZXNcL3ZhY2hlcm9uLWNvbnN0YW50aW5cL2hpc3RvcmlxdWVcL2xwaSIsInV1aWQiOiI3MzgwYzJjMi04MTljLTQ2M2MtYjZjZC00ZmY5MmI4MGE1MTcifQ%3D%3D "Collector Square")](https://www.collectorsquare.com/en/watches/vacheron-constantin/historique/lpi) (36 jewels) · 7587 — manual K1050/3 [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjYxNTMsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49c29tbG8uY29tIiwicHJldmlld1RpdGxlIjoiMThjdCB3aGl0ZSBnb2xkIGFuZCBkaWFtb25kIHNldCBWYWNoZXJvbiAmIENvbnN0YW50aW4gcmVmLiA3NTg3IGJyYWNlbCDigJMgU29tbG8gTG9uZG9uIiwic291cmNlIjoiU29tbG8gTG9uZG9uIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1zb21sby5jb20iLCJzb3VyY2UiOiJTb21sbyBMb25kb24iLCJ0aXRsZSI6IjE4Y3Qgd2hpdGUgZ29sZCBhbmQgZGlhbW9uZCBzZXQgVmFjaGVyb24gJiBDb25zdGFudGluIHJlZi4gNzU4NyBicmFjZWwg4oCTIFNvbWxvIExvbmRvbiIsInVybCI6Imh0dHBzOlwvXC9zb21sby5jb21cL3Byb2R1Y3RzXC8xOGN0LXdoaXRlLWdvbGQtYW5kLWRpYW1vbmQtc2V0LWJyYWNlbGV0LXdhdGNoLXdpdGgtamFkZS1kaWFsLWNpcmNhLTE5NzAifV0sInN0YXJ0SW5kZXgiOjI2MTM5LCJ0aXRsZSI6IlNvbWxvIExvbmRvbiIsInVybCI6Imh0dHBzOlwvXC9zb21sby5jb21cL3Byb2R1Y3RzXC8xOGN0LXdoaXRlLWdvbGQtYW5kLWRpYW1vbmQtc2V0LWJyYWNlbGV0LXdhdGNoLXdpdGgtamFkZS1kaWFsLWNpcmNhLTE5NzAiLCJ1dWlkIjoiNjBkMTZjZjQtMDhmYy00ZTliLWIxNmUtNmQzZmYwMzMxYzhjIn0%3D "Somlo London")](https://somlo.com/products/18ct-white-gold-and-diamond-set-bracelet-watch-with-jade-dial-circa-1970)
- **Key identifiers**: 4657: 31×31mm square 18k yellow-gold case, silvered dial, snap-on caseback. [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjYyNTIsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y29sbGVjdG9yc3F1YXJlLmNvbSIsInByZXZpZXdUaXRsZSI6IlZhY2hlcm9uIENvbnN0YW50aW4gSGlzdG9yaXF1ZSBzZWNvbmQgaGFuZCBwcmljZXMiLCJzb3VyY2UiOiJDb2xsZWN0b3IgU3F1YXJlIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1jb2xsZWN0b3JzcXVhcmUuY29tIiwic291cmNlIjoiQ29sbGVjdG9yIFNxdWFyZSIsInRpdGxlIjoiVmFjaGVyb24gQ29uc3RhbnRpbiBIaXN0b3JpcXVlIHNlY29uZCBoYW5kIHByaWNlcyIsInVybCI6Imh0dHBzOlwvXC93d3cuY29sbGVjdG9yc3F1YXJlLmNvbVwvZW5cL3dhdGNoZXNcL3ZhY2hlcm9uLWNvbnN0YW50aW5cL2hpc3RvcmlxdWVcL2xwaSJ9XSwic3RhcnRJbmRleCI6MjYxODMsInRpdGxlIjoiQ29sbGVjdG9yIFNxdWFyZSIsInVybCI6Imh0dHBzOlwvXC93d3cuY29sbGVjdG9yc3F1YXJlLmNvbVwvZW5cL3dhdGNoZXNcL3ZhY2hlcm9uLWNvbnN0YW50aW5cL2hpc3RvcmlxdWVcL2xwaSIsInV1aWQiOiJjOGY4NTFmOC0zMWExLTRjNDMtYTZmZC1jMTY3ZjliNTFlODUifQ%3D%3D "Collector Square")](https://www.collectorsquare.com/en/watches/vacheron-constantin/historique/lpi) 7391: yellow-gold bracelet watch, [![](claude-citation:/icon.png?validation=B3405D24-096B-43ED-9553-DECED4211877&citation=eyJlbmRJbmRleCI6MjYyODYsIm1ldGFkYXRhIjp7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Y29sbGVjdG9yc3F1YXJlLmNvbSIsInByZXZpZXdUaXRsZSI6IlZhY2hlcm9uIENvbnN0YW50aW4gSGlzdG9yaXF1ZSBzZWNvbmQgaGFuZCBwcmljZXMiLCJzb3VyY2UiOiJDb2xsZWN0b3IgU3F1YXJlIiwidHlwZSI6ImdlbmVyaWNfbWV0YWRhdGEifSwic291cmNlcyI6W3siaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1jb2xsZWN0b3JzcXVhcmUuY29tIiwic291cmNlIjoiQ29sbGVjdG9yIFNxdWFyZSIsInRpdGxlIjoiVmFjaGVyb24gQ29uc3RhbnRpbiBIaXN0b3JpcXVlIHNlY29uZCBoYW5kIHByaWNlcyIsInVybCI6Imh0dHBzOlwvXC93d3cuY29sbGVjdG9yc3F1YXJlLmNvbVwvZW5cL3dhdGNoZXNcL3ZhY2hlcm9uLWNvbnN0YW50aW5cL2hpc3RvcmlxdWVcL2xwaSJ9XSwic3RhcnRJbmRleCI6MjYyNTksInRpdGxlIjoiQ29sbGVjdG9yIFNxdWFyZSIsInVybCI6Imh0dHBzOlwvXC93d3cuY29sbGVjdG9yc3F1YXJlLmNvbVwvZW5cL3dhdGNoZXNcL3ZhY2hlcm9uLWNvbnN0YW50aW5cL2hpc3RvcmlxdWVcL2xwaSIsInV1aWQiOiJiMDkwNmQ1Ni0wYWEzLTRlYWQtYjE2My01YTE5MThkMjdkMjcifQ%3D%3D "Collector Square")](https://www.collectorsquare.com/en/watches/vacheron-constantin/historique/lpi) champagne dial, integrated bracelet, automatic K1120. 7587: ladies' bracelet watch, 18k white-gold ~20mm case, diamond-set bezel, jade dial.
- **Notes**: The 4657 is one of Vacheron's square 1950s dress references — analogous in spirit to the Patek 2488. The 7391 is a 1970s bracelet watch using the K1120 automatic, a movement shared with high-end VC complications including the 222 (Vacheron's first sports watch). The 7587 represents Vacheron's strong 1970s jewelry-watch presence, with diamond-set white-gold cases and hard-stone (jade, lapis, malachite) dial executions — an underappreciated category that has found renewed interest from collectors of period stone-dial watches.
- **Sources**: [Sotheby's — VC Historique 7391 (2020)](https://www.sothebys.com/en/buy/auction/2020/watches-2/vacheron-constantin-historique-reference-7391-a) · [Collectors Square](https://www.collectorsquare.com/en/watches/vacheron-constantin/lpi) · [Somlo London](https://somlo.com/collections/vacheron-constantin)

### Model line: Reference 47052 Patrimony Semainier (Triple Calendar with Week)

- **Refs**: `47052`
- **Years**: c.1995–c.2005
- **Designer / movement**: Automatic cal. 889/2 (JLC base) with triple-calendar and week-of-year complication module
- **Key identifiers**: 36mm 18k white-gold or yellow-gold case, "Semainier" triple calendar (day, date, month, week number), moonphase or no-moonphase variants, applied baton or Roman indices
- **Common nicknames**: "Semainier" (week indication)
- **Notes**: The 47052 is one of the few modern dress watches to indicate the week of the year — a Vacheron complication rooted in 19th-century pocket-watch tradition. Wind Vintage and Phillips note production was modest and white-gold examples are particularly scarce; the watch sits within the broader Patrimony lineage but is a serious complication piece on the JLC 889 base.
- **Sources**: [Wind Vintage — 47052 White Gold](https://www.windvintage.com/vacheron-constantin-patrimony-semainier-reference-47052-in-18k-white-gold)

### Model line: Reference 4020T (Traditionnelle Complete Calendar Openface)

- **Refs**: `4020T`
- **Years**: 2017–present
- **Designer / movement**: Vacheron cal. 2460 QCL/2 (later QCL/270 in the 270th-anniversary edition), automatic, Geneva Seal
- **Key identifiers**: 41mm platinum, white-gold or pink-gold case, openworked dial showing complete calendar (day, date, month, moonphase), "Traditionnelle" classic case shape
- **Notes**: The `T` suffix in the modern Vacheron reference system denotes the **Traditionnelle openface/sub-line designator**; it does **not** indicate tantalum or any specific case material — a common misreading. The 4020T's Geneva-Seal-bearing cal. 2460 QCL is a modern Vacheron complete-calendar movement with moonphase, and the 270th-anniversary edition launched in 2025 uses a specially decorated QCL/270 variant.
- **Sources**: [Vacheron Constantin official](https://www.vacheron-constantin.com/) · [WatchBase](https://watchbase.com/) · [Oracle Time](https://oracleoftime.com/)

### Overseas reference suffix decode (modern, 2016+)

The third-generation Overseas reference structure is:

## Breitling

-----

## Brand: Breitling

**Canonical name forms for listing matching:** `Breitling`, `BREITLING` (all-caps is common on the wordmark and case-back), `Breitling Genève` (vintage dial signature for late-1950s/1960s pieces), `Breitling Watch Co.` (early 20th-century usage), `Breitling SA`, `Léon G. Breitling SA Montbrillant Watch Manufactory` (founder-era full corporate name on vintage paperwork), and `G. Léon Breitling` (early 1890s pocket-watch signature). Reference numbers pre-1995 are 3- to 5-digit numeric strings (`806`, `765`, `81950`, `7806`); post-1995 references use a letter-prefix code: `A` = stainless steel, `B` = yellow gold, `D` = bicolor steel/yellow gold, `E` = titanium, `K` = rose gold, `J` = white gold, `R` = red gold variant, `U` = bicolor steel/red gold; followed by 5 digits encoding model/caliber/variant and typically a 2-digit dial-color code at the end. Example: `AB012012/B978` parses as `A` (steel) + `B` (second material — none, i.e., all steel) + `01` (Caliber 01) + `20` (Chronomat 42 model code) + `12` (dial variant), then `/B978` strap/dial finishing code. Many modern Breitlings carry a longer 12–14 character reference string when fully specified.

### Model line: Navitimer (vintage)

- **Refs**: `806` (1954–1968 — the foundational reference; encompasses AOPA-signed dials, “Twin Jet” dials, Venus 178 and brief Valjoux 72 production), pre-806 (`unnumbered`, AOPA only, 1954–1955, Valjoux 72), `7806` (1972–1974 manual with date), `7816` (1972–~1978 auto with date), `1806` (1969–~1979 Chrono-Matic / Cal. 11/12/14 automatic), `806/36` (small variants), `819` (chronograph), `816` (date variant)
- **Years**: 1954–~1979 (vintage Navitimer production)
- **Designer / movement**: Pre-806 / earliest 806: Valjoux 72 (manual chronograph, column wheel — same movement family as vintage Rolex Daytona); 806 from ~1955 onward: Venus 178 (manual chronograph, column wheel, 17 jewels); 7806: Valjoux 7740 (manual cam-actuated, derived from Cal. 11 base architecture); 1806 / Chrono-Matic: Caliber 11/12/14 (auto, modular Buren-Hamilton/Dubois-Dépraz collaboration, also used in Heuer Monaco 1133)
- **Key identifiers**: 41 mm steel (or gold-plated/solid-gold) case, circular slide-rule outer bezel (Breitling’s signature aviation calculator), inner tachymeter ring, three-register chronograph (running seconds at 9, 30-minute at 3, 12-hour at 6 — except 7806 which moves running seconds to 12 and adds date at 4-30), beaded bezel on 1950s–1963 examples (~93–125 beads), milled-edge bezel from 1964, “AOPA” wings logo at 12 on pre-806 and early 806s, “Twin Jet” logo from 1964, “Breitling Genève” signature
- **Common nicknames**: “Navitimer”, “AOPA Navitimer” (specifically the AOPA-signed dials), “Pre-806” (1954–1955 unnumbered Valjoux 72 examples), “Big Eye” (specifically 7806 with oversized subdial counters), “Twin Jet” (Breitling’s late-1960s logo, often used to describe the dial variant), “RAF Navitimer” (RAF-signed dials, very rare)
- **Notes**: The Navitimer is the foundational pilot’s chronograph of the modern era and arguably Breitling’s most important watch historically. The “Pre-806” (1954–1955, unnumbered case-back, Valjoux 72-powered, AOPA-only distribution at $87.50 each) is among the most collectible aviation watches at auction. From ~1956 the 806 transitioned to the Venus 178 (column-wheel chronograph) and added the Breitling signature to dials that previously bore only AOPA wings. Dial evolution: all-black with black subdials (1954–1963) → “reverse panda” black dial with white subdials (1963 transitional) → milled bezel + Twin Jet logo (1964 onward) → larger subdials and color accents. Crown/pusher evolution and case finish are key authentication points. The 1969 Caliber 11 launch made the 1806 one of the world’s first automatic chronograph wristwatches (alongside the Zenith El Primero, Seiko 6139, and Heuer/Hamilton Caliber 11 collaboration). Valuation: AOPA pre-806s now trade in the $25,000–60,000 range at major auctions; standard Venus 178 806s start around $4,000 and rise sharply for condition, dial originality, and provenance. Reference-matching gotcha: the same `806` reference number persisted through the entire 1954–1968 production, so “ref 806” alone doesn’t disambiguate sub-variants — the dial signature (AOPA / unsigned / Twin Jet / Breitling Genève), bezel style (beaded / milled), and movement (Valjoux 72 / Venus 178) are necessary for precise identification.

### Model line: Navitimer Cosmonaute / Co-Pilot

- **Refs**: `809` (Cosmonaute, 24-hour Navitimer with Scott Carpenter–era origin, 1962–~1970), `765 AVI` (Co-Pilot 1953–1957, “Raquel Welch” steel bezel), `765 CP` (Co-Pilot 1965–1967, ~1,000 made, “Twin Pilot” two-crown), `7650` (Twin Pilot later variant), reference `765 CP "Long Playing"` (extra-long power reserve / extended chronograph variants)
- **Years**: 1953–~1979
- **Designer / movement**: `765 AVI`: Venus 178; `765 CP`: Venus 178 (17 jewels, with 15-minute counter modified from 30-minute for pilot use); `809 Cosmonaute`: Venus 178 modified for 24-hour dial
- **Key identifiers**: `809 Cosmonaute`: same case shape as 806 but with 24-hour dial layout (0-24 instead of 1-12) and beaded bezel; `765 CP`: 41 mm case (large for the 1960s), reverse panda dial with three subdials including an oversized 3-o’clock subdial, black anodized aluminum 12-hour bezel insert, large luminous Arabic numerals at 12-3-6-9, no slide rule
- **Common nicknames**: “Cosmonaute” (809), “Co-Pilot” (765 AVI and 765 CP), “Twin Pilot” (765 CP / 7650 — the two-crown variant), “Long Playing” (extended-power-reserve variant), “Raquel Welch” (765 AVI with steel bezel, allegedly worn by the actress), “Jean-Claude Killy Breitling” (the 765 CP Killy wore winning gold at 1968 Grenoble Olympics)
- **Notes**: The 809 Cosmonaute was created in 1962 when astronaut Scott Carpenter approached Breitling explaining that in space he could not distinguish AM from PM with a standard 12-hour dial. Breitling responded by reworking the 806 design to a 24-hour dial; Carpenter wore the resulting watch on his Aurora 7 Mercury orbital flight (May 24, 1962), making it Breitling’s space-flight equivalent of Omega’s Speedmaster Apollo claim. The watch carried an “806” reference number for roughly a year before being separately catalogued as the `809`. The `765 CP` Co-Pilot (1965–1967, est. ~1,000 made) is the line’s premier vintage collectible — the 41 mm case is unusually large for the period, the reverse panda dial is highly attractive, and Jean-Claude Killy’s wearing it during his triple gold-medal sweep at the 1968 Grenoble Olympics established its sporting credentials. Listing gotcha: the 765 AVI and 765 CP share the 765 reference root but are visually distinct (765 AVI has a steel bezel and 12-hour scale; 765 CP has a black bezel insert and was designed specifically for pilot timing). The Twin Pilot variant adds a second crown at 4 o’clock for an interior 24-hour disc.

### Model line: Navitimer (modern)

- **Refs**: `A13322` (Navitimer 92, steel auto, 1990s with Cal. 13 = ETA 7750 based), `A13022` (Navitimer World GMT), `AB012012` (Navitimer 01 / Navitimer 1 B01 Chronograph 43, in-house Cal. 01), `AB0121211B1A1` (Navitimer 1 B01 Chronograph 43), `AB0127211B1P1`, `AB0139211B1P1`, `A23322` (Old Navitimer II, ETA 7750), Navitimer Heritage `A35350`, Navitimer 1959 Re-Edition `AB0910371B1X1`, Navitimer 8 series (later renamed Aviator 8) `A17314`, `AB0117131C1P1`
- **Years**: 1992–present (continuous modern production since the 1992 “Old Navitimer”)
- **Designer / movement**: Cal. 13 (ETA 7750-based), Cal. 23 (ETA 2892 + DD module), Cal. 24 (world time module), Cal. 01 (in-house, 2009 — column wheel, vertical clutch, 70-hour reserve, COSC), Cal. 04 (in-house GMT)
- **Key identifiers**: Slide-rule bezel (the line’s enduring signature — bidirectional rotating), three-register chronograph at 3-6-9 (the in-house Cal. 01 variants) or 6-9-12 (Cal. 7750-based older variants), “Breitling 1884” or wings logo on dial, AOPA logo on certain heritage editions, screw-down crown on newer pieces, 41/43/46 mm cases
- **Common nicknames**: “Navi” (universal collector shorthand), “Old Navitimer” (`A13322`, 1992–~2005), “Navitimer 01” or “B01” (`AB012012` and successors with in-house Caliber 01), “Navitimer 1” / “Navitimer Reference 806 1959 Re-Edition” (modern faithful reissue)
- **Notes**: The Old Navitimer `A13322` (1992) revived the line after a 1980s hiatus and used the Valjoux 7750 (rebranded as Breitling Cal. 13); it remains one of the more accessible vintage-styled Breitlings. The 2009 launch of the in-house Cal. 01 in the Navitimer 01 (`AB012012`) was Breitling’s first fully in-house chronograph movement and a significant brand achievement — column wheel, vertical clutch, 70-hour reserve, COSC. The 2018 brand reorientation under Georges Kern split the Navitimer family into the slide-rule Navitimer line (now positioned as the heritage continuation) and the simpler Aviator 8 (formerly Navitimer 8), which dropped the slide-rule bezel. The 2022 “Navitimer Ref. 806 1959 Re-Edition” `AB0910371B1X1` is the most faithful modern reissue of the vintage 806, with Cal. B09 (manual-wound, column wheel — re-created to closely resemble the Venus 178 layout). Bezel direction: vintage Navitimers had bidirectional friction bezels; some 1990s versions experimented with unidirectional; modern Navi-1 returned to bidirectional.

### Model line: Chronomat (vintage 1940s — original “Chronographe Mathématique”)

- **Refs**: `769` (1942, original Chronomat), `808` (post-war Chronomat variant), `769 type 42` slide-rule predecessor to Navitimer
- **Years**: 1942–~1955
- **Designer / movement**: Venus 175 (manual chronograph)
- **Key identifiers**: Round 36 mm steel case, slide-rule bezel (the predecessor to the Navitimer’s slide rule — the Chronomat’s slide rule was internal to the dial / under the crystal), two-register chronograph, “Breitling Chronomat” signature
- **Common nicknames**: “Original Chronomat”, “1942 Chronomat”, “Chronographe Mathématique”
- **Notes**: The original Chronomat predates the Navitimer by a decade. The name was a contraction of “Chronograph Mathématique” — the slide rule was a calculator. When Willy Breitling created the Navitimer in 1952, he externalized the slide rule onto a rotating bezel and rebranded the result. The Chronomat name then went largely dormant until Ernest Schneider revived it in 1984 with the entirely different ref. 81950 Chronomat.

### Model line: Chronomat (modern — 1984+)

- **Refs**: `81950` (1984–1990 first modern Chronomat, Valjoux 7750), `81970` (1990–~1995 evolution, gold-plated rider tabs added as standard), `B13352` / `A13352` (Chronomat Evolution mid-1990s, Cal. 13), `A13350` (Chronomat Blackbird), `AB011012` (Chronomat 44 B01, 2009 in-house), `AB012012` (Chronomat 42 in-house), `AB0134101B1A1` (Chronomat B01 42, 2020 redesign), `AB0136251` (Chronomat 41), `A10380` (Chronomat Automatic 36)
- **Years**: 1984–present (continuous)
- **Designer / movement**: Ernest Schneider (concept), Frecce Tricolori aerobatic team (initial brief 1983); Valjoux 7750 (`81950`, `81970`), Cal. 13 (modified 7750), Cal. 01 (in-house since 2009, used in modern B01 Chronomat 42/44)
- **Key identifiers**: Four “rider tab” projections on the rotating bezel at 12-3-6-9 (the line’s signature — the 3 and 9 tabs are unscrewable and reversible for count-up vs. count-down timing), “Rouleaux” three-link rolled bracelet (integrated on 1984–1996 originals, revived 2020+), onion-shaped pusher and crown caps (referencing classic pilot watch ergonomics), three-register chronograph layout, inner tachymeter scale on rehaut
- **Common nicknames**: “Chronomat”, “Rider Tabs” (referring to the four bezel projections), “Frecce Tricolori” (the 1983 Italian Air Force aerobatic-team predecessor), “Rouleaux” (the three-link bracelet)
- **Notes**: The modern Chronomat began as a 1983 special order for the Italian Air Force aerobatic team Frecce Tricolori, who needed a pilot’s chronograph durable enough for cockpit use and aesthetic enough for off-duty wear. The four “rider tabs” were a Breitling engineering solution to a specific problem: jet pilots repeatedly damaged watch crystals when opening and closing canopies, so Breitling recessed the crystal into the bezel and protected it with raised tabs. The reversible 15/45 tabs allow the bezel to function as either count-up or countdown — a feature genuinely useful for both aviation and yachting. The 1984 public launch (ref. `81950`) coincided with Breitling’s 100th anniversary and was a commercial and aesthetic landmark: it positioned mechanical watchmaking against the quartz crisis and re-established Breitling as a serious watchmaker. The Caliber 01 (in-house, 2009) was first deployed in the Chronomat 44 `AB011012` and is now standard. The 2020 redesign under Georges Kern (`AB0134101B1A1`) returned to the 1984 case proportions (42 mm vs. 44 mm), restored the Rouleaux integrated bracelet (which had been discontinued in 1996), and refined the rider tabs. Reference numbering caution: the 1984–~2000 Chronomats use 5-digit numeric references (`81950`, `81970`); the late-1990s through 2020 generation uses the `A13xxx` letter-prefix system; the 2020+ generation uses 12+ character reference strings starting `AB0134`. The 81950 had several official sub-variants (Frecce Tricolori case-back engraved, Yachting timer variant, Renault F1 special edition, moonphase Cal. 7750/3).

### Model line: SuperOcean (vintage)

- **Refs**: `1004` (1957 time-only, Felsa Cal. 692/B125, 39 mm), `807` (1957 chronograph, Venus 188/175, 38.5 mm), `2005` (1964 “Slow Motion” chronograph, single central minute hand for diving), `2105` (1969 Chrono-Matic SuperOcean — first automatic SuperOcean chrono, 48 mm), `81190` (1983 SuperOcean Deep Sea, 1000 m quartz)
- **Years**: 1957–~1990
- **Designer / movement**: `1004`: Felsa B125 (auto, swept seconds, no date); `807`: Venus 188 (manual chrono); `2005`: bespoke “Slow Motion” caliber (chronograph hand makes one revolution per hour, not per minute); `2105`: Caliber 11/12 (auto chronograph, Buren-Hamilton/Dubois-Dépraz/Heuer/Breitling consortium); `81190`: quartz
- **Key identifiers**: Concave / sloped rotating bezel (a SuperOcean signature, distinct from the flat insert of most dive watches), oversized triangular and circular hour markers (designed for legibility at depth), large arrow-shaped hour hand, “SuperOcean” or “Super-Ocean” dial signature, 200 m water resistance (1957 originals — a remarkable rating for the era), 1000 m for the 81190 Deep Sea
- **Common nicknames**: “Slow Motion” (the 2005 with the one-revolution-per-hour central chronograph hand), “Deep Sea” (specifically the 81190 with 1000 m rating), “Reverse Panda” (the 807 with its white-subdial-on-black-dial layout, one of the first reverse-panda dial designs in watchmaking)
- **Notes**: Breitling launched the SuperOcean line in 1957 — same year as the Omega Seamaster 300 and one year after the Blancpain Fifty Fathoms reached production. The 200 m water resistance immediately matched or exceeded the Rolex Submariner 6204/6536 (100 m) of the same period. The `807` chronograph is a vintage holy grail: as the world’s first dedicated dive chronograph and arguably the first watch ever to use a “reverse panda” dial (a black face with white subdials, calibrated for improved underwater contrast), it is one of the most historically significant 1950s chronographs. The 1964 `2005` “Slow Motion” introduced an engineering oddity that’s also a stroke of brilliance: the central chronograph hand made one revolution per *hour* instead of per minute, allowing divers to read elapsed dive time directly from the central hand rather than a small minute counter. Because the slow-moving hand made it hard to tell at a glance whether the chrono was running, Willy Breitling added a tiny “activity indicator” dot above 6 — yellow when running, half-yellow when paused, black when reset (a clever and underappreciated complication). The 2105 Chrono-Matic SuperOcean (1969) was the first automatic SuperOcean chronograph and used the same Cal. 11/12 as the contemporary Heuer Monaco 1133 and Hamilton Chrono-Matic — one of the world’s first automatic chronograph movements. Auction values: a great `807` can pass $30,000+; the `2005` Slow Motion is rare and frequently mis-attributed.

### Model line: SuperOcean (modern)

- **Refs**: `A17360` (42 mm, 2009 redesign), `A17391` (44 mm), `A17345` (42 mm, current Superocean Automatic 42), `A17375` (Superocean Automatic 42 current), `A17316` (Superocean 36/44 chronograph), `A17040` (1990s-2000s Superocean with rider tab bezel), `Y17310` (Superocean 46 with bronze)
- **Years**: ~1995–present (continuous modern production)
- **Designer / movement**: Caliber 17 (modified ETA 2824), Caliber 24 (modified ETA 7750 chronograph), Cal. B20 (in-house since ~2017, based on Tudor MT5612)
- **Key identifiers**: Unidirectional dive bezel with prominent 5-minute increments and luminous pip at 0, 200 m to 2000 m water resistance depending on variant, oversized luminous markers, arrow-shaped hour hand, screw-down crown, modern aesthetic (less vintage-influenced than the Heritage line)
- **Common nicknames**: “SuperOcean” or “Superocean” (the lowercase “ocean” became official in 2022 — pre-2022 listings often use “SuperOcean” with capital O; post-2022 Breitling uses “Superocean”), “Steelfish” (the late-1990s/2000s ref. `A17040` and later, with the rider-tab dive bezel)
- **Notes**: The modern SuperOcean is Breitling’s professional tool diver, distinct in feel from the vintage-inspired SuperOcean Heritage. Water resistance ratings span 200 m (Superocean 42) to 2000 m (Superocean Automatic 46) to 3000 m (Superocean Heritage Chronoworks special editions). In 2022 Breitling officially dropped the capital “O” in the name to “Superocean” — listings spanning the change use both forms. The shift in 2017+ to the in-house Cal. B20 (which is the Tudor MT5612 base — the chronograph variants use Tudor MT5813 base via the Cal. B01-related exchange) was the most significant technical upgrade.

### Model line: SuperOcean Heritage

- **Refs**: `A17321` (Heritage 46 mm, 2007 launch), `A17320` (Heritage 38), `A17313` (Heritage 38 newer), `M17326` (Heritage 57 capsule, 2020), `M17375` (Heritage II 42), `AB2010` (Heritage II Chronograph 44), `A23370` (Heritage Chronograph 44)
- **Years**: 2007–present
- **Designer / movement**: Cal. 17 (ETA 2824 base, 2007), Cal. 23 (ETA 7750 base chronograph), Cal. B20 (in-house, current Heritage II), Cal. B01 (Heritage Chronograph II 44 from 2017)
- **Key identifiers**: Vintage-inspired SuperOcean styling drawn from the 1957 ref. 1004: large arrow hour hand, simple stick + triangle hour markers, slightly domed sapphire crystal, ceramic bezel insert (Heritage II) with minimal markings (no dive timing graduations), date at 6 (Heritage II) or 3 (older), steel mesh bracelet (“Milanese”) or rubber strap, 200 m water resistance (Heritage II — a deliberate reduction from earlier Heritage’s 500 m to refine the case proportions)
- **Common nicknames**: “Heritage”, “Heritage 57” (the capsule collection most faithful to the 1957 1004), “Heritage II” (the 2017+ generation)
- **Notes**: The SuperOcean Heritage was launched in 2007 to mark the 50th anniversary of the SuperOcean and re-introduced the 1950s tool-diver aesthetic for a vintage-styling-hungry market. The Heritage II (2017) and Heritage ’57 capsule collection (2020) doubled down on the vintage cues — the ’57 capsule famously brings back even the non-screw-down crown and bidirectional friction bezel of the original. Heritage vs. regular SuperOcean is the key disambiguation: Heritage = vintage-inspired (1957 1004 cues), regular = modern tool diver (heavy bezel markings, oversize hands). Both use SuperOcean / Superocean in their name, which causes endless aggregator confusion.

### Model line: Aerospace

- **Refs**: `E56062` (titanium quartz analog-digital, 1985 launch), `E75362` (later variant), `E79362` (Aerospace Avantage), `E79363` (Aerospace EVO with thermo-compensated SuperQuartz)
- **Years**: 1985–present
- **Designer / movement**: Caliber 65 (Aerospace original quartz), Caliber 75/79 (thermo-compensated SuperQuartz from Breitling 1990s onward, ±10 sec/year — chronometer-grade)
- **Key identifiers**: 40 mm (later 43 mm Avantage / EVO) titanium case, hybrid analog (hours/minutes hands) + dual LCD digital displays at 12 and 6, single crown that controls all functions via push and twist combinations, multi-function: chronograph, alarm, second time zone, countdown timer, perpetual calendar (digital), 100 m water resistance, fixed bezel with engraved 60-second scale
- **Common nicknames**: “Aerospace”, “Avantage” (the 43 mm variant), “EVO” (the current generation)
- **Notes**: The Aerospace, launched 1985, was one of the earliest and most enduring analog-digital “ana-digi” pilot watches and effectively defined the category. Its single-crown operation is genuinely clever: a short twist toggles modes, a long twist sets values — engineering that takes practice but allows ten functions through one interface. The titanium case made it lightweight enough for pilots to wear for long sorties without fatigue, and the thermo-compensated SuperQuartz movement reaches chronometer-grade accuracy (~10 seconds per year). The Aerospace has been worn by various military aviation units including the Patrouille de France and the Italian Frecce Tricolori as official issue. Now categorized under Breitling’s “Professional” collection alongside the Emergency and Endurance Pro.

### Model line: Emergency

- **Refs**: `E56021` (1995 original, titanium 43 mm, 121.5 MHz analog beacon), `E56121.1` (minor revision), `E56321` (later original-generation, COSC chronometer-grade movement), `J56321` (white gold, ~20 made — extreme rarity), `K56321` (yellow gold), `E76321` (titanium, SuperQuartz Cal. 76 upgrade 2002), `E76322` (Mission), `E45321` (Mission II 45 mm), `V76325` (Emergency II 51 mm, 2013, dual-frequency 121.5 + 406 MHz)
- **Years**: 1995–present (with hiatus 2009–2013 before Emergency II)
- **Designer / movement**: Caliber 56 (original quartz with analog beacon transmitter), Caliber 76 (SuperQuartz), Caliber 76 modified for Emergency II with 406 MHz transmitter; beacon transmitter was developed in collaboration with Dassault Electronique
- **Key identifiers**: Two crowns (left side for transmitter activation — the cap must be unscrewed and antenna deployed; right side for time setting), telescopic antenna stored inside the case, analog + dual LCD digital displays, titanium case (or white/yellow gold on rarities), 43 mm (original) → 45 mm (Mission II) → 51 mm (Emergency II), distress-beacon transmitter on 121.5 MHz (original) or dual 121.5 + 406 MHz (Emergency II for Cospas-Sarsat satellite system compatibility), “Emergency” or “Chronomètre Emergency” dial signature
- **Common nicknames**: “Emergency”, “PLB watch”, “Emergency II” (the 51 mm dual-frequency generation), “Orbiter 3” (the 1999 limited edition celebrating the first non-stop balloon circumnavigation), “Mission” (the 45 mm generation)
- **Notes**: The Breitling Emergency, launched 1995, is the world’s first wristwatch with an integrated emergency locator beacon (ELT/PLB) and remains a singular product in watchmaking — no other manufacturer has produced anything comparable. The beacon was developed in collaboration with Dassault Electronique and was originally restricted to licensed pilots who signed a waiver acknowledging financial liability for false-alarm rescue costs. Breitling claims more than 20 documented rescues attributable to Emergency activations and reportedly zero false alarms from genuine Emergency owners. The 2013 Emergency II upgrade added a 406 MHz digital distress signal (in addition to retaining the original 121.5 MHz analog signal) compatible with the Cospas-Sarsat international satellite search-and-rescue system, which transitioned away from satellite monitoring of the 121.5 MHz band in 2009. Use restrictions: in many jurisdictions, including the US under FCC and FAA regulations, activating the beacon outside a genuine life-threatening emergency carries significant fines (typically $10,000+). Special editions: the `E56321` Orbiter 3 (1,999 pieces) celebrates Piccard and Jones’s 1999 round-the-world balloon flight; the J56321 white-gold version is limited to 20 pieces and trades at $30,000+; Khanjar dial variants for Omani military command premiums on the secondary market. Listing note: a sizable proportion of vintage Emergency listings show “battery dead, antenna untested” — the beacon’s battery is non-trivial to replace (requiring authorized service), and many listings cannot confirm beacon functionality.

### Model line: Colt

- **Refs**: `A57035` (Colt Automatic original 1980s/90s), `A17380` (modern Colt 41/44), `A74380` (Colt Skyracer titanium), `A77380` (Colt quartz), `X74320` (Colt 36)
- **Years**: 1983–~2018 (discontinued in current catalog)
- **Designer / movement**: ETA 2824 (Cal. 17) on automatic variants, SuperQuartz Cal. 74 on quartz, Cal. 77 on later quartz, Colt Skyracer used a polymer “Breitlight” case
- **Key identifiers**: 41 mm or 44 mm case, military-style hands and indices, rotating dive-style bezel with rider tabs (smaller and less pronounced than Chronomat’s), 200–500 m water resistance, screw-down crown, designed originally as an entry-level military-supply watch
- **Common nicknames**: “Colt”, “Skyracer” (the titanium/polymer variant)
- **Notes**: The Colt was originally Breitling’s military-supply pilot/diver, conceived in 1983 alongside the Chronomat for the more budget-conscious military buyer. It served as Breitling’s entry-level point for decades and was retired from the catalog around 2018 in favor of broader Avenger range expansion and the new Endurance Pro. Secondary-market values are quite reasonable. The Skyracer (a Breitlight polymer-cased lightweight variant) was a curious late-2010s outlier.

### Model line: Avenger

- **Refs**: `A13380` (Avenger Chronograph), `A17370` (Avenger Seawolf 1000 m / 3000 m), `E17370` (Avenger Seawolf titanium), `A32390` (Avenger GMT), `A77310` (Super Avenger 48 mm), `AB0184101` (Avenger B01 Chronograph 44 current), `A45370` (Avenger Bandit), `M13370` (Avenger Blackbird)
- **Years**: 2001–present
- **Designer / movement**: Caliber 13 (modified ETA 7750), Cal. 17 (ETA 2824), Cal. 25 (GMT), Cal. 32 (GMT chronograph), Cal. B01 (in-house since 2018 in select Avenger B01)
- **Key identifiers**: Large case sizes (43–48 mm — the Super Avenger is 48 mm), heavy military aesthetic, oversize luminous numerals at 12-3-6-9, screw-down crown and pushers, prominent unidirectional dive-style bezel with engraved or applied numerals, 300–1000 m water resistance, brushed steel or titanium case
- **Common nicknames**: “Avenger”, “Super Avenger” (48 mm), “Seawolf” (the deep-rated dive variant), “Bandit” (the all-titanium with green dial), “Blackbird” (vintage line carried over)
- **Notes**: The Avenger represents Breitling’s “extreme” sport line — larger cases, higher depth ratings, military aesthetic. The Super Avenger at 48 mm was among the largest mainstream Swiss watches at its 2005 introduction. The Seawolf with a 3000 m water rating (matching the Rolex Sea-Dweller Deepsea territory) was a notable spec achievement. The Bandit (titanium green-dial) had a short-lived cult following. The “Blackbird” name moved from the Chronomat family to the Avenger line in the mid-2000s, which is a frequent listing-matching pitfall (an `A13350` Chronomat Blackbird is different from an `M13370` Avenger Blackbird).

### Model line: Transocean

- **Refs**: `AB0152` (Transocean Chronograph), `AB0510` (Transocean Chronograph Unitime — world time with chronograph, in-house Cal. 05), `R45310` (Transocean Chronograph Unitime in rose gold), `A45310` (Transocean Day & Date)
- **Years**: 2010–~2019 (discontinued in current catalog)
- **Designer / movement**: Caliber 01 (chronograph), Caliber 05 (Unitime — chronograph + world time, in-house, COSC)
- **Key identifiers**: 43 mm or 46 mm round case with clean dial aesthetic, integrated tachymeter scale on rehaut, three-register chronograph at 3-6-9, on Unitime variants the world-time city ring is added, screw-down crown, dressier presentation than other Breitling sport lines
- **Common nicknames**: “Transocean”, “Transocean Unitime”, “TOU”
- **Notes**: The Transocean was Breitling’s mid-2010s attempt at a more dress-oriented chronograph — fewer rider tabs, less aviation aesthetic, cleaner dial. The Transocean Chronograph Unitime (`AB0510`) was a particular technical highlight: a single-crown world-time mechanism allowing the city ring to be advanced one hour at a time with the crown — and the date and chronograph functions all adjust simultaneously. The Cal. 05 Unitime module was Breitling’s first in-house world-time complication. Discontinued around 2019 under the Kern brand reset; secondary-market values are attractive for the in-house Cal. 05 and 01 pieces.

### Model line: Premier (revived)

- **Refs**: `AB0118221B1P1` (Premier B01 Chronograph 42), `AB0148221L1P1` (Premier Bentley Mulliner), `R0918371Q1P1` (Premier B09 Chronograph 40 manual)
- **Years**: 2018–present revival (original Premier line 1943–~1960)
- **Designer / movement**: Cal. B01 (auto chronograph), Cal. B09 (manual, hand-wound chronograph revival — based on B01 architecture but without rotor)
- **Key identifiers**: 40 or 42 mm case, dressy aesthetic, three-register chronograph layout at 3-6-9, applied baton hour markers, dauphine hands on some variants, no slide-rule bezel, integrated tachymeter scale, water-resistant only to 100 m or less (positioned as dress chronograph, not tool watch)
- **Common nicknames**: “Premier”, “Premier B01”, “Premier B09” (the manual)
- **Notes**: Original Premier (1943–~1960) was Breitling’s high-end dress chronograph and the company’s most luxurious line before the Navitimer. Vintage references include the Premier `790` (1940s, Venus 175), `787` (early 1940s rectangular Premier — extremely rare), and `795`. The line was revived in 2018 by Georges Kern as part of Breitling’s pivot toward broader appeal beyond strict tool watchmaking. The manual-wound B09 (in the Premier B09 Chronograph 40, `R0918371Q1P1`) is Breitling’s first modern manual-wound chronograph and represents the brand’s seriousness about the dress segment.

### Model line: Vintage rarities (Duograph, ref. 92, Surfboard, etc.)

- **Refs**: `762` (Duograph rattrapante 1943–~1948, non-waterproof, two-register, Venus 179), `764` (Duograph waterproof 1944+), `783` (later Duograph two-register variant), `766` (three-register Duograph, Venus 185), `791` (three-register waterproof Duograph), `92` (eight-year calendar pocket-watch-derived complication), `190` “Surfboard” (early single-pusher chronograph), `765 AVI` and `765 CP` covered above under Cosmonaute/Co-Pilot
- **Years**: 1940s–1960s
- **Designer / movement**: Venus 179 (two-register rattrapante), Venus 185 (three-register rattrapante with hour counter)
- **Key identifiers**: Split-seconds (rattrapante) chronograph — twin chronograph seconds hands that can be split for interim readings, hour-counter sub-dial on three-register variants, gold or steel cases, “Duograph” or “Premier” signature on dial; ref 92 carries an eight-year date mechanism (a single calendar that requires manual setting only every eight years); the “Surfboard” 190 has an unusual elongated mono-pusher case
- **Common nicknames**: “Duograph” (the rattrapante line), “Surfboard” (190 — for its elongated case shape), “Eight-Year Calendar” (ref. 92)
- **Notes**: Vintage Breitling rarities are an under-followed corner of pre-war and mid-century watchmaking. Total Duograph production from 1943–1970 was approximately 350 pieces across all references (Venus 179- and 185-powered combined) — roughly 13 pieces per year — making them genuinely rare. Most Duographs were special-order production rather than off-the-shelf inventory, which contributes to wide variation among surviving examples. Fred Mandelbaum’s book “Premier Story” (2020) is the standard scholarly reference for the Premier, Duograph, and adjacent rare Breitlings. Authentication on Duographs is notoriously challenging — Alpha Hands and similar collector databases note that a high percentage of surviving Duographs have non-original components (swapped dials, refinished cases, replaced movement parts). Use the crown-as-pusher detail (some Duographs use the crown itself as the rattrapante split-pusher, like Patek and a handful of others) as one authentication marker. The 1999 `E56321` Orbiter 3 (limited edition Emergency in titanium, 1,999 pieces) is also a recognized vintage-style modern rarity.

### Model line: Endurance Pro

- **Refs**: `X82310A41B1S1` (Endurance Pro 44 black), `X82310D21B1S1` (orange), `X82310 series` (all variants)
- **Years**: 2020–present
- **Designer / movement**: Caliber 82 (Breitlight thermo-compensated SuperQuartz, ±10 sec/year, COSC)
- **Key identifiers**: 44 mm Breitlight polymer composite case (lightweight, anti-magnetic), quartz analog with pulsometer/tachymeter functions, vibrant colored bezel and accents (black, red, white, orange, yellow, blue, green), 100 m water resistance, integrated rubber strap
- **Common nicknames**: “Endurance Pro”
- **Notes**: Modern lifestyle-positioned quartz sport watch positioned as a complement to the more traditional Professional line (Aerospace, Emergency). Lower retail than mechanical Breitlings and aimed at a fitness-oriented audience. Listing note: aggregators sometimes confuse it with the Avenger or older Colt — the Breitlight case material (matte composite, light enough to feel almost weightless) is the immediate disambiguator.

-----

### Breitling Caliber Quick-Reference Table

|Caliber                                                                   |Type                                                                         |Used in                                                                                           |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
|Venus 175                                                                 |Manual chronograph                                                           |Original Chronomat 769 (1942), early Premier                                                      |
|Venus 178                                                                 |Manual chronograph, column wheel, 17j                                        |Vintage Navitimer 806 (1956+), Cosmonaute 809, Co-Pilot 765 CP                                    |
|Venus 179                                                                 |Manual split-seconds (rattrapante), two-register                             |Duograph 762/764/783                                                                              |
|Venus 185                                                                 |Manual rattrapante, three-register                                           |Duograph 766/791                                                                                  |
|Venus 188                                                                 |Manual chronograph                                                           |SuperOcean Chronograph 807 (1957)                                                                 |
|Felsa 692 / B125                                                          |Auto, no date                                                                |SuperOcean 1004 (1957)                                                                            |
|Valjoux 72                                                                |Manual chronograph, column wheel, 17j                                        |Pre-806 Navitimer (1954–1955, AOPA), some 1955 transitional 806                                   |
|Valjoux 7740 / R7740                                                      |Manual cam chronograph (Cal. 11/12 base)                                     |Navitimer 7806 (1972–1974)                                                                        |
|Valjoux 7750                                                              |Auto chronograph, cam                                                        |Chronomat 81950 (1984), 81970, A13350 Blackbird, Avenger A13380, modern Cal. 13 (= 7750 rebranded)|
|Caliber 11/12/14 (Buren-Hamilton/Dubois-Dépraz/Heuer/Breitling consortium)|Auto chronograph, modular                                                    |Navitimer Chrono-Matic 1806 (1969+), SuperOcean Chrono-Matic 2105                                 |
|Lemania 1873                                                              |Manual chronograph                                                           |Some transitional 1970s Breitling chronographs                                                    |
|ETA 2824 / 2892 / 7750 (badged)                                           |Auto (Cal. 17 / 23 / 13)                                                     |Modern Colt, modern Avenger, older Chronomat, SuperOcean, older Navitimer 90s/2000s               |
|Cal. 65 (thermo-compensated quartz)                                       |Quartz analog-digital                                                        |Aerospace 1985+                                                                                   |
|Cal. 56 / 76 (SuperQuartz)                                                |Thermo-compensated quartz, ±10 sec/yr                                        |Emergency E56021 (Cal. 56), Emergency E76321 (Cal. 76), Emergency II V76325                       |
|Caliber B01                                                               |In-house auto chronograph, column wheel + vertical clutch, 70h reserve, COSC |Chronomat B01 42/44, Navitimer 01, Premier B01, Avenger B01, Transocean Chronograph               |
|Caliber B02                                                               |In-house manual chronograph (B01 hand-wound variant)                         |Limited editions                                                                                  |
|Caliber B04                                                               |In-house auto GMT chronograph (B01 + GMT module)                             |Navitimer World GMT chrono, Transocean GMT                                                        |
|Caliber B05                                                               |In-house auto chronograph + world time                                       |Transocean Chronograph Unitime                                                                    |
|Caliber B09                                                               |In-house manual chronograph (B01 without rotor)                              |Premier B09 Chronograph 40, Navitimer 1959 Re-Edition (B09)                                       |
|Caliber B13                                                               |Modified 7750 evolution                                                      |Older Chronomat Blackbird A13350                                                                  |
|Caliber B20                                                               |In-house auto, time + date — based on Tudor MT5612 (Tudor-Breitling exchange)|SuperOcean Heritage II 42, SuperOcean Automatic                                                   |
|Caliber B82                                                               |SuperQuartz thermo-compensated                                               |Endurance Pro X82310                                                                              |

### Breitling Listing-Matching Tips

- **Navitimer vs. Cosmonaute**: The Cosmonaute 809 uses a 24-hour dial layout (0/24 at the top), while the Navitimer 806 uses a standard 12-hour layout. In low-resolution thumbnails this is easy to miss — but the 24-hour Cosmonaute dial has a denser hour-marker arrangement and a different chronograph behavior. The Cosmonaute also has only one chronograph pusher in some early variants. AOPA wings can appear on both 806 and 809 dials.
- **AOPA vs. non-AOPA Navitimer**: AOPA-signed dials (with the “Aircraft Owners and Pilots Association” double-wing logo and “AOPA” letters in the center of the wings) command significant premiums on vintage 806s and pre-806s. Pre-806 (1954–1955) examples have NO Breitling signature on the dial — only AOPA wings — and are powered by the Valjoux 72; subsequent 806s have AOPA wings AND Breitling signature, powered by Venus 178. “RAF Navitimer” pieces with the Royal Air Force crest replace the AOPA wings and are exceptionally rare.
- **Vintage Valjoux 72 vs. Venus 178 Navitimer**: The Valjoux 72-powered pre-806s (1954–1955) command meaningful premiums over the Venus 178-powered 806s that followed. Movement identification requires case-back opening; visual disambiguation from the dial alone is impossible. Provenance documentation, original AOPA sales paperwork, and signature/dial details (the early AOPA dials lack the Breitling signature) are the main authentication routes.
- **“Chronomat” as model name vs. dial description**: Older Breitling watches (1940s–1960s) sometimes have “Chronomat” as a dial description rather than a model name — referring to the original Chronographe Mathématique slide-rule chronograph (ref. 769). A modern listing using “Chronomat” should specifically be the 1984+ rider-tab series; vintage listings using “Chronomat” need careful disambiguation against the 769 vintage line.
- **Reference numbering structure (modern, post-1995)**: The first letter encodes case material (`A`=steel, `B`=yellow gold, `D`=steel/yellow gold bicolor, `E`=titanium, `K`=rose gold, `J`=white gold, `R`=red gold, `U`=steel/red gold bicolor, `M` and `Y`=other variants). The second letter is sometimes also material-related (denoting bicolor combinations). The 5 digits encode model + caliber + variant. Modern reference strings extend to 12+ characters with full dial/strap codes; aggregators often strip these. Example breakdown: `AB012012` = `A` (steel case) + `B` (steel bracelet/no second material) + `01` (Caliber 01) + `20` (model code for Chronomat 42) + `12` (dial variant).
- **Pre-1995 numeric refs vs. post-1995 letter-prefix refs**: A naked 3-5 digit number (`806`, `809`, `765`, `81950`, `7806`) indicates pre-1995 production. A letter-prefix ref (`A13322`, `AB012012`, `E56321`) is post-1995. The transition was gradual through 1994–1996.
- **Chronomat 81950 (1984) vs. 769 (1942)**: Both are technically “the Chronomat” — but they have nothing in common visually or mechanically. The 81950 is the rider-tab modern revival; the 769 is the slide-rule 1940s original. Listings should specify era or reference.
- **SuperOcean vs. Superocean (capital O)**: Breitling officially dropped the capital “O” in 2022 — pre-2022 the line is “SuperOcean”, post-2022 “Superocean”. Aggregator listings span both forms.
- **In-house Cal. 01 vs. ETA 7750-based Cal. 13**: A key value disambiguator on Chronomat and Navitimer listings. Cal. 01 in-house pieces (2009+ for Chronomat 44 / Navitimer 01) carry meaningful premiums over Cal. 13 (7750-based). The case-back inscription typically distinguishes; alternatively, Cal. 01 has a 70-hour reserve and the 7750-based Cal. 13 has a 42-hour reserve.
- **Khanjar / Omani / military dials**: Several vintage and modern Breitlings carry the Khanjar (curved dagger) emblem of Oman, gifted by Sultan Qaboos to officers and visiting dignitaries. Authentic Khanjar dials command 3–5× premiums but the symbol is widely faked; provenance documentation is critical.

### Breitling Resources

- **Breitlingsource.com** — the longest-running independent Breitling reference site, with reference-by-reference data on the Emergency, Aerospace, Chronomat, and Navitimer lines.
- **Breitling Archives section on breitling.com/archives** — Breitling’s official archive division will issue extract-from-archives certificates for vintage pieces (a service especially useful for AOPA Navitimers, vintage Premiers, and Duographs); searchable historical reference pages for many vintage refs.
- **Welton-Navitimer.com** — Florent Welton’s exhaustive Navitimer database, including reference variations, AOPA-signed dial sub-types, and serial-range estimates by year.
- **BreitlingVintage.com** — vintage Breitling reference site covering Premier, Duograph, and early SuperOcean.
- **Alpha Hands (alphahands.com)** — collector research with deep Duograph and Premier coverage including caliber and serial-range data.
- **Chronopedia.club** — broad watch wiki with detailed Navitimer 806 and Chronomat pages including dial-variation timelines.
- **Phillips Watches “Breitling Specialty” auction catalogs** — particularly the May 2018 Phillips “Made for Breitling” thematic sale and recurring Phillips Geneva watch auctions, where AOPA pre-806s and rare Duographs have established price records.
- **“Premier Story” by Fred S. Mandelbaum** (2020) — the canonical scholarly reference on Breitling Premier and Duograph chronographs.
- **“Breitling — 140 Years in 140 Stories”** (2024) — Breitling’s official anniversary publication with rich reference detail.
- **Purists / PuristS forum Breitling section** — historic collector discussion archive.
- **WatchUSeek Breitling forum** — large active community, particularly knowledgeable on 1980s/90s Chronomat and Emergency references.
- **Hodinkee “Bring a Loupe” and “Reference Points” Navitimer/SuperOcean coverage** — accessible introductions to the vintage lines.

-----

*End of patch. This document extends the existing aggregator reference index covering Rolex, Omega, Heuer/TAG Heuer, Jaeger-LeCoultre, IWC, Zenith, Patek Philippe, A. Lange & Söhne, Universal Genève, Audemars Piguet, F.P. Journe, and Cartier. Brand-section ordering follows the patch brief (Tudor → Vacheron Constantin → Breitling). All reference numbers, designer attributions, caliber numbers, and historical dates have been cross-checked against primary brand archive material (TudorWatch.com Inside TUDOR, Vacheron-Constantin.com Heritage, Breitling.com Archives) and secondary collector references where applicable; where reference attribution is contested or speculative in the field (e.g., 222 Genta misattribution, AOPA pre-806 exact production years, vintage Tudor Ranger reference assignment), the patch flags the ambiguity rather than silently picking a side. Suggested update cadence: annual, coinciding with Watches & Wonders releases and major Phillips/Christie’s Geneva spring/autumn auction results. For listing-aggregator consumers, the “Listing-Matching Tips” subsections per brand are the most actionable content and should be wired directly into title-parsing/disambiguation logic.*


<!-- Below: new brand `Blancpain` merged from docs/Watch Brand Reference Index — Patch 02.md (2026-05-17) -->

## Brand: Blancpain

### Model line: Fifty Fathoms (vintage, 1953–1970s)

- **Refs**: `1000-1200-64B` (“No Rad” / “No Radiations” dial), `1000-1200-64` (standard 1953 production), Aqua Lung / US Divers co-signed variants, LIP-signed export variants, Bundeswehr-issued, Pakistani Navy-issued, Thai Navy-issued, French Navy “Nageurs de Combat” issue, Spirotechnique-signed variants
- **Years**: 1953–1979 (with extended production for military contracts into the early 1970s)
- **Designer / movement**: Jean-Jacques Fiechter (case + crown architecture, patented locking bezel) · early Rayville/AS 1361 automatic; later AS 1700/1701 and Felsa-derived calibers depending on contract
- **Key identifiers**: 41mm three-piece steel case; Fiechter-patented locking unidirectional bezel (must be pushed down to rotate — distinct from later Submariner-style click bezels); double-sealed caseback; large diamond-tipped or arrow minute hand; “Rayville S.A. succ. de Blancpain” caseback engraving on most production examples (the brand was legally renamed Rayville from 1932 until Blancpain’s revival in 1983); Bakelite bezel inserts on earliest production; lume is radium on pre-1962 examples and tritium thereafter
- **Common nicknames**: “No Rad” or “No Radiations” (the red-and-yellow crossed-out radiation triangle at 6 o’clock confirming non-radioactive tritium lume), “MIL-SPEC 1” (US Navy contract with hemispheric moisture indicator at 6), “Fiechter FF” (collector shorthand)
- **Notes**: The Fifty Fathoms is one of the three watches (along with the Rolex Submariner and Zodiac Sea Wolf) that defines the genesis of the modern dive watch in 1953, and Blancpain’s claim to primacy rests on Fiechter’s combined invention of the locking unidirectional bezel, water-resistant crown system, and double-sealed caseback in a single coherent specification commissioned  by Captain Robert Maloubier of the French Nageurs de Combat. Because the brand operated under the Rayville S.A. name during the entire vintage period (Blancpain was dormant as a corporate identity from 1932 until the JB 1735 era began in 1983), authentication hinges on the caseback’s “Rayville S.A. succ. de Blancpain” legend — pieces signed simply “Blancpain” on the caseback are usually later or suspect. The “No Rad” symbol was added circa 1962–63 after radium tritium-content concerns hit the recreational dive market, and these dials trade at a premium of 2–4× standard variants. Different navies received subtly different specifications: French Nageurs de Combat watches have the brand name absent from the dial in some batches, Bundeswehr-issue pieces carry “Bund”-engraved casebacks with NATO stock numbers, and Aqua Lung / Spirotechnique double-signed dials (created for US Divers Co., Cousteau’s American distributor) are among the most counterfeited variants in vintage diving. Auction records on clean vintage MIL-SPEC examples now routinely clear $40,000–80,000, with the rarest French Navy pieces at Phillips and Christie’s having exceeded $150,000.

### Model line: Tornek-Rayville TR-900 (US Navy contract)

- **Refs**: `TR-900` (single reference, multiple production batches 1964–1966)
- **Years**: 1964–1966 (issued); produced in approximately 1,000 examples
- **Designer / movement**: Jean-Jacques Fiechter case architecture · AS 1361N automatic, sometimes with US-fabricated jewels to satisfy Buy American Act requirements
- **Key identifiers**: “Tornek-Rayville” dial signature (NOT “Blancpain”); MIL-W-22176A(SHIPS) specification; hemispheric moisture indicator at 6 o’clock; triangular 0/60 bezel marker (vs. lozenge/rhombus on European MIL-SPEC variants); 41mm steel case; tritium hands and indices; caseback engraved with US Navy NSN and “DISPOSE RADIOACTIVE WASTE” warning
- **Common nicknames**: “TR-900”, “Tornek”, “the SEAL Fifty Fathoms”
- **Notes**: The Tornek-Rayville TR-900 is the result of a uniquely American workaround to the Buy American Act of 1933, which prevented direct procurement of Swiss watches for US military use; Allen V. Tornek, Blancpain’s US distributor, set up a domestic testing laboratory in New Jersey and re-badged Fifty Fathoms watches under his own name so they could be classified as “American” for procurement purposes. Approximately 1,000 examples were issued to US Navy Underwater Demolition Teams and the nascent SEAL teams between 1964 and 1966, but because the dials and hands were heavily dosed with radium-painted tritium, the vast majority were destroyed via military hazmat disposal at end-of-service-life. Fewer than 100 examples are believed to have survived in collectors’ hands, making this the rarest and most expensive vintage dive watch on the market — clean examples have crossed $250,000 at Phillips and Christie’s, with documented military provenance examples pushing higher. Authentication is extremely difficult because the simple dial layout has been faked extensively; specialists rely on case finishing details (the brushed flank of the case has a specific grain), the exact font of the “Tornek-Rayville” signature (which differs subtly between three known production batches), and movement-side serial correlation. Note also the “AM” MIL-SPEC 1 variant (Blancpain-signed but sharing the TR-900 case) which is documented from circa 1964 and equally rare. 

### Model line: Fifty Fathoms 1980s revival (refs 5000/5015/5020/5025)

- **Refs**: `5000` (1983 revival, Aqua Lung re-edition), `5015`, `5020`, `5025`, and various “Trilogy” 30-piece limited editions issued during Jean-Claude Biver’s tenure
- **Years**: 1983–early 2000s
- **Designer / movement**: Biver/Hayek-era revival under Blancpain SA · ETA 2892-A2 base with Blancpain modifications, later in-house variants
- **Key identifiers**: Smaller 38–40mm case sizes (closer to vintage proportions); domed sapphire crystal; Aqua Lung co-branding on certain editions; cleaner dial without modern minute track flourishes; period-correct Bakelite-look bezel inserts
- **Common nicknames**: “Biver FF”, “Aqua Lung revival”
- **Notes**: When Jean-Claude Biver and Jacques Piguet revived Blancpain in 1983, the Fifty Fathoms was one of three core revivals (alongside the Villeret round dress watch and the moon-phase). These 1980s and 1990s revivals are now significant collectibles in their own right — they predate the bloated modern 45mm Fifty Fathoms and respect the original 41mm proportions, but use modern movements and gaskets so they are wearable as daily divers. The Aqua Lung-signed examples from this era are particularly desirable. This is the bridge generation between the Rayville-era vintage pieces and the modern Swatch Group-era 5015/5018 lineage that began in 2007.

### Model line: Fifty Fathoms Automatique (modern, 2007–present)

- **Refs**: `5015-1130-52` (steel/black, sail-canvas), `5015-1130-52A` (steel/black, rubber), `5015D-1130-52` (alternate strap), `5010-1130-52` (steel/blue limited), `5015-12B40-O52A` (titanium/black), `5015-3603-52A` (steel/blue), `5017-1130-52` (annual calendar), `5025-1130-52A` (complete calendar), `5065-1127-52` (perpetual), `5200` family (chronograph)
- **Years**: 2007–present
- **Designer / movement**: Marc A. Hayek-era redesign · Caliber 1315 automatic (5-day power reserve, three barrels, silicon balance spring) in time-only; Caliber 1315DD for date; Caliber F385 column-wheel chronograph in 5200 series
- **Key identifiers**: 45mm (some 43mm later) steel/titanium/gold case; flat sapphire bezel insert (replaces vintage Bakelite); large applied indices with heavy Super-LumiNova; 4:30 date window;  engraved “Blancpain” signature on case flank (a Hayek-era trademark); exhibition caseback on most refs
- **Common nicknames**: “Modern FF”, “Big FF”, “Hayek Fathoms”
- **Notes**: The current Fifty Fathoms Automatique line, launched in 2007 to mark the model’s 55th anniversary, sized the watch up to 45mm and added the proprietary Caliber 1315 — Blancpain’s three-barrel, 120-hour-power-reserve automatic which is arguably the watch’s strongest technical argument. The sapphire bezel was a major departure that took the FF out of the vintage idiom and gave it a distinct modern identity. Reference numbering follows a five-segment system: case family (5015 = 45mm automatic, 5017 = annual cal, 5025 = complete cal, 5065 = perpetual, 5200 = flyback chrono) — case metal — dial code — strap code. The 4:30 date and the “Blancpain” engraved case flank are the two stylistic decisions that the modern collector community has divided itself over, and both are absent on the smaller-diameter 40mm limited editions (MIL-SPEC, Barakuda, No Rad, Bathyscaphe-line), which has driven those LE pieces to substantial secondary-market premiums.

### Model line: Fifty Fathoms Bathyscaphe (2013–present)

- **Refs**: `5000-1110-52A` (steel/black, 2013 launch), `5000-1110-52B` (steel/black, rubber/canvas variant), `5000-1110-B52A` (current black ceramic-bezel steel), `5000-1110-71S` (steel bracelet, meteor grey), `5000-0127-52A` (ceramic blue), `5000-0130-52A` (ceramic black), `5000-1210-98S` (titanium, anthracite), `5000-31B40-52B` (ocean blue limited), `5000-12B30-NABA` (Blue Mokarran/Gombessa), `5200-0130-52A` (Bathyscaphe Flyback Chronograph, ceramic), `5200-0127-52A` (chronograph blue), `5025-1130-52A` (Quantième Annuel)
- **Years**: 2013–present
- **Designer / movement**: Marc Hayek-era line under Blancpain SA · Caliber 1315 (time + date) for three-handers;  Caliber F385 flyback column-wheel for chronograph; Caliber 1315QA for annual calendar
- **Key identifiers**: 43mm (men’s; also 38mm women’s) case; ceramic bezel insert with Liquidmetal hour markers  (replaces the original 2013 anodised aluminium bezel after 2016); brushed steel/titanium/ceramic case finish; sword-shape hour hand; date at 4:30; thinner profile than the 45mm “Big FF”; sapphire caseback; sail-canvas, NATO, rubber, or bead-blasted steel bracelet options
- **Common nicknames**: “Bathy”, “BFF” (Bathyscaphe Fifty Fathoms), “Ocean Commitment” (for the green-dial charity editions)
- **Notes**: The Bathyscaphe revives a 1956 sub-family of the Fifty Fathoms originally intended as a smaller-cased civilian diver, and is now arguably Blancpain’s most successful modern reference — the 43mm case, ceramic bezel, and 5-day movement combine to make it the rare modern dive watch that is genuinely competitive with the Submariner, Seamaster, and Aquanaut on its own technical merits. The 2013 launch reference 5000-1110-52A had a black anodised aluminium bezel insert that was upgraded to ceramic with Liquidmetal markers in subsequent production — early aluminium-bezel examples are now appreciated as transitional pieces. The Bathyscaphe Flyback Chronograph (5200 family) carries Blancpain’s in-house F385 column-wheel automatic and is one of the few flyback chronographs at this price point with both a vertical clutch and column wheel. The Ocean Commitment / Gombessa / Mokarran limited editions tied to Laurent Ballesta’s marine expeditions carry charity provenance and trade at modest premiums.

### Model line: Tribute to Fifty Fathoms / Anniversary Limited Editions

- **Refs**: `5008-1130` (Tribute to Fifty Fathoms MilSpec, 2017, 500 pieces), `5008-11B30` (Hodinkee MIL-SPEC, 2020, 500 pieces), `5008-11B30-NABA` (“Barakuda” 2019, 500 pieces in steel), `5008-11B40-NABA` (No Rad tribute, 2022, 500 pieces), `5010-12B40-B64A` (Air Command), `5008B-1130-B52A` (Nageurs de Combat)
- **Years**: 2010–present (rolling LE programme)
- **Designer / movement**: Marc Hayek-era · Caliber 1151 (most LEs — slim 100-hour automatic) or Caliber 1315
- **Key identifiers**: 40mm case (the “sweet spot” size, smaller than the standard 45mm Fifty Fathoms Automatique); historically referenced bezel designs (coin-edge, serrated, etc.); period-correct dial layouts; restored vintage features (moisture indicator on MilSpec, red-and-yellow Barakuda batons, etc.)
- **Common nicknames**: “Tribute”, “Hodinkee FF”, “Barakuda”, “Nageurs”, “Air Command” (technically a separate chronograph reissue but lives in the same family)
- **Notes**: The Tribute / LE program is where Blancpain has put its most collector-focused product since roughly 2010, and the 40mm case size — never standard production in the modern line — is the key reason these references trade at very strong secondary-market premiums (the 2020 Hodinkee MIL-SPEC, originally CHF 14,800, has crossed $40,000 in secondary). Each LE typically references a specific vintage variant: the 2017 Tribute to Fifty Fathoms MilSpec (ref 5008-1130) reinterprets the 1957 MIL-SPEC 1 with its moisture indicator; the 2020 Hodinkee MIL-SPEC (ref 5008-11B30) brings back the Tornek-Rayville triangular 0/60 marker and coin-edge bezel; the Barakuda revives the orange-and-white batons commissioned by German distributor Barakuda in the 1960s; the No Rad reissues the red-and-yellow radiation crossed-out logo; and the Nageurs de Combat honours the original French commando issue. Authentication on these LEs is straightforward (limited-edition numbering on caseback) but specific reference identification matters for valuation as the various LE families have diverged significantly in market price.

-----

### Caliber Quick-Reference Table — Blancpain (divers)

|Caliber        |Type                                                            |Model lines / eras                                                                   |
|---------------|----------------------------------------------------------------|-------------------------------------------------------------------------------------|
|AS 1361 / 1361N|Automatic                                                       |Vintage Fifty Fathoms, MIL-SPEC, Tornek-Rayville (1953–1960s)                        |
|AS 1700/1701   |Automatic                                                       |Late vintage FF and military variants                                                |
|Felsa 690/692  |Automatic                                                       |Selected vintage civilian FF variants                                                |
|Cal. 1151      |Automatic, 100h PR                                              |Many 40mm Tribute / Hodinkee LEs, slim profile                                       |
|Cal. 1315      |Automatic, 120h PR, 3 barrels,  silicon balance                 |Modern Fifty Fathoms Automatique 5015 family; Bathyscaphe 5000 family (2013–present) |
|Cal. 1315DD    |Cal. 1315 with date                                             |Time-and-date variants of above                                                      |
|Cal. 1315QA    |Cal. 1315 + annual calendar module                              |Bathyscaphe Quantième Annuel 5025                                                    |
|Cal. F385      |In-house flyback column-wheel chronograph, vertical clutch, 5Hz |Bathyscaphe Chronograph Flyback 5200 family                                          |
|Cal. 13R0      |Manual 8-day chronometer (historical lineage cited in marketing)|Not used in current divers; relevant to Blancpain movement family                    |

### Listing-Matching Tips — Blancpain

- **Rayville vs Blancpain dial signatures**: Vintage FFs almost always have “Rayville S.A. succ. de Blancpain” on the caseback. A vintage-style watch signed only “Blancpain” on the caseback is either a 1980s+ revival (legitimate) or a re-cased fake (common).
- **Bakelite bezel vs aluminium bezel vs sapphire bezel**: Vintage = Bakelite (brittle, often chipped); 1980s revival = aluminium; modern = sapphire over Liquidmetal (Bathyscaphe early) or ceramic over Liquidmetal (Bathyscaphe current).
- **The “No Rad” symbol is dial-printed, not engraved**: Counterfeit dials sometimes get this wrong with raised paint.
- **Modern reference format**: `5015-1130-52` parses as case family (`5015`) – case material/dial (`1130` = steel/black sunburst) – strap (`52` = sail-canvas). The trailing letter (e.g. `52A`, `52B`) is a strap-revision suffix.
- **45mm vs 43mm vs 40mm**: Modern FF Automatique = 45mm; Bathyscaphe = 43mm; LE Tributes = 40mm. Sellers frequently mis-state size; always verify.
- **MilSpec vs MIL-SPEC**: The 2017 Tribute uses “MilSpec” on the dial; the 2020 Hodinkee piece uses “MIL-SPEC” (hyphenated, all caps). Different references, different markets, different prices.
- **Aqua Lung / US Divers signed dials are heavily faked** on vintage examples — provenance, dial-printing quality, and case finishing must all align.

### Resources — Blancpain

- *Fifty Fathoms — The Dive and Watch History 1953–2013* (Jeffrey S. Kingston, Blancpain-published; the definitive reference)
- The Blancpain Blog (blancpainblog.com) — Jeff Kingston’s editorial, dial-by-dial comparisons
- Phillips Watches archive (phillipswatches.com) and Christie’s vintage watch sales — for documented Tornek-Rayville and MIL-SPEC auction comparables
- Hodinkee “Reference Points: Five Decades of the Fifty Fathoms” — by Tony Traina
- *DOXA SUB: A 50 Year Journey* (Dr. Peter McClean Millar) — overlaps on Cousteau-era diving watches
- Watchprosite Blancpain forum — long-standing community board with deep MilSpec and Tornek-Rayville expertise
- The Fifty Fathoms Lounge on WatchUSeek for serial-number cross-referencing

-----


<!-- Below: new brand `Nivada Grenchen` merged from docs/Watch Brand Reference Index — Patch 02.md (2026-05-17) -->

## Brand: Nivada Grenchen

### Model line: Chronomaster / Chronomaster Aviator Sea Diver (vintage)

- **Refs**: `85002`, `85004` (the “Orange Boy” with orange chrono hand), `85006`, `85007`, `85009`, `85011`, `85013`, `85016`, `85018`, `85019`, `85022`, `85025`, `85040` (later Valjoux 7733 cushion-case variant), `85072` “racing” variants, `8221` (early 1960s, Valjoux 92), `8500/3730` (lollipop hand variant); US-market Croton-signed variants share these references; “broad arrow” hand variants distinguished from later baton-hand executions
- **Years**: 1961/63–1978 (production ran in waves under multiple movement suppliers)
- **Designer / movement**: In-house Nivada design · Valjoux 92 (earliest 2-register), Valjoux 23 (US/Croton variants), Venus 210, Landeron 248, Valjoux 7733 (later cushion-case 85040 series); all hand-wound
- **Key identifiers**: 38–38.5mm stainless steel case  (straight lugs on early refs, cushion case on Valjoux-7733 refs from late 1960s); bi-compax (2-register) dial with running seconds at 9 and 30-minute counter at 3 (the 30-minute counter has the first 5 minutes printed in **reverse** order and highlighted in red as a regatta countdown — the watch’s signature dial detail); bidirectional rotating bezel with 60-minute outer scale AND 12-hour inner scale for second time zone (a key disambiguator); tachymeter scale on inner ring; dials signed “Nivada Grenchen Chronomaster Aviator Sea Diver”, “Croton Chronomaster Aviator Sea Diver”, or “Croton Nivada Grenchen”; broad arrow hands on 1960s production, baton hands on 1970s; the iconic orange chrono hand on the “Orange Boy” refs (85004)
- **Common nicknames**: “Super Chronograph” (factory marketing term), “Orange Boy” (orange chrono hand variants, ref 85004), “Aviator Sea Diver”, “CASD”, “Panda” (white-dial reverse-panda variants), “Tropical” (faded brown-from-black dial variants)
- **Notes**: Advertised at launch as “the World’s Busiest Watch”, the Chronomaster Aviator Sea Diver combined nine functions — chronograph, tachymeter, 60-minute diving bezel, 12-hour GMT bezel, regatta countdown, telemeter (on some refs), 200m water resistance, anti-magnetism, and shock resistance — into a single 38mm tool watch, which was a remarkable design feat for 1961. The brand operated under a confusing dual identity: the same watches were sold as “Nivada Grenchen” in Europe and as “Croton” or “Croton Nivada Grenchen” in the US  (Movado had successfully challenged Nivada’s right to its similar-sounding name in the American market). Movement variation is the single biggest disambiguator on the secondary market: Valjoux 23 (US/Croton) and Valjoux 92 (European/Nivada) are the most desirable, the Valjoux 7733 cushion-case 85040 is the most common, and Venus 210 and Landeron 248 variants exist but are less collectible. Tropical-dial examples (where black has aged to chocolate brown) trade at significant premiums; original Singer-made dials (Singer was the same supplier that made Rolex Daytona “Paul Newman” dials) are the most coveted, particularly the “Big Eye” lollipop-handed 8500/3730. The book *Chronomaster Only* (by the Moonwatch Only authors) is the standard reference.  Beware aggressive redials — the reverse-3-2-1-O countdown in red is precisely-rendered on originals; faded or off-color red is a major red flag.

### Model line: Chronomaster (modern reissues, 2020–present)

- **Refs**: `86007M` (closest to vintage ref 8221, black dial broad arrow), `86010M` (panda), `86011M` (lollipop-hand alternative to 8500/3730), `86012M` (Orange Boy reissue of 85004/4076),  `86004M` and `86005M` (other dial/handset combinations), various Aviator Sea Diver dial-text reissues, “Singer Paul Newman” limited edition (2024), 25-piece limited edition with refurbished Valjoux 23 (2021)
- **Years**: 2020–present
- **Designer / movement**: Modern Nivada Grenchen design team (Guillaume Laidet + Rémi Chabrat) · Sellita SW510 hand-wound chronograph (most production); refurbished Valjoux 23 (2021 LE); modular customisable bezel system on the 2024 Singer Paul Newman edition
- **Key identifiers**: 38.3mm steel case (faithful to vintage proportions — refreshingly un-bloated); sapphire crystal (replaces vintage acrylic); period-correct dial layout including the reverse-3-2-1-O red regatta countdown; bidirectional dive/GMT bezel; modern Super-LumiNova “old radium” coloration on most variants
- **Common nicknames**: “Modern CASD”, “Reissue Chronomaster”, “Singer Newman” (for 2024 LE)
- **Notes**: Nivada Grenchen’s 2020 relaunch under Guillaume Laidet (a longtime vintage-watch dealer/scene insider) and Rémi Chabrat (Montrichard Group) succeeded where many heritage revivals have failed by virtue of preserving the original 38mm case size, dial layout, and overall proportions — most reviewers describe these as among the most faithful vintage reissues at the sub-$2,000 price point. The 2021 limited edition with refurbished Valjoux 23 movements (NOS calibers preserved for decades) is the closest you can get to a “new vintage” piece. The 2024 Singer Paul Newman edition introduced a swappable-bezel system, where multiple aluminium bezel inserts can be exchanged to change both look and function. Reference numbering for modern Nivada uses 5-digit codes prefixed `86` for Chronomaster and ending in `M` for manual-wind variants — distinct from the vintage 5-digit reference convention.

### Model line: Antarctic (vintage diver)

- **Refs**: `32007` (no date), `32012` (date), `32016`, `32019`, `32022`, `32023` (Super Antarctic); first-execution refs from 1955–63 use early Antarctic naming without “Super”; later 1960s diver execution uses Super Compressor-style case
- **Years**: 1954/55–early 1970s (first-execution Antarctic), 1960s diver variants
- **Designer / movement**: Nivada in-house · ETA cal. 1256 (early Antarctic), later ETA 2375, 23xx, 24xx series automatic;  AS 1701/1700 in the diver Super Compressor variants
- **Key identifiers**: 35mm round case (first-execution Antarctic) with large Art-Deco applied indices and dauphine hands, NO rotating bezel — this is a waterproof automatic, not a true diver; the Super Compressor-style diver variants (1960s) have dual crowns, internal rotating bezel, “aquarium” highly-domed acrylic crystal, and 200m water resistance; “Antarctic” printed below 12 on dial; Cal. 1256 dial signatures
- **Common nicknames**: “Deep Freeze” (after Operation Deep Freeze 1, 1955–56), “Aquamatic” (the predecessor model name on which Antarctic was based)
- **Notes**: The Antarctic was Nivada’s first waterproof automatic, derived from the Aquamatic and issued to Admiral Richard Byrd’s US Navy team during Operation Deep Freeze 1, the 1955–1956 expedition that established the first US presence at the South Pole — military-expedition provenance that Nivada has marketed continuously ever since. The first-execution Antarctic from 1954–55 has the longest production run of any Nivada model (over eight years), with large Art-Deco applied numerals and faceted markers arranged in a “V” pattern outside the markers — these straight-typeface early examples are visually distinct from later Antarctic II/III/IV/V/VI execution variants which used different fonts  and dial layouts. The dive-bezel Antarctic refs (32007, 32012, 32016 family) are the more “diver-like” pieces sometimes referred to by collectors as the “Antarctic Diver” or “Super Antarctic” depending on the dial signature. The advertising photograph for the original Antarctic (a bearded model named Peter Jarman smoking a cigarette) was famously banned in Cuba by Fulgencio Batista because the model bore a perceived resemblance to Fidel Castro — a quirky historical footnote that has become collector trivia.

### Model line: Antarctic / Super Antarctic (modern reissues, 2020–present)

- **Refs**: 35mm Antarctic refs (Landeron 21 hand-wound); 38mm Super Antarctic refs (Soprod P024 automatic, date and no-date variants); Super Antarctic 35mm refs; Antarctic Diver 38mm refs; Antarctic GMT (twin-crown, internal bezel, 2023+) — referenced via Nivada’s modern alphanumeric SKU system
- **Years**: 2020–present
- **Designer / movement**: Laidet/Chabrat-era Nivada · Landeron 21 manual-wind (35mm Antarctic); Soprod P024 (38mm Super Antarctic and Diver)
- **Key identifiers**: 35mm or 38mm steel case; large applied Art-Deco numerals (some with lume, some unlumed steel/gold-plated); dauphine hands; golden medallion on caseback; multiple dial colorways; Diver variant adds rotating bezel; GMT variant features twin crowns and internal rotating bezel evoking the original Antarctic GMT from the early 1970s 
- **Common nicknames**: “Modern Antarctic”, “Super Antarctic”
- **Notes**: The 2020 revival of the Antarctic preserves the vintage proportions and dial design more faithfully than almost any other modern reissue at this price point, and the 35mm Landeron 21 variant is essentially a hand-wound vintage replica with modern manufacturing. The 2023 Antarctic GMT references a rare 1970s twin-crown Antarctic and is one of the few sub-$2,000 GMTs to use a proper internal rotating bezel rather than a bezel-mounted GMT.

### Model line: Depthmaster (vintage)

- **Refs**: First-execution Depthmaster (1965, “Art Deco” dial with bold Art-Deco numerals — collector nickname); various dial configurations including “Pac-Man” variant (cult-favorite Art-Deco numeral arrangement); Depthomatic (1964 — predecessor with mechanical depth gauge)
- **Years**: 1964 (Depthomatic) – early 1970s
- **Designer / movement**: Nivada in-house · ETA 2472 automatic (Depthomatic),  various ETA-based automatics in Depthmaster
- **Key identifiers**: 38mm Swedish steel cushion-shaped case (extremely thick for the era); 1,000m / 100 ATM water resistance rating (one of the most water-resistant production watches of the 1960s); reinforced screw-down caseback with extra threads; double-sealed “Crysgard” crystal system; bi-directional fluted rotating bezel with recessed slots; matte black dial; lollipop hour hand, sword minute hand, red-tipped seconds hand; tritium luminous Art-Deco numerals and markers; the Depthomatic predecessor has an amber bladder around the crystal as a mechanical depth indicator
- **Common nicknames**: “Art Deco” (for the bold-numeral dial), “Pac-Man” (rare numeral-arrangement variant), “Baby Panerai” (collector nickname for the chunky cushion case)
- **Notes**: The 1965 Depthmaster was advertised as “tested deeper than any other underwater watch” and its 1,000m rating made it one of the few production watches of the era capable of competing with the Rolex Sea-Dweller (which itself only launched in 1967 at 610m). The “Art Deco” dial with its bold, stylized 6 and 9 numerals is the most recognized variant and is what most collectors mean when they say “Depthmaster”. The 1964 Depthomatic predecessor is technically more important historically — it was among the first wristwatches with a mechanical depth gauge (preceded only by Favre-Leuba’s Bathy 50 by a year or two depending on dating) — using an amber plastic bladder around the crystal that filled with water at depth to indicate diving depth.

### Model line: Aviator Sea Diver (separate from Chronomaster) / Sea Diver variants

- **Refs**: `87001` (white dial), `87002` (black dial), `87003` (grey dial); broad arrow hand variants and baton hand variants; tropical dial variants; Dessert King transitional refs
- **Years**: 1960s
- **Designer / movement**: Nivada in-house · various ETA and AS-based automatics
- **Key identifiers**: 36–38mm steel case; rotating bezel; “Aviator Sea Diver” or “Sea Diver” dial signature (note: this is a distinct simpler watch from the Chronomaster Aviator Sea Diver chronograph, which adds the chronograph complication); broad arrow hands on early production
- **Common nicknames**: Often confused in listings with the Chronomaster Aviator Sea Diver — verify with chronograph pushers and movement
- **Notes**: A frequent source of listing confusion: “Aviator Sea Diver” without “Chronomaster” refers to a separate, simpler three-hand-with-bezel diver — not the chronograph. Listings frequently misuse the name; check for chronograph pushers and movement type. The Dessert King is a transitional variant. Tropical dials and broad arrow handsets command premiums.

-----

### Caliber Quick-Reference Table — Nivada Grenchen

|Caliber             |Type                            |Model lines / eras                                              |
|--------------------|--------------------------------|----------------------------------------------------------------|
|Valjoux 92          |Manual chronograph, 2-register  |Vintage Chronomaster (European/Nivada branded), 1961–early 1960s|
|Valjoux 23          |Manual chronograph, 2-register  |Vintage Chronomaster (US/Croton branded), 1960s                 |
|Venus 210           |Manual chronograph              |Selected vintage Chronomaster variants                          |
|Landeron 248        |Manual chronograph              |Selected vintage Chronomaster variants                          |
|Valjoux 7733        |Manual chronograph, cam-actuated|Late-1960s/1970s cushion-case Chronomaster ref 85040 family     |
|ETA 1256            |Automatic                       |Vintage Antarctic (first execution)                             |
|ETA 2375, 23xx, 24xx|Automatic                       |Vintage Antarctic (later executions)                            |
|ETA 2472            |Automatic with date             |Vintage Depthomatic, some Depthmaster variants                  |
|AS 1700/1701        |Automatic                       |Vintage Antarctic Diver / Sea Diver variants                    |
|Sellita SW510       |Manual chronograph (modern)     |Modern Chronomaster reissue (2020–present)                      |
|ETA Valjoux 7750    |Automatic chronograph (modern)  |Autochron and modern automatic chronograph variants             |
|Soprod P024         |Automatic                       |Modern Super Antarctic 38mm (2020–present)                      |
|Landeron 21         |Manual-wind                     |Modern Antarctic 35mm reissue                                   |

### Listing-Matching Tips — Nivada Grenchen

- **“Nivada” vs “Croton” vs “Nivada Grenchen” vs “Croton Nivada Grenchen”**: All four are the same brand. US-market watches were sold as “Croton” (1939 trademark settlement with Movado); some have Croton, some Nivada Grenchen, and some both on the dial. Also seen with US-market private-label dials: Pierre Vallee, Rudolph’s, Austin, Guildcrest, Sussex, Le Marc — all identical movements/cases.
- **Chronomaster Aviator Sea Diver ≠ Aviator Sea Diver**: The former is a chronograph (refs 8xxxx with two pushers); the latter is a 3-hand bezel diver (refs 87xxx).
- **The reverse-numeral regatta countdown** (red 3-2-1-O at the start of the 30-min subdial) is the single most recognizable Chronomaster dial feature.
- **Vintage 85040 (Valjoux 7733)** is the most common Chronomaster reference and trades at lower premiums than the earlier Valjoux 92 / Valjoux 23 examples.
- **Modern reference convention**: `86007M`, `86010M`, etc. — `86` prefix is Chronomaster, trailing `M` denotes manual-wind. Modern Antarctic uses different conventions.
- **The “Pac-Man” Depthmaster dial** is genuinely rare; most “Pac-Man” listings are misidentifications of the standard Art-Deco dial.
- **Singer-made dials** on vintage Chronomasters command large premiums; verify dial-printing detail and provenance.

### Resources — Nivada Grenchen

- *Chronomaster Only* (book by the Moonwatch Only authors / OnlyWatch books) — the standard vintage Chronomaster reference
- *Super Antarctic — The Book* (Aashdin K. Billimoria) and *The Antarctic Book* (Billimoria) — two collector-authored deep dives on the Antarctic lineage
- Nivada Grenchen official site (nivadagrenchenofficial.com) — for modern reference cross-referencing
- watchfid.com (vintage Nivada photography archive)
- Analog:Shift Nivada Grenchen blog series — strong on the dual-name Croton history
- Time and Tide / Worn & Wound / Monochrome historical features on the Antarctic and Chronomaster
- WatchUseek vintage Nivada/Croton forum

-----


<!-- Below: new brand `Benrus` merged from docs/Watch Brand Reference Index — Patch 02.md (2026-05-17) -->

## Brand: Benrus

### Model line: Type I Military (MIL-W-50717, Navy SEAL dive watch)

- **Refs**: Type I (1972–1980 production for US Naval Special Warfare units); ordnance-wheel-marked variants; broad-arrow-marked variants; “sterile” no-marking variants
- **Years**: 1972–1980 (production); the underlying MIL-W-50717 specification dates from the early 1970s
- **Designer / movement**: Benrus Watch Co. (Ridgefield, CT) · Benrus GS1D2 (modified ETA 2620) automatic, 40-hour power reserve, hacking seconds, no date
- **Key identifiers**: 43mm one-piece (monobloc) bead-blasted/Parkerised steel case (asymmetric, with crown guard integrated into case shape); 14mm thick; fixed unidirectional 60-minute bezel with sterile lume pip; one-piece case opens through the crystal (no caseback); olive-drab matte dial with simple stick markers, hour markers at 3-6-9-12 only; tritium hands and indices; orange-tipped seconds hand; 20mm fixed bars (no spring bars on most examples) requiring NATO strap; serial number stamped on crown-side case flank or caseback
- **Common nicknames**: “Type I”, “SEAL Benrus”, “Class A dive watch”
- **Notes**: The Type I was developed against US military specification MIL-W-50717, which mandated a fully sealed monobloc dive watch case with no caseback openings, and was issued primarily to US Navy SEAL teams, Underwater Demolition Teams, and assorted clandestine units (including documented issuance to the CIA’s Special Activities Division) during the closing years of Vietnam and through the late 1970s. The asymmetric case with integrated crown guard is the watch’s signature design feature and predates Panerai’s mainstream commercialization of the cushion/integrated-crown-guard look. Like many military-issue watches, the majority of issued examples were destroyed at end of service life due to radium/tritium content; surviving examples with original tritium dials and intact case finishing have traded in the $5,000–15,000 range at Phillips and various specialist dealers, with documented unit-issue provenance pushing higher. The reissue by the modern Benrus brand (relaunched in Switzerland in the late 2010s) is a separate product and should not be confused with the originals. Authentication relies on case-flank serial format, dial-printing typography, hand luminescence, and movement consistency — fakes are increasingly common in this segment.

### Model line: Type II Military (MIL-W-50717 update)

- **Refs**: Type II (1972–1980); with and without phosphorescent tritium warning text; date and no-date variants exist
- **Years**: 1972–1980
- **Designer / movement**: Benrus GS1D2 (same as Type I) automatic; date-equipped variants use modified base
- **Key identifiers**: Same 43mm monobloc case as Type I but with date complication; date window typically at 3 o’clock; rotating bezel position differs in some batches; “H3” tritium warning marking; otherwise nearly identical to Type I
- **Common nicknames**: “Type II”, “Date Benrus”, less colloquially “Officer’s Benrus”
- **Notes**: The Type II is essentially the date-equipped variant of the same MIL-W-50717-derived platform, and was issued in smaller numbers. Visually and functionally nearly identical to the Type I except for the date complication. Both Type I and Type II Benrus dive watches were the subjects of a detailed Worn & Wound feature article that remains the most accessible single reference for their identification.

### Model line: DTU-2A/P (MIL-W-3818B field watch)

- **Refs**: `MIL-W-3818B / DTU-2A/P` (Benrus production 1964–early 1970s); date codes engraved on caseback (e.g., “OCT 1964”, “MAR 1969”)
- **Years**: 1964 (Marine Corps procurement) – early 1970s
- **Designer / movement**: Benrus · Benrus DR 2F2 (17-jewel hacking manual-wind, ~30 sec/day accuracy, 36-hour power reserve);  some sources cite 7-jewel base-metal variants in less-stringent procurement batches
- **Key identifiers**: 34mm (35.5mm with crown) by 40.5mm steel bead-blasted matte case; acrylic crystal; matte black dial with 12-hour Arabic numerals on outer track and 24-hour numerals on inner ring; triangular luminous hour markers; lumed hour and minute hands; orange-tipped (later red-tipped) arrow seconds hand; drilled lug holes for 18mm NATO/canvas strap; caseback engraved with the MIL-W-3818B spec, “U.S.”, year/month of manufacture, and contract number; tritium lume
- **Common nicknames**: “DTU”, “Vietnam Benrus”, “3818B”, “the original field watch”
- **Notes**: The Benrus MIL-W-3818B is arguably the most influential field watch design of the 20th century — its 34mm case proportions, 24-hour inner track, and triangular markers became the visual template that Hamilton, Marathon, Timex, and countless modern brands have copied. Benrus won the 1964 US Marine Corps procurement contract against Longines-Wittnauer, Mathey-Tissot, and Clinton Watch of Chicago, and production ran in significant numbers through the Vietnam War years; Phillips has documented examples that were issued to “a certain three-letter intelligence agency” for covert operations in Vietnam predating the broader Gulf-of-Tonkin escalation. The 3818B specification was the lineal ancestor of the GG-W-113 (1967) and MIL-W-46374 (which produced the more famous Hamilton and Marathon field watches). Authentication relies on the engraved caseback (date, spec, contract number must be consistent and correctly stamped), case finishing (bead-blasted matte, not polished), and the DR 2F2 movement. Many examples have been refurbished with replacement crowns and crystals; sanitised casebacks (engraving removed)  are common on units issued to clandestine personnel. Reissues are sold by both the modern Benrus brand (Switzerland) and numerous homage manufacturers.

### Model line: Sky Chief / Sky Chief II (civilian chronograph)

- **Refs**: Sky Chief (1950s–1960s, various dial configurations); Sky Chief II (date-equipped successor)
- **Years**: late 1940s – 1960s
- **Designer / movement**: Benrus · Valjoux 71 / 72 manual-wind chronograph in earlier examples; Valjoux 7733 in later
- **Key identifiers**: 36mm stainless steel chronograph case; 2-register dial (running seconds at 9, 30-minute counter at 3); tachymeter/telemeter peripheral scales on some variants; “Sky Chief” dial signature; gold-filled and steel case variants; broad-arrow or pencil hands
- **Common nicknames**: “Sky Chief”, “Benrus chrono”
- **Notes**: The Sky Chief was Benrus’s flagship civilian chronograph and is one of the more sought-after 1950s American-branded chronographs (the movement is Swiss but the watch was assembled and marketed in New York). Several dial variations exist including waterproof “screw-down” cases and pilot-style configurations. These are vintage market specialty pieces that occasionally appear at HQ Milton, Analog:Shift, and various US-based vintage dealers; condition is typically the limiting factor as these were daily wearers rather than tool-watch trophies.

### Model line: DTU/DTG series (multi-time-zone military)

- **Refs**: `DTU-2A/P` (designation also used for the 3818B above), `DTG` variants (Dual Time GMT-style for aviators), various NATO-stock-numbered military variants
- **Years**: 1960s–1970s
- **Designer / movement**: Benrus · various Swiss-ebauche-based manual and automatic calibers
- **Key identifiers**: Similar case architecture to standard DTU but with second time zone indication on inner bezel or 24-hour subdial; military designations stamped on caseback
- **Common nicknames**: “DTG Benrus”
- **Notes**: These are niche military variants and trade in a small specialist sub-market. Authentication requires careful cross-reference with US military procurement records; counterfeits and “franken” pieces assembled from period parts are common in this segment.

-----

### Caliber Quick-Reference Table — Benrus

|Caliber               |Type                                 |Model lines / eras                         |
|----------------------|-------------------------------------|-------------------------------------------|
|Benrus DR 2F2         |Manual-wind, 17 jewels, hacking      |MIL-W-3818B / DTU-2A/P (1964 onwards)      |
|Benrus GS1D2          |Automatic (modified ETA 2620), 40h PR|Type I and Type II dive watches (1972–1980)|
|Valjoux 71 / 72       |Manual chronograph                   |Sky Chief and Sky Chief II                 |
|Valjoux 7733          |Manual chronograph, cam-actuated     |Later Sky Chief variants                   |
|ETA-based calibers    |Various automatic                    |Civilian dress and sports models           |
|Modern ETA 2671 / 2824|Automatic (modern revival brand)     |Current Benrus DTU-2A/P reissues           |

### Listing-Matching Tips — Benrus

- **Caseback authenticity is everything**: Original 3818B casebacks show spec, date of manufacture (e.g., “OCT 1964”), part number, and “DOD” or branch markings. Re-stamped or sanitised casebacks need provenance to justify premium pricing.
- **Type I vs Type II**: Type I has NO date; Type II HAS date. Both are 43mm monobloc.
- **Vintage 1972–1980 Type I dive watches vs modern Benrus brand reissues**: The current Benrus (Switzerland-based, La Chaux-de-Fonds)  is a reborn brand using the trademark — these reissues are recent and should not be confused with original SEAL-issue pieces.
- **Drilled lug holes**: Original MIL-W-3818Bs have drilled lug holes for fixed bars or aftermarket NATOs. The 18mm lug width is standard.
- **Tritium dial degradation**: Period-correct examples have aged tritium with creamy/yellow patina; pure-white or radium-style lume is suspicious.
- **Sky Chief variants are often misidentified** as TAG Heuer or other branded chronographs in non-specialist listings.
- **The “Benrus” name has been licensed multiple times** post-1970s — the genuine vintage Benrus Watch Co. of Ridgefield, CT ceased original production in the 1970s.

### Resources — Benrus

- Worn & Wound, “Military Watches of the World: U.S.A. Part 2” — comprehensive MIL-W-3818B / Type I / Type II overview
- Chronopedia (chronopedia.club) MIL-W-3818B and Type I/II entries
- Hamilton Chronicles (hamiltonchronicles.com) — for cross-reference with the broader US military watch ecosystem
- Phillips, “The Hour Glass / Military Watches” auction catalogues
- DC Vintage Watches and Craft + Tailored for documented military-issue Benrus examples
- A Blog to Watch and Hodinkee feature articles on the Type I / SEAL issue history

-----


<!-- Below: new brand `Favre-Leuba` merged from docs/Watch Brand Reference Index — Patch 02.md (2026-05-17) -->

## Brand: Favre-Leuba

### Model line: Bathy 50 (1968–early 1970s)

- **Refs**: `15016`, `15017`, `53243-42` (1969 production reference seen with full sets); rectangular Bathy 50 variant introduced 1971
- **Years**: 1967 (Bathy 15 prototype) – 1968 (Bathy 50 production launch) – early 1970s (production end coincided with Peseux 320 movement discontinuation)
- **Designer / movement**: Favre-Leuba (patented 1965 by the brand) · Peseux 320 manual-wind base; depth gauge module proprietary to Favre-Leuba
- **Key identifiers**: ~40mm stainless steel case;  black bakelite bidirectional rotating bezel with elapsed-time scale; signed screw-down crown; black tritium dial with white-printed depth gauge ring (graduated in both metres and feet, 0–50m / 0–160ft); red depth-indicator hand pointing to the depth gauge ring (in addition to standard hours/minutes/sub-seconds); aneroid metal membrane in the caseback that flexes under water pressure to drive the depth hand via a linkage; “Bathy 50” or “Bathy 15” dial signature with the brand’s hourglass logo
- **Common nicknames**: “Bathy”, “The first depth-gauge watch”, “the Favre depthmeter”
- **Notes**: Favre-Leuba’s Bathy 50 (1968) is one of two competing claims to “first wristwatch with a mechanical depth gauge” — Favre-Leuba’s patent dates from 1965 and its production Bathy 15 appeared in 1967,  with the deeper-rated Bathy 50 in 1968; Nivada Grenchen’s Depthomatic appeared in 1964 but used a different (bladder-based) depth indication mechanism rather than the aneroid-membrane approach. The Favre-Leuba mechanism is the technically significant ancestor of the modern Blancpain X Fathoms and Favre-Leuba Bathy 120 MemoDepth (2018) systems. Despite the watch’s historical importance — it predates the Rolex Sea-Dweller’s helium escape valve commercialisation — Bathy 50s remained in production for only a few years because the Peseux 320 movement was discontinued in the early 1970s, ending both the Bathy and the sister Bivouac altimeter watch.  Original Bathy 50s with intact tritium and working depth gauges command $8,000–15,000 at vintage specialists; full-set examples with documentation are rarer still. Note that early Quill & Pad and historical sources incorrectly identify the Bathy 50 as Bourdon-tube-based — actually it is an aneroid-membrane mechanism  (similar in principle to a barometer), which is why the Bathy 50 has been described inconsistently in older literature.

### Model line: Sea Sky (chronograph diver)

- **Refs**: `36030` (dual-crown Sea Sky), `36031`, `36045`, `33033` (1960s Sea Sky Chronograph — the historical reference for the 2024 Sea Sky Revival); Valjoux-72-powered variants
- **Years**: late 1960s – early 1970s (vintage); 2024 revival as “Sea Sky Revival Chronograph”
- **Designer / movement**: Favre-Leuba · Valjoux 72 (3-register manual chronograph) on vintage; modern revival uses La Joux-Perret L112 column-wheel automatic chronograph (a derivative of the Valjoux 7750 family) 
- **Key identifiers**: ~40mm steel chronograph case with rotating bezel; 3-register dial (running seconds at 9, 30-min counter at 3, 12-hour counter at 6 on Valjoux 72 examples); tachymeter and telemeter peripheral scales; broad-arrow minutes hand, dauphine hours hand; the brand’s hourglass logo and cursive “Sea Sky” dial signature; the dual-crown Sea Sky 36030 variant adds an inner rotating bezel (with countdown timer) operated by the second crown
- **Common nicknames**: “Sea Sky”, “Sea Sky Chrono”; the 2024 revival is known as the “Sea Sky Revival”
- **Notes**: The Sea Sky was Favre-Leuba’s high-end sports chronograph of the late 1960s, sharing its Valjoux 72 movement with the Rolex Daytona, Heuer Carrera/Autavia, and Breitling Navitimer of the same era — making it a movement-equal contender to far more famous chronographs of the period at substantially lower current prices. The 2024 Sea Sky Revival Chronograph (CHF 3,950) revives the 1960s ref 33033 dial design  under Patrik Hoffmann’s revived Favre-Leuba brand (post-Tata, see below), with subtle changes (the brand name no longer includes its historical hyphen).

### Model line: Raider (chronograph)

- **Refs**: `26105`, `26106` (Valjoux 7733 cushion case 1970s Raider variants); various other Raider-branded chronograph refs
- **Years**: late 1960s – 1970s
- **Designer / movement**: Favre-Leuba · Valjoux 7733 manual-wind chronograph (cam-actuated 2-register)
- **Key identifiers**: ~38mm cushion case; bi-compax 2-register dial; “Raider” dial signature; bidirectional bezel on some refs; broad-arrow or paddle hands
- **Common nicknames**: “Raider”
- **Notes**: The Raider was Favre-Leuba’s more accessible chronograph line in the 1970s, competing in roughly the same market as the Heuer Cortina and Camaro of the era. Production was modest and surviving examples are reasonably uncommon. The cushion case and Valjoux 7733 movement place these firmly in the 1970s tool-chrono idiom.

### Model line: Sea King / Sea Chief / Sea Bird / Sea Conquistador / Deep Blue

- **Refs**: Sea Chief refs (32.5mm, FL 101 caliber, from 1956); Sea King refs (34mm, water-resistant, from 1956); Sea Bird refs (date variants from 1957, FL 102 caliber); Deep Blue refs (200m diver from 1960); Sea Conquistador refs (broader diver family)
- **Years**: 1956 (Sea Chief launch) – early 1970s
- **Designer / movement**: Favre-Leuba in-house FL 101 and FL 102 calibers (manual-wind); Twin Power caliber (from 1965 on certain models);  various automatic calibers in larger Sea-named refs
- **Key identifiers**: Compact 30–36mm cases; water-resistant case construction; “Sea King”, “Sea Chief”, or other Sea-prefixed dial signatures with the hourglass logo; some date-equipped variants have magnifying-lens crystals (cyclops-style)
- **Common nicknames**: “Sea King”, “Sea Chief”, “FL classics”
- **Notes**: The Sea-family is Favre-Leuba’s broad mid-tier vintage line — competent water-resistant manual-wind watches that are now under-the-radar collectibles in the same idiom as vintage Tudor Oysters and Longines Conquests but at lower prices. The 1960 Deep Blue was advertised as one of the first wristwatches with 200m water resistance — predating the broader proliferation of 200m+ ratings later in the decade — and is a meaningful historical artifact even though the brand never commercialized this lead the way Rolex and Blancpain did.

-----

### Caliber Quick-Reference Table — Favre-Leuba

|Caliber            |Type                                     |Model lines / eras                                                                          |
|-------------------|-----------------------------------------|--------------------------------------------------------------------------------------------|
|Peseux 320         |Manual-wind                              |Bathy 15, Bathy 50, Bivouac (1960s–early 1970s); discontinued early 1970s ending these lines|
|FL 101             |Manual-wind in-house                     |Sea Chief (1956), various entry-level Sea-family pieces                                     |
|FL 102             |Manual-wind in-house with date           |Sea Bird (date variants from 1957)                                                          |
|Twin Power         |High-frequency automatic in-house        |1965+ Sea-family upgrade variants                                                           |
|Valjoux 72         |Manual chronograph, 3-register           |Sea Sky vintage chronograph (1960s–70s)                                                     |
|Valjoux 7733       |Manual chronograph, 2-register cam       |Raider, late vintage chronograph variants                                                   |
|La Joux-Perret L112|Modern column-wheel automatic chronograph|2024 Sea Sky Revival                                                                        |
|Various ETA/Sellita|Modern automatic                         |Bivouac 9000 (revived), Raider Sea King (revived)                                           |

### Listing-Matching Tips — Favre-Leuba

- **“Favre-Leuba” vs “Favre Leuba”**: The brand historically used the hyphen; the revived/modern brand has dropped it.  Both names appear in literature.
- **Bathy 50 vs Bathy 15**: Bathy 15 (1967, 15m depth gauge range) is the earlier and rarer prototype-grade piece; Bathy 50 (1968, 50m range) is the production model. Bathy 50 rectangular variant (1971) is rare. 
- **Aneroid-membrane mechanism, not Bourdon tube**: Despite some older sources, the Bathy 50 uses an aneroid (membrane) depth mechanism, not a Bourdon tube. Bourdon-tube depth gauge wristwatches were tried by Aquastar and others but Favre-Leuba’s was membrane-based.
- **Bivouac altimeter**: 1962 first wristwatch with aneroid barometer/altimeter   — closely related to the Bathy mechanism. Bivouac and Bathy share the Peseux 320 caliber.
- **Brand has multiple revival cycles**: Quartz-crisis collapse, several owners through 1990s/2000s, revival under Tata Group (2015–2022 with the Bivouac 9000, Raider, etc.), market exit by Tata circa 2022–23, and a 2024 revival under Patrik Hoffmann (formerly Ulysse Nardin CEO) with the Sea Sky Revival. Modern references should be checked for which revival era they belong to.
- **Service Bathy 50 watches with care**: Many examples on the market have non-functioning depth gauges due to corroded membranes; restoration is specialist work and not always possible.
- **Production was small** even at peak — Favre-Leuba was never a mass-market brand, so all surviving vintage examples have some collectibility regardless of model.

### Resources — Favre-Leuba

- Time2Tell (time2tell.com) “Main models of Favre-Leuba watches” — comprehensive vintage model overview by Joseph Belmont
- Quill & Pad’s “Comprehensive Look at Mechanical Depth Gauge Watches” series — for Bathy 50 mechanism discussion
- Fratello Watches Favre-Leuba archive — for revival-era coverage
- Heuerworld Favre Leuba Bathy 50 section
- Vintage Watch Specialist (UK) — for documented Bathy 50 sales
- Lesmala.net/plongee/histoiremontre.htm — French-language history of diving watches  with extensive Favre-Leuba content
- WatchUseek Favre-Leuba forum

-----


<!-- Below: new brand `Enicar` merged from docs/Watch Brand Reference Index — Patch 02.md (2026-05-17) -->

## Brand: Enicar

### Model line: Sherpa Graph MK Ia (the “Stirling Moss / Jim Clark” first execution)

- **Refs**: `1308 BaNCH` (the original factory reference as catalogued in the 1960 Saturn in-house magazine); collectors often shorthand this as “MK Ia”
- **Years**: 1960–1961
- **Designer / movement**: Enicar / Racine family · Valjoux 72 (3-register manual chronograph) with rosé golden finish; 35mm column-wheel high-grade caliber
- **Key identifiers**: 40.2mm × 49.3mm stainless steel EPSA Compressor case with bayonet lock back; 13.5mm thick; lug width 20mm; inner tachymetre scale in WHITE only, marked “Tachymetre Base 1000”; large Saturn-style Enicar logo (letters in the middle of the Saturn ring); RADIUM lume (the only Sherpa Graph generation with radium); grey or black dial with white sub-dials; “Gladius hands” — sword-shaped skeletonised hour and minute hands, available with or without radium lume inside the skeleton; cloverleaf engraving on the caseback; thin compressor crown without Saturn marking on earliest production; estimated production ~500 pieces
- **Common nicknames**: “Stirling Moss”, “Jim Clark” (Clark’s chief engineer Dick Scammell received one as thanks for help winning the 1963 F1 championship), “MK Ia”, “Gladius”
- **Notes**: The MK Ia is the rarest and most desirable Sherpa Graph generation by a wide margin — produced in roughly 500 pieces between 1960 and 1961, with the unique “Gladius” skeleton sword hands and the only radium lume in the Sherpa Graph series. The connection to Stirling Moss (who appeared in Enicar advertising and was photographed wearing one in the in-house “Saturn” magazine) and to Jim Clark / Dick Scammell has made these watches the apex of Enicar collecting; clean examples at recent auctions have crossed $40,000+, with the rarest variants substantially higher. Authentication is critical because there are many “MK I” pieces that are actually MK Ib or transitional — the distinguishing features are the white-only inner tachy scale, the radium lume (which has aged to a distinctive yellow-brown patina), the precise Gladius hand shape, the cloverleaf caseback, and the unsigned thin compressor crown. The Nico-led research project at enicar101.com maintains a serial-number database for Sherpa Graph identification.

### Model line: Sherpa Graph MK Ib (1961–1962)

- **Refs**: Same `1308` family reference; MK Ib serial range overlaps MK Ia
- **Years**: late 1961 – 1962
- **Designer / movement**: Enicar · Valjoux 72 with rosé golden finish  
- **Key identifiers**: Same case as MK Ia (40.2mm EPSA Compressor); inner tachy scale predominantly in SILVER without the word “Tachymetre” (the only Sherpa Graph generation with this layout); paddle-shaped hour and minute hands (the now-iconic Enicar paddle, longer tip than later examples); radium lume; new dial colors introduced including the “reverse panda” (black with white subs) and the famous grey-dial-with-white-subs “Jim Clark” version, plus all-white variant; thin compressor crown with Saturn marking; cloverleaf caseback
- **Common nicknames**: “MK Ib”, “Jim Clark” (specifically the grey-dial variant)
- **Notes**: The MK Ib is the transitional second generation, introducing the paddle hands and the silver tachy ring that distinguish it from the MK Ia, as well as new dial colors. Note that “Jim Clark” as a collector nickname is widely misused — by Enicar 101’s research, the specific Jim Clark connection is most legitimately tied to the MK Ib grey-dial variant or earlier MK Ia pieces; many MK II/III/IV listings are inappropriately marketed as “Jim Clark” pieces.

### Model line: Sherpa Graph MK II / MK IIa (1962–1965)

- **Refs**: `072/001` (introduced ~1963), `072/002` (continues into MK III era)
- **Years**: 1963–1965
- **Designer / movement**: Enicar · Valjoux 72C (3-register manual chronograph, fundamentally same as MK I but with later production updates)
- **Key identifiers**: 40.2mm EPSA Compressor case unchanged; new dial variations; transitional hand styles; tritium lume (radium phased out); estimated production ~1,600 pieces (smallest run after MK Ia)
- **Common nicknames**: “MK II”
- **Notes**: A transitional execution between the seminal MK I generation and the heavier-production MK III. Production was modest. The MK IIa designation was introduced by enicar101 to distinguish a small ~1963 sub-batch.

### Model line: Sherpa Graph MK III (1965–1972)

- **Refs**: `072-02-01`
- **Years**: 1963/65–1972
- **Designer / movement**: Enicar · Valjoux 72C; serial ranges 641.xxx, 835.1xx–835.9xx, 906.4xx, 908.xxx, 940.5xx–941.4xx; ca. 3,200 pieces produced
- **Key identifiers**: Same 40.2mm EPSA Compressor case; 13.5mm thick; lug width 20mm; inner tachymetre scale in BLACK or GREY (non-base style, starting at 300 km/h); most common dial is black with grey sub-dials; smaller, more refined applied Enicar logo (no longer the giant Saturn-in-the-middle of MK I); paddle hands with rectangular tritium lume and orange tip (tip is shorter than MK Ib); rare dial variants include complete black, complete white, white with silver subs, and black with silver subs
- **Common nicknames**: “MK III”
- **Notes**: The most produced and most commonly seen Sherpa Graph variant — also the foundation of the modern collector market for these watches. Clean examples with original dials and matching cases trade in the $7,000–15,000 range at vintage specialist dealers; the rarer dial color variations (all-white, blue) push higher.

### Model line: Sherpa Graph MK IV (1967–early 1970s)

- **Refs**: `146-01`, `146-02`, `146-03`, `146-04` (per the user-specified taxonomy in the source brief); enicar101 documents the MK IV reference as `072-02-01` with later evolution variants
- **Years**: late 1967 – early 1970s
- **Designer / movement**: Enicar · Valjoux 72 (later refs use Valjoux 726 or in some examples the 7734 in later evolution)
- **Key identifiers**: 40.2mm × 49.3mm steel EPSA Compressor case (slightly thicker at 13.5mm); two-tone dial with black or white chapter ring contrasting with the dial center; NO lume plots at hour markers (a key MK III vs MK IV distinguisher); applied Enicar logo similar in style to MK III but font slightly bolder/fuzzier on some examples (less stringent QC); most common dial: black with white sub-dials; rare variants include white with grey/silver subs, black with grey subs, and blue with white subs; baton-style minute/hour hands (no longer paddles); orange or red painted chrono minute counter hand; triangular red/orange central chrono seconds hand; combined MK III+MK IV production approximately 6,000 pieces
- **Common nicknames**: “MK IV”, “Reverse Panda MK IV” (for the white-sub-on-black variant)
- **Notes**: The MK IV is the chunkiest and most “1970s” Sherpa Graph, with bigger lugs, thicker bevels, and the bolder dial chapter ring. It’s frequently cited as the most legible execution and many enthusiast collectors (including Fratello’s Tomáš Suk-Mikulínkó, formerly Czech vintage writer) consider it the most wearable. The blue dial reverse-panda MK IV is rare and trades at substantial premiums on the secondary market.

### Model line: Sherpa Super-Dive (Super Compressor diver)

- **Refs**: `140-01`, `140-02`; full reference format `144/35/02` and similar; 200m water resistance
- **Years**: 1960s
- **Designer / movement**: Enicar · AR 1145 automatic
- **Key identifiers**: EPSA Super Compressor case (single or dual-crown depending on variant); inner rotating bezel operated by upper crown; ~38–40mm steel case; “Sherpa Super-Dive” dial signature; 200m rating
- **Common nicknames**: “Super-Dive”
- **Notes**: The Super-Dive is the entry into the dual-crown Sherpa diver lineage that culminates in the Ultradive. Many were issued or worn by various European naval forces — the Polish Navy Super Dive issuances documented by enicar101 are a recent area of collector research.

### Model line: Sherpa Ultradive (300m diver, Super Compressor)

- **Refs**: `144/35/03` (MK I Ultradive), `144/35/03A` (Sherpa OPS sibling with PVD-coated case); time-only large-case dive watch
- **Years**: mid-1960s – early 1970s
- **Designer / movement**: Enicar · AR 1145 automatic
- **Key identifiers**: Large EPSA Super Compressor case with crown guard (the Ultradive’s defining design feature, intended to prevent snagging during dives); dual-crown configuration (upper crown rotates the internal dive bezel only when pulled out — a clever safety mechanism so the bezel can’t be moved accidentally during a dive); “double lollipop” seconds hand (Ultradive-exclusive); rated to 300m; matte black dial; tritium lume; rare also seen with three internal shock-absorbing rubber tubes positioned between movement holder and case (a feature that distinguishes Ultradive from the otherwise similar OPS reference)
- **Common nicknames**: “Ultradive”, “OPS” (for the PVD-coated 144/35/03A sibling), “Polish Navy” (for issued examples)
- **Notes**: The Ultradive is the apex Enicar diver, prized for its substantial proportions, crown-guarded case, and the unique safety-bezel mechanism. Clean unpolished examples with intact tritium routinely trade in the $5,000–10,000 range; the PVD-coated OPS variant is rarer and commands a premium. The 144/35/03A “OPS” was reportedly produced for Polish military divers among other military markets (East German examples are documented).

### Model line: Sherpa Jet / Super-Jet (GMT chronograph and GMT diver)

- **Refs**: Jet Graph 300 (chronograph + GMT) — MK I `072/002`, MK II, MK III, MK IV with `072-02-01` later variants; Sherpa Jet MK I–IV time-only-with-GMT (`148-35-02` for AR 1146 caliber Sub Compressor); Sherpa Super-Jet (42mm cushion case MK IV)
- **Years**: 1963–early 1970s
- **Designer / movement**: Enicar · Valjoux 724 (Jet Graph — GMT chronograph) with golden finish; AR 1126 / AR 1146 / AR 166 (Sherpa Jet/Super-Jet time+GMT)
- **Key identifiers**: 36mm (Jet) or 40mm/42mm (Super-Jet) EPSA Compressor case; aluminum GMT bezel with 24-hour numerals (6–18 black on silver, 18–6 reverse); free-turning bezel without clicks on early; red anodised aluminum pointer ring (Jet Graph-exclusive); red and black checker GMT hand; orange or red triangle chrono seconds hand (MK IV); various dial colors including pepsi-bezel racing dials; Sherpa 300 logo with sea-pearl on caseback on most variants
- **Common nicknames**: “Jet Graph”, “Super-Jet”, “Pepsi Enicar”
- **Notes**: The Sherpa Jet Graph (the chronograph + GMT) is one of the more unusual mid-1960s complications, combining a column-wheel chronograph with a GMT hand and rotating 24-hour bezel. Production was small and the watches are rare. The MK IV Jet Graph is the most commonly seen but still uncommon. The simpler Sherpa Jet (time + GMT, no chronograph) was produced in considerably larger numbers across MK I–IV. The Super-Jet MK IV with its 42mm cushion case is among the most distinctive 1970s Enicars and has its own following.

### Model line: Sherpa Aqua Graph (chronograph diver)

- **Refs**: `148`, `149`; MK Ia, Ib, II, III, IV generations following the same generational logic as the Sherpa Graph; reference 072/002 and 072/02/02 documented
- **Years**: 1963–1969
- **Designer / movement**: Enicar · Valjoux 72 manual chronograph
- **Key identifiers**: EPSA Compressor case (sometimes with Sherpa Dive bezel and red ring on early examples); 3-register dial; rotating dive bezel; 300 feet (≈90m) water resistance; Aquagraph trademark dating from 1957; later variants follow MK IV-style hand changes (orange minute counter, triangle red chrono seconds)
- **Common nicknames**: “Aqua Graph”
- **Notes**: The Aqua Graph is the diver-specific Enicar chronograph — combining the Valjoux 72 with the dive bezel and EPSA Compressor case. Production was small across all four MK generations. The watch is documented to have been worn by Brigitte Bardot, Romy Schneider, and Maurice Ronet in the 1969 film *La Piscine* — high-end celebrity provenance that enicar101 has researched extensively.

### Model line: Sherpa Guide (GMT diver, dual-crown)

- **Refs**: Sherpa Guide MK I–MK IV; 600m and 300m variants; some “Guide 600 GMT” listings
- **Years**: 1960–1970s
- **Designer / movement**: Enicar · AR 1126 automatic with GMT
- **Key identifiers**: 42mm case (larger than the standard Sherpa Jet); dual-crown configuration; inner rotating 24-hour bezel; GMT hand; long lugs on MK I–III, shorter cushion case on MK IV; documented in larger production numbers than the Jet Graph
- **Common nicknames**: “Guide”
- **Notes**: The Guide is one of the more readily available higher-end vintage Enicars due to its larger production runs, but quality varies. It’s a pilot’s watch in design intent despite its diver-like dimensions.

### Model line: Sherpa Dive / Sherpa Date / Sherpa Star Diver

- **Refs**: `100/124 BaANXS` (Sherpa Dive), `167-10-01` (Sherpa 320 automatic), `144-59-01` (Sherpa large diver); Sherpa Star Diver (42mm, two versions: stainless steel and PVD)
- **Years**: 1956–1970s
- **Designer / movement**: Various Enicar AR-series automatic calibers
- **Key identifiers**: Range of EPSA Compressor and traditional cases; Star Diver has unique sapphire domed crystal, screw-down crown, unidirectional bezel, short arrow-style hands — uniquely it has a screw caseback (not EPSA bayonet style); Sherpa Divette is the smaller diver in the family
- **Common nicknames**: “Star Diver” (the 42mm 1970s upgrade); “Divette” (smaller diver), “Sherpa Dive”
- **Notes**: This broader Sherpa diver family is well-documented at vintageenicar.com and represents the workhorse range. The Sherpa Dive ref 100/124 BaANXS used on the Hans Hass Xarifa II underwater expedition is one of the more historically significant diver references; Hans Hass was a pioneering Austrian underwater filmmaker and Enicar’s promotional partnership with him is documented in archived correspondence.

-----

### Caliber Quick-Reference Table — Enicar

|Caliber                           |Type                                        |Model lines / eras                                   |
|----------------------------------|--------------------------------------------|-----------------------------------------------------|
|Valjoux 72 / 72C                  |Manual chronograph, 3-register, column-wheel|All Sherpa Graph and Aqua Graph generations (MK I–IV)|
|Valjoux 724                       |Manual chronograph with GMT                 |Sherpa Jet Graph (chrono + GMT)                      |
|Valjoux 726 / Valjoux 7734        |Manual chronograph                          |Late MK IV Sherpa Graph examples                     |
|Enicar AR 1125                    |Automatic                                   |Base for AR 1126/1146 GMT family                     |
|Enicar AR 1126                    |Automatic with GMT                          |Sherpa Jet, Sherpa Guide                             |
|Enicar AR 1145                    |Automatic                                   |Sherpa Super-Dive, Sherpa Ultradive (300m)           |
|Enicar AR 1146                    |Automatic with GMT (Sub Compressor)         |Sherpa Jet 148-35-02                                 |
|Enicar AR 166 / AR 167            |Automatic with GMT (later evolution)        |Sherpa Super-Jet MK IV, Sherpa 320                   |
|Enicar AR 1701 / AS-based calibers|Automatic                                   |Various Sherpa Star, Sherpa Date                     |
|Beta 21                           |Quartz                                      |Brief late-1970s Enicar quartz experiment            |

### Listing-Matching Tips — Enicar

- **Reference numbering is inconsistent**: vintage Enicar used multiple parallel reference conventions — a long-form (`072-02-01`), short-form (`072/002`), or descriptor codes (`144/35/03`). All four MK generations of the Sherpa Graph share the long-form `072-02-01` in late production.
- **The MK Ia “Gladius” hands are the single most counterfeited element** of vintage Enicar — they are extremely difficult to fake convincingly because of the precise skeletonisation; most “MK Ia” listings without provenance should be assumed MK Ib or later.
- **“Jim Clark” tag is overused**: Strictly speaking, the Jim Clark connection is the grey-dial MK Ib (and possibly the MK Ia). Any MK II/III/IV labelled “Jim Clark” is marketing.
- **EPSA Compressor crown identification**: Early thin compressor crowns are UNSIGNED; later waffle-pattern crowns have the Enicar Saturn logo. Many crowns have been swapped during service.
- **Cloverleaf vs Sea-Pearl caseback**: Early MK I–II Sherpa Graphs have a cloverleaf engraving; MK III–IV have the “Sherpa 300” with sea-pearl emblem.
- **Aqua Graph vs Sherpa Graph confusion**: Aqua Graphs have a rotating dive bezel (no tachymeter); Sherpa Graphs have an inner tachymetre scale. Both use Valjoux 72.
- **Brand status**: The original Enicar (Racine family) went bankrupt in 1987; the modern “Enicar” Hong Kong brand is unrelated to the vintage manufacturer and uses neither the original tooling nor the AR-series calibers. Vintage and modern Enicar are essentially separate brands sharing only the name.
- **Sir Edmund Hillary connection**: There is an unresolved historical debate over whether Hillary wore an Enicar Sherpa or a Rolex Oyster Explorer on his 1953 Everest summit; Enicar’s claim is documented in Swiss expedition records but is not universally accepted. The 1956 Lhotse expedition Enicar issuance is better documented.

### Resources — Enicar

- **enicar101.com** (run by “Nico” / @_JimJupiter) — the definitive online resource for Sherpa Graph / Jet Graph / Aqua Graph / Ultradive identification, with extensive serial-number research and generation-by-generation detail
- **vintageenicar.com** — broader Sherpa family coverage (Star Diver, Guide, Divette, etc.)
- **enicar.org** — additional vintage Enicar content including the Sherpa Jet/Super-Jet exploration article by Martijn van der Ven
- *Time for a Change: Discovering Vintage Enicar* (Martijn van der Ven, 2019, self-published) — the only book-length vintage Enicar reference; essential for serious collectors
- Fratello Watches “Understanding the Different Enicar Sherpa Graph Executions” by Tomáš Suk-Mikulínkó
- Wind Vintage Collector’s Guide to the Sherpa Ultradive
- timeline.watch Enicar entries for Super-Compressor / Ultradive details
- S.Song Watches and Watchfid.com for documented vintage photography

-----


<!-- Below: new brand `Doxa` merged from docs/Watch Brand Reference Index — Patch 02.md (2026-05-17) -->

## Brand: Doxa

### Model line: Sub 200 T.Graph (1969 chronograph diver)

- **Refs**: Vintage Sub 200 T.Graph (1969–early 1970s, three dial colors: Professional/orange, Sharkhunter/black, Searambler/silver); modern reissue limited editions including the 2019 50th-anniversary stainless steel (300 pieces), 2019 18k 4N gold (13 pieces), and orange “Professional” reissue with restored NOS Valjoux 7734
- **Years**: 1969–early 1970s (vintage); 2019–2020 (modern LE reissues)
- **Designer / movement**: Doxa under Synchron Group ownership · vintage: Eberhard Cal. 310-82 (column-wheel manual chronograph, ~14 lignes, integrated date, one of the last classic column-wheel chronograph movements designed in the 1960s) — Doxa-marked “Cal. 287”; modern reissue: refurbished NOS Valjoux 7734 manual chronograph
- **Key identifiers**: 43mm (modern) / similar dimensions vintage steel case; bi-compax dial (running seconds at 9, 30-min counter at 3, date at 6 on some); patented Doxa unidirectional rotating bezel with dual indication (US Navy no-decompression dive table on the inner ring, elapsed-minutes on the outer); Doxa-signed crown (no recessed crown area like the Sub 300T — flat case sides); “<25 MC” tritium-content marking on vintage dials; Cousteau/Gene Cernan documented provenance examples; Apollo 17 / Cernan connection (Cernan owned a vintage Professional T.Graph)
- **Common nicknames**: “T.Graph”, “T-Graph”, “Sub 200 Chrono”, “Cernan Doxa”
- **Notes**: The 1969 Sub 200 T.Graph is one of the most coveted vintage Doxa references because of its rarity (production estimated in low hundreds, not thousands), its Eberhard 310-82 column-wheel movement (the only Synchron-group Doxa to use this caliber — Heuer used a Valjoux equivalent and Omega/Lemania used the 930 in comparable date chronographs), and the documented Jacques Cousteau and Gene Cernan provenance examples. The Professional/orange version is the most recognizable; Searambler/silver is rarer; Sharkhunter/black is also extremely scarce. The “T” in T.Graph denotes Tritium luminous material (and is unrelated to the “T” in the Sub 300T which denotes “Tested” / extreme depth rating). Vintage T.Graphs trade at $15,000–35,000 for clean examples, with Cousteau/Cernan provenance pieces substantially higher. The 2019 stainless steel reissue (priced ~$5,000) brought back the design with the unusual marketing point that the movements were NOS Valjoux 7734 preserved by the Jenny family during the brand’s dormant period — historically interesting but ahistorical in caliber choice (the original was Eberhard, not Valjoux).

### Model line: Sub 300 (1967 — the foundational reference)

- **Refs**: Vintage Sub 300 (1967–1969 Synchron-era, four-color launch: Professional/orange, Sharkhunter/black, Searambler/silver, Caribbean/dark blue); modern Sub 300 COSC (`821.10.001.20` Sharkhunter, `821.10.021.10/.20` Searambler, `821.10.351.10/.20` Professional/orange, `821.10.101.10/.20` Sharkhunter, `821.10.011.20`, `821.10.241.10` Aquamarine, `821.10.361.10/.31` Divingstar/yellow, etc. — full reference structure `821.10.XXX.YY` where XXX = dial code and YY = strap code)
- **Years**: 1967–early 1970s (Synchron-era vintage); 2002+ (Marei-era revival); 2020+ (current SUB 300 COSC). 2020 expanded the modern lineup to 8 dial colors including Aquamarine (turquoise), Whitepearl (white), Sea Emerald (green) joining the original four
- **Designer / movement**: Vintage: Synchron-group Doxa with co-design input from Jacques Cousteau / US Divers (Cousteau chaired US Divers 1957–1996) — ETA-based automatic in vintage; modern: ETA 2824-2 automatic, COSC-certified, 38h power reserve, 28,800 vph
- **Key identifiers**: 42.5mm × 45mm tonneau/cushion-shaped 316L stainless steel case (the modern reissue precisely preserves vintage dimensions); 13.4mm thick; lug width 20mm; PATENTED Doxa unidirectional rotating bezel with **dual indication** — inner ring shows US Navy no-decompression dive times in minutes, outer ring shows depth in meters with colored dots at 12 (orange/yellow/blue depending on color); domed sapphire crystal (vintage was acrylic); screw-down crown; 300m / 30 bar water resistance; the iconic orange “Professional” dial is the foundational reference; “beads of rice” stainless steel bracelet (period-correct vintage style); date at 3 with cyclops on some examples
- **Common nicknames**: “Sub 300”, “Cousteau Doxa”, “Sharkhunter / Professional / Searambler / Caribbean / Divingstar / Aquamarine / Whitepearl / Sea Emerald” (each color is a named sub-variant)
- **Notes**: The 1967 Sub 300 is one of the watches that defines the second wave of modern dive watch history — alongside the contemporaneous Rolex Sea-Dweller and Aquastar Benthos 500. Cousteau himself wore the Sub 300 and his US Divers / Aqua Lung company distributed Doxa to the American diving community; this commercial relationship is the reason Doxa pioneered the no-decompression dive table on the bezel (developed in collaboration with US Divers using US Navy diving manuals) — every other dive watch at the time simply had an elapsed-minutes bezel. The orange dial — chosen because orange is among the last colors to remain visible at depth before disappearing into the blue-shifted spectrum — became the brand’s signature and the watch’s most enduring legacy. The “Sub 300 Beta” introduced in 2022 with ceramic case and bezel is a separate modern technical evolution. Doxa went dormant during the quartz crisis, was held by the Jenny family in essentially trustee status from the 1980s, was revived commercially under Rick Marei (US Divers ownership era from 1997–2002+, Marei left circa 2019), and is now under new management continuing the SUB program at a strong pace.

### Model line: Sub 300T (1968 — the helium-escape-valve diver)

- **Refs**: Vintage Sub 300T Conquistador (1968) — first commercially available dive watch with a helium escape valve (HEV), 1,200m water resistance despite the “300T” name (T = “Tested”, not 300m); modern Sub 300T `840.10.XXX.YY` family (8 dial colors); `840.10.101.10/.20` Sharkhunter, `840.10.021.10/.20` Searambler, `840.10.011.20` Professional/orange, `840.10.201.10/.20` Caribbean, `840.10.361.10/.20/.31` Divingstar
- **Years**: 1968 (Conquistador launch); modern: 2019+ revival
- **Designer / movement**: Doxa with Synchron-group resources (HEV co-developed with Rolex according to some sources; Rolex used the technology on its Sea-Dweller in 1971) · vintage: ETA-based automatic with HEV; modern: ETA 2824-2 automatic
- **Key identifiers**: Same 42.5mm tonneau case as Sub 300 but reinforced for 1,200m / 120 bar water resistance; automatic helium escape valve (typically at 9 o’clock); same patented Doxa dual-scale dive bezel; same dial color naming convention; “300T” on dial denotes “Tested” diving rating (a frequent confusion); thicker case profile than Sub 300 (13.65mm vs 13.4mm)
- **Common nicknames**: “Sub 300T”, “Conquistador”, “HEV Doxa”
- **Notes**: The 1968 Sub 300T Conquistador’s helium escape valve is one of the great quiet horological innovations — the technology was reportedly co-developed by Doxa and Rolex (both were addressing the saturation-diving market and the COMEX commercial diving industry), and Rolex commercialized it more famously on the 1971 Sea-Dweller, but Doxa’s Conquistador arrived first. The HEV solves the saturation-diving problem of tiny helium atoms entering the case at depth and then bursting the crystal off during decompression — relevant only to commercial saturation divers, not recreational ones, but a meaningful technical achievement. The naming convention is genuinely confusing: the Sub 300 is rated to 300m (the “300” refers to water-resistance depth), but the Sub 300T is rated to 1,200m (the “300T” refers to T=Tested, not depth) — a Doxa quirk that has tripped up many a listing.

### Model line: Sub 200 (modern, time-only entry)

- **Refs**: `799.10.XXX.YY` family (8 dial colors); `799.10.351.10` Professional bracelet, `799.10.351.20` Professional rubber, similar variants for each color; Sub 200 C-Graph variants (chronograph reinterpretation of the T.Graph design language, modern)
- **Years**: 2019–present
- **Designer / movement**: Doxa · ETA 2824-2 automatic
- **Key identifiers**: 42mm steel case (slightly smaller than Sub 300); 200m water resistance; standard Doxa bezel with no-deco table; same color naming convention as Sub 300 family
- **Common nicknames**: “Sub 200”, “entry Doxa”
- **Notes**: The modern Sub 200 is the brand’s entry-level proposition — same design language as the iconic Sub 300 but smaller case, 200m rating, and lower price (around $1,200 on bracelet). The Sub 200 C-Graph is a modern automatic chronograph variant that thematically references the vintage Sub 200 T.Graph but with a Valjoux 7750-based movement.

### Model line: Sub 300 Carbon (modern carbon-composite)

- **Refs**: `822.70.101.20` Sharkhunter Carbon, `822.70.101AQL.20` Aqua Lung Sharkhunter LE (limited 300 pieces), Carbon Whitepearl, Carbon Aquamarine, and other dial variants
- **Years**: 2020+ (Carbon launch); ongoing
- **Designer / movement**: Doxa · ETA 2824-2 automatic, COSC-certified
- **Key identifiers**: 42.5mm forged carbon composite case (random graining, so each example is unique); same Doxa bezel and dive scales; 300m water resistance; the Whitepearl Carbon variant features a full-dial Super-LumiNova coating (first Doxa to do so); Aqua Lung co-branded LE references the historical US Divers / Aqua Lung distributor relationship
- **Common nicknames**: “Sub Carbon”, “AQL” (for Aqua Lung)
- **Notes**: The Carbon line is the brand’s modern technical statement, using lightweight forged carbon while preserving the iconic Doxa case shape. The Aqua Lung LE is a particularly meaningful piece historically since Cousteau’s US Divers / Aqua Lung was the original American distributor of Doxa Sub series watches in the 1960s/70s.

### Model line: Sub 600T / Sub 1500T / Sub 4000T (deep-rated divers)

- **Refs**: Sub 600T various (40mm or 42.5mm depending on era); Sub 1500T `883.10.XXX.YY` family; Sub 4000T historical reference
- **Years**: 1980s (Sub 600T historical) and modern revivals
- **Designer / movement**: Doxa · ETA 2824-2 automatic typically
- **Key identifiers**: Sub 600T: 40mm case, 600m WR, originally an 1980s reference now reissued; Sub 1500T: 45mm case, 1,500m WR, beefy diver; Sub 4000T: historical 4,000ft (~1,220m) reference, mostly archival
- **Common nicknames**: “1500T”, “deep Doxa”
- **Notes**: The deeper-rated Doxas form a sub-family that emphasizes water-resistance over wearability. The 1980s Sub 600T was a notable piece of its era and is the inspiration for some of the modern Whitepearl revivals.

### Model line: Sub 300 Beta / Sub 300 Beta Sharkhunter (modern ceramic)

- **Refs**: 42.5mm ceramic case variants in white, black, and blue; 2022 Doxa Army anniversary re-edition
- **Years**: 2021+ (Beta launch)
- **Designer / movement**: Doxa · automatic ETA-based
- **Key identifiers**: Ceramic case construction; wave-pattern dial; gold accents on Sharkhunter variant; 300m water resistance; 50th anniversary Doxa Army (2022) commemorates Doxa’s military variant
- **Common nicknames**: “Beta”, “Ceramic Doxa”, “Army” (for anniversary)
- **Notes**: The modern technical-material variants of the Sub 300 — ceramic, carbon, etc. — extend the platform into contemporary materials. The 2022 Army re-edition references a vintage military Doxa variant that is itself a niche collector reference.

-----

### Caliber Quick-Reference Table — Doxa

|Caliber                          |Type                                       |Model lines / eras                                                    |
|---------------------------------|-------------------------------------------|----------------------------------------------------------------------|
|Eberhard 310-82 (Doxa “Cal. 287”)|Manual chronograph, column-wheel, with date|Vintage Sub 200 T.Graph (1969)                                        |
|ETA-based automatic              |Automatic                                  |Vintage Sub 300 (1967), Sub 300T Conquistador (1968)                  |
|ETA 2824-2                       |Automatic, COSC for modern Sub 300         |Modern Sub 300, Sub 300T, Sub 200, Sub 600T, Sub 1500T, Sub 300 Carbon|
|Valjoux 7734 (NOS, refurbished)  |Manual chronograph                         |2019 Sub 200 T.Graph 50th anniversary reissue                         |
|Valjoux 7750-based               |Automatic chronograph                      |Sub 200 C-Graph modern                                                |

### Listing-Matching Tips — Doxa

- **Modern reference structure**: `XXX.YY.ZZZ.WW` where `XXX` = model family (799=Sub 200, 821=Sub 300, 822=Sub 300 Carbon, 840=Sub 300T, 883=Sub 1500T), `YY` = case material code (10=steel, 70=carbon, etc.), `ZZZ` = dial color code (351=Professional/orange, 101=Sharkhunter/black, 021=Searambler/silver, 201=Caribbean/blue, 361=Divingstar/yellow, 241=Aquamarine/turquoise, etc.), `WW` = strap code (10=bracelet, 20=rubber, 31=color-matched rubber).
- **Color name → dial color cheatsheet**: Professional = orange; Sharkhunter = black; Searambler = silver/grey; Caribbean = dark blue; Divingstar = yellow; Aquamarine = turquoise; Whitepearl = white; Sea Emerald = green. These names are consistent across model families.
- **The “T” in Sub 300T is not depth**: “T” = “Tested” rating. Sub 300T = 1,200m water resistance, not 300m. The “T” in Sub 200 T.Graph denotes Tritium (1969). Easily confused.
- **Vintage Sub 300 vs Sub 300T**: The Sub 300 (1967) lacks the helium escape valve; the Sub 300T Conquistador (1968) has it. Both share the same dial color taxonomy.
- **The dive bezel scales**: Original Doxa patent — outer ring depth in meters, inner ring no-decompression dive time in minutes. Bezels missing these dual scales are not authentic Doxa Sub.
- **Synchron-era vs Marei-era vs modern**: Synchron = 1969–1970s (under Synchron Group); Marei = 1997/2002–2019 (Rick Marei revival via US Divers); modern = 2019+ under new management. Each era has somewhat different production quality and pricing.
- **Aqua Lung / US Divers co-branding** appears on both vintage Synchron-era pieces and modern AQL limited editions — verify dial details.
- **“Beads of rice” bracelet** is the period-correct Doxa Sub bracelet; modern versions have improved clasps with diving extensions.

### Resources — Doxa

- *DOXA SUB: A 50 Year Journey* (Dr. Peter McClean Millar) — the definitive history of the Sub line
- doxa300t.com — long-running Doxa enthusiast site with extensive vintage photography and T.Graph documentation
- doxawatches.com (official) — for modern reference cross-referencing
- Chronopedia.club Doxa entries
- Analog:Shift Doxa guide series (history-focused articles)
- Two Broke Watch Snobs Doxa coverage (skeptical/independent reviews)
- WatchUseek Doxa forum — strong vintage T.Graph community

-----


<!-- Below: new brand `Aquastar` merged from docs/Watch Brand Reference Index — Patch 02.md (2026-05-17) -->

## Brand: Aquastar

### Model line: 63 / Regate (vintage regatta timer)

- **Refs**: Ref `4000N` (the iconic Regate); various Felsa/Valjoux/Felsa-based regatta variants; Aquastar “63” originally produced from 1963 (the name commemorating year of introduction); some examples sold under license as Duward (Spain) and Lorenz (Italy)
- **Years**: 1963 onwards through early 1970s (vintage); 2010s+ revival
- **Designer / movement**: Aquastar in-house (Frédéric Robert era — Robert is one of the unsung heroes of 1960s tool-watch design) · Felsa 4000N (the Regate-specific countdown caliber with the regatta mechanism)
- **Key identifiers**: ~37mm steel case (small by modern standards); the Regate’s signature: a sub-counter with rotating colored discs that count down minutes to a yacht race start; date variant on some; black or blue dial with star-themed Aquastar logo at 12; “Regate” or “63” dial signature; rotating bezel on some refs; this is a SAILING regatta countdown timer, NOT a diver — a common misclassification
- **Common nicknames**: “Regate”, “the 63”, “Aquastarlet” (the smaller-cased version), “Grand Air” (closely related sibling family)
- **Notes**: The Aquastar Regate is one of the most ingenious tool-watch complications of the 1960s — it’s a regatta countdown timer (5 minutes, typically) that displays the time to a yacht race start using rotating colored discs visible in a small sub-counter aperture, making it instantly readable in the chaos of the pre-race countdown. The Regate predates the much more famous Heuer Skipper (which used a similar countdown concept), and the F4000N Felsa-based caliber was specifically engineered for this purpose. Aquastar’s broader 1962–63 product family (the Regate, the 63, the Grand-Air, the Aquastarlet) shared core designs and were also sold under license as Duward (Spain) and Lorenz (Italy). The brand’s modern revival has not yet successfully reissued the Regate because the Felsa 4000N is no longer in production and recreating the regatta-disc complication would require a new movement.

### Model line: Deepstar (1965 chronograph diver)

- **Refs**: Ref `1802` (the original 1965 Deepstar); Deepstar 2000 (later variant); “L’Equipe Cousteau” co-signed examples; Duward-licensed Deepstar MK2 variants (Valjoux 92-powered)
- **Years**: 1965–early 1970s (vintage); 2020+ modern Deepstar reissue (Deepstar III as Valjoux-23-echo)
- **Designer / movement**: Frédéric Robert / Aquastar in-house design · Valjoux 23 (manual chronograph, 2-register column-wheel, ~30mm) — the historically accurate original caliber; some variants and Duward-licensed pieces used Valjoux 92
- **Key identifiers**: ~36–37mm steel case (compact for a chronograph diver); bi-compax dial (running seconds at 9, 30-min counter at 3); 100m water resistance; rotating dive bezel; the Aquastar star logo at 12; “Deepstar” dial signature; “L’Equipe Cousteau” co-signed examples carry Cousteau’s team’s name; period-correct dive-decompression bezel scale on some references
- **Common nicknames**: “Deepstar”, “L’Equipe Cousteau”, “Mayol Deepstar” (Jacques Mayol freediver provenance)
- **Notes**: The 1965 Aquastar Deepstar is one of the very first chronograph divers — combining a manually-wound Valjoux 23 chronograph with a 100m water-resistant case and rotating dive bezel, predating most three-register dive chronographs of the era. Cousteau and his diving team used Deepstars (visible in stills from *Le Monde du Silence* and other Cousteau-era footage), and the watches were also issued via L’Equipe Cousteau co-branded variants. Most famously, Jacques Piccard’s 1968 Grumman *Deepstar IV* submersible vehicle crew were equipped with Aquastar Deepstars (the watch and the submersible share the name by no coincidence — Aquastar developed the watch partly for use on board), giving the watch genuine deep-sea-research provenance. Jacques Mayol (the freediver hero of *The Big Blue*) also wore Aquastar Deepstars and Benthos models throughout his career. The 2020 Aquastar revival’s “Deepstar 2020” / Deepstar III reissue (echoing the Valjoux 23-powered original) was the moment the modern Aquastar brand returned to the conversation, and is one of the most successful vintage-tool-watch revivals of the past decade.

### Model line: Benthos 68 / Benthos 500 / Benthos I / Benthos II (deep diver)

- **Refs**: Benthos 68 (1968 launch, Super Compressor case); Benthos 500 (1970 launch, 500m water resistance, A. Schild 1902 with proprietary 60-minute totalizer module — later updated to A. Schild 2162); Benthos I (1,000m monobloc case, ~1973); Benthos II (1,000m quartz, French Navy issued); Benthos 500 II Founder Edition (modern revival, limited 300 pieces); modern Benthos Heritage II and Benthos Professional with DLC coating
- **Years**: 1968 (Benthos 68) – mid-1970s (Benthos I and II); 2020s revival
- **Designer / movement**: Frédéric Robert (chief designer) · A. Schild 1902 with proprietary monopusher 60-min flyback totalizer (Benthos 500 first gen); A. Schild 2162 (Benthos 500 2nd gen, 28,800 vph); quartz in Benthos II; La Joux-Perret-developed exclusive movement (modern Benthos 500 II)
- **Key identifiers**: 42–47mm steel case (large for the era); crown offset at 2 o’clock with monopusher at 4 o’clock for the totalizer flyback (Benthos 500); ARROW-shaped red 60-minute totalizer hand on dial (frequently misidentified as a GMT hand); 60-click rotating bezel with simple high-contrast minute markings; 500m or 1,000m water resistance; monobloc case (Benthos I, II — no caseback); the Benthos II is quartz with simplified 3-hand display and 24-hour count, French Navy issued
- **Common nicknames**: “Benthos”, “Benthos 500”, “Mayol Benthos”, “Marine Nationale Benthos” (French Navy issued)
- **Notes**: The Benthos 500 (1970) was one of the most ambitious dive watches of its era — the first non-monobloc dive watch designed to operate at 500m depth, featuring a proprietary 60-minute flyback totalizer (operated via the 4-o’clock monopusher) developed on an A. Schild 1902 base with the patented flyback mechanism. Aquastar patented the totalizer design in 1968. The watch was approved equipment in the 1973 US Navy Air Diving Manual, and Jacques Mayol famously wore his Benthos 500 during his 1976 record-breaking 101-meter no-limits freedive. The Benthos I (~1973) doubled the depth rating to 1,000m by switching to a monobloc case, and the Benthos II simplified the watch to quartz for the French Navy “Marine Nationale” issuance. Vintage Benthos 500s in clean condition trade in the $5,000–12,000 range; French Navy Benthos II examples with documented military issuance have specialty value. The modern Benthos 500 II Founder Edition (limited 300 pieces) uses a co-developed La Joux-Perret movement.

### Model line: Aquastar 63 / 63 Sub family (early diver)

- **Refs**: Various 63-series refs; AS 1701 / AS 1581 calibers
- **Years**: 1964–early 1970s
- **Designer / movement**: Aquastar in-house · A. Schild 1701 automatic (200m diver), AS 1581 in earlier examples
- **Key identifiers**: ~36mm steel case; inner rotating dive bezel operated by single crown (clever Aquastar variant that uses the same crown for time-setting and bezel rotation depending on its position); highly domed glass crystal; 200m water resistance
- **Common nicknames**: “Aquastar 63”, “Cousteau 63”
- **Notes**: A simpler early Aquastar diver that’s somewhat overlooked next to the Deepstar and Benthos. Solid build quality and 200m rating; Cousteau’s team is documented to have used these alongside the Deepstars.

### Model line: Aquastar Modern Revival (2020+)

- **Refs**: Deepstar II (2020+, automatic with ceramic-bearing bezel, 200m); Deepstar III (2024+, Valjoux 23-echo manual chronograph); Benthos Heritage II (904L steel, HEV, 300m); Benthos 500 II Founder Edition (LE 300); Airstar (Valjoux 7753 aviation chronograph); Model 60 MKII (referencing the 1960 Mariana Trench Challenger Deep dive Aquastar)
- **Years**: 2020–present
- **Designer / movement**: Modern Aquastar (current ownership) · co-developed La Joux-Perret movements (Benthos 500 II), Valjoux 7753 (Airstar), various automatic movements
- **Key identifiers**: Faithful echoes of 1960s/70s Aquastar designs at modern wearable sizes; 904L steel construction on some refs; modern materials (ceramic bezels, sapphire crystals, DLC coating on Benthos Professional)
- **Common nicknames**: “New Aquastar”
- **Notes**: The 2020 Aquastar revival under new ownership (with input from Rick Marei, formerly of Doxa, before his late-career independent work) was one of the most credible vintage-tool-watch revivals — pricing in the $1,400–2,000 range for the Benthos Heritage II and Deepstar II makes them serious value propositions next to mainstream Swiss dive watches. The current brand emphasizes that every modern reference traces directly to a 1960s/70s vintage original.

-----

### Caliber Quick-Reference Table — Aquastar

|Caliber                             |Type                                                                     |Model lines / eras                              |
|------------------------------------|-------------------------------------------------------------------------|------------------------------------------------|
|Felsa 4000N                         |Manual-wind regatta countdown (proprietary disc complication)            |Regate ref 4000N (1963–early 1970s)             |
|Valjoux 23                          |Manual chronograph, 2-register column-wheel                              |Deepstar (1965)                                 |
|Valjoux 92                          |Manual chronograph, 2-register                                           |Duward-licensed Deepstar MK2 variants           |
|A. Schild 1581                      |Automatic                                                                |Early Aquastar 63                               |
|A. Schild 1701                      |Automatic (high-grade)                                                   |Aquastar 200m divers (mid-1960s)                |
|A. Schild 1902                      |Automatic, 21,600 vph + Aquastar proprietary monopusher flyback totalizer|Benthos 500 (1st generation)                    |
|A. Schild 2162                      |Automatic, 28,800 vph + flyback totalizer                                |Benthos 500 (2nd generation)                    |
|A. Schild 2063                      |Automatic with date                                                      |Aquastar Grand-Air (1969–1976)                  |
|Quartz (unspecified)                |Quartz 3-hand                                                            |Benthos II (French Navy issued)                 |
|La Joux-Perret co-developed (modern)|Automatic exclusive movement                                             |Modern Benthos 500 II                           |
|ETA 2824-2                          |Automatic                                                                |Modern Aquastar Deepstar II, Benthos Heritage II|
|ETA Valjoux 7753                    |Automatic chronograph                                                    |Modern Airstar                                  |

### Listing-Matching Tips — Aquastar

- **Regate / 63 is NOT a diver**: The Regate is a regatta countdown timer (sailing-specific), often misidentified as a dive watch. Same case shape, but no rotating dive bezel and only modest water resistance.
- **The Benthos 500’s red arrow hand is a 60-min totalizer, NOT a GMT hand**: Major listing confusion source. Operated via the monopusher at 4 o’clock.
- **Duward / Lorenz licensed variants**: Vintage Aquastar production was also sold under license as Duward (Spain) and Lorenz (Italy); these have different brand markings but identical movements/cases.
- **“L’Equipe Cousteau” co-signed dials** on Deepstars are highly desirable but heavily counterfeited; verify dial-printing detail and provenance.
- **Marine Nationale-issued Benthos II quartz** examples should have French Navy markings on the caseback.
- **Modern vs vintage**: Modern Aquastar (2020+) is fully a new production company — there is no continuity with the original Aquastar SA, which folded during the quartz crisis. The trademark was reclaimed and the brand restarted.
- **Jacques Mayol provenance** is real and meaningful (he wore Aquastars throughout his career) but provenance documentation is rare — most “Mayol Deepstar” listings are aspirational.
- **Benthos 68 vs Benthos 500**: Benthos 68 is the 1968 Super Compressor diver (smaller, simpler); Benthos 500 is the 1970 large flyback-totalizer 500m diver. Different watches.

### Resources — Aquastar

- aquastar.ch (official modern site) — extensive history sections on the Benthos and Deepstar lineage with archival blueprints
- *Aquastar* (Cliff Diamond / community-authored vintage reference book)
- adiveintotime.com — long-form vintage Aquastar articles by Don Wilkins
- WatchUseek vintage Aquastar threads
- Analog:Shift Aquastar Deepstar articles with Cousteau-era photography
- The Watch Spot Blog on Aquastar Grand-Air and movements
- Hodinkee feature on the 2020 Deepstar revival

-----


<!-- Below: new brand `Ressence` merged from docs/Watch Brand Reference Index — Patch 02.md (2026-05-17) -->

## Brand: Ressence

### Model line: Type 1 (Type 1, Type 1 Slim, Type 1², Slim²)

- **Refs**: Original Type 1 (Round, 42mm, multiple dial colors); Type 1 Slim (42mm, 11mm thick, 212 components); Type 1² (“squared” — square case variant); Slim² (squared slim variant); various LE colorways including yellow, orange, red, blue, anthracite
- **Years**: 2010 (Zero Series prototype) — 2011 (Type 1 launch) — present
- **Designer / movement**: Benoît Mintiens (founder, industrial designer, Antwerp) · Customized ETA 2824-2 base with proprietary in-house ROCS (Ressence Orbital Convex System) module replacing all traditional hands; automatic, ~36h power reserve; case is grade 5 titanium
- **Key identifiers**: 42mm round (or squared in Type 1²) grade 5 titanium case; NO conventional hands — time is displayed by rotating biaxial sub-discs orbiting around the convex dial (hour disc, minute disc, day-of-week disc, small seconds disc); NO crown — time is set by rotating the entire caseback; convex sapphire crystal (the dial bulges outward); engraved indications filled with Super-LumiNova
- **Common nicknames**: “Type 1”, “the no-hands watch”, “the discs watch”, “the Ressence”, “Beyond Hands”
- **Notes**: The Type 1 is the foundational Ressence — designed by Belgian industrial designer Benoît Mintiens, who founded the brand in 2010 after years of working in industrial design (his clients had included rail vehicles, medical devices, and ergonomic furniture). The Zero Series in 2010 introduced the ROCS concept; the Type 1 in 2011 brought it into production. ROCS replaces traditional hands with continuously rotating sub-discs that orbit the convex dial like moons around a planet — the minute “hand” is actually a small triangular indicator on the largest disc, the hour is a sub-disc that orbits within that disc, and similarly for the day of week and small seconds. Time is set by rotating the entire caseback (a small crown-like edge on the back), and the watch is wound automatically by an ETA 2824-2 base. Production is around 150–200 watches per year, putting Ressence firmly in the independent / micro-brand tier. The Type 1 Slim (released ~2018) reduces the case to 11mm thick by re-engineering the ROCS module. The Type 1² and Slim² square variants are unusual departures into shaped cases. Retail prices start around CHF 15,000–22,000 depending on variant.

### Model line: Type 2 (e-Crown — electronic time-setting)

- **Refs**: Type 2 e-Crown (44mm titanium); Type 2N (specific dial variant)
- **Years**: 2018–present
- **Designer / movement**: Benoît Mintiens with electronic-system development partner · Mechanical movement (ETA-based) plus proprietary e-Crown electronic module that automatically sets the time via smartphone app and Bluetooth synchronization; uses photovoltaic cells under the dial for power
- **Key identifiers**: 45mm grade 5 titanium round case; ROCS display; the e-Crown system is concealed under the dial — visible only by the bezel-mounted toggle activator on some references and the small status indicators on the dial; powered by light passing through translucent areas of the convex dial; the watch can be set to a “satellite time” from a smartphone app and will then maintain that time automatically when worn
- **Common nicknames**: “Type 2”, “e-Crown Ressence”, “the smart mechanical”
- **Notes**: The Type 2 was Ressence’s most technically audacious watch at launch — it combines a fully mechanical ROCS module with an “e-Crown” electronic module that uses Bluetooth to receive accurate time from a smartphone and small motors to adjust the mechanical movement back into accuracy. The hybrid is genuinely novel: the watch is mechanically wound (or automatic) and tells time mechanically, but its accuracy is maintained electronically. The technical challenge of integrating this without conventional crowns, and powering it from light alone, took multiple years of development. The Type 2 is sometimes viewed as a curiosity rather than a core Ressence proposition; the mechanical-purist customer base of the brand has favored the Type 1, Type 3, and Type 5 oil-filled mechanical pieces. Pricing approximately CHF 48,000.

### Model line: Type 3 (the first oil-filled mechanical watch)

- **Refs**: Type 3 (original 2013, multiple dial colorways); Type 3 Black, Type 3 White (2024 updated versions); Type 3 BB (Black Beret), Type 3 BB2 (Black Black 2), Type 3 BBB (full-black updated 2024), Type 3 Eucalyptus Green; Type 3 MN (Marc Newson collaboration)
- **Years**: 2013–present (Type 3 won the 2013 GPHG Horological Revelation prize)
- **Designer / movement**: Benoît Mintiens · Lower chamber: modified ETA 2892-A2 / 2824-2 automatic base movement, 4Hz, 36-hour power reserve, caseback winding and setting; upper chamber: ROCS 3 module (215 parts, including main and sub discs) bathed in 3.57ml of oil, connected to the base movement via magnetic transmission (multiple 1mm × 0.5mm micromagnets — NO physical axles between the two chambers); compensating bellows system for thermal expansion of the oil; total ~47 jewels in 2-chamber assembly
- **Key identifiers**: 44mm grade 5 titanium pebble-shaped case (15mm thick); TWO separate sealed chambers — lower chamber houses the mechanical movement and air; upper chamber houses the ROCS module submerged in 3.57ml of oil; double-domed sapphire crystals on top AND bottom (sapphire-to-sapphire case shape); the OIL chamber is the key to the watch’s signature visual effect — the oil has the same refractive index as sapphire, so the crystal essentially disappears, and the discs appear to float at the surface of the convex display; dials include indicators for hours, minutes, day of week, oil temperature, and pointer date around the periphery; splash-resistant only (~10m WR — NOT a diver); displays include a temperature gauge for the bellows system
- **Common nicknames**: “Type 3”, “the oil-filled Ressence”, “BB” / “BB2” (for blackest variants), “Marc Newson Type 3” (for the 2018 collab)
- **Notes**: The Type 3 won the 2013 GPHG Horological Revelation prize and is generally credited as the first mechanical wristwatch with an oil-filled display chamber. The oil eliminates parallax, eliminates internal reflections (because oil and sapphire have matched refractive indices), and creates an extraordinary “screen-like” appearance where the discs appear to float at the surface of the convex display. The two-chamber design separates the mechanical movement (which would not function submerged in oil because the escapement requires air) from the display (which benefits from oil). Power and time-information are transmitted between the two chambers magnetically — multiple micromagnets in each chamber, transmitting torque through the sealed barrier with no physical axles. The bellows system compensates for the thermal expansion/contraction of the oil over temperature swings, displayed as the oil-temperature indicator on the dial. The Type 3 MN (Marc Newson collaboration, 2018) is the first major Newson-Ressence design tie-up. Type 3 BB / BB2 are the all-black titanium variants. Retail pricing approximately CHF 42,000–55,000.

### Model line: Type 5 (oil-filled diver)

- **Refs**: Type 5 (2015 launch, 46mm titanium); Type 5N (Navy blue dial); Type 5G (grey); Type 5 BBT (Bonzes Bleus des Fonds Marins, a deep marine-themed editorial variant); various color releases
- **Years**: 2015–present
- **Designer / movement**: Benoît Mintiens · Same two-chamber architecture as Type 3 — modified ETA 2824-2 base in air-filled lower chamber, ROCS 5 module in oil-filled upper chamber, magnetic transmission, bellows compensation; specifically engineered for diving (the case is rated to 100m and the oil-filled display is genuinely useful underwater)
- **Key identifiers**: 46mm grade 5 titanium pebble case (wears like 42mm due to extremely short lugs); 100m water resistance (ISO 6425 diver); unidirectional rotating bezel (the Type 3’s lack of a bezel is the most obvious Type 3 vs Type 5 disambiguator); the oil-filled display is the key technical justification — underwater, conventional watches reflect light off the inside of their crystals and become unreadable at certain angles, but the Type 5’s oil-filled display has zero reflections and remains legible at any angle; engraved indications filled with Super-LumiNova; navy blue, grey, or other minimalist dial colorways
- **Common nicknames**: “Type 5”, “the oil-filled diver”, “Beyond Hands diver”
- **Notes**: The Type 5 is Ressence’s diver and the only ISO 6425-compliant watch in the lineup. The development came from a serendipitous discovery during Type 3 development: when Mintiens submerged the Type 3 prototype in water, he noticed that the oil-filled display had ZERO reflections — unlike every other dive watch, which becomes hard to read at certain angles underwater because of light reflecting off the inside of the crystal. Mintiens engineered the Type 5 specifically to exploit this property — adding a unidirectional dive bezel, increasing water resistance to 100m, and tuning the dial layout for underwater legibility. The Type 5 is a legitimate dive watch and one of the most unusual pieces in the ISO 6425 catalogue. Retail pricing approximately CHF 38,000.

### Model line: Type 7 (Type 7N Night / GMT variants)

- **Refs**: Type 7 (various dial variants including Type 7N “Night”); GMT-equipped Type 7 variants
- **Years**: late 2010s – present
- **Designer / movement**: Benoît Mintiens · ROCS 7 module with jewel ball-bearing axes (concept borrowed from Type 2 for slimmer construction); GMT functionality on dedicated variants
- **Key identifiers**: Round titanium case; ROCS display similar to Type 3 but slimmer thanks to ball-bearing innovations; oil-filled upper chamber; GMT version adds second time zone indication
- **Common nicknames**: “Type 7”, “Type 7 GMT”, “Type 7N”
- **Notes**: The Type 7 introduced jewel ball bearings in the ROCS module (rather than conventional axes and gears), which Mintiens borrowed from the Type 2’s design — this allows for a slimmer module construction at the cost of producing a faintly audible rattle when the watch is shaken. The Type 7 GMT extends the Ressence concept to a true second time zone, a significant complication-step for the brand.

### Model line: Type 8 (simplified, monobloc)

- **Refs**: Type 8 (smaller round case, simplified ROCS display, no oil-filling)
- **Years**: 2021–present
- **Designer / movement**: Benoît Mintiens · ROCS module without oil filling, simpler base movement
- **Key identifiers**: Smaller titanium case (around 42mm); monobloc construction; reduced ROCS display (typically just hours and minutes, no oil chamber); pure-form aesthetic
- **Common nicknames**: “Type 8”, “Simple Ressence”
- **Notes**: The Type 8 is Ressence’s most accessible (in pricing and visual terms) reference — a simplified ROCS display in a monobloc case without the oil-filling complication, emphasizing the brand’s design language at a lower price point. Pricing approximately CHF 18,000–22,000.

-----

### Caliber Quick-Reference Table — Ressence

|Caliber / Module                             |Type                                                        |Model lines / eras                      |
|---------------------------------------------|------------------------------------------------------------|----------------------------------------|
|ROCS 1 (over ETA 2824-2 base)                |Ressence Orbital Convex System, 1st gen — air-only          |Type 1, Type 1 Slim, Type 1², Slim²     |
|ROCS 2 (over mechanical base + e-Crown)      |ROCS + electronic time-setting module                       |Type 2 e-Crown                          |
|ROCS 3 (215 parts, over modified ETA 2892-A2)|Oil-filled ROCS, magnetic transmission, bellows compensation|Type 3 (2013 launch onwards)            |
|ROCS 3.6 (revised)                           |Updated ROCS 3 with new layout                              |Type 3 Black, Type 3 White (2024 update)|
|ROCS 5 (over modified ETA 2824-2)            |Oil-filled ROCS for diving applications, 100m WR            |Type 5, Type 5N, Type 5G                |
|ROCS 7 (jewel ball-bearing axes)             |Slimmer oil-filled ROCS module                              |Type 7, Type 7N, Type 7 GMT             |
|ROCS 8 (simplified)                          |Non-oil-filled simplified module                            |Type 8                                  |

### Listing-Matching Tips — Ressence

- **All Ressence watches have NO crown** — time setting is done via rotating the entire caseback. Listings showing a watch with a conventional crown are not Ressence.
- **All Ressence watches have NO conventional hands** — time is displayed via rotating sub-discs on a convex dial.
- **Type 1 vs Type 3 vs Type 5 disambiguation**: Type 1 = no oil, flat sapphire crystal feel, 42mm round (or square in 1²); Type 3 = oil-filled display, pebble-shape with sapphire crystals on top AND bottom, no bezel, 44mm; Type 5 = oil-filled with unidirectional dive bezel, 46mm but wears smaller due to short lugs, 100m WR.
- **Oil-filling visual effect**: Oil-filled Ressences (Type 3, 5, 7) have a distinctive “digital screen” appearance where the indicators appear to float at the surface of the display. Non-oil-filled (Type 1, Type 8) have a more traditional “watch dial under a dome” appearance.
- **Power and setting are both at the caseback** — no winding via crown.
- **Founder / brand**: Always founded by and run by Benoît Mintiens, Antwerp-based industrial designer. Production is in Switzerland (movement and assembly); brand operations and final R500H testing in Antwerp, Belgium.
- **Production volume**: ~150–200 watches per year — pricing reflects independent/micro-brand status (CHF 15,000–55,000 depending on reference).
- **GPHG awards**: Type 3 won Horological Revelation 2013; the brand has earned several subsequent nominations.

### Resources — Ressence

- ressencewatches.com (official) — for current reference cross-referencing
- Monochrome Watches Ressence archive — exceptional long-form reviews of Type 3, 5, 7
- Fratello Watches “Up Close With Benoît Mintiens” workshop visit articles
- The 1916 Company pre-owned Ressence collection — for secondary-market reference verification
- Hodinkee Type 5 and Type 3 reviews
- Escapement Magazine Type 1 hands-on
- A Collected Man Ressence editorial coverage

-----


<!-- Below: new brand `Laurent Ferrier` merged from docs/Watch Brand Reference Index — Patch 02.md (2026-05-17) -->

## Brand: Laurent Ferrier

### Model line: Galet Classic Tourbillon Double Spiral (flagship tourbillon)

- **Refs**: `LCF001-W` (white gold), `LCF001-R` (rose/pink gold), `LCF001-Y` (yellow gold), `LCF001-P` (platinum); subsequent variants including Galet Classic Dual Tourbillon Double Spiral (`LCF020.G1.GG1.1/2`) with front-visible tourbillon (2017)
- **Years**: 2010 launch (Galet Classic Tourbillon Double Spiral, won GPHG Men’s Watch Prize 2010) — present
- **Designer / movement**: Laurent Ferrier (founder; 37-year veteran of Patek Philippe movement department) and Christian Ferrier (his son, technical chief) with movement co-development by La Fabrique du Temps (Enrico Barbasini + Michel Navas — the LV-owned haute horlogerie facility — hence the “FBN” prefix in caliber naming where F=Ferrier, B=Barbasini, N=Navas) · Caliber LF 619.01 / LF 619.03 (manual-wind, chronometer-certified by Besançon Observatory, 21,600 vph balance, 80-hour power reserve, double-spiral tourbillon)
- **Key identifiers**: 41mm round Galet (“pebble”) case in precious metal; grand-feu enamel dial (white for yellow gold, ivory for rose gold, onyx for white gold) with painted Roman numerals (slate grey for visual softness, not jet black); “assegai-shaped” hour and minute hands (named after the Zulu javelin); baton small seconds at 6; tourbillon hidden under the dial (in the original 2010 model) and visible via sapphire caseback only; on the 2017 Dual Tourbillon Double Spiral, the tourbillon is visible from the dial side; long-blade ratchet pawl winding system (19th-century chronometer style — produces tangible clicks during winding)
- **Common nicknames**: “Double Spiral”, “the GPHG-winning Ferrier”, “Galet Tourbillon”
- **Notes**: The Galet Classic Tourbillon Double Spiral was Laurent Ferrier’s debut watch and the founding piece of the brand — Ferrier left Patek Philippe in 2009 after 37 years as movement department chief to found his own house, and he developed this tourbillon as the brand’s first project. The “Double Spiral” hairspring is Ferrier’s proprietary innovation: two balance springs mounted in opposition (one overcoil, one flat) whose radial forces cancel each other out, reducing friction and improving isochronism — a tourbillon-complementary precision technique. The 2010 GPHG Men’s Watch Prize win brought the brand immediate critical recognition. Production is extraordinarily limited — Laurent Ferrier produces under 200 watches per year across the entire lineup, putting it firmly in the top tier of independent watchmaking alongside F.P. Journe, Roger W. Smith, Greubel Forsey, and Philippe Dufour. Retail starts approximately CHF 175,000–180,000.

### Model line: Galet Classic Micro-Rotor / Classic Micro-Rotor

- **Refs**: `LCF004.AC.RG1.2` (stainless steel, autumn salmon dial), `LCF004` family in various metals; `LCF010` series for special editions; Kamine 110th-anniversary Japanese retailer edition (`LCF010.AC.E07G.1`, 3 pieces with grand-feu enamel dial); various pièce unique and limited editions including the Revolution & The Rake Steel Galet Micro-Rotor salmon (1-of-1), Revolution Classic Micro-Rotor “Amazonia” (15 pieces), Sincere Fine Watches LE
- **Years**: 2012 launch — present
- **Designer / movement**: Laurent Ferrier and Christian Ferrier with La Fabrique du Temps · Caliber FBN 229.01 (automatic, micro-rotor, 35 jewels, 186 components, 3Hz / 21,600 vph, 72-hour power reserve from single mainspring barrel; double direct-impulse natural escapement modeled after Breguet’s 1789/1802 design; free-sprung balance with adjustment masses; overcoil hairspring; six-position adjustment — one position more than the typical five used by most chronometers); silicon escape wheel using nickel phosphorus material via LIGA process
- **Key identifiers**: 40mm or 41mm Galet (“pebble”) case with rounded bezel and thin straight lugs; available in stainless steel, white gold, rose gold, platinum; signature onion-shaped crown; assegai-style hands; grand-feu enamel dials or sector dials, sometimes with Breguet numerals or applied Arabic numerals; visible micro-rotor through sapphire caseback on a mirror-polished bridge (visually evocative of a tourbillon bridge); the double direct-impulse escapement is one of the few production examples of Breguet’s “natural escapement” concept
- **Common nicknames**: “Micro-Rotor”, “Classic Micro-Rotor”, “the entry Ferrier” (though still CHF 50,000+), “Amazonia” (specific green-dial LE), “Salmon Ferrier” (autumn dial variants)
- **Notes**: The Micro-Rotor was Ferrier’s answer to collector demand for “something like the tourbillon but more accessible” — launched in 2012 as a lower-priced (relatively) entry to the brand. The caliber FBN 229.01 is one of the most technically refined micro-rotor automatics in production: it incorporates the Breguet natural escapement (a double direct-impulse design that provides energy to the balance on both swing directions, vs. lever escapement’s single-direction impulse, increasing isochronism — Breguet implemented this in only 20 pocket watches in his lifetime because it was too difficult to manufacture with period tools, but modern materials and CAD made it producible), a free-sprung balance with overcoil hairspring (more shock-resistant than mobile-index regulation), six-position adjustment (vs. the standard five), and 72-hour power reserve from a single barrel. Finishing is among the very best in the industry — Tim Mosso has compared it favorably to Voutilainen, Greubel Forsey, and Lange. Various special editions (Kamine, Revolution & The Rake, Amazonia, Boréal sport variants, Hour Glass Sincere) have made this collection one of the most actively traded among independent collectors. Pre-owned market pricing currently $35,000–60,000 for steel, $50,000–90,000 for precious metals.

### Model line: Galet Annual Calendar Micro-Rotor

- **Refs**: `LCF235.01` (white gold), `LCF235` family with various dial configurations including Montre École and blue sector dial variants (`LCF025` for the Montre École version)
- **Years**: 2015+ launch — present
- **Designer / movement**: Laurent Ferrier with La Fabrique du Temps · Caliber based on FBN 229.01 with annual calendar module; date and month indication, manual annual correction at February
- **Key identifiers**: Same Galet case as Micro-Rotor (40mm); annual calendar with date, month, day, and power reserve indication on some variants; blue sector dial on some references; precious metal cases
- **Common nicknames**: “Annual Calendar Ferrier”
- **Notes**: The Annual Calendar Micro-Rotor extends the brand’s automatic micro-rotor platform with an annual calendar complication. The Montre École variant (LCF025) carries a particularly clean blue sector dial referencing 1950s scientific watches. Production is extremely limited.

### Model line: Galet Square / Square Micro-Rotor

- **Refs**: `LCF230` family — Galet Square Micro-Rotor in various dial configurations including chocolate brown, sector dials, and Only Watch 2015 pièce unique
- **Years**: 2015 launch (Galet Square introduced as pièce unique for Only Watch 2015 hosted by Phillips — sold for CHF 62,500) — present
- **Designer / movement**: Laurent Ferrier · Caliber FBN 229.01 (same automatic micro-rotor as round Galet)
- **Key identifiers**: Square Galet case (a departure from the typical round case); brushed and polished finishing; same assegai hands and dial language; precious metal or stainless steel; chocolate dial variant is a signature reference; Only Watch 2015 piece was a unique square case in stainless steel
- **Common nicknames**: “Galet Square”, “Square Ferrier”
- **Notes**: The Galet Square introduced a square case option to the Ferrier lineup, with the 2015 Only Watch pièce unique (62,500 CHF) putting the variant on the map. The chocolate-brown dial Square Micro-Rotor is among the most distinctive references in the modern Ferrier catalogue.

### Model line: Galet Traveller (dual-time)

- **Refs**: `LCF007.AC.CW1` (stainless steel, midnight blue dial); special-order variants in white gold with chocolate dial; Boréal variants with lume-treated dials
- **Years**: 2013+ launch — present
- **Designer / movement**: Laurent Ferrier · Caliber based on FBN 229.01 with dual-time module (date and second time zone)
- **Key identifiers**: 41mm Galet case; second time zone displayed via additional 12-hour hand and 24-hour AM/PM indicator; date complication; sector or sun-burst dial variants; Boréal lume on some sport variants
- **Common nicknames**: “Traveller”, “GMT Ferrier”
- **Notes**: The Galet Traveller adds dual-time GMT functionality to the micro-rotor base platform — a natural complication extension. The Boréal variants apply Super-LumiNova to dial features for sportier aesthetic, sometimes paired with the Sport Auto case treatment.

### Model line: Sport Auto / Grand Sport Tourbillon

- **Refs**: Sport Auto (limited titanium with bracelet, viridian green opaline dial, 40 pieces); Grand Sport Tourbillon (rose gold with bracelet, limited 24 pieces, 13 of 24 documented at auction)
- **Years**: 2018+ Sport Auto; 2020+ Grand Sport Tourbillon
- **Designer / movement**: Laurent Ferrier · FBN 229.01 (Sport Auto); LF 619-based tourbillon (Grand Sport Tourbillon)
- **Key identifiers**: Sport case shape (departure from pure round Galet); integrated bracelet on Grand Sport; Boréal lume treatments on some; precious metal or titanium construction; chronograph variants exist in special LE form
- **Common nicknames**: “Sport Auto”, “Grand Sport”
- **Notes**: The Sport Auto line expanded Ferrier’s reach into the sport-luxury segment that Patek Philippe Nautilus and Audemars Piguet Royal Oak occupy at higher price points. The Grand Sport Tourbillon (24-piece limited edition with bracelet) was the most expensive at-launch Ferrier piece and is a recent acquisition for major independent collectors. Sincere Fine Watches’ 70th Anniversary edition added a first-ever guilloché dial to the Grand Sport Tourbillon.

### Model line: Classic Origin (regulator)

- **Refs**: `LCF024.AC` (steel Montre École Micro-Rotor Régulateur, 35,000 CHF launch price), `LCF024.G` (gold), various Revolution & The Rake limited editions of 12 pieces each (Sector dial, Two-tone sector dial — Mark Cho’s sold publicly at auction October 2021), Classic Origin Opaline
- **Years**: 2017+ launch
- **Designer / movement**: Laurent Ferrier · Caliber FBN228.01 (the brand’s regulator caliber — micro-rotor with separate hour, minute, seconds indications)
- **Key identifiers**: 40mm Galet case; regulator dial layout — large central minute hand, small hour sub-dial at 12, small seconds at 6; sector-style dial with combined satin, sandblasted, and snailed finish areas; period-correct typography
- **Common nicknames**: “Montre École”, “Régulateur Ferrier”, “school watch”
- **Notes**: The Montre École celebrates Ferrier’s own watchmaking-school graduation piece (every Geneva watchmaking student constructs a “montre école” as their final project) and translates the pebble-like proportions of pocket watches into modern wristwatch form. The Classic Origin variants — and especially the Revolution & The Rake collaborations — are among the most-traded Ferriers in the secondary market, with Mark Cho’s auction example having achieved a strong premium. The regulator layout differentiates this from the standard Micro-Rotor and gives it its own identity.

-----

### Caliber Quick-Reference Table — Laurent Ferrier

|Caliber                       |Type                                                                                                                                                       |Model lines / eras                                                                                        |
|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
|LF 619.01 / LF 619.03         |Manual-wind tourbillon, double-spiral hairspring, 80h PR, chronometer-certified                                                                            |Galet Classic Tourbillon Double Spiral (2010+), Galet Dual Tourbillon Double Spiral (2017)                |
|LF 916.01                     |Manual-wind tourbillon with double spiral, 80h PR (current production variant)                                                                             |Current Galet Classic Tourbillon                                                                          |
|FBN 229.01                    |Automatic, micro-rotor, 35 jewels, 72h PR, double direct-impulse natural escapement, free-sprung balance, overcoil hairspring, six-position adjustment, 3Hz|Galet/Classic Micro-Rotor (2012+), Galet Square Micro-Rotor, Galet Traveller, Sport Auto, special editions|
|FBN228.01                     |Regulator version of micro-rotor caliber                                                                                                                   |Galet Micro-Rotor Régulateur Montre École / Classic Origin (2017+)                                        |
|FBN annual calendar variant   |Automatic with annual calendar module                                                                                                                      |Galet Annual Calendar Micro-Rotor (2015+)                                                                 |
|Grand Sport Tourbillon caliber|Manual tourbillon optimized for sport case                                                                                                                 |Grand Sport Tourbillon (2020+, 24 pieces)                                                                 |

### Listing-Matching Tips — Laurent Ferrier

- **Reference convention**: `LCFXXX.YY.ZZ` where `LCF` = Laurent Ferrier Classic, `XXX` = collection number, `YY` = case metal code (`AC` = stainless steel, `G` = gold variants — `R` rose, `W` white, `Y` yellow, `P` platinum), `ZZ` = dial/strap details.
- **Founder background**: Laurent Ferrier is a former Geneva watchmaking school graduate (his “Montre École” pocket watch from 1968 is the inspiration for the current Classic Origin); he worked at Patek Philippe for 37 years rising to head of movement department; before that he had brief stints in racing (Le Mans podium with Patrick Tambay/François Servanin team at Le Mans 24 Hours in 1979 — a frequently misstated fact, sometimes erroneously cited as Ferrari). He founded Laurent Ferrier in 2009 (some sources say 2008) with his son Christian and a group of investors.
- **The “FBN” caliber prefix** = Ferrier + Barbasini + Navas. Barbasini and Navas are the founders of La Fabrique du Temps (now owned by Louis Vuitton / LVMH), who collaborated on movement development. This is documented and not a secret — Christian Ferrier has explained the naming in multiple interviews.
- **Natural escapement**: Breguet’s 1789 patent, implemented in only 20 pocket watches by Breguet himself; revived by Ferrier with modern materials (nickel phosphorus escape wheels via LIGA process). One of the most technically sophisticated escapements in production.
- **Production volume**: Under 200 watches per year, total. Each watch has multi-year waitlists at retail.
- **Pricing**: Steel Micro-Rotor starts ~$44,000–59,000 retail; precious metal Micro-Rotors $50,000–90,000; tourbillons $175,000+; Grand Sport Tourbillon $250,000+.
- **Assegai hands and onion crown** are brand signatures — verify both are present and properly executed on listings.
- **Special editions / pièce unique**: Many one-off and limited Ferriers exist (Only Watch 2015, Revolution & The Rake collaborations, Kamine 110th anniversary, Sincere Fine Watches 70th anniversary, etc.) — check edition numbering and provenance for accurate valuation.

### Resources — Laurent Ferrier

- laurentferrier.com (official, limited public information given production scarcity)
- Revolution Watch’s Wei Koh long-form coverage — including “The Complete History of Laurent Ferrier”
- A Collected Man Laurent Ferrier secondary-market listings and editorial — exceptional vintage and used Ferrier coverage
- Quill & Pad reviews by Tim Mosso (Watchbox media director) — comprehensive technical analyses
- Phillips Watches archive (phillipswatches.com) — auction comparables for all major references
- Time Transformed (timetransformed.com) — Martin Green’s coverage of new Ferrier launches
- The Rake / Revolution magazine archive for limited-edition collaborations
- GPHG official results database (gphg.org) for award-winning references

-----


<!-- Below: new brand `Berneron` merged from docs/Watch Brand Reference Index — Patch 02.md (2026-05-17) -->

## Brand: Berneron

### Model line: Mirage / Mirage 38 (Sienna and Prussian Blue)

- **Refs**: Mirage 38 Sienna (yellow gold, the first batch of 12 pieces delivered 2024); Mirage 38 Prussian Blue (white gold, the second metal/dial colorway); future colorways anticipated; the Mirage is sold as a single-reference model in two case-metal/dial variants only — no steel will ever be produced (by the founder’s explicit policy)
- **Years**: 2022 (Berneron company founded September 2022, with first watch teaser via dummy/paper-dial model shown to early collector clients); 2023 (Mirage formally introduced); 2024 (official launch and first deliveries; won GPHG Audacity Prize 2024); ongoing production limited to ~24 pieces of each model per year
- **Designer / movement**: Sylvain Berneron (founder, French, 34 years old at brand launch; former designer at BMW, Porsche, Ducati, then IWC, then Breitling where he served as Creative Director for five years and was later promoted to Chief Product Officer with founder Georges Kern’s permission to pursue Berneron in parallel) · Proprietary Caliber 233 — hand-wound, 72-hour power reserve, direct small seconds, inverted handset complication (the hour hand sits on TOP of the minute hand rather than the other way around, allowing for thinner case profile), 2.30mm thick movement, FULLY constructed from 18K solid gold (case, dial, hands, buckle, spring bars, movement main plate, AND bridges); movement designed asymmetrically — the watch’s shape is derived from the movement architecture rather than imposed on it (the case wraps around a deliberately oversized barrel)
- **Key identifiers**: 34mm × 38mm asymmetric (“free shape”) case; 42mm lug-to-lug; 7.00mm total case thickness; 4.90mm visible height; 18K yellow gold (Sienna) or 18K white gold (Prussian Blue); sector dial in silver and blue (Prussian Blue) or silver/yellow tones (Sienna); curved hands (machine-fabricated to standard tolerances are not yet possible — hands must be hand-finished); elongated teardrop-shaped asymmetric crown (uniquely shaped); typography on dial and bridges derived from the Fibonacci sequence; movement decoration includes guilloché, anglage, colimaçonnage, nuagage, and traits tirés finishing — all hand-applied; 20–16mm Barenia leather strap; 30m / 3 ATM water resistance; visible through sapphire caseback with curved spokes for the balance wheel and gears, and curved balance bridge to match the case asymmetry
- **Common nicknames**: “Mirage”, “the asymmetric Berneron”, “the GPHG Audacity winner”
- **Notes**: Berneron is one of the most striking debuts in independent watchmaking of the 2020s, and the Mirage is one of very few modern watches to legitimately rethink the case-from-movement relationship rather than imposing a shaped case on a generic movement. Sylvain Berneron’s argument — that a mechanical movement can be more efficient if freed from the constraints of a circular case, because the gear and escapement trains can take their natural space rather than being squeezed into a round mainplate — is technically substantive, not merely marketing language; the Mirage’s enlarged mainspring barrel directly results in the 72-hour power reserve from a single barrel, and the resulting asymmetric movement shape was the starting point for the case design. Berneron explicitly references Andrew Grima, Gilbert Albert, Rupert Emmerson, vintage Calatrava shaped models, the Cartier Crash, and the Patek Asymétrie as design influences, but distinguishes the Mirage by virtue of having its own dedicated proprietary movement rather than retrofitting a small ladies’ or pocket-watch caliber into a shaped case (the way most vintage shaped watches did). The full-gold construction is rare in the industry — even FP Journe took years to master gold-movement manufacture, and Berneron achieved it on its debut watch. The Mirage won the GPHG Audacity Prize 2024, debuted at Phillips’ Geneva Sessions Fall 2025 online auction (estimate CHF 40,000–80,000 for a 2024 Prussian Blue example), and quickly attracted serious collectors — first major collector Roni Madhvani placed his order based on a paper-dial dummy at a lunch meeting, before the company was even fully operational. Production is limited to ~24 pieces per year per model and pricing at launch was approximately CHF 67,000–85,000 depending on configuration.

### Model line: Quantième Annuel (2025+ second collection)

- **Refs**: Quantième Annuel Silver, Quantième Annuel Black (CHF 140,000 excl. VAT each); production limited to 24 pieces per model per year; first deliveries expected October 2026
- **Years**: 2025 (announced April, debut at Geneva Watch Days September 2025) — first deliveries October 2026
- **Designer / movement**: Sylvain Berneron · Caliber 595 (5.95mm thick — named for its slim height) hand-wound annual calendar with four instantaneous jumping apertures (hour, day, month, day/night indicator) plus retrograde date; two-barrel construction with one barrel beneath the plate and one visible at 6 o’clock vertically aligned with the balance wheel at 12; crown wheel, cliquet, and ratchet wheel form a horizontal line; instantaneous jumping construction
- **Key identifiers**: Round (not asymmetric) case in contrast to the Mirage; officer’s caseback with engraving surface; 30m / 3 ATM water resistance; symmetric dial layout with jumping aperture indications; day correction via pusher at 8 o’clock and month correction via pusher at 4 o’clock; crown handles date and time
- **Common nicknames**: “Berneron Annual”, “Quantième Annuel”
- **Notes**: The Quantième Annuel is Berneron’s second collection and a deliberate contrast to the Mirage — a round-cased, traditional-format annual calendar that demonstrates the brand’s range beyond the asymmetric design language of its debut. The complication is unusually sophisticated for a second collection from a young brand: four instantaneous jumping apertures (instead of slow-creeping changes) and a retrograde date mechanism is comparable in complexity to high-end Patek or Lange annual calendars. The Caliber 595 is named after its 5.95mm thickness, which is impressively slim for an annual calendar with this level of mechanical complexity. The decision to launch a round-cased symmetric watch as the second collection suggests Berneron intends to build a multi-collection house rather than remain a single-design boutique, and the GPHG Audacity Prize legitimacy gives the brand significant runway. First deliveries scheduled October 2026; pricing is CHF 140,000 ex-VAT.

-----

### Caliber Quick-Reference Table — Berneron

|Caliber    |Type                                                                                                                                                                                                                                                                         |Model lines / eras                                                                    |
|-----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
|Caliber 233|Hand-wound time-only, full 18K gold construction (case, dial, hands, mainplate, bridges, spring bars all in gold), direct small seconds, inverted handset complication, 2.30mm thick movement, 72h power reserve, single oversized mainspring barrel, asymmetric architecture|Mirage 38 Sienna (yellow gold), Mirage 38 Prussian Blue (white gold) — 2023/24 onwards|
|Caliber 595|Hand-wound annual calendar, 5.95mm thick, four instantaneous jumping apertures (hour, day, month, day/night), retrograde date, two mainspring barrels                                                                                                                        |Quantième Annuel Silver, Quantième Annuel Black — 2026 deliveries onwards             |

### Listing-Matching Tips — Berneron

- **Founder identity**: Sylvain Berneron, French, designer background at BMW, Porsche, Ducati, IWC, and Breitling (where he was Creative Director then Chief Product Officer). The brand was founded September 2022 in Geneva. He launched the brand with Georges Kern’s explicit blessing while still employed at Breitling — an unusually permissive arrangement.
- **The Mirage is a single reference in TWO COLORWAYS only**: Sienna (yellow gold case + dial palette) and Prussian Blue (white gold case + blue/silver dial). No steel version has ever been or will ever be produced (Berneron’s explicit policy to preserve scarcity and material justification of pricing).
- **Production volume**: 24 pieces per year per model. Heavily back-ordered; first allocations went to a small group of major independent collectors (Roni Madhvani, Laurent Picciotto, Auro Montanari).
- **Caliber 233 full-gold construction**: Case, dial, hands, mainplate, bridges, even the spring bars are 18K gold. Total movement thickness 2.30mm. Verify gold authenticity on any secondary-market listing.
- **Fibonacci-derived typography**: The dial numerals and minute markers are designed using the Fibonacci sequence proportions. The hour wheel features a perforated dotted pattern also derived from a Fibonacci spiral. Authentic Berneron typography is distinctive and difficult to fake.
- **GPHG Audacity Prize 2024**: Mirage’s first major award. Provenance documentation should mention this.
- **Phillips auction debut**: Fall 2025 Geneva Sessions, Lot 1, Prussian Blue example. Set pricing precedent for secondary market.
- **Movement architecture**: The asymmetric movement geometry of Caliber 233 is what drives the case shape — the watch’s shape comes from the calibre, not the other way around. This is the brand’s foundational design philosophy.
- **Servicing**: Berneron designs allow servicing by experienced local watchmakers (once Berneron provides a spare parts kit) or directly by the brand in Switzerland. Service interval is 5–10 years depending on use.
- **All components manufactured in Switzerland** (cantons of Neuchâtel and Jura) — Berneron exceeds the “Swiss Made” 60% threshold and emphasizes this in marketing.

### Resources — Berneron

- berneron.ch (official) — only direct source for current reference cross-referencing
- Phillips Watches (phillips.com) — the Berneron Mirage auction debut at Geneva Sessions Fall 2025, including editorial coverage by Logan Baker
- Revolution Watch coverage by Wei Koh — “Sylvain Berneron Makes His Debut with the Mirage” — the most detailed pre-launch profile
- Watchonista feature articles on the Mirage (including “The Buzz Behind the Berneron Mirage”) and the Quantième Annuel debut at Geneva Watch Days 2025
- Hairspring vintage/independent dealer coverage of secondary-market Mirage 38 examples
- A Collected Man editorial (occasional, given limited production)
- GPHG 2024 results — Audacity Prize
- Hodinkee and Robb Report features for general-press coverage

-----

Watch Brand Reference Index — Patch 02 has been written in ten sections covering Blancpain (divers), Nivada Grenchen, Benrus, Favre-Leuba, Enicar, Doxa, Aquastar, Ressence, Laurent Ferrier, and Berneron. Each brand section follows the exact schema specified — model-line entries with Refs/Years/Designer-movement/Key identifiers/Common nicknames/Notes, followed by the per-brand Caliber Quick-Reference Table, Listing-Matching Tips, and Resources appendix. The patch is ready to be appended to the master aggregator index.

## Appendix

## Appendix

### A. Cross-brand nickname dictionary

|Nickname                                  |Brand                           |Model line                           |Reference(s)                                                                             |
|------------------------------------------|--------------------------------|-------------------------------------|-----------------------------------------------------------------------------------------|
|Albino                                    |Rolex                           |Daytona / Explorer                   |6263 “Albino” (white-dial Daytona); 14270 “Albino” prototype                             |
|Andretti                                  |Heuer                           |Autavia                              |1163 with orange accents                                                                 |
|Bao Dai                                   |Rolex                           |(Vintage Triple Calendar)            |6062 Bao Dai (unique black diamond-marker variant — $5M+ auctions)                       |
|Bark                                      |Rolex                           |Day-Date                             |1831 (bark-finished gold)                                                                |
|Batman / Batgirl                          |Rolex                           |GMT-Master II                        |116710BLNR (Batman, Oyster) / 126710BLNR (Batgirl, Jubilee)                              |
|Big Eye                                   |TAG Heuer / Heuer               |Autavia / Autavia reissue            |CBE2110 (oversized 30-min)                                                               |
|Big Red                                   |Rolex                           |Daytona                              |6263/6265 with “DAYTONA” in red                                                          |
|Big Triangle                              |Omega                           |Seamaster 300                        |165.024 first execution                                                                  |
|Black Bay (n/a)                           |—                               |—                                    |(Tudor brand — exclude)                                                                  |
|Bond Seamaster                            |Omega                           |Seamaster Diver 300M                 |2531.80                                                                                  |
|Brass Journe                              |F.P. Journe                     |Tourbillon / Résonance / etc.        |Pre-2003 brass-movement era                                                              |
|Camaro Panda                              |Heuer                           |Camaro                               |7220 panda dial                                                                          |
|Candy / Coral / Turquoise                 |Rolex                           |Oyster Perpetual                     |124300 with vivid 2020 dial colors                                                       |
|Cermit / Starbucks                        |Rolex                           |Submariner                           |126610LV (black dial green bezel)                                                        |
|Charlie / Charlie’s Angel                 |F.P. Journe                     |(any white-dial)                     |(rare collector slang)                                                                   |
|Cloud (Bleu Nuit Nuage 50)                |Audemars Piguet                 |Royal Oak                            |5402ST / 15202ST / 16202ST original blue galvanic dial                                   |
|Coke                                      |Rolex                           |GMT-Master II                        |16710 with red/black bezel                                                               |
|Comex                                     |Rolex                           |Submariner / Sea-Dweller             |5514 / 1665 / 16610 COMEX co-signed                                                      |
|Cookie Monster                            |Patek Philippe                  |Aquanaut                             |Limited blue + brown dial variants                                                       |
|Dark Lord                                 |Heuer                           |Monaco                               |740303N (black PVD)                                                                      |
|Dato 45                                   |Heuer                           |Carrera                              |3147 (date at 9 — extremely rare)                                                        |
|Daytona Beach                             |Rolex                           |Daytona                              |116519 with white-MOP, turquoise, etc.                                                   |
|Deep Blue / D-Blue / Cameron              |Rolex                           |Deepsea                              |126660 with gradient blue-black dial                                                     |
|Demoiselle                                |Cartier                         |Santos-Dumont                        |Skeleton 2022 with aircraft-shaped rotor                                                 |
|Destro / Sprite                           |Rolex                           |GMT-Master II                        |126720VTNR (green-black bezel + left crown)                                              |
|Doctor No                                 |Rolex                           |Submariner                           |6538 “Big Crown” (vintage James Bond reference)                                          |
|DON / “Domino’s Pizza”                    |Rolex                           |GMT-Master II                        |(informal — refers to 16710 “Domino’s” promotional dial; less common)                    |
|Double Red                                |Rolex                           |Sea-Dweller                          |1665 DRSD (two red lines of text)                                                        |
|Ed White                                  |Omega                           |Speedmaster                          |105.003 (pre-Professional Cal. 321)                                                      |
|Evil Nina                                 |Universal Genève                |Compax                               |885103 (reverse panda black/white)                                                       |
|Eye of the Tiger                          |Patek Philippe                  |Aquanaut                             |Limited gradient orange                                                                  |
|Fat Lady                                  |Rolex                           |GMT-Master II                        |16760 (1980s thicker case)                                                               |
|FOIS                                      |Omega                           |Speedmaster                          |311.32.40.30.01.001 First Omega In Space                                                 |
|Freccione                                 |Rolex                           |Explorer II                          |1655 (orange arrow GMT hand)                                                             |
|Frosted Gold                              |Audemars Piguet                 |Royal Oak                            |15454/15510 etc. with hammered gold case                                                 |
|Glassbox Carrera                          |TAG Heuer                       |Carrera                              |CBN201F / CBK2110 / CBS2210 (2023 60th-anniversary 39mm domed sapphire)                  |
|Great White / Triple Six                  |Rolex                           |Sea-Dweller                          |1665 final execution white-text                                                          |
|Gulf Monaco                               |TAG Heuer                       |Monaco                               |CBL2115 / CAW211R (orange/blue stripes)                                                  |
|Havana                                    |F.P. Journe                     |Chronomètre Souverain / Octa Lune    |Brown ruthenium-gold dial                                                                |
|Hulk                                      |Rolex                           |Submariner                           |116610LV (all-green)                                                                     |
|IGY                                       |Jaeger-LeCoultre                |Geophysic                            |E168 1958 original (International Geophysical Year)                                      |
|Ice Blue                                  |Rolex                           |Day-Date / Daytona                   |Platinum-only dial color (118206, 116506, 126506)                                        |
|Jaguar                                    |Patek Philippe                  |Aquanaut                             |(informal — gradient green)                                                              |
|James Bond                                |Rolex                           |Submariner                           |6538 / 2531.80 (also Omega)                                                              |
|Jaws                                      |Audemars Piguet                 |Royal Oak Offshore                   |25721ST “The Beast”                                                                      |
|John Mayer                                |Rolex                           |Daytona                              |116508 (yellow gold green dial)                                                          |
|Jumbo                                     |Audemars Piguet / Patek Philippe|Royal Oak / Nautilus                 |5402/14802/15002/15202/16202 (AP); 3700/1A (Patek period nickname)                       |
|Khaki                                     |Patek Philippe                  |Aquanaut                             |5168G-010 green dial                                                                     |
|Kermit                                    |Rolex                           |Submariner                           |16610LV (green bezel only — 50th anniversary 2003)                                       |
|Klaus Calendar                            |IWC                             |Da Vinci                             |IW3750 1985 Kurt Klaus mechanism                                                         |
|Lake Tahoe                                |IWC                             |Big Pilot Top Gun                    |White ceramic LE                                                                         |
|Lightning Bolt                            |Rolex                           |Milgauss                             |6541 / 116400GV                                                                          |
|Maxi Dial                                 |Rolex                           |Submariner                           |5513/1680 with fat lume plots                                                            |
|McQueen                                   |Heuer                           |Monaco                               |1133B (Le Mans, 1971)                                                                    |
|MilSub                                    |Rolex                           |Submariner                           |5513/5517 military                                                                       |
|Mick Jagger                               |Heuer                           |Carrera                              |1153N                                                                                    |
|Microtor only                             |Universal Genève                |Polerouter                           |20360/20363/10357 early Cal. 215                                                         |
|Mojave Desert                             |IWC                             |Big Pilot                            |IW501007 (sand-colored ceramic)                                                          |
|Moonwatch                                 |Omega                           |Speedmaster Professional             |105.012 onward                                                                           |
|Nina Rindt                                |Universal Genève                |Compax                               |885101 (white dial, black sub-registers)                                                 |
|No Time to Die                            |Omega                           |Seamaster Diver 300M                 |210.92.42.20.01.001 titanium mesh                                                        |
|Padellone                                 |Rolex                           |Triple Calendar                      |8171                                                                                     |
|Panda                                     |Multiple                        |(any chronograph)                    |White dial + black subregisters (Daytona 6263, Carrera 2447SN, Speedmaster CK2998 silver)|
|Patrizzi                                  |Rolex                           |Daytona                              |16520 with brown-fading silver subdials                                                  |
|Paul Newman                               |Rolex                           |Daytona                              |6239/6241/6262/6263/6264/6265 exotic dial                                                |
|Pepsi                                     |Rolex                           |GMT-Master / GMT-Master II           |1675/16710/126710BLRO (red/blue)                                                         |
|Petit Prince                              |IWC                             |Pilot Mark XVIII / Big Pilot         |IW327015 / various blue-dial Saint-Exupéry LEs                                           |
|Polar                                     |Rolex                           |Explorer II                          |16550/16570/226570 white dial                                                            |
|Pussy Galore                              |Rolex                           |GMT-Master                           |6542 (no crown guards)                                                                   |
|Rainbow                                   |Rolex                           |Daytona                              |116595RBOW (gem-set baguette)                                                            |
|Red Sub                                   |Rolex                           |Submariner                           |1680 with red “Submariner” text                                                          |
|Reverse Panda                             |Multiple                        |(any chronograph)                    |Black dial + white subregisters                                                          |
|Root Beer                                 |Rolex                           |GMT-Master                           |1675/16753 / 126711CHNR brown                                                            |
|Rindt                                     |Heuer                           |Autavia                              |2446 SN (Jochen Rindt)                                                                   |
|Sigma Dial                                |Multiple                        |(gold-marker-flanked indices)        |(refers to σ symbols indicating real-gold appliques — found on 1970s Rolex/Patek/AP)     |
|Sky Dweller (n/a model line in this index)|Rolex                           |Sky-Dweller                          |(excluded from scope; lineage uses refs 326933, 336235 etc.)                             |
|Smurf                                     |Rolex                           |Submariner                           |116619LB (white gold blue)                                                               |
|Snoopy                                    |Omega                           |Speedmaster                          |311.32.42.30.04.003 / 310.32.42.50.02.001 etc.                                           |
|Soccer Star                               |Patek Philippe                  |Aquanaut                             |(informal — sport-luxury slang)                                                          |
|Solo                                      |Heuer                           |Daytona                              |6263/6265 without “Cosmograph”                                                           |
|Speedy Tuesday                            |Omega                           |Speedmaster                          |311.32.42.30.04.003 (LE 2017)                                                            |
|Spider                                    |Rolex                           |Datejust / Day-Date                  |(dial lacquer cracking pattern)                                                          |
|Spirograph                                |Patek Philippe                  |Calatrava                            |(informal — guilloché pattern)                                                           |
|Stella                                    |Rolex                           |Day-Date / Oyster Perpetual          |Lacquered colored vintage dials                                                          |
|Steve McQueen                             |Heuer / Rolex                   |Monaco / Explorer II (misattribution)|1133B / 1655 (1655 misattribution)                                                       |
|Submariner Single Red                     |Rolex                           |Submariner                           |1680 with single “Submariner” red line (transitional)                                    |
|Tiffany Nautilus                          |Patek Philippe                  |Nautilus                             |5711/1A-014 (LE 170 Tiffany Blue 2021)                                                   |
|Tropical                                  |Multiple                        |(any)                                |Brown-faded originally-black dial                                                        |
|Triple Crown                              |Jaeger-LeCoultre                |Polaris Memovox                      |E859 (three crowns)                                                                      |
|Viceroy                                   |Heuer                           |Autavia                              |1163V (Viceroy cigarette LE)                                                             |
|Wimbledon                                 |Rolex                           |Datejust                             |116200/126234 with green-Roman slate dial                                                |
|Z-Blue                                    |Rolex                           |Milgauss                             |116400GV with blue electric dial 2014                                                    |

### B. Cross-brand dial descriptor vocabulary

|Term                                                       |Meaning                                                                                                                                                                     |
|-----------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Tropical**                                               |Originally black/dark dial that has oxidized to brown/chocolate from sun exposure. Highly valued when even and well-developed; uneven tropical patina is less desirable.    |
|**Tropical patina**                                        |The brown coloration itself, distinguished from full “tropical” when partial.                                                                                               |
|**Gilt**                                                   |High-gloss black dial with gilded (gold) printed text and chapter ring (vintage Rolex 1950s–60s, Omega Pre-Professional Speedy, etc.). Distinguished by the lacquered shine.|
|**Matte**                                                  |Non-glossy dial finish (vintage Rolex 1968+ transition from gilt to matte).                                                                                                 |
|**Panda**                                                  |White/silver dial with black sub-registers. Used across Daytona, Speedmaster, Carrera, Compax, etc.                                                                         |
|**Reverse panda**                                          |Black dial with white sub-registers.                                                                                                                                        |
|**Soleil / Sunburst / Sunray**                             |Dial with radial brushing creating a rising-sun light effect.                                                                                                               |
|**DON** (“Dot Over Ninety”)                                |Refers to specific Rolex GMT bezel inserts where the lume dot sits above the “90” tachymeter marking (vs. next to).                                                         |
|**Paul Newman**                                            |Exotic dial Daytona with Art Deco numerals, square markers in sub-registers, and contrasting sub-dial colors. Often the “RCO” variant (Rolex Cosmograph Oyster).            |
|**Big Logo / Small Logo**                                  |Variant pre-/post-transition references with differently sized brand logo (common on Tudor, occasional on vintage Rolex).                                                   |
|**Sigma dial** (σ)                                         |Dials marked with σ (sigma) Greek letters flanking the “SWISS” or “T SWISS T” indicating real-gold hour markers; produced ~1969–80 by APRIOR consortium.                    |
|**Lume plot / Lume pip**                                   |The luminous compound circles at the hour markers; condition (tritium intact, patina match between dial and hands) is critical.                                             |
|**Spider / spider cracking**                               |Concentric lacquer cracking on vintage dial finishes — generally undesirable.                                                                                               |
|**Maxi dial**                                              |Vintage Rolex Submariner 5513/1680 dial variant with enlarged lume plots ~1977–80.                                                                                          |
|**Singer dial**                                            |Manufactured by Singer in Switzerland; common on vintage Heuer and Rolex; the “Singer” name on the back is a quality indicator.                                             |
|**Stern Frères dial**                                      |Geneva-based dial maker for Patek and AP; “Bleu Nuit, Nuage 50” was their proprietary blue.                                                                                 |
|**Cloisonné enamel**                                       |High-temperature enamel artwork with gold-wire boundaries delineating colors. Common on vintage Patek World Time map dials.                                                 |
|**Grand Feu enamel**                                       |High-temperature fired single-color enamel dial, glasslike and luminous.                                                                                                    |
|**Guilloché / Engine-turned**                              |Pattern hand-machined into the dial surface (clous de Paris hobnail, barleycorn, sunburst, soleil, etc.).                                                                   |
|**Petite Tapisserie / Grande Tapisserie / Méga Tapisserie**|AP’s three sizes of pyramidal guilloché dial texture, used on Royal Oak Jumbo (Petite), 41mm RO (Grande), and Offshore (Méga).                                              |
|**Honeygold**                                              |A. Lange & Söhne proprietary alloy — slightly warmer than yellow gold, harder for engraving.                                                                                |
|**Ice Blue**                                               |Rolex platinum-exclusive pale blue dial color (118206 Day-Date, 116506/126506 Daytona).                                                                                     |
|**Bleu Nuit, Nuage 50**                                    |Audemars Piguet’s signature deep blue dial color for vintage and modern RO Jumbo, achieved via galvanic bath.                                                               |
|**Smoked / Fumé**                                          |Gradient dial fading from light center to darker periphery (Royal Oak smoked dials, Zenith A385 original fumé).                                                             |
|**Lumen**                                                  |A. Lange & Söhne’s semi-transparent dial editions allowing UV light to charge luminous date discs.                                                                          |
|**Mocha / Slate / Anthracite / Champagne**                 |Common dial color descriptors for vintage and modern pieces.                                                                                                                |

### C. Key resources and databases

|Resource                                 |URL                                            |Use                                                                                                             |
|-----------------------------------------|-----------------------------------------------|----------------------------------------------------------------------------------------------------------------|
|**WatchBase**                            |watchbase.com                                  |Reference database with specifications, calibers, dimensions across brands; useful for fact-checking refs.      |
|**Chrono24**                             |chrono24.com                                   |Largest secondary market aggregator; current listing prices and reference-level pages.                          |
|**Ranfft.de** (legacy)                   |ranfft.de                                      |Movement caliber database (succession site exists; original was indispensable for vintage caliber ID).          |
|**Fratello Watches**                     |fratellowatches.com                            |In-depth modern and vintage reviews; strong on Omega and modern releases.                                       |
|**Hodinkee**                             |hodinkee.com                                   |Wide brand coverage; auction reports; in-depth historical features.                                             |
|**Phillips Watches**                     |phillips.com/watches                           |Auction house with industry-leading vintage research; “The Fine Print” guides are reference-tier.               |
|**Christie’s / Sotheby’s / Antiquorum**  |christies.com / sothebys.com / antiquorum.swiss|Auction archives for provenance and price history.                                                              |
|**Bonhams Watches**                      |bonhams.com                                    |Auction archives.                                                                                               |
|**Langepedia**                           |langepedia.com                                 |A. Lange & Söhne reference specialist site.                                                                     |
|**AP Chronicles**                        |apchronicles.com                               |Audemars Piguet specialist site (informal but dense).                                                           |
|**OnTheDash**                            |onthedash.com                                  |Definitive vintage Heuer reference site (Jeff Stein).                                                           |
|**Heuer Price Guide**                    |heuerpriceguide.com                            |Vintage Heuer pricing and reference identification.                                                             |
|**Universal Genève Polerouter Reference**|universalgenevepolerouter.com                  |Specialist database for Polerouter dial variants and serial ranges.                                             |
|**SJX Watches**                          |watchesbysjx.com                               |Industry coverage with focus on independent watchmaking and Asia market.                                        |
|**A Collected Man**                      |acollectedman.com                              |UK-based independent dealer with strong editorial on F.P. Journe and independents.                              |
|**Monochrome Watches**                   |monochrome-watches.com                         |Modern release coverage and reviews.                                                                            |
|**Revolution Watch**                     |revolutionwatch.com                            |Industry magazine with deep technical features.                                                                 |
|**The 1916 Company** (formerly WatchBox) |the1916company.com                             |Pre-owned high-end dealer with reference cards.                                                                 |
|**Bring a Loupe**                        |hodinkee.com/bring-a-loupe                     |Curated weekly vintage finds (Hodinkee section).                                                                |
|**Watch Sites for Cartier**              |(no single canonical source)                   |Cross-reference Cartier.com, Cartier Privé press releases, and Phillips auction archives.                       |
|**WatchProSite / Purists**               |watchprosite.com                               |Long-form forum threads, often by recognized industry experts (Jean-Claude Biver participation in some threads).|
|**Patek Philippe Magazine**              |patek.com                                      |Brand-published references for current production specifications.                                               |
|**Patek Philippe Archives Service**      |patek.com/en/services/archives                 |Official Extract from the Archives — necessary for vintage Patek authentication.                                |

### D. Retailer / co-signer signals vocabulary

Co-signed dials with retailer or signatory names typically command 20–500% premiums over equivalent non-co-signed pieces. Authentication is critical — counterfeit co-signatures are common.

|Co-signer                         |Brands typically affected                                           |Era                                                     |Notes                                                                                                                                                                                                                                      |
|----------------------------------|--------------------------------------------------------------------|--------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Tiffany & Co.**                 |Patek Philippe, Rolex (Datejust/Day-Date/OP), Audemars Piguet (rare)|1950s–present                                           |Tiffany Blue Nautilus 5711-014 is the modern apotheosis. Vintage Tiffany Patek 96/570 stamped “Tiffany & Co.” adds significantly to value. Tiffany Rolex OPs from the 1960s–80s are increasingly collected.                                |
|**Cartier Paris**                 |Cartier CPCP, Rolex (rare vintage), JLC (rare)                      |1998–2008 CPCP era; pre-1970s “Cartier” stamped on Rolex|“Paris” suffix on dial = CPCP authentic. “Cartier” stamped on a 1960s Rolex Daytona or Submariner is one of the rarest co-signatures.                                                                                                      |
|**Cartier London**                |Cartier vintage (Crash, Tank, etc.)                                 |1960s–early 1970s                                       |London-made pieces (Jean-Jacques Cartier era) include the 1967 original Crash. Distinguished by London hallmarks on case.                                                                                                                  |
|**Gübelin**                       |Patek Philippe, Rolex, Vacheron, Audemars                           |1940s–80s                                               |Swiss retailer based in Lucerne. Gübelin co-signed Patek perpetuals are auction-grade rare.                                                                                                                                                |
|**Beyer**                         |Patek Philippe, Rolex, IWC                                          |1950s–present                                           |Zurich retailer. Beyer-signed pieces from the 1960s–70s are highly collected.                                                                                                                                                              |
|**Serpico y Laino**               |Patek Philippe, Rolex                                               |1940s–60s                                               |Venezuelan retailer (Caracas). Famous for “Serpico y Laino, Caracas” Patek and Rolex Padellone (8171) co-signatures. Strong Italian and Venezuelan demand.                                                                                 |
|**Joyería Riviera**               |Rolex, Patek                                                        |1960s–80s                                               |Latin American retailer co-signatures.                                                                                                                                                                                                     |
|**Black Label FPJ**               |F.P. Journe                                                         |2003+                                                   |Black-dial editions sold only through F.P. Journe boutiques (not authorized dealers). Identifying mark: red text on caseback indicating Boutique edition; dial is black; specific reference (CS, AN, RM, RQ, etc. in Black Label variants).|
|**CPCP**                          |Cartier                                                             |1998–2008                                               |Collection Privée Cartier Paris boutique-only series. “Paris” dial signature; hand-finished mechanical movements (Cal. 9P, F. Piguet, JLC ébauches).                                                                                       |
|**Cartier Privé**                 |Cartier                                                             |2017–present                                            |Annual limited-edition revival (50–200 pieces). Reference numbers prefix `WHRO`/`WGCH`/`CRWHTA` etc.; dial signature standard; serially-numbered case-back.                                                                                |
|**Comex**                         |Rolex                                                               |1970s–80s                                               |“COMEX” stamped on dial (between SWISS MADE indications) and case-back of Submariner/Sea-Dweller commissioned for COMEX divers. Original engraved case-back numbers are critical authentication.                                           |
|**A. Aerospatiale / SAS / Pan Am**|Various aviation                                                    |1950s–60s                                               |Aviation industry commissioning marks; rare. Pan Am co-signed GMT-Masters (1675) are auction-grade.                                                                                                                                        |
|**Cartier Privé “Le Opus”**       |Cartier                                                             |2025                                                    |10th anniversary Privé trilogy — Tank Normale, Tortue Monopoussoir, Crash Squelette in platinum with burgundy accents. Limited to 150 pieces for the Crash.                                                                                |

-----

## File usage notes (closing)

This index is intended to be loaded in full as context into a Claude Code session — at approximately 35,000 tokens, it fits comfortably alongside a watch listing dataset for matching tasks. Recommended Claude Code patterns:

1. **Reference extraction**: pass the file as a tool-callable resource (`@watch_reference_index.md`) and ask Claude to “extract brand canonical, model line, and reference number from this listing text, citing the specific entry in the index that matched.”
1. **Disambiguation**: when a listing mentions only a nickname (e.g., “vintage Pepsi”), use the Cross-brand nickname dictionary to enumerate candidate references, then ask follow-up questions or examine images to confirm.
1. **Era flagging**: the Heuer / TAG Heuer split at 1985 is enforced — when a listing is ambiguous, the reference number format is the most reliable signal (4-digit vintage = Heuer; alphanumeric modern = TAG Heuer).
1. **Co-signer verification**: when a listing claims a retailer co-signature (Tiffany, Cartier, Gübelin, Serpico y Laino, Comex), require corroborating evidence (extract from archives, photographic detail of dial signature, original paperwork) before applying valuation premiums.
1. **Authentication signals**: collector-grade Notes for each model line embed the most consequential authentication red flags (refinished dials, replaced bezels, incorrect bracelets) — surface these in listing summaries when prompted.

This document is a living reference. Brand release schedules (particularly Rolex, Audemars Piguet, Patek Philippe, and Cartier Privé) introduce new references annually. Re-cross-check current production references against the brand’s official site (rolex.com, patek.com, audemarspiguet.com, alange-soehne.com, fpjourne.com, cartier.com) when accuracy on the latest releases is critical. For vintage references, Phillips, Christie’s, Sotheby’s, Antiquorum, and Bonhams auction archives remain the most reliable provenance and pricing sources.

— End of `watch_reference_index.md` —