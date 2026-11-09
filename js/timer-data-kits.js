// Generated from docs/darkroom-timer-spec.md: colour films and kits. Do not edit times by hand.

export const COLOUR_FILMS = {
  "c41": [
    "Kodak Portra 160",
    "Kodak Portra 400",
    "Kodak Portra 800",
    "Kodak Ektar 100",
    "Kodak Gold 200",
    "Kodak Ultramax 400",
    "Kodak ColorPlus 200",
    "Fujifilm 400",
    "CineStill 800T",
    "CineStill 400D",
    "Lomography Color 400",
    "Ilford XP2 Super (B&W C-41)",
    "Other C-41 film"
  ],
  "e6": [
    "Kodak Ektachrome E100",
    "Fujifilm Velvia 50",
    "Fujifilm Velvia 100",
    "Fujifilm Provia 100F",
    "Other E-6 film"
  ],
  "ecn2": [
    "Kodak Vision3 50D",
    "Kodak Vision3 250D",
    "Kodak Vision3 200T",
    "Kodak Vision3 500T",
    "Other ECN-2 film"
  ]
};

export const KITS = {
  c41: [
    {
      name: "Kodak Flexicolor @ 37.8 °C",
      steps: [
        {"name": "Developer", "seconds": 195, "note": "37.8 ± 0.15 °C", "preset": "c41k"},
        {"name": "Bleach III", "seconds": 390, "note": "24–41 °C", "preset": "fix"},
        {"name": "Wash", "seconds": 195, "note": "24–41 °C", "preset": null},
        {"name": "Fixer", "seconds": 390, "note": "24–41 °C", "preset": "fix"},
        {"name": "Wash", "seconds": 195, "note": "24–41 °C", "preset": null},
        {"name": "Stabilizer / final rinse", "seconds": 90, "note": "24–41 °C", "preset": "once"},
      ],
    },
    {
      name: "CineStill Cs41 @ 39 °C",
      steps: [
        {"name": "Pre-soak", "seconds": 60, "note": "At developer temp, no agitation", "preset": null, "optional": true, "skipped": true},
        {"name": "Developer", "seconds": 210, "note": "39 °C (102 °F)", "preset": "cs"},
        {"name": "Blix", "seconds": 480, "note": "24–40 °C", "preset": "cs"},
        {"name": "Wash", "seconds": 180, "note": "Running water or 7 fills", "preset": null},
        {"name": "Stabilizer / final rinse", "seconds": 60, "note": "30–60 s, room temp", "preset": "once", "optional": true},
      ],
    },
    {
      name: "Tetenal Colortec C-41 @ 38 °C",
      steps: [
        {"name": "Pre-warm", "seconds": 240, "note": "38 °C water", "preset": "tet41", "optional": true},
        {"name": "Developer", "seconds": 195, "note": "38 °C", "preset": "tet41"},
        {"name": "Blix", "seconds": 360, "note": "38 °C", "preset": "tet41"},
        {"name": "Wash", "seconds": 195, "note": "Change water at least 4 times", "preset": null},
        {"name": "Stabilizer", "seconds": 60, "note": "20–25 °C, outside the tank", "preset": "once"},
      ],
    },
    {
      name: "Flic Film C-41 1 L @ 39 °C",
      steps: [
        {"name": "Developer", "seconds": 210, "note": "39 °C (102 °F)", "preset": "cs"},
        {"name": "Stop bath", "seconds": 30, "note": "Invert once, then stand", "preset": "once"},
        {"name": "Rinse", "seconds": 30, "note": "3 water changes (no time given)", "preset": null},
        {"name": "Bleach", "seconds": 180, "note": "39 °C", "preset": "cs"},
        {"name": "Rinse", "seconds": 30, "note": "3 water changes (no time given)", "preset": null},
        {"name": "Fixer", "seconds": 150, "note": "39 °C", "preset": "cs"},
        {"name": "Wash", "seconds": 300, "note": "Running water", "preset": null},
        {"name": "Stabilizer", "seconds": 60, "note": "Room temp", "preset": "once"},
      ],
    },
  ],
  e6: [
    {
      name: "Kodak E-6 6-bath @ 38 °C",
      steps: [
        {"name": "First developer", "seconds": 360, "note": "38 °C, critical", "preset": "tetE6"},
        {"name": "First wash", "seconds": 120, "note": "33–39 °C", "preset": null},
        {"name": "Reversal bath", "seconds": 120, "note": "24–39 °C", "preset": "once"},
        {"name": "Color developer", "seconds": 360, "note": "38 °C", "preset": "tetE6"},
        {"name": "Pre-bleach", "seconds": 120, "note": "24–39 °C", "preset": "once"},
        {"name": "Bleach", "seconds": 360, "note": "33–39 °C", "preset": "fix"},
        {"name": "Fixer", "seconds": 240, "note": "33–39 °C", "preset": "fix"},
        {"name": "Final wash", "seconds": 240, "note": "33–39 °C", "preset": null},
        {"name": "Final rinse", "seconds": 60, "note": "24–39 °C", "preset": "once"},
      ],
    },
    {
      name: "Tetenal Colortec E-6 3-bath @ 38 °C",
      steps: [
        {"name": "Pre-warm", "seconds": 120, "note": "38 °C water", "preset": "tetE6", "optional": true},
        {"name": "First developer", "seconds": 375, "note": "38 ± 0.3 °C, critical", "preset": "tetE6"},
        {"name": "Wash", "seconds": 150, "note": "38 °C", "preset": null},
        {"name": "Color developer", "seconds": 360, "note": "38 ± 0.3 °C", "preset": "tetE6"},
        {"name": "Wash", "seconds": 150, "note": "33–39 °C", "preset": null},
        {"name": "Blix", "seconds": 360, "note": "33–39 °C", "preset": "tetE6"},
        {"name": "Wash", "seconds": 240, "note": "33–39 °C", "preset": null},
        {"name": "Stabilizer", "seconds": 60, "note": "20–39 °C", "preset": "once"},
      ],
    },
  ],
  ecn2: [
    {
      name: "Kodak ECN-2 @ 41.1 °C",
      steps: [
        {"name": "Prebath", "seconds": 10, "note": "27 ± 1 °C", "preset": "rotary"},
        {"name": "Rem-jet removal & rinse", "seconds": 60, "note": "27–38 °C; Kodak gives no time (placeholder)", "preset": "rotary"},
        {"name": "Developer", "seconds": 180, "note": "41.1 ± 0.1 °C, critical", "preset": "cs"},
        {"name": "Stop", "seconds": 30, "note": "27–38 °C", "preset": "rotary"},
        {"name": "Wash", "seconds": 30, "note": "27–38 °C", "preset": null},
        {"name": "UL bleach", "seconds": 180, "note": "27 ± 1 °C", "preset": "fix"},
        {"name": "Wash", "seconds": 60, "note": "27–38 °C", "preset": null},
        {"name": "Fixer", "seconds": 120, "note": "38 ± 1 °C", "preset": "fix"},
        {"name": "Wash", "seconds": 120, "note": "27–38 °C", "preset": null},
        {"name": "Final rinse", "seconds": 10, "note": "27–38 °C", "preset": "once"},
      ],
    },
    {
      name: "CineStill Cs2 @ 41 °C",
      steps: [
        {"name": "Developer + prebath", "seconds": 210, "note": "41 °C (106 °F)", "preset": "cs"},
        {"name": "Blix + stop", "seconds": 360, "note": "32–40 °C", "preset": "cs"},
        {"name": "Wash", "seconds": 180, "note": "27–38 °C", "preset": null},
        {"name": "Stabilizer / final rinse", "seconds": 60, "note": "", "preset": "once", "optional": true},
      ],
    },
    {
      name: "Flic Film ECN-2 @ 41.1 °C",
      steps: [
        {"name": "Prebath", "seconds": 10, "note": "27 °C, tap to release bubbles", "preset": null},
        {"name": "Prebath rinse", "seconds": 30, "note": "3 changes, shake hard (no time given)", "preset": "rotary"},
        {"name": "Developer", "seconds": 180, "note": "41.1 °C", "preset": "cs"},
        {"name": "Stop bath", "seconds": 30, "note": "Invert once, then stand", "preset": "once"},
        {"name": "Rinse", "seconds": 30, "note": "3 water changes (no time given)", "preset": null},
        {"name": "Bleach", "seconds": 180, "note": "41.1 °C", "preset": "cs"},
        {"name": "Rinse", "seconds": 30, "note": "3 water changes (no time given)", "preset": null},
        {"name": "Fixer", "seconds": 120, "note": "41.1 °C", "preset": "cs"},
        {"name": "Rem-jet removal wash", "seconds": 300, "note": "Running water; wipe off remaining rem-jet", "preset": null},
        {"name": "Stabilizer", "seconds": 60, "note": "Room temp", "preset": "once"},
      ],
    },
  ],
};
