import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { FileRejection } from 'react-dropzone';
import { uploadFile } from '../services/uploadService';
import { pollForAudioFile, downloadAudioFile } from '../services/downloadService';

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export const FileUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pollingProgress, setPollingProgress] = useState<{ current: number; max: number } | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    // Handle rejected files (wrong type)
    if (rejectedFiles.length > 0) {
      const rejectedFile = rejectedFiles[0];
      const fileName = rejectedFile.file.name;
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'unknown';

      setFile(null);
      setStatus('error');
      setErrorMessage(
        `Sorry, "${fileName}" is not supported. Only .txt files are accepted. ` +
        `You uploaded a .${fileExtension} file.`
      );
      setAudioUrl(null);
      setPollingProgress(null);
      return;
    }

    // Handle accepted files
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setStatus('idle');
      setAudioUrl(null);
      setErrorMessage('');
      setPollingProgress(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;

    setStatus('uploading');
    setErrorMessage('');
    setPollingProgress(null);

    try {
      // Step 1: Upload file to S3
      const uploadResult = await uploadFile(file);
      console.log('Upload complete, file key:', uploadResult.fileKey);

      // Step 2: Poll for the processed audio file
      setStatus('processing');

      const downloadResult = await pollForAudioFile(uploadResult.fileKey, {
        maxAttempts: 30,
        intervalMs: 2000,
        onProgress: (attempt, max) => {
          setPollingProgress({ current: attempt, max });
        },
      });

      console.log('Audio file ready, download URL:', downloadResult.downloadUrl);

      // Step 3: Set the audio URL for playback
      setAudioUrl(downloadResult.downloadUrl);
      setStatus('success');
      setPollingProgress(null);

    } catch (error) {
      console.error('Upload/Processing error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
      setPollingProgress(null);
    }
  };

  const handleDownload = () => {
    if (!audioUrl || !file) return;

    // Generate a nice filename for the download
    const baseFileName = file.name.replace(/\.[^.]+$/, '');
    const downloadFileName = `${baseFileName}.mp3`;

    downloadAudioFile(audioUrl, downloadFileName);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="text-center mb-10">
        <h1 className="text-6xl font-bold mb-3 bg-gradient-to-r from-blue-800 via-blue-900 to-blue-950 bg-clip-text text-transparent">
          PollyPress
        </h1>
        <p className="text-gray-600 text-xl">Convert your text documents to speech</p>
      </div>

      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-2xl p-16 cursor-pointer transition-all duration-300 ease-out
          ${isDragActive
            ? 'border-blue-600 bg-blue-50 scale-[1.02]'
            : file
              ? 'border-green-600 bg-green-50'
              : 'border-gray-300 bg-gray-50 hover:border-blue-600 hover:bg-blue-50'
          }
        `}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            <p className="font-semibold text-xl text-gray-900 mt-2">{file.name}</p>
            <p className="text-sm text-gray-600">{(file.size / 1024).toFixed(2)} KB</p>
          </div>
        ) : isDragActive ? (
          <div className="text-center">
            <p className="text-xl text-blue-700 font-medium">Drop your file here...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 mb-2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div className="text-center space-y-2">
              <p className="text-xl text-gray-700">Drag & drop your file here</p>
              <p className="text-base text-gray-500">or click to browse</p>
            </div>
            <p className="text-sm text-gray-400 mt-2">Supports .txt files only</p>
          </div>
        )}
      </div>

      {file && status === 'idle' && (
        <div className="flex justify-center mt-8">
          <button
            onClick={handleUpload}
            className="px-10 py-4 text-lg font-semibold bg-gradient-to-r from-blue-800 to-blue-900 text-white rounded-xl shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 hover:-translate-y-1 active:translate-y-0 transition-all duration-200"
          >
            Convert to Speech
          </button>
        </div>
      )}

      {(status === 'uploading' || status === 'processing') && (
        <div className="mt-10 flex flex-col items-center gap-5">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-800 rounded-full animate-spin"></div>
          <p className="text-lg text-gray-700">
            {status === 'uploading' ? 'Uploading your document...' : 'Converting to speech...'}
          </p>
          {pollingProgress && (
            <p className="text-sm text-gray-500">
              Checking for processed file... (attempt {pollingProgress.current} of {pollingProgress.max})
            </p>
          )}
        </div>
      )}

      {status === 'success' && (
        <div className="mt-10 p-8 rounded-2xl bg-green-50 border-2 border-green-600">
          <div className="flex flex-col items-center gap-4">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-2xl font-semibold text-gray-900">Conversion complete!</p>
            <p className="text-gray-600">Your audio file is ready to play or download.</p>
            {audioUrl && (
              <>
                <audio controls src={audioUrl} className="w-full mt-4 rounded-lg">
                  Your browser does not support the audio element.
                </audio>
                <button
                  onClick={handleDownload}
                  className="mt-4 px-8 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 active:scale-95 transition-all duration-200 shadow-lg shadow-green-600/30"
                >
                  Download MP3
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-10 p-6 rounded-2xl bg-red-50 border-2 border-red-600">
          <p className="text-lg text-red-600 text-center">
            {errorMessage || 'Something went wrong. Please try again.'}
          </p>
        </div>
      )}
    </div>
  );
};
