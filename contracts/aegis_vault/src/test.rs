#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;

// Issue #176: upgrade mechanism for aegis_vault.
//
// Scope note: these tests cover what a native unit test can honestly
// verify — that the constructor records an admin and that `upgrade` is
// gated behind that admin's authorization. A full end-to-end WASM swap
// (uploading a second built artifact and confirming the running contract
// actually changes behavior while storage survives) needs a real second
// compiled .wasm and is exercised against Stellar testnet as part of the
// deploy runbook, not as a native unit test — Soroban's own upgrade
// examples test it the same way, since `update_current_contract_wasm`
// only has an artifact to swap to once something has actually been built
// and uploaded.

fn setup(env: &Env) -> (AegisVaultClient<'_>, Address) {
    let verifier = Address::generate(env);
    let token = Address::generate(env);
    let admin = Address::generate(env);
    let contract_id = env.register(AegisVault, (verifier, token, admin.clone()));
    (AegisVaultClient::new(env, &contract_id), admin)
}

#[test]
fn constructor_records_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup(&env);
    assert_eq!(client.get_admin(), Some(admin));
}

#[test]
fn upgrade_requires_admin_authorization() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup(&env);
    let not_admin = Address::generate(&env);
    assert_ne!(admin, not_admin);

    // A syntactically valid (if meaningless) wasm hash — upgrade must
    // reject the caller on authorization grounds before it would ever
    // attempt to resolve/install this hash.
    let bogus_hash = BytesN::from_array(&env, &[7u8; 32]);

    // `set_auths` switches this env from "mock every require_auth" (set by
    // setup()'s mock_all_auths) to strict verification against exactly the
    // given entries. An empty list means no address is authorized for the
    // next invocation, so `admin.require_auth()` inside `upgrade` must fail.
    env.set_auths(&[]);
    let result = client.try_upgrade(&bogus_hash);
    assert!(result.is_err(), "upgrade must fail without the admin's authorization");
}
