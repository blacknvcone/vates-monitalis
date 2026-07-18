# User Management Refactoring — Implementation Plan

## Goal
Make Logto the single source of truth for user identity and RBAC. Remove duplicate user data from CMS.

## Changes

### Phase 1: Logto as Source of Truth

**1.1 CMS: Refactor `logto-auth.ts`**
- Read `roles` from Logto ID token (Logto includes roles in ID token claims)
- Read `custom_data.monetalis.loanId` from ID token
- Remove dependency on `monetalis-users` collection
- Return Payload JWT with embedded role + loanId

**1.2 CMS: Add `monetalis` custom_data scope to Logto**
- Configure Logto to include `custom_data` in ID token
- Store `{ monetalis: { loanId, isActive } }` per user

**1.3 SPA: Simplify auth flow**
- Remove password login (`api.login()`)
- Remove `fetchCurrentUser()` (data comes from Logto + CMS response)
- Keep only Logto SSO flow
- Remove password login UI from login page

**1.4 SPA: Update User type**
- Get role from CMS response (which reads from Logto)
- Get loanId from CMS response (which reads from Logto custom_data)

**1.5 Migrate existing users**
- Set Logto custom_data for each user: `{ monetalis: { loanId, isActive } }`
- Verify Logto roles are assigned

**1.6 Remove `monetalis-users` collection**
- Delete from `payload.config.ts`
- Delete `MonetalisUsers.ts`

### Phase 2: Payload CMS Admin → Logto SSO

**2.1 Add Logto OIDC auth to CMS Users collection**
- Custom auth strategy that validates Logto access tokens
- Auto-create CMS user from Logto profile
- Map Logto `cms-admin` role to Payload admin access

**2.2 Add Logto roles for CMS**
- `cms-admin` — full CMS access
- `cms-editor` — content editing only

### Phase 3: Cleanup

**3.1 Remove legacy password auth**
- Delete `POST /api/monetalis-users/login` endpoint
- Remove password field references

**3.2 Clean up localStorage**
- Use only `monetalis_token` (Payload JWT from Logto flow)
- Remove `monetalis_user` (derive from token)

---

## Files Modified

| File | Change |
|------|--------|
| `revamp-portfolio/apps/cms/src/endpoints/logto-auth.ts` | Refactor to read from Logto |
| `revamp-portfolio/apps/cms/src/collections/Users.ts` | Add Logto SSO auth |
| `revamp-portfolio/apps/cms/src/payload.config.ts` | Remove monetalis-users |
| `revamp-portfolio/apps/cms/src/collections/monetalis/MonetalisUsers.ts` | DELETE |
| `vates-monitalis/src/lib/auth.tsx` | Remove password login |
| `vates-monitalis/src/lib/api.ts` | Remove password login API |
| `vates-monitalis/src/routes/login.tsx` | Remove password form |

## Rollout
1. Merge CMS changes → deploy CMS
2. Merge SPA changes → rebuild SPA image
3. Run migration script to set Logto custom_data
4. Verify SSO flow works end-to-end
