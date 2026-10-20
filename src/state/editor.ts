import { useCallback, useEffect, useReducer } from 'react';
import {
  DEFAULT_BASE_COLOR,
  DEFAULT_PRESET_ID,
  EMPTY_ARTWORK,
  type ArtworkMap,
  type FinishId,
  type SizeOverride,
} from '../constants/presets';
import type { LayoutId } from '../constants/layouts';

/** Everything that defines a mockup design. Changes to it are undoable. */
export interface EditorDoc {
  presetId: string;
  size: SizeOverride | null;
  artwork: ArtworkMap;
  finish: FinishId;
  baseColor: string;
  layoutId: LayoutId;
  /** Lid opening, 0 = closed, 1 = fully open. */
  open: number;
}

export const INITIAL_DOC: EditorDoc = {
  presetId: DEFAULT_PRESET_ID,
  size: null,
  artwork: EMPTY_ARTWORK,
  finish: 'matte',
  baseColor: DEFAULT_BASE_COLOR,
  layoutId: 'single',
  open: 0,
};

interface HistoryState {
  past: EditorDoc[];
  present: EditorDoc;
  future: EditorDoc[];
  lastKey: string | null;
  lastAt: number;
}

type Action =
  | { type: 'set'; patch: Partial<EditorDoc>; coalesce?: string }
  | { type: 'replace'; doc: EditorDoc }
  | { type: 'undo' }
  | { type: 'redo' };

const HISTORY_LIMIT = 100;
/** Continuous edits (sliders, color drags) with the same key merge into one undo step. */
const COALESCE_MS = 800;

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'set': {
      const now = Date.now();
      const next = { ...state.present, ...action.patch };
      if (action.coalesce && action.coalesce === state.lastKey && now - state.lastAt < COALESCE_MS) {
        return { ...state, present: next, future: [], lastAt: now };
      }
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
        lastKey: action.coalesce ?? null,
        lastAt: now,
      };
    }
    case 'replace':
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: action.doc,
        future: [],
        lastKey: null,
        lastAt: 0,
      };
    case 'undo': {
      if (!state.past.length) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
        lastKey: null,
        lastAt: 0,
      };
    }
    case 'redo': {
      if (!state.future.length) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
        lastKey: null,
        lastAt: 0,
      };
    }
  }
}

export function useEditor() {
  const [state, dispatch] = useReducer(reducer, {
    past: [],
    present: INITIAL_DOC,
    future: [],
    lastKey: null,
    lastAt: 0,
  });

  const update = useCallback(
    (patch: Partial<EditorDoc>, coalesce?: string) => dispatch({ type: 'set', patch, coalesce }),
    [],
  );
  const replace = useCallback((doc: EditorDoc) => dispatch({ type: 'replace', doc }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);

  // Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl+Y, except while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return {
    doc: state.present,
    update,
    replace,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
