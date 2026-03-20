# Tokenomics And Stewardship
> Internal source of truth for launch economics, reserve logic, and the path from guided launch to artist sovereignty.

---

## Current Testnet Reality

The current implementation appears to be:
- total supply = `10B`
- `1B` to the artist
- `100M` for LP seeding
- `8.9B` in reserve
- LP paired with roughly `0.01 ETH`

Important correction:
- `100M` out of `10B` is **1%**, not 10%

That means the current market opens much shallower than it first sounded.

---

## What The Real Problem Is

The issue is not just how many artist tokens are in the pool.

The issue is:
- token-side depth
- ETH-side depth
- price curve behavior together

A shallow ETH side means a buyer can move price violently even if the token number looks large on paper.

Simple truth:
one buyer should not be able to cheaply scoop a massive share of supply.

The goal is not to make that literally impossible forever.
The goal is to make it too expensive and impractical to dominate early.

---

## Working Public-Ready Direction

The strongest simple direction right now is:
- `1B` artist
- `1B` LP
- `8B` reserve vault

Why this direction is attractive:
- still simple to explain
- artist is still a billionaire at launch
- market opens deeper
- reserve remains protected for later

Important:
- paired ETH-side liquidity still needs to be chosen carefully
- more tokens in LP without enough ETH can still create a weak opening market

---

## Protocol-Funded Launch

The artist should not need money to launch.

Best working model:
- artist launches with just an email
- protocol fronts gas and launch costs
- protocol seeds the market
- protocol stewards the reserve vault at first
- protocol tries to sustain or recover costs through fees, grants, sponsors, and later healthy growth

This keeps the launch:
- simple
- obvious
- fair
- low-risk for the artist

---

## Reserve Vault

The reserve vault is protected supply held under stewardship.

It exists so some supply is saved for later:
- future sovereignty
- future artist control
- future release decisions
- future support if needed

What it is **not**:
- not a hidden dump bucket
- not random future dilution
- not a casual market-manipulation tool
- not an early leverage toy

The reserve is positive if it has a clear purpose and clear limits.

---

## Stewardship To Sovereignty

The launch begins under stewardship.

That means:
- protocol handles the complex parts at first
- artist carries less risk at the beginning
- artist does not need to know everything on day one

Later, the artist can inherit more:
- reserve vault control
- fee rights
- contract ownership
- full responsibility

This is training wheels to sovereignty.

---

## UUPS Implications

The contracts are UUPS proxy upgradeable.

This is powerful, but it changes the trust model.

Good implications:
- launch mechanics can improve
- safety can improve
- operations can improve
- handoff tools can improve

Dangerous implications:
- fans may fear the rules can change under them
- artists may not know what is fixed and what is flexible
- reserve release can feel like dilution if not explained well

Best principle:
**upgradeable mechanics, not casually changeable promises**

That means:
- improve safety
- improve usability
- improve stewardship
- do not casually rewrite the economic promises people relied on

---

## What Should Stay Fixed

These should be treated as sacred once the public-ready launch model is chosen:
- total supply
- initial split
- existence of the reserve vault
- basic fee policy
- artist path to later sovereignty

---

## What Can Evolve

These can evolve carefully over time:
- reserve release tools
- handoff flow to the artist
- internal operations
- better wallet reload rails
- better guidance and onboarding flows

---

## Fee Logic

Current AMM fee logic is `0.3%`.

Best current role for that fee:
- sustain launch support
- offset gas and operating costs
- support the protocol while it is stewarding launches

Later, when the artist is ready, fee control and collection can also become part of the sovereignty handoff.

---

## Borrowing Against The Reserve

This is a later idea, not an early feature.

It could eventually become:
- a way for artists to access value without draining LP
- a more graceful path than selling into their own market

But early risks are high:
- leverage confusion
- collateral risk
- liquidation risk
- legal complexity
- artist harm if used before they are ready

For now, the reserve should be treated as:
- protected
- stewarded
- transparent
- not leveraged by default

---

## Best Current Summary

The reserve vault is worth keeping.

Its highest use is not as a vague treasury.
Its highest use is as a **protected reserve under stewardship** that can later become part of the artist's sovereignty.

The launch should stay simple.
The promises should stay clear.
The flexibility should live underneath that clarity, not on top of it.
