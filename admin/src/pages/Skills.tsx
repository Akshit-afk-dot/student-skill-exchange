import { useMemo, useState } from 'react';
import {
  Badge,
  EmptyState,
  ErrorAlert,
  TableSkeleton,
  Modal,
  Pagination,
  formatDate,
} from '../components/ui';
import { useMutation, useQuery } from '../hooks/useApi';
import { api, type Paginated } from '../lib/api';
import type { AdminSkill, SkillCategory, SkillReviewStatus } from '../lib/types';

/** Matches COMMUNITY_APPROVAL_STUDENTS in server/src/modules/skills/service.ts. */
const COMMUNITY_APPROVAL_STUDENTS = 3;

function categoryName(skill: AdminSkill): string {
  return skill.category?.name ?? '—';
}

const STATUS_FILTERS: Array<{ value: SkillReviewStatus; label: string }> = [
  { value: 'all', label: 'All live skills' },
  { value: 'pending', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'removed', label: 'Removed' },
];

/** Where a skill stands, and for approved skills, who approved it. */
function SkillStatus({ skill }: { skill: AdminSkill }) {
  if (skill.rejectedAt) {
    return (
      <span title={skill.rejectReason ?? undefined}>
        <Badge tone="danger">removed</Badge>
      </span>
    );
  }
  if (!skill.approved) return <Badge tone="warning">in review</Badge>;
  if (skill.approvedVia === 'CATALOGUE') return <Badge tone="neutral">catalogue</Badge>;
  if (skill.approvedVia === 'COMMUNITY') return <Badge tone="info">approved by students</Badge>;
  return <Badge tone="success">approved</Badge>;
}

export function SkillsPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<SkillReviewStatus>('all');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [mergeSource, setMergeSource] = useState<AdminSkill | null>(null);
  const [removing, setRemoving] = useState<AdminSkill | null>(null);

  const { data: categories } = useQuery<SkillCategory[]>('/skills/categories');

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '50', status });
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    return `/admin/skills?${params.toString()}`;
  }, [page, query, category, status]);

  const { data, error, loading, reload } = useQuery<Paginated<AdminSkill>>(path);

  const approve = useMutation(async (id: string) => api.post(`/admin/skills/${id}/approve`));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Skill catalogue</h1>
          <p>
            Skills students add stay in review, visible only on their own lists, until you approve
            them or {COMMUNITY_APPROVAL_STUDENTS} students have added the same one. Remove anything that
            isn&apos;t a real skill, and merge duplicates.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          Add skill
        </button>
      </div>

      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <input
          type="search"
          placeholder="Search skills"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search skills"
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as SkillReviewStatus);
          }}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => {
            setPage(1);
            setCategory(e.target.value);
          }}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn">Search</button>
      </form>

      <ErrorAlert message={error ?? approve.error} />

      <div className="card">
        {loading ? (
          <TableSkeleton rows={6} columns={8} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title={status === 'pending' ? 'Nothing waiting for review' : 'No skills found'}
            hint={status === 'pending' ? 'New skills students add will appear here.' : 'Try a different search or filter.'}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Category</th>
                    <th>Teaching</th>
                    <th>Learning</th>
                    <th>Status</th>
                    <th>Added by</th>
                    <th>Added</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((skill) => {
                    const catalogue = skill.approvedVia === 'CATALOGUE';
                    return (
                      <tr key={skill.id}>
                        <td>
                          <div>{skill.name}</div>
                          <div className="cell-sub mono">
                            {skill.slug}
                            {skill.aliases && skill.aliases.length > 0 ? ` · also ${skill.aliases.join(', ')}` : ''}
                          </div>
                        </td>
                        <td>{categoryName(skill)}</td>
                        <td>{skill.teachCount}</td>
                        <td>{skill.learnCount}</td>
                        <td>
                          <SkillStatus skill={skill} />
                        </td>
                        <td>
                          {skill.createdBy ? (
                            <>
                              <div>{skill.createdBy.name}</div>
                              <div className="cell-sub">{skill.createdBy.email}</div>
                            </>
                          ) : (
                            <span className="muted">{catalogue ? 'Catalogue' : 'Admin'}</span>
                          )}
                        </td>
                        <td className="nowrap">{formatDate(skill.createdAt)}</td>
                        <td className="text-right">
                          <div className="row" style={{ justifyContent: 'flex-end' }}>
                            {!skill.approved ? (
                              <button
                                className="btn btn-sm"
                                disabled={approve.pending}
                                onClick={async () => {
                                  if ((await approve.run(skill.id)) !== null) reload();
                                }}
                              >
                                {skill.rejectedAt ? 'Restore' : 'Approve'}
                              </button>
                            ) : null}
                            {!skill.rejectedAt && !catalogue ? (
                              <button className="btn btn-sm btn-danger" onClick={() => setRemoving(skill)}>
                                Remove
                              </button>
                            ) : null}
                            {!skill.rejectedAt ? (
                              <button className="btn btn-sm" onClick={() => setMergeSource(skill)}>
                                Merge
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              onPage={setPage}
            />
          </>
        )}
      </div>

      {creating ? (
        <CreateSkillModal
          categories={categories ?? []}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            reload();
          }}
        />
      ) : null}

      {mergeSource ? (
        <MergeSkillModal
          source={mergeSource}
          onClose={() => setMergeSource(null)}
          onDone={() => {
            setMergeSource(null);
            reload();
          }}
        />
      ) : null}

      {removing ? (
        <RemoveSkillModal
          skill={removing}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

/** Takes a student-added skill off every list. The students are told, with the reason. */
function RemoveSkillModal({
  skill,
  onClose,
  onDone,
}: {
  skill: AdminSkill;
  onClose(): void;
  onDone(): void;
}) {
  const [reason, setReason] = useState('');
  const remove = useMutation(async () =>
    api.post(`/admin/skills/${skill.id}/reject`, reason.trim() ? { reason: reason.trim() } : {}),
  );
  const listings = skill.teachCount + skill.learnCount;

  return (
    <Modal
      title={`Remove "${skill.name}"`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={remove.pending}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={remove.pending}
            onClick={async () => {
              if ((await remove.run()) !== null) onDone();
            }}
          >
            {remove.pending ? 'Removing…' : 'Remove skill'}
          </button>
        </>
      }
    >
      <ErrorAlert message={remove.error} />

      <p className="muted mt-0">
        <strong>{skill.name}</strong> comes off {listings === 1 ? '1 student list' : `${listings} student lists`}, and
        each student gets a notice. Nobody can add this name again unless you restore it.
      </p>

      <div className="field">
        <label htmlFor="remove-reason">Reason shown to the students (optional)</label>
        <textarea
          id="remove-reason"
          rows={2}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="It isn't a skill that can be taught."
        />
      </div>
    </Modal>
  );
}

function CreateSkillModal({
  categories,
  onClose,
  onDone,
}: {
  categories: SkillCategory[];
  onClose(): void;
  onDone(): void;
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [description, setDescription] = useState('');

  const create = useMutation(async () =>
    api.post('/admin/skills', {
      name: name.trim(),
      categoryId,
      ...(description.trim() ? { description: description.trim() } : {}),
    }),
  );

  return (
    <Modal
      title="Add a skill"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={create.pending}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={create.pending || !name.trim() || !categoryId}
            onClick={async () => {
              if ((await create.run()) !== null) onDone();
            }}
          >
            {create.pending ? 'Adding…' : 'Add skill'}
          </button>
        </>
      }
    >
      <ErrorAlert message={create.error} />

      <div className="field">
        <label htmlFor="skill-name">Name</label>
        <input
          id="skill-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rust"
        />
      </div>

      <div className="field">
        <label htmlFor="skill-category">Category</label>
        <select
          id="skill-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="skill-desc">Description (optional)</label>
        <textarea
          id="skill-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function MergeSkillModal({
  source,
  onClose,
  onDone,
}: {
  source: AdminSkill;
  onClose(): void;
  onDone(): void;
}) {
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState('');

  const path = search.trim().length >= 2 ? `/skills?q=${encodeURIComponent(search.trim())}&limit=20` : null;
  const { data: results } = useQuery<Paginated<AdminSkill>>(path, [search]);

  const merge = useMutation(async () =>
    api.post('/admin/skills/merge', { sourceId: source.id, targetId }),
  );

  const candidates = (results?.items ?? []).filter((s) => s.id !== source.id);

  return (
    <Modal
      title={`Merge "${source.name}" into another skill`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={merge.pending}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={merge.pending || !targetId}
            onClick={async () => {
              if ((await merge.run()) !== null) onDone();
            }}
          >
            {merge.pending ? 'Merging…' : 'Merge'}
          </button>
        </>
      }
    >
      <ErrorAlert message={merge.error} />

      <p className="muted mt-0">
        Every student listing <strong>{source.name}</strong> is moved onto the skill you pick, and{' '}
        <strong>{source.name}</strong> is deleted. This cannot be undone.
      </p>

      <div className="field">
        <label htmlFor="merge-search">Search for the skill to keep</label>
        <input
          id="merge-search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setTargetId('');
          }}
          placeholder="Start typing a skill name"
        />
      </div>

      {candidates.length > 0 ? (
        <div className="field">
          <label htmlFor="merge-target">Keep this skill</label>
          <select id="merge-target" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Select a skill…</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.teachCount} teaching)
              </option>
            ))}
          </select>
        </div>
      ) : search.trim().length >= 2 ? (
        <p className="muted">No other skills match that search.</p>
      ) : null}
    </Modal>
  );
}
