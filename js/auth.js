// ── SIPD AUTH & SESSION ──────────────────────────────────────────────

const Auth = (() => {

  const STORAGE_KEY = 'sipd_user';
  const USERS_KEY   = 'sipd_users';

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch { return []; }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
    catch { return null; }
  }

  function setSession(user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function getInitials(name) {
    return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function generateId() {
    return 'u_' + Math.random().toString(36).substr(2, 9);
  }

  function register(data) {
    const users = getUsers();

    // Check duplicate ID number
    if (users.find(u => u.idNumber === data.idNumber)) {
      return { ok: false, error: 'An account with this ID number already exists.' };
    }

    const user = {
      id: generateId(),
      name: data.name,
      initials: getInitials(data.name),
      idNumber: data.idNumber,
      phone: data.phone,
      bankAccount: data.bankAccount,
      bankName: data.bankName,
      color: randomColor(),
      joinedAt: Date.now(),
      queuePos: users.length + 1,
      verified: true,
      active: true,
      // daily state — reset at midnight
      sentToday: 0,
      recvToday: 0,
      cupsUsed: [],
      lastReset: todayStr(),
      // lifetime
      totalSent: 0,
      totalReceived: 0,
      totalEarned: 0,
      history: [],
    };

    users.push(user);
    saveUsers(users);
    setSession(user);
    return { ok: true, user };
  }

  function login(idNumber) {
    const users = getUsers();
    const user = users.find(u => u.idNumber === idNumber);
    if (!user) return { ok: false, error: 'No account found with that ID number.' };
    if (!user.active) return { ok: false, error: 'Your account has been suspended. Contact support.' };
    setSession(user);
    return { ok: true, user };
  }

  function refreshSession() {
    const session = getSession();
    if (!session) return null;
    const users = getUsers();
    const fresh = users.find(u => u.id === session.id);
    if (fresh) setSession(fresh);
    return fresh || null;
  }

  function updateUser(updatedUser) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === updatedUser.id);
    if (idx > -1) {
      users[idx] = updatedUser;
      saveUsers(users);
      setSession(updatedUser);
    }
  }

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function checkDailyReset(user) {
    if (user.lastReset !== todayStr()) {
      user.sentToday = 0;
      user.recvToday = 0;
      user.cupsUsed = [];
      user.lastReset = todayStr();
      updateUser(user);
    }
    return user;
  }

  function randomColor() {
    const colors = ['#c8a96e','#5b9cf6','#4caf7d','#e07b5c','#9b7fe8','#5cc8c8','#e05c8a'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function requireAuth(redirectTo = 'index.html') {
    const user = refreshSession();
    if (!user) { window.location.href = redirectTo; return null; }
    return checkDailyReset(user);
  }

  function requireAdmin(redirectTo = 'index.html') {
    const session = getSession();
    if (!session || session.idNumber !== 'ADMIN001') {
      window.location.href = redirectTo; return null;
    }
    return session;
  }

  return { register, login, getSession, setSession, clearSession,
           getUsers, saveUsers, updateUser, refreshSession,
           requireAuth, requireAdmin, todayStr, checkDailyReset };
})();
