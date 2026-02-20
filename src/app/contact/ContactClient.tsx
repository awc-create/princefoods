'use client';

import { useEffect, useState } from 'react';
import styles from './Contact.module.scss';

interface FormState {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  address?: string;
  company?: string; // honeypot
}

export default function ContactClient() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    address: '',
    company: ''
  });

  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<null | string>(null);
  const [err, setErr] = useState<null | string>(null);
  const [copied, setCopied] = useState(false);

  const onChange =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    setErr(null);

    // Custom validation only (no browser popups)
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setErr('Please fill in your name, email, and message.');
      return;
    }

    // Honeypot (bot protection)
    if (form.company?.trim()) {
      setOk('Thanks — we’ve got your message. We’ll reply within 24–48 hours.');
      resetForm();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = res.ok ? ((await res.json()) as { ticketId?: string }) : {};

      setOk(
        `Thanks — we’ve got it${
          data?.ticketId ? ` (ticket #${data.ticketId})` : ''
        }. We’ll reply within 24–48 hours.`
      );

      resetForm();
    } catch {
      setErr('Something went wrong. Please try again or email support@prince-foods.com.');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
      address: '',
      company: ''
    });
  }

  function copyEmail() {
    try {
      navigator.clipboard.writeText('support@prince-foods.com');
      setCopied(true);
    } catch {
      // ignore clipboard errors
    }
  }

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <section className={styles.wrapper} aria-labelledby="contact-heading">
      <div className={styles.inner}>
        {/* LEFT SIDE */}
        <div className={styles.left}>
          <h1 id="contact-heading">We’re here to help</h1>

          <p className={styles.sub}>
            Questions about orders, products, or wholesale? Our team usually replies within{' '}
            <strong>24–48 hours</strong>.
          </p>

          {/* Email chip */}
          <div className={styles.contactRow} role="group" aria-label="Email">
            <button
              type="button"
              className={styles.rowIconBtn}
              aria-label="Copy email"
              onClick={copyEmail}
            >
              ✉️
            </button>

            <a className={styles.emailLink} href="mailto:support@prince-foods.com">
              support@prince-foods.com
            </a>

            <span aria-live="polite" className={styles.copyToast} data-show={copied ? '1' : '0'}>
              Copied
            </span>
          </div>

          <div className={styles.badges} aria-hidden>
            <span>UK-based</span>
            <span>Since 2007</span>
            <span>Secure &amp; private</span>
          </div>

          <nav className={styles.quickLinks} aria-label="Quick answers">
            <a href="/faq#orders">Where is my order?</a>
            <a href="/faq#frozen">Frozen items</a>
            <a href="/wholesale">Wholesale</a>
          </nav>
        </div>

        {/* RIGHT SIDE (FORM CARD) */}
        <div className={styles.right} aria-label="Contact form card">
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            {/* Honeypot */}
            <input
              type="text"
              name="company"
              value={form.company}
              onChange={onChange('company')}
              className={styles.honeypot}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="name">Name*</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={onChange('name')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="email">Email*</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={onChange('email')}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+44…"
                  inputMode="tel"
                  value={form.phone}
                  onChange={onChange('phone')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="address">Address (optional)</label>
                <input
                  id="address"
                  type="text"
                  placeholder="House no., street, city"
                  value={form.address}
                  onChange={onChange('address')}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="subject">Subject</label>
              <input
                id="subject"
                type="text"
                placeholder="How can we help?"
                value={form.subject}
                onChange={onChange('subject')}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="message">Message*</label>
              <textarea
                id="message"
                rows={6}
                placeholder="Tell us what happened or what you need. Batch code, order #, product, etc."
                value={form.message}
                onChange={onChange('message')}
              />
            </div>

            {err && (
              <p className={styles.error} role="alert">
                {err}
              </p>
            )}

            {ok && (
              <p className={styles.success} role="status">
                {ok}
              </p>
            )}

            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Sending…' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
