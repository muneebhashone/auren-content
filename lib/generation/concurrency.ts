export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const total = items.length;
  if (total === 0) return [];
  const cap = Math.max(1, Math.min(limit | 0, total));
  const results = new Array<PromiseSettledResult<R>>(total);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const i = cursor++;
      if (i >= total) return;
      try {
        const value = await fn(items[i], i);
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };

  const workers = Array.from({ length: cap }, () => worker());
  await Promise.all(workers);
  return results;
}
