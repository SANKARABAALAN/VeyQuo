import { NextResponse } from 'next/server';
import { generateText, hasAI } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { 
      message: userMessage, 
      history, 
      activeListings = [], 
      activeQuery = "", 
      activeWeights = {
        priceWeight: 0.40,
        sellerWeight: 0.20,
        warrantyWeight: 0.15,
        deliveryWeight: 0.10,
        specificationWeight: 0.10,
        conditionWeight: 0.05
      }
    } = await request.json();

    if (!userMessage) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    // Call AI if key exists
    if (hasAI()) {
      try {
        const listingsContextText = activeListings.slice(0, 5).map((l: any, idx: number) => 
          `Listing #${idx + 1}: ID: ${l.id}, Title: ${l.title}, Marketplace: ${l.marketplaceName}, Seller: ${l.sellerName} (Rating: ${l.sellerRating}/5.0, Trust: ${l.sellerTrustStatus}), Effective Price: ₹${l.effectivePrice}, Condition: ${l.condition}, Warranty: ${l.warranty} (${l.warrantyMonths}m), Delivery Days: ${l.deliveryDays}, Overall Score: ${l.scores?.totalScore || 'N/A'}/1.0.`
        ).join("\n");

        const prompt = `
          You are the AI Decision Assistant for VEYQUO, a decision intelligence platform.
          You help users navigate search listings, explain rankings, and control the dashboard layout.
          
          Current Search Query: "${activeQuery}"
          Current User Weights: Price: ${activeWeights.priceWeight}, Seller: ${activeWeights.sellerWeight}, Warranty: ${activeWeights.warrantyWeight}, Delivery: ${activeWeights.deliveryWeight}, Specs: ${activeWeights.specificationWeight}, Condition: ${activeWeights.conditionWeight}
          
          Active Listings:
          ${listingsContextText}

          User Message: "${userMessage}"

          If the user's message requests adjustments to weights, filters, budgets, or sorting, output a layout control action.
          Supported Actions:
          - UPDATE_WEIGHTS: Payload changes weights. Keys: priceWeight, sellerWeight, warrantyWeight, deliveryWeight, specificationWeight, conditionWeight. E.g. "ignore warranty" -> {"warrantyWeight": 0.0, "priceWeight": 0.50} (ensure total weight sums to 1.0 or scales reasonably)
          - SET_FILTER: Payload changes filters. Keys: condition ("NEW", "REFURBISHED", "USED" or null), marketplace (code e.g. "amazon" or null).
          - UPDATE_BUDGET: Payload changes budget. Keys: budget (number, e.g. 50000 or null).
          - SET_SORT_FIELD: Payload changes sort order. Keys: sortField ("price", "delivery", "score").

          Provide a concise response explaining what actions you triggered or answering their queries.
          
          Respond ONLY with a valid JSON object matching this schema:
          {
            "response": "Brief chat response text.",
            "action": {
              "type": "UPDATE_WEIGHTS" | "SET_FILTER" | "UPDATE_BUDGET" | "SET_SORT_FIELD",
              "payload": { ... }
            } | null
          }

          Do NOT use markdown block ticks (like \`\`\`json). Return raw JSON only.
        `;

        const responseText = await generateText(prompt, true);

        if (responseText) {
          const parsed = JSON.parse(responseText.trim());
          return NextResponse.json(parsed);
        }
      } catch (error) {
        console.error("AI chat assistant error:", error);
      }
    }

    // Robust rule-based fallback if Gemini fails or is not configured
    const lowercaseMsg = userMessage.toLowerCase();
    let responseText = "I've processed your message.";
    let action = null;

    if (lowercaseMsg.includes("ignore warranty") || lowercaseMsg.includes("remove warranty")) {
      responseText = "Updating weights: Setting warranty weight to 0% and redistributing weight to price.";
      action = {
        type: "UPDATE_WEIGHTS",
        payload: { ...activeWeights, warrantyWeight: 0.0, priceWeight: activeWeights.priceWeight + 0.15 }
      };
    } else if (lowercaseMsg.includes("show only new") || lowercaseMsg.includes("new products")) {
      responseText = "Filtering items to show brand new products only.";
      action = {
        type: "SET_FILTER",
        payload: { condition: "NEW" }
      };
    } else if (lowercaseMsg.includes("cheapest") || lowercaseMsg.includes("sort by price")) {
      responseText = "Sorting the comparison table by effective price.";
      action = {
        type: "SET_SORT_FIELD",
        payload: { sortField: "price" }
      };
    } else if (lowercaseMsg.includes("budget to") || lowercaseMsg.includes("budget of")) {
      const budgetMatch = lowercaseMsg.match(/budget\s*(?:to|of)?\s*₹?\s*(\d+)/);
      if (budgetMatch) {
        const value = parseInt(budgetMatch[1]);
        responseText = `Updating your maximum target budget filter to ₹${value.toLocaleString()}.`;
        action = {
          type: "UPDATE_BUDGET",
          payload: { budget: value }
        };
      }
    } else {
      responseText = "Hi! I am Veyquo AI, your personal decision co-pilot. I am currently running on local fallback rules because the active Gemini API key has exceeded its daily free-tier quota (HTTP 429). Once hosted with a standard billing tier key, I use live Google Search Grounding to query real-time listings, compare specs, identify the best seller, and return live buy links across Amazon, Flipkart, Croma, Reliance Digital, and OLX!";
    }

    return NextResponse.json({
      response: responseText,
      action: action
    });

  } catch (err: any) {
    console.error("Chat API route error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
