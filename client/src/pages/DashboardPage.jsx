import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useLoginEntrance } from '../hooks/useLoginEntrance';

function formatEvent(type) {
  return String(type || 'activity')
    .replace(/_/g, ' ');
}


function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}


function numberValue(value) {
  return Number(value) || 0;
}

function compactNumber(value) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(numberValue(value));
}

function sumCounts(items = []) {
  return items.reduce((total, item) => total + numberValue(item.count), 0);
}

function averageCounts(items = []) {
  if (!items.length) return 0;
  return Math.round(sumCounts(items) / items.length);
}

function peakItem(items = []) {
  return items.reduce((peak, item) => (numberValue(item.count) > numberValue(peak?.count) ? item : peak), items[0] || null);
}

function monthLabel(monthKey) {
  const date = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return monthKey;
  return date.toLocaleDateString(undefined, { month: 'short' });
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeDayKey(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(date.getTime())) return localDateKey(date);
  return String(value).slice(0, 10);
}

function buildLastSixMonths(rows = []) {
  const byMonth = new Map(rows.map((item) => [String(item.month), numberValue(item.count)]));
  return Array.from({ length: 6 }).map((_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { month: key, label: monthLabel(key), count: byMonth.get(key) || 0 };
  });
}

function buildLastSevenDays(rows = []) {
  const byDay = new Map(rows.map((item) => [normalizeDayKey(item.day), numberValue(item.count)]));
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    return {
      day: key,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      count: byDay.get(key) || 0
    };
  });
}

function BarChart({ items, max, label }) {
  const hasData = items.some((item) => numberValue(item.count) > 0);

  return (
    <div className="mini-chart dashboard-chart dashboard-chart--animated" aria-label={label}>
      {hasData ? (
        items.map((item) => {
          const height = Math.max(8, (numberValue(item.count) / max) * 100);
          return (
            <div className="mini-chart-bar dashboard-chart-bar" key={item.day || item.month}>
              <span style={{ height: `${height}%` }} title={`${item.count} messages`}>
                <i>{item.count}</i>
              </span>
              <small>{item.label}</small>
            </div>
          );
        })
      ) : (
        <div className="dashboard-chart-empty">No message volume for this period yet.</div>
      )}
    </div>
  );
}

function StatisticsToggle({ weeklyStats, monthlyStats, maxWeekly, maxMonthly, enterDelay }) {
  const [statsView, setStatsView] = useState('weekly');
  const last3Months = useMemo(() => monthlyStats.slice(-3), [monthlyStats]);
  const options = [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: '3months', label: '3 Months' }
  ];

  const viewData = {
    weekly: { items: weeklyStats, max: maxWeekly, label: 'Last 7 days' },
    monthly: { items: monthlyStats, max: maxMonthly, label: 'Last 6 months' },
    '3months': { items: last3Months, max: Math.max(1, ...last3Months.map(m => m.count)), label: 'Last 3 months' }
  };

  const current = viewData[statsView];
  const currentTotal = sumCounts(current.items);
  const currentAverage = averageCounts(current.items);
  const currentPeak = peakItem(current.items);

  return (
    <section
      className="dashboard-panel dashboard-panel--chart dashboard-panel--statistics dashboard-panel--wide"
      style={enterDelay ? { '--dash-delay': enterDelay } : undefined}
    >
      <div className="panel-title-row">
        <div>
          <h3>Message Statistics</h3>
          <p className="admin-panel-hint">{current.label} message volume</p>
        </div>
        <div className="statistics-toggle" role="group" aria-label="Statistics range">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`toggle-btn ${statsView === option.id ? 'toggle-btn--active' : ''}`}
              onClick={() => setStatsView(option.id)}
              aria-pressed={statsView === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="dashboard-stat-summary" aria-label="Selected period summary">
        <div>
          <span>Total</span>
          <strong>{currentTotal}</strong>
        </div>
        <div>
          <span>Average</span>
          <strong>{currentAverage}</strong>
        </div>
        <div>
          <span>Peak</span>
          <strong>{currentPeak ? `${currentPeak.label} · ${numberValue(currentPeak.count)}` : 'None'}</strong>
        </div>
      </div>
      <BarChart items={current.items} max={current.max} label={`${current.label} message statistics`} />
    </section>
  );
}

export default function DashboardPage() {
  const loginEnter = useLoginEntrance();
  const [counts, setCounts] = useState({
    total_messages: 0,
    sent: 0,
    received: 0,
    drafts: 0,
    unread: 0,
    opened: 0,
    needs_action: 0,
    pending_tasks: 0,
    active_users: 0,
    department_activity: 0,
    this_month: 0,
    last_month: 0,
    weekly_stats: [],
    monthly_stats: [],
    recent_activity: []
  });
  const [error, setError] = useState('');
  const [profileName, setProfileName] = useState('');
  const token = sessionStorage.getItem('token');

  const weeklyStats = useMemo(() => buildLastSevenDays(counts.weekly_stats), [counts.weekly_stats]);
  const monthlyStats = useMemo(() => buildLastSixMonths(counts.monthly_stats), [counts.monthly_stats]);
  const maxWeekly = Math.max(1, ...weeklyStats.map((item) => item.count));
  const maxMonthly = Math.max(1, ...monthlyStats.map((item) => item.count));
  const displayName = profileName || 'User';



  const cards = [
    { key: 'total_messages', label: 'Total Messages', icon: 'TM', value: counts.total_messages, tone: 'blue', hint: `${compactNumber(counts.this_month)} this month` },
    { key: 'sent', label: 'Sent', icon: 'SE', value: counts.sent, tone: 'green', hint: 'Outbound letters' },
    { key: 'received', label: 'Received', icon: 'RC', value: counts.received ?? counts.inbox, tone: 'gold', hint: `${counts.unread} unread` },
    { key: 'drafts', label: 'Drafts', icon: 'DR', value: counts.drafts, tone: 'slate', hint: 'Not submitted' }
  ];

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    axios.get('/api/search/dashboard', { headers })
      .then((res) => {
        setCounts(res.data);
        setError('');
      })
      .catch(() => {
        setError('Unable to load dashboard counts.');
      });

    axios.get('/api/auth/me', { headers })
      .then((res) => {
        const nextName = String(res.data?.name || res.data?.email || '').trim();
        setProfileName(nextName);
      })
      .catch(() => {
        setProfileName(String(sessionStorage.getItem('user_name') || sessionStorage.getItem('email') || '').trim());
      });
  }, [token]);

  return (
    <div className={`dashboard-container dashboard-container--pro${loginEnter ? ' dashboard-container--enter' : ''}`}>
      <div className="dashboard-hero">
        <div className="dashboard-hero-brand">
          <img className="dashboard-hero-logo" src="/qms-logo.png" alt="" width={72} height={72} />
          <div>
            <span className="dashboard-kicker">Mesob Connect</span>
            <h2>Welcome, {displayName}</h2>
            <p className="admin-panel-hint">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {error ? <div className="error banner-message">{error}</div> : null}

      <div className="stats-grid analytics-grid dashboard-kpi-grid" style={{ marginBottom: 0 }}>

        {cards.map((card, index) => (
          <div
            className={`stat-card stat-card--${card.tone} dashboard-kpi-card`}
            key={card.key}
            style={loginEnter ? { '--dash-delay': `${0.1 + index * 0.07}s` } : undefined}
          >
            <div className="stat-card-icon">{card.icon}</div>
            <span>{card.label}</span>
            <strong>{numberValue(card.value)}</strong>
            <small>{card.hint}</small>
          </div>
        ))}
      </div>

      <div className="dashboard-grid dashboard-grid--pro dashboard-grid--focus">
        <StatisticsToggle
          weeklyStats={weeklyStats}
          monthlyStats={monthlyStats}
          maxWeekly={maxWeekly}
          maxMonthly={maxMonthly}
          enterDelay={loginEnter ? '0.38s' : undefined}
        />

        <section
          className="dashboard-panel dashboard-panel--wide"
          style={loginEnter ? { '--dash-delay': '0.48s' } : undefined}
        >
          <div className="panel-title-row">
            <h3>Your Recent Activity</h3>
            <span className="badge">Latest</span>
          </div>
          <ul className="activity-feed dashboard-activity-feed">
            {(counts.recent_activity || []).map((item) => (
              <li key={item.id}>
                <span className={`activity-dot ${(() => {
                  const t = String(item.event_type || '');
                  if (t === 'sent' || t === 'submit') return 'activity-dot--sent';
                  if (t === 'delivered') return 'activity-dot--delivered';
                  if (t === 'opened' || t === 'read') return 'activity-dot--opened';
                  if (t === 'printed') return 'activity-dot--printed';
                  if (t === 'pdf_downloaded' || t === 'downloaded_pdf') return 'activity-dot--pdf_downloaded';
                  if (t === 'forwarded') return 'activity-dot--forwarded';
                  if (t === 'created_draft') return 'activity-dot--created_draft';
                  return 'activity-dot--default';
                })()}`} />
                <div>
                  <strong>{formatEvent(item.event_type)}</strong>
                  <p>
                    {item.message_id ? (
                      <Link to={`/messages/${item.message_id}`}>
                        {item.subject || '(No subject)'} {item.reference_number ? `- ${item.reference_number}` : ''}
                      </Link>
                    ) : (
                      <>{item.subject || '(No subject)'} {item.reference_number ? `- ${item.reference_number}` : ''}</>
                    )}
                  </p>
                  <small>You {formatDate(item.created_at)}</small>
                </div>
              </li>
            ))}
            {!(counts.recent_activity || []).length ? <li className="empty-state">No recent activity found for your account.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
