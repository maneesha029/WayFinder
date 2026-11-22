'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { setSessionFromToken } from '@/lib/auth';
import { api } from '@/lib/api/endpoints';
import { LogoMark } from '@/components/shell/AppShell';
import { Button } from '@/components/ui/Button';
import { SimBadge } from '@/components/ui/SimBadge';
import { DEMO_MODE } from '@/lib/api/client';

/**
 * `/login` (A6b): tabs Sign in / Register, inline validation, generic error
 * (never reveals which part was wrong), demo-account hint in demo mode.
 */
export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'TRAVELLER' | 'ADVISOR'>('TRAVELLER');
  const [touched, setTouched] = useState(false);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const passwordOk = password.length >= 8;

  const submit = useMutation({
    mutationFn: async () => {
      const res =
        tab === 'signin'
          ? await api.login({ email, password })
          : await api.register({ email, password, name, role });
      setSessionFromToken(res);
      return res;
    },
    onSuccess: (res) => {
      router.replace(res.user.role === 'ADVISOR' ? '/advisor' : '/');
    }
  });

  const canSubmit = tab === 'signin' ? emailOk && passwordOk : emailOk && passwordOk && name.trim().length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-wash px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoMark size={44} />
          <h1 className="font-display text-3xl">
            Wayfinder <span className="text-brand">One</span>
          </h1>
          <p className="max-w-sm text-balance text-sm leading-relaxed text-ink-2">
            The travel agent that doesn&apos;t stop working after you book — plans with proof, books with approval, and
            keeps guarding the trip.
          </p>
        </div>

        <div className="rounded-card border border-line bg-surface p-6 shadow-card" data-testid="login-form">
          <div
            role="tablist"
            aria-label="Sign in or register"
            className="mb-5 grid grid-cols-2 rounded-full border border-line bg-surface-2 p-0.5"
          >
            {(
              [
                ['signin', 'Sign in'],
                ['register', 'Register']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => {
                  setTab(id);
                  submit.reset();
                }}
                className={clsx(
                  'rounded-full py-2 text-sm font-semibold transition-all',
                  tab === id ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (canSubmit) submit.mutate();
            }}
          >
            {tab === 'register' ? (
              <Field
                label="Your name"
                name="name"
                value={name}
                onChange={setName}
                autoComplete="name"
                invalid={touched && !name.trim()}
                hint="Name is required."
              />
            ) : null}
            <Field
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              invalid={touched && !emailOk}
              hint="That doesn't look like an email address."
            />
            <Field
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              invalid={touched && !passwordOk}
              hint="Use at least 8 characters."
            />
            {tab === 'register' ? (
              <fieldset className="flex gap-2" aria-label="Account type">
                {(['TRAVELLER', 'ADVISOR'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={role === r}
                    onClick={() => setRole(r)}
                    className={clsx(
                      'flex-1 rounded-inset border px-3 py-2 text-sm font-medium transition-colors',
                      role === r ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-2 hover:border-ink-3'
                    )}
                  >
                    {r === 'TRAVELLER' ? 'Traveller' : 'Travel advisor'}
                  </button>
                ))}
              </fieldset>
            ) : null}

            {submit.isError ? (
              <p role="alert" className="rounded-inset bg-red-bg px-3 py-2.5 text-sm text-red">
                Email or password is incorrect.
              </p>
            ) : null}

            <Button type="submit" className="w-full" loading={submit.isPending} disabled={!canSubmit && touched} data-testid={tab === 'signin' ? 'login-submit' : 'register-submit'}>
              {tab === 'signin' ? 'Sign in' : 'Create account'}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </form>

          {DEMO_MODE ? (
            <div className="mt-5 rounded-inset border border-dashed border-line bg-surface-2/60 px-3.5 py-3 text-sm">
              <p className="font-medium">Demo accounts</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-ink-2">
                <span>
                  traveller@demo.wf <KeyRound className="mx-0.5 inline h-3 w-3" aria-hidden />demo1234
                </span>
                <span>
                  advisor@demo.wf <KeyRound className="mx-0.5 inline h-3 w-3" aria-hidden />demo1234
                </span>
                <SimBadge source="Seeded demo users" />
              </p>
            </div>
          ) : null}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-3">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Your session lives in this tab only. No payments, no real tickets — this is a prototype.</span>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  autoComplete,
  invalid,
  hint
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  invalid?: boolean;
  hint?: string;
}) {
  const hintId = `${name}-hint`;
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        data-testid={tabName(name)}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? hintId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'h-11 w-full rounded-inset border bg-surface-2 px-3 text-sm',
          invalid ? 'border-red' : 'border-line focus:border-brand'
        )}
      />
      {invalid && hint ? (
        <p id={hintId} className="mt-1 text-xs text-red">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function tabName(name: string): string {
  return name === 'email' ? 'login-email' : name === 'password' ? 'login-password' : name;
}
