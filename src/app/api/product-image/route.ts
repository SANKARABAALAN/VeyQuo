import { NextResponse } from 'next/server';

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

  try {
    // Add keywords like "product" and "png" to find clean, high-quality images
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query + ' product')}&first=1`;
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
        // Exclude generic low-res icon placeholders
        const url = decodeURIComponent(match[1]);
        if (!url.includes('logo') && !url.includes('icon') && !url.includes('avatar')) {
          matches.push(url);
        }
      }

      if (matches.length > 0) {
        // Return the first clean image match
        return NextResponse.redirect(matches[0]);
      }
    }
  } catch (error) {
    console.error("Error fetching product image from internet:", error);
  }

  // Fallback to Unsplash categories if scraping failed
  return NextResponse.redirect(fallbackRedirect(query));
}
