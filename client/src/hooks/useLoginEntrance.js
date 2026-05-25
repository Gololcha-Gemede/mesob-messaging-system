import { useEffect, useState } from 'react';
import { LOGIN_ENTRANCE_KEY } from '../utils/jwt';

/** True briefly after login while the post-login entrance animation runs. */
export function useLoginEntrance(duration = 900) {
  const [active, setActive] = useState(
    () => sessionStorage.getItem(LOGIN_ENTRANCE_KEY) === '1'
  );

  useEffect(() => {
    if (!active) return undefined;
    const t = window.setTimeout(() => setActive(false), duration);
    return () => window.clearTimeout(t);
  }, [active, duration]);

  return active;
}
