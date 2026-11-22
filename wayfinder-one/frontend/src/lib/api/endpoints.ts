import type {
  Alert,
  AlertAck,
  Booking,
  BookRequest,
  BookResult,
  CancelRequest,
  ChatRequest,
  ChatResponse,
  CourtesyDraft,
  DemoClock,
  DemoInject,
  DraftDecision,
  EvidenceEvent,
  EvidencePack,
  Group,
  GroupPreference,
  LiveStatus,
  MergedPreferences,
  ModifyBookingRequest,
  NotificationPrefs,
  OfflineManifest,
  OptionalityReport,
  Plan,
  PrioritiesRequest,
  PushSubscription,
  RebalancePreview,
  RebalanceRequest,
  RegroupSuggestion,
  ResponsibleReport,
  SafeCheckin,
  SafeCheckinCreate,
  ShareLink,
  SharedTripView,
  SlackScore,
  SplitReport,
  SseToken,
  SwitchDecision,
  SwitchRecommendation,
  SwitchResult,
  TokenResponse,
  Trip,
  TripDetail,
  TripSummary,
  TrustedContact,
  TrustedContactCreate,
  VoteRequest,
  VoteTally
} from '@contracts/types';
import { API_MODE, request } from './client';
import { fixtureFetch } from './fixtures';

/** Every endpoint in B6.3/B6.3b, typed end to end. Fixtures mode routes to the local world. */
async function call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, idem?: string, raw?: boolean): Promise<T> {
  if (API_MODE === 'fixtures') {
    const { getToken } = await import('@/lib/auth');
    return fixtureFetch<T>(method, path, body, getToken(), idem);
  }
  return request<T>(path, { method, body, idempotencyKey: idem, raw });
}

export const api = {
  // auth (28–31)
  register: (body: { email: string; password: string; name: string; role: 'TRAVELLER' | 'ADVISOR' }) =>
    call<TokenResponse>('POST', '/auth/register', body),
  login: (body: { email: string; password: string }) => call<TokenResponse>('POST', '/auth/login', body),
  me: () => call<import('@contracts/types').User>('GET', '/auth/me'),
  sseToken: () => call<SseToken>('POST', '/auth/sse-token'),

  // preferences (32–33)
  getPrefs: () => call<NotificationPrefs>('GET', '/me/preferences'),
  putPrefs: (body: NotificationPrefs) => call<NotificationPrefs>('PUT', '/me/preferences', body),
  pushSubscription: (body: PushSubscription) => call<{ ok: true }>('POST', '/me/push-subscription', body),

  // health (25)
  health: () => call<{ status: string; contract_version: string; llm_mode: string; supplier: string; db: string }>('GET', '/health'),

  // chat (1)
  chat: (body: ChatRequest) => call<ChatResponse>('POST', '/chat', body),

  // trips (2, 3)
  trips: () => call<TripSummary[]>('GET', '/trips'),
  trip: (id: string) => call<TripDetail>('GET', `/trips/${id}`),

  // booking (4, 5, 18, 56, 17)
  book: (id: string, body: BookRequest, idem: string) => call<BookResult>('POST', `/trips/${id}/book`, body, idem),
  bookings: (id: string) => call<Booking[]>('GET', `/trips/${id}/bookings`),
  cancelBooking: (bookingId: string, body: CancelRequest, idem: string) => call<Booking>('POST', `/bookings/${bookingId}/cancel`, body, idem),
  modifyBooking: (bookingId: string, body: ModifyBookingRequest, idem?: string) => call<Booking>('POST', `/bookings/${bookingId}/modify`, body, idem),
  vouchers: (id: string) => call<Array<{ booking_id: string; title: string; reference: string; html_url: string }>>('GET', `/trips/${id}/vouchers`),

  // slack / alerts / signals (6, 7, 8, 57)
  slack: (id: string) => call<SlackScore>('GET', `/trips/${id}/slack`),
  alerts: (id: string, state?: 'NEW') => call<Alert[]>('GET', `/trips/${id}/alerts${state ? `?state=${state}` : ''}`),
  ackAlert: (alertId: string, body: AlertAck) => call<Alert>('POST', `/alerts/${alertId}/ack`, body),
  signals: (id: string) => call<Array<{ signal: import('@contracts/types').Signal; used_in: string[] }>>('GET', `/trips/${id}/signals`),

  // switch + drafts (9, 10, 11, 12)
  switchRec: (id: string) => call<SwitchRecommendation | null>('GET', `/trips/${id}/switch`),
  switchDecision: (switchId: string, body: SwitchDecision, idem: string) => call<SwitchResult>('POST', `/switch/${switchId}/decision`, body, idem),
  drafts: (id: string, language?: string) => call<CourtesyDraft[]>('GET', `/trips/${id}/drafts${language ? `?language=${language}` : ''}`),
  draftDecision: (draftId: string, body: DraftDecision) => call<CourtesyDraft>('POST', `/drafts/${draftId}/decision`, body),

  // evidence (13, 14, 58)
  evidence: (id: string) => call<EvidencePack>('GET', `/trips/${id}/evidence`),
  evidencePrint: (id: string) => call<EvidencePack>('GET', `/trips/${id}/evidence/print`),
  evidencePdf: (id: string) => request<Blob>(`/trips/${id}/evidence/pdf`, { raw: true }) as unknown as Promise<Blob>,

  // live (15, 16)
  live: (id: string) => call<LiveStatus>('GET', `/trips/${id}/live`),
  location: (id: string, body: { lat: number; lng: number; speed_kmh?: number; ts: string }) =>
    call<LiveStatus>('POST', `/trips/${id}/location`, body),

  // demo (20–24, 26)
  demoState: () => call<{ trip_id: string; window: string | null; sim_now: string | null; injected: DemoInject[] }>('GET', '/demo/state'),
  demoSeedTrip: () => call<TripDetail>('POST', '/demo/seed-trip'),
  demoClock: (tripId: string, body: DemoClock) => call<{ window: string; sim_now: string }>('POST', `/demo/clock?trip_id=${tripId}`, body),
  demoInject: (tripId: string, body: DemoInject) => call<{ signal_ids: string[] }>('POST', `/demo/inject?trip_id=${tripId}`, body),
  demoReset: () => call<{ ok: true }>('POST', '/demo/reset'),
  demoRoute: () => call<{ points: Array<{ lat: number; lng: number }> }>('GET', '/demo/route'),

  // priorities / time banking (42, 43)
  putPriorities: (id: string, body: PrioritiesRequest) => call<Plan>('PUT', `/trips/${id}/priorities`, body),
  rebalance: (id: string, body: RebalanceRequest, idem?: string) => call<RebalancePreview>('POST', `/trips/${id}/rebalance`, body, idem),

  // optionality / responsible (44, 45, 61)
  optionality: (id: string) => call<OptionalityReport>('GET', `/trips/${id}/optionality`),
  responsible: (id: string) => call<ResponsibleReport>('GET', `/trips/${id}/responsible`),
  swapItem: (id: string, body: { item_id: string; offer_id: string; apply: boolean; approve: boolean }, idem?: string) =>
    call<import('@contracts/types').SwapPreview>('POST', `/trips/${id}/swap-item`, body, idem),

  // group (34–41)
  createGroup: (id: string) => call<Group>('POST', `/trips/${id}/group`),
  joinGroup: (inviteCode: string) => call<Group>('POST', '/groups/join', { invite_code: inviteCode }),
  group: (id: string) => call<Group>('GET', `/trips/${id}/group`),
  putGroupPrefs: (id: string, body: GroupPreference) => call<MergedPreferences>('PUT', `/trips/${id}/group/preferences`, body),
  mergedPrefs: (id: string) => call<MergedPreferences>('GET', `/trips/${id}/group/merged`),
  vote: (id: string, body: VoteRequest) => call<VoteTally>('POST', `/trips/${id}/votes`, body),
  votes: (id: string) => call<VoteTally>('GET', `/trips/${id}/votes`),
  split: (id: string, method: 'EQUAL' | 'BY_BUDGET') => call<SplitReport>('GET', `/trips/${id}/split?method=${method}`),
  regroup: (id: string) => call<RegroupSuggestion | null>('GET', `/trips/${id}/regroup`),

  // safety (46–50)
  createShare: (id: string, ttlHours?: number) => call<ShareLink>('POST', `/trips/${id}/share`, { ttl_hours: ttlHours }),
  revokeShare: (id: string) => call<{ ok: true }>('DELETE', `/trips/${id}/share`),
  shareView: (token: string) => call<SharedTripView>('GET', `/share/${token}`),
  contacts: (id: string) => call<TrustedContact[]>('GET', `/trips/${id}/trusted-contacts`),
  addContact: (id: string, body: TrustedContactCreate) => call<TrustedContact>('POST', `/trips/${id}/trusted-contacts`, body),
  createCheckin: (id: string, body: SafeCheckinCreate) => call<SafeCheckin>('POST', `/trips/${id}/safe-checkins`, body),
  confirmCheckin: (checkinId: string) => call<SafeCheckin>('POST', `/safe-checkins/${checkinId}/confirm`),
  sos: (id: string, body: { lat?: number; lng?: number; message?: string }, idem: string) =>
    call<{ notified: string[]; queued: boolean }>('POST', `/trips/${id}/sos`, body, idem),

  // offline (51, 52)
  offlineManifest: (id: string) => call<OfflineManifest>('GET', `/trips/${id}/offline-manifest`),
  offlinePack: (id: string) => call<Record<string, unknown>>('GET', `/trips/${id}/offline-pack`),

  // advisor (53–55)
  advisorTrips: () => call<Array<import('@contracts/types').AdvisorTripRow>>('GET', '/advisor/trips'),
  advisorTrip: (id: string) => call<{ detail: TripDetail; notes: Array<{ id: string; trip_id: string; advisor_id: string; body: string; created_at: string }> }>('GET', `/advisor/trips/${id}`),
  advisorNote: (id: string, body: { body: string }) => call<{ id: string; trip_id: string; advisor_id: string; body: string; created_at: string }>('POST', `/advisor/trips/${id}/notes`, body),
  inviteAdvisor: (id: string, body: { advisor_email: string; consent_to_act: boolean }) => call<Trip>('POST', `/trips/${id}/advisor`, body)
};

/** Typed SSE event names (B6.5/B6.5b). */
export const SSE_EVENTS = [
  'alert.created',
  'slack.updated',
  'switch.proposed',
  'plan.switched',
  'draft.created',
  'booking.updated',
  'sim.clock',
  'signal.created',
  'plan.updated',
  'group.updated',
  'vote.updated',
  'safe_checkin.due',
  'notification.sent',
  'live.updated',
  'sim.reset'
] as const;

export type { EvidenceEvent };
