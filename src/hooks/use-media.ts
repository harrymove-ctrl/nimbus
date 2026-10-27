"use client";

import { useEffect, useState } from "react";

/** True while the media query matches (false on the server and on first paint). */
export function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(query);
    const on = () => setMatch(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, [query]);
  return match;
}
