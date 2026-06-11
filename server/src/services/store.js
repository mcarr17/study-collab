import admin from 'firebase-admin';
import { randomUUID } from 'crypto';

let db = null;

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  admin.initializeApp({ credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  }) });
  db = admin.firestore();
}

if (db) {
  console.log('Using Firestore database');
} else {
  console.log('Using in-memory database');
}

const memory = { users: new Map(), groups: new Map(), notes: new Map() };

export const store = {
  async createUser(user) {
    const id = randomUUID();
    const doc = { id, ...user, createdAt: new Date().toISOString() };
    if (db) await db.collection('users').doc(id).set(doc); else memory.users.set(id, doc);
    return doc;
  },
  async findUserByEmail(email) {
    if (db) {
      const snap = await db.collection('users').where('email', '==', email).limit(1).get();
      return snap.empty ? null : snap.docs[0].data();
    }
    return [...memory.users.values()].find(u => u.email === email) || null;
  },
  async listGroups(userId) {
    if (!db) {
      return Array.from(memory.groups.values())
        .filter(g => g.memberIds?.includes(userId))
        .map(g => ({
          ...g,
          isOwner: g.ownerId === userId
        }));
    }
  
    const snap = await db.collection('groups')
      .where('memberIds', 'array-contains', userId)
      .get();
  
    return snap.docs.map(doc => {
      const group = { id: doc.id, ...doc.data() };
      return {
        ...group,
        isOwner: group.ownerId === userId
      };
    });
  },
  async createGroup(group) {
    const id = randomUUID();
    const doc = { id, ...group, createdAt: new Date().toISOString() };
    if (db) await db.collection('groups').doc(id).set(doc); else memory.groups.set(id, doc);
    return doc;
  },
  async deleteGroup(groupId) {
    if (!db) {
      memory.groups.delete(groupId);
  
      for (const [noteId, note] of memory.notes.entries()) {
        if (note.groupId === groupId) {
          memory.notes.delete(noteId);
        }
      }
  
      return true;
    }
  
    await db.collection('groups').doc(groupId).delete();
  
    const notesSnap = await db.collection('notes')
      .where('groupId', '==', groupId)
      .get();
  
    const batch = db.batch();
    notesSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  
    return true;
  },
  async saveNote(note) {
    const id = note.id || randomUUID();
    const doc = { ...note, id, updatedAt: new Date().toISOString() };
    if (db) await db.collection('notes').doc(id).set(doc, { merge: true }); else memory.notes.set(id, doc);
    return doc;
  },

  async listNotes(groupId) {
    if (db) {
      const snap = await db.collection('notes').where('groupId', '==', groupId).get();
      return snap.docs.map(d => d.data());
    }
    return [...memory.notes.values()].filter(n => n.groupId === groupId);
  },

  async deleteNote(noteId, groupId, userId) {
    if (db) {
      const noteRef = db.collection('notes').doc(noteId);
      const noteSnap = await noteRef.get();

      if (!noteSnap.exists) return false;

      const note = noteSnap.data();

      if (note.groupId !== groupId) return false;
      if (note.authorId !== userId) return false;

      await noteRef.delete();
      return true;
    }

    const note = memory.notes.get(noteId);

    if (!note) return false;
    if (note.groupId !== groupId) return false;
    if (note.authorId !== userId) return false;

    memory.notes.delete(noteId);
    return true;
  },
  async findUserById(userId) {
    if (db) {
      const snap = await db.collection('users').doc(userId).get();
      return snap.exists ? snap.data() : null;
    }
  
    return memory.users.get(userId) || null;
  },
  
  async getGroup(groupId) {
    if (db) {
      const snap = await db.collection('groups').doc(groupId).get();
      return snap.exists ? snap.data() : null;
    }
  
    return memory.groups.get(groupId) || null;
  },
  
  async listAllGroups() {
    if (db) {
      const snap = await db.collection('groups').get();
      return snap.docs.map(d => d.data());
    }
  
    return [...memory.groups.values()];
  },
  
  async joinGroup(groupId, userId) {
    if (db) {
      const groupRef = db.collection('groups').doc(groupId);
      const groupSnap = await groupRef.get();
  
      if (!groupSnap.exists) return null;
  
      const group = groupSnap.data();
      const memberIds = group.memberIds || [];
  
      if (!memberIds.includes(userId)) {
        memberIds.push(userId);
        await groupRef.update({ memberIds });
      }
  
      return { ...group, memberIds };
    }
  
    const group = memory.groups.get(groupId);
    if (!group) return null;
  
    group.memberIds = group.memberIds || [];
  
    if (!group.memberIds.includes(userId)) {
      group.memberIds.push(userId);
    }
  
    memory.groups.set(groupId, group);
    return group;
  },
  
  async leaveGroup(groupId, userId) {
    if (db) {
      const groupRef = db.collection('groups').doc(groupId);
      const groupSnap = await groupRef.get();
  
      if (!groupSnap.exists) return null;
  
      const group = groupSnap.data();
  
      if (group.ownerId === userId) {
        return { error: 'OWNER_CANNOT_LEAVE' };
      }
  
      const memberIds = (group.memberIds || []).filter(id => id !== userId);
      await groupRef.update({ memberIds });
  
      return { ...group, memberIds };
    }
  
    const group = memory.groups.get(groupId);
    if (!group) return null;
  
    if (group.ownerId === userId) {
      return { error: 'OWNER_CANNOT_LEAVE' };
    }
  
    group.memberIds = (group.memberIds || []).filter(id => id !== userId);
    memory.groups.set(groupId, group);
  
    return group;
  },
};
