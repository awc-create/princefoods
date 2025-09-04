// src/app/admin/chat/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import styles from './Chat.module.scss';

type EscItem = { threadId: string; preview: string; updatedAt: string };

type IncomingMessage = {
  threadId: string;
  from: string;
  subject: string;
  bodyHtml: string;
  updatedAt: string;
};

export default function AdminChatPage() {
  const [items, setItems] = useState<EscItem[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  // email bridge fields
  const [customerEmail, setCustomerEmail] = useState('');
  const [subject, setSubject] = useState('Re: your Prince Foods question');
  const [bodyHtml, setBodyHtml] = useState(
    'Hi! Thanks for your message — replying here by email is fine. We’ll keep everything in one place.'
  );

  useEffect(() => {
    const socket: Socket = io();

    socket.on('threads', (data: EscItem[]) => {
      setItems(data);
    });

    socket.on('message', (msg: IncomingMessage) => {
      // update preview when new message comes in
      setItems((prev) =>
        prev.map((item) =>
          item.threadId === msg.threadId
            ? { ...item, preview: msg.bodyHtml, updatedAt: msg.updatedAt }
            : item
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleReply = async () => {
    if (!activeThread || !reply.trim()) return;

    const res = await fetch('/api/admin/chat/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId: activeThread,
        reply,
        customerEmail,
        subject,
        bodyHtml,
      }),
    });

    if (res.ok) {
      setReply('');
    }
  };

  return (
    <div className={styles.chatContainer}>
      <aside className={styles.sidebar}>
        <h3>Threads</h3>
        <ul>
          {items.map((item) => (
            <li
              key={item.threadId}
              className={activeThread === item.threadId ? styles.active : ''}
              onClick={() => setActiveThread(item.threadId)}
            >
              <div className={styles.preview}>
                <strong>{item.threadId}</strong>
                <p>{item.preview}</p>
                <span>{new Date(item.updatedAt).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <main className={styles.threadView}>
        {activeThread ? (
          <>
            <div className={styles.replyBox}>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply..."
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    void handleReply();
                  }
                }}
              />
              <button onClick={handleReply}>Send Reply</button>
            </div>

            <div className={styles.emailBridge}>
              <h4>Email Bridge</h4>
              <input
                type="email"
                placeholder="Customer Email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <textarea
                placeholder="Body HTML"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
              />
            </div>
          </>
        ) : (
          <p>Select a thread to view</p>
        )}
      </main>
    </div>
  );
}
