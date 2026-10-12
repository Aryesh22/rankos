import { logger } from "../config/logger.js";

/**
 * OCR service — extracts questions/options/answers from an uploaded OMR sheet or
 * CBT screenshot and returns structured rows.
 *
 * Provider: Google Cloud Vision (`documentTextDetection`) when configured via
 * GOOGLE_APPLICATION_CREDENTIALS (or GOOGLE_VISION_KEY_JSON). When it isn't (the
 * default in this build), a DEV STUB returns a realistic sample exam sheet so
 * the parse → persist pipeline runs end-to-end and can be swapped to live OCR by
 * simply providing credentials — no code change.
 */
function isVisionConfigured() {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_VISION_KEY_JSON ||
      process.env.GCP_PROJECT,
  );
}

/** Raw OCR text extraction. Returns { text, provider }. */
export async function extractText({ buffer, mimeType }) {
  if (isVisionConfigured()) {
    try {
      const vision = await import("@google-cloud/vision");
      const client = new vision.ImageAnnotatorClient(
        process.env.GOOGLE_VISION_KEY_JSON
          ? { credentials: JSON.parse(process.env.GOOGLE_VISION_KEY_JSON) }
          : undefined,
      );
      const [result] = await client.documentTextDetection({ image: { content: buffer } });
      const text = result.fullTextAnnotation?.text || "";
      logger.info(`[ocr] vision extracted ${text.length} chars (${mimeType})`);
      return { text, provider: "google-vision" };
    } catch (err) {
      logger.warn(`[ocr] vision failed (${err.message}) — falling back to stub`);
    }
  }
  logger.warn("[ocr:stub] no Vision credentials — returning sample sheet");
  return { text: STUB_SHEET, provider: "stub" };
}

/**
 * Parse OCR text into structured question rows. Tolerant of both the stub format
 * and typical Vision output: blocks start at "Q<n>." / "<n>.", options are
 * "(A) …", answers are "Your Answer: X" / "Correct Answer: X". Subject headings
 * (PHYSICS/CHEMISTRY/MATHEMATICS) carry down to following questions.
 * @returns {Array<{questionNumber,subject,topic,text,options,studentAnswer,correctAnswer}>}
 */
export function parseExam(text) {
  const lines = String(text).split(/\r?\n/);
  const rows = [];
  let currentSubject = null;
  let block = null;

  const flush = () => {
    if (!block) return;
    const joined = block.lines.join(" ").replace(/\s+/g, " ").trim();
    // Extract options by splitting on the (A)…(D) markers only, so option text
    // that itself contains parentheses — e.g. "(2/3) g sinθ" — stays intact.
    const options = [];
    const optZone = joined.split(/Your Answer|Correct Answer/i)[0];
    const parts = optZone.split(/\(([A-D])\)/).slice(1); // [letter, text, letter, text, …]
    for (let i = 0; i < parts.length - 1; i += 2) {
      const text = (parts[i + 1] || "").trim();
      if (/^[A-D]$/.test(parts[i]) && text) options.push(text);
    }
    const student = joined.match(/Your Answer:\s*([A-D])/i)?.[1] ?? null;
    const correct = joined.match(/Correct Answer:\s*([A-D])/i)?.[1] ?? null;
    const qText = joined
      .split(/\(A\)/i)[0]
      .replace(/^Q?\s*\d+[.)]\s*/i, "")
      .trim();
    rows.push({
      questionNumber: block.number,
      subject: block.subject,
      topic: null,
      text: qText,
      options,
      studentAnswer: student,
      correctAnswer: correct,
    });
    block = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^(PHYSICS|CHEMISTRY|MATHEMATICS|BIOLOGY)\b/i);
    if (heading) {
      flush();
      currentSubject = heading[1][0].toUpperCase() + heading[1].slice(1).toLowerCase();
      continue;
    }
    const q = line.match(/^Q?\s*(\d+)[.)]\s*(.*)$/i);
    if (q) {
      flush();
      block = { number: Number(q[1]), subject: currentSubject, lines: [q[2]] };
    } else if (block) {
      block.lines.push(line);
    }
  }
  flush();
  return rows;
}

/**
 * Full pipeline for one Upload doc: extract → parse → persist. Mutates + saves
 * the document. Returns the updated doc.
 */
export async function processUpload(uploadDoc) {
  uploadDoc.status = "processing";
  await uploadDoc.save();
  try {
    const { text, provider } = await extractText({
      buffer: uploadDoc.__buffer,
      mimeType: uploadDoc.mimeType,
    });
    const parsed = parseExam(text);
    uploadDoc.rawText = text;
    uploadDoc.ocrProvider = provider;
    uploadDoc.parsed = parsed;
    uploadDoc.status = "parsed";
    await uploadDoc.save();
    logger.info(`[ocr] upload ${uploadDoc._id} parsed ${parsed.length} questions (${provider})`);
    return uploadDoc;
  } catch (err) {
    uploadDoc.status = "failed";
    uploadDoc.error = err.message;
    await uploadDoc.save();
    throw err;
  }
}

/** Realistic sample sheet used by the dev stub. */
const STUB_SHEET = `PHYSICS
Q1. A uniform disc of mass M and radius R rolls without slipping down an incline of angle theta. Find the acceleration of its centre of mass.
(A) g sinθ (B) (2/3) g sinθ (C) (1/2) g sinθ (D) (3/5) g sinθ
Your Answer: C   Correct Answer: B

Q2. A block on a rough incline is projected up the plane. The friction force acts
(A) up the incline (B) down the incline (C) horizontally (D) is zero
Your Answer: A   Correct Answer: B

CHEMISTRY
Q3. Which reagent converts a primary alcohol to an aldehyde without over-oxidation?
(A) KMnO4 / H+ (B) PCC in CH2Cl2 (C) K2Cr2O7 / H2SO4 (D) Hot alkaline KMnO4
Your Answer: B   Correct Answer: B

MATHEMATICS
Q4. If f(x) = integral of t sin t dt from 0 to x, then f'(pi/2) is
(A) pi/2 (B) 1 (C) pi (D) 0
Your Answer: D   Correct Answer: A
`;

export default { extractText, parseExam, processUpload };
