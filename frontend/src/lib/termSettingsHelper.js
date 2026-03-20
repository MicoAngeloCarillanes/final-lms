/**
 * termSettingsHelper.js
 * FOLDER: frontend/src/lib/termSettingsHelper.js
 *
 * Provides:
 *  - fetchTermSettings()          async → loads admin-configured month→term map from Supabase
 *  - termFromDateWithSettings()   pure  → resolves a term given a settings object
 *  - termFromDateSync()           pure  → hardcoded fallback (matches original constants.js)
 *  - useCurrentTerm(date?)        hook  → React hook: returns the term for a date,
 *                                         using DB settings with sync fallback
 *
 * Caches the Supabase response at module level so it is only fetched once
 * per page load — subsequent hook calls are instant.
 */

import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { EXAM_TERMS } from "./constants";

// ─── Module-level cache ───────────────────────────────────────────────────────
// Shape: { Prelim: [8,9,10,6,7], Midterm: [11,12], ... }  or  null (not loaded yet)
let _settingsCache = null;
let _fetchPromise  = null;

/**
 * Load term settings from Supabase (once, then cached).
 * Returns a map of { term: monthsArray } or null if the table is empty / missing.
 */
export async function fetchTermSettings() {
  if (_settingsCache) return _settingsCache;
  if (_fetchPromise)  return _fetchPromise;

  _fetchPromise = supabase
    .from("term_settings")
    .select("term, months")
    .then(({ data, error }) => {
      if (error || !data?.length) {
        _fetchPromise = null; // allow retry on next call
        return null;
      }
      const map = {};
      data.forEach(r => { map[r.term] = r.months || []; });
      _settingsCache = map;
      return map;
    });

  return _fetchPromise;
}

/** Force-invalidate the cache (call after admin saves new settings). */
export function invalidateTermSettingsCache() {
  _settingsCache = null;
  _fetchPromise  = null;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Hardcoded fallback — mirrors the original constants.js logic. */
export function termFromDateSync(date) {
  const m = (date ? new Date(date) : new Date()).getMonth() + 1; // 1-based
  if (m >= 8 && m <= 10) return "Prelim";
  if (m >= 11 && m <= 12) return "Midterm";
  if (m >= 1  && m <= 2)  return "Semi-Final";
  if (m >= 3  && m <= 5)  return "Finals";
  return "Prelim"; // Jun–Jul → summer, treat as Prelim
}

/**
 * Resolve term using admin-configured settings.
 * Falls back to hardcoded if settings is null or the month is unmapped.
 */
export function termFromDateWithSettings(date, settings) {
  if (!settings) return termFromDateSync(date);
  const m = (date ? new Date(date) : new Date()).getMonth() + 1;
  for (const term of EXAM_TERMS) {
    if (settings[term]?.includes(m)) return term;
  }
  return termFromDateSync(date); // unmapped month → hardcoded fallback
}

// ─── React hook ───────────────────────────────────────────────────────────────

/**
 * useCurrentTerm(date?)
 *
 * Returns the term string for the given date (or today).
 * Immediately returns the sync/hardcoded result, then silently updates to the
 * DB-backed result once fetched (usually < 200 ms, cached after first call).
 *
 * Usage:
 *   const autoTerm = useCurrentTerm();          // for today
 *   const autoTerm = useCurrentTerm(someDate);  // for a specific date
 */
export function useCurrentTerm(date) {
  const [term, setTerm] = useState(() => termFromDateSync(date));

  useEffect(() => {
    let active = true;
    fetchTermSettings().then(settings => {
      if (!active) return;
      const resolved = termFromDateWithSettings(date, settings);
      setTerm(resolved);
    });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return term;
}
