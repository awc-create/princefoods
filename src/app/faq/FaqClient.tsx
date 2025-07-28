'use client';

import { useState } from 'react';
import styles from './Faq.module.scss';

const faqs = [
  {
    question: 'WHAT IS YOUR RETURN POLICY?',
    answer:
      "We want you to be completely satisfied with your order. If you receive a damaged or incorrect item, please contact us within 48 hours of receiving your shipment. Please provide photographic evidence, and we'll promptly arrange a replacement or refund. Due to the perishable nature of our frozen goods, returns for reasons other than damages or errors are typically not accepted."
  },
  {
    question: 'HOW MUCH IS THE MINIMUM ORDER?',
    answer:
      'The minimum order for free delivery across the UK is just £30. Orders below this amount will incur a shipping fee.'
  },
  {
    question: 'HOW MUCH DOES SHIPPING COST?',
    answer:
      'For orders of £30 or more, delivery is free across the UK. Orders below £30 will have a shipping fee clearly indicated at checkout. We dispatch orders on the next working day, with delivery typically within 2-3 working days. All frozen items are shipped via next-day delivery service, carefully packaged in food-grade rigifoam cartons with ice gel packs to maintain optimum temperature and freshness.\nFor any special delivery requirements or further information, please contact our customer service team directly.'
  },
  {
    question: 'CAN I TRACK MY ORDER?',
    answer:
      'Yes, once your order ships, we’ll email you a tracking link so you can follow its journey from our warehouse to your door, whether you’re in England, Scotland, Wales or Ireland.'
  },
  {
    question: 'WHAT PAYMENT METHODS DO YOU ACCEPT?',
    answer:
      'We accept all major credit and debit cards (Visa, Mastercard, American Express) processed securely via Stripe—so your card details are never stored on our servers.'
  },
  {
    question: 'WHICH AREAS DO YOU DELIVER TO?',
    answer:
      'We deliver across all of Great Britain (England, Scotland & Wales), Northern Ireland and the Republic of Ireland. Check our Delivery page for region-specific minimum orders and packing fees.'
  }
];

export default function FaqClient() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className={styles.wrapper}>
      <h1>FAQS AND THEIR ANSWERS</h1>
      <p className={styles.sub}>Browse Some of Our Most Asked Questions</p>
      <div className={styles.accordion}>
        {faqs.map((item, index) => (
          <div key={index} className={styles.item}>
            <button className={styles.question} onClick={() => toggle(index)}>
              {item.question}
              <span className={styles.icon}>{openIndex === index ? '−' : '›'}</span>
            </button>
            {openIndex === index && (
              <div className={styles.answer}>
                <p>{item.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
