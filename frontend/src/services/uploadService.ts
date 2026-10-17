import { authHeaders, isUnauthorized, UnauthorizedError } from './authService';

// Get API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'https://api.pollypress.pyutasane.com';

export type UploadRequest = {
  fileName: string;
  fileType: string;
};

export type UploadResponse = {
  uploadUrl: string;
  fileId: string;
  fileKey: string;
};

/**
 * Request a presigned URL from the API to upload a file to S3
 */
export async function requestPresignedUrl(
  fileName: string,
  fileType: string
): Promise<UploadResponse> {
  console.log('Requesting presigned URL from API...');

  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({
      fileName,
      fileType,
    }),
  });

  if (isUnauthorized(response)) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get upload URL');
  }

  return response.json();
}

/**
 * Upload a file directly to S3 using a presigned URL.
 * Uses XMLHttpRequest because fetch can't report upload progress.
 */
export function uploadToS3(
  file: File,
  presignedUrl: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Failed to upload file: ${xhr.statusText || xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading the file'));

    xhr.send(file);
  });
}

/**
 * Complete upload flow: request presigned URL and upload to S3
 */
export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResponse> {
  const uploadData = await requestPresignedUrl(file.name, file.type);
  await uploadToS3(file, uploadData.uploadUrl, onProgress);
  return uploadData;
}
