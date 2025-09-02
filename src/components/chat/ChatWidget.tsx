'use client';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type Msg = { role: 'user' | 'assistant' | 'admin'; content: string };

export default function ChatWidget() {
  const [userKey, setUserKey] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const socketRef = useRef<Socket | null>(null);

  // Browser-only: get or create a stable user key
  useEffect(() => {
    const k = 'pf_user_key';
    try {
      if (typeof window === 'undefined') return; // safety
      let v = window.localStorage.getItem(k);
      if (!v) {
        const id =
          (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
        window.localStorage.setItem(k, id);
        v = id;
      }
      setUserKey(v);
    } catch {
      // last-resort fallback (not persisted)
      setUserKey(Math.random().toString(36).slice(2));
    }
  }, []);

  // Init socket only after we have a userKey (client-only)
  useEffect(() => {
    if (!userKey) return;
    fetch('/api/socket'); // ensure IO server is bootstrapped
    const s = io({ path: '/api/socket' });
    socketRef.current = s;

    if (threadId) s.emit('join', `thread-${threadId}`);
    s.on('message', (m: Msg) => setMessages(prev => [...prev, m]));

    return () => { s.disconnect(); };
  }, [userKey, threadId]);

  async function send() {
    const text = input.trim();
    if (!text || !userKey) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');

    const res = await fetch('/api/chat/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, userKey, threadId })
    }).then(r => r.json());

    setThreadId(res.threadId);
    socketRef.current?.emit('join', `thread-${res.threadId}`);
    setMessages(prev => [...prev, { role: 'assistant', content: res.answer }]);
  }

  // Optionally render nothing until ready (avoids flicker)
  if (!userKey) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 rounded-xl shadow-lg bg-white border">
      <div className="p-3 font-semibold border-b">Help • Policies & FAQs</div>
      <div className="p-3 space-y-2 max-h-80 overflow-auto text-sm">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div className={`inline-block px-3 py-2 rounded-lg ${m.role==='user'?'bg-black text-white':'bg-gray-100'}`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <div className="p-2 flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1 text-sm"
          value={input}
          onChange={e=>setInput(e.target.value)}
          placeholder="Ask about returns, delivery…"
        />
        <button onClick={send} className="px-3 py-1 rounded bg-black text-white text-sm">Send</button>
      </div>
    </div>
  );
}
