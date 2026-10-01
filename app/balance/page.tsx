import { BalanceView } from "@/components/BalanceView";

export const metadata = { title: "My balance · Covered" };

export default function BalancePage() {
  return (
    <div className="wrap pt-12">
      <h1 className="text-[40px] md:text-[56px] mb-8">My balance</h1>
      <BalanceView />
    </div>
  );
}
