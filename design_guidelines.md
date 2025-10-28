# Options Pricing Platform - Design Guidelines

## Design Approach

**Selected Approach**: Hybrid - Modern Data Application Pattern
Combining clean, minimal fintech aesthetics (Stripe, Robinhood) with professional trading platform patterns (TradingView, Bloomberg Terminal) to create a trustworthy, data-rich interface optimized for rapid analysis and decision-making.

**Core Principles**:
- Data clarity over decoration
- Instant visual feedback for all interactions
- Professional credibility through restrained design
- Information density balanced with breathing room

---

## Typography System

**Font Families**:
- **Primary (UI/Data)**: Inter or Manrope via Google Fonts - excellent for numbers and data tables
- **Monospace (Numbers/Prices)**: JetBrains Mono for prices, Greeks, and calculations - ensures consistent alignment

**Type Scale**:
- **Hero/Page Titles**: text-4xl md:text-5xl font-bold (32px/48px)
- **Section Headings**: text-2xl md:text-3xl font-semibold (24px/30px)
- **Card Headers**: text-lg font-semibold (18px)
- **Body/Labels**: text-base (16px)
- **Data/Metrics**: text-sm md:text-base font-medium (14px/16px)
- **Captions/Footnotes**: text-xs (12px)
- **Large Metrics**: text-3xl md:text-4xl font-bold tabular-nums (30px/36px)

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16** for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: py-12 md:py-16 lg:py-20
- Card gaps: gap-4 to gap-6
- Grid gaps: gap-6 to gap-8

**Container Strategy**:
- Main container: max-w-7xl mx-auto px-4 md:px-6
- Chart containers: Full width within sections
- Data tables: Overflow-x-auto with horizontal scrolling on mobile
- Sidebar (if present): Fixed width w-64 lg:w-80

**Grid System**:
- Strategy cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Metrics dashboard: grid-cols-2 md:grid-cols-4 lg:grid-cols-5
- Two-column layout: grid-cols-1 lg:grid-cols-2 (chart + controls)

---

## Component Library

### Navigation
**Top Navigation Bar**:
- Sticky header with backdrop-blur effect
- Logo left, primary navigation center, user actions right
- Height: h-16
- Include: Strategy Builder, Calculator, Learn, Pricing tabs
- Mobile: Hamburger menu with slide-in drawer

### Hero Section
**Data-Focused Hero**:
- Height: min-h-[60vh] with centered content
- Large headline showcasing core value proposition
- Interactive demo/preview of profit/loss chart embedded directly in hero
- Two CTAs: "Build Strategy" (primary), "View Example" (secondary)
- Trust indicators below: "Real-time data • 50+ Strategies • Free to start"

### Core Application Components

**1. Interactive Chart Container**:
- Prominent placement: Takes 60-70% of viewport width on desktop
- Border with subtle shadow for depth
- Padding: p-6
- Chart fills container with responsive aspect ratio
- Axes clearly labeled with monospace font for prices
- Grid lines for easy reading
- Legend positioned top-right of chart
- Hover tooltips showing exact values at cursor position

**2. Strategy Control Panel**:
- Sidebar or bottom panel: 30-40% width on desktop, full width mobile
- Organized sections with clear dividers
- Strike price sliders with numerical inputs
- Expiration date picker with calendar icon
- Add/Remove legs buttons clearly visible
- Real-time P&L summary card at top (sticky on scroll)

**3. Greeks Dashboard**:
- Card-based layout: grid-cols-2 md:grid-cols-5
- Each Greek in its own card with icon
- Large number display (text-2xl) with label below
- Positive/negative indicators
- Tooltip explaining each Greek on hover

**4. Strategy Template Cards**:
- Card dimensions: Consistent height with hover elevation
- Each card contains:
  - Strategy name (text-lg font-semibold)
  - Mini P&L curve preview (small inline chart)
  - Key metrics: Max Profit, Max Loss, Breakeven
  - Risk level badge (Low/Medium/High)
  - "Build This Strategy" button
- Hover state: Slight lift with shadow increase

**5. Data Tables**:
- Clean, minimal borders
- Alternating row treatment for scannability
- Sticky headers on scroll
- Sortable columns with arrow indicators
- Monospace font for all numerical columns
- Right-aligned numbers, left-aligned text
- Compact row height: py-3

**6. Calculator Input Form**:
- Grouped input sections with labels
- Input fields: Consistent height h-10 to h-12
- Number inputs with increment/decrement steppers
- Dropdown selects for option type (Call/Put)
- Immediate validation and calculation on change
- Results displayed in prominent card to the right

**7. Metrics Summary Cards**:
- Dashboard-style grid of key metrics
- Each card: p-6 with border and subtle shadow
- Large metric value: text-3xl font-bold
- Label below: text-sm
- Change indicator with up/down arrow
- Compact on mobile: grid-cols-2, larger on desktop: grid-cols-4

### Forms & Inputs
**Standard Input Pattern**:
- Height: h-10 to h-12
- Padding: px-4
- Border with focus ring
- Label: text-sm font-medium mb-2
- Helper text: text-xs mt-1
- Error state with clear messaging

**Slider Controls**:
- Custom styled with prominent thumb
- Value display above slider
- Range labels at both ends
- Smooth dragging with snap-to-increment

### Buttons
**Primary Action**: 
- Large touch target: h-12 px-6
- Font: text-base font-semibold
- Full width on mobile, auto width on desktop

**Secondary Action**:
- Same size, different treatment
- Used for "Reset", "Clear", auxiliary actions

**Icon Buttons**:
- Consistent size: w-10 h-10
- Used for add/remove legs, close modals

### Cards
**Standard Card**:
- Border with subtle shadow
- Padding: p-4 to p-6
- Rounded corners: rounded-lg
- Hover state for interactive cards

**Pricing Cards** (for subscription tiers):
- Vertical layout with clear hierarchy
- Featured plan: Enhanced border and scale
- Price large and prominent: text-4xl
- Feature list with checkmarks
- CTA button at bottom

---

## Page-Specific Layouts

### Landing Page Structure

**Section 1 - Hero**:
- Min height: min-h-[70vh]
- Centered headline and subheadline
- Live interactive P&L chart preview embedded
- Two prominent CTAs
- Trust indicators below

**Section 2 - Key Features** (3-column grid):
- Grid: grid-cols-1 md:grid-cols-3 gap-8
- Each feature: Icon, heading, 2-3 line description
- Icon size: w-12 h-12 in bordered container

**Section 3 - Strategy Templates Showcase**:
- Carousel or grid showing popular strategies
- 6-8 template cards visible
- "View All Strategies" CTA

**Section 4 - Live Calculator Demo**:
- Two-column: Left shows inputs, right shows results
- Fully functional calculator embedded
- "Try it yourself" encouragement

**Section 5 - Analytics Dashboard Preview**:
- Full-width screenshot or interactive demo
- Greeks dashboard, P&L table, chart all visible
- Annotated callouts highlighting features

**Section 6 - Pricing**:
- 3 tiers: Free, Pro, Enterprise
- Side-by-side comparison: grid-cols-1 md:grid-cols-3
- Feature comparison table below

**Section 7 - Educational Resources**:
- 3-4 tutorial cards
- Links to strategy guides
- "Learn Options Trading" CTA

**Footer**:
- Multi-column: Company, Product, Resources, Legal
- Newsletter signup form
- Social links and app badges
- Disclaimer about financial risks

### Application Dashboard

**Layout Structure**:
- Optional side navigation (collapsible): w-64
- Main content area: flex-1
- Top toolbar with strategy selector and actions

**Main View - Strategy Builder**:
- Two-column desktop layout:
  - Left (60%): Interactive P&L chart
  - Right (40%): Controls and Greeks
- Single column mobile: Chart on top, controls below
- Sticky summary bar showing current position metrics

**Tabs/Sections within Builder**:
- "Build" - Main construction interface
- "Analyze" - Greeks and scenario analysis
- "Compare" - Side-by-side strategy comparison
- "History" - Saved strategies

---

## Icons

Use **Heroicons** via CDN for all interface icons:
- Chart icons for analytics
- Plus/minus for add/remove
- Cog for settings
- User circle for profile
- Arrow trending up/down for metrics
- Information circle for tooltips

---

## Interactions & States

**Chart Interactions**:
- Crosshair cursor on hover showing price/profit coordinates
- Zoom controls (+ / - buttons)
- Drag to pan when zoomed
- Reset view button

**Form Interactions**:
- Instant calculation on value change (debounced)
- Live validation with inline error messages
- Loading state for calculations

**Card Interactions**:
- Subtle hover elevation (shadow increase)
- Smooth transitions: transition-all duration-200
- Click feedback on interactive elements

**Loading States**:
- Skeleton screens for data tables
- Spinner for calculations
- Progress bars for multi-step processes

---

## Data Visualization Principles

**Chart Design**:
- Clean axes with minimal grid lines
- Clearly labeled with units
- Legend always visible
- Tooltips on hover for exact values
- Responsive sizing maintaining aspect ratio

**Color Coding Conventions**:
- Consistent visual language throughout
- Clear distinction between long and short positions
- Profit zones vs loss zones clearly differentiated
- Use opacity for expired vs active options

**Tables**:
- Sortable columns
- Pagination for large datasets
- Export to CSV option
- Sticky headers on scroll
- Compact row spacing for density

---

## Responsive Behavior

**Desktop (lg: 1024px+)**:
- Side-by-side layouts maximized
- All features visible
- Multi-column grids
- Expanded navigation

**Tablet (md: 768px)**:
- Some columns collapse to 2-column
- Charts remain full-width
- Navigation may condense

**Mobile (base < 768px)**:
- All stacks to single column
- Charts: Full width with horizontal scroll if needed
- Tables: Card-based view or horizontal scroll
- Bottom navigation for key actions
- Collapsible sections to manage content density

---

## Images

**Hero Section**: Large background image showing professional trader workspace or abstract financial data visualization. Image should convey professionalism and data-driven decision making. Overlay with semi-transparent gradient to ensure text readability.

**Feature Section Icons**: Custom illustrated icons for each key feature (calculator, chart, strategies, alerts) - simple, modern line-style illustrations.

**Tutorial Cards**: Screenshots of actual interface showing specific features in action.

**Trust Indicators**: Logos of data providers or certifications if applicable.