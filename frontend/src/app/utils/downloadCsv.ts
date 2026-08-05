/**
 * Reusable helper utility to format and trigger local browser download of CSV reports.
 */
export function downloadCsv(headers: string[], rows: any[][], filename: string): void {
  const csvContent = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","),
    ...rows.map(row => 
      row.map(val => {
        if (val === null || val === undefined) return '""';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(",")
    )
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
