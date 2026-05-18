'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import { maskPhone } from '@/lib/phone';
import {
  PRIMARY_OWNER_ROLES,
  SECONDARY_OWNER_ROLES,
  SECONDARY_OWNER_VALUES,
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

interface ChildDraft {
  localId:   string;
  name:      string;
  birthDate: string;
}

function ChildCard({
  child,
  onChange,
  onRemove,
}: {
  child:    ChildDraft;
  onChange: (c: ChildDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 border border-border/50 rounded-sm px-4 py-4">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Name"
          value={child.name}
          onChange={(e) => onChange({ ...child, name: e.target.value })}
          className="flex-1 bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove child"
          className="shrink-0 w-10 h-10 flex items-center justify-center border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground transition rounded-sm text-base"
        >
          ×
        </button>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground/60">Birthday (optional)</label>
        <input
          type="date"
          value={child.birthDate}
          onChange={(e) => onChange({ ...child, birthDate: e.target.value })}
          max={new Date().toISOString().split('T')[0]}
          className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-foreground/60 transition rounded-sm outline-none"
        />
      </div>
    </div>
  );
}

function nextLocalId() {
  return `${Date.now()}-${Math.random()}`;
}

type Step = 'family-profile' | 'members' | 'verify-phone';

export default function SetupPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('family-profile');

  const [familyName,  setFamilyName]  = useState('');
  const [ownerName,   setOwnerName]   = useState('');
  const [ownerRole,   setOwnerRole]   = useState('parent');
  const [spouseName,  setSpouseName]  = useState('');
  const [children,    setChildren]    = useState<ChildDraft[]>([]);
  const [setupPhone,  setSetupPhone]  = useState('');

  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  const [phoneCode,            setPhoneCode]            = useState('');
  const [phoneVerifyBusy,      setPhoneVerifyBusy]      = useState(false);
  const [phoneError,           setPhoneError]           = useState('');
  const [phoneResendCountdown, setPhoneResendCountdown] = useState(0);
  const phoneCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (phoneCountdownRef.current) clearInterval(phoneCountdownRef.current);
  }, []);

  function startPhoneCountdown() {
    setPhoneResendCountdown(30);
    phoneCountdownRef.current = setInterval(() => {
      setPhoneResendCountdown((v) => {
        if (v <= 1) {
          clearInterval(phoneCountdownRef.current!);
          phoneCountdownRef.current = null;
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  async function triggerPhoneVerification() {
    const supabase = getBrowserSupabase();
    if (!supabase) { router.push('/capture'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const phone = (session?.user?.user_metadata?.phone as string | undefined) ?? '';
    if (!phone) { router.push('/capture'); return; }
    setSetupPhone(phone);
    const { error } = await supabase.auth.updateUser({ phone });
    if (error) { router.push('/capture'); return; }
    startPhoneCountdown();
    setStep('verify-phone');
  }

  async function verifyPhoneCode(digits: string) {
    const supabase = getBrowserSupabase();
    if (!supabase || phoneVerifyBusy) return;
    setPhoneVerifyBusy(true);
    setPhoneError('');
    const { error } = await supabase.auth.verifyOtp({
      phone: setupPhone,
      token: digits,
      type:  'phone_change',
    });
    if (error) {
      setPhoneError("That code didn't match — try again.");
      setPhoneCode('');
      setPhoneVerifyBusy(false);
      return;
    }
    router.push('/capture');
  }

  function handleProfileNext(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim() || !ownerRole) return;
    setError('');
    setStep('members');
  }

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    for (const c of children) {
      if (!c.name.trim()) { setError('Each child needs a name.'); return; }
    }
    setBusy(true);
    try {
      const members = [
        ...(spouseName.trim()
          ? [{ name: spouseName.trim(), role: 'spouse', customRoleLabel: null, birthDate: null }]
          : []),
        ...children.map((c) => ({
          name:            c.name.trim(),
          role:            'child',
          customRoleLabel: null,
          birthDate:       c.birthDate || null,
        })),
      ];
      const res = await fetch('/api/setup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ownerName:       ownerName.trim(),
          ownerRole,
          customOwnerRole: null,
          familyName:      familyName.trim() || null,
          members,
        }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong. Please try again.');
        setBusy(false);
        return;
      }
      await triggerPhoneVerification();
    } catch {
      setError('Could not save your profile. Check your connection.');
    } finally {
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
          <form onSubmit={(e) => void handleFinalSubmit(e)} className="space-y-6">

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Spouse / partner
              </p>
              <input
                type="text"
                placeholder="Their first name (optional)"
                value={spouseName}
                onChange={(e) => setSpouseName(e.target.value)}
                className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm outline-none"
              />
            </div>

            <div className="border-t border-border/30" />

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Children
              </p>
              {children.map((c, i) => (
                <ChildCard
                  key={c.localId}
                  child={c}
                  onChange={(updated) =>
                    setChildren((prev) => prev.map((x, j) => (j === i ? updated : x)))
                  }
                  onRemove={() =>
                    setChildren((prev) => prev.filter((_, j) => j !== i))
                  }
                />
              ))}
              <button
                type="button"
                onClick={() =>
                  setChildren((prev) => [
                    ...prev,
                    { localId: nextLocalId(), name: '', birthDate: '' },
                  ])
                }
                className="w-full py-3 border border-dashed border-border text-muted-foreground text-sm tracking-wide hover:border-foreground/40 hover:text-foreground transition rounded-sm"
              >
                + Add {children.length === 0 ? 'a child' : 'another child'}
              </button>
            </div>

            <p className="text-xs text-muted-foreground/60 text-center">
              You can always add more family members later.
            </p>

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

        {/* ── Step 3: Verify phone ─────────────────────────────── */}
        {step === 'verify-phone' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="font-serif text-3xl text-foreground">One last step.</h1>
              <p className="text-sm text-muted-foreground">
                {setupPhone
                  ? `Enter the code we texted to ${maskPhone(setupPhone)}.`
                  : 'Enter the code we texted to your phone.'}
              </p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              placeholder="——————"
              value={phoneCode}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPhoneCode(digits);
                if (digits.length === 6) void verifyPhoneCode(digits);
              }}
              disabled={phoneVerifyBusy}
              maxLength={6}
              className="w-full bg-card border border-border px-3 py-3 text-foreground text-2xl text-center tracking-[0.5em] placeholder:text-muted-foreground/30 focus:border-foreground/60 transition rounded-sm outline-none disabled:opacity-50"
            />

            {phoneError && <p className="text-xs text-red-400 text-center">{phoneError}</p>}

            <div className="flex flex-col items-center gap-2">
              {phoneResendCountdown > 0 ? (
                <p className="text-xs text-muted-foreground">Resend in {phoneResendCountdown}s</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void triggerPhoneVerification()}
                  disabled={phoneVerifyBusy}
                  className="text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-30"
                >
                  Resend code
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push('/capture')}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
