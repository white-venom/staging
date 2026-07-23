"""
End-to-end smoke tests for the core money-affecting flows: login, collections,
bank deposits, virtual transfers, staff handovers, and the backdating/denomination
guard rails.

Runs against a live API (local dev server or a deployed environment) over HTTP,
using dedicated test fixtures (retailer/staff/bank account/portal, all prefixed
SMOKE_TEST_) so it never touches real data. The test retailer and staff are
created with no phone/email, so the WhatsApp/email notification code paths in
collections.py and deposits.py never fire against a real contact.

Everything created is deleted at the end, in dependency order, regardless of
whether earlier assertions failed (best-effort cleanup).

Usage:
    python scripts/smoke_test_money_flows.py --tenant do-it-services \
        --base-url https://api.crediiflow.in \
        --admin-phone 7900671145 --admin-password pass123

Requires an existing ADMIN account on the target tenant (used to create the
throwaway test staff/retailer/bank-account/portal fixtures and to run the
admin-only virtual transfer). No default tenant/credentials are baked in --
both must be supplied explicitly.
"""
import argparse
import random
import sys
import uuid
from decimal import Decimal

import requests


class SmokeTestFailure(Exception):
    pass


class Client:
    def __init__(self, base_url: str, tenant: str):
        self.base_url = base_url.rstrip("/")
        self.tenant = tenant
        self.session = requests.Session()
        # do-it-services currently runs with maintenance_mode=true, which 403/503s
        # every non-admin request. Admins bypass it automatically; this header lets
        # the throwaway test staff accounts bypass it too, without touching the
        # tenant's real maintenance flag (left on intentionally by the operator).
        self.session.headers.update({"X-Tenant-ID": tenant, "X-Maintenance-Bypass": "true"})

    def login(self, phone: str, password: str) -> str:
        r = self.session.post(f"{self.base_url}/auth/login", json={"phone": phone, "password": password})
        if r.status_code != 200:
            raise SmokeTestFailure(f"Login failed for {phone}: {r.status_code} {r.text}")
        token = r.json()["access_token"]
        return token

    def as_user(self, token: str) -> "Client":
        c = Client(self.base_url, self.tenant)
        c.session.headers.update({"Authorization": f"Bearer {token}"})
        return c

    def request(self, method: str, path: str, **kwargs) -> requests.Response:
        return self.session.request(method, f"{self.base_url}{path}", **kwargs)


def check(condition: bool, message: str):
    if not condition:
        raise SmokeTestFailure(message)


def zero_denom(total_amount, online_amount=None):
    """Build a denomination dict that sums exactly to total_amount using only note_100s + a remainder in coins."""
    total = Decimal(str(total_amount))
    online = Decimal(str(online_amount)) if online_amount is not None else Decimal("0.00")
    cash = total - online
    note_100 = int(cash // 100)
    remainder = cash - (note_100 * 100)
    return {
        "note_500": 0, "note_200": 0, "note_100": note_100, "note_50": 0,
        "note_20": 0, "note_10": 0, "coins": str(remainder), "online_amount": str(online),
    }


class SmokeTest:
    def __init__(self, base_url: str, tenant: str, admin_phone: str, admin_password: str):
        self.tenant = tenant
        self.anon = Client(base_url, tenant)
        admin_token = self.anon.login(admin_phone, admin_password)
        self.admin = self.anon.as_user(admin_token)

        self.suffix = uuid.uuid4().hex[:8]
        self.digit_suffix = "".join(random.choices("0123456789", k=8))
        self.created = {
            "collections": [], "deposits": [], "retailers": [], "bank_accounts": [],
            "portals": [], "users": [],
        }
        self.results = []

        # Fixtures, populated in setup()
        self.staff = None       # primary staff client + id
        self.staff2 = None      # second staff, for handover test
        self.portal_id = None
        self.bank_account_id = None
        self.retailer_id = None

    # ---------- bookkeeping helpers ----------

    def record(self, name: str, passed: bool, detail: str = ""):
        self.results.append((name, passed, detail))
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {name}" + (f" -- {detail}" if detail else ""))

    def run_step(self, name: str, fn):
        try:
            fn()
            self.record(name, True)
        except SmokeTestFailure as e:
            self.record(name, False, str(e))
        except Exception as e:
            self.record(name, False, f"unexpected error: {e!r}")

    # ---------- fixture setup / teardown ----------

    def setup(self):
        # Test staff user (no need for a real phone to receive anything -- staff
        # phones are never used for outbound notifications in this app).
        staff_phone = f"9{self.digit_suffix}1"
        r = self.admin.request("POST", "/users", json={
            "name": f"SMOKE_TEST_staff_{self.suffix}",
            "phone": staff_phone,
            "password": "SmokeTest!123",
            "role": "staff",
        })
        check(r.status_code == 201, f"create staff failed: {r.status_code} {r.text}")
        staff_id = r.json()["id"]
        self.created["users"].append(staff_id)
        staff_token = self.anon.login(staff_phone, "SmokeTest!123")
        self.staff = {"id": staff_id, "phone": staff_phone, "client": self.anon.as_user(staff_token)}

        staff2_phone = f"8{self.digit_suffix}2"
        r = self.admin.request("POST", "/users", json={
            "name": f"SMOKE_TEST_staff2_{self.suffix}",
            "phone": staff2_phone,
            "password": "SmokeTest!123",
            "role": "staff",
        })
        check(r.status_code == 201, f"create staff2 failed: {r.status_code} {r.text}")
        staff2_id = r.json()["id"]
        self.created["users"].append(staff2_id)
        staff2_token = self.anon.login(staff2_phone, "SmokeTest!123")
        self.staff2 = {"id": staff2_id, "phone": staff2_phone, "client": self.anon.as_user(staff2_token)}

        # Portal (grouping) + bank account under it
        r = self.admin.request("POST", "/portals", json={
            "name": f"SMOKE_TEST_portal_{self.suffix}",
            "opening_to_give": 0.0, "opening_to_take": 0.0, "show_in_online_payment": False,
        })
        check(r.status_code == 201, f"create portal failed: {r.status_code} {r.text}")
        self.portal_id = r.json()["id"]
        self.created["portals"].append(self.portal_id)

        r = self.admin.request("POST", "/bank-accounts", json={
            "bank_account_name": f"SMOKE_TEST_bank_{self.suffix}",
            "portal_id": self.portal_id,
            "opening_to_give": 0.0, "opening_to_take": 0.0,
            "show_in_online_payment": False,
        })
        check(r.status_code == 201, f"create bank account failed: {r.status_code} {r.text}")
        self.bank_account_id = r.json()["id"]
        self.created["bank_accounts"].append(self.bank_account_id)

        # Retailer -- no email, and a phone that is structurally invalid (all
        # zeros) so no real WhatsApp/email notification can ever be delivered.
        # NOTE: retailers.phone is NOT NULL at the DB level even though the
        # Pydantic schema marks it Optional -- omitting it entirely 500s (see
        # audit findings), so a placeholder value is required here.
        r = self.admin.request("POST", "/retailers", json={
            "retailer_name": f"SMOKE_TEST_retailer_{self.suffix}",
            "address": "Smoke Test Address",
            "phone": f"000{self.digit_suffix}",
            "opening_to_give": 0.0, "opening_to_take": 0.0,
        })
        check(r.status_code == 201, f"create retailer failed: {r.status_code} {r.text}")
        self.retailer_id = r.json()["id"]
        self.created["retailers"].append(self.retailer_id)

    def teardown(self):
        print("\n--- cleanup ---")
        for dep_id in self.created["deposits"]:
            r = self.admin.request("DELETE", f"/bank-deposits/{dep_id}")
            print(f"delete deposit {dep_id}: {r.status_code}")
        for col_id in self.created["collections"]:
            r = self.admin.request("DELETE", f"/collections/{col_id}")
            print(f"delete collection {col_id}: {r.status_code}")
        for ret_id in self.created["retailers"]:
            r = self.admin.request("DELETE", f"/retailers/{ret_id}")
            print(f"delete retailer {ret_id}: {r.status_code}")
        for ba_id in self.created["bank_accounts"]:
            r = self.admin.request("DELETE", f"/bank-accounts/{ba_id}")
            print(f"delete bank_account {ba_id}: {r.status_code}")
        for p_id in self.created["portals"]:
            r = self.admin.request("DELETE", f"/portals/{p_id}")
            print(f"delete portal {p_id}: {r.status_code}")
        for u_id in self.created["users"]:
            r = self.admin.request("DELETE", f"/users/{u_id}")
            detail = "" if r.status_code == 204 else f" -- {r.text}"
            print(f"delete user {u_id}: {r.status_code}{detail}")

    # ---------- scenarios ----------

    def get_retailer_balance(self) -> Decimal:
        r = self.admin.request("GET", "/retailers")
        check(r.status_code == 200, f"list retailers failed: {r.status_code}")
        for ret in r.json():
            if ret["id"] == self.retailer_id:
                return Decimal(str(ret["balance"]))
        raise SmokeTestFailure("test retailer not found in list")

    def get_bank_account_balance(self) -> Decimal:
        # Item #8 consolidated per-BankAccount balance tracking into the parent
        # Portal -- BankAccountResponse no longer carries a `balance` field at
        # all, so the only source of truth for "did this deposit move money"
        # is the owning Portal's balance now.
        r = self.admin.request("GET", "/portals")
        check(r.status_code == 200, f"list portals failed: {r.status_code}")
        for p in r.json():
            if p["id"] == self.portal_id:
                return Decimal(str(p["balance"]))
        raise SmokeTestFailure("test portal not found in list")

    def scenario_login(self):
        # Already exercised in setup() via admin+staff logins; assert /auth/me works too.
        r = self.staff["client"].request("GET", "/auth/me")
        check(r.status_code == 200, f"/auth/me failed: {r.status_code} {r.text}")
        check(r.json()["phone"] == self.staff["phone"], "logged-in identity mismatch")

    def scenario_collection_cash_in(self):
        before = self.get_retailer_balance()
        amount = Decimal("500.00")
        payload = {
            "retailer_id": self.retailer_id,
            "total_amount": str(amount),
            "denominations": zero_denom(amount),
        }
        r = self.staff["client"].request("POST", "/collections", json=payload)
        check(r.status_code == 201, f"create collection failed: {r.status_code} {r.text}")
        col = r.json()
        self.created["collections"].append(col["id"])
        check(Decimal(str(col["denominations"]["note_100"])) * 100
              + Decimal(str(col["denominations"]["coins"])) == amount,
              "denomination sum mismatch in response")
        after = self.get_retailer_balance()
        check(after - before == amount, f"retailer balance should increase by {amount}, moved {after - before}")

    def scenario_bank_deposit_cash_out(self):
        before = self.get_bank_account_balance()
        amount = Decimal("300.00")
        payload = {
            "deposit_type": "portal",
            "bank_account_id": self.bank_account_id,
            "payment_mode": "cash",
            "amount": str(amount),
            "denominations": zero_denom(amount),
        }
        r = self.staff["client"].request("POST", "/bank-deposits", json=payload)
        check(r.status_code == 201, f"create bank deposit failed: {r.status_code} {r.text}")
        dep = r.json()
        self.created["deposits"].append(dep["id"])
        after = self.get_bank_account_balance()
        check(after - before == amount, f"bank account balance should increase by {amount}, moved {after - before}")

    def scenario_virtual_transfer(self):
        ba_before = self.get_bank_account_balance()
        ret_before = self.get_retailer_balance()
        amount = Decimal("150.00")
        payload = {
            "deposit_type": "virtual",
            "bank_account_id": self.bank_account_id,
            "retailer_id": self.retailer_id,
            "payment_mode": "cash",
            "amount": str(amount),
        }
        # Admin-only endpoint.
        r = self.admin.request("POST", "/bank-deposits", json=payload)
        check(r.status_code == 201, f"virtual transfer failed: {r.status_code} {r.text}")
        dep = r.json()
        self.created["deposits"].append(dep["id"])
        ba_after = self.get_bank_account_balance()
        ret_after = self.get_retailer_balance()
        check(ba_before - ba_after == amount, f"bank account should decrease by {amount}, moved {ba_before - ba_after}")
        check(ret_after - ret_before == amount, f"retailer should increase by {amount}, moved {ret_after - ret_before}")

    def scenario_staff_handover(self):
        amount = Decimal("200.00")
        payload = {
            "from_staff_id": self.staff2["id"],
            "total_amount": str(amount),
            "denominations": zero_denom(amount),
        }
        # staff (recipient) submits the collection recording money received from staff2.
        r = self.staff["client"].request("POST", "/collections", json=payload)
        check(r.status_code == 201, f"handover collection failed: {r.status_code} {r.text}")
        col = r.json()
        self.created["collections"].append(col["id"])
        check(col.get("mirror_deposit_id"), "handover collection missing mirror_deposit_id link")

        mirror_id = col["mirror_deposit_id"]
        r = self.admin.request("GET", "/bank-deposits")
        check(r.status_code == 200, f"list deposits failed: {r.status_code}")
        mirror = next((d for d in r.json() if d["id"] == mirror_id), None)
        check(mirror is not None, "mirrored BankDeposit not found")
        check(mirror["staff_id"] == self.staff2["id"], "mirror deposit sender mismatch")
        check(mirror["recipient_staff_id"] == self.staff["id"], "mirror deposit recipient mismatch")
        check(Decimal(str(mirror["amount"])) == amount, "mirror deposit amount mismatch")
        # Note: the mirror deposit is deleted automatically when its linked
        # collection is deleted (collections.py delete_collection), so it does
        # not need a separate cleanup entry.

    def scenario_backdated_rejected(self):
        import datetime
        # Don't assume the flag's value -- it's a real per-tenant business
        # setting an operator may have deliberately turned on, not a fixed
        # default. Assert against whatever it actually is right now.
        settings_r = self.admin.request("GET", "/admin-settings/business")
        check(settings_r.status_code == 200, f"fetch business settings failed: {settings_r.status_code} {settings_r.text}")
        staff_can_change_date = bool(settings_r.json().get("staff_can_change_collection_date"))

        yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        amount = Decimal("50.00")
        payload = {
            "retailer_id": self.retailer_id,
            "total_amount": str(amount),
            "collection_date": yesterday,
            "denominations": zero_denom(amount),
        }
        r = self.staff["client"].request("POST", "/collections", json=payload)
        if staff_can_change_date:
            check(r.status_code == 201,
                  f"staff_can_change_collection_date is ON for this tenant, expected the backdated collection to succeed, got {r.status_code}: {r.text}")
            self.created["collections"].append(r.json()["id"])
        else:
            check(r.status_code == 403,
                  f"staff_can_change_collection_date is OFF for this tenant, expected 403, got {r.status_code}: {r.text}")
            check("backdat" in r.text.lower(), f"expected a clear backdating error message, got: {r.text}")

    def scenario_denomination_mismatch_rejected(self):
        payload = {
            "retailer_id": self.retailer_id,
            "total_amount": "1000.00",
            "denominations": {
                "note_500": 1, "note_200": 0, "note_100": 0, "note_50": 0,
                "note_20": 0, "note_10": 0, "coins": "0.00", "online_amount": "0.00",
            },  # sums to 500, not 1000
        }
        r = self.staff["client"].request("POST", "/collections", json=payload)
        check(r.status_code == 422,
              f"expected 422 validation error for denomination mismatch, got {r.status_code}: {r.text}")

    def scenario_cash_in_hand_denomination_offset(self):
        """Regression test for the 2026-07-18 QA finding: GET /staff/cash-in-hand used to
        clamp each note denomination independently to max(0, collected - deposited), so a
        surplus in one denomination could never offset a shortfall in another. Collecting
        Rs.500 as a single note_500 and then depositing that exact Rs.500 back out as five
        note_100s (routine bank note-exchange) used to still show Rs.500 "in pocket" --
        this must now net to exactly zero change."""
        r = self.staff["client"].request("GET", "/staff/cash-in-hand")
        check(r.status_code == 200, f"get cash-in-hand (before) failed: {r.status_code} {r.text}")
        before = Decimal(str(r.json()["total_pocket_cash"]))

        amount = Decimal("500.00")
        r = self.staff["client"].request("POST", "/collections", json={
            "retailer_id": self.retailer_id,
            "total_amount": str(amount),
            "denominations": {
                "note_500": 1, "note_200": 0, "note_100": 0, "note_50": 0,
                "note_20": 0, "note_10": 0, "coins": "0.00", "online_amount": "0.00",
            },
        })
        check(r.status_code == 201, f"collect Rs.500 as 1x note_500 failed: {r.status_code} {r.text}")
        self.created["collections"].append(r.json()["id"])

        r = self.staff["client"].request("POST", "/bank-deposits", json={
            "deposit_type": "portal", "bank_account_id": self.bank_account_id, "payment_mode": "cash",
            "amount": str(amount),
            "denominations": {
                "note_500": 0, "note_200": 0, "note_100": 5, "note_50": 0,
                "note_20": 0, "note_10": 0, "coins": "0.00", "online_amount": "0.00",
            },
        })
        check(r.status_code == 201, f"deposit the same Rs.500 as 5x note_100 failed: {r.status_code} {r.text}")
        self.created["deposits"].append(r.json()["id"])

        r = self.staff["client"].request("GET", "/staff/cash-in-hand")
        check(r.status_code == 200, f"get cash-in-hand (after) failed: {r.status_code} {r.text}")
        after = Decimal(str(r.json()["total_pocket_cash"]))
        check(after == before,
              f"cash-in-hand should be unchanged (net zero) after collecting Rs.500 then depositing that exact "
              f"Rs.500 back out with a different note mix: before={before}, after={after}")

    def scenario_online_routing_deposit_link(self):
        """Regression test for the 2026-07-18 audit finding: the auto-created
        online-payment-routing BankDeposit had no FK back to its Collection, only
        coincidence-matching by bank_account_id/staff_id/amount/date. If that deposit
        was ever edited directly (bypassing the Collection), deleting the Collection
        would silently fail to find it and leave the bank_account balance un-reversed.
        Collection.online_routing_deposit_id now makes this lookup exact."""
        amount = Decimal("1000.00")
        online_amount = Decimal("500.00")
        payload = {
            "retailer_id": self.retailer_id,
            "bank_account_id": self.bank_account_id,
            "total_amount": str(amount),
            "denominations": zero_denom(amount, online_amount),
        }
        r = self.admin.request("POST", "/collections", json=payload)
        check(r.status_code == 201, f"create collection with online routing failed: {r.status_code} {r.text}")
        col = r.json()
        self.created["collections"].append(col["id"])
        check(col.get("online_routing_deposit_id"), "collection missing online_routing_deposit_id FK")
        routing_dep_id = col["online_routing_deposit_id"]

        r = self.admin.request("GET", "/bank-deposits")
        check(r.status_code == 200, f"list deposits failed: {r.status_code}")
        routing_dep = next((d for d in r.json() if d["id"] == routing_dep_id), None)
        check(routing_dep is not None, "linked online-routing deposit not found via FK")
        check(Decimal(str(routing_dep["amount"])) == online_amount, "routing deposit amount mismatch")

        ba_before = self.get_bank_account_balance()

        # Edit the routing deposit DIRECTLY (bypassing the Collection) -- exactly the
        # scenario that used to break the old coincidence-match lookup, since the
        # deposit's amount no longer equals collection.denominations.online_amount.
        new_online_amount = Decimal("750.00")
        r = self.admin.request("PUT", f"/bank-deposits/{routing_dep_id}", json={
            "deposit_type": "portal", "bank_account_id": self.bank_account_id, "payment_mode": "online",
            "amount": str(new_online_amount), "deposit_date": col["collection_date"],
            "denominations": zero_denom(new_online_amount, new_online_amount),
        })
        check(r.status_code == 200, f"direct edit of routing deposit failed: {r.status_code} {r.text}")
        ba_after_edit = self.get_bank_account_balance()
        check(ba_after_edit - ba_before == (new_online_amount - online_amount),
              f"bank account should move by {new_online_amount - online_amount}, moved {ba_after_edit - ba_before}")

        # Delete the Collection. With the FK, this must find the (now coincidence-
        # mismatched) deposit via online_routing_deposit_id and correctly reverse the
        # CURRENT bank_account balance (750), not silently leave it un-reversed.
        r = self.admin.request("DELETE", f"/collections/{col['id']}")
        check(r.status_code == 204, f"delete collection failed: {r.status_code} {r.text}")
        self.created["collections"].remove(col["id"])

        ba_after_delete = self.get_bank_account_balance()
        expected_reversal = ba_after_edit - new_online_amount
        check(ba_after_delete == expected_reversal,
              f"bank account balance did not correctly reverse via FK lookup after delete: "
              f"expected {expected_reversal}, got {ba_after_delete}")

        r = self.admin.request("GET", "/bank-deposits")
        still_exists = any(d["id"] == routing_dep_id for d in r.json())
        check(not still_exists, "online-routing deposit was not deleted alongside its Collection")

    def run(self):
        self.run_step("setup fixtures", self.setup)
        self.run_step("1. login as staff/admin", self.scenario_login)
        self.run_step("2. collection (cash-in) moves retailer balance +", self.scenario_collection_cash_in)
        self.run_step("3. bank deposit (cash-out) moves bank account balance +", self.scenario_bank_deposit_cash_out)
        self.run_step("4. virtual transfer moves bank account - / retailer +", self.scenario_virtual_transfer)
        self.run_step("5. staff-to-staff handover mirrors correctly", self.scenario_staff_handover)
        self.run_step("6. backdated entry rejected when staff flag is off", self.scenario_backdated_rejected)
        self.run_step("7. denomination/amount mismatch rejected", self.scenario_denomination_mismatch_rejected)
        self.run_step("8. cash-in-hand nets denomination offset correctly (no per-type clamp)", self.scenario_cash_in_hand_denomination_offset)
        self.run_step("9. online-routing deposit FK survives independent edit + collection delete", self.scenario_online_routing_deposit_link)
        self.teardown()

        print("\n--- summary ---")
        failed = [r for r in self.results if not r[1]]
        for name, passed, detail in self.results:
            print(f"{'PASS' if passed else 'FAIL'}: {name}")
        print(f"\n{len(self.results) - len(failed)}/{len(self.results)} passed")
        return len(failed) == 0


def main():
    parser = argparse.ArgumentParser(description="Smoke-test core money-affecting flows against a live API.")
    parser.add_argument("--tenant", required=True, help="Tenant subdomain to test against. No default -- must be explicit.")
    parser.add_argument("--base-url", required=True, help="Base URL of the API, e.g. https://api.crediiflow.in or http://localhost:8000")
    parser.add_argument("--admin-phone", required=True, help="Phone number of an existing admin user on this tenant.")
    parser.add_argument("--admin-password", required=True, help="Password for the admin user.")
    args = parser.parse_args()

    test = SmokeTest(args.base_url, args.tenant, args.admin_phone, args.admin_password)
    ok = test.run()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
