import { create } from "zustand";
import { toUserMessage } from "./errors";

export type AlertType = "error" | "warning" | "info" | "success";

export interface AlertModalItem {
  id: string;
  title?: string;
  message: string;
  type: AlertType;
  confirmText?: string;
  onConfirm?: () => void;
}

interface AlertModalState {
  currentAlert: AlertModalItem | null;
  queue: AlertModalItem[];
  showAlert: (item: Omit<AlertModalItem, "id">) => void;
  closeAlert: () => void;
}

export function detectAlertType(message: string, title?: string): AlertType {
  const text = `${title || ""} ${message}`.toLowerCase();

  // Success detection
  if (
    text.includes("copied") ||
    text.includes("successfully") ||
    text.includes("completed") ||
    text.includes("saved to local device") ||
    text.includes("synced") ||
    text.includes("verified")
  ) {
    return "success";
  }

  // Error detection
  if (
    text.includes("failed") ||
    text.includes("error") ||
    text.includes("could not") ||
    text.includes("exception") ||
    text.includes("rejected") ||
    text.includes("denied") ||
    text.includes("forbidden") ||
    text.includes("unauthorized") ||
    text.includes("crash") ||
    text.includes("not available")
  ) {
    return "error";
  }

  // Warning detection
  if (
    text.includes("please") ||
    text.includes("required") ||
    text.includes("cannot be") ||
    text.includes("must be") ||
    text.includes("locked") ||
    text.includes("warning") ||
    text.includes("caution") ||
    text.includes("invalid") ||
    text.includes("missing")
  ) {
    return "warning";
  }

  return "info";
}

export function getDefaultTitle(type: AlertType): string {
  switch (type) {
    case "error":
      return "Action Failed";
    case "warning":
      return "Attention Required";
    case "success":
      return "Operation Successful";
    case "info":
    default:
      return "Notice";
  }
}

export const useAlertModalStore = create<AlertModalState>((set, get) => ({
  currentAlert: null,
  queue: [],

  showAlert: (item) => {
    const newItem: AlertModalItem = {
      ...item,
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: item.title || getDefaultTitle(item.type),
    };

    const state = get();
    if (!state.currentAlert) {
      set({ currentAlert: newItem });
    } else {
      set({ queue: [...state.queue, newItem] });
    }
  },

  closeAlert: () => {
    const state = get();
    if (state.currentAlert?.onConfirm) {
      try {
        state.currentAlert.onConfirm();
      } catch (err) {
        console.error("Error running alert confirm callback:", err);
      }
    }

    if (state.queue.length > 0) {
      const [nextItem, ...remainingQueue] = state.queue;
      set({ currentAlert: nextItem, queue: remainingQueue });
    } else {
      set({ currentAlert: null });
    }
  },
}));

export interface ShowAlertOptions {
  message: unknown;
  title?: string;
  type?: AlertType;
  confirmText?: string;
  onConfirm?: () => void;
}

export function showAlertPopup(options: string | ShowAlertOptions) {
  if (typeof options === "string") {
    const text = options.trim();
    const type = detectAlertType(text);
    useAlertModalStore.getState().showAlert({
      message: text,
      type,
    });
    return;
  }

  const rawMessage = options.message;
  const formattedMessage = toUserMessage(rawMessage);
  const type = options.type || detectAlertType(formattedMessage, options.title);

  useAlertModalStore.getState().showAlert({
    title: options.title,
    message: formattedMessage,
    type,
    confirmText: options.confirmText,
    onConfirm: options.onConfirm,
  });
}

export function showErrorPopup(error: unknown, title?: string, onConfirm?: () => void) {
  const message = toUserMessage(error);
  useAlertModalStore.getState().showAlert({
    title: title || "Action Failed",
    message,
    type: "error",
    onConfirm,
  });
}

export function showSuccessPopup(message: string, title?: string, onConfirm?: () => void) {
  useAlertModalStore.getState().showAlert({
    title: title || "Success",
    message,
    type: "success",
    onConfirm,
  });
}

export function showWarningPopup(message: string, title?: string, onConfirm?: () => void) {
  useAlertModalStore.getState().showAlert({
    title: title || "Attention Required",
    message,
    type: "warning",
    onConfirm,
  });
}

export function showInfoPopup(message: string, title?: string, onConfirm?: () => void) {
  useAlertModalStore.getState().showAlert({
    title: title || "Notice",
    message,
    type: "info",
    onConfirm,
  });
}

/**
 * Intercepts native window.alert calls in browser environment
 * and forwards them seamlessly to the CrediiFlow themed modal popup.
 */
export function setupAlertInterceptor(): () => void {
  if (typeof window === "undefined") return () => {};

  const win = window as any;
  if (!win.__nativeAlert) {
    win.__nativeAlert = window.alert.bind(window);
  }

  window.alert = (message?: any) => {
    const formatted = toUserMessage(message, "An unknown alert occurred.");
    const detectedType = detectAlertType(formatted);

    useAlertModalStore.getState().showAlert({
      message: formatted,
      type: detectedType,
    });
  };

  return () => {
    if (win.__nativeAlert) {
      window.alert = win.__nativeAlert;
    }
  };
}
