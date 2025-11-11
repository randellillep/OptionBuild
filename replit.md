# OptionFlow - Options Strategy Builder

## Overview

OptionFlow is a professional options trading strategy builder and analysis platform inspired by OptionStrat.com. It allows users to construct, visualize, and analyze options strategies with real-time profit/loss charts, Greeks calculations, and comprehensive risk metrics. The application features 10+ pre-built strategy templates (spreads, straddles, condors, butterflies), interactive volatility controls, and 6-tab analysis section. Uses the Black-Scholes model for accurate option pricing with time decay.

The platform targets traders who need to understand complex options positions through visual analysis, P/L scenarios across time and price, and risk exposure metrics before executing trades.

## Recent Updates (November 11, 2025)

- **OptionStrat-Style Navigation**: Added Build (with strategy dropdown), Optimize, and Market Trends buttons in header
- **Quick Add Functionality**: Implemented Add button dropdown for rapidly adding option legs (Buy Call, Buy Put, Sell Call, Sell Put)
- **Interactive Controls**: Added Range (±5-50%) and Implied Volatility (10-100%) sliders that dynamically update calculations
- **Analysis Tabs**: Created 6-tab section below heatmap (Greeks, Expected Move, Volatility Skew, Option Overview, Analysis, Open Interest)
- **Dynamic Volatility**: Connected IV slider to Black-Scholes pricing engine for real-time heatmap updates
- **Time Decay Visualization**: Fixed P/L heatmap to properly show option value changes across different dates using calculateProfitLossAtDate

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18+ with TypeScript in strict mode

**Routing**: Wouter for lightweight client-side routing (Home page and Builder page)

**State Management**: 
- React hooks for local component state
- Custom `useStrategyEngine` hook centralizes strategy calculations and state
- TanStack Query (React Query) for server state management

**UI Framework**: 
- Shadcn UI component library with Radix UI primitives
- Tailwind CSS for styling with custom design system
- Custom theme with light/dark mode support stored in localStorage
- Design follows "Modern Data Application Pattern" combining fintech aesthetics with trading platform patterns

**Component Strategy**:
- Presentational components in `/client/src/components/` (FeatureCard, GreeksDashboard, ProfitLossChart, etc.)
- Page components in `/client/src/pages/` (Home, Builder, NotFound)
- Reusable UI primitives in `/client/src/components/ui/`

**Data Visualization**:
- Recharts library for interactive P/L charts and visualizations
- Custom components for heatmaps, strike ladders, and expiration timelines

**Key Design Patterns**:
- Composition over inheritance for UI components
- Controlled components for form inputs
- Custom hooks for business logic separation
- TypeScript strict mode for type safety

### Backend Architecture

**Server Framework**: Express.js with TypeScript

**Development Setup**:
- Vite for development server with HMR (Hot Module Replacement)
- Custom middleware mode integrating Vite with Express
- TSX for running TypeScript in development

**API Structure**:
- RESTful API prefix convention (`/api/*`)
- Route registration through `registerRoutes` function
- Request/response logging middleware with JSON response capture
- Session support via connect-pg-simple (configured for PostgreSQL sessions)

**Storage Layer**:
- Abstracted storage interface (`IStorage`) for CRUD operations
- In-memory implementation (`MemStorage`) as default
- Designed for future database integration via storage interface pattern

**Build Process**:
- Client: Vite builds to `dist/public`
- Server: esbuild bundles to `dist/index.js` (ESM format, Node platform)
- Production serves static client files from Express

**Key Design Decisions**:
- Monorepo structure with shared types between client/server
- Middleware pattern for cross-cutting concerns (logging, body parsing)
- Separation of concerns: routes, storage, and server initialization

### Data Architecture

**Schema Design** (`shared/schema.ts`):
- PostgreSQL-ready schema using Drizzle ORM
- User authentication structure (users table with username/password)
- Options strategy types defined in TypeScript (not persisted to DB yet):
  - `OptionLeg`: Individual option positions with type, strike, premium, expiration
  - `Strategy`: Collection of legs with underlying price
  - `Greeks`: Delta, gamma, theta, vega, rho calculations
  - `StrategyMetrics`: Max profit/loss, breakeven points, risk/reward ratios

**Database Strategy**:
- Drizzle ORM with Neon serverless PostgreSQL driver
- Schema-first approach with Zod validation via drizzle-zod
- Migrations stored in `/migrations` directory
- Connection via DATABASE_URL environment variable

**Pricing Engine** (`lib/options-pricing.ts`):
- Black-Scholes model implementation for calls and puts
- Greeks calculations (delta, gamma, theta, vega, rho)
- Strategy-level metrics computation (max profit, max loss, breakeven)
- Cumulative normal distribution for option pricing
- Support for profit/loss at different time periods and price points

**Key Design Decisions**:
- Options calculations performed client-side for real-time responsiveness
- Strategy data currently client-side only (not persisted)
- Database schema prepared for future user strategy persistence
- Type safety enforced through shared schema definitions

### Design System

**Typography**:
- Primary: Inter (UI/data)
- Monospace: JetBrains Mono (numbers/prices)
- Loaded via Google Fonts

**Color System**:
- CSS variables for theming (`--background`, `--foreground`, `--primary`, etc.)
- HSL color space for alpha channel support
- Separate color definitions for card, popover, and sidebar contexts
- Automatic border color computation for buttons

**Spacing & Layout**:
- Tailwind spacing scale (2, 4, 6, 8, 12, 16)
- Max-width container: 7xl (80rem)
- Responsive grid systems for strategy cards and metrics
- Mobile-first responsive design

**Component Styling Patterns**:
- Hover/active states via elevation utilities (`hover-elevate`, `active-elevate-2`)
- Shadow system for depth (shadow-xs, shadow-sm, shadow-md, shadow-lg)
- Consistent border radius (lg: 9px, md: 6px, sm: 3px)
- Dark mode via class-based toggle

## External Dependencies

**UI & Styling**:
- Radix UI primitives (20+ component packages) for accessible UI components
- Tailwind CSS for utility-first styling
- class-variance-authority & clsx for conditional className composition
- Recharts for data visualization

**Frontend Infrastructure**:
- React 18+ with React DOM
- Wouter for routing
- TanStack Query v5 for server state
- React Hook Form with Zod resolvers for form validation

**Backend Infrastructure**:
- Express.js for HTTP server
- Drizzle ORM for database access
- Neon serverless driver for PostgreSQL connections
- connect-pg-simple for PostgreSQL session storage

**Development Tools**:
- Vite for build tooling and dev server
- TypeScript 5+ for type safety
- ESBuild for server bundling
- Replit plugins (runtime error modal, cartographer, dev banner)

**Utilities**:
- date-fns for date manipulation
- nanoid for ID generation
- embla-carousel for carousel functionality

**Current Integration Status**:
- Database configured but strategy persistence not implemented
- User authentication schema present but auth routes not implemented
- Options pricing and Greeks calculations fully client-side
- No external market data APIs currently integrated