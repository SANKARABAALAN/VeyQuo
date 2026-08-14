import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Load saved comparisons or a specific one by ID
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Load a specific comparison by ID
      const comparison = await prisma.comparison.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              listing: {
                include: {
                  variant: {
                    include: {
                      product: true,
                      specifications: true,
                    }
                  },
                  seller: true,
                  marketplace: true
                }
              }
            }
          },
          recommendation: true,
        }
      });

      if (!comparison) {
        return NextResponse.json({ error: 'Comparison not found' }, { status: 404 });
      }

      // Format back to pipeline listings
      const listings = comparison.items.map(item => ({
        id: item.listing.id,
        title: item.listing.title,
        url: item.listing.url,
        price: item.listing.price,
        deliveryFee: item.listing.deliveryFee,
        discount: item.listing.discount,
        effectivePrice: item.listing.effectivePrice,
        condition: item.listing.condition,
        warranty: item.listing.warranty || "No Warranty",
        warrantyMonths: item.listing.warrantyMonths,
        deliveryDays: item.listing.deliveryDays,
        returnPolicy: item.listing.returnPolicy || "No Return",
        sellerName: item.listing.seller.name,
        sellerRating: item.listing.seller.rating,
        sellerReviewCount: item.listing.seller.reviewCount,
        sellerTrustStatus: item.listing.seller.trustStatus,
        marketplaceName: item.listing.marketplace.name,
        marketplaceCode: item.listing.marketplace.code,
        specifications: item.listing.variant.specifications.map(s => ({ key: s.key, value: s.originalValue })),
        sourceType: item.listing.sourceType,
      }));

      return NextResponse.json({
        id: comparison.id,
        name: comparison.name,
        createdAt: comparison.createdAt,
        listings,
        recommendation: comparison.recommendation,
      });
    }

    // List all saved comparisons
    const comparisons = await prisma.comparison.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: true
      }
    });

    return NextResponse.json(comparisons);
  } catch (error: any) {
    console.error('GET Comparison Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve comparison.' }, { status: 500 });
  }
}

// POST: Save a comparison
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, listings, query, summary } = body;

    if (!name || !listings || !Array.isArray(listings) || listings.length === 0) {
      return NextResponse.json({ error: 'Comparison name and listings are required.' }, { status: 400 });
    }

    // Create Comparison
    const comparison = await prisma.comparison.create({
      data: { name }
    });

    // Create or find references for listings, variants, sellers, and marketplaces
    for (const item of listings) {
      // 1. Ensure Marketplace exists
      let dbMarketplace = await prisma.marketplace.findFirst({
        where: { code: item.marketplaceCode }
      });
      if (!dbMarketplace) {
        dbMarketplace = await prisma.marketplace.create({
          data: {
            name: item.marketplaceName,
            code: item.marketplaceCode,
            baseUrl: item.url ? new URL(item.url).origin : "https://www.example.com"
          }
        });
      }

      // 2. Ensure Seller exists
      let dbSeller = await prisma.seller.findFirst({
        where: {
          name: item.sellerName,
          marketplace: item.marketplaceName
        }
      });
      if (!dbSeller) {
        dbSeller = await prisma.seller.create({
          data: {
            name: item.sellerName,
            marketplace: item.marketplaceName,
            rating: item.sellerRating,
            reviewCount: item.sellerReviewCount || 0,
            trustStatus: item.sellerTrustStatus || "UNKNOWN"
          }
        });
      }

      // 3. Ensure Product & Variant exist (use temporary placeholder category)
      let dbProduct = await prisma.product.findFirst({
        where: { name: item.title.split(' ').slice(0, 3).join(' ') }
      });
      if (!dbProduct) {
        dbProduct = await prisma.product.create({
          data: {
            brand: item.title.split(' ')[0] || "Generic",
            name: item.title.split(' ').slice(0, 3).join(' '),
            category: "General"
          }
        });
      }

      let dbVariant = await prisma.productVariant.findFirst({
        where: {
          name: item.title.slice(0, 100),
          productId: dbProduct.id
        }
      });
      if (!dbVariant) {
        dbVariant = await prisma.productVariant.create({
          data: {
            name: item.title.slice(0, 100),
            productId: dbProduct.id
          }
        });

        // Seed specifications
        if (item.specifications && Array.isArray(item.specifications)) {
          await prisma.specification.createMany({
            data: item.specifications.map((s: any) => ({
              variantId: dbVariant!.id,
              key: s.key,
              originalValue: s.value || s.normalizedValue || s.originalValue || "N/A",
              normalizedValue: s.normalizedValue || s.value || s.originalValue || "N/A",
            }))
          });
        }
      }

      // 4. Create Listing in DB (or find existing one by URL)
      let dbListing = await prisma.listing.findFirst({
        where: { url: item.url }
      });
      if (!dbListing) {
        dbListing = await prisma.listing.create({
          data: {
            variantId: dbVariant.id,
            marketplaceId: dbMarketplace.id,
            sellerId: dbSeller.id,
            title: item.title,
            url: item.url || "https://www.example.com",
            price: item.price,
            deliveryFee: item.deliveryFee || 0,
            discount: item.discount || 0,
            effectivePrice: item.effectivePrice || item.price,
            condition: item.condition || "NEW",
            warranty: item.warranty || "No Warranty",
            warrantyMonths: item.warrantyMonths || 0,
            deliveryDays: item.deliveryDays || 3,
            returnPolicy: item.returnPolicy || "No Return",
            sourceType: item.sourceType || "USER_URL",
            dataCompleteness: item.scores?.dataCompleteness || 0.8,
            matchConfidence: item.scores?.matchConfidence || 1.0,
          }
        });
      }

      // Link to comparison
      await prisma.comparisonItem.create({
        data: {
          comparisonId: comparison.id,
          listingId: dbListing.id
        }
      });
    }

    // Save Recommendation summary if provided
    if (summary) {
      await prisma.recommendation.create({
        data: {
          comparisonId: comparison.id,
          summary: summary
        }
      });
    }

    return NextResponse.json({ id: comparison.id, name: comparison.name, message: 'Comparison saved successfully!' });
  } catch (error: any) {
    console.error('POST Comparison Error:', error);
    return NextResponse.json({ error: 'Failed to save comparison.' }, { status: 500 });
  }
}
