"use client";

import { useEffect } from "react";
import { markAllReadAction } from "../actions";

/** Marks the list as read once it has been seen; the dots stay until the next visit. */
export function MarkRead() {
  useEffect(() => {
    void markAllReadAction();
  }, []);
  return null;
}
