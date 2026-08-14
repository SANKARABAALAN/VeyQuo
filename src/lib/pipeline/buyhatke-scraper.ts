import * as cheerio from "cheerio";

export interface BuyHatkeListing {
  title: string;
  price: number | null;       // null if not found — NEVER fake
  imageUrl: string | null;
  productUrl: string;
  marketplace: string | null; // null if not identifiable — NEVER default to Amazon
  sellerRating?: number | null;
}

const cache = new Map<string, { data: BuyHatkeListing[]; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

export async function crawlBuyHatke(query: string): Promise<BuyHatkeListing[]> {
  const normQuery = query.toLowerCase().trim();
  const cached = cache.get(normQuery);
  if (cached && cached.expiry > Date.now()) {
    console.log(`Scraper Cache: Hit for "${normQuery}"`);
    return cached.data;
  }

  const searchUrl = `https://buyhatke.com/search?product=${encodeURIComponent(query)}`;

  try {
    console.log(`Scraper Fetching: ${searchUrl}`);
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`BuyHatke fetch failed: ${res.status}`);
      return [];
    }

    const html = await res.text();

    // DEBUG STEP — saves raw response to local scratch folder for inspection
    if (process.env.NODE_ENV !== "production") {
      const fs = await import("fs/promises");
      const path = await import("path");
      const debugPath = path.join("C:\\Users\\ABACUS\\.gemini\\antigravity\\brain\\d287b120-5d35-47e8-a9b7-20587a111252\\scratch", "buyhatke-debug.html");
      await fs.writeFile(debugPath, html).catch(() => {});
      console.log(`Saved raw response to ${debugPath} for inspection`);
    }

    const $ = cheerio.load(html);
    const listingsMap = new Map<string, BuyHatkeListing>();

    $("a.text-left.flex.flex-col").each((_, el) => {
      const card = $(el);
      const productHref = card.attr("href") || "";
      if (!productHref) return;

      const productUrl = productHref.startsWith("http")
        ? productHref
        : `https://buyhatke.com${productHref}`;

      let existing = listingsMap.get(productUrl);
      if (!existing) {
        existing = {
          title: "",
          price: null,
          imageUrl: null,
          productUrl,
          marketplace: null,
          sellerRating: null
        };
        listingsMap.set(productUrl, existing);
      }

      // 1. Image URL
      const imgElem = card.find("img.product_image").first();
      const imageUrl = imgElem.attr("src") || imgElem.attr("data-src") || null;
      if (imageUrl && !existing.imageUrl) {
        existing.imageUrl = imageUrl;
      }

      // 2. Product Title
      const title = imgElem.attr("alt")?.trim() || card.find("p.font-medium").first().text().trim() || null;
      if (title && (!existing.title || existing.title.length < title.length)) {
        existing.title = title;
      }

      // 3. Price
      const priceText = card.find("p.font-semibold.text-base").first().text();
      if (priceText) {
        const price = parsePrice(priceText);
        if (price !== null && existing.price === null) {
          existing.price = price;
        }
      }

      // 4. Marketplace logo/store identification
      const logoImg = card.find('img[src*="site_icons_m/"]').first();
      const logoAlt = (logoImg.attr("alt") || "").toLowerCase();
      const logoSrc = (logoImg.attr("src") || "").toLowerCase();
      const marketplaceMap: [string, string][] = [
        ["flipkart", "Flipkart"],
        ["croma", "Croma"],
        ["reliance", "Reliance Digital"],
        ["tatacliq", "Tata CLiQ"],
        ["olx", "OLX"],
        ["amazon", "Amazon"],
      ];
      for (const [needle, label] of marketplaceMap) {
        if (logoAlt.includes(needle) || logoSrc.includes(needle)) {
          existing.marketplace = label;
          break;
        }
      }

      // 5. Seller Rating
      const ratingText = card.find('p[class*="ff6d20"]').first().text().trim();
      if (ratingText) {
        const ratingVal = parseFloat(ratingText);
        if (!isNaN(ratingVal) && existing.sellerRating === null) {
          existing.sellerRating = ratingVal;
        }
      }
    });

    // Filter to only complete listings with a valid title and price
    const listings = Array.from(listingsMap.values()).filter(
      (item) => item.title && item.price !== null
    );

    console.log(`Parsed ${listings.length} real grouped listings for "${query}"`);
    cache.set(normQuery, { data: listings, expiry: Date.now() + CACHE_TTL });
    return listings;
  } catch (err) {
    console.error("Scraper exception:", err);
    return [];
  }
}
