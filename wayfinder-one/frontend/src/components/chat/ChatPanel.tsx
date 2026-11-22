'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { Mic, MicOff, SendHorizonal, Sparkles, Wand2 } from 'lucide-react';
import type { ChatResponse } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { useVoice } from '@/hooks/useVoice';
import { Button } from '@/components/ui/Button';
import { SimBadge } from '@/components/ui/SimBadge';
import { Chip } from '@/components/ui/Chip';

export const GOLDEN_DEMO_REQUEST =
  'Plan a 5-day budget trip from Bengaluru for 2 people, early December, around ₹55,000. We like tea estates, waterfalls and sunsets. Avoid driving on ghat roads after dark.';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export type WorkspacePhase = 'empty' | 'clarifying' | 'recommending' | 'planning' | 'planned';

export function ChatPanel({
  tripId,
  phase,
  onResponse,
  onSendStart,
  onQuickReply,
  quickReplies,
  resumeTrip,
  onResume,
  className
}: {
  tripId: string | null;
  phase: WorkspacePhase;
  onResponse: (r: ChatResponse) => void;
  onSendStart?: () => void;
  onQuickReply?: (q: string) => void;
  quickReplies?: string[];
  resumeTrip?: { id: string; title: string } | null;
  onResume?: () => void;
  className?: string;
}) {
  const [message, setMessage] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voice = useVoice('en');
  const tooLong = message.length > 2000; // ChatRequest validation (B6.3)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, phase]);

  // voice transcript preview lands in the input for a deliberate send (A6b)
  useEffect(() => {
    if (voice.finalText) {
      const t = voice.consume();
      if (t) setMessage((m) => (m ? `${m} ${t}` : t));
    }
  }, [voice.finalText, voice]);

  const send = useMutation({
    mutationFn: (text: string) => api.chat({ message: text, trip_id: tripId, locale: 'en', input_mode: 'TEXT' }),
    onMutate: (text) => setTurns((prev) => [...prev, { role: 'user', text }]),
    onSuccess: (r) => {
      setTurns((prev) => [...prev, { role: 'assistant', text: r.assistant_message }]);
      onResponse(r);
    },
    onError: (e) => {
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', text: e instanceof Error ? e.message : 'The planner is unavailable right now. Try again.' }
      ]);
    }
  });

  function submit(text?: string) {
    const value = (text ?? message).trim();
    if (!value || tooLong || send.isPending) return;
    setMessage('');
    onSendStart?.();
    send.mutate(value);
  }

  return (
    <section
      data-testid="chat-panel"
      aria-label="Plan with the travel agent"
      className={clsx('flex min-h-0 flex-col rounded-card border border-line bg-surface shadow-card', className)}
    >
      <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg leading-tight">Plan a journey</h2>
          <p className="truncate text-xs text-ink-2">Tell me the vibe, dates and budget — I&apos;ll prove the plan before anything is booked.</p>
        </div>
        <SimBadge source="Agent (mock LLM)" />
      </header>

      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {turns.length === 0 && phase === 'empty' ? (
          <EmptyChat onStartDemo={() => submit(GOLDEN_DEMO_REQUEST)} onPick={(q) => submit(q)} resumeTrip={resumeTrip} onResume={onResume} />
        ) : null}
        {turns.map((t, i) => (
          <Bubble key={i} role={t.role} text={t.text} />
        ))}
        {send.isPending ? <Thinking /> : null}
      </div>

      {quickReplies?.length && !send.isPending ? (
        <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              data-testid="quick-reply"
              onClick={() => {
                onQuickReply?.(q);
                submit(q);
              }}
              className="rounded-full border border-brand/30 bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand transition-colors hover:bg-brand hover:text-brand-ink"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      <footer className="border-t border-line px-4 py-3">
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="chat-input">
            Message the travel agent
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            data-testid="chat-input"
            value={message}
            rows={2}
            placeholder={phase === 'planned' ? 'Ask about bookings, vouchers, changes…' : 'e.g. Plan a 5-day budget trip from Bengaluru for 2 in early December…'}
            className={clsx(
              'scroll-thin max-h-28 min-h-11 flex-1 resize-none rounded-inset border bg-surface-2 px-3 py-2.5 text-sm',
              tooLong ? 'border-red' : 'border-line focus:border-brand'
            )}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            aria-describedby={tooLong ? 'chat-counter' : undefined}
          />
          {voice.supported ? (
            <Button
              variant="secondary"
              size="md"
              aria-label={voice.listening ? 'Stop dictation' : 'Dictate a message'}
              data-testid="voice-button"
              className={clsx('!px-3', voice.listening && 'animate-pulse !border-brand text-brand')}
              onClick={() => (voice.listening ? voice.stop() : voice.start())}
            >
              {voice.listening ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
            </Button>
          ) : null}
          <Button
            data-testid="chat-send"
            aria-label="Send message"
            disabled={!message.trim() || tooLong}
            loading={send.isPending}
            className="!px-3"
            onClick={() => submit()}
          >
            <SendHorizonal className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        {voice.transcript && voice.listening ? (
          <p className="mt-2 rounded-inset bg-surface-2 px-3 py-2 text-sm italic text-ink-2">“{voice.transcript}”</p>
        ) : null}
        {tooLong ? (
          <p id="chat-counter" className="tnum mt-1.5 text-right font-mono text-xs text-red">
            {message.length}/2000 — trim it down
          </p>
        ) : null}
      </footer>
    </section>
  );
}

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  return (
    <div className={clsx('flex', role === 'user' ? 'justify-end' : 'justify-start')}>
      <p
        className={clsx(
          'max-w-[85%] whitespace-pre-wrap rounded-card px-3.5 py-2.5 text-sm leading-relaxed',
          role === 'user' ? 'rounded-br-inset bg-brand text-brand-ink' : 'rounded-bl-inset border border-line bg-surface-2 text-ink'
        )}
      >
        {text}
      </p>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex justify-start">
      <p className="rounded-bl-inset rounded-card border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">
        <span className="mr-1 inline-flex gap-1 align-middle" aria-label="Agent is thinking">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-3"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </span>
        Thinking…
      </p>
    </div>
  );
}

function EmptyChat({
  onStartDemo,
  onPick,
  resumeTrip,
  onResume
}: {
  onStartDemo: () => void;
  onPick: (q: string) => void;
  resumeTrip?: { id: string; title: string } | null;
  onResume?: () => void;
}) {
  const examples = ['A calm week in the hills of Munnar', 'Goa in December, 2 people', 'Hampi ruins + bouldering'];
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-paper-wash text-brand shadow-card">
        <Wand2 className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h3 className="font-display text-2xl">Where to next?</h3>
        <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-ink-2">
          Describe the trip in one line. You&apos;ll see two solver-verified plans with the math shown — nothing books without your approval.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {examples.map((e) => (
          <button
            key={e}
            type="button"
            data-testid="quick-reply"
            onClick={() => onPick(e)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 transition-colors hover:border-brand hover:text-brand"
          >
            {e}
          </button>
        ))}
      </div>
      {resumeTrip && onResume ? (
        <button
          type="button"
          data-testid="resume-trip"
          onClick={onResume}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-brand-ink"
        >
          Continue “{resumeTrip.title}” →
        </button>
      ) : null}
      <button
        type="button"
        data-testid="try-demo"
        onClick={onStartDemo}
        className="group inline-flex items-center gap-1.5 rounded-full bg-grad-brand px-4 py-2 text-sm font-semibold text-brand-ink shadow-card transition-transform hover:scale-[1.02]"
      >
        <Chip tone="sim" className="!border-0 !bg-white/20 !text-white">
          Demo
        </Chip>
        Try the demo trip
      </button>
    </div>
  );
}
