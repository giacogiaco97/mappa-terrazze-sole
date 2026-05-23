export function googleMapsUrl(input: { name: string; address: string }): string {
  const parts = [input.name, input.address, 'Barcelona'].filter(Boolean);
  const q = encodeURIComponent(parts.join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
