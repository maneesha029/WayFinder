# contracts/models.py
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

CONTRACT_VERSION = "1.0.0"

ItemType      = Literal["FLIGHT", "HOTEL", "TRANSFER", "ACTIVITY"]
Priority      = Literal["MUST", "NICE", "SKIP_IF_NEEDED"]
BookingStatus = Literal["NOT_BOOKED", "HELD", "PENDING", "CONFIRMED", "FAILED", "CANCELLED"]
AlertLevel    = Literal["INFO", "NUDGE", "ACTION_NEEDED", "CRITICAL"]
Health        = Literal["GREEN", "AMBER", "RED"]
RiskTag       = Literal["RAIN", "GHAT_ROAD", "CROWD", "STRIKE", "HEAT"]
Window        = Literal["POST_BOOKING", "T-72H", "T-24H", "T-3H", "LIVE"]
TripStatus    = Literal["DRAFT", "PLANNED", "BOOKED", "ACTIVE", "COMPLETED"]

class Provenance(BaseModel):
    source: str                         # "TBO Sandbox (sim)", "Flight status feed (sim)"
    checked_at: datetime
    is_simulated: bool = True
    confidence: float = Field(1.0, ge=0, le=1)

class Place(BaseModel):
    name: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)

class BookingRef(BaseModel):
    booking_id: str
    status: BookingStatus
    supplier_ref: str | None = None

class PlanItem(BaseModel):
    id: str
    type: ItemType
    title: str
    day: int = Field(ge=1)
    start: datetime
    end: datetime
    origin: Place | None = None
    place: Place | None = None
    price_inr: int = Field(ge=0)
    price_provenance: Provenance
    refundable: bool
    cancel_by: datetime | None = None
    priority: Priority = "NICE"
    fixed: bool = False                         # time cannot move (flights, timed tickets)
    hard_deadline: datetime | None = None    # last entry, hotel check-in cut-off
    depends_on: list[str] = []
    risk_tags: list[RiskTag] = []
    indoor: bool = False
    co2_kg: float | None = None
    rebook_fee_inr: int | None = None
    booking: BookingRef | None = None

class ProofCheck(BaseModel):
    name: str                 # "budget", "hard_connection:it_a_t1->it_a_e1", "daily_hours", "no_night_ghat"
    passed: bool
    detail: str               # human readable, numbers come from the solver

class Validation(BaseModel):
    feasible: bool
    checks: list[ProofCheck]
    min_slack_min: int
    budget_headroom_inr: int
    feasibility: float = Field(ge=0, le=1)
    solver: str = "ortools-cp-sat"
    solve_ms: int = 0

class Plan(BaseModel):
    id: str
    trip_id: str
    kind: Literal["A", "B"]
    version: int = 1
    items: list[PlanItem]
    total_cost_inr: int
    validation: Validation
    summary: str = ""
    created_at: datetime
    superseded: bool = False

class SlackComponents(BaseModel):
    time_buffer: int; delay_risk: int; weather_risk: int; crowd_risk: int; budget_headroom: int   # each 0-100, higher = safer

class SlackScore(BaseModel):
    trip_id: str
    health: Health
    score: int = Field(ge=0, le=100)
    components: SlackComponents
    weakest_item_id: str | None = None
    explanation: str
    computed_at: datetime

class DestinationOption(BaseModel):
    name: str; why: str; est_budget_inr: int; available: bool

class TripIntent(BaseModel):
    origin: str | None = None
    destination: str | None = None
    start_date: date | None = None
    nights: int | None = Field(None, ge=1, le=14)
    travellers: int | None = Field(None, ge=1, le=9)
    budget_inr: int | None = Field(None, ge=1000)
    interests: list[str] = []
    constraints: list[str] = []
    pace: Literal["RELAXED", "BALANCED", "PACKED"] | None = None
    must_dos: list[str] = []
    missing: list[str] = []          # empty => ready to plan

class ActionRef(BaseModel):
    action: Literal["SWITCH_PLAN", "APPROVE_DRAFTS", "CHECK_IN", "KEEP_PLAN", "BOOK_PLAN", "CANCEL_BOOKING", "VIEW"]
    label: str
    params: dict[str, Any] = {}

class Trip(BaseModel):
    id: str
    title: str
    status: TripStatus
    intent: TripIntent
    active_plan: Literal["A", "B"] = "A"
    plan_a_id: str | None = None
    plan_b_id: str | None = None
    sim_now: datetime | None = None
    sim_window: Window | None = None
    owner_id: str
    group_id: str | None = None
    advisor_id: str | None = None
    advisor_consent: bool = False
    created_at: datetime

class Booking(BaseModel):
    id: str; trip_id: str; plan_id: str; item_id: str
    status: BookingStatus
    supplier_ref: str | None = None
    amount_inr: int
    refundable: bool
    failure_reason: str | None = None
    penalty_inr: int | None = None          # set after a cancellation
    updated_at: datetime

class Signal(BaseModel):
    id: str; trip_id: str
    kind: Literal["FLIGHT_STATUS", "WEATHER", "LOCAL_EVENT", "TRAFFIC", "HOTEL_CONFIRMATION", "FARE_RULE"]
    item_id: str | None = None
    severity: int = Field(ge=0, le=3)
    summary: str
    payload: dict[str, Any] = {}              # e.g. {"delay_min": 55} | {"rain": "HEAVY", "day": 3}
    provenance: Provenance

class Alert(BaseModel):
    id: str; trip_id: str
    level: AlertLevel
    window: Window
    title: str
    body: str
    provenance: Provenance                     # source + freshness shown on every alert
    recommended_action: ActionRef | None = None
    state: Literal["NEW", "SEEN", "APPROVED", "DISMISSED", "EXPIRED"] = "NEW"
    audience_user_ids: list[str] = []          # empty = everyone on the trip
    channels_sent: list[str] = []              # Channel values actually used
    created_at: datetime

class LostItem(BaseModel):
    item_id: str; title: str; priority: Priority

class SwitchRecommendation(BaseModel):
    id: str; trip_id: str
    mode: Literal["FULL", "MIXED"]
    reason: str
    feasibility_a: float; feasibility_b: float
    slack_a_min: int; slack_b_min: int
    delta_cost_inr: int
    lost_items: list[LostItem]
    kept_booking_item_ids: list[str]           # commitment-preserving: stays untouched
    changed_booking_item_ids: list[str]        # cancel/rebook needed
    resulting_plan: Plan                       # the plan that becomes active if approved (kind A, version+1)
    sources: list[Provenance]
    state: Literal["PROPOSED", "APPROVED", "REJECTED", "EXECUTED", "FAILED", "EXPIRED"] = "PROPOSED"
    created_at: datetime

class CourtesyDraft(BaseModel):
    id: str; trip_id: str; recommendation_id: str | None = None
    recipient_kind: Literal["HOTEL", "DRIVER", "VENDOR", "COMPANION"]
    recipient_name: str
    channel: Literal["WHATSAPP", "EMAIL", "SMS"]
    language: Literal["en", "hi", "hinglish"] = "en"
    subject: str | None = None
    body: str
    state: Literal["DRAFT", "APPROVED", "SENT", "DISCARDED"] = "DRAFT"    # SENT = simulated
    created_at: datetime

class EvidenceEvent(BaseModel):
    id: str; trip_id: str; ts: datetime
    kind: Literal["SIGNAL", "ALERT", "SWITCH", "BOOKING", "COST", "DRAFT", "NOTE"]
    source: str
    detail: str
    ref: dict[str, Any] = {}

class ClaimSection(BaseModel):
    type: Literal["AIRLINE", "INSURANCE", "SUPPLIER"]
    summary: str
    amount_inr: int | None = None
    attachments: list[str] = []                # booking ids, signal ids

class EvidencePack(BaseModel):
    trip_id: str; generated_at: datetime
    events: list[EvidenceEvent]
    total_delay_min: int
    extra_cost_inr: int
    claim_sections: list[ClaimSection]

class RerouteOption(BaseModel):
    id: str
    mode: Literal["DRIVE", "METRO", "WALK", "CAB", "RESHUFFLE_DAY", "SHIFT_SLOT", "USE_PLAN_B_SEGMENT"]
    title: str
    eta_min: int | None = None
    slack_min: int
    delta_cost_inr: int
    note: str
    provenance: Provenance
    action: ActionRef | None = None

class NextCommitment(BaseModel):
    item_id: str; title: str; arrive_by: datetime
    eta_min: int; slack_min: int; health: Health

class GeofencePrompt(BaseModel):
    kind: Literal["ARRIVED_HOTEL", "LEAVING_VENUE", "OFF_ROUTE"]
    title: str; body: str

class LiveStatus(BaseModel):
    trip_id: str; as_of: datetime
    location: Place | None = None
    tracking_on: bool
    next_commitment: NextCommitment | None = None
    reroute_options: list[RerouteOption] = []
    geofence_prompt: GeofencePrompt | None = None

class Voucher(BaseModel):
    booking_id: str; title: str; reference: str; html_url: str

# ---- request / response wrappers ----
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    trip_id: str | None = None
    locale: Literal["en", "hi", "hinglish"] = "en"
    input_mode: Literal["TEXT", "VOICE"] = "TEXT"

class ChatResponse(BaseModel):
    trip_id: str
    stage: Literal["CLARIFYING", "RECOMMENDING", "PLANNED", "ANSWER"]
    assistant_message: str
    intent: TripIntent
    quick_replies: list[str] = []
    destination_options: list[DestinationOption] = []
    plan_a: Plan | None = None
    plan_b: Plan | None = None
    proposed_action: ActionRef | None = None     # e.g. CANCEL_BOOKING awaiting approval

class TripDetail(BaseModel):
    trip: Trip; plan_a: Plan | None; plan_b: Plan | None
    bookings: list[Booking]; slack: SlackScore | None; unread_alerts: int

class TripSummary(BaseModel):
    id: str; title: str; status: TripStatus; health: Health | None; start_date: date | None; total_cost_inr: int | None

class BookRequest(BaseModel):
    plan: Literal["A", "B"] = "A"
    approve: bool                                   # must be true or API returns APPROVAL_REQUIRED
    idempotency_key: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")

class BookResult(BaseModel):
    status: Literal["CONFIRMED", "PARTIAL", "PENDING"]
    bookings: list[Booking]
    message: str

class AlertAck(BaseModel):
    action: Literal["APPROVE", "DISMISS", "SEEN"]

class SwitchDecision(BaseModel):
    decision: Literal["APPROVE", "REJECT"]
    approve_draft_ids: list[str] = []
    idempotency_key: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")

class SwitchResult(BaseModel):
    recommendation: SwitchRecommendation
    trip: Trip
    plan_a: Plan; plan_b: Plan | None
    bookings: list[Booking]
    drafts: list[CourtesyDraft]
    evidence_event_ids: list[str]

class DraftDecision(BaseModel):
    decision: Literal["APPROVE", "EDIT", "DISCARD"]
    body: str | None = None                      # required when EDIT

class LocationPing(BaseModel):
    lat: float = Field(ge=-90, le=90); lng: float = Field(ge=-180, le=180)
    speed_kmh: float | None = Field(None, ge=0, le=400)
    ts: datetime

class CancelRequest(BaseModel):
    approve: bool
    idempotency_key: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")

class DemoClock(BaseModel):
    window: Window

class DemoInject(BaseModel):
    kind: Literal["FLIGHT_DELAY", "RAIN", "BANDH", "TRAFFIC_JAM"]
    params: dict[str, Any] = {}                     # FLIGHT_DELAY {"minutes":55} | RAIN {"day":3,"intensity":"HEAVY"} | BANDH {"day":2} | TRAFFIC_JAM {"minutes":25}

class ErrorBody(BaseModel):
    code: Literal["VALIDATION_ERROR", "NOT_FOUND", "CONFLICT", "APPROVAL_REQUIRED", "INVALID_STATE",
                  "SUPPLIER_UNAVAILABLE", "PRICE_CHANGED", "SOLVER_INFEASIBLE", "LLM_UNAVAILABLE", "INTERNAL",
                  "UNAUTHENTICATED", "FORBIDDEN", "RATE_LIMITED", "CONSENT_REQUIRED"]
    message: str
    details: dict[str, Any] | None = None
    request_id: str

class ErrorResponse(BaseModel):
    error: ErrorBody

# ---- accounts, preferences, notifications ----
Role = Literal["TRAVELLER", "ADVISOR"]
Channel = Literal["IN_APP", "PUSH", "WHATSAPP", "EMAIL", "SMS"]

class User(BaseModel):
    id: str; email: str; name: str; role: Role = "TRAVELLER"
    language: Literal["en", "hi", "hinglish"] = "en"

class RegisterRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    role: Role = "TRAVELLER"

class LoginRequest(BaseModel):
    email: str; password: str

class TokenResponse(BaseModel):
    access_token: str; token_type: Literal["bearer"] = "bearer"; expires_in: int; user: User

class SseToken(BaseModel):                         # EventSource cannot send headers; 60s single-purpose token
    token: str; expires_in: int = 60

class NotificationPrefs(BaseModel):
    user_id: str
    channels: list[Channel] = ["IN_APP"]
    whatsapp_number: str | None = Field(None, pattern=r"^\+\d{8,15}$")
    quiet_hours_start: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")   # "22:00"
    quiet_hours_end: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")
    sensitivity: Literal["LOW", "NORMAL", "HIGH"] = "NORMAL"   # LOW = only ACTION_NEEDED+; HIGH = everything but batched
    language: Literal["en", "hi", "hinglish"] = "en"
    # rule: CRITICAL ignores quiet hours; INFO/NUDGE are batched during quiet hours

class PushSubscription(BaseModel):
    endpoint: str; p256dh: str; auth: str

# ---- group mode ----
class GroupMember(BaseModel):
    user_id: str; name: str; role: Literal["OWNER", "MEMBER"]; location_sharing: bool = False; joined_at: datetime

class Group(BaseModel):
    id: str; trip_id: str; invite_code: str; members: list[GroupMember]; created_at: datetime

class GroupPreference(BaseModel):
    user_id: str
    budget_inr: int | None = None
    interests: list[str] = []
    constraints: list[str] = []                    # "vegetarian", "no trekking"
    pace: Literal["RELAXED", "BALANCED", "PACKED"] | None = None
    must_dos: list[str] = []

class PrefConflict(BaseModel):
    field: str; values: dict[str, Any]; resolution: str   # e.g. budget: min of members; constraints: union (hard)

class MergedPreferences(BaseModel):
    merged_intent: TripIntent; conflicts: list[PrefConflict]

class VoteRequest(BaseModel):
    plan_id: str; vote: Literal["A", "B", "NEITHER"]

class VoteTally(BaseModel):
    trip_id: str; votes: dict[str, str]; counts: dict[str, int]; leader: Literal["A", "B"] | None = None
    decided: bool = False; rule: str = "Majority of members; owner breaks ties"

class CostSplit(BaseModel):
    member_id: str; name: str; share_inr: int; item_ids: list[str] = []
    # shares sum EXACTLY to plan total (largest-remainder rounding); method in SplitReport; item_ids reserved (empty in v1)
class SplitReport(BaseModel):
    trip_id: str; method: Literal["EQUAL", "BY_BUDGET"]; total_inr: int; shares: list[CostSplit]

class RegroupSuggestion(BaseModel):
    reason: str; point: Place; meet_by: datetime; member_etas_min: dict[str, int]; affected_user_ids: list[str]

# ---- priorities, time banking, optionality, responsible ----
class ItemPriorityUpdate(BaseModel):
    item_id: str; priority: Priority
class PrioritiesRequest(BaseModel):
    priorities: list[ItemPriorityUpdate]

class RebalanceRequest(BaseModel):
    lost_min: int = Field(ge=1, le=600); from_item_id: str
    apply: bool = False
    approve: bool = False                          # required when apply=true
    idempotency_key: str | None = Field(None, pattern=r"^[A-Za-z0-9_-]{8,64}$")

class RebalancePreview(BaseModel):
    plan_preview: Plan; dropped: list[LostItem]; shortened: list[str]; summary: str; applied: bool = False

class SwapItemRequest(BaseModel):
    item_id: str; offer_id: str
    apply: bool = False
    approve: bool = False                          # required when apply=true
    idempotency_key: str | None = Field(None, pattern=r"^[A-Za-z0-9_-]{8,64}$")

class SwapPreview(BaseModel):
    plan_preview: Plan; delta_cost_inr: int; delta_co2_kg: float | None = None
    lost_items: list[LostItem] = []; changed_booking_item_ids: list[str] = []
    summary: str; applied: bool = False

class RiskLine(BaseModel):
    item_id: str; disruption_prob: float; expected_loss_inr: int
    flex_premium_inr: int; recommended: Literal["FLEX", "SAVER"]; reason: str
class OptionalityReport(BaseModel):
    trip_id: str; lines: list[RiskLine]
    total_saver_inr: int; total_saver_with_risk_inr: int; total_flex_inr: int; recommendation: str

class ResponsibleInsight(BaseModel):
    item_id: str | None = None
    kind: Literal["CO2", "CROWD_RELIEF", "LOCAL_ECONOMY", "ECO_HERITAGE"]
    title: str; detail: str
    alternative_offer_id: str | None = None
    co2_saving_kg: float | None = None; delta_cost_inr: int | None = None
class ResponsibleReport(BaseModel):
    trip_id: str; total_co2_kg: float; by_mode: dict[str, float]; insights: list[ResponsibleInsight]
    method: str                                   # emission-factor table name + version

# ---- safety, sharing, offline ----
class TrustedContact(BaseModel):
    id: str; trip_id: str; name: str; phone: str | None = None; email: str | None = None
class TrustedContactCreate(BaseModel):
    name: str; phone: str | None = Field(None, pattern=r"^\+\d{8,15}$"); email: str | None = None

class ShareLink(BaseModel):
    token: str; url: str; expires_at: datetime; active: bool = True
class SharedTripView(BaseModel):                  # public, read-only, NO PII (no booking refs, no phone numbers)
    title: str; health: Health; next_stop: str | None = None; eta: datetime | None = None
    last_location_name: str | None = None; as_of: datetime

class SafeCheckinCreate(BaseModel):
    item_id: str; due_at: datetime
class SafeCheckin(BaseModel):
    id: str; trip_id: str; item_id: str; due_at: datetime
    state: Literal["PENDING", "CONFIRMED", "MISSED"] = "PENDING"

class SosRequest(BaseModel):
    lat: float | None = Field(None, ge=-90, le=90); lng: float | None = Field(None, ge=-180, le=180)
    message: str | None = Field(None, max_length=300)
class SosResult(BaseModel):
    notified: list[str]; queued: bool = False

class OfflineResource(BaseModel):
    url: str; kind: Literal["ITINERARY", "VOUCHER", "PLAN_B", "CONTACTS", "MAP", "SOS"]; bytes: int
class OfflineManifest(BaseModel):
    trip_id: str; version: int; generated_at: datetime; resources: list[OfflineResource]; expires_at: datetime

# ---- advisor ----
class AdvisorTripRow(BaseModel):
    trip_id: str; traveller_name: str; title: str; status: TripStatus
    health: Health | None; score: int | None; next_risk: str | None
    unread_alerts: int; start_date: date | None; has_consent: bool
class AdvisorNote(BaseModel):
    id: str; trip_id: str; advisor_id: str; body: str = Field(max_length=2000); created_at: datetime
class AdvisorNoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
class AdvisorInvite(BaseModel):
    advisor_email: str; consent_to_act: bool = False

# ---- booking modification, messaging webhook ----
class ModifyBookingRequest(BaseModel):
    approve: bool
    idempotency_key: str | None = Field(None, pattern=r"^[A-Za-z0-9_-]{8,64}$")
    new_start: datetime | None = None; note: str | None = Field(None, max_length=300)
    # approve=false returns 400 APPROVAL_REQUIRED with details {fee_inr, new_price_inr, available} (the quote)

class SignalView(BaseModel):                      # "why am I seeing this?" transparency list
    signal: Signal; used_in: list[str]            # alert ids / recommendation ids

# ---- internal models (used between backend, engine and agent; not all are exposed over REST) ----
class Offer(BaseModel):                      # a purchasable candidate, from SupplierAdapter
    id: str; type: ItemType; title: str
    place: Place | None = None; origin: Place | None = None
    price_inr: int; price_provenance: Provenance
    refundable: bool; cancel_hours_before: int | None = None
    earliest_start: datetime | None = None; latest_end: datetime | None = None
    fixed_start: datetime | None = None; duration_min: int
    hard_deadline: datetime | None = None; rebook_fee_inr: int | None = None
    flex_premium_inr: int | None = None   # extra cost of the flexible/refundable variant
    priority_hint: Priority = "NICE"; rating: float = 4.0
    risk_tags: list[RiskTag] = []; indoor: bool = False; co2_kg: float | None = None
    destination: str | None = None
    tags: list[str] = []                      # "tea", "waterfall", "sunset", "wildlife"

class Inventory(BaseModel):
    flights: list[Offer]; hotels: list[Offer]; transfers: list[Offer]; activities: list[Offer]

class PlanPair(BaseModel):
    plan_a: Plan; plan_b: Plan

class AgentState(BaseModel):                 # backend builds it from DB each turn; agent is stateless
    trip_id: str; intent: TripIntent; history: list[dict[str, Any]] = []   # [{"role","content"}], last 12
    trip_facts: TripDetail | None = None  # for post-booking Q&A
    channel: Literal["WEB", "WHATSAPP"] = "WEB"
    pending_recommendation_id: str | None = None

class AgentTurn(BaseModel):
    response: ChatResponse; intent: TripIntent; llm_fallback: bool = False

class PriceCheck(BaseModel):
    price_inr: int; checked_at: datetime; available: bool = True

class SupplierBooking(BaseModel):
    status: BookingStatus; supplier_ref: str | None = None; confirm_in_sec: int | None = None

class CancelOutcome(BaseModel):
    ok: bool; penalty_inr: int = 0

class FlightStatus(BaseModel):
    flight_ref: str; status: Literal["ON_TIME", "DELAYED", "CANCELLED", "UNKNOWN"]
    delay_min: int = 0; provenance: Provenance

class NewsItem(BaseModel):
    id: str; title: str; summary: str = ""; url: str; source: str
    published_at: datetime; lang: Literal["en", "hi", "ml", "other"] = "en"

class LocalEvent(BaseModel):
    kind: Literal["BANDH", "STRIKE", "FESTIVAL", "LANDSLIDE", "ROAD_RESTRICTION", "VIP_MOVEMENT", "CROWD_PEAK", "NONE"]
    location_text: str = ""; destination: str | None = None
    start: datetime | None = None; end: datetime | None = None
    confidence: float = Field(0.0, ge=0, le=1); source_url: str

class VoteRequestRow(BaseModel):
    user_id: str; plan_id: str; vote: Literal["A", "B", "NEITHER"]
