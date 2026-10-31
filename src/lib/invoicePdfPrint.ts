import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';

/**
 * Ensures all fonts and images within a given container are completely loaded
 */
async function waitForAssets(element: HTMLElement): Promise<void> {
  // 1. Wait for document fonts
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('Font loading check timed out or failed:', e);
    }
  }

  // 2. Wait for all <img> tags inside element to be complete
  const images = Array.from(element.querySelectorAll('img'));
  const pendingImages = images.filter((img) => !img.complete);

  if (pendingImages.length > 0) {
    await Promise.all(
      pendingImages.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve(); // continue even if an image fails
            setTimeout(() => resolve(), 1500);
          })
      )
    );
  }
}

/**
 * Robust, isolated Print function for InvoiceTemplate:
 * Creates an isolated hidden iframe with exact cloned styles, avoiding parent modal/navigation interference.
 */
export async function printInvoice(elementId = 'invoice-printable-root'): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Invoice printable element '#${elementId}' not found.`);
  }

  await waitForAssets(element);

  // Remove any leftover print iframe
  const oldIframe = document.getElementById('__apex_invoice_print_iframe__');
  if (oldIframe) {
    oldIframe.remove();
  }

  // Create isolated printing iframe
  const iframe = document.createElement('iframe');
  iframe.id = '__apex_invoice_print_iframe__';
  iframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    window.print();
    return;
  }

  // Copy all parent stylesheets and styles into the iframe
  const styleNodes = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
  const stylesHtml = styleNodes.map((node) => node.outerHTML).join('\n');

  const printCss = `
    <style>
      @page {
        size: A4 portrait;
        margin: 8mm;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      }
      .invoice-container {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 4mm !important;
        box-shadow: none !important;
        border: 1px solid #94a3b8 !important;
      }
      .invoice-table {
        width: 100% !important;
        border-collapse: collapse !important;
      }
      tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .no-print, .print\\:hidden {
        display: none !important;
      }
    </style>
  `;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Tax Invoice - APEX MEDI SALES</title>
        ${stylesHtml}
        ${printCss}
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  // Wait for iframe fonts and images
  if (iframe.contentWindow?.document) {
    await waitForAssets(iframe.contentWindow.document.body);
  }

  // Brief delay for browser layout engine to paint
  await new Promise((r) => setTimeout(r, 120));

  try {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  } catch (err) {
    console.warn('Iframe print failed, falling back to window.print():', err);
    window.print();
  } finally {
    setTimeout(() => {
      const f = document.getElementById('__apex_invoice_print_iframe__');
      if (f) f.remove();
    }, 60000);
  }
}

/**
 * High-Fidelity Client-Side PDF Generator:
 * Renders the EXACT same InvoiceTemplate DOM node to an A4 PDF.
 * Uses html-to-image as primary renderer (native browser SVG engine, fully supports oklch and modern CSS)
 * with a fallback to html2canvas (with oklch sanitized) if needed.
 */
export async function downloadInvoicePdf(
  elementId = 'invoice-printable-root',
  fileName = 'Invoice.pdf'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Invoice printable element '#${elementId}' not found.`);
  }

  await waitForAssets(element);

  let dataUrl: string;

  try {
    // Primary engine: html-to-image (native browser rasterization, supports oklch, lab, modern CSS)
    dataUrl = await toPng(element, {
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      cacheBust: false,
      filter: (node) => {
        if (node instanceof HTMLElement && node.classList.contains('no-print')) {
          return false;
        }
        return true;
      },
    });
  } catch (primaryErr: any) {
    console.warn('html-to-image rasterization encountered error, trying fallback:', primaryErr?.message || primaryErr);

    // Fallback engine: html2canvas with oklch sanitizer
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth || 1024,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(elementId);
        if (clonedEl) {
          clonedEl.style.backgroundColor = '#ffffff';
          clonedEl.style.margin = '0 auto';
        }
        // Sanitize any style elements containing oklch
        const styles = clonedDoc.querySelectorAll('style');
        styles.forEach((s) => {
          if (s.textContent && s.textContent.includes('oklch')) {
            s.textContent = s.textContent.replace(/oklch\([^)]+\)/g, '#334155');
          }
        });
      },
    });
    dataUrl = canvas.toDataURL('image/png');
  }

  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed loading rendered invoice image'));
  });

  // Standard A4 dimensions in mm: 210 x 297
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pdfWidth = 210;
  const pdfPageHeight = 297;
  const imgHeight = (img.naturalHeight * pdfWidth) / img.naturalWidth;

  let heightLeft = imgHeight;
  let position = 0;

  // Add first page
  pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pdfPageHeight;

  // Multi-page handling (with 3mm threshold to avoid blank trailing page on subpixel rounding)
  while (heightLeft > 3) {
    position -= pdfPageHeight;
    pdf.addPage();
    pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfPageHeight;
  }

  pdf.save(fileName);
}
