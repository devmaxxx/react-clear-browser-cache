import { useEffect, useId, useRef, useState } from 'react';
import type {
  UpdatePromptProps,
  UpdatePromptReason
} from 'react-clear-browser-cache';

import './UpdateDialog.css';

const messages: Record<UpdatePromptReason, string> = {
  poll: 'Reload to get the latest fixes and features. It only takes a second.',
  error:
    'Part of the app could not load because a new version was released. Reload to continue.'
};

// An example prompt to copy into your app: the library ships none, so the
// prompt can match your design system.
export function UpdateDialog({
  latestVersion,
  reason,
  reload,
  dismiss
}: UpdatePromptProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reloadRef = useRef<HTMLButtonElement>(null);
  const [reloading, setReloading] = useState(false);
  const titleId = useId();
  const messageId = useId();

  // Declared before the opening effect so it records focus from before the
  // dialog took it. The dialog is removed rather than closed, and removal does
  // not hand focus back the way close() does.
  useEffect(() => {
    const previouslyFocused = document.activeElement;

    return () => {
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;

    // StrictMode's second run finds it open already.
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    // React applies autoFocus before the dialog opens, when nothing inside it
    // can take focus, and opening then focuses the first button instead.
    reloadRef.current?.focus();
  }, []);

  // Escape while the reload is under way would otherwise hide the prompt, or
  // hand the error to the parent boundary, just before the page reloads.
  const dismissUnlessReloading = () => {
    if (!reloading) {
      dismiss();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className='update-dialog'
      data-reason={reason}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        dismissUnlessReloading();
      }}
    >
      <div className='update-dialog-icon' aria-hidden='true'>
        <svg viewBox='0 0 24 24' width='22' height='22'>
          <path
            d='M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </div>
      <h2 id={titleId}>A new version is available</h2>
      <p id={messageId}>{messages[reason]}</p>
      <p className='update-dialog-version'>
        Version <code>{latestVersion}</code>
      </p>
      <div className='update-dialog-actions'>
        <button type='button' onClick={dismiss} disabled={reloading}>
          Later
        </button>
        <button
          ref={reloadRef}
          type='button'
          className='update-dialog-primary'
          aria-busy={reloading}
          disabled={reloading}
          onClick={() => {
            setReloading(true);
            reload();
          }}
        >
          Reload
        </button>
      </div>
    </dialog>
  );
}
