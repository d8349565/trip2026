/**
 * Coordinate system transforms.
 *
 * Photo EXIF GPS is WGS84; AMap renders GCJ-02. Storing or displaying raw
 * WGS84 on the AMap map would offset markers by hundreds of meters in China.
 */

const PI = Math.PI;
const SEMI_MAJOR_AXIS = 6378245.0;
const ECC_SQ = 0.00669342162296594323;

function outOfChina(latitude: number, longitude: number): boolean {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271;
}

function transformLat(x: number, y: number): number {
  let result = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  result += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  result += ((20 * Math.sin(y * PI) + 40 * Math.sin((y / 3) * PI)) * 2) / 3;
  result += ((160 * Math.sin((y / 12) * PI) + 320 * Math.sin((y * PI) / 30)) * 2) / 3;
  return result;
}

function transformLng(x: number, y: number): number {
  let result = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  result += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  result += ((20 * Math.sin(x * PI) + 40 * Math.sin((x / 3) * PI)) * 2) / 3;
  result += ((150 * Math.sin((x / 12) * PI) + 300 * Math.sin((x / 30) * PI)) * 2) / 3;
  return result;
}

export function wgs84ToGcj02(latitude: number, longitude: number): { latitude: number; longitude: number } {
  if (outOfChina(latitude, longitude)) return { latitude, longitude };
  let dLat = transformLat(longitude - 105, latitude - 35);
  let dLng = transformLng(longitude - 105, latitude - 35);
  const radLat = (latitude / 180) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - ECC_SQ * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / (((SEMI_MAJOR_AXIS * (1 - ECC_SQ)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180) / ((SEMI_MAJOR_AXIS / sqrtMagic) * Math.cos(radLat) * PI);
  return { latitude: latitude + dLat, longitude: longitude + dLng };
}
