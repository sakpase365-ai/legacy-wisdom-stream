'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import AnimatedWordmark from '@/components/AnimatedWordmark';
import { normalizePhone, maskPhone } from '@/lib/phone';

type LoginState = 'phone' | 'code';

function LoginForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const next         = searchParams.get('next') ?? '/capture';

  const [loginState,        setLoginState]        = useState<LoginState>('phone');
  const [phone,             setPhone]             = useState('');
  const [normalizedPhone,   setNormalizedPhone]   = useState('');
  const [code,              setCode]              = useState('');
  const [error,             setError]             = useState('');
  const [busy,              setBusy]              = useState(false);
  const [resendCountdown,   setResendCountdown]   = useState(0);
  const [sendFailCount,     setSendFailCount]     = useState(0);
  const [showEmailFallback, setShowEmailFallback] = useState(false);

  const codeInputRef  = useRef<HTMLInputElement>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loginState === 'code') requestAnimationFrame(() => codeInputRef.current?.focus());
  }, [loginState]);

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  function startResendCountdown() {
    setResendCountdown(30);
    countdownRef.current = setInterval(() => {
      setResendCountdown((v) => {
        if (v <= 1) { clearInterval(countdownRef.current!); countdownRef.current = null; return 0; }
        return v - 1;
      });
    }, 1000);
  }

  async function sendCode(phoneE164: string) {
    setBusy(true);
    setError('');
    const supabase = getBrowserSupabase();
    if (!supabase) { setError('Auth not available.'); setBusy(false); return; }
    const { error: err } = await supabase.auth.signInWithOtp({ phone: phoneE164 });
    if (err) {
      const count = sendFailCount + 1;
      setSendFailCount(count);
      if (count >= 2) setShowEmailFallback(true);
      setError("We couldn't send a code. Try again.");
      setBusy(false);
      return;
    }
    setNormalizedPhone(phoneE164);
    setLoginState('code');
    startResendCountdown();
    setBusy(false);
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) { setError('Please enter a valid phone number.'); return; }
    await sendCode(normalized);
  }

  async function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length < 6) return;
    setBusy(true);
    setError('');
    const supabase = getBrowserSupabase();
    if (!supabase) { setError('Auth not available.'); setBusy(false); return; }
    const { error: err } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: digits,
      type:  'sms',
    });
    if (err) {
      setError("That code didn't match — try again.");
      setCode('');
      setBusy(false);
      codeInputRef.current?.focus();
      return;
    }
    router.push(next);
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center space-y-3">
          <AnimatedWordmark className="text-5xl font-serif font-light tracking-tight text-foreground sm:text-6xl md:text-7xl" />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75, duration: 0.45 }}
            className="text-xs text-muted-foreground sm:text-sm"
          >
            {loginState === 'phone' ? 'Sign in to continue' : `Code sent to ${maskPhone(normalizedPhone)}`}
          </motion.p>
        </div>

        {loginState === 'phone' && (
          <form onSubmit={(e) => void handlePhoneSubmit(e)} className="space-y-3">
            <div className="flex">
              <span className="flex items-center px-3 border border-r-0 border-border bg-card/50 text-muted-foreground text-sm rounded-l-sm select-none">
                +1
              </span>
              <input
                type="tel"
                required
                autoComplete="tel-national"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(''); }}
                className="flex-1 bg-card border border-border px-3 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-r-sm outline-none"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 border border-foreground text-foreground text-xs tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition sm:text-sm"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
            {showEmailFallback && (
              <p className="text-center text-xs text-muted-foreground">
                Having trouble?{' '}
                <a href="/login-email" className="underline hover:text-foreground transition">
                  Sign in with email instead
                </a>
              </p>
            )}
          </form>
        )}

        {loginState === 'code' && (
          <div className="space-y-4">
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              placeholder="——————"
              value={code}
              onChange={(e) => void handleCodeChange(e.target.value)}
              disabled={busy}
              maxLength={6}
              className="w-full bg-card border border-border px-3 py-3 text-foreground text-2xl text-center tracking-[0.5em] placeholder:text-muted-foreground/30 focus:border-foreground/60 transition rounded-sm outline-none disabled:opacity-50"
            />
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <div className="flex flex-col items-center gap-2">
              {resendCountdown > 0 ? (
                <p className="text-xs text-muted-foreground">Resend in {resendCountdown}s</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void sendCode(normalizedPhone)}
                  disabled={busy}
                  className="text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-30"
                >
                  Resend code
                </button>
              )}
              {showEmailFallback && (
                <a href="/login-email" className="text-xs text-muted-foreground hover:text-foreground transition">
                  Having trouble? Sign in with email instead
                </a>
              )}
              <button
                type="button"
                onClick={() => { setLoginState('phone'); setCode(''); setError(''); }}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition"
              >
                ← Change number
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground sm:text-xs">
          First time?{' '}
          <a href="/signup" className="underline hover:text-foreground transition">
            Create an account
          </a>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
