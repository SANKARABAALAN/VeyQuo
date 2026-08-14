import { NextResponse } from 'next/server';
import { generateText, hasAI } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { listings, query, weights } = await request.json();
    
    if (!listings || !Array.isArray(listings) || listings.length === 0) {
      return NextResponse.json({ error: "Listings are required for analysis." }, { status: 400 });
    }

    if (!hasAI()) {
      // Fallback rule-based analysis
      const sorted = [...listings].sort((a, b) => b.score - a.score);
      const winner = sorted[0];
      const second = sorted[1];
      let summary = `🏆 **${winner.title}** is selected as the Best Overall Product for you. (Effective Price: ₹${winner.effectivePrice.toLocaleString()}).`;
      if (second) {
        summary += ` Compared to **${second.title}** (Effective Price: ₹${second.effectivePrice.toLocaleString()}), it provides the best balance of price, seller trust, and specifications according to your weights.`;
      }
      return NextResponse.json({ summary });
    }

    const listingsSummary = listings.map((l: any, idx: number) => 
      `Option #${idx + 1}: Title: ${l.title}, Brand: ${l.brand}, Effective Price: ₹${l.effectivePrice}, Seller Rating: ${l.sellerRating}/5.0, Warranty: ${l.warranty || 'N/A'}, Condition: ${l.condition || 'NEW'}, Specifications: ${JSON.stringify(l.specifications || [])}`
    ).join("\n");

    const prompt = `
      You are the AI Decision Analyst for VEYQUO, a decision intelligence platform.
      Provide a detailed, expert comparison and recommendation report for the following products based on the user's weights.
      
      DO NOT simply suggest the cheapest item. You must analyze the specifications (features, capacity, RAM, storage, etc.) and balance them against the cost. Explain which is the best value overall.

      User Query: "${query || 'Product Comparison'}"
      User weights:
      - Price Priority: ${Math.round((weights?.priceWeight || 0.4) * 100)}%
      - Seller Trust: ${Math.round((weights?.sellerWeight || 0.2) * 100)}%
      - Warranty Protection: ${Math.round((weights?.warrantyWeight || 0.15) * 100)}%
      - Delivery Speed: ${Math.round((weights?.deliveryWeight || 0.1) * 100)}%
      - Technical Specifications: ${Math.round((weights?.specificationWeight || 0.1) * 100)}%
      - Product Condition: ${Math.round((weights?.conditionWeight || 0.05) * 100)}%

      Compared Options:
      ${listingsSummary}

      Write a highly detailed, professional, and objective 3-paragraph analysis:
      1. Best Overall Recommendation: State which product is the absolute best match and explain why, focusing on the spec-to-cost value proposition (e.g. "iPhone 13 is recommended over iPhone 12 because for a 15% price increase you get 50% better specs, matching your high spec priority").
      2. Trade-offs: Contrast the key options. Detail what the user gains or sacrifices with each choice (price vs specs vs delivery vs warranty).
      3. Competitor Analysis: Briefly explain why the other options are less optimal for this specific query and set of weights.

      Format your output in clean Markdown.
    `;

    const summary = await generateText(prompt, false, false);
    return NextResponse.json({ summary: summary.trim() });
  } catch (error: any) {
    console.error("Comparison analysis error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
