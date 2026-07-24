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
  marginIn: number = 0.4
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.98);

  const pdf = new jsPDF({ unit: "in", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth() - marginIn * 2;
  const pageHeight = pdf.internal.pageSize.getHeight() - marginIn * 2;
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = marginIn;
  pdf.addImage(imgData, "JPEG", marginIn, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight - marginIn;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", marginIn, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
