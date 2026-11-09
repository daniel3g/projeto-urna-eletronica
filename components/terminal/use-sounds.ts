"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Teclas em sequência rápida se sobrepõem — um único elemento de áudio cortaria
 * o som anterior a cada toque, então giramos entre algumas cópias.
 */
const KEY_VOICES = 4;

function load(src: string) {
  const audio = new Audio(src);
  audio.preload = "auto";
  return audio;
}

function play(audio: HTMLAudioElement | undefined) {
  if (!audio) return;
  audio.currentTime = 0;
  // O navegador bloqueia áudio antes do primeiro gesto do usuário; na urna isso
  // só aconteceria em um som disparado sem toque, e falhar em silêncio é melhor
  // do que quebrar a votação.
  void audio.play().catch(() => {});
}

/** Sons da urna: `tecla` a cada toque, `fim` ao encerrar o voto do eleitor. */
export function useSounds() {
  const keys = useRef<HTMLAudioElement[]>([]);
  const keyVoice = useRef(0);
  const end = useRef<HTMLAudioElement | null>(null);

  // `new Audio` só existe no navegador — por isso a carga fica no efeito.
  useEffect(() => {
    keys.current = Array.from({ length: KEY_VOICES }, () => load("/tecla.mp3"));
    end.current = load("/fim.mp3");

    return () => {
      for (const audio of [...keys.current, end.current]) audio?.pause();
      keys.current = [];
      end.current = null;
    };
  }, []);

  const playKey = useCallback(() => {
    const voices = keys.current;
    if (voices.length === 0) return;
    play(voices[keyVoice.current]);
    keyVoice.current = (keyVoice.current + 1) % voices.length;
  }, []);

  const playEnd = useCallback(() => {
    play(end.current ?? undefined);
  }, []);

  return { playKey, playEnd };
}
