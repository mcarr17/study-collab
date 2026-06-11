import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}

function raw(token) {
  return jwt.verify(token, secret);
}

function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    req.user = raw(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid auth token' });
  }
}
verifyToken.raw = raw;
export { verifyToken };
