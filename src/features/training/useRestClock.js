// src/features/training/useRestClock.js
//
// The current time (epoch ms) for showing a rest countdown: refreshed every
// second while the deadline `endsAt` is still ahead, and on returning to
// the app. It only redraws; the rest itself is the deadline stored in the
// workout (session.timer), so leaving the screen, coming back or
// restarting never starts a second timer and the countdown never drifts.
// No interval runs when there is no rest. In-app only: nothing alerts
// while the app is closed (no notifications in v1).
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useRestClock(endsAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (endsAt == null) return undefined;
    let interval = null;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt && interval !== null) { clearInterval(interval); interval = null; }
    };
    if (Date.now() < endsAt) interval = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') tick(); });
    return () => { if (interval !== null) clearInterval(interval); sub.remove(); };
  }, [endsAt]);
  return now;
}
