export interface MapFocusCoordinate {
  latitude?: number;
  longitude?: number;
}

export interface ResolvedMapFocus {
  latitude: number;
  longitude: number;
}

/**
 * 返回第一个有效的高优先级地图焦点。
 *
 * 调用方按业务优先级传入：待上传照片、已上传照片确认、地点编辑。
 */
export function resolveMapFocus(
  ...candidates: Array<MapFocusCoordinate | null | undefined>
): ResolvedMapFocus | undefined {
  for (const candidate of candidates) {
    if (
      Number.isFinite(candidate?.latitude)
      && Number.isFinite(candidate?.longitude)
      && Math.abs(candidate?.latitude as number) <= 90
      && Math.abs(candidate?.longitude as number) <= 180
    ) {
      return {
        latitude: candidate?.latitude as number,
        longitude: candidate?.longitude as number,
      };
    }
  }
  return undefined;
}

export function shouldFitAllPlacesInitially(
  markerCount: number,
  priorityFocus?: ResolvedMapFocus,
): boolean {
  return markerCount > 0 && !priorityFocus;
}
