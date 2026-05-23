import { create } from 'zustand';
import type { Terrace } from '../types/index.js';

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
}));
