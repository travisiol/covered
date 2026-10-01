// End-to-end check against a fork of Robinhood Chain mainnet:
//   npx hardhat run scripts/fork-check.ts
// Real pons factory, real pons fee escrow, our router and tab on top.
import { ethers, network } from "hardhat";

const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";
const RPC = process.env.FORK_URL ?? "https://rpc.mainnet.chain.robinhood.com";

const pons = [
  "function launchToken((string name,string symbol,string logo,string description,(string,string,string,string,string) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 economicsHash,bytes32 salt) params,uint256 configId,address pairToken,address[] snipeTaxExempt) payable returns (address token,address curve)",
  "function previewLaunchEconomics(uint256,address) view returns (bytes32)",
  "function launchFee() view returns (uint256)",
];
const curveAbi = [
  "function deployer() view returns (address)",
  "function buy(uint256 quoteAmount,uint256 minTokensOut,address recipient) payable",
  "function quoteFeeBalance() view returns (uint256)",
];
const escrowAbi = ["function credit(address) payable", "function balanceOf(address) view returns (uint256)"];

const step = (n: number, text: string) => console.log(`  ${n}. ${text}`);

async function main() {
  await network.provider.request({ method: "hardhat_reset", params: [{ forking: { jsonRpcUrl: RPC } }] });
  const [owner, fulfiller, treasury, creator, trader] = await ethers.getSigners();
  console.log("fork at block", await ethers.provider.getBlockNumber());

  const factory = new ethers.Contract(FACTORY, pons, creator);
  const escrow = new ethers.Contract(ESCROW, escrowAbi, trader);

  const router = await (await ethers.getContractFactory("CoveredRouter")).deploy(owner.address, ESCROW, FACTORY, fulfiller.address, treasury.address);
  const tabAddress = await router.predictTab(creator.address);
  step(1, `router deployed, creator's tab will be ${tabAddress} (no code yet)`);

  // The part a mock cannot prove: a real pons launch whose fees point at the unopened tab.
  const params = {
    name: "Fork Check",
    symbol: "FORK",
    logo: "",
    description: "Creator fees pay for gift cards via Covered",
    socials: ["", "", "", "", ""],
    creatorFeeRecipient: tabAddress,
    creatorTaxBps: 100,
    buybackEnabled: false,
    economicsHash: await factory.previewLaunchEconomics(0, ethers.ZeroAddress),
    salt: ethers.id("covered-fork-check" + Date.now()),
  };
  const fee = await factory.launchFee();
  const [token, curveAddress] = await factory.launchToken.staticCall(params, 0, ethers.ZeroAddress, [], { value: fee });
  await (await factory.launchToken(params, 0, ethers.ZeroAddress, [], { value: fee })).wait();
  const curve = new ethers.Contract(curveAddress, curveAbi, trader);
  if ((await curve.deployer()) !== tabAddress) throw new Error("curve.deployer() is not the tab");
  step(2, `real pons launch ${token}: the curve's fee recipient is the tab`);

  await network.provider.send("evm_increaseTime", [10]);
  await (await curve.buy(ethers.parseEther("0.2"), 0, trader.address, { value: ethers.parseEther("0.2") })).wait();
  step(3, `a 0.2 ETH buy left ${ethers.formatEther(await curve.quoteFeeBalance())} ETH of fees on the curve (pons sweeps them later)`);

  // pons sweeps on its own schedule; stand in for the sweep by crediting the real escrow.
  const swept = ethers.parseEther("0.02");
  try {
    await (await escrow.credit(tabAddress, { value: swept })).wait();
  } catch {
    await network.provider.send("hardhat_impersonateAccount", [curveAddress]);
    await network.provider.send("hardhat_setBalance", [curveAddress, "0x56BC75E2D63100000"]);
    const asCurve = await ethers.getSigner(curveAddress);
    await (await escrow.connect(asCurve).getFunction("credit")(tabAddress, { value: swept })).wait();
    console.log("     (escrow.credit needed the curve as sender)");
  }
  if ((await escrow.balanceOf(tabAddress)) !== swept) throw new Error("escrow did not credit the tab");
  step(4, "real pons escrow holds 0.02 ETH for the tab");

  await (await router.connect(trader).pullMany([creator.address])).wait();
  const tab = await ethers.getContractAt("Tab", tabAddress);
  if ((await tab.available()) !== swept) throw new Error("tab did not receive the escrow balance");
  step(5, "pullMany by a stranger: tab deployed and 0.02 ETH claimed from the real escrow");

  const sku = ethers.encodeBytes32String("netflix-25");
  const q = { tab: tabAddress, sku, usdCents: 2500, weiAmount: ethers.parseEther("0.008"), expiry: (await ethers.provider.getBlock("latest"))!.timestamp + 300, nonce: 1 };
  const { chainId } = await ethers.provider.getNetwork();
  const signature = await fulfiller.signTypedData(
    { name: "Covered", version: "1", chainId, verifyingContract: tabAddress },
    { Quote: [{ name: "tab", type: "address" }, { name: "sku", type: "bytes32" }, { name: "usdCents", type: "uint32" }, { name: "weiAmount", type: "uint256" }, { name: "expiry", type: "uint256" }, { name: "nonce", type: "uint256" }] },
    q,
  );
  await (await tab.connect(creator).redeem(q.sku, q.usdCents, q.weiAmount, q.expiry, q.nonce, signature)).wait();
  const before = await ethers.provider.getBalance(treasury.address);
  await (await tab.connect(fulfiller).fulfill(0, ethers.id("supplier-order-1"))).wait();
  if ((await ethers.provider.getBalance(treasury.address)) - before !== q.weiAmount) throw new Error("treasury not paid");
  step(6, "card ordered with a signed quote (chain id " + chainId + "), delivered, treasury paid 0.008 ETH");

  await (await tab.connect(creator).withdraw(creator.address, await tab.available())).wait();
  step(7, "creator withdrew the remaining 0.012 ETH");
  console.log("fork check passed");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
