import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

export interface ExtractedMedicineRow {
  serialNumber?: number;
  productName: string;
  packing?: string;
  hsnCode?: string;
  manufacturer?: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  freeQty: number;
  mrp: number;
  purchaseRate: number;
  discountPercent: number;
  gstRate: number;
  amount: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  uncertainFields: string[];
}

export interface ExtractedInvoiceData {
  supplier: {
    name: string;
    gstin?: string;
    address?: string;
    phone?: string;
    dlNo?: string;
  };
  invoice: {
    invoiceNumber: string;
    invoiceDate: string;
    taxType: 'GST' | 'IGST';
    paymentTerms?: string;
  };
  items: ExtractedMedicineRow[];
  summary: {
    totalQuantity: number;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    discountAmount: number;
    roundOff: number;
    grandTotal: number;
  };
  rawTextNotes?: string;
  sourceType: 'UPLOADED_FILE' | 'SAMPLE_PRESET';
}

export async function extractInvoiceWithGemini(
  fileBuffer: Buffer,
  mimeType: string,
  apiKey?: string
): Promise<ExtractedInvoiceData> {
  const activeKey = apiKey || process.env.GEMINI_API_KEY || process.env.OCR_API_KEY;

  if (!activeKey || activeKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured. Please supply an API key in settings or use the reference samples.');
  }

  const ai = new GoogleGenAI({ apiKey: activeKey });
  const modelName = process.env.OCR_MODEL || 'gemini-3.8-flash';

  const systemPrompt = `
You are an expert Indian Pharmaceutical Invoice OCR and data extraction system.
Extract structured invoice data from the provided image or PDF document.
Distinguish between Purchase Rate and MRP.
Distinguish between billed Quantity and Free Quantity.
Distinguish intra-state SGST+CGST vs inter-state IGST.
Dates must be normalized to YYYY-MM-DD. If only month and year are visible (e.g. 04/27 or 04/2027), set to the last day of that month (e.g. 2027-04-30).
Flag any values that are blurry, ambiguous, or questionable in 'uncertainFields'.

Return ONLY valid JSON matching this schema:
{
  "supplier": {
    "name": "Supplier or Distributor Company Name",
    "gstin": "GSTIN number if visible",
    "address": "Full address",
    "phone": "Phone number",
    "dlNo": "Drug Licence number"
  },
  "invoice": {
    "invoiceNumber": "Invoice number or Bill number",
    "invoiceDate": "YYYY-MM-DD",
    "taxType": "GST" or "IGST",
    "paymentTerms": "Credit/Cash"
  },
  "items": [
    {
      "serialNumber": 1,
      "productName": "Medicine Name with strength/dosage",
      "packing": "30 ML, 10X15, etc",
      "hsnCode": "HSN code",
      "manufacturer": "Company or Labcorp name",
      "batchNumber": "Batch No",
      "expiryDate": "YYYY-MM-DD",
      "quantity": 10,
      "freeQty": 0,
      "mrp": 100.0,
      "purchaseRate": 50.0,
      "discountPercent": 0,
      "gstRate": 5.0,
      "amount": 500.0,
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "uncertainFields": []
    }
  ],
  "summary": {
    "totalQuantity": 10,
    "taxableAmount": 500.0,
    "cgstAmount": 12.5,
    "sgstAmount": 12.5,
    "igstAmount": 0.0,
    "discountAmount": 0.0,
    "roundOff": 0.0,
    "grandTotal": 525.0
  },
  "rawTextNotes": "Brief notes on any unreadable stamps or anomalies"
}
`;

  const base64Data = fileBuffer.toString('base64');

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemPrompt },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType || 'image/png',
            },
          },
        ],
      },
    ],
  });

  const rawText = response.text || '';
  const cleanedJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleanedJson);
    return {
      ...parsed,
      sourceType: 'UPLOADED_FILE',
    };
  } catch (err) {
    console.error('Failed to parse Gemini OCR response as JSON:', rawText);
    throw new Error('OCR model generated non-JSON response. Please retry or adjust image angle.');
  }
}

/**
 * High-fidelity fallback/demo presets inspired by the user's reference images
 */
export function getSampleInvoiceData(sampleId: 'kroyf_distributor' | 'apex_tax_invoice'): ExtractedInvoiceData {
  if (sampleId === 'kroyf_distributor') {
    return {
      sourceType: 'SAMPLE_PRESET',
      supplier: {
        name: 'KROYF LABCORP',
        gstin: '06ABCFK8854D1ZA',
        address: 'Sector 25, Industrial Area Phase II, Faridabad, Haryana',
        phone: '09891185959',
        dlNo: 'HR-123456/20',
      },
      invoice: {
        invoiceNumber: 'OS001230',
        invoiceDate: '2024-07-30',
        taxType: 'IGST',
        paymentTerms: 'Credit',
      },
      items: [
        {
          serialNumber: 1,
          productName: 'PODPILL CV DS DRY SYP',
          packing: '30 ML',
          hsnCode: '30049069',
          manufacturer: 'KROYF LABCORP',
          batchNumber: 'PBD5255C',
          expiryDate: '2027-04-30',
          quantity: 24,
          freeQty: 0,
          mrp: 186.00,
          purchaseRate: 41.00,
          discountPercent: 0,
          gstRate: 5.0,
          amount: 984.00,
          confidence: 'HIGH',
          uncertainFields: [],
        },
        {
          serialNumber: 2,
          productName: 'PODPILL 25 DROPS',
          packing: '10 ML',
          hsnCode: '30049069',
          manufacturer: 'KROYF LABCORP',
          batchNumber: 'PBD5255C',
          expiryDate: '2028-02-28',
          quantity: 144,
          freeQty: 0,
          mrp: 92.34,
          purchaseRate: 21.00,
          discountPercent: 0,
          gstRate: 5.0,
          amount: 3024.00,
          confidence: 'HIGH',
          uncertainFields: [],
        },
        {
          serialNumber: 3,
          productName: 'SEFIRIN 50 LB DRY SYP',
          packing: '30 ML',
          hsnCode: '30049000',
          manufacturer: 'KROYF LABCORP',
          batchNumber: 'PBD6097B',
          expiryDate: '2027-09-30',
          quantity: 192,
          freeQty: 0,
          mrp: 72.50,
          purchaseRate: 19.00,
          discountPercent: 0,
          gstRate: 5.0,
          amount: 3648.00,
          confidence: 'HIGH',
          uncertainFields: [],
        },
        {
          serialNumber: 4,
          productName: 'SEFIRIN 100 LB DRY SYP',
          packing: '30 ML',
          hsnCode: '30049000',
          manufacturer: 'KROYF LABCORP',
          batchNumber: 'PBD5295B',
          expiryDate: '2027-05-31',
          quantity: 24,
          freeQty: 0,
          mrp: 116.72,
          purchaseRate: 21.00,
          discountPercent: 0,
          gstRate: 5.0,
          amount: 504.00,
          confidence: 'HIGH',
          uncertainFields: [],
        },
        {
          serialNumber: 5,
          productName: 'SEFIRIN CV DRY SYP',
          packing: '30 ML',
          hsnCode: '30049000',
          manufacturer: 'KROYF LABCORP',
          batchNumber: 'PBD5266B',
          expiryDate: '2028-04-30',
          quantity: 24,
          freeQty: 0,
          mrp: 111.94,
          purchaseRate: 26.00,
          discountPercent: 0,
          gstRate: 5.0,
          amount: 624.00,
          confidence: 'HIGH',
          uncertainFields: [],
        },
        {
          serialNumber: 6,
          productName: 'SEFIRIN O DRY SYP',
          packing: '30 ML',
          hsnCode: '30049000',
          manufacturer: 'KROYF LABCORP',
          batchNumber: 'PBD5254C',
          expiryDate: '2027-10-31',
          quantity: 192,
          freeQty: 0,
          mrp: 116.70,
          purchaseRate: 21.00,
          discountPercent: 0,
          gstRate: 5.0,
          amount: 4032.00,
          confidence: 'HIGH',
          uncertainFields: [],
        },
        {
          serialNumber: 7,
          productName: 'SEFIRIN 25 DROPS',
          packing: '10 ML',
          hsnCode: '30049000',
          manufacturer: 'KROYF LABCORP',
          batchNumber: 'PBD6107A',
          expiryDate: '2028-04-30',
          quantity: 144,
          freeQty: 0,
          mrp: 79.00,
          purchaseRate: 22.00,
          discountPercent: 0,
          gstRate: 5.0,
          amount: 3168.00,
          confidence: 'HIGH',
          uncertainFields: [],
        },
      ],
      summary: {
        totalQuantity: 744,
        taxableAmount: 26261.71,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 1313.09,
        discountAmount: 0,
        roundOff: 0.20,
        grandTotal: 27575.00,
      },
      rawTextNotes: 'Distributor Invoice from KROYF LABCORP with 7 dry syrup & drops batches.',
    };
  }

  // APEX TAX INVOICE SAMPLE
  return {
    sourceType: 'SAMPLE_PRESET',
    supplier: {
      name: 'APEX HEALTH DISTRIBUTORS',
      gstin: '29BZWWPN5791F1ZE',
      address: 'ALVEKODI SHIRALI ROAD, BHATKAL, KARNATAKA',
      phone: '9113917343',
      dlNo: 'KA-KW1-299954',
    },
    invoice: {
      invoiceNumber: 'AM-P001',
      invoiceDate: '2026-08-10',
      taxType: 'GST',
      paymentTerms: 'Credit',
    },
    items: [
      {
        serialNumber: 1,
        productName: 'KETOCIS TAB',
        packing: '10X15',
        hsnCode: '30049069',
        manufacturer: 'APEX HEALTH',
        batchNumber: 'LGQ05/334/0',
        expiryDate: '2028-04-30',
        quantity: 50,
        freeQty: 0,
        mrp: 1299.00,
        purchaseRate: 220.00,
        discountPercent: 0,
        gstRate: 5.0,
        amount: 11000.00,
        confidence: 'HIGH',
        uncertainFields: [],
      },
      {
        serialNumber: 2,
        productName: 'OMSYS 20 CAP',
        packing: '10X15',
        hsnCode: '30049034',
        manufacturer: 'APEX HEALTH',
        batchNumber: 'PGC26-174C',
        expiryDate: '2028-05-31',
        quantity: 60,
        freeQty: 0,
        mrp: 450.00,
        purchaseRate: 160.00,
        discountPercent: 0,
        gstRate: 5.0,
        amount: 9600.00,
        confidence: 'HIGH',
        uncertainFields: [],
      },
    ],
    summary: {
      totalQuantity: 110,
      taxableAmount: 20600.00,
      cgstAmount: 515.00,
      sgstAmount: 515.00,
      igstAmount: 0.00,
      discountAmount: 0.00,
      roundOff: 0.00,
      grandTotal: 21630.00,
    },
    rawTextNotes: 'Tablets and capsules stock batch import.',
  };
}
