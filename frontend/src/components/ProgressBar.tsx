type ProgressBarProps = {
  // null shows an indeterminate (animated) bar
  percent: number | null;
  label: string;
  tone?: 'brand' | 'success';
};

export const ProgressBar = ({ percent, label, tone = 'brand' }: ProgressBarProps) => {
  const fill = tone === 'success' ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500';

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/60"
    >
      {percent === null ? (
        <div className={`absolute inset-y-0 w-1/3 rounded-full ${fill} animate-indeterminate`} />
      ) : (
        <div
          className={`h-full rounded-full ${fill} transition-[width] duration-500 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      )}
    </div>
  );
};
