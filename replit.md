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
**Integrations**: Finnhub API (live stock prices, search, historical data, fundamentals), PostgreSQL (user authentication, session storage), Replit Auth (Google sign-in).

## Backtesting Engine (tastytrade-aligned)

**Key Design Decisions**:
- Expiration dates snap to Fridays (standard equity options expiration)
- Strike prices use realistic increments ($0.50 for <$25, $1 for <$50, $2.50 for <$200, $5 for $200+)
- Duplicate trade avoidance: skips entry if same strike/expiration combo already active
- Volatility estimation uses 30-day lookback with 1.15x VRP (Volatility Risk Premium) multiplier to approximate implied volatility
- Buying power uses tastytrade-style BPR: max(20% underlying - OTM amount + premium, 10% strike + premium)
- Open P/L calculated per-trade individually (not averaged across positions)
- Capital tracking: max concurrent BPR sum represents "used capital"
- Drawdown: dollar-based from peak, expressed as percentage of current total BPR