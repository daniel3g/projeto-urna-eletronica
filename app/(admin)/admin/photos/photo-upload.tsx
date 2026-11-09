"use client";

import { useRef, useState, useTransition } from "react";

import { prepareSquarePhoto } from "@/lib/image/prepare";

import { removePhoto, uploadPhoto } from "./actions";

export type PhotoKind = "student" | "candidate" | "candidate-deputy";

export function PhotoUpload({
  kind,
  id,
  name,
  photoUrl,
  photoPath,
  revalidate,
  size = 48,
}: {
  kind: PhotoKind;
  id: string;
  name: string;
  photoUrl: string | null;
  photoPath: string | null;
  revalidate: string;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const working = pending || busy;

  async function handlePick(file: File) {
    setError(null);
    setBusy(true);

    try {
      // O redimensionamento acontece aqui, antes de sair do navegador: sobem
      // ~50 KB em vez dos 4 MB que uma foto de celular costuma ter.
      const prepared = await prepareSquarePhoto(file);
      setPreview(URL.createObjectURL(prepared.blob));

      const payload = new FormData();
      payload.set("kind", kind);
      payload.set("id", id);
      payload.set("revalidate", revalidate);
      payload.set(
        "file",
        new File([prepared.blob], "foto", { type: prepared.type }),
      );

      startTransition(async () => {
        const result = await uploadPhoto(payload);
        if (result.error) {
          setError(result.error);
          setPreview(null);
        }
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao processar a imagem.");
      setPreview(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove() {
    setError(null);
    const payload = new FormData();
    payload.set("kind", kind);
    payload.set("id", id);
    payload.set("currentPath", photoPath ?? "");
    payload.set("revalidate", revalidate);

    startTransition(async () => {
      const result = await removePhoto(payload);
      if (result.error) setError(result.error);
      else setPreview(null);
    });
  }

  const shown = preview ?? photoUrl;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  // O selo do canto acompanha o tamanho do avatar, com um mínimo legível.
  const badge = Math.max(16, Math.round(size * 0.36));

  return (
    <div className="flex items-center gap-2">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={working}
          title={shown ? `Trocar foto de ${name}` : `Enviar foto de ${name}`}
          className="group relative block h-full w-full overflow-hidden rounded-full border border-black/10 bg-black/5 transition hover:ring-2 hover:ring-blue-500/60 disabled:opacity-50 dark:border-white/15 dark:bg-white/10"
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada com
            // expiração; o otimizador do next/image não acrescenta nada aqui.
            <img
              src={shown}
              alt={`Foto de ${name}`}
              width={size}
              height={size}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-full w-full items-center justify-center text-xs font-medium opacity-60"
            >
              {initials || "?"}
            </span>
          )}

          <span
            aria-hidden
            className="absolute inset-0 hidden items-center justify-center bg-black/45 group-hover:flex"
          >
            <CameraIcon size={Math.round(size * 0.4)} className="text-white" />
          </span>

          {working ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white">
              …
            </span>
          ) : null}
        </button>

        {/* Selo permanente: sem ele não há pista de que o avatar é clicável.
            pointer-events-none para o clique atravessar até o botão. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-[var(--background)]"
          style={{ width: badge, height: badge }}
        >
          <CameraIcon size={Math.round(badge * 0.62)} />
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handlePick(file);
        }}
      />

      {shown ? (
        <button
          type="button"
          onClick={handleRemove}
          disabled={working}
          className="text-xs opacity-50 hover:text-red-700 hover:opacity-100 disabled:opacity-30 dark:hover:text-red-400"
        >
          remover
        </button>
      ) : null}

      {error ? (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function CameraIcon({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
