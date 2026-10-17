import { Layout } from '../App';
import { ConverterView } from '../components/ConverterView';
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
  downloading: {
    ...initialConverterState,
    phase: 'done',
    file: report,
    audioUrl: 'data:audio/mpeg;base64,',
    downloadPercent: 47,
  },
  error: {
    ...initialConverterState,
    phase: 'error',
    file: sampleFile('scanned-contract.pdf', 12_400_000),
    error: 'No readable text found in the file. Scanned or image-only PDFs are not supported.',
  },
};

const noop = () => {};

export const Preview = ({ name }: { name: string }) => {
  const state = previewStates[name];

  if (!state) {
    return (
      <div className="p-8 font-sans">
        <p className="mb-4">Unknown preview. Try one of:</p>
        <ul className="list-disc pl-6">
          {Object.keys(previewStates).map((key) => (
            <li key={key}>
              <a className="text-indigo-600 underline" href={`?preview=${key}`}>{key}</a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <Layout>
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
