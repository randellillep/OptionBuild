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