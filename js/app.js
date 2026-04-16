// ── SIPD CORE APP LOGIC ───────────────────────────────────────────────

const App = (() => {

  const CUPS = {
    small:  { label: 'Small',  icon: '🥤', price: 55,  payfastCents: 5500 },
    medium: { label: 'Medium', icon: '☕', price: 90,  payfastCents: 9000 },
    large:  { label: 'Large',  icon: '🧋', price: 165, payfastCents: 16500 },
  };

  const MAX_SENDS_PER_DAY    = 3;
  const RECEIVE_MULT         = 2; // each send unlocks 2 receive slots
  const MAX_RECEIVES_PER_DAY = MAX_SENDS_PER_DAY * RECEIVE_MULT; // = 6

  let currentUser = null;
  let selectedCup = null;
  let assignedRecipient = null;
  let activeTab = 'queue';

  // ── INIT ───────────────────────────────────────────────────────────
  function init() {
    currentUser = Auth.requireAuth('index.html');
    if (!currentUser) return;

    // Seed demo users if none exist beyond the current user
    seedDemoUsers();

    renderTopbar();
    bindTabs();
    checkPaymentReturn();
    showTab('queue');
  }

  function renderTopbar() {
    const el = document.getElementById('topbar-user');
    if (!el) return;
    el.innerHTML = `
      <div class="user-chip">
        <div class="av" style="background:${currentUser.color}22;color:${currentUser.color};border-color:${currentUser.color}44">${currentUser.initials}</div>
        <span>${currentUser.name.split(' ')[0]}</span>
        <span class="badge badge-green" style="font-size:10px;padding:1px 6px">Verified</span>
      </div>
      <button class="btn btn-ghost" style="width:auto;padding:6px 12px;font-size:12px" onclick="App.logout()">Sign out</button>`;
  }

  function seedDemoUsers() {
    const users = Auth.getUsers();
    if (users.length > 1) return; // already seeded

    const demos = [
      { name: 'Amara Khumalo',  idNumber: 'DEMO001', phone: '0821234001', bankAccount: '1234001', bankName: 'FNB',     queuePos: 1, sentToday: 2, recvToday: 2, totalEarned: 870,  cupsUsed: ['small','medium'] },
      { name: 'Sipho Mokoena',  idNumber: 'DEMO002', phone: '0821234002', bankAccount: '1234002', bankName: 'Absa',    queuePos: 2, sentToday: 1, recvToday: 1, totalEarned: 420,  cupsUsed: ['small'] },
      { name: 'Lerato Nkosi',   idNumber: 'DEMO003', phone: '0821234003', bankAccount: '1234003', bankName: 'Nedbank', queuePos: 3, sentToday: 3, recvToday: 5, totalEarned: 1640, cupsUsed: ['small','medium','large'] },
      { name: 'Thabo Vilakazi', idNumber: 'DEMO004', phone: '0821234004', bankAccount: '1234004', bankName: 'Standard',queuePos: 4, sentToday: 0, recvToday: 0, totalEarned: 275,  cupsUsed: [] },
      { name: 'Zanele Dlamini', idNumber: 'DEMO005', phone: '0821234005', bankAccount: '1234005', bankName: 'Capitec', queuePos: 5, sentToday: 2, recvToday: 3, totalEarned: 1150, cupsUsed: ['small','large'] },
      { name: 'Kagiso Radebe',  idNumber: 'DEMO006', phone: '0821234006', bankAccount: '1234006', bankName: 'FNB',     queuePos: 6, sentToday: 1, recvToday: 2, totalEarned: 580,  cupsUsed: ['medium'] },
      { name: 'Nandi Buthelezi',idNumber: 'DEMO007', phone: '0821234007', bankAccount: '1234007', bankName: 'Absa',    queuePos: 7, sentToday: 1, recvToday: 0, totalEarned: 310,  cupsUsed: ['large'] },
    ];

    const COLORS = ['#c8a96e','#5b9cf6','#4caf7d','#e07b5c','#9b7fe8','#5cc8c8','#e05c8a'];
    demos.forEach((d, i) => {
      users.push({
        id: 'demo_' + (i+1),
        name: d.name,
        initials: d.name.split(' ').map(w=>w[0]).join('').toUpperCase(),
        idNumber: d.idNumber,
        phone: d.phone,
        bankAccount: d.bankAccount,
        bankName: d.bankName,
        color: COLORS[i],
        joinedAt: Date.now() - (10 - i) * 3600000,
        queuePos: d.queuePos,
        verified: true,
        active: true,
        sentToday: d.sentToday,
        recvToday: d.recvToday,
        cupsUsed: d.cupsUsed,
        lastReset: Auth.todayStr(),
        totalSent: d.sentToday,
        totalReceived: d.recvToday,
        totalEarned: d.totalEarned,
        history: [],
      });
    });

    // update current user queue pos if needed
    if (currentUser.queuePos === 1 && users.filter(u=>u.id !== currentUser.id).length > 0) {
      currentUser.queuePos = demos.length + 1;
      Auth.updateUser(currentUser);
    }

    Auth.saveUsers(users);
  }

  // ── TABS ───────────────────────────────────────────────────────────
  function bindTabs() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });
  }

  function showTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.nav-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-section').forEach(s => {
      s.style.display = s.id === 'tab-' + tab ? 'block' : 'none';
    });
    if (tab === 'queue')     renderQueue();
    if (tab === 'send')      renderSend();
    if (tab === 'dashboard') renderDashboard();
  }

  // ── FIFO QUEUE LOGIC ───────────────────────────────────────────────
  // Returns next eligible recipient: has open receive slots, sorted by queuePos asc
  function fifoAssign(excludeId) {
    const users = Auth.getUsers();
    return users
      .filter(u => {
        if (u.id === excludeId) return false;
        if (!u.active) return false;
        const slots = u.sentToday * RECEIVE_MULT;
        return slots > 0 && u.recvToday < slots;
      })
      .sort((a, b) => a.queuePos - b.queuePos)[0] || null;
  }

  // ── RENDER QUEUE ───────────────────────────────────────────────────
  function renderQueue() {
    const users = Auth.getUsers().sort((a, b) => a.queuePos - b.queuePos);
    const firstEligIdx = users.findIndex(u => {
      const s = u.sentToday * RECEIVE_MULT;
      return u.id !== currentUser.id && s > 0 && u.recvToday < s;
    });

    const html = users.map((u, i) => {
      const slots = u.sentToday * RECEIVE_MULT;
      const pct   = slots > 0 ? Math.round((u.recvToday / slots) * 100) : 0;
      const full  = slots > 0 && u.recvToday >= slots;
      const noSlt = slots === 0;
      const isMe  = u.id === currentUser.id;
      const isNext= i === firstEligIdx;

      let badge = full  ? `<span class="badge badge-gray">Full today</span>`
                : noSlt ? `<span class="badge badge-gold">Must send first</span>`
                        : `<span class="badge badge-green">Open</span>`;

      return `
        <div class="queue-item${isMe ? ' me-row' : ''}">
          <div class="q-pos">#${u.queuePos}</div>
          <div class="q-avatar" style="background:${u.color}22;color:${u.color}">${u.initials}</div>
          <div class="q-info">
            <div class="q-name">
              ${u.name}
              ${isMe ? '<span class="badge badge-gold" style="margin-left:5px">You</span>' : ''}
              ${isNext ? '<span class="badge badge-blue" style="margin-left:5px">Next up</span>' : ''}
            </div>
            <div class="q-sub">Sent ${u.sentToday}/3 · Received ${u.recvToday}/${slots} · ${u.bankName || 'Bank linked'}</div>
            <div class="q-progress"><div class="q-progress-fill" style="width:${pct}%;background:${u.color}"></div></div>
          </div>
          ${badge}
        </div>`;
    }).join('');

    document.getElementById('queue-list').innerHTML = html || '<div class="empty-state">No members yet</div>';
  }

  // ── RENDER SEND ────────────────────────────────────────────────────
  function renderSend() {
    currentUser = Auth.checkDailyReset(currentUser);
    const rem = MAX_SENDS_PER_DAY - currentUser.sentToday;

    // Limit dots
    document.getElementById('send-dots').innerHTML =
      Array.from({length: MAX_SENDS_PER_DAY}, (_, i) =>
        `<div class="l-dot${i < currentUser.sentToday ? ' used' : ''}"></div>`
      ).join('');

    document.getElementById('send-status').textContent =
      rem > 0 ? `${rem} send${rem !== 1 ? 's' : ''} remaining today — send 1, 2, or all 3, your choice`
              : 'Daily send limit reached — come back tomorrow!';

    assignedRecipient = fifoAssign(currentUser.id);
    const arc = document.getElementById('assigned-recipient');

    if (currentUser.sentToday >= MAX_SENDS_PER_DAY) {
      arc.innerHTML = `<div class="empty-state" style="padding:1rem 0">All 3 daily sends used. Resets at midnight.</div>`;
      document.getElementById('cup-selector').style.display = 'none';
      return;
    }

    if (!assignedRecipient) {
      arc.innerHTML = `<div class="empty-state" style="padding:1rem 0">No eligible recipients in the queue right now. Check back soon.</div>`;
      document.getElementById('cup-selector').style.display = 'none';
      return;
    }

    const open = (assignedRecipient.sentToday * RECEIVE_MULT) - assignedRecipient.recvToday;
    arc.innerHTML = `
      <div class="assign-box">
        <div class="queue-item" style="border:none;padding:0">
          <div class="q-avatar" style="background:${assignedRecipient.color}22;color:${assignedRecipient.color}">${assignedRecipient.initials}</div>
          <div class="q-info">
            <div class="q-name">${assignedRecipient.name}</div>
            <div class="q-sub">Queue position #${assignedRecipient.queuePos} · ${open} slot${open !== 1 ? 's' : ''} open · ${assignedRecipient.bankName}</div>
          </div>
          <span class="badge badge-blue">System assigned</span>
        </div>
      </div>`;

    document.getElementById('cup-selector').style.display = 'block';
    document.getElementById('recip-name').textContent = assignedRecipient.name;

    selectedCup = null;
    document.getElementById('send-btn').disabled = true;
    document.getElementById('send-btn').textContent = 'Select a cup size to continue';

    // Reset cup buttons, disable already-used sizes
    Object.keys(CUPS).forEach(size => {
      const el = document.getElementById('cup-' + size);
      el.classList.remove('selected');
      if (currentUser.cupsUsed.includes(size)) el.classList.add('disabled');
      else el.classList.remove('disabled');
    });
  }

  // ── CUP SELECTION ──────────────────────────────────────────────────
  function selectCup(size) {
    if (currentUser.cupsUsed.includes(size)) return;
    selectedCup = size;
    Object.keys(CUPS).forEach(k => document.getElementById('cup-' + k).classList.remove('selected'));
    document.getElementById('cup-' + size).classList.add('selected');
    const c = CUPS[size];
    const btn = document.getElementById('send-btn');
    btn.disabled = false;
    btn.textContent = `Send ${c.label} (R ${c.price}) via PayFast`;
  }

  // ── SEND CUP ───────────────────────────────────────────────────────
  function sendCup() {
    if (!assignedRecipient || !selectedCup) return;
    if (currentUser.sentToday >= MAX_SENDS_PER_DAY) return;

    const cup = CUPS[selectedCup];
    const btn = document.getElementById('send-btn');
    btn.disabled = true;
    btn.textContent = 'Processing payment…';

    PayFast.initiatePayment({
      type: selectedCup,
      amount: cup.payfastCents,
      buyerId: currentUser.id,
      recipientId: assignedRecipient.id,
      recipientName: assignedRecipient.name,
      onSuccess: (result) => onPaymentSuccess(result, assignedRecipient, cup),
    });
  }

  function onPaymentSuccess(result, recipient, cup) {
    const users = Auth.getUsers();
    const now   = new Date();
    const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');

    // Update recipient
    const recip = users.find(u => u.id === recipient.id);
    if (recip) {
      recip.recvToday++;
      recip.totalReceived++;
      recip.totalEarned += cup.price;
      recip.history = recip.history || [];
      recip.history.unshift({
        type: 'recv', from: currentUser.name, cup: cup.label,
        icon: cup.icon, price: cup.price, time: timeStr, ref: result.ref,
      });
    }

    // Update current user
    currentUser = users.find(u => u.id === currentUser.id);
    currentUser.sentToday++;
    currentUser.totalSent++;
    currentUser.cupsUsed.push(selectedCup);
    currentUser.history = currentUser.history || [];
    currentUser.history.unshift({
      type: 'sent', to: recipient.name, cup: cup.label,
      icon: cup.icon, price: cup.price, time: timeStr, ref: result.ref,
    });

    Auth.saveUsers(users);
    Auth.setSession(currentUser);

    showBanner(`✓ R ${cup.price} sent to ${recipient.name}! 2 receive slots unlocked.`, 'banner-success');

    // Simulate 2 people sending back (FIFO from other users)
    scheduleReceives(cup, timeStr, users);

    selectedCup = null;
    renderSend();
    renderQueue();
  }

  // Simulate incoming receives (2 per send, with delay for realism)
  function scheduleReceives(sentCup, timeStr, users) {
    const givers = users.filter(u =>
      u.id !== currentUser.id &&
      u.sentToday > 0 &&
      u.recvToday < u.sentToday * RECEIVE_MULT
    ).sort(() => Math.random() - 0.5).slice(0, RECEIVE_MULT);

    givers.forEach((giver, i) => {
      setTimeout(() => {
        const allUsers = Auth.getUsers();
        const me = allUsers.find(u => u.id === currentUser.id);
        if (!me) return;

        const maxRecv = me.sentToday * RECEIVE_MULT;
        if (me.recvToday >= maxRecv) return;

        const rcupKeys  = Object.keys(CUPS);
        const rcup      = CUPS[rcupKeys[Math.floor(Math.random() * rcupKeys.length)]];
        const rTimeStr  = new Date().getHours().toString().padStart(2,'0') + ':' + new Date().getMinutes().toString().padStart(2,'0');
        const ref       = PayFast.generateRef('PF');

        me.recvToday++;
        me.totalReceived++;
        me.totalEarned += rcup.price;
        me.history = me.history || [];
        me.history.unshift({
          type: 'recv', from: giver.name, cup: rcup.label,
          icon: rcup.icon, price: rcup.price, time: rTimeStr, ref,
        });

        Auth.saveUsers(allUsers);
        Auth.setSession(me);
        currentUser = me;

        showBanner(`☕ R ${rcup.price} received from ${giver.name} via PayFast!`, 'banner-success');
        if (activeTab === 'dashboard') renderDashboard();
        if (activeTab === 'queue')     renderQueue();

      }, 1200 + i * 1800);
    });
  }

  // ── RENDER DASHBOARD ───────────────────────────────────────────────
  function renderDashboard() {
    currentUser = Auth.refreshSession();

    document.getElementById('ds-sent').textContent  = `${currentUser.sentToday}/3`;
    document.getElementById('ds-recv').textContent  = `${currentUser.recvToday}/${currentUser.sentToday * RECEIVE_MULT}`;
    document.getElementById('ds-total').textContent = `R ${currentUser.totalEarned}`;

    // Receive slots
    const maxSlots = currentUser.sentToday * RECEIVE_MULT;
    const slotEl   = document.getElementById('slot-display');
    if (maxSlots === 0) {
      slotEl.innerHTML = '<div style="font-size:13px;color:var(--text2)">Send a cup first to unlock your receive slots.</div>';
    } else {
      slotEl.innerHTML = `<div class="slots-wrap">${
        Array.from({length: maxSlots}, (_, i) => {
          const filled = i < currentUser.recvToday;
          return `<div class="slot-pill ${filled ? 'filled' : 'empty'}">
            <span>${filled ? '☕' : '○'}</span> ${filled ? 'Received' : 'Waiting'}
          </div>`;
        }).join('')
      }</div>`;
    }

    // History
    const hist = currentUser.history || [];
    const histEl = document.getElementById('hist-list');
    if (!hist.length) {
      histEl.innerHTML = '<div class="empty-state">No transactions yet today</div>';
    } else {
      histEl.innerHTML = hist.slice(0, 20).map(h => `
        <div class="hist-row">
          <span class="hist-icon">${h.icon}</span>
          <div class="hist-info">
            <div class="hist-main">
              <span class="badge ${h.type === 'sent' ? 'badge-gold' : 'badge-green'}">${h.type === 'sent' ? 'Sent' : 'Received'}</span>
              &nbsp;${h.type === 'sent' ? 'to ' + h.to : 'from ' + h.from} — ${h.cup}
            </div>
            <div class="hist-ref">${h.ref} · ${h.time}</div>
          </div>
          <div class="hist-amount" style="color:${h.type === 'sent' ? 'var(--accent)' : 'var(--green)'}">
            ${h.type === 'sent' ? '−' : '+'} R ${h.price}
          </div>
        </div>`).join('');
    }

    // Queue position
    const users = Auth.getUsers();
    const ahead = users.filter(u =>
      u.queuePos < currentUser.queuePos &&
      u.sentToday * RECEIVE_MULT > u.recvToday
    ).length;

    document.getElementById('queue-pos-display').innerHTML = `
      <div style="font-size:14px;color:var(--text2)">Your queue position:
        <span style="font-weight:600;color:var(--text);font-family:var(--mono)">#${currentUser.queuePos}</span>
      </div>
      <div style="font-size:13px;color:var(--text2);margin-top:4px">
        Members ahead with open slots:
        <span style="font-weight:600;color:var(--text)">${ahead}</span>
      </div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px">
        FIFO — longest-waiting eligible member always receives first
      </div>`;
  }

  // ── BANNER ────────────────────────────────────────────────────────
  function showBanner(msg, cls = 'banner-success') {
    const b = document.getElementById('app-banner');
    if (!b) return;
    b.textContent = msg;
    b.className = 'banner ' + cls;
    b.style.display = 'block';
    clearTimeout(b._t);
    b._t = setTimeout(() => b.style.display = 'none', 4500);
  }

  // ── PAYMENT RETURN ────────────────────────────────────────────────
  function checkPaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      showBanner('Payment successful! Processing your transaction…', 'banner-info');
      window.history.replaceState({}, '', 'app.html');
    } else if (params.get('payment') === 'cancel') {
      showBanner('Payment was cancelled. You can try again.', 'banner-warn');
      window.history.replaceState({}, '', 'app.html');
    }
  }

  function logout() {
    Auth.clearSession();
    window.location.href = 'index.html';
  }

  return { init, showTab, selectCup, sendCup, logout };
})();

window.addEventListener('DOMContentLoaded', App.init);
