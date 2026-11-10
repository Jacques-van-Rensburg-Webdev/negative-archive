// Generated from docs/darkroom-timer-spec.md: agitation presets, developers, baths and sources.

export const PRESETS = {
  ilford: {"first": 10, "label": "Invert 4×", "every": 60, "dur": 10},
  kodak: {"first": 5, "label": "Invert 5–7×", "every": 30, "dur": 5},
  foma: {"first": 30, "label": "Agitate", "every": 60, "dur": 10},
  rotary: {"continuous": true, "label": "Agitate continuously"},
  fix: {"first": 30, "label": "Agitate", "every": 60, "dur": 10},
  once: {"first": 15, "label": "Agitate gently"},
  stand: {"first": 30, "label": "Agitate gently", "mid": true},
  caffenol: {"first": 30, "label": "Invert", "every": 20, "dur": 3},
  df96i: {"first": 30, "label": "Agitate", "every": 60, "dur": 10},
  df96m: {"first": 10, "label": "Agitate gently", "every": 60, "dur": 5},
  c41k: {"first": 30, "label": "Agitate", "every": 15, "dur": 2},
  cs: {"first": 10, "label": "Invert 4×", "every": 30, "dur": 5},
  tet41: {"first": 15, "label": "Invert once", "every": 30, "dur": 3},
  tetE6: {"first": 15, "label": "Invert once", "every": 15, "dur": 3},
};

export const DEVELOPERS = [
  ["d76", "Kodak D-76 stock"],
  ["d76h", "Kodak D-76 1+1"],
  ["id11", "Ilford ID-11 stock"],
  ["id11h", "Ilford ID-11 1+1"],
  ["xtol", "Kodak XTOL stock"],
  ["xtolh", "Kodak XTOL 1+1"],
  ["tmax", "Kodak T-Max Developer 1+4"],
  ["hc110b", "Kodak HC-110 dil. B (1+31)"],
  ["hc110h", "Kodak HC-110 dil. H (1+63)"],
  ["ilfotec", "Ilford Ilfotec HC 1+31"],
  ["lc29", "Ilford Ilfotec LC29 1+19"],
  ["ddx", "Ilford Ilfotec DD-X 1+4"],
  ["ilfosol", "Ilford Ilfosol 3 1+9"],
  ["microphen", "Ilford Microphen stock"],
  ["perceptol", "Ilford Perceptol stock"],
  ["rod25", "Rodinal / Adonal / Fomadon R09 1+25"],
  ["rod50", "Rodinal / Adonal / Fomadon R09 1+50"],
  ["rod100", "Rodinal / Adonal 1+100 semi-stand"],
  ["df96", "CineStill Df96 monobath"],
  ["caffenol", "Caffenol-C-M"],
  ["custom", "Other developer (user enters time)"],
];

export const BATHS = {
  "Stop": [
    {"label": "Ilford Ilfostop 1+19", "normal": 10, "tgrain": 10, "note": "10 s", "source": "Ilford datasheets"},
    {"label": "Kodak Indicator Stop Bath 1+63", "normal": 30, "tgrain": 30, "note": "30 s", "source": "Kodak F-4017, E-103CF"},
    {"label": "Running water rinse", "normal": 60, "tgrain": 60, "note": "For alkaline fixers", "source": "Formulary TF-4/TF-5"},
  ],
  "Fixer": [
    {"label": "Ilford Rapid Fixer 1+4", "normal": 300, "tgrain": 300, "note": "2–5 min; longer end for Delta", "source": "Ilford Rapid Fixer"},
    {"label": "Ilford Hypam 1+4", "normal": 300, "tgrain": 300, "note": "2–5 min", "source": "Ilford HP5 Plus"},
    {"label": "Kodak Professional Rapid Fixer", "normal": 240, "tgrain": 300, "note": "Tri-X 2–4, T-Max 3–5 min", "source": "Kodak F-4017, T-Max 400"},
    {"label": "Kodak Kodafix 1+3", "normal": 240, "tgrain": 600, "note": "Tri-X 2–4, T-Max 5–10 min", "source": "Kodak F-4017, T-Max 400"},
    {"label": "Formulary TF-4 (alkaline)", "normal": 240, "tgrain": 360, "note": "3–4 min, T-Max 6 min", "source": "Formulary TF-4"},
    {"label": "Formulary TF-5 (alkaline)", "normal": 240, "tgrain": 360, "note": "3–4 min, T-Max 6 min", "source": "Formulary TF-5"},
    {"label": "Adox Adofix P II (used as mixed)", "normal": 240, "tgrain": 300, "note": "4 min film; no further dilution", "source": "Adox (retailer listings)"},
    {"label": "Adox Adofix Plus 1+4", "normal": 300, "tgrain": 300, "note": "Time from the bottle; 5 min to be safe", "source": ""},
  ],
  "Hypo clear": [
    {"label": "None", "normal": null, "tgrain": null, "note": "", "source": ""},
    {"label": "Kodak Hypo Clearing Agent", "normal": 120, "tgrain": 120, "note": "1–2 min, then 5 min wash", "source": "Kodak F-4017"},
  ],
  "Wetting": [
    {"label": "Kodak Photo-Flo 200 (1+200)", "normal": 30, "tgrain": 30, "note": "1+200, 30 s", "source": "Kodak E-103CF"},
    {"label": "Ilford Ilfotol (1+200)", "normal": 30, "tgrain": 30, "note": "5 ml/L; Ilford gives no time", "source": "Ilford Delta 100"},
    {"label": "Adox Adoflo II (1+200)", "normal": 30, "tgrain": 30, "note": "5 ml/L; use the dilution up within days", "source": "Adox"},
    {"label": "Distilled water rinse", "normal": 60, "tgrain": 60, "note": "Prevents water spots", "source": ""},
    {"label": "None", "normal": null, "tgrain": null, "note": "", "source": ""},
  ],
};

export const SOURCES = [
  ["Ilford/Harman", [["HP5 Plus", "https://ilfordphoto.com/amfile/file/download/file/1903/product/691"], ["FP4 Plus", "https://www.ilfordphoto.com/amfile/file/download/file/1919/product/687"], ["Delta 100", "https://www.chrysis.net/wp-content/uploads/2020/08/DELTA-100-datasheet.pdf"], ["Delta 400", "https://ilfordphoto.com/amfile/file/download/file/1915/product/424"], ["Delta 3200 (2025)", "https://www.ilfordphoto.com/amfile/file/download/file/1913/product/682"], ["older Delta 3200 sheet", "https://stuff.mit.edu/afs/sipb.mit.edu/user/bert/debug/root/mit/gamadrid/delta3200.pdf"], ["Pan F Plus (2010)", "https://www.freestylephoto.com/pdf/product_pdfs/ilford/Ilford_PanF.pdf"], ["Ilfotec DD-X", "https://www.ilfordphoto.com/amfile/file/download/file/1950/product/545/"], ["Ilfosol 3", "https://www.ilfordphoto.com/amfile/file/download/file/572/product/542"], ["Rapid Fixer", "https://www.physics.wisc.edu/instructional/phys109/yoshi/Photography_Lab/ILFORD_Info/ILFORD_Rapid_Fixer.pdf"]]],
  ["Kodak", [["Tri-X F-4017", "https://kodakprofessional.com/sites/default/files/wysiwyg/film/f4017_trix_320400.pdf"], ["T-Max 400", "https://www.freestylephoto.com/pdf/product_pdfs/kodak/Kodak_Tmax400.pdf"], ["T-Max 100 F-4016 (2002)", "https://125px.com/docs/unsorted/kodak/f4016.pdf"], ["HC-110 J-24", "https://www.freestylephoto.com/pdf/product_pdfs/kodak/KodakHC110.pdf"], ["B&W chemicals E-103CF", "https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/E103CF_0.pdf"], ["Flexicolor Z-131", "https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/z131.pdf"], ["E-6 Z-119", "https://125px.com/docs/unsorted/kodak/z119-3.pdf"], ["ECN-2 kit chemicals", "https://www.kodak.com/content/pdfs/Using-KODAK-Kit-Chemicals-in-Motion-Picture-Film-Laboratories.pdf"]]],
  ["Foma", [["Fomapan 100", "https://cdn.shopify.com/s/files/1/1273/8933/files/Foma-100.pdf"], ["Fomapan 400", "https://www.freestylephoto.com/static/pdf/product_pdfs/foma/Fomapan_400.pdf"]]],
  ["Agfa", [["Rodinal times", "https://125px.com/docs/techpubs/agfa/Rodinal-times.pdf"]]],
  ["Kits", [["CineStill Cs41", "https://www.photrio.com/forum/attachments/cinestill-c-41-kit-pdf.325882/"], ["CineStill Cs2", "https://cdn.shopify.com/s/files/1/0339/5113/files/Cs2_powder_instructions.pdf"], ["CineStill Df96", "https://www.freestylephoto.com/static/pdf/product_pdf/3m/DF96_instructions.pdf"], ["Tetenal Colortec C-41", "https://www.macodirect.de/media/pdf/e5/45/cf/RC11K_Bedienungsanleitung_e.pdf"], ["Tetenal Colortec E-6", "https://parallaxphotographic.coop/wp-content/uploads/2021/06/Tetenal-Colortec-E6-3-Bath-Instruction-EN.pdf"], ["Flic Film C-41", "https://www.freestylephoto.com/static/pdf/product_pdf/flicfilm/C-41-1-LITRE-KIT-INSTRUCTIONS-ENGLISH.pdf"], ["Flic Film ECN-2", "https://www.freestylephoto.com/static/pdf/product_pdf/flicfilm/FLIC_FILM_ECN-2_5_LITER_INSTRUCTIONS.pdf"], ["Formulary TF-4", "https://www.digitaltruth.com/products/photoformulary_tech/Formulary%20TF-4%20Fixer%20[03-0141].pdf"], ["Formulary TF-5", "https://www.freestylephoto.com/static/pdf/product_pdf/formulary/Photographer's_Formulary_TF-5_Rapid_Fixer_Instructions.pdf"], ["Caffenol-C-M recipe", "https://caffenol.blogspot.com/2010/03/caffenol-c-m-recipe.html"]]],
];
