'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './PrinceChat.module.scss';
import { io, Socket } from 'socket.io-client';

// --- util: persistent anonymous user key
function getUserKey() {
  if (typeof window === 'undefined') return 'server';
  const k = 'pf_user_key';
  let v = localStorage.getItem(k);
  if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); }
  return v;
}

// --- brand chat/crown icon (inline SVG)
function CrownChatIcon({className}:{className?:string}) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      {/* crown */}
      <path d="M10 22l8-8 6 8 8-12 8 12 6-8 8 8v18H10V22z" fill="currentColor" opacity="0.9"/>
      {/* bubble */}
      <path d="M12 36c0-8.8 9.2-16 20.5-16S53 27.2 53 36s-9.2 16-20.5 16c-2.8 0-5.5-.4-8-1.2L12 55l3.7-6.1c-2.3-3-3.7-6.5-3.7-10z"
            fill="currentColor"/>
    </svg>
  );
}

type Msg = { role: 'user'|'assistant'|'admin'; content: string };

export default function PrinceChat() {
  const [open, setOpen] = useState<boolean>(() => (typeof window !== 'undefined' && localStorage.getItem('pf_chat_open') === '1'));
  const [threadId, setThreadId] = useState<string | null>(() => (typeof window !== 'undefined' ? localStorage.getItem('pf_thread_id') : null));
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);

  // TEASER
  const [showTeaser, setShowTeaser] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const userKey = useMemo(() => getUserKey(), []);

  // Idle close (client-side fallback)
  const idleTimerRef = useRef<number | null>(null);
  const IDLE_MIN = Number(process.env.NEXT_PUBLIC_CHAT_IDLE_MINUTES || 8);

  function clearIdleTimer() {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }

  function scheduleIdleClose() {
    clearIdleTimer();
    if (!threadId) return;
    idleTimerRef.current = window.setTimeout(async () => {
      try {
        await fetch('/api/chat/auto-close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId })
        });
      } catch {}
      // Locally close/reset and show a subtle line in the history
      setOpen(false);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Chat closed due to inactivity. Start a new chat any time.' }]);
      localStorage.removeItem('pf_thread_id');
      setThreadId(null);
    }, IDLE_MIN * 60_000);
  }

  // init socket server, connect socket
  useEffect(() => {
    fetch('/api/socket'); // initialize server once
    const s = io({ path: '/api/socket' });
    socketRef.current = s;

    if (threadId) s.emit('join', `thread-${threadId}`);

    s.on('message', (m: Msg) => {
      setMessages(prev => [...prev, m]);
      if (!open && (m.role === 'assistant' || m.role === 'admin')) {
        setUnread(u => Math.min(99, u + 1));
      }
      // If bot/admin spoke, start waiting for user
      if (m.role === 'assistant' || m.role === 'admin') scheduleIdleClose();
    });

    return () => { s.disconnect(); clearIdleTimer(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist open state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pf_chat_open', open ? '1' : '0');
    }
    if (open) {
      setUnread(0);
      setShowTeaser(false);
    }
  }, [open]);

  // join room when thread appears
  useEffect(() => {
    if (threadId && socketRef.current) {
      socketRef.current.emit('join', `thread-${threadId}`);
      localStorage.setItem('pf_thread_id', threadId);
    }
  }, [threadId]);

  // TEASER: show once per user after 10s, auto-hide after 6s
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (open) return; // don't show if already open
    const seenKey = 'pf_chat_teaser_seen';
    const alreadySeen = localStorage.getItem(seenKey) === '1';
    if (alreadySeen) return;

    const showTimer = setTimeout(() => {
      setShowTeaser(true);
      localStorage.setItem(seenKey, '1');
      const hideTimer = setTimeout(() => setShowTeaser(false), 6000);
      return () => clearTimeout(hideTimer);
    }, 10000);

    return () => clearTimeout(showTimer);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text) return;

    // User replied, stop idle timer
    clearIdleTimer();

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');

    const res = await fetch('/api/chat/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, userKey, threadId })
    }).then(r => r.json());

    if (!threadId && res.threadId) setThreadId(res.threadId);
    setMessages(prev => [...prev, { role: 'assistant', content: res.answer }]);

    // Assistant spoke; wait for user's next reply
    scheduleIdleClose();
  }

  return (
    <>
      {/* Bubble / FAB */}
      {!open && (
        <>
          <button
            className={`${styles.fab} ${unread > 0 ? styles.fabNotify : ''}`}
            aria-label="Open chat"
            onClick={() => { setOpen(true); setShowTeaser(false); }}
          >
            <span className={styles.fabIconWrap}>
              <CrownChatIcon className={styles.fabIcon}/>
            </span>
            <span className={styles.fabLabel}>Chat</span>
            {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
          </button>

          {/* TEASER bubble */}
          {showTeaser && (
            <div className={styles.teaser} role="status" aria-live="polite" onClick={() => setShowTeaser(false)}>
              <span>Hi, can we help?</span>
            </div>
          )}
        </>
      )}

      {/* Panel */}
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Prince Foods chat">
          <header className={styles.header}>
            <div className={styles.brand}>
              <CrownChatIcon className={styles.headerIcon}/>
              <div>
                <div className={styles.title}>Prince Foods Help</div>
                <div className={styles.subtitle}>
                  <span className={styles.dot}/> Online
                </div>
              </div>
            </div>
            <button className={styles.close} aria-label="Close chat" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className={styles.history}>
            {messages.length === 0 && (
              <div className={styles.welcome}>
                👋 Hi! Ask about <strong>delivery, returns, frozen packing</strong>, or anything from our FAQs & policies.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`${styles.row} ${m.role === 'user' ? styles.right : styles.left}`}>
                <div className={`${styles.bubble} ${m.role === 'user' ? styles.me : styles.them}`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.inputBar}>
            <input
              className={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about returns, delivery…"
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
            />
            <button className={styles.send} onClick={send} aria-label="Send message">
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
