export type Terrace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tables: number;
  neighborhood: string;
  /** Numero di sedie totali. 0 se assente nel dataset sorgente. */
  chairs?: number;
  /** Superficie occupata in m². 0 se assente nel dataset sorgente. */
  surfaceSqM?: number;
  /** Google Maps place_id. Se presente, il link "Google Maps" apre la scheda esatta. */
  placeId?: string;
  /**
   * Provenienza del nome commerciale:
   * - `osm`: matched da OpenStreetMap (alta confidenza, locale verificato dalla community)
   * - `google`: matched da Google Places Nearby (primo locale entro 30m, possibile mismatch se più locali vicini)
   * - undefined: nessun match, `name` coincide con `address` (dataset BCN)
   */
  nameSource?: 'osm' | 'google';
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
