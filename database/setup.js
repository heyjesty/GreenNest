/**
 * Creates the database, tables and starter content.
 *   npm run db:setup         -> create if missing, seed empty tables
 *   npm run db:reset         -> DROP the database and rebuild everything
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { dbConfig } = require('../config/db');

const reset = process.argv.includes('--reset');

const categories = [
  { name: 'Indoor', slug: 'indoor' },
  { name: 'Outdoor', slug: 'outdoor' },
  { name: 'Low Light', slug: 'low-light' },
];

const products = [
  {
    name: 'Snake Plant', price: 24.99, compare: null, stock: 32, image: '/assets/images/snake-plant.jpg',
    light: 'Low to bright, indirect', water: 'Every 2–3 weeks', size: 'Medium · 45 cm', pet: 0, featured: 1,
    cats: ['indoor', 'outdoor', 'low-light'],
    short: 'Architectural, upright leaves that thrive on neglect and clean the air.',
    desc: 'The Snake Plant (Sansevieria) is the ultimate beginner plant. Its striking, sword-like leaves add structure to any corner, and it tolerates low light, dry air and the occasional forgotten watering. It is also one of the best air-purifying plants, converting CO₂ to oxygen even at night — perfect for bedrooms.',
  },
  {
    name: 'Peace Lily', price: 29.99, compare: 34.99, stock: 18, image: '/assets/images/peace-lily.jpg',
    light: 'Medium, indirect', water: 'Weekly', size: 'Medium · 50 cm', pet: 0, featured: 1,
    cats: ['indoor', 'low-light'],
    short: 'Glossy foliage and elegant white blooms that brighten shady rooms.',
    desc: 'The Peace Lily brings calm, glossy greenery and graceful white flowers to spaces with modest light. It tells you when it is thirsty by gently drooping, then perks up within hours of a drink — making it a forgiving, rewarding companion for new plant parents.',
  },
  {
    name: 'Monstera', price: 34.99, compare: null, stock: 14, image: '/assets/images/monstera.jpg',
    light: 'Bright, indirect', water: 'Every 1–2 weeks', size: 'Large · 60 cm', pet: 0, featured: 1,
    cats: ['indoor', 'outdoor'],
    short: 'The iconic split-leaf statement plant for a lush, tropical look.',
    desc: 'Monstera deliciosa is loved for its dramatic, fenestrated leaves. Give it bright indirect light and a moss pole to climb and it will reward you with fast growth and ever-larger leaves. A true statement piece for living rooms and studios.',
  },
  {
    name: 'ZZ Plant', price: 24.99, compare: null, stock: 26, image: '/assets/images/zz-plant.jpg',
    light: 'Low to bright, indirect', water: 'Every 2–3 weeks', size: 'Medium · 45 cm', pet: 0, featured: 1,
    cats: ['indoor', 'low-light'],
    short: 'Waxy, glossy leaves that handle low light and busy schedules.',
    desc: 'The ZZ Plant (Zamioculcas zamiifolia) stores water in its thick rhizomes, so it is happy to be left alone. Its waxy, deep-green leaves reflect light beautifully, making it ideal for offices, hallways and anywhere that does not get much sun.',
  },
  {
    name: 'Fiddle Leaf Fig', price: 49.99, compare: 59.99, stock: 9, image: '/assets/images/fiddle-leaf-fig.jpg',
    light: 'Bright, indirect', water: 'Weekly', size: 'Medium · 55 cm', pet: 0, featured: 1,
    cats: ['indoor', 'outdoor'],
    short: 'Large violin-shaped leaves for a bold, designer finish.',
    desc: 'The Fiddle Leaf Fig is the darling of interior design with its large, violin-shaped leaves. It loves a consistent spot near a bright window and a regular watering routine. Rotate it every few weeks for even, upright growth.',
  },
  {
    name: 'Aglaonema', price: 27.99, compare: null, stock: 20, image: '/assets/images/aglaonema.jpg',
    light: 'Low to medium, indirect', water: 'Weekly', size: 'Small · 35 cm', pet: 0, featured: 1,
    cats: ['indoor', 'low-light'],
    short: 'Pink-splashed leaves that add colour to low-light spaces.',
    desc: 'Aglaonema, or Chinese Evergreen, brings vivid pink and green patterns to your home without demanding much light. It is slow-growing, compact and tolerant of indoor conditions — a colourful, low-effort choice for desks and shelves.',
  },
  {
    name: 'Pothos', price: 19.99, compare: null, stock: 40, image: '/assets/images/pothos.jpg',
    light: 'Low to bright, indirect', water: 'Every 1–2 weeks', size: 'Trailing · 40 cm', pet: 0, featured: 1,
    cats: ['indoor', 'outdoor', 'low-light'],
    short: 'Fast-growing trailing vines — perfect for shelves and hanging pots.',
    desc: 'Golden Pothos is one of the easiest houseplants you can grow. Its heart-shaped, variegated leaves trail gracefully from shelves and hanging baskets, and cuttings root in a glass of water — so one plant can easily become many.',
  },
  {
    name: 'Rubber Plant', price: 29.99, compare: null, stock: 15, image: '/assets/images/rubber-plant.jpg',
    light: 'Bright, indirect', water: 'Every 1–2 weeks', size: 'Medium · 50 cm', pet: 0, featured: 1,
    cats: ['indoor', 'outdoor'],
    short: 'Deep burgundy-green leaves with a polished, glossy shine.',
    desc: 'The Rubber Plant (Ficus elastica) has thick, glossy leaves in rich burgundy-green tones. It grows into a handsome indoor tree with bright light and occasional dusting of its leaves, adding a refined, modern feel to any room.',
  },
];

const posts = [
  {
    title: '5 Easy Plants For Beginners', category: 'Beginner Guides', image: '/assets/images/blog-monstera.jpg', minutes: 5,
    excerpt: 'Just getting started with plants? These five low-maintenance beauties are perfect for beginners — easy to grow, hard not to love.',
    content: `<p>Starting your plant journey should feel exciting, not stressful. The secret is choosing plants that forgive the occasional missed watering and adapt to everyday home conditions. Here are our five favourites for first-time plant parents.</p>
<h2>1. Snake Plant</h2><p>Practically indestructible. It handles low light, dry air and irregular watering, and its upright leaves suit modern interiors.</p>
<h2>2. Pothos</h2><p>Fast-growing and trailing, Pothos tells you when it is thirsty by drooping slightly. It looks beautiful on shelves or in hanging baskets.</p>
<h2>3. ZZ Plant</h2><p>Its water-storing rhizomes make it perfect for busy people. Water only when the soil is completely dry.</p>
<h2>4. Monstera</h2><p>A statement plant that is surprisingly easy. Give it bright, indirect light and water when the top few centimetres of soil feel dry.</p>
<h2>5. Peace Lily</h2><p>Elegant white blooms and glossy leaves, even in modest light. It droops when thirsty and bounces back quickly.</p>
<h2>Our top tip</h2><p>Most beginner plants are lost to overwatering, not neglect. Always check the soil with your finger before reaching for the watering can.</p>`,
  },
  {
    title: 'The Complete Watering Guide', category: 'Watering', image: '/assets/images/peace-lily.jpg', minutes: 6,
    excerpt: 'Learn the right way to water your plants — how often, how much, and the warning signs that something is off.',
    content: `<p>Watering is the single biggest factor in keeping houseplants healthy. Rather than following a strict calendar, learn to read your plant and its soil.</p>
<h2>Check before you water</h2><p>Push a finger 3–5 cm into the soil. If it feels dry, it is time to water. If it is still damp, wait a few days and check again.</p>
<h2>Water thoroughly</h2><p>When you water, water deeply until it drains from the bottom of the pot. This encourages strong, deep roots. Always empty saucers so roots never sit in water.</p>
<h2>Adjust with the seasons</h2><p>Plants drink more in spring and summer when they are actively growing, and much less in autumn and winter.</p>
<h2>Warning signs</h2><ul><li><strong>Yellow, soft leaves</strong> — usually overwatering.</li><li><strong>Crispy brown tips</strong> — underwatering or low humidity.</li><li><strong>Drooping</strong> — can be either; check the soil to tell.</li></ul>`,
  },
  {
    title: 'Best Plants For Low-Light Rooms', category: 'Plant Care', image: '/assets/images/zz-plant.jpg', minutes: 4,
    excerpt: 'No sunny windows? No problem. These tough, beautiful plants are happy in shady corners and north-facing rooms.',
    content: `<p>Low light does not mean no plants. Many tropical species evolved on shady forest floors and are perfectly suited to dimmer rooms.</p>
<h2>Our low-light heroes</h2><ul><li><strong>ZZ Plant</strong> — glossy and almost care-free.</li><li><strong>Snake Plant</strong> — sculptural and tolerant.</li><li><strong>Aglaonema</strong> — adds colour without needing sun.</li><li><strong>Pothos</strong> — trails happily in shade.</li></ul>
<h2>Tips for success</h2><p>Plants in low light use less water, so water less often. Wipe leaves regularly so they can absorb as much light as possible, and rotate pots every few weeks.</p>`,
  },
  {
    title: 'How To Repot A Houseplant', category: 'Care Tips', image: '/assets/images/fiddle-leaf-fig.jpg', minutes: 5,
    excerpt: 'Roots poking out of the drainage holes? Here is a simple, stress-free way to give your plant a new home.',
    content: `<p>Most houseplants need repotting every 12–18 months, ideally in spring as they start a new growth season.</p>
<h2>Signs it is time</h2><ul><li>Roots growing from the drainage holes</li><li>Water running straight through the pot</li><li>Growth has slowed despite good care</li></ul>
<h2>Step by step</h2><p>Choose a pot only 2–5 cm wider than the current one. Water the plant a day before, gently ease it out, loosen circling roots, and place it in fresh potting mix at the same depth. Water well and keep it out of direct sun for a week while it settles.</p>`,
  },
  {
    title: 'Styling Plants In Small Spaces', category: 'Inspiration', image: '/assets/images/pothos.jpg', minutes: 3,
    excerpt: 'Turn a compact apartment into a green retreat with shelves, hanging planters and smart plant choices.',
    content: `<p>You do not need a big home to enjoy a lush, plant-filled space. Think vertically and choose plants that suit the light you have.</p>
<h2>Go vertical</h2><p>Wall shelves and hanging planters free up floor space. Trailing plants like Pothos look stunning cascading from height.</p>
<h2>Group in odd numbers</h2><p>Clusters of three plants at different heights create a natural, styled look.</p>
<h2>Mirror the light</h2><p>Placing plants near mirrors bounces extra light around the room — your plants and your space will both feel brighter.</p>`,
  },
  {
    title: 'Pet-Safe Plant Care Basics', category: 'Care Tips', image: '/assets/images/rubber-plant.jpg', minutes: 4,
    excerpt: 'Sharing your home with cats or dogs? Here is how to enjoy plants safely alongside curious pets.',
    content: `<p>Many popular houseplants can upset a pet's stomach if chewed. With a few simple habits, plants and pets can live together happily.</p>
<h2>Place plants thoughtfully</h2><p>Use high shelves and hanging planters for plants that are not pet-safe, and keep fallen leaves tidied away.</p>
<h2>Offer alternatives</h2><p>Cat grass gives curious cats something safe to nibble on, which often keeps them away from other plants.</p>
<h2>Ask us</h2><p>Not sure whether a plant suits your household? Contact our team and we will happily recommend pet-friendly options.</p>`,
  },
];

const testimonials = [
  { name: 'Emily', role: 'Plant Lover', image: '/assets/images/customer-emily.png',
    message: "Absolutely love this plant shop! Beautiful, healthy plants and a great selection. The staff was super helpful in recommending the perfect plant for my home. The atmosphere is so calming — I'll definitely be back." },
  { name: 'Sarah M.', role: 'Plant Lover', image: '/assets/images/customer-sarah.png',
    message: "Absolutely love this plant shop! Beautiful, healthy plants and a great selection. The staff was super helpful in recommending the perfect plant for my home. The atmosphere is so calming — I'll definitely be back." },
];

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const { database, ...server } = dbConfig;
  const conn = await mysql.createConnection({ ...server, multipleStatements: true });
  console.log(`Connected to MySQL at ${server.host}:${server.port}`);

  if (reset) {
    await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
    console.log(`Dropped database "${database}"`);
  }
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${database}\``);
  await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log('Tables ready');

  const count = async (table) => (await conn.query(`SELECT COUNT(*) AS n FROM ${table}`))[0][0].n;

  if (!(await count('categories'))) {
    await conn.query('INSERT INTO categories (name, slug) VALUES ?', [categories.map((c) => [c.name, c.slug])]);
  }
  const [catRows] = await conn.query('SELECT id, slug FROM categories');
  const catId = Object.fromEntries(catRows.map((c) => [c.slug, c.id]));

  if (!(await count('products'))) {
    for (const p of products) {
      const [res] = await conn.query(
        `INSERT INTO products (name, slug, short_description, description, price, compare_price, stock, image, light, water, size, pet_friendly, is_featured)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [p.name, slugify(p.name), p.short, p.desc, p.price, p.compare, p.stock, p.image, p.light, p.water, p.size, p.pet, p.featured]
      );
      await conn.query('INSERT INTO product_categories (product_id, category_id) VALUES ?', [p.cats.map((c) => [res.insertId, catId[c]])]);
    }
    console.log(`Seeded ${products.length} products`);
  }

  if (!(await count('blog_posts'))) {
    let day = 0;
    for (const b of posts) {
      await conn.query(
        `INSERT INTO blog_posts (title, slug, category, excerpt, content, image, read_minutes, published_at)
         VALUES (?,?,?,?,?,?,?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [b.title, slugify(b.title), b.category, b.excerpt, b.content, b.image, b.minutes, (day += 6)]
      );
    }
    console.log(`Seeded ${posts.length} blog posts`);
  }

  if (!(await count('testimonials'))) {
    await conn.query('INSERT INTO testimonials (name, role, message, image) VALUES ?', [testimonials.map((t) => [t.name, t.role, t.message, t.image])]);
  }

  if (!(await count('coupons'))) {
    await conn.query("INSERT INTO coupons (code, percent) VALUES ('SPRING25', 25), ('WELCOME10', 10)");
    console.log('Seeded coupons: SPRING25 (25%), WELCOME10 (10%)');
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@greennest.com').toLowerCase();
  const [[admin]] = await conn.query('SELECT id FROM users WHERE email = ?', [adminEmail]);
  if (!admin) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@12345', 12);
    await conn.query("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,'admin')",
      [process.env.ADMIN_NAME || 'GreenNest Admin', adminEmail, hash]);
    console.log(`Created admin user: ${adminEmail}`);
  }

  await conn.end();
  console.log('Database setup complete ✔');
}

main().catch((err) => {
  console.error('\nDatabase setup failed:', err.message);
  if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('→ Check DB_USER / DB_PASSWORD in your .env file.');
  if (err.code === 'ECONNREFUSED') console.error('→ Is MySQL running? Check DB_HOST / DB_PORT in your .env file.');
  process.exit(1);
});
