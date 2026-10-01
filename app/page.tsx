import Link from "next/link";
import { Progress } from "@/components/BalanceView";
import { Calculator } from "@/components/Calculator";
import { BrandMark, GiftCard } from "@/components/GiftCard";
import { HeroCards } from "@/components/HeroCards";
import { brandById, CATALOG } from "@/lib/catalog";
import { PONS, REFUND_DELAY_HOURS, SERVICE_FEE_BPS } from "@/lib/config";

const STEPS = [
  {
    title: "Launch",
    lead: "Create your coin.",
    body: "One transaction on pons, on Robinhood Chain. Pick what it should pay for: its creator fees are pointed at your balance from the first trade.",
    icon: "M12 19V5M5 12l7-7 7 7",
  },
  {
    title: "Collect",
    lead: "Track the creator fees it generates.",
    body: "When people trade your coin, a share of the trading fee is yours. It adds up in a balance only your wallet controls.",
    icon: "M4 17l5-5 4 4 7-8M15 8h5v5",
  },
  {
    title: "Redeem",
    lead: "Use your available balance for gift cards.",
    body: "Cards on your list are bought by themselves when the balance covers them. You can also buy one by hand, or withdraw the balance as ETH.",
    icon: "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 11h18",
  },
];

const JOURNEY = [
  ["Someone trades your coin", "pons takes 1% of the trade. Part of it is your creator fee."],
  ["The fee reaches your balance", "It is collected on chain into a balance only your wallet commands."],
  ["The card is bought for you", "The moment the balance covers a card on your list. No click, no gas for you."],
  ["The code arrives", "In your account, readable only by your wallet, and in your inbox if you gave an e-mail."],
];

const COMPARE = [
  ["Who pays for it", "You, out of your own pocket.", "The people trading your coin, through its creator fees."],
  ["Turning fees into a card", "Claim them on pons, move the ETH, sell it on an exchange, then go and buy the card.", "Nothing to do. Fees are collected, priced and spent for you."],
  ["Next month", "Do all of it again.", "Bought again by itself, as soon as the balance covers it."],
  ["What your community sees", "Nothing.", "A public page showing what the coin pays for, and every card it has paid."],
  ["If you want the money instead", "It is your money either way.", "Withdraw the balance as ETH whenever you like."],
];

const FAQ = [
  {
    q: "Why not just buy a gift card myself?",
    a: "You can, with your own money. Covered is for the money you did not have to spend: the creator fees your coin earns when people trade it. They turn into the cards you would otherwise pay for, without you claiming, selling or buying anything.",
  },
  {
    q: "Where does the money come from?",
    a: `pons charges 1% on every trade of a coin and pays ${PONS.creatorShareOfFee * 100}% of that to the coin's creator, plus any creator tax set at launch. Covered points those creator fees at your balance. No trades, no fees: a coin nobody trades earns nothing.`,
  },
  {
    q: "How do I receive a card?",
    a: "Its code appears in your account under My cards. You read it by signing with your wallet, so nobody else can. If you gave an e-mail, the card is sent there too.",
  },
  {
    q: "What does Covered charge?",
    a: `Nothing on your fees. A card costs its face value plus ${SERVICE_FEE_BPS / 100}%, shown in full before anything is bought.`,
  },
  {
    q: "What if a card never arrives?",
    a: `Its price stays locked in your own balance until the card is delivered. If it cannot be delivered the order is refunded, and you can refund it yourself after ${REFUND_DELAY_HOURS} hours.`,
  },
  {
    q: "Are these brands partners of Covered?",
    a: "No. The cards are ordinary retail gift cards bought from a gift card supplier. Covered is not affiliated with any of the brands, and availability depends on the supplier and on your country.",
  },
];

const netflix = brandById("netflix")!;
const spotify = brandById("spotify")!;

const chip = (bg: string) => ({ background: bg, boxShadow: "0 0 0 1px #17191714" });

export default function Home() {
  return (
    <>
      <section className="wrap grid lg:grid-cols-[1.15fr_1fr] items-center gap-12 pt-14 md:pt-24 pb-8">
        <div>
          <h1 className="text-[44px] sm:text-[60px] lg:text-[80px]">
            Your coin. Your fees.
            <br />
            <span className="text-accent">Your everyday.</span>
          </h1>
          <p className="text-mute text-[17px] md:text-[18px] leading-relaxed mt-7 max-w-[500px]">
            Launch a coin, collect creator fees, and put your available balance toward gift cards. They are bought for you and delivered by
            themselves.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-9">
            <Link href="/launch" className="btn btn-primary">
              Launch a coin
            </Link>
            <a href="#how" className="font-bold underline underline-offset-4 decoration-line hover:decoration-ink min-h-12 inline-flex items-center">
              How it works
            </a>
          </div>
        </div>
        <HeroCards />
      </section>

      <section id="how" className="wrap pt-20 scroll-mt-24">
        <h2 className="text-[32px] md:text-[44px]">How it works</h2>
        <ol className="grid md:grid-cols-3 gap-5 mt-9">
          {STEPS.map((s, i) => (
            <li key={s.title} className="panel p-7">
              <div className="flex items-center justify-between">
                <span className="grid place-items-center size-11 rounded-[13px] bg-accent-soft">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={s.icon} />
                  </svg>
                </span>
                <span className="num text-mute text-[14px] font-bold">Step {i + 1}</span>
              </div>
              <h3 className="text-[24px] mt-6">{s.title}</h3>
              <p className="font-bold mt-2">{s.lead}</p>
              <p className="text-mute leading-relaxed mt-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap pt-24">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-10 lg:gap-16 items-center">
          <div>
            <h2 className="text-[32px] md:text-[44px]">You do nothing. The card still shows up.</h2>
            <ol className="mt-9 grid gap-0">
              {JOURNEY.map(([title, body], i) => (
                <li key={title} className="grid grid-cols-[40px_1fr] gap-4">
                  <div className="flex flex-col items-center">
                    <span className="num grid place-items-center size-10 rounded-[12px] bg-ink text-card font-bold shrink-0">{i + 1}</span>
                    {i < JOURNEY.length - 1 && <span className="w-px flex-1 bg-line my-1.5" />}
                  </div>
                  <div className="pb-7">
                    <h3 className="text-[19px] leading-10">{title}</h3>
                    <p className="text-mute leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* What arriving looks like: the balance crossing a card's price, then the card. */}
          <div className="grid gap-4" aria-label="An illustration of a card being delivered">
            <div className="panel p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2.5 font-bold">
                  <span className="grid place-items-center size-9 rounded-[10px]" style={chip(netflix.bg)}>
                    <BrandMark brand={netflix} size={18} />
                  </span>
                  Netflix <span className="num">$25</span>
                  <span className="text-mute font-semibold text-[13px]">every 30 days</span>
                </p>
                <span className="tag bg-accent-soft">Next up</span>
              </div>
              <div className="mt-4">
                <Progress have={25.75} need={25.75} />
              </div>
            </div>
            <div className="flex justify-center text-mute" aria-hidden>
              <svg width="20" height="28" viewBox="0 0 20 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2v22M3 17l7 7 7-7" />
              </svg>
            </div>
            <div className="panel p-6 shadow-[0_24px_40px_-28px_rgb(23_25_23/0.45)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-mute text-[13.5px] font-semibold">To you · from Covered</p>
                <span className="tag bg-sage-soft">Delivered</span>
              </div>
              <p className="font-extrabold text-[22px] tracking-tight mt-3">Your Netflix card is here</p>
              <p className="text-mute text-[14.5px] mt-1">Paid from your coin&apos;s creator fees. Nothing left your pocket.</p>
              <div className="grid sm:grid-cols-[150px_1fr] gap-5 items-center mt-5">
                <GiftCard brand={netflix} amount={25} />
                <div>
                  <p className="text-mute text-[13px] font-semibold">Card code</p>
                  <p className="num font-extrabold text-[20px] tracking-[0.12em] mt-1">•••• •••• ••••</p>
                  <p className="text-mute text-[13px] mt-2">Shown once you sign with your wallet.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap pt-24">
        <h2 className="text-[32px] md:text-[44px] max-w-[760px]">Why not just buy the card yourself?</h2>
        <p className="text-mute text-[17px] leading-relaxed mt-4 max-w-[640px]">
          You can. The difference is who pays, and how much of it you have to do by hand.
        </p>
        <div className="panel mt-9 overflow-hidden">
          <div className="hidden md:grid grid-cols-[0.8fr_1fr_1fr] text-[14px] font-bold border-b border-line">
            <span className="p-5" />
            <span className="p-5 text-mute">Buying it yourself</span>
            <span className="p-5 bg-accent-soft">With Covered</span>
          </div>
          {COMPARE.map(([topic, self, covered], i) => (
            <div key={topic} className={`grid md:grid-cols-[0.8fr_1fr_1fr] ${i ? "border-t border-line" : ""}`}>
              <p className="px-5 pt-5 md:py-5 font-bold">{topic}</p>
              <p className="px-5 pt-2 md:py-5 text-mute leading-relaxed">
                <span className="md:hidden font-bold text-ink">Yourself: </span>
                {self}
              </p>
              <p className="px-5 py-3 md:py-5 mt-3 md:mt-0 bg-accent-soft leading-relaxed font-semibold">
                <span className="md:hidden font-extrabold">With Covered: </span>
                {covered}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap pt-24">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
          <div className="panel p-6 md:p-7 order-last lg:order-first" aria-label="An illustration of a coin's public page">
            <div className="flex items-center gap-4">
              <span className="grid place-items-center size-14 rounded-[14px] bg-sage font-extrabold text-[18px]">MN</span>
              <div>
                <p className="font-extrabold text-[22px] tracking-tight">
                  Movie Night <span className="text-mute">$MOVIE</span>
                </p>
                <p className="text-mute text-[14px]">What this coin pays for</p>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-line">
              <li className="py-4 grid sm:grid-cols-2 gap-3 items-center">
                <p className="flex items-center gap-2.5 font-bold">
                  <span className="grid place-items-center size-9 rounded-[10px]" style={chip(netflix.bg)}>
                    <BrandMark brand={netflix} size={18} />
                  </span>
                  Netflix <span className="num">$25</span>
                </p>
                <Progress have={18.4} need={25.75} />
              </li>
              <li className="py-4 grid sm:grid-cols-2 gap-3 items-center">
                <p className="flex items-center gap-2.5 font-bold">
                  <span className="grid place-items-center size-9 rounded-[10px]" style={chip(spotify.bg)}>
                    <BrandMark brand={spotify} size={18} />
                  </span>
                  Spotify <span className="num">$30</span>
                </p>
                <p className="text-mute text-[14px]">Paid for this period.</p>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-[32px] md:text-[44px]">A reason to trade your coin</h2>
            <p className="text-mute text-[17px] leading-relaxed mt-5 max-w-[520px]">
              Every coin gets a public page that shows what it pays for and how close the next card is. It is read straight from the chain, so
              nobody has to take your word for it.
            </p>
            <p className="text-mute text-[17px] leading-relaxed mt-4 max-w-[520px]">
              Share the link when you launch. People who trade the coin can watch it pay for your Netflix.
            </p>
          </div>
        </div>
      </section>

      <section id="cards" className="wrap pt-24 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-[32px] md:text-[44px]">Gift cards</h2>
          <p className="text-mute max-w-[440px]">
            Sold at face value plus {SERVICE_FEE_BPS / 100}%. Availability depends on the supplier and on your country.
          </p>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 mt-9">
          {CATALOG.map((b) => (
            <li key={b.id}>
              <GiftCard className="lift" brand={b} note={`$${b.amounts[0]} to $${b.amounts[b.amounts.length - 1]}`} />
              <p className="text-mute text-[13.5px] mt-2.5 px-1">{b.covers}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap pt-24">
        <div className="panel p-7 md:p-12">
          <Calculator />
        </div>
      </section>

      <section className="wrap pt-24">
        <h2 className="text-[32px] md:text-[44px] max-w-[640px]">Your balance stays yours</h2>
        <div className="grid md:grid-cols-3 gap-5 mt-9">
          {[
            ["Withdraw any time", "Your balance is ETH held by a contract only your wallet commands. Take it out whenever you like."],
            ["No card, no charge", `A card's price stays locked in your balance until it is delivered. Undelivered after ${REFUND_DELAY_HOURS} hours: refund it yourself.`],
            ["A limit on every card", "Auto-pay can never take more than the ceiling you approved for a card, whatever the ETH price does."],
          ].map(([t, b]) => (
            <div key={t} className="rounded-[22px] bg-sage-soft p-7">
              <h3 className="text-[22px]">{t}</h3>
              <p className="text-ink/75 leading-relaxed mt-3">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap pt-24 grid lg:grid-cols-[0.8fr_1.2fr] gap-10">
        <h2 className="text-[32px] md:text-[44px]">Questions</h2>
        <div className="grid gap-3">
          {FAQ.map((f) => (
            <details key={f.q} className="panel px-6 group">
              <summary className="flex items-center justify-between gap-4 min-h-16 cursor-pointer list-none font-bold text-[17px]">
                {f.q}
                <span className="text-mute text-2xl leading-none transition-transform duration-200 group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="text-mute leading-relaxed pb-6 max-w-[620px]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="wrap pt-24">
        <div className="rounded-[22px] bg-ink text-card px-7 py-14 md:py-20 text-center">
          <h2 className="text-[32px] md:text-[52px] max-w-[720px] mx-auto">Let your coin pick up the bill.</h2>
          <Link href="/launch" className="btn btn-primary mt-9">
            Launch a coin
          </Link>
        </div>
      </section>
    </>
  );
}
