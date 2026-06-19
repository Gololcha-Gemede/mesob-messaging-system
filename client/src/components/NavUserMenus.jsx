import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ADMIN_REGISTER_SESSION_KEY } from '../utils/jwt';
import { notify } from '../utils/notify';
import { useSSE } from '../hooks/useSSE';

function Icon({ name }) {
  const icons = {
    bell: 'M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Zm-4 4a2 2 0 0 1-4 0',
    check: 'M20 6 9 17l-5-5',
    close: 'M18 6 6 18M6 6l12 12',
    inbox: 'M4 4h16l-2 10h-4a4 4 0 0 1-8 0H2L4 4Zm2 4h12'
  };
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

function getProfileInitial(profile) {
  const name = String(profile?.name || profile?.email || 'U').trim();
  return (name[0] || 'U').toUpperCase();
}

function profileImageSrc(profile) {
  const path = profile?.profile_image_path;
  if (!path) return '';
  return String(path).startsWith('http') ? path : path;
}

function formatBadgeCount(count) {
  const n = Number(count) || 0;
  if (n > 99) return '99+';
  return String(n);
}

function formatRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function roleLabel(role) {
  if (role === 'admin') return 'Administrator';
  if (role === 'manager') return 'Manager';
  if (role === 'user') return 'Staff';
  return role ? String(role).replace(/_/g, ' ') : 'Staff';
}

export default function NavUserMenus({ token }) {
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pinnedMenu, setPinnedMenu] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const [profile, setProfile] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '', profile_image: null });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileMessageTone, setProfileMessageTone] = useState('');

  const lastNotificationCountRef = useRef(null);
  const editingProfileRef = useRef(false);

  useEffect(() => {
    editingProfileRef.current = editingProfile;
  }, [editingProfile]);

  const profilePreviewUrl = useMemo(
    () => (profileForm.profile_image ? URL.createObjectURL(profileForm.profile_image) : ''),
    [profileForm.profile_image]
  );

  useEffect(() => {
    if (!profilePreviewUrl) return undefined;
    return () => URL.revokeObjectURL(profilePreviewUrl);
  }, [profilePreviewUrl]);

  const loadNavData = useCallback(async (showLoading = false) => {
    if (!token) return;
    if (showLoading) setNotificationsLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [notificationsRes, profileRes] = await Promise.allSettled([
        axios.get('/api/messages/notifications', { headers }),
        axios.get('/api/auth/me', { headers })
      ]);

      if (notificationsRes.status === 'fulfilled') {
        const data = notificationsRes.value.data;
        const nextCount = Number(data?.count) || 0;
        setNotifications(Array.isArray(data?.messages) ? data.messages : []);
        setNotificationCount(nextCount);
        if (lastNotificationCountRef.current !== null && nextCount > lastNotificationCountRef.current) {
          notify({ type: 'info', title: 'New message', message: 'You have a new unread message in your inbox.' });
        }
        lastNotificationCountRef.current = nextCount;
      }

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data);
        if (!editingProfileRef.current) {
          setProfileForm({
            name: profileRes.value.data?.name || '',
            email: profileRes.value.data?.email || '',
            password: '',
            profile_image: null
          });
        }
      }
    } finally {
      if (showLoading) setNotificationsLoading(false);
    }
  }, [token]);

  useSSE(token, {
    onNewMessage: (data) => {
      loadNavData(false);
      notify({ type: 'info', title: 'New message', message: `From ${data.sender_name}: ${data.subject || '(No subject)'}` });
    },
    onMessageRead: (data) => {
      console.log('[Real-time] Message read:', data);
    }
  });

  useEffect(() => {
    if (!token) return undefined;
    let ignore = false;
    const run = async () => {
      if (ignore) return;
      await loadNavData(false);
    };
    run();
    const interval = window.setInterval(() => {
      if (!ignore) loadNavData(false);
    }, 60000);
    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, [token, location.pathname, loadNavData]);

  const closeMenus = (resetEdit = true) => {
    setNotificationsOpen(false);
    setProfileOpen(false);
    setPinnedMenu(null);
    if (resetEdit) {
      setEditingProfile(false);
      setProfileMessage('');
      setProfileMessageTone('');
    }
  };

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        closeMenus(true);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMenus(true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem(ADMIN_REGISTER_SESSION_KEY);
    closeMenus(true);
    navigate('/login');
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage('');
    setProfileMessageTone('');
    try {
      let res;
      if (profileForm.profile_image) {
        const body = new FormData();
        body.append('name', profileForm.name);
        body.append('email', profileForm.email);
        if (profileForm.password) body.append('password', profileForm.password);
        body.append('profile_image', profileForm.profile_image);
        res = await axios.put('/api/auth/me', body, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        const payload = { name: profileForm.name, email: profileForm.email };
        if (profileForm.password) payload.password = profileForm.password;
        res = await axios.put('/api/auth/me', payload, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
      }
      setProfile(res.data);
      setProfileForm({ name: res.data.name || '', email: res.data.email || '', password: '', profile_image: null });
      setEditingProfile(false);
      setProfileMessage('Profile saved successfully.');
      setProfileMessageTone('success');
    } catch (err) {
      setProfileMessage(err?.response?.data?.message || err?.response?.data?.error || 'Could not update profile.');
      setProfileMessageTone('error');
    } finally {
      setProfileSaving(false);
    }
  };

  const markNotificationRead = async (messageId, { silent = false } = {}) => {
    try {
      await axios.patch(`/api/messages/${messageId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((items) => items.filter((item) => item.id !== messageId));
      setNotificationCount((count) => Math.max(0, count - 1));
      if (!silent) {
        notify({ type: 'success', title: 'Dismissed', message: 'Notification removed from your list.' });
      }
    } catch {
      notify({ type: 'error', title: 'Could not dismiss', message: 'Please try again.' });
    }
  };

  const markAllNotificationsRead = async () => {
    if (!notifications.length || markingAll) return;
    setMarkingAll(true);
    try {
      await Promise.allSettled(
        notifications.map((msg) =>
          axios.patch(`/api/messages/${msg.id}/read`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      );
      setNotifications([]);
      setNotificationCount(0);
      lastNotificationCountRef.current = 0;
    } catch {
      notify({ type: 'error', title: 'Could not clear all', message: 'Some notifications may remain.' });
      await loadNavData(false);
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = (messageId) => {
    setNotificationsOpen(false);
    setPinnedMenu(null);
    navigate(`/messages/${messageId}`);
    markNotificationRead(messageId, { silent: true });
  };

  const toggleNotifications = () => {
    const shouldOpen = pinnedMenu !== 'notifications' || !notificationsOpen;
    setPinnedMenu(shouldOpen ? 'notifications' : null);
    setNotificationsOpen(shouldOpen);
    setProfileOpen(false);
    setEditingProfile(false);
    setProfileMessage('');
    setProfileMessageTone('');
    if (shouldOpen) loadNavData(true);
  };

  const toggleProfile = () => {
    const shouldOpen = pinnedMenu !== 'profile' || !profileOpen;
    setPinnedMenu(shouldOpen ? 'profile' : null);
    setProfileOpen(shouldOpen);
    setNotificationsOpen(false);
    if (!shouldOpen) {
      setEditingProfile(false);
      setProfileMessage('');
      setProfileMessageTone('');
    }
  };

  const closeUnpinnedMenus = () => {
    if (!pinnedMenu) {
      setNotificationsOpen(false);
      setProfileOpen(false);
    }
  };

  const startEditProfile = () => {
    setProfileForm({
      name: profile?.name || '',
      email: profile?.email || '',
      password: '',
      profile_image: null
    });
    setProfileMessage('');
    setProfileMessageTone('');
    setEditingProfile(true);
  };

  const cancelEditProfile = () => {
    setProfileForm({
      name: profile?.name || '',
      email: profile?.email || '',
      password: '',
      profile_image: null
    });
    setEditingProfile(false);
    setProfileMessage('');
    setProfileMessageTone('');
  };

  const profilePhoto = profilePreviewUrl || profileImageSrc(profile);
  const profileMessageClass = profileMessageTone === 'success'
    ? 'nav-popover-feedback nav-popover-feedback--success'
    : profileMessageTone === 'error'
      ? 'nav-popover-feedback nav-popover-feedback--error'
      : 'nav-popover-feedback';

  if (!token) return null;

  return (
    <div className="nav-user-menus" ref={rootRef}>
      <div
        className="top-nav-menu"
        onMouseEnter={() => {
          if (pinnedMenu) return;
          setNotificationsOpen(true);
          setProfileOpen(false);
        }}
        onMouseLeave={closeUnpinnedMenus}
      >
        <button
          type="button"
          className={`icon-btn icon-btn--bell${notificationsOpen ? ' icon-btn--active' : ''}`}
          aria-label="Notifications"
          aria-expanded={notificationsOpen}
          aria-haspopup="dialog"
          onClick={toggleNotifications}
        >
          <Icon name="bell" />
          {notificationCount > 0 ? (
            <span className="notification-badge" aria-label={`${notificationCount} unread`}>
              {formatBadgeCount(notificationCount)}
            </span>
          ) : null}
        </button>
        {notificationsOpen ? (
          <div className="top-popover top-popover--notifications" role="dialog" aria-label="Notifications">
            <div className="nav-popover-header">
              <div>
                <h3>Notifications</h3>
                <p className="nav-popover-subtitle">
                  {notificationCount
                    ? `${notificationCount} unread message${notificationCount === 1 ? '' : 's'}`
                    : 'You are all caught up'}
                </p>
              </div>
              <button
                type="button"
                className="nav-popover-close"
                aria-label="Close notifications"
                onClick={() => {
                  setNotificationsOpen(false);
                  setPinnedMenu(null);
                }}
              >
                <Icon name="close" />
              </button>
            </div>
            {notificationsLoading ? (
              <div className="nav-popover-loading">Updating...</div>
            ) : null}
            {notifications.length ? (
              <>
                <ul className="notification-list notification-list--refined">
                  {notifications.map((msg) => (
                    <li key={msg.id} className="notification-item">
                      <button
                        type="button"
                        className="notification-item-main"
                        onClick={() => openNotification(msg.id)}
                      >
                        <span className="notification-unread-dot" aria-hidden />
                        <span className="notification-item-copy">
                          <span className="notification-item-subject">{msg.subject || '(No subject)'}</span>
                          <span className="notification-item-meta">
                            {msg.reference_number ? <em>{msg.reference_number}</em> : null}
                            {msg.reference_number ? ' · ' : null}
                            {formatRelativeTime(msg.submitted_at || msg.created_at)}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="notification-dismiss-btn"
                        aria-label={`Dismiss ${msg.subject || 'message'}`}
                        onClick={() => markNotificationRead(msg.id)}
                      >
                        <Icon name="check" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="nav-popover-footer">
                  <button
                    type="button"
                    className="nav-popover-link-btn"
                    disabled={markingAll}
                    onClick={markAllNotificationsRead}
                  >
                    {markingAll ? 'Clearing...' : 'Mark all as read'}
                  </button>
                  <Link
                    to="/inbox"
                    className="nav-popover-inbox-link"
                    onClick={() => {
                      setNotificationsOpen(false);
                      setPinnedMenu(null);
                    }}
                  >
                    <Icon name="inbox" />
                    Open inbox
                  </Link>
                </div>
              </>
            ) : (
              <div className="nav-popover-empty">
                <Icon name="bell" />
                <strong>No new notifications</strong>
                <span>Unread messages will appear here when you receive them.</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div
        className="top-nav-menu"
        onMouseEnter={() => {
          if (pinnedMenu) return;
          setProfileOpen(true);
          setNotificationsOpen(false);
        }}
        onMouseLeave={closeUnpinnedMenus}
      >
        <button
          type="button"
          className={`icon-btn icon-btn--profile${profileOpen ? ' icon-btn--active' : ''}`}
          aria-label="Account menu"
          aria-expanded={profileOpen}
          aria-haspopup="dialog"
          onClick={toggleProfile}
        >
          {profilePhoto ? (
            <img className="profile-avatar-img" src={profilePhoto} alt="" />
          ) : (
            <span className="profile-avatar-fallback">{getProfileInitial(profile)}</span>
          )}
        </button>
        {profileOpen ? (
          <div className="top-popover top-popover--profile" role="dialog" aria-label="Account">
            {editingProfile ? (
              <form className="profile-edit-form" onSubmit={saveProfile}>
                <div className="nav-popover-header">
                  <h3>Edit profile</h3>
                  <button
                    type="button"
                    className="nav-popover-close"
                    aria-label="Close profile editor"
                    onClick={() => {
                      cancelEditProfile();
                      setProfileOpen(false);
                      setPinnedMenu(null);
                    }}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <div className="profile-edit-avatar-section">
                  <div className="profile-edit-avatar-wrapper">
                    {profilePhoto ? (
                      <img className="profile-edit-avatar-img" src={profilePhoto} alt="" />
                    ) : (
                      <span className="profile-edit-avatar-fallback">
                        {getProfileInitial({ name: profileForm.name, email: profileForm.email })}
                      </span>
                    )}
                    <label className="profile-edit-avatar-overlay">
                      <Icon name="user" />
                      <span>Change</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setProfileForm((form) => ({ ...form, profile_image: e.target.files?.[0] || null }))}
                      />
                    </label>
                  </div>
                </div>
                <div className="profile-edit-fields">
                  <label className="profile-field">
                    <span className="profile-field-label">Full name</span>
                    <div className="profile-field-input-wrapper">
                      <Icon name="user" />
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm((form) => ({ ...form, name: e.target.value }))}
                        required
                      />
                    </div>
                  </label>
                  <label className="profile-field">
                    <span className="profile-field-label">Email address</span>
                    <div className="profile-field-input-wrapper">
                      <Icon name="mail" />
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm((form) => ({ ...form, email: e.target.value }))}
                        required
                      />
                    </div>
                  </label>
                  <label className="profile-field">
                    <span className="profile-field-label">New password</span>
                    <div className="profile-field-input-wrapper">
                      <Icon name="lock" />
                      <input
                        type="password"
                        placeholder="Leave blank to keep current"
                        value={profileForm.password}
                        onChange={(e) => setProfileForm((form) => ({ ...form, password: e.target.value }))}
                        autoComplete="new-password"
                      />
                    </div>
                  </label>
                </div>
                <div className="profile-edit-actions">
                  <button type="submit" className="profile-save-btn" disabled={profileSaving}>
                    {profileSaving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button type="button" className="profile-cancel-btn" onClick={cancelEditProfile}>
                    Cancel
                  </button>
                </div>
                {profileMessage ? <div className={profileMessageClass}>{profileMessage}</div> : null}
              </form>
            ) : (
              <>
                <div className="profile-popover-header">
                  {profilePhoto ? (
                    <img className="profile-popover-avatar" src={profilePhoto} alt="" />
                  ) : (
                    <span className="profile-popover-avatar profile-popover-avatar--fallback">
                      {getProfileInitial(profile)}
                    </span>
                  )}
                  <div className="profile-popover-identity">
                    <h3>{profile?.name || 'Account'}</h3>
                    <p>{profile?.email || 'Email unavailable'}</p>
                    {profile?.position_title ? (
                      <span className="profile-popover-title">{profile.position_title}</span>
                    ) : null}
                    <span className={`status-pill role-pill role-pill--${profile?.role === 'admin' ? 'admin' : profile?.role === 'manager' ? 'manager' : 'staff'}`}>
                      {roleLabel(profile?.role)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="nav-popover-close"
                    aria-label="Close account menu"
                    onClick={() => {
                      setProfileOpen(false);
                      setPinnedMenu(null);
                    }}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <div className="nav-popover-actions">
                  <button type="button" className="nav-popover-action-btn" onClick={startEditProfile}>
                    Edit profile
                  </button>
                  <button type="button" className="nav-popover-action-btn nav-popover-action-btn--logout" onClick={logout}>
                    Sign out
                  </button>
                </div>
                {profileMessage ? <div className={profileMessageClass}>{profileMessage}</div> : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
