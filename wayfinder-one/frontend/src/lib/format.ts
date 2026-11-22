/** Formatting helpers (A7): Asia/Kolkata always, en-IN money, freshness vs sim_now. */

const IST = 'Asia/Kolkata';

export type UiLocale = 'en-IN' | 'hi-IN';

export function intlLocale(lang: string | undefined): UiLocale {
  return lang === 'hi' ? 'hi-IN' : 'en-IN';
}

const moneyFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function fmtMoney(inr: number | null | undefined): string {
  if (inr === null || inr === undefined) return '—';
  return `₹${moneyFmt.format(inr)}`;
}

export function fmtMoneySigned(inr: number): string {
  const sign = inr > 0 ? '+' : inr < 0 ? '−' : '';
  return `${sign}₹${moneyFmt.format(Math.abs(inr))}`;
}

export function fmtTime(iso: string, lang?: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(iso));
}

export function fmtDate(iso: string, lang?: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(iso));
}

export function fmtDay(iso: string, lang?: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    timeZone: IST,
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(new Date(iso));
}

export function fmtDateTime(iso: string, lang?: string): string {
  return `${fmtDay(iso, lang)} · ${fmtTime(iso, lang)}`;
}

/** "checked 2 min ago" — against sim_now when the trip carries one (A7). */
export function freshness(checkedAt: string, simNow?: string | null, lang?: string): string {
  const ref = simNow ? new Date(simNow) : new Date();
  const mins = Math.max(0, Math.round((ref.getTime() - new Date(checkedAt).getTime()) / 60000));
  if (mins < 1) return lang === 'hi' ? 'अभी जाँचा गया' : 'checked just now';
  if (mins === 1) return lang === 'hi' ? '1 मिनट पहले जाँचा गया' : 'checked 1 min ago';
  if (mins < 60) return lang === 'hi' ? `${mins} मिनट पहले जाँचा गया` : `checked ${mins} min ago`;
  const hours = Math.round(mins / 60);
  return lang === 'hi' ? `${hours} घंटे पहले जाँचा गया` : `checked ${hours} h ago`;
}

export function timeAgo(ts: string, simNow?: string | null): string {
  const ref = simNow ? new Date(simNow) : new Date();
  const mins = Math.max(0, Math.round((ref.getTime() - new Date(ts).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function signedPct(x: number): string {
  const v = Math.round(x * 100);
  return `${v > 0 ? '+' : ''}${v}%`;
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** +45 min / +10 min tight / −12 min missed (A6.1 SlackConnector). */
export function slackLabel(min: number): { text: string; tone: 'ok' | 'tight' | 'missed' } {
  if (min < 0) return { text: `−${fmtDuration(Math.abs(min))} missed`, tone: 'missed' };
  if (min <= 15) return { text: `+${fmtDuration(min)} tight`, tone: 'tight' };
  return { text: `+${fmtDuration(min)}`, tone: 'ok' };
}

export function slugId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}

/** Idempotency keys: {verb}-{scope}-{random6+} matching the contract pattern (B6.1). */
export function idemKey(verb: string, scope: string): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${verb}-${scope}-${rnd}`;
}
