import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, NavLink, useLocation } from 'react-router-dom';

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
import NavUserMenus from './components/NavUserMenus';

import { roleFromToken, ADMIN_REGISTER_SESSION_KEY, LOGIN_ENTRANCE_KEY } from './utils/jwt';
import { api, authHeaders } from './utils/api';

	function PrivateRoute({ children }) {
  const token = sessionStorage.getItem('token');
	return token ? children : <Navigate to="/login" replace />;
	}



	function AdminRoute({ children }) {
	const token = sessionStorage.getItem('token');
	const role = roleFromToken(token);
	if (!token) return <Navigate to="/login" replace />;
	if (role !== 'admin') return <Navigate to="/" replace />;
	return children;
}

function RegisterRoute() {
	const token = sessionStorage.getItem('token');

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
		users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
		departments: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h1M9 13h1M9 17h1',
		chevron: 'm6 9 6 6 6-6',
		check: 'M20 6 9 17l-5-5',
		menu: 'M3 6h18M3 12h18M3 18h18',
		close: 'M18 6 6 18M6 6l12 12'
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

function NavBar({ onToggleSidebar }) {
	const token = sessionStorage.getItem('token');
	const homePath = token ? '/' : '/login';

	return (
		<header>
			<nav className="top-nav" aria-label="Main">
				<div className="top-nav-inner">
					{token ? (
						<button type="button" className="mobile-menu-btn" onClick={onToggleSidebar} aria-label="Toggle menu">
							<Icon name="menu" />
						</button>
					) : null}
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
							<span className="brand-title">Mesob Connect</span>
							<span className="brand-sub">Internal message management</span>
						</div>
					</Link>
					<div className="top-nav-links">
						<NavUserMenus token={token} />
						{!token && <>
							<NavLink className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`} to="/login">Login</NavLink>
						</>}
					</div>
				</div>
			</nav>
		</header>
	);
}

function SideBar({ mobileOpen, onClose }) {
	const token = sessionStorage.getItem('token');
	const isAdmin = roleFromToken(token) === 'admin';
	const location = useLocation();
	const [openGroups, setOpenGroups] = useState({
		messages: ['/inbox', '/sent', '/drafts', '/compose'].includes(location.pathname),
		tracking: location.pathname === '/track',
		admin: location.pathname === '/admin'
	});
	const [unreadInboxCount, setUnreadInboxCount] = useState(0);

	useEffect(() => {
		if (!token) {
			return undefined;
		}
		let ignore = false;
		const headers = authHeaders(token);
		const loadUnread = async () => {
			const dashboardResult = await api.get('/api/search/dashboard', { headers }).catch(() => null);
			if (ignore) return;
			if (dashboardResult) {
				setUnreadInboxCount(Number(dashboardResult.data?.unread) || 0);
			} else {
				setUnreadInboxCount(0);
			}
		};
		loadUnread();
		const interval = window.setInterval(loadUnread, 30000);
		return () => {
			ignore = true;
			window.clearInterval(interval);
		};
	}, [token]);

	if (!token) return null;

	const toggleGroup = (group) => {
		setOpenGroups((groups) => ({ ...groups, [group]: !groups[group] }));
	};
	const messagesActive = ['/inbox', '/sent', '/drafts', '/compose'].includes(location.pathname);
	const trackingActive = location.pathname === '/track';
	const adminActive = location.pathname === '/admin';

	return (
		<aside className={`side-nav${mobileOpen ? ' side-nav--mobile-open' : ''}`} aria-label="Tools">
			<div className="side-nav-site">
				<img className="side-nav-site-logo" src={APP_LOGO} alt="" width={40} height={40} />
				<div className="side-nav-site-text">
					<span className="side-nav-site-title">Lideta Center</span>
					<span className="side-nav-site-sub">Mesob Connect</span>
				</div>
			</div>
			<NavLink className={({ isActive }) => `side-nav-link${isActive ? ' side-nav-link--active' : ''}`} to="/" end><Icon name="dashboard" /><span className="side-nav-label">Dashboard</span></NavLink>
			<div className={`side-nav-group${openGroups.messages ? ' side-nav-group--open' : ''}`}>
				<button type="button" className={`side-nav-link side-nav-group-trigger${messagesActive ? ' side-nav-link--active-parent' : ''}`} onClick={() => toggleGroup('messages')} aria-expanded={openGroups.messages}>
					<span><Icon name="inbox" /><span className="side-nav-label">Messages</span></span>
					<Icon name="chevron" />
				</button>
				<div className="side-nav-submenu">
					<NavLink
						className={({ isActive }) => `side-nav-link side-nav-sublink${isActive ? ' side-nav-link--active' : ''}`}
						to="/inbox"
					>
						<Icon name="inbox" /><span className="side-nav-label">Inbox</span>
						{unreadInboxCount > 0 ? <span className="inbox-unread-badge">{unreadInboxCount}</span> : null}
					</NavLink>
					<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive ? ' side-nav-link--active' : ''}`} to="/sent"><Icon name="sent" /><span className="side-nav-label">Sent</span></NavLink>
					<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive ? ' side-nav-link--active' : ''}`} to="/drafts"><Icon name="drafts" /><span className="side-nav-label">Drafts</span></NavLink>
					<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive ? ' side-nav-link--active' : ''}`} to="/compose"><Icon name="compose" /><span className="side-nav-label">Compose</span></NavLink>
				</div>
			</div>
			<div className={`side-nav-group${openGroups.tracking ? ' side-nav-group--open' : ''}`}>
				<button type="button" className={`side-nav-link side-nav-group-trigger${trackingActive ? ' side-nav-link--active-parent' : ''}`} onClick={() => toggleGroup('tracking')} aria-expanded={openGroups.tracking}>
					<span><Icon name="track" /><span className="side-nav-label">Tracking</span></span>
					<Icon name="chevron" />
				</button>
				<div className="side-nav-submenu">
					<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive ? ' side-nav-link--active' : ''}`} to="/track"><Icon name="track" /><span className="side-nav-label">Track Messages</span></NavLink>
				</div>
			</div>
			{isAdmin ? (
				<div className={`side-nav-group${openGroups.admin ? ' side-nav-group--open' : ''}`}>
					<button type="button" className={`side-nav-link side-nav-group-trigger${adminActive ? ' side-nav-link--active-parent' : ''}`} onClick={() => toggleGroup('admin')} aria-expanded={openGroups.admin}>
						<span><Icon name="admin" /><span className="side-nav-label">Admin</span></span>
						<Icon name="chevron" />
					</button>
					<div className="side-nav-submenu">
						<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive && location.search !== '?section=departments' ? ' side-nav-link--active' : ''}`} to="/admin?section=users"><Icon name="users" /><span className="side-nav-label">Users</span></NavLink>
						<NavLink className={({ isActive }) => `side-nav-link side-nav-sublink${isActive && location.search === '?section=departments' ? ' side-nav-link--active' : ''}`} to="/admin?section=departments"><Icon name="departments" /><span className="side-nav-label">Departments</span></NavLink>
					</div>
				</div>
			) : null}
		</aside>
	);
}

function AppLayout() {
	const location = useLocation();
	const authRoute = location.pathname === '/login' || location.pathname === '/register';
	const [pageEnter, setPageEnter] = useState(false);
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

	useEffect(() => {
		if (authRoute) return undefined;
		if (sessionStorage.getItem(LOGIN_ENTRANCE_KEY) !== '1') return undefined;
		sessionStorage.removeItem(LOGIN_ENTRANCE_KEY);
		const start = window.setTimeout(() => setPageEnter(true), 0);
		const end = window.setTimeout(() => setPageEnter(false), 900);
		return () => {
			window.clearTimeout(start);
			window.clearTimeout(end);
		};
	}, [authRoute, location.pathname]);

	useEffect(() => {
		setMobileSidebarOpen(false);
	}, [location.pathname]);

	return (
		<>
			{!authRoute ? <NavBar onToggleSidebar={() => setMobileSidebarOpen((v) => !v)} /> : null}
			<div className={authRoute ? 'app-main app-main--auth' : 'app-main'}>
				{authRoute ? (
					<Routes>
						<Route path="/register" element={<RegisterRoute />} />
						<Route path="/login" element={<LoginPage />} />
					</Routes>
				) : (
					<div className="app-shell">
						{mobileSidebarOpen ? <div className="mobile-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} /> : null}
						<SideBar mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
						<div className={`app-content${pageEnter ? ' app-content--enter' : ''}`}>
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
