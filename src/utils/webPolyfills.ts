const canUseDom = typeof window !== "undefined";

const showAlert = (title: string, message?: string) => {
  if (!canUseDom) return;
  window.alert(title + (message ? `\n${message}` : ""));
};

const copyToClipboard = async (value: string) => {
  if (!canUseDom) return;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

export const Alert = {
  alert: (title: string, message?: string) => {
    showAlert(title, message);
  },
};

export const confirmAction = (title: string, message?: string) => {
  if (!canUseDom) return false;
  return window.confirm(title + (message ? `\n\n${message}` : ""));
};

export const openExternalUrl = async (url: string) => {
  if (!canUseDom) return;
  window.open(url, "_blank", "noopener,noreferrer");
};

export const Share = {
  share: async ({ message, url }: { message?: string; url?: string }) => {
    if (!canUseDom) {
      return { action: "dismissedAction" };
    }

    if (navigator.share) {
      try {
        await navigator.share({ text: message, url });
        return { action: "sharedAction" };
      } catch (_error) {
        return { action: "dismissedAction" };
      }
    }

    const valueToCopy = url || message;
    if (valueToCopy) {
      await copyToClipboard(valueToCopy);
      showAlert("Copied", "Share text copied to clipboard.");
    }

    return { action: "sharedAction" };
  },
};
