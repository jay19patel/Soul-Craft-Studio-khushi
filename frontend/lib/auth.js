import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'scs-super-secret-key-12345';

/**
 * Verifies a plain-text password against a hashed password (supporting both legacy Django and new Next.js formats).
 */
export function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;

  // Django's standard PBKDF2 format: pbkdf2_sha256$<iterations>$<salt>$<hash>
  if (passwordHash.startsWith('pbkdf2_sha256$')) {
    const parts = passwordHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const hash = parts[3];

    const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64');
    return derived === hash;
  }

  // Next.js format: scs_pbkdf2$<iterations>$<salt>$<hash>
  if (passwordHash.startsWith('scs_pbkdf2$')) {
    const parts = passwordHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const hash = parts[3];

    const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64');
    return derived === hash;
  }

  return false;
}

/**
 * Hashes a plain-text password using PBKDF2 (similar to Django's structure).
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(12).toString('base64');
  const iterations = 390000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64');
  return `scs_pbkdf2$${iterations}$${salt}$${hash}`;
}

/**
 * Signs a payload with standard JWT HS256 algorithm.
 */
export function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const sHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  
  // Expiry is set to 7 days (60 * 60 * 24 * 7 seconds)
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const sPayload = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${sHeader}.${sPayload}`)
    .digest('base64url');
    
  return `${sHeader}.${sPayload}.${signature}`;
}

/**
 * Verifies a JWT token. Returns the payload or null if invalid/expired.
 */
export function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [sHeader, sPayload, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${sHeader}.${sPayload}`)
      .digest('base64url');
      
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(Buffer.from(sPayload, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    
    return payload;
  } catch (e) {
    return null;
  }
}
