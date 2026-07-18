# Monetalis User Management Refactoring Plan

## Problem Statement

Currently, user management is split across two systems with overlapping responsibilities:

| Concern | Logto (SSO) | CMS Payload (MongoDB) |
|---------|-------------|----------------------|
| User identity | email, name | email, name (duplicate) |
| Authentication | OIDC login | Password login + Logto ID token bridge |
| Authorization/RBAC | monetalis-admin/viewer roles | role field (admin/viewer) |
| App-specific data | — | loan assignment, isActive |
| CMS admin panel | Not integrated | Payload built-in auth |

**Issues:**
1. User data is duplicated — email/name stored in both Logto and `monetalis-users`
2. RBAC is duplicated — roles in both Logto and CMS
3. CMS admin panel doesn't use Logto SSO — separate auth system
4. New user onboarding requires creating users in TWO places
5. The `monetalis-users` collection has `() => true` access control — any unauthenticated user can CRUD

---

## Target Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Logto (Source of Truth)            │
│                                                      │
│  Users: email, name, password                        │
│  Roles: monetalis-admin, monetalis-viewer            │
│  Custom Data: { loanId: "...", isActive: true }      │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Monetalis SPA          Payload CMS Admin            │
│  ─────────────          ─────────────────            │
│  1. Login via Logto     1. Login via Logto SSO       │
│  2. Get ID token        2. Get access token          │
│  3. Call CMS API        3. Use Management API        │
│     with ID token           for admin operations     │
│                                                      │
│  CMS Backend (Payload)                               │
│  ─────────────────────                               │
│  - Validates Logto tokens                            │
│  - Reads user roles from Logto                       │
│  - Stores only app data (loans, schedules, etc.)     │
│  - No user/password tables                           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Consolidate User Identity to Logto

### 1.1 Store app-specific data in Logto custom_data

**Logto custom_data per user:**
```json
{
  "monetalis": {
    "loanId": "6a534312df4c6f6adce3c64e",
    "isActive": true
  }
}
```

**Implementation:**
- Update the `logto-auth.ts` endpoint to read `custom_data` from Logto Management API
- Or include custom_data in the ID token via Logto custom claims
- Remove `role`, `loan`, `isActive` fields from `monetalis-users` collection

### 1.2 Simplify CMS logto-auth endpoint

**Current flow:**
1. Validate Logto ID token → extract email
2. Find user in `monetalis-users` by email → get role, loan, isActive
3. Return Payload JWT

**New flow:**
1. Validate Logto ID token → extract email, roles, custom_data
2. Check if user has `monetalis-admin` or `monetalis-viewer` role in Logto
3. Read `loanId` and `isActive` from custom_data
4. Return Payload JWT with embedded role and loan info

**Code changes:**
```typescript
// logto-auth.ts — new version
const logtoAuthHandler = async (req: PayloadRequest) => {
  // 1. Validate Logto ID token
  const { payload: logtoPayload } = await jwtVerify(idToken, getJWKS(), {
    issuer: `${LOGTO_ENDPOINT}/oidc`,
  });

  const email = logtoPayload.email;
  const name = logtoPayload.name;
  const roles = logtoPayload.roles || []; // Logto roles
  const customData = logtoPayload.custom_data || {};
  const monetalisData = customData.monetalis || {};

  // 2. Check authorization
  const isMonetalisUser = roles.some(r => 
    r === 'monetalis-admin' || r === 'monetalis-viewer'
  );
  if (!isMonetalisUser) {
    return Response.json({ error: 'Not authorized for Monetalis' }, { status: 403 });
  }
  if (!monetalisData.isActive) {
    return Response.json({ error: 'Account is inactive' }, { status: 403 });
  }

  // 3. Return token with embedded user info
  const token = jwt.sign({
    email,
    name,
    role: roles.includes('monetalis-admin') ? 'admin' : 'viewer',
    loanId: monetalisData.loanId,
  }, req.payload.secret, { expiresIn: '7d' });

  return Response.json({
    token,
    user: { email, name, role, loanId: monetalisData.loanId },
  });
};
```

### 1.3 Migrate existing data to Logto custom_data

**Script to run once:**
```bash
# For each user in monetalis-users:
# 1. Find user in Logto by email
# 2. Update their custom_data with loanId and isActive
# 3. Assign correct Logto role if not already assigned
```

### 1.4 Remove monetalis-users collection

After migration:
- Delete the `monetalis-users` collection from Payload CMS
- Remove the import from `payload.config.ts`
- Keep the `users` collection for CMS admin panel (will be migrated in Phase 2)

---

## Phase 2: Payload CMS Admin Panel → Logto SSO

### 2.1 Add Logto SSO to Payload CMS admin panel

**Current:** CMS admin uses Payload's built-in auth (`users` collection with email + password)

**Target:** CMS admin uses Logto SSO (same as Monetalis SPA)

**Implementation:**
- Create a new Payload auth strategy that validates Logto OIDC tokens
- Replace the built-in `users` auth with a custom auth adapter
- The CMS admin panel redirects to Logto for login

**Payload CMS 3.x custom auth adapter:**
```typescript
// collections/Users.ts
export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    useAPIKey: true,
    strategies: [
      {
        name: 'logto',
        authenticate: async ({ payload, headers }) => {
          const authHeader = headers.authorization;
          if (!authHeader?.startsWith('Bearer ')) return null;
          
          const token = authHeader.slice(7);
          // Validate Logto access token
          const { payload: verified } = await jwtVerify(token, getJWKS(), {
            issuer: `${LOGTO_ENDPOINT}/oidc`,
          });
          
          // Find or create user in Payload
          const email = verified.email;
          let user = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
          });
          
          if (user.docs.length === 0) {
            // Auto-create user from Logto
            user = await payload.create({
              collection: 'users',
              data: { email, name: verified.name },
            });
          }
          
          return { user: user.docs[0] };
        },
      },
    ],
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'name', type: 'text' },
  ],
};
```

### 2.2 CMS admin panel Logto integration

**Frontend changes:**
- Add Logto React SDK to the Payload admin panel
- On admin panel load, check for Logto session
- If no session, redirect to Logto login
- After login, send Logto access token to Payload for validation

**This requires:**
- A Payload CMS plugin for Logto SSO
- Or a custom admin panel that wraps the Payload API

### 2.3 RBAC for CMS admin panel

**Logto roles for CMS:**
- `cms-admin` — full CMS access (manage all collections)
- `cms-editor` — edit content (projects, experiences, skills)
- `cms-viewer` — read-only CMS access

**Payload access control:**
```typescript
// Example: Only cms-admin can delete
access: {
  delete: ({ req }) => {
    const user = req.user;
    return user?.roles?.includes('cms-admin') ?? false;
  },
}
```

---

## Phase 3: Remove Legacy Auth

### 3.1 Remove password-based auth from Monetalis

- Remove `POST /api/monetalis-users/login` endpoint
- Remove password field from any user collections
- Remove `monetalis_token` from localStorage (use Logto tokens only)

### 3.2 Remove duplicate user data

- Remove `name` field from CMS collections (read from Logto)
- Remove `role` field from CMS collections (read from Logto roles)
- Keep only app-specific data (loan assignments, schedules, etc.)

### 3.3 Clean up localStorage

**Current:**
- `monetalis_token` — Payload JWT
- `monetalis_user` — cached user object

**Target:**
- Use Logto SDK's built-in session management
- Store only `logto_access_token` (for API calls)
- Read user info from Logto ID token claims

---

## Implementation Order

| Step | Task | Effort | Impact |
|------|------|--------|--------|
| 1 | Store loanId/isActive in Logto custom_data | 2h | Foundation |
| 2 | Refactor logto-auth.ts to read from Logto | 3h | Core |
| 3 | Migrate existing users to Logto custom_data | 1h | Data |
| 4 | Update Monetalis SPA to use Logto roles | 2h | Frontend |
| 5 | Remove monetalis-users collection | 1h | Cleanup |
| 6 | Add Logto SSO to Payload CMS admin | 4h | CMS |
| 7 | Remove legacy password auth | 1h | Cleanup |
| 8 | Update CI/CD with new env vars | 1h | DevOps |

**Total: ~15 hours**

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Logto custom_data size limit | Keep only essential fields; use Logto Management API for complex queries |
| CMS admin panel Logto integration complexity | Start with API key auth + Logto for user-facing; add CMS SSO later |
| Breaking existing users during migration | Run migration script in dry-run mode first |
| Payload CMS 3.x auth adapter compatibility | Check Payload docs for custom auth strategy support |

---

## Environment Variables Required

```env
# CMS (.env)
LOGTO_ENDPOINT=https://auth.danipras.dev
LOGTO_APP_ID=9phbhuk9sq5z2mba9grj6
LOGTO_APP_SECRET=NgKraLg7t47n1UT1nReH1FsUU7UddU8F

# Monetalis SPA (.env)
VITE_LOGTO_ENDPOINT=https://auth.danipras.dev
VITE_LOGTO_APP_ID=xvw36t0vruqvbid8215dq
VITE_LOGTO_REDIRECT_URI=https://monetalis.danipras.dev/callback
VITE_LOGTO_POST_LOGOUT_URI=https://monetalis.danipras.dev
```
