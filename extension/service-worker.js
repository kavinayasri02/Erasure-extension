const BACKEND = 'http://localhost:5000';
let authToken = null;
let machineId = null;

async function getMachineId() {
  const stored = await chrome.storage.local.get('machineId');
  if (stored.machineId) return stored.machineId;
  const id = 'machine_' + Math.random().toString(36).slice(2, 10);
  await chrome.storage.local.set({ machineId: id });
  return id;
}

async function loadToken() {
  const data = await chrome.storage.local.get('authToken');
  authToken = data.authToken || null;
  machineId = await getMachineId();
}

// Report session to backend
async function reportSession(domain) {
  if (!authToken || !machineId) return;
  try {
    await fetch(`${BACKEND}/api/sessions/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        domain,
        machine_id: machineId,
        machine_name: 'Lab PC ' + machineId.slice(-4)
      })
    });
  } catch (e) {
    console.log('Report failed:', e.message);
  }
}

// Cookie listener
chrome.cookies.onChanged.addListener(async (change) => {
  if (!change.removed && authToken) {
    const domain = change.cookie.domain.replace(/^\./, '');
    await reportSession(domain);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SET_TOKEN') {
    authToken = msg.token;
    chrome.storage.local.set({ authToken: msg.token });
    sendResponse({ ok: true });
  }
  if (msg.type === 'GET_TOKEN') {
    sendResponse({ token: authToken });
  }
  // ACTUAL COOKIE DELETION when remote logout triggered
  if (msg.type === 'REVOKE_COOKIES') {
    deleteCookiesForDomain(msg.domain).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
  return true;
});

// Delete ALL cookies for a domain
async function deleteCookiesForDomain(domain) {
  const cleanDomain = domain.replace(/^\./, '');
  const urls = [
    `https://${cleanDomain}`,
    `http://${cleanDomain}`,
    `https://www.${cleanDomain}`,
    `http://www.${cleanDomain}`
  ];

  for (const url of urls) {
    const cookies = await chrome.cookies.getAll({ url });
    for (const cookie of cookies) {
      await chrome.cookies.remove({ url, name: cookie.name });
    }
  }
  console.log(`✅ Cookies deleted for ${domain}`);
}

loadToken();