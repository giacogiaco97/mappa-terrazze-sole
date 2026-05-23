export type Terrace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tables: number;
  chairs: number;
  surfaceSqM: number;
  neighborhood: string;
};

export type Building = {
  id: string;
  height: number; // metri, sempre risolta
  footprint: [number, number][]; // anello chiuso, [lng, lat][]
  heightSource: 'osm' | 'levels' | 'default';
};

export type Meta = {
  city: string;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  generatedAt: string; // ISO 8601
  gridStep: number; // gradi per cella
  buildingCount: number;
  terraceCount: number;
};
