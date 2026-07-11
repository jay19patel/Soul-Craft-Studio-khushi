import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/khushi';

let clientInstance = null;
let dbInstance = null;

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

/**
 * Returns the cached MongoDB database connection.
 * Connects asynchronously. Runs only on the server.
 */
export async function getDb() {
  if (typeof window !== 'undefined') {
    throw new Error('Database can only be accessed on the server.');
  }

  if (!dbInstance) {
    console.log('Connecting to MongoDB at:', MONGODB_URI.replace(/:([^:@]+)@/, ':****@'));
    clientInstance = new MongoClient(MONGODB_URI);
    await clientInstance.connect();

    dbInstance = clientInstance.db(parseDbName(MONGODB_URI));
  }
  return dbInstance;
}
