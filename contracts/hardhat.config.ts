import { HardhatUserConfig, task } from "hardhat/config";
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY?.trim();
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

// Every compile re-exports the ABIs (and the router creation bytecode the
// /deploy page needs) into ../lib/abi, so the site cannot drift from the
// contracts.
task(TASK_COMPILE, async (args, hre, runSuper) => {
  const result = await runSuper(args);
  const out = join(__dirname, "..", "lib", "abi");
  mkdirSync(out, { recursive: true });
  for (const name of ["CoveredRouter", "Tab"]) {
    const artifact = await hre.artifacts.readArtifact(name);
    writeFileSync(join(out, `${name}.json`), JSON.stringify(artifact.abi, null, 2) + "\n");
    if (name === "CoveredRouter") {
      writeFileSync(join(out, `${name}.bytecode.json`), JSON.stringify({ bytecode: artifact.bytecode }) + "\n");
    }
  }
  return result;
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" },
  },
  networks: {
    // Same chain id as mainnet, so a forked node accepts the site's wallet and quotes.
    hardhat: { chainId: 4663 },
    localhost: { url: process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8934" },
    robinhood: {
      url: process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts,
    },
  },
};

export default config;
