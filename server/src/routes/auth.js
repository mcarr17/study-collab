import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import xss from 'xss';
import { store } from '../services/store.js';

const router = express.Router();
const secret = process.env.JWT_SECRET || 'dev-only-change-me';

function issueToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, secret, { expiresIn: '2h' });
}

router.post('/register', async (req, res) => {
  const name = xss(String(req.body.name || '').trim());
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Name, email, and 8+ char password required' });
  if (await store.findUserByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await store.createUser({ name, email, passwordHash });
  res.cookie('token', issueToken(user), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.status(201).json({ token: issueToken(user), user: { id: user.id, name, email } });
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await store.findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid login' });
  const token = issueToken(user);
  res.cookie('token', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.json({ token, user: { id: user.id, name: user.name, email } });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

export default router;
