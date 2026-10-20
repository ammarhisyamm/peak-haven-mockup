import { LAYOUTS, type LayoutId } from '../../constants/layouts';
import { LayoutThumb } from '../ui/Thumbnails';
import { PanelTitle } from '../ui/controls';

export default function LayoutPanel({ layoutId, onSelect }: { layoutId: LayoutId; onSelect: (id: LayoutId) => void }) {
  return (
    <div>
      <PanelTitle>Arrangement</PanelTitle>
      <p className="-mt-2 mb-3 text-sm text-slate-500">Show several copies of your packaging in one scene.</p>
      <div className="grid grid-cols-2 gap-2.5">
        {LAYOUTS.map((layout) => {
          const active = layout.id === layoutId;
          return (
            <button
              key={layout.id}
              type="button"
              onClick={() => onSelect(layout.id)}
              className={`rounded-xl border p-2 text-left transition ${
                active ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="aspect-[4/3] rounded-lg bg-gradient-to-b from-slate-50 to-slate-200 p-2">
                <LayoutThumb layout={layout} />
              </div>
              <p className="mt-1.5 text-xs font-medium text-slate-800">{layout.name}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
