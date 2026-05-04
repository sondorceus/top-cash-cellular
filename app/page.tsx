"use client";
import { useState, useEffect, useCallback } from "react";

const BRAND = "Top Cash Cellular";
const PHONE = "(877) 549-2056";
const PHONE_TEL = "+18775492056";

const IPHONE_SERIES = [
  { id: "17", label: "iPhone 17", image: "/iphone17.png", year: "2025", topPrice: 825, variants: [
    { id: "ip17pm", label: "iPhone 17 Pro Max", base: 825 },
    { id: "ip17p", label: "iPhone 17 Pro", base: 715 },
    { id: "ip17air", label: "iPhone 17 Air", base: 475 },
    { id: "ip17plus", label: "iPhone 17 Plus", base: 500 },
    { id: "ip17", label: "iPhone 17", base: 455 },
    { id: "ip17e", label: "iPhone 17E", base: 190 },
  ]},
  { id: "16", label: "iPhone 16", image: "/iphone16.png", year: "2024", topPrice: 490, variants: [
    { id: "ip16pm", label: "iPhone 16 Pro Max", base: 490 },
    { id: "ip16p", label: "iPhone 16 Pro", base: 390 },
    { id: "ip16plus", label: "iPhone 16 Plus", base: 320 },
    { id: "ip16", label: "iPhone 16", base: 300 },
    { id: "ip16e", label: "iPhone 16E", base: 145 },
  ]},
  { id: "15", label: "iPhone 15", image: "/iphone15.png", year: "2023", topPrice: 290, variants: [
    { id: "ip15pm", label: "iPhone 15 Pro Max", base: 290 },
    { id: "ip15p", label: "iPhone 15 Pro", base: 235 },
    { id: "ip15plus", label: "iPhone 15 Plus", base: 180 },
    { id: "ip15", label: "iPhone 15", base: 160 },
  ]},
  { id: "14", label: "iPhone 14", image: "/iphone14.png", year: "2022", topPrice: 170, variants: [
    { id: "ip14pm", label: "iPhone 14 Pro Max", base: 170 },
    { id: "ip14p", label: "iPhone 14 Pro", base: 140 },
    { id: "ip14plus", label: "iPhone 14 Plus", base: 110 },
    { id: "ip14", label: "iPhone 14", base: 100 },
  ]},
  { id: "13", label: "iPhone 13", image: "/iphone13.png", year: "2021", topPrice: 130, variants: [
    { id: "ip13pm", label: "iPhone 13 Pro Max", base: 130 },
    { id: "ip13p", label: "iPhone 13 Pro", base: 100 },
    { id: "ip13", label: "iPhone 13", base: 75 },
  ]},
  { id: "12", label: "iPhone 12", image: "/iphone12.png", year: "2020", topPrice: 130, variants: [
    { id: "ip12pm", label: "iPhone 12 Pro Max", base: 130 },
    { id: "ip12p", label: "iPhone 12 Pro", base: 110 },
    { id: "ip12", label: "iPhone 12", base: 80 },
    { id: "ip12mini", label: "iPhone 12 Mini", base: 60 },
  ]},
  { id: "11", label: "iPhone 11", image: "/iphone11.png", year: "2019", topPrice: 100, variants: [
    { id: "ip11pm", label: "iPhone 11 Pro Max", base: 100 },
    { id: "ip11p", label: "iPhone 11 Pro", base: 85 },
    { id: "ip11", label: "iPhone 11", base: 60 },
  ]},
];

const SAMSUNG_SERIES = [
  { id: "sseries", label: "S Series", year: "Galaxy S20–S26", topPrice: 510, image: "/s-series.webp", variants: [
    { id: "gs26u", label: "Galaxy S26 Ultra", base: 510 },
    { id: "gs25u", label: "Galaxy S25 Ultra", base: 330 },
    { id: "gs24u", label: "Galaxy S24 Ultra", base: 460 },
    { id: "gs23u", label: "Galaxy S23 Ultra", base: 300 },
    { id: "gs22u", label: "Galaxy S22 Ultra", base: 180 },
    { id: "gs21u", label: "Galaxy S21 Ultra", base: 130 },
    { id: "gs20u", label: "Galaxy S20 Ultra", base: 80 },
    { id: "gs25edge", label: "Galaxy S25 Edge", base: 120 },
    { id: "gs26p", label: "Galaxy S26+", base: 275 },
    { id: "gs25p", label: "Galaxy S25+", base: 210 },
    { id: "gs24p", label: "Galaxy S24+", base: 240 },
    { id: "gs23p", label: "Galaxy S23+", base: 190 },
    { id: "gs22p", label: "Galaxy S22+", base: 115 },
    { id: "gs21p", label: "Galaxy S21+", base: 65 },
    { id: "gs20p", label: "Galaxy S20+", base: 70 },
    { id: "gs26", label: "Galaxy S26", base: 200 },
    { id: "gs25", label: "Galaxy S25", base: 125 },
    { id: "gs24", label: "Galaxy S24", base: 170 },
    { id: "gs23", label: "Galaxy S23", base: 120 },
    { id: "gs22", label: "Galaxy S22", base: 70 },
    { id: "gs21", label: "Galaxy S21", base: 40 },
    { id: "gs20", label: "Galaxy S20", base: 35 },
    { id: "gs25fe", label: "Galaxy S25 FE", base: 95 },
  ]},
  { id: "foldseries", label: "Fold Series", year: "Z TriFold + Z Fold lineup", topPrice: 1475, image: "/fold-series.webp", variants: [
    { id: "gztrifold", label: "Galaxy Z TriFold", base: 1475 },
    { id: "gzfold7", label: "Galaxy Z Fold 7", base: 630 },
    { id: "gzfold6", label: "Galaxy Z Fold 6", base: 325 },
    { id: "gzfold5", label: "Galaxy Z Fold 5", base: 400 },
    { id: "gzfold4", label: "Galaxy Z Fold 4", base: 300 },
    { id: "gzfold3", label: "Galaxy Z Fold 3", base: 190 },
  ]},
  { id: "flipseries", label: "Flip Series", year: "Z Flip lineup", topPrice: 300, image: "/flip-series.webp", variants: [
    { id: "gzflip7", label: "Galaxy Z Flip 7", base: 160 },
    { id: "gzflip6", label: "Galaxy Z Flip 6", base: 300 },
    { id: "gzflip5", label: "Galaxy Z Flip 5", base: 240 },
    { id: "gzflip4", label: "Galaxy Z Flip 4", base: 150 },
    { id: "gzflip3", label: "Galaxy Z Flip 3", base: 70 },
  ]},
];

const PIXEL_SERIES = [
  { id: "pproseries", label: "Pro Series", year: "Pixel 6 Pro–10 Pro XL", topPrice: 530, image: "/pixel-pro-series.webp", variants: [
    { id: "px10pxl", label: "Pixel 10 Pro XL", base: 530 },
    { id: "px10p", label: "Pixel 10 Pro", base: 440 },
    { id: "px9pxl", label: "Pixel 9 Pro XL", base: 375 },
    { id: "px9p", label: "Pixel 9 Pro", base: 305 },
    { id: "px8p", label: "Pixel 8 Pro", base: 240 },
    { id: "px7p", label: "Pixel 7 Pro", base: 85 },
    { id: "px6p", label: "Pixel 6 Pro", base: 50 },
  ]},
  { id: "pstandard", label: "Standard Series", year: "Pixel 5–10 + a-series", topPrice: 325, image: "/pixel-standard-series.webp", variants: [
    { id: "px10", label: "Pixel 10", base: 325 },
    { id: "px10a", label: "Pixel 10a", base: 145 },
    { id: "px9", label: "Pixel 9", base: 185 },
    { id: "px9a", label: "Pixel 9a", base: 135 },
    { id: "px8", label: "Pixel 8", base: 120 },
    { id: "px8a", label: "Pixel 8a", base: 90 },
    { id: "px7", label: "Pixel 7", base: 45 },
    { id: "px7a", label: "Pixel 7a", base: 10 },
    { id: "px6", label: "Pixel 6", base: 40 },
    { id: "px6a", label: "Pixel 6a", base: 30 },
    { id: "px5", label: "Pixel 5", base: 50 },
    { id: "px5a", label: "Pixel 5a (5G)", base: 30 },
  ]},
  { id: "pfoldseries", label: "Fold Series", year: "Pixel Fold lineup", topPrice: 755, image: "/pixel-fold-series.webp", variants: [
    { id: "px10pfold", label: "Pixel 10 Pro Fold", base: 755 },
    { id: "px9pfold", label: "Pixel 9 Pro Fold", base: 575 },
    { id: "pxfold", label: "Pixel Fold", base: 280 },
  ]},
];

const MACBOOK_PRO_MODELS = [
  { id: "mbp16_m5pmax_2026", label: "MacBook Pro 16\" M5 Pro/Max (2026)", base: 0, inquiryOnly: true },
  { id: "mbp14_m5pmax_2026", label: "MacBook Pro 14\" M5 Pro/Max (2026)", base: 0, inquiryOnly: true },
  { id: "mbp14_m5_2025", label: "MacBook Pro 14\" M5 (2025)", base: 0, inquiryOnly: true },
  { id: "mbp16m4", label: "MacBook Pro 16\" M4 (2024)", base: 1200 },
  { id: "mbp14m4", label: "MacBook Pro 14\" M4 (2024)", base: 1000 },
  { id: "mbp16m3", label: "MacBook Pro 16\" M3 (2023)", base: 950 },
  { id: "mbp14m3", label: "MacBook Pro 14\" M3 (2023)", base: 800 },
  { id: "mbp16m2", label: "MacBook Pro 16\" M2 (2023)", base: 750 },
  { id: "mbp14m2", label: "MacBook Pro 14\" M2 (2023)", base: 650 },
  { id: "mbp13m1", label: "MacBook Pro 13\" M1 (2020)", base: 400 },
  { id: "mbp13_intel_2020", label: "MacBook Pro 13\" Intel (2020)", base: 0, inquiryOnly: true },
  { id: "mbp16_intel_2019", label: "MacBook Pro 16\" Intel (2019)", base: 0, inquiryOnly: true },
  { id: "mbp_tb_2018_2019", label: "MacBook Pro Touch Bar 13\"/15\" (2018–2019)", base: 0, inquiryOnly: true },
  { id: "mbp_tb_2016_2017", label: "MacBook Pro Touch Bar 13\"/15\" (2016–2017)", base: 0, inquiryOnly: true },
  { id: "mbp_retina_2015", label: "MacBook Pro Retina 13\"/15\" (2015)", base: 0, inquiryOnly: true },
  { id: "mbp_retina_2014", label: "MacBook Pro Retina 13\"/15\" (2014)", base: 0, inquiryOnly: true },
];
const MACBOOK_AIR_MODELS = [
  { id: "mba_m5_2026", label: "MacBook Air M5 (13\" & 15\", 2026)", base: 0, inquiryOnly: true },
  { id: "mba15m3", label: "MacBook Air 15\" M3 (2024)", base: 700 },
  { id: "mba13m3", label: "MacBook Air 13\" M3 (2024)", base: 600 },
  { id: "mba15m2", label: "MacBook Air 15\" M2 (2023)", base: 550 },
  { id: "mba13m2", label: "MacBook Air 13\" M2 (2022)", base: 480 },
  { id: "mba13m1", label: "MacBook Air 13\" M1 (2020)", base: 350 },
  { id: "mba_intel_2020", label: "MacBook Air Intel (2020)", base: 0, inquiryOnly: true },
  { id: "mba_retina_2018_2019", label: "MacBook Air Retina (2018–2019)", base: 0, inquiryOnly: true },
  { id: "mba_2017", label: "MacBook Air (2017)", base: 0, inquiryOnly: true },
  { id: "mba_2014_2015", label: "MacBook Air (2014–2015)", base: 0, inquiryOnly: true },
];
const MACBOOK_CLASSIC_MODELS = [
  { id: "mb12_2017", label: "MacBook 12\" (2017)", base: 0, inquiryOnly: true },
  { id: "mb12_2016", label: "MacBook 12\" (2016)", base: 0, inquiryOnly: true },
  { id: "mb12_2015", label: "MacBook 12\" (2015)", base: 0, inquiryOnly: true },
];
const MACBOOK_SERIES = [
  { id: "mbpro", label: "MacBook Pro", year: "M1–M4", topPrice: 1200, image: "/macbook-pro-series.webp", variants: MACBOOK_PRO_MODELS },
  { id: "mbair", label: "MacBook Air", year: "M1–M3", topPrice: 700, image: "/macbook-air-series.webp", variants: MACBOOK_AIR_MODELS },
  { id: "mbclassic", label: "MacBook", year: "12-inch Retina", topPrice: 0, image: "/macbook-classic-series.webp", variants: MACBOOK_CLASSIC_MODELS, inquiryOnly: true },
];

const SAMSUNG_PC_MODELS = [
  { id: "sgbk4u", label: "Galaxy Book 4 Ultra", base: 750 },
  { id: "sgbk4p", label: "Galaxy Book 4 Pro 360", base: 600 },
  { id: "sgbk4pro", label: "Galaxy Book 4 Pro", base: 520 },
  { id: "sgbk4", label: "Galaxy Book 4", base: 350 },
  { id: "sgbk3u", label: "Galaxy Book 3 Ultra", base: 580 },
  { id: "sgbk3p", label: "Galaxy Book 3 Pro 360", base: 450 },
  { id: "sgbk3pro", label: "Galaxy Book 3 Pro", base: 380 },
  { id: "sgbk3", label: "Galaxy Book 3", base: 250 },
  { id: "sgbk2p", label: "Galaxy Book 2 Pro", base: 280 },
  { id: "sgbk2", label: "Galaxy Book 2", base: 180 },
];

const LENOVO_MODELS = [
  { id: "lntp14g5", label: "ThinkPad X1 Carbon Gen 12", base: 700 },
  { id: "lntp14g4", label: "ThinkPad X1 Carbon Gen 11", base: 550 },
  { id: "lntp14g3", label: "ThinkPad X1 Carbon Gen 10", base: 400 },
  { id: "lnyoga9", label: "Yoga 9i 14\" Gen 9", base: 600 },
  { id: "lnyoga7", label: "Yoga 7i 16\" Gen 9", base: 450 },
  { id: "lnslim7", label: "IdeaPad Slim 7 Pro", base: 380 },
  { id: "lnslim5", label: "IdeaPad Slim 5", base: 250 },
  { id: "lnlegion7", label: "Legion Pro 7i Gen 9", base: 850 },
  { id: "lnlegion5", label: "Legion 5i Gen 9", base: 550 },
  { id: "lnlegion5g8", label: "Legion 5i Gen 8", base: 400 },
];

const DELL_MODELS = [
  { id: "dxps17", label: "XPS 17 (2024)", base: 750 },
  { id: "dxps15", label: "XPS 15 (2024)", base: 620 },
  { id: "dxps13", label: "XPS 13 (2024)", base: 480 },
  { id: "dxps15g23", label: "XPS 15 (2023)", base: 500 },
  { id: "dxps13g23", label: "XPS 13 (2023)", base: 380 },
  { id: "dlat7440", label: "Latitude 7440", base: 420 },
  { id: "dlat5540", label: "Latitude 5540", base: 300 },
  { id: "dinsp16p", label: "Inspiron 16 Plus", base: 350 },
  { id: "dinsp15", label: "Inspiron 15", base: 220 },
  { id: "dinsp14", label: "Inspiron 14", base: 200 },
];

const ALIENWARE_FLAGSHIP_VARIANTS = [
  { id: "aw18_a51_2026", label: "Alienware 18 Area-51 (2026)", base: 0, inquiryOnly: true },
  { id: "aw16_a51_2026", label: "Alienware 16 Area-51 (2026)", base: 0, inquiryOnly: true },
  { id: "awm18r2", label: "Alienware m18 R2", base: 0, inquiryOnly: true },
  { id: "awm18r1", label: "Alienware m18 R1", base: 0, inquiryOnly: true },
  { id: "aw_a51m_r2", label: "Alienware Area-51m R2", base: 0, inquiryOnly: true },
  { id: "aw_a51m_r1", label: "Alienware Area-51m R1", base: 0, inquiryOnly: true },
];
const ALIENWARE_AURORA_VARIANTS = [
  { id: "aw16x_aurora_2026", label: "Alienware 16X Aurora (2026)", base: 0, inquiryOnly: true },
  { id: "aw16_aurora_2026", label: "Alienware 16 Aurora (2026)", base: 0, inquiryOnly: true },
  { id: "awx16r2", label: "Alienware x16 R2", base: 0, inquiryOnly: true },
  { id: "awx16r1", label: "Alienware x16 R1", base: 0, inquiryOnly: true },
  { id: "awx14r2", label: "Alienware x14 R2", base: 0, inquiryOnly: true },
  { id: "awx14r1", label: "Alienware x14 R1", base: 0, inquiryOnly: true },
  { id: "awx17r2", label: "Alienware x17 R2", base: 0, inquiryOnly: true },
  { id: "awx17r1", label: "Alienware x17 R1", base: 0, inquiryOnly: true },
  { id: "awx15r2", label: "Alienware x15 R2", base: 0, inquiryOnly: true },
  { id: "awx15r1", label: "Alienware x15 R1", base: 0, inquiryOnly: true },
];
const ALIENWARE_ULTRASLIM_VARIANTS = [
  { id: "aw16_ultraslim_2026", label: "Alienware 16 Ultraslim (2026)", base: 0, inquiryOnly: true },
  { id: "aw14_ultraslim_2026", label: "Alienware 14 Ultraslim (2026)", base: 0, inquiryOnly: true },
];
const ALIENWARE_MAINSTREAM_VARIANTS = [
  { id: "aw_entry_2026", label: "Alienware Entry-Level (2026)", base: 0, inquiryOnly: true },
  { id: "awm16r2", label: "Alienware m16 R2", base: 0, inquiryOnly: true },
  { id: "awm16r1", label: "Alienware m16 R1", base: 0, inquiryOnly: true },
  { id: "awm17r5", label: "Alienware m17 R5 (AMD flagship)", base: 0, inquiryOnly: true },
  { id: "awm15r7", label: "Alienware m15 R7", base: 0, inquiryOnly: true },
  { id: "awm15r6", label: "Alienware m15 R6", base: 0, inquiryOnly: true },
  { id: "awm15r5_ryzen", label: "Alienware m15 R5 (Ryzen)", base: 0, inquiryOnly: true },
];
const ALIENWARE_SERIES = [
  { id: "aw_flagship", label: "Flagship", year: "Area-51 / m18", topPrice: 0, variants: ALIENWARE_FLAGSHIP_VARIANTS, inquiryOnly: true },
  { id: "aw_aurora", label: "Aurora & X", year: "Premium Slim", topPrice: 0, variants: ALIENWARE_AURORA_VARIANTS, inquiryOnly: true },
  { id: "aw_ultraslim", label: "Ultraslim", year: "2026 — New", topPrice: 0, variants: ALIENWARE_ULTRASLIM_VARIANTS, inquiryOnly: true },
  { id: "aw_mainstream", label: "M-Series & Entry", year: "All-rounder", topPrice: 0, variants: ALIENWARE_MAINSTREAM_VARIANTS, inquiryOnly: true },
];
const ALIENWARE_MODELS = [
  ...ALIENWARE_FLAGSHIP_VARIANTS,
  ...ALIENWARE_AURORA_VARIANTS,
  ...ALIENWARE_ULTRASLIM_VARIANTS,
  ...ALIENWARE_MAINSTREAM_VARIANTS,
];

const HP_MODELS = [
  { id: "hpspec16", label: "Spectre x360 16\" (2024)", base: 0, inquiryOnly: true },
  { id: "hpspec14", label: "Spectre x360 14\" (2024)", base: 0, inquiryOnly: true },
  { id: "hpspec16g23", label: "Spectre x360 16\" (2023)", base: 0, inquiryOnly: true },
  { id: "hpenvy16", label: "Envy 16\" (2024)", base: 0, inquiryOnly: true },
  { id: "hpenvy15", label: "Envy x360 15\" (2024)", base: 0, inquiryOnly: true },
  { id: "hpomen17", label: "OMEN 17\" (2024)", base: 0, inquiryOnly: true },
  { id: "hpomen16", label: "OMEN 16\" (2024)", base: 0, inquiryOnly: true },
  { id: "hppav15", label: "Pavilion 15\"", base: 0, inquiryOnly: true },
  { id: "hpelite840", label: "EliteBook 840 G10", base: 0, inquiryOnly: true },
  { id: "hpprobook", label: "ProBook 450 G10", base: 0, inquiryOnly: true },
];

const ACER_MODELS = [
  { id: "acswx14", label: "Swift X 14 (2024)", base: 480 },
  { id: "acsw14", label: "Swift Go 14 (2024)", base: 380 },
  { id: "acpred16", label: "Predator Helios 16 (2024)", base: 750 },
  { id: "acpred18", label: "Predator Helios 18 (2024)", base: 900 },
  { id: "acnit16", label: "Nitro V 16 (2024)", base: 400 },
  { id: "acnit15", label: "Nitro 5 (2023)", base: 300 },
  { id: "acasp15", label: "Aspire 5", base: 200 },
  { id: "acasp3", label: "Aspire 3", base: 150 },
];

const LG_GRAM_STANDARD_VARIANTS = [
  { id: "lg_gr17_24", label: "LG Gram 17 (17Z90S, 2024)", base: 0, inquiryOnly: true },
  { id: "lg_gr16_24", label: "LG Gram 16 (16Z90S, 2024)", base: 0, inquiryOnly: true },
  { id: "lg_gr14_24", label: "LG Gram 14 (14Z90S, 2024)", base: 0, inquiryOnly: true },
  { id: "lg_gr17_23", label: "LG Gram 17 (17Z90R, 2023)", base: 0, inquiryOnly: true },
  { id: "lg_gr16_23", label: "LG Gram 16 (16Z90R, 2023)", base: 0, inquiryOnly: true },
  { id: "lg_gr15_23", label: "LG Gram 15 (15Z90R, 2023)", base: 0, inquiryOnly: true },
  { id: "lg_gr14_23", label: "LG Gram 14 (14Z90R, 2023)", base: 0, inquiryOnly: true },
];
const LG_GRAM_2IN1_VARIANTS = [
  { id: "lg_gr16t_24", label: "LG Gram 16 2-in-1 (16T90S, 2024)", base: 0, inquiryOnly: true },
  { id: "lg_gr14t_24", label: "LG Gram 14 2-in-1 (14T90S, 2024)", base: 0, inquiryOnly: true },
  { id: "lg_gr16t_23", label: "LG Gram 16 2-in-1 (16T90R, 2023)", base: 0, inquiryOnly: true },
  { id: "lg_gr14t_23", label: "LG Gram 14 2-in-1 (14T90R, 2023)", base: 0, inquiryOnly: true },
];
const LG_GRAM_STYLE_VARIANTS = [
  { id: "lg_grstyle16", label: "LG Gram Style 16 (16Z90RS, 2023)", base: 0, inquiryOnly: true },
  { id: "lg_grstyle14", label: "LG Gram Style 14 (14Z90RS, 2023)", base: 0, inquiryOnly: true },
];
const LG_GRAM_ULTRASLIM_VARIANTS = [
  { id: "lg_grultra15", label: "LG Gram Ultraslim 15 (15Z90RT, 2023)", base: 0, inquiryOnly: true },
];
const LG_GRAM_PRO_VARIANTS = [
  { id: "lg_grpro17_25", label: "LG Gram Pro 17 (17Z90TR, 2025)", base: 0, inquiryOnly: true },
  { id: "lg_grpro16_25", label: "LG Gram Pro 16 (16Z90TR, 2025)", base: 0, inquiryOnly: true },
  { id: "lg_grpro17_24", label: "LG Gram Pro 17 (17Z90SP, 2024)", base: 0, inquiryOnly: true },
  { id: "lg_grpro16_24", label: "LG Gram Pro 16 (16Z90SP, 2024)", base: 0, inquiryOnly: true },
];
const LG_GRAM_PRO_2IN1_VARIANTS = [
  { id: "lg_grpro16t_24", label: "LG Gram Pro 16 2-in-1 (16T90SP, 2024)", base: 0, inquiryOnly: true },
];
const LG_GRAM_BOOK_VARIANTS = [
  { id: "lg_grbook16", label: "LG Gram Book 16 (2024–2025)", base: 0, inquiryOnly: true },
  { id: "lg_grbook15", label: "LG Gram Book 15.6 (2024–2025)", base: 0, inquiryOnly: true },
];
const LG_ULTRAGEAR_VARIANTS = [
  { id: "lg_ultragear16_24", label: "LG UltraGear 16 (16G90S, 2024)", base: 0, inquiryOnly: true },
  { id: "lg_ultragear16_23", label: "LG UltraGear 16 (16G90R, 2023)", base: 0, inquiryOnly: true },
  { id: "lg_ultragear16_22", label: "LG UltraGear 16 (16G90Q, 2022)", base: 0, inquiryOnly: true },
];
const LG_PC_SERIES = [
  { id: "lg_gram", label: "Gram", year: "Standard", topPrice: 0, variants: LG_GRAM_STANDARD_VARIANTS, inquiryOnly: true },
  { id: "lg_gram2in1", label: "Gram 2-in-1", year: "Convertible", topPrice: 0, variants: LG_GRAM_2IN1_VARIANTS, inquiryOnly: true },
  { id: "lg_gramstyle", label: "Gram Style", year: "OLED", topPrice: 0, variants: LG_GRAM_STYLE_VARIANTS, inquiryOnly: true },
  { id: "lg_gramultra", label: "Gram Ultraslim", year: "Super-thin", topPrice: 0, variants: LG_GRAM_ULTRASLIM_VARIANTS, inquiryOnly: true },
  { id: "lg_grampro", label: "Gram Pro", year: "Performance", topPrice: 0, variants: LG_GRAM_PRO_VARIANTS, inquiryOnly: true },
  { id: "lg_grampro2in1", label: "Gram Pro 2-in-1", year: "Pro Convertible", topPrice: 0, variants: LG_GRAM_PRO_2IN1_VARIANTS, inquiryOnly: true },
  { id: "lg_grambook", label: "Gram Book", year: "Budget", topPrice: 0, variants: LG_GRAM_BOOK_VARIANTS, inquiryOnly: true },
  { id: "lg_ultragear", label: "UltraGear", year: "Gaming", topPrice: 0, variants: LG_ULTRAGEAR_VARIANTS, inquiryOnly: true },
];
const LG_PC_MODELS = [
  ...LG_GRAM_STANDARD_VARIANTS,
  ...LG_GRAM_2IN1_VARIANTS,
  ...LG_GRAM_STYLE_VARIANTS,
  ...LG_GRAM_ULTRASLIM_VARIANTS,
  ...LG_GRAM_PRO_VARIANTS,
  ...LG_GRAM_PRO_2IN1_VARIANTS,
  ...LG_GRAM_BOOK_VARIANTS,
  ...LG_ULTRAGEAR_VARIANTS,
];

const APPLE_DESKTOP_MODELS = [
  { id: "macstudiom4u", label: "Mac Studio M4 Ultra", base: 2200 },
  { id: "macstudiom4m", label: "Mac Studio M4 Max", base: 1400 },
  { id: "macstudiom2u", label: "Mac Studio M2 Ultra", base: 1600 },
  { id: "macstudiom2m", label: "Mac Studio M2 Max", base: 1000 },
  { id: "macprom2u", label: "Mac Pro M2 Ultra", base: 2800 },
  { id: "macminim4", label: "Mac Mini M4", base: 400 },
  { id: "macminim4p", label: "Mac Mini M4 Pro", base: 600 },
  { id: "macminim2", label: "Mac Mini M2", base: 300 },
  { id: "macminim1", label: "Mac Mini M1", base: 220 },
  { id: "imac24m4", label: "iMac 24\" M4", base: 900 },
  { id: "imac24m3", label: "iMac 24\" M3", base: 700 },
  { id: "imac24m1", label: "iMac 24\" M1", base: 450 },
];

const DELL_DESKTOP_MODELS = [
  { id: "doptiplex7010", label: "OptiPlex 7010", base: 350 },
  { id: "doptiplex5000", label: "OptiPlex 5000", base: 280 },
  { id: "dxps8960", label: "XPS Desktop 8960", base: 500 },
  { id: "dxps8950", label: "XPS Desktop 8950", base: 380 },
  { id: "dinsp3030", label: "Inspiron 3030 Desktop", base: 250 },
  { id: "dprecision3680", label: "Precision 3680", base: 550 },
];

const LENOVO_DESKTOP_MODELS = [
  { id: "lnthinkm", label: "ThinkCentre M920", base: 300 },
  { id: "lnthinkm90q", label: "ThinkCentre M90q Tiny", base: 350 },
  { id: "lnlegion5dtwr", label: "Legion Tower 5i", base: 550 },
  { id: "lnlegion7dtwr", label: "Legion Tower 7i", base: 750 },
  { id: "lnideactower", label: "IdeaCentre 5i", base: 250 },
];

const HP_DESKTOP_MODELS = [
  { id: "hpelitedesk", label: "EliteDesk 800 G9", base: 400 },
  { id: "hpprodesk", label: "ProDesk 400 G9", base: 280 },
  { id: "hpomendsk", label: "OMEN 45L Desktop", base: 650 },
  { id: "hpomen40", label: "OMEN 40L Desktop", base: 500 },
  { id: "hpenvy34", label: "Envy 34 All-in-One", base: 550 },
  { id: "hppav32", label: "Pavilion 32 All-in-One", base: 380 },
];

const ASUS_DESKTOP_MODELS = [
  { id: "asrogstrix", label: "ROG Strix G16CH", base: 700 },
  { id: "asroghyper", label: "ROG Hyperion", base: 1200 },
  { id: "asrogflow", label: "ROG NUC", base: 500 },
  { id: "astufgaming", label: "TUF Gaming Desktop", base: 450 },
  { id: "asexperpro", label: "ExpertCenter D5", base: 300 },
  { id: "asnuc14", label: "NUC 14 Pro", base: 350 },
];

const ALIENWARE_DESKTOP_MODELS = [
  { id: "awaurorar16", label: "Aurora R16", base: 800 },
  { id: "awaurorar15", label: "Aurora R15", base: 600 },
  { id: "awaurorar13", label: "Aurora R13", base: 450 },
];

const MSI_DESKTOP_MODELS = [
  { id: "msiinfinity", label: "MEG Trident X2", base: 900 },
  { id: "msitrident", label: "MAG Trident S5", base: 550 },
  { id: "msinightblade", label: "MAG Codex 6", base: 650 },
  { id: "msicodex5", label: "MAG Codex 5", base: 450 },
  { id: "msipro", label: "PRO DP180", base: 300 },
];

const IPAD_SERIES = [
  { id: "ipadpro", label: "iPad Pro", topPrice: 610, image: "/ipadpro.png", variants: [
    { id: "ipadpro13m5", label: "iPad Pro 13\" M5", base: 610 },
    { id: "ipadpro11m5", label: "iPad Pro 11\" M5", base: 475 },
    { id: "ipadpro13m4", label: "iPad Pro 13\" M4", base: 500 },
    { id: "ipadpro11m4", label: "iPad Pro 11\" M4", base: 350 },
    { id: "ipadpro129g6", label: "iPad Pro 12.9\" 6th Gen", base: 270 },
    { id: "ipadpro11g4", label: "iPad Pro 11\" 4th Gen", base: 225 },
  ]},
  { id: "ipadair", label: "iPad Air", topPrice: 360, image: "/ipadair.png", variants: [
    { id: "ipadair13m3", label: "iPad Air 13\" M3", base: 360 },
    { id: "ipadair11m3", label: "iPad Air 11\" M3", base: 275 },
    { id: "ipadair13m2", label: "iPad Air 13\" M2", base: 275 },
    { id: "ipadair11m2", label: "iPad Air 11\" M2", base: 200 },
  ]},
  { id: "ipadmini", label: "iPad Mini", topPrice: 225, image: "/ipadmini.png", variants: [
    { id: "ipadmini7", label: "iPad Mini 7th Gen", base: 225 },
    { id: "ipadmini6", label: "iPad Mini 6th Gen", base: 150 },
  ]},
  { id: "ipadbase", label: "iPad", topPrice: 150, image: "/ipadbase.png", variants: [
    { id: "ipad10", label: "iPad 10th Gen", base: 150 },
    { id: "ipad9", label: "iPad 9th Gen", base: 100 },
  ]},
];

const IPAD_MODELS = IPAD_SERIES.flatMap(s => s.variants);

const PS5_VARIANTS = [
  { id: "ps5pro", label: "PlayStation 5 Pro (2024)", base: 0, inquiryOnly: true },
  { id: "ps5", label: "PlayStation 5 (Standard, Disc)", base: 300 },
  { id: "ps5d", label: "PlayStation 5 Digital", base: 250 },
  { id: "ps5slim", label: "PlayStation 5 Slim (Disc)", base: 0, inquiryOnly: true },
  { id: "ps5slim_d", label: "PlayStation 5 Slim Digital", base: 0, inquiryOnly: true },
];
const PS4_VARIANTS = [
  { id: "ps4pro", label: "PlayStation 4 Pro", base: 150 },
  { id: "ps4", label: "PlayStation 4 (Standard)", base: 100 },
  { id: "ps4slim", label: "PlayStation 4 Slim", base: 0, inquiryOnly: true },
];
const SONY_SERIES = [
  { id: "ps5_family", label: "PlayStation 5", year: "Pro · Std · Slim", topPrice: 300, image: "/ps5-series.webp", variants: PS5_VARIANTS },
  { id: "ps4_family", label: "PlayStation 4", year: "Pro · Std · Slim", topPrice: 150, image: "/ps4-series.webp", variants: PS4_VARIANTS },
];
const SONY_MODELS = [...PS5_VARIANTS, ...PS4_VARIANTS];

const MICROSOFT_MODELS = [
  { id: "xsx", label: "Xbox Series X", base: 280 },
  { id: "xss", label: "Xbox Series S", base: 150 },
  { id: "xone", label: "Xbox One", base: 80 },
];

const NINTENDO_MODELS = [
  { id: "switch", label: "Nintendo Switch OLED", base: 180 },
  { id: "switchv2", label: "Nintendo Switch V2", base: 130 },
  { id: "switchlite", label: "Nintendo Switch Lite", base: 90 },
];

const CONSOLE_MODELS = [...SONY_MODELS, ...MICROSOFT_MODELS, ...NINTENDO_MODELS];

const APPLEWATCH_MODELS = [
  { id: "awu2", label: "Apple Watch Ultra 2", base: 450 },
  { id: "awu1", label: "Apple Watch Ultra", base: 350 },
  { id: "aws10", label: "Apple Watch Series 10", base: 280 },
  { id: "aws9", label: "Apple Watch Series 9", base: 220 },
  { id: "aws8", label: "Apple Watch Series 8", base: 170 },
  { id: "aws7", label: "Apple Watch Series 7", base: 120 },
  { id: "awse2", label: "Apple Watch SE (2nd Gen)", base: 130 },
  { id: "awse1", label: "Apple Watch SE (1st Gen)", base: 80 },
];

const PIXELWATCH_MODELS = [
  { id: "pw3", label: "Pixel Watch 3", base: 200 },
  { id: "pw2", label: "Pixel Watch 2", base: 130 },
  { id: "pw1", label: "Pixel Watch", base: 80 },
];

const GARMIN_MODELS = [
  { id: "gfenix7", label: "Fenix 7", base: 300 },
  { id: "gfenix7s", label: "Fenix 7S", base: 250 },
  { id: "gepix2", label: "Epix Gen 2", base: 280 },
  { id: "gfr965", label: "Forerunner 965", base: 250 },
  { id: "gfr265", label: "Forerunner 265", base: 180 },
  { id: "gvenu3", label: "Venu 3", base: 220 },
  { id: "gvenu2", label: "Venu 2", base: 130 },
];

const SAMSUNGWATCH_MODELS = [
  { id: "sgwu", label: "Galaxy Watch Ultra", base: 350 },
  { id: "sgw7", label: "Galaxy Watch 7", base: 150 },
  { id: "sgw6c", label: "Galaxy Watch 6 Classic", base: 160 },
  { id: "sgw6", label: "Galaxy Watch 6", base: 110 },
  { id: "sgw5p", label: "Galaxy Watch 5 Pro", base: 130 },
  { id: "sgw5", label: "Galaxy Watch 5", base: 80 },
];

const DJI_MODELS = [
  { id: "djimavic", label: "DJI Mavic" },
  { id: "djiinspire", label: "DJI Inspire" },
  { id: "djiavata", label: "DJI Avata" },
  { id: "djifpv", label: "DJI FPV" },
  { id: "djiair", label: "DJI Air" },
  { id: "djimini", label: "DJI Mini" },
  { id: "djiphantom", label: "DJI Phantom" },
  { id: "djiflip", label: "DJI Flip" },
  { id: "djispark", label: "DJI Spark" },
];

const APPLE_VR_MODELS = [
  { id: "avp1tb", label: "Apple Vision Pro (1TB)" },
  { id: "avp512", label: "Apple Vision Pro (512GB)" },
  { id: "avp256", label: "Apple Vision Pro (256GB)" },
];

const META_VR_MODELS = [
  { id: "mq3512", label: "Meta Quest 3S (512GB)" },
  { id: "mq3128", label: "Meta Quest 3S (128GB)" },
  { id: "mq3", label: "Meta Quest 3 (512GB)" },
  { id: "mq3b", label: "Meta Quest 3 (128GB)" },
  { id: "mq2256", label: "Meta Quest 2 (256GB)" },
  { id: "mq2128", label: "Meta Quest 2 (128GB)" },
  { id: "mqpro", label: "Meta Quest Pro" },
];

const VALVE_VR_MODELS = [
  { id: "valveidx", label: "Valve Index Full Kit" },
  { id: "valveidxhmd", label: "Valve Index Headset Only" },
];

const PSVR_MODELS = [
  { id: "psvr2", label: "PlayStation VR2" },
  { id: "psvr2h", label: "PlayStation VR2 Horizon Bundle" },
  { id: "psvr1", label: "PlayStation VR (Original)" },
];

const SAMSUNG_TAB_MODELS = [
  { id: "stabs9u", label: "Galaxy Tab S9 Ultra" },
  { id: "stabs9p", label: "Galaxy Tab S9+" },
  { id: "stabs9", label: "Galaxy Tab S9" },
  { id: "stabs8u", label: "Galaxy Tab S8 Ultra" },
  { id: "stabs8p", label: "Galaxy Tab S8+" },
  { id: "stabs8", label: "Galaxy Tab S8" },
  { id: "staba9", label: "Galaxy Tab A9+" },
];

const SURFACE_PRO_VARIANTS = [
  { id: "surfpro12_13", label: "Surface Pro 12 13\" (2026)", base: 0, inquiryOnly: true },
  { id: "surfpro12_12", label: "Surface Pro 12 12\" (2026)", base: 0, inquiryOnly: true },
  { id: "surfpro11", label: "Surface Pro 11th Ed (Copilot+ / Snapdragon X)", base: 0, inquiryOnly: true },
  { id: "surfpro10biz", label: "Surface Pro 10 for Business", base: 0, inquiryOnly: true },
  { id: "surfpro9", label: "Surface Pro 9", base: 0, inquiryOnly: true },
  { id: "surfpro8", label: "Surface Pro 8", base: 0, inquiryOnly: true },
  { id: "surfpro7p", label: "Surface Pro 7+", base: 0, inquiryOnly: true },
  { id: "surfpro7", label: "Surface Pro 7", base: 0, inquiryOnly: true },
  { id: "surfpro6", label: "Surface Pro 6", base: 0, inquiryOnly: true },
  { id: "surfpro5_2017", label: "Surface Pro 5 (2017)", base: 0, inquiryOnly: true },
  { id: "surfpro4", label: "Surface Pro 4", base: 0, inquiryOnly: true },
  { id: "surfpro3", label: "Surface Pro 3", base: 0, inquiryOnly: true },
  { id: "surfpro2", label: "Surface Pro 2", base: 0, inquiryOnly: true },
  { id: "surfpro1", label: "Surface Pro (2013)", base: 0, inquiryOnly: true },
];
const SURFACE_GO_VARIANTS = [
  { id: "surfgo4", label: "Surface Go 4 (Business)", base: 0, inquiryOnly: true },
  { id: "surfgo3", label: "Surface Go 3", base: 0, inquiryOnly: true },
  { id: "surfgo2", label: "Surface Go 2", base: 0, inquiryOnly: true },
  { id: "surfgo1", label: "Surface Go (2018)", base: 0, inquiryOnly: true },
];
const SURFACE_X_VARIANTS = [
  { id: "surfprox2020", label: "Surface Pro X (2020 Refresh)", base: 0, inquiryOnly: true },
  { id: "surfprox2019", label: "Surface Pro X (2019)", base: 0, inquiryOnly: true },
];
const SURFACE_BOOKSTUDIO_VARIANTS = [
  { id: "surfstudio2", label: "Surface Laptop Studio 2", base: 0, inquiryOnly: true },
  { id: "surfstudio1", label: "Surface Laptop Studio 1", base: 0, inquiryOnly: true },
  { id: "surfbook3", label: "Surface Book 3", base: 0, inquiryOnly: true },
  { id: "surfbook2", label: "Surface Book 2", base: 0, inquiryOnly: true },
  { id: "surfbook1", label: "Surface Book 1", base: 0, inquiryOnly: true },
];
const SURFACE_ORIGINAL_VARIANTS = [
  { id: "surf3", label: "Surface 3", base: 0, inquiryOnly: true },
  { id: "surf2", label: "Surface 2", base: 0, inquiryOnly: true },
  { id: "surfrt", label: "Surface RT (2012)", base: 0, inquiryOnly: true },
];
const SURFACE_DUO_VARIANTS = [
  { id: "surfduo2", label: "Surface Duo 2", base: 0, inquiryOnly: true },
  { id: "surfduo1", label: "Surface Duo", base: 0, inquiryOnly: true },
];
const SURFACE_SERIES = [
  { id: "surf_pro", label: "Pro", year: "Flagship", topPrice: 0, variants: SURFACE_PRO_VARIANTS, inquiryOnly: true },
  { id: "surf_go", label: "Go", year: "Compact", topPrice: 0, variants: SURFACE_GO_VARIANTS, inquiryOnly: true },
  { id: "surf_x", label: "Pro X", year: "ARM Ultra-thin", topPrice: 0, variants: SURFACE_X_VARIANTS, inquiryOnly: true },
  { id: "surf_bookstudio", label: "Book & Laptop Studio", year: "Hybrid", topPrice: 0, variants: SURFACE_BOOKSTUDIO_VARIANTS, inquiryOnly: true },
  { id: "surf_original", label: "Original (Non-Pro)", year: "RT / 2 / 3", topPrice: 0, variants: SURFACE_ORIGINAL_VARIANTS, inquiryOnly: true },
  { id: "surf_duo", label: "Duo", year: "Dual-Screen", topPrice: 0, variants: SURFACE_DUO_VARIANTS, inquiryOnly: true },
];
const SURFACE_MODELS = [
  ...SURFACE_PRO_VARIANTS,
  ...SURFACE_GO_VARIANTS,
  ...SURFACE_X_VARIANTS,
  ...SURFACE_BOOKSTUDIO_VARIANTS,
  ...SURFACE_ORIGINAL_VARIANTS,
  ...SURFACE_DUO_VARIANTS,
];

const LENOVO_LEGION_TAB_VARIANTS = [
  { id: "legtabg5", label: "Legion Tab Gen 5 (8.8\")", base: 0, inquiryOnly: true },
  { id: "legtabg3", label: "Legion Tab Gen 3", base: 0, inquiryOnly: true },
  { id: "legy900_2026", label: "Legion Y900 (2026)", base: 0, inquiryOnly: true },
];
const LENOVO_IDEA_TAB_VARIANTS = [
  { id: "ideatabprog2", label: "Idea Tab Pro Gen 2", base: 0, inquiryOnly: true },
  { id: "ideatabstd", label: "Idea Tab (Standard)", base: 0, inquiryOnly: true },
  { id: "yogatab13aura", label: "Yoga Tab 13 (Aura Edition)", base: 0, inquiryOnly: true },
];
const LENOVO_TABPK_VARIANTS = [
  { id: "tabk11plus", label: "Tab K11 Plus", base: 0, inquiryOnly: true },
  { id: "tabp12", label: "Tab P12", base: 0, inquiryOnly: true },
  { id: "tabp11g2", label: "Tab P11 Gen 2", base: 0, inquiryOnly: true },
  { id: "tabk11", label: "Tab K11", base: 0, inquiryOnly: true },
];
const LENOVO_TABM_VARIANTS = [
  { id: "tabplusjbl", label: "Tab Plus (8-speaker JBL)", base: 0, inquiryOnly: true },
  { id: "tabm11", label: "Tab M11", base: 0, inquiryOnly: true },
  { id: "tabm10_5g", label: "Tab M10 (5G)", base: 0, inquiryOnly: true },
  { id: "tabm8g5", label: "Tab M8 (Gen 5)", base: 0, inquiryOnly: true },
];
const LENOVO_THINKTAB_VARIANTS = [
  { id: "thinktabx11", label: "ThinkTab X11", base: 0, inquiryOnly: true },
];
const LENOVO_TAB_SERIES = [
  { id: "lenovo_legion", label: "Legion", year: "Gaming", topPrice: 0, variants: LENOVO_LEGION_TAB_VARIANTS, inquiryOnly: true },
  { id: "lenovo_ideatab", label: "Idea Tab", year: "Productivity", topPrice: 0, variants: LENOVO_IDEA_TAB_VARIANTS, inquiryOnly: true },
  { id: "lenovo_tabpk", label: "Tab P & K", year: "Education", topPrice: 0, variants: LENOVO_TABPK_VARIANTS, inquiryOnly: true },
  { id: "lenovo_tabm", label: "Tab M & Plus", year: "Budget", topPrice: 0, variants: LENOVO_TABM_VARIANTS, inquiryOnly: true },
  { id: "lenovo_thinktab", label: "ThinkTab", year: "Industrial", topPrice: 0, variants: LENOVO_THINKTAB_VARIANTS, inquiryOnly: true },
];
const LENOVO_TAB_MODELS = [
  ...LENOVO_LEGION_TAB_VARIANTS,
  ...LENOVO_IDEA_TAB_VARIANTS,
  ...LENOVO_TABPK_VARIANTS,
  ...LENOVO_TABM_VARIANTS,
  ...LENOVO_THINKTAB_VARIANTS,
];

const ONEPLUS_TAB_MODELS = [
  { id: "oppad2", label: "OnePlus Pad 2" },
  { id: "oppad", label: "OnePlus Pad" },
];

const GOOGLE_TAB_MODELS = [
  { id: "gpixeltab", label: "Pixel Tablet (256GB)" },
  { id: "gpixeltab128", label: "Pixel Tablet (128GB)" },
];

const CONDITIONS = [
  { id: "brandnew", label: "Brand New", desc: "Factory sealed, never activated", multiplier: 1.15, icon: "🆕", details: ["Still in factory original packaging", "Plastic film still on the device and has not been reapplied", "Device is not activated", "Must come with the original box with matching serial number", "Contains all original accessories"] },
  { id: "flawless", label: "Flawless", desc: "Like new, zero signs of use", multiplier: 1.0, icon: "✨", details: ["Zero scratches, scuffs, or other marks — looks like new", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "verygood", label: "Very Good", desc: "Minimal use, no visible scratches at arm's length", multiplier: 0.95, icon: "💎", details: ["Light scratches or scuffs not visible at arm's length — no dents, dings, or deep scratches", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "good", label: "Good", desc: "Light wear, fully functional", multiplier: 0.88, icon: "👍", details: ["Light to moderate signs of wear — few light scratches and/or dents", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "fair", label: "Fair", desc: "Moderate to heavy wear, functional", multiplier: 0.72, icon: "👌", details: ["Moderate to excessive signs of wear — contains heavy scratches and/or dents", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "broken", label: "Broken", desc: "Cracked, defective, or damaged", multiplier: 0.50, icon: "⚠️", details: ["Functionally defective or broken parts on either screen or body", "Cracked display or damaged housing", "Display defects such as dead pixels, white spots, or burn-in", "Shows no signs of liquid intrusion or water damage"] },
];

const ALL_STORAGES = [
  { id: "64", label: "64 GB", multiplier: 0.85 },
  { id: "128", label: "128 GB", multiplier: 1.0 },
  { id: "256", label: "256 GB", multiplier: 1.12 },
  { id: "512", label: "512 GB", multiplier: 1.25 },
  { id: "1tb", label: "1 TB", multiplier: 1.4 },
  { id: "2tb", label: "2 TB", multiplier: 1.55 },
];

const STORAGE_MAP: Record<string, string[]> = {
  // iPhone 17 series — confirmed by Skywalker
  ip17pm: ["256", "512", "1tb", "2tb"],
  ip17p: ["256", "512", "1tb"],
  ip17air: ["256", "512", "1tb"],
  ip17plus: ["256", "512"],
  ip17: ["256", "512"],
  ip17e: ["256"],
  // iPhone 16 series
  ip16pm: ["256", "512", "1tb"],
  ip16p: ["128", "256", "512", "1tb"],
  ip16plus: ["128", "256", "512"],
  ip16: ["128", "256", "512"],
  ip16e: ["128", "256"],
  // iPhone 15 series
  ip15pm: ["256", "512", "1tb"],
  ip15p: ["128", "256", "512", "1tb"],
  ip15plus: ["128", "256", "512"],
  ip15: ["128", "256", "512"],
  // iPhone 14 series
  ip14pm: ["128", "256", "512", "1tb"],
  ip14p: ["128", "256", "512", "1tb"],
  ip14plus: ["128", "256", "512"],
  ip14: ["128", "256", "512"],
  // iPhone 13 series — 13 Pro/PM have 128/256/512/1TB, base 13 has 128/256/512
  ip13pm: ["128", "256", "512", "1tb"],
  ip13p: ["128", "256", "512", "1tb"],
  ip13: ["128", "256", "512"],
  // iPhone 12 series — 12 Pro/PM start 128, base has 64/128/256
  ip12pm: ["128", "256", "512"],
  ip12p: ["128", "256", "512"],
  ip12: ["64", "128", "256"],
  ip12mini: ["64", "128", "256"],
  // iPhone 11 series — Pro/PM skip 128GB
  ip11pm: ["64", "256", "512"],
  ip11p: ["64", "256", "512"],
  ip11: ["64", "128", "256"],
  // Samsung Galaxy
  gs26u: ["256", "512", "1tb"],
  gs26p: ["256", "512"],
  gs26: ["128", "256", "512"],
  gs25u: ["256", "512", "1tb"],
  gs25edge: ["256", "512"],
  gs25p: ["256", "512"],
  gs25: ["128", "256", "512"],
  gs25fe: ["128", "256"],
  gs24u: ["256", "512", "1tb"],
  gs24p: ["256", "512"],
  gs24: ["128", "256"],
  gs23u: ["256", "512", "1tb"],
  gs23p: ["256", "512"],
  gs23: ["128", "256", "512"],
  gs22u: ["128", "256", "512", "1tb"],
  gs22p: ["128", "256"],
  gs22: ["128", "256"],
  gs21u: ["128", "256", "512"],
  gs21p: ["128", "256"],
  gs21: ["128", "256"],
  gs20u: ["128", "256", "512"],
  gs20p: ["128", "256", "512"],
  gs20: ["128"],
  gztrifold: ["512", "1tb"],
  gzfold7: ["256", "512", "1tb"],
  gzfold6: ["256", "512", "1tb"],
  gzfold5: ["256", "512", "1tb"],
  gzfold4: ["256", "512", "1tb"],
  gzfold3: ["256", "512"],
  gzflip7: ["256", "512"],
  gzflip6: ["256", "512"],
  gzflip5: ["256", "512"],
  gzflip4: ["128", "256", "512"],
  gzflip3: ["128", "256"],
  // Google Pixel
  px10pxl: ["128", "256", "512", "1tb"],
  px10p: ["128", "256", "512", "1tb"],
  px10: ["128", "256"],
  px10a: ["128", "256"],
  px10pfold: ["256", "512", "1tb"],
  px9pxl: ["128", "256", "512", "1tb"],
  px9p: ["128", "256", "512", "1tb"],
  px9: ["128", "256"],
  px9a: ["128", "256"],
  px9pfold: ["256", "512"],
  px8p: ["128", "256", "512", "1tb"],
  px8: ["128", "256"],
  px8a: ["128", "256"],
  px7p: ["128", "256", "512"],
  px7: ["128", "256"],
  px7a: ["128"],
  pxfold: ["256", "512"],
  px6p: ["128", "256", "512"],
  px6: ["128", "256"],
  px6a: ["128"],
  px5: ["128"],
  px5a: ["128"],
  // MacBooks — unified memory, storage options
  mbp16m4: ["512", "1tb"],
  mbp14m4: ["512", "1tb"],
  mbp16m3: ["512", "1tb"],
  mbp14m3: ["512", "1tb"],
  mba15m3: ["256", "512", "1tb"],
  mba13m3: ["256", "512", "1tb"],
  mbp16m2: ["512", "1tb"],
  mbp14m2: ["512", "1tb"],
  mba15m2: ["256", "512"],
  mba13m2: ["256", "512"],
  mba13m1: ["256", "512"],
  mbp13m1: ["256", "512"],
  // Samsung Computers
  sgbk4u: ["512", "1tb"],
  sgbk4p: ["512", "1tb"],
  sgbk4pro: ["256", "512"],
  sgbk4: ["256", "512"],
  sgbk3u: ["512", "1tb"],
  sgbk3p: ["512", "1tb"],
  sgbk3pro: ["256", "512"],
  sgbk3: ["256", "512"],
  sgbk2p: ["256", "512"],
  sgbk2: ["256", "512"],
  // Lenovo
  lntp14g5: ["256", "512", "1tb"],
  lntp14g4: ["256", "512", "1tb"],
  lntp14g3: ["256", "512"],
  lnyoga9: ["512", "1tb"],
  lnyoga7: ["256", "512"],
  lnslim7: ["256", "512"],
  lnslim5: ["256", "512"],
  lnlegion7: ["512", "1tb"],
  lnlegion5: ["256", "512", "1tb"],
  lnlegion5g8: ["256", "512"],
  // Dell
  dxps17: ["512", "1tb"],
  dxps15: ["512", "1tb"],
  dxps13: ["256", "512", "1tb"],
  dxps15g23: ["512", "1tb"],
  dxps13g23: ["256", "512"],
  dlat7440: ["256", "512"],
  dlat5540: ["256", "512"],
  dinsp16p: ["256", "512", "1tb"],
  dinsp15: ["256", "512"],
  dinsp14: ["256", "512"],
  // Alienware
  awm18r2: ["512", "1tb"],
  awm16r2: ["512", "1tb"],
  awx16r2: ["512", "1tb"],
  awx14r2: ["512", "1tb"],
  awm18r1: ["512", "1tb"],
  awm16r1: ["512", "1tb"],
  awx16r1: ["512", "1tb"],
  awx14r1: ["256", "512"],
  // HP
  hpspec16: ["512", "1tb"],
  hpspec14: ["512", "1tb"],
  hpspec16g23: ["512", "1tb"],
  hpenvy16: ["512", "1tb"],
  hpenvy15: ["256", "512"],
  hpomen17: ["512", "1tb"],
  hpomen16: ["512", "1tb"],
  hppav15: ["256", "512"],
  hpelite840: ["256", "512"],
  hpprobook: ["256", "512"],
  // Acer
  acswx14: ["512", "1tb"],
  acsw14: ["256", "512"],
  acpred16: ["512", "1tb"],
  acpred18: ["512", "1tb"],
  acnit16: ["256", "512"],
  acnit15: ["256", "512"],
  acasp15: ["256", "512"],
  acasp3: ["128", "256"],
  // LG
  lggr17: ["512", "1tb"],
  lggr16: ["256", "512", "1tb"],
  lggr14: ["256", "512"],
  lggr17g23: ["512", "1tb"],
  lggr16g23: ["256", "512"],
  lggrpro16: ["512", "1tb"],
  lgultgear: ["512", "1tb"],
  // Apple Desktops
  macstudiom4u: ["512", "1tb"],
  macstudiom4m: ["512", "1tb"],
  macstudiom2u: ["512", "1tb"],
  macstudiom2m: ["512", "1tb"],
  macprom2u: ["1tb"],
  macminim4: ["256", "512"],
  macminim4p: ["512", "1tb"],
  macminim2: ["256", "512"],
  macminim1: ["256", "512"],
  imac24m4: ["256", "512", "1tb"],
  imac24m3: ["256", "512", "1tb"],
  imac24m1: ["256", "512"],
  // Dell Desktops
  doptiplex7010: ["256", "512"],
  doptiplex5000: ["256", "512"],
  dxps8960: ["512", "1tb"],
  dxps8950: ["512", "1tb"],
  dinsp3030: ["256", "512"],
  dprecision3680: ["512", "1tb"],
  // Lenovo Desktops
  lnthinkm: ["256", "512"],
  lnthinkm90q: ["256", "512"],
  lnlegion5dtwr: ["512", "1tb"],
  lnlegion7dtwr: ["512", "1tb"],
  lnideactower: ["256", "512"],
  // HP Desktops
  hpelitedesk: ["256", "512"],
  hpprodesk: ["256", "512"],
  hpomendsk: ["512", "1tb"],
  hpomen40: ["512", "1tb"],
  hpenvy34: ["512", "1tb"],
  hppav32: ["256", "512"],
  // Asus Desktops
  asrogstrix: ["512", "1tb"],
  asroghyper: ["1tb"],
  asrogflow: ["512", "1tb"],
  astufgaming: ["512", "1tb"],
  asexperpro: ["256", "512"],
  asnuc14: ["256", "512"],
  // Alienware Desktops
  awaurorar16: ["512", "1tb"],
  awaurorar15: ["512", "1tb"],
  awaurorar13: ["512", "1tb"],
  // MSI Desktops
  msiinfinity: ["1tb"],
  msitrident: ["512", "1tb"],
  msinightblade: ["512", "1tb"],
  msicodex5: ["512", "1tb"],
  msipro: ["256", "512"],
  // iPads
  ipadpro13m5: ["256", "512", "1tb"],
  ipadpro11m5: ["256", "512", "1tb"],
  ipadpro13m4: ["256", "512", "1tb"],
  ipadpro11m4: ["256", "512", "1tb"],
  ipadpro129g6: ["128", "256", "512", "1tb"],
  ipadpro11g4: ["128", "256", "512", "1tb"],
  ipadair13m3: ["128", "256", "512", "1tb"],
  ipadair11m3: ["128", "256", "512", "1tb"],
  ipadair13m2: ["128", "256", "512", "1tb"],
  ipadair11m2: ["128", "256", "512", "1tb"],
  ipad10: ["64", "256"],
  ipad9: ["64", "256"],
  ipadmini7: ["128", "256", "512"],
  ipadmini6: ["64", "256"],
  // Samsung Tablets
  stabs9u: ["256", "512"],
  stabs9p: ["256", "512"],
  stabs9: ["128", "256"],
  stabs8u: ["128", "256"],
  stabs8p: ["128", "256"],
  stabs8: ["128", "256"],
  staba9: ["64", "128"],
  // Surface
  surfpro10: ["256", "512", "1tb"],
  surfpro9: ["128", "256", "512"],
  surfgo4: ["64", "128"],
  surfgo3: ["64", "128"],
  // Lenovo Tabs
  ltabp12: ["128", "256"],
  ltabp11g2: ["128", "256"],
  ltabp11: ["128", "256"],
  ltabm11: ["64", "128"],
  // OnePlus
  oppad2: ["128", "256"],
  oppad: ["128", "256"],
  // Google
  gpixeltab: ["256"],
  gpixeltab128: ["128"],
};

function getStoragesForModel(modelId: string) {
  const valid = STORAGE_MAP[modelId];
  if (!valid) return ALL_STORAGES;
  return ALL_STORAGES.filter(s => valid.includes(s.id));
}

const CARRIERS = [
  { id: "unlocked", label: "Unlocked", multiplier: 1.0, icon: "🔓" },
  { id: "att", label: "AT&T", multiplier: 0.95, icon: "📶" },
  { id: "tmobile", label: "T-Mobile", multiplier: 0.95, icon: "📶" },
  { id: "verizon", label: "Verizon", multiplier: 0.95, icon: "📶" },
  { id: "other", label: "Other / Locked", multiplier: 0.85, icon: "🔒" },
];

const PAYOUTS = [
  { id: "cash", label: "Cash", icon: "💵" },
  { id: "cashapp", label: "Cash App", icon: "💚" },
  { id: "zelle", label: "Zelle", icon: "⚡" },
  { id: "btc", label: "Bitcoin", icon: "₿" },
];

const FAQS = [
  { q: "How does the process work?", a: "Select your device, choose its condition, and get an instant quote. Accept the offer, pick your payout method, and we'll arrange a local pickup in Austin." },
  { q: "How fast will I get paid?", a: "Same day for local Austin pickups. We pay on the spot via your preferred method — Cash, Cash App, Zelle, or BTC." },
  { q: "What if my device is cracked or damaged?", a: "We buy devices in any condition. Damaged phones get a lower offer, but you'll still get cash. Select 'Fair' or 'Poor' condition for an accurate quote." },
  { q: "Are the quotes guaranteed?", a: "Quotes are based on the condition you select. Final price is confirmed during inspection at pickup — if the device matches your description, you get the quoted price." },
  { q: "What devices do you buy?", a: "We buy iPhones (11 and newer) and Samsung Galaxy phones (S21 and newer), including Z Fold and Z Flip models." },
  { q: "Do I need to factory reset my phone?", a: "Yes, please back up your data and factory reset before selling. We'll walk you through it if you need help." },
];

type Step = "device" | "category" | "brand" | "model" | "storage" | "condition" | "carrier" | "quote" | "checkout" | "payout" | "contact" | "done" | "inquiry";
const BRAND_LABELS: Record<string, string> = {
  iphone: "iPhone", android: "Samsung", pixel: "Pixel", ipad: "iPad",
  macbook: "MacBook", samsung_pc: "Samsung", lenovo: "Lenovo", dell: "Dell",
  alienware: "Alienware", hp: "HP", acer: "Acer", lg_pc: "LG",
  apple_desktop: "Apple", dell_desktop: "Dell", lenovo_desktop: "Lenovo",
  hp_desktop: "HP", asus_desktop: "ASUS", alienware_desktop: "Alienware",
  msi_desktop: "MSI", console: "Console", sony: "PlayStation",
  microsoft: "Xbox", nintendo: "Nintendo", applewatch: "Apple Watch",
  pixelwatch: "Pixel Watch", garmin: "Garmin", samsungwatch: "Galaxy Watch",
  dji: "DJI", samsung_tab: "Samsung", surface: "Surface", lenovo_tab: "Lenovo",
  oneplus_tab: "OnePlus", google_tab: "Google", apple_vr: "Apple Vision",
  meta_vr: "Meta Quest", valve_vr: "Valve Index", psvr: "PSVR",
};

type DeviceType = "iphone" | "android" | "pixel" | "macbook" | "samsung_pc" | "lenovo" | "dell" | "alienware" | "hp" | "acer" | "lg_pc" | "apple_desktop" | "dell_desktop" | "lenovo_desktop" | "hp_desktop" | "asus_desktop" | "alienware_desktop" | "msi_desktop" | "console" | "sony" | "microsoft" | "nintendo" | "applewatch" | "pixelwatch" | "garmin" | "samsungwatch" | "dji" | "samsung_tab" | "surface" | "lenovo_tab" | "oneplus_tab" | "google_tab" | "apple_vr" | "meta_vr" | "valve_vr" | "psvr" | "ipad" | null;

function FairPromise() {
  return (
    <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-1">Our Promise</h3>
      <p className="text-base font-bold text-white mb-1">Fair Evaluation Promise</p>
      <p className="text-[#888] text-xs mb-3">Concerned about quote adjustments? Here&apos;s how we handle inspections.</p>
      <div className="space-y-3">
        <div className="flex gap-3"><span className="text-lg">🎯</span><div><p className="text-sm font-semibold text-[#ccc]">Consistent grading</p><p className="text-xs text-[#888]">Every device is evaluated using a standardized process based on the condition you select.</p></div></div>
        <div className="flex gap-3"><span className="text-lg">🤝</span><div><p className="text-sm font-semibold text-[#ccc]">Clear explanations</p><p className="text-xs text-[#888]">If your device differs from what was described, we&apos;ll explain what we found before adjusting your offer.</p></div></div>
        <div className="flex gap-3"><span className="text-lg">🔄</span><div><p className="text-sm font-semibold text-[#ccc]">Your choice</p><p className="text-xs text-[#888]">Don&apos;t agree with the updated offer? We&apos;ll return your device — no questions asked.</p></div></div>
      </div>
    </div>
  );
}

function TrustBadge() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[#888] text-xs">
      <span>⭐ Thousands of happy sellers</span>
      <span>·</span>
      <span>🔒 7-day price lock</span>
      <span>·</span>
      <span>⚡ Same-day payout</span>
      <span>·</span>
      <span>🏠 Austin local</span>
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("device");
  const [category, setCategory] = useState<"phones" | "tablets" | "computers" | "desktops" | "consoles" | "watches" | "drones" | "vr" | null>(null);
  const [deviceType, setDeviceType] = useState<DeviceType>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<typeof CARRIERS[0] | null>(null);
  const [page, setPage] = useState<"home" | "about" | "privacy" | "terms">("home");
  const [model, setModel] = useState<{ id: string; label: string; base: number } | null>(null);
  const [storage, setStorage] = useState<typeof ALL_STORAGES[0] | null>(null);
  const [condition, setCondition] = useState<typeof CONDITIONS[0] | null>(null);
  const [payout, setPayout] = useState<typeof PAYOUTS[0] | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<"choose" | "chat" | "call">("choose");
  const [chatMsg, setChatMsg] = useState("");
  const [chatSent, setChatSent] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ from: "user" | "bot"; text: string }[]>([
    { from: "bot", text: "Hey! I'm here to help you sell your device. Ask me anything about pricing, how it works, or what we buy!" }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  const sendChat = async () => {
    if (!chatMsg.trim()) return;
    const msg = chatMsg;
    setChatMsg("");
    setChatMessages(prev => [...prev, { from: "user", text: msg }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, history: chatMessages }) });
      const data = await res.json();
      setChatMessages(prev => [...prev, { from: "bot", text: data.reply }]);
    } catch {
      setChatMessages(prev => [...prev, { from: "bot", text: "Sorry, something went wrong. Try again or call us!" }]);
    }
    setChatLoading(false);
  };
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [quoteEmail, setQuoteEmail] = useState("");
  const [quoteSaved, setQuoteSaved] = useState(false);
  const [devicePhoto, setDevicePhoto] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [cartItems, setCartItems] = useState<Array<{ model: string; modelId: string; storage: string; condition: string; price: number; quantity: number }>>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [inquiryCategory, setInquiryCategory] = useState("");
  const [inquirySent, setInquirySent] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [inquiryDesc, setInquiryDesc] = useState("");
  const [cookieConsent, setCookieConsent] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [animatedStats, setAnimatedStats] = useState({ devices: 0, payout: 0, time: 0 });

  useEffect(() => {
    const saved = localStorage.getItem("cookie-consent");
    setCookieConsent(saved);
  }, []);

  // Scroll to top whenever step changes (so the new screen starts at the top, not at the button position)
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, page]);

  useEffect(() => {
    const imgs = ["/ipadpro.png", "/ipadair.png", "/ipadmini.png", "/ipadbase.png", "/ipad.png",
      "/iphone17.png", "/iphone16.png", "/iphone15.png", "/iphone14.png", "/iphone13.png", "/iphone12.png", "/iphone11.png",
      "/iphone17air.png", "/iphone17plus.png", "/iphone17e.png", "/iphone17base.png",
      "/iphone16plus.png", "/iphone16base.png", "/iphone16e.png", "/iphone15base.png",
      "/iphone14base.png", "/iphone14plus.png", "/iphone13base.png", "/iphone12base.png", "/iphone12mini.png", "/iphone11base.png"];
    imgs.forEach(src => { const img = new Image(); img.src = src; });
  }, []);

  useEffect(() => {
    if (!statsVisible) return;
    const targets = { devices: 500, payout: 150, time: 24 };
    const duration = 1500;
    const steps = 40;
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current++;
      const progress = current / steps;
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedStats({
        devices: Math.round(targets.devices * ease),
        payout: Math.round(targets.payout * ease),
        time: Math.round(targets.time * ease),
      });
      if (current >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [statsVisible]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tcc-session");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.step && s.step !== "done" && Date.now() - (s.ts || 0) < 7 * 24 * 60 * 60 * 1000) {
          if (s.deviceType) setDeviceType(s.deviceType);
          if (s.selectedSeries) setSelectedSeries(s.selectedSeries);
          if (s.model) setModel(s.model);
          if (s.storage) setStorage(s.storage);
          if (s.condition) setCondition(s.condition);
          if (s.carrier) setCarrier(s.carrier);
          if (s.quantity) setQuantity(s.quantity);
          if (s.email) setEmail(s.email);
          setStep(s.step);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step === "device") { localStorage.removeItem("tcc-session"); return; }
    try {
      localStorage.setItem("tcc-session", JSON.stringify({
        step, deviceType, selectedSeries, model, storage, condition, carrier, quantity, email, ts: Date.now(),
      }));
    } catch {}
  }, [step, deviceType, selectedSeries, model, storage, condition, carrier, quantity, email]);

  const storageMultiplier = storage?.multiplier ?? 1;
  const carrierMultiplier = carrier?.multiplier ?? 1;

  type Promo = { active: boolean; text: string; percent: number; appliesTo: string; minQuantity?: number };
  const [promo, setPromo] = useState<Promo | null>(null);
  useEffect(() => {
    fetch("/promo.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(setPromo).catch(() => setPromo(null));
  }, []);
  const promoApplies = !!(promo?.active && deviceType && (promo.appliesTo === "all" || promo.appliesTo === deviceType) && (!promo.minQuantity || quantity >= promo.minQuantity));
  const promoMultiplier = promoApplies && promo ? 1 + (promo.percent / 100) : 1;

  const [couponCode, setCouponCode] = useState("");
  const [couponPercent, setCouponPercent] = useState(0);
  const [couponLabel, setCouponLabel] = useState("");
  const [couponError, setCouponError] = useState("");
  const couponMultiplier = 1 + (couponPercent / 100);
  const applyCoupon = async () => {
    setCouponError("");
    const code = couponCode.trim().toUpperCase();
    if (!code) { setCouponError("Enter a code"); return; }
    try {
      const res = await fetch("/coupons.json", { cache: "no-store" });
      const data: Record<string, { percent: number; active: boolean; description?: string }> = await res.json();
      const c = data[code];
      if (!c || !c.active) { setCouponError("Invalid or expired code"); return; }
      setCouponPercent(c.percent);
      setCouponLabel(code);
      setCouponError("");
    } catch { setCouponError("Couldn't verify code, try again"); }
  };

  const quote = model && condition ? Math.round(model.base * storageMultiplier * condition.multiplier * carrierMultiplier * promoMultiplier * couponMultiplier) : 0;

  const maxQuoteFor = (v: { id: string; base: number }) => {
    const sids = STORAGE_MAP[v.id];
    const maxStorageMult = sids?.length ? Math.max(...sids.map(sid => ALL_STORAGES.find(s => s.id === sid)?.multiplier ?? 1)) : 1;
    return Math.round(v.base * maxStorageMult * 1.15);
  };
  const maxQuoteForSeries = (vs: { id: string; base: number }[]) => Math.max(...vs.map(maxQuoteFor));

  const pushHistory = useCallback((s: string) => {
    window.history.pushState({ step: s }, "", `#${s}`);
  }, []);

  useEffect(() => {
    const onPop = () => { handleBack(); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  const handleBack = () => {
    if (step === "model" && selectedSeries) { setSelectedSeries(null); return; }
    if (step === "model") { if (category) { setStep("brand"); } else { setStep("category"); } setDeviceType(null); }
    else if (step === "brand") { setStep("category"); setCategory(null); }
    else if (step === "category") { setStep("device"); }
    else if (step === "storage") { setStep("model"); setModel(null); }
    else if (step === "condition") { if (deviceType === "console" || deviceType === "sony" || deviceType === "microsoft" || deviceType === "nintendo" || deviceType === "applewatch" || deviceType === "pixelwatch" || deviceType === "garmin" || deviceType === "samsungwatch" || deviceType === "apple_vr" || deviceType === "meta_vr" || deviceType === "valve_vr" || deviceType === "psvr") { setStep("model"); setModel(null); } else { setStep("storage"); setStorage(null); } }
    else if (step === "carrier") { setStep("condition"); setCondition(null); }
    else if (step === "quote") { if (carrier) { setStep("carrier"); setCarrier(null); } else { setStep("condition"); setCondition(null); } }
    else if (step === "checkout") setStep("quote");
    else if (step === "payout") setStep("checkout");
    else if (step === "contact") setStep("payout"); pushHistory("payout");
  };

  const reset = () => {
    setStep("device");
    setCategory(null);
    setDeviceType(null);
    setSelectedSeries(null);
    setModel(null);
    setStorage(null);
    setCondition(null);
    setCarrier(null);
    setPayout(null);
    setQuantity(1);
    setExpandedFaq(null);
    setPage("home");
    setName("");
    setPhone("");
    setEmail("");
  };

  const iphoneVariants = selectedSeries ? IPHONE_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];
  const ipadVariants = selectedSeries ? IPAD_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];
  const samsungVariants = selectedSeries ? SAMSUNG_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];
  const pixelVariants = selectedSeries ? PIXEL_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];
  const macbookVariants = selectedSeries ? MACBOOK_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];
  const sonyVariants = selectedSeries ? SONY_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];
  const alienwareVariants = selectedSeries ? ALIENWARE_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];
  const lgPcVariants = selectedSeries ? LG_PC_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];
  const lenovoTabVariants = selectedSeries ? LENOVO_TAB_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];
  const surfaceVariants = selectedSeries ? SURFACE_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];

  type Crumb = { label: string; onClick: () => void };
  const breadcrumbs: Crumb[] = [
    { label: "Sell", onClick: () => reset() },
  ];
  if (deviceType) {
    breadcrumbs.push({
      label: BRAND_LABELS[deviceType] || deviceType,
      onClick: () => { setSelectedSeries(null); setModel(null); setStorage(null); setCondition(null); setCarrier(null); setStep("model"); pushHistory("model"); },
    });
  }
  if (selectedSeries) {
    const seriesList = deviceType === "iphone" ? IPHONE_SERIES : deviceType === "android" ? SAMSUNG_SERIES : deviceType === "pixel" ? PIXEL_SERIES : deviceType === "ipad" ? IPAD_SERIES : deviceType === "macbook" ? MACBOOK_SERIES : deviceType === "sony" ? SONY_SERIES : deviceType === "alienware" ? ALIENWARE_SERIES : deviceType === "lg_pc" ? LG_PC_SERIES : deviceType === "lenovo_tab" ? LENOVO_TAB_SERIES : deviceType === "surface" ? SURFACE_SERIES : null;
    const ser = seriesList?.find(s => s.id === selectedSeries);
    if (ser) breadcrumbs.push({
      label: ser.label,
      onClick: () => { setModel(null); setStorage(null); setCondition(null); setCarrier(null); setStep("model"); pushHistory("model"); },
    });
  }
  if (model) breadcrumbs.push({
    label: model.label,
    onClick: () => { setStorage(null); setCondition(null); setCarrier(null); setStep("storage"); pushHistory("storage"); },
  });
  if (storage) breadcrumbs.push({
    label: storage.label,
    onClick: () => { setCondition(null); setCarrier(null); setStep("condition"); pushHistory("condition"); },
  });
  if (condition) breadcrumbs.push({
    label: condition.label,
    onClick: () => { setCarrier(null); const next = (deviceType === "iphone" || deviceType === "android" || deviceType === "pixel") ? "carrier" : "quote"; setStep(next); pushHistory(next); },
  });
  if (carrier) breadcrumbs.push({
    label: carrier.label,
    onClick: () => { setStep("quote"); pushHistory("quote"); },
  });
  const showBreadcrumbs = breadcrumbs.length > 1 && step !== "device" && step !== "category" && page === "home";
  const models = deviceType === "iphone" ? iphoneVariants : deviceType === "android" ? samsungVariants : deviceType === "pixel" ? pixelVariants : deviceType === "macbook" ? macbookVariants : deviceType === "samsung_pc" ? SAMSUNG_PC_MODELS : deviceType === "lenovo" ? LENOVO_MODELS : deviceType === "dell" ? DELL_MODELS : deviceType === "alienware" ? alienwareVariants : deviceType === "hp" ? HP_MODELS : deviceType === "acer" ? ACER_MODELS : deviceType === "lg_pc" ? lgPcVariants : deviceType === "apple_desktop" ? APPLE_DESKTOP_MODELS : deviceType === "dell_desktop" ? DELL_DESKTOP_MODELS : deviceType === "lenovo_desktop" ? LENOVO_DESKTOP_MODELS : deviceType === "hp_desktop" ? HP_DESKTOP_MODELS : deviceType === "asus_desktop" ? ASUS_DESKTOP_MODELS : deviceType === "alienware_desktop" ? ALIENWARE_DESKTOP_MODELS : deviceType === "msi_desktop" ? MSI_DESKTOP_MODELS : deviceType === "console" ? CONSOLE_MODELS : deviceType === "sony" ? sonyVariants : deviceType === "microsoft" ? MICROSOFT_MODELS : deviceType === "nintendo" ? NINTENDO_MODELS : deviceType === "applewatch" ? APPLEWATCH_MODELS : deviceType === "pixelwatch" ? PIXELWATCH_MODELS : deviceType === "garmin" ? GARMIN_MODELS : deviceType === "samsungwatch" ? SAMSUNGWATCH_MODELS :  deviceType === "ipad" ? ipadVariants : [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => { reset(); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Go to homepage" className="cursor-pointer group tap-press rounded-xl">
            <span className="flex items-center gap-2">
              <span className="relative w-9 h-9 rounded-xl tcc-logo-card flex items-center justify-center">
                <span className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: "radial-gradient(circle at 28% 25%, rgba(0,230,118,0.18), transparent 65%)" }}></span>
                <span className="relative w-6 h-6 rounded-lg tcc-logo-tile flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.35))" }}>
                    {/* phone body */}
                    <rect x="6" y="1.5" width="12" height="21" rx="3" />
                    {/* dynamic island */}
                    <rect x="10" y="3" width="4" height="1.4" rx="0.7" fill="#fff" stroke="none" />
                    {/* speaker grille */}
                    <line x1="10.8" y1="3.7" x2="13.2" y2="3.7" strokeWidth="0.6" stroke="#00a039" />
                    {/* screen frame */}
                    <rect x="7.5" y="5.5" width="9" height="13.5" rx="1" stroke="rgba(255,255,255,0.4)" strokeWidth="0.7" />
                    {/* home indicator */}
                    <line x1="10" y1="20.3" x2="14" y2="20.3" strokeWidth="1.6" />
                    {/* side button */}
                    <line x1="5.6" y1="9" x2="5.6" y2="12" strokeWidth="1" />
                  </svg>
                </span>
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-extrabold text-[#1a1100] tcc-logo-coin" style={{ background: "radial-gradient(circle at 30% 30%, #ffe066, #ffb400 70%, #c08a00)", boxShadow: "0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.7)" }}>$</span>
              </span>
              <div className="flex flex-col leading-none">
                <span className="text-[15px] font-black tracking-[-0.02em] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-[#bdbdbd] group-hover:from-[#00e676] group-hover:via-[#00e676] group-hover:to-[#00a039] transition" style={{ fontFeatureSettings: '"ss01", "cv11"' }}>TOP CASH</span>
                <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.32em] uppercase">
                  <span className="block w-1 h-1 rounded-full bg-[#00c853] shadow-[0_0_4px_#00c853]"></span>
                  <span className="text-[#00c853]">Cellular</span>
                </span>
              </div>
            </span>
          </button>
          <div className="flex items-center gap-3">
            <a href="/how-it-works" className="hidden md:inline text-xs text-[#888] hover:text-white transition">How it works</a>
            <a href="/faq" className="hidden md:inline text-xs text-[#888] hover:text-white transition">FAQ</a>
            <a href="/bulk" className="hidden md:inline text-xs text-[#888] hover:text-white transition">Bulk</a>
            <a href="/reviews" className="hidden sm:inline-flex items-center gap-1 text-xs text-[#ffb400] hover:text-[#ffd54f] font-semibold transition"><svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5l2.6 5.5 5.9.7-4.4 4.1 1.2 5.8L10 14.7l-5.3 2.9 1.2-5.8L1.5 7.7l5.9-.7L10 1.5z"/></svg>Reviews</a>
            <a href={`tel:${PHONE_TEL}`} aria-label="Call us" className="bg-[#00c853] text-white px-4 py-2 rounded-full text-xs font-semibold hover:bg-[#00e676] transition">
              Call Us
            </a>
          </div>
        </div>
      </nav>

      {/* BREADCRUMB */}
      {showBreadcrumbs && (
        <div className="bg-[#0a0a0a] border-b border-white/5">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-2 flex items-center gap-1.5 text-xs overflow-x-auto whitespace-nowrap scrollbar-hide">
            {breadcrumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5 flex-shrink-0">
                {i > 0 && <span className="text-[#444]">/</span>}
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-white font-semibold">{c.label}</span>
                ) : (
                  <button onClick={c.onClick} className="text-[#888] hover:text-white hover:underline cursor-pointer transition">{c.label}</button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* STEP: DEVICE TYPE */}
      {step === "device" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          {/* PROMO BANNER (config: public/promo.json) */}
          {promo?.active && promo.text && (
            <div className="px-3 pt-3 pb-1">
              <div className="relative overflow-hidden rounded-full text-center py-2 px-5 mx-auto max-w-fit" style={{ background: "linear-gradient(90deg, #00c853 0%, #00e5ff 50%, #7c4dff 100%)", backgroundSize: "200% 100%", animation: "promoGradient 6s ease-in-out infinite, promoPulse 2.4s ease-in-out infinite" }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)", animation: "promoShimmer 3s ease-in-out infinite" }}></div>
                <p className="relative text-white text-xs font-extrabold tracking-wide drop-shadow whitespace-nowrap">{promo.text}</p>
              </div>
            </div>
          )}
          {/* HERO: Phone → Cash Visual */}
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-4">
            <div className="flex items-center justify-center gap-4 mb-4">
              <img src="/iphone17.png" alt="Phone" width={64} height={64} loading="eager" fetchPriority="high" decoding="async" className="w-16 h-16 object-contain" />
              <div className="flex items-center gap-0.5 animate-pulse">
                <svg className="w-6 h-6 text-[#00c853]" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
                <svg className="w-6 h-6 text-[#00c853]/60" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
                <svg className="w-6 h-6 text-[#00c853]/30" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
              </div>
              <span className="text-4xl">💰</span>
            </div>
          </div>

          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pb-8">
            <h1 className="text-4xl font-bold tracking-tight leading-[1.08] mb-3 hero-fade-up">
              Get top dollar<br />for your device.
            </h1>
            <p className="text-[#888] text-lg mb-1 font-medium hero-fade-up hero-d-1">
              Instant quote. Same-day payout available.
            </p>
            <p className="text-[#888] text-lg mb-6 font-medium hero-fade-up hero-d-2">
              Cash, Cash App, Zelle, or BTC.
            </p>

            <div className="glow-border mb-6 p-[3px] hero-scale-in hero-d-3">
              <button
                onClick={() => { setStep("category"); pushHistory("category"); }}
                className="w-full bg-[#00c853] text-white py-5 rounded-[14px] text-xl font-bold cursor-pointer hover:bg-[#00e676] transition tap-press shadow-lg shadow-[#00c853]/20 relative z-10"
              >
                Sell Your Device
              </button>
            </div>

            <div className="mt-5 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[#888] text-sm">Don&apos;t see your device? <a href={`tel:${PHONE_TEL}`} className="text-[#00c853] font-semibold hover:underline">Contact us</a> and we&apos;ll make you an offer!</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 hero-fade-up hero-d-4">
              <a href="/reviews" className="inline-flex items-center gap-1.5 bg-[#ffb400]/10 text-[#ffb400] text-xs font-semibold px-3 py-1.5 rounded-full border border-[#ffb400]/20 hover:bg-[#ffb400]/15 transition">
                <span className="text-sm leading-none">★</span>
                4.9 — Read reviews
              </a>
              <span className="inline-flex items-center gap-1.5 bg-[#00c853]/15 text-[#00c853] text-xs font-semibold px-3 py-1.5 rounded-full border border-[#00c853]/20">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Best Price Guarantee
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/5 text-[#888] text-xs font-medium px-3 py-1.5 rounded-full border border-white/10">
                Same-Day Payout
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/5 text-[#888] text-xs font-medium px-3 py-1.5 rounded-full border border-white/10">
                Austin Local + Shipping
              </span>
            </div>

            <div className="mt-8 -mx-4">
              <p className="text-[#888] text-xs font-semibold uppercase tracking-wider mb-3 px-4">Popular devices — sell yours today</p>
              <div className="overflow-hidden tcc-marquee-mask">
                <div className="flex gap-3 w-max animate-[marquee_28s_linear_infinite] hover:[animation-play-state:paused]">
                  {(() => {
                    const devices = [
                      { name: "iPhone 16 Pro Max", price: 789, brand: "iphone" as const },
                      { name: "iPhone 15 Pro Max", price: 467, brand: "iphone" as const },
                      { name: "Samsung S24 Ultra", price: 805, brand: "android" as const },
                      { name: "MacBook Pro 16\" M4", price: 1932, brand: "macbook" as const },
                      { name: "PlayStation 5", price: 345, brand: "sony" as const },
                      { name: "iPhone 14 Pro", price: 225, brand: "iphone" as const },
                    ];
                    return [...devices, ...devices].map((d, i) => (
                      <button key={i} onClick={() => { setDeviceType(d.brand); setStep("model"); pushHistory("model"); }} className="flex-shrink-0 w-[260px] flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/10 hover:border-[#00c853]/40 transition cursor-pointer text-left tap-press">
                        <span className="text-white text-xs font-semibold truncate pr-2">{d.name}</span>
                        <span className="text-[#00c853] text-xs font-bold whitespace-nowrap">up to ${d.price.toLocaleString()}</span>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* HOMEPAGE: How it works (3 steps) */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-2 reveal">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight reveal" data-stagger="1">From drawer to dollars in 3 steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { n: 1, icon: "💸", title: "Get an instant quote", body: "Pick your device, condition, and storage. We show you the offer in seconds — no signup needed." },
              { n: 2, icon: "📦", title: "Ship free or drop off", body: "Print our prepaid label, or drop off in Austin. We pay shipping. Insured up to $1,000." },
              { n: 3, icon: "💵", title: "Get paid same-day", body: "Cash, Cash App, Zelle, or BTC. Most payouts hit within 24 hours of arrival." },
            ].map((s, i) => (
              <div key={s.n} className="relative bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] hover:border-[#00c853]/30 transition reveal" data-stagger={Math.min(i + 2, 8)}>
                <div className="absolute -top-3 -left-2 w-9 h-9 rounded-full bg-[#00c853] text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-[#00c853]/30">{s.n}</div>
                <div className="text-4xl mb-3">{s.icon}</div>
                <h3 className="font-bold text-lg mb-1.5">{s.title}</h3>
                <p className="text-[#888] text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* HOMEPAGE: Why people choose us (6-tile trust grid) */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-2 reveal">Why Austin chooses us</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight reveal" data-stagger="1">Trusted by thousands of locals</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { stat: "5,000+", label: "Devices bought", icon: "📲" },
              { stat: "4.9★", label: "Average review rating", icon: "⭐" },
              { stat: "Same-Day", label: "Payouts available", icon: "⚡" },
              { stat: "Free", label: "Shipping nationwide", icon: "📦" },
              { stat: "Higher", label: "Offer than Apple trade-in", icon: "💰" },
              { stat: "Local", label: "Austin-based, real humans", icon: "🤠" },
            ].map((t, i) => (
              <div key={i} className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10 rounded-2xl p-5 text-center hover:border-[#00c853]/30 hover:from-white/[0.12] transition reveal" data-stagger={Math.min(i + 2, 8)}>
                <div className="text-3xl mb-2">{t.icon}</div>
                <div className="text-2xl font-extrabold text-[#00c853] mb-1 leading-none">{t.stat}</div>
                <div className="text-[#888] text-xs font-medium leading-tight">{t.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* HOMEPAGE: Mid-page reinforcement CTA */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-8">
          <div className="bg-gradient-to-r from-[#00c853]/[0.18] via-[#00c853]/[0.10] to-[#00c853]/[0.18] border border-[#00c853]/30 rounded-3xl p-7 md:p-9 text-center reveal">
            <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">Still sitting on that old tech?</h2>
            <p className="text-[#aaa] text-sm md:text-base mb-5">Turn it into cash today. Quote in 30 seconds.</p>
            <button onClick={() => { setStep("category"); pushHistory("category"); }} className="bg-[#00c853] hover:bg-[#00e676] text-white font-bold px-8 py-3.5 rounded-full shadow-lg shadow-[#00c853]/30 transition tap-press cursor-pointer">
              Get my quote →
            </button>
          </div>
        </section>
      )}

      {/* HOMEPAGE: Customer reviews carousel */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto py-10">
          <div className="px-4 flex items-end justify-between mb-6">
            <div>
              <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-1 reveal">Real Austin customers</p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight reveal" data-stagger="1">What people are saying</h2>
            </div>
            <a href="/reviews" className="text-[#00c853] text-sm font-semibold whitespace-nowrap hover:underline">See all →</a>
          </div>
          <div className="overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3 snap-x snap-mandatory">
              {[
                { name: "Marcus T.", loc: "South Austin", text: "Sold my iPhone 14 Pro for $480. Apple offered $230. Same-day cash. Zero BS.", stars: 5 },
                { name: "Priya S.", loc: "Round Rock", text: "Drove in, walked out with cash for my MacBook in 20 minutes. Easiest sale I've ever made.", stars: 5 },
                { name: "Jamal R.", loc: "East Austin", text: "Better offer than Gazelle and IWM. Got the money on Cash App in 15 min after they tested it.", stars: 5 },
                { name: "Sarah M.", loc: "Cedar Park", text: "Shipped my Galaxy S22 Ultra. Free label, instant quote, payout was same-day on Zelle.", stars: 5 },
                { name: "Diego L.", loc: "Pflugerville", text: "Sold my PS5 Pro. They Zelle'd me before my coffee finished brewing. Wild.", stars: 5 },
                { name: "Kelsey W.", loc: "North Austin", text: "Actual Austinites running this — not some bot site. Picked up the phone on the first ring.", stars: 5 },
              ].map((r, i) => (
                <div key={i} className="snap-start flex-shrink-0 w-[280px] md:w-[320px] bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-[#00c853]/30 transition reveal" data-stagger={Math.min(i + 2, 8)}>
                  <div className="flex gap-0.5 mb-3 text-[#ffb400] text-sm">{"★".repeat(r.stars)}</div>
                  <p className="text-white text-sm leading-relaxed mb-4 min-h-[80px]">&ldquo;{r.text}&rdquo;</p>
                  <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00c853] to-[#00a039] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{r.name[0]}</div>
                    <div className="min-w-0">
                      <div className="text-white text-sm font-semibold leading-tight truncate">{r.name}</div>
                      <div className="text-[#888] text-xs truncate">{r.loc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* HOMEPAGE: FAQ accordion */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-2 reveal">Got questions?</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight reveal" data-stagger="1">Things people ask us</h2>
          </div>
          <div className="space-y-2">
            {[
              { q: "How do I get paid?", a: "Choose Cash, Cash App, Zelle, or BTC. Most payouts hit your account within 24 hours of your device arriving — same-day if you drop off in Austin." },
              { q: "Do you ship for free?", a: "Yes — every offer over $50 gets a free prepaid USPS label. We also offer free Austin pickup for local sellers." },
              { q: "What if my device shows up worth less than the quote?", a: "We send you a revised offer. If you don't like it, we ship the device back to you free of charge. No pressure, no surprises." },
              { q: "Are you really in Austin?", a: "Yes — Austin-based and real humans. You can drop off locally for same-day cash, or ship from anywhere in the US." },
              { q: "How fast is the quote?", a: "Instant. Pick your device, condition, and storage and we show you the offer right then. No signup, no email required." },
              { q: "Is my data safe?", a: "We do a certified factory wipe on every device. We also recommend you sign out of iCloud/Google and remove screen locks before shipping." },
            ].map((f, i) => (
              <details key={i} className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition reveal" data-stagger={Math.min(i + 1, 8)}>
                <summary className="cursor-pointer px-5 py-4 flex items-center justify-between font-semibold list-none [&::-webkit-details-marker]:hidden">
                  <span className="pr-3">{f.q}</span>
                  <svg className="w-5 h-5 text-[#00c853] flex-shrink-0 group-open:rotate-180 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="px-5 pb-4 text-[#aaa] text-sm leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* HOMEPAGE: Closing CTA banner */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-10">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0a3d20] via-[#003d1a] to-[#012812] border border-[#00c853]/30 rounded-3xl p-8 md:p-12 text-center reveal">
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "radial-gradient(circle at 30% 20%, rgba(0, 200, 83, 0.4), transparent 60%), radial-gradient(circle at 70% 80%, rgba(0, 230, 118, 0.3), transparent 50%)" }} />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">Swap your old tech for cash today.</h2>
              <p className="text-[#bbb] text-base md:text-lg mb-6">Instant quote · Same-day payout · No signup needed</p>
              <button onClick={() => { setStep("category"); pushHistory("category"); }} className="bg-[#00c853] hover:bg-[#00e676] text-white font-bold text-lg px-10 py-4 rounded-full shadow-lg shadow-[#00c853]/40 transition tap-press cursor-pointer">
                Sell Your Device
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STEP: CATEGORY */}
      {step === "category" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">What are you selling?</h2>
            <p className="text-[#888] text-sm mb-6">Select a category</p>
            <div className="grid grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
              {[
                { id: "phones" as const, label: "Sell Phone", icon: "📱" },
                { id: "tablets" as const, label: "Sell Tablet", icon: "⬜", customIcon: true },
                { id: "computers" as const, label: "Sell Laptop", icon: "💻" },
                { id: "desktops" as const, label: "Sell Desktop", icon: "🖥️" },
                { id: "watches" as const, label: "Sell Smartwatch", icon: "⌚" },
                { id: "consoles" as const, label: "Sell Game Console", icon: "🎮" },
                { id: "drones" as const, label: "Sell Drone", icon: "🛸" },
                { id: "vr" as const, label: "Sell VR", icon: "🥽" },
              ].map((cat, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if ((cat as { direct?: boolean }).direct) {
                      const subs = (cat as { subcats?: string[] }).subcats;
                      setInquiryCategory(subs ? cat.label.replace('Sell ', '') : cat.label.replace('Sell ', ''));
                      setInquirySent(false);
                      setInquiryDesc(subs ? '' : '');
                      setStep("inquiry");
                      pushHistory("inquiry");
                      return;
                    }
                    const dt = (cat as { deviceType?: string }).deviceType;
                    if (dt) { setDeviceType(dt as DeviceType); setStep("model"); pushHistory("model"); return; }
                    setCategory(cat.id); setStep("brand"); pushHistory("brand");
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 transition cursor-pointer tap-press reveal"
                  data-stagger={Math.min(idx + 1, 8)}
                >
                  {(cat as { customIcon?: boolean }).customIcon ? (
                    <svg className="w-8 h-6 mb-1.5 text-white" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="28" height="20" rx="3" /><circle cx="16" cy="22" r="1" fill="currentColor" /></svg>
                  ) : (
                    <span className="text-2xl mb-1.5">{cat.icon}</span>
                  )}
                  <p className="font-semibold text-white text-xs text-center">{cat.label}</p>
                </button>
              ))}
            </div>
            <p className="text-[#777] text-[11px] text-center mt-3">Some categories will connect you to our team for a custom quote</p>
            <div className="text-center mt-2">
              <button
                onClick={() => {
                  setInquiryCategory("Other");
                  setInquirySent(false);
                  setInquiryDesc("");
                  setStep("inquiry");
                  pushHistory("inquiry");
                }}
                className="text-[#888] text-[11px] underline underline-offset-2 hover:text-[#00c853] cursor-pointer transition"
              >
                Sell other
              </button>
            </div>

            <FairPromise />
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: INQUIRY (unknown categories) — full quote flow */}
      {step === "inquiry" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8">
            <button onClick={() => { setStep("category"); pushHistory("category"); }} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">{inquiryCategory === "Other" ? "Tell us what you'd like to sell" : `Sell Your ${inquiryCategory}`}</h2>

            {/* Step 1: Device details */}
            {!condition && !inquirySent && (
              <>
                <p className="text-[#888] text-sm mb-6">Tell us about your device, then we&apos;ll walk you through the same quick process.</p>

                {inquiryCategory === "Smartwatch" && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-[#888] mb-2 uppercase tracking-wider">Select Brand</p>
                    <div className="grid grid-cols-3 gap-2">
                      {["Apple Watch", "Google Pixel Watch", "Garmin"].map((brand) => (
                        <button key={brand} onClick={() => setInquiryDesc(prev => prev.includes(brand) ? prev : brand + (prev ? ' - ' + prev : ''))} className={`p-3 rounded-xl text-xs font-semibold text-center cursor-pointer transition ${inquiryDesc.includes(brand) ? 'bg-[#00c853] text-black' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'}`}>
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Device Details</label>
                    <textarea value={inquiryDesc} onChange={(e) => setInquiryDesc(e.target.value)} required placeholder={`Brand, model, storage size, any issues (e.g. "Samsung Galaxy S24, 256GB, small crack on back")`} rows={3} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition resize-none" />
                  </div>
                  <button
                    onClick={() => { if (inquiryDesc.trim()) { setModel({ id: "custom", label: inquiryDesc.trim(), base: 0 }); } }}
                    disabled={!inquiryDesc.trim()}
                    className="w-full bg-[#00c853] text-white py-4 rounded-2xl text-lg font-semibold cursor-pointer hover:bg-[#00e676] transition tap-press disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next: Select Condition
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Condition selection */}
            {model && !condition && !inquirySent && (
              <>
                <p className="text-[#888] text-sm mb-6">What condition is your device in?</p>
                <div className="space-y-2">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCondition(c)}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/30 cursor-pointer transition text-left tap-press"
                    >
                      <span className="text-2xl">{c.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{c.label}</p>
                        <p className="text-[#888] text-xs">{c.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setModel(null)} className="mt-4 text-[#888] text-sm cursor-pointer hover:text-white transition">← Change device details</button>
              </>
            )}

            {/* Step 3: Contact + Submit (replaces checkout for custom devices) */}
            {model && condition && !inquirySent && (
              <>
                <p className="text-[#888] text-sm mb-2">Almost done! We&apos;ll review your device and send you a quote.</p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                  <p className="text-xs text-[#888] uppercase tracking-wider font-medium mb-2">Your device</p>
                  <p className="text-white font-semibold text-sm">{model.label}</p>
                  <p className="text-[#888] text-xs mt-1">Condition: {condition.label} ({condition.desc})</p>
                </div>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await fetch("/api/lead", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name, phone, email, device: inquiryCategory, model: model.label, storage: "N/A", condition: condition.label, quote: 0, payout: "TBD", notes: "Custom device - full flow submission", photos: photoUrls }),
                    });
                  } catch {}
                  setInquirySent(true);
                }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Phone</label>
                    <input type="tel" value={phone} onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      if (!digits) { setPhone(""); return; }
                      const isDeleting = e.target.value.length < phone.length;
                      if (isDeleting) { setPhone(digits); return; }
                      if (digits.length >= 6) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
                      else if (digits.length >= 3) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3)}`);
                      else setPhone(digits);
                    }} required placeholder="(512) 555-0000" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@email.com" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Photos (optional)</label>
                    <label className={`flex items-center justify-center gap-2 w-full px-4 py-3.5 bg-white/5 border border-white/10 border-dashed rounded-xl text-sm cursor-pointer hover:bg-white/10 transition ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                      <svg className="w-5 h-5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span className="text-[#888]">{uploading ? "Uploading..." : photoUrls.length ? `${photoUrls.length} photo${photoUrls.length > 1 ? "s" : ""} added` : "Add photos of your device"}</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                        const files = e.target.files;
                        if (!files?.length) return;
                        setUploading(true);
                        const urls: string[] = [...photoUrls];
                        for (const file of Array.from(files)) {
                          try {
                            const fd = new FormData();
                            fd.append("file", file);
                            const res = await fetch("/api/upload", { method: "POST", body: fd });
                            const data = await res.json();
                            if (data.url) urls.push(data.url);
                          } catch {}
                        }
                        setPhotoUrls(urls);
                        setUploading(false);
                      }} />
                    </label>
                    {photoUrls.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {photoUrls.map((url, i) => (
                          <div key={i} className="relative">
                            <img src={url} alt={`Photo ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                            <button type="button" onClick={() => setPhotoUrls(photoUrls.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center cursor-pointer">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="submit" disabled={uploading} className="w-full bg-[#00c853] text-white py-4 rounded-2xl text-lg font-semibold cursor-pointer hover:bg-[#00e676] transition tap-press disabled:opacity-40 disabled:cursor-not-allowed">
                    Get My Custom Quote
                  </button>
                </form>
                <button onClick={() => setCondition(null)} className="mt-4 text-[#888] text-sm cursor-pointer hover:text-white transition">← Change condition</button>
              </>
            )}

            {/* Step 4: Confirmation */}
            {inquirySent && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-[#00c853]/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✅</span>
                </div>
                <h3 className="text-xl font-bold mb-2">Submitted!</h3>
                <p className="text-[#888] text-sm mb-2">We&apos;re reviewing your {inquiryCategory === "Other" ? "item" : inquiryCategory.toLowerCase()} and will send you a personalized quote shortly.</p>
                <p className="text-[#888] text-xs mb-6">Most quotes are sent within a few hours.</p>
                <button onClick={reset} className="text-[#00c853] font-semibold text-sm cursor-pointer hover:underline">
                  Sell another device
                </button>
              </div>
            )}

            <FairPromise />
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: BRAND */}
      {step === "brand" && page === "home" && category && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your brand</h2>
            <p className="text-[#888] text-sm mb-6">{category === "phones" ? "Phone brands" : category === "tablets" ? "Tablet brands" : category === "computers" ? "Laptop brands" : category === "desktops" ? "Desktop brands" : category === "watches" ? "Smartwatch brands" : category === "drones" ? "Drone brands" : category === "vr" ? "VR headset brands" : "Console brands"}</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {category === "phones" && [
                { id: "iphone" as const, label: "Apple iPhone", sub: "iPhone 11 and newer", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "android" as const, label: "Samsung Galaxy", sub: "Galaxy S21 and newer", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1428a0"/><text x="20" y="22" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="Arial" letterSpacing="0.5">SAMSUNG</text><rect x="14" y="24" width="12" height="1" rx="0.5" fill="#fff" opacity="0.5"/></svg> },
                { id: "pixel" as const, label: "Google Pixel", sub: "Pixel 5 and newer", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#fff"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#4285F4" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="0"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#EA4335" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-15"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#FBBC05" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-30"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#34A853" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-45"/><text x="20" y="24" textAnchor="middle" fill="#4285F4" fontSize="11" fontWeight="bold" fontFamily="Arial">G</text></svg> },
              ].map((b, i) => (
                <button key={b.id} onClick={() => { setDeviceType(b.id); setStep("model"); pushHistory("model"); }} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press reveal" data-stagger={Math.min(i + 1, 8)}>
                  <span className="flex-shrink-0 mb-2">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#888] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "tablets" && [
                { id: "ipad" as const, label: "Apple", sub: "iPad Pro, Air, Mini, iPad", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "samsung_tab" as const, label: "Samsung", sub: "Galaxy Tab S8, S9, A9+", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1428a0"/><text x="20" y="22" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="Arial" letterSpacing="0.5">SAMSUNG</text><rect x="14" y="24" width="12" height="1" rx="0.5" fill="#fff" opacity="0.5"/></svg> },
                { id: "surface" as const, label: "Microsoft Surface", sub: "Surface Pro, Surface Go", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#00a4ef"/><rect x="11" y="11" width="8" height="8" fill="#f25022"/><rect x="21" y="11" width="8" height="8" fill="#7fba00"/><rect x="11" y="21" width="8" height="8" fill="#00a4ef"/><rect x="21" y="21" width="8" height="8" fill="#ffb900"/></svg> },
                { id: "lenovo_tab" as const, label: "Lenovo", sub: "Tab P12, P11, M11", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#e2231a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">Lenovo</text></svg> },
                { id: "oneplus_tab" as const, label: "OnePlus", sub: "OnePlus Pad, Pad 2", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#eb0028"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="Arial">1+</text></svg> },
                { id: "google_tab" as const, label: "Google", sub: "Pixel Tablet", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#fff"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#4285F4" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="0"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#EA4335" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-15"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#FBBC05" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-30"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#34A853" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-45"/><text x="20" y="24" textAnchor="middle" fill="#4285F4" fontSize="11" fontWeight="bold" fontFamily="Arial">G</text></svg> },
                { id: "other_tab" as const, label: "Other", sub: "Any other tablet", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><rect x="12" y="8" width="16" height="24" rx="3" fill="none" stroke="#fff" strokeWidth="1.5"/><line x1="18" y1="28" x2="22" y2="28" stroke="#fff" strokeWidth="1" strokeLinecap="round"/></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_tab") { setInquiryCategory("Tablet"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#888] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "computers" && [
                { id: "macbook" as const, label: "Apple MacBook", sub: "MacBook Air & Pro, M1+", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "samsung_pc" as const, label: "Samsung", sub: "Galaxy Book 2, 3, 4 series", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1428a0"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Arial">S</text></svg> },
                { id: "dell" as const, label: "Dell", sub: "XPS, Latitude, Inspiron", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#007db8"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="Arial">DELL</text></svg> },
                { id: "alienware" as const, label: "Alienware", sub: "m16, m18, x14, x16", brandIcon: <span className="text-[40px] leading-none">👽</span> },
                { id: "hp" as const, label: "HP", sub: "Spectre, Envy, OMEN, EliteBook", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#0096d6"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">hp</text></svg> },
                { id: "lenovo" as const, label: "Lenovo", sub: "ThinkPad, Yoga, Legion, IdeaPad", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#e2231a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">Lenovo</text></svg> },
                { id: "acer" as const, label: "Acer", sub: "Swift, Predator, Nitro, Aspire", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#83b81a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="Arial">acer</text></svg> },
                { id: "lg_pc" as const, label: "LG", sub: "Gram, Gram Pro, UltraGear", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#a50034"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">LG</text></svg> },
                { id: "other_pc" as const, label: "Other Brand", sub: "Any other computer", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><rect x="11" y="10" width="18" height="14" rx="2" fill="none" stroke="#fff" strokeWidth="1.5"/><line x1="15" y1="28" x2="25" y2="28" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="20" y1="24" x2="20" y2="28" stroke="#fff" strokeWidth="1.5"/></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_pc") { setInquiryCategory("Computer"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#888] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "desktops" && [
                { id: "apple_desktop" as const, label: "Apple", sub: "Mac Studio, Mac Mini, Mac Pro, iMac", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "dell_desktop" as const, label: "Dell", sub: "OptiPlex, XPS, Precision, Inspiron", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#007db8"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="Arial">DELL</text></svg> },
                { id: "lenovo_desktop" as const, label: "Lenovo", sub: "ThinkCentre, Legion Tower, IdeaCentre", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#e2231a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">Lenovo</text></svg> },
                { id: "hp_desktop" as const, label: "HP", sub: "EliteDesk, OMEN, Envy, Pavilion", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#0096d6"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">hp</text></svg> },
                { id: "asus_desktop" as const, label: "Asus", sub: "ROG, TUF Gaming, ExpertCenter, NUC", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1a1a1a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">ASUS</text></svg> },
                { id: "alienware_desktop" as const, label: "Alienware", sub: "Aurora R13, R15, R16", brandIcon: <span className="text-[40px] leading-none">👽</span> },
                { id: "msi_desktop" as const, label: "MSI", sub: "MEG, MAG Trident, Codex, PRO", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#eb1c24"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="Arial">MSI</text></svg> },
                { id: "other_desktop" as const, label: "Other Brand", sub: "Any other desktop", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><rect x="10" y="8" width="20" height="16" rx="2" fill="none" stroke="#fff" strokeWidth="1.5"/><line x1="14" y1="28" x2="26" y2="28" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="20" y1="24" x2="20" y2="28" stroke="#fff" strokeWidth="1.5"/></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_desktop") { setInquiryCategory("Desktop"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#888] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "vr" && [
                { id: "apple_vr" as const, label: "Apple", sub: "Vision Pro", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "meta_vr" as const, label: "Meta", sub: "Quest 2, Quest 3, Quest Pro", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#0668E1"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">META</text></svg> },
                { id: "valve_vr" as const, label: "Valve Index", sub: "Full Kit, Headset Only", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#171a21"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="Arial">VALVE</text></svg> },
                { id: "psvr" as const, label: "PlayStation VR", sub: "PSVR2, PSVR Original", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#003087"/><text x="20" y="24" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">PSVR</text></svg> },
                { id: "other_vr" as const, label: "Other Brand", sub: "HTC Vive, Pico, etc.", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><text x="20" y="24" textAnchor="middle" fill="#fff" fontSize="14">🥽</text></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_vr") { setInquiryCategory("VR Headset"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#888] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "drones" && [
                { id: "dji" as const, label: "DJI", sub: "Mavic, Inspire, Avata, Mini, Air", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1a1a1a"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" fontFamily="Arial">DJI</text></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#888] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "watches" && [
                { id: "applewatch" as const, label: "Apple Watch", sub: "Ultra, Series 7–10, SE", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "samsungwatch" as const, label: "Samsung", sub: "Galaxy Watch Ultra, 5–7", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1428a0"/><text x="20" y="22" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="Arial" letterSpacing="0.5">SAMSUNG</text><rect x="14" y="24" width="12" height="1" rx="0.5" fill="#fff" opacity="0.5"/></svg> },
                { id: "pixelwatch" as const, label: "Google Pixel Watch", sub: "Pixel Watch 1–3", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#fff"/><path d="M29.5 20c0-5.2-4.3-9.5-9.5-9.5-5.2 0-9.5 4.3-9.5 9.5 0 4.5 3.1 8.2 7.3 9.2v-3.7h-2.2V20h2.2v-2c0-2.2 1.3-3.4 3.3-3.4.9 0 1.9.2 1.9.2v2.2h-1.1c-1 0-1.4.6-1.4 1.3V20h2.4l-.4 2.5h-2V29.2c4.2-1 7.3-4.7 7.3-9.2z" fill="none"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#4285F4" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="0"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#EA4335" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-15"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#FBBC05" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-30"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#34A853" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-45"/><text x="20" y="24" textAnchor="middle" fill="#4285F4" fontSize="11" fontWeight="bold" fontFamily="Arial">G</text></svg> },
                { id: "garmin" as const, label: "Garmin", sub: "Fenix, Epix, Forerunner, Venu", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1d4e89"/><text x="20" y="24" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">GARMIN</text></svg> },
                { id: "other_watch" as const, label: "Other Brand", sub: "Fitbit, Amazfit, etc.", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><circle cx="20" cy="20" r="9" fill="none" stroke="#fff" strokeWidth="1.5"/><text x="20" y="24" textAnchor="middle" fill="#fff" fontSize="10">?</text></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_watch") { setInquiryCategory("Smartwatch"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#888] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "consoles" && [
                { id: "sony" as const, label: "Sony", sub: "PlayStation 4, PS4 Pro, PS5", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#003087"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="Arial">SONY</text></svg> },
                { id: "microsoft" as const, label: "Microsoft", sub: "Xbox One, Series S, Series X", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#107c10"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="Arial">XBOX</text></svg> },
                { id: "nintendo" as const, label: "Nintendo", sub: "Switch OLED, Switch V2, Switch Lite", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#e60012"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">Nintendo</text></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => { setDeviceType(b.id); setStep("model"); pushHistory("model"); }} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#888] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* STEP: MODEL SELECTION */}
      {step === "model" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>

            {/* iPhone: Series grid → Variant list */}
            {deviceType === "iphone" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your iPhone</h2>
                <p className="text-[#888] text-sm mb-6">Choose your series</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {IPHONE_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press">
                      {(s as { image?: string }).image && <img src={(s as { image?: string }).image} alt={s.label} width={56} height={56} loading="eager" decoding="async" fetchPriority="high" className="w-14 h-14 object-contain mb-1" />}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">up to ${maxQuoteForSeries(s.variants)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* iPhone: Variant list (after series selected) */}
            {deviceType === "iphone" && selectedSeries && (
              <>
                <h2 className="text-2xl font-bold mb-1">{IPHONE_SERIES.find(s => s.id === selectedSeries)?.label} Series</h2>
                <p className="text-[#888] text-sm mb-6">Pick your exact model</p>
                <div className="space-y-2">
                  {models.map((m) => {
                    const seriesImg = IPHONE_SERIES.find(s => s.id === selectedSeries);
                    const imgSrc = ({ip17pm:"/iphone17.png",ip17p:"/iphone17.png",ip17air:"/iphone17air.png",ip17plus:"/iphone17plus.png",ip17:"/iphone17base.png",ip17e:"/iphone17e.png",ip16pm:"/iphone16.png",ip16p:"/iphone16.png",ip16plus:"/iphone16plus.png",ip16:"/iphone16base.png",ip16e:"/iphone16e.png",ip15pm:"/iphone15.png",ip15p:"/iphone15.png",ip15plus:"/iphone15.png",ip15:"/iphone15base.png",ip14pm:"/iphone14.png",ip14p:"/iphone14.png",ip14plus:"/iphone14plus.png",ip14:"/iphone14base.png",ip13pm:"/iphone13.png",ip13p:"/iphone13.png",ip13:"/iphone13base.png",ip12pm:"/iphone12.png",ip12p:"/iphone12.png",ip12:"/iphone12base.png",ip12mini:"/iphone12mini.png",ip11pm:"/iphone11.png",ip11p:"/iphone11.png",ip11:"/iphone11base.png"} as Record<string,string>)[m.id] || (seriesImg as {image?:string})?.image || null;
                    return (
                    <button key={m.id} onClick={() => { setModel(m); setStep("storage"); pushHistory("storage"); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      {imgSrc && <img src={imgSrc} alt={m.label} className="w-10 h-10 object-contain flex-shrink-0" />}
                      <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">up to ${maxQuoteFor(m)}</span>
                        <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Samsung: Series grid → Variant list */}
            {deviceType === "android" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your Galaxy</h2>
                <p className="text-[#888] text-sm mb-6">Choose your series</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {SAMSUNG_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press">
                      {(s as { image?: string }).image ? (
                        <img src={(s as { image?: string }).image} alt={s.label} width={s.id === "sseries" ? 71 : 64} height={s.id === "sseries" ? 71 : 64} loading="eager" decoding="async" fetchPriority="high" className={`${s.id === "sseries" ? "w-[71px] h-[71px]" : "w-16 h-16"} object-contain mb-1`} />
                      ) : (
                        <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#1428a0"/><text x="20" y="22" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="Arial" letterSpacing="0.5">SAMSUNG</text><rect x="14" y="24" width="12" height="1" rx="0.5" fill="#fff" opacity="0.5"/></svg>
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">up to ${maxQuoteForSeries(s.variants)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Samsung: Variant list (after series selected) */}
            {deviceType === "android" && selectedSeries && (
              <>
                <h2 className="text-2xl font-bold mb-1">{SAMSUNG_SERIES.find(s => s.id === selectedSeries)?.label}</h2>
                <p className="text-[#888] text-sm mb-6">Pick your exact model</p>
                <div className="space-y-2">
                  {models.map((m) => (
                    <button key={m.id} onClick={() => { setModel(m); setStep("storage"); pushHistory("storage"); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">up to ${maxQuoteFor(m as { id: string; base: number })}</span>
                        <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Pixel: Series grid */}
            {deviceType === "pixel" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your Pixel</h2>
                <p className="text-[#888] text-sm mb-6">Choose your series — we&apos;ll send you a custom offer</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {PIXEL_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press">
                      {(s as { image?: string }).image ? (
                        <img src={(s as { image?: string }).image} alt={s.label} width={64} height={64} loading="eager" decoding="async" fetchPriority="high" className="w-16 h-16 object-contain mb-1" />
                      ) : (
                        <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#fff"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#4285F4" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="0"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#EA4335" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-15"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#FBBC05" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-30"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#34A853" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-45"/><text x="20" y="24" textAnchor="middle" fill="#4285F4" fontSize="11" fontWeight="bold" fontFamily="Arial">G</text></svg>
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Pixel: Variant list (after series selected) */}
            {deviceType === "pixel" && selectedSeries && (
              <>
                <h2 className="text-2xl font-bold mb-1">{PIXEL_SERIES.find(s => s.id === selectedSeries)?.label}</h2>
                <p className="text-[#888] text-sm mb-6">Pick your model — we&apos;ll send you a custom offer</p>
                <div className="space-y-2">
                  {models.map((m) => (
                    <button key={m.id} onClick={() => { setInquiryCategory("Google Pixel"); setInquiryDesc(m.label); setInquirySent(false); setStep("inquiry"); pushHistory("inquiry"); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">Get an offer</span>
                        <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* MacBook: Series grid (Pro / Air / 12" Classic) */}
            {deviceType === "macbook" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your MacBook</h2>
                <p className="text-[#888] text-sm mb-6">Choose your family</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {MACBOOK_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px]">
                      {(s as { image?: string }).image ? (
                        <img src={(s as { image?: string }).image} alt={s.label} width={64} height={48} loading="eager" decoding="async" fetchPriority="high" className="w-16 h-12 object-contain mb-1" style={{ backgroundColor: "transparent" }} />
                      ) : (
                        <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg>
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#888] text-[10px]">{s.year}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">{(s as { inquiryOnly?: boolean }).inquiryOnly ? "Get an offer" : `up to $${maxQuoteForSeries(s.variants)}`}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* MacBook: Variant list (after series selected) */}
            {deviceType === "macbook" && selectedSeries && (() => {
              const ser = MACBOOK_SERIES.find(s => s.id === selectedSeries);
              return (
                <>
                  <h2 className="text-2xl font-bold mb-1">{ser?.label}</h2>
                  <p className="text-[#888] text-sm mb-6">Pick your exact model</p>
                  <div className="space-y-2">
                    {models.map((m) => {
                      const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                      return (
                        <button key={m.id} onClick={() => {
                          if (inq) { setInquiryCategory("MacBook"); setInquiryDesc(m.label); setInquirySent(false); setStep("inquiry"); pushHistory("inquiry"); }
                          else { setModel(m); setStep("storage"); pushHistory("storage"); }
                        }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                          <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[#00c853] font-bold text-sm">{inq ? "Get an offer" : `up to $${maxQuoteFor(m as { id: string; base: number })}`}</span>
                            <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {/* iPad: Series grid → Variant list */}
            {deviceType === "ipad" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your iPad</h2>
                <p className="text-[#888] text-sm mb-6">Choose your model line</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {IPAD_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] tap-press">
                      {(s as { image?: string }).image ? (
                        <img src={(s as { image?: string }).image} alt={s.label} width={56} height={56} loading="eager" decoding="async" fetchPriority="high" className="w-14 h-14 object-contain mb-1" />
                      ) : (
                        <svg className="w-10 h-7 mb-1.5 text-white" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="28" height="20" rx="3" /><circle cx="16" cy="22" r="1" fill="currentColor" /></svg>
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">up to ${maxQuoteForSeries(s.variants)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* iPad: Variant list (after series selected) */}
            {deviceType === "ipad" && selectedSeries && (
              <>
                {(() => { const series = IPAD_SERIES.find(s => s.id === selectedSeries); return series ? (
                  <div className="flex items-center gap-4 mb-6">
                    {(series as { image?: string }).image && <img src={(series as { image?: string }).image!} alt={series.label} className="w-20 h-20 object-contain" />}
                    <div>
                      <h2 className="text-2xl font-bold">{series.label}</h2>
                      <p className="text-[#888] text-sm">Pick your exact model</p>
                    </div>
                  </div>
                ) : null; })()}
                <div className="space-y-2">
                  {models.map((m) => (
                    <button key={m.id} onClick={() => { setModel(m); setStep("storage"); pushHistory("storage"); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      <p className="font-semibold text-[15px]">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">up to ${maxQuoteFor(m)}</span>
                        <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* DJI Drones: No pricing, goes to inquiry */}
            {deviceType === "dji" && (
              <>
                <h2 className="text-2xl font-bold mb-1">Select your drone</h2>
                <p className="text-[#888] text-sm mb-6">Choose your DJI model</p>
                <div className="space-y-2">
                  {DJI_MODELS.map((m) => (
                    <button key={m.id} onClick={() => { setInquiryCategory("Drone"); setInquiryDesc(m.label); setInquirySent(false); setStep("inquiry"); pushHistory("inquiry"); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      <p className="font-semibold text-[15px]">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">Get Quote</span>
                        <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Laptop/Desktop: Grid on mobile, list on desktop */}
            {/* LG: 8 family boxes (Gram / 2-in-1 / Style / Ultraslim / Pro / Pro 2-in-1 / Book / UltraGear) */}
            {deviceType === "lg_pc" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your LG laptop</h2>
                <p className="text-[#888] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 gap-3">
                  {LG_PC_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[140px]">
                      <svg className="w-12 h-9 mb-2 text-white" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="2" width="28" height="18" rx="3" />
                        <line x1="10" y1="22" x2="22" y2="22" strokeLinecap="round" />
                        <text x="16" y="14" fill="#a50034" fontSize="6" fontWeight="bold" textAnchor="middle" stroke="none">LG</text>
                      </svg>
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#888] text-[10px]">{s.year}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Lenovo Tab: 5 family boxes (Legion / Idea Tab / Tab P&K / Tab M&Plus / ThinkTab) */}
            {deviceType === "lenovo_tab" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your Lenovo tablet</h2>
                <p className="text-[#888] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 gap-3">
                  {LENOVO_TAB_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[140px]">
                      <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#e2231a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">Lenovo</text></svg>
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#888] text-[10px]">{s.year}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Lenovo Tab: variant list when a series is selected */}
            {deviceType === "lenovo_tab" && selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Lenovo {LENOVO_TAB_SERIES.find(s => s.id === selectedSeries)?.label}</h2>
                <p className="text-[#888] text-sm mb-6">Choose your model</p>
                <div className="space-y-2">
                  {lenovoTabVariants.map((m) => (
                    <button key={m.id} onClick={() => { setInquiryCategory("Tablet"); setInquiryDesc(`Lenovo ${m.label}`); setInquirySent(false); setStep("inquiry"); pushHistory("inquiry"); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      <p className="font-semibold text-[15px]">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">Get Offer</span>
                        <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Surface: 6 family boxes (Pro / Go / Pro X / Book & Studio / Original / Duo) */}
            {deviceType === "surface" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your Surface</h2>
                <p className="text-[#888] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 gap-3">
                  {SURFACE_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[140px]">
                      {s.id === "surf_pro" ? (
                        <img src="/surface-pro-series.webp" alt="Surface Pro" width={64} height={48} loading="eager" decoding="async" fetchPriority="high" className="w-16 h-12 object-contain mb-1" style={{ backgroundColor: "transparent" }} />
                      ) : s.id === "surf_x" ? (
                        <img src="/surface-x-series.webp" alt="Surface Pro X" width={64} height={48} loading="eager" decoding="async" fetchPriority="high" className="w-16 h-12 object-contain mb-1" style={{ backgroundColor: "transparent" }} />
                      ) : (
                        <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#00a4ef"/><rect x="11" y="11" width="8" height="8" fill="#f25022"/><rect x="21" y="11" width="8" height="8" fill="#7fba00"/><rect x="11" y="21" width="8" height="8" fill="#00a4ef"/><rect x="21" y="21" width="8" height="8" fill="#ffb900"/></svg>
                      )}
                      <p className="font-bold text-sm text-center px-1 leading-tight">{s.label}</p>
                      <p className="text-[#888] text-[10px]">{s.year}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Surface: variant list when a series is selected */}
            {deviceType === "surface" && selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Surface {SURFACE_SERIES.find(s => s.id === selectedSeries)?.label}</h2>
                <p className="text-[#888] text-sm mb-6">Choose your model</p>
                <div className="space-y-2">
                  {surfaceVariants.map((m) => (
                    <button key={m.id} onClick={() => { setInquiryCategory("Tablet"); setInquiryDesc(`Microsoft ${m.label}`); setInquirySent(false); setStep("inquiry"); pushHistory("inquiry"); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      <p className="font-semibold text-[15px]">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">Get Offer</span>
                        <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Alienware: 4 family boxes (Flagship / Aurora & X / Ultraslim / M-Series) */}
            {deviceType === "alienware" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your Alienware</h2>
                <p className="text-[#888] text-sm mb-6">Choose your tier</p>
                <div className="grid grid-cols-2 gap-3">
                  {ALIENWARE_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[140px]">
                      <svg className="w-12 h-9 mb-2 text-white" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="2" width="28" height="18" rx="3" />
                        <line x1="10" y1="22" x2="22" y2="22" strokeLinecap="round" />
                        {s.id === "aw_flagship" && <text x="16" y="14" fill="#00c853" fontSize="6" fontWeight="bold" textAnchor="middle" stroke="none">FLAG</text>}
                        {s.id === "aw_aurora" && <text x="16" y="14" fill="#00c853" fontSize="6" fontWeight="bold" textAnchor="middle" stroke="none">AURORA</text>}
                        {s.id === "aw_ultraslim" && <text x="16" y="14" fill="#00c853" fontSize="5" fontWeight="bold" textAnchor="middle" stroke="none">ULTRA</text>}
                        {s.id === "aw_mainstream" && <text x="16" y="14" fill="#00c853" fontSize="6" fontWeight="bold" textAnchor="middle" stroke="none">M-SERIES</text>}
                      </svg>
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#888] text-[10px]">{s.year}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {deviceType !== "iphone" && deviceType !== "ipad" && deviceType !== "dji" && deviceType !== "macbook" && (category === "computers" || category === "desktops") && !(deviceType === "alienware" && !selectedSeries) && !(deviceType === "lg_pc" && !selectedSeries) && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">{deviceType === "alienware" && selectedSeries ? `Alienware — ${ALIENWARE_SERIES.find(s => s.id === selectedSeries)?.label}` : deviceType === "lg_pc" && selectedSeries ? `LG ${LG_PC_SERIES.find(s => s.id === selectedSeries)?.label}` : "Select your model"}</h2>
                <p className="text-[#888] text-sm mb-6">Choose your exact device</p>
                {/* Mobile: grid cards */}
                <div className="grid grid-cols-2 gap-2 md:hidden">
                  {models.map((m) => {
                    const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                    return (
                      <button key={m.id} onClick={() => {
                        if (inq) { setInquiryCategory(category === "computers" ? "Laptop" : "Desktop"); setInquiryDesc(m.label); setInquirySent(false); setStep("inquiry"); pushHistory("inquiry"); }
                        else { setModel(m); setStep("storage"); pushHistory("storage"); }
                      }} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition tap-press">
                        <svg className="w-10 h-7 mb-1.5 text-white" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="28" height="18" rx="3" /><line x1="10" y1="22" x2="22" y2="22" strokeLinecap="round" /></svg>
                        <p className="font-bold text-sm text-center leading-tight">{m.label}</p>
                        <p className="text-[#00c853] font-bold text-xs mt-0.5">{inq ? "Get an offer" : `up to $${maxQuoteFor(m as { id: string; base: number })}`}</p>
                      </button>
                    );
                  })}
                </div>
                {/* Desktop: expanded list */}
                <div className="hidden md:block space-y-2">
                  {models.map((m) => {
                    const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                    return (
                      <button key={m.id} onClick={() => {
                        if (inq) { setInquiryCategory(category === "computers" ? "Laptop" : "Desktop"); setInquiryDesc(m.label); setInquirySent(false); setStep("inquiry"); pushHistory("inquiry"); }
                        else { setModel(m); setStep("storage"); pushHistory("storage"); }
                      }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                        <p className="font-semibold text-[15px]">{m.label}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[#00c853] font-bold text-sm">{inq ? "Get an offer" : `up to $${maxQuoteFor(m as { id: string; base: number })}`}</span>
                          <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* No-price devices (VR + non-Apple/non-Lenovo/non-Surface tablets): goes to inquiry */}
            {(deviceType === "apple_vr" || deviceType === "meta_vr" || deviceType === "valve_vr" || deviceType === "psvr" || deviceType === "samsung_tab" || deviceType === "oneplus_tab" || deviceType === "google_tab") && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your device</h2>
                <p className="text-[#888] text-sm mb-6">Choose your model</p>
                <div className="space-y-2">
                  {(deviceType === "apple_vr" ? APPLE_VR_MODELS : deviceType === "meta_vr" ? META_VR_MODELS : deviceType === "valve_vr" ? VALVE_VR_MODELS : deviceType === "psvr" ? PSVR_MODELS : deviceType === "samsung_tab" ? SAMSUNG_TAB_MODELS : deviceType === "oneplus_tab" ? ONEPLUS_TAB_MODELS : GOOGLE_TAB_MODELS).map((m) => (
                    <button key={m.id} onClick={() => { setInquiryCategory(deviceType?.includes("vr") || deviceType === "psvr" ? "VR Headset" : "Tablet"); setInquiryDesc(m.label); setInquirySent(false); setStep("inquiry"); pushHistory("inquiry"); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      <p className="font-semibold text-[15px]">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">Get Offer</span>
                        <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Sony: PlayStation 5 / PlayStation 4 family picker */}
            {deviceType === "sony" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your PlayStation</h2>
                <p className="text-[#888] text-sm mb-6">Choose your console family</p>
                <div className="grid grid-cols-2 gap-3">
                  {SONY_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[140px]">
                      {(s as { image?: string }).image ? (
                        <img src={(s as { image?: string }).image} alt={s.label} width={56} height={56} loading="eager" decoding="async" fetchPriority="high" className="w-14 h-14 object-contain mb-1" style={{ backgroundColor: "transparent" }} />
                      ) : (
                        <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#003087"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">{s.id === "ps5_family" ? "PS5" : "PS4"}</text></svg>
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#888] text-[10px]">{s.year}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">up to ${maxQuoteForSeries(s.variants)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Other categories (consoles, watches): Flat model list */}
            {deviceType !== "iphone" && deviceType !== "ipad" && deviceType !== "android" && deviceType !== "pixel" && deviceType !== "dji" && deviceType !== "apple_vr" && deviceType !== "meta_vr" && deviceType !== "valve_vr" && deviceType !== "psvr" && deviceType !== "samsung_tab" && deviceType !== "surface" && deviceType !== "lenovo_tab" && deviceType !== "oneplus_tab" && deviceType !== "google_tab" && category !== "computers" && category !== "desktops" && !(deviceType === "sony" && !selectedSeries) && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">{deviceType === "sony" ? (SONY_SERIES.find(s => s.id === selectedSeries)?.label || "Select your model") : "Select your model"}</h2>
                <p className="text-[#888] text-sm mb-6">{deviceType === "sony" ? "Pick your exact variant" : "Choose your exact device"}</p>
                <div className="space-y-2">
                  {models.map((m) => {
                    const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                    return (
                      <button key={m.id} onClick={() => {
                        if (inq) { setInquiryCategory(deviceType === "sony" ? "PlayStation" : "Console"); setInquiryDesc(m.label); setInquirySent(false); setStep("inquiry"); pushHistory("inquiry"); }
                        else { setModel(m); const ns = (deviceType === "console" || deviceType === "sony" || deviceType === "microsoft" || deviceType === "nintendo" || deviceType === "applewatch" || deviceType === "pixelwatch" || deviceType === "garmin" || deviceType === "samsungwatch") ? "condition" : "storage"; setStep(ns); pushHistory(ns); }
                      }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                        <p className="font-semibold text-[15px]">{m.label}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[#00c853] font-bold text-sm">{inq ? "Get an offer" : `up to $${maxQuoteFor(m as { id: string; base: number })}`}</span>
                          <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <FairPromise />
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: STORAGE */}
      {step === "storage" && page === "home" && model && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">Storage capacity?</h2>
            <p className="text-[#888] text-sm mb-6">{model.label}</p>
            <div className="space-y-2">
              {getStoragesForModel(model.id).map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setStorage(s); setStep("condition"); pushHistory("condition"); }}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press"
                >
                  <p className="font-semibold text-[15px]">{s.label}</p>
                  <span className="text-[#00c853] font-bold text-sm">up to ${Math.round(model.base * s.multiplier * 1.15)}</span>
                </button>
              ))}
            </div>
            <FairPromise />
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: CONDITION */}
      {step === "condition" && page === "home" && model && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">Select Condition</h2>
            <p className="text-[#888] text-sm mb-2">{model.label}</p>
            <button className="text-[#00c853] text-xs font-medium mb-4 cursor-pointer hover:underline" onClick={() => { const el = document.getElementById('condition-guide'); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }}>How to assess condition</button>
            <div id="condition-guide" style={{ display: 'none' }} className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 text-xs text-[#aaa] space-y-2">
              <p><strong className="text-white">Brand New:</strong> Sealed in original packaging, never opened</p>
              <p><strong className="text-white">Flawless:</strong> Opened but looks brand new — zero scratches, scuffs, or marks</p>
              <p><strong className="text-white">Very Good:</strong> Minimal signs of use, no scratches visible at arm&apos;s length</p>
              <p><strong className="text-white">Good:</strong> Light scratches on screen or body, fully functional</p>
              <p><strong className="text-white">Fair:</strong> Noticeable wear — scuffs, dents, or cosmetic damage</p>
              <p><strong className="text-white">Broken:</strong> Cracked screen, water damage, or not fully functional</p>
            </div>
            <div className="space-y-3">
              {CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('details') || (e.target as HTMLElement).closest('summary')) return;
                    setCondition(c); const cs = (deviceType === "iphone" || deviceType === "android" || deviceType === "pixel") ? "carrier" : "quote"; if (cs === "quote") { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); } setStep(cs); pushHistory(cs);
                  }}
                  className="group w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press"
                >
                  <span className="text-2xl">{c.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{c.label}</p>
                    <p className="text-[#888] text-sm">{c.desc}</p>
                    {(c as { details?: string[] }).details && (
                      <details className="mt-2">
                        <summary className="text-[#00c853] text-xs cursor-pointer hover:underline">ℹ️ What qualifies?</summary>
                        <ul className="mt-1.5 space-y-1 text-[#999] text-xs list-disc list-inside">
                          {(c as { details?: string[] }).details!.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </details>
                    )}
                  </div>
                  <span className="text-[#00c853] font-bold text-sm">${Math.round(model.base * storageMultiplier * c.multiplier)}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-1">Our Promise</h3>
              <p className="text-base font-bold text-white mb-1">The Top Cash Guarantee</p>
              <p className="text-[#888] text-xs mb-4">Concerned about quote adjustments? Here&apos;s how we handle inspections.</p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="text-lg">🎯</span>
                  <div><p className="text-sm font-semibold text-[#ccc]">Transparent Pricing</p><p className="text-xs text-[#888]">What you see is what you get. Your quote is based on the condition you select — no surprise deductions.</p></div>
                </div>
                <div className="flex gap-3">
                  <span className="text-lg">🤝</span>
                  <div><p className="text-sm font-semibold text-[#ccc]">Honest Inspections</p><p className="text-xs text-[#888]">If anything differs from your description, we&apos;ll walk you through our findings before adjusting.</p></div>
                </div>
                <div className="flex gap-3">
                  <span className="text-lg">🔄</span>
                  <div><p className="text-sm font-semibold text-[#ccc]">No Pressure, No Strings</p><p className="text-xs text-[#888]">Not happy with the final offer? We&apos;ll return your device — no questions asked.</p></div>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-base font-bold text-white mb-3">Why Sellers Choose Top Cash</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">⭐</p>
                  <p className="text-xs text-[#888] mt-1">Thousands of happy sellers</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">⚡</p>
                  <p className="text-xs text-[#888] mt-1">Get paid the same day</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">🔒</p>
                  <p className="text-xs text-[#888] mt-1">Your price is locked 7 days</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">🏠</p>
                  <p className="text-xs text-[#888] mt-1">We meet locally in Austin</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: CARRIER */}
      {step === "carrier" && page === "home" && model && condition && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">Carrier status?</h2>
            <p className="text-[#888] text-sm mb-6">Is your phone unlocked or locked to a carrier?</p>
            <div className="space-y-2">
              {CARRIERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCarrier(c); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); setStep("quote"); pushHistory("quote"); }}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press"
                >
                  <span className="text-xl">{c.icon}</span>
                  <p className="font-semibold text-[15px] flex-1">{c.label}</p>
                  {c.id === "unlocked" && <span className="text-[#00c853] text-xs font-medium">Best value</span>}
                </button>
              ))}
            </div>
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: QUOTE */}
      {step === "quote" && page === "home" && model && condition && (
        <section className="animate-[fadeIn_0.3s_ease-out] relative">
          {showConfetti && (
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
              {Array.from({ length: 60 }).map((_, i) => (
                <div key={i} className="absolute animate-[confettiFall_2.5s_ease-out_forwards]" style={{
                  left: `${Math.random() * 100}%`,
                  top: `-5%`,
                  animationDelay: `${Math.random() * 0.8}s`,
                  width: `${8 + Math.random() * 8}px`,
                  height: `${8 + Math.random() * 8}px`,
                  background: ['#00c853','#00e676','#fff','#76ff03','#ffd600','#ff6d00'][Math.floor(Math.random() * 6)],
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  transform: `rotate(${Math.random() * 360}deg)`,
                }} />
              ))}
            </div>
          )}
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-12 pb-8 text-center">
            <div className="flex items-center justify-center gap-5 mb-2">
              {(() => {
                const imgMap: Record<string, string> = { ip17e: "/iphone17e.png", ip17pm: "/iphone17.png", ip17p: "/iphone17.png", ip17air: "/iphone17air.png", ip17plus: "/iphone17plus.png", ip17: "/iphone17base.png", ip16pm: "/iphone16.png", ip16p: "/iphone16.png", ip16plus: "/iphone16plus.png", ip16: "/iphone16base.png", ip16e: "/iphone16e.png", ip15pm: "/iphone15.png", ip15p: "/iphone15.png", ip15plus: "/iphone15.png", ip15: "/iphone15base.png", ip14pm: "/iphone14.png", ip14p: "/iphone14.png", ip14plus: "/iphone14plus.png", ip14: "/iphone14base.png", ip13pm: "/iphone13.png", ip13p: "/iphone13.png", ip13: "/iphone13base.png", ip12pm: "/iphone12.png", ip12: "/iphone12base.png", ip12mini: "/iphone12mini.png", ip11pm: "/iphone11.png", ip11: "/iphone11base.png", ipadpro13m5: "/ipadpro.png", ipadpro11m5: "/ipadpro.png", ipad10: "/ipadbase.png", ipad9: "/ipadbase.png", ipadair13m3: "/ipadair.png", ipadair11m3: "/ipadair.png", ipadair13m2: "/ipadair.png", ipadair11m2: "/ipadair.png", ipadmini7: "/ipadmini.png", ipadmini6: "/ipadmini.png" };
                const isTablet = deviceType === "ipad";
                const fallbackImg = isTablet ? "/ipad.png" : null;
                const src = imgMap[model.id] || fallbackImg;
                const sizeClass = isTablet ? "w-28 h-28" : "w-20 h-20";
                if (!src) return null;
                if (isTablet) return <img src={src} alt={model.label} className={`${sizeClass} object-contain`} />;
                return <img src={src} alt={model.label} className={`${sizeClass} object-contain`} />;
              })()}
              <div>
                <p className="text-[#888] text-sm font-medium">{model.label} · {storage?.label} · {condition.label}</p>
                <p className="text-5xl font-bold text-[#00c853] mt-1">${quote * quantity}</p>
                {promoApplies && promo && (
                  <p className="text-[10px] mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00c853]/15 text-[#00c853] font-bold">🎉 +{promo.percent}% promo applied</p>
                )}
                {couponPercent > 0 && (
                  <p className="text-[10px] mt-1 ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00c853]/15 text-[#00c853] font-bold">🎟️ {couponLabel} +{couponPercent}%</p>
                )}
              </div>
            </div>
            {quantity > 1 && <p className="text-[#888] text-sm mb-2">${quote} each × {quantity}</p>}
            {quantity === 1 && <div className="mb-3" />}

            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-[#888] text-sm">Quantity:</span>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-white hover:bg-white/10 transition cursor-pointer text-lg font-bold">−</button>
                <span className="px-4 py-2 text-white font-semibold text-sm min-w-[2rem] text-center">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(10, quantity + 1))} className="px-3 py-2 text-white hover:bg-white/10 transition cursor-pointer text-lg font-bold">+</button>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-3">How we compare</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#00c853]">Top Cash Cellular</span>
                  <span className="text-lg font-bold text-[#00c853]">${quote * quantity}</span>
                </div>
                <div className="flex items-center justify-between text-[#888]">
                  <span className="text-sm">Apple Trade-In</span>
                  <span className="text-sm">${Math.round(quote * 0.62 * quantity)}</span>
                </div>
                <div className="flex items-center justify-between text-[#888]">
                  <span className="text-sm">Carrier Trade-In</span>
                  <span className="text-sm">${Math.round(quote * 0.7 * quantity)}</span>
                </div>
              </div>
              <p className="text-[#00c853] text-xs font-semibold mt-3">You make up to ${(quote - Math.round(quote * 0.62)) * quantity} more with us</p>
              <a href={`mailto:offers@topcashcellular.com?subject=Price%20Match%20Request&body=Model%3A%20${encodeURIComponent(model?.label || '')}%0AStorage%3A%20${encodeURIComponent(storage?.label || '')}%0AStorage%3A%20${encodeURIComponent(condition?.label || '')}%0ACompetitor%20URL%3A%20%0ACompetitor%20offer%3A%20%24`} className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00c853]/10 border border-[#00c853]/30 hover:bg-[#00c853]/15 text-[#00c853] text-xs font-bold transition">⚡ Got a higher offer? We&apos;ll beat it by $25</a>
            </div>

            {/* Coupon code */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 text-left">
              <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Have a coupon code?</p>
              {couponLabel ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00c853]/15 border border-[#00c853]/30 text-[#00c853] text-xs font-bold">🎟️ {couponLabel} · +{couponPercent}% applied</span>
                  <button onClick={() => { setCouponPercent(0); setCouponLabel(""); setCouponCode(""); }} className="text-[#888] hover:text-white text-xs underline cursor-pointer">Remove</button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#666] focus:outline-none focus:border-[#00c853] transition uppercase tracking-wide" />
                    <button onClick={applyCoupon} className="px-4 py-2 bg-[#00c853] text-white rounded-xl text-sm font-semibold hover:bg-[#00e676] cursor-pointer transition">Apply</button>
                  </div>
                  {couponError && <p className="text-xs text-red-400 mt-1.5">{couponError}</p>}
                </>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 mb-4">
              <svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <p className="text-[#00c853] text-sm font-semibold">Price locked for 7 days</p>
            </div>

            <div className="flex gap-3">
              <button onClick={handleBack} className="flex-1 bg-white/10 text-white py-4 rounded-2xl text-lg font-semibold cursor-pointer hover:bg-white/15 transition tap-press">
                Back
              </button>
              <button
                onClick={() => {
                  if (model && condition) {
                    setCartItems(prev => {
                      const key = `${model.id}-${storage?.label || ''}-${condition.label}`;
                      const existing = prev.find(i => `${i.modelId}-${i.storage}-${i.condition}` === key);
                      if (existing) return prev.map(i => `${i.modelId}-${i.storage}-${i.condition}` === key ? { ...i, quantity: i.quantity + quantity } : i);
                      return [...prev, { model: model.label, modelId: model.id, storage: storage?.label || 'N/A', condition: condition.label, price: quote, quantity }];
                    });
                  }
                  setStep("checkout"); pushHistory("checkout");
                }}
                className="flex-[2] bg-[#00c853] text-white py-4 rounded-2xl text-lg font-semibold cursor-pointer hover:bg-[#00e676] transition tap-press"
              >
                Add to Cart
              </button>
            </div>

            <div className="mt-6 space-y-3 text-left">
              <div className="flex items-center gap-3"><span className="text-lg">💰</span><span className="text-sm text-[#ccc]">No selling fees</span></div>
              <div className="flex items-center gap-3"><span className="text-lg">🛡️</span><span className="text-sm text-[#ccc]">Zero fraud risk</span></div>
              <div className="flex items-center gap-3"><span className="text-lg">📦</span><span className="text-sm text-[#ccc]">Free shipping via FedEx or UPS</span></div>
              <div className="flex items-center gap-3"><span className="text-lg">⚡</span><span className="text-sm text-[#ccc]">Same-day pickup &amp; 24-hour processing</span></div>
              <div className="flex items-start gap-3">
                <span className="text-lg leading-none">💳</span>
                <div className="flex-1">
                  <p className="text-sm text-[#ccc] mb-2">Get paid your way</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-white/10 text-white text-[10px] font-bold">💵 Cash</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#00d54b] text-white text-[10px] font-bold">Cash App</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#6D1ED4] text-white text-[10px] font-bold">Zelle</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#f7931a] text-white text-[10px] font-bold">₿ BTC</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5 text-left">
              <h3 className="text-base font-bold text-white mb-1">The Top Cash Guarantee</h3>
              <p className="text-[#888] text-xs mb-4">Your device, your terms. Here&apos;s what we stand behind.</p>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[#ccc]">🎯 Transparent Pricing</p>
                  <p className="text-xs text-[#888] mt-1">What you see is what you get. No surprise deductions, no bait-and-switch. Your quote is based on the condition you select.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#ccc]">🤝 Honest Inspections</p>
                  <p className="text-xs text-[#888] mt-1">If anything differs from your description, we&apos;ll walk you through our findings before adjusting — no silent changes.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#ccc]">🔄 No Pressure, No Strings</p>
                  <p className="text-xs text-[#888] mt-1">Changed your mind? Not happy with the final offer? We&apos;ll return your device — no questions asked.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#ccc]">⚡ Same-Day Payout</p>
                  <p className="text-xs text-[#888] mt-1">Austin local? Get paid on the spot. Cash, Cash App, Zelle, or BTC — your call.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5 text-left">
              <h3 className="text-base font-bold text-white mb-4">Why Sellers Choose Top Cash</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">⭐</p>
                  <p className="text-xs text-[#888] mt-1">Thousands of happy sellers</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">⚡</p>
                  <p className="text-xs text-[#888] mt-1">Get paid the same day</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">🔒</p>
                  <p className="text-xs text-[#888] mt-1">Your price is locked 7 days</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">🏠</p>
                  <p className="text-xs text-[#888] mt-1">We meet locally in Austin</p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-xs text-[#888]">Trusted by Austin sellers</p>
              </div>
            </div>

            {!quoteSaved ? (
              <div className="mt-5 bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-[#888] text-xs font-medium mb-3">Not ready yet? Save this quote for later.</p>
                <div className="flex gap-2">
                  <input type="email" value={quoteEmail} onChange={(e) => setQuoteEmail(e.target.value)} placeholder="your@email.com" aria-label="Email for quote" className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] transition" />
                  <button onClick={async () => {
                    if (!quoteEmail) return;
                    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "", phone: "", email: quoteEmail, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, quote, payout: "TBD" }) }); } catch {}
                    setQuoteSaved(true);
                  }} className="bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-white/15 transition tap-press">
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-[#00c853] text-sm font-medium">Quote saved! Check your inbox.</p>
            )}

            <button onClick={reset} className="mt-4 text-[#888] text-sm cursor-pointer hover:text-white transition">
              Start new quote
            </button>
          </div>
        </section>
      )}

      {/* STEP: CHECKOUT (email capture) */}
      {step === "checkout" && page === "home" && model && condition && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{model.label}</p>
                  <p className="text-[#888] text-xs">{storage?.label} · {condition.label}{quantity > 1 ? ` · ×${quantity}` : ''}</p>
                </div>
                <p className="text-[#00c853] font-bold text-xl">${quote * quantity}</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-1">Checkout</h2>

            {/* SECTION 1: ACCOUNT */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-1">Account</h3>
              <p className="text-[#888] text-sm mb-4">You&apos;re one step away from getting paid.</p>

              {/* Guest Checkout */}
              <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Guest Checkout</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!email) return;
                fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Guest", phone: "", email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, quote: quote * quantity, payout: "TBD", quantity }) }).catch(() => {});
                setStep("payout"); pushHistory("payout");
              }} className="space-y-3 mb-4">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                <button type="submit" className="w-full bg-[#00c853] text-white py-4 rounded-2xl text-base font-semibold cursor-pointer hover:bg-[#00e676] transition tap-press">Continue As Guest</button>
              </form>

              <div className="flex items-center gap-3 my-3"><div className="flex-1 h-px bg-white/10" /><span className="text-[#777] text-xs">or</span><div className="flex-1 h-px bg-white/10" /></div>

              {/* Customer Login */}
              <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Customer Login</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!email) return;
                fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Returning User", phone: "", email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, quote: quote * quantity, payout: "TBD", quantity }) }).catch(() => {});
                setStep("payout"); pushHistory("payout");
              }} className="space-y-3 mb-2">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                <input type="password" placeholder="Password" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                <button type="button" className="text-[#00c853] text-xs cursor-pointer hover:underline">Forgot Your Password?</button>
                <button type="submit" className="w-full bg-white/10 text-white py-4 rounded-2xl text-base font-semibold cursor-pointer hover:bg-white/15 transition tap-press">Login</button>
              </form>

              <p className="text-center text-[#777] text-xs my-2">Create An Account</p>

              <div className="flex items-center gap-3 my-3"><div className="flex-1 h-px bg-white/10" /><span className="text-[#777] text-xs">or</span><div className="flex-1 h-px bg-white/10" /></div>

              {/* Continue with Google */}
              <button
                onClick={() => {
                  if (!email) return;
                  fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Google User", phone: "", email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, quote: quote * quantity, payout: "TBD", quantity }) }).catch(() => {});
                  setStep("payout"); pushHistory("payout");
                }}
                className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white py-4 rounded-2xl text-base font-semibold cursor-pointer hover:bg-white/10 transition tap-press"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue With Google
              </button>
            </div>

            {/* SECTION 2: PAYMENT */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-2">Payment</h3>
              <p className="text-[#888] text-xs">Select your payout method after completing account setup.</p>
            </div>

            {/* SECTION 3: SHIPPING */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-2">Shipping</h3>
              <p className="text-[#888] text-xs">Austin local? We meet locally! Or reply for a free prepaid shipping label.</p>
            </div>

            {/* SECTION 4: OPTIONS & TERMS */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-2">Options &amp; Terms</h3>
              <p className="text-[#888] text-xs">By proceeding, you agree that the quoted price is an estimate. Final offer confirmed at inspection based on device condition.</p>
            </div>
          </div>
        </section>
      )}

      {/* STEP: PAYOUT METHOD */}
      {step === "payout" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
              <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Your Cart</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{model?.label}</p>
                  <p className="text-[#888] text-xs">{storage?.label} · {condition?.label}{quantity > 1 ? ` · ×${quantity}` : ''}</p>
                </div>
                <p className="text-[#00c853] font-bold text-xl">${quote * quantity}</p>
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-1">How would you like to get paid?</h2>
            <p className="text-[#888] text-sm mb-6">Select your preferred payout method</p>
            <div className="grid grid-cols-2 gap-3">
              {PAYOUTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPayout(p); setStep("contact"); pushHistory("contact"); }}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[100px] tap-press"
                >
                  <span className="text-3xl mb-2">{p.icon}</span>
                  <p className="font-semibold text-sm">{p.label}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* STEP: CONTACT INFO */}
      {step === "contact" && page === "home" && model && condition && payout && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold">{model.label}</p>
                <p className="text-[#00c853] font-bold text-xl">${quote * quantity}</p>
              </div>
              <p className="text-[#888] text-sm">{storage?.label} · {condition.label} · {payout.label}{quantity > 1 ? ` · ×${quantity}` : ''}</p>
            </div>

            <h2 className="text-xl font-bold mb-1">Almost done</h2>
            <p className="text-[#888] text-sm mb-6">We&apos;ll contact you to arrange pickup &amp; payment</p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch("/api/lead", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, phone, email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, quote: quote * quantity, payout: payout?.label, quantity }),
                });
                if (!res.ok) throw new Error('Failed');
                if (email || phone) {
                  fetch("/api/confirm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, phone, email, model: model?.label, storage: storage?.label, condition: condition?.label, quote: quote * quantity, payout: payout?.label, quantity }),
                  }).catch(() => {});
                }
                localStorage.removeItem("tcc-session"); setStep("done"); pushHistory("done");
              } catch { alert("Something went wrong. Please try again or call us directly."); }
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={50} placeholder="Your name" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Phone</label>
                <input type="tel" value={phone} onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  if (digits.length >= 6) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
                  else if (digits.length >= 3) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3)}`);
                  else setPhone(digits);
                }} required pattern="\(\d{3}\) \d{3}-\d{4}" placeholder="(512) 555-0000" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
              </div>
              {email && <p className="text-[#888] text-xs">Email: {email}</p>}
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Device Photo <span className="normal-case text-[12px]">(optional — speeds up payout)</span></label>
                {!devicePhoto ? (
                  <label className="flex flex-col items-center justify-center w-full h-28 bg-white/5 border-2 border-dashed border-white/15 rounded-xl cursor-pointer hover:bg-white/10 hover:border-[#00c853]/30 transition">
                    <svg className="w-8 h-8 text-[#777] mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-[#777] text-xs">Tap to add a photo</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) { alert("Photo must be under 10MB"); e.target.value = ""; return; }
                        const reader = new FileReader();
                        reader.onload = () => setDevicePhoto(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                ) : (
                  <div className="relative">
                    <img src={devicePhoto} alt="Device" className="w-full h-28 object-cover rounded-xl" />
                    <button type="button" onClick={() => setDevicePhoto(null)} aria-label="Remove photo" className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center cursor-pointer hover:bg-black/80">x</button>
                  </div>
                )}
              </div>
              <p className="text-[#666] text-[11px] text-center leading-relaxed">By submitting, you agree that the quoted price is an estimate. Final offer confirmed at inspection based on device condition.</p>
              <button type="submit" className="w-full bg-[#00c853] text-white py-4 rounded-2xl text-base font-semibold cursor-pointer hover:bg-[#00e676] transition tap-press">
                Submit &amp; Get Paid
              </button>
            </form>
          </div>
        </section>
      )}

      {/* STEP: DONE */}
      {step === "done" && page === "home" && model && condition && payout && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-10 pb-8">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-[#00c853]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✅</span>
              </div>
              <h2 className="text-2xl font-bold mb-1">Okay, I sold! Now what?</h2>
              <p className="text-[#888] text-sm">We&apos;ll contact you within the hour. Here&apos;s your summary:</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-left">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold">{model.label}</p>
                  <p className="text-[#888] text-xs">{storage?.label} · {condition.label} · {payout.label}{quantity > 1 ? ` · ×${quantity}` : ''}</p>
                </div>
                <p className="text-[#00c853] font-bold text-2xl">${quote * quantity}</p>
              </div>
              <div className="border-t border-white/10 pt-3 text-sm text-[#888]">
                <p>{name} · {phone}{email ? ` · ${email}` : ''}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-center">
              <p className="text-[#888] text-sm">📦 Need to ship? You&apos;ll receive an email with shipping instructions shortly.</p>
            </div>

            <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-4 mb-6 text-center">
              <p className="text-[#00c853] font-semibold text-sm">🏠 Austin local? We meet locally — no shipping needed!</p>
            </div>

            <div className="text-center">
              <button onClick={reset} className="text-[#00c853] font-semibold text-sm cursor-pointer hover:underline">
                Sell another device
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TRUST + TESTIMONIALS + FAQ (only on home) */}
      {step === "device" && page === "home" && (
        <>
          {/* HOW IT WORKS — Visual persona example */}
          <section className="py-12 bg-[#0d0d0d]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4">
              <h2 className="text-xl font-bold text-center mb-2">Get your instant quote</h2>
              <p className="text-[#888] text-sm text-center mb-8">Select your device and condition, and get your offer before you say &ldquo;goodbye, clutter&rdquo;</p>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                <p className="text-[#888] text-xs font-medium mb-4 uppercase tracking-wider">Jenny wants to sell her iPhone</p>
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-[#00c853]/15 flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">📱</span>
                    </div>
                    <p className="text-[#888] text-[11px] uppercase tracking-wider font-medium">Device</p>
                    <p className="text-white text-sm font-bold">iPhone 13</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-[#00c853]/15 flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">✨</span>
                    </div>
                    <p className="text-[#888] text-[11px] uppercase tracking-wider font-medium">Condition</p>
                    <p className="text-white text-sm font-bold">Good</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-[#00c853]/15 flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">💰</span>
                    </div>
                    <p className="text-[#888] text-[11px] uppercase tracking-wider font-medium">Offer</p>
                    <p className="text-[#00c853] text-sm font-bold">$190.00</p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#00c853]/10 border border-[#00c853]/20 rounded-xl px-4 py-3">
                  <span className="text-white text-sm font-semibold">Jenny&apos;s payout</span>
                  <span className="text-[#00c853] text-lg font-bold">$190.00</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 mb-2">
                {["Device", "Condition", "Offer"].map((label, i) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#00c853] flex items-center justify-center text-white text-xs font-bold">{i + 1}</div>
                      <span className="text-white text-xs font-semibold">{label}</span>
                    </div>
                    {i < 2 && <svg className="w-4 h-4 text-[#777]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
                  </div>
                ))}
              </div>
              <p className="text-[#777] text-xs text-center">3 steps. 30 seconds. Done.</p>
            </div>
          </section>

          {/* SHIP TO US */}
          <section className="py-12 bg-[#0a0a0a]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4">
              <h2 className="text-xl font-bold text-center mb-2">Not in Austin? Ship to us</h2>
              <p className="text-[#888] text-sm text-center mb-8">Mail your device from anywhere in the US. We pay shipping.</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { num: "1", icon: "📦", title: "Pack", desc: "We send you a free prepaid shipping label" },
                  { num: "2", icon: "✈️", title: "Ship", desc: "Drop it off at any USPS or UPS location" },
                  { num: "3", icon: "💸", title: "Get Paid", desc: "Payment sent same day we receive it" },
                ].map((s) => (
                  <div key={s.num} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#00c853]/15 flex items-center justify-center mx-auto mb-2">
                      <span className="text-lg">{s.icon}</span>
                    </div>
                    <p className="text-white text-sm font-bold mb-1">{s.title}</p>
                    <p className="text-[#888] text-[11px] leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* BOLD STATS COUNTER */}
          <section className="py-14 bg-[#111]" ref={(el) => { if (el && !statsVisible) { const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsVisible(true); obs.disconnect(); } }, { threshold: 0.3 }); obs.observe(el); } }}>
            <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4">
              <p className="text-[#888] text-xs font-semibold uppercase tracking-wider text-center mb-8">Top Cash Cellular by the numbers</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 overflow-hidden">
                  <p className="text-2xl md:text-3xl font-extrabold text-[#00c853] tabular-nums">{animatedStats.devices}+</p>
                  <p className="text-white text-xs font-semibold mt-1">Devices Bought</p>
                  <p className="text-[#888] text-[10px] mt-0.5">and counting</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 overflow-hidden">
                  <p className="text-2xl md:text-3xl font-extrabold text-[#00c853] tabular-nums">${animatedStats.payout}K+</p>
                  <p className="text-white text-xs font-semibold mt-1">Paid Out</p>
                  <p className="text-[#888] text-[10px] mt-0.5">to Austin sellers</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 overflow-hidden">
                  <p className="text-2xl md:text-3xl font-extrabold text-[#00c853] tabular-nums">&lt;{animatedStats.time}h</p>
                  <p className="text-white text-xs font-semibold mt-1">Avg Payout</p>
                  <p className="text-[#888] text-[10px] mt-0.5">from quote to cash</p>
                </div>
              </div>
            </div>
          </section>

          {/* TESTIMONIALS */}
          <section className="py-10 overflow-hidden bg-[#0a0a0a]">
            <p className="text-white font-semibold text-lg text-center mb-6">What sellers say</p>
            <div className="relative">
              <div className="flex animate-[marquee_25s_linear_infinite] gap-4 w-max">
                {[
                  { text: "Got $420 for my iPhone 14 Pro. Way more than the Apple trade-in.", name: "Mike R." },
                  { text: "Zelle payment hit my account same day. Super smooth.", name: "Ashley T." },
                  { text: "They came to me and paid cash on the spot. Can't beat that.", name: "David L." },
                  { text: "Sold my old Galaxy S23 in 5 minutes. Easy money.", name: "Sarah K." },
                  { text: "Best price I found anywhere in Austin. Highly recommend.", name: "Chris M." },
                  { text: "Got $420 for my iPhone 14 Pro. Way more than the Apple trade-in.", name: "Mike R." },
                  { text: "Zelle payment hit my account same day. Super smooth.", name: "Ashley T." },
                  { text: "They came to me and paid cash on the spot. Can't beat that.", name: "David L." },
                  { text: "Sold my old Galaxy S23 in 5 minutes. Easy money.", name: "Sarah K." },
                  { text: "Best price I found anywhere in Austin. Highly recommend.", name: "Chris M." },
                ].map((r, i) => (
                  <div key={i} className="flex-shrink-0 w-[260px] bg-white/5 rounded-2xl p-4 border border-white/10">
                    <p className="text-sm text-white/85 font-medium mb-2">&ldquo;{r.text}&rdquo;</p>
                    <p className="text-xs text-[#888]">— {r.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* PAYMENT TIMELINE */}
          <section className="py-12 bg-[#0d0d0d]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto">
              <h2 className="text-xl font-bold text-center mb-2 px-4">When do I get paid?</h2>
              <p className="text-[#888] text-sm text-center mb-8 px-4">Transparent timelines. No surprises.</p>
              <div className="overflow-hidden tcc-marquee-mask">
                <div className="flex gap-3 w-max animate-[marquee_32s_linear_infinite] hover:[animation-play-state:paused]">
                  {[...Array(2)].flatMap((_, dup) => [
                    { method: "Local Pickup", icon: "🏠", timeline: "Same day", desc: "We meet in Austin. Inspect device. Pay on the spot.", highlight: true },
                    { method: "Cash", icon: "💵", timeline: "Instant", desc: "Handed to you at pickup. Immediate.", highlight: false },
                    { method: "Cash App / Zelle", icon: "⚡", timeline: "Under 5 min", desc: "Sent while you watch. Hits your account instantly.", highlight: false },
                    { method: "Bitcoin (BTC)", icon: "₿", timeline: "Under 30 min", desc: "Sent on-chain to your wallet. Confirmation in minutes.", highlight: false },
                    { method: "Ship To Us", icon: "📦", timeline: "Same day received", desc: "We inspect and pay within hours of receiving your device.", highlight: false },
                  ].map((p, i) => (
                    <div key={`${dup}-${i}`} className={`flex-shrink-0 w-[280px] flex items-start gap-3 rounded-2xl p-4 border ${p.highlight ? "bg-[#00c853]/10 border-[#00c853]/30" : "bg-white/5 border-white/10"}`}>
                      <span className="text-2xl shrink-0">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-white text-sm font-bold">{p.method}</p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${p.highlight ? "bg-[#00c853]/20 text-[#00c853]" : "bg-white/10 text-[#aaa]"}`}>{p.timeline}</span>
                        </div>
                        <p className="text-[#888] text-xs leading-snug">{p.desc}</p>
                      </div>
                    </div>
                  )))}
                </div>
              </div>
            </div>
          </section>

          {/* CTA SECTION */}
          <section className="py-16 bg-[#0a0a0a] text-center">
            <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4">
              <div className="bg-gradient-to-br from-[#00c853]/10 to-transparent border border-[#00c853]/20 rounded-3xl p-8">
                <p className="text-4xl mb-3">💸</p>
                <h2 className="text-3xl font-bold mb-2">Still sitting on old tech?</h2>
                <p className="text-[#888] text-base mb-2">That phone in your drawer is losing value every day.</p>
                <p className="text-white/70 text-sm mb-6">Get your instant quote — it takes 30 seconds.</p>
                <button onClick={() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; setStep("category"); pushHistory("category"); requestAnimationFrame(() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }); }} className="bg-[#00c853] text-white px-10 py-4 rounded-2xl text-lg font-bold cursor-pointer hover:bg-[#00e676] transition tap-press shadow-lg shadow-[#00c853]/20">
                  Get Your Quote Now
                </button>
                <p className="text-[#777] text-xs mt-4">No account required · Free instant quote · No obligation</p>
              </div>
            </div>
          </section>

          {/* NEWSLETTER CAPTURE */}
          <section className="py-12 bg-[#0d0d0d]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <p className="text-xl mb-2">📬</p>
                <h3 className="text-lg font-bold mb-1">Get price alerts &amp; deals</h3>
                <p className="text-[#888] text-sm mb-4">We&apos;ll let you know when buyback prices go up or we run a promo. No spam — just money.</p>
                {newsletterSubmitted ? (
                  <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-xl p-4">
                    <p className="text-[#00c853] font-semibold text-sm">You&apos;re in! We&apos;ll keep you posted.</p>
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newsletterEmail.trim()) return;
                    try {
                      await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Newsletter Signup", email: newsletterEmail, phone: "", device: "Newsletter", notes: "Homepage newsletter signup" }) });
                    } catch {}
                    setNewsletterSubmitted(true);
                  }} className="flex gap-2">
                    <input type="email" value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)} placeholder="your@email.com" required aria-label="Email for newsletter" className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] transition" />
                    <button type="submit" className="bg-[#00c853] text-white px-6 py-3 rounded-xl text-sm font-bold cursor-pointer hover:bg-[#00e676] transition tap-press whitespace-nowrap">
                      Sign Up
                    </button>
                  </form>
                )}
                <p className="text-[#777] text-[11px] mt-3">Unsubscribe anytime. We respect your inbox.</p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-12 bg-[#111]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4">
              <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
              <div className="space-y-2">
                {FAQS.map((faq, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 cursor-pointer text-left">
                      <p className="font-semibold text-sm pr-4">{faq.q}</p>
                      <svg className={`w-4 h-4 text-[#888] shrink-0 transition-transform ${expandedFaq === i ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {expandedFaq === i && (
                      <div className="px-4 pb-4 animate-[fadeIn_0.2s_ease-out]">
                        <p className="text-[#888] text-sm">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* GREEN / SUSTAINABILITY */}
          <section className="py-12 bg-[#0a0a0a]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4">
              <div className="bg-[#00c853]/5 border border-[#00c853]/15 rounded-2xl p-6 text-center">
                <p className="text-2xl mb-2">♻️</p>
                <h3 className="text-lg font-bold mb-1">Good for your wallet. Better for the planet.</h3>
                <p className="text-[#888] text-sm leading-relaxed">Every device we buy gets a second life — refurbished and reused, not dumped in a landfill. Selling your old tech with Top Cash Cellular keeps electronics out of waste streams and puts cash in your pocket.</p>
              </div>
            </div>
          </section>

          {/* LOCAL CREDIBILITY */}
          <section className="py-8 bg-[#111]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4">
              <div className="flex flex-wrap items-center justify-center gap-4 text-center">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <span className="text-sm">📍</span>
                  <span className="text-white text-xs font-semibold">Austin-Based Business</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <span className="text-sm">🤝</span>
                  <span className="text-white text-xs font-semibold">Real People, Local Meetups</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <span className="text-sm">⚡</span>
                  <span className="text-white text-xs font-semibold">Same-Day Payout</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <span className="text-sm">🔒</span>
                  <span className="text-white text-xs font-semibold">Secure Transactions</span>
                </div>
              </div>
            </div>
          </section>

          {/* BULK / BUSINESS SELLING */}
          <section className="py-12 bg-[#0a0a0a]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="text-center mb-4">
                  <p className="text-2xl mb-2">🏢</p>
                  <h3 className="text-lg font-bold">Selling in bulk?</h3>
                  <p className="text-[#888] text-sm">Upgrading your office, school, or fleet? We buy devices in bulk with custom pricing.</p>
                </div>
                <button
                  onClick={() => { setInquiryCategory("Bulk / Business"); setInquirySent(false); setInquiryDesc(""); setModel(null); setCondition(null); setStep("inquiry"); pushHistory("inquiry"); }}
                  className="w-full bg-[#00c853] text-white py-3 rounded-xl text-sm font-bold cursor-pointer hover:bg-[#00e676] transition tap-press"
                >
                  Get a Bulk Quote
                </button>
                <p className="text-[#777] text-[11px] text-center mt-3">10+ devices? We&apos;ll make you a custom offer.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* INNER PAGES */}
      {(page === "about" || page === "privacy" || page === "terms") && (
        <section className="min-h-[60vh] animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6 pb-16">
            <button onClick={() => { setPage("home"); window.scrollTo({ top: 0 }); }} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Home
            </button>
            {page === "about" && <div className="animate-[fadeIn_0.3s_ease-out]">
              <h1 className="text-3xl font-bold mb-2">About Top Cash Cellular</h1>
              <p className="text-[#00c853] text-sm font-semibold mb-6">Austin&apos;s #1 Device Buyback Service</p>

              <div className="bg-gradient-to-br from-[#00c853]/10 to-transparent border border-[#00c853]/20 rounded-2xl p-6 mb-8">
                <p className="text-white text-lg font-medium leading-relaxed mb-3">We started Top Cash Cellular with a simple idea: selling your phone shouldn&apos;t be a hassle.</p>
                <p className="text-[#888] text-sm leading-relaxed">No lowball carrier trade-ins. No mailing your device and waiting weeks for a check. No haggling with strangers on marketplace apps. Just a fair price, paid fast, from a team you can trust.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">500+</p>
                  <p className="text-[#888] text-xs mt-1">Devices Purchased</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">4.9★</p>
                  <p className="text-[#888] text-xs mt-1">Customer Rating</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">Same Day</p>
                  <p className="text-[#888] text-xs mt-1">Payment</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">38%</p>
                  <p className="text-[#888] text-xs mt-1">More Than Trade-In</p>
                </div>
              </div>

              <h2 className="text-xl font-bold mb-4">Why sell to us?</h2>
              <div className="space-y-3 mb-8">
                {[
                  { icon: "💰", title: "Highest payouts in Austin", desc: "We consistently beat Apple, carrier, and marketplace prices by 20-40%. Get a quote and compare." },
                  { icon: "⚡", title: "Paid on the spot", desc: "Cash, Cash App, Zelle, or BTC — your choice. No waiting for checks or bank transfers." },
                  { icon: "🤝", title: "Local & personal", desc: "We meet you at a convenient Austin location. Face-to-face, safe, and quick. 5 minutes and you're done." },
                  { icon: "📦", title: "Nationwide shipping", desc: "Not in Austin? No problem. We send a free prepaid label. Ship your device, get paid same day we receive it." },
                  { icon: "📱", title: "We buy everything", desc: "iPhones, Samsung Galaxy, MacBooks, PS5, Xbox, Nintendo Switch. Working, cracked, or water damaged." },
                  { icon: "🔒", title: "7-day price lock", desc: "Your quote is locked for 7 days. Take your time deciding — the price won't change." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 bg-white/5 rounded-2xl p-4 border border-white/10">
                    <span className="text-2xl shrink-0">{item.icon}</span>
                    <div>
                      <p className="font-semibold text-sm mb-0.5">{item.title}</p>
                      <p className="text-[#888] text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-bold mb-4">How it works</h2>
              <div className="space-y-3 mb-8">
                {[
                  { num: "1", title: "Get an instant quote", desc: "Select your device, model, storage, and condition. See your price in 30 seconds." },
                  { num: "2", title: "Choose how to sell", desc: "Meet us locally in Austin or ship your device for free from anywhere in the US." },
                  { num: "3", title: "Get paid instantly", desc: "We verify your device and pay you on the spot. Cash, Cash App, Zelle, or BTC." },
                ].map((step) => (
                  <div key={step.num} className="flex items-start gap-4 bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="w-8 h-8 rounded-full bg-[#00c853] flex items-center justify-center text-white text-sm font-bold shrink-0">{step.num}</div>
                    <div>
                      <p className="font-semibold text-sm mb-0.5">{step.title}</p>
                      <p className="text-[#888] text-sm leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
                <p className="text-lg font-bold mb-2">Ready to sell?</p>
                <p className="text-[#888] text-sm mb-4">Get your instant quote in 30 seconds.</p>
                <button onClick={() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; setPage("home"); setStep("category"); pushHistory("category"); requestAnimationFrame(() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }); }} className="bg-[#00c853] text-white px-8 py-3 rounded-2xl font-semibold cursor-pointer hover:bg-[#00e676] transition tap-press">
                  Get My Quote
                </button>
              </div>

              <div className="mt-8 text-center">
                <p className="text-[#888] text-sm mb-1">Questions? Call us anytime.</p>
                <a href={`tel:${PHONE_TEL}`} className="text-[#00c853] font-bold text-lg">{PHONE}</a>
              </div>
            </div>}

            {page === "privacy" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
                <div className="text-[#888] text-sm space-y-4 leading-relaxed">
                  <p>Top Cash Cellular respects your privacy. We collect only the information needed to process your device sale: name, phone number, email, device details, and payout preference.</p>
                  <p>We do not sell, share, or distribute your personal information to third parties. Your data is used solely to complete your transaction and communicate with you about your sale.</p>
                  <p>Device data (photos, files) is your responsibility to remove before selling. We recommend a factory reset before handoff. We are not responsible for any data left on sold devices.</p>
                  <p>For questions about your data, contact us at {PHONE}.</p>
                </div>
              </div>
            )}

            {page === "terms" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
                <div className="text-[#888] text-sm space-y-4 leading-relaxed">
                  <p>By using Top Cash Cellular, you agree to these terms. Quotes provided on our site are estimates based on the condition and model you select. Final pricing is confirmed during in-person inspection.</p>
                  <p>All devices sold to us must be legally owned by the seller. Stolen devices will be reported to law enforcement. Sellers must provide valid identification at the time of sale.</p>
                  <p>Payouts are processed via your selected method (Cash, Cash App, Zelle, BTC) at the time of device inspection and acceptance. We reserve the right to adjust offers if the device condition differs from the online assessment.</p>
                  <p>All sales are final once payment is issued. Top Cash Cellular is not responsible for data left on sold devices. Please factory reset your device before selling.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="mt-auto bg-[#060606] text-[#888] py-10 border-t border-white/10">
        <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Company</p>
              <div className="space-y-2">
                <button onClick={() => { setPage("about"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-white transition cursor-pointer">About Us</button>
                <a href="/reviews" className="block text-xs hover:text-white transition">Reviews</a>
                <a href={`tel:${PHONE_TEL}`} className="block text-xs hover:text-white transition">Contact</a>
                <a href="/privacy" className="block text-xs hover:text-white transition">Privacy Policy</a>
                <button onClick={() => { setPage("terms"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-white transition cursor-pointer">Terms of Service</button>
              </div>
            </div>
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Service</p>
              <div className="space-y-2">
                <p className="text-xs">Austin, TX</p>
                <p className="text-xs">Mon-Sat 8AM-8PM</p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center">
            <p className="text-[11px] text-[#888]/60 mb-3">© 2026 {BRAND}</p>
            <div className="flex items-center justify-center gap-4">
              <a href="/privacy" className="text-[11px] text-[#777] hover:text-[#888] transition">Privacy Policy</a>
              <span className="text-[11px] text-[#333]">·</span>
              <a href="https://atxgadgetfix.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#777] hover:text-[#888] transition">
                Need a repair? ATX Gadget Fix →
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* CHAT WIDGET */}
      <div className="fixed bottom-6 left-6 z-50">
        {chatOpen && (
          <div className="mb-3 w-[300px] bg-[#111] border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-[#00c853] px-4 py-3 flex items-center justify-between">
              <p className="text-white font-semibold text-sm">Top Cash Cellular</p>
              <button onClick={() => setChatOpen(false)} aria-label="Close chat" className="text-white/80 hover:text-white cursor-pointer text-lg">×</button>
            </div>
            <div className="p-4">
              {chatMode === "choose" && (
                <>
                  <p className="text-white text-sm mb-4">Hey! Got a device to sell? How can we help?</p>
                  <div className="space-y-2">
                    <button onClick={() => setChatMode("chat")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition text-left tap-press">
                      <span className="text-xl">💬</span>
                      <div><p className="font-semibold text-sm">Live Chat</p><p className="text-[#888] text-xs">Send us a message</p></div>
                    </button>
                    <button onClick={() => setChatMode("call")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition text-left tap-press">
                      <span className="text-xl">📞</span>
                      <div><p className="font-semibold text-sm">Talk to a Human</p><p className="text-[#888] text-xs">Call or get a callback</p></div>
                    </button>
                  </div>
                </>
              )}
              {chatMode === "chat" && (
                <>
                  <button onClick={() => setChatMode("choose")} className="text-[#888] text-xs mb-2 cursor-pointer hover:text-white">← Back</button>
                  <div className="h-[200px] overflow-y-auto space-y-2 mb-2 pr-1">
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${m.from === "user" ? "bg-[#00c853] text-white" : "bg-white/10 text-white/90"}`}>{m.text}</div>
                      </div>
                    ))}
                    {chatLoading && <div className="flex justify-start"><div className="bg-white/10 text-white/60 px-3 py-2 rounded-xl text-xs">Typing...</div></div>}
                  </div>
                  <div className="flex gap-2">
                    <input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Ask me anything..." aria-label="Chat message" className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853]" />
                    <button onClick={sendChat} disabled={chatLoading} aria-label="Send message" className="bg-[#00c853] text-white px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer hover:bg-[#00e676] transition disabled:opacity-50">Send</button>
                  </div>
                </>
              )}
              {chatMode === "call" && (
                <div className="text-center py-2">
                  <button onClick={() => setChatMode("choose")} className="text-[#888] text-xs mb-3 cursor-pointer hover:text-white block mx-auto">← Back</button>
                  <a href={`tel:${PHONE_TEL}`} className="block w-full bg-[#00c853] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#00e676] transition text-center mb-2">📞 Call {PHONE}</a>
                  <p className="text-[#888] text-xs">Mon-Sat 8AM-8PM</p>
                </div>
              )}
            </div>
          </div>
        )}
        <button onClick={() => setChatOpen(!chatOpen)} className="w-14 h-14 rounded-full bg-[#00c853] text-white flex items-center justify-center shadow-lg hover:bg-[#00e676] transition cursor-pointer tap-press">
          {chatOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          )}
        </button>
      </div>

      {/* CART WIDGET — only visible when items in cart */}
      {cartItems.length > 0 && <div className="fixed bottom-6 right-6 z-50">
        {cartOpen && (
          <div className="mb-3 w-[320px] bg-[#111] border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-[#00c853] px-4 py-3 flex items-center justify-between">
              <p className="text-black font-semibold text-sm">Your Cart ({cartItems.reduce((sum, i) => sum + i.quantity, 0)} items)</p>
              <button onClick={() => setCartOpen(false)} aria-label="Close cart" className="text-black/60 hover:text-black cursor-pointer text-lg font-bold">×</button>
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[#888] text-sm">Your cart is empty</p>
                  <p className="text-[#777] text-xs mt-2">Get a quote and add a device!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cartItems.map((item, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-sm text-white">{item.model}</p>
                          <button onClick={() => setCartItems(prev => prev.filter((_, idx) => idx !== i))} className="text-[#888] hover:text-red-400 text-xs cursor-pointer">Remove</button>
                        </div>
                        <p className="text-[#888] text-xs">{item.storage} · {item.condition}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCartItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))} className="w-6 h-6 rounded bg-white/10 text-white text-xs flex items-center justify-center cursor-pointer hover:bg-white/20">−</button>
                            <span className="text-white text-sm font-semibold">{item.quantity}</span>
                            <button onClick={() => setCartItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.min(10, it.quantity + 1) } : it))} className="w-6 h-6 rounded bg-white/10 text-white text-xs flex items-center justify-center cursor-pointer hover:bg-white/20">+</button>
                          </div>
                          <p className="text-[#00c853] font-bold text-sm">${item.price * item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-white/10 mt-3 pt-3 flex items-center justify-between">
                    <p className="text-[#888] text-sm">Total</p>
                    <p className="text-[#00c853] font-bold text-lg">${cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)}</p>
                  </div>
                  <button
                    onClick={() => { setCartOpen(false); setStep("checkout"); pushHistory("checkout"); }}
                    className="w-full mt-3 bg-[#00c853] text-black py-3 rounded-xl text-sm font-bold cursor-pointer hover:bg-[#00e676] transition tap-press"
                  >
                    Checkout
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <button onClick={() => setCartOpen(!cartOpen)} className="w-14 h-14 rounded-full bg-[#00c853] text-black flex items-center justify-center shadow-lg hover:bg-[#00e676] transition cursor-pointer tap-press relative">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
          {cartItems.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">{cartItems.reduce((sum, i) => sum + i.quantity, 0)}</span>
          )}
        </button>
      </div>}

      {/* PROGRESS BAR — shows during flow */}
      {step !== "device" && step !== "done" && page === "home" && (
        <div className="fixed top-[52px] left-0 right-0 z-30 h-1 bg-white/10">
          <div className="h-full bg-[#00c853] transition-all duration-500" style={{ width: `${({category: 8, brand: 15, model: 22, storage: 32, condition: 42, carrier: 52, quote: 62, checkout: 72, payout: 82, contact: 92} as Record<string,number>)[step] ?? 0}%` }} />
        </div>
      )}

      {cookieConsent === null && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111]/95 backdrop-blur-sm border-t border-white/10 px-3 py-2 animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto flex items-center gap-3">
            <p className="text-white/80 text-[11px] flex-1">We use cookies to improve your experience.</p>
            <button onClick={() => { localStorage.setItem("cookie-consent", "essential"); setCookieConsent("essential"); }} className="text-white/60 text-[11px] font-medium cursor-pointer hover:text-white transition whitespace-nowrap">Essential</button>
            <button onClick={() => { localStorage.setItem("cookie-consent", "full"); setCookieConsent("full"); }} className="bg-[#00c853] text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer hover:bg-[#00e676] transition whitespace-nowrap">Accept All</button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </main>
  );
}
