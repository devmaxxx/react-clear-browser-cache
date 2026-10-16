import type { UpdatePromptProps } from 'react-clear-browser-cache';

import { UpdateDialog } from '../UpdateDialog';

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
  dialog: UpdateDialog,
  banner: BannerPrompt
};

export type PromptChoice = keyof typeof prompts;
