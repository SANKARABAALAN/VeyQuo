import { NextResponse } from 'next/server';

function cleanQuery(q: string) {
  let cleaned = q.toLowerCase();
  
  // 1. Remove parenthesized content (like colors, variants, storage, etc.)
  cleaned = cleaned.replace(/\([^)]*\)/g, '');
  
  // 2. Remove specifications like "16 GB / 512 GB" or "8 GB / 128 GB"
  cleaned = cleaned.replace(/\d+\s*(gb|tb|mb|ram)\s*\/\s*\d+\s*(gb|tb|mb)/gi, '');
  cleaned = cleaned.replace(/\d+\s*(gb|tb|mb|ram)/gi, '');
  
  // 3. Remove "unknown" and "generic"
  cleaned = cleaned.replace(/\b(unknown|generic)\b/gi, '');
  
  // 4. Remove noise words
  cleaned = cleaned.replace(/\b(crawled|specs|compare|variant|high performance|starting at|starting|smartphones|laptops|refrigerators|washing machines|smartwatches|earbuds|wireless earbuds|earphones|tvs|tv|televisions|shoes|true wireless)\b/gi, '');

  // 5. Remove special characters and clean spacing
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s-]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Proper capitalization and iPhone formatting
  return cleaned.split(' ').map(w => {
    if (w.toLowerCase() === 'iphone') return 'iPhone';
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

async function getDDGImages(query: string): Promise<string[] | null> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
  };
  
  try {
    // 1. Fetch main search page to get the VQD session token
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query + ' product')}`;
    const searchRes = await fetch(searchUrl, { headers, next: { revalidate: 86400 } });
    const html = await searchRes.text();
    
    // Extract the vqd token
    const vqdRegex = /vqd\s*=\s*['"]([^'"]+)['"]/i;
    const vqdMatch = html.match(vqdRegex);
    if (!vqdMatch) return null;
    const vqd = vqdMatch[1];
    
    // 2. Query the DDG internal image JSON API using the session token
    const imageApiUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query + ' product')}&o=json&vqd=${vqd}&f=,,,`;
    const imageRes = await fetch(imageApiUrl, { headers, next: { revalidate: 86400 } });
    const data = await imageRes.json();
    
    const results = data.results;
    if (results && results.length > 0) {
      return results.map((r: any) => r.image);
    }
  } catch (err) {
    console.error("DDG image scraping error:", err);
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  const fallbackRedirect = (q: string) => {
    const lowerTitle = q.toLowerCase();
    if (lowerTitle.includes('headphone') || lowerTitle.includes('earbud') || lowerTitle.includes('earphone')) {
      return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80';
    }
    if (lowerTitle.includes('phone') || lowerTitle.includes('iphone')) {
      return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&q=80';
    }
    if (lowerTitle.includes('laptop') || lowerTitle.includes('macbook')) {
      return 'https://images.unsplash.com/photo-1496181130204-7552cc14ac4b?w=300&q=80';
    }
    return 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=300&q=80';
  };

  if (!query) {
    return NextResponse.redirect(fallbackRedirect(''));
  }

  const cleaned = cleanQuery(query);

  // 1. Fetch images from DuckDuckGo
  const images = await getDDGImages(cleaned);
  if (images && images.length > 0) {
    // Filter out standard placeholders or icons
    const validImages = images.filter(url => 
      !url.includes('logo') && 
      !url.includes('icon') && 
      !url.includes('avatar') && 
      !url.includes('layout') && 
      !url.includes('floor')
    );
    if (validImages.length > 0) {
      // Redirect to the first valid clean product image
      return NextResponse.redirect(validImages[0]);
    }
  }

  // 2. Final Fallback to Unsplash categories if all else fails
  return NextResponse.redirect(fallbackRedirect(query));
}
