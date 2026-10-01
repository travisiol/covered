// Deploys the router on a local fork of Robinhood Chain (real pons underneath):
//   npx hardhat node --fork https://rpc.mainnet.chain.robinhood.com --port 8934
//   npx hardhat run scripts/deploy-local.ts --network localhost
import { ethers } from "hardhat";

const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";

async function main() {
  const [owner, fulfiller, treasury] = await ethers.getSigners();
  const router = await (await ethers.getContractFactory("CoveredRouter")).deploy(owner.address, ESCROW, FACTORY, fulfiller.address, treasury.address);
  await router.waitForDeployment();
  console.log("ROUTER", await router.getAddress());
  console.log("FULFILLER", fulfiller.address, "(hardhat account #1)");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
