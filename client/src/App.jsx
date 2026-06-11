import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { Bell, Brain, WifiOff } from 'lucide-react';
import { API, api, getToken, setToken } from './lib/api.js';

function Login({ onLogin }) {
  const [form, setForm] = useState({ name: 'Demo User', email: 'demo@example.com', password: 'password123' });
  const [mode, setMode] = useState('register');

  const submit = async e => {
    e.preventDefault();
    const data = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
    setToken(data.token);
    onLogin(data.user);
  };

  return <main className="min-h-screen grid place-items-center bg-slate-950 text-white p-4">
    <section className="w-full max-w-md rounded-2xl bg-white/10 p-6 shadow-xl" aria-labelledby="login-title">
      <h1 id="login-title" className="text-3xl font-bold">AI Study Collab</h1>
      <p className="mt-2 text-slate-200">Collaborative notes, AI summaries, offline drafts, and realtime group updates.</p>

      <form onSubmit={submit} className="mt-6 grid gap-3">
        {mode === 'register' && (
          <label>
            Name
            <input
              className="mt-1 w-full rounded p-3 text-black"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            className="mt-1 w-full rounded p-3 text-black"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            minLength="8"
            className="mt-1 w-full rounded p-3 text-black"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
          />
        </label>

        <button className="rounded bg-blue-500 p-3 font-semibold hover:bg-blue-400">
          {mode === 'register' ? 'Create account' : 'Log in'}
        </button>
      </form>

      <button
        className="mt-4 underline"
        onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
      >
        Switch to {mode === 'register' ? 'login' : 'register'}
      </button>
    </section>
  </main>;
}

function CanvasBoard() {
  useEffect(() => {
    const canvas = document.getElementById('study-canvas');
    const ctx = canvas.getContext('2d');
    let drawing = false;

    const pos = e => ({ x: e.offsetX, y: e.offsetY });

    canvas.onpointerdown = e => {
      drawing = true;
      ctx.beginPath();
      const p = pos(e);
      ctx.moveTo(p.x, p.y);
    };

    canvas.onpointermove = e => {
      if (!drawing) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };

    canvas.onpointerup = () => {
      drawing = false;
    };
  }, []);

  return <article className="rounded-2xl bg-white p-4 shadow" aria-labelledby="canvas-title">
    <h2 id="canvas-title" className="font-bold">Canvas scratch board</h2>
    <canvas
      id="study-canvas"
      width="480"
      height="180"
      className="mt-2 w-full rounded border"
      aria-label="Drawable study scratch board"
    />
  </article>;
}
function parseFlashcards(summary) {
  const matches = [...summary.matchAll(/Q:\s*([\s\S]*?)\nA:\s*([\s\S]*?)(?=\n\nQ:|\nPractice Questions|$)/g)];

  return matches.map(match => ({
    question: match[1].trim(),
    answer: match[2].trim()
  }));
}
function removeFlashcardsFromSummary(summary) {
  return summary.replace(/Flashcards[\s\S]*?(?=Practice Questions|$)/i, '').trim();
}

function Dashboard({ onLogout }) {
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(null);
  const [note, setNote] = useState({ title: 'Lecture Notes', body: '' });
  const [summary, setSummary] = useState('');
  const [toast, setToast] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [groupForm, setGroupForm] = useState({ name: '', course: '' });
  const [savedNotes, setSavedNotes] = useState([]);
  const [groupDrafts, setGroupDrafts] = useState({});
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [groupSummaries, setGroupSummaries] = useState({});
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  const socket = useMemo(() => io(API, { auth: { token: getToken() } }), []);

  useEffect(() => {
    api('/api/groups').then(setGroups).catch(() => {});
    socket.on('server-notification', n => setToast(n.text));

    const on = () => setOffline(false);
    const off = () => setOffline(true);

    addEventListener('online', on);
    addEventListener('offline', off);

    return () => {
      socket.disconnect();
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  }, []);

  async function selectGroup(group) {
    if (active) {
      setGroupDrafts(prev => ({
        ...prev,
        [active.id]: note
      }));
    }

    setActive(group);
    setNote(groupDrafts[group.id] || { title: 'Lecture Notes', body: '' });
    setEditingNoteId(null);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    setSummary(groupSummaries[group.id] || '');
    socket.emit('join-group', group.id);
    setToast(`Selected group: ${group.name}`);

    try {
      const notes = await api(`/api/groups/${group.id}/notes`);
      setSavedNotes(prev => {
        const otherGroupNotes = prev.filter(n => n.groupId !== group.id);
        return [...otherGroupNotes, ...notes];
      });
    } catch (err) {
      setToast('Could not load saved notes for this group');
    }
  }

  async function deleteGroup(groupId) {
    const ok = window.confirm('Delete this group? This cannot be undone.');
    if (!ok) return;

    try {
      await api(`/api/groups/${groupId}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Backend delete failed, removing from UI only for now.');
    }

    setGroups(groups.filter(g => g.id !== groupId));
    setSavedNotes(savedNotes.filter(n => n.groupId !== groupId));

    if (active?.id === groupId) {
      setActive(null);
      setNote({ title: 'Lecture Notes', body: '' });
      setEditingNoteId(null);
      setSummary('');
    }

    setGroupSummaries(prev => {
      const copy = { ...prev };
      delete copy[groupId];
      return copy;
    });
    setToast('Group deleted');
  }

  async function createGroup(e) {
    e.preventDefault();

    if (!groupForm.name.trim() || !groupForm.course.trim()) {
      setToast('Enter a group name and course first');
      return;
    }

    const group = await api('/api/groups', {
      method: 'POST',
      body: JSON.stringify({
        name: groupForm.name.trim(),
        course: groupForm.course.trim()
      })
    });

    setGroups([...groups, group]);
    setActive(group);
    setSavedNotes(prev => prev.filter(n => n.groupId !== group.id));
    setSummary('');
    setNote({ title: 'Lecture Notes', body: '' });
    setEditingNoteId(null);
    setGroupForm({ name: '', course: '' });
    socket.emit('join-group', group.id);
    setToast(`New study group created: ${group.name}`);
  }

  async function saveNote() {
    if (!active) {
      setToast('Select a group before saving a note');
      return;
    }

    if (!note.body.trim()) {
      setToast('Write some notes before saving');
      return;
    }

    const payload = { ...note, groupId: active.id };

    if (editingNoteId) {
      const updated = await api(`/api/groups/${active.id}/notes/${editingNoteId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      setSavedNotes(savedNotes.map(n => n.id === editingNoteId ? updated : n));
      setEditingNoteId(null);
      setNote({ title: 'Lecture Notes', body: '' });
      setToast('Note updated');
      return;
    }

    if (offline) {
      const queued = JSON.parse(localStorage.getItem('queuedNotes') || '[]');
      localStorage.setItem('queuedNotes', JSON.stringify([...queued, payload]));
      setSavedNotes([...savedNotes, payload]);
      setToast('Offline: note queued for later sync');
      return;
    }

    const saved = await api(`/api/groups/${active.id}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    setSavedNotes([...savedNotes, saved]);
    setNote({ title: 'Lecture Notes', body: '' });
    setToast('Note saved and pushed to your group');
  }

  function editSavedNote(saved) {
    setEditingNoteId(saved.id);
    setNote({
      title: saved.title,
      body: saved.body
    });
    setToast('Editing saved note');
  }

  async function deleteSavedNote(noteId) {
    const ok = window.confirm('Delete this note?');
    if (!ok) return;

    await api(`/api/groups/${active.id}/notes/${noteId}`, {
      method: 'DELETE'
    });

    setSavedNotes(savedNotes.filter(n => n.id !== noteId));

    if (editingNoteId === noteId) {
      setEditingNoteId(null);
      setNote({ title: 'Lecture Notes', body: '' });
    }

    setToast('Note deleted');
  }

  async function summarize() {
    if (!active) {
      setToast('Select a group before using AI summarize');
      return;
    }
  
    if (!note.body.trim()) {
      setToast('Write notes before using AI summarize');
      return;
    }
  
    try {
      setSummarizing(true);
      setToast('Generating AI study guide...');
  
      const data = await api('/api/ai/summarize', {
        method: 'POST',
        body: JSON.stringify({ text: note.body })
      });
  
      const output = data.summary || data.quiz?.join('\n') || 'No summary returned.';
  
      setSummary(output);
  
      setGroupSummaries(prev => ({
        ...prev,
        [active.id]: output
      }));
  
      setFlashcardIndex(0);
      setFlashcardFlipped(false);
      setToast('AI study guide ready');
    } catch (err) {
      setToast('AI summary failed');
    } finally {
      setSummarizing(false);
    }
  }
  const flashcards = parseFlashcards(summary);

  function nextFlashcard() {
    setFlashcardFlipped(false);
    setFlashcardIndex((flashcardIndex + 1) % flashcards.length);
  }

  function previousFlashcard() {
    setFlashcardFlipped(false);
    setFlashcardIndex((flashcardIndex - 1 + flashcards.length) % flashcards.length);
  }

  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <header className="sticky top-0 z-10 bg-white shadow">
      <nav className="mx-auto flex max-w-6xl items-center justify-between p-4">
        <h1 className="text-xl font-bold">AI Study Collab</h1>

        <div className="flex items-center gap-4">
          <span aria-live="polite" className="flex gap-2">
            {offline && <><WifiOff /> Offline</>}
            <Bell /> {toast}
          </span>

          <button
            onClick={onLogout}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-500"
          >
            Log out
          </button>
        </div>
      </nav>
    </header>

    <section className="mx-auto grid max-w-6xl gap-4 p-4 md:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl bg-white p-4 shadow">
        <h2 className="font-bold">Groups</h2>

        <form onSubmit={createGroup} className="my-3 grid gap-2">
          <input
            className="w-full rounded border p-2"
            placeholder="Group name"
            value={groupForm.name}
            onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
          />

          <input
            className="w-full rounded border p-2"
            placeholder="Course, ex: CS 144"
            value={groupForm.course}
            onChange={e => setGroupForm({ ...groupForm, course: e.target.value })}
          />

          <button className="w-full rounded bg-blue-700 p-3 text-white hover:bg-blue-600">
            Create group
          </button>
        </form>

        <div className="grid gap-2">
          {groups.length === 0 && (
            <p className="text-sm text-slate-500">No groups yet. Create one to start saving notes.</p>
          )}

          {groups.map(g => (
            <div
              key={g.id}
              className={`flex items-center gap-2 rounded border ${
                active?.id === g.id
                  ? 'border-blue-700 bg-blue-50 font-semibold'
                  : 'border-transparent hover:bg-slate-100'
              }`}
            >
              <button
                onClick={() => selectGroup(g)}
                className="flex-1 p-3 text-left"
              >
                {g.name}
                <br />
                <small>{g.course}</small>
              </button>

              <button
                onClick={() => deleteGroup(g.id)}
                className="mr-2 rounded px-2 py-1 text-xl hover:bg-red-100"
                aria-label={`Delete ${g.name}`}
                title="Delete group"
              >
                ⋯
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="grid gap-4">
        <article className="rounded-2xl bg-white p-4 shadow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Collaborative note editor</h2>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
              {active ? `Active group: ${active.name}` : 'No group selected'}
            </span>
          </div>

          {!active && (
            <p className="mt-3 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
              Create or select a group before saving notes.
            </p>
          )}

          {editingNoteId && (
            <p className="mt-3 rounded bg-blue-50 p-3 text-sm text-blue-800">
              Editing an existing note. Click Update note to save changes.
            </p>
          )}

          <input
            className="my-2 w-full rounded border p-3"
            value={note.title}
            onChange={e => setNote({ ...note, title: e.target.value })}
          />

          <textarea
            className="h-48 w-full rounded border p-3"
            placeholder="Type notes here. This can be saved offline and summarized by AI."
            value={note.body}
            onChange={e => setNote({ ...note, body: e.target.value })}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={saveNote}
              disabled={!active}
              className={`rounded px-4 py-2 text-white ${
                active
                  ? 'bg-slate-900 hover:bg-slate-700'
                  : 'cursor-not-allowed bg-slate-400'
              }`}
            >
              {editingNoteId ? 'Update note' : 'Save note'}
            </button>

            {editingNoteId && (
              <button
                onClick={() => {
                  setEditingNoteId(null);
                  setNote({ title: 'Lecture Notes', body: '' });
                  setToast('Edit cancelled');
                }}
                className="rounded bg-slate-200 px-4 py-2 hover:bg-slate-300"
              >
                Cancel edit
              </button>
            )}

            <button
              onClick={summarize}
              disabled={summarizing}
              className="rounded bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-600"
            >
              {summarizing ? (
                <>
                  <span className="inline-block animate-spin">⏳</span> Generating...
                </>
              ) : (
                <>
                  <Brain className="inline" /> AI summarize
                </>
              )}
            </button>
          </div>
        </article>

        {summary && (
          <article className="rounded-2xl bg-white p-4 shadow" aria-live="polite">
            <h2 className="font-bold">AI Output</h2>
            <p className="whitespace-pre-wrap">{removeFlashcardsFromSummary(summary)}</p>

            {flashcards.length > 0 && (
              <section className="mt-4 rounded-xl border bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold">Flashcard Mode</h3>
                  <span className="text-sm text-slate-600">
                    Card {flashcardIndex + 1} / {flashcards.length}
                  </span>
                </div>

                <button
                  onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                  className="min-h-40 w-full rounded-xl bg-white p-6 text-left shadow hover:bg-slate-100"
                >
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {flashcardFlipped ? 'Answer' : 'Question'}
                  </p>

                  <p className="mt-3 text-lg font-semibold">
                    {flashcardFlipped
                      ? flashcards[flashcardIndex].answer
                      : flashcards[flashcardIndex].question}
                  </p>

                  <p className="mt-4 text-sm text-slate-500">
                    Click card to flip
                  </p>
                </button>

                <div className="mt-3 flex justify-between gap-2">
                  <button
                    onClick={previousFlashcard}
                    className="rounded bg-slate-200 px-4 py-2 hover:bg-slate-300"
                  >
                    Previous
                  </button>

                  <button
                    onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                    className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-600"
                  >
                    Flip
                  </button>

                  <button
                    onClick={nextFlashcard}
                    className="rounded bg-slate-200 px-4 py-2 hover:bg-slate-300"
                  >
                    Next
                  </button>
                </div>
              </section>
            )}
          </article>
        )}

        {active && savedNotes.filter(saved => saved.groupId === active.id).length > 0 && (
          <article className="rounded-2xl bg-white p-4 shadow">
            <h2 className="font-bold">Saved notes this session</h2>

            <div className="mt-3 grid gap-2">
              {savedNotes
                .filter(saved => saved.groupId === active?.id)
                .map(saved => (
                  <section key={saved.id} className="rounded border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{saved.title}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {saved.body}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => editSavedNote(saved)}
                          className="rounded bg-blue-100 px-3 py-1 text-sm hover:bg-blue-200"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteSavedNote(saved.id)}
                          className="rounded bg-red-100 px-3 py-1 text-sm hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </section>
                ))}
            </div>
          </article>
        )}

        <CanvasBoard />
      </section>
    </section>
  </main>;
}

export default function App() {
  const [user, setUser] = useState(getToken() ? { name: 'User' } : null);

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return user ? <Dashboard onLogout={logout} /> : <Login onLogin={setUser} />;
}