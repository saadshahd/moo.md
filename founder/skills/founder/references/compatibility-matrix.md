# Compatibility Matrix

Dimension combinations for founder workflows. Use to select optimal workflow sequencing and parameter pairings.

## Workflow x Stage

|                    | Pre-Seed | Seed | Series A | Growth |
|--------------------|----------|------|----------|--------|
| Validate Idea      | ✓✓       | ✓    | ✗        | ✗      |
| Size Market        | ✓✓       | ✓✓   | ✓        | ✓      |
| Analyze Competition| ✓✓       | ✓✓   | ✓✓       | ✓✓     |
| Build Pitch Deck   | ✓        | ✓✓   | ✓✓       | ✓      |
| Prep for Investors | ✓        | ✓✓   | ✓✓       | ✓      |
| Model Financials   | ✗        | ✓    | ✓✓       | ✓✓     |
| Plan Launch        | ✓✓       | ✓✓   | ✓        | ✗      |
| Report to Board    | ✗        | ✗    | ✓✓       | ✓✓     |

**Notes:**
- Validate Idea + Series A/Growth: Should be validated by now; revisiting signals pivot
- Model Financials + Pre-Seed: Limited data; projections are fiction
- Report to Board + Pre-Seed/Seed: No formal board yet typically
- Plan Launch + Growth: Launches are operational, not strategic at scale

## Validation Verdict x Next Workflow

|          | Size Market | Build Pitch | Model Financials | Plan Launch |
|----------|-------------|-------------|------------------|-------------|
| GO       | ✓✓          | ✓✓          | ✓                | ✓✓          |
| ITERATE  | ✓✓          | ✗           | ✗                | ✗           |
| KILL     | ✗           | ✗           | ✗                | ✗           |

**Notes:**
- ITERATE + Pitch/Financials/Launch: Don't invest in artifacts for unvalidated ideas
- ITERATE + Size Market: Research can help identify pivot direction
- KILL: Stop. No workflows until new idea or major pivot

## Pitch Deck x Audience

|                   | YC/Accelerator | Angels | Institutional VC | Strategic |
|-------------------|----------------|--------|------------------|-----------|
| Problem-First     | ✓✓             | ✓✓     | ✓✓               | ✓         |
| Traction-First    | ✓              | ✓      | ✓✓               | ✓✓        |
| Team-First        | ✓✓             | ✓✓     | ✓                | ✓         |
| Vision-First      | ✓              | ✓      | ✓                | ✓✓        |
| Technical-Deep    | ✓              | ✗      | ✓                | ✓✓        |

**Notes:**
- Technical-Deep + Angels: Most angels lack technical depth; focus on market
- Team-First + Institutional VC: They assume you can execute; show traction
- Vision-First + YC: YC values execution over grand vision
- Traction-First + YC/Angels: Early stage often lacks traction; problem/team matter more

## Financial Model Depth x Funding Stage

|              | Pre-Seed | Seed | Series A | Series B+ |
|--------------|----------|------|----------|-----------|
| Back-of-Napkin| ✓✓      | ✓    | ✗        | ✗         |
| Simple Model | ✓        | ✓✓   | ✓        | ✗         |
| Detailed Model| ✗       | ✓    | ✓✓       | ✓✓        |
| Full Forecast| ✗        | ✗    | ✓        | ✓✓        |

**Notes:**
- Detailed Model + Pre-Seed: False precision; no data to support complexity
- Back-of-Napkin + Series A: Investors expect rigor at this stage
- Full Forecast + Seed: Overkill; 3-year projections are sufficient

## Board Report x Company Health

|                    | Thriving | Stable | Struggling | Crisis |
|--------------------|----------|--------|------------|--------|
| Metrics-Heavy      | ✓✓       | ✓✓     | ✓          | ✗      |
| Narrative-Heavy    | ✓        | ✓      | ✓✓         | ✓✓     |
| Ask-Focused        | ✓        | ✓      | ✓✓         | ✓✓     |
| Celebration Mode   | ✓✓       | ✓      | ✗          | ✗      |

**Notes:**
- Metrics-Heavy + Crisis: Numbers tell the bad story; need narrative for path forward
- Celebration + Struggling/Crisis: Tone-deaf; board loses trust
- Ask-Focused + Thriving: May signal trouble; be specific about growth asks

## Market Size Approach x Market Type

|                | Existing Market | New Category | Market Expansion |
|----------------|-----------------|--------------|------------------|
| Top-Down       | ✓✓              | ✗            | ✓                |
| Bottom-Up      | ✓✓              | ✓✓           | ✓✓               |
| Value-Based    | ✓               | ✓✓           | ✓                |

**Notes:**
- Top-Down + New Category: No existing market data; bottoms-up from value is better
- Value-Based + Existing: Established pricing exists; use market data

## Launch Phase x Traction Level

|              | Zero Users | Waitlist | Beta Users | Paying Customers |
|--------------|------------|----------|------------|------------------|
| Stealth      | ✓✓         | ✓        | ✗          | ✗                |
| Soft Launch  | ✓          | ✓✓       | ✓✓         | ✓                |
| Full Launch  | ✗          | ✓        | ✓          | ✓✓               |
| PR Blitz     | ✗          | ✗        | ✓          | ✓✓               |

**Notes:**
- Full Launch + Zero Users: Nothing to launch; build waitlist first
- PR Blitz + Zero/Waitlist: Attention without conversion; waste of press cycle
- Stealth + Paying Customers: Why hide? Validate openly

## Workflow Sequence Compatibility

Typical founder journey: `validate → market → compete → pitch → investor prep`

| Prerequisite         | Required Before |
|----------------------|-----------------|
| Validate (GO)        | Everything else |
| Size Market          | Pitch, Board    |
| Analyze Competition  | Pitch           |
| Build Pitch          | Investor Prep   |
| Model Financials     | Series A+ Pitch |

**Parallel workflows:**
- Size Market + Analyze Competition: Run simultaneously for research phase
- Build Pitch + Investor Prep: Often iterate together

## Usage

1. Identify your startup stage and current workflow
2. Cross-reference with audience, market type, and company health
3. Check prerequisites before starting a workflow
4. Prefer ✓✓ combinations; ✓ works with care; avoid ✗
5. When ✗ is necessary, document why in your decision log
