# Covered

Launch a coin on pons (Robinhood Chain). Every creator fee it earns goes to your
balance, and the balance buys gift cards for you, by itself. Same fee-bridge
mechanism as cashed.money, with gift cards instead of a dollar payout.

## How it works

1. `CoveredRouter` gives every wallet one deterministic `Tab` address (a clone).
   The router's own address is fixed by the operator address
   (`NEXT_PUBLIC_OPERATOR_ADDRESS`) and `lib/abi/CoveredRouter.bytecode.json`,
   so the site knows it before it exists. **The first person who launches a coin
   deploys it** (one extra transaction, through the CREATE2 proxy); `/deploy`
   shows its state. Once coins point at it, that bytecode file must not change.
2. The launch page calls pons directly with `creatorFeeRecipient = tab`, then
   `router.setup(...)` saves the creator's auto-pay list and e-mail.
3. pons sweeps creator fees to its escrow; `Tab.pull()` collects them (anyone can call it).
4. Auto-pay: `GET /api/cron/renew` (daily on Vercel, see `vercel.json`) charges
   every card that is due and covered (`Tab.charge`, capped in wei).
5. Manual buy: the server signs a price (EIP-712), `Tab.redeem` locks the wei.
6. Delivery. With a supplier (Reloadly) the card is bought automatically. Without
   one, which is the default, the order waits in `/admin` (password: `ADMIN_SECRET`):
   the operator buys the card anywhere, pastes its code, and `Tab.fulfill` stores
   it **encrypted on chain** and pays the locked price to the treasury. No
   delivery → refund (any time by the operator, after 48 h by the creator).
7. The creator reads a code under "My cards" with a wallet signature
   (`/api/reveal` decrypts what the chain holds). Nothing is stored on the server.
8. `/c/<token>` is the coin's public page, read from the chain.
9. The creator can always `withdraw` the ETH, or `redirectFees` away (pons' 3-day timelock).

## Run

```bash
npm install && npm --prefix contracts install
npm run dev -- --port 3934
npm run test:contracts                                   # 22 tests
cd contracts && npx hardhat run scripts/fork-check.ts    # real pons on a mainnet fork
node scripts/probe-pons.mjs                              # pons calls simulated on mainnet
```

### The whole flow on a local fork

```bash
cd contracts
npx hardhat node --fork https://rpc.mainnet.chain.robinhood.com --port 8934
```

Add `ROBINHOOD_RPC_URL=http://127.0.0.1:8934` to `.env.local`, restart the site,
and use a wallet whose transactions go to that node (the run recorded here used
a hardhat account behind an EIP-6963 stub). The first launch deploys the router
at its real address. Then:

```bash
TOKEN=0x… ETH=0.05 npx hardhat run scripts/sweep-local.ts --network localhost   # a trade + a fee sweep
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3934/api/cron/renew  # auto-pay
```

**Remove that line afterwards.** With it, the server reads the fork while real
wallets write to mainnet.

## Operating it

- `node scripts/new-operator.mjs` creates the operator key and the secrets in
  `.env.local`. The same five values are set on Vercel. **Back that file up**:
  the key owns the router and receives the price of every delivered card, and
  `CARDS_SECRET` decrypts every stored code.
- Send the operator address a little ETH on Robinhood Chain: it pays the gas of
  every delivery, refund and auto-pay charge. `/admin` shows its balance.
- Deliver orders from `/admin`. To hand ownership to another wallet, call
  `transferOwnership` then `acceptOwnership` on the router; `setFulfiller` and
  `setTreasury` change the other two roles.
- Vercel's free plan runs the cron once a day; call `/api/cron/renew` more often
  from elsewhere if cards should be bought sooner.

## Not proven yet

- Nothing has been signed by a real wallet on mainnet. The router's deployment
  and a pons launch were simulated against mainnet (`eth_call`), and the whole
  flow was played on a fork with the production configuration.
- `lib/server/provider.ts` (Reloadly) has never run with real credentials.
- The contracts are not audited. Card prices and "covers" labels in
  `lib/catalog.ts` are typical US prices and only feed the estimate.
- The name is a placeholder: it lives in `BRAND` in `lib/config.ts`.
