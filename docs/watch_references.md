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