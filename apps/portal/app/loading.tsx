import { Spinner } from '@boost/ui';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Spinner size={28} />
    </div>
  );
}
