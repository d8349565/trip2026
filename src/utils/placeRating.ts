import type { Place, Visit } from '../types';

type VisitRating = Pick<Visit, 'place_id' | 'rating'>;

export function formatPlaceRating(rating: number | null | undefined): string {
  return typeof rating === 'number' && Number.isFinite(rating)
    ? rating.toFixed(1)
    : '未评分';
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

export function mergeVisitRatings(places: Place[], visits: VisitRating[]): Place[] {
  const ratingsByPlace = new Map<string, number[]>();

  for (const visit of visits) {
    if (!Number.isFinite(visit.rating) || visit.rating < 0 || visit.rating > 5) continue;
    const ratings = ratingsByPlace.get(visit.place_id) ?? [];
    ratings.push(visit.rating);
    ratingsByPlace.set(visit.place_id, ratings);
  }

  return places.map((place) => {
    const rating = average(ratingsByPlace.get(place.id) ?? []);
    return rating === undefined ? place : { ...place, rating };
  });
}
