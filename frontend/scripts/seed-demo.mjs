/**
 * Demo catalog for Soul Craft Studio.
 *
 *   node scripts/seed-demo.mjs           # add / refresh demo data
 *   node scripts/seed-demo.mjs --clean   # remove everything this script added
 *
 * Every document it creates has `demo: true`, so re-running replaces the demo
 * data instead of duplicating it, and --clean removes only demo data.
 * Real products, orders and customers are never touched.
 *
 * Store settings are only filled in for sections the admin hasn't saved yet.
 *
 * NOTE: the YouTube videos are public crochet videos by other creators and
 * the reviews are sample text — replace them with your own before going live.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dns from 'dns';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['.env.local', '.env']) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}
if (uri.startsWith('mongodb+srv')) dns.setServers(['8.8.8.8', '1.1.1.1']);
const dbName = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'https://')).pathname.replace(/^\//, '') || 'khushi';

const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString();
const yt = (id, title, isShort = false) => ({
  id: crypto.randomUUID(),
  url: isShort ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
  youtube_id: id,
  title,
  is_short: isShort,
});

const CATEGORIES = [
  { _id: 'demo-forever-flowers', name: 'Forever Flowers', slug: 'forever-flowers', description: 'Crochet blooms that never wilt — for desks, shelves and gifting.', image_url: '/images/2.jpeg', sort_order: 1 },
  { _id: 'demo-keychains', name: 'Keychains & Bag Charms', slug: 'keychains-bag-charms', description: 'Tiny handmade friends for your keys, bags and phones.', image_url: '/images/6.jpeg', sort_order: 2 },
  { _id: 'demo-gift-sets', name: 'Gift Sets', slug: 'gift-sets', description: 'Ready-to-gift combos, wrapped with love.', image_url: '/images/3.jpeg', sort_order: 3 },
];

const PRODUCTS = [
  {
    name: 'Forever Sunflower Stem',
    category_id: 'demo-forever-flowers',
    tagline: 'A sunflower that keeps smiling — no water, no wilting.',
    description:
      'Hand-crocheted petal by petal in sunshine-yellow cotton yarn, with a wire-supported stem so it stands tall in any bottle or vase.\n\nPerfect for study tables, bedside corners and anyone who needs a little daily sunshine. Vase not included.',
    highlights: ['Milk-cotton yarn, colour-fast', 'Height approx. 35 cm with bendable stem', 'Takes ~4 hours to make by hand', 'Dust with a soft brush — lasts for years'],
    base_price: 449, discount: 10, stock: 12,
    images: ['/images/1.jpeg', '/images/2.jpeg', '/images/3.jpeg'],
    videos: [yt('IGzWjSlQp6c', 'How a crochet sunflower is made'), yt('kvP588FvENM', 'From yarn to bouquet')],
    is_featured: true, featured_order: 10, age: 2,
  },
  {
    name: 'Sunshine Sunflower Pot',
    category_id: 'demo-forever-flowers',
    tagline: 'A potted sunflower that brightens any desk.',
    description:
      'A complete little plant — sunflower, leaves and a textured woven pot — all crocheted by hand. Needs zero care and makes the sweetest housewarming or teacher’s-day gift.',
    highlights: ['Pot + flower, fully handmade', 'Approx. 18 cm tall, 9 cm pot', 'Stuffed base so it stands firmly', 'Gift-wrapped on request'],
    base_price: 699, discount: 0, stock: 6,
    images: ['/images/2.jpeg', '/images/1.jpeg'],
    videos: [yt('o83IdMAagco', 'Making the sunflower pot'), yt('_DY1mB_2gGA', 'Sunflowers that look real')],
    is_featured: true, featured_order: 20, age: 5,
  },
  {
    name: 'Nazar Evil Eye Keychain',
    category_id: 'demo-keychains',
    tagline: 'Protection, but make it cute.',
    description:
      'A bold cobalt evil-eye charm with a tassel tail and a glass nazar bead. Crocheted tightly so it keeps its round shape on your keys, bag or car mirror.',
    highlights: ['Approx. 6 cm charm + 6 cm tassel', 'Sturdy split-ring keychain', 'Glass nazar bead detail', 'Great as a return gift'],
    base_price: 249, discount: 0, stock: 20,
    images: ['/images/7.jpeg', '/images/6.jpeg'],
    videos: [yt('QDNOMZJoz_M', 'Cute keychain ideas', true), yt('ZKgrkTutnsM', 'Making a mini charm')],
    is_featured: true, featured_order: 30, age: 1,
  },
  {
    name: 'Sunflower Pearl Bag Charm',
    category_id: 'demo-keychains',
    tagline: 'Sunshine for your tote, with a string of pearls.',
    description: 'A crochet sunflower and leaf hanging from a faux-pearl strap — clip it on your bag, keys or water bottle.',
    highlights: ['Faux-pearl wrist strap', 'Lobster clasp + ring', 'Sunflower approx. 7 cm'],
    base_price: 299, discount: 15, stock: 8,
    images: ['/images/3.jpeg', '/images/1.jpeg'],
    videos: [yt('LwbCT3OPqIU', 'Tiny charms, made by hand', true)],
    age: 3,
  },
  {
    name: 'Strawberry & Daisy Keychain',
    category_id: 'demo-keychains',
    tagline: 'Berry sweet, with a little daisy friend.',
    description: 'A plump red strawberry with seed details and a white daisy on a beaded chain. Soft, squishy and impossible not to smile at.',
    highlights: ['Strawberry approx. 6 cm', 'Beaded chain with key ring', 'Soft polyfill stuffing'],
    base_price: 279, discount: 0, stock: 15,
    images: ['/images/6.jpeg', '/images/8.jpeg'],
    videos: [yt('LwbCT3OPqIU', 'Fruit charms in progress', true)],
    age: 4,
  },
  {
    name: 'Baby Sea Turtle Keychain',
    category_id: 'demo-keychains',
    tagline: 'A tiny ocean buddy for your keys.',
    description: 'A pastel-blue shell with cream flippers, crocheted in super-soft yarn. Each turtle comes out a little different — that’s the handmade charm.',
    highlights: ['Approx. 8 cm', 'Safety eyes, child-friendly', 'Made to order in 2–3 days'],
    base_price: 329, discount: 0, stock: 2,
    images: ['/images/5.jpeg'],
    videos: [yt('ByHqB7cC5VU', 'Sea creature charms', true)],
    age: 6,
  },
  {
    name: 'Daisy Keychain',
    category_id: 'demo-keychains',
    tagline: 'Simple, sweet and always in bloom.',
    description: 'A white daisy with a sunny centre and a little leaf, on a sturdy key ring.',
    highlights: ['Approx. 6 cm flower', 'Pastel leaf charm'],
    base_price: 199, discount: 0, stock: 25,
    images: ['/images/8.jpeg', '/images/6.jpeg'],
    videos: [],
    age: 8,
  },
  {
    name: 'Coquette Bow Keychain — Set of 2',
    category_id: 'demo-keychains',
    tagline: 'Pink & ivory bows for you and your bestie.',
    description: 'Two puffy crochet bows — blush pink and ivory — each with a bead-detail key ring. One for you, one to share.',
    highlights: ['Set of 2 (pink + ivory)', 'Bow approx. 7 cm wide', 'Friendship-gift ready'],
    base_price: 399, discount: 20, stock: 0,
    images: ['/images/4.jpeg'],
    videos: [],
    age: 10,
  },
  {
    name: 'Sunshine Gift Combo',
    category_id: 'demo-gift-sets',
    tagline: 'Sunflower pot + pearl bag charm, gift-wrapped.',
    description: 'Our two bestsellers together at a combo price — the Sunshine Sunflower Pot and the Sunflower Pearl Bag Charm, packed in a gift box with a handwritten note.',
    highlights: ['Sunflower pot + bag charm', 'Gift box + handwritten note', 'Save vs buying separately'],
    base_price: 999, discount: 10, stock: 5,
    images: ['/images/2.jpeg', '/images/3.jpeg', '/images/1.jpeg'],
    videos: [yt('ZiB0r3kfiWE', 'Packing a gift order', true)],
    age: 1,
  },
];

const REVIEWS = [
  { author_name: 'Priya M.', author_location: 'Surat', rating: 5, product: 'Forever Sunflower Stem', content: 'The sunflower looks even better in person! It sits on my study table and honestly makes me happy every morning.' },
  { author_name: 'Neha S.', author_location: 'Mumbai', rating: 5, product: 'Nazar Evil Eye Keychain', content: 'Ordered 6 evil-eye keychains as return gifts. Every single one was perfect and so neatly packed.' },
  { author_name: 'Aarav P.', author_location: 'Ahmedabad', rating: 5, product: 'Sunshine Sunflower Pot', content: 'Gifted the sunflower pot to my mom — she put it right next to her real plants 😄 Super cute and sturdy.' },
  { author_name: 'Riddhi K.', author_location: 'Valsad', rating: 4, product: 'Strawberry & Daisy Keychain', content: 'Soft, squishy and adorable. Delivery took a few days since it is handmade, but worth the wait.' },
  { author_name: 'Sneha D.', author_location: 'Pune', rating: 5, product: 'Coquette Bow Keychain — Set of 2', content: 'Got the bow set for me and my best friend. The colours are exactly like the photos!' },
  { author_name: 'Kavya R.', author_location: 'Bengaluru', rating: 5, product: 'Sunshine Gift Combo', content: 'The handwritten note in the gift box was such a sweet touch. Will definitely order again for Diwali.' },
  { author_name: 'Unboxing — Ishita', author_location: 'Vadodara', rating: 5, product: 'Nazar Evil Eye Keychain', content: 'My keychain haul!', video: yt('QDNOMZJoz_M', '', true) },
  { author_name: 'Unboxing — Meera', author_location: 'Delhi', rating: 5, product: 'Sunshine Gift Combo', content: 'Look how it was packed 🥹', video: yt('ZiB0r3kfiWE', '', true) },
];

const DEFAULT_SECTIONS = {
  home: {
    hero_badge: '100% Handcrafted Crochet Art',
    hero_title: 'Soul Craft Studio',
    hero_subtitle: 'Forever flowers, cute keychains and gifts — crocheted by hand in Valsad, one loop at a time.',
    hero_cta_label: 'Shop now',
    hero_video_url: '',
    hero_video_id: '',
    announcement: '🌻 Free shipping on orders above ₹999 · Every piece handmade to last',
    story_title: 'Behind the craft',
    story_subtitle: 'Watch how yarn turns into sunflowers, charms and gifts.',
    brand_videos: [
      yt('kvP588FvENM', 'From yarn to sunflower bouquet'),
      yt('o83IdMAagco', 'Making a sunflower pot, step by step'),
      yt('ZiB0r3kfiWE', 'Packing a big order', true),
      yt('QDNOMZJoz_M', 'Keychain ideas', true),
      yt('LwbCT3OPqIU', 'Tiny charms', true),
    ],
    show_categories: true,
    show_new_arrivals: true,
  },
  shipping: { flat_fee: 60, free_shipping_threshold: 999, estimated_delivery: '5-7 business days' },
};

async function clean(db) {
  const products = await db.collection('products').deleteMany({ demo: true });
  const cats = await db.collection('categories').deleteMany({ demo: true });
  const reviews = await db.collection('testimonials').deleteMany({ demo: true });
  console.log(`Removed demo data: ${products.deletedCount} products, ${cats.deletedCount} categories, ${reviews.deletedCount} reviews.`);
}

async function seed(db) {
  await clean(db);

  await db.collection('categories').insertMany(
    CATEGORIES.map((c) => ({ ...c, demo: true, created_at: daysAgo(30), updated_at: daysAgo(30) }))
  );

  const productIds = {};
  for (const p of PRODUCTS) {
    const { age, images, ...rest } = p;
    const slug = rest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const doc = {
      ...rest,
      slug,
      demo: true,
      is_active: true,
      is_featured: !!rest.is_featured,
      featured_order: rest.featured_order || 0,
      images: images.map((url, i) => ({ id: crypto.randomUUID(), image_url: url, is_primary: i === 0 })),
      variants: [{ id: crypto.randomUUID(), sku: `SCS-${slug.toUpperCase().slice(0, 18)}`, size: '', color: '', price_override: null, stock: rest.stock }],
      created_at: daysAgo(age),
      updated_at: daysAgo(age),
    };
    delete doc.stock;
    const res = await db.collection('products').insertOne(doc);
    productIds[p.name] = res.insertedId.toString();
  }

  await db.collection('testimonials').insertMany(
    REVIEWS.map((r, i) => ({
      author_name: r.author_name,
      author_location: r.author_location,
      content: r.content,
      rating: r.rating,
      video_url: r.video?.url || '',
      youtube_id: r.video?.youtube_id || null,
      is_short: !!r.video?.is_short,
      product_id: productIds[r.product] || null,
      is_active: true,
      is_featured: i < 2,
      reviewed: true,
      source: 'admin',
      demo: true,
      created_at: daysAgo(i + 1),
      updated_at: daysAgo(i + 1),
    }))
  );

  // Fill only settings sections the admin has never saved.
  const existing = (await db.collection('settings').findOne({ _id: 'store' })) || {};
  const missing = Object.fromEntries(Object.entries(DEFAULT_SECTIONS).filter(([k]) => !existing[k]));
  if (Object.keys(missing).length) {
    await db.collection('settings').updateOne({ _id: 'store' }, { $set: { ...missing, updated_at: now.toISOString() } }, { upsert: true });
  }

  console.log(`Seeded ${CATEGORIES.length} categories, ${PRODUCTS.length} products, ${REVIEWS.length} reviews.`);
  console.log(Object.keys(missing).length ? `Filled settings: ${Object.keys(missing).join(', ')}` : 'Settings already configured — left unchanged.');
}

const client = await MongoClient.connect(uri);
try {
  const db = client.db(dbName);
  console.log(`Database: ${dbName}`);
  if (process.argv.includes('--clean')) await clean(db);
  else await seed(db);
} finally {
  await client.close();
}
