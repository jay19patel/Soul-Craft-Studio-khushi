import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/khushi';

let clientInstance = null;
let dbInstance = null;

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
    
    // Parse dbName from URI, default to 'khushi'
    const dbName = MONGODB_URI.split('/').pop().split('?')[0] || 'khushi';
    dbInstance = clientInstance.db(dbName);
  }
  return dbInstance;
}
