'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSearchParams } from 'next/navigation';
import styles from './Chat.module.scss';

type EscItem = { threadId: string; preview: string; updatedAt: string };
type ChatMsg = { id?: string; role: 'user'|'assistant'|'admin'|'system'; content: string; createdAt?: string };

export default function AdminChatPage() {
  const [items, setItems] = useState<EscItem[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [reply, setReply] = useState('');

  // email bridge fields
  const [customerEmail, setCustomerEmail] = useState('');
  const [subject, setSubject] = useState('Re: your Prince Foods question');
  const [bodyHtml, setBodyHtml] = useState(
    'Hi! Thanks for your message — replying here by email is fine. We’ll keep everything in one place.'
  );
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailOpen, setEmailOpen] = useState(true);

  const searchParams = useSearchParams();
  const threadIdParam = searchParams ? searchParams.get('threadId') : null;

  // sockets
  const socketRef = useRef<Socket | null>(null);
  const currentRoomRef = useRef<string | null>(null);

  // autoscroll
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = useMemo(
    () => () => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); },
    []
  );

  // Socket bootstrap
  useEffect(() => {
    fetch('/api/socket'); // init server
    const s = io({ path: '/api/socket' });
    socketRef.current = s;

    // admin escalations stream
    s.emit('join', 'admins');
    s.on('new_escalation', (e: any) => {
      setItems(prev => [
        { threadId: e.threadId, preview: e.preview, updatedAt: new Date().toISOString() },
        ...prev,
      ]);
    });

    // thread messages stream (we'll join the thread room when selected)
    s.on('message', (m: ChatMsg) => {
      setMessages(prev => [...prev, m]);
      // keep scrolled to bottom on new messages
      setTimeout(scrollToBottom, 0);
    });

    return () => {
      s.off('new_escalation');
      s.off('message');
      s.disconnect();
    };
  }, [scrollToBottom]);

  // Initial load of escalations
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/escalations');
        if (res.ok) {
          const data = (await res.json()) as EscItem[];
          setItems(data);
        }
      } catch { /* no-op */ }
    })();
  }, []);

  // Deep-link to specific thread via ?threadId=...
  useEffect(() => {
    if (threadIdParam) setActiveThread(threadIdParam);
  }, [threadIdParam]);

  // Load messages & join room whenever the active thread changes
  useEffect(() => {
    if (!activeThread) return;

    // 1) fetch history
    (async () => {
      const res = await fetch(`/api/admin/threads/${activeThread}/messages`);
      if (res.ok) {
        const { thread, messages } = (await res.json()) as {
          thread: { customerEmail?: string };
          messages: ChatMsg[];
        };
        setMessages(messages);
        if (thread?.customerEmail) setCustomerEmail(thread.customerEmail);
        setTimeout(scrollToBottom, 0);
      } else {
        setMessages([{ role: 'system', content: 'Unable to load messages.' }]);
      }
    })();

    // 2) join socket room, leave previous
    const room = `thread-${activeThread}`;
    const s = socketRef.current;
    if (s) {
      if (currentRoomRef.current) s.emit('leave', currentRoomRef.current);
      s.emit('join', room);
      currentRoomRef.current = room;
    }

    // cleanup leaves current room on unmount/change
    return () => {
      const s2 = socketRef.current;
      if (s2 && currentRoomRef.current === room) {
        s2.emit('leave', room);
        currentRoomRef.current = null;
      }
    };
  }, [activeThread, scrollToBottom]);

  async function sendReply() {
    if (!activeThread || !reply.trim()) return;
    const content = reply.trim();
    setReply('');
    // Let socket broadcast deliver the message; no optimistic append to avoid duplicates
    await fetch('/api/admin/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: activeThread, content })
    });
  }

  async function moveToEmail() {
    if (!activeThread) return;
    const to = customerEmail.trim();
    if (!to) { alert('Enter the customer email first.'); return; }
    setSendingEmail(true);
    try {
      const res = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: activeThread,
          to,
          subject,
          html: `<p>${bodyHtml}</p>`,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to send email');
      }
      alert('Sent! Customer can reply by email; replies will appear in this thread.');
    } catch (e: any) {
      alert(e.message || 'Error sending');
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Admin Chat</h1>

      <div className={styles.grid}>
        {/* Inbox */}
        <aside className={styles.inbox}>
          <div className={styles.inboxHeader}>
            <span>Escalations</span>
            <span className={styles.badge}>{items.length}</span>
          </div>

          {items.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>💬</div>
              <div>No escalations yet</div>
              <p className={styles.emptySub}>When a chat is escalated, it will appear here.</p>
            </div>
          ) : (
            <ul className={styles.threadList}>
              {items.map((it) => (
                <li key={it.threadId}>
                  <button
                    onClick={() => setActiveThread(it.threadId)}
                    className={`${styles.threadItem} ${activeThread === it.threadId ? styles.active : ''}`}
                  >
                    <div className={styles.threadTop}>
                      <span className={styles.threadId}>#{it.threadId.slice(0, 8)}</span>
                      <time className={styles.time}>
                        {new Date(it.updatedAt).toLocaleString()}
                      </time>
                    </div>
                    <div className={styles.preview}>{it.preview}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Conversation panel */}
        <section className={styles.chat}>
          <div className={styles.chatHeader}>
            <div className={styles.threadLabel}>
              <span className={styles.threadTitle}>Thread:</span>
              <span className={styles.threadValue}>{activeThread ? `#${activeThread.slice(0, 8)}` : '—'}</span>
              {activeThread && <span className={styles.statusPill}>Open</span>}
            </div>
            <div className={styles.headerActions}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setEmailOpen(v => !v)}
                disabled={!activeThread}
              >
                {emailOpen ? 'Hide' : 'Show'} Email Panel
              </button>
            </div>
          </div>

          {/* Email bridge panel */}
          <div className={`${styles.emailPanel} ${emailOpen ? styles.open : ''} ${!activeThread ? styles.disabled : ''}`}>
            <div className={styles.fieldRow}>
              <label>Customer Email</label>
              <input
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                disabled={!activeThread}
              />
            </div>
            <div className={styles.fieldRow}>
              <label>Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={!activeThread}
              />
            </div>
            <div className={styles.fieldCol}>
              <label>Email Body</label>
              <textarea
                rows={3}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                disabled={!activeThread}
              />
            </div>
            <div className={styles.emailActions}>
              <button
                className={styles.primaryBtn}
                onClick={moveToEmail}
                disabled={!activeThread || sendingEmail}
                title="Send an email to the customer; replies will return to this thread."
              >
                {sendingEmail ? 'Sending…' : 'Move to email'}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className={styles.messages} ref={listRef}>
            {!activeThread ? (
              <div className={styles.messagesEmpty}>
                Select a thread to view messages
              </div>
            ) : messages.length === 0 ? (
              <div className={styles.messagesEmpty}>
                No messages yet.
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={m.id ?? i}
                  className={`${styles.msgRow} ${m.role === 'user' ? styles.left : styles.right}`}
                >
                  <div className={`${styles.msgBubble} ${m.role === 'user' ? styles.user : m.role === 'admin' ? styles.admin : styles.assistant}`}>
                    {m.content}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Composer */}
          <div className={styles.composer}>
            <input
              className={styles.input}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type a reply…"
              disabled={!activeThread}
              onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
            />
            <button
              className={styles.primaryBtn}
              onClick={sendReply}
              disabled={!activeThread || !reply.trim()}
            >
              Send
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
