import { useState, useEffect } from "react";

/**
 * Countdown timer hook for ExamTaker.
 * Parses a human-readable duration string like "2 hours" or "45 min"
 * and counts down second by second, calling onExpire when it hits zero.
 */
export default function useExamTimer(durationStr, onExpire) {
  const parseSeconds = (s) => {
    const h = s.match(/(\d+)\s*hour/i);
    const m = s.match(/(\d+)\s*min/i);
    return ((h ? parseInt(h[1]) : 0) * 3600) + ((m ? parseInt(m[1]) : 0) * 60) || 3600;
  };

  const [secs, setSecs] = useState(() => parseSeconds(durationStr));

  useEffect(() => {
    if (secs <= 0) { onExpire?.(); return; }
    const t = setTimeout(() => setSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  const h   = Math.floor(secs / 3600);
  const m   = Math.floor((secs % 3600) / 60);
  const s   = secs % 60;
  const fmt = (n) => String(n).padStart(2, "0");

  return {
    display: `${fmt(h)}:${fmt(m)}:${fmt(s)}`,
    urgent:  secs < 300,
    expired: secs <= 0,
  };
}
