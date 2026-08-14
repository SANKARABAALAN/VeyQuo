import { extractIntent, ExtractedIntent } from './intent';
import { CONNECTORS, MarketplaceListing } from './connectors';
import { normalizeSpecsList, NormalizedSpec } from './normalizer';
import { compareListings, extractAttributes } from './matching';
import { calculateScores, rankListings, ScoredListing, UserWeights } from './scoring';
import { generateText, hasAI } from '../gemini';
import { prisma } from '../prisma';

export interface PipelineVariantGroup {
  id: string;
  name: string;
  brand: string;
  model: string;
  ram: string | null;
  storage: string | null;
  condition: string;
  specifications: NormalizedSpec[];
  listings: ScoredListing[];
  bestScore: number;
  avgPrice: number;
  minPrice: number;
}

export interface PipelineResult {
  intent: ExtractedIntent;
  variants: PipelineVariantGroup[];
  recommendation: {
    summary: string;
    bestForYouId: string | null;
    bestValueId: string | null;
    lowestPriceId: string | null;
    mostTrustedId: string | null;
    bestWarrantyId: string | null;
    bestDeliveryId: string | null;
  };
}

// Generate realistic mock listings for any category in demo mode using Gemini
async function generateDynamicDemoListings(
  category: string,
  query: string,
  specsToCompare: string[]
): Promise<any[]> {
  if (!hasAI()) return [];
  
  try {
    const prompt = `
      You are an expert product specialist for VEYQUO. The user searched for: "${query}" in the category: "${category}".
      Generate 5 to 6 realistic, diverse, and structured marketplace listings that match this query.
      Ensure there is a mix of high-end, budget-friendly, new, and refurbished options across different marketplaces (Amazon, Flipkart, Croma, Reliance Digital).
      
      For each listing, return a JSON object conforming exactly to this structure:
      {
        "title": "Clean full product title, e.g. Samsung 253L 3 Star Frost Free Refrigerator",
        "brand": "Samsung",
        "model": "253L Frost Free",
        "price": 28490,
        "deliveryFee": 0,
        "discount": 1500,
        "condition": "NEW" or "REFURBISHED" or "USED",
        "warranty": "1 Year Comprehensive Warranty",
        "warrantyMonths": 12,
        "deliveryDays": 3,
        "returnPolicy": "10 Days Replacement",
        "sellerName": "Appario Retail" or another realistic seller,
        "sellerRating": 4.4,
        "sellerTrustStatus": "VERIFIED" or "UNKNOWN",
        "marketplaceName": "Amazon" or "Flipkart" or "Croma" or "Reliance Digital",
        "marketplaceCode": "amazon" or "flipkart" or "croma" or "reliance",
        "specifications": [
          // Must include the following keys: ${JSON.stringify(specsToCompare)}
          // E.g. {"key": "Capacity", "value": "253 Liters"}, {"key": "Energy Rating", "value": "3 Star"}
        ]
      }

      Return ONLY a valid JSON array of these listings. Do not add markdown backticks or any other text.
    `;

    const responseText = await generateText(prompt, true, true);

    if (responseText) {
      return JSON.parse(responseText.trim());
    }
  } catch (error) {
    console.error("Error generating dynamic demo listings:", error);
  }
  return [];
}

// Insert dynamically generated mock listings into database
async function saveDynamicListingsToDb(category: string, listingsData: any[]) {
  try {
    for (const data of listingsData) {
      // 1. Ensure Marketplace exists
      const marketplace = await prisma.marketplace.upsert({
        where: { code: data.marketplaceCode },
        update: {},
        create: {
          name: data.marketplaceName,
          code: data.marketplaceCode,
          logoUrl: `/images/marketplaces/${data.marketplaceCode}.png`,
          baseUrl: `https://www.${data.marketplaceCode}.com`
        }
      });

      // 2. Ensure Seller exists
      const seller = await prisma.seller.upsert({
        where: {
          name_marketplace: {
            name: data.sellerName,
            marketplace: data.marketplaceName
          }
        },
        update: {
          rating: data.sellerRating,
          trustStatus: data.sellerTrustStatus
        },
        create: {
          name: data.sellerName,
          marketplace: data.marketplaceName,
          rating: data.sellerRating,
          trustStatus: data.sellerTrustStatus
        }
      });

      // 3. Ensure Product exists
      let product = await prisma.product.findFirst({
        where: {
          brand: data.brand,
          name: data.model,
          category: category
        }
      });
      if (!product) {
        product = await prisma.product.create({
          data: {
            brand: data.brand,
            name: data.model,
            category: category
          }
        });
      }

      // 4. Create ProductVariant
      const variantName = `${data.brand} ${data.model}`;
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: variantName,
        }
      });

      // 5. Save Specifications for the variant
      if (data.specifications && Array.isArray(data.specifications)) {
        for (const spec of data.specifications) {
          await prisma.specification.create({
            data: {
              variantId: variant.id,
              key: spec.key,
              originalValue: spec.value,
              normalizedValue: spec.value
            }
          });
        }
      }

      // 6. Create Listing
      const effectivePrice = data.price + (data.deliveryFee || 0) - (data.discount || 0);
      await prisma.listing.create({
        data: {
          variantId: variant.id,
          marketplaceId: marketplace.id,
          sellerId: seller.id,
          title: data.title,
          url: `https://www.${data.marketplaceCode}.com/dp/${Math.random().toString(36).substring(7)}`,
          price: data.price,
          deliveryFee: data.deliveryFee || 0,
          discount: data.discount || 0,
          effectivePrice: effectivePrice,
          condition: data.condition || 'NEW',
          warranty: data.warranty,
          warrantyMonths: data.warrantyMonths || 0,
          deliveryDays: data.deliveryDays || 3,
          returnPolicy: data.returnPolicy || '7 Days Replacement',
          sourceType: 'DEMO_DATA'
        }
      });
    }
  } catch (error) {
    console.error("Error saving dynamic listings to database:", error);
  }
}

export async function runDecisionPipeline(
  query: string,
  userWeights: UserWeights,
  customListings: MarketplaceListing[] = []
): Promise<PipelineResult> {
  // Step 1: Extract Intent
  console.log("Pipeline Step 1: Extracting Intent...");
  const intent = await extractIntent(query);
  console.log("Extracted Intent:", intent);

  // Step 2: Product Discovery / Ingestion
  console.log("Pipeline Step 2: Discovering listings...");
  let listings: MarketplaceListing[] = [];
  
  if (customListings.length > 0) {
    listings = customListings;
  } else {
    for (const connector of CONNECTORS) {
      const results = await connector.search(intent.category);
      listings.push(...results);
    }

    // Dynamic generation fallback if DB does not have listings for this category
    if (listings.length === 0) {
      console.log(`No seeded listings found for category "${intent.category}". Generating dynamic demo listings...`);
      try {
        const generatedListings = await generateDynamicDemoListings(intent.category, query, intent.specificationsToCompare);
        if (generatedListings && generatedListings.length > 0) {
          await saveDynamicListingsToDb(intent.category, generatedListings);
          
          // Query again after saving
          listings = [];
          for (const connector of CONNECTORS) {
            const results = await connector.search(intent.category);
            listings.push(...results);
          }
        }
      } catch (err) {
        console.warn("Dynamic demo listings generation failed, falling back to local mock generator:", err);
      }

      // Final local generator fallback if DB is empty and API is exhausted (e.g., 429 errors)
      if (listings.length === 0) {
        console.log(`Generating mock listings locally for category "${intent.category}"`);
        listings = generateMockListingsLocally(intent.category, query, intent.specificationsToCompare);
      }
    }
  }

  if (listings.length === 0) {
    return {
      intent,
      variants: [],
      recommendation: {
        summary: "No products or listings could be discovered matching your criteria. Try widening your search or pasting listing URLs.",
        bestForYouId: null,
        bestValueId: null,
        lowestPriceId: null,
        mostTrustedId: null,
        bestWarrantyId: null,
        bestDeliveryId: null,
      }
    };
  }

  // Step 3: Match Listings into Variant Groups
  console.log("Pipeline Step 3: Grouping listings into variants...");
  const variantGroups: PipelineVariantGroup[] = [];
  let groupCounter = 1;

  for (const listing of listings) {
    let matchedGroup: PipelineVariantGroup | null = null;

    // Compare with existing groups to find a match
    for (const group of variantGroups) {
      const referenceListing = group.listings[0] as any;
      const match = await compareListings(
        { title: listing.title, category: intent.category, specs: listing.specifications },
        { 
          title: referenceListing.title, 
          category: intent.category, 
          specs: referenceListing.specifications.map((s: any) => ({ key: s.key, value: s.value || s.originalValue || "" })) 
        }
      );

      if (match.status === 'SAME_PRODUCT') {
        matchedGroup = group;
        break;
      }
    }

    const attrs = extractAttributes(listing.title, intent.category, listing.specifications);

    if (matchedGroup) {
      matchedGroup.listings.push(listing as any);
    } else {
      const newGroup: PipelineVariantGroup = {
        id: `variant-group-${groupCounter++}`,
        name: listing.title,
        brand: attrs.brand,
        model: attrs.model,
        ram: attrs.ram,
        storage: attrs.storage,
        condition: attrs.condition,
        specifications: normalizeSpecsList(listing.specifications),
        listings: [listing as any],
        bestScore: 0,
        avgPrice: 0,
        minPrice: 0,
      };
      variantGroups.push(newGroup);
    }
  }

  // Step 4: Deterministic Scoring & Ranking of Listings within each Variant Group
  console.log("Pipeline Step 4: Scoring and ranking listings...");
  
  const allListingsToScore = variantGroups.flatMap(g => 
    g.listings.map((l: any) => ({
      id: l.id || Math.random().toString(36).substring(7),
      title: l.title,
      url: l.url,
      price: l.price,
      deliveryFee: l.deliveryFee || 0,
      discount: l.discount || 0,
      effectivePrice: l.effectivePrice || l.price,
      condition: l.condition || 'NEW',
      warranty: l.warranty || 'No warranty info',
      warrantyMonths: l.warrantyMonths || 0,
      deliveryDays: l.deliveryDays || 3,
      returnPolicy: l.returnPolicy || 'No returns policy',
      sellerName: l.sellerName || 'Generic seller',
      sellerRating: l.sellerRating,
      sellerTrustStatus: l.sellerTrustStatus || 'UNKNOWN',
      marketplaceName: l.marketplaceName || 'Marketplace',
      marketplaceCode: l.marketplaceCode || 'unknown',
      dataCompleteness: 0.9,
      matchConfidence: 1.0,
      specifications: l.specifications.map((s: any) => ({ key: s.key, normalizedValue: s.value || s.normalizedValue || "" })),
    }))
  );

  const scoredAllListings = calculateScores(allListingsToScore, userWeights);
  const rankedAllListings = rankListings(scoredAllListings);

  // Map scored listings back to their groups
  for (const group of variantGroups) {
    const groupListings = rankedAllListings.filter(rl => 
      group.listings.some((gl: any) => gl.title === rl.title && gl.url === rl.url)
    );
    
    group.listings = groupListings;
    
    if (groupListings.length > 0) {
      group.bestScore = Math.max(...groupListings.map(l => l.scores.totalScore));
      group.avgPrice = Math.round(groupListings.reduce((sum, l) => sum + l.effectivePrice, 0) / groupListings.length);
      group.minPrice = Math.min(...groupListings.map(l => l.effectivePrice));
      
      let suffix = "";
      if (group.ram) suffix += ` ${group.ram}`;
      if (group.storage) suffix += ` / ${group.storage}`;
      if (group.condition !== 'NEW') suffix += ` (${group.condition})`;
      group.name = `${group.brand} ${group.model}${suffix}`.trim();
    }
  }

  // Sort groups by best listing score descending
  variantGroups.sort((a, b) => b.bestScore - a.bestScore);

  // Step 5: Highlight specific badges / recommendations
  let bestForYouId: string | null = null;
  let bestValueId: string | null = null;
  let lowestPriceId: string | null = null;
  let mostTrustedId: string | null = null;
  let bestWarrantyId: string | null = null;
  let bestDeliveryId: string | null = null;

  if (rankedAllListings.length > 0) {
    bestForYouId = rankedAllListings[0].id;

    const sortedByPrice = [...rankedAllListings].sort((a, b) => a.effectivePrice - b.effectivePrice);
    lowestPriceId = sortedByPrice[0].id;

    const sortedByValue = [...rankedAllListings].sort((a, b) => 
      (b.scores.specificationScore / (b.effectivePrice / 10000)) - (a.scores.specificationScore / (a.effectivePrice / 10000))
    );
    bestValueId = sortedByValue[0].id;

    const sortedByTrust = [...rankedAllListings].sort((a, b) => b.scores.sellerScore - a.scores.sellerScore);
    mostTrustedId = sortedByTrust[0].id;

    const sortedByWarranty = [...rankedAllListings].sort((a, b) => b.scores.warrantyScore - a.scores.warrantyScore);
    bestWarrantyId = sortedByWarranty[0].id;

    const sortedByDelivery = [...rankedAllListings].sort((a, b) => b.scores.deliveryScore - a.scores.deliveryScore);
    bestDeliveryId = sortedByDelivery[0].id;
  }

  // Step 6: Generate AI Explanation
  console.log("Pipeline Step 6: Generating recommendation report...");
  let summary = "";

  if (hasAI()) {
    try {
      const topListingsSummary = (rankedAllListings as any[]).slice(0, 3).map((l, index) => 
        `Rank #${index + 1}: ${l.title} on ${l.marketplaceName} sold by ${l.sellerName}. Effective Price: ₹${l.effectivePrice}, Overall Score: ${l.scores.totalScore}/1.0 (Price Score: ${l.scores.priceScore.toFixed(2)}, Seller: ${l.scores.sellerScore.toFixed(2)}, Warranty: ${l.scores.warrantyScore.toFixed(2)}, Delivery: ${l.scores.deliveryScore.toFixed(2)}, Specs: ${l.scores.specificationScore.toFixed(2)}).`
      ).join("\n");

      const prompt = `
        You are the AI Decision Analyst for VEYQUO, a decision intelligence platform.
        Synthesize a highly professional, user-friendly recommendation report based on the following pipeline data.
        
        User Search Query: "${query}"
        User Weights: Price ${Math.round(userWeights.priceWeight*100)}%, Seller Rating ${Math.round(userWeights.sellerWeight*100)}%, Warranty ${Math.round(userWeights.warrantyWeight*100)}%, Delivery Speed ${Math.round(userWeights.deliveryWeight*100)}%, Technical Specifications ${Math.round(userWeights.specificationWeight*100)}%, Product Condition ${Math.round(userWeights.conditionWeight*100)}%.

        Top 3 Scoring Listings:
        ${topListingsSummary}

        Write a concise, engaging summary (max 3 paragraphs) answering:
        1. Which listing is the absolute best match for this user and WHY (mapping directly to their weights and the structured scores)?
        2. What is the key trade-off of the winning option (e.g. costs slightly more but has better warranty, or has slower delivery but better seller rating)?
        3. Why did the other close alternatives lose?

        CRITICAL: Use ONLY facts provided above. Do not invent any pricing, warranties, or ratings that are not in the top listings summary. Do not use generic placeholders.
      `;

      const responseText = await generateText(prompt, false, false);

      if (responseText) {
        summary = responseText.trim();
      }
    } catch (e) {
      console.warn("AI recommendation summary failed, falling back to rule-based summary.", e);
    }
  }

  // Fallback rule-based summary if AI is unavailable or failed
  if (!summary && rankedAllListings.length > 0) {
    const winner = rankedAllListings[0] as any;
    const second = rankedAllListings[1] as any;
    
    summary = `Based on your query and personalized scoring weights, the **${winner.title}** on **${winner.marketplaceName}** is your best match with an overall score of **${winner.scores.totalScore}/1.0**.\n\nIt stands out because it offers an effective price of **₹${winner.effectivePrice}** with a high seller rating of **${winner.sellerRating || 'N/A'}/5.0** and **${winner.warranty || 'standard'}** protection. `;
    
    if (second) {
      summary += `Compared to your next best choice, the **${second.title}** on **${second.marketplaceName}** (score: **${second.scores.totalScore}**), this option saves you **₹${Math.max(0, Math.round(second.effectivePrice - winner.effectivePrice))}** and offers a superior combination of ratings and delivery times.`;
    }
  }

  return {
    intent,
    variants: variantGroups,
    recommendation: {
      summary,
      bestForYouId,
      bestValueId,
      lowestPriceId,
      mostTrustedId,
      bestWarrantyId,
      bestDeliveryId,
    }
  };
}

// ----------------------------------------------------
// Robust Fallback Generator: Local specifications and listings
// ----------------------------------------------------
export function generateMockListingsLocally(category: string, query: string, specsToCompare: string[]) {
  const listings = [];
  const brands: Record<string, string[]> = {
    'Smartphones': ['Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Google'],
    'Laptops': ['Dell', 'HP', 'Lenovo', 'Apple', 'Asus'],
    'Refrigerators': ['LG', 'Samsung', 'Whirlpool', 'Godrej', 'Haier'],
    'Washing Machines': ['IFB', 'LG', 'Samsung', 'Bosch', 'Panasonic'],
    'Smartwatches': ['Apple', 'Samsung', 'Fitbit', 'Garmin', 'Fossil'],
    'Earbuds': ['Sony', 'Bose', 'Sennheiser', 'OnePlus', 'JBL'],
    'Wireless Earbuds': ['Sony', 'Bose', 'Sennheiser', 'OnePlus', 'JBL'],
    'Earphones': ['Sony', 'Bose', 'Sennheiser', 'OnePlus', 'JBL'],
    'TVs': ['Sony', 'Samsung', 'LG', 'OnePlus', 'Xiaomi'],
    'TV': ['Sony', 'Samsung', 'LG', 'OnePlus', 'Xiaomi'],
    'Televisions': ['Sony', 'Samsung', 'LG', 'OnePlus', 'Xiaomi'],
    'Shoes': ['Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour']
  };

  const matchedKey = Object.keys(brands).find(k => k.toLowerCase() === category.toLowerCase()) || 'Smartphones';
  const selectedBrands = brands[matchedKey];
  const marketNames = ['Amazon', 'Flipkart', 'Croma', 'Reliance Digital', 'Tata CLiQ'];
  const marketCodes = ['amazon', 'flipkart', 'croma', 'reliance', 'tatacliq'];

  for (let i = 0; i < 30; i++) {
    const brand = selectedBrands[i % selectedBrands.length];
    const model = `${category} Model-${i + 1} Z`;
    const title = `${brand} ${model} with High Performance`;
    const price = 4999 + i * 2500;
    const condition = i % 10 === 8 ? 'REFURBISHED' : i % 10 === 9 ? 'USED' : 'NEW';

    const specs = specsToCompare.map(key => {
      let val = 'Standard';
      if (key.toLowerCase().includes('capacity')) val = `${180 + i * 2} Liters`;
      else if (key.toLowerCase().includes('rating')) val = `${3 + (i % 3)} Star`;
      else if (key.toLowerCase().includes('ram')) val = `${4 + (i % 3) * 4} GB`;
      else if (key.toLowerCase().includes('storage')) val = `${64 + (i % 3) * 64} GB`;
      else if (key.toLowerCase().includes('warranty')) val = `${1 + (i % 2)} Year Manufacturer`;
      else if (key.toLowerCase().includes('processor')) val = i % 2 === 0 ? 'Intel Core i5' : 'AMD Ryzen 5';
      else if (key.toLowerCase().includes('size')) val = `${8 + (i % 4)}`;
      return { key, value: val };
    });

    const deliveryFee = i % 2 === 0 ? 0 : 99;
    const discount = i % 3 === 0 ? 500 : 0;
    listings.push({
      title,
      brand,
      model,
      price,
      deliveryFee,
      discount,
      effectivePrice: price + deliveryFee - discount,
      condition: condition as 'NEW' | 'REFURBISHED' | 'USED',
      url: `https://www.${marketCodes[i % marketCodes.length]}.com/search?q=${encodeURIComponent(title)}`,
      warranty: `${1 + (i % 2)} Year Manufacturer Warranty`,
      warrantyMonths: (1 + (i % 2)) * 12,
      deliveryDays: 1 + (i % 4),
      returnPolicy: "10 Days Return Policy",
      sellerName: `Seller-${brand}-${i}`,
      sellerRating: parseFloat((4.0 + ((i % 5) * 0.2)).toFixed(1)),
      sellerReviewCount: 120 + i * 15,
      sellerTrustStatus: (i % 2 === 0 ? 'VERIFIED' : 'UNKNOWN') as 'VERIFIED' | 'UNKNOWN',
      marketplaceName: marketNames[i % marketNames.length],
      marketplaceCode: marketCodes[i % marketCodes.length],
      specifications: specs,
      sourceType: 'DEMO_DATA' as const
    });
  }
  return listings;
}

// ----------------------------------------------------
// 2nd stage comparison: Platform deals & coupon offerings
// ----------------------------------------------------
export async function runDealsPipeline(
  productName: string,
  userWeights: UserWeights
): Promise<PipelineResult> {
  console.log(`Deals Pipeline: Fetching deals for ${productName}...`);
  
  let listings: any[] = [];
  let summary = "";

  const intent: ExtractedIntent = {
    category: "Deals Compare",
    budget: null,
    useCase: null,
    priority: "price" as const,
    condition: "NEW" as const,
    specificationsToCompare: ["Price", "Coupon Discount", "Card Offer", "Final Price", "Delivery Speed", "Warranty"],
    rawInput: productName
  };

  if (hasAI()) {
    try {
      const prompt = `
        Search the live internet for active pricing, delivery details, coupon codes, and bank/credit card offers for: "${productName}"
        across the following 5 online platforms in India: Amazon.in, Flipkart, Croma, Reliance Digital, and Tata CLiQ.
        
        For each platform, return a JSON object containing:
        {
          "marketplaceName": "Amazon" | "Flipkart" | "Croma" | "Reliance Digital" | "Tata CLiQ",
          "marketplaceCode": "amazon" | "flipkart" | "croma" | "reliance" | "tatacliq",
          "title": "Full product title on this site",
          "price": Selling price before coupons (number, e.g. 45000),
          "deliveryFee": Delivery fee (number, e.g. 0),
          "couponCode": "Active coupon code text, e.g. SAVE500, or null if none",
          "couponDiscount": Discount amount from the coupon code (number, e.g. 500, or 0 if none),
          "bankOffer": "Card discount description, e.g. 10% off with HDFC Card, or null if none",
          "bankDiscount": Max discount amount from card offer (number, e.g. 1500, or 0 if none),
          "deliveryDays": Delivery days (number, e.g. 2),
          "warranty": "Warranty text",
          "url": "Direct product listing link"
        }
        
        Return ONLY a valid JSON array.
      `;
      const responseText = await generateText(prompt, true, true);

      if (responseText) {
        listings = JSON.parse(responseText.trim());
      }
    } catch (e) {
      console.warn("AI deals fetch failed, falling back to local deals generator.", e);
    }
  }

  if (listings.length === 0) {
    listings = generateMockDealsLocally(productName);
  }

  const processedListings = listings.map((l, index) => {
    const couponDiscount = l.couponDiscount || 0;
    const bankDiscount = l.bankDiscount || 0;
    const deliveryFee = l.deliveryFee || 0;
    const basePrice = l.price;
    const effectivePrice = basePrice + deliveryFee - (couponDiscount + bankDiscount);

    const maxPrice = Math.max(...listings.map(item => item.price));
    const minPrice = Math.min(...listings.map(item => item.price));
    const priceScore = maxPrice === minPrice ? 1.0 : 1.0 - ((effectivePrice - minPrice) / (maxPrice - minPrice));

    const totalScore = parseFloat((priceScore * 0.8 + (1.0 - (l.deliveryDays / 10)) * 0.2).toFixed(2));

    return {
      id: `deal-${l.marketplaceCode}-${index}`,
      title: l.title || `${productName} on ${l.marketplaceName}`,
      url: l.url || `https://www.${l.marketplaceCode}.com`,
      price: basePrice,
      deliveryFee,
      discount: couponDiscount + bankDiscount,
      effectivePrice,
      condition: l.condition || "NEW",
      deliveryText: l.deliveryText || (deliveryFee === 0 ? "Free" : `₹${deliveryFee}`),
      warranty: l.warranty || "1 Year Manufacturer",
      warrantyMonths: 12,
      deliveryDays: l.deliveryDays || 3,
      returnPolicy: "10 Days Return",
      sellerName: "Authorized Retailer",
      sellerRating: l.sellerRating || 4.5,
      sellerTrustStatus: "VERIFIED",
      marketplaceName: l.marketplaceName,
      marketplaceCode: l.marketplaceCode,
      couponCode: l.couponCode || null,
      bankOffer: l.bankOffer || null,
      dataCompleteness: 1.0,
      matchConfidence: 1.0,
      specifications: [
        { key: "Base Price", normalizedValue: `₹${basePrice.toLocaleString()}` },
        { key: "Coupon", normalizedValue: l.couponCode ? `${l.couponCode} (-₹${couponDiscount})` : "None" },
        { key: "Bank Offer", normalizedValue: l.bankOffer ? `${l.bankOffer} (-₹${bankDiscount})` : "None" },
        { key: "Delivery Time", normalizedValue: `${l.deliveryDays} Days` }
      ],
      scores: {
        totalScore,
        priceScore,
        sellerScore: 0.9,
        warrantyScore: 0.8,
        deliveryScore: 1.0 - (l.deliveryDays / 10),
        specificationScore: 0.9,
        conditionScore: 1.0,
        returnScore: 1.0,
        dataCompleteness: 1.0,
        matchConfidence: 1.0
      }
    };
  });

  processedListings.sort((a, b) => b.scores.totalScore - a.scores.totalScore);

  const bestForYouId = processedListings[0]?.id || null;
  const lowestPriceId = [...processedListings].sort((a, b) => a.effectivePrice - b.effectivePrice)[0]?.id || null;

  if (processedListings.length > 0) {
    const winner = processedListings[0];
    summary = `For the **${productName}**, the best platform to purchase from is **${winner.marketplaceName}**.\n\nIt offers the lowest effective price of **₹${winner.effectivePrice.toLocaleString()}** (Base price ₹${winner.price.toLocaleString()} + ₹${winner.deliveryFee} delivery fee minus coupon code discounts). `;
    if (winner.couponCode) {
      summary += `Be sure to apply coupon code **${winner.couponCode}** at checkout to save ₹${winner.discount} instantly! `;
    }
    if (winner.bankOffer) {
      summary += `You can also get an additional discount of **₹${winner.discount}** using the card offer: *"${winner.bankOffer}"*.`;
    }
  }

  return {
    intent,
    variants: [{
      id: "deals-comparison-group",
      name: productName,
      brand: "Platform Compare",
      model: productName,
      ram: null,
      storage: null,
      condition: "NEW",
      specifications: [],
      listings: processedListings,
      bestScore: Math.max(...processedListings.map(l => l.scores.totalScore)),
      avgPrice: Math.round(processedListings.reduce((sum, l) => sum + l.effectivePrice, 0) / processedListings.length),
      minPrice: Math.min(...processedListings.map(l => l.effectivePrice))
    }],
    recommendation: {
      summary,
      bestForYouId,
      bestValueId: bestForYouId,
      lowestPriceId,
      mostTrustedId: bestForYouId,
      bestWarrantyId: bestForYouId,
      bestDeliveryId: bestForYouId
    }
  };
}

function generateMockDealsLocally(productName: string) {
  const platforms = [
    { name: 'Amazon', code: 'amazon', baseOffset: 0, coupon: 'AMZ500', couponAmt: 500, bank: 'SBI Card 10% off', bankAmt: 1000, days: 2, condition: 'NEW', warranty: '1 Year Brand Warranty', deliveryText: 'Free' },
    { name: 'Flipkart', code: 'flipkart', baseOffset: -1499, coupon: 'FLIPNEW', couponAmt: 300, bank: 'HDFC Card 10% off', bankAmt: 1200, days: 3, condition: 'NEW', warranty: '1 Year Brand Warranty', deliveryText: 'Free' },
    { name: 'OLX', code: 'olx', baseOffset: -9999, coupon: null, couponAmt: 0, bank: null, bankAmt: 0, days: 1, condition: 'USED', warranty: '3 Months Seller Warranty', deliveryText: 'Pickup' },
    { name: 'Croma', code: 'croma', baseOffset: 200, coupon: 'CROMA400', couponAmt: 400, bank: 'ICICI Card 5% off', bankAmt: 800, days: 4, condition: 'NEW', warranty: '1 Year Brand Warranty', deliveryText: 'Free' },
    { name: 'Reliance Digital', code: 'reliance', baseOffset: 500, coupon: 'RELIANCE1000', couponAmt: 1000, bank: 'OneCard Flat ₹1000 off', bankAmt: 1000, days: 3, condition: 'NEW', warranty: '1 Year Brand Warranty', deliveryText: 'Free' },
    { name: 'Tata CLiQ', code: 'tatacliq', baseOffset: -100, coupon: 'CLIQ500', couponAmt: 500, bank: 'Axis Bank Flat ₹750 off', bankAmt: 750, days: 5, condition: 'NEW', warranty: '1 Year Brand Warranty', deliveryText: 'Free' }
  ];

  let basePrice = 24999;
  const lowerName = productName.toLowerCase();
  if (lowerName.includes('iphone') || lowerName.includes('apple')) basePrice = 49999;
  else if (lowerName.includes('earbud') || lowerName.includes('earphone')) basePrice = 8999;
  else if (lowerName.includes('refrigerator')) basePrice = 28490;
  else if (lowerName.includes('laptop')) basePrice = 54990;

  return platforms.map(p => {
    let finalBasePrice = basePrice + p.baseOffset;
    if (p.code === 'olx') {
      finalBasePrice = Math.round(basePrice * 0.8); // Pre-owned discount
    }
    return {
      marketplaceName: p.name,
      marketplaceCode: p.code,
      title: `${productName} (${p.condition === 'USED' ? 'Pre-owned' : 'Brand New'})`,
      price: finalBasePrice,
      deliveryFee: p.deliveryText === 'Pickup' ? 0 : 99,
      couponCode: p.coupon,
      couponDiscount: p.couponAmt,
      bankOffer: p.bank,
      bankDiscount: p.bankAmt,
      deliveryDays: p.days,
      warranty: p.warranty,
      condition: p.condition,
      deliveryText: p.deliveryText,
      sellerRating: p.code === 'olx' ? 3.9 : 4.5,
      url: `https://www.${p.code}.com/search?q=${encodeURIComponent(productName)}`
    };
  });
}

