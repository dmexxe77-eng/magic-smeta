import { useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { ALL_NOMS, DEFAULT_FOLDERS } from '../data/nomenclature';
import type { NomItem, NomFolder } from '../types';

const FALLBACK_FOLDER: NomFolder = { id: '_other', name: 'Прочее', icon: '📦', isDefault: true };

function getFolderId(nom: { brand?: string }): string {
  return nom.brand || FALLBACK_FOLDER.id;
}

export function useNomenclature() {
  const { state } = useApp();

  const mergedNoms = useMemo((): NomItem[] => {
    const editMap = new Map<string, Partial<NomItem>>();
    for (const e of state.editedNoms) {
      if (e.id) editMap.set(e.id, e);
    }
    const deletedSet = new Set(state.deletedNomIds);

    const base = (ALL_NOMS as NomItem[])
      .filter(n => !deletedSet.has(n.id))
      .map(n => {
        const edit = editMap.get(n.id);
        return edit ? { ...n, ...edit } as NomItem : n;
      });

    return [...base, ...state.noms];
  }, [state.editedNoms, state.deletedNomIds, state.noms]);

  const allFolders = useMemo((): NomFolder[] => {
    const defaults: NomFolder[] = DEFAULT_FOLDERS.map(f => ({
      id: f.id, name: f.name, icon: f.icon, isDefault: true,
    }));
    const hasOrphan = mergedNoms.some(n => !n.brand);
    const all: NomFolder[] = hasOrphan ? [...defaults, FALLBACK_FOLDER] : [...defaults];
    return [...all, ...state.nomFolders];
  }, [state.nomFolders, mergedNoms]);

  const getItemsForFolder = (folderId: string): NomItem[] => {
    return mergedNoms.filter(n => getFolderId(n) === folderId);
  };

  const searchNoms = (query: string): NomItem[] => {
    if (!query.trim()) return mergedNoms;
    const q = query.toLowerCase();
    return mergedNoms.filter(n =>
      n.name.toLowerCase().includes(q) ||
      (n.section || '').toLowerCase().includes(q) ||
      (n.category || '').toLowerCase().includes(q)
    );
  };

  return { mergedNoms, allFolders, getItemsForFolder, searchNoms, getFolderId };
}

export { getFolderId };
