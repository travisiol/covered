import Link from "next/link";
import { PLAN_MAX_WEI_MULTIPLE, PLAN_PERIOD_DAYS, PONS, QUOTE_TTL_SECONDS, REFUND_DELAY_HOURS, ROUTER_ADDRESS, SERVICE_FEE_BPS, explorerAddress } from "@/lib/config";

export const metadata = { title: "How it works · Covered" };

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "overview",
    title: "Overview",
    body: (
      <>
        <p>
          Covered turns the creator fees of a coin into gift cards for the subscriptions its creator already pays. You launch a coin on pons, on
          Robinhood Chain, with its creator fees pointed at your Covered balance. Trades fill the balance; the balance buys cards.
        </p>
        <p>
          Your balance is a small contract, called a tab, that only your wallet commands. There is one per wallet, and every coin you launch fills
          the same one.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    title: "Where the fees come from",
    body: (
      <>
        <p>
          pons charges 1% on every trade, on the bonding curve and after the coin graduates. {PONS.creatorShareOfFee * 100}% of that is the creator
          fee. If you set a creator tax at launch (up to {PONS.maxCreatorTaxBps / 100}%), it is added on top and is yours in full.
        </p>
        <p>
          Fees do not arrive trade by trade. They build up on the coin, pons sweeps them to its fee escrow, and your tab collects them from there.
          Collection happens by itself whenever you buy a card, and anyone can trigger it: it can only move money into your tab.
        </p>
      </>
    ),
  },
  {
    id: "buying",
    title: "Buying a card",
    body: (
      <>
        <p>
          Pick a card and a value. You are shown a price in ETH, valid for {QUOTE_TTL_SECONDS / 60} minutes: the card&apos;s face value plus a{" "}
          {SERVICE_FEE_BPS / 100}% service fee, at the current ETH price. That fee is the only thing Covered charges. It pays the gift card supplier
          and the gas spent delivering your card.
        </p>
        <p>
          When you confirm, the price is locked inside your own tab. It is released only once the card has been bought and its code stored for you.
          If the supplier cannot deliver, the order is refunded at once. If nothing happens for {REFUND_DELAY_HOURS} hours, you can refund it
          yourself, on chain, without asking anyone.
        </p>
        <p>
          A card&apos;s code appears in your account under My cards. To read it you sign a message with your wallet, so only the wallet that owns
          the balance can. If you saved an e-mail, the supplier also sends the card to that inbox.
        </p>
      </>
    ),
  },
  {
    id: "plans",
    title: "Auto-pay",
    body: (
      <>
        <p>
          Put a card on your auto-pay list and it is bought by itself as soon as your balance covers it: once, or again every {PLAN_PERIOD_DAYS}{" "}
          days. You approve it one time, with a ceiling per card set to {PLAN_MAX_WEI_MULTIPLE}× the price on the day you add it, so auto-pay can
          never take more than that whatever the ETH price does. You can set the list while launching, in the same flow.
        </p>
        <p>
          If your balance is short, nothing is bought and nothing is owed: the card waits until the fees catch up. Remove a card from the list
          at any time on your balance page. Each coin also has a public page showing its list and every card it has paid.
        </p>
      </>
    ),
  },
  {
    id: "yours",
    title: "What stays in your hands",
    body: (
      <>
        <p>
          <strong>Withdrawing.</strong> The balance is ETH. You can withdraw any part that is not locked in an open order, at any time.
        </p>
        <p>
          <strong>Leaving.</strong> Your tab is the fee recipient of your coins, and it lets you, and only you, point a coin&apos;s fees somewhere
          else. pons makes every such change wait {PONS.redirectTimelockDays} days before it takes effect.
        </p>
        <p>
          <strong>What you trust us for.</strong> Two things: that the ETH price in a quote is fair (you see it before confirming, and plans are
          capped), and that a card marked delivered really was. Both are limited to the price of one card at a time.
        </p>
      </>
    ),
  },
  {
    id: "existing",
    title: "Coins you already launched",
    body: (
      <p>
        If you are the fee recipient of a coin on pons, you can move its fees to your tab by calling <code>transferCreatorFeeRecipient</code> on the
        pons factory with your tab address, then executing the change after pons&apos; {PONS.redirectTimelockDays}-day delay. Your tab address is
        shown on your balance page.
      </p>
    ),
  },
  {
    id: "risks",
    title: "Risks",
    body: (
      <>
        <p>
          A coin can earn nothing. Fees exist only when people trade, and most coins stop trading. Do not launch a coin expecting it to pay your
          bills; treat what it earns as a bonus.
        </p>
        <p>
          Gift cards depend on a supplier and on your country. A card for the wrong region may not redeem, and a delivered code cannot be returned.
          The contracts have not been audited.
        </p>
      </>
    ),
  },
];

export default function DocsPage() {
  return (
    <div className="wrap pt-12 grid lg:grid-cols-[220px_1fr] gap-10">
      <nav className="hidden lg:block sticky top-28 self-start text-[14.5px]">
        <ul className="grid gap-2.5">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-mute hover:text-ink">
                {s.title}
              </a>
            </li>
          ))}
          <li>
            <a href="#contracts" className="text-mute hover:text-ink">
              Contracts
            </a>
          </li>
        </ul>
      </nav>
      <div className="max-w-[720px]">
        <h1 className="text-[40px] md:text-[56px]">How it works</h1>
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-28 mt-14">
            <h2 className="text-[30px] font-bold">{s.title}</h2>
            <div className="mt-4 grid gap-4 text-[16.5px] leading-relaxed text-ink/80 [&_code]:font-mono [&_code]:text-[14px] [&_code]:bg-card [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_strong]:text-ink">
              {s.body}
            </div>
          </section>
        ))}
        <section id="contracts" className="scroll-mt-28 mt-14">
          <h2 className="text-[30px] font-bold">Contracts</h2>
          <dl className="panel mt-5 divide-y divide-line text-[14.5px]">
            {[
              ["Covered router", ROUTER_ADDRESS],
              ["pons factory", PONS.factory],
              ["pons launch forwarder", PONS.forwarder],
              ["pons fee escrow", PONS.escrow],
            ].map(([label, address]) => (
              <div key={label} className="flex flex-wrap justify-between gap-2 px-5 py-4">
                <dt className="text-mute">{label}</dt>
                <dd className="num break-all">
                  {address ? (
                    <a className="hover:underline" href={explorerAddress(address)} target="_blank" rel="noreferrer">
                      {address}
                    </a>
                  ) : (
                    <Link href="/deploy" className="underline">
                      not deployed yet
                    </Link>
                  )}
                </dd>
              </div>
            ))}
            <div className="flex justify-between px-5 py-4">
              <dt className="text-mute">Chain</dt>
              <dd>Robinhood Chain, id 4663</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
