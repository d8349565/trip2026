/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User and Auth Types
export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

export interface InviteCode {
  id: string;
  code: string;
  max_uses: number;
  uses: number;
  expires_at: string;
  created_at: string;
}

// Map Place Categories
export type PlaceCategory =
  | 'stream'      // 溯溪点
  | 'scenic'      // 景点
  | 'play'        // 游玩点
  | 'food'        // 美食
  | 'accommodation' // 住宿
  | 'camp'        // 营地
  | 'parking'     // 停车/补给
  | 'hiking'      // 徒步点
  | 'viewpoint'   // 观景台
  | 'family'      // 亲子点
  | 'charging'    // 充电站
  | 'medical';    // 医疗/应急

export interface Place {
  id: string;
  name: string;
  category_id: PlaceCategory;
  latitude: number;
  longitude: number;
  coordinate_system: 'WGS84' | 'GCJ02';
  address: string;
  province?: string;
  city?: string;
  district?: string;
  poi_provider?: string;
  poi_id?: string;
  cover_image?: string;
  summary?: string;
  overview_route?: string;
  overview_tips?: string;
  safety_notes?: string;
  packing_list?: string;
  nearby_services?: string;
  rating?: number | null; // 1-5；数据库未评分时为 null
  status: 'want_to_go' | 'visited';
  visibility: 'private' | 'shared';
  favorite: boolean;
  recommended: boolean; // 强烈推荐
  created_by: string;
  created_at: string;
  updated_at: string;
  
  // Custom metadata for filtering / outdoors
  is_wet?: boolean; // 是否涉水
  need_hiking?: boolean; // 是否需要徒步
  rainy_ready?: boolean; // 是否适合雨后
  has_signal?: boolean; // 是否有信号
  risk_level?: 'low' | 'medium' | 'high'; // 风险等级
  best_season?: string; // 最佳季节
  ticket_price?: string; // 门票
  open_hours?: string; // 营业时间
  suggested_duration?: string; // 建议时长
  has_parking?: boolean; // 是否有停车
  has_restroom?: boolean; // 是否有厕所
  has_charging?: boolean; // 是否有充电
  difficulty?: 'easy' | 'moderate' | 'hard'; // 难度
}

export interface Visit {
  id: string;
  place_id: string;
  trip_id?: string;
  created_by: string;
  visit_date: string;
  companions?: string;
  weather?: string;
  rating: number;
  note?: string;
  actual_cost?: number;
  revisit_intention: 'yes' | 'maybe' | 'no';
}

// Trip Types
export type TripStatus = 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Trip {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  origin: string;
  destination_summary: string;
  travel_mode: 'drive' | 'train' | 'flight' | 'other';
  participants: string;
  vehicle?: string;
  status: TripStatus;
  budget?: number;
  cover_image?: string;
  visibility: 'private' | 'shared';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TripDay {
  id: string;
  trip_id: string;
  day_number: number;
  date: string;
  title: string;
  departure_place?: string;
  destination_place?: string;
  planned_distance?: number; // km
  planned_drive_time?: number; // minutes
  planned_cost?: number; // 预计通用费用
  intensity?: 'easy' | 'moderate' | 'hard'; // 强度级别
  weather_note?: string;
  risk_level?: 'low' | 'medium' | 'high';
  notes?: string;
}

export type TripItemType =
  | 'drive'       // 驾驶路段
  | 'play'        // 游玩地点
  | 'food'        // 餐饮
  | 'accommodation' // 住宿
  | 'rest'        // 休息
  | 'charging'    // 充电
  | 'parking'     // 停车
  | 'shopping'    // 采购
  | 'backup'      // 备用方案
  | 'reminder';   // 普通提醒

export interface TripItem {
  id: string;
  trip_day_id: string;
  type: TripItemType;
  place_id?: string; // Optional link to a place
  title: string;
  start_time?: string; // e.g. "08:30"
  end_time?: string;
  duration?: number; // minutes
  booking_status?: 'unbooked' | 'booked' | 'na';
  cost?: number;
  priority: 'must' | 'optional' | 'backup';
  status: 'pending' | 'completed' | 'skipped';
  note?: string;
  sort_order: number;
}

// Media Types
export interface Media {
  id: string;
  user_id: string;
  file_path: string;
  thumbnail_path: string;
  file_hash: string;
  file_size: number;
  captured_at?: string;
  exif_latitude?: number;
  exif_longitude?: number;
  source_latitude?: number;
  source_longitude?: number;
  source_coordinate_system?: 'WGS84' | 'GCJ02';
  location_source?: 'exif' | 'xmp' | 'browser' | 'manual';
  location_accuracy_m?: number;
  location_observed_at?: string;
  display_latitude?: number;
  display_longitude?: number;
  metadata_status?: PhotoMetadataStatus;
  metadata_parser?: PhotoMetadataParser;
  metadata_error_code?: string;
  place_id?: string;
  visit_id?: string;
  trip_id?: string;
  favorite: boolean;
  visibility: 'private' | 'shared';
  created_at: string;
}

export type PhotoMetadataStatus =
  | 'found'
  | 'not_found'
  | 'unsupported'
  | 'parse_error'
  | 'probe_unavailable';

export type PhotoMetadataParser = 'client-exifr' | 'server-exifr';

export interface PhotoMetadataProbeResult {
  status: Exclude<PhotoMetadataStatus, 'probe_unavailable'>;
  parser: 'server-exifr';
  latitude?: number;
  longitude?: number;
  capturedAt?: string;
  source?: 'exif' | 'xmp';
  errorCode?: string;
}

export interface MapMarkerSummary {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category_id: PlaceCategory;
  status: 'want_to_go' | 'visited';
  favorite: boolean;
  cover_image?: string;
  photo_count: number;
}

export interface MapLocation {
  latitude: number;
  longitude: number;
  accuracyM?: number;
  source: 'browser' | 'manual';
  observedAt: string;
  address?: string;
  name?: string;
}

export interface MediaUploadInput {
  filename: string;
  file_size: number;
  dataUrl: string;
  place_id?: string;
  trip_id?: string;
  captured_at?: string;
  /** 兼容旧调用方；新调用方优先使用 latitude/longitude。 */
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  coordinate_system?: 'WGS84' | 'GCJ02';
  location_source?: 'exif' | 'xmp' | 'browser' | 'manual';
  location_accuracy_m?: number;
  location_observed_at?: string;
  metadata_status?: PhotoMetadataStatus;
  metadata_parser?: PhotoMetadataParser;
  metadata_error_code?: string;
}

// Guide Types
export interface Guide {
  id: string;
  title: string;
  target_type: 'place' | 'city' | 'theme' | 'general';
  target_id?: string; // Link to place_id or city name
  summary: string;
  content: string; // Markdown text
  source?: string;
  verified_at?: string;
  created_by: string;
  visibility: 'private' | 'shared';
  created_at: string;
  updated_at: string;
}

// Checklist Types
export interface Checklist {
  id: string;
  title: string;
  trip_id?: string;
  template_type?: 'stream' | 'drive' | 'general' | 'family';
  created_by: string;
  visibility: 'private' | 'shared';
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  name: string;
  quantity: number;
  owner?: string;
  required: boolean;
  completed: boolean;
  trip_day_id?: string;
  note?: string;
  category?: string; // e.g. "车辆" | "衣物" | "亲子" | "药品" | "户外"
  source?: string; // e.g. "manual" | "trip" | "guide" | "template"
}

// Global DB Structure for our JSON engine
export interface AppDatabase {
  users: User[];
  passwords: Record<string, string>; // user_id -> bcrypt-hash (or simple hash for MVP)
  invites: InviteCode[];
  places: Place[];
  visits: Visit[];
  trips: Trip[];
  tripDays: TripDay[];
  tripItems: TripItem[];
  media: Media[];
  guides: Guide[];
  checklists: Checklist[];
  checklistItems: ChecklistItem[];
}

export const IMAGE_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'><rect width='800' height='500' fill='%23f1f5f9'/><path d='M350 200a40 40 0 1 1 80 0 40 40 0 0 1-80 0zm250 130H200l100-130 100 100 50-60z' fill='%23cbd5e1'/><text x='50%' y='75%' d='text' dominant-baseline='middle' text-anchor='middle' font-family='system-ui, sans-serif' font-size='24' font-weight='600' fill='%2394a3b8'>旅行足迹 · 精彩照片</text></svg>";
