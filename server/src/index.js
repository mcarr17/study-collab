import 'dotenv/config';
import express from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import groupsRoutes from './routes/groups.js';
import aiRoutes from './routes/ai.js';
import { verifyToken } from './middleware/auth.js';

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const io = new Server(server, { cors: { origin: allowedOrigin, credentials: true } });

app.set('io', io);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/groups', verifyToken, groupsRoutes);
app.use('/api/ai', verifyToken, aiRoutes);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('missing token'));
  try {
    socket.user = verifyToken.raw(token);
    return next();
  } catch {
    return next(new Error('invalid token'));
  }
});

io.on('connection', socket => {
  socket.on('join-group', groupId => socket.join(groupId));
  socket.on('send-message', payload => {
    const message = { ...payload, userId: socket.user.id, createdAt: new Date().toISOString() };
    io.to(payload.groupId).emit('message-created', message);
    io.to(payload.groupId).emit('server-notification', { text: `New message in ${payload.groupName || 'your group'}` });
  });
});

const port = process.env.PORT || 8080;
server.listen(port, () => console.log(`API listening on ${port}`));
