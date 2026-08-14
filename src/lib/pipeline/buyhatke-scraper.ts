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
  if (cached && cached.expiry > Date.now()) return cached.data;

  const searchUrl = `https://buyhatke.com/search?product=${encodeURIComponent(query)}`;

  try {
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
    const listings: BuyHatkeListing[] = [];

    $("a.text-left.flex.flex-col").each((_, el) => {
      const card = $(el);
      const productHref = card.attr("href") || "";
      if (!productHref) return;

      const productUrl = productHref.startsWith("http")
        ? productHref
        : `https://buyhatke.com${productHref}`;

      const imgElem = card.find("img.product_image").first();
      const imageUrl = imgElem.attr("src") || imgElem.attr("data-src") || null;

      const title =
        imgElem.attr("alt")?.trim() ||
        card.find("p.font-medium").first().text().trim() ||
        null;

      const priceText = card.find("p.font-semibold.text-base").first().text();
      const price = parsePrice(priceText); // no fake fallback

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
      let marketplace: string | null = null;
      for (const [needle, label] of marketplaceMap) {
        if (logoAlt.includes(needle) || logoSrc.includes(needle)) {
          marketplace = label;
          break;
        }
      }

      const ratingText = card.find('p[class*="ff6d20"]').first().text().trim();
      const sellerRating = ratingText ? parseFloat(ratingText) : null;

      // Skip cards where we couldn't even get a title+price — don't push junk
      if (!title || price === null) return;

      listings.push({
        title,
        price,
        imageUrl,
        productUrl,
        marketplace,
        sellerRating: isNaN(sellerRating as number) ? null : sellerRating,
      });
    });

    console.log(`Parsed ${listings.length} real listings for "${query}"`);
    cache.set(normQuery, { data: listings, expiry: Date.now() + CACHE_TTL });
    return listings;
  } catch (err) {
    console.error("Scraper exception:", err);
    return [];
  }
}
