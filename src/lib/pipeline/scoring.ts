export interface ListingScoringData {
  id: string;
  title: string;
  url: string;
  price: number;
  deliveryFee: number;
  discount: number;
  effectivePrice: number;
  condition: string; // NEW, REFURBISHED, USED
  warranty: string;
  warrantyMonths: number;
  deliveryDays: number;
  returnPolicy: string | null;
  sellerName: string;
  sellerRating: number | null;
  sellerTrustStatus: string;
  marketplaceName: string;
  marketplaceCode: string;
  dataCompleteness: number;
  matchConfidence: number;
  specifications: { key: string; normalizedValue: string }[];
}

export interface UserWeights {
  priceWeight: number;       // e.g. 0.40
  sellerWeight: number;      // e.g. 0.20
  warrantyWeight: number;    // e.g. 0.15
  deliveryWeight: number;    // e.g. 0.10
  specificationWeight: number; // e.g. 0.10
  conditionWeight: number;   // e.g. 0.05
}

export interface DetailedScores {
  priceScore: number;
  sellerScore: number;
  warrantyScore: number;
  deliveryScore: number;
  returnScore: number;
  specificationScore: number;
  conditionScore: number;
  dataCompleteness: number;
  matchConfidence: number;
  totalScore: number; // Personalized weighted sum
}

export interface ScoredListing extends ListingScoringData {
  scores: DetailedScores;
}

export function calculateScores(
  listings: ListingScoringData[],
  weights: UserWeights
): ScoredListing[] {
  if (listings.length === 0) return [];

  // Find min and max effective prices to normalize price score
  const effectivePrices = listings.map(l => l.effectivePrice);
  const minPrice = Math.min(...effectivePrices);
  const maxPrice = Math.max(...effectivePrices);
  const priceRange = maxPrice - minPrice;

  return listings.map(listing => {
    // 1. Price Score (Lower price is better. Scale 0 to 1)
    let priceScore = 1.0;
    if (priceRange > 0) {
      priceScore = 1.0 - (listing.effectivePrice - minPrice) / priceRange;
    }

    // 2. Seller Score
    const rating = listing.sellerRating !== null ? listing.sellerRating : 3.5; // Default rating if missing
    let sellerScore = rating / 5.0; // Scale 0-1
    if (listing.sellerTrustStatus === 'VERIFIED') {
      sellerScore = Math.min(1.0, sellerScore * 1.1); // 10% bonus for verified sellers
    } else if (listing.sellerTrustStatus === 'UNKNOWN') {
      sellerScore = sellerScore * 0.9; // 10% penalty for unknown
    }

    // 3. Warranty Score (Scale based on months, 24 months is max score of 1.0)
    const warrantyScore = Math.min(1.0, listing.warrantyMonths / 24.0);

    // 4. Delivery Score (Fewer days is better. 1 day is 1.0, 7 days is 0.14, 8+ days is 0.0)
    const deliveryScore = Math.max(0, 1.0 - (listing.deliveryDays - 1) / 7.0);

    // 5. Return Score
    let returnScore = 0.5; // Neutral default
    const policy = listing.returnPolicy ? listing.returnPolicy.toLowerCase() : '';
    if (policy.includes('refund') || policy.includes('return') || policy.includes('days replacement')) {
      returnScore = 1.0;
    } else if (policy.includes('replacement only')) {
      returnScore = 0.7;
    } else if (policy.includes('no return') || policy.includes('no replacement')) {
      returnScore = 0.0;
    }

    // 6. Specification Score
    // Calculate spec score based on RAM and Storage standard values
    let specScore = 0.5; // Default if no matching specs
    let specCount = 0;
    let specSum = 0;

    const ramSpec = listing.specifications.find(s => s.key.toLowerCase() === 'ram');
    if (ramSpec) {
      specCount++;
      const val = parseInt(ramSpec.normalizedValue);
      if (!isNaN(val)) {
        // Normalize RAM: 4GB -> 0.4, 8GB -> 0.7, 16GB -> 1.0
        if (val >= 16) specSum += 1.0;
        else if (val >= 8) specSum += 0.7;
        else specSum += 0.4;
      }
    }

    const storageSpec = listing.specifications.find(s => s.key.toLowerCase() === 'storage');
    if (storageSpec) {
      specCount++;
      const val = parseInt(storageSpec.normalizedValue);
      if (!isNaN(val)) {
        // Normalize Storage: 128GB -> 0.5, 256GB -> 0.7, 512GB -> 0.9, 1024GB (1TB) -> 1.0
        if (val >= 1024) specSum += 1.0;
        else if (val >= 512) specSum += 0.9;
        else if (val >= 256) specSum += 0.7;
        else specSum += 0.5;
      }
    }

    if (specCount > 0) {
      specScore = specSum / specCount;
    }

    // 7. Condition Score
    let conditionScore = 1.0;
    if (listing.condition === 'REFURBISHED') {
      conditionScore = 0.7;
    } else if (listing.condition === 'USED') {
      conditionScore = 0.4;
    }

    // Calculate dynamic personalized total score
    // Ensure weights sum to 1
    const totalWeights = 
      weights.priceWeight + 
      weights.sellerWeight + 
      weights.warrantyWeight + 
      weights.deliveryWeight + 
      weights.specificationWeight + 
      weights.conditionWeight;
      
    const wPrice = weights.priceWeight / totalWeights;
    const wSeller = weights.sellerWeight / totalWeights;
    const wWarranty = weights.warrantyWeight / totalWeights;
    const wDelivery = weights.deliveryWeight / totalWeights;
    const wSpec = weights.specificationWeight / totalWeights;
    const wCondition = weights.conditionWeight / totalWeights;

    const totalScore = 
      (priceScore * wPrice) +
      (sellerScore * wSeller) +
      (warrantyScore * wWarranty) +
      (deliveryScore * wDelivery) +
      (specScore * wSpec) +
      (conditionScore * wCondition);

    return {
      ...listing,
      scores: {
        priceScore,
        sellerScore,
        warrantyScore,
        deliveryScore,
        returnScore,
        specificationScore: specScore,
        conditionScore,
        dataCompleteness: listing.dataCompleteness,
        matchConfidence: listing.matchConfidence,
        totalScore: Math.round(totalScore * 100) / 100, // round to 2 decimal places
      }
    };
  });
}

// Perform ranking and sorting of listings
export function rankListings(
  listings: ScoredListing[]
): ScoredListing[] {
  // Sort primarily by totalScore descending, then by effectivePrice ascending
  return [...listings].sort((a, b) => {
    if (b.scores.totalScore !== a.scores.totalScore) {
      return b.scores.totalScore - a.scores.totalScore;
    }
    return a.effectivePrice - b.effectivePrice;
  });
}
