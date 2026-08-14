import { normalizeSpec } from './normalizer';
import { ai, GEMINI_MODEL_FLASH } from '../gemini';

export interface ProductAttributes {
  brand: string;
  model: string;
  ram: string | null;
  storage: string | null;
  color: string | null;
  condition: 'NEW' | 'REFURBISHED' | 'USED';
}

export interface MatchResult {
  status: 'SAME_PRODUCT' | 'DIFFERENT_VARIANT' | 'DIFFERENT_MODEL' | 'DIFFERENT_CONDITION' | 'INSUFFICIENT_INFORMATION';
  confidence: number; // 0.0 to 1.0
  reason: string;
}

// Deterministically extract attributes from a listing title and existing specs
export function extractAttributes(title: string, category: string, specs: { key: string; value: string }[] = []): ProductAttributes {
  const lowercaseTitle = title.toLowerCase();

  // 1. Brand Detection
  let brand = "Unknown";
  const brands = ["apple", "samsung", "oneplus", "google", "sony", "bose", "sennheiser", "dell", "hp", "lenovo", "asus", "acer", "lg", "canon", "nikon", "fujifilm"];
  for (const b of brands) {
    if (lowercaseTitle.includes(b)) {
      brand = b.charAt(0).toUpperCase() + b.slice(1);
      break;
    }
  }

  // 2. Condition Detection
  let condition: ProductAttributes['condition'] = "NEW";
  if (lowercaseTitle.match(/refurbished|refurb|renewed/)) {
    condition = "REFURBISHED";
  } else if (lowercaseTitle.match(/used|second\s*hand|preowned|pre-owned/)) {
    condition = "USED";
  }

  // Check specs for condition
  const condSpec = specs.find(s => s.key.toLowerCase() === 'condition');
  if (condSpec) {
    const v = condSpec.value.toUpperCase();
    if (v === 'REFURBISHED' || v === 'USED' || v === 'NEW') {
      condition = v as ProductAttributes['condition'];
    }
  }

  // 3. RAM Detection
  let ram: string | null = null;
  const ramSpec = specs.find(s => s.key.toLowerCase() === 'ram' || s.key.toLowerCase() === 'memory');
  if (ramSpec) {
    ram = normalizeSpec('ram', ramSpec.value);
  } else {
    // Match e.g., "8gb ram", "8 gb ram", "16gb" in title (not to be confused with storage)
    const ramMatch = lowercaseTitle.match(/(\d+)\s*(?:gb|g)\s*ram/);
    if (ramMatch) {
      ram = `${ramMatch[1]} GB`;
    } else {
      // Look for a standalone 8gb/16gb that isn't large (like 128gb, 256gb which are storage)
      const standaloneGbMatches = lowercaseTitle.match(/\b(4|6|8|12|16|24|32|64)\s*(?:gb|g)\b/g);
      if (standaloneGbMatches) {
        // Take the smallest GB value which represents RAM (usually <= 32 or 64 in some high-end pcs, but storage is usually >= 128)
        const vals = standaloneGbMatches.map(m => parseInt(m)).filter(v => v < 128);
        if (vals.length > 0) {
          ram = `${Math.min(...vals)} GB`;
        }
      }
    }
  }

  // 4. Storage Detection
  let storage: string | null = null;
  const storageSpec = specs.find(s => s.key.toLowerCase() === 'storage' || s.key.toLowerCase() === 'rom' || s.key.toLowerCase() === 'ssd' || s.key.toLowerCase() === 'hdd');
  if (storageSpec) {
    storage = normalizeSpec('storage', storageSpec.value);
  } else {
    // Match storage, e.g., "128gb", "256 gb ssd", "1tb", "1 tb ssd"
    if (lowercaseTitle.includes('tb') || lowercaseTitle.includes('1t')) {
      const tbMatch = lowercaseTitle.match(/(\d+)\s*tb/);
      storage = `${tbMatch ? parseInt(tbMatch[1]) * 1024 : 1024} GB`;
    } else {
      const storageMatch = lowercaseTitle.match(/\b(128|256|512|64)\s*(?:gb|g|ssd|rom|hdd)?\b/);
      if (storageMatch) {
        storage = `${storageMatch[1]} GB`;
      }
    }
  }

  // 5. Color Detection
  let color: string | null = null;
  const colors = ["black", "blue", "grey", "gray", "silver", "white", "gold", "green", "red", "yellow", "purple", "orange", "cool blue", "space grey", "space gray"];
  for (const c of colors) {
    if (lowercaseTitle.includes(c)) {
      color = c.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  // 6. Model Extraction (Clean the title)
  let model = title;
  // Try to remove brand, RAM, storage, and colors from model name
  let cleanModel = lowercaseTitle;
  if (brand !== "Unknown") {
    cleanModel = cleanModel.replace(brand.toLowerCase(), "");
  }
  cleanModel = cleanModel
    .replace(/\b\d+\s*(?:gb|g|tb|t)\b/g, "")
    .replace(/\bram\b/g, "")
    .replace(/\brefurbished|refurb|renewed|used|second\s*hand\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Deduce model name from clean tokens
  // E.g. "iphone 15 pro max"
  const tokens = cleanModel.split(' ');
  if (category === 'Smartphones' && lowercaseTitle.includes('iphone')) {
    const matches = lowercaseTitle.match(/iphone\s*\d+\s*(?:pro\s*max|pro|plus)?/i);
    if (matches) model = matches[0];
  } else if (category === 'Smartphones' && lowercaseTitle.includes('galaxy')) {
    const matches = lowercaseTitle.match(/galaxy\s*[a-z]?\d+\s*(?:ultra|plus|\+)?/i);
    if (matches) model = matches[0];
  } else if (category === 'Laptops' && lowercaseTitle.includes('macbook')) {
    const matches = lowercaseTitle.match(/macbook\s*(?:air|pro)?\s*(?:m\d)?/i);
    if (matches) model = matches[0];
  } else {
    // Fallback: take the first 3 tokens
    model = tokens.slice(0, 3).join(' ');
  }

  // Titlecase model
  model = model.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return {
    brand,
    model,
    ram,
    storage,
    color,
    condition,
  };
}

// Compare two listings to check relation
export async function compareListings(
  a: { title: string; category: string; specs?: { key: string; value: string }[] },
  b: { title: string; category: string; specs?: { key: string; value: string }[] }
): Promise<MatchResult> {
  const attrA = extractAttributes(a.title, a.category, a.specs || []);
  const attrB = extractAttributes(b.title, b.category, b.specs || []);

  // Check different category
  if (a.category !== b.category) {
    return { status: 'DIFFERENT_MODEL', confidence: 1.0, reason: 'Categories do not match.' };
  }

  // Check brand mismatch
  if (attrA.brand.toLowerCase() !== attrB.brand.toLowerCase() && attrA.brand !== "Unknown" && attrB.brand !== "Unknown") {
    return { status: 'DIFFERENT_MODEL', confidence: 1.0, reason: `Brand mismatch: ${attrA.brand} vs ${attrB.brand}` };
  }

  // Check model mismatch
  const cleanModelA = attrA.model.toLowerCase().replace(/\s+/g, '');
  const cleanModelB = attrB.model.toLowerCase().replace(/\s+/g, '');
  const isModelMatch = cleanModelA.includes(cleanModelB) || cleanModelB.includes(cleanModelA) || cleanModelA === cleanModelB;
  
  if (!isModelMatch) {
    return { status: 'DIFFERENT_MODEL', confidence: 0.9, reason: `Model mismatch: ${attrA.model} vs ${attrB.model}` };
  }

  // Model matches, check specifications
  // Check RAM and Storage
  const isRamMismatch = attrA.ram && attrB.ram && attrA.ram !== attrB.ram;
  const isStorageMismatch = attrA.storage && attrB.storage && attrA.storage !== attrB.storage;

  if (isRamMismatch || isStorageMismatch) {
    return {
      status: 'DIFFERENT_VARIANT',
      confidence: 1.0,
      reason: `Specification variant mismatch: RAM (${attrA.ram} vs ${attrB.ram}) or Storage (${attrA.storage} vs ${attrB.storage})`
    };
  }

  // Check Condition mismatch
  if (attrA.condition !== attrB.condition) {
    return {
      status: 'DIFFERENT_CONDITION',
      confidence: 1.0,
      reason: `Condition mismatch: ${attrA.condition} vs ${attrB.condition}`
    };
  }

  // If we don't have enough specs to be certain
  if (!attrA.storage && !attrB.storage) {
    return {
      status: 'INSUFFICIENT_INFORMATION',
      confidence: 0.5,
      reason: 'Missing storage details to confirm if variants are identical.'
    };
  }

  // Default to same product if no mismatch is found deterministically.
  // Avoid calling the Gemini API inside this O(N^2) loop to prevent immediate rate limit (429) errors.
  return {
    status: 'SAME_PRODUCT',
    confidence: 0.9,
    reason: `Attributes match: Model (${attrA.model}), RAM (${attrA.ram}), Storage (${attrA.storage}), Condition (${attrA.condition})`
  };
}
