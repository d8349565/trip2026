export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function calculateDistanceKm(from: Coordinates, to: Coordinates): number | undefined {
  if (
    !Number.isFinite(from.latitude) || !Number.isFinite(from.longitude)
    || !Number.isFinite(to.latitude) || !Number.isFinite(to.longitude)
  ) return undefined;

  const earthRadiusKm = 6371;
  const latitudeDelta = (to.latitude - from.latitude) * Math.PI / 180;
  const longitudeDelta = (to.longitude - from.longitude) * Math.PI / 180;
  const fromLatitude = from.latitude * Math.PI / 180;
  const toLatitude = to.latitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const distance = earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Math.round(distance * 10) / 10;
}
