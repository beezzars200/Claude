# Ticket Sales Blueprint (Stripe Connect)

A plan for adding public ticket sales to the existing UMN ticket system.
Nothing here is built yet — this is the map for when you're ready.

## Guiding principle

Reuse everything already built. The tickets table, unique UUID + QR codes,
the `/verify` endpoint, and the scanner all stay exactly as they are. We are
only adding a **public storefront** in front of the existing engine, plus a
**payment step** and **automatic ticket issuing**.

---

## Money model

- **Stripe Connect (Standard accounts)** — each club connects their own Stripe
  account. Money goes **directly to the club**. Unity never holds anyone's funds
  (keeps us out of financial-regulation territory).
- **Unity takes a booking fee per ticket** (an "application fee" in Stripe),
  collected automatically. This is Unity's revenue stream.
- **The customer pays the fees** via a visible booking fee added at checkout
  (the Eventbrite model). Club receives full face value.

### Worked example — €50 ticket
```
Buyer pays        €51.50
  → Club receives €50.00   (full face value)
  → Stripe takes  ~€1.00   (1.5% + €0.25, EU card)
  → Unity keeps   ~€0.50   (platform booking fee)
```

### Costs
- Stripe Connect setup / monthly: **€0** (Standard accounts)
- Per sale: **~1.5% + €0.25** (EU cards) — borne by the buyer via booking fee
- Express accounts (~€2/active club/month) — NOT needed to start
- Transactional email provider — free tier likely enough (e.g. Resend 3k/mo)
- Railway hosting — marginal, already running
- Verify current rates: stripe.com/ie/pricing

---

## Important architecture note: PDF generation must move server-side

Today, ticket PDFs are generated in the **Electron desktop app** (on your Mac).
For online sales, the **server** must generate and email tickets automatically
the moment a payment succeeds — your Mac won't be in the loop. So the pdfkit
ticket-drawing logic (currently in `electron-admin/main.js`) needs a
server-side twin in `web-scanner`. The Electron app keeps its version for the
manual/CSV flow; the server gets one for the sales flow. Same layout code,
two homes.

---

## Database changes

**organisations** — add:
- `stripe_account_id VARCHAR(255)` — the club's connected Stripe account
- `booking_fee_cents INT DEFAULT 150` — Unity's fee per ticket (optional per-org override)

**events** — add:
- `price_cents INT` — ticket price (null = not for sale)
- `capacity INT` — how many tickets released for public sale
- `sales_open TINYINT(1) DEFAULT 0` — the "release tickets" switch
- `sales_start DATETIME NULL`, `sales_end DATETIME NULL` — optional sales window

**orders** — new table:
- `id`, `event_id`, `buyer_name`, `buyer_email`, `buyer_phone`
- `quantity INT`, `amount_cents INT`
- `status ENUM('pending','paid','failed','refunded') DEFAULT 'pending'`
- `stripe_session_id`, `stripe_payment_intent`
- `created_at`

**tickets** — add:
- `order_id INT NULL` — links a sold ticket back to its order
  (imported/CSV tickets leave this null). Tickets are only created **after**
  payment succeeds.

---

## New public routes (web-scanner)

- `GET  /buy/:eventSlug` — public storefront: name, date, price, tickets
  remaining, quantity picker. Respects `sales_open` and the sales window.
- `POST /buy/:eventSlug/checkout` — create a **pending** order, create a Stripe
  Checkout Session (with `application_fee_amount` = Unity fee, funds routed to
  the club's `stripe_account_id`), return the redirect URL.
- `POST /webhooks/stripe` — verify Stripe signature; on
  `checkout.session.completed`: mark order `paid`, generate the unique tickets,
  email the PDF(s) to the buyer. **This webhook is what makes it automatic.**
- `GET  /buy/success` and `GET /buy/cancel` — buyer return pages.

Stock control: decrement available capacity against paid + pending-not-expired
orders so two buyers can't oversell the last seats. Expire stale pending orders.

---

## Admin additions (manage / Electron)

- **Event form**: price, capacity for sale, "Release tickets" toggle, optional
  sales window.
- **Organisation**: "Connect Stripe" button → Stripe hosted onboarding →
  store `stripe_account_id`; show connection status.
- **Orders view**: list of sales per event with status; refund button
  (calls Stripe refund + marks tickets void).

---

## Email

Need a transactional email provider to send the ticket PDFs:
- Options: Resend, Postmark, SendGrid (free tiers exist)
- Sends: order confirmation + attached ticket PDF(s)

---

## GDPR / legal (do before going live)

- **Card data**: never stored by us — Stripe handles it entirely. Big risk removed.
- **We store**: buyer name, email, phone → needs a **privacy notice**, a
  **retention policy**, and a way to **delete on request**.
- **Roles**: the **club is the data controller**, **Unity is the data
  processor** → put a short **data-processing agreement** in place per club.
- Add a privacy policy page + consent checkbox at checkout.

---

## Phasing

**Phase 1 — prove the flow (one club, one event)**
- Server-side PDF + email
- Stripe Checkout + webhook → auto-issue + email
- Money to a single Stripe account (no Connect yet)

**Phase 2 — multi-club with Connect**
- Stripe Connect Standard onboarding per club
- Funds to each club directly, Unity booking fee via application fee
- Orders/refunds admin view

**Phase 3 — polish**
- Sold-out / low-stock states, discount codes, waitlist
- Sales windows, per-org booking-fee overrides
- Sales reporting per club (revenue, fees, payout status)

---

## What stays exactly the same

- The tickets table, UUID + QR generation, `/verify`, and the door scanner.
- The CSV/manual import + Electron PDF flow (for clubs who sell tickets their
  own way and just want scanning). Online sales is an **additional** path, not
  a replacement — which fits the original goal of bridging low-funded clubs and
  expensive ticketing systems.
