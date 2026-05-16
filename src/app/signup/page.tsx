'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { motion } from 'framer-motion';
import AnimatedWordmark from '@/components/AnimatedWordmark';
import {
  PRIMARY_OWNER_ROLES,
  SECONDARY_OWNER_ROLES,
  SECONDARY_OWNER_VALUES,
  PRIMARY_MEMBER_ROLES,
  SECONDARY_MEMBER_ROLES,
} from '@/lib/roles';

// ─── Shared style tokens ──────────────────────────────────────
const INPUT =
  'w-full bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm outline-none';

const SELECT =
  'w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-foreground/60 transition rounded-sm outline-none';

// ─── Owner role selector ──────────────────────────────────────
function OwnerRoleSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [showMore, setShowMore] = useState(() => SECONDARY_OWNER_VALUES.has(value));

  function handlePrimary(v: string) {
    onChange(v);
    setShowMore(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground uppercase tracking-widest">
        Your role in the family
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {PRIMARY_OWNER_ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => handlePrimary(r.value)}
            className={`py-2.5 text-xs tracking-wide border transition rounded-sm ${
              value === r.value
                ? 'border-foreground text-foreground bg-foreground/5'
                : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground/80'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {!showMore ? (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition"
        >
          More family roles →
        </button>
      ) : (
        <div className="space-y-2">
          <select
            value={SECONDARY_OWNER_VALUES.has(value) ? value : ''}
            onChange={(e) => {
              if (e.target.value) onChange(e.target.value);
            }}
            className={SELECT}
          >
            <option value="" disabled>
              Select a role…
            </option>
            {SECONDARY_OWNER_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowMore(false)}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition"
          >
            ← Back to main roles
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Family member row ────────────────────────────────────────
interface MemberDraft {
  localId: string;
  name: string;
  role: string;
  birthDate: string;
}

function MemberRow({
  member,
  onChange,
  onRemove,
}: {
  member: MemberDraft;
  onChange: (m: MemberDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 border border-border/50 rounded-sm px-4 py-4">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Name"
          value={member.name}
          onChange={(e) => onChange({ ...member, name: e.target.value })}
          className="flex-1 bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove member"
          className="shrink-0 w-10 h-10 flex items-center justify-center border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground transition rounded-sm text-base"
        >
          ×
        </button>
      </div>

      <select
        value={member.role}
        onChange={(e) => onChange({ ...member, role: e.target.value })}
        className={SELECT}
      >
        <option value="" disabled>
          Relationship…
        </option>
        <optgroup label="Family">
          {PRIMARY_MEMBER_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Extended family">
          {SECONDARY_MEMBER_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </optgroup>
      </select>



      <div className="space-y-1">
        <label className="text-xs text-muted-foreground/60">
          Birthday (optional)
        </label>
        <input
          type="date"
          value={member.birthDate}
          onChange={(e) => onChange({ ...member, birthDate: e.target.value })}
          max={new Date().toISOString().split('T')[0]}
          className={INPUT}
        />
      </div>
    </div>
  );
}

// ─── Step progress bar ────────────────────────────────────────
function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all ${
            i < current ? 'w-8 bg-foreground/60' : 'w-4 bg-foreground/20'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
type Step = 'account' | 'family-profile' | 'members' | 'sent';

function nextLocalId() {
  return `${Date.now()}-${Math.random()}`;
}

export default function SignupPage() {
  const [step, setStep] = useState<Step>('account');

  // Step 1
  const [email, setEmail] = useState('');

  // Step 2
  const [familyName,      setFamilyName]      = useState('');
  const [ownerName,       setOwnerName]       = useState('');
  const [ownerRole,       setOwnerRole]       = useState('parent');

  // Step 3
  const [members, setMembers] = useState<MemberDraft[]>([]);

  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  function handleAccountNext(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStep('family-profile');
  }

  function handleProfileNext(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim() || !ownerRole) return;
    setStep('members');
  }

  async function handleMembersSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    for (const m of members) {
      if (!m.name.trim()) {
        setError('Each family member needs a name.');
        return;
      }
      if (!m.role) {
        setError('Please select a relationship for each family member.');
        return;
      }
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: `${window.location.origin}/auth/callback?next=/capture`,
          data: {
            owner_name:        ownerName.trim(),
            owner_role:        ownerRole,
            custom_owner_role: null,
            family_name:       familyName.trim() || null,
            family_members:    members.map((m) => ({
              name:              m.name.trim(),
              role:              m.role,
              custom_role_label: null,
              birth_date:        m.birthDate || null,
            })),
          },
        }),
      });
      let json: { error?: string } = {};
      try {
        json = (await res.json()) as { error?: string };
      } catch {
        setError('Something went wrong. Please try again.');
        return;
      }
      if (!res.ok || json.error) {
        setError(json.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setStep('sent');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'sent') {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="font-serif text-foreground text-2xl">Almost there.</p>
          <p className="text-sm text-muted-foreground">
            Check your email at{' '}
            <span className="text-foreground">{email}</span> to finish
            setting up your family profile.
          </p>
        </div>
      </main>
    );
  }

  const STEP_INDEX: Record<Step, number> = {
    account:        1,
    'family-profile': 2,
    members:        3,
    sent:           4,
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">

        {/* Header */}
        <div className="text-center space-y-4">
          <AnimatedWordmark />
          <motion.p
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="text-sm text-muted-foreground"
          >
            {step === 'account'          && 'Create your account'}
            {step === 'family-profile'   && 'Your family profile'}
            {step === 'members'          && 'Your family'}
          </motion.p>
        </div>

        <Progress current={STEP_INDEX[step]} total={3} />

        {/* ── Step 1: Email ───────────────────────────────────── */}
        {step === 'account' && (
          <form onSubmit={handleAccountNext} className="space-y-4">
            <input
              type="email"
              required
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
            <button
              type="submit"
              className="w-full py-3 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
            >
              Continue
            </button>
          </form>
        )}

        {/* ── Step 2: Family profile ──────────────────────────── */}
        {step === 'family-profile' && (
          <form onSubmit={handleProfileNext} className="space-y-4">
            <input
              type="text"
              placeholder="Family name (e.g. The Johnson Family)"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className={INPUT}
            />
            <input
              type="text"
              required
              placeholder="Your first name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className={INPUT}
            />

            <OwnerRoleSelector value={ownerRole} onChange={setOwnerRole} />

            <button
              type="submit"
              className="w-full py-3 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setStep('account')}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition"
            >
              ← Back
            </button>
          </form>
        )}

        {/* ── Step 3: Family members ──────────────────────────── */}
        {step === 'members' && (
          <form onSubmit={handleMembersSubmit} className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add the people you&apos;re writing for. You can always add more later.
            </p>

            <div className="space-y-3">
              {members.map((m, i) => (
                <MemberRow
                  key={m.localId}
                  member={m}
                  onChange={(updated) =>
                    setMembers((prev) =>
                      prev.map((x, j) => (j === i ? updated : x))
                    )
                  }
                  onRemove={() =>
                    setMembers((prev) => prev.filter((_, j) => j !== i))
                  }
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setMembers((prev) => [
                  ...prev,
                  {
                    localId:   nextLocalId(),
                    name:      '',
                    role:      '',
                    birthDate: '',
                  },
                ])
              }
              className="w-full py-3 border border-border text-muted-foreground text-sm tracking-wide hover:border-foreground/40 hover:text-foreground transition"
            >
              + Add family member
            </button>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 border border-foreground text-foreground text-sm tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition"
            >
              {busy ? 'Creating account…' : 'Continue'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('family-profile'); setError(''); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition"
            >
              ← Back
            </button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <a href="/login" className="underline hover:text-foreground transition">
            Sign in
          </a>
        </p>
        <p className="text-center text-xs text-muted-foreground/50 leading-relaxed">
          Your entries are private to you. We do not share or sell your
          family&apos;s data.
        </p>
      </div>
    </main>
  );
}
