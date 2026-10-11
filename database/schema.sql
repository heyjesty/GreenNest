-- GreenNest database schema (PostgreSQL — Neon on Vercel)
-- Run through `npm run db:setup`.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(30),
  role          VARCHAR(20)  NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  slug VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(120)  NOT NULL,
  slug              VARCHAR(140)  NOT NULL UNIQUE,
  short_description VARCHAR(255)  NOT NULL DEFAULT '',
  description       TEXT,
  price             NUMERIC(10,2) NOT NULL,
  compare_price     NUMERIC(10,2),
  stock             INTEGER       NOT NULL DEFAULT 0,
  image             VARCHAR(255)  NOT NULL,
  light             VARCHAR(60)   NOT NULL DEFAULT 'Bright, indirect',
  water             VARCHAR(60)   NOT NULL DEFAULT 'Weekly',
  size              VARCHAR(60)   NOT NULL DEFAULT 'Medium',
  pet_friendly      SMALLINT      NOT NULL DEFAULT 0,
  is_featured       SMALLINT      NOT NULL DEFAULT 0,
  is_active         SMALLINT      NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (is_active, is_featured);

CREATE TABLE IF NOT EXISTS product_categories (
  product_id  INTEGER NOT NULL REFERENCES products(id)   ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    INTEGER  NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(40) NOT NULL UNIQUE,
  percent    SMALLINT    NOT NULL,
  is_active  SMALLINT    NOT NULL DEFAULT 1,
  expires_at DATE
);

CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  order_number   VARCHAR(20)   NOT NULL UNIQUE,
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name  VARCHAR(100)  NOT NULL,
  email          VARCHAR(190)  NOT NULL,
  phone          VARCHAR(30)   NOT NULL,
  address        VARCHAR(255)  NOT NULL,
  city           VARCHAR(100)  NOT NULL,
  state          VARCHAR(100)  NOT NULL,
  postal_code    VARCHAR(20)   NOT NULL,
  notes          VARCHAR(500),
  subtotal       NUMERIC(10,2) NOT NULL,
  discount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total          NUMERIC(10,2) NOT NULL,
  coupon_code    VARCHAR(40),
  payment_method VARCHAR(20)   NOT NULL DEFAULT 'cod',
  status         VARCHAR(20)   NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id);

CREATE TABLE IF NOT EXISTS order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(120)  NOT NULL,
  image        VARCHAR(255)  NOT NULL,
  unit_price   NUMERIC(10,2) NOT NULL,
  quantity     INTEGER       NOT NULL,
  line_total   NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(160) NOT NULL,
  slug         VARCHAR(180) NOT NULL UNIQUE,
  category     VARCHAR(60)  NOT NULL DEFAULT 'Plant Care',
  excerpt      VARCHAR(300) NOT NULL,
  content      TEXT         NOT NULL,
  image        VARCHAR(255) NOT NULL,
  author       VARCHAR(100) NOT NULL DEFAULT 'GreenNest Team',
  read_minutes SMALLINT     NOT NULL DEFAULT 4,
  is_published SMALLINT     NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_pub ON blog_posts (is_published, published_at);

CREATE TABLE IF NOT EXISTS testimonials (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  role      VARCHAR(100) NOT NULL DEFAULT 'Plant Lover',
  message   TEXT NOT NULL,
  rating    SMALLINT NOT NULL DEFAULT 5,
  image     VARCHAR(255) NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subscribers (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(190) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(190) NOT NULL,
  subject    VARCHAR(160) NOT NULL,
  message    TEXT NOT NULL,
  is_read    SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Images uploaded from the admin panel (stored in the DB because Vercel's
-- file system is read-only).
CREATE TABLE IF NOT EXISTS media (
  id         SERIAL PRIMARY KEY,
  mime_type  VARCHAR(40) NOT NULL,
  data       BYTEA       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Login sessions (used by connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  sid    VARCHAR NOT NULL PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON "session" (expire);
