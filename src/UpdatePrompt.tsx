import React from 'react';

export type UpdatePromptReason = 'poll' | 'error';

export type UpdatePromptProps = {
  latestVersion: string;
  /**
   * `poll`: a newer build was found while the app kept working.
   * `error`: part of the app failed to load because of it, and the boundary
   * shows its fallback until the user decides.
   */
  reason: UpdatePromptReason;
  /** Clears Cache Storage and reloads the page. */
  reload: () => Promise<void>;
  /**
   * Hides the prompt until a newer build than `latestVersion` is found. For
   * `reason: 'error'` the error goes on to the parent error boundary instead.
   */
  dismiss: () => void;
};

export type DefaultUpdatePromptProps = UpdatePromptProps & {
  title?: React.ReactNode;
  message?: React.ReactNode;
  reloadLabel?: React.ReactNode;
  dismissLabel?: React.ReactNode;
  className?: string;
  /** Modal blocks the page behind it; non-modal leaves it usable. */
  modal?: boolean;
};

const defaultMessages: Record<UpdatePromptReason, string> = {
  poll: 'Reload the page to get the latest version.',
  error:
    'Part of the app could not load because a new version was released. Reload the page to continue.'
};

/**
 * Unstyled update prompt on the native `<dialog>` element, which supplies
 * focus handling and closing on Escape.
 */
export function UpdatePrompt({
  reason,
  reload,
  dismiss,
  title = 'A new version is available',
  message = defaultMessages[reason],
  reloadLabel = 'Reload',
  dismissLabel = 'Later',
  className,
  modal = true
}: DefaultUpdatePromptProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const reloadRef = React.useRef<HTMLButtonElement>(null);
  const [reloading, setReloading] = React.useState(false);
  const titleId = React.useId();
  const messageId = React.useId();

  // Declared before the opening effect so it records focus from before the
  // dialog took it. The dialog is removed rather than closed, and removal does
  // not hand focus back the way close() does.
  React.useEffect(() => {
    const previouslyFocused = document.activeElement;

    return () => {
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  React.useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    // Older engines and jsdom lack the dialog methods; the `open` attribute
    // still shows the content.
    if (dialog.open) {
      // StrictMode's second run finds it open already.
    } else if (modal && typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else if (typeof dialog.show === 'function') {
      dialog.show();
    } else {
      dialog.setAttribute('open', '');
    }

    // React applies autoFocus before the dialog opens, when nothing inside it
    // can take focus, and opening then focuses the first button instead.
    reloadRef.current?.focus();
    // No cleanup: closing here would fire `close` during StrictMode's
    // simulated unmount, and removing the element closes it anyway.
  }, [modal]);

  // Escape while the reload is under way would otherwise hide the prompt, or
  // hand the error to the parent boundary, just before the page reloads.
  const dismissUnlessReloading = () => {
    if (!reloading) {
      dismiss();
    }
  };

  const handleReload = () => {
    setReloading(true);
    reload();
  };

  return (
    <dialog
      ref={dialogRef}
      className={className}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        dismissUnlessReloading();
      }}
      // A non-modal dialog gets no cancel event for Escape.
      onKeyDown={(event) => {
        if (!modal && event.key === 'Escape') {
          dismissUnlessReloading();
        }
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <p id={messageId}>{message}</p>
      <button type='button' onClick={dismiss} disabled={reloading}>
        {dismissLabel}
      </button>
      <button
        ref={reloadRef}
        type='button'
        onClick={handleReload}
        disabled={reloading}
      >
        {reloadLabel}
      </button>
    </dialog>
  );
}
