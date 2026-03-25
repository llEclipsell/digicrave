# DigiCrave — Local Setup Guide (No Docker)

## Prerequisites

| Tool     | Min Version | Check              |
|----------|-------------|--------------------|
| Node.js  | 18.x        | `node -v`          |
| npm      | 9.x         | `npm -v`           |

FastAPI backend must be running at `http://localhost:8000` before starting Next.js.

---

## Phase 1 — Project Init

### 1. Create the Next.js app

```bash
npx create-next-app@latest digicrave \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
cd digicrave
```

Answer **No** to Turbopack when asked.

### 2. Install all dependencies

```bash
npm install zustand \
  @tanstack/react-query @tanstack/react-query-devtools \
  axios \
  react-hook-form zod @hookform/resolvers \
  recharts \
  date-fns \
  clsx tailwind-merge class-variance-authority \
  lucide-react \
  tailwindcss-animate
```

### 3. Initialise Shadcn UI

```bash
npx shadcn@latest init
# Style: Default | Color: Slate | CSS variables: Yes
```

### 4. Add Shadcn components

```bash
npx shadcn@latest add \
  button card badge sheet dialog \
  input label textarea select \
  separator scroll-area tabs \
  sonner progress \
  dropdown-menu avatar \
  skeleton alert \
  checkbox tooltip
```

### 5. Copy source files

Replace `src/` with the provided files, plus copy `tailwind.config.ts`, `next.config.ts`, `tsconfig.json` to project root.

### 6. Configure environment

```bash
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_API_URL, NEXT_PUBLIC_RAZORPAY_KEY_ID, etc.
```

### 7. Add Razorpay script to layout.tsx

```tsx
// Inside src/app/layout.tsx <body>
import Script from "next/script";
<Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
```

### 8. Run

```bash
npm run dev
# → http://localhost:3000  (redirects to /menu)
```

---

## Route Map

| URL                             | User          | Description                    |
|---------------------------------|---------------|--------------------------------|
| `/menu?table=T-05&rid=rest_001` | Customer      | QR menu + cart                 |
| `/cart`                         | Customer      | Checkout (Razorpay / Counter)  |
| `/order-status?id=ORD-0042`     | Customer      | Live order tracker             |
| `/staff/kds`                    | Kitchen       | Real-time KDS board            |
| `/staff/pos`                    | Cashier       | POS grid + table view          |
| `/admin`                        | Owner         | Analytics + WhatsApp wallet    |

---

## Pricing Engine (Blueprint Rules 1 & 2)

```
Digital Price  = Offline Price × (1 − discount%)
GST            = Subtotal × 5%
Platform Fee   = ₹3 flat        (Blueprint Rule 2 — Razorpay Route)
Gateway Fee    = Subtotal × 2%
Total          = Subtotal + GST + ₹3 + Gateway Fee
Rule 1 check:  Total < Offline Total   (validated before checkout renders)
```

## Common Errors

| Error | Fix |
|-------|-----|
| `Module not found: @/components/ui/xxx` | `npx shadcn@latest add xxx` |
| CORS from FastAPI | Add `http://localhost:3000` to FastAPI `CORSMiddleware` |
| `window.Razorpay is not a constructor` | Add `strategy="lazyOnload"` to the Script tag |
| `tailwindcss-animate not found` | `npm install tailwindcss-animate` |

## Next Steps After This PR

1. **UrbanPiper** — wire aggregator webhook → `aggregator.order_received` WS event → KDS SLA timer
2. **Staff Auth** — Next.js middleware protecting `/staff/*` and `/admin`
3. **ESC/POS Printing** — thermal receipt via `escpos` npm package
4. **PWA** — `next-pwa` for offline menu caching on mobile
