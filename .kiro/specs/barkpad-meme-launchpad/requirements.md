# Requirements Document

## Introduction

**Barkpad** is a dog-themed meme launchpad and community infrastructure built on **OPN Chain** (IOPn's EVM-compatible Layer 1). This document captures the requirements for an MVP that is positioned as reusable infrastructure rather than a single meme coin, directly targeting the IOPn Builder's Programme judging criteria: innovation, technical execution, and real-world viability. The sections below define the project overview, glossary, functional requirements (in user-story + EARS acceptance-criteria format), non-functional requirements, and scope boundaries.

## Project Overview

**Barkpad** is a dog-themed meme launchpad and community infrastructure built on **OPN Chain** (IOPn's EVM-compatible Layer 1, Cosmos SDK + Tendermint BFT, 10,000+ TPS, sub-second finality, ~7 Gwei gas).

Barkpad is positioned as **infrastructure, not a demo**. Instead of being a single meme coin, it is a reusable platform that lets anyone create, fairly launch, and grow meme tokens with built-in anti-rug protection, on-chain reputation, IOPn Digital Identity integration, and AI-assisted meme generation. Every token launched through Barkpad generates new on-chain activity for OPN Chain, directly serving the Builder's Programme goal of "scaling what gets built."

### Builder's Programme Alignment

| Judging Criterion | How Barkpad Satisfies It |
|---|---|
| Innovation | Token factory + bonding curve + AI meme agent + identity-gated launches, not a single coin |
| Technical Execution | Audited-ready Solidity contracts, full test coverage, live on OPN testnet |
| Real-World Viability | Protocol fee revenue model, anti-rug mechanisms, real users |
| Scale What Gets Built | Each user-created token = new on-chain activity for OPN Chain |
| Ecosystem Fit | Integrates IOPn Digital Identity + Agentic AI narrative |

## Glossary

- **Creator**: A user who launches a new meme token through Barkpad.
- **Trader / Holder**: A user who buys, sells, or holds meme tokens.
- **Bonding Curve**: An automated pricing mechanism where token price is a deterministic function of supply sold.
- **Graduation**: The event when a token's bonding curve reaches a target market cap and migrates liquidity to a DEX pool.
- **Liquidity Lock**: A smart-contract-enforced time lock on liquidity provider tokens to prevent rug pulls.
- **Reputation Score**: An on-chain score assigned to a creator based on their launch history and behavior.
- **IOPn Digital Identity**: IOPn's sovereign on-chain identity used to verify creators.
- **Protocol Treasury**: The contract that collects platform fees.

## Requirements

### Requirement 1: Meme Token Creation (Token Factory)

**User Story:** As a creator, I want to launch a meme token without writing code, so that I can start a community quickly and safely.

#### Acceptance Criteria

1. WHEN a creator submits a token name, symbol, total supply, and metadata THEN the system SHALL deploy a new ERC-20 token contract on OPN Chain.
2. WHEN a token is deployed THEN the system SHALL record the creator address, token address, and creation timestamp on-chain.
3. WHEN a creator submits a token THEN the system SHALL charge a fixed creation fee paid to the Protocol Treasury.
4. IF the token symbol or name exceeds defined length limits THEN the system SHALL reject the creation and return a validation error.
5. WHEN a token is deployed THEN the system SHALL renounce or disable the mint function after the initial supply is set, so that no additional tokens can be minted later.
6. WHERE metadata (logo URI, description, social links) is provided THEN the system SHALL associate it with the token record.

### Requirement 2: Fair Launch via Bonding Curve

**User Story:** As a trader, I want to buy and sell new tokens against a transparent bonding curve, so that pricing is fair and resistant to whale manipulation.

#### Acceptance Criteria

1. WHEN a token is created THEN the system SHALL initialize a bonding curve with a deterministic price function based on supply sold.
2. WHEN a trader buys tokens THEN the system SHALL calculate the price from the current curve position and transfer tokens in exchange for OPN.
3. WHEN a trader sells tokens THEN the system SHALL calculate the refund from the current curve position and return OPN minus a configurable fee.
4. IF a single buy transaction would exceed a per-wallet purchase cap during the early launch window THEN the system SHALL reject the transaction.
5. WHEN a buy or sell occurs THEN the system SHALL collect a configurable trading fee to the Protocol Treasury.
6. WHEN the bonding curve reaches the graduation market cap THEN the system SHALL halt curve trading and trigger the graduation process.

### Requirement 3: Graduation and Liquidity Migration

**User Story:** As a holder, I want a successful token to migrate to a DEX with locked liquidity, so that I can trade freely without rug-pull risk.

#### Acceptance Criteria

1. WHEN a token graduates THEN the system SHALL create a liquidity pool on a designated OPN Chain DEX using the accumulated reserve.
2. WHEN liquidity is added at graduation THEN the system SHALL lock the resulting LP tokens for a minimum configurable duration.
3. WHILE liquidity is locked THE system SHALL prevent withdrawal of locked LP tokens before the lock expires.
4. WHEN graduation completes THEN the system SHALL emit an event recording the pool address, locked amount, and unlock timestamp.
5. IF graduation fails for any reason THEN the system SHALL keep curve funds recoverable by traders and SHALL NOT lose user funds.

### Requirement 4: Anti-Rug and Safety Mechanisms

**User Story:** As a trader, I want platform-enforced safety guarantees, so that I am protected from common scam patterns.

#### Acceptance Criteria

1. WHEN a token is created THEN the system SHALL enforce that the creator cannot mint additional supply after launch.
2. WHEN a token trades on the bonding curve THEN the system SHALL hold all reserves in the curve contract, not in the creator's wallet.
3. WHERE a per-wallet purchase cap is configured THEN the system SHALL enforce it during the early launch window.
4. IF a creator attempts to withdraw locked liquidity before unlock THEN the system SHALL reject the transaction.
5. WHEN displaying a token THEN the system SHALL surface safety indicators (mint disabled, liquidity locked, creator reputation) to traders.

### Requirement 5: IOPn Digital Identity Integration

**User Story:** As the platform, I want to optionally gate launches behind IOPn Digital Identity, so that serial scammers and bots are deterred and creator trust is increased.

#### Acceptance Criteria

1. WHERE identity gating is enabled THEN the system SHALL require a creator to present a valid IOPn Digital Identity attestation before launching a token.
2. WHEN a verified creator launches a token THEN the system SHALL mark the token as "identity-verified" on-chain.
3. IF a creator does not have a valid identity attestation AND identity gating is enabled THEN the system SHALL reject the launch.
4. WHEN displaying a token THEN the system SHALL indicate whether the creator is identity-verified.
5. WHERE the IOPn identity service is unavailable THEN the system SHALL degrade gracefully according to a configurable policy (block or allow-unverified).

### Requirement 6: On-Chain Creator Reputation

**User Story:** As a trader, I want to see a creator's track record, so that I can assess the risk of a new launch.

#### Acceptance Criteria

1. WHEN a creator launches a token THEN the system SHALL initialize or update that creator's on-chain reputation record.
2. WHEN a token graduates successfully THEN the system SHALL increase the creator's reputation score.
3. WHEN a token is flagged for malicious behavior THEN the system SHALL decrease the creator's reputation score.
4. WHEN a trader views a creator THEN the system SHALL expose the reputation score and launch history.
5. THE reputation score SHALL be derived only from on-chain verifiable events.

### Requirement 7: AI Meme Generation Assistant

**User Story:** As a creator, I want AI help generating a logo, description, and meme art, so that I can launch a polished token without design skills.

#### Acceptance Criteria

1. WHEN a creator requests AI assistance with a prompt THEN the system SHALL generate candidate token logos and descriptions.
2. WHEN AI-generated assets are produced THEN the system SHALL allow the creator to accept and attach them to the token metadata.
3. WHERE GPU compute is rate-limited THEN the system SHALL queue or throttle requests and inform the creator.
4. IF AI generation fails THEN the system SHALL allow the creator to proceed with manually uploaded assets.

### Requirement 8: Discovery and Community Engagement

**User Story:** As a trader, I want to discover trending tokens and engage with communities, so that I stay active on the platform.

#### Acceptance Criteria

1. WHEN a trader opens the platform THEN the system SHALL display a leaderboard of tokens ranked by configurable metrics (volume, market cap, recency).
2. WHEN a trader selects a token THEN the system SHALL display its price chart, bonding-curve progress, holder count, and safety indicators.
3. WHERE staking is enabled for a token THEN the system SHALL allow holders to stake and earn rewards.
4. WHEN a holder stakes or unstakes THEN the system SHALL update their reward accrual accordingly.

### Requirement 9: Protocol Revenue and Treasury

**User Story:** As the protocol operator, I want to collect and manage fees, so that the platform is financially viable.

#### Acceptance Criteria

1. WHEN a creation, buy, or sell fee is charged THEN the system SHALL route it to the Protocol Treasury contract.
2. WHERE treasury governance is configured THEN the system SHALL restrict treasury withdrawals to authorized governance actions.
3. WHEN fees are collected THEN the system SHALL emit events enabling transparent off-chain accounting.
4. THE fee parameters SHALL be adjustable only by authorized roles within defined bounds.

### Requirement 10: Wallet and Network Integration

**User Story:** As any user, I want to connect a standard EVM wallet to OPN Chain, so that I can use the platform with familiar tools.

#### Acceptance Criteria

1. WHEN a user connects a wallet THEN the system SHALL support standard EVM wallets (e.g., MetaMask) configured for OPN Chain.
2. IF the user's wallet is on the wrong network THEN the system SHALL prompt them to switch to or add OPN Chain.
3. WHEN a transaction is submitted THEN the system SHALL display gas estimates and transaction status to the user.
4. WHEN a transaction confirms or fails THEN the system SHALL notify the user with the result and a block explorer link.

### Requirement 11: Token Swap (Post-Graduation DEX)

**User Story:** As a trader, I want to swap OPN for a graduated meme token (and back), so that I can keep trading after the bonding curve closes.

#### Acceptance Criteria

1. WHEN a token has graduated THEN the system SHALL provide an AMM pool where users can swap OPN for the token and the token for OPN.
2. WHEN a user swaps THEN the system SHALL price the swap using a constant-product formula and apply a configurable swap fee.
3. IF the output amount is below the user's specified minimum THEN the system SHALL revert the swap (slippage protection).
4. WHEN a swap executes THEN the system SHALL update pool reserves and emit a swap event.
5. WHERE liquidity is insufficient THEN the system SHALL reject the swap rather than execute at an invalid price.

### Requirement 12: Meme Token Staking

**User Story:** As a holder, I want to stake a meme token to earn rewards, so that I am incentivized to hold and support the community.

#### Acceptance Criteria

1. WHEN a holder stakes tokens THEN the system SHALL record their staked balance and start accruing rewards from that point.
2. WHEN a holder unstakes THEN the system SHALL return their staked tokens and settle accrued rewards.
3. WHEN a holder claims THEN the system SHALL transfer accrued reward tokens without requiring unstaking.
4. THE reward accrual SHALL be proportional to staked amount and staking duration, using a standard accumulator (reward-per-token) model.
5. WHERE a reward pool is funded THEN the system SHALL distribute rewards only up to the funded amount and not beyond.
6. WHEN computing rewards THEN the system SHALL prevent any user from withdrawing more than their fair share (no reward draining).

### Requirement 13: Airdrop Distribution

**User Story:** As a creator, I want to airdrop my meme token to many recipients, so that I can bootstrap a community and reward early supporters.

#### Acceptance Criteria

1. WHEN a creator funds an airdrop with a token and a Merkle root THEN the system SHALL allow eligible recipients to claim their allocation.
2. WHEN a recipient submits a valid Merkle proof THEN the system SHALL transfer their allocated amount exactly once.
3. IF a recipient has already claimed THEN the system SHALL reject a second claim.
4. IF a Merkle proof is invalid THEN the system SHALL reject the claim.
5. WHERE an airdrop has an expiry THEN the system SHALL allow the creator to reclaim unclaimed tokens after expiry.
6. THE total claimed amount SHALL never exceed the funded airdrop amount.

### Requirement 14: Project Token Presale

**User Story:** As the project team, I want to run a fixed-price presale of the project token (DogOn / DOGON), so that I can raise initial liquidity and distribute tokens fairly before listing.

#### Acceptance Criteria

1. WHEN the sale is live AND a buyer sends OPN THEN the system SHALL record their contribution and allocate tokens at a fixed rate.
2. WHERE a per-wallet cap or global hard cap is configured THEN the system SHALL reject contributions exceeding those caps.
3. WHEN the sale ends with the soft cap met THEN the system SHALL allow the owner to finalize and buyers to claim tokens after an optional unlock time.
4. IF the soft cap is not met by the end OR the sale is cancelled THEN the system SHALL allow buyers to reclaim their OPN in full.
5. WHEN the sale is finalized THEN the system SHALL allow the owner to withdraw raised OPN and sweep unsold tokens.
6. THE total tokens claimable SHALL never exceed the tokens funded into the sale.

### Requirement 15: Quest Points Airdrop (Promotion Campaign)

**User Story:** As the project team, I want to reward users with points for promotional actions (follow, join Discord, post on X, refer friends) and convert points to a token airdrop, so that I can grow the community.

#### Acceptance Criteria

1. WHERE an action type is configured with a point weight THEN the system SHALL allow an authorized operator to award those points to a user.
2. WHEN an operator awards an action to a user THEN the system SHALL credit the configured points and prevent the same action from being credited twice for that user.
3. IF an action is not configured OR the caller is not an authorized operator THEN the system SHALL reject the award.
4. WHEN the campaign converts points to tokens THEN the system SHALL require the reward pool to be funded to cover all outstanding points before opening claims.
5. WHEN a user claims THEN the system SHALL transfer tokens proportional to their points exactly once.
6. THE social actions SHALL be verified off-chain by the project backend (operator), since follow/post/join cannot be proven on-chain.

## Non-Functional Requirements

### Security
- All smart contracts SHALL follow established security patterns (reentrancy guards, checks-effects-interactions, access control via roles).
- Contracts SHALL be built on audited libraries (e.g., OpenZeppelin) where applicable.
- The system SHALL avoid storing user reserves in externally owned accounts.

### Performance
- The platform SHALL leverage OPN Chain's sub-second finality for responsive trade confirmation.
- Read-heavy discovery views SHALL be served from indexed data to minimize on-chain read load.

### Compatibility
- Contracts SHALL be fully EVM-compatible and deployable on OPN Chain without modification.
- The frontend SHALL use standard tooling (ethers.js / wagmi) compatible with OPN Chain JSON-RPC.

### Transparency
- All fees, locks, and reputation changes SHALL be emitted as on-chain events for verifiability.

## Out of Scope (Initial Version)

- Cross-chain bridging (IBC) — planned by OPN Chain for the future, not required for MVP.
- Full DAO governance — initial treasury uses role-based access; DAO is a later phase.
- Native mobile apps — web-first for MVP.
