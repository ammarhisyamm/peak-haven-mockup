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
import { Badge } from '../reui/badge';
import { Button } from '../ui/button';
import { Segmented, SizeEditor } from '../ui/controls';
import { Input } from '../ui/input';

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
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models, e.g. mailer, vial 10ml"
              aria-label="Search models"
              className="h-9 pl-8"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['all', ...LIBRARY_GROUPS] as Filter[]).map((f) => (
              <Button
                key={f}
                size="xs"
                variant={filter === f ? 'default' : 'outline'}
                aria-pressed={filter === f}
                onClick={() => {
                  setFilter(f);
                  setType(null);
                }}
                className={`rounded-full px-3 ${filter === f ? 'bg-brand-violet text-brand-pure hover:bg-brand-violet/85' : 'text-muted-foreground'}`}
              >
                {f === 'all' ? 'All' : f}
              </Button>
            ))}
          </div>
          {types.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1">
              {types.map((t) => (
                <Button
                  key={t}
                  size="xs"
                  variant="ghost"
                  aria-pressed={type === t}
                  onClick={() => setType((cur) => (cur === t ? null : t))}
                  className={type === t ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary' : 'font-normal text-muted-foreground'}
                >
                  {t}
                </Button>
              ))}
            </div>
          )}
          <Badge variant="outline" size="sm" radius="full" className="mt-3 text-muted-foreground">
            {results.length} models
          </Badge>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            {results.map((p) => {
              const active = p.id === preset.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={`group rounded-xl border p-2 text-left transition ${
                    active ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card hover:border-input'
                  }`}
                >
                  <div className="aspect-square rounded-lg bg-linear-to-b from-slate-100 to-[var(--thumb-end)] p-2">
                    <ModelThumb preset={p} />
                  </div>
                  <p className="mt-1.5 truncate text-xs font-medium text-foreground">{p.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{formatDimensions(p, unit)}</p>
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
          <p className="mb-3 text-sm text-muted-foreground">
            Set an exact size for <span className="font-medium text-foreground">{basePreset.name}</span>. The
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
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Project name"
          aria-label="Project name"
          className="h-9 min-w-0 flex-1"
        />
        <Button onClick={save} disabled={busy} className="h-9 font-semibold">
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
          Save
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">Projects are saved in this browser, artwork included.</p>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      <ul className="mt-3 space-y-2">
        {projects === null && <li className="py-4 text-center text-sm text-slate-500">Loading…</li>}
        {projects?.length === 0 && <li className="py-4 text-center text-sm text-slate-500">No saved projects yet.</li>}
        {projects?.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2">
            <img src={p.thumbnail} alt="" className="h-14 w-14 rounded-lg bg-muted object-contain" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.doc.presetId} · {new Date(p.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => onOpen(p)} aria-label={`Open ${p.name}`} title="Open">
              <FolderOpen />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={async () => {
                await deleteProject(p.id);
                refresh();
              }}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Delete ${p.name}`}
              title="Delete"
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
