import { useRef, useState } from 'react';

export function useAction() {
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function run(task: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError('');

    try {
      await task();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not complete this action.');
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return { pending, error, run, clearError: () => setError('') };
}
