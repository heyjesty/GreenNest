# GreenNest — Indoor Plant Shop

A full e-commerce website for GreenNest, built with **Node.js + Express + MySQL**.
The landing page matches the original design; every other page uses the same colours, fonts, cards and buttons.

## Features

**Storefront**
- Home page (products, testimonials and blog posts loaded from the database)
- Shop with search, category / price / stock filters, sorting and pagination
- Product pages with care info, stock status, reviews and related plants
- Cart with quantity editing, coupon codes, free-shipping progress and checkout
- Cash-on-delivery orders saved to MySQL, with stock reduced safely inside a transaction
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

**Security:** bcrypt password hashing, sessions stored in MySQL, CSRF protection on every form, rate-limited sign-in and forms, Helmet security headers, parameterised SQL queries and image-only upload checks.

## Setup

Requirements: **Node.js 18+** and **MySQL 8** (both already installed on this PC).

1. **Install packages**
   ```bash
   npm install
   ```
2. **Configure the database.** Open `.env` and set your MySQL login:
   ```ini
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your-mysql-password
   ```
   Also change `ADMIN_EMAIL` and `ADMIN_PASSWORD` to the admin login you want.
3. **Create the database, tables and starter content**
   ```bash
   npm run db:setup
   ```
4. **Start the site**
   ```bash
   npm start          # or: npm run dev   (restarts automatically when files change)
   ```
   Open **http://localhost:4000** (port 3000 is used by another project on this PC).

### Logins
- **Admin:** the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (default `admin@greennest.com` / `Admin@12345`). **Change this before going live.**
- **Customers:** register at `/register`.

### Coupon codes (seeded)
- `SPRING25`: 25% off (matches the spring sale banner)
- `WELCOME10`: 10% off

Manage codes in the `coupons` table.

### Useful commands
| Command | What it does |
|---|---|
| `npm run db:setup` | Creates the database and tables if missing, and seeds empty tables |
| `npm run db:reset` | **Deletes** the database and rebuilds it with starter content |

## Project structure

```
server.js            App entry: security, sessions, routes, error pages
config/db.js         MySQL connection pool and helpers
database/            schema.sql + setup.js (create and seed)
lib/                 cart, product queries, formatting helpers
middleware/          auth (login/admin guards), CSRF
routes/              site, shop, cart/checkout, blog, auth, account, admin
views/pages/         storefront pages (EJS)
views/admin/         admin panel pages
views/partials/      header, footer, product and post cards, hero, etc.
public/              css, js, images, icons; uploads/ holds admin-uploaded images
```

## Before going live
- Replace the placeholder phone number and address on the Contact page (`views/pages/contact.ejs`).
- Have the Privacy, Terms and Shipping pages reviewed for your business and region.
- Set `NODE_ENV=production`, use a strong `SESSION_SECRET`, and serve the site over HTTPS.
- Only cash on delivery is enabled. Online card payment needs a payment provider such as Stripe or Razorpay.
