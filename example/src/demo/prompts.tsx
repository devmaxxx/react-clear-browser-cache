import {
  UpdatePrompt,
  type UpdatePromptProps
} from 'react-clear-browser-cache';

// Declared once at module level: a new function on every render would be a new
// component type, and React would remount the prompt each time.
export function DialogPrompt(props: UpdatePromptProps) {
  return <UpdatePrompt {...props} className='dialog' />;
}

export function BannerPrompt({
  latestVersion,
  reason,
  reload,
  dismiss
}: UpdatePromptProps) {
  return (
    <div className='banner' role='status'>
      <span>
        {reason === 'error'
          ? `Part of the page needs ${latestVersion}.`
          : `${latestVersion} is ready.`}
      </span>
      <button type='button' className='primary' onClick={reload}>
        Refresh
      </button>
      <button type='button' onClick={dismiss}>
        Dismiss
      </button>
    </div>
  );
}

export const prompts = {
  dialog: DialogPrompt,
  banner: BannerPrompt,
  none: undefined
};

export type PromptChoice = keyof typeof prompts;
