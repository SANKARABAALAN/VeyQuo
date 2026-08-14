import { generateText, hasAI } from '../gemini';

export interface ExtractedIntent {
  category: string; // Dynamic category name (e.g. "Smartphones", "Refrigerators", "Shoes", etc.)
  budget: number | null;
  useCase: string | null;
  priority: 'price' | 'seller' | 'warranty' | 'delivery' | 'specifications' | 'condition' | null;
  condition: 'NEW' | 'REFURBISHED' | 'USED' | null;
  specificationsToCompare: string[]; // List of 4-6 key specifications that matter for this category
  rawInput: string;
}

// Fallback local rules if Gemini is unavailable
export function parseIntentLocally(query: string): ExtractedIntent {
  const lowercase = query.toLowerCase();
  
  // 1. Detect Category & Specs
  let category = "Smartphones";
  let specificationsToCompare = ["RAM", "Storage", "Camera", "Battery", "Display"];

  if (lowercase.match(/laptop|macbook|notebook|coding|computer|pc/)) {
    category = "Laptops";
    specificationsToCompare = ["RAM", "Storage", "Processor", "Display", "Battery"];
  } else if (lowercase.match(/headphone|earphone|earbud|audio|anc|noise cancel|sound/)) {
    category = "Headphones";
    specificationsToCompare = ["Type", "Battery Life", "Noise Cancelling", "Water Resistance"];
  } else if (lowercase.match(/tv|television|oled|qled|display/)) {
    category = "TVs";
    specificationsToCompare = ["Display Size", "Resolution", "Panel Type", "Refresh Rate"];
  } else if (lowercase.match(/camera|dslr|lens|mirrorless/)) {
    category = "Cameras";
    specificationsToCompare = ["Sensor Type", "Resolution", "Lens Mount", "Video Resolution"];
  } else if (lowercase.match(/refrigerator|fridge/)) {
    category = "Refrigerators";
    specificationsToCompare = ["Capacity", "Energy Rating", "Type", "Dimensions", "Warranty"];
  } else if (lowercase.match(/washing machine|dryer/)) {
    category = "Washing Machines";
    specificationsToCompare = ["Load Capacity", "Loading Type", "Energy Rating", "Spin Speed"];
  } else if (lowercase.match(/shoe|sneaker|boot/)) {
    category = "Shoes";
    specificationsToCompare = ["Size", "Material", "Gender", "Return Policy", "Fit"];
  } else if (lowercase.match(/watch|smartwatch/)) {
    category = "Smartwatches";
    specificationsToCompare = ["Display Type", "Battery Life", "Water Resistance", "Sensors"];
  } else if (lowercase.match(/monitor|screen/)) {
    category = "Monitors";
    specificationsToCompare = ["Display Size", "Resolution", "Refresh Rate", "Panel Type"];
  }

  // 2. Detect Budget
  let budget: number | null = null;
  const budgetMatches = lowercase.match(/(?:under|below|less than|budget|₹|rs\.?|inr)\s*(\d+[\d,]*)\s*(k)?/i);
  if (budgetMatches) {
    let numStr = budgetMatches[1].replace(/,/g, '');
    let val = parseFloat(numStr);
    const isK = !!budgetMatches[2];
    if (isK) {
      val = val * 1000;
    }
    if (!isNaN(val)) {
      budget = val;
    }
  } else {
    const kMatches = lowercase.match(/(\d+)\s*k/);
    if (kMatches) {
      budget = parseInt(kMatches[1]) * 1000;
    }
  }

  // 3. Detect Priority
  let priority: ExtractedIntent['priority'] = null;
  if (lowercase.match(/battery|camera|screen|performance|processor|ram|storage|display|specs|specification/)) {
    priority = "specifications";
  } else if (lowercase.match(/cheap|lowest|price|under|budget|save/)) {
    priority = "price";
  } else if (lowercase.match(/warranty|guarantee|protect/)) {
    priority = "warranty";
  } else if (lowercase.match(/delivery|shipping|fast|quick|tomorrow/)) {
    priority = "delivery";
  } else if (lowercase.match(/seller|trusted|rating|reviews/)) {
    priority = "seller";
  }

  // 4. Detect Condition
  let condition: ExtractedIntent['condition'] = null;
  if (lowercase.match(/refurbished|refurb|renewed/)) {
    condition = "REFURBISHED";
  } else if (lowercase.match(/used|second hand|preowned|pre-owned/)) {
    condition = "USED";
  } else if (lowercase.match(/new|brand new/)) {
    condition = "NEW";
  }

  // 5. Use Case
  let useCase: string | null = null;
  if (lowercase.match(/coding|program/)) {
    useCase = "coding";
  } else if (lowercase.match(/gaming|game/)) {
    useCase = "gaming";
  } else if (lowercase.match(/photography|photo|shoot|video/)) {
    useCase = "photography";
  } else if (lowercase.match(/office|work|student/)) {
    useCase = "office";
  }

  return {
    category,
    budget,
    useCase,
    priority,
    condition,
    specificationsToCompare,
    rawInput: query,
  };
}

export async function extractIntent(query: string): Promise<ExtractedIntent> {
  if (!hasAI()) {
    return parseIntentLocally(query);
  }

  try {
    const prompt = `
      You are an AI parsing agent for VEYQUO, an AI product decision platform.
      Analyze this user product search query and extract structured intent in JSON format.
      
      Determine:
      - category: The name of the product category, formatted in Title Case (e.g. "Smartphones", "Laptops", "Refrigerators", "Washing Machines", "Smartwatches", "Shoes", "Wireless Earbuds"). Do NOT restrict to a hardcoded list — extract whatever the user is searching for!
      - budget: A number representing budget in INR, or null if not specified. E.g. "under 70k" -> 70000.
      - useCase: A string for the use case (e.g., "coding", "gaming", "fitness", "general"), or null if not specified.
      - priority: One of: ["price", "seller", "warranty", "delivery", "specifications", "condition"], or null if not specified.
      - condition: One of: ["NEW", "REFURBISHED", "USED"], or null if not specified.
      - specificationsToCompare: An array of 4 to 6 important specification keys that matter most when comparing products in this specific category. Ensure proper casing, e.g. for Refrigerator: ["Capacity", "Energy Rating", "Defrost Type", "Warranty"], for Shoes: ["Size", "Material", "Closure Type", "Fit Type"].
      
      User query: "${query}"

      Return ONLY a valid JSON object matching this schema. No markdown formatting, no comments, just raw JSON.
    `;

    const responseText = await generateText(prompt, true);

    if (responseText) {
      const parsed = JSON.parse(responseText.trim());
      return {
        category: parsed.category || "Smartphones",
        budget: parsed.budget || null,
        useCase: parsed.useCase || null,
        priority: parsed.priority || null,
        condition: parsed.condition || null,
        specificationsToCompare: parsed.specificationsToCompare || ["RAM", "Storage", "Camera", "Battery", "Display"],
        rawInput: query,
      };
    }
  } catch (error) {
    console.error("Error in AI intent extraction:", error);
  }

  // Return fallback if anything fails
  return parseIntentLocally(query);
}
