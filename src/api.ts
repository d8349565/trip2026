/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Place, Trip, Guide, Checklist, Media, User, InviteCode, type MediaUploadInput } from './types';

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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as {
      error?: string | { code?: string; message?: string; details?: unknown };
    } | undefined;
    const error = body?.error;
    if (error && typeof error === 'object') {
      throw new ApiError(error.message || 'Request failed', response.status, error.code, error.details);
    }
    throw new ApiError(typeof error === 'string' ? error : 'Request failed', response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  getCurrentUser: async (userId?: string): Promise<{ user: User }> => {
    const res = await fetch(`${API_BASE}/api/me`, {
      headers: userId ? { 'x-user-id': userId } : {}
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  login: async (username: string, password: string): Promise<{ user: User }> => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '登录失败');
    }
    return res.json();
  },

  registerByInvite: async (username: string, password: string, inviteCode: string): Promise<{ user: User }> => {
    const res = await fetch(`${API_BASE}/api/auth/register-by-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, inviteCode })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '注册失败');
    }
    return res.json();
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

  // Places
  getPlaces: async (filters: { category?: string; status?: string; search?: string; favorite?: boolean } = {}): Promise<Place[]> => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.favorite) params.append('favorite', 'true');
    
    const res = await fetch(`${API_BASE}/api/places?${params.toString()}`);
    return res.json();
  },

  createPlace: async (place: Partial<Place>, userId?: string): Promise<Place> => {
    const res = await fetch(`${API_BASE}/api/places`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(place)
    });
    if (!res.ok) throw new Error('Failed to create place');
    return res.json();
  },

  updatePlace: async (id: string, place: Partial<Place>): Promise<Place> => {
    const res = await fetch(`${API_BASE}/api/places/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(place)
    });
    if (!res.ok) throw new Error('Failed to update place');
    return res.json();
  },

  deletePlace: async (id: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/places/${id}`, {
      method: 'DELETE'
    });
    return res.ok;
  },

  toggleFavorite: async (id: string): Promise<Place> => {
    const res = await fetch(`${API_BASE}/api/places/${id}/favorite`, { method: 'POST' });
    return res.json();
  },

  toggleVisited: async (id: string): Promise<Place> => {
    const res = await fetch(`${API_BASE}/api/places/${id}/mark-visited`, { method: 'POST' });
    return res.json();
  },

  addToTrip: async (placeId: string, data: { trip_day_id: string; type?: string; start_time?: string; note?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/places/${placeId}/add-to-trip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Trips
  getTrips: async (): Promise<Trip[]> => {
    const res = await fetch(`${API_BASE}/api/trips`);
    return res.json();
  },

  createTrip: async (trip: Partial<Trip>, userId?: string): Promise<Trip> => {
    const res = await fetch(`${API_BASE}/api/trips`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(trip)
    });
    return res.json();
  },

  getTripDetails: async (id: string): Promise<Trip & { days: any[]; items: any[] }> => {
    const res = await fetch(`${API_BASE}/api/trips/${id}`);
    if (!res.ok) throw new Error('Trip not found');
    return res.json();
  },

  updateTrip: async (id: string, data: Partial<Trip>): Promise<Trip> => {
    const res = await fetch(`${API_BASE}/api/trips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  deleteTrip: async (id: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/trips/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  updateTripDay: async (dayId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/trip-days/${dayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  createTripItem: async (dayId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/trip-days/${dayId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  updateTripItem: async (itemId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/trip-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  deleteTripItem: async (itemId: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/trip-items/${itemId}`, { method: 'DELETE' });
    return res.ok;
  },

  reorderTripItems: async (items: { id: string; sort_order: number; trip_day_id?: string }[]): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/trip-items/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    return res.ok;
  },

  // Media
  getMedia: async (params: { place_id?: string; trip_id?: string } = {}): Promise<Media[]> => {
    const q = new URLSearchParams();
    if (params.place_id) q.append('place_id', params.place_id);
    if (params.trip_id) q.append('trip_id', params.trip_id);
    const res = await fetch(`${API_BASE}/api/media?${q.toString()}`);
    return res.json();
  },

  uploadMedia: async (data: MediaUploadInput, userId?: string): Promise<Media> => {
    const res = await fetch(`${API_BASE}/api/media/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      let message = '上传失败';
      try {
        const body = await res.json();
        if (typeof body?.error?.message === 'string') message = body.error.message;
        else if (typeof body?.error === 'string') message = body.error;
      } catch { /* keep the generic message */ }
      throw new Error(message);
    }
    return res.json();
  },

  deleteMedia: async (id: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/media/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  updateMedia: async (id: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/media/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Checklists
  getChecklists: async (): Promise<Checklist[]> => {
    const res = await fetch(`${API_BASE}/api/checklists`);
    return res.json();
  },

  getChecklistDetails: async (id: string): Promise<Checklist & { items: any[] }> => {
    const res = await fetch(`${API_BASE}/api/checklists/${id}`);
    return res.json();
  },

  createChecklist: async (data: { title: string; trip_id?: string; template_type?: string }, userId?: string): Promise<Checklist> => {
    const res = await fetch(`${API_BASE}/api/checklists`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  createChecklistFromTemplate: async (data: { title: string; trip_id?: string; template_type: string }, userId?: string): Promise<Checklist & { items: any[] }> => {
    const res = await fetch(`${API_BASE}/api/checklists/from-template`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  createChecklistItem: async (checklistId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/checklists/${checklistId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  updateChecklistItem: async (itemId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/checklist-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  deleteChecklistItem: async (itemId: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/checklist-items/${itemId}`, { method: 'DELETE' });
    return res.ok;
  },

  // Guides
  getGuides: async (): Promise<Guide[]> => {
    const res = await fetch(`${API_BASE}/api/guides`);
    return res.json();
  },

  getGuideDetails: async (id: string): Promise<Guide> => {
    const res = await fetch(`${API_BASE}/api/guides/${id}`);
    return res.json();
  },

  createGuide: async (data: Partial<Guide>, userId?: string): Promise<Guide> => {
    const res = await fetch(`${API_BASE}/api/guides`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  updateGuide: async (id: string, data: Partial<Guide>): Promise<Guide> => {
    const res = await fetch(`${API_BASE}/api/guides/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  deleteGuide: async (id: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/guides/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  // Visits
  getVisits: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/api/visits`);
    return res.json();
  },

  createVisit: async (data: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: { message?: string } | string } | null;
      const message = typeof body?.error === 'string'
        ? body.error
        : body?.error?.message || 'Failed to create visit';
      throw new Error(message);
    }
    return res.json();
  },

  // System & Admin
  getBackups: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/api/backups`);
    return res.json();
  },

  createBackup: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/backups`, { method: 'POST' });
    return res.json();
  },

  restoreBackup: async (filename: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/backups/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    return res.json();
  },

  deleteBackup: async (filename: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/backups/${filename}`, { method: 'DELETE' });
    return res.ok;
  },

  getCapacity: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/system/capacity`);
    return res.json();
  },

  getInvites: async (): Promise<InviteCode[]> => {
    const res = await fetch(`${API_BASE}/api/admin/invites`);
    return res.json();
  },

  createInvite: async (data: any, userId?: string): Promise<InviteCode> => {
    const res = await fetch(`${API_BASE}/api/admin/invites`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify(data)
    });
    return res.json();
  }
};
