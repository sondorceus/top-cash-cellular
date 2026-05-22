// Debug normLabel
function normLabel(s) {
  return s
    .toLowerCase()
    .replace(/[''′"`]/g, "")
    .replace(/\((.*?)\)/g, " $1 ")
    .replace(/\b(\d+)(st|nd|rd|th)\s+gen\b/g, "$1")
    .replace(/\bapple watch\s+/g, "")
    .replace(/\b(galaxy\s+)?note\b/g, "note")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const cases = [
  "iPad 10th Gen",
  "iPad Air 11\" M3",
  'iPad Air 11" (M3) 128GB',
  "Apple Watch Series 10",
  "Series 10 46mm",
  "Galaxy S25 Ultra",
  "Galaxy S25 Ultra (Carrier Locked)",
  "Pixel 10",
  "Pixel 10a",
  "PIXEL 10 5G FACTORY ORIGINAL UNLOCKED",
];
for (const c of cases) console.log(`${c.padEnd(45)} -> "${normLabel(c)}"`);
