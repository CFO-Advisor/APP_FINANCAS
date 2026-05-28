import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Converts any caught value (including Supabase PostgrestError plain objects) to a real Error so DevTools/Next.js overlay shows the message. */
export function toError(err: unknown): Error {
  if (err instanceof Error) return err
  if (typeof err === 'object' && err !== null) {
    const msg = (err as Record<string, unknown>).message
    return new Error(typeof msg === 'string' ? msg : JSON.stringify(err))
  }
  return new Error(String(err))
}
