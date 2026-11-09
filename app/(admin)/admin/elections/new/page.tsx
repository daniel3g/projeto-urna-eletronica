import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";

import { ElectionForm } from "./election-form";

export const metadata = { title: "Nova eleição — Urna Eletrônica Escolar" };

export default async function NewElectionPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm opacity-60 hover:opacity-100">
          ← Eleições
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Nova eleição</h1>
      </div>

      <ElectionForm />
    </div>
  );
}
