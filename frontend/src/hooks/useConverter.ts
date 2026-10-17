import { useCallback, useRef, useState } from 'react';
import { uploadFile } from '../services/uploadService';
import { pollForAudioFile, downloadAudioFile } from '../services/downloadService';
import { ProcessingFailedError } from '../services/downloadService';
import type { FailureCode, ProcessingProgress } from '../services/downloadService';
import { UnauthorizedError } from '../services/authService';

export type Phase = 'idle' | 'ready' | 'uploading' | 'converting' | 'done' | 'error';

export type ConverterState = {
  phase: Phase;
  file: File | null;
  uploadPercent: number;
  conversion: ProcessingProgress | null;
  etaSeconds: number | null;
  audioUrl: string | null;
  // null = not downloading; -1 = downloading, size unknown
  downloadPercent: number | null;
  error: string | null;
  // Set for known failures so the view can tailor its message
  errorCode: FailureCode | null;
  // When a limit-blocked file can be tried again (ISO 8601)
  retryAt: string | null;
};

export const initialConverterState: ConverterState = {
  phase: 'idle',
  file: null,
  uploadPercent: 0,
  conversion: null,
  etaSeconds: null,
  audioUrl: null,
  downloadPercent: null,
  error: null,
  errorCode: null,
  retryAt: null,
};

export const audioFileName = (file: File): string => `${file.name.replace(/\.[^.]+$/, '')}.mp3`;

/**
 * Drives the upload → convert → download flow and exposes its state for the view.
 */
export function useConverter({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [state, setState] = useState<ConverterState>(initialConverterState);
  // First progress sample, used to estimate time remaining from the observed rate
  const firstSample = useRef<{ at: number; completed: number } | null>(null);

  const update = (patch: Partial<ConverterState>) => setState((prev) => ({ ...prev, ...patch }));

  const selectFile = useCallback((file: File) => {
    setState({ ...initialConverterState, phase: 'ready', file });
  }, []);

  const rejectFile = useCallback((message: string) => {
    setState({ ...initialConverterState, phase: 'error', error: message });
  }, []);

  const reset = useCallback(() => setState(initialConverterState), []);

  const convert = useCallback(async () => {
    const { file } = state;
    if (!file) return;

    firstSample.current = null;
    setState({ ...initialConverterState, phase: 'uploading', file });

    try {
      const { fileKey } = await uploadFile(file, (uploadPercent) => update({ uploadPercent }));
      update({ phase: 'converting', uploadPercent: 100 });

      const { downloadUrl } = await pollForAudioFile(fileKey, {
        onProgress: (conversion) => {
          let etaSeconds: number | null = null;
          if (conversion) {
            const now = Date.now();
            firstSample.current ??= { at: now, completed: conversion.completedChunks };
            const done = conversion.completedChunks - firstSample.current.completed;
            if (done > 0) {
              const perChunk = (now - firstSample.current.at) / done;
              etaSeconds = Math.round((perChunk * (conversion.totalChunks - conversion.completedChunks)) / 1000);
            }
          }
          update({ conversion: conversion ?? null, etaSeconds });
        },
      });

      setState((prev) => ({
        ...prev,
        phase: 'done',
        audioUrl: downloadUrl,
        conversion: prev.conversion && { ...prev.conversion, completedChunks: prev.conversion.totalChunks },
        etaSeconds: null,
      }));
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      update({
        phase: 'error',
        error: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        errorCode: error instanceof ProcessingFailedError ? error.code ?? null : null,
        retryAt: error instanceof ProcessingFailedError ? error.retryAt ?? null : null,
      });
    }
  }, [state, onUnauthorized]);

  const download = useCallback(async () => {
    const { audioUrl, file } = state;
    if (!audioUrl || !file) return;

    update({ downloadPercent: 0 });
    try {
      await downloadAudioFile(audioUrl, audioFileName(file), (percent) => update({ downloadPercent: percent ?? -1 }));
      update({ downloadPercent: 100 });
      setTimeout(() => update({ downloadPercent: null }), 2500);
    } catch {
      update({ downloadPercent: null, error: 'The download failed. Please try again.' });
    }
  }, [state]);

  return { state, selectFile, rejectFile, convert, download, reset };
}
