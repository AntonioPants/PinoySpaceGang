"""Text templates for everything the engine says, in English and Filipino.

Every explanation the engine produces goes through ``t(lang, key, **values)`` so the same
plan can be read in either language.  Missing Filipino strings fall back to English.

The Filipino text was written by the team for the prototype and should be reviewed by a
native-speaking agricultural extension worker before field use.
"""
from __future__ import annotations

LANGUAGES = ("en", "fil")

MESSAGES: dict[str, dict[str, str]] = {
    # ---- vocabulary ----------------------------------------------------------------------
    "season.wet": {"en": "wet season", "fil": "tag-ulan"},
    "season.dry": {"en": "dry season", "fil": "tag-araw"},
    "season.warm": {"en": "warm season", "fil": "mainit na panahon"},
    "season.cool": {"en": "cool season", "fil": "malamig na panahon"},
    "water_source.rainfed": {"en": "rain only", "fil": "ulan lamang"},
    "water_source.supplemental": {"en": "limited supplemental irrigation", "fil": "limitadong dagdag na patubig"},
    "water_source.irrigated": {"en": "full irrigation", "fil": "buong patubig"},
    "factor.water": {"en": "water shortage", "fil": "kakulangan sa tubig"},
    "factor.heat": {"en": "heat during flowering", "fil": "init habang namumulaklak"},
    "factor.waterlogging": {"en": "waterlogging", "fil": "pagkababad sa tubig"},
    "factor.extreme_weather": {"en": "storms (extreme rain or wind)", "fil": "bagyo (matinding ulan o hangin)"},
    "factor.thermal_time": {"en": "too little warmth to mature", "fil": "kulang na init para mahinog"},
    "factor.frost": {"en": "frost", "fil": "hamog na nagyeyelo"},
    "factor.salinity": {"en": "soil salinity", "fil": "alat ng lupa"},
    "criterion.water": {"en": "water fit", "fil": "akma sa tubig"},
    "criterion.soil": {"en": "soil health", "fil": "kalusugan ng lupa"},
    "criterion.risk": {"en": "low climate risk", "fil": "mababang panganib sa klima"},
    "criterion.income": {"en": "income", "fil": "kita"},
    "relation.below": {"en": "below", "fil": "mas mababa sa"},
    "relation.above": {"en": "above", "fil": "mas mataas sa"},
    "indicator.root_wetness": {
        "en": "root-zone soil wetness ({days}-day average)",
        "fil": "basa ng lupa sa lalim ng ugat (average ng {days} araw)",
    },
    "indicator.rain_30d": {"en": "rainfall in the previous {days} days", "fil": "ulan sa nakaraang {days} araw"},
    "indicator.rain_60d": {"en": "rainfall in the previous {days} days", "fil": "ulan sa nakaraang {days} araw"},
    "fallow": {"en": "Fallow", "fil": "Pahinga (walang tanim)"},
    "unit.wetness": {"en": "(0 = dry, 1 = saturated)", "fil": "(0 = tuyo, 1 = babad)"},
    "disclaimer": {
        "en": "Scores are relative comparisons between rotations, not yield or profit predictions. Review this plan with a local agricultural adviser before acting on it.",
        "fil": "Ang mga iskor ay paghahambing lamang ng mga ikot-tanim, hindi hula ng ani o kita. Ipasuri muna ang planong ito sa lokal na agricultural adviser o technician bago kumilos.",
    },
    # ---- feasibility ---------------------------------------------------------------------
    "feas.season.ok": {"en": "{crop} is grown in the {season}.", "fil": "Itinatanim ang {crop} sa {season}."},
    "feas.season.fail": {
        "en": "{crop} is not a {season} crop in this region.",
        "fil": "Hindi pang-{season} ang {crop} sa rehiyong ito.",
    },
    "feas.duration.ok": {
        "en": "{crop} needs {days} days; the season window allows {window}.",
        "fil": "Kailangan ng {crop} ang {days} araw; {window} araw ang haba ng panahon.",
    },
    "feas.duration.fail": {
        "en": "{crop} needs {days} days but only {window} days fit in the season.",
        "fil": "Kailangan ng {crop} ang {days} araw pero {window} araw lang ang kasya sa panahon.",
    },
    "feas.temp.ok": {
        "en": "Mean temperature while growing is {value} C, inside the {lo:g}-{hi:g} C range of {crop}.",
        "fil": "Ang karaniwang temperatura habang lumalaki ay {value} C, pasok sa {lo:g}-{hi:g} C na saklaw ng {crop}.",
    },
    "feas.temp.fail": {
        "en": "Mean temperature while growing is {value} C, outside the {lo:g}-{hi:g} C range of {crop}.",
        "fil": "Ang karaniwang temperatura habang lumalaki ay {value} C, labas sa {lo:g}-{hi:g} C na saklaw ng {crop}.",
    },
    "feas.gdd.ok": {
        "en": "{value} growing-degree days are available; {crop} needs about {need}.",
        "fil": "May {value} growing-degree days; mga {need} ang kailangan ng {crop}.",
    },
    "feas.gdd.fail": {
        "en": "Only {value} growing-degree days are available; {crop} needs about {need} to mature.",
        "fil": "{value} growing-degree days lang ang mayroon; mga {need} ang kailangan ng {crop} para mahinog.",
    },
    "feas.frost.ok": {
        "en": "Frost occurred in {pct}% of years while {crop} would be in the field - within tolerance.",
        "fil": "Nagkaroon ng frost sa {pct}% ng mga taon habang nasa bukid ang {crop} - kaya pa.",
    },
    "feas.frost.fail": {
        "en": "Frost occurred in {pct}% of years while frost-sensitive {crop} would be in the field.",
        "fil": "Nagkaroon ng frost sa {pct}% ng mga taon habang nasa bukid ang {crop} na sensitibo sa frost.",
    },
    "feas.salt.ok": {
        "en": "Soil salinity {value} dS/m is tolerable for {crop} (yield starts to fall above {threshold} dS/m).",
        "fil": "Kaya ng {crop} ang alat ng lupa na {value} dS/m (bumababa ang ani kapag lampas {threshold} dS/m).",
    },
    "feas.salt.fail": {
        "en": "Soil salinity {value} dS/m is far above what {crop} tolerates ({threshold} dS/m).",
        "fil": "Ang alat ng lupa na {value} dS/m ay sobrang taas para sa {crop} ({threshold} dS/m lang ang kaya).",
    },
    "feas.ph.ok": {
        "en": "Soil pH {value} suits {crop} (range {lo:g}-{hi:g}).",
        "fil": "Akma sa {crop} ang pH ng lupa na {value} (saklaw {lo:g}-{hi:g}).",
    },
    "feas.ph.fail": {
        "en": "Soil pH {value} is outside the {lo:g}-{hi:g} range of {crop}.",
        "fil": "Ang pH ng lupa na {value} ay labas sa {lo:g}-{hi:g} na saklaw ng {crop}.",
    },
    "feas.water.ok": {
        "en": "With {source}, {pct}% of the water {crop} needs in the {season} was met on average over {years} years (crop demand {demand} mm, rain while growing {rain} mm).",
        "fil": "Sa {source}, {pct}% ng tubig na kailangan ng {crop} sa {season} ang natugunan sa loob ng {years} taon (kailangan ng tanim {demand} mm, ulan habang lumalaki {rain} mm).",
    },
    "feas.water.fail": {
        "en": "With {source}, only {pct}% of the water {crop} needs in the {season} was met on average over {years} years (crop demand {demand} mm, rain while growing {rain} mm). It needs more irrigation than this farm has.",
        "fil": "Sa {source}, {pct}% lang ng tubig na kailangan ng {crop} sa {season} ang natugunan sa loob ng {years} taon (kailangan ng tanim {demand} mm, ulan habang lumalaki {rain} mm). Kailangan nito ng mas maraming patubig kaysa mayroon ang bukid.",
    },
    "feas.reliable.ok": {
        "en": "{crop} in the {season} failed in {failed} of {years} years replayed.",
        "fil": "Pumalya ang {crop} sa {season} sa {failed} sa {years} taong sinubok.",
    },
    "feas.reliable.fail": {
        "en": "{crop} in the {season} failed in {failed} of {years} years replayed, mainly from {cause}.",
        "fil": "Pumalya ang {crop} sa {season} sa {failed} sa {years} taong sinubok, pangunahing dahil sa {cause}.",
    },
    # ---- reasons behind the scores -------------------------------------------------------
    "reason.water.slot": {
        "en": "{crop} in the {season}: {pct}% of its water demand was met on average over {years} years (demand {demand} mm, rain while growing {rain} mm).",
        "fil": "{crop} sa {season}: {pct}% ng kailangang tubig ang natugunan sa loob ng {years} taon (kailangan {demand} mm, ulan habang lumalaki {rain} mm).",
    },
    "reason.water.irrigation": {
        "en": "Irrigation applied averages {m3} m3/ha per year with {source}.",
        "fil": "Karaniwang {m3} m3/ha kada taon ang patubig na nagamit sa {source}.",
    },
    "reason.soil.n": {
        "en": "Legumes ({legumes}) pass on about {credit} kg N/ha per year to the crops that follow. Fertiliser nitrogen still needed averages {per_crop} kg/ha per crop grown (current rotation: {current}), or {need} kg/ha per year in total.",
        "fil": "Ang mga legumbre ({legumes}) ay nag-iiwan ng mga {credit} kg N/ha kada taon sa susunod na tanim. Karaniwang {per_crop} kg/ha na abonong nitroheno pa ang kailangan sa bawat tanim (kasalukuyang ikot: {current}), o {need} kg/ha kada taon sa kabuuan.",
    },
    "reason.soil.n.none": {
        "en": "No legume in the cycle: all nitrogen ({per_crop} kg/ha per crop grown, {need} kg/ha per year) must come from fertiliser.",
        "fil": "Walang legumbre sa ikot: lahat ng nitroheno ({per_crop} kg/ha sa bawat tanim, {need} kg/ha kada taon) ay manggagaling sa abono.",
    },
    "reason.soil.cover": {
        "en": "Soil cover and residue rating {cover}/5; the field is bare or fallow in {fallow} of 6 seasons.",
        "fil": "Marka ng takip at natirang dayami {cover}/5; nakatiwangwang ang bukid sa {fallow} sa 6 na panahon.",
    },
    "reason.soil.carbon": {
        "en": "About {c} t C/ha goes back into the soil each year; organic carbon is projected to change by {pct:+.1f}% in 10 years (illustrative).",
        "fil": "Mga {c} t C/ha ang naibabalik sa lupa kada taon; tinatayang magbabago ang organic carbon nang {pct:+.1f}% sa loob ng 10 taon (halimbawa lamang).",
    },
    "reason.soil.carbon.unavailable": {
        "en": "About {c} t C/ha goes back into the soil each year. No starting organic-carbon value is available, so no carbon trend is scored.",
        "fil": "Mga {c} t C/ha ang naibabalik sa lupa kada taon. Walang panimulang halaga ng organic carbon kaya hindi namarkahan ang takbo ng carbon.",
    },
    "reason.soil.diversity": {
        "en": "{n} crop families in the cycle ({families}), which breaks pest and disease build-up.",
        "fil": "{n} pamilya ng tanim sa ikot ({families}), kaya napuputol ang pagdami ng peste at sakit.",
    },
    "reason.soil.diversity.one": {
        "en": "Only one crop family in the cycle ({families}), so its pests and diseases can build up year after year.",
        "fil": "Iisang pamilya lang ng tanim sa ikot ({families}), kaya maaaring dumami taon-taon ang peste at sakit nito.",
    },
    "reason.risk.worst": {
        "en": "In its worst 20% of years ({worst_years}) the average season outcome was {worst}/100, against {mean}/100 over all {years} years.",
        "fil": "Sa pinakamahihirap na 20% ng mga taon ({worst_years}), {worst}/100 ang karaniwang resulta ng panahon, kumpara sa {mean}/100 sa lahat ng {years} taon.",
    },
    "reason.risk.failures": {
        "en": "{failed} of {total} crop-seasons replayed ended as failures (season outcome below 40).",
        "fil": "{failed} sa {total} tanim-panahong sinubok ang pumalya (resultang mas mababa sa 40).",
    },
    "reason.risk.weakest": {
        "en": "Riskiest part: {crop} in the {season} failed in {n} of {years} years, mainly from {cause} (worst year {year}).",
        "fil": "Pinakamapanganib: pumalya ang {crop} sa {season} sa {n} sa {years} taon, pangunahing dahil sa {cause} (pinakamalala noong {year}).",
    },
    "reason.risk.lowest": {
        "en": "No crop-season failed in {years} years; the weakest was {crop} in the {season} with a lowest outcome of {low}/100 in {year} ({cause}).",
        "fil": "Walang tanim-panahong pumalya sa {years} taon; pinakamahina ang {crop} sa {season} na may pinakamababang resultang {low}/100 noong {year} ({cause}).",
    },
    "reason.income.bands": {
        "en": "Relative income index {score}/100, from the income bands of its crops ({bands}) weighted by how well each did in the replay.",
        "fil": "Relatibong indeks ng kita {score}/100, mula sa antas ng kita ng mga tanim ({bands}) na tinimbang ayon sa resulta ng bawat isa sa pagsubok.",
    },
    "reason.income.fallow": {
        "en": "{n} of 6 seasons are fallow and earn nothing.",
        "fil": "{n} sa 6 na panahon ang walang tanim at walang kita.",
    },
    "reason.income.caveat": {
        "en": "This is a relative comparison between rotations - not a price, yield or profit forecast.",
        "fil": "Paghahambing lamang ito ng mga ikot-tanim - hindi hula ng presyo, ani o tubo.",
    },
    # ---- adaptive plan -------------------------------------------------------------------
    "adaptive.none": {
        "en": "No early signal separated good from bad years for {crop} in {years} years of weather. Follow the fixed plan.",
        "fil": "Walang maagang senyales na nakapaghiwalay sa maganda at masamang taon para sa {crop} sa {years} taon ng panahon. Sundin ang nakatakdang plano.",
    },
    "adaptive.not_robust": {
        "en": "A switch from {crop} to {alt} looked useful in hindsight (+{gain} points) but did not hold up when tested on years it had not seen ({cv:+.1f}). Follow the fixed plan.",
        "fil": "Mukhang nakatulong ang paglipat mula {crop} patungong {alt} kung babalikan (+{gain} puntos) pero hindi ito tumibay nang subukin sa mga taong hindi pa nakikita ({cv:+.1f}). Sundin ang nakatakdang plano.",
    },
    "adaptive.rule": {
        "en": "Check on {date}: if {indicator} is {relation} {threshold} {unit}, plant {alt} instead of {crop}. Otherwise plant {crop} as planned.",
        "fil": "Suriin sa {date}: kung ang {indicator} ay {relation} {threshold} {unit}, magtanim ng {alt} sa halip na {crop}. Kung hindi, ituloy ang {crop} ayon sa plano.",
    },
    "adaptive.evidence": {
        "en": "In {n} of {years} years the {indicator} was {relation} {threshold} {unit}. In those years the season value of {crop} averaged {planned_bad}/100 and {alt} averaged {alt_bad}/100; in the other years {crop} averaged {planned_good}/100. Tested on years left out of the search, the rule gained {cv:+.1f} points on average. (Season value = season outcome, water fit and income band, weighted by your priorities.)",
        "fil": "Sa {n} sa {years} taon, ang {indicator} ay {relation} {threshold} {unit}. Sa mga taong iyon, {planned_bad}/100 ang karaniwang halaga ng panahon ng {crop} at {alt_bad}/100 ang {alt}; sa ibang taon, {planned_good}/100 ang {crop}. Nang subukin sa mga taong hindi isinama sa paghahanap, {cv:+.1f} puntos ang karaniwang dagdag ng tuntunin. (Halaga ng panahon = resulta ng panahon, akma sa tubig at antas ng kita, tinimbang ayon sa iyong prayoridad.)",
    },
    "adaptive.summary": {
        "en": "{rules} decision point(s). Replayed over {years} years with honest (leave-one-year-out) testing, the adaptive plan changes the average season value by {gain:+.1f} points and the worst-20%-of-years value by {worst:+.1f} points; failed crop-seasons go from {failed_fixed} to {failed_adaptive}.",
        "fil": "{rules} (na) punto ng pagpapasya. Nang subukin sa {years} taon gamit ang tapat na pagsusuri (isang taon ang iniiwan sa bawat ulit), binago ng adaptive na plano ang karaniwang halaga ng panahon nang {gain:+.1f} puntos at ang halaga sa pinakamahihirap na 20% ng taon nang {worst:+.1f} puntos; ang mga pumalyang tanim-panahon ay mula {failed_fixed} naging {failed_adaptive}.",
    },
    "adaptive.summary.none": {
        "en": "No decision point passed the honesty test over {years} years, so this rotation is best followed as a fixed plan. That is a real finding: early-season signals did not reliably tell good years from bad ones here.",
        "fil": "Walang punto ng pagpapasya ang pumasa sa tapat na pagsusuri sa {years} taon, kaya pinakamainam sundin ang ikot na ito bilang nakatakdang plano. Tunay na natuklasan ito: hindi mapagkakatiwalaang nasabi ng maagang senyales kung maganda o masama ang taon dito.",
    },
    # ---- flash drought -------------------------------------------------------------------
    "drought.level.normal": {"en": "No drought warning", "fil": "Walang babala ng tagtuyot"},
    "drought.level.watch": {"en": "Drought watch: keep an eye on soil moisture", "fil": "Bantay-tagtuyot: subaybayan ang basa ng lupa"},
    "drought.level.warning": {"en": "Drought warning: the field is drying quickly", "fil": "Babala ng tagtuyot: mabilis na natutuyo ang bukid"},
    "drought.level.alert": {"en": "Flash-drought alert: act now to protect the crop", "fil": "Alerto ng biglaang tagtuyot: kumilos na para maprotektahan ang tanim"},
    "drought.pct_low": {
        "en": "Root-zone wetness is at the {pct}th percentile for this time of year (drier than {dry}% of past years).",
        "fil": "Ang basa ng lupa sa ugat ay nasa ika-{pct} percentile para sa panahong ito (mas tuyo kaysa {dry}% ng mga nakaraang taon).",
    },
    "drought.pct_lowish": {
        "en": "Root-zone wetness is at the {pct}th percentile for this time of year - on the dry side.",
        "fil": "Ang basa ng lupa sa ugat ay nasa ika-{pct} percentile para sa panahong ito - medyo tuyo.",
    },
    "drought.flash": {
        "en": "Flash-drought pattern: wetness fell from the {start}th to the {now}th percentile within {days} days.",
        "fil": "Padron ng biglaang tagtuyot: bumagsak ang basa mula ika-{start} hanggang ika-{now} percentile sa loob ng {days} araw.",
    },
    "drought.falling": {
        "en": "Wetness dropped {drop} percentile points in {days} days.",
        "fil": "Bumaba ang basa nang {drop} percentile points sa loob ng {days} araw.",
    },
    "drought.no_wetness": {
        "en": "No root-zone wetness data is available, so the percentile signal is unavailable.",
        "fil": "Walang datos ng basa ng lupa sa ugat, kaya hindi magagamit ang senyales na percentile.",
    },
    "drought.esi_low": {
        "en": "Evaporative stress index is {value} (below 0.5 means plants get less than half the water the air demands).",
        "fil": "Ang evaporative stress index ay {value} (kapag mas mababa sa 0.5, wala pang kalahati ng hinihinging tubig ang nakukuha ng halaman).",
    },
    "drought.esi_falling": {
        "en": "Evaporative stress index fell by {drop} over the last two weeks.",
        "fil": "Bumaba ang evaporative stress index nang {drop} sa nakaraang dalawang linggo.",
    },
    "drought.canopy_hot": {
        "en": "The surface is unusually warm relative to the air ({z} standard deviations above normal), a sign of reduced evaporative cooling.",
        "fil": "Di-karaniwang mainit ang ibabaw kumpara sa hangin ({z} standard deviation na mas mataas sa normal), tanda ng humihinang paglamig mula sa pagsingaw.",
    },
    "drought.canopy_hot_abs": {
        "en": "Canopy is {value} C warmer than the air, a sign of water stress.",
        "fil": "Mas mainit nang {value} C ang dahon kaysa hangin, tanda ng kakulangan sa tubig.",
    },
    "drought.normal": {
        "en": "Soil moisture, evaporative stress and surface temperature are all within the normal range for this time of year.",
        "fil": "Nasa karaniwang saklaw para sa panahong ito ang basa ng lupa, evaporative stress at temperatura ng ibabaw.",
    },
    # ---- soil projection / irrigation ----------------------------------------------------
    "soilproj.label": {
        "en": "Illustrative projection - shows direction and rough size of change, not a forecast.",
        "fil": "Halimbawang projection - ipinapakita ang direksyon at tinatayang laki ng pagbabago, hindi hula.",
    },
    "soilproj.assume.model": {
        "en": "One-pool model: each year {h}% of the carbon in returned residues becomes soil organic carbon, and a fixed share of the existing carbon decays.",
        "fil": "Simpleng modelo: kada taon, {h}% ng carbon sa ibinalik na dayami ang nagiging organic carbon ng lupa, at may takdang bahagi ng dating carbon ang nabubulok.",
    },
    "soilproj.assume.decay": {
        "en": "Decay rate {k}% per year ({how}).",
        "fil": "Bilis ng pagkabulok {k}% kada taon ({how}).",
    },
    "soilproj.decay.default": {"en": "default value: no starting carbon available", "fil": "default: walang panimulang carbon"},
    "soilproj.decay.calibrated": {
        "en": "calibrated so that soil carbon is stable under your current rotation",
        "fil": "itinugma para manatiling pantay ang carbon ng lupa sa kasalukuyan mong ikot",
    },
    "soilproj.decay.calibrated-bounded": {
        "en": "calibrated to your current rotation, then limited to a plausible range",
        "fil": "itinugma sa kasalukuyan mong ikot, saka nilimitahan sa makatwirang saklaw",
    },
    "soilproj.assume.residue": {
        "en": "Assumes crop residues stay on the field (not burned or removed).",
        "fil": "Ipinagpapalagay na naiiwan sa bukid ang dayami at tira ng tanim (hindi sinusunog o inaalis).",
    },
    "soilproj.assume.n": {
        "en": "Nitrogen figures are crop demand minus legume credits; they ignore soil supply, manure and losses.",
        "fil": "Ang nitroheno ay pangangailangan ng tanim bawas ang ambag ng legumbre; hindi kasama ang galing sa lupa, dumi ng hayop at mga nawawala.",
    },
    "irrigation.note": {
        "en": "Net need = water to keep the crop unstressed beyond rain and stored soil water. Gross = net divided by {eff}% field efficiency (surface irrigation). P80 = need exceeded in only 1 year in 5.",
        "fil": "Net na kailangan = tubig para hindi mauhaw ang tanim bukod sa ulan at naimbak na tubig sa lupa. Gross = net hinati sa {eff}% na bisa sa bukid (surface irrigation). P80 = nalalampasan lang sa 1 sa bawat 5 taon.",
    },
    # ---- why it lost ---------------------------------------------------------------------
    "whylost.summary": {
        "en": "{name} is {behind} points behind the winner. It trails most on {weakest} (-{weak_delta}) and leads on {strongest} (+{strong_delta}).",
        "fil": "{behind} puntos ang agwat ng {name} sa nangunguna. Pinakamalaki ang lamang sa kanya sa {weakest} (-{weak_delta}) at lamang naman ito sa {strongest} (+{strong_delta}).",
    },
    "whylost.summary.behind": {
        "en": "{name} is {behind} points behind the winner and does not beat it on any of the four criteria; its biggest gap is {weakest} (-{weak_delta}).",
        "fil": "{behind} puntos ang agwat ng {name} sa nangunguna at hindi ito lamang sa alinman sa apat na pamantayan; pinakamalaki ang agwat sa {weakest} (-{weak_delta}).",
    },
    "whylost.dominated": {
        "en": "No change of priorities can make {name} win: the winner is at least as good on all four criteria.",
        "fil": "Walang pagbabago ng prayoridad na magpapanalo sa {name}: kasinggaling o mas magaling ang nangunguna sa lahat ng apat na pamantayan.",
    },
    "whylost.priority": {
        "en": "{name} would win if {criterion} mattered more to you: raise its weight from {old}% to {new}% (checked against the {pool} leading candidates).",
        "fil": "Mananalo ang {name} kung mas mahalaga sa iyo ang {criterion}: itaas ang timbang nito mula {old}% hanggang {new}% (sinuri laban sa {pool} nangungunang kandidato).",
    },
    "whylost.priority.none": {
        "en": "No shift of weight toward a single criterion makes {name} the overall winner.",
        "fil": "Walang paglipat ng timbang sa iisang pamantayan ang magpapanalo sa {name}.",
    },
    "whylost.rain.less": {
        "en": "{name} would lead this shortlist if every season had {pct}% less rain.",
        "fil": "Mangunguna ang {name} sa listahang ito kung {pct}% na mas kaunti ang ulan sa bawat panahon.",
    },
    "whylost.rain.more": {
        "en": "{name} would lead this shortlist if every season had {pct}% more rain.",
        "fil": "Mangunguna ang {name} sa listahang ito kung {pct}% na mas marami ang ulan sa bawat panahon.",
    },
    "whylost.rain.none": {
        "en": "No rainfall change between -50% and +50% makes {name} lead this shortlist.",
        "fil": "Walang pagbabago sa ulan mula -50% hanggang +50% ang magpapauna sa {name} sa listahang ito.",
    },
    # ---- backtest ------------------------------------------------------------------------
    "backtest.method": {
        "en": "For each season since 2001: the engine's water satisfaction for a generic rain-fed crop (sowing to {days} days) compared with the MODIS NDVI anomaly over the same days.",
        "fil": "Sa bawat panahon mula 2001: inihambing ang tantiya ng engine sa natugunang tubig ng karaniwang tanim na umaasa sa ulan (mula pagtatanim hanggang {days} araw) sa NDVI anomaly ng MODIS sa parehong mga araw.",
    },
    "backtest.unavailable": {
        "en": "MODIS NDVI is not available for this location yet, so no backtest could be run.",
        "fil": "Wala pang MODIS NDVI para sa lokasyong ito kaya hindi naisagawa ang backtest.",
    },
    "backtest.too_few": {
        "en": "Only {n} seasons have both NDVI and weather; at least {need} are needed.",
        "fil": "{n} panahon lang ang may parehong NDVI at datos ng panahon; kailangan ng hindi bababa sa {need}.",
    },
    "backtest.no_variation": {
        "en": "The engine estimates no water stress in any {season}, so there is nothing to compare with NDVI.",
        "fil": "Walang tinatayang kakulangan sa tubig ang engine sa alinmang {season}, kaya walang maihahambing sa NDVI.",
    },
    "backtest.result.none": {
        "en": "{season}: no statistically significant relationship (r = {r}, p = {p}, n = {n}). The engine's water-stress estimate is NOT confirmed by satellite greenness here.",
        "fil": "{season}: walang makabuluhang ugnayan sa estadistika (r = {r}, p = {p}, n = {n}). HINDI napatunayan ng satellite ang tantiya ng engine sa kakulangan ng tubig dito.",
    },
    "backtest.result.weak": {
        "en": "{season}: weak but significant agreement (r = {r}, p = {p}, n = {n}). Drier model seasons were somewhat browner in the satellite record.",
        "fil": "{season}: mahina pero makabuluhang pagkakatugma (r = {r}, p = {p}, n = {n}). Medyo mas kayumanggi sa satellite ang mga panahong tuyo sa modelo.",
    },
    "backtest.result.moderate": {
        "en": "{season}: moderate agreement (r = {r}, p = {p}, n = {n}). Drier model seasons were browner in the satellite record.",
        "fil": "{season}: katamtamang pagkakatugma (r = {r}, p = {p}, n = {n}). Mas kayumanggi sa satellite ang mga panahong tuyo sa modelo.",
    },
    "backtest.result.strong": {
        "en": "{season}: strong agreement (r = {r}, p = {p}, n = {n}). Drier model seasons were clearly browner in the satellite record.",
        "fil": "{season}: malakas na pagkakatugma (r = {r}, p = {p}, n = {n}). Malinaw na mas kayumanggi sa satellite ang mga panahong tuyo sa modelo.",
    },
    "backtest.result.wrong_sign": {
        "en": "{season}: the relationship is significant but in the WRONG direction (r = {r}, p = {p}, n = {n}): drier model seasons were greener. Treat the water-stress estimate for this season with caution.",
        "fil": "{season}: makabuluhan ang ugnayan pero BALIKTAD ang direksyon (r = {r}, p = {p}, n = {n}): mas luntian ang mga panahong tuyo sa modelo. Mag-ingat sa tantiya ng kakulangan sa tubig sa panahong ito.",
    },
    "backtest.intensity": {
        "en": "NDVI shows a median of {cycles} green-up cycle(s) per year around the pin, with two or more in {share}% of {years} years. This hints at how often the land is cropped; it does not identify the crop.",
        "fil": "Ipinapakita ng NDVI ang median na {cycles} ikot ng paglunti kada taon sa paligid ng pin, at dalawa o higit pa sa {share}% ng {years} taon. Pahiwatig ito kung gaano kadalas tinataniman ang lupa; hindi nito tinutukoy ang tanim.",
    },
    "backtest.caveat.1": {
        "en": "NDVI is the median of a ~2 km box of 250 m pixels: it mixes many fields, trees, roads and houses, not just this farm.",
        "fil": "Ang NDVI ay median ng ~2 km na kahon ng 250 m na pixel: halo ito ng maraming bukid, puno, kalsada at bahay, hindi lang ang bukid na ito.",
    },
    "backtest.caveat.2": {
        "en": "Irrigated fields nearby stay green in dry years, which hides rain-driven stress.",
        "fil": "Nananatiling luntian ang mga kalapit na may patubig kahit tuyo ang taon, kaya natatago ang epekto ng kulang na ulan.",
    },
    "backtest.caveat.3": {
        "en": "Weather comes from a ~55 km grid cell; NDVI from a 2 km box. They do not describe the same area.",
        "fil": "Galing ang panahon sa ~55 km na grid cell; ang NDVI ay sa 2 km na kahon. Hindi magkapareho ang lawak na inilalarawan nila.",
    },
    "backtest.caveat.4": {
        "en": "With about 25 seasons, only strong relationships can be detected; a non-significant result does not prove the model wrong.",
        "fil": "Sa mga 25 panahon lang, malalakas na ugnayan lang ang matutuklasan; ang resultang hindi makabuluhan ay hindi patunay na mali ang modelo.",
    },
    "backtest.caveat.5": {
        "en": "Greenness is not yield. This checks one ingredient of the engine (moisture stress), not the rotation scores.",
        "fil": "Ang pagiging luntian ay hindi ani. Sinusuri nito ang isang sangkap ng engine (kakulangan sa tubig), hindi ang mga iskor ng ikot-tanim.",
    },
    # ---- rule violations of the current rotation -----------------------------------------
    "rule.family_gap": {
        "en": "{family} crops come back too soon ({distance} season(s) apart; this family needs at least {required}).",
        "fil": "Masyadong maagang bumabalik ang mga tanim na {family} ({distance} panahon lang ang pagitan; kailangan ng hindi bababa sa {required}).",
    },
    "rule.legume": {
        "en": "No nitrogen-fixing legume anywhere in the 3-year cycle.",
        "fil": "Walang legumbre na nag-iipon ng nitroheno sa buong 3-taong ikot.",
    },
    "rule.taproot": {
        "en": "Compaction is suspected but no deep-taprooted crop is in the cycle.",
        "fil": "Hinihinalang siksik ang lupa pero walang tanim na malalim ang ugat sa ikot.",
    },
    "rule.main_season_cropped": {
        "en": "The main season is left without a crop.",
        "fil": "Walang tanim sa pangunahing panahon.",
    },
    # ---- information gaps ----------------------------------------------------------------
    "gap.salinity": {
        "en": "Soil salinity is unknown (no map provides it). Crops were not filtered for salt; enter an EC test result if salinity is a concern.",
        "fil": "Hindi alam ang alat ng lupa (walang mapang nagbibigay nito). Hindi nasala ang mga tanim ayon sa alat; ilagay ang resulta ng EC test kung may alalahanin.",
    },
    "gap.soil_unavailable": {
        "en": "SoilGrids could not be reached for this point: {reason}. Soil values not entered by the farmer are unavailable.",
        "fil": "Hindi naabot ang SoilGrids para sa lugar na ito: {reason}. Walang halaga ang mga katangian ng lupang hindi inilagay ng magsasaka.",
    },
    "gap.texture_assumed": {
        "en": "Soil texture is unknown, so a loam was ASSUMED for the water balance. Enter your soil texture for a result you can rely on.",
        "fil": "Hindi alam ang uri ng lupa kaya IPINAGPALAGAY na loam para sa kuwenta ng tubig. Ilagay ang uri ng iyong lupa para sa resultang maaasahan.",
    },
    "gap.soil_modelled": {
        "en": "Soil values come from the SoilGrids 250 m map (a model, not a test of this field). A soil test would replace them.",
        "fil": "Galing ang mga halaga ng lupa sa mapang SoilGrids na 250 m (modelo, hindi pagsusuri ng bukid na ito). Mapapalitan ito ng soil test.",
    },
    "gap.drainage_assumed": {
        "en": "Field drainage was not given; '{drainage}' was assumed from the {texture} texture. It strongly affects which wet-season crops survive.",
        "fil": "Hindi ibinigay ang drainage ng bukid; ipinagpalagay na '{drainage}' batay sa lupang {texture}. Malaki ang epekto nito sa kung aling tanim ang mabubuhay sa tag-ulan.",
    },
    "gap.smap": {
        "en": "SMAP L4 soil moisture unavailable ({reason}); NASA POWER root-zone wetness (modelled, ~55 km) is used instead.",
        "fil": "Walang SMAP L4 na basa ng lupa ({reason}); ginamit ang NASA POWER root-zone wetness (modelo, ~55 km).",
    },
    "gap.ecostress": {
        "en": "ECOSTRESS unavailable ({reason}); the drought stress index is derived from NASA POWER instead (modelled).",
        "fil": "Walang ECOSTRESS ({reason}); kinuha ang drought stress index mula sa NASA POWER (modelo).",
    },
    "gap.modis": {
        "en": "MODIS NDVI unavailable ({reason}); no backtest against observed greenness.",
        "fil": "Walang MODIS NDVI ({reason}); walang backtest laban sa naobserbahang pagkaluntian.",
    },
    "gap.power_resolution": {
        "en": "Weather is a ~55 km grid-cell average (NASA POWER), not a station on the farm: local rainfall, storms and hot days can differ, and grid rainfall totals can be biased.",
        "fil": "Ang panahon ay average ng ~55 km na grid cell (NASA POWER), hindi istasyon sa bukid: maaaring iba ang lokal na ulan, bagyo at init, at maaaring may kiling ang kabuuang ulan ng grid.",
    },
    "gap.excluded_years": {
        "en": "Years left out of the replay because the weather record is incomplete: {years}.",
        "fil": "Mga taong hindi isinama sa pagsubok dahil kulang ang datos ng panahon: {years}.",
    },
    "gap.prefilter": {
        "en": "{enumerated} valid rotations were enumerated; the best {replayed} by average weighted score went through the year-by-year replay.",
        "fil": "{enumerated} wastong ikot-tanim ang nailista; ang pinakamahusay na {replayed} ayon sa average na iskor ang dumaan sa taon-taong pagsubok.",
    },
    "gap.current_infeasible": {
        "en": "Your current rotation includes {crop} in the {season}, which failed the feasibility filter: {why}",
        "fil": "Kasama sa kasalukuyan mong ikot ang {crop} sa {season}, na hindi pumasa sa pagsala: {why}",
    },
    "gap.income": {
        "en": "Income bands are a rough 0-5 ranking by the team, not market prices. Local prices, input costs and labour are not modelled.",
        "fil": "Ang antas ng kita ay tinatayang 0-5 na ranggo ng team, hindi presyo sa merkado. Hindi kasama ang lokal na presyo, gastos at paggawa.",
    },
    "gap.pests": {
        "en": "Pests, diseases, typhoon tracks, flooding from rivers and market shocks are not modelled.",
        "fil": "Hindi kasama sa modelo ang peste, sakit, daan ng bagyo, baha mula sa ilog at biglaang pagbabago sa merkado.",
    },
    "gap.et0_fallback": {
        "en": "ET0 used the temperature-only Hargreaves method on {days} day(s) with missing humidity, wind or radiation.",
        "fil": "Ginamit ang Hargreaves (temperatura lang) para sa ET0 sa {days} araw na kulang ang humidity, hangin o radiation.",
    },
    "gap.gapfill": {
        "en": "{n} missing daily value(s) in short gaps were linearly interpolated: {detail}.",
        "fil": "{n} nawawalang arawang halaga sa maiikling puwang ang pinunan sa pamamagitan ng linear interpolation: {detail}.",
    },
    "plan.name.current": {"en": "Current rotation", "fil": "Kasalukuyang ikot"},
    "plan.name.option": {"en": "Option {letter}", "fil": "Opsyon {letter}"},
    # ---- rule-based advisor --------------------------------------------------------------
    "advisor.fallback_note": {
        "en": "(Answered from the plan data by the built-in rule-based advisor.)",
        "fil": "(Sinagot mula sa datos ng plano ng built-in na rule-based advisor.)",
    },
    "advisor.no_plan": {
        "en": "I do not have a plan to work from yet. Set up the farm and run the plan first, then ask me about it.",
        "fil": "Wala pa akong planong mapagbabatayan. I-set up muna ang bukid at patakbuhin ang plano, saka ako tanungin.",
    },
    "advisor.best": {
        "en": "The top-ranked rotation is {name}: {slots}. Overall score {overall}/100 (average over {years} years), {worst}/100 in its worst 20% of years, and it beat your current rotation in {win}% of years.",
        "fil": "Ang nangungunang ikot-tanim ay {name}: {slots}. Kabuuang iskor {overall}/100 (average sa {years} taon), {worst}/100 sa pinakamahihirap na 20% ng taon, at tinalo nito ang kasalukuyan mong ikot sa {win}% ng mga taon.",
    },
    "advisor.compare": {
        "en": "Your current rotation scores {cur}/100 against {best}/100 for {name}. The biggest differences: {diffs}.",
        "fil": "Ang kasalukuyan mong ikot ay may iskor na {cur}/100 laban sa {best}/100 ng {name}. Pinakamalaking pagkakaiba: {diffs}.",
    },
    "advisor.adaptive": {
        "en": "Decision points for {name}: {rules}",
        "fil": "Mga punto ng pagpapasya para sa {name}: {rules}",
    },
    "advisor.adaptive.none": {
        "en": "{name} has no decision point that passed the honesty test, so follow it as a fixed plan.",
        "fil": "Walang punto ng pagpapasya ang {name} na pumasa sa tapat na pagsusuri, kaya sundin ito bilang nakatakdang plano.",
    },
    "advisor.water": {
        "en": "{name} needs about {net} m3/ha of irrigation per year on average to keep every crop unstressed ({p80} m3/ha in a dry year, 1 in 5). With your water source ({source}) it scored {water}/100 on water fit.",
        "fil": "Kailangan ng {name} ng mga {net} m3/ha na patubig kada taon para hindi mauhaw ang bawat tanim ({p80} m3/ha sa tuyong taon, 1 sa 5). Sa pinagkukunan mo ng tubig ({source}), {water}/100 ang iskor nito sa akma sa tubig.",
    },
    "advisor.soil": {
        "en": "{name} scores {soil}/100 on soil health: {detail}",
        "fil": "{soil}/100 ang iskor ng {name} sa kalusugan ng lupa: {detail}",
    },
    "advisor.risk": {
        "en": "{name}: {detail} Its worst years in the replay were {years}.",
        "fil": "{name}: {detail} Pinakamahihirap na taon nito sa pagsubok: {years}.",
    },
    "advisor.income": {
        "en": "{name} scores {income}/100 on the relative income index. {detail}",
        "fil": "{income}/100 ang iskor ng {name} sa relatibong indeks ng kita. {detail}",
    },
    "advisor.drought": {
        "en": "Current drought status: {headline}. {reasons}",
        "fil": "Kasalukuyang kalagayan ng tagtuyot: {headline}. {reasons}",
    },
    "advisor.data": {
        "en": "Data used: {sources}. Known gaps: {gaps}",
        "fil": "Datos na ginamit: {sources}. Mga kilalang kakulangan: {gaps}",
    },
    "advisor.why": {
        "en": "{text} {priority} {rain}",
        "fil": "{text} {priority} {rain}",
    },
    "advisor.year": {
        "en": "In {year}, {name} scored {score}/100 (season outcome {performance}/100). {detail}",
        "fil": "Noong {year}, {score}/100 ang iskor ng {name} (resulta ng panahon {performance}/100). {detail}",
    },
    "advisor.year.bad": {
        "en": "It was a bad year for this plan: {failed} crop-season(s) failed.",
        "fil": "Masamang taon ito para sa plano: {failed} tanim-panahon ang pumalya.",
    },
    "advisor.year.ok": {"en": "No crop-season failed that year.", "fil": "Walang tanim-panahong pumalya noong taong iyon."},
    "advisor.help": {
        "en": "I can answer from your plan: which rotation is best and why, how it compares with your current one, the decision points, water and irrigation, soil health, risk and bad years, income, why another option lost, the drought status and what data was used.",
        "fil": "Makakasagot ako mula sa iyong plano: aling ikot-tanim ang pinakamahusay at bakit, paghahambing sa kasalukuyan, mga punto ng pagpapasya, tubig at patubig, kalusugan ng lupa, panganib at masasamang taon, kita, bakit natalo ang ibang opsyon, kalagayan ng tagtuyot at anong datos ang ginamit.",
    },
}


def t(lang: str, key: str, **values) -> str:
    """Render message ``key`` in ``lang`` (falls back to English, then to the key itself)."""
    entry = MESSAGES.get(key)
    if entry is None:
        return key
    template = entry.get(lang) or entry.get("en") or key
    try:
        return template.format(**values)
    except (KeyError, IndexError, ValueError):
        return template
