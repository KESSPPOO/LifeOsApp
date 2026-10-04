// src/core/time/useNow.js
//
// The current time for a screen that shows time-dependent state (I dag,
// Plan): refreshed every minute while the screen is mounted, and right away
// when the app returns to the foreground. Screens mount only while focused
// (AppNavigator), so the timer runs only for the visible screen. The pure
// logic receives this value; it never reads the clock itself.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const MINUTE = 60 * 1000;

export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    // Tick on the minute boundary, then every minute.
    let interval;
    const timeout = setTimeout(() => {
      refresh();
      interval = setInterval(refresh, MINUTE);
    }, MINUTE - (Date.now() % MINUTE));
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { clearTimeout(timeout); clearInterval(interval); sub.remove(); };
  }, []);
  return [now, setNow];
}
