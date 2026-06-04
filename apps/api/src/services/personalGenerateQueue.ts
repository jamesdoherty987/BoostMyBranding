/**
 * Serialize personal `generateForAccount` runs **per account** so multiple
 * "Generate" clicks (or overlapping scheduler + manual runs) do not launch
 * several heavy FFmpeg + AI pipelines at once — that pattern makes every job
 * crawl on a typical dev box or small VPS.
 *
 * Jobs still run in parallel **across different** personal accounts.
 */

const tailByAccount = new Map<string, Promise<unknown>>();

export function enqueuePersonalGenerateForAccount<T>(
  accountId: string,
  run: () => Promise<T>,
): Promise<T> {
  const prev = tailByAccount.get(accountId) ?? Promise.resolve();
  const chained = prev.then(
    () => run(),
    () => run(),
  );
  tailByAccount.set(
    accountId,
    chained.then(
      () => undefined,
      () => undefined,
    ),
  );
  return chained;
}
