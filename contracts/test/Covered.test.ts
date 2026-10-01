import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const sku = (s: string) => ethers.encodeBytes32String(s);
const NETFLIX = sku("netflix-25");
const eth = (n: string) => ethers.parseEther(n);

describe("Covered", () => {
  async function setup() {
    const [owner, fulfiller, treasury, creator, stranger] = await ethers.getSigners();
    const escrow = await (await ethers.getContractFactory("MockEscrow")).deploy();
    const pons = await (await ethers.getContractFactory("MockPonsFactory")).deploy();
    const router = await (await ethers.getContractFactory("CoveredRouter")).deploy(
      owner.address,
      await escrow.getAddress(),
      await pons.getAddress(),
      fulfiller.address,
      treasury.address,
    );
    const tabAddress = await router.predictTab(creator.address);
    const tab = await ethers.getContractAt("Tab", tabAddress);
    return { owner, fulfiller, treasury, creator, stranger, escrow, pons, router, tab, tabAddress };
  }

  async function quote(
    s: Awaited<ReturnType<typeof setup>>,
    over: Partial<{ signer: any; weiAmount: bigint; expiry: number; nonce: number; usdCents: number }> = {},
  ) {
    const q = {
      tab: s.tabAddress,
      sku: NETFLIX,
      usdCents: over.usdCents ?? 2500,
      weiAmount: over.weiAmount ?? eth("0.01"),
      expiry: over.expiry ?? (await time.latest()) + 300,
      nonce: over.nonce ?? 1,
    };
    const { chainId } = await ethers.provider.getNetwork();
    const signature = await (over.signer ?? s.fulfiller).signTypedData(
      { name: "Covered", version: "1", chainId, verifyingContract: s.tabAddress },
      {
        Quote: [
          { name: "tab", type: "address" },
          { name: "sku", type: "bytes32" },
          { name: "usdCents", type: "uint32" },
          { name: "weiAmount", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
      },
      q,
    );
    return { ...q, signature };
  }

  const redeem = (s: Awaited<ReturnType<typeof setup>>, q: Awaited<ReturnType<typeof quote>>, from = s.creator) =>
    s.tab.connect(from).redeem(q.sku, q.usdCents, q.weiAmount, q.expiry, q.nonce, q.signature);

  async function funded() {
    const s = await setup();
    await s.escrow.credit(s.tabAddress, { value: eth("0.05") });
    await s.router.pullMany([s.creator.address]);
    return s;
  }

  describe("tab address", () => {
    it("is known before the tab exists and fees credited early are not lost", async () => {
      const s = await setup();
      expect(await s.router.isOpen(s.creator.address)).to.equal(false);
      await s.escrow.credit(s.tabAddress, { value: eth("0.02") });
      await expect(s.router.connect(s.stranger).pullMany([s.creator.address]))
        .to.emit(s.router, "TabOpened")
        .withArgs(s.creator.address, s.tabAddress);
      expect(await s.tab.creator()).to.equal(s.creator.address);
      expect(await s.tab.available()).to.equal(eth("0.02"));
      expect(await s.tab.totalPulled()).to.equal(eth("0.02"));
    });

    it("opening twice is a no-op and the tab cannot be re-initialized", async () => {
      const s = await setup();
      await s.router.openTab(s.creator.address);
      await s.router.openTab(s.creator.address);
      expect(await s.router.creatorCount()).to.equal(1n);
      await expect(s.tab.connect(s.stranger).initialize(s.stranger.address)).to.be.revertedWithCustomError(
        s.tab,
        "AlreadyInitialized",
      );
    });

    it("gives each creator a different tab", async () => {
      const s = await setup();
      expect(await s.router.predictTab(s.stranger.address)).to.not.equal(s.tabAddress);
    });
  });

  describe("balance", () => {
    it("pull with nothing in escrow does nothing", async () => {
      const s = await setup();
      await s.router.openTab(s.creator.address);
      await expect(s.tab.pull()).to.not.emit(s.tab, "Pulled");
    });

    it("only the creator withdraws, and only what is not locked", async () => {
      const s = await funded();
      await redeem(s, await quote(s, { weiAmount: eth("0.03") }));
      await expect(s.tab.connect(s.stranger).withdraw(s.stranger.address, 1)).to.be.revertedWithCustomError(
        s.tab,
        "NotCreator",
      );
      await expect(s.tab.connect(s.creator).withdraw(s.creator.address, eth("0.03"))).to.be.revertedWithCustomError(
        s.tab,
        "InsufficientBalance",
      );
      await expect(s.tab.connect(s.creator).withdraw(s.stranger.address, eth("0.02"))).to.changeEtherBalance(
        s.stranger,
        eth("0.02"),
      );
    });

    it("the creator can point a coin's fees away from the tab", async () => {
      const s = await funded();
      const token = ethers.Wallet.createRandom().address;
      await s.tab.connect(s.creator).redirectFees(token, s.creator.address);
      expect(await s.pons.pendingOf(token)).to.equal(s.creator.address);
      await s.tab.connect(s.creator).executeRedirect(token);
      expect(await s.pons.recipientOf(token)).to.equal(s.creator.address);
      await expect(s.tab.connect(s.stranger).redirectFees(token, s.stranger.address)).to.be.revertedWithCustomError(
        s.tab,
        "NotCreator",
      );
    });
  });

  describe("one-off gift card", () => {
    it("locks the quoted wei, then pays the treasury on delivery", async () => {
      const s = await funded();
      const q = await quote(s);
      await expect(redeem(s, q)).to.emit(s.tab, "Ordered").withArgs(0, NETFLIX, 2500, eth("0.01"), false);
      expect(await s.tab.locked()).to.equal(eth("0.01"));
      expect(await s.tab.available()).to.equal(eth("0.04"));

      const receipt = ethers.id("card-1");
      await expect(s.tab.connect(s.fulfiller).fulfill(0, receipt)).to.changeEtherBalance(s.treasury, eth("0.01"));
      expect(await s.tab.locked()).to.equal(0n);
      expect((await s.tab.orders(0)).status).to.equal(2n);
      expect(await s.tab.sealedCard(0)).to.equal(receipt);
      await expect(s.tab.connect(s.fulfiller).fulfill(0, receipt)).to.be.revertedWithCustomError(s.tab, "OrderNotOpen");
    });

    it("rejects a quote signed by anyone but the fulfiller", async () => {
      const s = await funded();
      await expect(redeem(s, await quote(s, { signer: s.creator }))).to.be.revertedWithCustomError(
        s.tab,
        "BadQuoteSignature",
      );
    });

    it("rejects a tampered, expired or replayed quote", async () => {
      const s = await funded();
      const q = await quote(s);
      await expect(
        s.tab.connect(s.creator).redeem(q.sku, q.usdCents, eth("0.001"), q.expiry, q.nonce, q.signature),
      ).to.be.revertedWithCustomError(s.tab, "BadQuoteSignature");
      await redeem(s, q);
      await expect(redeem(s, q)).to.be.revertedWithCustomError(s.tab, "QuoteReused");
      const old = await quote(s, { nonce: 2 });
      await time.increase(301);
      await expect(redeem(s, old)).to.be.revertedWithCustomError(s.tab, "QuoteExpired");
    });

    it("a quote for one tab does not work on another", async () => {
      const s = await funded();
      const q = await quote(s);
      await s.router.openTab(s.stranger.address);
      const other = await ethers.getContractAt("Tab", await s.router.predictTab(s.stranger.address));
      await s.owner.sendTransaction({ to: await other.getAddress(), value: eth("0.05") });
      await expect(
        other.connect(s.stranger).redeem(q.sku, q.usdCents, q.weiAmount, q.expiry, q.nonce, q.signature),
      ).to.be.revertedWithCustomError(other, "BadQuoteSignature");
    });

    it("only the creator redeems, and not beyond the balance", async () => {
      const s = await funded();
      await expect(redeem(s, await quote(s), s.stranger)).to.be.revertedWithCustomError(s.tab, "NotCreator");
      await expect(redeem(s, await quote(s, { weiAmount: eth("0.06") }))).to.be.revertedWithCustomError(
        s.tab,
        "InsufficientBalance",
      );
    });

    it("an undelivered order is refundable by the creator after 48h only", async () => {
      const s = await funded();
      await redeem(s, await quote(s));
      await expect(s.tab.connect(s.creator).refund(0)).to.be.revertedWithCustomError(s.tab, "RefundTooEarly");
      await expect(s.tab.connect(s.stranger).refund(0)).to.be.revertedWithCustomError(s.tab, "NotCreator");
      await time.increase(48 * 3600);
      await expect(s.tab.connect(s.creator).refund(0)).to.emit(s.tab, "Refunded").withArgs(0);
      expect(await s.tab.available()).to.equal(eth("0.05"));
      await expect(s.tab.connect(s.fulfiller).fulfill(0, ethers.ZeroHash)).to.be.revertedWithCustomError(
        s.tab,
        "OrderNotOpen",
      );
    });

    it("the fulfiller can refund straight away (card out of stock)", async () => {
      const s = await funded();
      await redeem(s, await quote(s));
      await s.tab.connect(s.fulfiller).refund(0);
      expect(await s.tab.locked()).to.equal(0n);
    });

    it("a treasury that rejects ETH leaves the order open and refundable", async () => {
      const s = await funded();
      const bad = await (await ethers.getContractFactory("RejectingTreasury")).deploy();
      await s.router.setTreasury(await bad.getAddress());
      await redeem(s, await quote(s));
      await expect(s.tab.connect(s.fulfiller).fulfill(0, ethers.ZeroHash)).to.be.revertedWithCustomError(
        s.tab,
        "TransferFailed",
      );
      expect((await s.tab.orders(0)).status).to.equal(1n);
    });
  });

  describe("plans", () => {
    it("charges once per period, inside the creator's wei cap", async () => {
      const s = await funded();
      await s.tab.connect(s.creator).setPlan(NETFLIX, 2500, 30, eth("0.02"));
      expect(await s.tab.planSkus()).to.deep.equal([NETFLIX]);

      await expect(s.tab.connect(s.stranger).charge(NETFLIX, eth("0.01"))).to.be.revertedWithCustomError(
        s.tab,
        "NotFulfiller",
      );
      await expect(s.tab.connect(s.fulfiller).charge(NETFLIX, eth("0.021"))).to.be.revertedWithCustomError(
        s.tab,
        "AboveMaxWei",
      );
      await expect(s.tab.connect(s.fulfiller).charge(NETFLIX, eth("0.01")))
        .to.emit(s.tab, "Ordered")
        .withArgs(0, NETFLIX, 2500, eth("0.01"), true);
      await expect(s.tab.connect(s.fulfiller).charge(NETFLIX, eth("0.01"))).to.be.revertedWithCustomError(
        s.tab,
        "PlanNotDue",
      );
      await time.increase(30 * 86400);
      await s.tab.connect(s.fulfiller).charge(NETFLIX, eth("0.01"));
      expect(await s.tab.orderCount()).to.equal(2n);
    });

    it("a charge pulls the escrow first", async () => {
      const s = await setup();
      await s.router.openTab(s.creator.address);
      await s.tab.connect(s.creator).setPlan(NETFLIX, 2500, 30, eth("0.02"));
      await s.escrow.credit(s.tabAddress, { value: eth("0.01") });
      await s.tab.connect(s.fulfiller).charge(NETFLIX, eth("0.01"));
      expect(await s.tab.locked()).to.equal(eth("0.01"));
    });

    it("a cancelled plan cannot be charged, and editing keeps the due date", async () => {
      const s = await funded();
      await s.tab.connect(s.creator).setPlan(NETFLIX, 2500, 30, eth("0.02"));
      await s.tab.connect(s.fulfiller).charge(NETFLIX, eth("0.01"));
      const due = (await s.tab.plans(NETFLIX)).nextDue;
      await s.tab.connect(s.creator).setPlan(NETFLIX, 5000, 30, eth("0.04"));
      expect((await s.tab.plans(NETFLIX)).nextDue).to.equal(due);
      expect(await s.tab.planSkus()).to.deep.equal([NETFLIX]);
      await s.tab.connect(s.creator).cancelPlan(NETFLIX);
      await time.increase(30 * 86400);
      await expect(s.tab.connect(s.fulfiller).charge(NETFLIX, eth("0.01"))).to.be.revertedWithCustomError(
        s.tab,
        "PlanInactive",
      );
    });

    it("a one-off plan is bought once, then switches itself off", async () => {
      const s = await funded();
      await s.tab.connect(s.creator).setPlan(NETFLIX, 2500, 0, eth("0.02"));
      await s.tab.connect(s.fulfiller).charge(NETFLIX, eth("0.01"));
      expect((await s.tab.plans(NETFLIX)).active).to.equal(false);
      await expect(s.tab.connect(s.fulfiller).charge(NETFLIX, eth("0.01"))).to.be.revertedWithCustomError(
        s.tab,
        "PlanInactive",
      );
    });

    it("setup opens the caller's tab and sets its plans in one transaction", async () => {
      const s = await setup();
      const SPOTIFY = sku("spotify-10");
      await s.router.connect(s.creator).setup([NETFLIX, SPOTIFY], [2500, 1000], [30, 0], [eth("0.02"), eth("0.01")], "0xc0ffee");
      expect(await s.tab.contact()).to.equal("0xc0ffee");
      expect(await s.tab.creator()).to.equal(s.creator.address);
      expect(await s.tab.planSkus()).to.deep.equal([NETFLIX, SPOTIFY]);
      expect((await s.tab.plans(SPOTIFY)).periodDays).to.equal(0n);
      // Nobody can set plans on someone else's tab, through the router or directly.
      await s.router.connect(s.stranger).setup([NETFLIX], [9900], [30], [eth("1")], "0x");
      expect((await s.tab.plans(NETFLIX)).usdCents).to.equal(2500n);
      await expect(
        s.tab.connect(s.stranger).setPlans([NETFLIX], [9900], [30], [eth("1")]),
      ).to.be.revertedWithCustomError(s.tab, "NotCreator");
      await expect(s.tab.connect(s.creator).setPlans([NETFLIX], [2500, 1], [30], [eth("1")])).to.be.revertedWithCustomError(
        s.tab,
        "BadPlan",
      );
    });

    it("only the creator sets the delivery contact, and it is bounded", async () => {
      const s = await funded();
      await s.tab.connect(s.creator).setContact("0x1234");
      expect(await s.tab.contact()).to.equal("0x1234");
      await expect(s.tab.connect(s.stranger).setContact("0x00")).to.be.revertedWithCustomError(s.tab, "NotCreator");
      await expect(s.tab.connect(s.creator).setContact("0x" + "00".repeat(513))).to.be.revertedWithCustomError(s.tab, "TooLong");
    });

    it("only the creator sets or cancels a plan", async () => {
      const s = await funded();
      await expect(s.tab.connect(s.fulfiller).setPlan(NETFLIX, 2500, 30, eth("1"))).to.be.revertedWithCustomError(
        s.tab,
        "NotCreator",
      );
      await expect(s.tab.connect(s.creator).setPlan(NETFLIX, 0, 30, eth("1"))).to.be.revertedWithCustomError(
        s.tab,
        "BadPlan",
      );
    });
  });

  describe("router admin", () => {
    it("only the owner changes fulfiller and treasury", async () => {
      const s = await setup();
      await expect(s.router.connect(s.stranger).setFulfiller(s.stranger.address)).to.be.revertedWithCustomError(
        s.router,
        "OwnableUnauthorizedAccount",
      );
      await s.router.setFulfiller(s.stranger.address);
      expect(await s.router.fulfiller()).to.equal(s.stranger.address);
    });
  });
});
