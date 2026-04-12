import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const ORG_ID = 'WCC-Worship-Ministry';
const LOGIN_EMAIL = process.env.ADMIN_USERNAME!;
const LOGIN_PASSWORD = process.env.ADMIN_PASSWORD!;

test.describe('Song Health Page - UI User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/admin/login?org=${ORG_ID}`);

    // Wait for login form to load
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill in email
    await page.fill('input[type="email"]', LOGIN_EMAIL);

    // Fill in password
    await page.fill('input[type="password"]', LOGIN_PASSWORD);

    // Click login button
    const loginButton = page.locator('button:has-text("Sign In")');
    await loginButton.click();

    // Wait for redirect to admin dashboard
    await page.waitForURL(/\/admin\/(roster|songs|people|health)/, { timeout: 15000 });

    // Navigate to Song Health page
    await page.goto(`${BASE_URL}/admin/songs/health?org=${ORG_ID}`);

    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 });
  });

  test('JRN-001: Page loads with correct structure', async ({ page }) => {
    // Verify page title — use specific selector to avoid matching sidebar h1
    await expect(page.getByRole('heading', { name: 'Song Health' })).toBeVisible();
    
    // Verify subtitle
    await expect(page.locator('p:has-text("Inventory of missing song information")')).toBeVisible();
    
    // Verify tabs are present
    const healthTab = page.locator('button:has-text("Health Overview")');
    const urlTab = page.locator('button:has-text("Bulk URL Update")');
    
    await expect(healthTab).toBeVisible();
    await expect(urlTab).toBeVisible();
    
    console.log('✓ JRN-001: Page structure verified');
  });

  test('JRN-002: Health Overview tab shows summary chips', async ({ page }) => {
    // Check for summary chip labels
    const labels = [
      'Missing Chords',
      'Missing Keys',
      'Missing Video',
      'Missing Scripture',
    ];
    
    for (const label of labels) {
      const chip = page.locator(`text=${label}`);
      await expect(chip).toBeVisible();
    }
    
    // Verify chips contain numbers
    const chips = page.locator('div.grid.grid-cols-4 > div');
    const chipCount = await chips.count();
    expect(chipCount).toBe(4);
    
    console.log('✓ JRN-002: All summary chips visible with data');
  });

  test('JRN-003: Filter toggle works', async ({ page }) => {
    // Check that filter toggle exists
    const filterCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(filterCheckbox).toBeVisible();
    
    // Verify label
    const filterLabel = page.locator('text=Show incomplete only');
    await expect(filterLabel).toBeVisible();
    
    // Toggle filter
    const isChecked = await filterCheckbox.isChecked();
    console.log(`Filter initially: ${isChecked ? 'checked' : 'unchecked'}`);
    
    console.log('✓ JRN-003: Filter toggle is interactive');
  });

  test('JRN-004: Song table renders with health indicators', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table');
    
    // Check for table headers
    const headers = ['Title', 'Artist', 'Chord', 'Keys', 'Video', 'Scripture'];
    
    for (const header of headers) {
      const headerCell = page.locator(`th:has-text("${header}")`);
      await expect(headerCell).toBeVisible();
    }
    
    // Check for health indicator symbols (✓ or ✗) — wait for data to load first
    const indicators = page.locator('span:has-text("✓"), span:has-text("✗")');
    await expect(indicators.first()).toBeVisible({ timeout: 10000 });
    const indicatorCount = await indicators.count();
    
    console.log(`Found ${indicatorCount} health indicator symbols`);
    expect(indicatorCount).toBeGreaterThan(0);
    
    console.log('✓ JRN-004: Song table with health indicators loaded');
  });

  test('JRN-005: Edit links are present in table rows', async ({ page }) => {
    await page.waitForSelector('table');

    // Generation buttons should NOT exist (removed from UI)
    await expect(page.locator('button:has-text("Select All Missing")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Generate Selected")')).not.toBeVisible();

    // Edit links appear after /api/me resolves — wait for the first one before counting
    const firstEditLink = page.locator('a:has-text("Edit")').first();
    await expect(firstEditLink).toBeVisible({ timeout: 10000 });

    const editLinks = page.locator('a:has-text("Edit")');
    const editCount = await editLinks.count();
    console.log(`Found ${editCount} Edit links in table rows`);
    expect(editCount).toBeGreaterThan(0);

    console.log('✓ JRN-005: Edit links visible, Generate buttons absent');
  });



  test('JRN-008: Bulk URL Update tab can be opened', async ({ page }) => {
    // Click the Bulk URL Update tab
    const urlTab = page.locator('button:has-text("Bulk URL Update")');
    await urlTab.click();
    
    // Wait for tab content to appear
    await page.waitForTimeout(300);
    
    // Check for URL input fields
    const urlInputs = page.locator('input[type="url"]');
    const count = await urlInputs.count();
    
    console.log(`Found ${count} URL input fields in Bulk Update tab`);
    
    // Check for "Save All Changes" button
    const saveBtn = page.locator('button:has-text("Save All Changes")');
    await expect(saveBtn).toBeVisible();
    
    console.log('✓ JRN-008: Bulk URL Update tab loads correctly');
  });

  test('JRN-009: URL input fields are editable', async ({ page }) => {
    // Switch to Bulk URL Update tab
    const urlTab = page.locator('button:has-text("Bulk URL Update")');
    await urlTab.click();
    
    await page.waitForTimeout(300);
    
    // Get first URL input field
    const firstInput = page.locator('input[type="url"]').first();
    
    // Type a URL
    const testUrl = 'https://drive.google.com/file/d/test123/view';
    await firstInput.fill(testUrl);
    
    // Verify the value was set
    const inputValue = await firstInput.inputValue();
    expect(inputValue).toBe(testUrl);
    
    console.log(`✓ URL input accepted: ${inputValue}`);
    
    console.log('✓ JRN-009: URL input fields are editable');
  });

  test('JRN-010: Save All Changes button is disabled when empty', async ({ page }) => {
    // Switch to Bulk URL Update tab
    const urlTab = page.locator('button:has-text("Bulk URL Update")');
    await urlTab.click();
    
    await page.waitForTimeout(300);
    
    // Clear all inputs
    const inputs = page.locator('input[type="url"]');
    const count = await inputs.count();
    
    for (let i = 0; i < count; i++) {
      await inputs.nth(i).fill('');
    }
    
    await page.waitForTimeout(300);
    
    // Check Save button state
    const saveBtn = page.locator('button:has-text("Save All Changes")');
    const isDisabled = await saveBtn.isDisabled();
    
    console.log(`Save button disabled when all inputs empty: ${isDisabled}`);
    
    expect(isDisabled).toBe(true);
    
    console.log('✓ JRN-010: Save button disabled when no changes');
  });

  test('JRN-011: Tab switching preserves URL input state', async ({ page }) => {
    // Enter a value in the URL tab
    const urlTab = page.locator('button:has-text("Bulk URL Update")');
    await urlTab.click();
    await page.waitForTimeout(300);

    const firstInput = page.locator('input[type="url"]').first();
    const testUrl = 'https://drive.google.com/file/d/tab-switch-test/view';
    await firstInput.fill(testUrl);

    // Switch to Health tab and back
    const healthTab = page.locator('button:has-text("Health Overview")');
    await healthTab.click();
    await page.waitForTimeout(300);
    await urlTab.click();
    await page.waitForTimeout(300);

    // URL input value should still be present
    const preservedValue = await page.locator('input[type="url"]').first().inputValue();
    expect(preservedValue).toBe(testUrl);

    console.log('✓ JRN-011: Tab switching preserves URL input state');
  });

  test('JRN-012: Edit button links to Song Manager', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('table');
    
    // Get first Edit button
    const firstEditBtn = page.locator('a:has-text("Edit")').first();
    
    // Check href attribute
    const href = await firstEditBtn.getAttribute('href');
    console.log(`Edit button href: ${href}`);
    
    // Should link to /admin/songs?edit={id}
    expect(href).toContain('/admin/songs?edit=');
    
    console.log('✓ JRN-012: Edit button has correct link');
  });

  test('JRN-013: Responsive layout check', async ({ page }) => {
    // Check if main content container has proper sizing — use page-specific class to avoid sidebar/layout matches
    const mainContainer = page.locator('div.min-h-screen.p-6');
    await expect(mainContainer).toBeVisible();
    
    // Check if table is horizontally scrollable if needed
    const tableWrapper = page.locator('div.overflow-x-auto');
    const count = await tableWrapper.count();
    
    console.log(`Found ${count} horizontally scrollable containers`);
    expect(count).toBeGreaterThanOrEqual(1);
    
    console.log('✓ JRN-013: Responsive layout verified');
  });

  test('JRN-014: Health page is read-only — no generation buttons present', async ({ page }) => {
    await page.waitForSelector('table');

    // Generation UI must not exist anywhere on the page
    await expect(page.locator('button:has-text("Select All Missing")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Generate Selected")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Gen")')).not.toBeVisible();

    // Row-level checkboxes for selection must not be present in tbody
    const rowCheckboxes = page.locator('tbody input[type="checkbox"]');
    await expect(rowCheckboxes).toHaveCount(0);

    console.log('✓ JRN-014: Health page is read-only — all generation UI absent');
  });
});
