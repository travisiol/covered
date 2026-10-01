// Proves, against Robinhood Chain mainnet and without spending a wei, the two
// pons calls the site relies on. Uses eth_call with a state override.
import { createPublicClient, http, parseAbi, encodeFunctionData, decodeFunctionResult, parseEther, zeroAddress, keccak256, toHex } from "viem";
const RPC = process.env.RPC ?? "https://rpc.mainnet.chain.robinhood.com";
const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const client = createPublicClient({ transport: http(RPC) });
const abi = parseAbi([
  "struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }",
  "struct LaunchParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 economicsHash; bytes32 salt; }",
  "function launchToken(LaunchParams params, uint256 configId, address pairToken, address[] snipeTaxExempt) payable returns (address token, address curve)",
  "function previewLaunchEconomics(uint256 configId, address pairToken) view returns (bytes32)",
  "function launchFee() view returns (uint256)",
  "function transferCreatorFeeRecipient(address token, address newRecipient)",
  "function pendingCreatorFeeRecipient(address token) view returns (address)",
  "function CREATOR_FEE_RECIPIENT_TIMELOCK() view returns (uint256)",
  "function deployer() view returns (address)",
]);
const fee = await client.readContract({ address: FACTORY, abi, functionName: "launchFee" });
const economicsHash = await client.readContract({ address: FACTORY, abi, functionName: "previewLaunchEconomics", args: [0n, zeroAddress] });
console.log("launchFee", fee, "economicsHash", economicsHash);
const eoa = "0x00000000000000000000000000000000c0febabe";
const tab = "0x000000000000000000000000000000000000ab1e"; // a recipient with no code, like an unopened tab
const data = encodeFunctionData({ abi, functionName: "launchToken", args: [{
  name: "Probe", symbol: "PROBE", logo: "", description: "Fees pay for gift cards via Covered",
  socials: { twitter: "", telegram: "", discord: "", website: "", farcaster: "" },
  creatorFeeRecipient: tab, creatorTaxBps: 0, buybackEnabled: false, economicsHash, salt: keccak256(toHex("probe" + Date.now())),
}, 0n, zeroAddress, []] });
const res = await client.call({ account: eoa, to: FACTORY, data, value: fee, stateOverride: [{ address: eoa, balance: parseEther("1") }] });
const [token, curve] = decodeFunctionResult({ abi, functionName: "launchToken", data: res.data });
console.log("1. launchToken with a codeless fee recipient ->", { token, curve });
console.log("timelock (s)", await client.readContract({ address: FACTORY, abi, functionName: "CREATOR_FEE_RECIPIENT_TIMELOCK" }).catch(e => e.shortMessage));
// 2. transferCreatorFeeRecipient(token, newRecipient), called by the current recipient of a real coin
const real = process.argv[2] ?? "0xe70aa718091c1968a08951229824e6d9e24d2a20";
const logs = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: FACTORY, data: "0x3cf28b5a" + real.slice(2).padStart(64, "0") }, "latest"] }) }).then(r => r.json());
const words = logs.result.slice(2).match(/.{64}/g).slice(0, 12);
const cands = [...new Set(words.filter(w => /^0{24}[0-9a-f]{40}$/.test(w) && !/^0{60}/.test(w)).map(w => "0x" + w.slice(24)))];
console.log("getLaunchedToken addresses", cands);
for (const from of cands) {
  try {
    await client.call({ account: from, to: FACTORY, data: encodeFunctionData({ abi, functionName: "transferCreatorFeeRecipient", args: [real, eoa] }) });
    console.log("2. transferCreatorFeeRecipient(token,new) OK when called by", from);
  } catch (e) { console.log("   from", from, "->", (e.shortMessage || e.message).slice(0, 120), e.cause?.data ?? e.walk?.()?.data ?? ""); }
}
