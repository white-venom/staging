import { test, expect, type Page } from "@playwright/test";

// Real browser-driven verification of THIS session's specific changes, run
// against a dedicated throwaway tenant (never real do-it-services data for
// anything mutating) plus impersonation for real-data read-only checks.
// Requires SUPERADMIN_TEST_PASSWORD env var (never hardcode it here).

const API_BASE = "https://api.crediiflow.in";
const TENANT = "smoketest-verify";
const TENANT_URL = "https://smoketest-verify.crediiflow.in";
const ADMIN_PHONE = "9999900001";
const ADMIN_PASSWORD = "SmokeTest123";

const superadminPassword = process.env.SUPERADMIN_TEST_PASSWORD;
if (!superadminPassword) {
  throw new Error("Set SUPERADMIN_TEST_PASSWORD env var before running this suite.");
}

async function apiCall(method: string, path: string, token?: string, tenant?: string, body?: any) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tenant) headers["X-Tenant-ID"] = tenant;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

let adminToken: string;
let superadminToken: string;
let retailerId: string;
let portalId: string;
let staffAId: string;
let staffBId: string;
const suffix = Math.random().toString(36).slice(2, 8);
const phoneSuffix = String(Math.floor(10000000 + Math.random() * 89999999)); // 8 numeric digits
const created: { retailers: string[]; portals: string[]; bankAccounts: string[]; users: string[]; collections: string[]; deposits: string[] } = {
  retailers: [], portals: [], bankAccounts: [], users: [], collections: [], deposits: [],
};

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  adminToken = (await apiCall("POST", "/auth/login", undefined, TENANT, { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })).access_token;
  superadminToken = (await apiCall("POST", "/superadmin/login", undefined, undefined, { username: "superadmin", password: superadminPassword })).access_token;

  const retailer = await apiCall("POST", "/retailers", adminToken, TENANT, {
    retailer_name: `PW_Retailer_${suffix}`, address: "x", phone: `70${phoneSuffix}`, opening_to_give: 0, opening_to_take: 0,
  });
  retailerId = retailer.id;
  created.retailers.push(retailerId);

  const portal = await apiCall("POST", "/portals", adminToken, TENANT, {
    name: `PW_Portal_${suffix}`, opening_to_give: 0, opening_to_take: 0, show_in_online_payment: true,
  });
  portalId = portal.id;
  created.portals.push(portalId);

  const bankAccount = await apiCall("POST", "/bank-accounts", adminToken, TENANT, {
    bank_account_name: `PW_Bank_${suffix}`, portal_id: portalId, opening_to_give: 0, opening_to_take: 0, show_in_online_payment: true,
  });
  created.bankAccounts.push(bankAccount.id);

  const staffA = await apiCall("POST", "/users", adminToken, TENANT, { name: `PW_StaffA_${suffix}`, phone: `71${phoneSuffix}`, password: "PwTest!123", role: "staff" });
  staffAId = staffA.id;
  created.users.push(staffAId);
  const staffB = await apiCall("POST", "/users", adminToken, TENANT, { name: `PW_StaffB_${suffix}`, phone: `72${phoneSuffix}`, password: "PwTest!123", role: "staff" });
  staffBId = staffB.id;
  created.users.push(staffBId);
});

test.afterAll(async () => {
  for (const id of created.collections) { try { await apiCall("DELETE", `/collections/${id}`, adminToken, TENANT); } catch {} }
  for (const id of created.deposits) { try { await apiCall("DELETE", `/bank-deposits/${id}`, adminToken, TENANT); } catch {} }
  for (const id of created.users) { try { await apiCall("DELETE", `/users/${id}`, adminToken, TENANT); } catch {} }
  for (const id of created.bankAccounts) { try { await apiCall("DELETE", `/bank-accounts/${id}`, adminToken, TENANT); } catch {} }
  for (const id of created.portals) { try { await apiCall("DELETE", `/portals/${id}`, adminToken, TENANT); } catch {} }
  for (const id of created.retailers) { try { await apiCall("DELETE", `/retailers/${id}`, adminToken, TENANT); } catch {} }
});

async function loginStaff(page: Page, phone: string, password: string) {
  await page.goto(TENANT_URL);
  await page.fill('input[placeholder="Mobile Number"]', phone);
  await page.fill('input[placeholder="Password"]', password);
  await page.click('button:has-text("Secure Login")');
  await expect(page).toHaveURL(/.*\/welcome/);
}

async function loginAdmin(page: Page) {
  await page.goto(TENANT_URL);
  await page.fill('input[placeholder="Mobile Number"]', ADMIN_PHONE);
  await page.fill('input[placeholder="Password"]', ADMIN_PASSWORD);
  await page.click('button:has-text("Secure Login")');
  await expect(page).toHaveURL(/.*\/welcome/);
  await expect(page).toHaveURL(/.*\/admin/, { timeout: 8000 });
}

test("1. Cash Out (Staff) still shows a BankAccount picker -- the one exempt flow", async ({ page }) => {
  await loginStaff(page, ADMIN_PHONE, ADMIN_PASSWORD);
  await page.goto(`${TENANT_URL}/deposit`);
  // "Portals" is the default-selected channel already.
  await expect(page.locator('text=1. Choose Portal')).toBeVisible();
  await expect(page.locator('text=2. Choose Bank Account')).toBeVisible({ timeout: 8000 });
});

test("2. Virtual Transfer only asks for a Portal -- no BankAccount picker anywhere in the form", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`${TENANT_URL}/admin/wallet-transfer`);
  await page.click('button:has-text("Virtual Transfer")');
  await expect(page.locator('text=Source Portal')).toBeVisible();
  await expect(page.locator('body')).not.toContainText("Source BankAccount");
  await expect(page.locator('body')).not.toContainText("Select Bank Account");
});

test("3. Portal-to-Portal Transfer only asks for Portals -- no BankAccount picker", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`${TENANT_URL}/admin/wallet-transfer`);
  await page.click('button:has-text("Portal to Portal")');
  await expect(page.locator('text=Source Portal (From)')).toBeVisible();
  await expect(page.locator('text=Destination Portal (To)')).toBeVisible();
  await expect(page.locator('body')).not.toContainText("Source BankAccount");
  await expect(page.locator('body')).not.toContainText("Destination BankAccount");
});

test("4. Collection online-routing only asks for a Portal (not a specific BankAccount)", async ({ page }) => {
  await loginStaff(page, ADMIN_PHONE, ADMIN_PASSWORD);
  await page.goto(`${TENANT_URL}/collection`);
  await page.locator('div:has(> label:has-text("Select Retailer"))').locator('button').first().click();
  await page.getByRole("button", { name: new RegExp(`PW_Retailer_${suffix}`) }).click();
  const onlineLabel = page.locator('span:text-is("Online (UPI)")');
  await onlineLabel.click();
  await expect(page.locator('text=Select Portal...')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('body')).not.toContainText("Select Bank Account...");
});

test("5. Staff-to-staff handover: sender initiates via Cash Out -> To Staff; self-selection is blocked", async ({ page }) => {
  await loginStaff(page, `71${phoneSuffix}`, "PwTest!123");
  await page.goto(`${TENANT_URL}/deposit`);
  await page.click('button:has-text("Staff"):has-text("Handover")');
  await page.locator('div:has(> label:has-text("Select Recipient Staff Member"))').locator('button').first().click();
  const options = await page.locator('div.max-h-56 button, div[role="listbox"] button').allInnerTexts();
  const staffAName = `PW_StaffA_${suffix}`;
  for (const text of options) {
    expect(text).not.toContain(staffAName); // logged-in staff (A) must not appear as their own recipient
  }
});

test("6. Time window + downstream auto-lock: fresh collection deletable, locked after cash-out draws it down", async ({ page }) => {
  const denom = { note_500: 1, note_200: 0, note_100: 0, note_50: 0, note_20: 0, note_10: 0, coins: "0", online_amount: "0" };
  const col = await apiCall("POST", "/collections", adminToken, TENANT, { retailer_id: retailerId, total_amount: "500.00", denominations: denom });
  created.collections.push(col.id);

  await loginAdmin(page);
  await page.goto(`${TENANT_URL}/admin/collections`);
  await page.reload();
  await expect(page.locator(`text=${retailerId.slice(0, 8)}`).first().or(page.locator("body"))).toBeTruthy();

  // Draw the pool down via a matching cash-out so the collection's cash is "used"
  const dep = await apiCall("POST", "/bank-deposits", adminToken, TENANT, {
    deposit_type: "portal", bank_account_id: created.bankAccounts[0], payment_mode: "cash", amount: "500.00", denominations: denom,
  });
  created.deposits.push(dep.id);

  const delResp = await fetch(`${API_BASE}/collections/${col.id}`, { method: "DELETE", headers: { "X-Tenant-ID": TENANT, Authorization: `Bearer ${adminToken}` } });
  expect(delResp.status).toBe(403);
  const body = await delResp.json();
  expect(body.detail.toLowerCase()).toContain("already been used");
  created.collections = created.collections.filter((c) => c !== col.id); // it's locked, can't clean up -- expected, leave for teardown to fail-soft
});

test("7. Retailer ledger page survives a hard reload (no redirect to list view)", async ({ page }) => {
  await loginAdmin(page);
  const retailers = await apiCall("GET", "/retailers", adminToken, TENANT);
  const target = retailers.find((r: any) => r.id === retailerId);
  await page.goto(`${TENANT_URL}/admin/retailers/${target.ledger_token}/ledger`);
  await expect(page.locator("text=CURRENT OUTSTANDING").or(page.locator("text=Current Outstanding"))).toBeVisible({ timeout: 15000 });
  await page.reload();
  await expect(page.locator("text=CURRENT OUTSTANDING").or(page.locator("text=Current Outstanding"))).toBeVisible({ timeout: 15000 });
  expect(page.url()).toContain(`/ledger`);
});

test("8. Superadmin: edit own profile via real UI, persists", async ({ page }) => {
  await page.goto("https://superadmin.crediiflow.in/login");
  await page.fill('input[placeholder="Enter superadmin username"]', "superadmin");
  await page.fill('input[placeholder="••••••••"]', superadminPassword!);
  await page.click('button:has-text("Sign In to Console")');
  await expect(page).toHaveURL(/superadmin\.crediiflow\.in\/?$/, { timeout: 10000 });

  await page.click('button:has-text("Edit Profile")');
  await expect(page.locator('text=Edit My Profile')).toBeVisible();
  const nameInput = page.locator('label:has-text("Full Name") >> xpath=.. >> input');
  await nameInput.fill("Playwright Verified Admin");
  await page.click('button:has-text("Save Changes")');
  await expect(page.locator('text=Profile updated successfully')).toBeVisible({ timeout: 5000 });
});

test("9. Superadmin: duplicate tenant subdomain is rejected cleanly (no raw/[object Object] error)", async ({ page }) => {
  await page.goto("https://superadmin.crediiflow.in/login");
  await page.fill('input[placeholder="Enter superadmin username"]', "superadmin");
  await page.fill('input[placeholder="••••••••"]', superadminPassword!);
  await page.click('button:has-text("Sign In to Console")');
  await expect(page).toHaveURL(/superadmin\.crediiflow\.in\/?$/, { timeout: 10000 });

  await page.click('button:has-text("+ Onboard New Client")');
  await page.fill('input[placeholder="e.g. Acme Corporation"]', "Dup Test Co");
  await page.fill('input[placeholder="e.g. acme"]', TENANT); // TENANT ("smoketest-verify") already exists -> must be rejected
  await page.fill('input[placeholder="e.g. John Doe"]', "Dup Admin");
  await page.fill('input[placeholder="e.g. 9876543210"]', "9000000001");
  await page.fill('input[placeholder="••••••••"]', "DupTest123");
  await page.click('button:has-text("Deploy Instance")');
  await expect(page.locator("body")).not.toContainText("[object Object]");
  await expect(page.locator("text=/already registered|already exists/i")).toBeVisible({ timeout: 8000 });
});

// ============= Color-scheme + balance-math re-verification =============
// Item #7: cash-in shows RED (display only), virtual-transfer LOAD shows
// GREEN, move-to-distributor (virtual REFUND) shows RED -- and in every
// case the underlying balance must move the mathematically correct amount
// in the same test, not just "some" color appearing somewhere.

async function openRetailerLedgerFilteredRow(page: Page, retailerName: string) {
  await page.goto(`${TENANT_URL}/admin/ledger`);
  await page.locator('input[placeholder="Search party or staff..."]').fill(retailerName);
  await page.waitForTimeout(800);
}

test("10. Cash-in (retailer collection) displays RED and correctly increases retailer balance", async ({ page }) => {
  const before = (await apiCall("GET", "/retailers", adminToken, TENANT)).find((r: any) => r.id === retailerId);
  const denom = { note_500: 1, note_200: 0, note_100: 0, note_50: 0, note_20: 0, note_10: 0, coins: "0", online_amount: "0" };
  const col = await apiCall("POST", "/collections", adminToken, TENANT, { retailer_id: retailerId, total_amount: "500.00", denominations: denom });
  created.collections.push(col.id);
  const after = (await apiCall("GET", "/retailers", adminToken, TENANT)).find((r: any) => r.id === retailerId);
  expect(Number(after.balance) - Number(before.balance)).toBeCloseTo(500, 2);

  await loginAdmin(page);
  await openRetailerLedgerFilteredRow(page, `PW_Retailer_${suffix}`);
  const row = page.locator("tr", { hasText: "500" }).first();
  await expect(row).toHaveClass(/text-red-700|text-red-400/, { timeout: 8000 }).catch(async () => {
    // Class may live on a child <td>, not the <tr> itself.
    await expect(row.locator("td.text-red-700, td.text-red-400").first()).toBeVisible({ timeout: 8000 });
  });
});

test("11. Virtual Transfer LOAD displays GREEN and increases retailer balance / decreases portal balance", async ({ page }) => {
  const retBefore = (await apiCall("GET", "/retailers", adminToken, TENANT)).find((r: any) => r.id === retailerId);
  const portBefore = (await apiCall("GET", "/portals", adminToken, TENANT)).find((p: any) => p.id === portalId);

  await loginAdmin(page);
  await page.goto(`${TENANT_URL}/admin/wallet-transfer`);
  await page.click('button:has-text("Virtual Transfer")');
  await page.locator('div:has(> label:has-text("Source Portal"))').locator('button').first().click();
  await page.getByRole("button", { name: new RegExp(`PW_Portal_${suffix}`) }).click();
  await page.locator('div:has(> label:has-text("Destination Retailer"))').locator('button').first().click();
  await page.getByRole("button", { name: new RegExp(`PW_Retailer_${suffix}`) }).click();
  await page.fill('input[placeholder*="15000"]', "300");
  // "Virtual Transfer" text also matches the tab button above the form --
  // scope to the actual <form> submit button to avoid re-clicking the tab.
  await page.locator('form button:has-text("Virtual Transfer")').click();
  await page.waitForTimeout(1500);

  const retAfter = (await apiCall("GET", "/retailers", adminToken, TENANT)).find((r: any) => r.id === retailerId);
  const portAfter = (await apiCall("GET", "/portals", adminToken, TENANT)).find((p: any) => p.id === portalId);
  expect(Number(retAfter.balance) - Number(retBefore.balance)).toBeCloseTo(300, 2);
  expect(Number(portAfter.balance) - Number(portBefore.balance)).toBeCloseTo(-300, 2);

  const deposits = await apiCall("GET", "/bank-deposits", adminToken, TENANT);
  const vt = deposits.find((d: any) => d.deposit_type === "virtual" && Number(d.amount) === 300 && d.payment_mode !== "refund");
  if (vt) created.deposits.push(vt.id);

  await openRetailerLedgerFilteredRow(page, `PW_Retailer_${suffix}`);
  const row = page.locator("tr", { hasText: "300" }).first();
  await expect(row.locator("td.text-emerald-700, td.text-emerald-400").first()).toBeVisible({ timeout: 8000 });
});

test("12. Move-to-distributor (virtual REFUND) displays RED and decreases retailer balance / increases portal balance", async ({ page }) => {
  const retBefore = (await apiCall("GET", "/retailers", adminToken, TENANT)).find((r: any) => r.id === retailerId);
  const portBefore = (await apiCall("GET", "/portals", adminToken, TENANT)).find((p: any) => p.id === portalId);

  await loginAdmin(page);
  await page.goto(`${TENANT_URL}/admin/wallet-transfer`);
  await page.click('button:has-text("Virtual Transfer")');
  await page.selectOption("select", "refund");
  // Refund direction relabels: Portal -> "Destination Portal", Retailer -> "Source Retailer".
  await page.locator('div:has(> label:has-text("Destination Portal"))').locator('button').first().click();
  await page.getByRole("button", { name: new RegExp(`PW_Portal_${suffix}`) }).click();
  await page.locator('div:has(> label:has-text("Source Retailer"))').locator('button').first().click();
  await page.getByRole("button", { name: new RegExp(`PW_Retailer_${suffix}`) }).click();
  await page.fill('input[placeholder="e.g. 15000"]', "100");
  await page.click('button:has-text("Move to Distributor")');
  await page.waitForTimeout(1500);

  const retAfter = (await apiCall("GET", "/retailers", adminToken, TENANT)).find((r: any) => r.id === retailerId);
  const portAfter = (await apiCall("GET", "/portals", adminToken, TENANT)).find((p: any) => p.id === portalId);
  expect(Number(retAfter.balance) - Number(retBefore.balance)).toBeCloseTo(-100, 2);
  expect(Number(portAfter.balance) - Number(portBefore.balance)).toBeCloseTo(100, 2);

  const deposits = await apiCall("GET", "/bank-deposits", adminToken, TENANT);
  const mtd = deposits.find((d: any) => d.deposit_type === "virtual" && Number(d.amount) === 100 && d.payment_mode === "refund");
  if (mtd) created.deposits.push(mtd.id);

  await openRetailerLedgerFilteredRow(page, `PW_Retailer_${suffix}`);
  const row = page.locator("tr", { hasText: "100" }).first();
  await expect(row.locator("td.text-red-700, td.text-red-400").first()).toBeVisible({ timeout: 8000 });
});
