import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ADMIN_REGISTER_SESSION_KEY } from '../utils/jwt';

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [deptName, setDeptName] = useState('');
  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editingDeptName, setEditingDeptName] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'staff',
    department_id: '',
    password: '',
  });
  const [listError, setListError] = useState('');

  const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const loadData = useCallback(async () => {
    setListError('');
    const h = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    const [usersRes, deptRes] = await Promise.allSettled([
      axios.get('/api/users', h),
      axios.get('/api/departments', h),
    ]);

    if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data);
    if (deptRes.status === 'fulfilled') setDepartments(deptRes.value.data);

    const errors = [];
    if (usersRes.status === 'rejected') {
      errors.push(usersRes.reason?.response?.data?.message || 'users');
    }
    if (deptRes.status === 'rejected') {
      errors.push(deptRes.reason?.response?.data?.message || 'departments');
    }
    if (errors.length) {
      setListError(`Could not load admin data: ${errors.join(' | ')}`);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeptSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/departments', { name: deptName }, authHeaders());
      setDeptName('');
      await loadData();
    } catch {
      setListError('Could not create department.');
    }
  };

  const startEditDept = (d) => {
    setEditingDeptId(d.id);
    setEditingDeptName(d.name);
  };

  const cancelEditDept = () => {
    setEditingDeptId(null);
    setEditingDeptName('');
  };

  const saveDept = async (id) => {
    try {
      await axios.put(`/api/departments/${id}`, { name: editingDeptName }, authHeaders());
      cancelEditDept();
      await loadData();
    } catch {
      setListError('Could not update department.');
    }
  };

  const deleteDept = async (id) => {
    if (!window.confirm('Delete this department? Users must be reassigned first.')) return;
    try {
      await axios.delete(`/api/departments/${id}`, authHeaders());
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not delete department.';
      setListError(msg);
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
    setEditForm({ name: '', email: '', role: 'staff', department_id: '', password: '' });
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
      if (editForm.password.trim()) {
        body.password = editForm.password.trim();
      }
      await axios.put(`/api/users/${editingUser}`, body, authHeaders());
      cancelEditUser();
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not update user.';
      setListError(msg);
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user? This may fail if they have related messages.')) return;
    try {
      await axios.delete(`/api/users/${id}`, authHeaders());
      if (editingUser === id) cancelEditUser();
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not delete user.';
      setListError(msg);
    }
  };

  return (
    <div className="admin-panel-container">
      <h2>Admin Panel</h2>
      {listError ? <div className="admin-banner-error">{listError}</div> : null}

      <div className="detail-section">
        <h3>Create User</h3>
        <p className="admin-panel-hint">Add a new staff or admin account on the registration screen.</p>
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

      <div className="detail-section">
        <h3>Create Department</h3>
        <form onSubmit={handleDeptSubmit}>
          <input type="text" placeholder="Department Name" value={deptName} onChange={(e) => setDeptName(e.target.value)} required />
          <button type="submit">Create Department</button>
        </form>
      </div>

      <div className="detail-section">
        <h3>Departments</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="admin-table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <td>
                    {editingDeptId === d.id ? (
                      <input
                        className="admin-inline-input"
                        value={editingDeptName}
                        onChange={(e) => setEditingDeptName(e.target.value)}
                      />
                    ) : (
                      d.name
                    )}
                  </td>
                  <td className="admin-table-actions">
                    {editingDeptId === d.id ? (
                      <>
                        <button type="button" className="admin-row-btn" onClick={() => saveDept(d.id)}>Save</button>
                        <button type="button" className="admin-row-btn secondary-btn" onClick={cancelEditDept}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="admin-row-btn" onClick={() => startEditDept(d)}>Edit</button>
                        <button type="button" className="admin-row-btn danger-btn" onClick={() => deleteDept(d.id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="detail-section">
        <h3>Users</h3>
        {editingUser ? (
          <div className="admin-edit-user">
            <h4 className="admin-edit-user-title">Edit user</h4>
            <div className="admin-edit-user-grid">
              <input type="text" placeholder="Name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              <input type="email" placeholder="Email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              <input type="password" placeholder="New password (optional)" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" />
              <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
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
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{departments.find((d) => d.id === u.department_id)?.name ?? '—'}</td>
                  <td className="admin-table-actions">
                    <button type="button" className="admin-row-btn" onClick={() => startEditUser(u)}>Edit</button>
                    <button type="button" className="admin-row-btn danger-btn" onClick={() => deleteUser(u.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
