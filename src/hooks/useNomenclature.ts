import { useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { ALL_NOMS } from '../data/nomenclature';
import type { NomItem, NomFolder } from '../types';

// Default folders auto-generated from nomenclature sections
const DEFAULT_FOLDERS: NomFolder[] = [
  { id: '_polotna', name: 'Polotna', icon: '🎨', isDefault: true },
  { id: '_raboty', name: 'Raboty', icon: '🔧', isDefault: true },
  { id: '_opcii', name: 'Opcii', icon: '📐', isDefault: true },
  { id: '_svet', name: 'Svetilniki', icon: '💡', isDefault: true },
  { id: '_kraab', name: 'KRAAB', icon: '🔩', isDefault: true },
  { id: '_clamp', name: 'Clamp', icon: '🔩', isDefault: true },
  { id: '_lumfer', name: 'LumFer', icon: '🔩', isDefault: true },
  { id: '_other', name: 'Prochee', icon: '📦', isDefault: true },
];

// Map hardcoded items to folder IDs
function getFolderId(nom: { category?: string; section?: string; type?: string }): string {
  if (nom.section === 'KRAAB') return '_kraab';
  if (nom.section === 'Clamp') return '_clamp';
  if (nom.section === 'LumFer') return '_lumfer';
  if (nom.category === 'Полотна') return '_polotna';
  if (nom.category === 'Работы') return '_raboty';
  if (nom.category === 'Опции') return '_opcii';
  if (nom.category === 'Светильники') return '_svet';
  if (nom.type === 'work') return '_raboty';
  return '_other';
}

// Proper Russian folder names
const FOLDER_NAMES: Record<string, string> = {
  '_polotna': 'Полотна',
  '_raboty': 'Работы',
  '_opcii': 'Опции',
  '_svet': 'Светильники',
  '_kraab': 'KRAAB',
  '_clamp': 'Clamp',
  '_lumfer': 'LumFer',
  '_other': 'Прочее',
};

export function useNomenclature() {
  const { state } = useApp();

  // Merged items: base + edits + custom
  const mergedNoms = useMemo((): NomItem[] => {
    const editMap = new Map<string, Partial<NomItem>>();
    for (const e of state.editedNoms) {
      if (e.id) editMap.set(e.id, e);
    }
    const deletedSet = new Set(state.deletedNomIds);

    // Start with hardcoded, apply edits, remove deleted
    const base = (ALL_NOMS as NomItem[])
      .filter(n => !deletedSet.has(n.id))
      .map(n => {
        const edit = editMap.get(n.id);
        return edit ? { ...n, ...edit } as NomItem : n;
      });

    // Append custom
    return [...base, ...state.noms];
  }, [state.editedNoms, state.deletedNomIds, state.noms]);

  // All folders: defaults + custom
  const allFolders = useMemo((): NomFolder[] => {
    const defaults = DEFAULT_FOLDERS.map(f => ({
      ...f,
      name: FOLDER_NAMES[f.id] || f.name,
    }));
    return [...defaults, ...state.nomFolders];
  }, [state.nomFolders]);

  // Items for a specific folder
  const getItemsForFolder = (folderId: string): NomItem[] => {
    return mergedNoms.filter(n => {
      // Custom items have brand = folderId
      if (n.brand) return n.brand === folderId;
      // Hardcoded items mapped by category/section
      return getFolderId(n) === folderId;
    });
  };

  // Search across all items
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
