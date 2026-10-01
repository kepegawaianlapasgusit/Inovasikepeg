"""
INFORMASI KEPEGAWAIAN LAGUSIT - End-to-end backend API test.
Covers: auth, RBAC, master data, employee CRUD, attendance apel flow (event,
batch records, duplicate prevention, correction, note, documentation),
summaries, KGB/Promotion status, announcements/notifications, agenda,
evaluation, generic record modules, dashboard, audit, search.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://lagusit-monitoring.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "kepegawaianlapasgusit@gmail.com"
ADMIN_PASSWORD = "Admin123!"

# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def ctx(client):
    """Shared context: master IDs."""
    types = client.get(f"{BASE_URL}/api/master/attendance_types").json()
    statuses = client.get(f"{BASE_URL}/api/master/attendance_statuses").json()
    emps = client.get(f"{BASE_URL}/api/employees?limit=5").json()["items"]
    return {"types": types, "statuses": statuses, "employees": emps}


# ---------------- auth ----------------
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["token_type"] == "bearer"
        assert d["user"]["email"] == ADMIN_EMAIL

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_super_wildcard_and_menu(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["is_super"] is True
        assert d["permissions"] == ["*"]
        assert len(d["menu"]) == 19

    def test_protected_without_token(self):
        r = requests.get(f"{BASE_URL}/api/employees")
        assert r.status_code == 401

    def test_protected_bad_token(self):
        r = requests.get(f"{BASE_URL}/api/employees", headers={"Authorization": "Bearer abc"})
        assert r.status_code == 401


# ---------------- master data ----------------
class TestMaster:
    @pytest.mark.parametrize("name", [
        "organizational_units", "sections", "positions", "grades", "teams",
        "attendance_types", "attendance_statuses", "categories"
    ])
    def test_list(self, client, name):
        r = client.get(f"{BASE_URL}/api/master/{name}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_crud_organizational_unit(self, client):
        r = client.post(f"{BASE_URL}/api/master/organizational_units",
                        json={"data": {"name": "TEST_Unit", "type": "unit"}})
        assert r.status_code == 200
        unit_id = r.json()["id"]
        # update
        r2 = client.put(f"{BASE_URL}/api/master/organizational_units/{unit_id}",
                        json={"data": {"name": "TEST_Unit_Edit", "type": "unit"}})
        assert r2.status_code == 200 and r2.json()["name"] == "TEST_Unit_Edit"
        # verify
        items = client.get(f"{BASE_URL}/api/master/organizational_units").json()
        assert any(i["id"] == unit_id and i["name"] == "TEST_Unit_Edit" for i in items)
        # delete
        assert client.delete(f"{BASE_URL}/api/master/organizational_units/{unit_id}").status_code == 200

    def test_invalid_collection(self, client):
        r = client.get(f"{BASE_URL}/api/master/not_a_real_collection")
        assert r.status_code == 404


# ---------------- employees ----------------
class TestEmployees:
    def test_list_and_pagination(self, client):
        r = client.get(f"{BASE_URL}/api/employees?page=1&limit=5")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "total" in d and d["page"] == 1

    def test_crud(self, client):
        nip = f"TEST{uuid.uuid4().hex[:8]}"
        payload = {"nip": nip, "name": "TEST_Pegawai", "jenis_kelamin": "L"}
        r = client.post(f"{BASE_URL}/api/employees", json=payload)
        assert r.status_code == 200, r.text
        emp = r.json()
        eid = emp["id"]
        assert emp["nip"] == nip

        # duplicate NIP rejected
        assert client.post(f"{BASE_URL}/api/employees", json=payload).status_code == 400

        # get enriched
        g = client.get(f"{BASE_URL}/api/employees/{eid}")
        assert g.status_code == 200 and "unit_name" in g.json()

        # search
        s = client.get(f"{BASE_URL}/api/employees?q=TEST_Pegawai")
        assert s.status_code == 200 and any(i["id"] == eid for i in s.json()["items"])

        # update
        upd = {**payload, "name": "TEST_Pegawai_Edit"}
        u = client.put(f"{BASE_URL}/api/employees/{eid}", json=upd)
        assert u.status_code == 200 and u.json()["name"] == "TEST_Pegawai_Edit"

        # soft delete
        assert client.delete(f"{BASE_URL}/api/employees/{eid}").status_code == 200
        assert client.get(f"{BASE_URL}/api/employees/{eid}").status_code == 404


# ---------------- attendance ----------------
class TestAttendance:
    def test_full_flow(self, client, ctx):
        if not ctx["types"] or not ctx["statuses"] or not ctx["employees"]:
            pytest.skip("Seed data missing")
        # Find Apel Staf with session Pagi (unique to avoid duplicate with existing records)
        atype = ctx["types"][0]
        sessions = atype.get("sessions") or []
        session = sessions[0] if sessions else "Pagi"
        # Use unique date to avoid dup prevention clash
        date_str = "2029-01-15"

        ev = client.post(f"{BASE_URL}/api/attendance/events", json={
            "date": date_str, "time": "07:30", "attendance_type_id": atype["id"],
            "session": session, "location": "Lapangan", "pembina": "Kalapas"
        })
        assert ev.status_code == 200, ev.text
        event = ev.json()
        assert event["code"].startswith(f"APEL-{date_str.replace('-','')}")

        # pick a 'present'-counting status
        present_status = next((s for s in ctx["statuses"] if s.get("counts_present")), ctx["statuses"][0])
        emp_ids = [e["id"] for e in ctx["employees"][:2]]
        records = [{"employee_id": eid, "status_id": present_status["id"]} for eid in emp_ids]

        br = client.post(f"{BASE_URL}/api/attendance/events/{event['id']}/records/batch",
                        json={"records": records})
        assert br.status_code == 200, br.text
        rb = br.json()
        assert rb["created"] == len(emp_ids)
        assert rb["recap"]["total"] == len(emp_ids)
        assert rb["recap"]["present"] == len(emp_ids)
        assert rb["recap"]["percentage"] == 100.0

        # duplicate prevention — submit same employee again
        br2 = client.post(f"{BASE_URL}/api/attendance/events/{event['id']}/records/batch",
                         json={"records": [{"employee_id": emp_ids[0], "status_id": present_status["id"]}]})
        assert br2.status_code == 200
        assert emp_ids[0] in br2.json()["skipped"]

        # list records & correction
        recs = client.get(f"{BASE_URL}/api/attendance/events/{event['id']}/records").json()
        assert len(recs) >= len(emp_ids)
        rec_id = recs[0]["id"]
        # pick different status
        other_status = next((s for s in ctx["statuses"] if s["id"] != present_status["id"]), present_status)
        corr = client.post(f"{BASE_URL}/api/attendance/records/{rec_id}/correct",
                          json={"status_id": other_status["id"], "keterangan": "", "reason": "Test correction"})
        assert corr.status_code == 200
        assert "recap" in corr.json()

        # correction without reason -> 400
        bad = client.post(f"{BASE_URL}/api/attendance/records/{rec_id}/correct",
                         json={"status_id": other_status["id"], "keterangan": "", "reason": "  "})
        assert bad.status_code == 400

        # Note upsert
        note = client.put(f"{BASE_URL}/api/attendance/events/{event['id']}/note",
                         json={"tema": "T", "pokok": "P", "isi": "I", "tindak_lanjut": "TL"})
        assert note.status_code == 200 and note.json()["tema"] == "T"

        # Documentation
        doc = client.post(f"{BASE_URL}/api/attendance/events/{event['id']}/documents",
                         json={"title": "Foto", "note": "test", "file_name": "x.jpg"})
        assert doc.status_code == 200

        # Get event has recap, note, documents
        ev_get = client.get(f"{BASE_URL}/api/attendance/events/{event['id']}").json()
        assert ev_get["recap"]["total"] >= len(emp_ids)
        assert ev_get["note"] is not None
        assert len(ev_get["documents"]) >= 1

        # Summary endpoints
        s1 = client.get(f"{BASE_URL}/api/attendance/my-summary")
        assert s1.status_code == 200
        s2 = client.get(f"{BASE_URL}/api/attendance/summary/{emp_ids[0]}")
        assert s2.status_code == 200
        assert "overall_percentage" in s2.json()

        # cleanup
        client.delete(f"{BASE_URL}/api/attendance/events/{event['id']}")


# ---------------- RBAC: users & roles ----------------
class TestRBAC:
    def test_list_roles_users(self, client):
        assert client.get(f"{BASE_URL}/api/roles").status_code == 200
        assert client.get(f"{BASE_URL}/api/users").status_code == 200

    def test_role_crud(self, client):
        r = client.post(f"{BASE_URL}/api/roles", json={"name": f"TEST_Role_{uuid.uuid4().hex[:6]}",
                                                        "description": "t", "permissions": ["dashboard.view"]})
        assert r.status_code == 200
        rid = r.json()["id"]
        u = client.put(f"{BASE_URL}/api/roles/{rid}", json={"name": "TEST_Role_Edit", "permissions": ["dashboard.view", "employee.view"]})
        assert u.status_code == 200 and "employee.view" in u.json()["permissions"]
        assert client.delete(f"{BASE_URL}/api/roles/{rid}").status_code == 200

    def test_user_crud_and_reset(self, client):
        email = f"test{uuid.uuid4().hex[:8]}@example.com"
        c = client.post(f"{BASE_URL}/api/users", json={"name": "TEST", "email": email, "password": "abc123"})
        assert c.status_code == 200, c.text
        uid = c.json()["id"]
        assert "password_hash" not in c.json()

        # reset password
        rp = client.post(f"{BASE_URL}/api/users/{uid}/reset-password", json={"new_password": "newpass123"})
        assert rp.status_code == 200
        # new login succeeds
        lg = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "newpass123"})
        assert lg.status_code == 200

        # update
        up = client.put(f"{BASE_URL}/api/users/{uid}", json={"name": "TEST_Edit"})
        assert up.status_code == 200 and up.json()["name"] == "TEST_Edit"

        # delete
        assert client.delete(f"{BASE_URL}/api/users/{uid}").status_code == 200

    def test_permission_enforcement(self, client):
        """Create user without user.manage perm; verify they get 403."""
        email = f"test{uuid.uuid4().hex[:8]}@example.com"
        c = client.post(f"{BASE_URL}/api/users", json={"name": "TEST_lowperm", "email": email, "password": "abc123"})
        uid = c.json()["id"]
        try:
            lg = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "abc123"}).json()
            tk = lg["access_token"]
            r = requests.get(f"{BASE_URL}/api/users", headers={"Authorization": f"Bearer {tk}"})
            assert r.status_code == 403
            r2 = requests.get(f"{BASE_URL}/api/audit-logs", headers={"Authorization": f"Bearer {tk}"})
            assert r2.status_code == 403
        finally:
            client.delete(f"{BASE_URL}/api/users/{uid}")

    def test_operator_evaluator_assignment(self, client):
        users = client.get(f"{BASE_URL}/api/users").json()
        uid = users[0]["id"]
        r = client.post(f"{BASE_URL}/api/attendance-operators", json={"user_id": uid, "attendance_type_ids": []})
        assert r.status_code == 200
        r2 = client.post(f"{BASE_URL}/api/evaluator-assignments", json={"evaluator_user_id": uid, "employee_ids": []})
        assert r2.status_code == 200


# ---------------- KGB / Promotion ----------------
class TestKGBPromotion:
    def test_kgb_status(self, client, ctx):
        if not ctx["employees"]:
            pytest.skip()
        eid = ctx["employees"][0]["id"]
        r = client.post(f"{BASE_URL}/api/kgb", json={"data": {"employee_id": eid, "next_date": "2030-01-01"}})
        assert r.status_code == 200
        lst = client.get(f"{BASE_URL}/api/kgb").json()
        row = next(x for x in lst if x["employee_id"] == eid and x.get("next_date") == "2030-01-01")
        assert row["status"] == "aman"
        assert isinstance(row["days_left"], int)
        client.delete(f"{BASE_URL}/api/kgb/{row['id']}")

    def test_promotion_overdue(self, client, ctx):
        if not ctx["employees"]:
            pytest.skip()
        eid = ctx["employees"][0]["id"]
        r = client.post(f"{BASE_URL}/api/promotion", json={"data": {"employee_id": eid, "next_date": "2020-01-01"}})
        rid = r.json()["id"]
        lst = client.get(f"{BASE_URL}/api/promotion").json()
        row = next(x for x in lst if x["id"] == rid)
        assert row["status"] == "terlambat" and row["days_left"] < 0
        client.delete(f"{BASE_URL}/api/promotion/{rid}")


# ---------------- Announcements + Notifications ----------------
class TestAnnouncements:
    def test_crud_and_notify(self, client):
        a = client.post(f"{BASE_URL}/api/announcements",
                       json={"title": "TEST_Ann", "content": "x", "target_type": "all"})
        assert a.status_code == 200
        aid = a.json()["id"]
        # notifications fanned out to admin
        n = client.get(f"{BASE_URL}/api/notifications").json()
        assert n["unread"] >= 1
        # read all
        assert client.post(f"{BASE_URL}/api/notifications/read-all").status_code == 200
        n2 = client.get(f"{BASE_URL}/api/notifications").json()
        assert n2["unread"] == 0
        client.delete(f"{BASE_URL}/api/announcements/{aid}")


# ---------------- Agenda ----------------
class TestAgenda:
    def test_crud(self, client):
        a = client.post(f"{BASE_URL}/api/agenda", json={"title": "TEST_Agenda", "date": "2029-05-01", "time": "08:00"})
        assert a.status_code == 200
        aid = a.json()["id"]
        lst = client.get(f"{BASE_URL}/api/agenda?date_from=2029-01-01&date_to=2029-12-31").json()
        assert any(x["id"] == aid for x in lst)
        client.delete(f"{BASE_URL}/api/agenda/{aid}")


# ---------------- Evaluation ----------------
class TestEvaluation:
    def test_template_and_eval_pulls_attendance(self, client, ctx):
        if not ctx["employees"]:
            pytest.skip()
        tpl = client.post(f"{BASE_URL}/api/evaluation/templates", json={
            "name": "TEST_Tpl", "period": "2029",
            "categories": [{"name": "Kinerja", "indicators": [{"name": "A", "weight": 1, "scale": 100}]}]
        })
        assert tpl.status_code == 200
        tid = tpl.json()["id"]
        eid = ctx["employees"][0]["id"]
        ev = client.post(f"{BASE_URL}/api/evaluation", json={
            "employee_id": eid, "template_id": tid, "period": "2029",
            "scores": [{"indicator": "A", "weight": 1, "value": 80}], "notes": "ok"
        })
        assert ev.status_code == 200
        d = ev.json()
        assert "attendance_percentage" in d
        assert d["manual_score"] == 80.0
        assert d["status"] == "submitted"
        # approve
        ap = client.post(f"{BASE_URL}/api/evaluation/{d['id']}/approve")
        assert ap.status_code == 200
        client.delete(f"{BASE_URL}/api/evaluation/templates/{tid}")


# ---------------- Generic record modules ----------------
class TestGenericModules:
    @pytest.mark.parametrize("path", ["documents", "leave", "training", "awards", "discipline"])
    def test_crud(self, client, ctx, path):
        if not ctx["employees"]:
            pytest.skip()
        eid = ctx["employees"][0]["id"]
        c = client.post(f"{BASE_URL}/api/{path}",
                       json={"data": {"employee_id": eid, "title": f"TEST_{path}"}})
        assert c.status_code == 200, c.text
        rid = c.json()["id"]
        lst = client.get(f"{BASE_URL}/api/{path}").json()
        assert any(x["id"] == rid for x in lst)
        u = client.put(f"{BASE_URL}/api/{path}/{rid}",
                      json={"data": {"employee_id": eid, "title": f"TEST_{path}_edit"}})
        assert u.status_code == 200
        assert client.delete(f"{BASE_URL}/api/{path}/{rid}").status_code == 200


# ---------------- Dashboard / Audit / Search ----------------
class TestDashboardAuditSearch:
    def test_dashboard_admin(self, client):
        r = client.get(f"{BASE_URL}/api/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert d["mode"] == "admin"
        assert "total_employees" in d["stats"]

    def test_audit_logs(self, client):
        r = client.get(f"{BASE_URL}/api/audit-logs?limit=5")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and isinstance(d["items"], list)
        # ensure LOGIN entry exists
        actions = {i.get("action") for i in client.get(f"{BASE_URL}/api/audit-logs?limit=100").json()["items"]}
        assert "LOGIN" in actions

    def test_search(self, client):
        r = client.get(f"{BASE_URL}/api/search?q=Pegawai")
        assert r.status_code == 200
        assert "results" in r.json()
