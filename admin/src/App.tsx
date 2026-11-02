import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Icon, type IconName } from './components/icons';
import { Loading } from './components/ui';
import { useQuery } from './hooks/useApi';
import { useAuth } from './lib/auth';
import type { DashboardStats } from './lib/types';
import { AuditLogPage } from './pages/AuditLog';
import { DashboardPage } from './pages/Dashboard';
import { LoginPage } from './pages/Login';
import { ReportsPage } from './pages/Reports';
import { SkillsPage } from './pages/Skills';
import { UsersPage } from './pages/Users';

export function App() {
  const { user, loading } = useAuth();

  // Wait for the session check before deciding what to render, otherwise a signed-in
  // admin sees the login screen flash on every page load.
  if (loading) return <Loading label="Checking your session…" />;
  if (!user) return <LoginPage />;

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Sidebar() {
  const { user, signOut } = useAuth();
  // Polled lightly so the open-report count on the nav stays roughly current.
  const { data: stats } = useQuery<DashboardStats>('/admin/stats');
  const openReports = stats?.community.openReports ?? 0;
  const pendingSkills = stats?.skills.unapproved ?? 0;

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          SE
        </span>
        <span>Skill Exchange</span>
      </div>

      <div className="sidebar-links">
        <NavItem to="/" label="Dashboard" icon="dashboard" />
        <NavItem to="/users" label="Students" icon="users" />
        <NavItem to="/reports" label="Reports" icon="flag" count={openReports} />
        <NavItem to="/skills" label="Skills" icon="sparkles" count={pendingSkills} />
        <NavItem to="/audit-log" label="Audit log" icon="log" />
      </div>

      <div className="sidebar-footer">
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: 'var(--text)', fontWeight: 500 }}>{user?.name}</div>
          <div>{user?.email}</div>
        </div>
        <button className="btn btn-sm" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon,
  count,
}: {
  to: string;
  label: string;
  icon: IconName;
  count?: number;
}) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
      <span className="nav-label">
        <Icon name={icon} />
        {label}
      </span>
      {count && count > 0 ? <span className="badge badge-danger">{count}</span> : null}
    </NavLink>
  );
}
