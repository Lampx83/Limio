/**
 * Tiny toast singleton — pub/sub. UI lives in <Toaster /> mounted in root layout.
 *
 * Usage from any client component:
 *   import { toast } from "@/lib/toast";
 *   toast.success("Đã lưu");
 *   toast.error("Lỗi");
 */

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  /** Optional secondary line. */
  description?: string;
  /** ms before auto-dismiss. Defaults to 4000; pass 0 to keep until manually closed. */
  duration?: number;
}

type Listener = (toasts: Toast[]) => void;

let nextId = 1;
let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l([...toasts]);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(
  variant: ToastVariant,
  message: string,
  opts: { description?: string; duration?: number } = {},
): number {
  const id = nextId++;
  const duration = opts.duration ?? 4000;
  toasts = [...toasts, { id, variant, message, ...opts }];
  emit();
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
  return id;
}

export const toast = {
  success(message: string, opts?: { description?: string; duration?: number }) {
    return push("success", message, opts);
  },
  error(message: string, opts?: { description?: string; duration?: number }) {
    return push("error", message, opts);
  },
  info(message: string, opts?: { description?: string; duration?: number }) {
    return push("info", message, opts);
  },
  dismiss: dismissToast,
};
