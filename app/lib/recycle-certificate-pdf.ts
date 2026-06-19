import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Generates the actual e-waste certificate as a printable PDF (Letter
// landscape, light background so it prints cleanly). Mirrors the content of
// the certificate email panel: title, recipient, device, cert #, date, the
// NIST 800-88 handling statement, and the recycler. Returns raw PDF bytes.
export async function generateRecycleCertificatePdf(opts: {
  customerName: string;
  deviceLabel: string;
  certNumber: string;
  certDate: string;
}): Promise<Uint8Array> {
  // pdf-lib's StandardFonts use WinAnsi encoding, which THROWS on codepoints
  // it can't encode (emoji, CJK, …). An exotic customer name would otherwise
  // crash generateRecycleCertificatePdf and the certificate email would never
  // send. Strip to the safe printable Latin-1 range and clamp length (also
  // prevents a no-space mega-string from overflowing the centered line).
  const winAnsiSafe = (s: string, max: number) =>
    (s || "").replace(/[^\x20-\x7E\xC0-\xFF]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  const { certNumber, certDate } = opts;
  const customerName = winAnsiSafe(opts.customerName, 48);
  const deviceLabel = winAnsiSafe(opts.deviceLabel, 60);

  const doc = await PDFDocument.create();
  doc.setTitle(`Certificate of Responsible Recycling — #${certNumber}`);
  doc.setAuthor("Top Cash Cellular");
  doc.setSubject("E-waste responsible recycling certificate");

  const W = 792, H = 612; // US Letter, landscape
  const page = doc.addPage([W, H]);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const GREEN = rgb(0, 0.784, 0.325); // #00C853
  const DARK = rgb(0.1, 0.1, 0.12);
  const GRAY = rgb(0.42, 0.42, 0.45);
  const FAINT = rgb(0.6, 0.6, 0.63);

  const centerX = (text: string, font: PDFFont, size: number) =>
    (W - font.widthOfTextAtSize(text, size)) / 2;
  const drawCenter = (text: string, top: number, font: PDFFont, size: number, color = DARK) =>
    page.drawText(text, { x: centerX(text, font, size), y: H - top, size, font, color });

  // Decorative double border
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: GREEN, borderWidth: 2.5 });
  page.drawRectangle({ x: 30, y: 30, width: W - 60, height: H - 60, borderColor: rgb(0.8, 0.92, 0.84), borderWidth: 1 });

  // Brand kicker
  drawCenter("T O P   C A S H   C E L L U L A R", 78, bold, 11, GREEN);

  // Title
  drawCenter("Certificate of Responsible Recycling", 118, bold, 27, DARK);

  // Divider under title
  const divW = 220;
  page.drawRectangle({ x: (W - divW) / 2, y: H - 134, width: divW, height: 2, color: GREEN });

  // Recipient block
  drawCenter("This certifies that", 178, helv, 12, GRAY);
  drawCenter(customerName || "Valued Customer", 210, bold, 24, DARK);
  drawCenter("has responsibly recycled the following device with Top Cash Cellular:", 244, helv, 12, GRAY);
  drawCenter(deviceLabel || "Device", 272, bold, 16, DARK);

  // Handling statement (word-wrapped, centered)
  const statement =
    "The device will be securely wiped to the NIST 800-88 media-sanitization standard, then either refurbished for reuse or broken down for responsible component recovery. It will never be landfilled or shipped overseas as e-waste.";
  wrapCentered(page, statement, helv, 11.5, H - 312, 560, 16, GRAY);

  // Detail row: cert number (left) + date (right), inside the frame
  const rowY = H - 392;
  page.drawText("CERTIFICATE NO.", { x: 120, y: rowY + 14, size: 8.5, font: bold, color: FAINT });
  page.drawText(`#${certNumber}`, { x: 120, y: rowY - 4, size: 15, font: bold, color: DARK });
  const dateLabel = "DATE ISSUED";
  const dateVal = certDate;
  page.drawText(dateLabel, { x: W - 120 - bold.widthOfTextAtSize(dateLabel, 8.5), y: rowY + 14, size: 8.5, font: bold, color: FAINT });
  page.drawText(dateVal, { x: W - 120 - bold.widthOfTextAtSize(dateVal, 15), y: rowY - 4, size: 15, font: bold, color: DARK });

  // Recycler / issuer line
  drawCenter("Issued by  Top Cash Cellular  ·  Austin, TX", H - 470, bold, 12, DARK);

  // Footer contact + disclaimer
  drawCenter("support@topcashcellular.com   ·   topcashcellular.com", 540, helv, 11, GREEN);
  drawCenter(
    "This is a transactional acknowledgement of free responsible recycling — not a legal or third-party audit certification.",
    560,
    helv,
    8.5,
    FAINT,
  );

  return doc.save();
}

// Minimal word-wrap that center-aligns each line. `topY` is the baseline of
// the first line measured from the page bottom; lines descend by `lineH`.
function wrapCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  topY: number,
  maxWidth: number,
  lineH: number,
  color: ReturnType<typeof rgb>,
) {
  const W = page.getWidth();
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((ln, i) => {
    const x = (W - font.widthOfTextAtSize(ln, size)) / 2;
    page.drawText(ln, { x, y: topY - i * lineH, size, font, color });
  });
}
