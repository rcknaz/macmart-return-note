import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey 
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    })
  : null;

// Memory caches for suggestions and parsed text to completely prevent quota exhaustion
const suggestionCache = new Map<string, any>();
const textParseCache = new Map<string, any>();

app.use(express.json());

// API: Parse user natural language text input into structured expiry items
app.post("/api/gemini/parse-text", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing required string 'text' in body." });
    }

    const normalizedText = text.trim();
    if (textParseCache.has(normalizedText)) {
      console.log("[Cache Hit] Returning cached parsed text items");
      return res.json(textParseCache.get(normalizedText));
    }

    if (!ai) {
      return res.status(200).json({
        items: [],
        message: "Gemini API key is not configured. Please add GEMINI_API_KEY in Secrets."
      });
    }

    const currentYear = new Date().getFullYear();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Parse the following manual check-in of expired products to return. Complete all missing details if possible or keep them blank. Identify name, barcode (use standard EAN/UPC guess if mentioned, or empty string), quantity, expiry date in YYYY-MM-DD format (if only month/year or month/day is given, assume reasonable default expiring on that date, we are in year ${currentYear}), and a brief professional reason for the return (e.g., 'Expired', 'Close to Expiry', 'Damaged Packaging', 'Damaged Product').
      
      User input text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING, description: "The name of the product." },
                  barcode: { type: Type.STRING, description: "The barcode of the product. Keep empty string if unknown." },
                  quantity: { type: Type.INTEGER, description: "Total quantity. Default to 1 if not specified." },
                  expiryDate: { type: Type.STRING, description: "Formatted date of expiry as YYYY-MM-DD. Estimate if partially written." },
                  reason: { type: Type.STRING, description: "Synthesized standard return reason. E.g. 'Expired', 'Damaged Packaging'. Default to 'Expired'." }
                },
                required: ["productName", "barcode", "quantity", "expiryDate", "reason"]
              },
            }
          },
          required: ["items"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    const successRes = {
      items: parsedData.items || [],
      message: "Success"
    };
    
    // Save in cache
    textParseCache.set(normalizedText, successRes);
    res.json(successRes);
  } catch (error: any) {
    console.error("Error in parse-text endpoint:", error);
    res.status(200).json({ 
      items: [], 
      error: error?.message || String(error),
      message: "AI Parsing failed or rate-limited. Please use standard manual form to add items."
    });
  }
});

// API: Guess or suggest details and standard return reasons for a product
app.post("/api/gemini/suggest-details", async (req, res) => {
  const { productName, barcode } = req.body;
  
  // Clean loader states
  let cleanProductName = productName || "";
  if (cleanProductName === "Looking up barcode on Google..." || cleanProductName.includes("Searching Google for EAN")) {
    cleanProductName = "";
  }

  const cleanBarcode = barcode ? String(barcode).trim().replace(/\s/g, '') : "";
  const normalizedName = cleanProductName ? String(cleanProductName).trim().toLowerCase() : "";

  // Dynamic Cache Key selection: Barcode takes priority if present, otherwise fallback to item name
  const cacheKey = cleanBarcode ? `bar:${cleanBarcode}` : (normalizedName ? `name:${normalizedName}` : "");

  if (cacheKey && suggestionCache.has(cacheKey)) {
    console.log(`[Cache Hit] Returning cached suggestion for: ${cacheKey}`);
    return res.json(suggestionCache.get(cacheKey));
  }

  try {
    if (!cleanProductName && !barcode) {
      return res.status(400).json({ error: "Provide either a productName or barcode." });
    }

    if (!ai) {
      const fallbackResult = {
        reasons: ["Expired", "Close to Expiry", "Damaged Packaging", "Defective Stock", "Recall / Batch Issue"],
        suggestedName: cleanProductName,
        suggestedBarcode: barcode || "",
        message: "Gemini API is not configured. Returning defaults."
      };
      if (cacheKey) suggestionCache.set(cacheKey, fallbackResult);
      return res.json(fallbackResult);
    }

    const hasBarcode = !!barcode && barcode.trim().length > 0;
    const searchInstruction = hasBarcode 
      ? `CRITICAL task: Use Google Search to look up the barcode (UPC or EAN) "${barcode}" and search what exact product name and brand is showing on Google. If found, return the precise match. If not found, fall back to clean parsing of "${cleanProductName}".`
      : `Provide a list of up to 5 standard return reasons relevant to this product: Name: "${cleanProductName}", Barcode: "${barcode || ''}". Also suggest standard product name or clean spelling, and estimated barcode if known.`;

    let response = null;
    let fallbackToNoTools = false;

    // 1. Try with Google Search tool if search is applicable
    if (hasBarcode) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: searchInstruction + `\nProvide the suggestions formatted as JSON. Additionally, suggest 3-5 standard professional return reasons for retailer/distributor returns.`,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestedName: { type: Type.STRING, description: "The precise product name found from Google Search or matched standard name. If none found, use the original product name." },
                suggestedBarcode: { type: Type.STRING, description: "Suggested or verified barcode." },
                reasons: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Up to 5 professional reasons to return this product. E.g., 'Past Expiry Date', 'Short Shelf Life', 'Item Damaged in Transit'."
                }
              },
              required: ["suggestedName", "suggestedBarcode", "reasons"]
            }
          }
        });
      } catch (searchErr: any) {
        console.warn("Google Search grounding failed or quota exceeded. Falling back to standard model query without tools...", searchErr?.message || searchErr);
        fallbackToNoTools = true;
      }
    }

    // 2. Retry without search grounding tool if search query was not used or failed
    if (!response || fallbackToNoTools) {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Provide standard information for this barcode (UPC/EAN): "${barcode || ''}" and Product Name: "${cleanProductName}". Suggest a standard product name or clean spelling, and a list of up to 5 standard professional return reasons (e.g. Expired, Damaged Packaging). Formatted as JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedName: { type: Type.STRING, description: "Clean spelling or standard name of the product. If unknown, return original product name." },
              suggestedBarcode: { type: Type.STRING, description: "Suggested or verified barcode." },
              reasons: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Up to 5 professional return reasons."
              }
            },
            required: ["suggestedName", "suggestedBarcode", "reasons"]
          }
        }
      });
    }

    const parsedData = JSON.parse(response.text || "{}");
    
    // Save in cache
    if (cacheKey) {
      suggestionCache.set(cacheKey, parsedData);
    }
    
    res.json(parsedData);
  } catch (error: any) {
    console.error("Error in suggest-details endpoint:", error);
    const fallbackErrResult = {
      suggestedName: cleanProductName,
      suggestedBarcode: barcode || "",
      reasons: ["Expired", "Close to Expiry", "Damaged Packaging", "Defective Goods", "Overstock Expiry"],
      error: error?.message || String(error),
      rateLimited: true
    };
    res.json(fallbackErrResult);
  }
});

// Server boot with Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
