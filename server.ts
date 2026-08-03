/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import https from 'https';
import { fileURLToPath } from 'url';
import type { Server } from 'node:http';
import { DbEngine } from './src/dbEngine';
import { AppDatabase, Place, Trip, TripDay, TripItem, Guide, Checklist, ChecklistItem, Media } from './src/types';
import { config } from './src/server/config';
import { wgs84ToGcj02 } from './src/utils/coords';
import { normalizeMediaLocation } from './src/server/mediaLocation';
import {
  extractPhotoMetadata,
  normalizePhotoMetadataDiagnostics,
} from './src/server/photoMetadata';
import {
  AmapGeocodingProvider,
  GeocodingError,
  GeocodingService,
} from './src/server/geocoding';
import {
  createAuthRouter,
  createSessionMiddleware,
  currentUser,
  originGuard,
  requireAdmin,
  requireAuth,
} from './src/server/auth/auth';

const __filename = fileURLToPath(import.meta.url);

export const app = express();
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '10mb' }));

// Ensure upload folders exist
const UPLOADS_DIR = config.uploadsPath;
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const mediaFileUrl = (id: string) => `/api/media/${id}/file`;
const mediaThumbnailUrl = (id: string) => `/api/media/${id}/thumbnail`;

function serializeMedia(m: Media): Media {
  return { ...m, file_path: mediaFileUrl(m.id), thumbnail_path: mediaThumbnailUrl(m.id) };
}

function serializeCoverImage(db: AppDatabase, cover?: string): string | undefined {
  if (!cover) return undefined;
  if (cover.startsWith('/api/media/')) return cover;
  const match = db.media.find((m) => m.file_path === cover || m.thumbnail_path === cover);
  return match ? mediaFileUrl(match.id) : undefined;
}

function serializePlace(db: AppDatabase, place: Place): Place {
  return { ...place, cover_image: serializeCoverImage(db, place.cover_image) };
}
// Private media must go through the authorized /api/media/:id/file endpoints.
// Legacy /uploads/* URLs are no longer served.
app.use('/uploads', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found' } });
});

const dbEngine = DbEngine.getInstance();
const geocodingService = new GeocodingService(
  config.amapWebServiceKey ? [new AmapGeocodingProvider(config.amapWebServiceKey)] : [],
);
app.use(createSessionMiddleware(dbEngine));
app.use(originGuard);

app.get('/api/health', (_req, res) => {
  const storage = dbEngine.getStorageStatus();
  res.json({
    status: 'ok',
    environment: config.environment,
    storage: storage.kind,
    database_integrity: storage.integrity,
  });
});

app.use('/api/auth', createAuthRouter(dbEngine));
app.get('/api/me', currentUser(dbEngine));
app.use('/api/admin', requireAuth(dbEngine), requireAdmin);
app.use('/api/system', requireAuth(dbEngine), requireAdmin);

// The JS API key is necessarily delivered to the browser. Keep this endpoint
// public so the map can initialize behind the login overlay; Web Service calls
// remain protected below and never expose their server-side key.
app.get('/api/map/config', (_req, res) => {
  if (!config.amapWebKey || !config.amapSecurityJsCode) {
    return res.status(503).json({
      error: { code: 'AMAP_NOT_CONFIGURED', message: 'AMAP browser key is not configured' },
    });
  }
  res.json({ webKey: config.amapWebKey, securityJsCode: config.amapSecurityJsCode });
});

app.use('/api', requireAuth(dbEngine));

app.get('/api/map/markers', (req, res) => {
  const keys = ['west', 'south', 'east', 'north'] as const;
  const presentKeys = keys.filter((key) => req.query[key] !== undefined);
  if (presentKeys.length !== 0 && presentKeys.length !== keys.length) {
    return res.status(400).json({
      error: { code: 'INVALID_MAP_BOUNDS', message: '地图范围必须同时包含 west、south、east、north' },
    });
  }

  let bounds: { west: number; south: number; east: number; north: number } | undefined;
  if (presentKeys.length === keys.length) {
    const values = Object.fromEntries(keys.map((key) => [key, Number(req.query[key])])) as typeof bounds;
    if (!values
      || !Object.values(values).every(Number.isFinite)
      || values.west < -180
      || values.east > 180
      || values.south < -90
      || values.north > 90
      || values.west > values.east
      || values.south > values.north) {
      return res.status(400).json({
        error: { code: 'INVALID_MAP_BOUNDS', message: '地图范围坐标无效' },
      });
    }
    bounds = values;
  }

  const db = dbEngine.getRawDb();
  const readableMedia = db.media.filter((item) => canRead(req, item));
  const mediaByPlace = new Map<string, Media[]>();
  for (const item of readableMedia) {
    if (!item.place_id) continue;
    const group = mediaByPlace.get(item.place_id);
    if (group) group.push(item);
    else mediaByPlace.set(item.place_id, [item]);
  }

  const allMarkers = db.places
    .filter((place) => canRead(req, place))
    .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
    .filter((place) => !bounds || (
      place.longitude >= bounds.west
      && place.longitude <= bounds.east
      && place.latitude >= bounds.south
      && place.latitude <= bounds.north
    ))
    .map((place) => {
      const placeMedia = mediaByPlace.get(place.id) ?? [];
      const latestMedia = placeMedia.reduce<Media | undefined>(
        (latest, item) => (!latest || item.created_at > latest.created_at ? item : latest),
        undefined,
      );
      return {
        id: place.id,
        name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        category_id: place.category_id,
        status: place.status,
        favorite: place.favorite,
        cover_image: serializeCoverImage(db, place.cover_image)
          ?? (latestMedia ? mediaThumbnailUrl(latestMedia.id) : undefined),
        photo_count: placeMedia.length,
      };
    });
  const limit = 5_000;
  return res.json({
    markers: allMarkers.slice(0, limit),
    total: allMarkers.length,
    truncated: allMarkers.length > limit,
  });
});

// ---------------- AMAP API ----------------

function requireAmapWebServiceKey(res: express.Response): string | undefined {
  if (config.amapWebServiceKey) return config.amapWebServiceKey;
  res.status(503).json({
    error: { code: 'AMAP_NOT_CONFIGURED', message: 'AMAP_WEB_SERVICE_KEY is not configured' },
  });
  return undefined;
}

function sendGeocodingError(res: express.Response, error: unknown) {
  if (error instanceof GeocodingError) {
    return res.status(error.code === 'GEOCODER_NOT_CONFIGURED' ? 503 : 502).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }
  return res.status(502).json({
    error: { code: 'GEOCODER_UPSTREAM_UNAVAILABLE', message: '地理编码服务暂不可用' },
  });
}

async function requestAmap(res: express.Response, url: URL) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok || body.status === '0') {
      return res.status(502).json({
        error: {
          code: 'AMAP_UPSTREAM_ERROR',
          message: typeof body.info === 'string' ? body.info : 'Amap service request failed',
          details: typeof body.infocode === 'string' ? { infocode: body.infocode } : undefined,
        },
      });
    }
    return res.json(body);
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'Amap service request timed out'
      : 'Unable to reach Amap service';
    return res.status(502).json({ error: { code: 'AMAP_UPSTREAM_UNAVAILABLE', message } });
  }
}

function isAllowedMapHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ['amap.com', 'gaode.com', 'baidu.com'].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function bd09ToGcj02(latitude: number, longitude: number) {
  const xPi = Math.PI * 3000 / 180;
  const x = longitude - 0.0065;
  const y = latitude - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * xPi);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * xPi);
  return { latitude: z * Math.sin(theta), longitude: z * Math.cos(theta) };
}

type SharedMapPoint = {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  provider: 'amap' | 'baidu';
};

function parseSharedMapPoint(value: string, sourceUrl: URL): SharedMapPoint | undefined {
  const decoded = (() => {
    try { return decodeURIComponent(value); } catch { return value; }
  })();
  const isBaidu = sourceUrl.hostname.toLowerCase().includes('baidu');
  const params = sourceUrl.searchParams;
  let latitude: number | undefined;
  let longitude: number | undefined;

  const position = params.get('position') ?? decoded.match(/[?&]position=([\d.-]+),([\d.-]+)/i)?.slice(1).join(',');
  if (position) {
    [longitude, latitude] = position.split(',').map(Number);
  }

  const location = params.get('location') ?? decoded.match(/[?&]location=([\d.-]+),([\d.-]+)/i)?.slice(1).join(',');
  if ((latitude === undefined || longitude === undefined) && location) {
    const [first, second] = location.split(',').map(Number);
    [latitude, longitude] = isBaidu ? [first, second] : [second, first];
  }

  if (latitude === undefined || longitude === undefined) {
    const latValue = params.get('lat') ?? params.get('latitude');
    const lngValue = params.get('lng') ?? params.get('lon') ?? params.get('longitude');
    if (latValue && lngValue) [latitude, longitude] = [Number(latValue), Number(lngValue)];
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude!) > 90 || Math.abs(longitude!) > 180) return undefined;

  const converted = isBaidu ? bd09ToGcj02(latitude!, longitude!) : { latitude: latitude!, longitude: longitude! };
  return {
    ...converted,
    name: params.get('name') ?? params.get('title') ?? undefined,
    address: params.get('address') ?? params.get('content') ?? undefined,
    provider: isBaidu ? 'baidu' : 'amap',
  };
}

app.get('/api/map/poi', async (req, res) => {
  const keywords = typeof req.query.keywords === 'string' ? req.query.keywords.trim() : '';
  if (!keywords || keywords.length > 100) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'keywords must contain 1 to 100 characters' } });
  }
  const region = typeof req.query.region === 'string' && req.query.region.trim()
    ? req.query.region.trim().slice(0, 50)
    : undefined;
  try {
    return res.json(await geocodingService.searchPoi({ keywords, region }));
  } catch (error) {
    return sendGeocodingError(res, error);
  }
});

app.get('/api/map/regeocode', async (req, res) => {
  const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
  if (!/^-?\d{1,3}(?:\.\d+)?,-?\d{1,2}(?:\.\d+)?$/.test(location)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'location must use lng,lat coordinates' } });
  }
  const [longitude, latitude] = location.split(',').map(Number);
  try {
    return res.json(await geocodingService.reverseGeocode({ latitude, longitude }));
  } catch (error) {
    return sendGeocodingError(res, error);
  }
});

app.get('/api/map/ip', async (_req, res) => {
  const key = requireAmapWebServiceKey(res);
  if (!key) return;
  // No ip param: AMap locates the requester — the server, which runs on the
  // same box/network as the users in this private deployment, so its public
  // IP yields the right city. (Passing a private client IP would be useless.)
  const url = new URL('https://restapi.amap.com/v3/ip');
  url.searchParams.set('key', key);
  return requestAmap(res, url);
});

app.post('/api/map/share/resolve', async (req, res) => {
  const input = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!input || input.length > 2_048) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A map share URL is required' } });
  }

  let currentUrl: URL;
  try {
    currentUrl = new URL(input.match(/https?:\/\/\S+/i)?.[0] ?? input);
  } catch {
    return res.status(400).json({ error: { code: 'INVALID_MAP_URL', message: '请输入完整的高德或百度地图分享链接' } });
  }
  if (currentUrl.protocol !== 'https:' || !isAllowedMapHost(currentUrl.hostname)) {
    return res.status(400).json({ error: { code: 'UNSUPPORTED_MAP_URL', message: '目前支持高德地图和百度地图 HTTPS 分享链接' } });
  }

  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
    const parsed = parseSharedMapPoint(currentUrl.toString(), currentUrl);
    if (parsed) return res.json({ ...parsed, sourceUrl: currentUrl.toString() });
    try {
      const response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(8_000),
        headers: { 'User-Agent': 'TravelFootprint/1.0' },
      });
      const location = response.headers.get('location');
      if (location && response.status >= 300 && response.status < 400) {
        const nextUrl = new URL(location, currentUrl);
        if (nextUrl.protocol !== 'https:' || !isAllowedMapHost(nextUrl.hostname)) break;
        currentUrl = nextUrl;
        continue;
      }
      const html = (await response.text()).slice(0, 1_000_000);
      const fromHtml = parseSharedMapPoint(html, currentUrl);
      if (fromHtml) return res.json({ ...fromHtml, sourceUrl: currentUrl.toString() });
      break;
    } catch {
      break;
    }
  }

  return res.status(422).json({
    error: { code: 'MAP_LOCATION_NOT_FOUND', message: '链接中未解析出坐标，请尝试复制地图中的完整分享链接' },
  });
});

app.get('/api/map/route/driving', async (req, res) => {
  const key = requireAmapWebServiceKey(res);
  if (!key) return;
  const coordinatePattern = /^-?\d{1,3}(?:\.\d+)?,-?\d{1,2}(?:\.\d+)?$/;
  const origin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';
  const destination = typeof req.query.destination === 'string' ? req.query.destination.trim() : '';
  if (!coordinatePattern.test(origin) || !coordinatePattern.test(destination)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'origin and destination must use lng,lat coordinates' },
    });
  }
  const url = new URL('https://restapi.amap.com/v5/direction/driving');
  url.searchParams.set('key', key);
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  url.searchParams.set('show_fields', 'cost,polyline');
  return requestAmap(res, url);
});

// Authentication middleware (Simple session-less token header or basic simulated auth)
// Since this is a private app, we will use a simple header "X-User-Id" to identify the user
// or default to the admin user to keep UX frictionless for the MVP while preserving the API structures.
function getCurrentUserId(req: express.Request): string {
  if (!req.currentUser) throw new Error('Authenticated user missing from request');
  return req.currentUser.id;
}

type ProtectedResource = {
  visibility?: 'private' | 'shared';
  created_by?: string;
  user_id?: string;
};

function canRead(req: express.Request, resource: ProtectedResource): boolean {
  const user = req.currentUser;
  if (!user) return false;
  const ownerId = resource.created_by ?? resource.user_id;
  return user.role === 'admin' || ownerId === user.id || resource.visibility === 'shared';
}

function canModify(req: express.Request, resource: ProtectedResource): boolean {
  const user = req.currentUser;
  if (!user) return false;
  return user.role === 'admin' || (resource.created_by ?? resource.user_id) === user.id;
}

function forbidden(res: express.Response) {
  return res.status(403).json({ error: { code: 'RESOURCE_FORBIDDEN', message: 'You do not have access to this resource' } });
}

function tripForDay(db: AppDatabase, dayId: string) {
  const day = db.tripDays.find((item) => item.id === dayId);
  return day ? db.trips.find((trip) => trip.id === day.trip_id) : undefined;
}

function tripForItem(db: AppDatabase, itemId: string) {
  const item = db.tripItems.find((candidate) => candidate.id === itemId);
  return item ? tripForDay(db, item.trip_day_id) : undefined;
}

function checklistForItem(db: AppDatabase, itemId: string) {
  const item = db.checklistItems.find((candidate) => candidate.id === itemId);
  return item ? db.checklists.find((checklist) => checklist.id === item.checklist_id) : undefined;
}

function pickAllowed(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  return Object.fromEntries(fields.filter((field) => Object.hasOwn(source, field)).map((field) => [field, source[field]]));
}

const PLACE_UPDATE_FIELDS = [
  'name', 'category_id', 'latitude', 'longitude', 'coordinate_system', 'address', 'province', 'city', 'district',
  'poi_provider', 'poi_id', 'cover_image', 'summary', 'overview_route', 'overview_tips', 'safety_notes',
  'packing_list', 'nearby_services', 'rating', 'visibility', 'recommended', 'is_wet', 'need_hiking',
  'rainy_ready', 'has_signal', 'risk_level', 'best_season', 'ticket_price', 'open_hours', 'suggested_duration',
  'has_parking', 'has_restroom', 'has_charging', 'difficulty',
] as const;
const TRIP_UPDATE_FIELDS = [
  'title', 'start_date', 'end_date', 'origin', 'destination_summary', 'travel_mode', 'participants', 'vehicle',
  'status', 'budget', 'cover_image', 'visibility',
] as const;
const TRIP_DAY_UPDATE_FIELDS = [
  'date', 'title', 'departure_place', 'destination_place', 'planned_distance', 'planned_drive_time', 'planned_cost',
  'intensity', 'weather_note', 'risk_level', 'notes',
] as const;
const TRIP_ITEM_UPDATE_FIELDS = [
  'type', 'place_id', 'title', 'start_time', 'end_time', 'duration', 'booking_status', 'cost', 'priority', 'status', 'note',
] as const;
const MEDIA_UPDATE_FIELDS = ['captured_at', 'place_id', 'visit_id', 'trip_id', 'favorite', 'visibility'] as const;
const CHECKLIST_ITEM_UPDATE_FIELDS = [
  'name', 'quantity', 'owner', 'required', 'completed', 'trip_day_id', 'note', 'category', 'source',
] as const;
const GUIDE_UPDATE_FIELDS = [
  'title', 'target_type', 'target_id', 'summary', 'content', 'source', 'verified_at', 'visibility',
] as const;

// ---------------- USER & AUTH API ----------------

app.get('/api/me', (req, res) => {
  const userId = getCurrentUserId(req);
  const db = dbEngine.getRawDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: '未登录' });
  }
  res.json({ user });
});

app.get('/api/admin/users', (req, res) => {
  const userId = getCurrentUserId(req);
  const db = dbEngine.getRawDb();
  const user = db.users.find(u => u.id === userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }
  res.json(db.users);
});

app.patch('/api/admin/users/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const index = db.users.findIndex((user) => user.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
  const { is_active, role } = req.body ?? {};
  if ((is_active !== undefined && typeof is_active !== 'boolean')
    || (role !== undefined && role !== 'admin' && role !== 'user')
    || (is_active === undefined && role === undefined)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Only is_active and role can be updated' } });
  }

  const current = db.users[index];
  const removesActiveAdmin = current.role === 'admin'
    && current.is_active
    && (is_active === false || role === 'user');
  if (removesActiveAdmin && db.users.filter((user) => user.role === 'admin' && user.is_active).length <= 1) {
    return res.status(409).json({ error: { code: 'LAST_ADMIN', message: 'The last active administrator cannot be disabled or demoted' } });
  }

  db.users[index] = {
    ...current,
    ...(is_active === undefined ? {} : { is_active }),
    ...(role === undefined ? {} : { role }),
  };
  dbEngine.saveDb(db);
  if (!db.users[index].is_active) dbEngine.deleteUserSessions(db.users[index].id);
  res.json(db.users[index]);
});

app.post('/api/admin/invites', (req, res) => {
  const userId = getCurrentUserId(req);
  const db = dbEngine.getRawDb();
  const user = db.users.find(u => u.id === userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  const { code, max_uses, expires_at } = req.body;
  const newInvite = {
    id: 'i_' + Math.random().toString(36).substring(2, 9),
    code: code || Math.random().toString(36).substring(2, 8).toUpperCase(),
    max_uses: max_uses || 5,
    uses: 0,
    expires_at: expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  };

  db.invites.push(newInvite);
  dbEngine.saveDb(db);
  res.json(newInvite);
});

app.get('/api/admin/invites', (req, res) => {
  const db = dbEngine.getRawDb();
  res.json(db.invites);
});

// ---------------- PLACES API ----------------

app.get('/api/places', (req, res) => {
  const userId = getCurrentUserId(req);
  const { category, status, search, favorite } = req.query;
  
  let result = dbEngine.getPlacesForUser(userId).filter((place) => canRead(req, place));

  if (category) {
    result = result.filter(p => p.category_id === category);
  }
  if (status) {
    result = result.filter(p => p.status === status);
  }
  if (favorite === 'true') {
    result = result.filter(p => p.favorite);
  }
  if (search) {
    const q = (search as string).toLowerCase();
    result = result.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.address.toLowerCase().includes(q) || 
      (p.summary && p.summary.toLowerCase().includes(q))
    );
  }

  const db = dbEngine.getRawDb();
  res.json(result.map((place) => serializePlace(db, place)));
});

app.post('/api/places', (req, res) => {
  const userId = getCurrentUserId(req);
  const db = dbEngine.getRawDb();
  const placeData = req.body;

  const newPlace: Place = {
    id: 'p_' + Math.random().toString(36).substring(2, 9),
    name: placeData.name,
    category_id: placeData.category_id,
    latitude: parseFloat(placeData.latitude),
    longitude: parseFloat(placeData.longitude),
    coordinate_system: placeData.coordinate_system || 'GCJ02',
    address: placeData.address || '',
    province: placeData.province,
    city: placeData.city,
    district: placeData.district,
    poi_provider: placeData.poi_provider,
    poi_id: placeData.poi_id,
    cover_image: placeData.cover_image,
    summary: placeData.summary,
    overview_route: placeData.overview_route,
    overview_tips: placeData.overview_tips,
    safety_notes: placeData.safety_notes,
    packing_list: placeData.packing_list,
    nearby_services: placeData.nearby_services,
    rating: placeData.rating,
    status: placeData.status || 'want_to_go',
    visibility: placeData.visibility || 'shared',
    favorite: !!placeData.favorite,
    recommended: !!placeData.recommended,
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),

    // Extra metadata fields
    is_wet: placeData.is_wet,
    need_hiking: placeData.need_hiking,
    rainy_ready: placeData.rainy_ready,
    has_signal: placeData.has_signal,
    risk_level: placeData.risk_level,
    best_season: placeData.best_season,
    ticket_price: placeData.ticket_price,
    open_hours: placeData.open_hours,
    suggested_duration: placeData.suggested_duration,
    has_parking: placeData.has_parking,
    has_restroom: placeData.has_restroom,
    has_charging: placeData.has_charging,
    difficulty: placeData.difficulty,
  };

  db.places.push(newPlace);
  dbEngine.saveDb(db);
  res.json(serializePlace(db, newPlace));
});

app.get('/api/places/:id', (req, res) => {
  const place = dbEngine.getPlacesForUser(getCurrentUserId(req)).find(p => p.id === req.params.id);
  if (place && !canRead(req, place)) return forbidden(res);
  if (!place) return res.status(404).json({ error: '地点不存在' });
  res.json(serializePlace(dbEngine.getRawDb(), place));
});

app.patch('/api/places/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const index = db.places.findIndex(p => p.id === req.params.id);
  if (index !== -1 && !canModify(req, db.places[index])) return forbidden(res);
  if (index === -1) return res.status(404).json({ error: '地点不存在' });

  const updatedPlace = {
    ...db.places[index],
    ...pickAllowed(req.body, PLACE_UPDATE_FIELDS),
    updated_at: new Date().toISOString()
  };

  db.places[index] = updatedPlace;
  dbEngine.saveDb(db);
  res.json(serializePlace(db, updatedPlace));
});

app.delete('/api/places/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const index = db.places.findIndex(p => p.id === req.params.id);
  if (index !== -1 && !canModify(req, db.places[index])) return forbidden(res);
  if (index === -1) return res.status(404).json({ error: '地点不存在' });

  db.places.splice(index, 1);
  db.visits = db.visits.filter((visit) => visit.place_id !== req.params.id);
  db.tripItems = db.tripItems.map((item) => item.place_id === req.params.id ? { ...item, place_id: undefined } : item);
  db.media = db.media.map((media) => media.place_id === req.params.id ? { ...media, place_id: undefined } : media);
  dbEngine.saveDb(db);
  res.json({ success: true });
});

// Toggle favorites & visited status
app.post('/api/places/:id/favorite', (req, res) => {
  const userId = getCurrentUserId(req);
  const place = dbEngine.getPlacesForUser(userId).find((item) => item.id === req.params.id);
  if (!place) return res.status(404).json({ error: { code: 'PLACE_NOT_FOUND', message: 'Place not found' } });
  if (!canRead(req, place)) return forbidden(res);
  res.json(serializePlace(dbEngine.getRawDb(), dbEngine.togglePlaceFavorite(userId, place.id)));
});

app.post('/api/places/:id/mark-visited', (req, res) => {
  const userId = getCurrentUserId(req);
  const place = dbEngine.getPlacesForUser(userId).find((item) => item.id === req.params.id);
  if (!place) return res.status(404).json({ error: { code: 'PLACE_NOT_FOUND', message: 'Place not found' } });
  if (!canRead(req, place)) return forbidden(res);
  res.json(serializePlace(dbEngine.getRawDb(), dbEngine.togglePlaceVisited(userId, place.id)));
});

// ---------------- VISITS API ----------------

app.get('/api/visits', (req, res) => {
  const db = dbEngine.getRawDb();
  res.json((db.visits || []).filter((visit) => canModify(req, visit)));
});

app.get('/api/places/:id/visits', (req, res) => {
  const db = dbEngine.getRawDb();
  const visits = db.visits.filter(v => v.place_id === req.params.id && canModify(req, v));
  res.json(visits);
});

app.post('/api/visits', (req, res) => {
  const userId = getCurrentUserId(req);
  const db = dbEngine.getRawDb();
  if (!db.visits) db.visits = [];
  const visitData = req.body;
  const placeIndex = db.places.findIndex((place) => place.id === visitData.place_id);
  if (placeIndex === -1) return res.status(404).json({ error: { code: 'PLACE_NOT_FOUND', message: 'Place not found' } });
  const targetPlace = db.places[placeIndex];
  if (!canRead(req, targetPlace)) return forbidden(res);

  const rating = visitData.rating !== undefined ? Number(visitData.rating) : 5;
  const actualCost = visitData.actual_cost !== undefined ? Number(visitData.actual_cost) : 0;
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'rating must be a number between 0 and 5' } });
  }
  if (!Number.isFinite(actualCost) || actualCost < 0) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'actual_cost must be a non-negative number' } });
  }
  const revisit = visitData.revisit_intention || 'yes';
  if (!['yes', 'maybe', 'no'].includes(revisit)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'revisit_intention must be yes, maybe, or no' } });
  }

  const newVisit = {
    id: 'v_' + Math.random().toString(36).substring(2, 9),
    place_id: visitData.place_id,
    trip_id: visitData.trip_id,
    created_by: userId,
    visit_date: visitData.visit_date || new Date().toISOString().split('T')[0],
    companions: visitData.companions || '',
    weather: visitData.weather || '晴',
    rating,
    note: visitData.note || '',
    actual_cost: actualCost,
    revisit_intention: revisit,
  };

  db.visits.push(newVisit);
  // Keep owner status in the snapshot aligned before replaceSnapshot, so a full
  // rewrite cannot clobber the visit-driven "visited" state for the owner.
  // Also aggregate visit ratings into the place rating (average of all visits).
  const placeVisitRatings = db.visits
    .filter((v) => v.place_id === targetPlace.id && Number.isFinite(Number(v.rating)) && Number(v.rating) > 0)
    .map((v) => Number(v.rating));
  const aggregatedRating = placeVisitRatings.length > 0
    ? Math.round((placeVisitRatings.reduce((sum, r) => sum + r, 0) / placeVisitRatings.length) * 10) / 10
    : undefined;
  db.places[placeIndex] = {
    ...targetPlace,
    status: targetPlace.created_by === userId ? 'visited' : targetPlace.status,
    rating: aggregatedRating ?? targetPlace.rating,
  };

  dbEngine.saveDb(db);
  // Always write the current user's per-user state (covers non-owner visitors too).
  dbEngine.markPlaceVisited(userId, visitData.place_id);
  res.json(newVisit);
});

// ---------------- TRIPS API ----------------

app.get('/api/trips', (req, res) => {
  const db = dbEngine.getRawDb();
  res.json(db.trips.filter((trip) => canRead(req, trip)));
});

app.post('/api/trips', (req, res) => {
  const userId = getCurrentUserId(req);
  const db = dbEngine.getRawDb();
  const tripData = req.body;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tripData.start_date ?? '')
    || !/^\d{4}-\d{2}-\d{2}$/.test(tripData.end_date ?? '')
    || tripData.end_date < tripData.start_date) {
    return res.status(400).json({ error: { code: 'INVALID_TRIP_DATES', message: 'Trip end date must not be earlier than start date' } });
  }

  const tripId = 't_' + Math.random().toString(36).substring(2, 9);
  const newTrip: Trip = {
    id: tripId,
    title: tripData.title,
    start_date: tripData.start_date,
    end_date: tripData.end_date,
    origin: tripData.origin || '',
    destination_summary: tripData.destination_summary || '',
    travel_mode: tripData.travel_mode || 'drive',
    participants: tripData.participants || '',
    vehicle: tripData.vehicle,
    status: tripData.status || 'draft',
    budget: tripData.budget ? parseFloat(tripData.budget) : undefined,
    cover_image: tripData.cover_image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=800',
    visibility: tripData.visibility || 'shared',
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.trips.push(newTrip);

  // Generate TripDays automatically based on start_date and end_date
  const start = new Date(tripData.start_date);
  const end = new Date(tripData.end_date);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 1; i <= diffDays; i++) {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + i - 1);
    const dayId = `td_${tripId}_${i}`;
    const newDay: TripDay = {
      id: dayId,
      trip_id: tripId,
      day_number: i,
      date: dayDate.toISOString().split('T')[0],
      title: `第 ${i} 天行程`
    };
    db.tripDays.push(newDay);
  }

  dbEngine.saveDb(db);
  res.json(newTrip);
});

app.get('/api/trips/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const trip = db.trips.find(t => t.id === req.params.id);
  if (trip && !canRead(req, trip)) return forbidden(res);
  if (!trip) return res.status(404).json({ error: '行程不存在' });
  
  const days = db.tripDays.filter(d => d.trip_id === trip.id);
  const dayIds = days.map(d => d.id);
  const items = db.tripItems.filter(item => dayIds.includes(item.trip_day_id));

  res.json({
    ...trip,
    days,
    items
  });
});

app.post('/api/trips/details-batch', (req, res) => {
  const ids = (req.body as { ids?: unknown } | undefined)?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'ids must be an array of strings' } });
  }
  if (ids.length > 100) {
    return res.status(400).json({ error: { code: 'TOO_MANY_IDS', message: 'ids must contain at most 100 entries' } });
  }

  const db = dbEngine.getRawDb();
  const details = [];
  for (const id of ids) {
    const trip = db.trips.find(t => t.id === id);
    if (!trip || !canRead(req, trip)) continue;
    const days = db.tripDays.filter(d => d.trip_id === trip.id);
    const dayIds = days.map(d => d.id);
    const items = db.tripItems.filter(item => dayIds.includes(item.trip_day_id));
    details.push({ ...trip, days, items });
  }
  res.json({ details });
});

app.patch('/api/trips/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const index = db.trips.findIndex(t => t.id === req.params.id);
  if (index !== -1 && !canModify(req, db.trips[index])) return forbidden(res);
  if (index === -1) return res.status(404).json({ error: '行程不存在' });

  const updatedTrip = {
    ...db.trips[index],
    ...pickAllowed(req.body, TRIP_UPDATE_FIELDS),
    updated_at: new Date().toISOString()
  };
  if (updatedTrip.end_date < updatedTrip.start_date) {
    return res.status(400).json({ error: { code: 'INVALID_TRIP_DATES', message: 'Trip end date must not be earlier than start date' } });
  }
  db.trips[index] = updatedTrip;

  dbEngine.saveDb(db);
  res.json(db.trips[index]);
});

app.delete('/api/trips/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const index = db.trips.findIndex(t => t.id === req.params.id);
  if (index !== -1 && !canModify(req, db.trips[index])) return forbidden(res);
  if (index === -1) return res.status(404).json({ error: '行程不存在' });

  const tripId = req.params.id;
  db.trips.splice(index, 1);

  // Clean up related days and items
  const days = db.tripDays.filter(d => d.trip_id === tripId);
  const dayIds = days.map(d => d.id);
  db.tripDays = db.tripDays.filter(d => d.trip_id !== tripId);
  db.tripItems = db.tripItems.filter(item => !dayIds.includes(item.trip_day_id));
  db.visits = db.visits.map((visit) => visit.trip_id === tripId ? { ...visit, trip_id: undefined } : visit);
  db.media = db.media.map((media) => media.trip_id === tripId ? { ...media, trip_id: undefined } : media);
  db.checklists = db.checklists.map((checklist) => checklist.trip_id === tripId ? { ...checklist, trip_id: undefined } : checklist);

  dbEngine.saveDb(db);
  res.json({ success: true });
});

// TRIP DAYS & ITEMS

app.patch('/api/trip-days/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const trip = tripForDay(db, req.params.id);
  if (trip && !canModify(req, trip)) return forbidden(res);
  const index = db.tripDays.findIndex(d => d.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '行程天信息不存在' });

  db.tripDays[index] = {
    ...db.tripDays[index],
    ...pickAllowed(req.body, TRIP_DAY_UPDATE_FIELDS)
  };

  dbEngine.saveDb(db);
  res.json(db.tripDays[index]);
});

app.post('/api/trip-days/:id/items', (req, res) => {
  const db = dbEngine.getRawDb();
  const dayId = req.params.id;
  const trip = tripForDay(db, dayId);
  if (!trip) return res.status(404).json({ error: { code: 'TRIP_DAY_NOT_FOUND', message: 'Trip day not found' } });
  if (!canModify(req, trip)) return forbidden(res);
  const itemData = req.body;
  if (!validateReference(req, res, db.places, itemData.place_id, '目标地点')) return;

  // Find max sort order
  const dayItems = db.tripItems.filter(item => item.trip_day_id === dayId);
  const maxOrder = dayItems.reduce((max, item) => item.sort_order > max ? item.sort_order : max, 0);

  const newItem: TripItem = {
    id: 'ti_' + Math.random().toString(36).substring(2, 9),
    trip_day_id: dayId,
    type: itemData.type || 'play',
    place_id: itemData.place_id,
    title: itemData.title,
    start_time: itemData.start_time,
    end_time: itemData.end_time,
    duration: itemData.duration,
    booking_status: itemData.booking_status || 'na',
    cost: itemData.cost ? parseFloat(itemData.cost) : undefined,
    priority: itemData.priority || 'must',
    status: itemData.status || 'pending',
    note: itemData.note,
    sort_order: maxOrder + 1
  };

  db.tripItems.push(newItem);
  dbEngine.saveDb(db);
  res.json(newItem);
});

app.patch('/api/trip-items/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const trip = tripForItem(db, req.params.id);
  if (trip && !canModify(req, trip)) return forbidden(res);
  const index = db.tripItems.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '行程项目不存在' });

  db.tripItems[index] = {
    ...db.tripItems[index],
    ...pickAllowed(req.body, TRIP_ITEM_UPDATE_FIELDS)
  };

  dbEngine.saveDb(db);
  res.json(db.tripItems[index]);
});

app.delete('/api/trip-items/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const trip = tripForItem(db, req.params.id);
  if (trip && !canModify(req, trip)) return forbidden(res);
  const index = db.tripItems.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '行程项目不存在' });

  db.tripItems.splice(index, 1);
  dbEngine.saveDb(db);
  res.json({ success: true });
});

app.post('/api/trip-items/reorder', (req, res) => {
  const db = dbEngine.getRawDb();
  const { items } = req.body; // Array of { id, sort_order, trip_day_id }

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: '参数不正确' });
  }

  const validItems = items.every((item) => item
    && typeof item.id === 'string'
    && Number.isInteger(item.sort_order)
    && item.sort_order > 0
    && (item.trip_day_id === undefined || typeof item.trip_day_id === 'string'));
  const itemIds = items.map((item) => item.id);
  if (!validItems || new Set(itemIds).size !== itemIds.length || itemIds.some((id) => !db.tripItems.some((item) => item.id === id))) {
    return res.status(400).json({ error: { code: 'INVALID_REORDER', message: 'Reorder items must be unique existing items with positive sort positions' } });
  }

  const affectedTrips = items.map((item) => tripForItem(db, item.id)).filter(Boolean);
  if (affectedTrips.some((trip) => !canModify(req, trip!))) return forbidden(res);
  const targetTrips = items
    .filter((item) => item.trip_day_id)
    .map((item) => tripForDay(db, item.trip_day_id));
  if (targetTrips.some((trip) => !trip || !canModify(req, trip))) return forbidden(res);

  const projected = db.tripItems.map((existing) => {
    const change = items.find((item) => item.id === existing.id);
    return change ? {
      ...existing,
      sort_order: change.sort_order,
      trip_day_id: change.trip_day_id || existing.trip_day_id,
    } : existing;
  });
  const positions = projected.map((item) => `${item.trip_day_id}:${item.sort_order}`);
  if (new Set(positions).size !== positions.length) {
    return res.status(400).json({ error: { code: 'DUPLICATE_SORT_ORDER', message: 'Each trip day must have unique sort positions' } });
  }

  items.forEach(reorder => {
    const index = db.tripItems.findIndex(item => item.id === reorder.id);
    if (index !== -1) {
      db.tripItems[index].sort_order = reorder.sort_order;
      if (reorder.trip_day_id) {
        db.tripItems[index].trip_day_id = reorder.trip_day_id;
      }
    }
  });

  dbEngine.saveDb(db);
  res.json({ success: true });
});

// Add to trip helper
app.post('/api/places/:id/add-to-trip', (req, res) => {
  const db = dbEngine.getRawDb();
  const placeId = req.params.id;
  const { trip_day_id, type, start_time, note } = req.body;
  const trip = tripForDay(db, trip_day_id);
  if (!trip) return res.status(404).json({ error: { code: 'TRIP_DAY_NOT_FOUND', message: 'Trip day not found' } });
  if (!canModify(req, trip)) return forbidden(res);

  const place = db.places.find(p => p.id === placeId);
  if (place && !canRead(req, place)) return forbidden(res);
  if (!place) return res.status(404).json({ error: '地点不存在' });

  const dayItems = db.tripItems.filter(item => item.trip_day_id === trip_day_id);
  const maxOrder = dayItems.reduce((max, item) => item.sort_order > max ? item.sort_order : max, 0);

  const newItem: TripItem = {
    id: 'ti_' + Math.random().toString(36).substring(2, 9),
    trip_day_id,
    type: type || 'play',
    place_id: placeId,
    title: place.name,
    start_time: start_time || '10:00',
    priority: 'must',
    status: 'pending',
    note: note || place.summary,
    sort_order: maxOrder + 1
  };

  db.tripItems.push(newItem);
  dbEngine.saveDb(db);
  res.json(newItem);
});

// ---------------- MEDIA API ----------------

app.post(
  '/api/media/metadata',
  express.raw({ type: () => true, limit: '50mb' }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        error: { code: 'PHOTO_BODY_REQUIRED', message: '请提交原始照片文件' },
      });
    }

    const rawFilename = req.get('x-photo-filename');
    let filename = rawFilename;
    if (rawFilename) {
      try {
        filename = decodeURIComponent(rawFilename);
      } catch {
        filename = rawFilename;
      }
    }

    const result = await extractPhotoMetadata(req.body, {
      contentType: req.get('content-type'),
      filename,
    });
    return res.json(result);
  },
);

app.get('/api/media', (req, res) => {
  const db = dbEngine.getRawDb();
  const { place_id, trip_id } = req.query;
  
  let result = db.media.filter((media) => canRead(req, media));
  if (place_id) {
    result = result.filter(m => m.place_id === place_id);
  }
  if (trip_id) {
    result = result.filter(m => m.trip_id === trip_id);
  }

  res.json(result.map(serializeMedia));
});

const MEDIA_FILE_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
};

type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif' | 'image/heic';

const UPLOAD_MIME_WHITELIST = new Set<ImageMime>([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic',
]);

const MIME_TO_EXTENSION: Record<ImageMime, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/heic': '.heic',
};

// Identify the real image type from magic bytes — the declared MIME is never trusted.
function sniffImageMime(buffer: Buffer): ImageMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
  if (
    buffer.length >= 8
    && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
    && buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a')) return 'image/gif';
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return null;
}

type ReferableResource = ProtectedResource & { id: string };

// Cross-resource references may only target resources the user can read;
// optional references (null/undefined/empty string) pass through untouched.
function validateReference(
  req: express.Request,
  res: express.Response,
  items: ReferableResource[],
  id: unknown,
  label: string,
): boolean {
  if (id === undefined || id === null || id === '') return true;
  const target = typeof id === 'string' ? items.find((item) => item.id === id) : undefined;
  if (!target || !canRead(req, target)) {
    res.status(400).json({ error: { code: 'INVALID_REFERENCE', message: `${label}不存在或无权访问` } });
    return false;
  }
  return true;
}

function serveMediaFile(req: express.Request, res: express.Response, kind: 'file' | 'thumbnail') {
  const db = dbEngine.getRawDb();
  const media = db.media.find((m) => m.id === req.params.id);
  // Media the user cannot read is treated as non-existent, matching the
  // filtering behaviour of the media list endpoint.
  if (!media || !canRead(req, media)) {
    return res.status(404).json({ error: { code: 'MEDIA_NOT_FOUND', message: '照片不存在' } });
  }

  const storedPath = kind === 'thumbnail' ? media.thumbnail_path : media.file_path;
  if (!storedPath || !storedPath.startsWith('/uploads/')) {
    return res.status(400).json({ error: { code: 'INVALID_MEDIA_PATH', message: 'Invalid media path' } });
  }
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  const fullPath = path.resolve(uploadsRoot, storedPath.slice('/uploads/'.length));
  if (!fullPath.startsWith(uploadsRoot + path.sep)) {
    return res.status(400).json({ error: { code: 'INVALID_MEDIA_PATH', message: 'Invalid media path' } });
  }
  const contentType = MEDIA_FILE_CONTENT_TYPES[path.extname(fullPath).toLowerCase()];
  if (!contentType) {
    return res.status(400).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported media type' } });
  }
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: { code: 'MEDIA_FILE_NOT_FOUND', message: '照片文件不存在' } });
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(fullPath).pipe(res);
}

app.get('/api/media/:id/file', (req, res) => serveMediaFile(req, res, 'file'));
app.get('/api/media/:id/thumbnail', (req, res) => serveMediaFile(req, res, 'thumbnail'));

// Since files are saved inside server, we can simulate an upload
// by saving base64 string or handling mock uploads for our light private use.
app.post('/api/media/upload', (req, res) => {
  const userId = getCurrentUserId(req);
  const db = dbEngine.getRawDb();
  const { filename, file_size, dataUrl, place_id, trip_id, captured_at } = req.body;

  if (!dataUrl) {
    return res.status(400).json({ error: '没有文件数据' });
  }

  let location: ReturnType<typeof normalizeMediaLocation>;
  let metadataDiagnostics: ReturnType<typeof normalizePhotoMetadataDiagnostics>;
  try {
    location = normalizeMediaLocation(req.body);
    metadataDiagnostics = normalizePhotoMetadataDiagnostics(req.body);
  } catch (error) {
    return res.status(400).json({
      error: {
        code: 'INVALID_MEDIA_LOCATION',
        message: error instanceof Error ? error.message : '照片位置格式无效',
      },
    });
  }

  // Attachments may only reference resources the user can read.
  if (!validateReference(req, res, db.places, place_id, '目标地点')) return;
  if (!validateReference(req, res, db.trips, trip_id, '目标行程')) return;

  // Parse dataUrl and verify the payload really is a whitelisted image;
  // the declared MIME alone is never trusted (SVG/HTML would otherwise be stored).
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return res.status(400).json({ error: '无效的数据格式' });
  }

  const declaredMime = matches[1].toLowerCase();
  const buffer = Buffer.from(matches[2], 'base64');
  const sniffedMime = sniffImageMime(buffer);
  if (!sniffedMime || !UPLOAD_MIME_WHITELIST.has(sniffedMime) || sniffedMime !== declaredMime) {
    return res.status(400).json({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: '仅支持 JPEG/PNG/WebP/GIF/AVIF/HEIC 图片，且文件内容须与声明类型一致' },
    });
  }

  // Target directory
  const safeFilename = path.basename(String(filename || 'photo.jpg')).replace(/[^\p{L}\p{N}._-]+/gu, '_');
  const extension = path.extname(safeFilename).toLowerCase();
  if (extension && !MEDIA_FILE_CONTENT_TYPES[extension]) {
    return res.status(400).json({
      error: { code: 'UNSUPPORTED_FILE_EXTENSION', message: '文件扩展名不支持，仅允许 JPG/PNG/WebP/GIF/AVIF/HEIC' },
    });
  }
  const relativePath = path.join('places', `${Date.now()}_${safeFilename || 'photo.jpg'}${extension ? '' : MIME_TO_EXTENSION[sniffedMime]}`);
  const targetPath = path.join(UPLOADS_DIR, relativePath);
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(targetPath, buffer);

  const mediaId = 'm_' + Math.random().toString(36).substring(2, 9);
  const newMedia: Media = {
    id: mediaId,
    user_id: userId,
    file_path: `/uploads/${relativePath.replace(/\\/g, '/')}`,
    thumbnail_path: `/uploads/${relativePath.replace(/\\/g, '/')}`, // Simulated thumbnail
    file_hash: crypto.createHash('md5').update(buffer).digest('hex'),
    file_size: file_size || buffer.length,
    captured_at: captured_at || new Date().toISOString(),
    exif_latitude: location?.exifLatitude,
    exif_longitude: location?.exifLongitude,
    source_latitude: location?.sourceLatitude,
    source_longitude: location?.sourceLongitude,
    source_coordinate_system: location?.sourceCoordinateSystem,
    location_source: location?.locationSource,
    location_accuracy_m: location?.locationAccuracyM,
    location_observed_at: location?.locationObservedAt,
    display_latitude: location?.displayLatitude,
    display_longitude: location?.displayLongitude,
    metadata_status: metadataDiagnostics.metadata_status
      ?? (location?.locationSource === 'exif' || location?.locationSource === 'xmp' ? 'found' : undefined),
    metadata_parser: metadataDiagnostics.metadata_parser
      ?? (location?.locationSource === 'exif' || location?.locationSource === 'xmp' ? 'client-exifr' : undefined),
    metadata_error_code: metadataDiagnostics.metadata_error_code,
    place_id,
    trip_id,
    favorite: false,
    visibility: 'shared',
    created_at: new Date().toISOString()
  };

  db.media.push(newMedia);
  try {
    dbEngine.saveDb(db);
  } catch (error) {
    const rollbackIndex = db.media.indexOf(newMedia);
    if (rollbackIndex !== -1) db.media.splice(rollbackIndex, 1);
    try { fs.unlinkSync(targetPath); } catch { /* best-effort orphan cleanup */ }
    const code = (error as { code?: string } | null)?.code ?? '';
    const message = error instanceof Error ? error.message : String(error);
    if (code === 'SQLITE_CONSTRAINT_UNIQUE' || message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: { code: 'DUPLICATE_MEDIA', message: '这张照片已经上传过（内容相同），无需重复上传。' },
      });
    }
    throw error;
  }
  res.json(serializeMedia(newMedia));
});

app.patch('/api/media/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const index = db.media.findIndex(m => m.id === req.params.id);
  if (index !== -1 && !canModify(req, db.media[index])) return forbidden(res);
  if (index === -1) return res.status(404).json({ error: '照片不存在' });

  const updates = pickAllowed(req.body, MEDIA_UPDATE_FIELDS);
  if (!validateReference(req, res, db.places, updates.place_id, '目标地点')) return;
  if (!validateReference(req, res, db.trips, updates.trip_id, '目标行程')) return;
  if (!validateReference(req, res, db.visits, updates.visit_id, '目标打卡记录')) return;

  db.media[index] = {
    ...db.media[index],
    ...updates
  };

  dbEngine.saveDb(db);
  res.json(serializeMedia(db.media[index]));
});

app.delete('/api/media/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const index = db.media.findIndex(m => m.id === req.params.id);
  if (index !== -1 && !canModify(req, db.media[index])) return forbidden(res);
  if (index === -1) return res.status(404).json({ error: '照片不存在' });

  const media = db.media[index];
  const fullPath = path.join(process.cwd(), media.file_path);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (e) {
      console.warn('Failed to delete physical file', e);
    }
  }

  db.media.splice(index, 1);
  dbEngine.saveDb(db);
  res.json({ success: true });
});

// ---------------- CHECKLISTS API ----------------

app.get('/api/checklists', (req, res) => {
  const db = dbEngine.getRawDb();
  res.json(db.checklists.filter((checklist) => canRead(req, checklist)));
});

app.get('/api/checklists/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const checklist = db.checklists.find(cl => cl.id === req.params.id);
  if (checklist && !canRead(req, checklist)) return forbidden(res);
  if (!checklist) return res.status(404).json({ error: '清单不存在' });
  
  const items = db.checklistItems.filter(item => item.checklist_id === checklist.id);
  res.json({
    ...checklist,
    items
  });
});

app.post('/api/checklists/details-batch', (req, res) => {
  const ids = (req.body as { ids?: unknown } | undefined)?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'ids must be an array of strings' } });
  }
  if (ids.length > 100) {
    return res.status(400).json({ error: { code: 'TOO_MANY_IDS', message: 'ids must contain at most 100 entries' } });
  }

  const db = dbEngine.getRawDb();
  const details = [];
  for (const id of ids) {
    const checklist = db.checklists.find(cl => cl.id === id);
    if (!checklist || !canRead(req, checklist)) continue;
    const items = db.checklistItems.filter(item => item.checklist_id === checklist.id);
    details.push({ ...checklist, items });
  }
  res.json({ details });
});

app.post('/api/checklists', (req, res) => {
  const userId = getCurrentUserId(req);
  const db = dbEngine.getRawDb();
  const { title, trip_id, template_type } = req.body;
  if (!validateReference(req, res, db.trips, trip_id, '目标行程')) return;

  const checklistId = 'cl_' + Math.random().toString(36).substring(2, 9);
  const newChecklist: Checklist = {
    id: checklistId,
    title,
    trip_id,
    template_type,
    created_by: userId,
    visibility: 'shared',
    created_at: new Date().toISOString()
  };

  db.checklists.push(newChecklist);
  dbEngine.saveDb(db);
  res.json(newChecklist);
});

app.post('/api/checklists/from-template', (req, res) => {
  const userId = getCurrentUserId(req);
  const db = dbEngine.getRawDb();
  const { title, trip_id, template_type } = req.body;
  if (!validateReference(req, res, db.trips, trip_id, '目标行程')) return;

  const checklistId = 'cl_' + Math.random().toString(36).substring(2, 9);
  const newChecklist: Checklist = {
    id: checklistId,
    title,
    trip_id,
    template_type,
    created_by: userId,
    visibility: 'shared',
    created_at: new Date().toISOString()
  };

  db.checklists.push(newChecklist);

  // Template items
  let items: string[] = [];
  if (template_type === 'stream') {
    items = ['防滑溯溪鞋', '救生衣/漂流服', '双肩防水袋', '全身干爽换洗衣物', '吸水大毛巾', '强力防蚊液', '儿童溯溪玩具/小网兜', '饮用水与高能巧克力', '户外创可贴'];
  } else if (template_type === 'drive') {
    items = ['车辆行驶证与驾照', '车用手机支架', '随车快充App/充电卡', '胎压计与应急工具', '车载雨具/折叠伞', '车载小垃圾桶/垃圾袋', '备用偏光太阳镜'];
  } else if (template_type === 'family') {
    items = ['轻便折叠手推车/腰凳', '儿童防晒服 & 防晒帽', '儿童防蚊贴/无比滴', '保温水杯与奶粉奶瓶', '湿纸巾 & 消毒棉片', '儿童小零食/果泥', '备用纸尿裤', '儿童常用感冒退烧药'];
  } else {
    items = ['身份证/护照/优惠证件', '防晒霜/遮阳伞', '手机/相机/充电线/充电宝', '常用急救药品/创可贴', '舒适耐磨徒步鞋', '基础换洗衣物'];
  }

  const getTemplateItemCategory = (name: string, type: string): string => {
    if (type === 'drive') return '车辆';
    if (type === 'stream') {
      if (name.includes('鞋') || name.includes('衣服') || name.includes('大毛巾') || name.includes('服')) return '衣物';
      if (name.includes('药') || name.includes('创可贴')) return '药品';
      if (name.includes('玩具') || name.includes('网兜')) return '亲子';
      return '户外';
    }
    if (type === 'family') {
      if (name.includes('药') || name.includes('消毒') || name.includes('无比滴')) return '药品';
      if (name.includes('服') || name.includes('帽') || name.includes('尿裤')) return '衣物';
      return '亲子';
    }
    if (name.includes('衣') || name.includes('鞋')) return '衣物';
    if (name.includes('药') || name.includes('创可贴')) return '药品';
    return '其他';
  };

  items.forEach(name => {
    const item: ChecklistItem = {
      id: 'cli_' + Math.random().toString(36).substring(2, 9),
      checklist_id: checklistId,
      name,
      quantity: 1,
      required: true,
      completed: false,
      category: getTemplateItemCategory(name, template_type || 'general'),
      source: 'template'
    };
    db.checklistItems.push(item);
  });

  dbEngine.saveDb(db);
  res.json({
    ...newChecklist,
    items: db.checklistItems.filter(item => item.checklist_id === checklistId)
  });
});

app.post('/api/checklists/:id/items', (req, res) => {
  const db = dbEngine.getRawDb();
  const checklistId = req.params.id;
  const checklist = db.checklists.find((candidate) => candidate.id === checklistId);
  if (!checklist) return res.status(404).json({ error: { code: 'CHECKLIST_NOT_FOUND', message: 'Checklist not found' } });
  if (!canModify(req, checklist)) return forbidden(res);
  const { name, quantity, owner, required, note, category, source } = req.body;

  const item: ChecklistItem = {
    id: 'cli_' + Math.random().toString(36).substring(2, 9),
    checklist_id: checklistId,
    name,
    quantity: quantity || 1,
    owner,
    required: required !== undefined ? required : true,
    completed: false,
    note,
    category: category || '其他',
    source: source || 'manual'
  };

  db.checklistItems.push(item);
  dbEngine.saveDb(db);
  res.json(item);
});

app.patch('/api/checklist-items/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const checklist = checklistForItem(db, req.params.id);
  if (checklist && !canModify(req, checklist)) return forbidden(res);
  const index = db.checklistItems.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '清单子项不存在' });

  db.checklistItems[index] = {
    ...db.checklistItems[index],
    ...pickAllowed(req.body, CHECKLIST_ITEM_UPDATE_FIELDS)
  };

  dbEngine.saveDb(db);
  res.json(db.checklistItems[index]);
});

app.delete('/api/checklist-items/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const checklist = checklistForItem(db, req.params.id);
  if (checklist && !canModify(req, checklist)) return forbidden(res);
  const index = db.checklistItems.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '清单子项不存在' });

  db.checklistItems.splice(index, 1);
  dbEngine.saveDb(db);
  res.json({ success: true });
});

// ---------------- GUIDES API ----------------

app.get('/api/guides', (req, res) => {
  const db = dbEngine.getRawDb();
  res.json(db.guides.filter((guide) => canRead(req, guide)));
});

app.post('/api/guides', (req, res) => {
  const userId = getCurrentUserId(req);
  const db = dbEngine.getRawDb();
  const guideData = req.body;

  const newGuide: Guide = {
    id: 'g_' + Math.random().toString(36).substring(2, 9),
    title: guideData.title,
    target_type: guideData.target_type || 'general',
    target_id: guideData.target_id,
    summary: guideData.summary || '',
    content: guideData.content || '',
    source: guideData.source || '原创记录',
    verified_at: guideData.verified_at || new Date().toISOString().split('T')[0],
    created_by: userId,
    visibility: guideData.visibility || 'shared',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.guides.push(newGuide);
  dbEngine.saveDb(db);
  res.json(newGuide);
});

app.get('/api/guides/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const guide = db.guides.find(g => g.id === req.params.id);
  if (guide && !canRead(req, guide)) return forbidden(res);
  if (!guide) return res.status(404).json({ error: '攻略不存在' });
  res.json(guide);
});

app.patch('/api/guides/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const index = db.guides.findIndex(g => g.id === req.params.id);
  if (index !== -1 && !canModify(req, db.guides[index])) return forbidden(res);
  if (index === -1) return res.status(404).json({ error: '攻略不存在' });

  db.guides[index] = {
    ...db.guides[index],
    ...pickAllowed(req.body, GUIDE_UPDATE_FIELDS),
    updated_at: new Date().toISOString()
  };

  dbEngine.saveDb(db);
  res.json(db.guides[index]);
});

app.delete('/api/guides/:id', (req, res) => {
  const db = dbEngine.getRawDb();
  const index = db.guides.findIndex(g => g.id === req.params.id);
  if (index !== -1 && !canModify(req, db.guides[index])) return forbidden(res);
  if (index === -1) return res.status(404).json({ error: '攻略不存在' });

  db.guides.splice(index, 1);
  dbEngine.saveDb(db);
  res.json({ success: true });
});

// ---------------- BACKUPS API ----------------

app.use('/api/backups', (_req, res) => {
  res.status(410).json({ error: { code: 'BACKUP_DISABLED', message: 'Backup and restore are not available yet' } });
});

app.get('/api/backups', (req, res) => {
  const backups = dbEngine.listBackups();
  res.json(backups);
});

app.post('/api/backups', (req, res) => {
  try {
    const filename = dbEngine.createBackup();
    res.json({ success: true, filename });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups/restore', (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: '缺少备份文件名' });
  const success = dbEngine.restoreBackup(filename);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: '恢复失败' });
  }
});

app.delete('/api/backups/:filename', (req, res) => {
  const success = dbEngine.deleteBackup(req.params.filename);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '备份未找到' });
  }
});

// Capacity check endpoint
app.get('/api/system/capacity', (req, res) => {
  const db = dbEngine.getRawDb();
  const dbPath = config.databasePath;
  const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  
  // Calculate uploads folder size
  let uploadsSize = 0;
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        uploadsSize += stat.size;
      }
    });
  };
  walk(UPLOADS_DIR);

  res.json({
    db_size: dbSize,
    uploads_size: uploadsSize,
    photos_count: db.media.length,
    places_count: db.places.length,
    trips_count: db.trips.length,
    users_count: db.users.length,
    max_uploads_limit: 10 * 1024 * 1024 * 1024, // 10 GB
    alert_triggered: uploadsSize > 8 * 1024 * 1024 * 1024 // 8 GB warning
  });
});

// JSON Export endpoint
app.get('/api/system/export', (req, res) => {
  res.status(410).json({ error: { code: 'EXPORT_DISABLED', message: 'Full export is not available yet' } });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found' } });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled request error', error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

let activeServer: Server | https.Server | undefined;
let closeDevelopmentServer: (() => Promise<void>) | undefined;

// Server client files
export async function startServer(): Promise<Server | https.Server> {
  if (activeServer) return activeServer;
  if (!config.isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    closeDevelopmentServer = () => vite.close();
  } else {
    const distPath = config.clientDistPath;
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(indexPath);
      });
    } else {
      app.get('/', (req, res) => {
        res.send('旅行足迹: Dev mode active, React is not built yet. Run build to serve files statically.');
      });
    }
  }

  const scheme = config.tlsCertPath && config.tlsKeyPath ? 'https' : 'http';
  if (scheme === 'https') {
    activeServer = https.createServer({
      cert: fs.readFileSync(config.tlsCertPath as string),
      key: fs.readFileSync(config.tlsKeyPath as string),
    }, app);
    activeServer.listen(config.port, config.host, () => {
      console.log(`Server listening on https://${config.host}:${config.port} (${config.environment}, TLS)`);
    });
  } else {
    activeServer = app.listen(config.port, config.host, () => {
      console.log(`Server listening on http://${config.host}:${config.port} (${config.environment})`);
    });
  }
  return activeServer;
}

export async function stopServer(signal: NodeJS.Signals = 'SIGTERM') {
  console.log(`Received ${signal}; closing server.`);
  if (activeServer) {
    await new Promise<void>((resolve, reject) => {
      activeServer?.close((error) => error ? reject(error) : resolve());
    });
    activeServer = undefined;
  }
  await closeDevelopmentServer?.();
  closeDevelopmentServer = undefined;
  dbEngine.close();
}

export async function runServer() {
  try {
    await startServer();
  } catch (error) {
    console.error('Failed to start server', error);
    process.exitCode = 1;
  }
}

const isMainModule = !process.env.TRAVEL_FOOTPRINT_PRODUCTION_ENTRY
  && process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMainModule) {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      const forceExit = setTimeout(() => process.exit(1), 10_000);
      forceExit.unref();
      void stopServer(signal)
        .catch((error) => {
          console.error('Failed to stop server cleanly', error);
          process.exitCode = 1;
        })
        .finally(() => clearTimeout(forceExit));
    });
  }
  await runServer();
}
