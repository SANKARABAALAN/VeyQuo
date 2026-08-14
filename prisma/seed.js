import { PrismaClient } from '../src/generated/prisma/client/index.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const getPrismaInstance = () => {
  const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');
  const adapter = new PrismaBetterSqlite3({
    url: `file:${dbPath}`,
  });
  return new PrismaClient({ adapter });
};

const prisma = getPrismaInstance();

async function main() {
  console.log("Cleaning database...");
  await prisma.comparisonItem.deleteMany({});
  await prisma.recommendation.deleteMany({});
  await prisma.comparison.deleteMany({});
  await prisma.listing.deleteMany({});
  await prisma.specification.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.seller.deleteMany({});
  await prisma.marketplace.deleteMany({});
  await prisma.watchlist.deleteMany({});
  await prisma.priceSnapshot.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.conversationMessage.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.userPreference.deleteMany({});
  await prisma.user.deleteMany({});
  
  console.log("Seeding Marketplaces...");
  const amazon = await prisma.marketplace.create({
    data: {
      name: "Amazon",
      code: "amazon",
      logoUrl: "/icons/amazon.png",
      baseUrl: "https://www.amazon.in",
    }
  });

  const flipkart = await prisma.marketplace.create({
    data: {
      name: "Flipkart",
      code: "flipkart",
      logoUrl: "/icons/flipkart.png",
      baseUrl: "https://www.flipkart.com",
    }
  });

  const croma = await prisma.marketplace.create({
    data: {
      name: "Croma",
      code: "croma",
      logoUrl: "/icons/croma.png",
      baseUrl: "https://www.croma.com",
    }
  });

  const reliance = await prisma.marketplace.create({
    data: {
      name: "Reliance Digital",
      code: "reliance",
      logoUrl: "/icons/reliance.png",
      baseUrl: "https://www.reliancedigital.in",
    }
  });

  console.log("Seeding Sellers...");
  const appario = await prisma.seller.create({
    data: { name: "Appario Retail", marketplace: "Amazon", rating: 4.6, reviewCount: 12500, trustStatus: "VERIFIED" }
  });
  const darshita = await prisma.seller.create({
    data: { name: "Darshita Electronics", marketplace: "Amazon", rating: 4.3, reviewCount: 310, trustStatus: "VERIFIED" }
  });
  const retailnet = await prisma.seller.create({
    data: { name: "RetailNet", marketplace: "Flipkart", rating: 4.7, reviewCount: 15400, trustStatus: "VERIFIED" }
  });
  const supercom = await prisma.seller.create({
    data: { name: "SuperComNet", marketplace: "Flipkart", rating: 4.4, reviewCount: 920, trustStatus: "VERIFIED" }
  });
  const cromaretail = await prisma.seller.create({
    data: { name: "Croma Retail", marketplace: "Croma", rating: 4.8, reviewCount: 6200, trustStatus: "VERIFIED" }
  });
  const relianceretail = await prisma.seller.create({
    data: { name: "Reliance Retail Ltd", marketplace: "Reliance Digital", rating: 4.6, reviewCount: 4800, trustStatus: "VERIFIED" }
  });
  const shadySeller = await prisma.seller.create({
    data: { name: "ExpressGizmos", marketplace: "Amazon", rating: 2.9, reviewCount: 14, trustStatus: "UNKNOWN" }
  });
  const refurbKing = await prisma.seller.create({
    data: { name: "Refurbished King", marketplace: "Amazon", rating: 4.0, reviewCount: 88, trustStatus: "VERIFIED" }
  });

  console.log("Seeding Products, Variants, Specifications, and Listings...");
  
  // Category 1: Laptops
  const macbook = await prisma.product.create({
    data: { brand: "Apple", name: "MacBook Air M2", category: "Laptops" }
  });

  const macbookBase = await prisma.productVariant.create({
    data: { productId: macbook.id, name: "Apple MacBook Air M2 8GB/256GB Space Grey" }
  });

  await prisma.specification.createMany({
    data: [
      { variantId: macbookBase.id, key: "RAM", originalValue: "8GB", normalizedValue: "8 GB" },
      { variantId: macbookBase.id, key: "Storage", originalValue: "256 GB SSD", normalizedValue: "256 GB" },
      { variantId: macbookBase.id, key: "Processor", originalValue: "Apple M2 8-core CPU", normalizedValue: "Apple M2" },
      { variantId: macbookBase.id, key: "Display", originalValue: "13.6-inch Liquid Retina", normalizedValue: "13.6 inch" },
      { variantId: macbookBase.id, key: "Battery Life", originalValue: "Up to 18 hours", normalizedValue: "18 Hours" },
    ]
  });

  await prisma.listing.createMany({
    data: [
      {
        variantId: macbookBase.id,
        marketplaceId: amazon.id,
        sellerId: appario.id,
        title: "Apple MacBook Air Laptop with M2 chip: 13.6-inch Liquid Retina Display, 8GB RAM, 256GB SSD Storage",
        url: "https://www.amazon.in/dp/B0B3CPNWN7",
        price: 84900,
        deliveryFee: 0,
        discount: 2000,
        effectivePrice: 82900,
        condition: "NEW",
        warranty: "1 Year Apple Manufacturer Warranty",
        warrantyMonths: 12,
        deliveryDays: 2,
        returnPolicy: "7 Days Replacement",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.95,
        matchConfidence: 1.0,
      },
      {
        variantId: macbookBase.id,
        marketplaceId: flipkart.id,
        sellerId: retailnet.id,
        title: "APPLE MacBook Air M2 - (8 GB/256 GB SSD/macOS Monterey) MLY33HN/A",
        url: "https://www.flipkart.com/apple-macbook-air-m2-8-gb-256-ssd-macos-monterey/p/itm5ab4b3cb19808",
        price: 86900,
        deliveryFee: 40,
        discount: 3000,
        effectivePrice: 83940,
        condition: "NEW",
        warranty: "1 Year Apple Warranty",
        warrantyMonths: 12,
        deliveryDays: 1,
        returnPolicy: "7 Days Replacement",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.90,
        matchConfidence: 0.95,
      },
      {
        variantId: macbookBase.id,
        marketplaceId: croma.id,
        sellerId: cromaretail.id,
        title: "Apple MacBook Air 2022 M2 (8GB RAM, 256GB SSD, macOS, 34.46cm)",
        url: "https://www.croma.com/apple-macbook-air-2022-m2-8gb-ram-256gb-ssd-macos-34-46cm-/p/256711",
        price: 89900,
        deliveryFee: 0,
        discount: 5000,
        effectivePrice: 84900,
        condition: "NEW",
        warranty: "1 Year Manufacturer Warranty",
        warrantyMonths: 12,
        deliveryDays: 3,
        returnPolicy: "10 Days Replacement",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.85,
        matchConfidence: 1.0,
      },
      {
        variantId: macbookBase.id,
        marketplaceId: amazon.id,
        sellerId: refurbKing.id,
        title: "(Refurbished) Apple MacBook Air Laptop with M2 chip, Space Grey",
        url: "https://www.amazon.in/dp/B0CRREFURB1",
        price: 68900,
        deliveryFee: 150,
        discount: 0,
        effectivePrice: 69050,
        condition: "REFURBISHED",
        warranty: "6 Months Seller Warranty",
        warrantyMonths: 6,
        deliveryDays: 4,
        returnPolicy: "7 Days Refund Only",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.80,
        matchConfidence: 0.90,
      }
    ]
  });

  // Laptop 2: Lenovo Yoga Slim (Premium Option)
  const yoga = await prisma.product.create({
    data: { brand: "Lenovo", name: "Yoga Slim 7", category: "Laptops" }
  });

  const yogaBase = await prisma.productVariant.create({
    data: { productId: yoga.id, name: "Lenovo Yoga Slim 7 Intel Core Ultra 7 16GB/1TB" }
  });

  await prisma.specification.createMany({
    data: [
      { variantId: yogaBase.id, key: "RAM", originalValue: "16GB LPDDR5X", normalizedValue: "16 GB" },
      { variantId: yogaBase.id, key: "Storage", originalValue: "1 TB PCIe NVMe SSD", normalizedValue: "1024 GB" },
      { variantId: yogaBase.id, key: "Processor", originalValue: "Intel Core Ultra 7 155H", normalizedValue: "Intel Core Ultra 7" },
      { variantId: yogaBase.id, key: "Display", originalValue: "14-inch WUXGA OLED Touch", normalizedValue: "14.0 inch" },
      { variantId: yogaBase.id, key: "Battery Life", originalValue: "Up to 12 hours", normalizedValue: "12 Hours" },
    ]
  });

  await prisma.listing.createMany({
    data: [
      {
        variantId: yogaBase.id,
        marketplaceId: amazon.id,
        sellerId: darshita.id,
        title: "Lenovo Yoga Slim 7 Intel Core Ultra 7 155H 14\" WUXGA OLED Touchscreen Laptop (16GB/1TB SSD)",
        url: "https://www.amazon.in/dp/B0CT118H",
        price: 99999,
        deliveryFee: 0,
        discount: 1000,
        effectivePrice: 98999,
        condition: "NEW",
        warranty: "1 Year onsite manufacturer warranty + 1 Year Premium Care",
        warrantyMonths: 24,
        deliveryDays: 3,
        returnPolicy: "7 Days Replacement",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.98,
        matchConfidence: 1.0,
      },
      {
        variantId: yogaBase.id,
        marketplaceId: reliance.id,
        sellerId: relianceretail.id,
        title: "Lenovo Yoga Slim 7 14IMH9 Intel Core Ultra 7 Touchscreen Laptop",
        url: "https://www.reliancedigital.in/p/49435118",
        price: 102999,
        deliveryFee: 0,
        discount: 4000,
        effectivePrice: 98999,
        condition: "NEW",
        warranty: "1 Year onsite manufacturer warranty",
        warrantyMonths: 12,
        deliveryDays: 2,
        returnPolicy: "No Return",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.90,
        matchConfidence: 0.98,
      }
    ]
  });

  // Category 2: Smartphones
  const iphone15 = await prisma.product.create({
    data: { brand: "Apple", name: "iPhone 15", category: "Smartphones" }
  });

  const iphone15_128 = await prisma.productVariant.create({
    data: { productId: iphone15.id, name: "Apple iPhone 15 128GB Black" }
  });

  await prisma.specification.createMany({
    data: [
      { variantId: iphone15_128.id, key: "RAM", originalValue: "6 GB RAM", normalizedValue: "6 GB" },
      { variantId: iphone15_128.id, key: "Storage", originalValue: "128GB ROM", normalizedValue: "128 GB" },
      { variantId: iphone15_128.id, key: "Processor", originalValue: "A16 Bionic Chip", normalizedValue: "Apple A16" },
      { variantId: iphone15_128.id, key: "Display", originalValue: "6.1-inch Super Retina XDR", normalizedValue: "6.1 inch" },
      { variantId: iphone15_128.id, key: "Camera", originalValue: "48MP + 12MP Dual Rear, 12MP Front", normalizedValue: "48 MP" },
    ]
  });

  await prisma.listing.createMany({
    data: [
      {
        variantId: iphone15_128.id,
        marketplaceId: amazon.id,
        sellerId: appario.id,
        title: "Apple iPhone 15 (128 GB) - Black",
        url: "https://www.amazon.in/dp/B0CHX2F17",
        price: 71200,
        deliveryFee: 0,
        discount: 1500,
        effectivePrice: 69700,
        condition: "NEW",
        warranty: "1 Year Apple India Warranty",
        warrantyMonths: 12,
        deliveryDays: 2,
        returnPolicy: "7 Days Replacement",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.95,
        matchConfidence: 1.0,
      },
      {
        variantId: iphone15_128.id,
        marketplaceId: flipkart.id,
        sellerId: retailnet.id,
        title: "APPLE iPhone 15 (Black, 128 GB)",
        url: "https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm2d83c18cd8b8a",
        price: 70999,
        deliveryFee: 49,
        discount: 1000,
        effectivePrice: 70048,
        condition: "NEW",
        warranty: "1 Year Warranty",
        warrantyMonths: 12,
        deliveryDays: 1,
        returnPolicy: "7 Days Replacement",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.92,
        matchConfidence: 1.0,
      },
      {
        variantId: iphone15_128.id,
        marketplaceId: reliance.id,
        sellerId: relianceretail.id,
        title: "Apple iPhone 15 128 GB, Black",
        url: "https://www.reliancedigital.in/p/4938392",
        price: 72900,
        deliveryFee: 0,
        discount: 3500,
        effectivePrice: 69400,
        condition: "NEW",
        warranty: "1 Year Apple Manufacturer Warranty",
        warrantyMonths: 12,
        deliveryDays: 2,
        returnPolicy: "No Return",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.88,
        matchConfidence: 1.0,
      },
      {
        variantId: iphone15_128.id,
        marketplaceId: amazon.id,
        sellerId: shadySeller.id,
        title: "Apple iPhone 15 (128 GB) - Black (Slightly Damaged Box)",
        url: "https://www.amazon.in/dp/B0CHX2F17shady",
        price: 64000,
        deliveryFee: 199,
        discount: 0,
        effectivePrice: 64199,
        condition: "NEW",
        warranty: "None",
        warrantyMonths: 0,
        deliveryDays: 5,
        returnPolicy: "No Return",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.65,
        matchConfidence: 0.85,
      }
    ]
  });

  // Smartphone 2: OnePlus 12R (Best Value Option)
  const oneplus12 = await prisma.product.create({
    data: { brand: "OnePlus", name: "12R", category: "Smartphones" }
  });

  const oneplusBase = await prisma.productVariant.create({
    data: { productId: oneplus12.id, name: "OnePlus 12R 8GB/128GB Cool Blue" }
  });

  await prisma.specification.createMany({
    data: [
      { variantId: oneplusBase.id, key: "RAM", originalValue: "8GB LPDDR5X", normalizedValue: "8 GB" },
      { variantId: oneplusBase.id, key: "Storage", originalValue: "128GB UFS 3.1", normalizedValue: "128 GB" },
      { variantId: oneplusBase.id, key: "Processor", originalValue: "Snapdragon 8 Gen 2", normalizedValue: "Qualcomm Snapdragon 8 Gen 2" },
      { variantId: oneplusBase.id, key: "Display", originalValue: "6.78-inch 120Hz AMOLED", normalizedValue: "6.78 inch" },
      { variantId: oneplusBase.id, key: "Battery Life", originalValue: "5500 mAh battery", normalizedValue: "5500 mAh" },
    ]
  });

  await prisma.listing.createMany({
    data: [
      {
        variantId: oneplusBase.id,
        marketplaceId: amazon.id,
        sellerId: appario.id,
        title: "OnePlus 12R (Cool Blue, 8GB RAM, 128GB Storage)",
        url: "https://www.amazon.in/dp/B0CQYG3E",
        price: 39999,
        deliveryFee: 0,
        discount: 1000,
        effectivePrice: 38999,
        condition: "NEW",
        warranty: "1 Year Manufacturer Warranty",
        warrantyMonths: 12,
        deliveryDays: 2,
        returnPolicy: "7 Days Replacement",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.95,
        matchConfidence: 1.0,
      },
      {
        variantId: oneplusBase.id,
        marketplaceId: flipkart.id,
        sellerId: supercom.id,
        title: "OnePlus 12R (Cool Blue, 128 GB) (8 GB RAM)",
        url: "https://www.flipkart.com/oneplus-12r-cool-blue-128-gb/p/itm7e366b57d0794",
        price: 39890,
        deliveryFee: 0,
        discount: 500,
        effectivePrice: 39390,
        condition: "NEW",
        warranty: "1 Year Brand Warranty",
        warrantyMonths: 12,
        deliveryDays: 1,
        returnPolicy: "7 Days Replacement",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.90,
        matchConfidence: 1.0,
      }
    ]
  });

  // Category 3: Headphones
  const sony1000 = await prisma.product.create({
    data: { brand: "Sony", name: "WH-1000XM5", category: "Headphones" }
  });

  const sonyXM5 = await prisma.productVariant.create({
    data: { productId: sony1000.id, name: "Sony WH-1000XM5 Wireless Active Noise Cancelling Headphones Black" }
  });

  await prisma.specification.createMany({
    data: [
      { variantId: sonyXM5.id, key: "Type", originalValue: "Over-Ear", normalizedValue: "Over-Ear" },
      { variantId: sonyXM5.id, key: "Battery Life", originalValue: "30 hours with ANC", normalizedValue: "30 Hours" },
      { variantId: sonyXM5.id, key: "ANC", originalValue: "Industry leading noise cancelling", normalizedValue: "Yes" },
      { variantId: sonyXM5.id, key: "Bluetooth", originalValue: "Bluetooth 5.2", normalizedValue: "v5.2" },
      { variantId: sonyXM5.id, key: "Weight", originalValue: "250g", normalizedValue: "250 g" },
    ]
  });

  await prisma.listing.createMany({
    data: [
      {
        variantId: sonyXM5.id,
        marketplaceId: amazon.id,
        sellerId: darshita.id,
        title: "Sony WH-1000XM5 Wireless Active Noise Cancelling Headphones, 30 Hr Battery, Black",
        url: "https://www.amazon.in/dp/B09XS7J8",
        price: 29990,
        deliveryFee: 0,
        discount: 3000,
        effectivePrice: 26990,
        condition: "NEW",
        warranty: "1 Year Brand Warranty",
        warrantyMonths: 12,
        deliveryDays: 3,
        returnPolicy: "7 Days Replacement",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.95,
        matchConfidence: 1.0,
      },
      {
        variantId: sonyXM5.id,
        marketplaceId: croma.id,
        sellerId: cromaretail.id,
        title: "Sony WH-1000XM5 Over-Ear Active Noise Cancelling Wireless Headphone, Black",
        url: "https://www.croma.com/sony-wh-1000xm5-over-ear-active-noise-cancelling-wireless-headphone-black-/p/252277",
        price: 31990,
        deliveryFee: 0,
        discount: 4000,
        effectivePrice: 27990,
        condition: "NEW",
        warranty: "1 Year onsite manufacturer warranty",
        warrantyMonths: 12,
        deliveryDays: 2,
        returnPolicy: "10 Days Replacement",
        sourceType: "DEMO_DATA",
        dataCompleteness: 0.90,
        matchConfidence: 1.0,
      }
    ]
  });

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
