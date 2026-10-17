import { useDropzone } from 'react-dropzone';
import type { FileRejection } from 'react-dropzone';
import type { ConverterState } from '../hooks/useConverter';
import { ProgressBar } from './ProgressBar';
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  FileIcon,
  RefreshIcon,
  ScissorsIcon,
  SparkIcon,
  Spinner,
  UploadCloudIcon,
  XIcon,
} from './icons';

export const MAX_FILE_SIZE_MB = 200;

type ConverterViewProps = {
  state: ConverterState;
  onSelectFile: (file: File) => void;
  onRejectFile: (message: string) => void;
  onConvert: () => void;
  onDownload: () => void;
  onReset: () => void;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatEta = (seconds: number): string => {
  if (seconds < 45) return 'less than a minute left';
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? 'about 1 minute left' : `about ${minutes} minutes left`;
};

const percentOf = (completed: number, total: number): number => Math.floor((completed / total) * 100);

export const primaryButton =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:-translate-y-0.5 hover:shadow-indigo-600/40 active:translate-y-0 disabled:pointer-events-none disabled:opacity-70 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30';

const secondaryButton =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30';

/* ---------- Pieces ---------- */

const Dropzone = ({ onSelectFile, onRejectFile }: Pick<ConverterViewProps, 'onSelectFile' | 'onRejectFile'>) => {
  const onDrop = (accepted: File[], rejected: FileRejection[]) => {
    if (rejected.length > 0) {
      const { file, errors } = rejected[0];
      const tooLarge = errors.some((e) => e.code === 'file-too-large');
      onRejectFile(
        tooLarge
          ? `"${file.name}" is ${formatBytes(file.size)}. The maximum file size is ${MAX_FILE_SIZE_MB} MB.`
          : `"${file.name}" isn't supported. Please choose a PDF or a plain text (.txt) file.`
      );
      return;
    }
    if (accepted[0]) onSelectFile(accepted[0]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  });

  return (
    <div
      {...getRootProps()}
      className={`group cursor-pointer rounded-2xl border-2 border-dashed px-6 py-12 text-center transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 ${
        isDragActive
          ? 'scale-[1.01] border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
          : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/5'
      }`}
    >
      <input {...getInputProps()} />
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 transition group-hover:scale-105 dark:bg-indigo-500/15 dark:text-indigo-300">
        <UploadCloudIcon className="h-8 w-8" />
      </div>
      <p className="text-lg font-semibold text-slate-900 dark:text-white">
        {isDragActive ? 'Drop it here' : 'Drop your document here'}
      </p>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        or <span className="font-semibold text-indigo-600 dark:text-indigo-400">browse your files</span>
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        {['PDF or TXT', `Up to ${MAX_FILE_SIZE_MB} MB`, 'Up to ~2 hours of audio a day'].map((chip) => (
          <span key={chip} className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
};

const FileRow = ({ file, onRemove }: { file: File; onRemove?: () => void }) => {
  const isPdf = file.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700/60">
      <div
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          isPdf
            ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
            : 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300'
        }`}
      >
        <FileIcon className="h-6 w-6" />
        <span className="absolute -bottom-1.5 rounded-md bg-current px-1 text-[9px] font-bold leading-4">
          <span className="text-white dark:text-slate-900">{isPdf ? 'PDF' : 'TXT'}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900 dark:text-white" title={file.name}>
          {file.name}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{formatBytes(file.size)}</p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove file"
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <XIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

type StepStatus = 'pending' | 'active' | 'complete';

const Step = ({
  number,
  title,
  detail,
  status,
  percent,
}: {
  number: number;
  title: string;
  detail: string;
  status: StepStatus;
  percent: number | null;
}) => (
  <li className="flex gap-4">
    <div
      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
        status === 'complete'
          ? 'bg-emerald-500 text-white'
          : status === 'active'
            ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
      }`}
    >
      {status === 'complete' ? <CheckIcon className="h-4 w-4" /> : number}
    </div>
    <div className="min-w-0 flex-1 pb-1">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-semibold ${status === 'pending' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
          {title}
        </p>
        {status !== 'pending' && (
          <span
            className={`text-sm font-semibold tabular-nums ${
              status === 'complete' ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
            }`}
          >
            {status === 'complete' ? '100%' : percent === null ? '' : `${percent}%`}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
      {status !== 'pending' && (
        <div className="mt-2.5">
          <ProgressBar
            percent={status === 'complete' ? 100 : percent}
            label={`${title} progress`}
            tone={status === 'complete' ? 'success' : 'brand'}
          />
        </div>
      )}
    </div>
  </li>
);

/* ---------- Screens ---------- */

const WorkingScreen = ({ state }: { state: ConverterState }) => {
  const { phase, uploadPercent, conversion, etaSeconds } = state;
  const converting = phase === 'converting';
  const convertPercent = conversion ? percentOf(conversion.completedChunks, conversion.totalChunks) : null;

  // Upload is quick relative to synthesis, so weight it lightly in the headline number
  const overall = converting ? 10 + Math.round((convertPercent ?? 0) * 0.9) : Math.round(uploadPercent * 0.1);

  const convertDetail = !converting
    ? 'Turns your text into natural speech'
    : !conversion || conversion.completedChunks === 0
      ? 'Reading your document…'
      : `Section ${conversion.completedChunks} of ${conversion.totalChunks}${etaSeconds !== null ? ` · ${formatEta(etaSeconds)}` : ''}`;

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Overall progress · {converting ? 'converting to speech' : 'uploading'}
          </p>
          <p className="text-5xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">
            {overall}
            <span className="text-3xl text-slate-400">%</span>
          </p>
        </div>
        <Spinner className="mb-2 h-6 w-6 text-indigo-600 dark:text-indigo-400" />
      </div>

      <ProgressBar percent={overall} label="Overall progress" />

      <ol className="mt-8 space-y-6">
        <Step
          number={1}
          title="Upload"
          detail={converting ? 'Your file is safely uploaded' : `Sending ${state.file ? formatBytes(state.file.size) : 'your file'}`}
          status={converting ? 'complete' : 'active'}
          percent={uploadPercent}
        />
        <Step
          number={2}
          title="Convert to speech"
          detail={convertDetail}
          status={converting ? 'active' : 'pending'}
          percent={convertPercent}
        />
        <Step number={3} title="Download" detail="Your MP3 will be ready to play and save" status="pending" percent={null} />
      </ol>

      <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
        You can keep this tab open in the background. Long documents can take a few minutes.
      </p>
    </>
  );
};

const DoneScreen = ({ state, onDownload, onReset }: Pick<ConverterViewProps, 'onDownload' | 'onReset'> & { state: ConverterState }) => {
  const { audioUrl, downloadPercent, error } = state;
  const downloading = downloadPercent !== null && downloadPercent < 100;
  const saved = downloadPercent === 100;

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
          <CheckIcon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">Your audio is ready</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Listen right here or save the MP3.</p>
        </div>
      </div>

      {audioUrl && (
        <audio controls src={audioUrl} preload="metadata" className="w-full rounded-full">
          Your browser does not support the audio element.
        </audio>
      )}

      <div className="mt-6 space-y-3">
        <button type="button" onClick={onDownload} disabled={downloading} className={primaryButton}>
          {downloading ? (
            <>
              <Spinner className="h-4 w-4" />
              Downloading{downloadPercent >= 0 ? ` ${downloadPercent}%` : '…'}
            </>
          ) : saved ? (
            <>
              <CheckIcon className="h-5 w-5" />
              Saved to your downloads
            </>
          ) : (
            <>
              <DownloadIcon className="h-5 w-5" />
              Download MP3
            </>
          )}
        </button>
        {downloading && (
          <ProgressBar percent={downloadPercent >= 0 ? downloadPercent : null} label="Download progress" />
        )}
        {error && <p className="text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <button type="button" onClick={onReset} className={secondaryButton}>
          <RefreshIcon className="h-4 w-4" />
          Convert another file
        </button>
      </div>
    </>
  );
};

/** e.g. { day: "Tomorrow, Saturday 18 October", time: "11:00 am AEDT", relative: "in about 9 hours" } */
const describeRetryTime = (iso: string, now = new Date()) => {
  const at = new Date(iso);
  const dayKey = (d: Date) => d.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const dateText = at.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const prefix = dayKey(at) === dayKey(now) ? 'Today, ' : dayKey(at) === dayKey(tomorrow) ? 'Tomorrow, ' : '';
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

  const minutes = Math.max(1, Math.round((at.getTime() - now.getTime()) / 60_000));
  const relative =
    minutes < 60
      ? `in ${minutes} minute${minutes === 1 ? '' : 's'}`
      : `in about ${Math.round(minutes / 60)} hour${Math.round(minutes / 60) === 1 ? '' : 's'}`;

  return { day: `${prefix}${dateText}`, time, relative };
};

const LimitReachedScreen = ({ state, onReset }: Pick<ConverterViewProps, 'onReset'> & { state: ConverterState }) => {
  const retry = state.retryAt ? describeRetryTime(state.retryAt) : null;

  return (
    <>
      <div className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30">
        <div className="flex gap-4">
          <ClockIcon className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100">Daily limit reached</p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200/90">{state.error}</p>
          </div>
        </div>

        {retry && (
          <div className="mt-5 rounded-xl bg-white/80 p-4 text-center ring-1 ring-amber-200/80 dark:bg-slate-900/60 dark:ring-amber-500/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Available again
            </p>
            <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">{retry.day}</p>
            <p className="text-slate-700 dark:text-slate-300">
              at <span className="font-semibold">{retry.time}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{retry.relative} · shown in your local time</p>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <button type="button" onClick={onReset} className={primaryButton}>
          Choose a shorter file
        </button>
      </div>
    </>
  );
};

const TooLongScreen = ({ state, onReset }: Pick<ConverterViewProps, 'onReset'> & { state: ConverterState }) => (
  <>
    <div className="flex gap-4 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30">
      <ScissorsIcon className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
      <div>
        <p className="font-semibold text-amber-900 dark:text-amber-100">This document is too long</p>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-200/90">{state.error}</p>
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-200/90">
          Tip: split the PDF into parts of about 40 pages and convert them one per day.
        </p>
      </div>
    </div>
    <div className="mt-6">
      <button type="button" onClick={onReset} className={primaryButton}>
        Choose a different file
      </button>
    </div>
  </>
);

const ErrorScreen = ({ state, onConvert, onReset }: Pick<ConverterViewProps, 'onConvert' | 'onReset'> & { state: ConverterState }) => {
  if (state.errorCode === 'DAILY_LIMIT_REACHED') return <LimitReachedScreen state={state} onReset={onReset} />;
  if (state.errorCode === 'DOCUMENT_TOO_LONG') return <TooLongScreen state={state} onReset={onReset} />;

  return (
  <>
    <div className="flex gap-4 rounded-2xl bg-rose-50 p-5 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/30">
      <AlertIcon className="h-6 w-6 shrink-0 text-rose-600 dark:text-rose-400" />
      <div>
        <p className="font-semibold text-rose-900 dark:text-rose-200">We couldn't convert that file</p>
        <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">{state.error}</p>
      </div>
    </div>
    <div className="mt-6 space-y-3">
      {state.file && (
        <button type="button" onClick={onConvert} className={primaryButton}>
          <RefreshIcon className="h-5 w-5" />
          Try again
        </button>
      )}
      <button type="button" onClick={onReset} className={secondaryButton}>
        Choose a different file
      </button>
    </div>
  </>
  );
};

/* ---------- View ---------- */

export const ConverterView = (props: ConverterViewProps) => {
  const { state, onSelectFile, onRejectFile, onConvert, onDownload, onReset } = props;
  const { phase, file } = state;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5 sm:p-8 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/10">
      {phase === 'idle' && <Dropzone onSelectFile={onSelectFile} onRejectFile={onRejectFile} />}

      {phase === 'ready' && file && (
        <>
          <FileRow file={file} onRemove={onReset} />
          <button type="button" onClick={onConvert} className={`${primaryButton} mt-6`}>
            <SparkIcon className="h-5 w-5" />
            Convert to speech
          </button>
        </>
      )}

      {(phase === 'uploading' || phase === 'converting') && (
        <>
          {file && (
            <div className="mb-8">
              <FileRow file={file} />
            </div>
          )}
          <WorkingScreen state={state} />
        </>
      )}

      {phase === 'done' && (
        <>
          {file && (
            <div className="mb-8">
              <FileRow file={file} />
            </div>
          )}
          <DoneScreen state={state} onDownload={onDownload} onReset={onReset} />
        </>
      )}

      {phase === 'error' && (
        <>
          {file && (
            <div className="mb-6">
              <FileRow file={file} />
            </div>
          )}
          <ErrorScreen state={state} onConvert={onConvert} onReset={onReset} />
        </>
      )}
    </div>
  );
};
