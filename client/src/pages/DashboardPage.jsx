import { useEffect, useState } from 'react';
import axios from 'axios';

export default function DashboardPage() {
  const [counts, setCounts] = useState({ inbox: 0, sent: 0, drafts: 0 });

  useEffect(() => {
    axios.get('/api/search/dashboard', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => setCounts(res.data));
  }, []);

  return (
    <div className="dashboard-container">
      <h2>Dashboard</h2>
      <div className="stats-grid">
        <div className="stat-card"><span>Inbox Messages</span><strong>{counts.inbox}</strong></div>
        <div className="stat-card"><span>Sent Messages</span><strong>{counts.sent}</strong></div>
        <div className="stat-card"><span>Drafts</span><strong>{counts.drafts}</strong></div>
      </div>
    </div>
  );
}
