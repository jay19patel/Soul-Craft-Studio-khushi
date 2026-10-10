import crypto from 'crypto';

// Never fall back to a hard-coded secret in production — anyone reading the
// source could forge admin sessions with it.
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set (at least 32 characters) in production.');
  }
  return secret || 'scs-dev-only-secret-do-not-use-in-production';
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

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

    const derived = crypto.pbkdf2Sync(String(password), salt, iterations, 32, 'sha256').toString('base64');
    return safeEqual(derived, hash);
  }

  // Next.js format: scs_pbkdf2$<iterations>$<salt>$<hash>
  if (passwordHash.startsWith('scs_pbkdf2$')) {
    const parts = passwordHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const hash = parts[3];

    const derived = crypto.pbkdf2Sync(String(password), salt, iterations, 32, 'sha256').toString('base64');
    return safeEqual(derived, hash);
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
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60 * 24 * 7;
  const sPayload = Buffer.from(JSON.stringify({ ...payload, iat, exp })).toString('base64url');
  
  const signature = crypto.createHmac('sha256', getJwtSecret())
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
    const expectedSignature = crypto.createHmac('sha256', getJwtSecret())
      .update(`${sHeader}.${sPayload}`)
      .digest('base64url');
      
    if (!safeEqual(signature, expectedSignature)) return null;
    
    const payload = JSON.parse(Buffer.from(sPayload, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    
    return payload;
  } catch (e) {
    return null;
  }
}
