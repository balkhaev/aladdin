# Coffee Trading Platform

Advanced cryptocurrency trading platform with real-time analytics, built with Next.js 15 and React 19.

## Features

- 🎨 **Dark Theme UI** - Modern TradingView-style interface
- 📊 **Market Dashboard** - Real-time market overview with key metrics
- 💹 **Trading Analytics** - Technical, on-chain, and sentiment analysis
- 🤖 **Automation** - ML models, signals, and backtesting
- 📱 **Responsive Design** - Works on desktop and mobile
- ⚡ **High Performance** - Built with Next.js 15 and Turbopack

## Tech Stack

- **Framework**: Next.js 15.5.4 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4
- **Components**: Radix UI
- **Icons**: Lucide React
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **Animations**: tw-animate-css

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Build

```bash
# Create production build
npm run build

# Start production server
npm start
```

## Project Structure

```
apps/web/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with sidebar
│   ├── page.tsx           # Dashboard page
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # Reusable UI components
│   ├── app-sidebar.tsx    # Main navigation sidebar
│   └── dashboard/         # Dashboard-specific components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions
└── public/                # Static assets
```

## Features Overview

### Dashboard
- Market statistics (cap, volume, dominance)
- Top gainers and losers
- Market sentiment analysis
- Recent activity feed

### Navigation
- **Markets**: Spot trading, futures
- **Portfolio**: Holdings management
- **Analytics**: Technical, on-chain, sentiment
- **Automation**: ML models, signals, backtesting
- **Screener**: Market screening tools
- **Risk Management**: Risk analysis tools

## UI Components

The application uses a comprehensive set of UI components:
- Cards, Buttons, Inputs
- Tables, Tabs, Dialogs
- Dropdowns, Popovers, Tooltips
- Charts, Badges, Skeletons
- Collapsible sidebar with icon mode

## Development

### Adding New Pages

Create a new file in the `app/` directory:

```tsx
// app/markets/page.tsx
export default function MarketsPage() {
  return <div>Markets Page</div>
}
```

### Creating Components

```tsx
// components/my-component.tsx
export function MyComponent() {
  return <div>My Component</div>
}
```

## License

Private project - All rights reserved
