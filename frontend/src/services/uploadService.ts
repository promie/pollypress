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
    },
    body: JSON.stringify({
      fileName,
      fileType,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get upload URL');
  }

  return response.json();
}

/**
 * Upload a file directly to S3 using a presigned URL
 */
export async function uploadToS3(
  file: File,
  presignedUrl: string
): Promise<void> {
  console.log('Uploading file to S3...');

  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file to S3: ${response.statusText}`);
  }

  console.log('✅ File uploaded successfully to S3!');
}

/**
 * Complete upload flow: request presigned URL and upload to S3
 */
export async function uploadFile(file: File): Promise<UploadResponse> {
  // Step 1: Get presigned URL from API
  const uploadData = await requestPresignedUrl(file.name, file.type);

  console.log('File will be stored at:', uploadData.fileKey);

  // Step 2: Upload file directly to S3 using presigned URL
  await uploadToS3(file, uploadData.uploadUrl);

  console.log('File ID:', uploadData.fileId);
  console.log('S3 Key:', uploadData.fileKey);

  return uploadData;
}
