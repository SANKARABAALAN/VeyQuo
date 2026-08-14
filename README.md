# Veyquo AI 🚀 — E-Commerce Decision Intelligence & Price Aggregator

**Veyquo AI** is a premium, state-of-the-art e-commerce decision intelligence platform and meta-search price aggregator. It crawls real-time information behind the scenes, parses listings, normalizes technical specifications, and uses custom priority weights to recommend the absolute best products for a user's unique needs.

Live URL: [https://vey-quo-kt8q.vercel.app/](https://vey-quo-kt8q.vercel.app/)

---

## ✨ Key Features

### 1. 🔍 Real-Time E-Commerce Aggregator & Search
* Aggregates products and listings from major Indian marketplaces: **Amazon India**, **Flipkart**, **Croma**, **Reliance Digital**, **Tata CLiQ**, and **OLX** (for used/secondhand options).
* Implements a **smart query-aware search** that handles both generic category inquiries (e.g., *"earphones"*, *"smartphones"*) and specific product lookups (e.g., *"iPhone 13 128GB"*).

### 2. 📸 DuckDuckGo Image Scraper
* Features a custom scraper in `/api/product-image` that extracts real, high-resolution product photos directly from the internet using DuckDuckGo's internal JSON API (with dynamic session `vqd` tokens).
* Filters out logos and icons and uses category fallback checkpoints (earphones, laptops, smartphones) to guarantee appropriate visual representations.

### 3. ⚖️ Personalized Decision Engine
* **Dynamic Priority Sliders:** Adjust weights for **Price**, **Seller Trust**, **Warranty**, **Delivery Speed**, **Technical Specs**, and **Condition**.
* **AI Spec-to-Cost Analyzer:** Replaces static rule-based selections. Generates a custom server-side analysis report comparing specs, price trade-offs, and competitor listings.
* **Category-Aware Specs:** Outputs correct parameters per product category (e.g., playtime, driver size, and IPX rating for earbuds; RAM, storage, and battery capacity for smartphones).

### 4. 🛒 Watchlist & Saved Deals Cart
* **Dual-Column Watchlist Hub:** 
  * **Price Alerts:** Sets target thresholds for product variants and tracks price changes.
  * **Saved Deals:** Bookmarks specific seller offers with active buy links, seller ratings, and conditions.
* Uses local browser caching (`localStorage`) to guarantee saved items are kept safe.

### 5. 🔗 Ultra-Accurate Regional Buying Links
* Converts product titles and marketplace codes into direct regional search links:
  * **Amazon India:** `amazon.in/s?k=...`
  * **Flipkart:** `flipkart.com/search?q=...`
  * **Croma:** `croma.com/search/?text=...`
  * **Reliance Digital:** `reliancedigital.in/search?q=...`
  * **Tata CLiQ:** `tatacliq.com/search/?text=...`
  * **OLX India:** `olx.in/items/q-...`

---

## 🛠️ Technology Stack
* **Framework:** Next.js 16 (App Router)
* **Language:** TypeScript
* **Database & ORM:** SQLite & Prisma ORM
* **Styling:** Tailwind CSS & Glassmorphism Design System
* **AI Engine:** Groq API (Llama-3.3-70b-versatile) / Gemini API wrapper

---

## 💻 Local Setup & Installation

Follow these steps to run the application on your local machine:

### 1. Clone the Repository
```bash
git clone https://github.com/SANKARABAALAN/VeyQuo.git
cd VeyQuo
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory:
```env
# Database connection (SQLite)
DATABASE_URL="file:./dev.db"

# AI Key (Groq key or Gemini key)
GEMINI_API_KEY="your_groq_or_gemini_api_key"
```

### 4. Setup the Database
Initialize your SQLite database using Prisma migrations and generate the client:
```bash
npx prisma db push
npx prisma generate
```

*(Optional) Seed database with demo products:*
```bash
npm run seed
# or manually seed via ts-node / prisma script
```

### 5. Run the Local Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser to test the application!

---

## 📂 Project Architecture

* `src/app/` — Next.js routing, pages, and API routes.
  * `page.tsx` — Premium comparison portal, sliders, tables, cart, and tabs.
  * `api/product-image/route.ts` — DuckDuckGo VQD real-time image scraper.
  * `api/compare/analyze/route.ts` — Server-side AI spec-to-cost analyzer.
* `src/lib/` — Shared utilities.
  * `pipeline/index.ts` — Fallback catalogs and search parsing algorithms.
  * `gemini.ts` — Groq / Gemini API models communication layer.
  * `prisma.ts` — Database client.
* `prisma/` — Schema definition for listings, products, and watchlists.
