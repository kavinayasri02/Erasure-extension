const BACKEND = 'http://localhost:5000';

let token = null;

document.addEventListener('DOMContentLoaded', function () {

  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('signout-btn').addEventListener('click', doSignOut);

  chrome.storage.local.get(['authToken', 'userEmail'], function (data) {
    if (data.authToken) {
      token = data.authToken;
      showSessions(data.userEmail);
      loadSessions();
    }
  });
});

async function doLogin() {
  const email = document.getElementById('email-input').value.trim();
  const name = document.getElementById('name-input').value.trim();

  if (!email) {
    shakeInput('email-input');
    return;
  }

  const btn = document.getElementById('login-btn');
  btn.innerHTML = '<span class="spinner"></span>Connecting...';
  btn.disabled = true;

  try {
    const res = await fetch(`${BACKEND}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name })
    });

    const data = await res.json();

    if (!data.token) {
      btn.innerHTML = '🔒 Start Protecting Sessions';
      btn.disabled = false;
      showError('Login failed. Is server running?');
      return;
    }

    token = data.token;

    chrome.storage.local.set({ authToken: token, userEmail: email }, function () {
      chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: token });
      showSessions(email);
      loadSessions();
    });

  } catch (err) {
    btn.innerHTML = '🔒 Start Protecting Sessions';
    btn.disabled = false;
    showError('Cannot connect to server! Make sure backend is running.');
  }
}

function shakeInput(id) {
  const el = document.getElementById(id);
  el.style.borderColor = 'rgba(239,68,68,0.6)';
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.animation = '';
  }, 500);
}

function showError(msg) {
  let err = document.getElementById('error-msg');
  if (!err) {
    err = document.createElement('p');
    err.id = 'error-msg';
    err.style.cssText = 'color:#f87171;font-size:12px;text-align:center;margin-top:10px;animation:slideIn 0.3s ease';
    document.getElementById('login-section').appendChild(err);
  }
  err.textContent = '⚠️ ' + msg;
  setTimeout(() => err && err.remove(), 4000);
}

function showSessions(email) {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('sessions-section').style.display = 'block';
  document.getElementById('status-dot').style.display = 'block';

  const label = document.getElementById('user-email-label');
  label.textContent = email || 'your account';

  const avatar = document.getElementById('user-avatar');
  avatar.textContent = (email || 'U')[0].toUpperCase();
}

function doSignOut() {
  chrome.storage.local.remove(['authToken', 'userEmail'], function () {
    token = null;
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('sessions-section').style.display = 'none';
    document.getElementById('status-dot').style.display = 'none';
  });
}

async function loadSessions() {
  if (!token) return;
  try {
    const res = await fetch(`${BACKEND}/api/sessions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const sessions = await res.json();
    renderSessions(sessions);
  } catch (err) {
    document.getElementById('sessions-list').innerHTML = `
      <div class="empty">
        <div class="empty-icon">⚠️</div>
        <p>Could not connect to server.<br>Check your backend is running.</p>
      </div>`;
  }
}

function renderSessions(sessions) {
  const list = document.getElementById('sessions-list');
  const count = document.getElementById('session-count');

  if (!sessions || sessions.length === 0) {
    count.textContent = '0';
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🛡️</div>
        <p>No active sessions yet.<br>Browse any website to start tracking.</p>
      </div>`;
    return;
  }

  count.textContent = sessions.length;

  list.innerHTML = sessions.map((s, i) => `
    <div class="session-card" style="animation-delay:${i * 0.05}s">
      <div class="session-info">
        <h3>${s.domain}</h3>
        <p>${s.machine_name || s.machine_id}</p>
        <span class="badge">Active</span>
      </div>
      <button class="logout-btn" data-id="${s.id}">⏏ Logout</button>
    </div>
  `).join('');

  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      revokeSession(this.getAttribute('data-id'), this);
    });
  });
}

async function revokeSession(sessionId, btn) {
  if (!confirm('Send remote logout command to this machine?')) return;

  const card = btn.closest('.session-card');
  const domain = card.querySelector('h3').textContent;

  btn.innerHTML = '<span class="spinner"></span>';
  btn.disabled = true;

  try {
    const res = await fetch(`${BACKEND}/api/sessions/revoke/${sessionId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      // Delete actual cookies
      chrome.runtime.sendMessage({ type: 'REVOKE_COOKIES', domain }, function () {
        card.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => loadSessions(), 350);
      });
    }
  } catch (err) {
    btn.innerHTML = '⏏ Logout';
    btn.disabled = false;
    alert('Failed to send logout command');
  }
}

// Add slideOut animation
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    25%{transform:translateX(-8px)}
    75%{transform:translateX(8px)}
  }
  @keyframes slideOut {
    to{opacity:0;transform:translateX(20px);max-height:0;padding:0;margin:0}
  }
`;
document.head.appendChild(style);

// Auto refresh every 5 seconds
setInterval(function () {
  if (token) loadSessions();
}, 5000);
