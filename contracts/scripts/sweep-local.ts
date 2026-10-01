// Local fork only. Stands in for trading and for pons' fee sweep on one coin:
//   TOKEN=0x… ETH=0.05 npx hardhat run scripts/sweep-local.ts --network localhost
// A trader buys the coin on its real curve, then `ETH` is credited to the
// coin's fee recipient in the real pons escrow, as a sweep would.
import { ethers } from "hardhat";

const ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";

async function main() {
  const [, , , , trader] = await ethers.getSigners();
  const token = new ethers.Contract(process.env.TOKEN!, ["function curve() view returns (address)"], trader);
  const curve = new ethers.Contract(
    await token.curve(),
    ["function deployer() view returns (address)", "function buy(uint256,uint256,address) payable", "function quoteFeeBalance() view returns (uint256)"],
    trader,
  );
  const recipient = await curve.deployer();
  await (await curve.buy(ethers.parseEther("0.2"), 0, trader.address, { value: ethers.parseEther("0.2") })).wait();
  console.log("bought 0.2 ETH of the coin; fees on the curve:", ethers.formatEther(await curve.quoteFeeBalance()));
  const escrow = new ethers.Contract(ESCROW, ["function credit(address) payable", "function balanceOf(address) view returns (uint256)"], trader);
  await (await escrow.credit(recipient, { value: ethers.parseEther(process.env.ETH ?? "0.05") })).wait();
  console.log("escrow now holds", ethers.formatEther(await escrow.balanceOf(recipient)), "ETH for", recipient);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
