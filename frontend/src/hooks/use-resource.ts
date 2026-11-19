import { useEffect, useState } from 'react';

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError('');

    load(controller.signal).then(
      (value) => { if (!controller.signal.aborted) setData(value); },
      (failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : 'Could not load this resource.');
        }
      },
    );
    return () => controller.abort();
  }, [load, attempt]);

  return { data, setData, error, retry: () => setAttempt((previous) => previous + 1) };
}
