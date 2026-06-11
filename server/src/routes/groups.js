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

router.get('/public', async (req, res) => {
  const groups = await store.listAllGroups();

  const withMembership = groups.map(group => ({
    ...group,
    isMember: group.memberIds?.includes(req.user.id),
    memberCount: group.memberIds?.length || 0,
  }));

  res.json(withMembership);
});

router.post('/:groupId/join', async (req, res) => {
  const group = await store.joinGroup(req.params.groupId, req.user.id);

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  req.app.get('io').emit('server-notification', {
    text: `Someone joined ${group.name}`,
  });

  res.json(group);
});

router.get('/public', async (req, res) => {
  const groups = await store.listAllGroups();

  const result = await Promise.all(groups.map(async group => {
    const owner = await store.findUserById(group.ownerId);

    return {
      ...group,
      isOwner: group.ownerId === req.user.id,
      isMember: group.memberIds?.includes(req.user.id),
      memberCount: group.memberIds?.length || 0,
      ownerName: owner?.name || owner?.email || 'Unknown owner',
    };
  }));

  res.json(result);
});

router.get('/:groupId/details', async (req, res) => {
  const group = await store.getGroup(req.params.groupId);

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  if (!group.memberIds?.includes(req.user.id)) {
    return res.status(403).json({ error: 'You are not a member of this group' });
  }

  const owner = await store.findUserById(group.ownerId);

  const members = await Promise.all(
    (group.memberIds || []).map(async memberId => {
      const user = await store.findUserById(memberId);

      return {
        id: memberId,
        name: user?.name || user?.email || 'Unknown user',
        email: user?.email || '',
        isOwner: memberId === group.ownerId,
      };
    })
  );

  res.json({
    ...group,
    ownerName: owner?.name || owner?.email || 'Unknown owner',
    members,
  });
});

router.post('/:groupId/join', async (req, res) => {
  const group = await store.joinGroup(req.params.groupId, req.user.id);

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  res.json(group);
});

router.post('/:groupId/leave', async (req, res) => {
  const group = await store.getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  if (group.ownerId === req.user.id) {
    return res.status(400).json({ error: 'Owner cannot leave their own group. Delete it instead.' });
  }

  if (!group.memberIds.includes(req.user.id)) {
    return res.status(400).json({ error: 'You are not a member of this group' });
  }

  const updated = await store.leaveGroup(req.params.groupId, req.user.id);
  res.json(updated);
});

router.get('/:groupId/notes', async (req, res) => res.json(await store.listNotes(req.params.groupId)));

router.post('/:groupId/notes', async (req, res) => {
  const note = await store.saveNote({
    id: req.body.id,
    groupId: req.params.groupId,
    title: xss(String(req.body.title || 'Untitled note').trim()),
    body: req.body.type === 'image'
      ? String(req.body.body || '')
      : xss(String(req.body.body || '').trim()),
    type: req.body.type || 'text',
    authorId: req.user.id,
    createdAt: new Date().toISOString()
  });

  req.app.get('io').emit('server-notification', {
    text: `New note saved: ${note.title}`
  });

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
  const group = await store.getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  if (group.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Only the owner can delete this group' });
  }

  await store.deleteGroup(req.params.groupId);
  res.json({ ok: true });
});

export default router;
