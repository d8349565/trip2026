import type { PlaceCategory } from '../types';

/**
 * 地点分类的轻量元数据，供照片上传等场景的分类选择器使用。
 * App.tsx 里的 CATEGORY_ICONS/CATEGORY_LABELS/CATEGORY_COLORS 用于地图渲染，
 * 这里是纯字符串版本，避免在组件间传递 React 节点。
 */
export interface CategoryMeta {
  id: PlaceCategory;
  label: string;
  emoji: string;
}

export const CATEGORY_OPTIONS: CategoryMeta[] = [
  { id: 'scenic', label: '景点', emoji: '⛰️' },
  { id: 'stream', label: '溯溪点', emoji: '🌊' },
  { id: 'hiking', label: '徒步点', emoji: '🥾' },
  { id: 'camp', label: '营地', emoji: '⛺' },
  { id: 'play', label: '游玩点', emoji: '🎡' },
  { id: 'viewpoint', label: '观景台', emoji: '🔭' },
  { id: 'family', label: '亲子点', emoji: '👶' },
  { id: 'food', label: '美食', emoji: '🍲' },
  { id: 'accommodation', label: '住宿', emoji: '🛌' },
  { id: 'parking', label: '停车/补给', emoji: '🅿️' },
  { id: 'charging', label: '充电站', emoji: '⚡' },
  { id: 'medical', label: '医疗/应急', emoji: '🚑' },
];
