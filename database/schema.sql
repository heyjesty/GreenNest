-- GreenNest database schema (MySQL 8)
-- Run through `npm run db:setup`, which creates the database first.

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(190)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  phone         VARCHAR(30)   NULL,
  role          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(60) NOT NULL,
  slug  VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(120)  NOT NULL,
  slug              VARCHAR(140)  NOT NULL UNIQUE,
  short_description VARCHAR(255)  NOT NULL DEFAULT '',
  description       TEXT          NULL,
  price             DECIMAL(10,2) NOT NULL,
  compare_price     DECIMAL(10,2) NULL,
  stock             INT           NOT NULL DEFAULT 0,
  image             VARCHAR(255)  NOT NULL,
  light             VARCHAR(60)   NOT NULL DEFAULT 'Bright, indirect',
  water             VARCHAR(60)   NOT NULL DEFAULT 'Weekly',
  size              VARCHAR(60)   NOT NULL DEFAULT 'Medium',
  pet_friendly      TINYINT(1)    NOT NULL DEFAULT 0,
  is_featured       TINYINT(1)    NOT NULL DEFAULT 0,
  is_active         TINYINT(1)    NOT NULL DEFAULT 1,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_active (is_active, is_featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_categories (
  product_id  INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (product_id, category_id),
  FOREIGN KEY (product_id)  REFERENCES products(id)   ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL,
  comment     TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (product_id, user_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupons (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(40) NOT NULL UNIQUE,
  percent    TINYINT UNSIGNED NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  expires_at DATE NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number   VARCHAR(20)   NOT NULL UNIQUE,
  user_id        INT UNSIGNED  NULL,
  customer_name  VARCHAR(100)  NOT NULL,
  email          VARCHAR(190)  NOT NULL,
  phone          VARCHAR(30)   NOT NULL,
  address        VARCHAR(255)  NOT NULL,
  city           VARCHAR(100)  NOT NULL,
  state          VARCHAR(100)  NOT NULL,
  postal_code    VARCHAR(20)   NOT NULL,
  notes          VARCHAR(500)  NULL,
  subtotal       DECIMAL(10,2) NOT NULL,
  discount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping       DECIMAL(10,2) NOT NULL DEFAULT 0,
  total          DECIMAL(10,2) NOT NULL,
  coupon_code    VARCHAR(40)   NULL,
  payment_method ENUM('cod') NOT NULL DEFAULT 'cod',
  status         ENUM('pending','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orders_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id     INT UNSIGNED NOT NULL,
  product_id   INT UNSIGNED NULL,
  product_name VARCHAR(120) NOT NULL,
  image        VARCHAR(255) NOT NULL,
  unit_price   DECIMAL(10,2) NOT NULL,
  quantity     INT UNSIGNED  NOT NULL,
  line_total   DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_posts (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(160) NOT NULL,
  slug         VARCHAR(180) NOT NULL UNIQUE,
  category     VARCHAR(60)  NOT NULL DEFAULT 'Plant Care',
  excerpt      VARCHAR(300) NOT NULL,
  content      MEDIUMTEXT   NOT NULL,
  image        VARCHAR(255) NOT NULL,
  author       VARCHAR(100) NOT NULL DEFAULT 'GreenNest Team',
  read_minutes TINYINT UNSIGNED NOT NULL DEFAULT 4,
  is_published TINYINT(1)   NOT NULL DEFAULT 1,
  published_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_posts_pub (is_published, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS testimonials (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  role      VARCHAR(100) NOT NULL DEFAULT 'Plant Lover',
  message   TEXT NOT NULL,
  rating    TINYINT UNSIGNED NOT NULL DEFAULT 5,
  image     VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscribers (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(190) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(190) NOT NULL,
  subject    VARCHAR(160) NOT NULL,
  message    TEXT NOT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Images uploaded from the admin panel (stored in the DB so they work on
-- serverless hosts like Vercel, where the file system is read-only).
CREATE TABLE IF NOT EXISTS media (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mime_type  VARCHAR(40)  NOT NULL,
  data       MEDIUMBLOB   NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
