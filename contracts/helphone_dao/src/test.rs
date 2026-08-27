#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Env, String};

fn create_test_env() -> (Env, Address, Address) {
    let env = Env::default();
    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    (env, admin, token)
}

#[test]
fn constructor_sets_admin_and_token() {
    let (env, admin, token) = create_test_env();
    env.mock_all_auths();

    let contract = HelPhoneDao;
    env.register_contract(&Address::generate(&env), contract);

    let contract_addr = Address::generate(&env);
    env.register_contract(&contract_addr, HelPhoneDao);

    HelPhoneDao::__constructor(env.clone(), admin.clone(), token.clone()).unwrap();

    assert_eq!(HelPhoneDao::get_admin(env.clone()), Some(admin));
    assert_eq!(HelPhoneDao::get_governance_token(env.clone()), Some(token));
    assert_eq!(HelPhoneDao::get_proposal_count(env.clone()), 0);
}

#[test]
fn governance_params_are_correct() {
    let env = Env::default();
    let (voting_period, execution_delay, quorum, pass_threshold) =
        HelPhoneDao::get_governance_params(env);

    assert_eq!(voting_period, 3 * 24 * 60 * 60); // 3 days
    assert_eq!(execution_delay, 1 * 24 * 60 * 60); // 1 day
    assert_eq!(quorum, 20); // 20%
    assert_eq!(pass_threshold, 50); // 50%
}

#[test]
fn proposal_status_values() {
    assert_eq!(ProposalStatus::Active, ProposalStatus::Active);
    assert_eq!(ProposalStatus::Passed, ProposalStatus::Passed);
    assert_eq!(ProposalStatus::Failed, ProposalStatus::Failed);
    assert_eq!(ProposalStatus::Executed, ProposalStatus::Executed);
    assert_eq!(ProposalStatus::Cancelled, ProposalStatus::Cancelled);
}

#[test]
fn vote_direction_values() {
    assert_eq!(VoteDirection::For, VoteDirection::For);
    assert_eq!(VoteDirection::Against, VoteDirection::Against);
    assert_eq!(VoteDirection::Abstain, VoteDirection::Abstain);
}

#[test]
fn proposal_type_values() {
    assert_eq!(ProposalType::ProtocolUpgrade, ProposalType::ProtocolUpgrade);
    assert_eq!(ProposalType::FundAllocation, ProposalType::FundAllocation);
    assert_eq!(ProposalType::ParameterChange, ProposalType::ParameterChange);
    assert_eq!(ProposalType::General, ProposalType::General);
}
