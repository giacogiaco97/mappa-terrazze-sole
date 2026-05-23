const M_PER_DEG_LAT = 111_320;

export type LocalProjection = {
  project: (lat: number, lng: number) => [number, number]; // [x_east_m, y_north_m]
  unproject: (x: number, y: number) => [number, number];   // [lat, lng]
};

export function makeLocalProjection(originLat: number, originLng: number): LocalProjection {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  return {
    project(lat, lng) {
      return [(lng - originLng) * mPerDegLng, (lat - originLat) * M_PER_DEG_LAT];
    },
    unproject(x, y) {
      return [originLat + y / M_PER_DEG_LAT, originLng + x / mPerDegLng];
    },
  };
}
