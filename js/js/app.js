// SIPD CORE APP LOGIC
// Like-for-like gifting: 1 Small sent = 2 Smalls back, 1 Medium = 2 Mediums, 1 Large = 2 Larges

const App = (() => {

  const CUPS = {
    small:  { label: 'Small',  icon: '🥤', price: 55,  payfastCents: 5500 },
    medium: { label: 'Medium', icon: '☕', price: 90,  payfastCents: 9000 },
    large:  { label: 'Large',  icon: '🧋', price: 165, payfastCents: 16500 },
  };

  const MAX_SENDS_PER_DAY = 3;
  const RECEIVE_MULT      = 2;

  let currentUser       = null;
  let selectedCup       = null;
  let assignedRecipient = null;
  let activeTab         = 'queue';

  // How many open receive slots for a specific cup size
  function openSlotsForSize(user, size) {
    const timesSent = (user.cupsUsed || []).filter(s => s === size).length;
    const filled    = (user.recvByCup || {})[size] || 0;
    return Math.max(0, (timesSent * RECEIVE_MULT) - filled);
  }

  function totalOpenSlots(user) {
    return ['small', 'medium', 'large'].reduce((sum, s) => sum + openSlotsForSize(user, s), 0);
  }

  // FIFO assign for a specific cup size
  function fifoAssign(excludeId, size) {
    return Auth.getUsers()
      .filter(u => u.id !== excludeId && u.active && openSlotsForSize(u, size) > 0)
      .sort((a, b) => a.queuePos - b.queuePos)[0] || null;
  }

  function init() {
    currentUser = Auth.requireAuth('index.html');
    if (!currentUser) return;
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
    if (users.length > 1) return;
    const demos = [
      { name: 'Amara Khumalo',   idNumber: 'DEMO001', phone: '0821234001', bankAccount: '1234001', bankName: 'FNB',      queuePos: 1, cupsUsed: ['small','medium'],        recvByCup: { small: 1, medium: 1 }, totalEarned: 870  },
      { name: 'Sipho Mokoena',   idNumber: 'DEMO002', phone: '0821234002', bankAccount: '1234002', bankName: 'Absa',     queuePos: 2, cupsUsed: ['small'],                 recvByCup: { small: 1 },            totalEarned: 420  },
      { name: 'Lerato Nkosi',    idNumber: 'DEMO003', phone: '0821234003', bankAccount: '1234003', bankName: 'Nedbank',  queuePos: 3, cupsUsed: ['small','medium','large'], recvByCup: { small: 2, medium: 2, large: 1 }, totalEarned: 1640 },
      { name: 'Thabo Vilakazi',  idNumber: 'DEMO004', phone: '0821234004', bankAccount: '1234004', bankName: 'Standard', queuePos: 4, cupsUsed: [],                        recvByCup: {},                      totalEarned: 0    },
      { name: 'Zanele Dlamini',  idNumber: 'DEMO005', phone: '0821234005', bankAccount: '1234005', bankName: 'Capitec',  queuePos: 5, cupsUsed: ['small','large'],          recvByCup: { small: 1, large: 1 },  totalEarned: 1150 },
      { name: 'Kagiso Radebe',   idNumber: 'DEMO006', phone: '0821234006', bankAccount: '1234006', bankName: 'FNB',      queuePos: 6, cupsUsed: ['medium'],                recvByCup: { medium: 1 },           totalEarned: 580  },
      { name: 'Nandi Buthelezi', idNumber: 'DEMO007', phone: '0821234007', bankAccount: '1234007', bankName: 'Absa',     queuePos: 7, cupsUsed: ['large'],                 recvByCup: {},                      totalEarned: 310  },
    ];
    const COLORS = ['#c8a96e','#5b9cf6','#4caf7d','#e07b5c','#9b7fe8','#5cc8c8','#e05c8a'];
    demos.forEach((d, i) => {
      const sentToday = d.cupsUsed.length;
      const recvToday = Object.values(d.recvByCup).reduce((s, v) => s + v, 0);
      users.push({
        id: 'demo_' + (i+1), name: d.name,
        initials: d.name.split(' ').map(w => w[0]).join('').toUpperCase(),
        idNumber: d.idNumber, phone: d.phone, bankAccount: d.bankAccount, bankName: d.bankName,
        color: COLORS[i], joinedAt: Date.now() - (10 - i) * 3600000, queuePos: d.queuePos,
        verified: true, active: true, sentToday, recvToday,
        cupsUsed: d.cupsUsed, recvByCup: d.recvByCup, lastReset: Auth.todayStr(),
        totalSent: sentToday, totalReceived: recvToday, totalEarned: d.totalEarned, history: [],
      });
    });
    if (currentUser.queuePos === 1 && users.filter(u => u.id !== currentUser.id).length > 0) {
      currentUser.queuePos = demos.length + 1;
      Auth.updateUser(currentUser);
    }
    Auth.saveUsers(users);
  }

  function bindTabs() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });
  }

  function showTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-section').forEach(s => {
      s.style.display = s.id === 'tab-' + tab ? 'block' : 'none';
    });
    if (tab === 'queue')     renderQueue();
    if (tab === 'send')      renderSend();
    if (tab === 'dashboard') renderDashboard();
  }

  function renderQueue() {
    const users = Auth.getUsers().sort((a, b) => a.queuePos - b.queuePos);
    const html = users.map((u, i) => {
      const open     = totalOpenSlots(u);
      const maxSlots = (u.cupsUsed || []).length * RECEIVE_MULT;
      const pct      = maxSlots > 0 ? Math.round(((maxSlots - open) / maxSlots) * 100) : 0;
      const noSent   = (u.cupsUsed || []).length === 0;
      const full     = !noSent && open === 0;
      const isMe     = u.id === currentUser.id;
      const isNext   = !isMe && !noSent && open > 0 &&
        users.findIndex(x => x.id !== currentUser.id && (x.cupsUsed||[]).length > 0 && totalOpenSlots(x) > 0) === i;

      let badge = full   ? '<span class="badge badge-gray">Full today</span>'
                : noSent ? '<span class="badge badge-gold">Must send first</span>'
                         : '<span class="badge badge-green">Open</span>';

      const sizeSlots = ['small','medium','large'].map(s => {
        const o = openSlotsForSize(u, s);
        return o > 0 ? `<span style="font-size:11px;color:var(--text3)">${CUPS[s].icon}${o}</span>` : '';
      }).filter(Boolean).join(' ');

      return `<div class="queue-item">
        <div class="q-pos">#${u.queuePos}</div>
        <div class="q-avatar" style="background:${u.color}22;color:${u.color}">${u.initials}</div>
        <div class="q-info">
          <div class="q-name">${u.name}
            ${isMe   ? '<span class="badge badge-gold" style="margin-left:5px">You</span>' : ''}
            ${isNext ? '<span class="badge badge-blue" style="margin-left:5px">Next up</span>' : ''}
          </div>
          <div class="q-sub">Sent ${(u.cupsUsed||[]).length}/3 · Open: ${sizeSlots || 'none'} · ${u.bankName||'Bank linked'}</div>
          <div class="q-progress"><div class="q-progress-fill" style="width:${pct}%;background:${u.color}"></div></div>
        </div>
        ${badge}
      </div>`;
    }).join('');
    document.getElementById('queue-list').innerHTML = html || '<div class="empty-state">No members yet</div>';
  }

  function renderSend() {
    currentUser = Auth.checkDailyReset(currentUser);
    const sentCount = (currentUser.cupsUsed || []).length;
    const rem = MAX_SENDS_PER_DAY - sentCount;

    document.getElementById('send-dots').innerHTML =
      Array.from({length: MAX_SENDS_PER_DAY}, (_, i) =>
        `<div class="l-dot${i < sentCount ? ' used' : ''}"></div>`).join('');

    document.getElementById('send-status').textContent =
      rem > 0 ? `${rem} send${rem !== 1 ? 's' : ''} remaining today — send 1, 2, or all 3, your choice`
              : 'Daily send limit reached — come back tomorrow!';

    selectedCup = null;
    document.getElementById('send-btn').disabled = true;
    document.getElementById('send-btn').textContent = 'Select a cup size to continue';
    Object.keys(CUPS).forEach(size => {
      const el = document.getElementById('cup-' + size);
      el.classList.remove('selected');
      if ((currentUser.cupsUsed || []).includes(size)) el.classList.add('disabled');
      else el.classList.remove('disabled');
    });

    if (sentCount >= MAX_SENDS_PER_DAY) {
      document.getElementById('assigned-recipient').innerHTML =
        '<div class="empty-state" style="padding:1rem 0">All 3 daily sends used. Resets at midnight.</div>';
      document.getElementById('cup-selector').style.display = 'none';
      return;
    }

    document.getElementById('cup-selector').style.display = 'block';
    document.getElementById('assigned-recipient').innerHTML =
      '<div style="font-size:13px;color:var(--text2);padding:8px 0">Select a cup size to see who the system assigns.</div>';
    document.getElementById('recip-name').textContent = '—';
  }

  function selectCup(size) {
    if ((currentUser.cupsUsed || []).includes(size)) return;
    selectedCup = size;
    Object.keys(CUPS).forEach(k => document.getElementById('cup-' + k).classList.remove('selected'));
    document.getElementById('cup-' + size).classList.add('selected');

    assignedRecipient = fifoAssign(currentUser.id, size);
    const arc = document.getElementById('assigned-recipient');

    if (!assignedRecipient) {
      arc.innerHTML = `<div style="font-size:13px;color:var(--text2);padding:8px 0">
        No one in the queue needs a ${CUPS[size].label} right now. Try another size or check back later.</div>`;
      document.getElementById('send-btn').disabled = true;
      document.getElementById('send-btn').textContent = 'No recipient available for this size';
      document.getElementById('recip-name').textContent = '—';
      return;
    }

    const open = openSlotsForSize(assignedRecipient, size);
    arc.innerHTML = `<div class="assign-box">
      <div class="queue-item" style="border:none;padding:0">
        <div class="q-avatar" style="background:${assignedRecipient.color}22;color:${assignedRecipient.color}">${assignedRecipient.initials}</div>
        <div class="q-info">
          <div class="q-name">${assignedRecipient.name}</div>
          <div class="q-sub">Queue #${assignedRecipient.queuePos} · ${open} ${CUPS[size].label} slot${open!==1?'s':''} open · ${assignedRecipient.bankName}</div>
        </div>
        <span class="badge badge-blue">System assigned</span>
      </div>
    </div>`;

    document.getElementById('recip-name').textContent = assignedRecipient.name;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('send-btn').textContent = `Send ${CUPS[size].label} (R ${CUPS[size].price}) via PayFast`;
  }

  function sendCup() {
    if (!assignedRecipient || !selectedCup) return;
    if ((currentUser.cupsUsed || []).length >= MAX_SENDS_PER_DAY) return;
    const cup = CUPS[selectedCup];
    const btn = document.getElementById('send-btn');
    btn.disabled = true;
    btn.textContent = 'Processing payment...';
    PayFast.initiatePayment({
      type: selectedCup, amount: cup.payfastCents,
      buyerId: currentUser.id, recipientId: assignedRecipient.id,
      recipientName: assignedRecipient.name,
      onSuccess: (result) => onPaymentSuccess(result, assignedRecipient, cup, selectedCup),
    });
  }

  function onPaymentSuccess(result, recipient, cup, size) {
    const users   = Auth.getUsers();
    const now     = new Date();
    const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');

    const recip = users.find(u => u.id === recipient.id);
    if (recip) {
      recip.recvByCup = recip.recvByCup || {};
      recip.recvByCup[size] = (recip.recvByCup[size] || 0) + 1;
      recip.recvToday = (recip.recvToday || 0) + 1;
      recip.totalReceived = (recip.totalReceived || 0) + 1;
      recip.totalEarned = (recip.totalEarned || 0) + cup.price;
      recip.history = recip.history || [];
      recip.history.unshift({ type: 'recv', from: currentUser.name, cup: cup.label, icon: cup.icon, price: cup.price, time: timeStr, ref: result.ref, size });
    }

    currentUser = users.find(u => u.id === currentUser.id);
    currentUser.cupsUsed = currentUser.cupsUsed || [];
    currentUser.cupsUsed.push(size);
    currentUser.sentToday = currentUser.cupsUsed.length;
    currentUser.totalSent = (currentUser.totalSent || 0) + 1;
    currentUser.history = currentUser.history || [];
    currentUser.history.unshift({ type: 'sent', to: recipient.name, cup: cup.label, icon: cup.icon, price: cup.price, time: timeStr, ref: result.ref, size });

    Auth.saveUsers(users);
    Auth.setSession(currentUser);

    showBanner(`R ${cup.price} sent to ${recipient.name}! You are now in line for 2 x ${cup.label} back.`, 'banner-success');
    scheduleReceives(cup, size, timeStr, users);
    selectedCup = null;
    renderSend();
    renderQueue();
  }

  function scheduleReceives(sentCup, size, timeStr, users) {
    const givers = users
      .filter(u => u.id !== currentUser.id && openSlotsForSize(u, size) > 0)
      .sort(() => Math.random() - 0.5)
      .slice(0, RECEIVE_MULT);

    givers.forEach((giver, i) => {
      setTimeout(() => {
        const allUsers = Auth.getUsers();
        const me = allUsers.find(u => u.id === currentUser.id);
        if (!me || openSlotsForSize(me, size) <= 0) return;

        const rTimeStr = new Date().getHours().toString().padStart(2,'0') + ':' + new Date().getMinutes().toString().padStart(2,'0');
        const ref = PayFast.generateRef('PF');

        me.recvByCup = me.recvByCup || {};
        me.recvByCup[size] = (me.recvByCup[size] || 0) + 1;
        me.recvToday = (me.recvToday || 0) + 1;
        me.totalReceived = (me.totalReceived || 0) + 1;
        me.totalEarned = (me.totalEarned || 0) + sentCup.price;
        me.history = me.history || [];
        me.history.unshift({ type: 'recv', from: giver.name, cup: sentCup.label, icon: sentCup.icon, price: sentCup.price, time: rTimeStr, ref, size });

        Auth.saveUsers(allUsers);
        Auth.setSession(me);
        currentUser = me;

        showBanner(`${sentCup.icon} R ${sentCup.price} ${sentCup.label} received from ${giver.name} via PayFast!`, 'banner-success');
        if (activeTab === 'dashboard') renderDashboard();
        if (activeTab === 'queue')     renderQueue();
      }, 1200 + i * 1800);
    });
  }

  function renderDashboard() {
    currentUser = Auth.refreshSession();
    const sentCount = (currentUser.cupsUsed || []).length;
    const maxSlots  = sentCount * RECEIVE_MULT;
    const recvCount = Object.values(currentUser.recvByCup || {}).reduce((s, v) => s + v, 0);

    document.getElementById('ds-sent').textContent  = `${sentCount}/3`;
    document.getElementById('ds-recv').textContent  = `${recvCount}/${maxSlots}`;
    document.getElementById('ds-total').textContent = `R ${currentUser.totalEarned || 0}`;

    const slotEl = document.getElementById('slot-display');
    if (sentCount === 0) {
      slotEl.innerHTML = '<div style="font-size:13px;color:var(--text2)">Send a cup first to unlock your receive slots.</div>';
    } else {
      const rows = ['small','medium','large'].map(size => {
        const cup    = CUPS[size];
        const sent   = (currentUser.cupsUsed || []).filter(s => s === size).length;
        if (sent === 0) return '';
        const slots  = sent * RECEIVE_MULT;
        const filled = (currentUser.recvByCup || {})[size] || 0;
        const pills  = Array.from({length: slots}, (_, i) => {
          const f = i < filled;
          return `<div class="slot-pill ${f ? 'filled' : 'empty'}"><span>${f ? cup.icon : 'o'}</span> ${f ? 'Received' : 'Waiting'}</div>`;
        }).join('');
        return `<div style="margin-bottom:10px">
          <div style="font-size:12px;color:var(--text2);margin-bottom:5px">${cup.icon} ${cup.label} — ${filled}/${slots} received</div>
          <div class="slots-wrap">${pills}</div>
        </div>`;
      }).join('');
      slotEl.innerHTML = rows;
    }

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
              &nbsp;${h.type === 'sent' ? 'to ' + h.to : 'from ' + h.from} - ${h.cup}
            </div>
            <div class="hist-ref">${h.ref} - ${h.time}</div>
          </div>
          <div class="hist-amount" style="color:${h.type === 'sent' ? 'var(--accent)' : 'var(--green)'}">
            ${h.type === 'sent' ? '-' : '+'} R ${h.price}
          </div>
        </div>`).join('');
    }

    const users = Auth.getUsers();
    const ahead = users.filter(u => u.queuePos < currentUser.queuePos && totalOpenSlots(u) > 0).length;
    document.getElementById('queue-pos-display').innerHTML = `
      <div style="font-size:14px;color:var(--text2)">Your queue position:
        <span style="font-weight:600;color:var(--text);font-family:var(--mono)">#${currentUser.queuePos}</span>
      </div>
      <div style="font-size:13px;color:var(--text2);margin-top:4px">Members ahead with open slots:
        <span style="font-weight:600;color:var(--text)">${ahead}</span>
      </div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px">FIFO - longest-waiting eligible member first - like-for-like sizing</div>`;
  }

  function showBanner(msg, cls) {
    const b = document.getElementById('app-banner');
    if (!b) return;
    b.textContent = msg;
    b.className = 'banner ' + (cls || 'banner-success');
    b.style.display = 'block';
    clearTimeout(b._t);
    b._t = setTimeout(() => b.style.display = 'none', 5000);
  }

  function checkPaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      showBanner('Payment successful! Processing your transaction...', 'banner-info');
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
