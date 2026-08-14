---
name: Decision Intelligence Interface
colors:
  surface: '#121315'
  surface-dim: '#121315'
  surface-bright: '#38393b'
  surface-container-lowest: '#0d0e10'
  surface-container-low: '#1b1c1e'
  surface-container: '#1f2022'
  surface-container-high: '#292a2c'
  surface-container-highest: '#343537'
  on-surface: '#e3e2e5'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e3e2e5'
  inverse-on-surface: '#303033'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#89ceff'
  on-secondary: '#00344d'
  secondary-container: '#00a2e6'
  on-secondary-container: '#00344e'
  tertiary: '#ffb783'
  on-tertiary: '#4f2500'
  tertiary-container: '#d97721'
  on-tertiary-container: '#452000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703700'
  background: '#121315'
  on-background: '#e3e2e5'
  surface-variant: '#343537'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 32px
  gutter: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 40px
---

## Brand & Style
The design system is engineered for high-stakes decision-making, blending the precision of a technical instrument with the cinematic allure of a premium executive suite. It targets C-suite executives and product strategists who require clarity amidst high data density.

The aesthetic follows a **Sophisticated Futuristic** direction, characterized by:
- **Cinematic Depth:** Deep, layered blacks and subtle glows that suggest infinite digital space.
- **Organic Precision:** A contrast between hyper-sharp data points and soft, elliptical container geometry.
- **Focused Intelligence:** A minimalist interface where color is strictly reserved for "AI Insight" and "Actionable Intelligence."
- **Atmosphere:** Professional, calm, and highly responsive.

## Colors
The palette is built on a "Vantablack" foundation to ensure maximum contrast for data visualization.

- **Background (#08090B):** The base canvas.
- **Secondary (#101216):** Used for large architectural elements like sidebars and main content areas.
- **Elevated (#181B21):** Reserved for floating panels, cards, and interactive surfaces.
- **Accent (Electric Indigo - #6366F1):** The "Intelligence" color. It marks AI-generated recommendations, active states, and critical decision paths.
- **Sub-Accent (Cyan - #0EA5E9):** Used sparingly for secondary metrics and healthy status indicators.

## Typography
The system utilizes **Inter** for its neutral, highly legible characteristics, ensuring that complex data remains the focus. For technical labels and monospaced data points, **Geist** provides a modern, developer-precise feel.

- **Headlines:** Should be tight-set with negative letter-spacing to feel confident and "news-headline" authoritative.
- **Body:** Maintains standard tracking for long-form report reading.
- **Labels:** Always uppercase with increased letter-spacing to differentiate from interactive text.

## Layout & Spacing
This design system employs a **Fluid Grid** with wide margins to create a sense of "gallery space" around data visualizations.

- **Desktop:** 12-column grid, 32px margins, 24px gutters.
- **Tablet:** 8-column grid, 24px margins, 16px gutters.
- **Mobile:** 4-column grid, 16px margins, 12px gutters.

Spacing follows a strict 4px baseline. Large vertical sections should be separated by at least 40px (`stack-lg`) to maintain the minimalist, airy atmosphere despite high data density.

## Elevation & Depth
Depth is not communicated through heavy shadows, but through **Tonal Layering** and **Glassmorphism**.

1.  **Level 0 (Base):** #08090B.
2.  **Level 1 (Submerged):** Internal wells and input backgrounds use #050506 with an inner subtle 1px stroke.
3.  **Level 2 (Surface):** #101216.
4.  **Level 3 (Elevated):** #181B21 with a 1px border of `rgba(255,255,255,0.08)`.
5.  **Overlay/AI State:** Glassmorphism with a 20px backdrop blur and a faint `accent_glow` (Indigo) outer shadow to signify intelligence.

## Shapes
The shape language is **Organic and Elliptical**. Avoid sharp 90-degree corners at all costs.

- **Main Containers:** Use a generous 24px radius to soften the technical nature of the data.
- **Buttons & Chips:** Always use the "Pill" shape (999px radius) for a fluid, modern feel.
- **Inputs:** Large 16px radius for search bars to accommodate the glassmorphic depth.
- **Selection Indicators:** Use pill-shaped indicators rather than traditional checkmarks where possible.

## Components
- **Search Inputs:** Over-sized (height: 64px) with `backdrop-filter: blur(12px)`. Include a subtle internal indigo glow when focused.
- **Status Chips:** High-gloss pill shapes. Use a small pulsating dot indicator for "Live" or "Processing" states.
- **Score Arcs:** Circular gauges should use a variable stroke weight—thicker at the current value, tapering off. Use the Primary Indigo for the "Value" and Secondary Cyan for the "Target."
- **Vertical Comparison Cards:** High-density lists within a 24px rounded container. Use subtle horizontal dividers (10% white) and bold Indigo highlights for "winning" metrics.
- **Priority Sliders:** Track is a thin 2px line. The thumb is a large 20px indigo circle with a faint outer glow.
- **AI Side Panels:** Slides in from the right with a full-height glassmorphic blur. Content inside should be more spaced out than the main dashboard to provide "thinking room."
- **Data Visualization:** Use "glow-lines" for charts—1px lines with a 4px blur of the same color beneath them to create a neon-light effect on the dark background.