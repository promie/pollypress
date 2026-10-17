import { authHeaders, isUnauthorized, UnauthorizedError } from './authService';

// Get API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'https://api.pollypress.pyutasane.com';

export type DownloadResponse = {
  downloadUrl: string;
  fileKey: string;
  expiresIn: number;
};

export type ProcessingProgress = {
  completedChunks: number;
  totalChunks: number;
};

export type DownloadError = {
  error: string;
  message?: string;
  progress?: ProcessingProgress;
};

/**
 * Thrown while the audio is still being generated. Carries progress once the
 * processor has started synthesizing.
 */
export class FileNotReadyError extends Error {
  readonly progress?: ProcessingProgress;

  constructor(progress?: ProcessingProgress) {
    super('FILE_NOT_READY');
    this.name = 'FileNotReadyError';
    this.progress = progress;
  }
}

/**
 * Request a presigned URL from the API to download the processed audio file
 */
export async function requestDownloadUrl(fileKey: string): Promise<DownloadResponse> {
  const response = await fetch(`${API_URL}/download?fileKey=${encodeURIComponent(fileKey)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
  });

  if (isUnauthorized(response)) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    const error = await response.json() as DownloadError;

    // If file not ready (404), throw specific error
    if (response.status === 404) {
      throw new FileNotReadyError(error.progress);
    }

    throw new Error(error.message || error.error || 'Failed to get download URL');
  }

  return response.json();
}

/**
 * Poll for the processed audio file to be ready.
 * Long documents can take a while, so polling only gives up if progress
 * stalls for `stallTimeoutMs` rather than after a fixed total time.
 */
export async function pollForAudioFile(
  fileKey: string,
  options: {
    intervalMs?: number;
    stallTimeoutMs?: number;
    onProgress?: (progress?: ProcessingProgress) => void;
  } = {}
): Promise<DownloadResponse> {
  const {
    intervalMs = 2000,
    stallTimeoutMs = 5 * 60 * 1000,
    onProgress,
  } = options;

  console.log(`Starting to poll for audio file: ${fileKey}`);

  let lastCompleted = -1;
  let lastProgressAt = Date.now();

  for (;;) {
    try {
      const response = await requestDownloadUrl(fileKey);
      console.log('✅ Audio file is ready!');
      return response;
    } catch (error) {
      if (!(error instanceof FileNotReadyError)) {
        console.error('Error polling for audio file:', error);
        throw error;
      }

      onProgress?.(error.progress);

      const completed = error.progress?.completedChunks ?? -1;
      if (completed > lastCompleted) {
        lastCompleted = completed;
        lastProgressAt = Date.now();
      } else if (Date.now() - lastProgressAt > stallTimeoutMs) {
        throw new Error('Audio processing is taking longer than expected. Please try again later.');
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
}

/**
 * Download the audio file and save it with `fileName`, reporting progress.
 * The file is fetched into a blob first because browsers ignore the
 * `download` attribute on cross-origin links like presigned S3 URLs.
 * `onProgress` receives null when the size is unknown.
 */
export async function downloadAudioFile(
  downloadUrl: string,
  fileName: string,
  onProgress?: (percent: number | null) => void
): Promise<void> {
  const response = await fetch(downloadUrl);
  if (!response.ok || !response.body) {
    throw new Error('Failed to download the audio file');
  }

  const total = Number(response.headers.get('Content-Length')) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(total ? Math.round((received / total) * 100) : null);
  }

  const blobUrl = URL.createObjectURL(new Blob(chunks, { type: 'audio/mpeg' }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the browser a moment to start the save before freeing the blob
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
