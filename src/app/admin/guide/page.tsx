// src/app/admin/guide/page.tsx
'use client';

import styles from './Guide.module.scss';

const sections = [
  {
    icon: '📊',
    title: 'Dashboard',
    path: '/admin',
    summary: 'Your starting point. Shows live stats at a glance.',
    details: [
      'View total Products, Customers, Orders and Revenue',
      'Switch time periods: Today, 7 days, 30 days, 1 year, All time',
      'Check APC shipping carrier status (green = live, red = down)',
      'See recent notifications from the bell menu',
    ],
    tip: 'If APC shows as DOWN, check your APC credentials in Settings → Shipping before attempting to generate any labels.',
  },
  {
    icon: '🛍️',
    title: 'Products',
    path: '/admin/products',
    summary: 'Manage everything in your catalogue.',
    details: [
      'All Products — view, search, filter and edit existing products',
      'Add Product — create a new product with images, pricing, variants and stock',
      'Categories — organise products into parent/child categories',
      'Analytics — see which products are selling, revenue per product',
    ],
    tip: 'Always assign a product to a category before publishing — uncategorised products won\'t appear in the shop\'s category filters.',
  },
  {
    icon: '📦',
    title: 'Orders',
    path: '/admin/orders',
    summary: 'The main day-to-day area for processing customer orders.',
    details: [
      'View all orders with status (Pending, Fulfilled, Shipped, Cancelled)',
      'Open an order to see items, customer details, payment and activity log',
      'Fulfil an order once payment is confirmed',
      'Ship an order — generates an APC label and sends tracking to the customer',
      'Cancel an order — within the reversal window set in Settings',
      'Delivery Exceptions — flagged orders where APC reported an issue',
    ],
    tip: 'Use the activity log inside each order to leave internal notes visible to other staff. Customers do not see these.',
  },
  {
    icon: '🚚',
    title: 'Shipments',
    path: '/admin/shipments',
    summary: 'Track and manage all APC shipments across all orders.',
    details: [
      'See every shipment that has been dispatched',
      'Recheck tracking status for in-transit parcels',
      'Download or reprint shipping labels',
      'Void a label if a shipment needs to be cancelled',
    ],
    tip: 'If a label fails to generate, go to the individual order page and use the Retry Label button rather than creating a duplicate shipment.',
  },
  {
    icon: '🗺️',
    title: 'Shipping Zones & Rates',
    path: '/admin/shipping',
    summary: 'Set up where you deliver and how much it costs.',
    details: [
      'Create shipping zones by country or region (e.g. UK Mainland, Highlands)',
      'Add flat-rate or tiered shipping rates per zone',
      'APC Warehouse settings — update your pickup address used when booking collections',
    ],
    tip: 'Rates only apply to new orders after they\'re saved. Existing orders keep the rate they were placed with.',
  },
  {
    icon: '👥',
    title: 'Customers',
    path: '/admin/customers',
    summary: 'View and manage customer accounts.',
    details: [
      'Browse all registered customers',
      'View a customer\'s order history and spend',
      'See addresses and contact details',
      'Apply a custom discount to a specific customer',
    ],
    tip: 'Customer discounts stack on top of active promotions unless you set a minimum order value to prevent stacking.',
  },
  {
    icon: '🎁',
    title: 'Promotions',
    path: '/admin/promotions',
    summary: 'Create discount codes and percentage-off promotions.',
    details: [
      'Set a promo code, discount amount or percentage, and expiry date',
      'Restrict to specific products, categories or customers',
      'View usage — how many times a code has been redeemed',
      'Send a promotion by email blast to eligible customers',
    ],
    tip: 'Use Offers for buy-one-get-one or bundle deals. Use Promotions for straightforward discount codes.',
  },
  {
    icon: '⚡',
    title: 'Offers',
    path: '/admin/offers',
    summary: 'Rule-based offers that apply automatically at checkout.',
    details: [
      'Create conditions like "spend £50, get 10% off" or "buy 3, pay for 2"',
      'Target specific products or categories',
      'View offer usage and revenue impact',
    ],
    tip: 'Offers trigger automatically — no code needed. Use Promotions if you want the customer to enter a code manually.',
  },
  {
    icon: '🔔',
    title: 'Notifications',
    path: '/admin/notifications',
    summary: 'System alerts for things that need your attention.',
    details: [
      'New order placed alerts',
      'APC label ready or failed alerts',
      'Delivery exception alerts',
      'Mark individual notifications as read or view all from the bell icon in the sidebar',
    ],
    tip: 'The bell icon in the top-left of the sidebar shows a badge count of unread notifications. Click it for a quick dropdown.',
  },
  {
    icon: '🖥️',
    title: 'Site Editing',
    path: '/admin/site/home',
    summary: 'Edit the content of your public-facing pages.',
    details: [
      'Home — edit hero banners, featured products, promotional sections',
      'About — update the about page text and images',
      'FAQ — add, edit or remove FAQ entries',
      'Contact — update contact details shown on the contact page',
      'Media Library — upload and manage images used across the site',
    ],
    tip: 'Changes to site content go live immediately — there\'s no draft/publish step. Make edits during low-traffic periods if possible.',
  },
  {
    icon: '⚙️',
    title: 'Settings',
    path: '/admin/settings',
    summary: 'Account, security and system configuration.',
    details: [
      'Account Info — view your name, email and role',
      'Change Password — update your admin password',
      'Staff Permissions (HEAD only) — add or remove staff accounts, send password reset links',
      'Order Settings (HEAD only) — set the cancellation reversal window',
      'Shipping (APC) (HEAD only) — update the warehouse pickup address',
    ],
    tip: 'Staff with VIEWER role can see the settings page but only their own account info and password. They cannot manage other staff.',
  },
];

export default function AdminGuidePage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Admin Guide</h1>
        <p className={styles.subtitle}>
          A quick reference for every section of the admin panel — what it does and where to go for what.
        </p>
      </div>

      <div className={styles.grid}>
        {sections.map((s) => (
          <div key={s.path} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.icon}>{s.icon}</span>
              <div>
                <h2 className={styles.cardTitle}>{s.title}</h2>
                <p className={styles.cardPath}>{s.path}</p>
              </div>
            </div>

            <p className={styles.cardSummary}>{s.summary}</p>

            <ul className={styles.list}>
              {s.details.map((d, i) => (
                <li key={i} className={styles.listItem}>
                  <span className={styles.bullet}>·</span>
                  {d}
                </li>
              ))}
            </ul>

            <div className={styles.tip}>
              <span className={styles.tipIcon}>💡</span>
              {s.tip}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
