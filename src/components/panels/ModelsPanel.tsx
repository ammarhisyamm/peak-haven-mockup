import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Loader2, Save, Search, Trash2 } from 'lucide-react';
import {
  LIBRARY_GROUPS,
  PRESETS,
  type LibraryGroup,
  formatDimensions,
  type PackagingPreset,
  type SizeOverride,
  type Unit,
} from '../../constants/presets';
import { deleteProject, listProjects, type StoredProject } from '../../lib/projects';
import { ModelThumb } from '../ui/Thumbnails';
import { Segmented, SizeEditor } from '../ui/controls';

type Tab = 'library' | 'projects' | 'custom';
type Filter = 'all' | LibraryGroup;

/** Sub-types of each group, in catalogue order. */
const TYPES_BY_GROUP = PRESETS.reduce(
  (acc, p) => {
    const list = (acc[p.group] ??= []);
    if (!list.includes(p.type)) list.push(p.type);
    return acc;
  },
  {} as Partial<Record<LibraryGroup, string[]>>,
);

export default function ModelsPanel({
  preset,
  basePreset,
  unit,
  onUnitChange,
  onSelect,
  onSize,
  onSaveProject,
  onOpenProject,
}: {
  preset: PackagingPreset;
  basePreset: PackagingPreset;
  unit: Unit;
  onUnitChange: (u: Unit) => void;
  onSelect: (id: string) => void;
  onSize: (s: SizeOverride | null) => void;
  onSaveProject: (name: string) => Promise<void>;
  onOpenProject: (p: StoredProject) => void;
}) {
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [type, setType] = useState<string | null>(null);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return PRESETS.filter((p) => filter === 'all' || p.group === filter)
      .filter((p) => !type || p.type === type)
      .filter((p) => {
        const haystack = `${p.id} ${p.name} ${p.description} ${p.kind} ${p.group} ${p.type}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
      });
  }, [query, filter, type]);
  const types = filter === 'all' ? [] : (TYPES_BY_GROUP[filter] ?? []);

  return (
    <div>
      <Segmented
        value={tab}
        options={[
          { value: 'library', label: 'Library' },
          { value: 'projects', label: 'Projects' },
          { value: 'custom', label: 'Custom' },
        ]}
        onChange={setTab}
      />

      {tab === 'library' && (
        <>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models, e.g. mailer, vial 10ml"
              className="w-full bg-transparent text-sm focus:outline-none"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['all', ...LIBRARY_GROUPS] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  setType(null);
                }}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
                  filter === f
                    ? 'border-brand-violet bg-brand-violet text-slate-950'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
          {types.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1">
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType((cur) => (cur === t ? null : t))}
                  className={`rounded-md px-2 py-1 text-xs transition ${
                    type === t ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-slate-500">{results.length} models</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            {results.map((p) => {
              const active = p.id === preset.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={`group rounded-xl border p-2 text-left transition ${
                    active ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="aspect-square rounded-lg bg-gradient-to-b from-slate-100 to-brand-deep p-2">
                    <ModelThumb preset={p} />
                  </div>
                  <p className="mt-1.5 truncate text-xs font-medium text-slate-800">{p.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{formatDimensions(p, unit)}</p>
                </button>
              );
            })}
            {!results.length && <p className="col-span-2 py-6 text-center text-sm text-slate-500">No models match.</p>}
          </div>
        </>
      )}

      {tab === 'projects' && <ProjectsTab onSave={onSaveProject} onOpen={onOpenProject} />}

      {tab === 'custom' && (
        <div className="mt-4">
          <p className="mb-3 text-sm text-slate-600">
            Set an exact size for <span className="font-medium text-slate-900">{basePreset.name}</span>. The
            dieline template follows the new size.
          </p>
          <SizeEditor preset={preset} basePreset={basePreset} unit={unit} onUnitChange={onUnitChange} onApply={onSize} />
        </div>
      )}
    </div>
  );
}

function ProjectsTab({ onSave, onOpen }: { onSave: (name: string) => Promise<void>; onOpen: (p: StoredProject) => void }) {
  const [projects, setProjects] = useState<StoredProject[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    listProjects()
      .then(setProjects)
      .catch(() => {
        setProjects([]);
        setError('Saved projects are unavailable in this browser.');
      });
  useEffect(() => {
    refresh();
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(name.trim() || `Mockup ${new Date().toLocaleString()}`);
      setName('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the project.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Project name"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">Projects are saved in this browser, artwork included.</p>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      <ul className="mt-3 space-y-2">
        {projects === null && <li className="py-4 text-center text-sm text-slate-500">Loading…</li>}
        {projects?.length === 0 && <li className="py-4 text-center text-sm text-slate-500">No saved projects yet.</li>}
        {projects?.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
            <img src={p.thumbnail} alt="" className="h-14 w-14 rounded-lg bg-slate-100 object-contain" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
              <p className="text-xs text-slate-500">
                {p.doc.presetId} · {new Date(p.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpen(p)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label={`Open ${p.name}`}
              title="Open"
            >
              <FolderOpen className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                await deleteProject(p.id);
                refresh();
              }}
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              aria-label={`Delete ${p.name}`}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
