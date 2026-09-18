/**
 * Exports a styled HTML string as a PDF by rendering into an invisible iframe
 * and triggering the native browser print/save-as-PDF dialog.
 */
export async function exportHtmlToPdf(htmlContent: string, title = "README"): Promise<void> {
  if (typeof window === "undefined") return;

  return new Promise((resolve) => {
    // Create hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    iframe.name = "readmeforge-pdf-frame";

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Give images & fonts time to load
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn("[PDF Export]: Error invoking print on iframe", err);
      } finally {
        // Clean up iframe after printing dialog closes
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve();
        }, 1500);
      }
    }, 400);
  });
}
