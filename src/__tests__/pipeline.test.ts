import { describe, it, expect } from 'vitest';
import { normalizeSpec } from '../lib/pipeline/normalizer';
import { extractAttributes, compareListings } from '../lib/pipeline/matching';
import { calculateScores, rankListings, ListingScoringData, UserWeights } from '../lib/pipeline/scoring';

describe('Specification Normalizer', () => {
  it('should normalize RAM sizes correctly', () => {
    expect(normalizeSpec('ram', '8GB')).toBe('8 GB');
    expect(normalizeSpec('ram', '8 GB')).toBe('8 GB');
    expect(normalizeSpec('ram', '16gb lpddr5')).toBe('16 GB');
    expect(normalizeSpec('ram', '8192 MB')).toBe('8 GB');
    expect(normalizeSpec('ram', '4 G')).toBe('4 GB');
  });

  it('should normalize Storage sizes correctly', () => {
    expect(normalizeSpec('storage', '256GB')).toBe('256 GB');
    expect(normalizeSpec('storage', '256 GB SSD')).toBe('256 GB');
    expect(normalizeSpec('storage', '1 TB')).toBe('1024 GB');
    expect(normalizeSpec('storage', '1TB NVMe')).toBe('1024 GB');
  });

  it('should normalize Display/Screen sizes correctly', () => {
    expect(normalizeSpec('display', '13.6-inch')).toBe('13.6 inch');
    expect(normalizeSpec('display', '13.6" Liquid Retina')).toBe('13.6 inch');
    expect(normalizeSpec('display', '14 inch OLED')).toBe('14 inch');
  });

  it('should normalize Battery sizes correctly', () => {
    expect(normalizeSpec('battery', '5500 mah')).toBe('5500 mAh');
    expect(normalizeSpec('battery life', '18 hours with ANC')).toBe('18 Hours');
    expect(normalizeSpec('battery', '12h')).toBe('12 Hours');
  });
});

describe('Product Identity Matching', () => {
  it('should parse brand and condition deterministically', () => {
    const attr = extractAttributes('Refurbished Apple iPhone 15 128GB Black', 'Smartphones');
    expect(attr.brand).toBe('Apple');
    expect(attr.condition).toBe('REFURBISHED');
    expect(attr.ram).toBeNull();
    expect(attr.storage).toBe('128 GB');
    expect(attr.color).toBe('Black');
  });

  it('should match identical products as SAME_PRODUCT', async () => {
    const match = await compareListings(
      { title: 'Apple iPhone 15 128GB Black', category: 'Smartphones' },
      { title: 'iPhone 15 128 GB Black', category: 'Smartphones' }
    );
    expect(match.status).toBe('SAME_PRODUCT');
  });

  it('should detect size differences as DIFFERENT_VARIANT', async () => {
    const match = await compareListings(
      { title: 'Apple iPhone 15 128GB Black', category: 'Smartphones' },
      { title: 'Apple iPhone 15 256GB Black', category: 'Smartphones' }
    );
    expect(match.status).toBe('DIFFERENT_VARIANT');
  });

  it('should detect condition differences as DIFFERENT_CONDITION', async () => {
    const match = await compareListings(
      { title: 'Apple iPhone 15 128GB Black', category: 'Smartphones' },
      { title: 'Refurbished Apple iPhone 15 128GB Black', category: 'Smartphones' }
    );
    expect(match.status).toBe('DIFFERENT_CONDITION');
  });
});

describe('Deterministic Scoring & Recalculation', () => {
  const mockListings: ListingScoringData[] = [
    {
      id: 'l1',
      title: 'Mock Product 1',
      url: 'https://example.com/1',
      price: 80000,
      deliveryFee: 0,
      discount: 5000,
      effectivePrice: 75000, // Winner on price
      condition: 'NEW',
      warranty: '1 Year Warranty',
      warrantyMonths: 12,
      deliveryDays: 5,
      returnPolicy: '7 Days Replacement',
      sellerName: 'Mock Seller 1',
      sellerRating: 4.2,
      sellerTrustStatus: 'VERIFIED',
      marketplaceName: 'Mock Market 1',
      marketplaceCode: 'mock1',
      dataCompleteness: 0.9,
      matchConfidence: 1.0,
      specifications: [
        { key: 'ram', normalizedValue: '8 GB' },
        { key: 'storage', normalizedValue: '256 GB' }
      ]
    },
    {
      id: 'l2',
      title: 'Mock Product 2',
      url: 'https://example.com/2',
      price: 85000,
      deliveryFee: 0,
      discount: 0,
      effectivePrice: 85000, // Higher price but better warranty/delivery
      condition: 'NEW',
      warranty: '2 Years Warranty',
      warrantyMonths: 24, // 2 Years Warranty
      deliveryDays: 1, // Next Day Delivery
      returnPolicy: '10 Days Return',
      sellerName: 'Mock Seller 2',
      sellerRating: 4.9, // Excellent seller rating
      sellerTrustStatus: 'VERIFIED',
      marketplaceName: 'Mock Market 2',
      marketplaceCode: 'mock2',
      dataCompleteness: 1.0,
      matchConfidence: 1.0,
      specifications: [
        { key: 'ram', normalizedValue: '16 GB' }, // Better spec
        { key: 'storage', normalizedValue: '512 GB' } // Better spec
      ]
    }
  ];

  it('should rank cheaper option higher when price weight is dominant', () => {
    const weights: UserWeights = {
      priceWeight: 0.80,
      sellerWeight: 0.05,
      warrantyWeight: 0.05,
      deliveryWeight: 0.05,
      specificationWeight: 0.05,
      conditionWeight: 0.00
    };

    const scored = calculateScores(mockListings, weights);
    const ranked = rankListings(scored);

    expect(ranked[0].id).toBe('l1'); // l1 (₹75k) should beat l2 (₹85k)
  });

  it('should rank premium spec/delivery option higher when specification and delivery weights dominate', () => {
    const weights: UserWeights = {
      priceWeight: 0.10,
      sellerWeight: 0.10,
      warrantyWeight: 0.20,
      deliveryWeight: 0.30,
      specificationWeight: 0.30,
      conditionWeight: 0.00
    };

    const scored = calculateScores(mockListings, weights);
    const ranked = rankListings(scored);

    expect(ranked[0].id).toBe('l2'); // l2 should win due to 24m warranty, 1d delivery, and 16GB/512GB specs
  });
});
