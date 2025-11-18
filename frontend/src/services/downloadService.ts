// Get API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'https://api.pollypress.pyutasane.com';

export type DownloadResponse = {
  downloadUrl: string;
  fileKey: string;
  expiresIn: number;
};

export type DownloadError = {
  error: string;
  message?: string;
};

/**
 * Request a presigned URL from the API to download the processed audio file
 */
export async function requestDownloadUrl(fileKey: string): Promise<DownloadResponse> {
  console.log('Requesting download URL from API for:', fileKey);

  const response = await fetch(`${API_URL}/download?fileKey=${encodeURIComponent(fileKey)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json() as DownloadError;

    // If file not ready (404), throw specific error
    if (response.status === 404) {
      throw new Error('FILE_NOT_READY');
    }

    throw new Error(error.error || 'Failed to get download URL');
  }

  return response.json();
}

/**
 * Poll for the processed audio file to be ready
 * Returns the download URL when ready, or throws after max attempts
 */
export async function pollForAudioFile(
  fileKey: string,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    onProgress?: (attempt: number, maxAttempts: number) => void;
  } = {}
): Promise<DownloadResponse> {
  const {
    maxAttempts = 30, // Poll for up to 30 attempts
    intervalMs = 2000, // Check every 2 seconds
    onProgress,
  } = options;

  console.log(`Starting to poll for audio file: ${fileKey}`);
  console.log(`Will check every ${intervalMs}ms for up to ${maxAttempts} attempts`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Polling attempt ${attempt}/${maxAttempts}...`);

      // Notify progress
      if (onProgress) {
        onProgress(attempt, maxAttempts);
      }

      // Try to get the download URL
      const response = await requestDownloadUrl(fileKey);

      console.log('✅ Audio file is ready!');
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // If file not ready, wait and try again
      if (errorMessage === 'FILE_NOT_READY') {
        if (attempt < maxAttempts) {
          console.log(`File not ready yet, waiting ${intervalMs}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          continue;
        } else {
          console.error('Max polling attempts reached');
          throw new Error('Audio processing is taking longer than expected. Please try again later.');
        }
      }

      // For other errors, throw immediately
      console.error('Error polling for audio file:', errorMessage);
      throw error;
    }
  }

  throw new Error('Audio processing is taking longer than expected. Please try again later.');
}

/**
 * Download the audio file using the presigned URL
 */
export function downloadAudioFile(downloadUrl: string, fileName: string): void {
  console.log('Starting download...');

  // Create a temporary anchor element to trigger download
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log('✅ Download started!');
}
