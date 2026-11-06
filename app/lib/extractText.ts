export const ACCEPT = ".txt,.md,.markdown,.csv,.json,.html,.htm,.pdf,text/plain,application/pdf";

const MAX_BYTES = 10 * 1024 * 1024;
const OCR_SCALE = 2.0;
const MIN_TEXT_PER_PAGE = 16;

export type Progress = (message: string) => void;

export async function extractText(file: File, onProgress?: Progress): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error("File is larger than 10 MB. Use a smaller file.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = ext === "pdf" || file.type === "application/pdf";

  if (isPdf) {
    return extractPdf(file, onProgress);
  }

  const text = await file.text();
  if (!text.trim()) {
    throw new Error("That file appears to be empty.");
  }
  return text;
}

async function extractPdf(file: File, onProgress?: Progress): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(line);
  }

  const textLayer = pages.join("\n").replace(/[ \t]+\n/g, "\n").trim();
  const hasUsableText = textLayer.length >= MIN_TEXT_PER_PAGE * doc.numPages;

  if (hasUsableText) {
    return textLayer;
  }

  return ocrPdf(doc, onProgress);
}

async function ocrPdf(
  doc: { numPages: number; getPage: (n: number) => Promise<unknown> },
  onProgress?: Progress,
): Promise<string> {
  const out: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.(`Scanning page ${i} of ${doc.numPages}…`);
    const page = await doc.getPage(i);
    const image = await renderPageToImage(page);
    const text = await ocrImage(image);
    if (text.trim()) out.push(text.trim());
  }

  const joined = out.join("\n\n").trim();
  if (!joined) {
    throw new Error("Could not read any text from this scanned PDF.");
  }
  return joined;
}

async function renderPageToImage(page: unknown): Promise<string> {
  const p = page as {
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: { canvasContext: CanvasRenderingContext2D; canvas: HTMLCanvasElement; viewport: unknown }) => {
      promise: Promise<void>;
    };
  };
  const viewport = p.getViewport({ scale: OCR_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not render the PDF page for scanning.");

  await p.render({ canvasContext: ctx, canvas, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function ocrImage(image: string): Promise<string> {
  const res = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Scanning failed.");
  return typeof data.text === "string" ? data.text : "";
}
