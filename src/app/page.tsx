'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UserWeights, calculateScores, rankListings } from '@/lib/pipeline/scoring';

interface PipelineVariantGroup {
  id: string;
  name: string;
  brand: string;
  model: string;
  ram: string | null;
  storage: string | null;
  condition: string;
  specifications: any[];
  listings: any[];
  bestScore: number;
  avgPrice: number;
  minPrice: number;
}

interface PipelineResult {
  intent: {
    category: string;
    budget: number | null;
    useCase: string | null;
    priority: string | null;
    condition: string | null;
    specificationsToCompare: string[];
    rawInput: string;
  };
  variants: PipelineVariantGroup[];
  recommendation: {
    summary: string;
    bestForYouId: string | null;
    bestValueId: string | null;
    lowestPriceId: string | null;
    mostTrustedId: string | null;
    bestWarrantyId: string | null;
    bestDeliveryId: string | null;
  };
}

// ----------------------------------------------------
// VEYQUO Glowing SVG Logo
// ----------------------------------------------------
const VeyquoLogo = () => (
  <svg className="w-12 h-12" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#c0c1ff" />
        <stop offset="50%" stopColor="#89ceff" />
        <stop offset="100%" stopColor="#ffb783" />
      </linearGradient>
      <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <polygon points="50,5 90,28 90,72 50,95 10,72 10,28" stroke="url(#logo-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.3" />
    <polygon points="50,22 75,37 75,63 50,78 25,63 25,37" stroke="url(#logo-grad)" strokeWidth="3" fill="rgba(192, 193, 255, 0.05)" filter="url(#logo-glow)" />
    <circle cx="50" cy="50" r="8" fill="url(#logo-grad)" opacity="0.8" className="animate-pulse" />
  </svg>
);

// ----------------------------------------------------
// WebGL Particles Flow Shader Background Component
// ----------------------------------------------------
const WebGLShaderBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return;

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      varying vec2 v_texCoord;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;

      vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                 -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
          dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 a0 = x - floor(x + 0.5);
        float g = dot(m, a0*x0.x + h*(vec3(x0.y, x12.xz)));
        return 130.0 * g;
      }

      void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
          vec2 mouse = (u_mouse.xy / u_resolution.xy) * 2.0 - 1.0;
          
          float dist = length(uv);
          float glow = 0.04 / (dist + 0.1);
          
          float angle = atan(uv.y, uv.x);
          float radius = length(uv);
          
          float particles = 0.0;
          for(float i=0.0; i<8.0; i++) {
              float t = u_time * (0.2 + i * 0.1);
              float n = snoise(vec2(angle * 2.0 + t, radius * 5.0 - t));
              particles += smoothstep(0.95, 1.0, n) * (1.0 - radius);
          }
          
          vec3 accentColor = vec3(0.4, 0.6, 1.0);
          vec3 bgColor = vec3(0.03, 0.035, 0.04);
          
          vec3 color = mix(bgColor, accentColor, glow * 0.5);
          color += accentColor * particles * 0.6;
          
          float lines = sin(radius * 40.0 - u_time * 2.0) * 0.5 + 0.5;
          color += accentColor * lines * 0.02 * (1.0 - radius);
          
          gl_FragColor = vec4(color, 1.0);
      }
    `;

    function compileShader(source: string, type: number) {
      if (!gl) return null;
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Shader link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'u_time');
    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');

    let mouse = { x: canvas.width / 2, y: canvas.height / 2 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = 1.0 - (e.clientY - rect.top) / rect.height;
        mouse.x = nx * canvas.width;
        mouse.y = ny * canvas.height;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;

    const render = (time: number) => {
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uTime, time * 0.001);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouse.x, mouse.y);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block pointer-events-none opacity-40 mix-blend-screen z-0" />;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'discover' | 'results' | 'details' | 'compare' | 'watchlist'>('discover');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Rotating placeholders for search
  const placeholders = ["Laptops...", "Smartphones...", "Refrigerators...", "Earphones...", "Wireless Earbuds..."];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Search Engine States
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);

  // Pagination states
  const [resultsPage, setResultsPage] = useState(1);
  const itemsPerPage = 15;

  // Selected Product & Comparison States
  const [selectedProduct, setSelectedProduct] = useState<PipelineVariantGroup | null>(null);
  const [compareMode, setCompareMode] = useState<'products' | 'platforms'>('products');
  const [comparisonListings, setComparisonListings] = useState<any[]>([]);
  const [aiRecommendation, setAiRecommendation] = useState('');

  // Priority Control Weights
  const [weights, setWeights] = useState<UserWeights>({
    priceWeight: 0.40,
    sellerWeight: 0.20,
    warrantyWeight: 0.15,
    deliveryWeight: 0.10,
    specificationWeight: 0.10,
    conditionWeight: 0.05,
  });

  // Watchlist states
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [savedComparisons, setSavedComparisons] = useState<any[]>([]);
  const [isSavingComparison, setIsSavingComparison] = useState(false);
  const [watchlistTargetPrice, setWatchlistTargetPrice] = useState('');

  // AI assistant chat widget states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant', text: string }>>([
    { sender: 'assistant', text: "Hello! I am Veyquo AI, your personal decision co-pilot. How can I help you compare products, analyze e-commerce listings, or tweak scoring weights today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);

  useEffect(() => {
    fetchWatchlist();
    fetchSavedComparisons();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch('/api/watchlist');
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data);
        return;
      }
    } catch (e) {
      console.warn("DB watchlist fetch failed, falling back to localStorage:", e);
    }
    const local = localStorage.getItem('veyquo_watchlist');
    if (local) {
      setWatchlist(JSON.parse(local));
    }
  };

  const fetchSavedComparisons = async () => {
    try {
      const res = await fetch('/api/compare');
      if (res.ok) {
        const data = await res.json();
        setSavedComparisons(data);
        return;
      }
    } catch (e) {
      console.warn("DB compare list fetch failed, falling back to localStorage:", e);
    }
    const local = localStorage.getItem('veyquo_saved_comparisons');
    if (local) {
      setSavedComparisons(JSON.parse(local));
    }
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setResult(null);
    setSelectedProduct(null);
    setResultsPage(1);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, weights })
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setActiveTab('results');
      } else {
        alert("Search failed. Please verify API configurations.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Compare Option 1: Pick top 10 products and score them
  const handleCompareWithProducts = () => {
    if (!result || !selectedProduct) return;
    setCompareMode('products');

    // Aggregate the best listings from the first 10 variants in results
    const topVariants = result.variants.slice(0, 10);
    const listingsToCompare = topVariants.map((v, idx) => {
      // Find the highest scoring listing for each variant
      const bestList = v.listings[0] || {
        price: 5000 + idx * 1200,
        deliveryFee: idx % 2 === 0 ? 0 : 99,
        discount: 0,
        condition: 'NEW',
        warranty: '1 Year Brand Warranty',
        sellerRating: 4.5,
        sellerName: 'Authorized Retailer'
      };

      const basePrice = bestList.price;
      const deliveryFee = bestList.deliveryFee || 0;
      const effectivePrice = basePrice + deliveryFee;

      return {
        id: `prod-${v.id}-${idx}`,
        title: v.name,
        brand: v.brand,
        price: basePrice,
        deliveryFee,
        effectivePrice,
        sellerRating: bestList.sellerRating || 4.5,
        warranty: bestList.warranty || '1 Year',
        deliveryText: deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`,
        condition: bestList.condition || 'NEW'
      };
    });

    // Score listings based on weights
    const maxPrice = Math.max(...listingsToCompare.map(l => l.effectivePrice));
    const minPrice = Math.min(...listingsToCompare.map(l => l.effectivePrice));

    const scored = listingsToCompare.map(l => {
      const priceScore = maxPrice === minPrice ? 1.0 : 1.0 - ((l.effectivePrice - minPrice) / (maxPrice - minPrice));
      const ratingScore = l.sellerRating / 5.0;
      const totalScore = parseFloat((priceScore * 0.6 + ratingScore * 0.4).toFixed(2));

      return { ...l, score: totalScore };
    });

    scored.sort((a, b) => b.score - a.score);
    setComparisonListings(scored);

    const winner = scored[0];
    setAiRecommendation(`🏆 **${winner.title}** is selected as the Best Overall Product for you.\n\nIt offers the best balance with an effective price of **₹${winner.effectivePrice.toLocaleString()}**, high seller rating of **${winner.sellerRating} ⭐**, and **${winner.warranty}** protection.`);
    setActiveTab('compare');
  };

  // Compare Option 2: Platform deals compare (Amazon vs Flipkart vs OLX vs Croma)
  const handleCompareWithPlatforms = async () => {
    if (!selectedProduct) return;
    setCompareMode('platforms');
    setLoading(true);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: selectedProduct.name,
          mode: 'deals',
          productName: selectedProduct.name,
          weights
        })
      });

      if (res.ok) {
        const data = await res.json();
        const deals = data.variants[0]?.listings || [];
        setComparisonListings(deals);
        setAiRecommendation(data.recommendation?.summary || 'Best deal recommendation generated.');
        setActiveTab('compare');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (product: PipelineVariantGroup) => {
    setSelectedProduct(product);
    setActiveTab('details');
  };

  const handleAddToWatchlist = async () => {
    if (!selectedProduct || !watchlistTargetPrice) return;
    const targetVal = parseFloat(watchlistTargetPrice);
    
    let success = false;
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: selectedProduct.id,
          targetPrice: targetVal
        })
      });
      if (res.ok) {
        success = true;
      }
    } catch (e) {
      console.warn("DB add to watchlist failed, falling back to localStorage:", e);
    }

    if (success) {
      setWatchlistTargetPrice('');
      fetchWatchlist();
      alert('Added to watchlist!');
    } else {
      const newItem = {
        id: `local-watch-${Date.now()}`,
        targetPrice: targetVal,
        variant: {
          id: selectedProduct.id,
          name: selectedProduct.name,
          brand: selectedProduct.brand,
          category: result?.intent.category || "General",
          bestPrice: selectedProduct.minPrice
        }
      };
      const local = localStorage.getItem('veyquo_watchlist');
      const items = local ? JSON.parse(local) : [];
      items.push(newItem);
      localStorage.setItem('veyquo_watchlist', JSON.stringify(items));
      setWatchlist(items);
      setWatchlistTargetPrice('');
      alert('Added to watchlist (Saved locally in browser)!');
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    let success = false;
    try {
      const res = await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        success = true;
      }
    } catch (e) {
      console.warn("DB delete watchlist failed, falling back to localStorage:", e);
    }

    if (success) {
      fetchWatchlist();
    } else {
      const local = localStorage.getItem('veyquo_watchlist');
      if (local) {
        const items = JSON.parse(local).filter((item: any) => item.id !== id);
        localStorage.setItem('veyquo_watchlist', JSON.stringify(items));
        setWatchlist(items);
      }
    }
  };

  const handleSaveComparison = async () => {
    if (!selectedProduct || comparisonListings.length === 0) return;
    setIsSavingComparison(true);
    
    let success = false;
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Comparison - ${selectedProduct.name} (${new Date().toLocaleDateString()})`,
          query: selectedProduct.name,
          listings: comparisonListings,
          summary: aiRecommendation
        })
      });
      if (res.ok) {
        success = true;
      }
    } catch (e) {
      console.warn("DB save comparison failed, falling back to localStorage:", e);
    }

    if (success) {
      fetchSavedComparisons();
      alert('Comparison saved successfully!');
    } else {
      const newComp = {
        id: `local-comp-${Date.now()}`,
        title: `Comparison - ${selectedProduct.name} (${new Date().toLocaleDateString()})`,
        query: selectedProduct.name,
        data: JSON.stringify({
          listings: comparisonListings,
          recommendation: { summary: aiRecommendation }
        })
      };
      const local = localStorage.getItem('veyquo_saved_comparisons');
      const items = local ? JSON.parse(local) : [];
      items.push(newComp);
      localStorage.setItem('veyquo_saved_comparisons', JSON.stringify(items));
      setSavedComparisons(items);
      alert('Comparison saved successfully (Saved locally in browser)!');
    }
    setIsSavingComparison(false);
  };

  const handleLoadSaved = (saved: any) => {
    setLoading(true);
    
    if (typeof saved.id === 'string' && saved.id.startsWith('local-')) {
      const parsedData = JSON.parse(saved.data);
      const mockProduct = {
        id: 'saved-prod',
        name: saved.title.replace('Comparison - ', ''),
        brand: 'Saved Search',
        model: 'Model',
        ram: null,
        storage: null,
        condition: 'NEW',
        specifications: [],
        listings: [],
        bestScore: 0,
        avgPrice: 0,
        minPrice: 0
      };
      setSelectedProduct(mockProduct);
      setComparisonListings(parsedData.listings);
      setAiRecommendation(parsedData.recommendation?.summary || '');
      setCompareMode(parsedData.listings[0]?.marketplaceCode ? 'platforms' : 'products');
      setActiveTab('compare');
      setLoading(false);
      return;
    }

    fetch(`/api/compare?id=${saved.id}`)
      .then(res => res.json())
      .then(data => {
        const mockProduct = {
          id: 'saved-prod',
          name: saved.name.replace('Comparison - ', ''),
          brand: 'Saved Search',
          model: 'Model',
          ram: null,
          storage: null,
          condition: 'NEW',
          specifications: [],
          listings: [],
          bestScore: 0,
          avgPrice: 0,
          minPrice: 0
        };
        setSelectedProduct(mockProduct);
        setComparisonListings(data.listings);
        setAiRecommendation(data.recommendation?.summary || '');
        setCompareMode(data.listings[0]?.marketplaceCode ? 'platforms' : 'products');
        setActiveTab('compare');
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userText = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setIsChatTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          activeQuery: query,
          activeListings: comparisonListings,
          activeWeights: weights
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { sender: 'assistant', text: data.response || "I couldn't process that request." }]);
        
        // Execute AI assistant actions dynamically on client
        if (data.action) {
          const { type, payload } = data.action;
          if (type === 'UPDATE_WEIGHTS' && payload) {
            setWeights(prev => ({ ...prev, ...payload }));
            alert('AI Assistant: Adjusted comparison scoring weights!');
          } else if (type === 'UPDATE_BUDGET' && payload?.budget) {
            alert(`AI Assistant: Filtering budget threshold to ₹${payload.budget.toLocaleString()}`);
          } else if (type === 'SET_SORT_FIELD' && payload?.sortField) {
            const sort = payload.sortField;
            setComparisonListings(prev => {
              const copy = [...prev];
              if (sort === 'price') {
                copy.sort((a, b) => (a.effectivePrice || a.price) - (b.effectivePrice || b.price));
              } else if (sort === 'score') {
                copy.sort((a, b) => (b.score || 0) - (a.score || 0));
              }
              return copy;
            });
            alert(`AI Assistant: Sorted listings table by ${sort}!`);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setChatMessages(prev => [...prev, { sender: 'assistant', text: "Error connecting to AI assistant." }]);
    } finally {
      setIsChatTyping(false);
    }
  };


  const getProductImage = (title: string) => {
    return `/api/product-image?q=${encodeURIComponent(title)}`;
  };

  const getRetailerLogo = (code: string) => {
    switch (code) {
      case 'amazon':
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuDDZqvJQuIfueCG6vorJlFGAFUYNqtH-tQ4uqMNugkEdj4aEtPnC9BMWtQzngJMNlbIDjs3VbogMPgGA21CZBvp3iwskoZv9C_WDvFF2CiKdgZ5RHo2aiV7MWo_Z_AlJRBWdXYVC2UV2K2K_qvIZZDAJGWxDgYihh6SCjYCdyMCJgFEIAc6GglAAgZuwd2_5q7MkL71Pc2KldrB4_w_VM9aMocbp2gaR5qdlwMoiY39RTau0l8w90oULw';
      case 'flipkart':
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuA3Vh1OW7z0pW0IT1CQ8QBBw73owmB3ciTWSAzarHViZpXV-xIUsclIYXjxw1JeTTo7JuMULsR_0DLmikweHx6tQIaD5BanPZfmvg-YFjzA8k4iImxtHXOT5mHtQ_BRRhFIxw3Get3SUv3Nry1WI-wAHLdcx-Aq7C0Hu6Pbus4Sw40LF5P2p-b2aiRlvHDE-Dnq7P9v8uTQbunjBwXtERuaON2_PoYGyF56dJkf9ipFpgdFb9dYEcS1lA';
      case 'croma':
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXEeA7H9w943Zx48hSHvj2uS0ml5ubgVKXJvR2HbxFX3ezYRFPsmrnoqlbKrIRd7rBDARNH_NxjupSF8Le3UhyWlxMWN1FetoLhX_suD-0z1YpOyIYgwJ05ER3GZhP2KP9D9C_qwYSXZpQ8gB3Cp9G6hjifqmOzLR_NI5q_twqZkPbmNPgFcRIikN--45d50b0H_SuWow4Xv8N5ceASGjxQCWtDL446GlD8xEHZ-K_2YpTksIgRX4_qQ';
      case 'reliance':
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuCyvhYJEeFOxhKUPYsw4C3AuN1M0OzjcK7WTEqMiUIkNHCPF3pRYwTp3MARZtLsBMVR11KtFafdBWRJSQNMAnqVxsZ1tsBFM0BZSxwIsVPesH2-I_UesZMqVipm7I8-Wzd-qffYFC-cUzpKrfT1KhxaMI77izXgGUKP1xii8JX0Bg3ak6STWWZdKjF1uXqwGQsFzaiKi6QAS-17D0y03UD_mt7v15arpEkTlFn-0_pvz7gHxyjyaM8ruw';
      default:
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfFKcR-VQnZRlNhupwWQe6tBHMGVjuBzsvNG2ercEVilQHRcnksKM_eugDZuKQ2Cv3WlTl3R8VRDnmjNn3nAPCZLpsMDCeK8xRgrxku2YvpVOMp3VrJBPDSERG1kUPnqQQN-VJHH42OhTi0YxzSCp2IZnK-3Ub91s8Dk5TRkrTbd9iRPShQG_ATQwykT3Pec-QGlbSsRtg3HsAFkMUSIjICjeSRi_i5VIVcbLucm-vSWD63yPwltYDrQ';
    }
  };

  const paginatedVariants = result?.variants.slice(
    (resultsPage - 1) * itemsPerPage,
    resultsPage * itemsPerPage
  ) || [];

  const totalPages = result ? Math.ceil(result.variants.length / itemsPerPage) : 1;

  return (
    <div className="text-[#e3e2e5] antialiased min-h-screen flex flex-col bg-[#08090B] font-sans selection:bg-[#c0c1ff]/30 selection:text-[#c0c1ff]">
      
      {/* Top Floating Glass Header (with Immersed Logo & Collapsible Hamburger) */}
      <header className="fixed top-0 left-0 w-full h-20 z-40 bg-[#08090B]/85 backdrop-blur-xl border-b border-white/5 px-6 md:px-12 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('discover')}>
          <VeyquoLogo />
          <div>
            <div className="font-display-lg text-[20px] font-black tracking-tighter text-white">VEYQUO</div>
            <p className="text-[#c0c1ff] text-[8px] font-bold uppercase tracking-widest opacity-80">Decision Intelligence</p>
          </div>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="text-white hover:text-[#c0c1ff] transition-all flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 border border-white/10 hover:border-[#c0c1ff]/30"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
      </header>

      {/* Unified Collapsible Menu Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#08090B]/98 backdrop-blur-xl flex flex-col p-6 animate-fade-in">
          <div className="flex justify-between items-center mb-10 w-full max-w-lg mx-auto">
            <div className="flex items-center gap-3">
              <VeyquoLogo />
              <div>
                <div className="font-display-lg text-2xl font-black text-white tracking-tighter">VEYQUO</div>
                <p className="text-[#c0c1ff] text-[9px] font-bold uppercase tracking-widest opacity-80">Decision Intelligence</p>
              </div>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)} 
              className="text-white hover:text-[#c0c1ff] w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>

          <nav className="flex flex-col gap-3 w-full max-w-lg mx-auto text-lg">
            <button 
              className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all text-left ${activeTab === 'discover' ? 'text-[#c0c1ff] font-bold bg-[#c0c1ff]/10 border-l-4 border-l-[#c0c1ff]' : 'text-[#c7c4d7] hover:bg-white/5'}`}
              onClick={() => { setActiveTab('discover'); setMobileMenuOpen(false); }}
            >
              <span className="material-symbols-outlined">explore</span>
              <span className="text-base font-semibold">Discover Search Console</span>
            </button>
            <button 
              className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all text-left ${activeTab === 'watchlist' ? 'text-[#c0c1ff] font-bold bg-[#c0c1ff]/10 border-l-4 border-l-[#c0c1ff]' : 'text-[#c7c4d7] hover:bg-white/5'}`}
              onClick={() => { setActiveTab('watchlist'); setMobileMenuOpen(false); }}
            >
              <span className="material-symbols-outlined">visibility</span>
              <span className="text-base font-semibold">My Active Watchlist</span>
            </button>
          </nav>
        </div>
      )}

      {/* Main Content Pane */}
      <main className="flex-1 w-full pt-20 overflow-y-auto min-h-screen flex flex-col relative z-0">
        
        {/* VIEW 1: DISCOVER (Search Console) */}
        {activeTab === 'discover' && (
          <div className="flex-grow flex flex-col justify-center relative px-6 md:px-12 py-12 max-w-5xl mx-auto w-full">
            <WebGLShaderBackground />

            {/* Hero Brand Title */}
            <div className="text-center mb-10 z-10 animate-fade-in">
              <h1 className="font-display-lg text-[44px] md:text-[68px] leading-tight font-black text-white tracking-tighter mb-4">
                Don't just find a product. <br />
                <span className="animated-gradient-text">Find the right decision.</span>
              </h1>
              <p className="font-title-md text-base md:text-lg text-[#c7c4d7] max-w-2xl mx-auto opacity-80 leading-relaxed">
                VEYQUO automatically matches listings across platforms and recommends the best overall value.
              </p>
            </div>

            {/* Rounded Search Console */}
            <div className="w-full max-w-3xl mx-auto mb-6 relative group z-10">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#c0c1ff]/20 via-[#89ceff]/20 to-[#c0c1ff]/20 rounded-full blur-lg opacity-40 group-hover:opacity-80 transition duration-1000"></div>
              <div className="relative flex items-center w-full h-[64px] glass-input rounded-full px-6 transition-all glow-hover">
                <span className="material-symbols-outlined text-[#908fa0] mr-4 text-[28px]">search</span>
                
                <div className="flex-grow flex items-center relative h-full">
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                    className="w-full bg-transparent border-none outline-none focus:ring-0 text-white font-title-md text-base md:text-lg z-10"
                    placeholder=""
                  />
                  {query === '' && (
                    <div className="absolute inset-0 pointer-events-none text-[#908fa0] font-title-md text-base md:text-lg flex items-center gap-2">
                      <span>Search broad category or specific model, e.g.</span>
                      <span className="text-[#908fa0] font-semibold">{placeholders[placeholderIndex]}</span>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => handleSearch(query)}
                  className="bg-[#c0c1ff] text-[#1000a9] rounded-full px-6 py-2.5 font-label-sm text-xs font-bold uppercase tracking-wider hover:bg-white transition-colors ml-2 shrink-0"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Loading stage indicators */}
            {loading && (
              <div className="glass-panel rounded-2xl p-8 text-center max-w-md mx-auto z-10 flex flex-col items-center border border-[#c0c1ff]/20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#c0c1ff] mb-4"></div>
                <h3 className="text-lg font-bold text-white mb-1">VEYQUO Decision Engine</h3>
                <p className="text-xs text-[#c7c4d7]">Orchestrating internet crawling and de-duplication...</p>
              </div>
            )}

            {/* Footer marquee brand list (Re-added) */}
            {!loading && (
              <div className="w-full mt-16 border-t border-white/5 pt-8 z-10">
                <p className="text-[10px] font-bold text-[#908fa0] uppercase tracking-widest text-center mb-6 opacity-60">Analyzing live data across global platforms</p>
                <div className="marquee opacity-60 hover:opacity-100 transition-opacity">
                  <div className="marquee-content items-center">
                    <img src={getRetailerLogo('amazon')} alt="Amazon" className="h-8 object-contain" />
                    <img src={getRetailerLogo('flipkart')} alt="Flipkart" className="h-8 object-contain" />
                    <img src={getRetailerLogo('croma')} alt="Croma" className="h-8 object-contain" />
                    <img src={getRetailerLogo('reliance')} alt="Reliance" className="h-8 object-contain" />
                    <img src={getRetailerLogo('tatacliq')} alt="Tata CLiQ" className="h-8 object-contain" />
                    <img src={getRetailerLogo('amazon')} alt="Amazon" className="h-8 object-contain" />
                    <img src={getRetailerLogo('flipkart')} alt="Flipkart" className="h-8 object-contain" />
                    <img src={getRetailerLogo('croma')} alt="Croma" className="h-8 object-contain" />
                    <img src={getRetailerLogo('reliance')} alt="Reliance" className="h-8 object-contain" />
                    <img src={getRetailerLogo('tatacliq')} alt="Tata CLiQ" className="h-8 object-contain" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: SEARCH RESULTS (Grid + Pagination) */}
        {activeTab === 'results' && (
          <div className="px-8 py-8 flex-1 flex flex-col animate-fade-in">
            <header className="mb-6 flex justify-between items-center">
              <div>
                <p className="text-xs text-[#89ceff] uppercase tracking-widest font-bold">Crawled Results</p>
                <h2 className="text-3xl font-light text-white tracking-tight">
                  Found <strong className="font-bold">{result?.variants.length || 0}</strong> products for "{result?.intent.rawInput}"
                </h2>
              </div>
              <button onClick={() => setActiveTab('discover')} className="text-xs text-[#c7c4d7] hover:text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">arrow_back</span> Back to search
              </button>
            </header>

            {paginatedVariants.length === 0 ? (
              <p className="text-center py-20 text-[#908fa0]">No products discovered. Try another query.</p>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
                  {paginatedVariants.map((v) => (
                    <div key={v.id} className="glass-panel rounded-2xl p-5 flex flex-col hover:border-[#c0c1ff]/30 transition-all duration-500">
                      <div className="w-full h-40 bg-[#0d0e10] rounded-xl overflow-hidden mb-4 border border-white/5 flex items-center justify-center">
                        <img src={getProductImage(v.name)} alt={v.name} className="w-full h-full object-cover" />
                      </div>
                      <h3 className="font-bold text-white mb-1 line-clamp-1">{v.name}</h3>
                      <p className="text-[10px] text-[#908fa0] uppercase tracking-wider font-extrabold mb-4">{v.brand}</p>
                      
                      <div className="flex justify-between items-baseline mt-auto pt-4 border-t border-white/5">
                        <span className="text-sm font-semibold text-[#c7c4d7]">Starting at</span>
                        <span className="text-lg font-black text-white">₹{v.minPrice.toLocaleString()}</span>
                      </div>

                      <button 
                        onClick={() => handleSelectProduct(v)}
                        className="w-full mt-4 py-2.5 bg-[#c0c1ff] text-[#1000a9] font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-white transition-colors"
                      >
                        View Specs & Compare
                      </button>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center items-center gap-4">
                    <button 
                      disabled={resultsPage === 1}
                      onClick={() => setResultsPage(p => p - 1)}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      Previous Page
                    </button>
                    <span className="text-xs text-[#908fa0]">Page <strong>{resultsPage}</strong> of {totalPages}</span>
                    <button 
                      disabled={resultsPage === totalPages}
                      onClick={() => setResultsPage(p => p + 1)}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      Next Page
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: PRODUCT DETAILS (Specs + Compare options) */}
        {activeTab === 'details' && selectedProduct && (
          <div className="px-8 py-8 flex-grow max-w-4xl mx-auto w-full flex flex-col animate-fade-in">
            <header className="mb-6 flex justify-between items-center">
              <button onClick={() => setActiveTab('results')} className="text-xs text-[#c7c4d7] hover:text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">arrow_back</span> Back to results
              </button>
              <h2 className="text-lg font-bold text-white">Product Profile</h2>
            </header>

            <div className="glass-panel rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-1/3 bg-[#0d0e10] rounded-2xl overflow-hidden border border-white/5 flex items-center justify-center p-4">
                <img src={getProductImage(selectedProduct.name)} alt={selectedProduct.name} className="w-full max-h-60 object-contain" />
              </div>
              <div className="flex-1 flex flex-col">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{selectedProduct.name}</h1>
                <p className="text-xs font-bold uppercase tracking-widest text-[#89ceff] mb-6">{selectedProduct.brand}</p>
                
                {/* Specifications List */}
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#908fa0] mb-3">Technical Specifications</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                  {selectedProduct.listings[0]?.specifications?.map((spec: any, sIdx: number) => (
                    <div key={sIdx} className="flex justify-between items-center p-3.5 bg-white/2.5 rounded-xl border border-white/5 text-xs">
                      <span className="text-[#908fa0] font-medium capitalize">{spec.key}</span>
                      <span className="text-white font-bold">{spec.value || spec.normalizedValue}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3.5 bg-white/2.5 rounded-xl border border-white/5 text-xs">
                    <span className="text-[#908fa0] font-medium">Condition</span>
                    <span className="text-white font-bold">{selectedProduct.condition}</span>
                  </div>
                  <div className="flex justify-between items-center p-3.5 bg-white/2.5 rounded-xl border border-white/5 text-xs">
                    <span className="text-[#908fa0] font-medium">Fulfillment Days</span>
                    <span className="text-white font-bold">{selectedProduct.listings[0]?.deliveryDays || 3} Days</span>
                  </div>
                </div>

                {/* Watchlist alerts config */}
                <div className="mt-6 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider block mb-2">Setup Price Alert</label>
                    <div className="flex gap-2 w-full">
                      <input 
                        type="number" 
                        placeholder="Price threshold (₹)..."
                        value={watchlistTargetPrice}
                        onChange={(e) => setWatchlistTargetPrice(e.target.value)}
                        className="bg-[#050506] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none w-full"
                      />
                      <button 
                        onClick={handleAddToWatchlist}
                        className="bg-[#c0c1ff]/10 hover:bg-[#c0c1ff]/20 border border-[#c0c1ff]/20 text-[#c0c1ff] px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shrink-0"
                      >
                        Watch
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison Options Grid at the bottom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
              <div 
                onClick={handleCompareWithProducts}
                className="glass-panel p-6 rounded-2xl border border-white/5 hover:border-[#c0c1ff]/30 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[#c0c1ff]">compare_arrows</span>
                    <h3 className="font-bold text-white group-hover:text-[#c0c1ff] transition-colors">Compare with Products</h3>
                  </div>
                  <p className="text-xs text-[#c7c4d7] leading-relaxed">VEYQUO automatically selects the top 10 models on the marketplace, ranks them based on metrics, and suggests the best match.</p>
                </div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#c0c1ff] mt-6 flex items-center gap-1">Compare Products <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span></span>
              </div>

              <div 
                onClick={handleCompareWithPlatforms}
                className="glass-panel p-6 rounded-2xl border border-white/5 hover:border-[#c0c1ff]/30 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[#89ceff]">sell</span>
                    <h3 className="font-bold text-white group-hover:text-[#89ceff] transition-colors">Compare with Platforms</h3>
                  </div>
                  <p className="text-xs text-[#c7c4d7] leading-relaxed">Triggers cross-marketplace pricing and deal comparison. Compares Amazon vs Flipkart vs OLX vs Croma vs Tata CLiQ.</p>
                </div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#89ceff] mt-6 flex items-center gap-1">Compare platforms <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span></span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: COMPARISON RESULTS BOARD */}
        {activeTab === 'compare' && selectedProduct && (
          <div className="px-8 py-8 flex-grow w-full max-w-6xl mx-auto flex flex-col animate-fade-in">
            <header className="mb-6 flex justify-between items-center">
              <button onClick={() => setActiveTab('details')} className="text-xs text-[#c7c4d7] hover:text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">arrow_back</span> Back to product specs
              </button>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveComparison}
                  disabled={isSavingComparison}
                  className="bg-[#1f2022] border border-white/10 hover:bg-[#292a2c] text-white px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">bookmark</span>
                  Save Matrix
                </button>
              </div>
            </header>

            {loading ? (
              <div className="text-center py-20 flex flex-col items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#89ceff] mb-4"></div>
                <p className="text-sm text-[#c7c4d7]">Building comparison model results...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                
                {/* AI Recommendation Explanation Card */}
                <div className="glass-card rounded-2xl p-6 border-l-4 border-l-[#c0c1ff]">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#c0c1ff] mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] animate-pulse">auto_awesome</span>
                    AI Decision Analysis
                  </h3>
                  <p className="text-sm text-white leading-relaxed whitespace-pre-line">{aiRecommendation}</p>
                </div>

                {/* Pricing Compare Table */}
                <div className="glass-panel rounded-2xl p-6 overflow-hidden">
                  <h2 className="text-base font-extrabold text-white mb-6">
                    {compareMode === 'products' ? 'Similar Products Comparison (Same Platform)' : `Cross-Platform Compare for ${selectedProduct.name}`}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-[#908fa0] font-bold uppercase tracking-wider">
                          <th className="pb-3 pr-4">{compareMode === 'products' ? 'Product Model' : 'E-Commerce Platform'}</th>
                          <th className="pb-3">Price</th>
                          <th className="pb-3">Seller Rating</th>
                          <th className="pb-3">Warranty</th>
                          <th className="pb-3">Delivery</th>
                          <th className="pb-3">Condition</th>
                          <th className="pb-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonListings.map((listing: any, index: number) => {
                          const isWinner = index === 0;
                          return (
                            <tr key={listing.id || index} className="border-b border-white/5 hover:bg-white/2.5 transition-colors">
                              <td className="py-4 pr-4">
                                <div className="flex items-center gap-3">
                                  {compareMode === 'platforms' && (
                                    <div className="w-8 h-8 rounded-lg bg-[#121315] flex items-center justify-center p-1">
                                      <img src={getRetailerLogo(listing.marketplaceCode)} alt={listing.marketplaceName} className="w-full h-full object-contain" />
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-bold text-white block">
                                      {compareMode === 'products' ? listing.title : listing.marketplaceName}
                                    </span>
                                    {isWinner && <span className="px-1.5 py-0.5 text-[8px] font-bold bg-[#c0c1ff]/10 text-[#c0c1ff] border border-[#c0c1ff]/20 rounded">🏆 Best Overall</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 font-extrabold text-white">₹{listing.effectivePrice?.toLocaleString() || listing.price?.toLocaleString()}</td>
                              <td className="py-4 text-[#ffb783] font-semibold">{listing.sellerRating ? `${listing.sellerRating} ⭐` : '—'}</td>
                              <td className="py-4 text-[#c7c4d7]">{listing.warranty || '1 Year'}</td>
                              <td className="py-4 text-[#c7c4d7]">{listing.deliveryText || (listing.deliveryFee === 0 ? 'Free' : `₹${listing.deliveryFee}`)}</td>
                              <td className="py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  listing.condition === 'USED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {listing.condition || 'NEW'}
                                </span>
                              </td>
                              <td className="py-4 text-right">
                                <a 
                                  href={listing.url || `https://www.google.com/search?q=${encodeURIComponent(listing.title || selectedProduct.name)}`}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 bg-[#c0c1ff]/10 hover:bg-[#c0c1ff] border border-[#c0c1ff]/20 text-[#c0c1ff] hover:text-[#1000a9] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                                >
                                  Buy Now
                                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* VIEW 5: WATCHLIST */}
        {activeTab === 'watchlist' && (
          <div className="px-8 py-8 flex-grow max-w-7xl mx-auto w-full animate-fade-in">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-white tracking-tight">Active Watchlist</h1>
              <p className="text-xs text-[#c7c4d7] mt-1 font-semibold uppercase tracking-wider">Tracking {watchlist.length} items across e-commerce databases</p>
            </header>

            {watchlist.length === 0 ? (
              <div className="glass-card rounded-2xl p-10 text-center py-20">
                <span className="material-symbols-outlined text-5xl text-[#908fa0] mb-4">visibility</span>
                <h3 className="text-xl font-bold text-white mb-1">Your Watchlist is empty</h3>
                <p className="text-xs text-[#c7c4d7]">Configure target thresholds in comparison cards to setup alerts.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {watchlist.map((item) => {
                  const score = item.variant.bestScore || 85;
                  const strokeOffset = 283 - (283 * (score / 100));

                  return (
                    <div 
                      key={item.id} 
                      className="glass-card rounded-2xl p-6 flex flex-col group hover:border-[#c0c1ff]/30 transition-all duration-500"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-[#0d0e10] flex items-center justify-center relative">
                          <img 
                            src={getProductImage(item.variant.name)} 
                            alt={item.variant.name} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-bold text-[#ffb783] uppercase tracking-wider mb-1">VEYQUO Score</span>
                          <div className="relative w-12 h-12 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" fill="none" r="45" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                              <circle 
                                className="zuno-score-arc" 
                                cx="50" 
                                cy="50" 
                                fill="none" 
                                r="45" 
                                stroke="#c0c1ff" 
                                strokeLinecap="round" 
                                strokeWidth="6" 
                                strokeDasharray="283"
                                strokeDashoffset={strokeOffset}
                              />
                            </svg>
                            <span className="absolute text-xs font-black text-[#c0c1ff]">{score}</span>
                          </div>
                        </div>
                      </div>

                      <h3 className="font-bold text-lg text-white mb-1 group-hover:text-[#c0c1ff] transition-colors">{item.variant.name}</h3>
                      <p className="text-[10px] text-[#908fa0] uppercase tracking-wider font-bold">{item.variant.brand} ({item.variant.category})</p>

                      <div className="bg-[#050506] rounded-xl p-4 border border-white/5 my-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-[#908fa0]">Current Price Alert</span>
                          <span className="text-[#89ceff] text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider">
                            <span className="material-symbols-outlined text-[13px]">arrow_downward</span>
                            Active
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-black text-white">₹{item.variant.bestPrice?.toLocaleString() || item.targetPrice.toLocaleString()}</span>
                          <span className="text-[#908fa0] text-xs font-bold">Target: ₹{item.targetPrice.toLocaleString()}</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDeleteWatchlist(item.id)}
                        className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold flex items-center justify-center gap-2 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all text-xs"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Remove Alert
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Floating AI Assistant Widget */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {/* Chat Panel */}
        {chatOpen && (
          <div className="w-80 md:w-96 h-[480px] rounded-3xl bg-[#121315]/95 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden mb-4 animate-fade-in">
            {/* Header */}
            <div className="px-5 py-4 bg-[#1b1c1e] border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#c0c1ff] animate-pulse">auto_awesome</span>
                <span className="text-sm font-bold text-white tracking-tight">VEYQUO AI Assistant</span>
              </div>
              <button 
                onClick={() => setChatOpen(false)}
                className="text-[#908fa0] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    msg.sender === 'user' 
                      ? 'bg-[#c0c1ff] text-[#1000a9] self-end font-medium' 
                      : 'bg-white/5 border border-white/5 text-[#e3e2e5] self-start'
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {isChatTyping && (
                <div className="bg-white/5 border border-white/5 text-[#e3e2e5] self-start rounded-2xl px-4 py-2.5 text-xs max-w-[80%] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>

            {/* Input field */}
            <div className="p-4 border-t border-white/5 bg-[#121315]">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }} 
                className="flex gap-2"
              >
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask to sort, update weights..." 
                  className="flex-1 bg-[#050506] border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-[#908fa0] focus:outline-none"
                />
                <button 
                  type="submit" 
                  className="bg-[#c0c1ff] hover:bg-white text-[#1000a9] rounded-xl px-4 py-2 text-xs font-bold transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Float Bubble Button */}
        <button 
          onClick={() => setChatOpen(!chatOpen)}
          className="w-14 h-14 rounded-full bg-[#c0c1ff] text-[#1000a9] shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all hover:bg-white glow-hover"
        >
          <span className="material-symbols-outlined text-[28px]">{chatOpen ? 'close' : 'smart_toy'}</span>
        </button>
      </div>

    </div>
  );
}
