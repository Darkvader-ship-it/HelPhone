# Stellar/ZK Runbook

## Verified Local Toolchain

- Noir/Nargo: `1.0.0-beta.9`
- Barretenberg: `bb v0.87.0`
- Rust via rustup: `~/.cargo/bin/rustc 1.96.0`
- Stellar CLI: `stellar 25.2.0`

The machine also has Homebrew `rustc 1.90.0` earlier in the default shell `PATH`.
Use the rustup binaries explicitly for Soroban commands:

```bash
RUSTC=/Users/paukoh/.cargo/bin/rustc /Users/paukoh/.cargo/bin/cargo test
RUSTC=/Users/paukoh/.cargo/bin/rustc /Users/paukoh/.cargo/bin/cargo build --target wasm32v1-none --release
```

## Verified Commands

Frontend:

```bash
npm run build
```

HelPhone contract:

```bash
cd contract
RUSTC=/Users/paukoh/.cargo/bin/rustc /Users/paukoh/.cargo/bin/cargo test
RUSTC=/Users/paukoh/.cargo/bin/rustc /Users/paukoh/.cargo/bin/cargo build --target wasm32v1-none --release
```

UltraHonk verifier:

```bash
cd contracts/noir_verifier
./tests/build_circuits.sh
RUSTC=/Users/paukoh/.cargo/bin/rustc /Users/paukoh/.cargo/bin/cargo build --target wasm32v1-none --release
RUSTC=/Users/paukoh/.cargo/bin/rustc /Users/paukoh/.cargo/bin/cargo test
```

Aegis Vault:

```bash
cd contracts/aegis_vault
RUSTC=/Users/paukoh/.cargo/bin/rustc /Users/paukoh/.cargo/bin/cargo test
RUSTC=/Users/paukoh/.cargo/bin/rustc /Users/paukoh/.cargo/bin/cargo build --target wasm32v1-none --release
```

## WASM Outputs

- `contract/target/wasm32v1-none/release/helphone_contract.wasm`
- `contracts/noir_verifier/target/wasm32v1-none/release/ultrahonk_soroban_contract.wasm`
- `contracts/aegis_vault/target/wasm32v1-none/release/aegis_vault.wasm`

## Aegis Funding Flow

Deploy `aegis_vault` with the verifier contract, reward token, and payout admin
address. The constructor initializes the responder payout to 50 USDC in token
base units. The admin can later call `set_payout_amount(admin, amount)` to adjust
the payout for emergency severity, token price changes, or governance decisions.

`aegis_vault.fund_zone` now requires the 160-byte campaign prefix:

```text
box_x_min | box_x_max | box_y_min | box_y_max | campaign_id
```

Claims must use public inputs with the same prefix. This prevents users from
creating arbitrary self-selected location boxes for a funded campaign.

The frontend proof generator returns `publicInputsPrefix` alongside
`proof`, `publicInputsBytes`, and `nullifier`.
