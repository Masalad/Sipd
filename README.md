# Sipd — SA Peer Gifting Platform

**Sipd Technologies PTY Ltd** | Trading as Sipd  
Built with plain HTML, CSS, and JavaScript — no build tools required.

---

## File Structure

```
sipd/
├── index.html       — Onboarding: registration + R5 joining fee + login
├── app.html         — Main user app: queue, send a cup, dashboard
├── admin.html       — Admin dashboard: members, transactions, queue view
├── css/
│   └── style.css    — All styles (dark theme, DM Sans font)
├── js/
│   ├── auth.js      — User registration, login, session management (localStorage)
│   ├── payfast.js   — PayFast payment integration (sandbox + live)
│   ├── app.js       — Core FIFO logic, queue, send/receive, dashboard
│   └── admin.js     — Admin dashboard logic
└── README.md
```

---

## How to Run Locally

Just open `index.html` in any browser. No server needed for the demo.

For live PayFast payments you will need a backend server (see below).

---

## Going Live — Checklist

### 1. Register your business
- Register **Sipd Technologies PTY Ltd** at CIPC: https://www.cipc.co.za
- Cost: ~R175
- Open a business bank account (FNB, Absa, or Standard Bank recommended)
- Trademark "Sipd" at CIPC trademarks office: ~R590

### 2. Set up PayFast
- Register at https://www.payfast.co.za
- Complete merchant verification (SA ID + bank account required)
- Enable **Split Payments** in your merchant dashboard
- Get your Merchant ID, Merchant Key, and set a Passphrase
- Update `js/payfast.js` CONFIG section:
  ```js
  merchantId:  'YOUR_MERCHANT_ID',
  merchantKey: 'YOUR_MERCHANT_KEY',
  passphrase:  'YOUR_PASSPHRASE',
  sandbox:     false,  // SET TO FALSE FOR LIVE
  ```

### 3. Set up a backend (required for live payments)
The current build uses localStorage for demo purposes.
For production you need a backend to:
- Store users in a real database (PostgreSQL recommended)
- Handle PayFast ITN (Instant Transaction Notifications) at `/api/payfast-itn`
- Verify payment signatures from PayFast
- Run daily midnight resets via a cron job

Recommended stack: **Node.js + Express + PostgreSQL** hosted on **Railway** or **Render** (both have free tiers).

Example ITN endpoint (Node.js):
```js
app.post('/api/payfast-itn', async (req, res) => {
  // 1. Verify PayFast signature
  // 2. Check payment_status === 'COMPLETE'
  // 3. Extract m_payment_id, custom_str1 (buyerId), custom_str2 (recipientId)
  // 4. Update database: increment sender's sentToday, recipient's recvToday + totalEarned
  // 5. Trigger PayFast Split Pay payout to recipient
  res.send('OK');
});
```

### 4. Hosting options

| Option | Cost | Best for |
|--------|------|----------|
| Netlify | Free | Frontend only (demo mode) |
| Vercel | Free | Frontend only (demo mode) |
| Railway | ~$5/mo | Full stack with backend + DB |
| Render | Free tier | Full stack with backend + DB |
| Hetzner | ~R80/mo | SA-based VPS, best latency |

For a SA audience, **Hetzner SA** (Johannesburg) gives the best performance.

### 5. Daily reset cron job
Add to your backend (runs at midnight SAST = UTC+2):
```js
// Runs at 00:00 SAST every day
cron.schedule('0 22 * * *', async () => {
  await db.query(`
    UPDATE users SET
      sent_today = 0,
      recv_today = 0,
      cups_used = '[]',
      last_reset = CURRENT_DATE
  `);
  console.log('Daily counters reset');
}, { timezone: 'Africa/Johannesburg' });
```

---

## Admin Access

Visit `/admin.html` directly in your browser.  
In production, protect this page with a server-side password or IP whitelist.

Admin features:
- Overview stats (members, activity, joining revenue)
- Member management (view, suspend/activate)
- Transaction log with PayFast references
- Full FIFO queue view
- CSV export
- Manual daily counter reset

---

## PayFast Fee Calculation

PayFast charges: **2% + R2.00 per transaction** (cards)  
EFT (Instant EFT): **Free** — most SA users prefer this

Example per cup sent:
| Cup    | Amount | PayFast fee | Net to recipient |
|--------|--------|-------------|-----------------|
| Small  | R 55   | ~R 3.10     | ~R 51.90        |
| Medium | R 90   | ~R 3.80     | ~R 86.20        |
| Large  | R 165  | ~R 5.30     | ~R 159.70       |

Note: For Instant EFT there is no fee, so recipient gets full amount.

---

## Legal Notes

- This platform must be registered with CIPC as a PTY Ltd
- Consult an FSCA-registered attorney before launch
- Terms of Service must clearly state: voluntary gifting, no guaranteed returns
- Consider consulting a tax advisor re: gift tax implications for members
- Keep all PayFast transaction records for 5 years (SARS requirement)

---

## Demo Credentials

To test the app, register any new user OR use the demo login:
- SA ID: `DEMO001` (after first registration seeds demo data)
- Admin: visit `admin.html` directly

---

Built with love in South Africa 🇿🇦
