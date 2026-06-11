import React, { useEffect, useMemo, useRef, useState } from 'react';
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

function CanvasBoard({ active, saveCanvasNote }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';

    let drawing = false;

    const pos = e => {
      const rect = canvas.getBoundingClientRect();

      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height
      };
    };

    const pointerDown = e => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };

    const pointerMove = e => {
      if (!drawing) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };

    const pointerUp = e => {
      drawing = false;
      canvas.releasePointerCapture(e.pointerId);
    };

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
    };
  }, []);

  const clearBoard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveBoard = () => {
    if (!active) {
      alert('Select a group before saving the canvas.');
      return;
    }

    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL('image/png');
    saveCanvasNote(imageData);
  };

  return (
    <article className="rounded-2xl bg-white p-4 shadow" aria-labelledby="canvas-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="canvas-title" className="font-bold">Canvas scratch board</h2>

        <div className="flex gap-2">
          <button
            onClick={clearBoard}
            className="rounded bg-slate-100 px-3 py-1 text-sm hover:bg-slate-200"
          >
            Clear
          </button>

          <button
            onClick={saveBoard}
            disabled={!active}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save as note
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width="960"
        height="360"
        className="mt-2 w-full touch-none rounded border bg-white"
        aria-label="Drawable study scratch board"
      />
    </article>
  );
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
  const [searchTerm, setSearchTerm] = useState('');
  const [quiz, setQuiz] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizFinished, setQuizFinished] = useState(false);
  const [publicGroups, setPublicGroups] = useState([]);
  const [groupDetails, setGroupDetails] = useState(null);
  const [showGroupDetails, setShowGroupDetails] = useState(false);

  const socket = useMemo(() => io(API, { auth: { token: getToken() } }), []);

  async function loadMyGroups() {
    const data = await api('/api/groups');
    setGroups(data);
    return data;
  }

  async function loadPublicGroups() {
    const data = await api('/api/groups/public');
    setPublicGroups(data);
    return data;
  }

  useEffect(() => {
    loadMyGroups().catch(() => {});
    loadPublicGroups().catch(() => {});

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
  }, [socket]);

  useEffect(() => {
    if (!active?.id) return;

    socket.emit('join-group', active.id);

    return () => {
      socket.emit('leave-group', active.id);
    };
  }, [socket, active?.id]);

  useEffect(() => {
    const handleDraftUpdate = ({ groupId, text }) => {
      const updatedNote = {
        title: note.title || 'Lecture Notes',
        body: text,
      };

      setGroupDrafts(prev => ({
        ...prev,
        [groupId]: updatedNote,
      }));

      if (active?.id === groupId && !editingNoteId) {
        setNote(updatedNote);
      }
    };

    socket.on('note-draft-updated', handleDraftUpdate);

    return () => {
      socket.off('note-draft-updated', handleDraftUpdate);
    };
  }, [socket, active?.id, note.title, editingNoteId]);

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
    setGroupDetails(null);
    setShowGroupDetails(false);
    setToast(`Selected group: ${group.name}`);

    try {
      const notes = await api(`/api/groups/${group.id}/notes`);
      setSavedNotes(prev => {
        const otherGroupNotes = prev.filter(n => n.groupId !== group.id);
        return [...otherGroupNotes, ...notes];
      });
    } catch (_err) {
      setToast('Could not load saved notes for this group');
    }
  }

  async function openGroupDetails() {
    if (!active?.id) return;

    try {
      const details = await api(`/api/groups/${active.id}/details`);
      setGroupDetails(details);
      setShowGroupDetails(true);
    } catch (_err) {
      setToast('Could not load group details');
    }
  }

  async function joinGroup(groupId) {
    const joined = await api(`/api/groups/${groupId}/join`, {
      method: 'POST',
    });

    await loadMyGroups();
    await loadPublicGroups();

    setActive(joined);
    setNote(groupDrafts[joined.id] || { title: 'Lecture Notes', body: '' });
    setSummary(groupSummaries[joined.id] || '');
    setEditingNoteId(null);
    setGroupDetails(null);
    setShowGroupDetails(false);
    setToast(`Joined group: ${joined.name}`);
  }

  async function leaveGroup(groupId) {
    const ok = window.confirm('Leave this group?');
    if (!ok) return;

    try {
      await api(`/api/groups/${groupId}/leave`, {
        method: 'POST',
      });

      await loadMyGroups();
      await loadPublicGroups();

      if (active?.id === groupId) {
        setActive(null);
        setNote({ title: 'Lecture Notes', body: '' });
        setEditingNoteId(null);
        setSummary('');
        setGroupDetails(null);
        setShowGroupDetails(false);
      }

      setToast('Left group');
    } catch (_err) {
      setToast('Could not leave group');
    }
  }

  async function deleteGroup(groupId) {
    const ok = window.confirm('Delete this group? This cannot be undone.');
    if (!ok) return;

    try {
      await api(`/api/groups/${groupId}`, { method: 'DELETE' });

      await loadMyGroups();
      await loadPublicGroups();

      setSavedNotes(savedNotes.filter(n => n.groupId !== groupId));

      if (active?.id === groupId) {
        setActive(null);
        setNote({ title: 'Lecture Notes', body: '' });
        setEditingNoteId(null);
        setSummary('');
        setGroupDetails(null);
        setShowGroupDetails(false);
      }

      setGroupSummaries(prev => {
        const copy = { ...prev };
        delete copy[groupId];
        return copy;
      });

      setGroupDrafts(prev => {
        const copy = { ...prev };
        delete copy[groupId];
        return copy;
      });

      setToast('Group deleted');
    } catch (_err) {
      setToast('Only the group owner can delete this group');
    }
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

    const myGroups = await loadMyGroups();
    await loadPublicGroups();

    const createdGroup = myGroups.find(g => g.id === group.id) || { ...group, isOwner: true };

    setActive(createdGroup);
    setSavedNotes(prev => prev.filter(n => n.groupId !== group.id));
    setSummary('');
    setNote({ title: 'Lecture Notes', body: '' });
    setEditingNoteId(null);
    setGroupDetails(null);
    setShowGroupDetails(false);
    setGroupForm({ name: '', course: '' });
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
    setGroupDrafts(prev => ({
      ...prev,
      [active.id]: { title: 'Lecture Notes', body: '' }
    }));
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

  const handleNoteDragStart = (e, noteId) => {
    e.dataTransfer.setData('text/plain', noteId);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleNoteDrop = (e, targetNoteId) => {
    e.preventDefault();
  
    const draggedNoteId = e.dataTransfer.getData('text/plain');
    if (!draggedNoteId || draggedNoteId === targetNoteId) return;
  
    setSavedNotes(prev => {
      const notes = [...prev];
  
      const draggedIndex = notes.findIndex(n => n.id === draggedNoteId);
      const targetIndex = notes.findIndex(n => n.id === targetNoteId);
  
      if (draggedIndex === -1 || targetIndex === -1) return prev;
  
      const [draggedNote] = notes.splice(draggedIndex, 1);
      notes.splice(targetIndex, 0, draggedNote);
  
      return notes;
    });
  };

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
      setQuiz([]);
      setQuizFinished(false);
      setQuizAnswers([]);
      setSelectedAnswer(null);
      setQuizIndex(0);

      setGroupSummaries(prev => ({
        ...prev,
        [active.id]: output
      }));

      setFlashcardIndex(0);
      setFlashcardFlipped(false);
      setToast('AI study guide ready');
    } catch (_err) {
      setToast('AI summary failed');
    } finally {
      setSummarizing(false);
    }
  }
  const saveCanvasNote = async imageData => {
    if (!active) return;
  
    const saved = await api(`/api/groups/${active.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'Canvas note',
        body: imageData,
        type: 'image'
      })
    });
  
    setSavedNotes(prev => [saved, ...prev]);
  };

  async function generateQuiz() {
    if (!active) {
      setToast('Select a group before generating a quiz');
      return;
    }

    if (!note.body.trim()) {
      setToast('Write notes before generating a quiz');
      return;
    }

    try {
      setQuizLoading(true);
      setToast('Generating quiz...');

      const data = await api('/api/ai/quiz', {
        method: 'POST',
        body: JSON.stringify({ text: note.body })
      });

      setQuiz(data.questions || []);
      setQuizIndex(0);
      setSelectedAnswer(null);
      setQuizAnswers([]);
      setQuizFinished(false);
      setToast('Quiz ready');
    } catch (_err) {
      setToast('Quiz generation failed');
    } finally {
      setQuizLoading(false);
    }
  }

  function submitQuizAnswer() {
    if (selectedAnswer === null) {
      setToast('Choose an answer first');
      return;
    }

    const updatedAnswers = [...quizAnswers, selectedAnswer];
    setQuizAnswers(updatedAnswers);

    if (quizIndex + 1 >= quiz.length) {
      setQuizFinished(true);
    } else {
      setQuizIndex(quizIndex + 1);
      setSelectedAnswer(null);
    }
  }

  function resetQuiz() {
    setQuizIndex(0);
    setSelectedAnswer(null);
    setQuizAnswers([]);
    setQuizFinished(false);
  }

  const flashcards = parseFlashcards(summary);

  const filteredNotes = savedNotes
    .filter(saved => saved.groupId === active?.id)
    .filter(saved =>
      saved.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      saved.body.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

              {g.isOwner ? (
                <button
                  onClick={() => deleteGroup(g.id)}
                  className="mr-2 rounded px-2 py-1 text-xl hover:bg-red-100"
                  aria-label={`Delete ${g.name}`}
                  title="Delete group"
                >
                  ⋯
                </button>
              ) : (
                <button
                  onClick={() => leaveGroup(g.id)}
                  className="mr-2 rounded px-2 py-1 text-sm hover:bg-yellow-100"
                  aria-label={`Leave ${g.name}`}
                  title="Leave group"
                >
                  Leave
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h2 className="font-bold">Discover Groups</h2>

          <div className="mt-3 grid gap-2">
            {publicGroups
              .filter(g => !groups.some(myGroup => myGroup.id === g.id))
              .map(g => (
                <div key={g.id} className="rounded border p-3">
                  <p className="font-semibold">{g.name}</p>
                  <p className="text-sm text-slate-500">{g.course}</p>
                  <p className="text-xs text-slate-400">
                    Owner: {g.ownerName || 'Unknown owner'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
                  </p>

                  <button
                    onClick={() => joinGroup(g.id)}
                    className="mt-2 rounded bg-green-700 px-3 py-1 text-sm text-white hover:bg-green-600"
                  >
                    Join
                  </button>
                </div>
              ))}

            {publicGroups.filter(g => !groups.some(myGroup => myGroup.id === g.id)).length === 0 && (
              <p className="text-sm text-slate-500">
                No new groups to join.
              </p>
            )}
          </div>
        </div>
      </aside>

      <section className="grid gap-4">
        <article className="rounded-2xl bg-white p-4 shadow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Collaborative note editor</h2>

            <button
              onClick={openGroupDetails}
              disabled={!active}
              className="rounded-full bg-slate-100 px-3 py-1 text-sm hover:bg-slate-200 disabled:cursor-not-allowed"
            >
              {active ? `Active group: ${active.name}` : 'No group selected'}
            </button>
          </div>

          {showGroupDetails && groupDetails && (
            <div className="mt-3 rounded border bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{groupDetails.name}</h3>
                <button
                  onClick={() => setShowGroupDetails(false)}
                  className="rounded px-2 py-1 hover:bg-slate-200"
                >
                  Close
                </button>
              </div>

              <p className="text-sm text-slate-600">
                Course: {groupDetails.course}
              </p>

              <p className="mt-2 text-sm font-semibold">
                Owner: {groupDetails.ownerName}
              </p>

              <div className="mt-3">
                <p className="text-sm font-semibold">Members:</p>

                <ul className="mt-1 list-disc pl-5 text-sm">
                  {groupDetails.members?.map(member => (
                    <li key={member.id}>
                      {member.name}
                      {member.isOwner ? ' (Owner)' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

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
            onChange={e => {
              const updatedNote = { ...note, title: e.target.value };
              setNote(updatedNote);

              if (active?.id && !editingNoteId) {
                setGroupDrafts(prev => ({
                  ...prev,
                  [active.id]: updatedNote,
                }));
              }
            }}
          />

          <textarea
            className="h-48 w-full rounded border p-3"
            placeholder="Type notes here. This can be saved offline and summarized by AI."
            value={note.body}
            onChange={(e) => {
              const text = e.target.value;

              const updatedNote = {
                ...note,
                body: text,
              };

              setNote(updatedNote);

              if (active?.id && !editingNoteId) {
                setGroupDrafts(prev => ({
                  ...prev,
                  [active.id]: updatedNote,
                }));

                socket.emit('note-draft-change', {
                  groupId: active.id,
                  text,
                });
              }
            }}
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
              className="rounded bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-600 disabled:opacity-50"
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
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">AI Output</h2>

              <button
                onClick={generateQuiz}
                disabled={quizLoading}
                className="rounded bg-purple-700 px-4 py-2 text-white hover:bg-purple-600 disabled:opacity-50"
              >
                {quizLoading ? 'Generating quiz...' : 'Generate Quiz'}
              </button>
            </div>

            <p className="mt-3 whitespace-pre-wrap">{removeFlashcardsFromSummary(summary)}</p>

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

        {quiz.length > 0 && (
          <article className="rounded-2xl bg-white p-4 shadow">
            <h2 className="font-bold">AI Quiz Mode</h2>

            {!quizFinished ? (
              <section className="mt-3">
                <p className="text-sm text-slate-500">
                  Question {quizIndex + 1} / {quiz.length}
                </p>

                <h3 className="mt-2 text-lg font-semibold">
                  {quiz[quizIndex].question}
                </h3>

                <div className="mt-3 grid gap-2">
                  {quiz[quizIndex].choices.map((choice, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedAnswer(index)}
                      className={`rounded border p-3 text-left ${
                        selectedAnswer === index
                          ? 'border-purple-700 bg-purple-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>

                <button
                  onClick={submitQuizAnswer}
                  className="mt-3 rounded bg-purple-700 px-4 py-2 text-white hover:bg-purple-600"
                >
                  Submit answer
                </button>
              </section>
            ) : (
              <section className="mt-3">
                <h3 className="text-lg font-semibold">
                  Score: {
                    quizAnswers.filter(
                      (answer, index) => answer === quiz[index].answerIndex
                    ).length
                  } / {quiz.length}
                </h3>

                <div className="mt-3 grid gap-3">
                  {quiz.map((question, index) => {
                    const correct = quizAnswers[index] === question.answerIndex;

                    return (
                      <section key={index} className="rounded border p-3">
                        <p className="font-semibold">{question.question}</p>

                        <p className={correct ? 'text-green-700' : 'text-red-700'}>
                          Your answer: {question.choices[quizAnswers[index]]}
                        </p>

                        <p className="text-slate-700">
                          Correct answer: {question.choices[question.answerIndex]}
                        </p>
                      </section>
                    );
                  })}
                </div>

                <button
                  onClick={resetQuiz}
                  className="mt-3 rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
                >
                  Retake quiz
                </button>
              </section>
            )}
          </article>
        )}

        {active && savedNotes.filter(saved => saved.groupId === active.id).length > 0 && (
          <article className="rounded-2xl bg-white p-4 shadow">
            <h2 className="font-bold">Saved notes this session</h2>

            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="mt-3 w-full rounded border p-2"
            />

            {searchTerm && (
              <p className="mt-2 text-sm text-slate-500">
                Found {filteredNotes.length} matching note{filteredNotes.length !== 1 ? 's' : ''}
              </p>
            )}

            <div className="mt-3 grid gap-2">
              {filteredNotes.map(saved => (
                <section
                  key={saved.id} 
                  draggable
                  onDragStart={e => handleNoteDragStart(e, saved.id)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleNoteDrop(e, saved.id)}
                  className="cursor-move rounded border p-3"
                  aria-label={`Draggable note ${saved.title}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{saved.title}</h3>
                      {saved.type === 'image' ? (
                        <div className="mt-2">
                          <img
                            src={saved.body}
                            alt={saved.title || 'Canvas note'}
                            className="max-h-72 max-w-full rounded border bg-white object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const win = window.open();
                              win.document.write(`
                                <img 
                                  src="${saved.body}" 
                                  alt="Canvas note" 
                                  style="max-width:100%;height:auto;" 
                                />
                              `);
                              win.document.close();
                            }}
                            className="mt-2 text-sm text-blue-700 underline"
                          >
                            Open canvas image
                          </button>
                        </div>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                          {saved.body}
                        </p>
                      )}
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

        <CanvasBoard active={active} saveCanvasNote={saveCanvasNote} />
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