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
