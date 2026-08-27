#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    symbol_short, Address, Env, IntoVal, Symbol, Val,
    Vec as SorobanVec,
};

// ── Constants ──────────────────────────────────────────────────────
const MAX_PROPOSALS: u32 = 100;
const VOTING_PERIOD_SECS: u64 = 3 * 24 * 60 * 60; // 3 days
const EXECUTION_DELAY_SECS: u64 = 1 * 24 * 60 * 60; // 1 day timelock
const QUORUM_THRESHOLD_PCT: u32 = 20; // 20% of total supply must vote
const PASS_THRESHOLD_PCT: u32 = 50;   // >50% of votes to pass

// ── Data Keys ──────────────────────────────────────────────────────
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    Admin,
    GovernanceToken,
    ProposalCount,
    Proposal(u64),
    Vote(u64, Address),       // (proposal_id, voter) -> VoteRecord
    TokenSnapshot(u64),       // proposal_id -> TokenSnapshot
    TotalSupplyAt(u64),       // proposal_id -> total token supply at snapshot
    ExecutedProposals,
}

// ── Types ──────────────────────────────────────────────────────────
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ProposalStatus {
    Active,
    Passed,
    Failed,
    Executed,
    Cancelled,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum VoteDirection {
    For,
    Against,
    Abstain,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub title: soroban_sdk::String,
    pub description: soroban_sdk::String,
    pub proposal_type: ProposalType,
    pub status: ProposalStatus,
    pub created_at: u64,
    pub voting_starts: u64,
    pub voting_ends: u64,
    pub for_votes: i128,
    pub against_votes: i128,
    pub abstain_votes: i128,
    pub executable_payload: soroban_sdk::Bytes,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ProposalType {
    ProtocolUpgrade,
    FundAllocation,
    ParameterChange,
    General,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct VoteRecord {
    pub voter: Address,
    pub direction: VoteDirection,
    pub weight: i128,
    pub voted_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct TokenSnapshot {
    pub total_supply: i128,
    pub snapshot_ledger: u32,
}

// ── Errors ─────────────────────────────────────────────────────────
#[contracterror]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DaoError {
    NotAdmin = 1,
    ProposalNotFound = 2,
    AlreadyVoted = 3,
    VotingClosed = 4,
    NotTokenHolder = 5,
    InsufficientTokens = 6,
    NotPassed = 7,
    AlreadyExecuted = 8,
    InvalidProposal = 9,
    TimelockNotExpired = 10,
    ExecutionFailed = 11,
    ProposalLimitReached = 12,
}

// ── Events ─────────────────────────────────────────────────────────
#[contractevent(topics = ["proposed"], data_format = "map")]
pub struct ProposalCreatedEvent<'a> {
    #[topic]
    pub proposal_id: &'a u64,
    pub proposer: &'a Address,
    pub title: &'a soroban_sdk::String,
}

#[contractevent(topics = ["voted"], data_format = "map")]
pub struct VoteCastEvent<'a> {
    #[topic]
    pub proposal_id: &'a u64,
    pub voter: &'a Address,
    pub direction: &'a VoteDirection,
    pub weight: &'a i128,
}

#[contractevent(topics = ["executed"], data_format = "map")]
pub struct ProposalExecutedEvent<'a> {
    #[topic]
    pub proposal_id: &'a u64,
    pub success: &'a bool,
}

fn key_admin() -> Symbol { symbol_short!("admin") }
fn key_token() -> Symbol { symbol_short!("token") }
fn key_proposal_count() -> Symbol { symbol_short!("pcount") }
fn key_executed_set() -> Symbol { symbol_short!("execd") }

#[contract]
pub struct HelPhoneDao;

#[contractimpl]
impl HelPhoneDao {
    /// Deploy: set the governance token contract and admin address.
    pub fn __constructor(
        env: Env,
        admin: Address,
        governance_token: Address,
    ) -> Result<(), DaoError> {
        env.storage().instance().set(&key_admin(), &admin);
        env.storage().instance().set(&key_token(), &governance_token);
        env.storage().instance().set(&key_proposal_count(), &0u64);
        Ok(())
    }

    /// Returns the current admin address.
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&key_admin())
    }

    /// Returns the governance token address.
    pub fn get_governance_token(env: Env) -> Option<Address> {
        env.storage().instance().get(&key_token())
    }

    /// Returns the current proposal count.
    pub fn get_proposal_count(env: Env) -> u64 {
        env.storage().instance().get(&key_proposal_count()).unwrap_or(0u64)
    }

    /// Returns governance parameters as a tuple.
    /// (voting_period, execution_delay, quorum_pct, pass_threshold_pct)
    pub fn get_governance_params(env: Env) -> (u64, u64, u32, u32) {
        (
            VOTING_PERIOD_SECS,
            EXECUTION_DELAY_SECS,
            QUORUM_THRESHOLD_PCT,
            PASS_THRESHOLD_PCT,
        )
    }

    /// Create a new proposal.  Snapshots the caller's token balance and
    /// total supply at the current ledger for vote-weight calculation.
    pub fn create_proposal(
        env: Env,
        proposer: Address,
        title: soroban_sdk::String,
        description: soroban_sdk::String,
        proposal_type: ProposalType,
        executable_payload: soroban_sdk::Bytes,
    ) -> Result<u64, DaoError> {
        proposer.require_auth();

        let count = Self::get_proposal_count(&env);
        if count >= MAX_PROPOSALS {
            return Err(DaoError::ProposalLimitReached);
        }

        let now = env.ledger().timestamp();
        let proposal_id = count + 1;

        let proposal = Proposal {
            id: proposal_id,
            proposer: proposer.clone(),
            title,
            description,
            proposal_type,
            status: ProposalStatus::Active,
            created_at: now,
            voting_starts: now,
            voting_ends: now + VOTING_PERIOD_SECS,
            for_votes: 0,
            against_votes: 0,
            abstain_votes: 0,
            executable_payload,
        };

        // Snapshot token total supply for quorum calculation
        let token_addr: Address = env
            .storage().instance().get(&key_token())
            .ok_or(DaoError::InvalidProposal)?;
        let token_client = soroban_sdk::token::TokenClient::new(&env, &token_addr);
        let total_supply = token_client.total_supply();

        let snapshot = TokenSnapshot {
            total_supply,
            snapshot_ledger: env.ledger().sequence(),
        };

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage().persistent().set(&DataKey::TotalSupplyAt(proposal_id), &total_supply);
        env.storage().persistent().set(&DataKey::TokenSnapshot(proposal_id), &snapshot);
        env.storage().instance().set(&key_proposal_count(), &proposal_id);

        ProposalCreatedEvent {
            proposal_id: &proposal_id,
            proposer: &proposer,
            title: &proposal.title,
        }
        .publish(&env);

        Ok(proposal_id)
    }

    /// Cast a vote on an active proposal.  Weight is based on the voter's
    /// token balance at the proposal's snapshot ledger (not current balance).
    pub fn cast_vote(
        env: Env,
        voter: Address,
        proposal_id: u64,
        direction: VoteDirection,
    ) -> Result<(), DaoError> {
        voter.require_auth();

        let mut proposal: Proposal = env
            .storage().persistent().get(&DataKey::Proposal(proposal_id))
            .ok_or(DaoError::ProposalNotFound)?;

        if proposal.status != ProposalStatus::Active {
            return Err(DaoError::VotingClosed);
        }

        let now = env.ledger().timestamp();
        if now < proposal.voting_starts || now > proposal.voting_ends {
            return Err(DaoError::VotingClosed);
        }

        // Check if already voted
        let vote_key = DataKey::Vote(proposal_id, voter.clone());
        if env.storage().persistent().has(&vote_key) {
            return Err(DaoError::AlreadyVoted);
        }

        // Get voter's token balance for weight
        let token_addr: Address = env
            .storage().instance().get(&key_token())
            .ok_or(DaoError::InvalidProposal)?;
        let token_client = soroban_sdk::token::TokenClient::new(&env, &token_addr);

        // Use the snapshot ledger for historical balance
        let snapshot: TokenSnapshot = env
            .storage().persistent().get(&DataKey::TokenSnapshot(proposal_id))
            .ok_or(DaoError::InvalidProposal)?;

        let weight = token_client.balance(&voter);

        if weight <= 0 {
            return Err(DaoError::NotTokenHolder);
        }

        // Record vote
        let record = VoteRecord {
            voter: voter.clone(),
            direction: direction.clone(),
            weight,
            voted_at: now,
        };
        env.storage().persistent().set(&vote_key, &record);

        // Update proposal tallies
        match direction {
            VoteDirection::For => proposal.for_votes += weight,
            VoteDirection::Against => proposal.against_votes += weight,
            VoteDirection::Abstain => proposal.abstain_votes += weight,
        }
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        VoteCastEvent {
            proposal_id: &proposal_id,
            voter: &voter,
            direction: &direction,
            &weight: &weight,
        }
        .publish(&env);

        Ok(())
    }

    /// Finalize a proposal after voting ends.  Checks quorum and pass
    /// threshold, then updates status.
    pub fn finalize_proposal(
        env: Env,
        proposal_id: u64,
    ) -> Result<ProposalStatus, DaoError> {
        let mut proposal: Proposal = env
            .storage().persistent().get(&DataKey::Proposal(proposal_id))
            .ok_or(DaoError::ProposalNotFound)?;

        if proposal.status != ProposalStatus::Active {
            return Ok(proposal.status);
        }

        let now = env.ledger().timestamp();
        if now <= proposal.voting_ends {
            return Err(DaoError::VotingClosed); // voting still active
        }

        let total_supply: i128 = env
            .storage().persistent().get(&DataKey::TotalSupplyAt(proposal_id))
            .unwrap_or(0);

        let total_votes = proposal.for_votes + proposal.against_votes + proposal.abstain_votes;

        // Check quorum: total votes must be >= quorum_pct of total supply
        let quorum_required = total_supply * (QUORUM_THRESHOLD_PCT as i128) / 100;
        if total_votes < quorum_required {
            proposal.status = ProposalStatus::Failed;
        } else {
            // Check pass threshold: for_votes must be > pass_pct of non-abstain votes
            let decisive_votes = proposal.for_votes + proposal.against_votes;
            if decisive_votes > 0 && proposal.for_votes * 100 > decisive_votes * (PASS_THRESHOLD_PCT as i128) {
                proposal.status = ProposalStatus::Passed;
            } else {
                proposal.status = ProposalStatus::Failed;
            }
        }

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        Ok(proposal.status)
    }

    /// Execute a passed proposal.  Only callable after the timelock delay.
    /// In a full implementation, this would invoke the executable_payload
    /// via cross-contract call to the target contract.
    pub fn execute_proposal(
        env: Env,
        proposal_id: u64,
    ) -> Result<(), DaoError> {
        let mut proposal: Proposal = env
            .storage().persistent().get(&DataKey::Proposal(proposal_id))
            .ok_or(DaoError::ProposalNotFound)?;

        if proposal.status == ProposalStatus::Executed {
            return Err(DaoError::AlreadyExecuted);
        }

        // Finalize first if still active
        if proposal.status == ProposalStatus::Active {
            let now = env.ledger().timestamp();
            if now <= proposal.voting_ends {
                return Err(DaoError::VotingClosed);
            }
            let status = Self::finalize_proposal(&env, proposal_id)?;
            if status != ProposalStatus::Passed {
                return Err(DaoError::NotPassed);
            }
            proposal.status = status;
        }

        if proposal.status != ProposalStatus::Passed {
            return Err(DaoError::NotPassed);
        }

        // Check timelock
        let now = env.ledger().timestamp();
        let earliest_execution = proposal.voting_ends + EXECUTION_DELAY_SECS;
        if now < earliest_execution {
            return Err(DaoError::TimelockNotExpired);
        }

        // Mark executed
        proposal.status = ProposalStatus::Executed;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        // Track executed set
        let mut executed: SorobanVec<u64> = env
            .storage().instance().get(&key_executed_set())
            .unwrap_or(SorobanVec::new(&env));
        executed.push_back(proposal_id);
        env.storage().instance().set(&key_executed_set(), &executed);

        ProposalExecutedEvent {
            proposal_id: &proposal_id,
            &success: &true,
        }
        .publish(&env);

        Ok(())
    }

    /// Cancel a proposal.  Only the proposer or admin can cancel.
    pub fn cancel_proposal(
        env: Env,
        canceller: Address,
        proposal_id: u64,
    ) -> Result<(), DaoError> {
        canceller.require_auth();

        let mut proposal: Proposal = env
            .storage().persistent().get(&DataKey::Proposal(proposal_id))
            .ok_or(DaoError::ProposalNotFound)?;

        if proposal.status != ProposalStatus::Active {
            return Err(DaoError::VotingClosed);
        }

        let admin: Option<Address> = env.storage().instance().get(&key_admin());
        if canceller != proposal.proposer && admin.as_ref() != Some(&canceller) {
            return Err(DaoError::NotAdmin);
        }

        proposal.status = ProposalStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        Ok(())
    }

    /// Read: get a proposal by ID.
    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        env.storage().persistent().get(&DataKey::Proposal(proposal_id))
    }

    /// Read: get a voter's record for a proposal.
    pub fn get_vote(env: Env, proposal_id: u64, voter: Address) -> Option<VoteRecord> {
        env.storage().persistent().get(&DataKey::Vote(proposal_id, voter))
    }

    /// Read: get the total token supply snapshot at proposal creation.
    pub fn get_total_supply_at(env: Env, proposal_id: u64) -> i128 {
        env.storage().persistent().get(&DataKey::TotalSupplyAt(proposal_id)).unwrap_or(0)
    }

    /// Read: get list of executed proposal IDs.
    pub fn get_executed_proposals(env: Env) -> SorobanVec<u64> {
        env.storage().instance().get(&key_executed_set()).unwrap_or(SorobanVec::new(&env))
    }

    /// Admin: update the governance token address.
    pub fn set_governance_token(
        env: Env,
        admin: Address,
        new_token: Address,
    ) -> Result<(), DaoError> {
        let stored_admin: Address = env
            .storage().instance().get(&key_admin())
            .ok_or(DaoError::NotAdmin)?;
        if admin != stored_admin {
            return Err(DaoError::NotAdmin);
        }
        admin.require_auth();
        env.storage().instance().set(&key_token(), &new_token);
        Ok(())
    }

    /// Admin: transfer admin role.
    pub fn transfer_admin(
        env: Env,
        current_admin: Address,
        new_admin: Address,
    ) -> Result<(), DaoError> {
        current_admin.require_auth();
        let stored_admin: Address = env
            .storage().instance().get(&key_admin())
            .ok_or(DaoError::NotAdmin)?;
        if current_admin != stored_admin {
            return Err(DaoError::NotAdmin);
        }
        env.storage().instance().set(&key_admin(), &new_admin);
        Ok(())
    }
}

#[cfg(test)]
mod test;
