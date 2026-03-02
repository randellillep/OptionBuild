# OptionBuild - Options Strategy Builder

## Overview

OptionBuild is a professional options trading strategy builder and analysis platform inspired by OptionStrat.com. It enables users to construct, visualize, and analyze options strategies with real-time profit/loss charts, Greeks calculations, and comprehensive risk metrics. The platform features over 10 pre-built strategy templates, interactive volatility controls, and a 6-tab analysis section. It utilizes the Black-Scholes model for accurate option pricing with time decay. OptionBuild aims to provide visual analysis, P/L scenarios across time and price, and risk exposure metrics to help traders understand complex options positions before execution.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18+ with TypeScript (strict mode)
**Routing**: Wouter
**State Management**: React hooks for local state, TanStack Query for server state, custom `useStrategyEngine` hook.
**UI Framework**: Shadcn UI with Radix UI primitives, Tailwind CSS for styling. Custom theme with light/dark mode, following a "Modern Data Application Pattern".
**Data Visualization**: Recharts for interactive P/L charts; custom components for heatmaps, strike ladders, and expiration timelines.
**Key Design Patterns**: Composition over inheritance, controlled components, custom hooks for business logic separation, and TypeScript strict mode.

### Backend Architecture

**Server Framework**: Express.js with TypeScript
**API Structure**: RESTful API (`/api/*`) with route registration, logging middleware, and session support.
**Market Data Integration**: Finnhub API for real-time US stock quotes and financial data.
**Storage Layer**: `IStorage` interface with `DatabaseStorage` implementation using Drizzle ORM and PostgreSQL.
**Authentication**: Replit Auth integration with OpenID Connect (Google sign-in supported). Sessions stored in PostgreSQL.
**Build Process**: Vite for client, esbuild for server.
**Key Design Decisions**: Monorepo structure, middleware pattern, separation of concerns.

### Data Architecture

**Schema Design**: PostgreSQL-ready schema using Drizzle ORM and TypeScript (shared types for `OptionLeg`, `Strategy`, `Greeks`, `StrategyMetrics`).
**Database Strategy**: Drizzle ORM with Neon serverless PostgreSQL driver, schema-first approach with Zod validation.
**Pricing Engine**: Black-Scholes model for option pricing and Greeks calculations (delta, gamma, theta, vega, rho). Computes strategy-level metrics.
**Key Design Decisions**: Client-side options calculations for real-time responsiveness, type safety via shared schema definitions.

### Design System

**Typography**: Inter (UI/data) and JetBrains Mono (numbers/prices).
**Color System**: CSS variables for theming in HSL, with specific definitions for trading contexts (profit/loss).
**Spacing & Layout**: Tailwind spacing scale, `max-width` container, responsive grid systems, mobile-first design.
**Component Styling Patterns**: Consistent hover/active states, shadow system, border radius, and class-based dark mode toggle.

## External Dependencies

**UI & Styling**: Radix UI, Tailwind CSS, `class-variance-authority`, `clsx`, Recharts.
**Frontend Infrastructure**: React, React DOM, Wouter, TanStack Query v5, React Hook Form, Zod.
**Backend Infrastructure**: Express.js, Drizzle ORM, Neon, `connect-pg-simple`.
**Development Tools**: Vite, TypeScript, ESBuild.
**Utilities**: `date-fns`, `nanoid`, `embla-carousel`.
**Integrations**: Finnhub API (live stock prices, search, historical data, fundamentals), PostgreSQL (user authentication, session storage), Replit Auth (Google sign-in), Alpaca Trading API (market data + trade execution).

## Brokerage Integration

**Architecture**: Per-user brokerage API credentials stored in `brokerage_connections` table. Server proxies all trading requests using user's credentials (never exposed to frontend).
**Supported Brokers**: Alpaca (paper + live trading), tastytrade (sandbox + live trading). Extensible to other brokers via `broker` field.
**API Routes**: `/api/brokerage/*` — connect, disconnect, status, account info, order submission, order history, order cancellation, positions. All routes branch on `conn.broker` to proxy to the correct broker API.
**Frontend Components**: `ExecuteTradeModal` (order preview + submission), `TradeTab` (connection management with broker selector, account info, order history in AnalysisTabs).
**OCC Symbol Generation**: Alpaca uses unpadded root (e.g., `AAPL260320C00265000`); tastytrade uses space-padded 6-char root (e.g., `AAPL  260320C00265000`).
**tastytrade Auth**: Session-based (username/password → session token via `/sessions` endpoint). Credentials stored as username in `apiKey`, password in `apiSecret`. Fresh session token obtained on each API call.
**Security**: API keys/passwords stored server-side only; frontend only sees last 4 chars of username/key. Credentials verified against broker API on connect.

## Blog System

**Schema**: `blog_posts` (id UUID, title, slug unique, excerpt, content HTML, coverImage, published 0/1, publishedAt, authorId, createdAt) and `blog_images` (id UUID, authorId, filename, mimeType, data base64, createdAt).
**API Routes**: Public `GET /api/blog/posts` (published only, no content), `GET /api/blog/posts/:slug` (full post). Admin `GET/POST /api/admin/blog/posts`, `GET/PUT/DELETE /api/admin/blog/posts/:id`, `POST /api/admin/blog/upload` (image upload, restricted to jpeg/png/gif/webp, max 5MB). Images served via `GET /api/blog/images/:id` with caching.
**Admin Access**: Email-based allowlist via `ADMIN_EMAILS` env var (comma-separated), defaults to owner email. Admin check via `GET /api/admin/check`.
**Frontend Pages**: `/blog` (listing grid with cards), `/blog/:slug` (full article with styled HTML content), `/admin/blog` (post list + editor with preview, image upload, publish toggle).
**Navigation**: Blog links in Builder toolbar, Footer, and Home page footer all point to `/blog`.

## Backtesting Engine (tastytrade-aligned)

**Key Design Decisions**:
- Expiration dates: enumerate all Fridays within ±14 days of target date (entry + DTE), adjust for US market holidays, pick Friday whose actual DTE is closest to target. Ties break to earlier (lower DTE). Achieves ~78% match rate vs tastytrade reference data; remaining mismatches are due to tastytrade using actual listed option expiration calendars.
- No duplicate trade avoidance: a new trade is opened every trading day (matching tastytrade's daily entry approach)
- Strike prices use realistic increments ($0.50 for <$25, $1 for <$50, $2.50 for <$200, $5 for $200+) and round to **nearest** increment (Math.round, not floor/ceil)
- Volatility estimation uses blended vol (70% simple HV + 30% EWMA) with 50% mean-reversion to 25% long-term IV, 1.15x VRP multiplier, capped 15%–45%
- Buying power uses tastytrade-style BPR: max(20% underlying - OTM amount + premium, 10% strike + premium)
- Default fee per contract: $0 (matching tastytrade's no-fee display preference)
- Open P/L calculated per-trade individually (not averaged across positions)
- Capital tracking: max concurrent BPR sum represents "used capital"
- Drawdown: dollar-based from peak, expressed as percentage of total used capital (max concurrent BPR sum)
- Close reason distinguishes "expired" (OTM at expiration) from "exercised" (ITM at expiration)
- Trade data includes `underlyingPriceAtOpen` and `underlyingPriceAtClose` for reference
- Trade log UI matches tastytrade's table format: #, Opened, Closed, Premium, Buying Power, Profit/Loss, Close Reason, ROI
- Transaction log matches tastytrade format: single "exercised" row with intrinsic value (strike - price for puts, price - strike for calls) for exercised trades; no row for expired trades; sell to open for entries
- Trade entry cutoff uses last available price data date (not config.endDate) to determine if a trade's expiration is trackable