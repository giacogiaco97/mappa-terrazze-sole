import { create } from 'zustand';
import type { Terrace } from '../types/index.js';
import type { BuildingIndex } from '../lib/building-index.js';

export type TerraceStatus = 'sun' | 'shade' | 'closed' | 'pending';

type State = {
  now: Date;
  setNow: (d: Date) => void;
  userPos: { lat: number; lng: number } | null;
  setUserPos: (p: { lat: number; lng: number } | null) => void;
  terraces: Terrace[];
  setTerraces: (t: Terrace[]) => void;
  states: Record<string, TerraceStatus>; // id → status
  setStates: (s: Record<string, TerraceStatus>) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  buildingIndex: BuildingIndex | null;
  setBuildingIndex: (i: BuildingIndex | null) => void;
  // Filtri lista
  search: string;
  setSearch: (s: string) => void;
  minTables: number;
  setMinTables: (n: number) => void;
  showShade: boolean;
  setShowShade: (v: boolean) => void;
  theme: 'light' | 'dark' | null;
  setTheme: (t: 'light' | 'dark' | null) => void;
};

export const useStore = create<State>((set) => ({
  now: new Date(),
  setNow: (now) => set({ now }),
  userPos: null,
  setUserPos: (userPos) => set({ userPos }),
  terraces: [],
  setTerraces: (terraces) => set({ terraces }),
  states: {},
  setStates: (states) => set({ states }),
  selectedId: null,
  setSelectedId: (selectedId) => set({ selectedId }),
  buildingIndex: null,
  setBuildingIndex: (buildingIndex) => set({ buildingIndex }),
  search: '',
  setSearch: (search) => set({ search }),
  minTables: 0,
  setMinTables: (minTables) => set({ minTables }),
  showShade: false,
  setShowShade: (showShade) => set({ showShade }),
  theme: (typeof localStorage !== 'undefined' && (localStorage.getItem('theme') as 'light' | 'dark' | null)) || null,
  setTheme: (theme) => {
    if (typeof localStorage !== 'undefined') {
      if (theme) localStorage.setItem('theme', theme);
      else localStorage.removeItem('theme');
    }
    if (typeof document !== 'undefined') {
      if (theme) document.documentElement.setAttribute('data-theme', theme);
      else document.documentElement.removeAttribute('data-theme');
    }
    set({ theme });
  },
}));
