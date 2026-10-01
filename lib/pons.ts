import { parseAbi } from "viem";
import { PONS } from "./config";

// Signatures read from the deployed bytecode and proven by simulation
// (scripts/probe-pons.mjs). `creatorFeeRecipient` is where the fees go.
export const ponsAbi = parseAbi([
  "struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }",
  "struct LaunchParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 economicsHash; bytes32 salt; }",
  "function launchToken(LaunchParams params, uint256 configId, address pairToken, address[] snipeTaxExempt) payable returns (address token, address curve)",
  "function launchAndBuy(LaunchParams params, uint256 configId, address pairToken, uint256 buyAmount, uint256 minTokensOut, address buyRecipient, address[] snipeTaxExempt) payable returns (address token, address curve)",
  "function previewLaunchEconomics(uint256 configId, address pairToken) view returns (bytes32)",
  "function launchFee() view returns (uint256)",
]);

export const curveAbi = parseAbi([
  "function quoteFeeBalance() view returns (uint256)",
  "function deployer() view returns (address)",
  "function graduated() view returns (bool)",
]);

export const escrowAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

/** Tokens out for a dev buy on a fresh curve (constant product, 1% fee on the way in). */
export function tokensForFirstBuy(weiIn: bigint): bigint {
  const net = weiIn - (weiIn * PONS.feeBps) / 10_000n;
  return (PONS.launchSupply * net) / (PONS.phantomQuote + net);
}
