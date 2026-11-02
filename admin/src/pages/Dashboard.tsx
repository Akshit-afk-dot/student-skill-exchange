import { Link } from 'react-router-dom';
import { BarList, TrendChart } from '../components/charts';
import { ErrorAlert, Stat, StatsSkeleton, plural } from '../components/ui';
import { useQuery } from '../hooks/useApi';
import { useAuth } from '../lib/auth';
import type { DashboardStats } from '../lib/types';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useQuery<DashboardStats>('/admin/stats');

  const firstName = user?.name.split(' ')[0] ?? '';
  // Rendered in every state so the heading never jumps when the data arrives.
  const header = (
    <div className="page-head">
      <div>
        <h1>Dashboard</h1>
        <p>
          {timeOfDayGreeting()}
          {firstName ? `, ${firstName}` : ''}. Platform health at a glance.
        </p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <>
        {header}
        <StatsSkeleton count={4} />
      </>
    );
  }

  if (error) {
    return (
      <>
        {header}
        <div className="card">
          <div className="empty">
            <ErrorAlert message={error} />
            <button className="btn" onClick={reload}>
              Try again
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!data) return header;

  const { users, sessions, requests, community, skills } = data;

  // Only the queues that have work in them. An empty dashboard should say nothing here.
  const attention = [
    {
      key: 'reports',
      label: 'Open reports',
      count: community.openReports,
      to: '/reports',
      action: 'Review reports',
    },
    {
      key: 'skills',
      label: 'Skills awaiting approval',
      count: skills.unapproved,
      to: '/skills',
      action: 'Review skills',
    },
  ].filter((item) => item.count > 0);

  return (
    <>
      {header}

      {attention.length > 0 ? (
        <section aria-label="Needs attention" className="mb-16">
          <h2 className="mb-16">Needs attention</h2>
          <div className="attention-grid">
            {attention.map((item) => (
              <Link key={item.key} to={item.to} className="attention-card">
                <div>
                  <div className="attention-label">{item.label}</div>
                  <div className="attention-action">{item.action} →</div>
                </div>
                <div className="attention-count">{item.count}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label="Students" className="mb-16">
        <h2 className="mb-16">Students</h2>
        <div className="grid grid-stats">
          <Stat
            label="Total students"
            value={users.total}
            hint={`${plural(users.newThisWeek, 'student')} joined this week`}
          />
          <Stat
            label="Active"
            value={users.active}
            hint={`${users.onlineNow} online right now`}
          />
          <Stat
            label="Verified email"
            value={users.verified}
            hint={
              users.total > 0
                ? `${Math.round((users.verified / users.total) * 100)}% of accounts`
                : '—'
            }
          />
          <Stat
            label="Restricted"
            value={users.suspended + users.banned}
            hint={`${users.suspended} suspended · ${users.banned} banned`}
          />
        </div>
      </section>

      <section aria-label="Learning activity" className="mb-16">
        <h2 className="mb-16">Learning activity</h2>
        <div className="grid grid-stats">
          <Stat
            label="Sessions"
            value={sessions.total}
            hint={`${sessions.completed} completed · ${sessions.scheduled} upcoming`}
          />
          <Stat
            label="Completion rate"
            value={`${sessions.completionRate}%`}
            hint={`${sessions.cancelled} cancelled`}
          />
          <Stat
            label="Hours exchanged"
            value={sessions.totalHoursExchanged}
            hint="Across all completed sessions"
          />
          <Stat
            label="Request acceptance"
            value={`${requests.acceptanceRate}%`}
            hint={`${plural(requests.pending, 'request')} still pending`}
          />
        </div>
      </section>

      <section aria-label="Community" className="mb-16">
        <h2 className="mb-16">Community</h2>
        <div className="grid grid-stats">
          <Stat label="Connections" value={community.connections} hint="Active exchange pairs" />
          <Stat label="Messages" value={community.messages} hint="Sent through in-app chat" />
          <Stat
            label="Average rating"
            value={community.averageRating || '—'}
            hint={plural(community.reviews, 'review')}
          />
          <Stat
            label="Open reports"
            value={community.openReports}
            hint={community.openReports > 0 ? 'Needs moderator attention' : 'Queue is clear'}
            tone={community.openReports > 0 ? 'alert' : 'neutral'}
          />
        </div>
      </section>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Signups — last 30 days</h2>
          </div>
          <div className="card-body">
            <TrendChart points={data.growth} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Skill catalogue</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-3">
              <Stat label="Skills" value={skills.total} />
              <Stat label="Categories" value={skills.categories} />
              <Stat
                label="Awaiting approval"
                value={skills.unapproved}
                hint={skills.unapproved > 0 ? 'Student-proposed' : 'All reviewed'}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Most taught skills</h2>
          </div>
          <div className="card-body">
            <BarList items={data.topSkills.mostTaught} emptyLabel="No teaching skills listed yet." />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Most wanted skills</h2>
          </div>
          <div className="card-body">
            <BarList
              items={data.topSkills.mostWanted}
              emptyLabel="No learning goals listed yet."
            />
          </div>
        </div>
      </div>
    </>
  );
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
