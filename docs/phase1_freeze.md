# MVS — Phase 1 Architecture Freeze

**Source:** Dr. Kevin Scully, "MVS Platform Architecture Directive — Phase 1 Freeze" delivered 2026-05-10.
**Status:** LOCKED. No further architectural expansion before first cohort (June 4, 2026).
**This document supersedes prior architecture notes where they conflict.**

## What's frozen (and what isn't)

### Locked for Phase 1 (build before June 4)
1. Multi-marker event taxonomy (8 independent markers per event)
2. Locked vs revisable decision architecture (per scenario)
3. Scenario classification tag system (9 metadata tags per scenario)
4. Event-data field expansion (presented_options, revision_flag, event_markers[], scenario_tags[], outcome_state)
5. Export validation (CSV remains comprehensive)
6. Cohort isolation validation (RLS re-verified)

### Deferred until post-deployment
- AI interpretation / predictive governance modeling
- Advanced dashboards
- Adaptive scenarios
- Automated behavioral profiling
- Larger randomized scenario bank (acknowledged as future need; current 5-scenario set ships v1)

## 1. Event Taxonomy — 8 Locked Markers

Each decision event may fire multiple markers simultaneously. Markers are **independent, not mutually exclusive.**

| Marker | Operational Meaning |
|---|---|
| `escalation` | Internal/system compression increasing |
| `narrowing` | Perceptual or cognitive bandwidth contraction |
| `premature_commitment` | Decision made before sufficient processing |
| `sequencing_break` | Loss of correct procedural or cognitive order |
| `drift` | Progressive degradation across event sequence |
| `intervention` | Deliberate corrective action applied |
| `recovery` | Restoration of functional governance |
| `governance_instability` | Loss of consistent internal rate control |

**Architecture constraint:** marker expansion must remain modular. Storing as JSONB on the event (with expression indexes for the 8 known keys) preserves modularity without sacrificing query speed.

## 2. Decision Commitment Architecture

Each scenario declares a `commitment_mode`:

### Locked Commitment
- **No answer revisions permitted.**
- **Domains:** Tactical, Law Enforcement, Military, Acute Medical, High-Compression Operational.
- **Default for:** the existing `active_threat_v1` scenario.
- **Purpose:** Measure irreversible decision timing under pressure.

### Revisable Commitment
- **Answer revisions permitted and logged.**
- **Domains:** Leadership, Executive Governance, Organizational Management, Educational Development.
- **Default for:** the 5 new scenarios delivered 2026-05-10 (Conversation Velocity, Perception Narrowing, Escalation Loop, Team Velocity, Recovery Failure / Drift) — pending doctor confirmation.
- **Required tracking per revision:** original response, revised response, revision latency, revision count, recovery timing.

Implementation: one event row per click (revisions are *additional* events, not updates). A revision row carries `is_revision=true` and `revises_response_event_id=<id of original>` plus an incrementing `revision_count`.

## 3. Scenario Classification Tags

Every scenario carries the following metadata (nullable until doctor populates):

| Tag | Values |
|---|---|
| `domain` | tactical / medical / leadership / executive |
| `compression_level` | low / moderate / high / extreme |
| `ambiguity` | low / moderate / high |
| `emotional_load` | low / moderate / high |
| `sensory_complexity` | low / moderate / high |
| `authority_conflict` | present / absent |
| `time_pressure` | low / moderate / high |
| `casualty_complexity` | none / single / multiple / mass |
| `governance_challenge` | individual / team / organizational |

These are pure metadata for cohort comparative analytics. No runtime behavior depends on tag values in Phase 1.

## 4. Event Data — Required Fields

`responses_long` must support capture of:

| Field | Source | Have today? |
|---|---|---|
| participant_id | client | ✓ |
| session_id | implicit per batch (enrollment_id) | ✓ |
| scenario_id | derived | ✓ |
| timestamp | server | ✓ |
| event_order | sequence_number | ✓ |
| response_latency | client paint→click | ✓ |
| branch_path | accumulated | ✓ |
| presented_options | snapshot of options shown | **add** |
| selected_option | option_selected | ✓ |
| revision_flag | new | **add** |
| event_markers[] | JSONB of 8 marker booleans | **add** |
| scenario_tags[] | derivable from scenario at export time | **derive** |
| outcome_state | terminal-screen ID or named outcome | **add** |

## 5. Deployment Priority (locked)

1. **Stability**
2. **Data integrity**
3. **Timing accuracy**
4. **Branch reconstruction**
5. Analytics expansion later.

No new features beyond items 1-6 in "Locked for Phase 1" above before June 4.
