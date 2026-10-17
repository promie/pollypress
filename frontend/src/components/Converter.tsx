import { useConverter } from '../hooks/useConverter';
import { ConverterView } from './ConverterView';

export const Converter = () => {
  const { state, selectFile, rejectFile, convert, download, reset } = useConverter();

  return (
    <ConverterView
      state={state}
      onSelectFile={selectFile}
      onRejectFile={rejectFile}
      onConvert={convert}
      onDownload={download}
      onReset={reset}
    />
  );
};
