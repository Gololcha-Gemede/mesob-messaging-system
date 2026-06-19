import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ADMIN_REGISTER_SESSION_KEY } from '../utils/jwt';

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editingDeptName, setEditingDeptName] = useState('');
  const [editingDeptCode, setEditingDeptCode] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null);
  const activeSection = searchParams.get('section') === 'departments' ? 'departments' : 'users';
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'user',
    department_id: '',
    password: '',
  });
  const [listError, setListError] = useState('');

  const authHeaders = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });


  const loadData = useCallback(async () => {
    setListError('');
    const h = authHeaders();
    const [usersRes, deptRes] = await Promise.allSettled([
      axios.get('/api/users', h),
      axios.get('/api/departments', h),
    ]);

    if (usersRes.status === 'fulfilled') setUsers(Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
    if (deptRes.status === 'fulfilled') setDepartments(Array.isArray(deptRes.value.data) ? deptRes.value.data : []);

    const errors = [];
    if (usersRes.status === 'rejected') errors.push(usersRes.reason?.response?.data?.message || 'users');
    if (deptRes.status === 'rejected') errors.push(deptRes.reason?.response?.data?.message || 'departments');
    if (errors.length) setListError(`Could not load admin data: ${errors.join(' | ')}`);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const changeSection = (section) => {
    setSearchParams({ section });
    setPage(1);
  };

  const handleDeptSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/departments', { name: deptName, code: deptCode }, authHeaders());
      setDeptName('');
      setDeptCode('');
      setSelectedDepartmentId(res.data?.id ?? null);
      await loadData();
    } catch {
      setListError('Could not create department.');
    }
  };

  const startEditDept = (d) => {
    setEditingDeptId(d.id);
    setEditingDeptName(d.name);
    setEditingDeptCode(d.code || '');
  };

  const cancelEditDept = () => {
    setEditingDeptId(null);
    setEditingDeptName('');
  };

  const saveDept = async (id) => {
    try {
      await axios.put(`/api/departments/${id}`, { name: editingDeptName, code: editingDeptCode }, authHeaders());
      cancelEditDept();
      await loadData();
    } catch {
      setListError('Could not update department.');
    }
  };

  const deleteDept = async (id) => {
    try {
      await axios.delete(`/api/departments/${id}`, authHeaders());
      if (selectedDepartmentId === id) setSelectedDepartmentId(null);
      setConfirmAction(null);
      await loadData();
    } catch (err) {
      setListError(err.response?.data?.message || 'Could not delete department.');
    }
  };

  const startEditUser = (u) => {
    setEditingUser(u.id);
    setEditForm({
      name: u.name,
      email: u.email,
      role: u.role,
      department_id: u.department_id ?? '',
      password: '',
    });
  };

  const cancelEditUser = () => {
    setEditingUser(null);
    setEditForm({ name: '', email: '', role: 'user', department_id: '', password: '' });
  };

  const saveUser = async () => {
    if (!editingUser) return;
    try {
      const body = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        department_id: editForm.department_id,
      };
      if (editForm.password.trim()) body.password = editForm.password.trim();
      await axios.put(`/api/users/${editingUser}`, body, authHeaders());
      cancelEditUser();
      await loadData();
    } catch (err) {
      setListError(err.response?.data?.message || 'Could not update user.');
    }
  };

  const deleteUser = async (id) => {
    try {
      await axios.delete(`/api/users/${id}`, authHeaders());
      if (editingUser === id) cancelEditUser();
      setConfirmAction(null);
      await loadData();
    } catch (err) {
      setListError(err.response?.data?.message || 'Could not delete user.');
    }
  };

  const departmentName = (departmentId) => departments.find((d) => d.id === departmentId)?.name ?? 'Unassigned';
  const pageSize = 8;
  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !query ||
        String(user.name || '').toLowerCase().includes(query) ||
        String(user.email || '').toLowerCase().includes(query);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesDepartment = departmentFilter === 'all' || String(user.department_id || '') === departmentFilter;
      return matchesQuery && matchesRole && matchesDepartment;
    });
  }, [departmentFilter, roleFilter, userSearch, users]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const visibleUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);
  const adminCount = users.filter((user) => user.role === 'admin').length;
  const managerCount = users.filter((user) => user.role === 'manager').length;
  const staffCount = users.filter((user) => user.role === 'user').length;
  const effectiveSelectedDepartmentId = departments.some((department) => department.id === selectedDepartmentId)
    ? selectedDepartmentId
    : departments[0]?.id ?? null;
  const selectedDepartment = departments.find((department) => department.id === effectiveSelectedDepartmentId) || null;
  const selectedDepartmentUsers = selectedDepartment
    ? users.filter((user) => user.department_id === selectedDepartment.id)
    : [];

  return (
    <div className="admin-panel-container">
      <div className="page-title-row">
        <div>
          <h2>Admin Panel</h2>
          <p className="admin-panel-hint">Manage organization users, departments, roles, and access structure.</p>
        </div>
      </div>
      {listError ? <div className="admin-banner-error">{listError}</div> : null}

      <div className="admin-stats-grid">
        <div className="admin-stat-card"><span>Total Users</span><strong>{users.length}</strong></div>
        <div className="admin-stat-card admin-stat-card--admin"><span>Admins</span><strong>{adminCount}</strong></div>
        <div className="admin-stat-card"><span>Managers</span><strong>{managerCount}</strong></div>
        <div className="admin-stat-card admin-stat-card--staff"><span>Staff</span><strong>{staffCount}</strong></div>
        <div className="admin-stat-card"><span>Departments</span><strong>{departments.length}</strong></div>
      </div>

      {activeSection === 'users' ? (
        <div className="detail-section admin-dropdown-section">
          <div className="admin-section-heading">
            <div>
              <h3>Users</h3>
              <p className="admin-panel-hint">Create, edit, and delete staff, manager, or admin accounts.</p>
            </div>
            <button
              type="button"
              className="admin-create-user-btn"
              onClick={() => {
                sessionStorage.setItem(ADMIN_REGISTER_SESSION_KEY, '1');
                navigate('/register', { state: { fromAdmin: true } });
              }}
            >
              Create User
            </button>
          </div>

          <div className="admin-toolbar">
            <input
              type="search"
              placeholder="Search users by name or email"
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setPage(1);
              }}
            />
            <select value={roleFilter} onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="user">Staff</option>
            </select>
            <select value={departmentFilter} onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setPage(1);
            }}>
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {editingUser ? (
            <div className="admin-edit-user">
              <h4 className="admin-edit-user-title">Edit user</h4>
              <div className="admin-edit-user-grid">
                <input type="text" placeholder="Name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                <input type="email" placeholder="Email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                <input type="password" placeholder="New password (optional)" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" />
                <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="user">Staff</option>
                </select>
                <select value={editForm.department_id} onChange={(e) => setEditForm((f) => ({ ...f, department_id: e.target.value }))} required>
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="admin-edit-user-actions">
                <button type="button" onClick={saveUser}>Save changes</button>
                <button type="button" className="secondary-btn" onClick={cancelEditUser}>Cancel</button>
              </div>
            </div>
          ) : null}

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th className="admin-table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <div className="user-status-row">
                        <span className="status-badge status-badge--active">Active</span>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><span className={`status-badge status-badge--${u.role === 'admin' ? 'admin' : u.role === 'manager' ? 'manager' : 'staff'}`}>{u.role === 'user' ? 'staff' : u.role}</span></td>
                    <td>{departmentName(u.department_id)}</td>
                    <td className="admin-table-actions">
                      <div className="table-action-row">
                        <button type="button" className="admin-row-btn" onClick={() => startEditUser(u)}>Edit</button>
                        <button
                          type="button"
                          className="admin-row-btn danger-btn danger-btn--soft"
                          onClick={() => setConfirmAction({ type: 'user', id: u.id, label: u.name })}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibleUsers.length ? (
                  <tr>
                    <td colSpan="5"><div className="empty-state">No users match the current filters.</div></td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="pagination-row">
            <button type="button" className="secondary-btn" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="secondary-btn" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
          </div>
        </div>
      ) : null}

      {activeSection === 'departments' ? (
        <div className="detail-section admin-dropdown-section">
          <div className="admin-section-heading">
            <div>
              <h3>Departments</h3>
              <p className="admin-panel-hint">Manage departments and the users assigned to each department.</p>
            </div>
          </div>

          <form className="admin-create-dept-form" onSubmit={handleDeptSubmit}>
            <input type="text" placeholder="Department Name" value={deptName} onChange={(e) => setDeptName(e.target.value)} required />
            <input type="text" placeholder="Code (e.g. HRD)" value={deptCode} onChange={(e) => setDeptCode(e.target.value)} maxLength={10} style={{ maxWidth: 140 }} />
            <button type="submit">Create Department</button>
          </form>

          <div className="department-management-layout">
            <div className="department-list-panel">
              <h4>Department List</h4>
              <div className="department-list">
                {departments.map((d) => {
                  const deptUsers = users.filter((u) => u.department_id === d.id);
                  const isSelected = effectiveSelectedDepartmentId === d.id;
                  return (
                    <button
                      type="button"
                      className={isSelected ? 'department-list-item department-list-item--active' : 'department-list-item'}
                      key={d.id}
                      onClick={() => {
                        setSelectedDepartmentId(d.id);
                        if (editingDeptId !== d.id) cancelEditDept();
                      }}
                    >
                      <span>{d.code ? `[${d.code}] ` : ''}{d.name}</span>
                      <strong>{deptUsers.length}</strong>
                    </button>
                  );
                })}
                {!departments.length ? <div className="empty-state">No departments created yet.</div> : null}
              </div>
            </div>

            <section className="department-detail-panel">
              {selectedDepartment ? (
                <>
                  <div className="department-card-header">
                    <div>
                      {editingDeptId === selectedDepartment.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input className="admin-inline-input" value={editingDeptName} onChange={(e) => setEditingDeptName(e.target.value)} style={{ flex: 1 }} />
                          <input className="admin-inline-input" value={editingDeptCode} onChange={(e) => setEditingDeptCode(e.target.value)} placeholder="Code" maxLength={10} style={{ width: 90 }} />
                        </div>
                      ) : (
                        <h4>{selectedDepartment.code ? `[${selectedDepartment.code}] ` : ''}{selectedDepartment.name}</h4>
                      )}
                      <p className="admin-panel-hint">{selectedDepartmentUsers.length} user(s) assigned to this department.</p>
                    </div>
                    <span className="badge">{selectedDepartmentUsers.length}</span>
                  </div>

                  <div className="admin-edit-user-actions">
                    {editingDeptId === selectedDepartment.id ? (
                      <>
                        <button type="button" className="admin-row-btn" onClick={() => saveDept(selectedDepartment.id)}>Save</button>
                        <button type="button" className="admin-row-btn secondary-btn" onClick={cancelEditDept}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="admin-row-btn" onClick={() => startEditDept(selectedDepartment)}>Edit Department</button>
                        <button type="button" className="admin-row-btn danger-btn danger-btn--soft" onClick={() => setConfirmAction({ type: 'department', id: selectedDepartment.id, label: selectedDepartment.name })}>Delete Department</button>
                      </>
                    )}
                  </div>

                  <ul className="department-user-list">
                    {selectedDepartmentUsers.length ? selectedDepartmentUsers.map((u) => (
                      <li key={u.id}>
                        <div>
                          <strong>{u.name}</strong>
                          <span>{u.email}</span>
                        </div>
                        <div className="department-user-actions">
                          <button type="button" className="admin-row-btn" onClick={() => {
                            changeSection('users');
                            startEditUser(u);
                          }}>Edit</button>
                          <button type="button" className="admin-row-btn danger-btn danger-btn--soft" onClick={() => setConfirmAction({ type: 'user', id: u.id, label: u.name })}>Delete</button>
                        </div>
                      </li>
                    )) : <li className="department-empty">No users assigned.</li>}
                  </ul>
                </>
              ) : (
                <div className="empty-state">Select a department to view details.</div>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
            <h3 id="confirm-delete-title">Confirm deletion</h3>
            <p>
              Delete {confirmAction.type === 'department' ? 'department' : 'user'} <strong>{confirmAction.label}</strong>?
              This action may fail if related records still exist.
            </p>
            <div className="confirm-modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button
                type="button"
                className="danger-btn danger-btn--soft"
                onClick={() => confirmAction.type === 'department' ? deleteDept(confirmAction.id) : deleteUser(confirmAction.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
