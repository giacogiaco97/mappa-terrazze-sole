export function googleMapsUrl(input: { name: string; address: string }): string {
  const parts = [input.name, input.address, 'Barcelona'].filter(Boolean);
  const q = encodeURIComponent(parts.join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Apre Google Street View centrato sul punto, senza richiedere API key. */
export function streetViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}
