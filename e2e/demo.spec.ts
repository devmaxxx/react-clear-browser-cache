import { expect, test } from '@playwright/test';

test('a simulated deploy is offered through the dialog and applied on Reload', async ({
  page
}) => {
  await page.goto('./');
  await expect(page.getByTestId('stored')).toHaveText('v1');

  await page.getByRole('button', { name: 'Deploy new version' }).click();
  await expect(page.getByTestId('deployed')).toHaveText('v2');

  const dialog = page.getByRole('dialog', {
    name: 'A new version is available'
  });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('button', { name: 'Reload' }).click();

  await expect(page.getByTestId('loads')).toHaveText('2');
  await expect(page.getByTestId('running')).toHaveText('v2');
  await expect(page.getByTestId('stored')).toHaveText('v2');
  await expect(page.getByText('Cache Storage is empty')).toBeVisible();
});

test('a lazy chunk removed by a deploy prompts with the error message', async ({
  page
}) => {
  await page.goto('./?duration=0');
  await page.getByRole('button', { name: 'Deploy new version' }).click();
  await page.getByRole('button', { name: 'Open reports (lazy chunk)' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('could not load');
  await dialog.getByRole('button', { name: 'Reload' }).click();

  await expect(page.getByTestId('running')).toHaveText('v2');
  await page.getByRole('button', { name: 'Open reports (lazy chunk)' }).click();
  await expect(page.getByTestId('reports')).toHaveText(/v2 chunk/);
});

test('the custom banner component replaces the dialog', async ({ page }) => {
  await page.goto('./?prompt=banner&duration=3000');
  await page.getByRole('button', { name: 'Deploy new version' }).click();

  const banner = page.getByRole('status');
  await expect(banner).toContainText('v2 is ready', { timeout: 10_000 });
  await banner.getByRole('button', { name: 'Dismiss' }).click();
  await expect(banner).toBeHidden();
  await expect(page.getByTestId('is-latest')).toHaveText('false');
});
