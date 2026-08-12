/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Place,
  Trip,
  Guide,
  Checklist,
  Media,
  User,
  InviteCode,
  type MediaUploadInput,
  type MapMarkerSummary,
  type PhotoMetadataProbeResult,
} from './types';

const API_BASE = '';

export interface AmapPoi {
  id: string;
  name: string;
  location: string;
  type?: string;
  address?: string | string[];
  pname?: string;
  cityname?: string;
  adname?: string;
}

export interface MapSharePoint {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  provider: 'amap' | 'baidu';
  sourceUrl: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = 'REQUEST_FAILED',
    readonly details?: unknown,
  ) {
    super(message);
  }
}

async function responseError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => undefined) as {
    error?: string | { code?: string; message?: string; details?: unknown };
  } | undefined;
  const error = body?.error;
  if (error && typeof error === 'object') {
    return new ApiError(error.message || 'Request failed', response.status, error.code, error.details);
  }
  return new ApiError(typeof error === 'string' ? error : 'Request failed', response.status);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, init);
  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function requestOk(url: string, init?: RequestInit): Promise<boolean> {
  const response = await fetch(`${API_BASE}${url}`, init);
  if (!response.ok) throw await responseError(response);
  return true;
}

export const api = {
  // Auth
  getCurrentUser: async (userId?: string): Promise<{ user: User }> => {
    return request('/api/me', {
      headers: userId ? { 'x-user-id': userId } : {}
    });
  },

  login: async (username: string, password: string): Promise<{ user: User }> => {
    return request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  },

  registerByInvite: async (username: string, password: string, inviteCode: string): Promise<{ user: User }> => {
    return request('/api/auth/register-by-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, inviteCode })
    });
  },

  // Formal cookie-session auth. The legacy methods above remain temporarily
  // for source compatibility and will be removed when api.ts is modularized.
  getSessionUser: async (): Promise<{ user: User }> => request('/api/me'),

  sessionLogin: async (username: string, password: string): Promise<{ user: User; password_upgraded?: boolean }> => {
    return request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  },

  sessionRegister: async (username: string, password: string, inviteCode: string): Promise<{ user: User }> => {
    return request('/api/auth/register-by-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, inviteCode }),
    });
  },

  logout: async (): Promise<void> => request('/api/auth/logout', { method: 'POST' }),

  // Map services. Web Service keys remain on the server.
  searchMapPoi: async (keywords: string, region?: string): Promise<AmapPoi[]> => {
    const params = new URLSearchParams({ keywords });
    if (region?.trim()) params.set('region', region.trim());
    const result = await request<{ pois?: AmapPoi[] }>(`/api/map/poi?${params}`);
    return result.pois ?? [];
  },

  reverseGeocode: async (latitude: number, longitude: number): Promise<{ address: string; name?: string; province?: string; city?: string; district?: string }> => {
    const result = await request<{ regeocode?: { formatted_address?: string; addressComponent?: { province?: string; city?: string | string[]; district?: string }; pois?: Array<{ name?: string }>; aois?: Array<{ name?: string }> } }>(
      `/api/map/regeocode?location=${encodeURIComponent(`${longitude},${latitude}`)}`,
    );
    const component = result.regeocode?.addressComponent;
    const nearestName = result.regeocode?.pois?.[0]?.name ?? result.regeocode?.aois?.[0]?.name;
    return {
      address: result.regeocode?.formatted_address ?? '',
      name: nearestName || undefined,
      province: component?.province,
      city: Array.isArray(component?.city) ? component.city[0] : component?.city,
      district: component?.district,
    };
  },

  locateByIp: async (): Promise<{ latitude: number; longitude: number } | null> => {
    const result = await request<{ rectangle?: string }>(`/api/map/ip`);
    // rectangle: "lng1,lat1;lng2,lat2" bounding box of the located city
    if (typeof result.rectangle !== 'string' || !result.rectangle.includes(';')) return null;
    const [cornerA, cornerB] = result.rectangle.split(';').map((pair) => pair.split(',').map(Number));
    if (!cornerA || !cornerB || cornerA.length !== 2 || cornerB.length !== 2
      || ![...cornerA, ...cornerB].every(Number.isFinite)) return null;
    return {
      latitude: (cornerA[1] + cornerB[1]) / 2,
      longitude: (cornerA[0] + cornerB[0]) / 2,
    };
  },

  resolveMapShare: async (url: string): Promise<MapSharePoint> => request('/api/map/share/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }),

  getMapMarkers: async (bounds?: {
    west: number;
    south: number;
    east: number;
    north: number;
  }): Promise<{ markers: MapMarkerSummary[]; total: number; truncated: boolean }> => {
    const params = new URLSearchParams();
    if (bounds) {
      for (const [key, value] of Object.entries(bounds)) params.set(key, String(value));
    }
    return request(`/api/map/markers${params.size ? `?${params}` : ''}`);
  },

  // Places
  getPlaces: async (filters: { category?: string; status?: string; search?: string; favorite?: boolean } = {}): Promise<Place[]> => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.favorite) params.append('favorite', 'true');
    
    return request(`/api/places?${params.toString()}`);
  },

  createPlace: async (place: Partial<Place>, userId?: string): Promise<Place> => {
    return request('/api/places', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(place)
    });
  },

  updatePlace: async (id: string, place: Partial<Place>): Promise<Place> => {
    return request(`/api/places/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(place)
    });
  },

  deletePlace: async (id: string): Promise<boolean> => requestOk(`/api/places/${id}`, { method: 'DELETE' }),

  toggleFavorite: async (id: string): Promise<Place> => request(`/api/places/${id}/favorite`, { method: 'POST' }),

  toggleVisited: async (id: string): Promise<Place> => request(`/api/places/${id}/mark-visited`, { method: 'POST' }),

  addToTrip: async (placeId: string, data: { trip_day_id: string; type?: string; start_time?: string; note?: string }): Promise<any> => {
    return request(`/api/places/${placeId}/add-to-trip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  // Trips
  getTrips: async (): Promise<Trip[]> => request('/api/trips'),

  createTrip: async (trip: Partial<Trip>, userId?: string): Promise<Trip> => {
    return request('/api/trips', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(trip)
    });
  },

  getTripDetails: async (id: string): Promise<Trip & { days: any[]; items: any[] }> => request(`/api/trips/${id}`),

  getTripDetailsBatch: async (ids: string[]): Promise<Array<Trip & { days: any[]; items: any[] }>> => {
    if (ids.length === 0) return [];
    const result = await request<{ details: Array<Trip & { days: any[]; items: any[] }> }>('/api/trips/details-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return result.details;
  },

  updateTrip: async (id: string, data: Partial<Trip>): Promise<Trip> => {
    return request(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteTrip: async (id: string): Promise<boolean> => requestOk(`/api/trips/${id}`, { method: 'DELETE' }),

  updateTripDay: async (dayId: string, data: any): Promise<any> => {
    return request(`/api/trip-days/${dayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  createTripItem: async (dayId: string, data: any): Promise<any> => {
    return request(`/api/trip-days/${dayId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  updateTripItem: async (itemId: string, data: any): Promise<any> => {
    return request(`/api/trip-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteTripItem: async (itemId: string): Promise<boolean> => requestOk(`/api/trip-items/${itemId}`, { method: 'DELETE' }),

  reorderTripItems: async (items: { id: string; sort_order: number; trip_day_id?: string }[]): Promise<boolean> => requestOk('/api/trip-items/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    }),

  // Media
  getMedia: async (params: { place_id?: string; trip_id?: string } = {}): Promise<Media[]> => {
    const q = new URLSearchParams();
    if (params.place_id) q.append('place_id', params.place_id);
    if (params.trip_id) q.append('trip_id', params.trip_id);
    return request(`/api/media?${q.toString()}`);
  },

  probePhotoMetadata: async (file: File): Promise<PhotoMetadataProbeResult> => {
    return request('/api/media/metadata', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Photo-Filename': encodeURIComponent(file.name),
      },
      body: file,
    });
  },

  uploadMedia: async (data: MediaUploadInput, userId?: string): Promise<Media> => {
    return request('/api/media/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(data)
    });
  },

  deleteMedia: async (id: string): Promise<boolean> => requestOk(`/api/media/${id}`, { method: 'DELETE' }),

  updateMedia: async (id: string, data: any): Promise<any> => {
    return request(`/api/media/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  // Checklists
  getChecklists: async (): Promise<Checklist[]> => request('/api/checklists'),

  getChecklistDetails: async (id: string): Promise<Checklist & { items: any[] }> => request(`/api/checklists/${id}`),

  getChecklistDetailsBatch: async (ids: string[]): Promise<Array<Checklist & { items: any[] }>> => {
    if (ids.length === 0) return [];
    const result = await request<{ details: Array<Checklist & { items: any[] }> }>('/api/checklists/details-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return result.details;
  },

  createChecklist: async (data: { title: string; trip_id?: string; template_type?: string }, userId?: string): Promise<Checklist> => {
    return request('/api/checklists', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(data)
    });
  },

  createChecklistFromTemplate: async (data: { title: string; trip_id?: string; template_type: string }, userId?: string): Promise<Checklist & { items: any[] }> => {
    return request('/api/checklists/from-template', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(data)
    });
  },

  createChecklistItem: async (checklistId: string, data: any): Promise<any> => {
    return request(`/api/checklists/${checklistId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  updateChecklistItem: async (itemId: string, data: any): Promise<any> => {
    return request(`/api/checklist-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteChecklistItem: async (itemId: string): Promise<boolean> => requestOk(`/api/checklist-items/${itemId}`, { method: 'DELETE' }),

  // Guides
  getGuides: async (): Promise<Guide[]> => request('/api/guides'),

  getGuideDetails: async (id: string): Promise<Guide> => request(`/api/guides/${id}`),

  createGuide: async (data: Partial<Guide>, userId?: string): Promise<Guide> => {
    return request('/api/guides', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(data)
    });
  },

  updateGuide: async (id: string, data: Partial<Guide>): Promise<Guide> => {
    return request(`/api/guides/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteGuide: async (id: string): Promise<boolean> => requestOk(`/api/guides/${id}`, { method: 'DELETE' }),

  // Visits
  getVisits: async (): Promise<any[]> => request('/api/visits'),

  createVisit: async (data: any): Promise<any> => {
    return request('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  // System & Admin
  getBackups: async (): Promise<any[]> => request('/api/backups'),

  createBackup: async (): Promise<any> => request('/api/backups', { method: 'POST' }),

  restoreBackup: async (filename: string): Promise<any> => {
    return request('/api/backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
  },

  deleteBackup: async (filename: string): Promise<boolean> => requestOk(`/api/backups/${filename}`, { method: 'DELETE' }),

  getCapacity: async (): Promise<any> => request('/api/system/capacity'),

  getInvites: async (): Promise<InviteCode[]> => request('/api/admin/invites'),

  getAdminUsers: async (): Promise<User[]> => {
    return request<User[]>('/api/admin/users');
  },

  createAdminUser: async (data: { username: string; password: string; role?: 'admin' | 'user' }): Promise<User> => {
    return request<User>('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  updateAdminUser: async (id: string, patch: { is_active?: boolean; role?: 'admin' | 'user' }): Promise<User> => {
    return request<User>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
  },

  resetAdminUserPassword: async (id: string, password: string): Promise<void> => {
    return request<void>(`/api/admin/users/${id}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
  },

  createInvite: async (data: any, userId?: string): Promise<InviteCode> => {
    return request('/api/admin/invites', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(data)
    });
  }
};
