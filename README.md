# GreenNest — Indoor Plant Shop

A full e-commerce website for GreenNest, built with **Node.js + Express + PostgreSQL (Neon)**, hosted on **Vercel**.

Live site: **https://greennest-shop.vercel.app**
The landing page matches the original design; every other page uses the same colours, fonts, cards and buttons.

## Features

**Storefront**
- Home page (products, testimonials and blog posts loaded from the database)
- Shop with search, category / price / stock filters, sorting and pagination
- Product pages with care info, stock status, reviews and related plants
- Cart with quantity editing, coupon codes, free-shipping progress and checkout
- Cash-on-delivery orders saved to the database, with stock reduced safely inside a transaction
- Customer accounts: register, sign in, order history and tracking, cancel pending orders, profile and password
- About, Plant Care, Blog (categories and search), Contact form, Privacy, Terms, Shipping and Returns, FAQ, 404 page
- Newsletter sign-up
- Fully responsive (desktop, tablet, mobile)

**Admin panel** (`/admin`)
- Dashboard: revenue, orders, customers, 7-day sales chart, low-stock alerts
- Products: create, edit and delete, with image upload, categories, featured flag and stock
- Orders: filter, search and update status (cancelling returns the items to stock)
- Blog posts: create, edit and delete, with cover image upload
- Contact messages, newsletter subscribers (CSV export) and customers

**Security:** bcrypt password hashing, sessions stored in PostgreSQL, CSRF protection on every form, rate-limited sign-in and forms, Helmet security headers, parameterised SQL queries and image-only upload checks.

## Setup (local development)

Requirements: **Node.js 18+**. The database is the same Neon PostgreSQL that the live site uses, so there's nothing to install.

1. **Install packages**
   ```bash
   npm install
   ```
2. **Get the database connection string** from Vercel (creates `.env.local`):
   ```bash
   npx vercel env pull .env.local
   ```
3. **Create tables and starter content** (safe to re-run; only seeds empty tables):
   ```bash
   npm run db:setup
   ```
4. **Start the site**
   ```bash
   npm start          # or: npm run dev   (restarts automatically when files change)
   ```
   Open **http://localhost:4000**.

> Local development uses the **same database as the live site**. For a separate test database, create a Neon branch and put its URL in `.env.local`.

### Logins
- **Admin:** `admin@greennest.com`. The password was set during deployment; it isn't stored in this repo.
- **Customers:** register at `/register`.

### Coupon codes (seeded)
- `SPRING25`: 25% off (matches the spring sale banner)
- `WELCOME10`: 10% off

Manage codes in the `coupons` table (Neon dashboard → SQL Editor).

### Useful commands
| Command | What it does |
|---|---|
| `npm run db:setup` | Creates the tables if missing and seeds empty tables |
| `npm run db:reset` | **Deletes all GreenNest tables** and rebuilds them with starter content |

## Deployment (Vercel + Neon)

- **Live site:** https://greennest-shop.vercel.app
- **Vercel project:** `greennest` (team heyjestys-projects), connected to this GitHub repo. Every push to `main` deploys automatically.
- **Database:** Neon PostgreSQL, added through the Vercel Marketplace. `DATABASE_URL` and related variables are injected automatically.
- **Other env vars:** `SESSION_SECRET` (set in Vercel → Settings → Environment Variables).
- Images uploaded in the admin panel are stored in the database (`media` table), because Vercel's file system is read-only.

Manual deploy: `npx vercel deploy --prod`

## Project structure

```
server.js            App entry: security, sessions, routes, error pages
config/db.js         PostgreSQL pool and query helpers
database/            schema.sql + setup.js (create and seed)
lib/                 cart, product queries, formatting helpers
middleware/          auth (login/admin guards), CSRF
routes/              site, shop, cart/checkout, blog, auth, account, admin
views/pages/         storefront pages (EJS)
views/admin/         admin panel pages
views/partials/      header, footer, product and post cards, hero, etc.
public/              css, js, images, icons
api/index.js         Vercel serverless entry point
```

## Before going live
- Replace the placeholder phone number and address on the Contact page (`views/pages/contact.ejs`).
- Have the Privacy, Terms and Shipping pages reviewed for your business and region.
- Only cash on delivery is enabled. Online card payment needs a payment provider such as Stripe or Razorpay.
