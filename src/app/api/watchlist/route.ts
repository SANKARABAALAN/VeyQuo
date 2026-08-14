import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateScores } from '@/lib/pipeline/scoring';

export async function GET() {
  try {
    const watchlist = await prisma.watchlist.findMany({
      include: {
        variant: {
          include: {
            product: true,
            specifications: true,
            listings: {
              include: {
                seller: true,
                marketplace: true
              },
              orderBy: { price: 'asc' }
            }
          }
        }
      }
    });

    // Dynamically calculate score for the best listing in each watched variant
    const processedWatchlist = watchlist.map((item: any) => {
      const listings = item.variant.listings || [];
      let bestScore = 75; // Default score fallback

      if (listings.length > 0) {
        const scoreData = listings.map((l: any) => ({
          id: l.id,
          title: l.title,
          url: l.url,
          price: l.price,
          deliveryFee: l.deliveryFee,
          discount: l.discount,
          effectivePrice: l.effectivePrice,
          condition: l.condition,
          warranty: l.warranty || 'No Warranty',
          warrantyMonths: l.warrantyMonths,
          deliveryDays: l.deliveryDays,
          returnPolicy: l.returnPolicy,
          sellerName: l.seller.name,
          sellerRating: l.seller.rating,
          sellerTrustStatus: l.seller.trustStatus,
          marketplaceName: l.marketplace.name,
          marketplaceCode: l.marketplace.code,
          dataCompleteness: 0.9,
          matchConfidence: 1.0,
          specifications: item.variant.specifications.map((s: any) => ({ key: s.key, normalizedValue: s.normalizedValue }))
        }));

        const defaultWeights = {
          priceWeight: 0.40,
          sellerWeight: 0.20,
          warrantyWeight: 0.15,
          deliveryWeight: 0.10,
          specificationWeight: 0.10,
          conditionWeight: 0.05
        };

        const scored = calculateScores(scoreData, defaultWeights);
        if (scored.length > 0) {
          bestScore = Math.round(scored[0].scores.totalScore * 100);
        }
      }

      return {
        id: item.id,
        variantId: item.variantId,
        targetPrice: item.targetPrice,
        createdAt: item.createdAt,
        variant: {
          id: item.variant.id,
          name: item.variant.name,
          brand: item.variant.product.brand,
          model: item.variant.product.name,
          category: item.variant.product.category,
          bestPrice: listings[0]?.effectivePrice || 0,
          bestScore: bestScore,
          image: listings[0]?.title.toLowerCase().includes('refrigerator')
            ? 'https://images.unsplash.com/photo-1571175432247-f58c73499709?w=300'
            : listings[0]?.title.toLowerCase().includes('earbuds')
            ? 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300'
            : 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=300'
        }
      };
    });

    return NextResponse.json(processedWatchlist);
  } catch (error: any) {
    console.error('GET Watchlist Error:', error);
    return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { variantId, targetPrice, userId } = body;

    if (!variantId || !targetPrice) {
      return NextResponse.json({ error: 'Variant ID and target price are required.' }, { status: 400 });
    }

    let activeUserId = userId;
    if (!activeUserId) {
      let defaultUser = await prisma.user.findFirst();
      if (!defaultUser) {
        defaultUser = await prisma.user.create({
          data: {
            email: 'demo@veyquo.com',
            name: 'Demo User',
          }
        });
      }
      activeUserId = defaultUser.id;
    }

    const watchlistItem = await prisma.watchlist.create({
      data: {
        userId: activeUserId,
        variantId,
        targetPrice: parseFloat(targetPrice),
      },
      include: {
        variant: true
      }
    });

    await prisma.alert.create({
      data: {
        userId: activeUserId,
        variantId,
        targetPrice: parseFloat(targetPrice),
        isActive: true,
      }
    });

    return NextResponse.json({ message: 'Added to watchlist successfully!', watchlistItem });
  } catch (error: any) {
    console.error('POST Watchlist Error:', error);
    return NextResponse.json({ error: 'Failed to add item to watchlist.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Watchlist Item ID is required.' }, { status: 400 });
    }

    await prisma.watchlist.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Item removed from watchlist.' });
  } catch (error: any) {
    console.error('DELETE Watchlist Error:', error);
    return NextResponse.json({ error: 'Failed to delete watchlist item.' }, { status: 500 });
  }
}
