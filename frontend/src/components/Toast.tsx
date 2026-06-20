import type { ReactNode } from "react";
import { toast as sonnerToast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

interface ToastContextValue {
  push: (kind: "success" | "error" | "info", message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const value: ToastContextValue = {
  push: (kind, message) => {
    if (kind === "success") sonnerToast.success(message);
    else if (kind === "error") sonnerToast.error(message);
    else sonnerToast.info(message);
  },
  success: (message) => sonnerToast.success(message),
  error: (message) => sonnerToast.error(message),
  info: (message) => sonnerToast.info(message),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}

export function useToast(): ToastContextValue {
  return value;
}
