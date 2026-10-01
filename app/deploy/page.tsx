import { DeployForm } from "@/components/DeployForm";

export const metadata = { title: "Contracts · Covered" };

export default function DeployPage() {
  return (
    <div className="wrap pt-12">
      <h1 className="text-[40px] md:text-[56px]">Contracts</h1>
      <p className="text-mute text-[17px] mt-4 mb-8 max-w-[620px]">
        Covered runs on one contract on Robinhood Chain. Its address is fixed in advance, so it can be checked before it exists.
      </p>
      <DeployForm />
    </div>
  );
}
