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
import type { AdminSkill, SkillCategory } from '../lib/types';

function categoryName(skill: AdminSkill): string {
  return skill.category?.name ?? '—';
}

export function SkillsPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [mergeSource, setMergeSource] = useState<AdminSkill | null>(null);

  const { data: categories } = useQuery<SkillCategory[]>('/skills/categories');

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    return `/skills?${params.toString()}`;
  }, [page, query, category]);

  const { data, error, loading, reload } = useQuery<Paginated<AdminSkill>>(path);

  const approve = useMutation(async (id: string) => api.post(`/admin/skills/${id}/approve`));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Skill catalogue</h1>
          <p>Approve student-proposed skills and merge duplicates.</p>
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
          <TableSkeleton rows={6} columns={5} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No skills found" hint="Try a different search or category." />
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
                    <th>Added</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((skill) => (
                    <tr key={skill.id}>
                      <td>
                        <div>{skill.name}</div>
                        <div className="cell-sub mono">{skill.slug}</div>
                      </td>
                      <td>{categoryName(skill)}</td>
                      <td>{skill.teachCount}</td>
                      <td>{skill.learnCount}</td>
                      <td>
                        {skill.approved ? (
                          <Badge tone="success">approved</Badge>
                        ) : (
                          <Badge tone="warning">pending</Badge>
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
                              Approve
                            </button>
                          ) : null}
                          <button className="btn btn-sm" onClick={() => setMergeSource(skill)}>
                            Merge
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
    </>
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
