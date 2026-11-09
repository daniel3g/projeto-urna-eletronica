"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { createCandidate, type FormState } from "./actions";

const initialState: FormState = { error: null };

export type PositionOption = {
  id: string;
  name: string;
  digits: number;
};

const field =
  "rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20";

export function CandidateForm({
  electionId,
  positions,
}: {
  electionId: string;
  positions: PositionOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createCandidate,
    initialState,
  );
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  const selected = positions.find((p) => p.id === positionId);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
      setPositionId((current) => current || positions[0]?.id || "");
    }
  }, [pending, state, positions]);

  if (positions.length === 0) return null;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <input type="hidden" name="electionId" value={electionId} />

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Cargo</span>
          <select
            name="positionId"
            value={positionId}
            onChange={(event) => setPositionId(event.target.value)}
            className={field}
          >
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex w-32 flex-col gap-1.5">
          <span className="text-sm font-medium">Número</span>
          <input
            name="number"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={selected?.digits ?? 5}
            required
            placeholder={"0".repeat(selected?.digits ?? 2)}
            className={`${field} font-mono`}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Nome completo</span>
          <input name="fullName" required placeholder="João Silva" className={field} />
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">
            Nome de urna{" "}
            <span className="font-normal opacity-60">(opcional)</span>
          </span>
          <input name="ballotName" placeholder="João" className={field} />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">
            Chapa <span className="font-normal opacity-60">(opcional)</span>
          </span>
          <input name="partyName" placeholder="Futuro da Escola" className={field} />
        </label>

        <label className="flex w-28 flex-col gap-1.5">
          <span className="text-sm font-medium">Sigla</span>
          <input name="partyAcronym" placeholder="FE" maxLength={10} className={field} />
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">
            Vice <span className="font-normal opacity-60">(opcional)</span>
          </span>
          <input name="deputyName" placeholder="Maria Souza" className={field} />
        </label>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Adicionando…" : "Adicionar candidato"}
        </button>
        {selected ? (
          <span className="text-xs opacity-60">
            {selected.name}: número com {selected.digits}{" "}
            {selected.digits === 1 ? "dígito" : "dígitos"}
          </span>
        ) : null}
      </div>

      <p className="text-xs opacity-60">
        As fotos são adicionadas depois, na etapa de upload de imagens.
      </p>
    </form>
  );
}
