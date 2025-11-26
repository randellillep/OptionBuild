# OptionFlow - Options Strategy Builder

## Overview

OptionFlow is a professional options trading strategy builder and analysis platform inspired by OptionStrat.com. It enables users to construct, visualize, and analyze options strategies with real-time profit/loss charts, Greeks calculations, and comprehensive risk metrics. The platform features over 10 pre-built strategy templates, interactive volatility controls, and a 6-tab analysis section. It utilizes the Black-Scholes model for accurate option pricing with time decay. OptionFlow aims to provide visual analysis, P/L scenarios across time and price, and risk exposure metrics to help traders understand complex options positions before execution.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18+ with TypeScript (strict mode)

**Routing**: Wouter

**State Management**: React hooks for local state, TanStack Query for server state, custom `useStrategyEngine` hook for strategy calculations.

**UI Framework**: Shadcn UI with Radix UI primitives, Tailwind CSS for styling. Features a custom theme with light/dark mode and follows a "Modern Data Application Pattern" for fintech aesthetics.

**Component Strategy**: Organizes components into presentational (`/client/src/components/`), page-level (`/client/src/pages/`), and reusable UI primitives (`/client/src/components/ui/`).

**Data Visualization**: Recharts for interactive P/L charts; custom components for heatmaps, strike ladders, and expiration timelines.

**Key Design Patterns**: Composition over inheritance, controlled components, custom hooks for business logic separation, and TypeScript strict mode.

### Backend Architecture

**Server Framework**: Express.js with TypeScript

**Development Setup**: Vite for development with HMR, custom middleware for Vite/Express integration, TSX for development.

**API Structure**: RESTful API (`/api/*`) with route registration, logging middleware, and session support via `connect-pg-simple`.

**Market Data Integration**: Finnhub API for real-time US stock quotes.

**Storage Layer**: Abstracted `IStorage` interface with an in-memory implementation (`MemStorage`), designed for future database integration.

**Build Process**: Vite builds client to `dist/public`, esbuild bundles server to `dist/index.js`.

**Key Design Decisions**: Monorepo structure, middleware pattern, separation of concerns.

### Data Architecture

**Schema Design**: PostgreSQL-ready schema using Drizzle ORM and TypeScript (shared types for `OptionLeg`, `Strategy`, `Greeks`, `StrategyMetrics`).

**Database Strategy**: Drizzle ORM with Neon serverless PostgreSQL driver, schema-first approach with Zod validation, migrations in `/migrations`.

**Pricing Engine**: Black-Scholes model for option pricing and Greeks calculations (delta, gamma, theta, vega, rho). Computes strategy-level metrics.

**Key Design Decisions**: Client-side options calculations for real-time responsiveness, client-side strategy data (not yet persisted), type safety via shared schema definitions.

### Design System

**Typography**: Inter (UI/data) and JetBrains Mono (numbers/prices).

**Color System**: CSS variables for theming in HSL, specific definitions for contexts, automatic border color computation.

**Spacing & Layout**: Tailwind spacing scale, `max-width` container, responsive grid systems, mobile-first design.

**Component Styling Patterns**: Hover/active states, shadow system, consistent border radius, class-based dark mode toggle.

## External Dependencies

**UI & Styling**: Radix UI, Tailwind CSS, `class-variance-authority`, `clsx`, Recharts.

**Frontend Infrastructure**: React, React DOM, Wouter, TanStack Query v5, React Hook Form, Zod.

**Backend Infrastructure**: Express.js, Drizzle ORM, Neon, `connect-pg-simple`.

**Development Tools**: Vite, TypeScript, ESBuild, Replit plugins.

**Utilities**: `date-fns`, `nanoid`, `embla-carousel`.

**Current Integration Status**: Finnhub API for live stock prices and search; React Query for data fetching with caching. Database configured, but strategy persistence and user authentication are not yet fully implemented. Options pricing and Greeks calculations are fully client-side.

## Recent Updates

### Auto-select Expiration Date
ExpirationTimeline now automatically selects the expiration date when:
- No expiration is currently selected
- Only one expiration date is available
- Current selection is invalid for the new symbol

### Clickable Option Legs with Cost Basis Editor
Option legs in the "Option Legs" section are now clickable. Clicking opens a Cost Basis Editor popover that allows:
- Manual premium editing with Save button
- Reset to market price functionality
- Displays premium source indicator (Market/Manual/Theo)

### Dynamic IV Updates
The Implied Volatility bar now updates in real-time:
- Recalculates when options are added/removed
- Updates when dragging strikes on the Strike Ladder
- IV data is passed with leg updates for accurate recalculation

### Streamlined UI
- **Removed Option Legs sidebar**: All option information is accessible by clicking the strike badge on the Strike Ladder, which opens the OptionDetailsPanel with Greeks, premium, and cost basis editing.
- **Removed Options Chain table**: Options are added exclusively via the blue Add button in the Strike Ladder header. The main tabs now show only Heatmap and P/L Chart.
- **Default symbol changed to AAPL**: The app now launches with AAPL as the default underlying symbol instead of SPY, with the correct live price fetched on initial load.
- **Compact UI layout**: Reduced padding and spacing throughout the Builder page to make the heatmap visible without scrolling. The main content area now uses a 3:1 grid ratio (heatmap takes 3/4 width). ExpirationTimeline, StrikeLadder, and SymbolSearchBar have been compacted with smaller text and reduced padding while maintaining usability.

### Live Price Updates
- **Auto-refresh**: Stock quotes refresh every 60 seconds, options chain data refreshes every 30 seconds
- **Automatic premium updates**: Option leg premiums auto-update when market data refreshes (except for manually edited prices)
- **Initial price fetch**: AAPL price is fetched on app launch, with a sensible fallback if the API is unavailable

### Slimmer Strike Ladder
- **Reduced height**: Strike ladder is now h-16 (was h-28) for a more compact appearance
- **Strike numbers at bottom**: Actual market strikes displayed in a separate row at bottom
- **Market-aware increments**: Auto-detects strike increment from market data (e.g., 2.5, 5, 10)
- **Snaps to available strikes only**: Dragging badges snaps exclusively to valid market strikes
- **Darker background**: Uses bg-muted/40 for better visual contrast
- **Badge positioning**: Long legs stack above center line, short legs stack below center line

### Compact Heatmap Layout
- **Tab buttons at top**: Small Heatmap/P/L Chart toggle buttons (h-6) at top right of card, replacing Profit/Loss legend
- **Removed all titles/descriptions**: Only Range badge and tab buttons remain in header
- **Compact sliders at bottom**: Range and IV sliders in single horizontal row below the heatmap table
- **Fixed height (no vertical scroll)**: Heatmap displays at full natural height with horizontal scroll only
- **Readable text**: 12px (text-xs) for table content, 11px for time labels, 10px for sublabels

### Compact Header
- **Reduced height**: Header now h-10 (was h-16)
- **Smaller elements**: h-7 buttons, h-3/h-4 icons, smaller text sizes
- **Tighter spacing**: gap-1 between right buttons, gap-4 for logo section