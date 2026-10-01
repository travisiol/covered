import { CoinView } from "@/components/CoinView";

export const metadata = { title: "What this coin pays for · Covered" };

export default async function CoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="wrap pt-12">
      <CoinView token={token} />
    </div>
  );
}
