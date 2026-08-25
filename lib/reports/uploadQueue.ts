// lib/reports/uploadQueue.ts
// Tiny concurrency limiter for background photo uploads. Photos are shown on
// screen the instant they're compressed — this only bounds how many Blob
// uploads run at once in the background, so 100+ photos don't fire 100+
// simultaneous uploads (which would just contend with each other and the
// browser's per-origin connection limit) while still uploading several at a
// time instead of strictly one-by-one.
export function createUploadQueue(concurrency: number) {
  let active = 0;
  const pending: (() => void)[] = [];

  function runNext() {
    if (active >= concurrency || pending.length === 0) return;
    active++;
    pending.shift()!();
  }

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      pending.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            runNext();
          });
      });
      runNext();
    });
  };
}
