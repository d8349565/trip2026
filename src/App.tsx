/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Place, PlaceCategory, Trip, TripDay, TripItem, Guide, Checklist, ChecklistItem, Media, User, InviteCode, Visit } from './types';
import { api } from './api';

// Components
import MapContainer from './components/MapContainer';
import PlaceDetailPane from './components/PlaceDetailPane';
import TripPlanner from './components/TripPlanner';
import PhotosGallery from './components/PhotosGallery';
import ChecklistTracker from './components/ChecklistTracker';
import GuidesList from './components/GuidesList';
import SettingsPanel from './components/SettingsPanel';

// Mobile Remade Components
import { useResponsive } from './hooks/useResponsive';
import MobileBottomNav from './components/mobile/MobileBottomNav';
import MobileCreateSheet from './components/mobile/MobileCreateSheet';
import MobileProfilePage from './components/mobile/MobileProfilePage';
import MobilePlaceMiniCard from './components/mobile/MobilePlaceMiniCard';
import MobilePlaceDetailPage from './components/mobile/MobilePlaceDetailPage';
import MobileMapPage from './components/mobile/MobileMapPage';
import MobileTodayTripPage from './components/mobile/MobileTodayTripPage';
import MobileTripOverviewPage from './components/mobile/MobileTripOverviewPage';
import MobilePhotoTimeline from './components/mobile/MobilePhotoTimeline';
import MobilePhotoDetail from './components/mobile/MobilePhotoDetail';
import MobileChecklistPage from './components/mobile/MobileChecklistPage';
import MobileGuideListPage from './components/mobile/MobileGuideListPage';
import MobileGuideDetailPage from './components/mobile/MobileGuideDetailPage';
import MobileTripSelectorSheet from './components/mobile/MobileTripSelectorSheet';
import MobileDaySelectorSheet from './components/mobile/MobileDaySelectorSheet';
import MobileQuickVisitSheet from './components/mobile/MobileQuickVisitSheet';
import MobileAddPlaceToTripSheet from './components/mobile/MobileAddPlaceToTripSheet';
import MobileVisitListPage from './components/mobile/MobileVisitListPage';

// Icons
import { 
  Map, Calendar, Image as ImageIcon, CheckSquare, BookOpen, Settings, Heart, 
  Search, Star, MapPin, Plus, SlidersHorizontal, LogIn, Key, Compass, X, 
  Menu, Info, Eye, LogOut, Check, ArrowUpDown, ChevronDown, List, Pencil, Waves
} from 'lucide-react';

// Category color mappings
const CATEGORY_COLORS: Record<PlaceCategory, { bg: string; text: string; iconBg: string; border: string; ring: string }> = {
  stream: { bg: 'bg-[#e0f2fe]', text: 'text-[#0284c7]', iconBg: 'bg-[#0284c7]', border: 'border-[#bae6fd]', ring: 'ring-[#bae6fd]' },
  scenic: { bg: 'bg-[#f0fdf4]', text: 'text-[#16a34a]', iconBg: 'bg-[#16a34a]', border: 'border-[#bbf7d0]', ring: 'ring-[#bbf7d0]' },
  play: { bg: 'bg-[#fdf2f8]', text: 'text-[#db2777]', iconBg: 'bg-[#db2777]', border: 'border-[#fbcfe8]', ring: 'ring-[#fbcfe8]' },
  food: { bg: 'bg-[#fff7ed]', text: 'text-[#ea580c]', iconBg: 'bg-[#ea580c]', border: 'border-[#ffedd5]', ring: 'ring-[#ffedd5]' },
  accommodation: { bg: 'bg-[#f0f9ff]', text: 'text-[#0284c7]', iconBg: 'bg-[#0284c7]', border: 'border-[#e0f2fe]', ring: 'ring-[#e0f2fe]' },
  camp: { bg: 'bg-[#f0fdf4]', text: 'text-[#15803d]', iconBg: 'bg-[#15803d]', border: 'border-[#bbf7d0]', ring: 'ring-[#bbf7d0]' },
  parking: { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]', iconBg: 'bg-[#475569]', border: 'border-[#e2e8f0]', ring: 'ring-[#e2e8f0]' },
  hiking: { bg: 'bg-[#fffbeb]', text: 'text-[#d97706]', iconBg: 'bg-[#d97706]', border: 'border-[#fef3c7]', ring: 'ring-[#fef3c7]' },
  viewpoint: { bg: 'bg-[#faf5ff]', text: 'text-[#7c3aed]', iconBg: 'bg-[#7c3aed]', border: 'border-[#f3e8ff]', ring: 'ring-[#f3e8ff]' },
  family: { bg: 'bg-[#ecfdf5]', text: 'text-[#059669]', iconBg: 'bg-[#059669]', border: 'border-[#d1fae5]', ring: 'ring-[#d1fae5]' },
  charging: { bg: 'bg-[#f0fdfa]', text: 'text-[#0d9488]', iconBg: 'bg-[#0d9488]', border: 'border-[#ccfbf1]', ring: 'ring-[#ccfbf1]' },
  medical: { bg: 'bg-[#fef2f2]', text: 'text-[#dc2626]', iconBg: 'bg-[#dc2626]', border: 'border-[#fee2e2]', ring: 'ring-[#fee2e2]' },
};

const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  stream: '溯溪点',
  scenic: '景点',
  play: '游玩点',
  food: '美食',
  accommodation: '住宿',
  camp: '营地',
  parking: '停车/补给',
  hiking: '徒步点',
  viewpoint: '观景台',
  family: '亲子点',
  charging: '充电站',
  medical: '医疗/应急',
};

const CATEGORY_ICONS: Record<PlaceCategory, React.ReactNode> = {
  stream: <span>🌊</span>,
  scenic: <span>⛰️</span>,
  play: <span>🎡</span>,
  food: <span>🍲</span>,
  accommodation: <span>🛌</span>,
  camp: <span>⛺</span>,
  parking: <span>🅿️</span>,
  hiking: <span>🥾</span>,
  viewpoint: <span>🔭</span>,
  family: <span>👶</span>,
  charging: <span>⚡</span>,
  medical: <span>🚑</span>,
};

export default function App() {
  const { isMobile } = useResponsive();
  
  // Mobile Detailed Overlay States
  const [mobileSelectedPhoto, setMobileSelectedPhoto] = useState<Media | null>(null);
  const [mobileSelectedGuide, setMobileSelectedGuide] = useState<Guide | null>(null);
  const [mobileSelectedPlaceDetail, setMobileSelectedPlaceDetail] = useState<Place | null>(null);
  const [mobileTripTab, setMobileTripTab] = useState<'today' | 'manage'>('today');
  const [showMobileCreateSheet, setShowMobileCreateSheet] = useState(false);

  // Mobile active trip and active day selectors states with persistence
  const [activeTripId, setActiveTripId] = useState<string | null>(() => {
    return localStorage.getItem('activeTripId');
  });
  const [activeDayId, setActiveDayId] = useState<string | null>(null);

  // Mobile bottom sheet toggles
  const [showTripSelector, setShowTripSelector] = useState(false);
  const [showDaySelector, setShowDaySelector] = useState(false);
  const [showQuickVisit, setShowQuickVisit] = useState(false);
  const [mobileAddPlaceToTripTarget, setMobileAddPlaceToTripTarget] = useState<Place | null>(null);
  const [mobileProfileSubPage, setMobileProfileSubPage] = useState<'visits' | 'favorites' | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'trip' | 'photos' | 'checklist' | 'guide' | 'settings'>('map');

  // Database core state lists
  const [places, setPlaces] = useState<Place[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripDays, setTripDays] = useState<TripDay[]>([]);
  const [tripItems, setTripItems] = useState<TripItem[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);

  // Filtering states
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [isWetFilter, setIsWetFilter] = useState<boolean>(false);

  // Focus detail selected place state
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  // Active navigation states for deeper linkages
  const [activePhotoPlaceId, setActivePhotoPlaceId] = useState<string | null>(null);
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);

  // Priority trip/day selectors synchronization logic
  useEffect(() => {
    if (trips.length === 0) return;

    // Check if we already have a valid, cached activeTripId
    if (activeTripId && trips.some(t => t.id === activeTripId)) {
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Priority 1: Ongoing/in_progress trips
    let resolved = trips.find(t => t.status === 'ongoing' || (t.status as string) === 'in_progress');

    // Priority 2: Current date match
    if (!resolved) {
      resolved = trips.find(t => todayStr >= t.start_date && todayStr <= t.end_date);
    }

    // Priority 3: Upcoming trips
    if (!resolved) {
      resolved = trips.find(t => t.status === 'upcoming');
    }

    // Priority 4: First trip
    if (!resolved) {
      resolved = trips[0];
    }

    if (resolved) {
      setActiveTripId(resolved.id);
      localStorage.setItem('activeTripId', resolved.id);
    }
  }, [trips, activeTripId]);

  useEffect(() => {
    if (!activeTripId || tripDays.length === 0) {
      setActiveDayId(null);
      return;
    }

    const currentTripDays = tripDays.filter(d => d.trip_id === activeTripId).sort((a, b) => a.day_number - b.day_number);
    if (currentTripDays.length === 0) {
      setActiveDayId(null);
      return;
    }

    // Keep current selection if it belongs to active trip
    if (activeDayId && currentTripDays.some(d => d.id === activeDayId)) {
      return;
    }

    // Priority 1: Match today's date
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDay = currentTripDays.find(d => d.date === todayStr);

    if (todayDay) {
      setActiveDayId(todayDay.id);
    } else {
      // Priority 2: Default to first day
      setActiveDayId(currentTripDays[0].id);
    }
  }, [activeTripId, tripDays, activeDayId]);

  const handleSelectTrip = (tripId: string) => {
    setActiveTripId(tripId);
    localStorage.setItem('activeTripId', tripId);
    
    // Auto reset the active day for this newly selected trip
    const currentTripDays = tripDays.filter(d => d.trip_id === tripId).sort((a, b) => a.day_number - b.day_number);
    if (currentTripDays.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayDay = currentTripDays.find(d => d.date === todayStr);
      setActiveDayId(todayDay ? todayDay.id : currentTripDays[0].id);
    } else {
      setActiveDayId(null);
    }
  };

  const handleNavigateToView = (view: 'map' | 'trip' | 'photos' | 'checklist' | 'guide' | 'settings', id?: string) => {
    setViewMode(view);
    if (view === 'photos' && id) {
      setActivePhotoPlaceId(id);
    } else if (view === 'guide' && id) {
      setActiveGuideId(id);
    }
  };

  // Creation overlays
  const [mapEditorRequest, setMapEditorRequest] = useState(0);
  const [showPlaceManager, setShowPlaceManager] = useState(false);
  const [mapEditRequest, setMapEditRequest] = useState<{ token: number; place: Place } | null>(null);
  const [pendingPhotoDraft, setPendingPhotoDraft] = useState<{ token: number; mediaId: string; latitude?: number; longitude?: number; name?: string; address?: string } | null>(null);

  // Authentication overlays
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    // Initial auth & content fetch
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    try {
      const authRes = await api.getSessionUser();
      setCurrentUser(authRes.user);
      await reloadAllData(authRes.user);
    } catch (e) {
      setCurrentUser(null);
      setShowLoginModal(true);
    }
  };

  const reloadAllData = async (sessionUser: User | null = currentUser) => {
    try {
      const placesData = await api.getPlaces();
      setPlaces(placesData);

      const tripsData = await api.getTrips();
      setTrips(tripsData);

      // Fetch active trips details to load days & items
      if (tripsData.length > 0) {
        let allDays: TripDay[] = [];
        let allItems: TripItem[] = [];
        for (const t of tripsData) {
          const details = await api.getTripDetails(t.id);
          if (details.days) allDays = [...allDays, ...details.days];
          if (details.items) allItems = [...allItems, ...details.items];
        }
        setTripDays(allDays);
        setTripItems(allItems);
      }

      const mediaData = await api.getMedia();
      setMedia(mediaData);

      const guidesData = await api.getGuides();
      setGuides(guidesData);

      if (sessionUser?.role === 'admin') {
        const invitesData = await api.getInvites();
        setInvites(invitesData);
      } else {
        setInvites([]);
      }

      const checklistsData = await api.getChecklists();
      setChecklists(checklistsData);

      let allChecklistItems: ChecklistItem[] = [];
      for (const cl of checklistsData) {
        const details = await api.getChecklistDetails(cl.id);
        if (details.items) {
          allChecklistItems = [...allChecklistItems, ...details.items];
        }
      }
      setChecklistItems(allChecklistItems);

      const visitsData = await api.getVisits();
      setVisits(visitsData);

    } catch (e) {
      console.error('Error fetching dashboard data', e);
    }
  };

  // Filter computations
  const filteredPlaces = places.filter(p => {
    if (selectedCategory && p.category_id !== selectedCategory) return false;
    if (showFavoritesOnly && !p.favorite) return false;
    if (isWetFilter && !p.is_wet) return false;
    if (difficultyFilter && p.difficulty !== difficultyFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchAddress = p.address.toLowerCase().includes(q);
      const matchSummary = p.summary?.toLowerCase().includes(q) || false;
      return matchName || matchAddress || matchSummary;
    }
    return true;
  });

  // Action: Toggle favorites
  const handleToggleFavorite = async (id: string) => {
    try {
      const updated = await api.toggleFavorite(id);
      setPlaces(prev => prev.map(p => p.id === id ? updated : p));
      if (selectedPlace?.id === id) {
        setSelectedPlace(updated);
      }
    } catch (e) {
      alert('收藏状态更新失败');
    }
  };

  // Action: Toggle visited checkbox
  const handleToggleVisited = async (id: string) => {
    try {
      const updated = await api.toggleVisited(id);
      setPlaces(prev => prev.map(p => p.id === id ? updated : p));
      if (selectedPlace?.id === id) {
        setSelectedPlace(updated);
      }
    } catch (e) {
      alert('到访状态更新失败');
    }
  };

  // Action: Add place to trip itinerary day
  const handleAddToTrip = async (placeId: string, tripDayId: string, type: string, time: string, note: string) => {
    try {
      await api.addToTrip(placeId, { trip_day_id: tripDayId, type, start_time: time, note });
      await reloadAllData();
    } catch (e) {
      alert('加入日程失败');
    }
  };

  const handleCreatePlace = async (place: Partial<Place>) => {
    const created = await api.createPlace(place, currentUser?.id);
    setPlaces((current) => [...current, created]);
    setSelectedPlace(created);
    // A place created while a photo draft is pending links that photo to it.
    if (pendingPhotoDraft) {
      const draft = pendingPhotoDraft;
      setPendingPhotoDraft(null);
      try {
        await api.updateMedia(draft.mediaId, { place_id: created.id });
        setMedia((current) => current.map((item) => item.id === draft.mediaId ? { ...item, place_id: created.id } : item));
      } catch (error) {
        console.error('Failed to link photo to the new place', error);
      }
    }
    return created;
  };

  const handleUpdatePlace = async (id: string, place: Partial<Place>) => {
    const updated = await api.updatePlace(id, place);
    setPlaces((current) => current.map((item) => item.id === id ? updated : item));
    if (selectedPlace?.id === id) setSelectedPlace(updated);
    return updated;
  };

  const handleDeletePlace = async (id: string) => {
    const deleted = await api.deletePlace(id);
    if (!deleted) throw new Error('地点删除失败');
    setPlaces((current) => current.filter((item) => item.id !== id));
    if (selectedPlace?.id === id) setSelectedPlace(null);
  };

  // Auth Submit Actions
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      let authenticatedUser: User;
      if (isRegisterMode) {
        const res = await api.sessionRegister(loginUsername, loginPassword, inviteCode);
        authenticatedUser = res.user;
        setCurrentUser(res.user);
        alert('邀请码校验成功，注册并登录成功！');
      } else {
        const res = await api.sessionLogin(loginUsername, loginPassword);
        authenticatedUser = res.user;
        setCurrentUser(res.user);
      }
      setShowLoginModal(false);
      await reloadAllData(authenticatedUser);
    } catch (err: any) {
      setAuthError(err.message || '操作失败');
    }
  };

  const handleLogout = async () => {
    await api.logout().catch((error) => console.error('Logout request failed', error));
    setCurrentUser(null);
    setPlaces([]);
    setTrips([]);
    setMedia([]);
    setShowLoginModal(true);
    alert('已安全退出私有会话');
  };

  // Add Trip
  const handleCreateTrip = async (tripData: Partial<Trip>) => {
    try {
      await api.createTrip(tripData, currentUser?.id);
      await reloadAllData();
    } catch (e) {
      alert('行程创建失败');
    }
  };

  const handleDeleteTrip = async (id: string) => {
    if (confirm('确定要删除此条完整的行程路书吗？这会清除其下所有天数的任务项')) {
      try {
        await api.deleteTrip(id);
        await reloadAllData();
      } catch (e) {
        alert('删除失败');
      }
    }
  };

  // Add / Edit / Delete Trip Items
  const handleAddTripItem = async (dayId: string, itemData: Partial<TripItem>) => {
    try {
      await api.createTripItem(dayId, itemData);
      await reloadAllData();
    } catch (e) {
      alert('添加项目项失败');
    }
  };

  const handleUpdateTripItem = async (itemId: string, data: Partial<TripItem>) => {
    try {
      await api.updateTripItem(itemId, data);
      await reloadAllData();
    } catch (e) {
      alert('更新日程项目失败');
    }
  };

  const handleDeleteTripItem = async (itemId: string) => {
    try {
      await api.deleteTripItem(itemId);
      await reloadAllData();
    } catch (e) {
      alert('删除失败');
    }
  };

  const handleCreateVisit = async (visitData: any) => {
    try {
      // Server marks the place as visited for the current user; do not toggle again.
      const created = await api.createVisit(visitData);
      await reloadAllData();
      return created;
    } catch (e) {
      alert('到访记录打卡失败');
      throw e;
    }
  };

  const handleUpdateTripDay = async (dayId: string, data: Partial<TripDay>) => {
    try {
      await api.updateTripDay(dayId, data);
      await reloadAllData();
    } catch (e) {
      alert('日日程摘要更新失败');
    }
  };

  // Media
  const handleUploadMedia = async (data: any): Promise<Media | undefined> => {
    try {
      const created = await api.uploadMedia(data, currentUser?.id);
      await reloadAllData();
      return created;
    } catch (e) {
      alert(e instanceof Error && e.message ? e.message : '照片存储失败');
      return undefined;
    }
  };

  const handleCreatePlaceFromPhoto = (seed: { mediaId: string; latitude?: number; longitude?: number; name?: string; address?: string }) => {
    setPendingPhotoDraft({ token: Date.now(), ...seed });
    setSelectedPlace(null);
    setViewMode('map');
  };

  // 照片带 GPS 时：直接自动建一个地点标记并关联照片，不再要求用户手动确认。
  const handleAutoCreatePlaceFromPhoto = async (seed: { mediaId: string; latitude?: number; longitude?: number; name?: string; address?: string; category_id?: string }) => {
    if (!Number.isFinite(seed.latitude) || !Number.isFinite(seed.longitude)) return;
    try {
      const created = await api.createPlace({
        name: seed.name?.trim() || seed.address?.trim() || '照片拍摄点',
        category_id: (seed.category_id as any) || 'scenic',
        latitude: seed.latitude,
        longitude: seed.longitude,
        coordinate_system: 'GCJ02',
        address: seed.address ?? '',
        visibility: 'shared',
        status: 'visited',
        favorite: false,
        recommended: false,
      }, currentUser?.id);
      setPlaces((current) => [...current, created]);
      await api.updateMedia(seed.mediaId, { place_id: created.id });
      setMedia((current) => current.map((item) => item.id === seed.mediaId ? { ...item, place_id: created.id } : item));
      setViewMode('map');
      // 手机 GPS 常有几十米到上公里偏差：自动进编辑态，让用户拖动蓝色标记修正后再保存。
      requestPlaceEdit(created);
    } catch (error) {
      console.error('自动创建照片地点失败', error);
      // 兜底：自动建点失败时退回手动流程
      handleCreatePlaceFromPhoto(seed);
    }
  };

  const handleDeleteMedia = async (id: string) => {
    if (confirm('确认永久删除这张照片吗？此操作会同步清除本地存储文件。')) {
      try {
        await api.deleteMedia(id);
        await reloadAllData();
      } catch (e) {
        alert('删除失败');
      }
    }
  };

  const handleToggleFavoriteMedia = async (id: string, fav: boolean) => {
    try {
      await api.updateMedia(id, { favorite: fav });
      await reloadAllData();
    } catch (e) {
      alert('更新失败');
    }
  };

  // 设置某张照片为地点封面
  const handleSetCover = async (placeId: string, photoUrl: string) => {
    try {
      const updated = await api.updatePlace(placeId, { cover_image: photoUrl });
      setPlaces((current) => current.map((item) => item.id === placeId ? updated : item));
      if (selectedPlace?.id === placeId) setSelectedPlace(updated);
    } catch (e) {
      alert('设置封面失败');
    }
  };

  // Checklists
  const handleAddChecklistFromTemplate = async (title: string, tripId: string, templateType: string) => {
    try {
      await api.createChecklistFromTemplate({ title, trip_id: tripId || undefined, template_type: templateType }, currentUser?.id);
      await reloadAllData();
    } catch (e) {
      alert('导入失败');
    }
  };

  const handleAddChecklistItem = async (checklistId: string, name: string, quantity: number, owner: string, category?: string, source?: string) => {
    try {
      await api.createChecklistItem(checklistId, { name, quantity, owner, category, source });
      await reloadAllData();
    } catch (e) {
      alert('添加失败');
    }
  };

  const handleUpdateChecklistItem = async (itemId: string, data: any) => {
    try {
      await api.updateChecklistItem(itemId, data);
      await reloadAllData();
    } catch (e) {
      alert('更新失败');
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    try {
      await api.deleteChecklistItem(itemId);
      await reloadAllData();
    } catch (e) {
      alert('删除失败');
    }
  };

  // Guides
  const handleCreateGuide = async (guideData: Partial<Guide>) => {
    try {
      await api.createGuide(guideData, currentUser?.id);
      await reloadAllData();
    } catch (e) {
      alert('攻略保存失败');
    }
  };

  const handleUpdateGuide = async (id: string, guideData: Partial<Guide>) => {
    try {
      await api.updateGuide(id, guideData);
      await reloadAllData();
    } catch (e) {
      alert('修改失败');
    }
  };

  const handleDeleteGuide = async (id: string) => {
    try {
      await api.deleteGuide(id);
      await reloadAllData();
    } catch (e) {
      alert('删除失败');
    }
  };

  const handleGenerateInvite = async (code: string, maxUses: number, expiresAt: string) => {
    try {
      await api.createInvite({ code, max_uses: maxUses, expires_at: expiresAt }, currentUser?.id);
      await reloadAllData();
      alert('邀请码口令已成功注册至服务器');
    } catch (e) {
      alert('创建失败，口令可能冲突');
    }
  };

  const requestMapEditor = () => {
    setViewMode('map');
    setMapEditorRequest((current) => current + 1);
  };

  const requestPlaceEdit = (place: Place) => {
    setViewMode('map');
    setSelectedPlace(null);
    setMobileSelectedPlaceDetail(null);
    setMapEditRequest({ token: Date.now(), place });
  };

  if (isMobile) {
    // Determine active trip & day & items dynamically based on prioritized rules
    const activeTrip = trips.find(t => t.id === activeTripId) || null;
    const activeDays = activeTrip ? tripDays.filter(d => d.trip_id === activeTrip.id).sort((a, b) => a.day_number - b.day_number) : [];
    const activeDay = tripDays.find(d => d.id === activeDayId) || null;
    const todayItems = activeDay ? tripItems.filter(item => item.trip_day_id === activeDay.id).sort((a, b) => a.sort_order - b.sort_order) : [];

    return (
      <div className="h-screen w-screen flex flex-col bg-slate-50/50 overflow-hidden text-slate-800 relative font-sans select-none" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        
        {/* 1. Page Header (Conditional depending on active tab) */}
        {viewMode !== 'map' && (
          <header className="bg-white px-4.5 py-4 shrink-0 flex items-center justify-between border-b border-slate-100 shadow-sm z-20">
            <div className="flex items-center gap-2">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20 shrink-0">
                {viewMode === 'trip' && <Calendar size={16} />}
                {viewMode === 'photos' && <ImageIcon size={16} />}
                {viewMode === 'checklist' && <CheckSquare size={16} />}
                {viewMode === 'guide' && <BookOpen size={16} />}
                {viewMode === 'settings' && <Settings size={16} />}
              </div>
              <div>
                <h1 className="font-extrabold text-[15px] tracking-tight text-slate-900 leading-tight">
                  {viewMode === 'trip' && '旅行日程'}
                  {viewMode === 'photos' && '照片'}
                  {viewMode === 'checklist' && '清单'}
                  {viewMode === 'guide' && '攻略'}
                  {viewMode === 'settings' && '我的'}
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5 font-semibold leading-none">
                  {viewMode === 'trip' && (activeTrip ? activeTrip.title : '点击下方 + 创建行程')}
                  {viewMode === 'photos' && `${media.length} 张`}
                  {viewMode === 'checklist' && `${checklists.length} 个清单`}
                  {viewMode === 'guide' && `${guides.length} 篇`}
                  {viewMode === 'settings' && '本地存储'}
                </p>
              </div>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl outline-none active:scale-95 transition-all"
              >
                {currentUser ? currentUser.username : '私人登录'}
              </button>
            </div>
          </header>
        )}

        {/* 2. Main Page Body (Natural scroll & padded properly) */}
        <div className="flex-1 overflow-y-auto px-4 py-4 relative">
          {viewMode === 'map' && (
            <div className="absolute inset-0 w-full h-full">
              <MobileMapPage
                places={places}
                media={media}
                selectedPlace={selectedPlace}
                onSelectPlace={setSelectedPlace}
                onViewPlaceDetails={(p) => setMobileSelectedPlaceDetail(p)}
                onCreatePlace={handleCreatePlace}
                onUpdatePlace={handleUpdatePlace}
                onDeletePlace={handleDeletePlace}
                onRequestEditor={requestMapEditor}
                editorRequest={mapEditorRequest}
                editRequest={mapEditRequest}
                photoDraft={pendingPhotoDraft}
                onPhotoDraftEnd={() => setPendingPhotoDraft(null)}
                onToggleFavorite={handleToggleFavorite}
                onAddToTrip={(placeId) => {
                  const p = places.find(item => item.id === placeId);
                  if (p) {
                    setMobileAddPlaceToTripTarget(p);
                  }
                }}
                categoryColors={CATEGORY_COLORS}
                categoryLabels={CATEGORY_LABELS}
                categoryIcons={CATEGORY_ICONS}
              />
            </div>
          )}

          {viewMode === 'trip' && (
            <div className="space-y-4">
              {/* Trip tab sub-switcher: 今日 vs 编排 */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  id="m_trip_tab_today"
                  onClick={() => setMobileTripTab('today')}
                  className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                    mobileTripTab === 'today' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  今日行程
                </button>
                <button
                  id="m_trip_tab_manage"
                  onClick={() => setMobileTripTab('manage')}
                  className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                    mobileTripTab === 'manage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  行程规划
                </button>
              </div>

              {mobileTripTab === 'today' ? (
                <MobileTodayTripPage
                  activeTrip={activeTrip}
                  activeDay={activeDay}
                  items={todayItems}
                  places={places}
                  onUpdateItemStatus={(itemId, status) => handleUpdateTripItem(itemId, { status })}
                  onNavigateToPlace={(placeId) => {
                    const p = places.find(item => item.id === placeId);
                    if (p) {
                      setSelectedPlace(p);
                      setViewMode('map');
                    }
                  }}
                  onOpenTripSelector={() => setShowTripSelector(true)}
                  onOpenDaySelector={() => setShowDaySelector(true)}
                  allDays={activeDays}
                />
              ) : (
                <MobileTripOverviewPage
                  trips={trips}
                  allDays={tripDays}
                  allItems={tripItems}
                  places={places}
                  activeTrip={activeTrip}
                  onSelectTrip={handleSelectTrip}
                  onDeleteTrip={handleDeleteTrip}
                  onCreateTrip={handleCreateTrip}
                  onUpdateTripDay={handleUpdateTripDay}
                  onAddTripItem={handleAddTripItem}
                  onDeleteTripItem={handleDeleteTripItem}
                />
              )}
            </div>
          )}

          {viewMode === 'photos' && (
            <MobilePhotoTimeline
              media={media}
              places={places}
              onUploadPhoto={handleUploadMedia}
              onDeletePhoto={handleDeleteMedia}
              onToggleFavorite={handleToggleFavoriteMedia}
              onSelectPhoto={(photo) => setMobileSelectedPhoto(photo)}
              onCreatePlaceFromPhoto={handleCreatePlaceFromPhoto}
              onAutoCreatePlaceFromPhoto={handleAutoCreatePlaceFromPhoto}
            />
          )}

          {viewMode === 'checklist' && (
            <MobileChecklistPage
              checklists={checklists}
              checklistItems={checklistItems}
              trips={trips}
              onAddChecklistFromTemplate={handleAddChecklistFromTemplate}
              onAddChecklistItem={handleAddChecklistItem}
              onUpdateChecklistItem={handleUpdateChecklistItem}
            />
          )}

          {viewMode === 'guide' && (
            <MobileGuideListPage
              guides={guides}
              places={places}
              onSelectGuide={(g) => setMobileSelectedGuide(g)}
              onCreateGuide={handleCreateGuide}
            />
          )}

          {viewMode === 'settings' && (
            <MobileProfilePage
              currentUser={currentUser}
              places={places}
              checklists={checklists}
              guides={guides}
              visits={visits}
              media={media}
              invites={invites}
              onLogout={handleLogout}
              onLoginClick={() => setShowLoginModal(true)}
              onNavigateToView={handleNavigateToView}
              onGenerateInvite={handleGenerateInvite}
              onOpenSubPage={(sub) => setMobileProfileSubPage(sub)}
            />
          )}
        </div>

        {/* 3. Mobile Bottom Navigation Bar (Fixed bottom) */}
        <div className="fixed bottom-0 inset-x-0 z-40">
          <MobileBottomNav
            currentView={viewMode === 'settings' ? 'profile' : viewMode}
            onViewChange={(tab) => {
              if (tab === 'profile') {
                setViewMode('settings');
              } else {
                setViewMode(tab);
              }
              setSelectedPlace(null);
            }}
            onOpenCreate={() => setShowMobileCreateSheet(true)}
          />
        </div>

        {/* 4. Immersive Overlays (Modals on top of mobile navigation) */}
        
        {/* Place details overlay */}
        {mobileSelectedPlaceDetail && (
          <MobilePlaceDetailPage
            place={mobileSelectedPlaceDetail}
            trips={trips}
            tripDays={tripDays}
            media={media.filter(m => m.place_id === mobileSelectedPlaceDetail.id)}
            visits={visits.filter(v => v.place_id === mobileSelectedPlaceDetail.id)}
            guides={guides.filter(g => g.target_id === mobileSelectedPlaceDetail.id)}
            onBack={() => setMobileSelectedPlaceDetail(null)}
            onToggleFavorite={handleToggleFavorite}
            onAddToTrip={handleAddToTrip}
            onUploadPhoto={handleUploadMedia}
            onCreateVisit={handleCreateVisit}
            onEditPlace={requestPlaceEdit}
            categoryColors={CATEGORY_COLORS}
            categoryLabels={CATEGORY_LABELS}
            categoryIcons={CATEGORY_ICONS}
            onNavigateToTrip={() => {
              setViewMode('trip');
              setMobileTripTab('today');
              setMobileSelectedPlaceDetail(null);
            }}
          />
        )}

        {/* Immersive Photo Viewer */}
        {mobileSelectedPhoto && (
          <MobilePhotoDetail
            photo={mobileSelectedPhoto}
            places={places}
            onClose={() => setMobileSelectedPhoto(null)}
            onDelete={handleDeleteMedia}
            onToggleFavorite={handleToggleFavoriteMedia}
          />
        )}

        {/* Immersive Guide Markdown Reader */}
        {mobileSelectedGuide && (
          <MobileGuideDetailPage
            guide={mobileSelectedGuide}
            places={places}
            trips={trips}
            onClose={() => setMobileSelectedGuide(null)}
            onSelectPlaceOnMap={(placeId) => {
              const p = places.find(item => item.id === placeId);
              if (p) {
                setSelectedPlace(p);
                setViewMode('map');
              }
            }}
            onAddPlaceToTrip={(placeId) => {
              const p = places.find(item => item.id === placeId);
              if (p) {
                setMobileAddPlaceToTripTarget(p);
              }
            }}
            onDeleteGuide={handleDeleteGuide}
            onUpdateGuide={handleUpdateGuide}
          />
        )}

        {/* Central Plus Create Sheet menu */}
        {showMobileCreateSheet && (
          <MobileCreateSheet
            isOpen={showMobileCreateSheet}
            onClose={() => setShowMobileCreateSheet(false)}
            onAction={(action) => {
              setShowMobileCreateSheet(false);
              if (action === 'add_place') {
                requestMapEditor();
              } else if (action === 'log_visit') {
                setShowQuickVisit(true);
              } else if (action === 'create_trip') {
                setViewMode('trip');
                setMobileTripTab('manage');
              } else if (action === 'upload_photo') {
                setViewMode('photos');
              } else if (action === 'create_checklist') {
                setViewMode('checklist');
              } else if (action === 'create_guide') {
                setViewMode('guide');
              }
            }}
          />
        )}

        {/* Trip Selector Sheet */}
        <MobileTripSelectorSheet
          isOpen={showTripSelector}
          onClose={() => setShowTripSelector(false)}
          trips={trips}
          tripDays={tripDays}
          activeTripId={activeTripId}
          onSelectTrip={(id) => {
            handleSelectTrip(id);
            setShowTripSelector(false);
          }}
        />

        {/* Day Selector Sheet */}
        <MobileDaySelectorSheet
          isOpen={showDaySelector}
          onClose={() => setShowDaySelector(false)}
          days={activeDays}
          allItems={tripItems}
          activeDayId={activeDayId}
          onSelectDay={(id) => {
            setActiveDayId(id);
            setShowDaySelector(false);
          }}
        />

        {/* Quick Visit Sheet */}
        <MobileQuickVisitSheet
          isOpen={showQuickVisit}
          onClose={() => setShowQuickVisit(false)}
          places={places}
          trips={trips}
          tripDays={tripDays}
          activeTrip={activeTrip}
          activeDay={activeDay}
          onCreateVisit={handleCreateVisit}
        />

        {/* Add Place To Trip Sheet */}
        {mobileAddPlaceToTripTarget && (
          <MobileAddPlaceToTripSheet
            isOpen={!!mobileAddPlaceToTripTarget}
            onClose={() => setMobileAddPlaceToTripTarget(null)}
            place={mobileAddPlaceToTripTarget}
            trips={trips}
            tripDays={tripDays}
            onAddToTrip={async (placeId, data) => {
              await handleAddToTrip(placeId, data.trip_day_id, data.type, data.start_time, data.note);
            }}
            onNavigateToTrip={() => {
              setViewMode('trip');
              setMobileTripTab('today');
            }}
          />
        )}

        {/* Immersive Visit List SubPage */}
        {mobileProfileSubPage === 'visits' && (
          <MobileVisitListPage
            visits={visits}
            places={places}
            trips={trips}
            onBack={() => setMobileProfileSubPage(null)}
            onNavigateToPlaceDetail={(p) => {
              setMobileSelectedPlaceDetail(p);
            }}
          />
        )}

        {showLoginModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-800 text-xs">{isRegisterMode ? '🔐 受邀注册新成员' : '🔑 成员安全登录'}</h4>
                <button onClick={() => { setAuthError(''); setShowLoginModal(false); }} className="p-1 rounded-full bg-slate-100 text-slate-500"><X size={15} /></button>
              </div>

              {authError && <p className="text-[10px] font-bold text-red-600 bg-red-50 p-2 rounded-lg">{authError}</p>}

              <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-black text-slate-400">用户名</label>
                  <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400">密码</label>
                  <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
                </div>
                {isRegisterMode && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400">专属邀请码</label>
                    <input type="text" placeholder="从主管理员处获取邀请码" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" required />
                  </div>
                )}
                <button type="submit" className="w-full py-2 bg-blue-600 text-white font-bold rounded-xl">{isRegisterMode ? '确认注册' : '立即验证'}</button>
                <button type="button" onClick={() => setIsRegisterMode(!isRegisterMode)} className="w-full text-[10px] text-blue-500 font-bold hover:underline text-center block mt-1">
                  {isRegisterMode ? '已有账户？去登录' : '没有账户？使用邀请注册'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#f8fafc] overflow-hidden text-slate-800">
      
      {/* -------------------- 1. SIDEBAR (DESKTOP) -------------------- */}
      {!isMobile && (
        <aside className="w-64 bg-white border-r border-slate-100 flex flex-col justify-between shrink-0 h-full p-5 shadow-[4px_0_12px_rgba(0,0,0,0.02)] z-30">
          <div className="space-y-6">
            {/* Logo Header */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20">
                <Compass size={22} className="animate-spin-slow" />
              </div>
              <div>
                <h1 className="font-extrabold text-sm tracking-tight text-slate-900 leading-none">旅行足迹</h1>
                <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">探索世界 · 记录美好</p>
              </div>
            </div>

            {/* Navigation links matching Screenshot 2 */}
            <nav className="space-y-1">
              <button
                onClick={() => setViewMode('map')}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all ${
                  viewMode === 'map'
                    ? 'bg-blue-50 text-blue-600 font-extrabold shadow-sm ring-1 ring-blue-500/10'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Map size={16} />
                <span>地图标记</span>
              </button>

              <button
                onClick={() => setViewMode('trip')}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all ${
                  viewMode === 'trip'
                    ? 'bg-blue-50 text-blue-600 font-extrabold shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Calendar size={16} />
                <span>行程规划</span>
              </button>

              <button
                onClick={() => setViewMode('photos')}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all ${
                  viewMode === 'photos'
                    ? 'bg-blue-50 text-blue-600 font-extrabold shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <ImageIcon size={16} />
                <span>照片足迹</span>
              </button>

              <button
                onClick={() => setViewMode('checklist')}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all ${
                  viewMode === 'checklist'
                    ? 'bg-blue-50 text-blue-600 font-extrabold shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <CheckSquare size={16} />
                <span>清单整理</span>
              </button>

              <button
                onClick={() => setViewMode('guide')}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all ${
                  viewMode === 'guide'
                    ? 'bg-blue-50 text-blue-600 font-extrabold shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <BookOpen size={16} />
                <span>攻略经验</span>
              </button>
            </nav>

            {/* Sidebar Stats Box matching mockup 2 */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold border-b border-slate-200/50 pb-1.5">
                <span>📊 存量归档统计</span>
                <span className="text-[9px] text-slate-400">实时数据</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-[10px] text-slate-500 font-medium">
                <div>
                  <p className="text-slate-400">已标记地点</p>
                  <p className="text-xs font-black text-slate-800 mt-0.5">{places.length} 个 ⬆</p>
                </div>
                <div>
                  <p className="text-slate-400">行程规划</p>
                  <p className="text-xs font-black text-slate-800 mt-0.5">{trips.length} 条</p>
                </div>
                <div>
                  <p className="text-slate-400">已归类照片</p>
                  <p className="text-xs font-black text-slate-800 mt-0.5">{media.length} 张</p>
                </div>
                <div>
                  <p className="text-slate-400">攻略文章</p>
                  <p className="text-xs font-black text-slate-800 mt-0.5">{guides.length} 篇</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom user section */}
          <div className="space-y-2 pt-4 border-t border-slate-100">
            {currentUser ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                    {currentUser.username[0]}
                  </div>
                  <div className="truncate flex-1">
                    <p className="text-xs font-bold text-slate-700 leading-tight">{currentUser.username}</p>
                    <p className="text-[9px] text-slate-400 font-semibold">{currentUser.role === 'admin' ? '主管理员' : '成员'}</p>
                  </div>
                </div>

                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => setViewMode('settings')}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                      viewMode === 'settings' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Settings size={14} />
                    <span>系统维护</span>
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 rounded-lg hover:bg-red-50 text-red-500 text-xs font-bold flex items-center gap-2 transition-colors"
                >
                  <LogOut size={14} />
                  <span>退出私有登录</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <LogIn size={14} />
                <span>邀请注册 / 私人登录</span>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* -------------------- 2. MAIN WORKSPACE AREA -------------------- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* MOBILE TOP NAVIGATION BAR matching mockup 1 */}
        {isMobile && (
          <header className="bg-white border-b border-slate-100 p-4 shrink-0 space-y-3.5 shadow-sm z-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                  <Compass size={16} />
                </div>
                <div>
                  <h1 className="font-extrabold text-xs tracking-tight text-slate-900 leading-none">旅行足迹</h1>
                  <p className="text-[9px] text-slate-400 mt-1 font-semibold">发现好地方 · 记录美好行程</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                  title="用户登录"
                >
                  <Key size={16} />
                </button>
                {currentUser?.role === 'admin' && (
                  <button 
                    onClick={() => setViewMode('settings')}
                    className="p-1.5 text-slate-400 hover:text-slate-600"
                    title="设置"
                  >
                    <Settings size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Top Sub-navigation pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                  viewMode === 'map' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Map size={13} />
                <span>地图</span>
              </button>
              <button
                onClick={() => setViewMode('trip')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                  viewMode === 'trip' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Calendar size={13} />
                <span>行程</span>
              </button>
              <button
                onClick={() => setViewMode('photos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                  viewMode === 'photos' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <ImageIcon size={13} />
                <span>照片</span>
              </button>
              <button
                onClick={() => setViewMode('checklist')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                  viewMode === 'checklist' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <CheckSquare size={13} />
                <span>清单</span>
              </button>
              <button
                onClick={() => setViewMode('guide')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                  viewMode === 'guide' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <BookOpen size={13} />
                <span>攻略</span>
              </button>
            </div>
          </header>
        )}

        {/* TOP FILTER & HEADER STRIP (DESKTOP) */}
        {!isMobile && viewMode === 'map' && (
          <header className="bg-white/90 backdrop-blur border-b border-slate-200/70 px-4 py-2.5 shrink-0 flex items-center gap-2 z-10">
            {/* 搜索 */}
            <div className="relative flex-1 max-w-sm min-w-44">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="搜索地点、城市、关键词..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-slate-100/80 border border-transparent rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-colors"
              />
            </div>

            <div className="w-px h-5 bg-slate-200 shrink-0" />

            {/* 难度筛选 */}
            <div className="relative shrink-0">
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="appearance-none h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 outline-none cursor-pointer hover:border-slate-300 focus:border-blue-500 transition-colors"
              >
                <option value="">难度不限</option>
                <option value="easy">轻松徒步</option>
                <option value="moderate">中等溯溪</option>
                <option value="hard">硬核穿越</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* 快捷开关 */}
            <button
              onClick={() => setIsWetFilter(prev => !prev)}
              title="避暑涉水"
              className={`h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center transition-all ${
                isWetFilter
                  ? 'bg-cyan-50 border-cyan-300 text-cyan-600 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-cyan-600 hover:border-cyan-200'
              }`}
            >
              <Waves size={15} />
            </button>
            <button
              onClick={() => setShowFavoritesOnly(prev => !prev)}
              title="精选收藏"
              className={`h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center transition-all ${
                showFavoritesOnly
                  ? 'bg-amber-50 border-amber-300 text-amber-500 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-200'
              }`}
            >
              <Star size={15} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
            </button>

            {/* 主操作：打开地点管理抽屉 */}
            <button
              onClick={() => setShowPlaceManager(true)}
              className="h-9 px-3.5 ml-auto shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-600/20 transition-all"
            >
              <List size={14} />
              <span>录入 / 管理地点</span>
              <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-extrabold leading-none">{places.length}</span>
            </button>

            {/* Right side user indicator */}
            {currentUser && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shadow-inner">
                  {currentUser.username[0].toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-700">{currentUser.username}</span>
              </div>
            )}
          </header>
        )}

        {/* CATEGORY BAR (FOR MAP VIEW) */}
        {viewMode === 'map' && (
          <div className="relative shrink-0 bg-white border-b border-slate-200/70 z-10">
            <div className="px-4 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setSelectedCategory('')}
                className={`h-7 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  !selectedCategory
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                全部
              </button>

              {/* 分类筛选：未选中保持安静，选中用分类自己的颜色 */}
              {(Object.keys(CATEGORY_LABELS) as PlaceCategory[]).map(cat => {
                const isActive = selectedCategory === cat;
                const colorConfig = CATEGORY_COLORS[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(isActive ? '' : cat)}
                    className={`h-7 pl-2 pr-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                      isActive
                        ? `${colorConfig.bg} ${colorConfig.text} ring-1 ring-inset ${colorConfig.ring} shadow-sm`
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colorConfig.iconBg} ${isActive ? '' : 'opacity-50'}`} />
                    <span>{CATEGORY_LABELS[cat]}</span>
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent" />
          </div>
        )}

        {/* 地点管理抽屉（桌面端）：替代原先被裁剪的下拉小面板 */}
        {!isMobile && showPlaceManager && (
          <div className="absolute inset-0 z-40">
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px] animate-fade-in" onClick={() => setShowPlaceManager(false)} />
            <aside className="absolute right-0 top-0 bottom-0 w-[340px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-slide-in-right">
              <div className="px-4 pt-4 pb-3 border-b border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-extrabold text-slate-800">地点管理</h2>
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-extrabold text-slate-500">{places.length}</span>
                  </div>
                  <button
                    onClick={() => setShowPlaceManager(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="关闭"
                  >
                    <X size={16} />
                  </button>
                </div>
                <button
                  onClick={() => { setShowPlaceManager(false); requestMapEditor(); }}
                  className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/20 transition-colors"
                >
                  <Plus size={14} />
                  <span>新增地点</span>
                </button>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="筛选地点..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 bg-slate-100/80 border border-transparent rounded-lg text-xs focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-colors"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {filteredPlaces.length === 0 ? (
                  <p className="px-2 py-10 text-center text-xs text-slate-400">
                    {places.length === 0 ? '还没有地点，点上方「新增地点」在地图上标记。' : '没有匹配的地点。'}
                  </p>
                ) : (
                  filteredPlaces.map((place) => {
                    const colorConfig = CATEGORY_COLORS[place.category_id];
                    return (
                      <div key={place.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50 transition-colors">
                        <button
                          onClick={() => { setShowPlaceManager(false); setSelectedPlace(place); setViewMode('map'); }}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${colorConfig?.bg ?? 'bg-slate-100'}`}>
                            {CATEGORY_ICONS[place.category_id] ?? '📍'}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold text-slate-800">{place.name}</span>
                            <span className="block truncate text-[10px] text-slate-400 mt-0.5">
                              {CATEGORY_LABELS[place.category_id] ?? '地点'}{place.address ? ` · ${place.address}` : ''}
                            </span>
                          </span>
                        </button>
                        <button
                          onClick={() => { setShowPlaceManager(false); requestPlaceEdit(place); }}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          title="编辑地点"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          </div>
        )}

        {/* -------------------- 3. CENTER VIEW CONTROLLER -------------------- */}
        <div className="flex-1 p-4 overflow-hidden relative">
          
          {viewMode === 'map' && (
            <div className="w-full h-full flex flex-col lg:flex-row gap-4 overflow-hidden relative">
              {/* Left Map Box */}
              <div className="flex-1 h-full relative">
                <MapContainer 
                  places={filteredPlaces}
                  media={media}
                  selectedPlace={selectedPlace}
                  onSelectPlace={(p) => setSelectedPlace(p)}
                  onCreatePlace={handleCreatePlace}
                  onUpdatePlace={handleUpdatePlace}
                  onDeletePlace={handleDeletePlace}
                  editorRequest={mapEditorRequest}
                  editRequest={mapEditRequest}
                  photoDraft={pendingPhotoDraft}
                  onPhotoDraftEnd={() => setPendingPhotoDraft(null)}
                  categoryColors={CATEGORY_COLORS}
                  categoryLabels={CATEGORY_LABELS}
                  categoryIcons={CATEGORY_ICONS}
                />
              </div>

              {/* Right detail overlay (Desktop) or sliding card (Mobile) */}
              {!isMobile && selectedPlace && (
                <div className="w-96 h-full border border-slate-100 rounded-2xl overflow-hidden shrink-0 shadow-lg bg-white">
                  <PlaceDetailPane 
                    place={selectedPlace}
                    trips={trips}
                    tripDays={tripDays}
                    tripItems={tripItems}
                    media={media}
                    guides={guides}
                    visits={visits}
                    onClose={() => setSelectedPlace(null)}
                    onToggleFavorite={handleToggleFavorite}
                    onToggleVisited={handleToggleVisited}
                    onAddToTrip={handleAddToTrip}
                    categoryColors={CATEGORY_COLORS}
                    categoryLabels={CATEGORY_LABELS}
                    onNavigateToView={handleNavigateToView}
                    onCreateVisit={handleCreateVisit}
                    onCreateGuide={handleCreateGuide}
                    onUploadPhoto={handleUploadMedia}
                    onEditPlace={requestPlaceEdit}
                    onSetCover={handleSetCover}
                  />
                </div>
              )}
            </div>
          )}

          {viewMode === 'trip' && (
            <div className="w-full h-full overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <TripPlanner 
                trips={trips}
                tripDays={tripDays}
                tripItems={tripItems}
                places={places}
                checklists={checklists}
                checklistItems={checklistItems}
                media={media}
                visits={visits}
                onCreateTrip={handleCreateTrip}
                onDeleteTrip={handleDeleteTrip}
                onUpdateTripItem={handleUpdateTripItem}
                onAddTripItem={handleAddTripItem}
                onDeleteTripItem={handleDeleteTripItem}
                onUpdateTripDay={handleUpdateTripDay}
              />
            </div>
          )}

          {viewMode === 'photos' && (
            <div className="w-full h-full overflow-y-auto bg-white rounded-2xl border border-slate-100 p-6 shadow-sm scrollbar-thin">
              <PhotosGallery
                media={media}
                places={places}
                trips={trips}
                onUploadMedia={handleUploadMedia}
                onDeleteMedia={handleDeleteMedia}
                onToggleFavoriteMedia={handleToggleFavoriteMedia}
                onCreatePlaceFromPhoto={handleCreatePlaceFromPhoto}
                onAutoCreatePlaceFromPhoto={handleAutoCreatePlaceFromPhoto}
                initialSelectedPlaceId={activePhotoPlaceId}
              />
            </div>
          )}

          {viewMode === 'checklist' && (
            <div className="w-full h-full overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <ChecklistTracker 
                checklists={checklists}
                checklistItems={checklistItems}
                trips={trips}
                onAddChecklistFromTemplate={handleAddChecklistFromTemplate}
                onAddChecklistItem={handleAddChecklistItem}
                onUpdateChecklistItem={handleUpdateChecklistItem}
                onDeleteChecklistItem={handleDeleteChecklistItem}
              />
            </div>
          )}

          {viewMode === 'guide' && (
            <div className="w-full h-full overflow-hidden">
              <GuidesList 
                guides={guides}
                places={places}
                trips={trips}
                tripDays={tripDays}
                tripItems={tripItems}
                onCreateGuide={handleCreateGuide}
                onDeleteGuide={handleDeleteGuide}
                onUpdateGuide={handleUpdateGuide}
                selectedGuideId={activeGuideId}
                onSelectGuideId={setActiveGuideId}
                onNavigateToView={handleNavigateToView}
              />
            </div>
          )}

          {viewMode === 'settings' && (
            <div className="w-full h-full overflow-y-auto bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <SettingsPanel 
                invites={invites}
                onGenerateInvite={handleGenerateInvite}
              />
            </div>
          )}

        </div>

        {/* MOBILE BOTTOM DETAIL SHEET SLIDER matching mockup 1 */}
        {isMobile && viewMode === 'map' && selectedPlace && (
          <div className="absolute inset-x-0 bottom-0 bg-white border-t border-slate-150 rounded-t-3xl shadow-2xl z-40 max-h-[80vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200">
            {/* Drag Handle top bar */}
            <div className="py-2.5 flex items-center justify-center shrink-0 border-b border-slate-100">
              <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
            </div>
            
            <div className="flex-1 overflow-y-auto pb-4">
              <PlaceDetailPane 
                place={selectedPlace}
                trips={trips}
                tripDays={tripDays}
                tripItems={tripItems}
                media={media}
                guides={guides}
                visits={visits}
                onClose={() => setSelectedPlace(null)}
                onToggleFavorite={handleToggleFavorite}
                onToggleVisited={handleToggleVisited}
                onAddToTrip={handleAddToTrip}
                categoryColors={CATEGORY_COLORS}
                categoryLabels={CATEGORY_LABELS}
                onNavigateToView={handleNavigateToView}
                onCreateVisit={handleCreateVisit}
                onCreateGuide={handleCreateGuide}
                onUploadPhoto={handleUploadMedia}
                onEditPlace={requestPlaceEdit}
                onSetCover={handleSetCover}
              />
            </div>
          </div>
        )}

        {/* MOBILE NAVIGATION BAR TABS (SCREEN 1 FOOTER) */}
        {isMobile && (
          <nav className="bg-white border-t border-slate-100 shrink-0 p-3 flex justify-around items-center text-[10px] text-slate-400 font-bold z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
            <button 
              onClick={() => { setViewMode('map'); setSelectedPlace(null); }}
              className={`flex flex-col items-center gap-1 ${viewMode === 'map' ? 'text-blue-600' : ''}`}
            >
              <Map size={18} />
              <span>地图</span>
            </button>
            <button 
              onClick={() => setViewMode('trip')}
              className={`flex flex-col items-center gap-1 ${viewMode === 'trip' ? 'text-blue-600' : ''}`}
            >
              <Calendar size={18} />
              <span>行程</span>
            </button>
            
            {/* Floating add action button (+) */}
            <button 
              onClick={requestMapEditor}
              className="w-11 h-11 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25 -translate-y-3 shrink-0 active:scale-95 transition-all"
            >
              <Plus size={20} strokeWidth={3} />
            </button>

            <button 
              onClick={() => setViewMode('photos')}
              className={`flex flex-col items-center gap-1 ${viewMode === 'photos' ? 'text-blue-600' : ''}`}
            >
              <ImageIcon size={18} />
              <span>照片</span>
            </button>
            <button 
              onClick={() => setViewMode('settings')}
              className={`flex flex-col items-center gap-1 ${viewMode === 'settings' ? 'text-blue-600' : ''}`}
            >
              <Settings size={18} />
              <span>我的</span>
            </button>
          </nav>
        )}
      </main>

      {/* -------------------- 4. GLOBAL POPOVER DIALOGS -------------------- */}

      {/* LOGIN & REGISTER BY INVITE MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-800 text-sm">
                {isRegisterMode ? '🔐 受邀注册新成员' : '🔑 成员安全口令登录'}
              </h4>
              <button 
                onClick={() => {
                  setAuthError('');
                  setShowLoginModal(false);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            {authError && (
              <div className="p-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangleIcon size={14} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-0.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">用户名</label>
                <input 
                  type="text" 
                  placeholder="输入您的成员名"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  required
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">访问密码</label>
                <input 
                  type="password" 
                  placeholder="安全授权密码"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  required
                />
              </div>

              {isRegisterMode && (
                <div className="space-y-0.5 animate-in slide-in-from-top-1 duration-100">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">专属邀请授权口令</label>
                  <input 
                    type="text" 
                    placeholder="请输入管理员分发的受邀码"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-blue-600 font-bold"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700"
              >
                {isRegisterMode ? '确认受邀注册并登录' : '立即验证登录'}
              </button>

              <div className="pt-2 text-center text-[11px] text-slate-400 font-bold">
                {isRegisterMode ? (
                  <span>
                    已有私有账户？
                    <button type="button" onClick={() => { setAuthError(''); setIsRegisterMode(false); }} className="text-blue-500 hover:underline">
                      立即登录
                    </button>
                  </span>
                ) : (
                  <span>
                    尚未加入团队？
                    <button type="button" onClick={() => { setAuthError(''); setIsRegisterMode(true); }} className="text-blue-500 hover:underline">
                      受邀成员注册
                    </button>
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Helpers
function AlertTriangleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
