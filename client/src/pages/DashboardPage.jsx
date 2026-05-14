import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { roleFromToken } from '../utils/jwt';

function formatEvent(type) {
  return String(type || 'activity').replace(/_/g, ' ');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export default function DashboardPage() {
  const [counts, setCounts] = useState({
    total_messages: 0,
    sent: 0,
    received: 0,
    drafts: 0,
    archived: 0,
    unread: 0,
    active_users: 0,
    department_activity: 0,
    weekly_stats: [],
    recent_activity: []
  });
  const [error, setError] = useState('');
  const token = sessionStorage.getItem('token');

  const isAdmin = roleFromToken(token) === 'admin';
  const maxWeekly = Math.max(1, ...((counts.weekly_stats || []).map((item) => Number(item.count) || 0)));

  const cards = [
    { key: 'total_messages', label: 'Total Messages', icon: 'TM', value: counts.total_messages, tone: 'blue' },
    { key: 'sent', label: 'Sent Messages', icon: 'SE', value: counts.sent, tone: 'green' },
    { key: 'received', label: 'Received Messages', icon: 'RC', value: counts.received ?? counts.inbox, tone: 'gold' },
    { key: 'drafts', label: 'Draft Messages', icon: 'DR', value: counts.drafts, tone: 'slate' },
    ...(isAdmin ? [
      { key: 'active_users', label: 'Active Users', icon: 'AU', value: counts.active_users, tone: 'green' },
      { key: 'department_activity', label: 'Department Activity', icon: 'DA', value: counts.department_activity, tone: 'gold' }
    ] : [])
  ];

  useEffect(() => {
    axios.get('/api/search/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setCounts(res.data);
        setError('');
      })
      .catch(() => {
        setError('Unable to load dashboard counts.');
      });
  }, [token]);

  return (
    <div className="dashboard-container">
      <div className="page-title-row">
        <div>
          <h2>Dashboard</h2>
          <p className="admin-panel-hint">Messaging performance, workload, and operational activity at a glance.</p>
        </div>
      </div>
      {error ? <div className="error banner-message">{error}</div> : null}
      <div className="stats-grid analytics-grid">
        {cards.map((card) => (
          <div className={`stat-card stat-card--${card.tone}`} key={card.key}>
            <div className="stat-card-icon">{card.icon}</div>
            <span>{card.label}</span>
            <strong>{Number(card.value) || 0}</strong>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="panel-title-row">
            <h3>Weekly Message Statistics</h3>
            <span className="badge">7 days</span>
          </div>
          <div className="mini-chart" aria-label="Weekly message statistics chart">
            {(counts.weekly_stats || []).length ? counts.weekly_stats.map((item) => {
              const height = Math.max(8, ((Number(item.count) || 0) / maxWeekly) * 100);
              return (
                <div className="mini-chart-bar" key={String(item.day)}>
                  <span style={{ height: `${height}%` }} title={`${item.count} messages`} />
                  <small>{String(item.day).slice(5, 10)}</small>
                </div>
              );
            }) : <div className="empty-state">No weekly message activity yet.</div>}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="panel-title-row">
            <h3>Quick Actions</h3>
          </div>
          <div className="quick-actions">
            <Link className="quick-action" to="/compose">Compose Message</Link>
            {isAdmin ? <Link className="quick-action" to="/admin?section=users">Create User</Link> : null}
            {isAdmin ? <Link className="quick-action" to="/admin?section=departments">Manage Departments</Link> : null}
          </div>
        </section>

        <section className="dashboard-panel dashboard-panel--wide">
          <div className="panel-title-row">
            <h3>Recent Activity Feed</h3>
          </div>
          <ul className="activity-feed">
            {(counts.recent_activity || []).map((item) => (
              <li key={item.id}>
                <span className="activity-dot" />
                <div>
                  <strong>{formatEvent(item.event_type)}</strong>
                  <p>{item.subject || '(No subject)'} {item.reference_number ? `- ${item.reference_number}` : ''}</p>
                  <small>{item.actor_name || 'System'} {formatDate(item.created_at)}</small>
                </div>
              </li>
            ))}
            {!(counts.recent_activity || []).length ? <li className="empty-state">No recent activity found.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
