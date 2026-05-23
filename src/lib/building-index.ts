import RBush from 'rbush';
import type { Building } from '../types/index.js';
import { bboxOfPolygon } from './geometry.js';

type IndexedBuilding = { minX: number; minY: number; maxX: number; maxY: number; building: Building };

class BuildingTree extends RBush<IndexedBuilding> {}

export type BuildingIndex = {
  search: (minLng: number, minLat: number, maxLng: number, maxLat: number) => Building[];
};

export function buildBuildingIndex(buildings: Building[]): BuildingIndex {
  const tree = new BuildingTree();
  const items: IndexedBuilding[] = buildings.map((b) => {
    const [minX, minY, maxX, maxY] = bboxOfPolygon(b.footprint);
    return { minX, minY, maxX, maxY, building: b };
  });
  tree.load(items);
  return {
    search(minLng, minLat, maxLng, maxLat) {
      return tree
        .search({ minX: minLng, minY: minLat, maxX: maxLng, maxY: maxLat })
        .map((it) => it.building);
    },
  };
}
