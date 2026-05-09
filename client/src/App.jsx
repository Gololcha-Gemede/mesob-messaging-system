import { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import InboxPage from './pages/InboxPage';
import SentPage from './pages/SentPage';
import DraftsPage from './pages/DraftsPage';
import ComposeMessagePage from './pages/ComposeMessagePage';
import MessageDetailPage from './pages/MessageDetailPage';
import AdminPanelPage from './pages/AdminPanelPage';
import TrackMessagePage from './pages/TrackMessagePage';
import { roleFromToken, ADMIN_REGISTER_SESSION_KEY } from './utils/jwt';
import { notify } from './utils/notify';

function PrivateRoute({ children }) {
	const token = localStorage.getItem('token');
	return token ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
	const token = localStorage.getItem('token');
	const role = roleFromToken(token);
	if (!token) return <Navigate to="/login" replace />;
	if (role !== 'admin') return <Navigate to="/" replace />;
	return children;
}

function RegisterRoute() {
	const token = localStorage.getItem('token');
	const location = useLocation();
	const role = roleFromToken(token);
	const fromAdmin =
		location.state?.fromAdmin === true ||
		sessionStorage.getItem(ADMIN_REGISTER_SESSION_KEY) === '1';
	if (!token) return <Navigate to="/login" replace />;
	if (role !== 'admin') return <Navigate to="/" replace />;
	if (!fromAdmin) return <Navigate to="/admin" replace />;
	return <RegisterPage />;
}

const APP_LOGO = '/qms-logo.png';

function Icon({ name }) {
	const icons = {
		dashboard: 'M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-12h8V3h-8v6Z',
		inbox: 'M4 4h16l-2 10h-4a4 4 0 0 1-8 0H2L4 4Zm2 4h12',
		sent: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
		drafts: 'M4 4h16v16H4V4Zm4 5h8M8 13h6',
		compose: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z',
		track: 'M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm0-11v4l2.5 1.5',
		admin: 'M12 3l8 4v5c0 5-3.4 8.5-8 9-4.6-.5-8-4-8-9V7l8-4Zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3 5a3 3 0 0 1 6 0',
		bell: 'M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Zm-4 4a2 2 0 0 1-4 0',
		profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0',
		users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
		departments: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h1M9 13h1M9 17h1',
		chevron: 'm6 9 6 6 6-6',
		check: 'M20 6 9 17l-5-5'
	};
	return (
		<svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
			<path d={icons[name]} />
		</svg>
	);
}

function ToastHost() {
	const [toasts, setToasts] = useState([]);

	useEffect(() => {
		const addToast = (event) => {
			const detail = event.detail || {};
			const toast = {
				id: Date.now() + Math.random(),
				type: detail.type || 'info',
				title: detail.title || 'Notification',
				message: detail.message || ''
			};
			setToasts((items) => [...items, toast].slice(-4));
			window.setTimeout(() => {
				setToasts((items) => items.filter((item) => item.id !== toast.id));
			}, 4200);
		};
		window.addEventListener('mesob:toast', addToast);
		return () => window.removeEventListener('mesob:toast', addToast);
	}, []);

	return (
		<div className="toast-stack" aria-live="polite" aria-atomic="true">
			{toasts.map((toast) => (
				<div className={`toast toast--${toast.type}`} key={toast.id}>
					<strong>{toast.title}</strong>
					{toast.message ? <span>{toast.message}</span> : null}
				</div>
			))}
		</div>
	);
}

function NavBar() {
	const token = localStorage.getItem('token');
	const navigate = useNavigate();
	const location = useLocation();
	const homePath = token ? '/' : '/login';
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [profileOpen, setProfileOpen] = useState(false);
	const [notifications, setNotifications] = useState([]);
	const [notificationCount, setNotificationCount] = useState(0);
	const [profile, setProfile] = useState(null);
	const [editingProfile, setEditingProfile] = useState(false);
	const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '' });
	const [profileSaving, setProfileSaving] = useState(false);
	const [profileMessage, setProfileMessage] = useState('');
	const navActionsRef = useRef(null);
	const lastNotificationCountRef = useRef(null);

	useEffect(() => {
		if (!token) return;
		let ignore = false;
		const headers = { Authorization: `Bearer ${token}` };
		const loadNavData = () => Promise.allSettled([
			axios.get('/api/messages/notifications', { headers }),
			axios.get('/api/auth/me', { headers })
		]).then(([notificationsRes, profileRes]) => {
			if (ignore) return;
			if (notificationsRes.status === 'fulfilled') {
				const data = notificationsRes.value.data;
				const nextCount = Number(data?.count) || 0;
				setNotifications(Array.isArray(data?.messages) ? data.messages : []);
				setNotificationCount(nextCount);
				if (lastNotificationCountRef.current !== null && nextCount > lastNotificationCountRef.current) {
					notify({ type: 'info', title: 'New Message Received notification', message: 'You have a new unread message.' });
				}
				lastNotificationCountRef.current = nextCount;
			}
			if (profileRes.status === 'fulfilled') {
				setProfile(profileRes.value.data);
				setProfileForm({
					name: profileRes.value.data?.name || '',
					email: profileRes.value.data?.email || '',
					password: ''
				});
			}
		});
		loadNavData();
		const interval = window.setInterval(loadNavData, 30000);
		return () => {
			ignore = true;
			window.clearInterval(interval);
		};
	}, [token, location.pathname]);

	useEffect(() => {
		const closeMenus = (event) => {
			if (!navActionsRef.current?.contains(event.target)) {
				setNotificationsOpen(false);
				setProfileOpen(false);
				setEditingProfile(false);
				setProfileMessage('');
			}
		};
		document.addEventListener('pointerdown', closeMenus);
		return () => document.removeEventListener('pointerdown', closeMenus);
	}, []);

	const logout = () => {
		localStorage.removeItem('token');
		setProfileOpen(false);
		setNotificationsOpen(false);
		navigate('/login');
	};

	const saveProfile = async (e) => {
		e.preventDefault();
		setProfileSaving(true);
		setProfileMessage('');
		try {
			const res = await axios.put('/api/auth/me', profileForm, {
				headers: { Authorization: `Bearer ${token}` }
			});
			setProfile(res.data);
			setProfileForm({ name: res.data.name || '', email: res.data.email || '', password: '' });
			setEditingProfile(false);
			setProfileMessage('Profile updated.');
		} catch (err) {
			setProfileMessage(err?.response?.data?.message || 'Could not update profile.');
		} finally {
			setProfileSaving(false);
		}
	};

	const markNotificationRead = async (messageId) => {
		try {
			await axios.patch(`/api/messages/${messageId}/read`, {}, {
				headers: { Authorization: `Bearer ${token}` }
			});
			setNotifications((items) => items.filter((item) => item.id !== messageId));
			setNotificationCount((count) => Math.max(0, count - 1));
			notify({ type: 'success', title: 'Notification read', message: 'Message notification was marked as read.' });
		} catch {
			notify({ type: 'error', title: 'Could not update notification', message: 'Please try again.' });
		}
	};

	return (
		<header>
			<nav className="top-nav" aria-label="Main">
				<div className="top-nav-inner">
					<Link to={homePath} className="brand-block">
						<img
							className="brand-logo"
							src={APP_LOGO}
							alt=""
							width={44}
							height={44}
							onError={(e) => {
								e.currentTarget.style.display = 'none';
							}}
						/>
						<div className="brand-text">
							<span className="brand-title">MESOB IMMS</span>
							<span className="brand-sub">Internal message management</span>
						</div>
					</Link>
					<div className="top-nav-links" ref={navActionsRef}>
						{token && (
							<>
								<div
									className="top-nav-menu"
									onMouseEnter={() => {
										setNotificationsOpen(true);
										setProfileOpen(false);
									}}
								>
									<button
										type="button"
										className="icon-btn"
										aria-label="Notifications"
										onClick={() => {
											setNotificationsOpen((open) => !open);
											setProfileOpen(false);
										}}
									>
										<Icon name="bell" />
										{notificationCount ? <span className="notification-badge">{notificationCount}</span> : null}
									</button>
									{notificationsOpen ? (
										<div className="top-popover notification-popover">
											<div className="popover-title-row">
												<h3>Notifications</h3>
												<span>{notificationCount} unread</span>
											</div>
											{notifications.length ? (
												<ul className="notification-list">
													{notifications.map((msg) => (
														<li key={msg.id}>
															<div className="notification-card">
																<Link to={`/messages/${msg.id}`} onClick={() => setNotificationsOpen(false)}>
																	<span>{msg.subject || '(No subject)'}</span>
																	<small>{msg.reference_number}</small>
																</Link>
																<button type="button" className="notification-read-btn" onClick={() => markNotificationRead(msg.id)} aria-label="Mark notification as read">
																	<Icon name="check" />
																</button>
															</div>
														</li>
													))}
												</ul>
											) : (
												<div className="popover-empty">No unread messages or system alerts.</div>
											)}
										</div>
									) : null}
								</div>
								<div
									className="top-nav-menu"
									onMouseEnter={() => {
										setProfileOpen(true);
										setNotificationsOpen(false);
									}}
								>
									<button
										type="button"
										className="icon-btn"
										aria-label="Profile"
										onClick={() => {
											setProfileOpen((open) => !open);
											setNotificationsOpen(false);
											setEditingProfile(false);
											setProfileMessage('');
										}}
									>
										<Icon name="profile" />
									</button>
									{profileOpen ? (
										<div className="top-popover profile-popover">
											{editingProfile ? (
												<form className="profile-edit-form" onSubmit={saveProfile}>
													<h3>Edit Profile</h3>
													<input
														type="text"
														placeholder="Name"
														value={profileForm.name}
														onChange={(e) => setProfileForm((form) => ({ ...form, name: e.target.value }))}
														required
													/>
													<input
														type="email"
														placeholder="Email"
														value={profileForm.email}
														onChange={(e) => setProfileForm((form) => ({ ...form, email: e.target.value }))}
														required
													/>
													<input
														type="password"
														placeholder="New password (optional)"
														value={profileForm.password}
														onChange={(e) => setProfileForm((form) => ({ ...form, password: e.target.value }))}
														autoComplete="new-password"
													/>
													<div className="profile-action-row">
														<button type="submit" disabled={profileSaving}>{profileSaving ? 'Saving...' : 'Save'}</button>
														<button type="button" className="secondary-btn" onClick={() => setEditingProfile(false)}>Cancel</button>
													</div>
													{profileMessage ? <div className="profile-message">{profileMessage}</div> : null}
												</form>
											) : (
												<>
													<h3>{profile?.name || 'Current user'}</h3>
													<p>{profile?.email || 'Email unavailable'}</p>
													<span className="status-pill status-submitted">{profile?.role || 'user'}</span>
													<div className="profile-action-row">
														<button type="button" onClick={() => setEditingProfile(true)}>Edit</button>
														<button type="button" className="profile-logout-btn" onClick={logout}>Logout</button>
													</div>
													{profileMessage ? <div className="profile-message">{profileMessage}</div> : null}
												</>
											)}
										</div>
									) : null}
								</div>
							</>
						)}
						{!token && <>
							<NavLink className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`} to="/login">Login</NavLink>
						</>}
					</div>
				</div>
			</nav>
		</header>
	);
}

function SideBar() {
	const token = localStorage.getItem('token');
	const isAdmin = roleFromToken(token) === 'admin';
	const location = useLocation();
	const [openGroups, setOpenGroups] = useState({
		messages: ['/inbox', '/sent', '/drafts', '/compose'].includes(location.pathname),
		tracking: location.pathname === '/track',
		admin: location.pathname === '/admin'
	});
	if (!token) return null;

	const toggleGroup = (group) => {
		setOpenGroups((groups) => ({ ...groups, [group]: !groups[group] }));
	};

	return (
		<aside className="side-nav" aria-label="Tools">
			<NavLink className={({ isActive }) => `side-nav-link${isActive ? ' side-nav-link--active' : ''}`} to="/" end><Icon name="dashboard" />Dashboard</NavLink>
			<div className={`side-nav-group${openGroups.messages ? ' side-nav-group--open' : ''}`}>
				<button type="button" className="side-nav-link side-nav-group-trigger" onClick={() => toggleGroup('messages')} aria-expanded={openGroups.messages}>
					<span><Icon name="inbox" />Messages</span>
					<Icon name="chevron" />
				</button>
				<div className="side-nav-submenu">
					<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive ? ' side-nav-link--active' : ''}`} to="/inbox"><Icon name="inbox" />Inbox</NavLink>
					<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive ? ' side-nav-link--active' : ''}`} to="/sent"><Icon name="sent" />Sent</NavLink>
					<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive ? ' side-nav-link--active' : ''}`} to="/drafts"><Icon name="drafts" />Drafts</NavLink>
					<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive ? ' side-nav-link--active' : ''}`} to="/compose"><Icon name="compose" />Compose</NavLink>
				</div>
			</div>
			<div className={`side-nav-group${openGroups.tracking ? ' side-nav-group--open' : ''}`}>
				<button type="button" className="side-nav-link side-nav-group-trigger" onClick={() => toggleGroup('tracking')} aria-expanded={openGroups.tracking}>
					<span><Icon name="track" />Tracking</span>
					<Icon name="chevron" />
				</button>
				<div className="side-nav-submenu">
					<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive ? ' side-nav-link--active' : ''}`} to="/track"><Icon name="track" />Track Messages</NavLink>
				</div>
			</div>
			{isAdmin ? (
				<div className={`side-nav-group${openGroups.admin ? ' side-nav-group--open' : ''}`}>
					<button type="button" className="side-nav-link side-nav-group-trigger" onClick={() => toggleGroup('admin')} aria-expanded={openGroups.admin}>
						<span><Icon name="admin" />Admin</span>
						<Icon name="chevron" />
					</button>
					<div className="side-nav-submenu">
						<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive && location.search !== '?section=departments' ? ' side-nav-link--active' : ''}`} to="/admin?section=users"><Icon name="users" />Users</NavLink>
						<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive && location.search === '?section=departments' ? ' side-nav-link--active' : ''}`} to="/admin?section=departments"><Icon name="departments" />Departments</NavLink>
					</div>
				</div>
			) : null}
		</aside>
	);
}

function AppLayout() {
	const location = useLocation();
	const authRoute = location.pathname === '/login' || location.pathname === '/register';
	return (
		<>
			{!authRoute ? <NavBar /> : null}
			<div className={authRoute ? 'app-main app-main--auth' : 'app-main'}>
				{authRoute ? (
					<Routes>
						<Route path="/register" element={<RegisterRoute />} />
						<Route path="/login" element={<LoginPage />} />
					</Routes>
				) : (
					<div className="app-shell">
						<SideBar />
						<div className="app-content">
							<Routes>
								<Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
								<Route path="/inbox" element={<PrivateRoute><InboxPage /></PrivateRoute>} />
								<Route path="/sent" element={<PrivateRoute><SentPage /></PrivateRoute>} />
								<Route path="/drafts" element={<PrivateRoute><DraftsPage /></PrivateRoute>} />
								<Route path="/track" element={<PrivateRoute><TrackMessagePage /></PrivateRoute>} />
								<Route path="/compose" element={<PrivateRoute><ComposeMessagePage /></PrivateRoute>} />
								<Route path="/messages/:id" element={<PrivateRoute><MessageDetailPage /></PrivateRoute>} />
								<Route path="/admin" element={<PrivateRoute><AdminRoute><AdminPanelPage /></AdminRoute></PrivateRoute>} />
							</Routes>
						</div>
					</div>
				)}
			</div>
		</>
	);
}

export default function App() {
	return (
		<Router>
			<AppLayout />
			<ToastHost />
		</Router>
	);
}
