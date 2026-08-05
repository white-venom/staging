import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

/**
 * Programmatically paginates the cloned HTML content and renders page-by-page onto jsPDF canvas
 * to prevent elements (such as table rows or lists) from cutting in half across pages.
 */
export async function downloadElementAsPdf(
  elementId: string,
  filename: string,
  marginIn: number = 0.4
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  // Constants for standard A4 page layout
  // 1 inch = 96 pixels (standard screen resolution reference)
  const pxPerInch = 96;
  const pageWidthPx = Math.round(8.27 * pxPerInch);
  const pageHeightPx = Math.round(11.69 * pxPerInch);
  const marginPx = Math.round(marginIn * pxPerInch);
  const contentHeightPx = pageHeightPx - (marginPx * 2);

  // 1. Create a hidden container to construct separate, distinct pages
  const tempContainer = document.createElement("div");
  // Enforce consistent light theme / print context
  tempContainer.className = element.className;
  tempContainer.classList.remove("dark");
  tempContainer.style.position = "absolute";
  tempContainer.style.left = "-9999px";
  tempContainer.style.top = "-9999px";
  tempContainer.style.width = `${pageWidthPx}px`;
  tempContainer.style.boxSizing = "border-box";
  tempContainer.style.backgroundColor = "#ffffff";
  document.body.appendChild(tempContainer);

  const pages: HTMLDivElement[] = [];

  function createNewPage(): HTMLDivElement {
    const page = document.createElement("div");
    page.style.width = `${pageWidthPx}px`;
    page.style.height = "auto";
    page.style.boxSizing = "border-box";
    page.style.padding = `${marginPx}px`;
    page.style.backgroundColor = "#ffffff";
    page.style.position = "relative";
    page.style.display = "flex";
    page.style.flexDirection = "column";
    page.style.overflow = "hidden";
    // Propagate default styles of the source container
    page.style.fontFamily = window.getComputedStyle(element as HTMLElement).fontFamily;
    page.style.color = "#0f172a"; // slate-900
    tempContainer.appendChild(page);
    pages.push(page);
    return page;
  }

  let currentPage = createNewPage();

  // Helper: Recreate parent wrapper element structure down to the target leaf
  function recreateHierarchy(current: HTMLElement, root: HTMLElement): HTMLElement {
    const path: HTMLElement[] = [];
    let curr: HTMLElement | null = current;
    while (curr && curr !== root) {
      path.unshift(curr);
      curr = curr.parentElement;
    }
    
    let active: HTMLElement = currentPage;
    for (const el of path) {
      const clone = el.cloneNode(false) as HTMLElement;
      // Keep styling correct but reset sizing properties
      clone.style.height = "auto";
      clone.style.minHeight = "0";
      clone.style.maxHeight = "none";
      clone.style.overflow = "visible";
      active.appendChild(clone);
      active = clone;
    }
    return active;
  }

  // Helper: Append a node to a page/container, recursively splitting tables/lists if height is exceeded
  function appendNodeToContainer(node: Node, currentContainer: HTMLElement, rootElement: HTMLElement) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      currentContainer.appendChild(node.cloneNode(true));
      return;
    }

    const el = node as HTMLElement;

    // A. Handle Table Splitting
    if (el.tagName.toLowerCase() === "table") {
      const tableShell = el.cloneNode(false) as HTMLTableElement;
      const thead = el.querySelector("thead")?.cloneNode(true) as HTMLTableSectionElement;
      if (thead) tableShell.appendChild(thead);
      let tbody = document.createElement("tbody");
      tableShell.appendChild(tbody);
      currentContainer.appendChild(tableShell);

      const rows = Array.from(el.querySelectorAll("tbody > tr"));
      for (const row of rows) {
        const clonedRow = row.cloneNode(true) as HTMLTableRowElement;
        tbody.appendChild(clonedRow);

        // Check if page bounds are broken
        if (currentPage.scrollHeight > pageHeightPx) {
          tbody.removeChild(clonedRow);
          
          if (tbody.children.length === 0 && currentPage.children.length <= 1) {
            // Keep on this page anyway if it's the only element on the page
            tbody.appendChild(clonedRow);
          } else {
            // Move to next page
            currentPage = createNewPage();
            const newContainer = recreateHierarchy(el.parentElement || rootElement, rootElement);
            const newTableShell = el.cloneNode(false) as HTMLTableElement;
            if (thead) newTableShell.appendChild(thead.cloneNode(true));
            const newTbody = document.createElement("tbody");
            newTbody.appendChild(clonedRow);
            newTableShell.appendChild(newTbody);
            newContainer.appendChild(newTableShell);
            
            currentContainer = newContainer;
            tbody = newTbody;
          }
        }
      }
      return;
    }

    // B. Handle Lists Splitting
    const isList = el.classList.contains("divide-y") || el.tagName.toLowerCase() === "ul" || el.tagName.toLowerCase() === "ol";
    if (isList) {
      let listShell = el.cloneNode(false) as HTMLElement;
      currentContainer.appendChild(listShell);

      const items = Array.from(el.children);
      for (const item of items) {
        const clonedItem = item.cloneNode(true) as HTMLElement;
        listShell.appendChild(clonedItem);

        if (currentPage.scrollHeight > pageHeightPx) {
          listShell.removeChild(clonedItem);
          
          if (listShell.children.length === 0 && currentPage.children.length <= 1) {
            listShell.appendChild(clonedItem);
          } else {
            currentPage = createNewPage();
            const newContainer = recreateHierarchy(el.parentElement || rootElement, rootElement);
            const newListShell = el.cloneNode(false) as HTMLElement;
            newListShell.appendChild(clonedItem);
            newContainer.appendChild(newListShell);
            
            currentContainer = newContainer;
            listShell = newListShell;
          }
        }
      }
      return;
    }

    // C. Handle Elements that contain tables or lists nested inside them
    const hasTable = el.querySelector("table");
    const hasList = el.querySelector(".divide-y, ul, ol");
    if (hasTable || hasList) {
      const wrapperShell = el.cloneNode(false) as HTMLElement;
      // Reset sizing on the wrapper so height bounds flow naturally
      wrapperShell.style.height = "auto";
      wrapperShell.style.minHeight = "0";
      wrapperShell.style.maxHeight = "none";
      wrapperShell.style.overflow = "visible";
      currentContainer.appendChild(wrapperShell);

      const children = Array.from(el.childNodes);
      for (const child of children) {
        appendNodeToContainer(child, wrapperShell, rootElement);
      }
      return;
    }

    // D. Standard block element
    const clonedEl = el.cloneNode(true) as HTMLElement;
    currentContainer.appendChild(clonedEl);

    if (currentPage.scrollHeight > pageHeightPx) {
      if (currentPage.children.length > 1 || currentContainer.children.length > 1) {
        currentContainer.removeChild(clonedEl);
        currentPage = createNewPage();
        const newContainer = recreateHierarchy(el.parentElement || rootElement, rootElement);
        newContainer.appendChild(clonedEl);
      }
    }
  }

  // 2. Iterate through direct children of original element and append
  const children = Array.from(element.childNodes);
  for (const child of children) {
    appendNodeToContainer(child, currentPage, element);
  }

  // 3. Set fixed height on all pages before rendering
  for (const page of pages) {
    page.style.height = `${pageHeightPx}px`;
  }

  // 4. Render each page using html2canvas and write to the PDF document
  try {
    const pdf = new jsPDF({ unit: "in", format: "a4", orientation: "portrait" });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) pdf.addPage();
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    }
    
    pdf.save(filename);
  } finally {
    // 4. Clean up temporary container
    document.body.removeChild(tempContainer);
  }
}
