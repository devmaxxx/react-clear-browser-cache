import { type Page, expect, test } from '@playwright/test';

const INDEX_HTML = '<!doctype html><html><head></head><body></body></html>';

/**
 * Serves meta.json from a version the test can change mid-run, standing in
 * for a deploy that happens while the page is open.
 */
async function deployServer(page: Page, initialVersion: string) {
  let versions: string[] = [initialVersion];

  await page.route('**/meta.json?*', (route) => {
    const version = versions.length > 1 ? versions.shift()! : versions[0];
    return route.fulfill({ json: { version } });
  });

  return {
    deploy(...next: string[]) {
      versions = next;
    }
  };
}

/** Answers chunk requests the way an SPA host does once the file is gone. */
async function breakLazyChunk(page: Page, times?: number) {
  await page.route(
    '**/assets/Component-*.js',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: INDEX_HTML
      }),
    { times }
  );
}

const storedVersion = (page: Page) =>
  page.evaluate(() => localStorage.getItem('APP_VERSION'));

const loads = (page: Page) => page.getByTestId('loads');

test('first visit renders the app in standards mode and records the version', async ({
  page
}) => {
  await deployServer(page, 'v1');

  await page.goto('/');

  await expect(page.getByTestId('lazy')).toHaveText('Lazy component');
  await expect(page.getByTestId('version')).toHaveText('v1');
  await expect(page.getByTestId('is-latest')).toHaveText('true');
  await expect(loads(page)).toHaveText('1');
  expect(await storedVersion(page)).toBe('v1');
  // Quirks mode would mean the HTML parser did not see a valid doctype.
  expect(await page.evaluate(() => document.compatMode)).toBe('CSS1Compat');
});

test('a load that finds a new build clears Cache Storage and reloads once', async ({
  page
}) => {
  const server = await deployServer(page, 'v1');
  await page.goto('/');
  await expect(page.getByTestId('version')).toHaveText('v1');
  await page.evaluate(async () => {
    const cache = await caches.open('assets-v1');
    await cache.put('/stale.js', new Response('stale'));
  });

  server.deploy('v2');
  await page.reload();

  await expect(loads(page)).toHaveText('3');
  await expect(page.getByTestId('version')).toHaveText('v2');
  expect(await storedVersion(page)).toBe('v2');
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
});

test('polling without auto offers an update and applies it on click', async ({
  page
}) => {
  const server = await deployServer(page, 'v1');
  await page.goto('/?duration=200');
  await expect(page.getByTestId('is-latest')).toHaveText('true');

  server.deploy('v2');

  await expect(page.getByTestId('is-latest')).toHaveText('false');
  await expect(page.getByTestId('version')).toHaveText('v2');
  expect(await storedVersion(page)).toBe('v1');

  await page.getByRole('button', { name: 'Update' }).click();

  await expect(loads(page)).toHaveText('2');
  await expect(page.getByTestId('is-latest')).toHaveText('true');
  expect(await storedVersion(page)).toBe('v2');
});

test('polling with auto reloads as soon as a new build is deployed', async ({
  page
}) => {
  const server = await deployServer(page, 'v1');
  await page.goto('/?auto=1&duration=200');
  await expect(loads(page)).toHaveText('1');

  server.deploy('v2');

  await expect(loads(page)).toHaveText('2');
  await expect(page.getByTestId('version')).toHaveText('v2');
  expect(await storedVersion(page)).toBe('v2');
});

test('a chunk removed by a deploy triggers a reload instead of an error screen', async ({
  page
}) => {
  const server = await deployServer(page, 'v1');
  await page.goto('/');
  await expect(page.getByTestId('lazy')).toBeVisible();

  // The reloaded page still sees v1 at mount, then the deploy lands before
  // its lazy chunk is fetched, and the old chunk is gone.
  server.deploy('v1', 'v2');
  await breakLazyChunk(page, 1);
  await page.reload();

  await expect(loads(page)).toHaveText('3');
  await expect(page.getByTestId('lazy')).toHaveText('Lazy component');
  await expect(page.getByRole('alert')).toBeHidden();
  expect(await storedVersion(page)).toBe('v2');
});

test('a chunk error on the current build reaches the app error boundary', async ({
  page
}) => {
  await deployServer(page, 'v1');
  await breakLazyChunk(page);

  await page.goto('/');

  await expect(page.getByRole('alert')).toHaveText('Something went wrong!');
  await expect(loads(page)).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem('loads'))).toBe('1');
});

test('an SPA fallback answering meta.json with HTML does not block or loop', async ({
  page
}) => {
  await page.route('**/meta.json?*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: INDEX_HTML })
  );

  await page.goto('/?auto=1&duration=200');

  await expect(page.getByTestId('lazy')).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(loads(page)).toHaveText('1');
  expect(await storedVersion(page)).toBeNull();
});
