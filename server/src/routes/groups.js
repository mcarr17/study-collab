import express from 'express';
import xss from 'xss';
import { store } from '../services/store.js';

const router = express.Router();

router.get('/', async (req, res) => res.json(await store.listGroups(req.user.id)));

router.post('/', async (req, res) => {
  const name = xss(String(req.body.name || '').trim());
  const course = xss(String(req.body.course || '').trim());
  if (!name) return res.status(400).json({ error: 'Group name required' });
  const group = await store.createGroup({ name, course, ownerId: req.user.id, memberIds: [req.user.id] });
  req.app.get('io').emit('server-notification', { text: `New study group created: ${group.name}` });
  res.status(201).json(group);
});

router.get('/:groupId/notes', async (req, res) => res.json(await store.listNotes(req.params.groupId)));

router.post('/:groupId/notes', async (req, res) => {
  const note = await store.saveNote({
    id: req.body.id,
    groupId: req.params.groupId,
    title: xss(String(req.body.title || 'Untitled')),
    body: xss(String(req.body.body || '')),
    authorId: req.user.id
  });
  req.app.get('io').to(req.params.groupId).emit('note-saved', note);
  res.status(201).json(note);
});

router.put('/:groupId/notes/:noteId', async (req, res) => {
  const note = await store.saveNote({
    id: req.params.noteId,
    groupId: req.params.groupId,
    title: xss(String(req.body.title || 'Untitled')),
    body: xss(String(req.body.body || '')),
    authorId: req.user.id
  });

  req.app.get('io').to(req.params.groupId).emit('note-saved', note);
  res.json(note);
});

router.delete('/:groupId/notes/:noteId', async (req, res) => {
  const deleted = await store.deleteNote(
    req.params.noteId,
    req.params.groupId,
    req.user.id
  );

  if (!deleted) {
    return res.status(404).json({ error: 'Note not found' });
  }

  req.app.get('io').to(req.params.groupId).emit('note-deleted', {
    id: req.params.noteId
  });

  res.json({ ok: true });
});

router.delete('/:groupId', async (req, res) => {
  const deleted = await store.deleteGroup(req.params.groupId, req.user.id);

  if (!deleted) {
    return res.status(404).json({ error: 'Group not found' });
  }

  req.app.get('io').emit('server-notification', { text: 'Study group deleted' });
  res.json({ ok: true });
});

export default router;
