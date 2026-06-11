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
const allowedOrigin = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://192.168.254.18:5173',
].filter(Boolean);
const io = new Server(server, {
  cors: { origin: allowedOrigin, credentials: true }
});

app.set('io', io);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '5mb' }));
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

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join-group', (groupId) => {
    socket.join(`group:${groupId}`);
  });

  socket.on('leave-group', (groupId) => {
    socket.leave(`group:${groupId}`);
  });

  socket.on('note-draft-change', ({ groupId, text }) => {
    socket.to(`group:${groupId}`).emit('note-draft-updated', {
      groupId,
      text,
    });
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
  });
});

const port = process.env.PORT || 8080;
server.listen(port, () => console.log(`API listening on ${port}`));
