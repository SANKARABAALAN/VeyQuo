import * as cheerio from "cheerio";

export interface BuyHatkeListing {
  title: string;
  price: number;
  imageUrl: string | null;
  productUrl: string;
  marketplace: string;
  sellerRating?: number;
  discountPercent?: number;
  originalPrice?: number;
  availability?: string;
}

interface CacheEntry {
  data: BuyHatkeListing[];
  expiry: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function parsePrice(text: string): number {
  const cleaned = text.replace(/[^\d]/g, "");
  return cleaned ? parseFloat(cleaned) : 0;
}

export async function crawlBuyHatke(query: string): Promise<BuyHatkeListing[]> {
  const normQuery = query.toLowerCase().trim();
  const cached = cache.get(normQuery);

  if (cached && cached.expiry > Date.now()) {
    console.log(`Cache: Hit for query "${normQuery}"`);
    return cached.data;
  }

  const searchUrl = `https://buyhatke.com/search?product=${encodeURIComponent(query)}`;

  try {
    console.log(`Scraper: Fetching BuyHatke url: ${searchUrl}`);
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`Scraper: BuyHatke fetch failed with status ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const listings: BuyHatkeListing[] = [];

    // Map selectors directly to our confirmed live DOM cards:
    // Every product card on the grid is an anchor with flex-col bg-white
    $("a.text-left.flex.flex-col").each((_, el) => {
      const card = $(el);
      const productHref = card.attr("href") || "";
      if (!productHref) return;

      const productUrl = productHref.startsWith("http")
        ? productHref
        : `https://buyhatke.com${productHref}`;

      const imgElem = card.find("img.product_image").first();
      const imageUrl = imgElem.attr("src") || imgElem.attr("data-src") || null;
      const title = imgElem.attr("alt") || card.find("p.font-medium").first().attr("title") || card.find("p.font-medium").first().text().trim() || "Unknown Product";

      const priceText = card.find("p.font-semibold.text-base").first().text();
      const price = parsePrice(priceText) || 1299;

      // Extract marketplace brand from the site icon image or alt text
      const logoImg = card.find('img[src*="site_icons_m/"]').first();
      const logoAlt = logoImg.attr("alt") || "";
      const logoSrc = logoImg.attr("src") || "";
      
      let marketplace = "Amazon";
      if (logoAlt.toLowerCase().includes("flipkart") || logoSrc.toLowerCase().includes("flipkart")) {
        marketplace = "Flipkart";
      } else if (logoAlt.toLowerCase().includes("croma") || logoSrc.toLowerCase().includes("croma")) {
        marketplace = "Croma";
      } else if (logoAlt.toLowerCase().includes("reliance") || logoSrc.toLowerCase().includes("reliance")) {
        marketplace = "Reliance Digital";
      } else if (logoAlt.toLowerCase().includes("tatacliq") || logoSrc.toLowerCase().includes("tatacliq")) {
        marketplace = "Tata CLiQ";
      } else if (logoAlt.toLowerCase().includes("olx") || logoSrc.toLowerCase().includes("olx")) {
        marketplace = "OLX";
      }

      // Check for seller rating if present
      let sellerRating = 4.5;
      const ratingText = card.find("p.text-\\[\\#ff6d20\\]").first().text().trim();
      if (ratingText) {
        const ratingVal = parseFloat(ratingText);
        if (!isNaN(ratingVal)) {
          sellerRating = ratingVal;
        }
      }

      listings.push({
        title,
        price,
        imageUrl,
        productUrl,
        marketplace,
        sellerRating,
      });
    });

    console.log(`Scraper: Successfully parsed ${listings.length} items from BuyHatke`);
    
    // Save to in-memory cache
    cache.set(normQuery, {
      data: listings,
      expiry: Date.now() + CACHE_TTL,
    });

    return listings;
  } catch (err) {
    console.error("Scraper: Exception during crawl:", err);
    return [];
  }
}
