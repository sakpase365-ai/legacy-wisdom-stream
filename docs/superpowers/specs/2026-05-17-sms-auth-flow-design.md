# SMS Auth Flow — Design Spec
**Date:** 2026-05-17
**Status:** Approved

---

## Problem

The login → capture flow creates compounded friction for a mobile-first app:

1. Returning users wait through a 2.4s home page animation before CTAs appear
2. Magic link auth forces the user out of the app to check email — breaking the writing mood
3. Sessions expire, causing the full email round-trip repeatedly

The fix: replace email magic links with SMS OTP for all logins, collect phone at signup, and keep sessions alive for a few hours of activity.

---

## Goals

- User enters phone → receives SMS code → types it in → lands on capture. Never leaves the app.
- New users sign up via email (account creation) and provide a phone number that becomes their login credential going forward.
- Sessions last ~6–8 hours of activity. Close the app overnight, re-auth tomorrow.
- Authenticated users landing on `/` skip home and go directly to `/capture`.

---

## Auth Flow

### Returning user (login)

1. User opens app → unauthenticated → `/login`
2. Phone number entry screen — single input, country code prefix, "Send code" button
3. SMS sent via Twilio → screen transitions to code entry (6-digit input)
4. Code auto-submits on digit 6 — no button press needed
5. Valid code → Supabase session established → redirect to `/capture`
6. Session lasts ~6–8 hours of inactivity (JWT expiry + refresh token window)
7. Next day / after idle: re-auth via phone + SMS

### New user (signup)

1. User hits `/signup` → collects: full name, family name, **email** (account creation), **phone number**
2. Supabase `signInWithOtp({ email })` sends magic link to email
3. User clicks email link → `/auth/callback` → `/setup`
4. **Setup Step 1:** Family name, their first name, their role in the family
5. **Setup Step 2 (redesigned):** Two named sections:
   - **Spouse / partner** — single name field, optional
   - **Children** — card-per-child, name + birthday (optional), add/remove cards
6. After Step 2 completes → app calls `supabase.auth.updateUser({ phone })` → Supabase sends verification SMS
7. User enters SMS code → phone attached to auth account → redirect to `/capture`
8. All future logins use phone OTP — email is never used again after account creation

**Setup Step 2 UI note:** Section labels (`SPOUSE / PARTNER`, `CHILDREN`) make purpose explicit. Generic relationship dropdown removed for this step — spouse and children are the primary family for MVP. Extended family can be added later from family management. Color treatment to be finalized during UI polish pass.

### Authenticated user on home

- Users with a valid session who land on `/` are redirected immediately to `/capture`
- Unauthenticated visitors see the full home page as before

---

## Technical Architecture

### Supabase configuration (dashboard)

- Auth → Phone provider: enabled
- SMS provider: Twilio (Account SID, Auth Token, Twilio phone number)
- JWT expiry: `28800` (8 hours)
- Refresh token rotation: enabled
- Goal: session expires after ~8 hours of inactivity. Exact refresh token lifetime config to be confirmed against Supabase dashboard options during implementation.

### Supabase client calls

**Send OTP (login):**
```typescript
await supabase.auth.signInWithOtp({ phone: '+1xxxxxxxxxx' })
```

**Verify OTP (login):**
```typescript
await supabase.auth.verifyOtp({ phone: '+1xxxxxxxxxx', token: '123456', type: 'sms' })
```

**Attach phone after email signup:**
```typescript
await supabase.auth.updateUser({ phone: '+1xxxxxxxxxx' })
// Supabase sends verification SMS automatically
```

**Verify phone after signup:**
```typescript
await supabase.auth.verifyOtp({ phone: '+1xxxxxxxxxx', token: '123456', type: 'phone_change' })
```

### Files changed

| File | Change |
|------|--------|
| `src/app/login/page.tsx` | Replace email form with phone entry + code entry (two-step, single page) |
| `src/app/signup/page.tsx` | Add phone number field; keep email for account creation |
| `src/app/page.tsx` | Add authenticated redirect to `/capture` |
| `src/app/api/send-magic-link/` | Retired — SMS send/verify is fully client-side |
| `src/app/setup/page.tsx` | Redesign Step 2: spouse field + children cards; add phone verification OTP step after submit |
| Supabase dashboard | Phone provider, Twilio credentials, JWT expiry |

### Auth callback

`/auth/callback` is only used during the initial email signup flow. Once a user has a phone attached, it is never triggered again. It stays in place for signup.

---

## Login Page UI

Two states, single page (`/login`):

**State 1 — Phone entry**
```
[Wordmark]
Sign in to continue

[+1  Phone number        ]
[     Send code          ]

First time? Create an account
```

**State 2 — Code entry**
```
[Wordmark]
Code sent to +1 (555) ···-1234

[_][_][_][_][_][_]   ← auto-submits on digit 6

Resend code  (appears after 30s)
Having trouble? Sign in with email instead  (appears after 2 failed sends)
```

---

## Error Handling

All errors surface inline — no redirects, no full-page error states.

| Scenario | Message | Recovery |
|----------|---------|----------|
| Invalid phone format | "Please enter a valid phone number." | Client-side, before send |
| SMS delivery failure | "We couldn't send a code. Try again." | Retry button |
| Wrong code | "That code didn't match — try again." | Input stays, refocused |
| Expired code | "That code has expired." | "Send a new code" button |
| 3 wrong attempts | "Request a new code to continue." | Resend triggered |
| SMS fails twice | Shows "Sign in with email instead" link | Falls back to magic link |
| Network error | "Check your connection and try again." | Retry button |

Resend link appears after 30 seconds on the code entry screen. One tap resends. Timer resets.

---

## Existing Users

Existing email-only accounts are unaffected in the database. On their next session:

- Login page shows phone entry (email no longer surfaced by default)
- If they have a phone already attached to their Supabase auth account, they proceed normally
- If not, the email fallback ("Sign in with email instead") lets them in — after which the app prompts them to add a phone number

No forced migration. The fallback handles the transition gracefully.

---

## Out of Scope

- Social login (Apple, Google)
- Password auth
- International number validation beyond basic format check (can add `libphonenumber-js` later)
- In-app session expiry countdown/warning UI
