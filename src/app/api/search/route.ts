import { NextResponse } from 'next/server';
import { runDecisionPipeline } from '@/lib/pipeline';
import { prisma } from '@/lib/prisma';

const defaultWeights = {
  priceWeight: 0.40,
  sellerWeight: 0.20,
  warrantyWeight: 0.15,
  deliveryWeight: 0.10,
  specificationWeight: 0.10,
  conditionWeight: 0.05,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, weights, customListings } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    const activeWeights = {
      priceWeight: weights?.priceWeight ?? defaultWeights.priceWeight,
      sellerWeight: weights?.sellerWeight ?? defaultWeights.sellerWeight,
      warrantyWeight: weights?.warrantyWeight ?? defaultWeights.warrantyWeight,
      deliveryWeight: weights?.deliveryWeight ?? defaultWeights.deliveryWeight,
      specificationWeight: weights?.specificationWeight ?? defaultWeights.specificationWeight,
      conditionWeight: weights?.conditionWeight ?? defaultWeights.conditionWeight,
    };

    // Run decision pipeline or deals comparison depending on mode
    let pipelineResult;
    if (body.mode === 'deals') {
      const { runDealsPipeline } = require('@/lib/pipeline');
      pipelineResult = await runDealsPipeline(body.productName || query, activeWeights);
    } else {
      pipelineResult = await runDecisionPipeline(query, activeWeights, customListings);
    }

    // Save Search to database for history
    try {
      await prisma.search.create({
        data: {
          query,
          category: pipelineResult.intent.category,
          budget: pipelineResult.intent.budget,
          useCase: pipelineResult.intent.useCase,
          priority: pipelineResult.intent.priority,
          condition: pipelineResult.intent.condition,
          recommendation: {
            create: {
              summary: pipelineResult.recommendation.summary,
              bestForYouId: pipelineResult.recommendation.bestForYouId,
              bestValueId: pipelineResult.recommendation.bestValueId,
              lowestPriceId: pipelineResult.recommendation.lowestPriceId,
              mostTrustedId: pipelineResult.recommendation.mostTrustedId,
              bestWarrantyId: pipelineResult.recommendation.bestWarrantyId,
              bestDeliveryId: pipelineResult.recommendation.bestDeliveryId,
            }
          }
        }
      });
    } catch (e) {
      console.error("Error saving search history to database:", e);
      // Fail silently and proceed returning search results to the user
    }

    return NextResponse.json(pipelineResult);
  } catch (error: any) {
    console.error('API Search Error:', error);
    return NextResponse.json(
      { error: 'An error occurred during product search and intelligence extraction.' },
      { status: 500 }
    );
  }
}
