import { MongoClient } from 'mongodb';
import dns from 'dns';

// Fix Node.js SRV lookup issues with MongoDB Atlas on macOS/local networks.
// Only in development — in production the platform's resolver is correct and
// overriding it would affect every outbound call (SMTP, Blob, ...).
if (process.env.NODE_ENV !== 'production') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (e) {
    // Ignore in environments where custom DNS servers cannot be set
  }
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/khushi';

/**
 * Extracts the database name from the URI's path, ignoring query string.
 * Handles both "mongodb://" and "mongodb+srv://" schemes, including Atlas
 * connection strings that have no path segment before the "?" (e.g.
 * "mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true").
 */
function parseDbName(uri) {
  try {
    const url = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'https://'));
    return url.pathname.replace(/^\//, '') || 'khushi';
  } catch (e) {
    return 'khushi';
  }
}

// Cached on globalThis so dev hot-reloads and warm serverless invocations reuse
// one connection pool instead of opening a new one per module instance.
const globalCache = globalThis.__scsMongo || (globalThis.__scsMongo = { promise: null });

async function ensureIndexes(db) {
  const specs = [
    ['users', { email: 1 }],
    ['users', { username: 1 }],
    ['products', { is_active: 1, created_at: -1 }],
    ['products', { is_featured: 1, featured_order: 1 }],
    ['orders', { user_id: 1, created_at: -1 }],
    ['orders', { status: 1, created_at: -1 }],
    ['orders', { payment_method: 1, payment_status: 1 }],
    ['orders', { upi_transaction_id: 1 }],
    ['emaillogs', { queued_at: -1 }],
    ['emaillogs', { order_id: 1 }],
    ['activity_logs', { created_at: -1 }],
    ['activity_logs', { entity_type: 1, entity_id: 1 }],
    ['testimonials', { is_active: 1, created_at: -1 }],
  ];
  await Promise.all(
    specs.map(([collection, keys]) => db.collection(collection).createIndex(keys).catch(() => null))
  );
  // Failed-login records clean themselves up after a day.
  await db.collection('login_attempts').createIndex({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 }).catch(() => null);
}

/**
 * Returns the cached MongoDB database connection.
 * Connects asynchronously. Runs only on the server.
 */
export async function getDb() {
  if (typeof window !== 'undefined') {
    throw new Error('Database can only be accessed on the server.');
  }

  if (!globalCache.promise) {
    globalCache.promise = (async () => {
      const client = new MongoClient(MONGODB_URI, { maxPoolSize: 10 });
      await client.connect();
      const db = client.db(parseDbName(MONGODB_URI));
      ensureIndexes(db).catch((err) => console.error('Index creation failed:', err));
      return db;
    })().catch((err) => {
      globalCache.promise = null; // allow a retry on the next request
      throw err;
    });
  }
  return globalCache.promise;
}
