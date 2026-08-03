import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

// html2canvas-pro (not the plain html2canvas the app used to load from
// /html2pdf.bundle.min.js) is required here: Tailwind v4 emits oklch()/lab()
// CSS colors, and the original html2canvas throws "Attempting to parse an
// unsupported color function" on those, silently falling back to
// window.print() instead of producing a PDF.
export async function downloadElementAsPdf(
  elementId: string,
  filename: string,
  marginIn: number = 0.3
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  // Clone element into isolated offscreen container to preserve A4 layout
  // without modifying live screen DOM or causing responsive shifts
  const clone = element.cloneNode(true) as HTMLElement;

  // Copy live values for any form inputs/selects/textareas inside clone
  const originalInputs = element.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
  const clonedInputs = clone.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
  originalInputs.forEach((input, i) => {
    if (clonedInputs[i]) {
      clonedInputs[i].value = input.value;
    }
  });

  // Make all .pdf-only elements visible in clone
  clone.querySelectorAll<HTMLElement>(".pdf-only").forEach((el) => {
    el.style.setProperty("display", "flex", "important");
  });

  // Ensure scroll wrappers are visible in clone
  clone.querySelectorAll<HTMLElement>(".overflow-x-auto, .overflow-y-auto, .overflow-hidden").forEach((el) => {
    el.style.setProperty("overflow", "visible", "important");
  });

  // Create isolated container set to standard A4 width (794px @ 96 DPI)
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "0px";
  container.style.top = "0px";
  container.style.zIndex = "-999999";
  container.style.width = "794px";
  container.style.minWidth = "794px";
  container.style.maxWidth = "794px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#0f172a";
  container.style.boxSizing = "border-box";
  container.style.padding = "0px";
  container.style.margin = "0px";

  clone.style.width = "794px";
  clone.style.maxWidth = "none";
  clone.style.minWidth = "794px";
  clone.style.boxSizing = "border-box";
  clone.style.backgroundColor = "#ffffff";
  clone.style.display = "block";

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 1280,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    const pdf = new jsPDF({ unit: "in", format: "a4", orientation: "portrait" });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const printableWidth = pdfWidth - marginIn * 2;
    const printableHeight = pdfHeight - marginIn * 2;

    let sourceY = 0;
    const sWidth = canvas.width;
    const sHeight = (printableHeight * canvas.width) / printableWidth;
    let pageIndex = 0;

    while (sourceY < canvas.height) {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = sWidth;
      pageCanvas.height = Math.min(sHeight, canvas.height - sourceY);

      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(
          canvas,
          0, sourceY, sWidth, pageCanvas.height,
          0, 0, sWidth, pageCanvas.height
        );
      }

      const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.98);
      const destHeight = (pageCanvas.height * printableWidth) / sWidth;

      pdf.addImage(pageImgData, "JPEG", marginIn, marginIn, printableWidth, destHeight);

      sourceY += sHeight;
      pageIndex++;
    }

    pdf.save(filename);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

