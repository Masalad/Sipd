// ── SIPD ADMIN DASHBOARD ─────────────────────────────────────────────

const Admin = (() => {

  let activeTab = 'overview';

  function init() {
    // Allow admin access with special ID or just load if coming from admin link
    // In production, protect this page with server-side auth
    const users = Auth.getUsers();

    bindTabs();
    showTab('overview');
  }

  function bindTabs() {
    document.querySelectorAll('.admin-tab').forEach(btn => {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });
  }

  function showTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.admin-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.admin-section').forEach(s =>
      s.style.display = s.id === 'atab-' + tab ? 'block' : 'none');
    if (tab === 'overview')  renderOverview();
    if (tab === 'members')   renderMembers();
    if (tab === 'txns')      renderTransactions();
    if (tab === 'queue')     renderQueue();
  }

  // ── OVERVIEW ─────────────────────────────────────────────────────
  function renderOverview() {
    const users = Auth.getUsers();
    const allHistory = users.flatMap(u => (u.history || []).map(h => ({...h, userName: u.name})));

    const totalMembers   = users.length;
    const activeToday    = users.filter(u => u.sentToday > 0 || u.recvToday > 0).length;
    const totalSentToday = users.reduce((s, u) => s + u.sentToday, 0);
    const totalVolume    = users.reduce((s, u) => s + (u.totalEarned || 0), 0);
    const joiningRevenue = users.length * 5; // R5 per member
    const txnsToday      = allHistory.filter(h => h.type === 'sent').length;

    document.getElementById('ov-members').textContent   = totalMembers;
    document.getElementById('ov-active').textContent    = activeToday;
    document.getElementById('ov-cups').textContent      = totalSentToday;
    document.getElementById('ov-revenue').textContent   = 'R ' + joiningRevenue;

    // Activity feed
    const recent = allHistory
      .filter(h => h.type === 'sent')
      .slice(0, 10);

    const feedEl = document.getElementById('activity-feed');
    if (!recent.length) {
      feedEl.innerHTML = '<div class="empty-state">No activity yet</div>';
      return;
    }
    feedEl.innerHTML = recent.map(h => `
      <div class="hist-row">
        <span class="hist-icon">${h.icon || '☕'}</span>
        <div class="hist-info">
          <div class="hist-main">${h.userName || '—'} sent ${h.cup} to ${h.to || '—'}</div>
          <div class="hist-ref">${h.ref || '—'} · ${h.time || '—'}</div>
        </div>
        <div class="hist-amount" style="color:var(--accent)">R ${h.price}</div>
      </div>`).join('');
  }

  // ── MEMBERS ──────────────────────────────────────────────────────
  function renderMembers() {
    const users = Auth.getUsers().sort((a, b) => a.queuePos - b.queuePos);

    document.getElementById('member-count').textContent = users.length + ' members';

    const html = users.map(u => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:32px;height:32px;border-radius:50%;background:${u.color}22;color:${u.color};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0">${u.initials}</div>
            <div>
              <div style="font-weight:500;color:var(--text)">${u.name}</div>
              <div style="font-size:11px;color:var(--text3);font-family:var(--mono)">${u.phone}</div>
            </div>
          </div>
        </td>
        <td><span style="font-family:var(--mono);font-size:12px">#${u.queuePos}</span></td>
        <td>${u.bankName || '—'}</td>
        <td>${u.sentToday}/3</td>
        <td>${u.recvToday}/${u.sentToday * 2}</td>
        <td style="color:var(--green);font-weight:500;font-family:var(--mono)">R ${u.totalEarned || 0}</td>
        <td>
          <span class="badge ${u.active ? 'badge-green' : 'badge-red'}">
            ${u.active ? 'Active' : 'Suspended'}
          </span>
        </td>
        <td>
          <button onclick="Admin.toggleUser('${u.id}')" class="btn btn-ghost" style="width:auto;padding:4px 10px;font-size:12px">
            ${u.active ? 'Suspend' : 'Activate'}
          </button>
        </td>
      </tr>`).join('');

    document.getElementById('members-tbody').innerHTML = html ||
      '<tr><td colspan="8" class="empty-state">No members yet</td></tr>';
  }

  // ── TRANSACTIONS ─────────────────────────────────────────────────
  function renderTransactions() {
    const users = Auth.getUsers();
    const txns  = users
      .flatMap(u => (u.history || []).filter(h => h.type === 'sent').map(h => ({...h, fromUser: u.name, fromId: u.id})))
      .sort((a, b) => b.time?.localeCompare(a.time));

    document.getElementById('txn-count').textContent = txns.length + ' transactions';

    const html = txns.slice(0, 50).map(t => `
      <tr>
        <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${t.ref || '—'}</td>
        <td style="color:var(--text)">${t.fromUser}</td>
        <td style="color:var(--text)">${t.to || '—'}</td>
        <td>${t.icon || '☕'} ${t.cup}</td>
        <td style="color:var(--accent);font-weight:500;font-family:var(--mono)">R ${t.price}</td>
        <td style="font-family:var(--mono);font-size:12px">${t.time || '—'}</td>
        <td><span class="badge badge-green">Completed</span></td>
      </tr>`).join('');

    document.getElementById('txns-tbody').innerHTML = html ||
      '<tr><td colspan="7" class="empty-state" style="text-align:center;padding:2rem">No transactions yet</td></tr>';
  }

  // ── QUEUE VIEW ────────────────────────────────────────────────────
  function renderQueue() {
    const users = Auth.getUsers().sort((a, b) => a.queuePos - b.queuePos);

    const html = users.map(u => {
      const slots = u.sentToday * 2;
      const pct   = slots > 0 ? Math.round((u.recvToday / slots) * 100) : 0;
      const eligible = slots > 0 && u.recvToday < slots;
      return `
        <div class="queue-item">
          <div class="q-pos">#${u.queuePos}</div>
          <div class="q-avatar" style="background:${u.color}22;color:${u.color}">${u.initials}</div>
          <div class="q-info">
            <div class="q-name">${u.name}</div>
            <div class="q-sub">Sent ${u.sentToday}/3 · Received ${u.recvToday}/${slots} · ${u.bankName || '—'}</div>
            <div class="q-progress"><div class="q-progress-fill" style="width:${pct}%;background:${u.color}"></div></div>
          </div>
          <span class="badge ${eligible ? 'badge-green' : slots === 0 ? 'badge-gold' : 'badge-gray'}">
            ${eligible ? 'Open' : slots === 0 ? 'Needs to send' : 'Full today'}
          </span>
        </div>`;
    }).join('');

    document.getElementById('admin-queue-list').innerHTML = html ||
      '<div class="empty-state">No members yet</div>';
  }

  // ── ACTIONS ───────────────────────────────────────────────────────
  function toggleUser(userId) {
    const users = Auth.getUsers();
    const u = users.find(u => u.id === userId);
    if (!u) return;
    u.active = !u.active;
    Auth.saveUsers(users);
    renderMembers();
  }

  function resetAllDaily() {
    if (!confirm('Reset all daily send/receive counters? This simulates a midnight reset.')) return;
    const users = Auth.getUsers();
    users.forEach(u => {
      u.sentToday = 0;
      u.recvToday = 0;
      u.cupsUsed  = [];
      u.lastReset = Auth.todayStr();
    });
    Auth.saveUsers(users);
    renderOverview();
    renderMembers();
    alert('Daily counters reset for all members.');
  }

  function exportCSV() {
    const users = Auth.getUsers();
    const rows  = [['Name','Phone','Bank','Queue Pos','Sent Today','Received Today','Total Earned','Active']];
    users.forEach(u => rows.push([
      u.name, u.phone, u.bankName || '', u.queuePos,
      u.sentToday, u.recvToday, u.totalEarned || 0, u.active ? 'Yes' : 'No'
    ]));
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'sipd_members_' + Auth.todayStr() + '.csv';
    a.click();
  }

  return { init, showTab, toggleUser, resetAllDaily, exportCSV };
})();

window.addEventListener('DOMContentLoaded', Admin.init);
