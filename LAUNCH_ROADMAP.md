# Launch Roadmap: Testnet → Clean Public Start
**Current phase, next steps, and what matters most right now.**

---

## Where You Are Right Now

This repo is still a **private rehearsal space** on Base Sepolia.

What already exists:
- Artists can be launched with just an email
- Tokens deploy, LP seeds, and live pricing works
- Fans can swap, buy downloads, and hold assets
- The chat, safewords, orbit, carousel, and portal feeling all exist
- GOSHEESH can receive feedback and manage the system
- The legal wrapper idea is real enough to keep shaping

What this repo is **not**:
- not the final public birth of the system
- not the clean public-ready repo
- not the final key set
- not the final launch economics

This repo is where the system gets tested, refined, and made magical.

---

## Current Testnet Economics

The current implementation appears to be:
- `1B` to the artist
- `100M` to LP seeding
- `8.9B` to reserve
- roughly `0.01 ETH` paired with the LP seed

Important correction:
- `100M` out of `10B` is **1%**, not 10%

That means the current launch market is much shallower than it first sounded.
The real problem is not just token allocation. It is **token-side depth plus ETH-side depth together**.

This is why one buyer can scoop too much too cheaply and make the artist's market feel broken.

---

## What Needs To Be True Before Public-Ready Launch

1. The launch economics have to feel fair, stable, and easy to explain
2. The artist onboarding has to feel like treasure, not admin work
3. Fans need an obvious way to keep going without getting stuck on gas or wallet friction
4. Feedback needs to reach GOSHEESH from the whole community
5. The story of stewardship and sovereignty has to be clear

---

## Current Best Direction

### Launch model to assess

The strongest simple direction right now is:
- `1B` artist
- `1B` LP
- `8B` reserve vault

With this model:
- the artist is still a billionaire at launch
- the market opens with much deeper supply
- the reserve stays protected for stewardship and later sovereignty
- the story remains simple

Important:
- LP depth still depends on the paired ETH side
- increasing token-side supply alone is not enough if ETH-side liquidity stays tiny

---

## Phase 1 — Inner Circle Rehearsal

**Goal: Blow the minds of 8–10 inner-circle artists and learn what breaks.**

### 1. Lock the launch economics
Before opening this to more artists, decide the working test model for the next round:
- confirm the current live economics
- choose the next test distribution
- choose the paired ETH-side depth
- keep the rule simple enough to explain in one sentence

### 2. Make onboarding magical
The bottleneck right now is not just code. It is the **onboarding experience**.

For the first inner-circle artists:
- preload logo
- preload colors
- preload the portal mood
- let them arrive to something that already feels like theirs
- let them fine tune after the reveal

Do not lead with a blank tan canvas for the first cohort if the goal is wonder.

### 3. Re-enable wallet funding safely on testnet
Artists and fans need a clear way to transact during the rehearsal phase.

That means:
- rotate keys first
- re-enable `fundWallet` safely
- keep guardrails in place
- use a faucet-like flow for testnet

### 4. Open feedback to all fans and artists
Every fan and artist should be able to reach GOSHEESH through the chat.
That keeps the feedback loop honest during rehearsal.

### 5. Improve creator tooling
The next creator layer should include:
- upload tagging
- per-asset splits
- equal by default
- custom percentages when needed

---

## Phase 2 — Validate The Loop

**Goal: Prove the experience, not just the contracts.**

### Artist journey
- artist enters through a secret or guided path
- the portal already feels alive
- token launch feels obvious and rich
- uploads and releases feel easy to finish

### Fan journey
- fan taps the NFC coin
- lands in the portal
- types the safeword
- sees the swap
- buys, unlocks, returns, discovers more later

### Community loop
- confusion goes to feedback
- feedback becomes PRD items
- PRD guides the next iteration

---

## Phase 3 — Mainnet Preparation

**Goal: Prepare the physical-world and money-world rails around the portal.**

### Gold backing
The backed-by-gold promise needs a real mechanism.

Current simplest direction:
- hold physical gold first
- publish it honestly
- move to a tokenized gold mechanism later if it becomes useful

### Venmo rail
Venmo is the obvious reload path once the testnet rehearsal graduates into real money.

Need:
- business account
- webhook reliability
- clear reload and withdrawal story

### Toppins
The idea is strong:
- first few views are free
- after that, a small toll per view
- 1155 ownership removes the toll

Best current direction:
- meter internally
- settle in batches
- do not try to force every micro-view onchain

### Grants and sponsorship
Base grants and sponsorship are aligned with the mission.
They can help fund:
- gas
- launches
- early onboarding
- protocol support during rehearsal and early public growth

---

## Phase 4 — Clean Public Start

**Goal: Fork clean when the experience and economics are ready.**

When this leaves private rehearsal:
- start a fresh repo
- rotate keys
- clean the launch story
- keep only what should survive into public trust

The public-ready birth should not inherit accidental testnet confusion.

---

## Immediate Next Actions

| # | Action | Who | Why It Matters |
|---|--------|-----|----------------|
| 1 | Lock the next test launch economics | Founder + Cursor | Everything downstream depends on this |
| 2 | Improve inner-circle onboarding reveal | Cursor | This is the current bottleneck |
| 3 | Rotate launch keys for the next phase | Founder | Needed before safer funding flows |
| 4 | Re-enable `fundWallet` safely on testnet | Cursor | Artists and fans need fuel to move |
| 5 | Open feedback to all fans and artists | Cursor | Community loop needs to be real |
| 6 | Add tags and per-asset splits | Cursor | Creator releases need better structure |
| 7 | Set up Venmo business path | Founder | Needed for future reload flow |
| 8 | Buy and document gold holdings | Founder | Needed for the promise to stay honest |
| 9 | Apply for Base grants / sponsorship | Founder | Helps sustain launch support |
| 10 | Prepare clean public fork plan | Founder + Cursor | Public trust needs a fresh start |

---

## What This Is, Simply

This repo is the rehearsal.

Use it to make the launch economics smarter.
Use it to make the onboarding unforgettable.
Use it to let a small inner circle feel the magic and tell you what breaks.

Then fork clean for the public-ready version with better economics, better keys, and a truer story.
