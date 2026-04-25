'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PRIMARY_OWNER_ROLES,
  SECONDARY_OWNER_ROLES,
  SECONDARY_OWNER_VALUES,
  PRIMARY_MEMBER_ROLES,
  SECONDARY_MEMBER_ROLES,
} from '@/lib/roles';

const INPUT =
  'w-full bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm outline-none';

const SELECT =
  'w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-foreground/60 transition rounded-sm outline-none';

function OwnerRoleSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [showMore, setShowMore] = useState(() => SECONDARY_OWNER_VALUES.has(value));

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
            onClick={() => { onChange(r.value); setShowMore(false); }}
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
            onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
            className={SELECT}
          >
            <option value="" disabled>Select a role…</option>
            {SECONDARY_OWNER_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
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
        <option value="" disabled>Relationship…</option>
        <optgroup label="Family">
          {PRIMARY_MEMBER_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </optgroup>
        <optgroup label="Extended family">
          {SECONDARY_MEMBER_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </optgroup>
      </select>


      <div className="space-y-1">
        <label className="text-xs text-muted-foreground/60">Birthday (optional)</label>
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

function nextLocalId() {
  return `${Date.now()}-${Math.random()}`;
}

type Step = 'family-profile' | 'members';

export default function SetupPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('family-profile');

  const [familyName,      setFamilyName]      = useState('');
  const [ownerName,       setOwnerName]       = useState('');
  const [ownerRole,       setOwnerRole]       = useState('parent');
  const [members,         setMembers]         = useState<MemberDraft[]>([]);

  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  function handleProfileNext(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim() || !ownerRole) return;
    setError('');
    setStep('members');
  }

  async function handleFinalSubmit(e: React.FormEvent) {
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

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName:       ownerName.trim(),
          ownerRole,
          customOwnerRole: null,
          familyName:      familyName.trim() || null,
          members:         members.map((m) => ({
            name:              m.name.trim(),
            role:              m.role,
            customRoleLabel:   null,
            birthDate:         m.birthDate || null,
          })),
        }),
      });

      if (res.status === 401) { router.push('/login'); return; }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong. Please try again.');
        setBusy(false);
        return;
      }

      router.push('/capture');
    } catch {
      setError('Could not save your profile. Check your connection.');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-foreground">
            {step === 'family-profile' ? 'Your family profile.' : 'Your family.'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 'family-profile'
              ? 'Tell us a little about yourself.'
              : 'Add the people you\'re writing for.'}
          </p>
        </div>

        {/* ── Step 1: Profile ──────────────────────────────────── */}
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


            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              className="w-full py-3 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
            >
              Continue
            </button>
          </form>
        )}

        {/* ── Step 2: Members ──────────────────────────────────── */}
        {step === 'members' && (
          <form onSubmit={handleFinalSubmit} className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add the people you&apos;re writing for. You can always add more later.
            </p>

            <div className="space-y-3">
              {members.map((m, i) => (
                <MemberRow
                  key={m.localId}
                  member={m}
                  onChange={(updated) =>
                    setMembers((prev) => prev.map((x, j) => (j === i ? updated : x)))
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
                  { localId: nextLocalId(), name: '', role: '', birthDate: '' },
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
              {busy ? 'Saving…' : 'Get started'}
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
      </div>
    </main>
  );
}
