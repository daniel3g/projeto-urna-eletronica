import Link from "next/link";

import { PhotoUpload } from "@/app/(admin)/admin/photos/photo-upload";
import { requireAdmin } from "@/lib/auth/admin";
import { signPhotoUrls, STUDENT_BUCKET } from "@/lib/db/photos";
import { createServiceClient } from "@/lib/supabase/service";

import { toggleStudent } from "./actions";
import { StudentForm } from "./student-form";

export const metadata = { title: "Estudantes — Urna Eletrônica Escolar" };

const PAGE_SIZE = 100;

type Props = { searchParams: Promise<{ q?: string }> };

export default async function StudentsPage({ searchParams }: Props) {
  await requireAdmin();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const db = createServiceClient();

  let select = db
    .from("students")
    .select("id, rm, full_name, class_name, photo_path, is_active", {
      count: "exact",
    });

  if (query) {
    // O índice trigram de students.full_name existe justamente para isto.
    select = select.or(`rm.ilike.%${query}%,full_name.ilike.%${query}%`);
  }

  const { data: students, count } = await select
    .order("full_name")
    .limit(PAGE_SIZE);

  const list = students ?? [];
  const total = count ?? 0;
  const withoutPhoto = list.filter((student) => !student.photo_path).length;

  const photoUrls = await signPhotoUrls(
    STUDENT_BUCKET,
    list.map((student) => student.photo_path),
  );

  const currentPath = query ? `/admin/students?q=${encodeURIComponent(query)}` : "/admin/students";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Estudantes</h1>
          <p className="mt-1 text-sm opacity-70">
            Cadastrados uma vez e reaproveitados em todas as eleições.
          </p>
        </div>
        <Link
          href="/admin/students/import"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Importar CSV
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Buscar por nome ou RM"
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20"
        />
        <button
          type="submit"
          className="rounded-md border border-black/15 px-4 py-2 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Buscar
        </button>
        {query ? (
          <Link
            href="/admin/students"
            className="rounded-md px-3 py-2 text-sm opacity-60 hover:opacity-100"
          >
            Limpar
          </Link>
        ) : null}
      </form>

      <StudentForm />

      <div className="flex items-center justify-between text-sm opacity-70">
        <span>
          {total} {total === 1 ? "estudante" : "estudantes"}
          {query ? " encontrados" : ""}
          {total > PAGE_SIZE ? ` · mostrando os ${PAGE_SIZE} primeiros` : ""}
        </span>
        {withoutPhoto > 0 ? (
          <span>{withoutPhoto} sem foto — o que não impede votar</span>
        ) : null}
      </div>

      {list.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {list.map((student) => (
            <li
              key={student.id}
              className={`flex items-center gap-4 rounded-lg border border-black/10 px-4 py-2.5 dark:border-white/15 ${
                student.is_active ? "" : "opacity-50"
              }`}
            >
              <PhotoUpload
                kind="student"
                id={student.id}
                name={student.full_name}
                photoUrl={
                  student.photo_path
                    ? (photoUrls.get(student.photo_path) ?? null)
                    : null
                }
                photoPath={student.photo_path}
                revalidate={currentPath}
                size={40}
              />
              <span className="w-24 shrink-0 font-mono text-sm">{student.rm}</span>
              <span className="flex-1 font-medium">{student.full_name}</span>
              <span className="w-28 shrink-0 text-sm opacity-60">
                {student.class_name ?? "—"}
              </span>

              <form action={toggleStudent}>
                <input type="hidden" name="studentId" value={student.id} />
                <input type="hidden" name="q" value={query} />
                <input
                  type="hidden"
                  name="nextActive"
                  value={student.is_active ? "false" : "true"}
                />
                <button
                  type="submit"
                  className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                >
                  {student.is_active ? "Desativar" : "Reativar"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-black/15 p-8 text-center dark:border-white/20">
          <p className="font-medium">
            {query ? "Nenhum estudante encontrado." : "Nenhum estudante cadastrado."}
          </p>
          <p className="mt-1 text-sm opacity-70">
            {query
              ? "Tente outro trecho do nome ou o RM completo."
              : "Use a importação em lote para carregar a lista da escola de uma vez."}
          </p>
        </div>
      )}
    </div>
  );
}
