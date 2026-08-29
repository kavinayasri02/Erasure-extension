# 🛡️ Erasure

**Remote session logout for shared lab & public computers.**

Ever walked away from a shared computer (library, campus lab, internet cafe) and only remembered *hours later* that you never signed out of your email, LMS, or bank? Erasure lets you see every active browser session tied to your account — across every machine — and kill any of them remotely, in real time, from your phone or any other browser.

---

## How it works

1. **Install the extension** on every shared/lab machine you use. Each install generates a random, anonymous `machine_id`.
2. **Log in with your email** in the popup (no password required for the MVP). This just identifies *you*, not the machine.
3. As you browse, the extension silently watches for new cookies and reports the **domain + machine** pair to the backend — building a live list of "where am I logged in, and on which computer."
4. Open the Erasure popup on **any** device and you'll see every active session across every machine.
5. Hit **Logout** next to any session. The backend flags it `revoked` and pushes a command over WebSocket to that *specific* machine.
6. That machine's extension receives the command and deletes the actual cookies for that domain — logging you out for real, even though you're nowhere near it.

```
[Your phone/browser]  --revoke request-->  [Backend: Express + Socket.io]  --socket push-->  [Lab PC extension]
                                                     |                                              |
                                              [PostgreSQL: users,                          deletes cookies for
                                               sessions tables]                             the target domain
```

---

## Project structure

```
Erasure/
├── backend/
│   ├── server.js          # Express + Socket.io entrypoint
│   ├── db.js               # PostgreSQL pool (via pg)
│   ├── setup-db.js         # Creates users/sessions tables
│   ├── routes/
│   │   ├── auth.js         # POST /api/auth/login (email-only, issues JWT)
│   │   └── sessions.js     # GET/POST session tracking + remote revoke
│   └── .env                # PORT, DATABASE_URL, JWT_SECRET (not committed)
└── extension/               # Chrome extension (Manifest V3)
    ├── manifest.json
    ├── popup.html / popup.js   # UI: login, session list, logout buttons
    └── service-worker.js       # Watches cookies, reports sessions, deletes on command
```

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express 5, Socket.io 4 |
| Database | PostgreSQL (`pg`) |
| Auth | JWT (`jsonwebtoken`) |
| Extension | Chrome Manifest V3 (service worker + `chrome.cookies` API) |
| Realtime | WebSockets via Socket.io, machine registry kept in memory |

---

## Getting started

### 1. Backend

```bash
cd backend
npm install
```

Create a `.env` file:

```env
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/sessiondb
JWT_SECRET=replace-with-a-strong-random-secret
```

Create the tables, then start the server:

```bash
node setup-db.js   # creates users + sessions tables
node server.js      # starts the API + WebSocket server on $PORT
```

### 2. Extension

The extension currently points at a deployed backend by default:

```js
const BACKEND = 'https://erasure-extension.onrender.com';
```

For local development, change `BACKEND` in **both** `popup.js` and `service-worker.js` to your local server (e.g. `http://localhost:5000`).

Then load it into Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder

### 3. Use it

- Click the Erasure icon, enter your email + name, and hit **Start Protecting Sessions**.
- Repeat on every shared machine you want tracked.
- Browse normally — sessions populate automatically as cookies are set.
- From any logged-in popup, click **Logout** on a session to remotely wipe it.

---

## Known limitations (MVP)

- **No password auth** — login is email-only. `bcrypt` is included as a dependency but isn't wired up yet; don't treat this as a real identity boundary.
- **Secrets** — `.env` (with `DATABASE_URL` and `JWT_SECRET`) must be set per-environment and is gitignored; the values in local dev are placeholders and **must** be replaced before any real deployment.
- **Open CORS** — the Socket.io and Express CORS config currently allows all origins (`origin: '*'`); tighten this before production use.
- **In-memory machine registry** — connected machines are tracked in a plain JS object on the server, so it resets on restart and won't scale past a single server instance.
- **No `npm start` script yet** — run the backend with `node server.js` directly, or add one to `package.json`.

---

## Roadmap ideas

- [ ] Real password/passkey auth
- [ ] `npm start` script + process manager config (PM2 / Docker)
- [ ] Persist connected-machine registry (Redis) for multi-instance scaling
- [ ] Lock down CORS to known origins
- [ ] Session history / audit log (who revoked what, when)
- [ ] Firefox / Edge extension builds
