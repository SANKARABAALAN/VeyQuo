import { NextResponse } from 'next/server';

function cleanQuery(q: string) {
  let cleaned = q.toLowerCase();
  
  // 1. Remove parenthesized content (like colors, variants, storage, etc.)
  cleaned = cleaned.replace(/\([^)]*\)/g, '');
  
  // 2. Remove specifications like "16 GB / 512 GB" or "8 GB / 128 GB"
  cleaned = cleaned.replace(/\d+\s*(gb|tb|mb|ram)\s*\/\s*\d+\s*(gb|tb|mb)/gi, '');
  cleaned = cleaned.replace(/\d+\s*(gb|tb|mb|ram)/gi, '');
  
  // 3. Remove noise words
  cleaned = cleaned.replace(/\b(crawled|specs|compare|variant|high performance|starting at|starting|smartphones|laptops|refrigerators|washing machines|smartwatches|earbuds|wireless earbuds|earphones|tvs|tv|televisions|shoes)\b/gi, '');

  // 4. Remove special characters and clean spacing
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s-]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Proper capitalization and iPhone format
  return cleaned.split(' ').map(w => {
    if (w.toLowerCase() === 'iphone') return 'iPhone';
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

async function getWikiImage(query: string): Promise<string | null> {
  const cleaned = cleanQuery(query);
  const headers = {
    'User-Agent': 'VeyquoProductIntelligence/1.0 (contact@veyquo.com)'
  };
  
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleaned)}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { headers, next: { revalidate: 86400 } });
    const searchData = await searchRes.json();
    const searchResults = searchData.query?.search;
    
    if (searchResults && searchResults.length > 0) {
      const pageTitle = searchResults[0].title;
      
      const imageQueryUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
      const imgRes = await fetch(imageQueryUrl, { headers, next: { revalidate: 86400 } });
      const imgData = await imgRes.json();
      
      const pages = imgData.query?.pages;
      if (pages) {
        const pageId = Object.keys(pages)[0];
        const thumbnail = pages[pageId]?.thumbnail;
        if (thumbnail && thumbnail.source) {
          return thumbnail.source;
        }
      }
    }
  } catch (err) {
    console.error("Wikipedia API error:", err);
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  const fallbackRedirect = (q: string) => {
    const lowerTitle = q.toLowerCase();
    if (lowerTitle.includes('phone') || lowerTitle.includes('iphone')) {
      return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&q=80';
    }
    if (lowerTitle.includes('laptop') || lowerTitle.includes('macbook')) {
      return 'https://images.unsplash.com/photo-1496181130204-7552cc14ac4b?w=300&q=80';
    }
    if (lowerTitle.includes('headphone') || lowerTitle.includes('earbud') || lowerTitle.includes('earphone')) {
      return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80';
    }
    return 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=300&q=80';
  };

  if (!query) {
    return NextResponse.redirect(fallbackRedirect(''));
  }

  // 1. Try Wikipedia first
  const wikiImage = await getWikiImage(query);
  if (wikiImage) {
    return NextResponse.redirect(wikiImage);
  }

  // 2. Fallback to Bing Images but with cleaned query
  try {
    const cleaned = cleanQuery(query);
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(cleaned + ' product photo white background')}&first=1`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
      },
      next: { revalidate: 86400 } // Cache for 24 hours
    });

    if (res.ok) {
      const html = await res.text();
      const regex = /murl&quot;:&quot;(https:[^&]+)&quot;/g;
      const matches = [];
      let match;
      while ((match = regex.exec(html)) !== null) {
        const url = decodeURIComponent(match[1]);
        if (!url.includes('logo') && !url.includes('icon') && !url.includes('avatar') && !url.includes('layout') && !url.includes('floor')) {
          matches.push(url);
        }
      }

      if (matches.length > 0) {
        return NextResponse.redirect(matches[0]);
      }
    }
  } catch (error) {
    console.error("Error fetching product image from internet:", error);
  }

  // 3. Final Fallback to Unsplash
  return NextResponse.redirect(fallbackRedirect(query));
}
