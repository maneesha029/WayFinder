"""Engine configuration, solver constants, and versioned emission factors (Owner: P3)."""
from __future__ import annotations

# Solver determinism & budget
SOLVER_RANDOM_SEED = 7
SOLVER_NUM_WORKERS = 1
SOLVER_MAX_TIME_SEC = 5.0

# Daily schedule limits (minutes from midnight local time +05:30)
DAY_START_MIN = 8 * 60          # 08:00
DAY_END_MIN = 19 * 60 + 30      # 19:30
NIGHT_GHAT_CUTOFF_MIN = 18 * 60 # 18:00 (no night ghat driving)
HARD_DEADLINE_MIN_BUFFER = 30

# Pace activity limits per day
PACE_MAX_ACTIVITIES: dict[str, int] = {
    "RELAXED": 2,
    "BALANCED": 3,
    "PACKED": 4,
}

# Objective weights
PLANNER_PRIORITY_WEIGHTS: dict[str, int] = {
    "MUST": 10,
    "NICE": 4,
    "SKIP_IF_NEEDED": 1,
}
SWITCH_LOST_WEIGHTS: dict[str, int] = {
    "MUST": 5,
    "NICE": 2,
    "SKIP_IF_NEEDED": 1,
}
COST_PENALTY_COEFF = 0.002

# Travel & geometry
SPEED_KMH: dict[str, float] = {
    "DRIVE": 40.0,
    "DRIVE_GHAT": 28.0,
    "CAB": 40.0,
    "METRO": 30.0,
    "WALK": 5.0,
}
DETOUR_FACTOR = 1.35
BASE_TRANSIT_OVERHEAD_MIN = 10
GATE_OVERHEAD_MIN = 20
AIRPORT_EXIT_BUFFER_MIN = 45
AIRPORT_CHECKIN_OVERHEAD_MIN = 115

# Feasibility & Slack scoring
SIGMA_MIN: dict[str, float] = {
    "FLIGHT": 25.0,
    "TRANSFER": 20.0,
    "GHAT_TRANSFER": 30.0,
    "ACTIVITY": 10.0,
    "HOTEL": 10.0,
}
WEATHER_UPLIFT_MIN: dict[str, int] = {
    "MODERATE": 15,
    "RAIN": 15,
    "HEAVY": 30,
}
BANDH_UPLIFT_MIN = 60

SLACK_WEIGHTS = (0.40, 0.25, 0.15, 0.10, 0.10)  # tb, dr, w, c, b
HEALTH_GREEN_MIN = 75
HEALTH_AMBER_MIN = 45

# Switch thresholds
SWITCH_SLACK_TRIGGER_MIN = 20
SWITCH_FEASIBILITY_GAP = 0.10
SWITCH_TARGET_FEASIBILITY = 0.90
DEFAULT_CAB_WAIT_FEE_INR = 1400

# Live geofences & regroup
GEOFENCE_HOTEL_ARRIVED_M = 300.0
GEOFENCE_OFF_ROUTE_KM = 5.0
REGROUP_GAP_MIN = 20

# Optionality weather/strike base probabilities
RAIN_BASE_RISK = 0.05
RAIN_MOD_RISK = 0.25
RAIN_HEAVY_RISK = 0.50
BANDH_RISK = 0.60

# Responsible travel emission factors (illustrative, DEFRA/ICAO aligned)
EMISSION_METHOD_V1 = "EMISSION_FACTORS_V1 (illustrative DEFRA/ICAO-aligned draft)"
EMISSION_FACTORS_V1: dict[str, float] = {
    "FLIGHT": 0.15,      # kg CO2 per pax-km
    "CAR": 0.19,         # kg CO2 per vehicle-km (divided by occupancy)
    "TRANSFER": 0.19,    # kg CO2 per vehicle-km (divided by occupancy)
    "EV_SHUTTLE": 0.04,  # kg CO2 per pax-km
    "BUS": 0.05,         # kg CO2 per pax-km
    "TRAIN": 0.04,       # kg CO2 per pax-km
    "METRO": 0.03,       # kg CO2 per pax-km
    "WALK": 0.0,
    "ACTIVITY_DEFAULT": 1.0,
}
