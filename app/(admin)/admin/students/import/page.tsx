import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";

import { ImportForm } from "./import-form";

export const metadata = { title: "Importar estudantes — Urna Eletrônica Escolar" };

export default async function ImportStudentsPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/students"
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← Estudantes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Importar estudantes</h1>
        <p className="mt-1 text-sm opacity-70">
          O arquivo é analisado antes de qualquer gravação. Você vê o que vai
          acontecer e só então confirma.
        </p>
      </div>

      <div className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/15">
        <p className="font-medium">Formato esperado</p>
        <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-3 font-mono text-xs dark:bg-white/10">
          {`rm,nome,turma
12345,Ana Silva,1 INFO
12346,Carlos Souza,1 INFO
12347,Pedro Santos,2 INFO`}
        </pre>
        <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 opacity-70">
          <li>
            Separador <code>,</code> ou <code>;</code> — detectado
            automaticamente, assim como o BOM que o Excel costuma inserir.
          </li>
          <li>
            As colunas podem vir em qualquer ordem. Também são aceitos os nomes{" "}
            <code>ra</code>, <code>matrícula</code>, <code>aluno</code> e{" "}
            <code>classe</code>.
          </li>
          <li>Sem cabeçalho, assume-se a ordem rm, nome, turma.</li>
          <li>
            RM já cadastrado tem nome e turma atualizados — nunca vira aluno
            duplicado, e a foto existente é preservada.
          </li>
          <li>Fotos não vêm pelo CSV: são adicionadas depois, e são opcionais.</li>
        </ul>
      </div>

      <ImportForm />
    </div>
  );
}
