import { useState, useEffect, useCallback } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card } from "@/components/common/Ui";
import { DataTable } from "@/components/common/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Loader2, KeyRound, Pencil, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Users() {
  const { permissionCatalog } = useAuth();
  return (
    <div>
      <PageHeader title="User Management" subtitle="Kelola akun, role, dan penugasan" />
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-roles">Roles & Permission</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab catalog={permissionCatalog} /></TabsContent>
        <TabsContent value="roles"><RolesTab catalog={permissionCatalog} /></TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTab({ catalog }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get("/users"), api.get("/roles"), api.get("/employees?limit=500")])
      .then(([u, r, e]) => { setUsers(u.data); setRoles(r.data); setEmployees(e.data.items || []); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setModal({ role_ids: [], extra_permissions: [], is_active: true })} className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="add-user-btn"><Plus size={16} /> Tambah User</button>
      </div>
      <DataTable
        testid="users-table"
        loading={loading}
        rows={users}
        columns={[
          { key: "name", label: "Nama", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "email", label: "Email" },
          { key: "role_names", label: "Role", render: (r) => (r.role_names || []).join(", ") || "-" },
          { key: "is_active", label: "Status", render: (r) => <span className={r.is_active ? "text-green-600" : "text-red-500"}>{r.is_active ? "Aktif" : "Nonaktif"}</span> },
          { key: "_a", label: "Aksi", render: (r) => (
            <div className="flex gap-2">
              <button onClick={() => setModal(r)} className="text-slate-500 p-1 hover:bg-slate-100 rounded" data-testid={`edit-user-${r.id}`}><Pencil size={15} /></button>
              <button onClick={() => setResetUser(r)} className="text-amber-600 p-1 hover:bg-amber-50 rounded" data-testid={`reset-user-${r.id}`}><KeyRound size={15} /></button>
              <button onClick={() => setToDelete(r)} className="text-red-500 p-1 hover:bg-red-50 rounded" data-testid={`delete-user-${r.id}`}><Trash2 size={15} /></button>
            </div>
          ) },
        ]}
      />
      {modal && <UserModal user={modal} roles={roles} employees={employees} catalog={catalog} onClose={() => setModal(null)} reload={load} />}
      {resetUser && <ResetModal user={resetUser} onClose={() => setResetUser(null)} />}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus user {toDelete?.name}?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-user" onClick={async () => { try { await api.delete(`/users/${toDelete.id}`); toast.success("Dihapus"); load(); } catch (e) { toast.error(apiError(e)); } setToDelete(null); }}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserModal({ user, roles, employees, catalog, onClose, reload }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role_ids: [], extra_permissions: [], employee_id: "", is_active: true, ...user });
  const [saving, setSaving] = useState(false);
  const [attTypes, setAttTypes] = useState([]);
  const [opAssign, setOpAssign] = useState([]);
  const [evalAssign, setEvalAssign] = useState([]);
  const isEdit = !!user.id;

  useEffect(() => {
    api.get("/master/attendance_types").then(({ data }) => setAttTypes(data));
    if (user.id) {
      api.get("/attendance-operators").then(({ data }) => { const a = data.find((x) => x.user_id === user.id); setOpAssign(a?.attendance_type_ids || []); });
      api.get("/evaluator-assignments").then(({ data }) => { const a = data.find((x) => x.evaluator_user_id === user.id); setEvalAssign(a?.employee_ids || []); });
    }
  }, [user.id]);

  const toggle = (key, val) => setForm((f) => ({ ...f, [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val] }));

  const save = async () => {
    setSaving(true);
    try {
      let uid = user.id;
      if (isEdit) {
        await api.put(`/users/${user.id}`, { name: form.name, role_ids: form.role_ids, extra_permissions: form.extra_permissions, employee_id: form.employee_id || null, is_active: form.is_active });
      } else {
        const { data } = await api.post("/users", { name: form.name, email: form.email, password: form.password, role_ids: form.role_ids, extra_permissions: form.extra_permissions, employee_id: form.employee_id || null, is_active: form.is_active });
        uid = data.id;
      }
      await api.post("/attendance-operators", { user_id: uid, attendance_type_ids: opAssign });
      await api.post("/evaluator-assignments", { evaluator_user_id: uid, employee_ids: evalAssign });
      toast.success("User tersimpan");
      onClose(); reload();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader><DialogTitle className="text-[#0B1F3A]">{isEdit ? "Edit User" : "Tambah User"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Nama *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="user-name" /></div>
            <div><label className="text-sm font-medium">Email *</label><input disabled={isEdit} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm disabled:bg-slate-50" data-testid="user-email" /></div>
            {!isEdit && <div><label className="text-sm font-medium">Password *</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="user-password" /></div>}
            <div><label className="text-sm font-medium">Tautkan ke Pegawai</label>
              <select value={form.employee_id || ""} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="user-employee">
                <option value="">-- Tidak --</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.nip})</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 mt-1"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" data-testid="user-active" /><label className="text-sm">Akun Aktif</label></div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Role / Fungsi (multi)</p>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <button key={r.id} onClick={() => toggle("role_ids", r.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${form.role_ids.includes(r.id) ? "bg-[#0B1F3A] text-white border-[#0B1F3A]" : "bg-white text-slate-600 border-slate-300"}`} data-testid={`role-opt-${r.id}`}>{r.name}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Operator Apel — jenis yang ditangani</p>
            <div className="flex flex-wrap gap-2">
              {attTypes.map((t) => (
                <button key={t.id} onClick={() => setOpAssign((s) => s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id])} className={`px-3 py-1.5 rounded-full text-xs border ${opAssign.includes(t.id) ? "bg-[#C9A227] text-[#071426] border-[#C9A227]" : "bg-white text-slate-600 border-slate-300"}`} data-testid={`op-opt-${t.id}`}>{t.name}</button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Kosong = dapat menangani semua jenis apel (jika punya izin input).</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Penilai — pegawai yang dinilai</p>
            <div className="max-h-32 overflow-y-auto scrollbar-thin border border-slate-200 rounded-md p-2">
              {employees.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm py-0.5">
                  <input type="checkbox" checked={evalAssign.includes(e.id)} onChange={() => setEvalAssign((s) => s.includes(e.id) ? s.filter((x) => x !== e.id) : [...s, e.id])} data-testid={`eval-opt-${e.id}`} />
                  {e.name}
                </label>
              ))}
              {employees.length === 0 && <p className="text-xs text-slate-400">Belum ada pegawai.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-300">Batal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-[#0B1F3A] text-white font-medium flex items-center gap-2" data-testid="save-user-btn">{saving && <Loader2 size={14} className="animate-spin" />} Simpan</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetModal({ user, onClose }) {
  const [pwd, setPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try { await api.post(`/users/${user.id}/reset-password`, { new_password: pwd }); toast.success("Password direset"); onClose(); }
    catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reset Password — {user.name}</DialogTitle></DialogHeader>
        <input type="password" placeholder="Password baru (min 6)" value={pwd} onChange={(e) => setPwd(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="reset-password-input" />
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-300">Batal</button>
          <button onClick={submit} disabled={saving || pwd.length < 6} className="px-4 py-2 text-sm rounded-md bg-[#0B1F3A] text-white font-medium" data-testid="save-reset-btn">Reset</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesTab({ catalog }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(() => { setLoading(true); api.get("/roles").then(({ data }) => setRoles(data)).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);

  const modules = [...new Set(catalog.map((c) => c.module))];

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setModal({ name: "", description: "", permissions: [] })} className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="add-role-btn"><Plus size={16} /> Tambah Role</button>
      </div>
      <DataTable
        testid="roles-table"
        loading={loading}
        rows={roles}
        columns={[
          { key: "name", label: "Role", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "description", label: "Deskripsi" },
          { key: "permissions", label: "Permission", render: (r) => r.permissions?.includes("*") ? "Semua (Super Admin)" : `${r.permissions?.length || 0} izin` },
          { key: "_a", label: "Aksi", render: (r) => (
            <button onClick={() => setModal(r)} disabled={r.permissions?.includes("*")} className="text-slate-500 p-1 hover:bg-slate-100 rounded disabled:opacity-30" data-testid={`edit-role-${r.id}`}><Pencil size={15} /></button>
          ) },
        ]}
      />
      {modal && <RoleModal role={modal} catalog={catalog} modules={modules} onClose={() => setModal(null)} reload={load} />}
    </div>
  );
}

function RoleModal({ role, catalog, modules, onClose, reload }) {
  const [form, setForm] = useState({ name: "", description: "", permissions: [], ...role });
  const [saving, setSaving] = useState(false);
  const toggle = (p) => setForm((f) => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] }));
  const save = async () => {
    setSaving(true);
    try {
      if (role.id) await api.put(`/roles/${role.id}`, { name: form.name, description: form.description, permissions: form.permissions });
      else await api.post("/roles", { name: form.name, description: form.description, permissions: form.permissions });
      toast.success("Role tersimpan"); onClose(); reload();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader><DialogTitle className="text-[#0B1F3A]">{role.id ? "Edit Role" : "Tambah Role"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Nama Role *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="role-name" /></div>
            <div><label className="text-sm font-medium">Deskripsi</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="role-desc" /></div>
          </div>
          <div className="space-y-3">
            {modules.map((m) => (
              <div key={m} className="border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-bold uppercase text-slate-500 mb-2">{m}</p>
                <div className="grid sm:grid-cols-2 gap-1">
                  {catalog.filter((c) => c.module === m).map((c) => (
                    <label key={c.key} className="flex items-center gap-2 text-sm py-0.5">
                      <input type="checkbox" checked={form.permissions.includes(c.key)} onChange={() => toggle(c.key)} data-testid={`perm-${c.key}`} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-300">Batal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-[#0B1F3A] text-white font-medium flex items-center gap-2" data-testid="save-role-btn">{saving && <Loader2 size={14} className="animate-spin" />} Simpan</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
