import { AdminView } from "@/components/AdminView";

export const metadata = { title: "Admin · Covered", robots: { index: false } };

export default function AdminPage() {
  return (
    <div className="wrap pt-12">
      <h1 className="text-[40px] md:text-[56px] mb-8">Admin</h1>
      <AdminView />
    </div>
  );
}
