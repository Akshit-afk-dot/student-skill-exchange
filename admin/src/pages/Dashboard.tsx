import { BarList, TrendChart } from '../components/charts';
import { ErrorAlert, Loading, Stat, plural } from '../components/ui';
import { useQuery } from '../hooks/useApi';
import type { DashboardStats } from '../lib/types';

export function DashboardPage() {
  const { data, error, loading } = useQuery<DashboardStats>('/admin/stats');

  if (loading) return <Loading label="Loading platform statistics…" />;
  if (error) return <ErrorAlert message={error} />;
  if (!data) return null;

  const { users, sessions, requests, community, skills } = data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Platform health at a glance.</p>
        </div>
      </div>

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
            <div className="grid grid-stats">
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
