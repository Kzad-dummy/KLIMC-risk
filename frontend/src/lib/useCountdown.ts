import { useEffect, useState } from 'react';

/**
 * Whole seconds left until `endsAt`, using the server's clock rather than this device's.
 * `serverNow` is the server time when the message was sent, so (endsAt - serverNow) is the
 * time that was left at that moment, whatever this device's clock says.
 * Pass null for both when there is nothing to count down to.
 */
export function useCountdown(endsAt: number | null, serverNow: number | null): number {
  // Start from the right number straight away, so there is no flash of "0 seconds".
  const [secondsLeft, setSecondsLeft] = useState(() =>
    endsAt !== null && serverNow !== null ? Math.max(0, Math.ceil((endsAt - serverNow) / 1000)) : 0
  );

  useEffect(() => {
    if (endsAt === null || serverNow === null) {
      setSecondsLeft(0);
      return;
    }
    const remainingMs = endsAt - serverNow;
    const receivedAt = Date.now();
    const tick = () => {
      const left = remainingMs - (Date.now() - receivedAt);
      setSecondsLeft(Math.max(0, Math.ceil(left / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, serverNow]);

  return secondsLeft;
}
