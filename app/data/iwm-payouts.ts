// ItsWorthMore payout grids (UNLOCKED, storage × condition), scraped with
// scripts/iwm-head-scrape.py. Sonny's standing rule is to pay ~10% under
// IWM (IWM_RULE_MULT); marginCapFor turns these into a storage-aware
// ceiling for every model that already had a market guard (a resell comp
// or a NET payout). Refresh: re-scrape, regenerate, bump IWM_SCRAPED.
// Sonny 2026-09-11 (price scan): "fix all other" — the stale resell comps
// were capping 14 models $85–$240 under this rule.
export const IWM_SCRAPED = "2026-09-11";
export const IWM_RULE_MULT = 0.90;
export type IwmCond = "sealed" | "mint" | "good" | "fair" | "broken";
export const IWM_PAYOUTS: Record<string, Record<string, Partial<Record<IwmCond, number>>>> = {
 "gs23u": {
  "256": {
   "sealed": 295,
   "mint": 265,
   "good": 230,
   "fair": 175,
   "broken": 35
  },
  "512": {
   "sealed": 320,
   "mint": 285,
   "good": 250,
   "fair": 195,
   "broken": 36
  },
  "1tb": {
   "sealed": 345,
   "mint": 325,
   "good": 290,
   "fair": 235,
   "broken": 37
  }
 },
 "gs24": {
  "128": {
   "sealed": 240,
   "mint": 210,
   "good": 180,
   "fair": 130,
   "broken": 55
  },
  "256": {
   "sealed": 275,
   "mint": 240,
   "good": 210,
   "fair": 160,
   "broken": 60
  },
  "512": {
   "sealed": 240,
   "mint": 210,
   "good": 180,
   "fair": 130
  }
 },
 "gs24fe": {
  "128": {
   "sealed": 190,
   "mint": 150,
   "good": 130,
   "fair": 80,
   "broken": 25
  },
  "256": {
   "sealed": 210,
   "mint": 170,
   "good": 150,
   "fair": 100,
   "broken": 35
  }
 },
 "gs24p": {
  "256": {
   "sealed": 295,
   "mint": 255,
   "good": 220,
   "fair": 160,
   "broken": 80
  },
  "512": {
   "sealed": 345,
   "mint": 285,
   "good": 250,
   "fair": 190,
   "broken": 90
  }
 },
 "gs24u": {
  "256": {
   "sealed": 430,
   "mint": 390,
   "good": 350,
   "fair": 275,
   "broken": 125
  },
  "512": {
   "sealed": 505,
   "mint": 410,
   "good": 370,
   "fair": 295,
   "broken": 130
  },
  "1tb": {
   "sealed": 605,
   "mint": 470,
   "good": 430,
   "fair": 355,
   "broken": 135
  }
 },
 "gs25": {
  "128": {
   "sealed": 330,
   "mint": 290,
   "good": 265,
   "fair": 210,
   "broken": 60
  },
  "256": {
   "sealed": 365,
   "mint": 330,
   "good": 305,
   "fair": 250,
   "broken": 65
  },
  "512": {
   "sealed": 330,
   "mint": 290,
   "good": 265,
   "fair": 210,
   "broken": 60
  }
 },
 "gs25edge": {
  "256": {
   "sealed": 370,
   "mint": 330,
   "good": 290,
   "fair": 200,
   "broken": 100
  },
  "512": {
   "sealed": 405,
   "mint": 355,
   "good": 315,
   "fair": 225,
   "broken": 110
  }
 },
 "gs25fe": {
  "128": {
   "sealed": 285,
   "mint": 245,
   "good": 215,
   "fair": 80,
   "broken": 25
  },
  "256": {
   "sealed": 305,
   "mint": 265,
   "good": 235,
   "fair": 100,
   "broken": 35
  },
  "512": {
   "sealed": 285,
   "broken": 25
  }
 },
 "gs25p": {
  "256": {
   "sealed": 440,
   "mint": 400,
   "good": 340,
   "fair": 290,
   "broken": 80
  },
  "512": {
   "sealed": 490,
   "mint": 460,
   "good": 400,
   "fair": 350,
   "broken": 90
  }
 },
 "gs25u": {
  "256": {
   "sealed": 570,
   "mint": 510,
   "good": 465,
   "fair": 380,
   "broken": 150
  },
  "512": {
   "sealed": 595,
   "mint": 545,
   "good": 500,
   "fair": 415,
   "broken": 160
  },
  "1tb": {
   "sealed": 620,
   "mint": 595,
   "good": 550,
   "fair": 465,
   "broken": 170
  }
 },
 "gs26": {
  "256": {
   "sealed": 500,
   "mint": 450,
   "good": 395,
   "fair": 315,
   "broken": 100
  },
  "512": {
   "sealed": 530,
   "mint": 475,
   "good": 420,
   "fair": 340,
   "broken": 110
  }
 },
 "gs26p": {
  "256": {
   "sealed": 550,
   "mint": 500,
   "good": 430,
   "fair": 340,
   "broken": 120
  },
  "512": {
   "sealed": 600,
   "mint": 540,
   "good": 470,
   "fair": 380,
   "broken": 130
  }
 },
 "gs26u": {
  "256": {
   "sealed": 725,
   "mint": 675,
   "good": 575,
   "fair": 475,
   "broken": 140
  },
  "512": {
   "sealed": 775,
   "mint": 715,
   "good": 615,
   "fair": 515,
   "broken": 150
  },
  "1tb": {
   "sealed": 825,
   "mint": 755,
   "good": 655,
   "fair": 555,
   "broken": 160
  }
 },
 "ip11pm": {
  "64": {
   "sealed": 195,
   "mint": 175,
   "good": 155,
   "fair": 115,
   "broken": 0
  },
  "256": {
   "sealed": 205,
   "mint": 180,
   "good": 160,
   "fair": 120,
   "broken": 2
  },
  "512": {
   "sealed": 210,
   "mint": 200,
   "good": 180,
   "fair": 140,
   "broken": 5
  }
 },
 "ip12": {
  "64": {
   "sealed": 130,
   "mint": 110,
   "good": 90,
   "fair": 65,
   "broken": 0
  },
  "128": {
   "sealed": 140,
   "mint": 140,
   "good": 120,
   "fair": 95,
   "broken": 2
  },
  "256": {
   "sealed": 145,
   "mint": 155,
   "good": 135,
   "fair": 110,
   "broken": 3
  }
 },
 "ip12p": {
  "128": {
   "sealed": 205,
   "mint": 170,
   "good": 150,
   "fair": 100,
   "broken": 0
  },
  "256": {
   "sealed": 220,
   "mint": 210,
   "good": 190,
   "fair": 140,
   "broken": 5
  },
  "512": {
   "sealed": 230,
   "mint": 210,
   "good": 190,
   "fair": 140,
   "broken": 7
  }
 },
 "ip12pm": {
  "128": {
   "sealed": 250,
   "mint": 220,
   "good": 205,
   "fair": 145,
   "broken": 0
  },
  "256": {
   "sealed": 290,
   "mint": 240,
   "good": 225,
   "fair": 165,
   "broken": 2
  },
  "512": {
   "sealed": 320,
   "mint": 255,
   "good": 240,
   "fair": 180,
   "broken": 5
  }
 },
 "ip13": {
  "128": {
   "sealed": 210,
   "mint": 180,
   "good": 160,
   "fair": 110,
   "broken": 50
  },
  "256": {
   "sealed": 240,
   "mint": 215,
   "good": 195,
   "fair": 145,
   "broken": 55
  },
  "512": {
   "sealed": 260,
   "mint": 225,
   "good": 205,
   "fair": 155,
   "broken": 60
  }
 },
 "ip13mini": {
  "128": {
   "sealed": 190,
   "mint": 160,
   "good": 130,
   "fair": 80,
   "broken": 0
  },
  "256": {
   "sealed": 200,
   "mint": 190,
   "good": 160,
   "fair": 110,
   "broken": 5
  },
  "512": {
   "sealed": 205,
   "mint": 210,
   "good": 180,
   "fair": 130,
   "broken": 7
  }
 },
 "ip13p": {
  "128": {
   "sealed": 275,
   "mint": 245,
   "good": 215,
   "fair": 155,
   "broken": 65
  },
  "256": {
   "sealed": 350,
   "mint": 280,
   "good": 250,
   "fair": 190,
   "broken": 70
  },
  "512": {
   "sealed": 425,
   "mint": 305,
   "good": 275,
   "fair": 215,
   "broken": 72
  },
  "1tb": {
   "sealed": 475,
   "mint": 315,
   "good": 285,
   "fair": 225,
   "broken": 75
  }
 },
 "ip13pm": {
  "128": {
   "sealed": 355,
   "mint": 295,
   "good": 265,
   "fair": 205,
   "broken": 85
  },
  "256": {
   "sealed": 380,
   "mint": 340,
   "good": 310,
   "fair": 250,
   "broken": 90
  },
  "512": {
   "sealed": 405,
   "mint": 350,
   "good": 320,
   "fair": 260,
   "broken": 95
  },
  "1tb": {
   "sealed": 430,
   "mint": 365,
   "good": 335,
   "fair": 275,
   "broken": 100
  }
 },
 "ip14": {
  "128": {
   "sealed": 235,
   "mint": 185,
   "good": 160,
   "fair": 115,
   "broken": 60
  },
  "256": {
   "sealed": 260,
   "mint": 220,
   "good": 195,
   "fair": 150,
   "broken": 65
  },
  "512": {
   "sealed": 285,
   "mint": 295,
   "good": 270,
   "fair": 225,
   "broken": 67
  }
 },
 "ip14p": {
  "128": {
   "sealed": 350,
   "mint": 325,
   "good": 275,
   "fair": 205,
   "broken": 125
  },
  "256": {
   "sealed": 375,
   "mint": 355,
   "good": 305,
   "fair": 235,
   "broken": 135
  },
  "512": {
   "sealed": 390,
   "mint": 385,
   "good": 335,
   "fair": 265,
   "broken": 140
  },
  "1tb": {
   "sealed": 410,
   "mint": 405,
   "good": 355,
   "fair": 285,
   "broken": 145
  }
 },
 "ip14plus": {
  "128": {
   "sealed": 260,
   "mint": 220,
   "good": 190,
   "fair": 150,
   "broken": 95
  },
  "256": {
   "sealed": 310,
   "mint": 260,
   "good": 230,
   "fair": 190,
   "broken": 100
  },
  "512": {
   "sealed": 335,
   "mint": 280,
   "good": 250,
   "fair": 210,
   "broken": 105
  }
 },
 "ip14pm": {
  "128": {
   "sealed": 440,
   "mint": 410,
   "good": 355,
   "fair": 275,
   "broken": 160
  },
  "256": {
   "sealed": 470,
   "mint": 430,
   "good": 375,
   "fair": 295,
   "broken": 180
  },
  "512": {
   "sealed": 480,
   "mint": 460,
   "good": 405,
   "fair": 325,
   "broken": 200
  },
  "1tb": {
   "sealed": 500,
   "mint": 490,
   "good": 435,
   "fair": 355,
   "broken": 220
  }
 },
 "ip15": {
  "128": {
   "sealed": 320,
   "mint": 290,
   "good": 255,
   "fair": 215,
   "broken": 100
  },
  "256": {
   "sealed": 370,
   "mint": 330,
   "good": 295,
   "fair": 255,
   "broken": 110
  },
  "512": {
   "sealed": 420,
   "mint": 360,
   "good": 325,
   "fair": 285,
   "broken": 115
  }
 },
 "ip15p": {
  "128": {
   "sealed": 455,
   "mint": 415,
   "good": 355,
   "fair": 295,
   "broken": 190
  },
  "256": {
   "sealed": 505,
   "mint": 465,
   "good": 405,
   "fair": 345,
   "broken": 210
  },
  "512": {
   "sealed": 530,
   "mint": 495,
   "good": 435,
   "fair": 375,
   "broken": 220
  },
  "1tb": {
   "sealed": 580,
   "mint": 535,
   "good": 475,
   "fair": 415,
   "broken": 240
  }
 },
 "ip15plus": {
  "128": {
   "sealed": 375,
   "mint": 335,
   "good": 285,
   "fair": 245,
   "broken": 145
  },
  "256": {
   "sealed": 425,
   "mint": 350,
   "good": 300,
   "fair": 260,
   "broken": 155
  },
  "512": {
   "sealed": 450,
   "mint": 395,
   "good": 345,
   "fair": 305,
   "broken": 165
  }
 },
 "ip15pm": {
  "256": {
   "sealed": 585,
   "mint": 510,
   "good": 475,
   "fair": 390,
   "broken": 180
  },
  "512": {
   "sealed": 610,
   "mint": 545,
   "good": 510,
   "fair": 425,
   "broken": 190
  },
  "1tb": {
   "sealed": 635,
   "mint": 590,
   "good": 555,
   "fair": 470,
   "broken": 200
  }
 },
 "ip16": {
  "128": {
   "sealed": 475,
   "mint": 435,
   "good": 385,
   "fair": 325,
   "broken": 180
  },
  "256": {
   "sealed": 530,
   "mint": 475,
   "good": 425,
   "fair": 365,
   "broken": 220
  },
  "512": {
   "sealed": 585,
   "mint": 505,
   "good": 455,
   "fair": 395,
   "broken": 260
  }
 },
 "ip16e": {
  "128": {
   "sealed": 290,
   "mint": 255,
   "good": 210,
   "fair": 150,
   "broken": 70
  },
  "256": {
   "sealed": 345,
   "mint": 325,
   "good": 280,
   "fair": 220,
   "broken": 90
  },
  "512": {
   "sealed": 400,
   "mint": 375,
   "good": 330,
   "fair": 270,
   "broken": 110
  }
 },
 "ip16p": {
  "128": {
   "sealed": 580,
   "mint": 540,
   "good": 475,
   "fair": 375,
   "broken": 225
  },
  "256": {
   "sealed": 630,
   "mint": 590,
   "good": 525,
   "fair": 425,
   "broken": 235
  },
  "512": {
   "sealed": 680,
   "mint": 630,
   "good": 565,
   "fair": 465,
   "broken": 275
  },
  "1tb": {
   "sealed": 730,
   "mint": 690,
   "good": 625,
   "fair": 525,
   "broken": 300
  }
 },
 "ip16plus": {
  "128": {
   "sealed": 495,
   "mint": 455,
   "good": 425,
   "fair": 375,
   "broken": 215
  },
  "256": {
   "sealed": 545,
   "mint": 495,
   "good": 465,
   "fair": 415,
   "broken": 255
  },
  "512": {
   "sealed": 595,
   "mint": 530,
   "good": 500,
   "fair": 450,
   "broken": 295
  }
 },
 "ip16pm": {
  "256": {
   "sealed": 700,
   "mint": 670,
   "good": 610,
   "fair": 575,
   "broken": 250
  },
  "512": {
   "sealed": 800,
   "mint": 725,
   "good": 665,
   "fair": 630,
   "broken": 280
  },
  "1tb": {
   "sealed": 900,
   "mint": 810,
   "good": 750,
   "fair": 715,
   "broken": 320
  }
 },
 "ip17": {
  "256": {
   "sealed": 620,
   "mint": 555,
   "good": 510,
   "fair": 440,
   "broken": 260
  },
  "512": {
   "sealed": 730,
   "mint": 655,
   "good": 610,
   "fair": 540,
   "broken": 340
  }
 },
 "ip17air": {
  "256": {
   "sealed": 635,
   "mint": 585,
   "good": 515,
   "fair": 450,
   "broken": 230
  },
  "512": {
   "sealed": 745,
   "mint": 645,
   "good": 575,
   "fair": 510,
   "broken": 310
  },
  "1tb": {
   "sealed": 815,
   "mint": 720,
   "good": 650,
   "fair": 585,
   "broken": 350
  }
 },
 "ip17e": {
  "256": {
   "sealed": 400,
   "mint": 370,
   "good": 330,
   "fair": 180,
   "broken": 100
  },
  "512": {
   "sealed": 440,
   "mint": 410,
   "good": 370,
   "fair": 220,
   "broken": 120
  }
 },
 "ip17p": {
  "256": {
   "sealed": 805,
   "mint": 765,
   "good": 685,
   "fair": 600,
   "broken": 320
  },
  "512": {
   "sealed": 955,
   "mint": 865,
   "good": 785,
   "fair": 700,
   "broken": 440
  },
  "1tb": {
   "sealed": 1005,
   "mint": 915,
   "good": 835,
   "fair": 750,
   "broken": 480
  }
 },
 "ip17pm": {
  "256": {
   "sealed": 860,
   "mint": 830,
   "good": 780,
   "fair": 700,
   "broken": 330
  },
  "512": {
   "sealed": 960,
   "mint": 930,
   "good": 880,
   "fair": 800,
   "broken": 360
  },
  "1tb": {
   "sealed": 1060,
   "mint": 995,
   "good": 945,
   "fair": 865,
   "broken": 400
  },
  "2tb": {
   "sealed": 1260,
   "mint": 1030,
   "good": 980,
   "fair": 900,
   "broken": 480
  }
 }
};
