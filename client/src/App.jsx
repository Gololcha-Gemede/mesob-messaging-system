import { BrowserRouter as Router, Routes, Route, Navigate, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
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

function NavBar() {
	const token = localStorage.getItem('token');
	const navigate = useNavigate();
	const homePath = token ? '/' : '/login';
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
					<div className="top-nav-links">
						{token && <>
							<NavLink className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`} to="/" end>Dashboard</NavLink>
							<NavLink className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`} to="/inbox">Inbox</NavLink>
							<NavLink className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`} to="/sent">Sent</NavLink>
							<NavLink className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`} to="/drafts">Drafts</NavLink>
							<button type="button" className="logout-btn" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
						</>}
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
	if (!token) return null;

	return (
		<aside className="side-nav" aria-label="Tools">
			<NavLink className={({ isActive }) => `side-nav-link${isActive ? ' side-nav-link--active' : ''}`} to="/compose">Compose</NavLink>
			<NavLink className={({ isActive }) => `side-nav-link${isActive ? ' side-nav-link--active' : ''}`} to="/track">Track</NavLink>
			{isAdmin ? (
				<NavLink className={({ isActive }) => `side-nav-link${isActive ? ' side-nav-link--active' : ''}`} to="/admin">Admin</NavLink>
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
		</Router>
	);
}
