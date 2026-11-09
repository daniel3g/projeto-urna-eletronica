import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { ELECTION_STATUS_LABEL } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";

import { deletePosition, movePosition } from "./actions";
import { PositionForm } from "./position-form";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
};

export default async function PositionsPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { erro } = await searchParams;

  const db = createServiceClient();

  const { data: election } = await db
    .from("elections")
    .select("id, name, status")
    .eq("id", id)
    .maybeSingle();

  if (!election) notFound();

  const { data: positions } = await db
    .from("positions")
    .select("id, name, digits, display_order")
    .eq("election_id", id)
    .order("display_order");

  const isDraft = election.status === "draft";
  const list = positions ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/elections/${id}`}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← {election.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Cargos</h1>
        <p className="mt-1 text-sm opacity-70">
          A ordem definida aqui é a sequência em que a urna apresentará os cargos
          ao eleitor.
        </p>
      </div>

      {erro ? (
        <p
          role="alert"
          className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {erro}
        </p>
      ) : null}

      {!isDraft ? (
        <p className="rounded-md bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Esta eleição está em <strong>{ELECTION_STATUS_LABEL[election.status]}</strong>.
          Os cargos estão congelados — o próprio banco recusa alterações.
        </p>
      ) : null}

      {list.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {list.map((position, index) => (
            <li
              key={position.id}
              className="flex items-center gap-3 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
            >
              <span className="w-6 text-sm opacity-50">{index + 1}</span>

              <div className="flex-1">
                <p className="font-medium">{position.name}</p>
                <p className="text-xs opacity-60">
                  {position.digits} {position.digits === 1 ? "dígito" : "dígitos"}
                </p>
              </div>

              {isDraft ? (
                <div className="flex items-center gap-1">
                  <MoveButton
                    electionId={id}
                    positionId={position.id}
                    direction="up"
                    disabled={index === 0}
                    label="Subir"
                  >
                    ↑
                  </MoveButton>
                  <MoveButton
                    electionId={id}
                    positionId={position.id}
                    direction="down"
                    disabled={index === list.length - 1}
                    label="Descer"
                  >
                    ↓
                  </MoveButton>
                  <form action={deletePosition}>
                    <input type="hidden" name="electionId" value={id} />
                    <input type="hidden" name="positionId" value={position.id} />
                    <button
                      type="submit"
                      aria-label={`Remover ${position.name}`}
                      className="rounded-md border border-black/15 px-2 py-1 text-sm hover:bg-red-500/10 hover:text-red-700 dark:border-white/20 dark:hover:text-red-400"
                    >
                      Remover
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-lg border border-dashed border-black/15 p-8 text-center dark:border-white/20">
          <p className="font-medium">Nenhum cargo cadastrado.</p>
          <p className="mt-1 text-sm opacity-70">
            A eleição não pode ser aberta sem ao menos um cargo.
          </p>
        </div>
      )}

      {isDraft ? <PositionForm electionId={id} /> : null}
    </div>
  );
}

function MoveButton({
  electionId,
  positionId,
  direction,
  disabled,
  label,
  children,
}: {
  electionId: string;
  positionId: string;
  direction: "up" | "down";
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form action={movePosition}>
      <input type="hidden" name="electionId" value={electionId} />
      <input type="hidden" name="positionId" value={positionId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        className="rounded-md border border-black/15 px-2 py-1 text-sm hover:bg-black/5 disabled:opacity-30 dark:border-white/20 dark:hover:bg-white/10"
      >
        {children}
      </button>
    </form>
  );
}
