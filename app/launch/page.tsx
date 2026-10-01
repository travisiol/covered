import { LaunchForm } from "@/components/LaunchForm";

export const metadata = { title: "Launch a coin · Covered" };

export default function LaunchPage() {
  return (
    <div className="wrap pt-12">
      <h1 className="text-[40px] md:text-[56px]">Launch a coin</h1>
      <p className="text-mute text-[17px] mt-4 mb-8 max-w-[560px]">
        Launch on pons, say what it should pay for, and its creator fees go to your balance from the first trade.
      </p>
      <LaunchForm />
    </div>
  );
}
