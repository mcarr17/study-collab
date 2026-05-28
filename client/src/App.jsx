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
    setToken(data.token); onLogin(data.user);
  };
  return <main className="min-h-screen grid place-items-center bg-slate-950 text-white p-4">
    <section className="w-full max-w-md rounded-2xl bg-white/10 p-6 shadow-xl" aria-labelledby="login-title">
      <h1 id="login-title" className="text-3xl font-bold">AI Study Collab</h1>
      <p className="mt-2 text-slate-200">Collaborative notes, AI summaries, offline drafts, and realtime group updates.</p>
      <form onSubmit={submit} className="mt-6 grid gap-3">
        {mode === 'register' && <label>Name<input className="mt-1 w-full rounded p-3 text-black" value={form.name} onChange={e => setForm({...form, name:e.target.value})} required /></label>}
        <label>Email<input type="email" className="mt-1 w-full rounded p-3 text-black" value={form.email} onChange={e => setForm({...form, email:e.target.value})} required /></label>
        <label>Password<input type="password" minLength="8" className="mt-1 w-full rounded p-3 text-black" value={form.password} onChange={e => setForm({...form, password:e.target.value})} required /></label>
        <button className="rounded bg-blue-500 p-3 font-semibold hover:bg-blue-400">{mode === 'register' ? 'Create account' : 'Log in'}</button>
      </form>
      <button className="mt-4 underline" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>Switch to {mode === 'register' ? 'login' : 'register'}</button>
    </section>
  </main>;
}

function CanvasBoard() {
  useEffect(() => {
    const canvas = document.getElementById('study-canvas');
    const ctx = canvas.getContext('2d');
    let drawing = false;
    const pos = e => ({ x: e.offsetX, y: e.offsetY });
    canvas.onpointerdown = e => { drawing = true; ctx.beginPath(); const p = pos(e); ctx.moveTo(p.x, p.y); };
    canvas.onpointermove = e => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    canvas.onpointerup = () => drawing = false;
  }, []);
  return <article className="rounded-2xl bg-white p-4 shadow" aria-labelledby="canvas-title">
    <h2 id="canvas-title" className="font-bold">Canvas scratch board</h2>
    <canvas id="study-canvas" width="480" height="180" className="mt-2 w-full rounded border" aria-label="Drawable study scratch board"></canvas>
  </article>;
}

function Dashboard() {
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(null);
  const [note, setNote] = useState({ title: 'Lecture Notes', body: '' });
  const [summary, setSummary] = useState('');
  const [toast, setToast] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const socket = useMemo(() => io(API, { auth: { token: getToken() } }), []);

  useEffect(() => {
    api('/api/groups').then(setGroups).catch(() => {});
    socket.on('server-notification', n => setToast(n.text));
    const on = () => setOffline(false), off = () => setOffline(true);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { socket.disconnect(); removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);

  async function createGroup() {
    const group = await api('/api/groups', { method:'POST', body: JSON.stringify({ name: 'CS 144 Final Team', course: 'CS 144' }) });
    setGroups([...groups, group]); setActive(group); socket.emit('join-group', group.id);
  }
  async function saveNote() {
    if (!active) return;
    const payload = { ...note, groupId: active.id };
    if (offline) {
      const queued = JSON.parse(localStorage.getItem('queuedNotes') || '[]');
      localStorage.setItem('queuedNotes', JSON.stringify([...queued, payload]));
      setToast('Offline: note queued for later sync'); return;
    }
    await api(`/api/groups/${active.id}/notes`, { method:'POST', body: JSON.stringify(payload) });
    setToast('Note saved and pushed to your group');
  }
  async function summarize() {
    const data = await api('/api/ai/summarize', { method:'POST', body: JSON.stringify({ text: note.body }) });
    setSummary(data.summary || data.quiz?.join('\n'));
  }

  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <header className="sticky top-0 z-10 bg-white shadow"><nav className="mx-auto flex max-w-6xl items-center justify-between p-4"><h1 className="text-xl font-bold">AI Study Collab</h1><span aria-live="polite" className="flex gap-2">{offline && <><WifiOff /> Offline</>}<Bell /> {toast}</span></nav></header>
    <section className="mx-auto grid max-w-6xl gap-4 p-4 md:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl bg-white p-4 shadow"><h2 className="font-bold">Groups</h2><button onClick={createGroup} className="my-3 w-full rounded bg-blue-700 p-3 text-white">Create demo group</button>{groups.map(g => <button key={g.id} onClick={() => { setActive(g); socket.emit('join-group', g.id); }} className="block w-full rounded p-2 text-left hover:bg-slate-100">{g.name}<br/><small>{g.course}</small></button>)}</aside>
      <section className="grid gap-4">
        <article className="rounded-2xl bg-white p-4 shadow"><h2 className="font-bold">Collaborative note editor</h2><input className="my-2 w-full rounded border p-3" value={note.title} onChange={e => setNote({...note,title:e.target.value})}/><textarea className="h-48 w-full rounded border p-3" placeholder="Type notes here. This can be saved offline and summarized by AI." value={note.body} onChange={e => setNote({...note,body:e.target.value})}/><div className="mt-3 flex flex-wrap gap-2"><button onClick={saveNote} className="rounded bg-slate-900 px-4 py-2 text-white">Save note</button><button onClick={summarize} className="rounded bg-emerald-700 px-4 py-2 text-white"><Brain className="inline"/> AI summarize</button></div></article>
        {summary && <article className="rounded-2xl bg-white p-4 shadow" aria-live="polite"><h2 className="font-bold">AI Output</h2><p className="whitespace-pre-wrap">{summary}</p></article>}
        <CanvasBoard />
      </section>
    </section>
  </main>;
}

export default function App() {
  const [user, setUser] = useState(getToken() ? { name: 'User' } : null);
  return user ? <Dashboard /> : <Login onLogin={setUser} />;
}
