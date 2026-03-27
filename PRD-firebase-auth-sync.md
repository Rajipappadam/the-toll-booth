# PRD — Firebase Auth & Sync Integration

## Goal
Add Google Sign-In and Firestore sync to The Toll Booth so user data is backed up and persists across reinstalls/devices.

---

## Authentication

**Method:** Google Sign-In only (via `chrome.identity` API — no offscreen document needed for this flow)

**Trigger:**
- On first popup open → show a sign-in prompt/banner
- When user clicks a "Sync" button manually

**States:**
- **Signed out** — extension works fully using `chrome.storage` only, no sync
- **Signed in** — extension works locally AND syncs to Firestore in the background

---

## Data Sync

**What gets synced:** Everything
| Field | Firestore path |
|-------|---------------|
| `tasks` | `users/{uid}/data/tasks` |
| `blockedSites` | `users/{uid}/data/blockedSites` |
| `timerDuration` | `users/{uid}/data/timerDuration` |
| `visitCounts` | `users/{uid}/data/visitCounts` |
| `unlocks` | `users/{uid}/data/unlocks` |

**Sync strategy: local-first**
- All reads/writes hit `chrome.storage` first (fast, works offline)
- After every write, if signed in, mirror to Firestore in the background (fire-and-forget)
- On sign-in, pull Firestore data down and merge into `chrome.storage`

**Conflict resolution:** Firestore wins on sign-in (first pull overwrites local). After that, last-write wins per field.

---

## Offline Behaviour
- Extension works fully offline at all times via `chrome.storage`
- Firestore writes are attempted when online; silently skipped if offline
- No queuing of offline writes (keep it simple for now)

---

## Implementation Plan

### Phase 1 — Authentication
1. Add a sign-in button/banner to `popup.html` when user is not authenticated
2. Implement Google Sign-In in `popup.js` using `chrome.identity.getAuthToken`
3. Exchange the token for a Firebase credential and sign in via Firebase Auth
4. Store the `uid` in `chrome.storage` (already planned in `storage.js`)
5. Show signed-in state (user avatar/email + Sign Out button) in popup

### Phase 2 — Firestore Sync Layer
1. Create `shared/sync.js` — a `pushToFirestore(uid, data)` and `pullFromFirestore(uid)` helper
2. Wrap every `set*` call in `storage.js` to also call `pushToFirestore` if signed in
3. On sign-in success → call `pullFromFirestore` and merge into `chrome.storage`
4. Add a manual "Sync Now" button in the popup

### Phase 3 — Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/data/{document} {
      allow read, write: if request.auth.uid == uid;
    }
  }
}
```

---

## Out of Scope (for now)
- Leaderboards / social features
- Offline write queuing
- Email/password auth
- Todoist token syncing (sensitive — keep local only)
- Anthropic API key syncing (sensitive — keep local only)
