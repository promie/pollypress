import { Layout } from '../App';
import { ConverterView } from '../components/ConverterView';
import { PasscodeGate } from '../components/PasscodeGate';
import { initialConverterState, type ConverterState } from '../hooks/useConverter';

/**
 * Dev-only gallery of every screen with sample data, for design review.
 * Open with `npm run dev` and `/?preview=<name>` (e.g. ?preview=converting).
 */

const sampleFile = (name: string, size: number): File => {
  const file = new File(['sample'], name, { type: name.endsWith('.pdf') ? 'application/pdf' : 'text/plain' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const report = sampleFile('Annual Report 2025 - Full Edition.pdf', 4_820_000);

export const previewStates: Record<string, ConverterState> = {
  idle: initialConverterState,
  ready: { ...initialConverterState, phase: 'ready', file: report },
  uploading: { ...initialConverterState, phase: 'uploading', file: report, uploadPercent: 64 },
  reading: { ...initialConverterState, phase: 'converting', file: report, uploadPercent: 100 },
  converting: {
    ...initialConverterState,
    phase: 'converting',
    file: report,
    uploadPercent: 100,
    conversion: { completedChunks: 112, totalChunks: 245 },
    etaSeconds: 150,
  },
  done: { ...initialConverterState, phase: 'done', file: report, audioUrl: 'data:audio/mpeg;base64,' },
  'done-reused': {
    ...initialConverterState,
    phase: 'done',
    file: sampleFile('Annual Report 2025 (copy).pdf', 4_820_000),
    audioUrl: 'data:audio/mpeg;base64,',
    reusedConvertedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
  downloading: {
    ...initialConverterState,
    phase: 'done',
    file: report,
    audioUrl: 'data:audio/mpeg;base64,',
    downloadPercent: 47,
  },
  'limit-reached': {
    ...initialConverterState,
    phase: 'error',
    file: sampleFile('Quarterly Board Pack.pdf', 3_150_000),
    error: "This document needs about 50 minutes of audio, but only about 20 minutes of today's 2 hours is left.",
    errorCode: 'DAILY_LIMIT_REACHED',
    // Next midnight UTC, like the backend
    retryAt: (() => {
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
    })(),
  },
  'too-long': {
    ...initialConverterState,
    phase: 'error',
    file: report,
    error: 'This document would be about 6 hours 30 minutes of audio, but the daily limit is about 2 hours. Try splitting it into smaller files.',
    errorCode: 'DOCUMENT_TOO_LONG',
  },
  error: {
    ...initialConverterState,
    phase: 'error',
    file: sampleFile('scanned-contract.pdf', 12_400_000),
    error: 'No readable text found in the file. Scanned or image-only PDFs are not supported.',
  },
};

const noop = () => {};

const gatePreviews: Record<string, { message?: string; checking?: boolean }> = {
  locked: {},
  'locked-error': { message: "That passcode isn't right. Please check it and try again." },
  'locked-checking': { checking: true },
};

export const Preview = ({ name }: { name: string }) => {
  const state = previewStates[name];
  const gate = gatePreviews[name];

  if (gate) {
    return (
      <Layout>
        <PasscodeGate onUnlocked={noop} initialMessage={gate.message} initialChecking={gate.checking} />
      </Layout>
    );
  }

  if (!state) {
    return (
      <div className="p-8 font-sans">
        <p className="mb-4">Unknown preview. Try one of:</p>
        <ul className="list-disc pl-6">
          {[...Object.keys(previewStates), ...Object.keys(gatePreviews)].map((key) => (
            <li key={key}>
              <a className="text-indigo-600 underline" href={`?preview=${key}`}>{key}</a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <Layout onLock={noop}>
      <ConverterView
        state={state}
        onSelectFile={noop}
        onRejectFile={noop}
        onConvert={noop}
        onDownload={noop}
        onReset={noop}
      />
    </Layout>
  );
};
