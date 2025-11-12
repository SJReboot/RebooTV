export interface Playlist {
  id: number;
  name: string;
  url: string;
  type: 'xtream' | 'm3u' | 'stalker';
  isActive: boolean;
  status: 'active' | 'inactive' | 'loading' | 'error';
  errorMessage?: string;
  username?: string;
  password?: string;
  macAddress?: string;
  maxConnections?: number;
  expirationDate?: string | null;
  lastUpdated?: string;
}

export interface EpgEntry {
  id: number;
  title: string;
  description?: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
}

export interface Channel {
  id: number;
  playlistId: number;
  name: string;
  logoUrl: string;
  streamUrl: string;
  epg: EpgEntry[];
  category: string;
  categoryId: number;
  isFavorite: boolean;
  isHidden: boolean;
}

export interface Category {
  id: number;
  playlistId: number;
  name: string;
  isHidden: boolean;
}

export interface VODItem {
  id: number;
  playlistId: number;
  title: string;
  streamUrl: string;
  imageUrl: string;
  type: 'movie' | 'series';
  description?: string;
  releaseYear?: number;
  genres: string[];
  duration?: number; // in seconds
  isFavorite: boolean;
  isOnWatchlist: boolean;
}

export interface Episode {
  id: number;
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  description?: string;
  imageUrl: string;
  streamUrl: string;
  duration?: number; // in seconds
}

export interface Season {
    id: number;
    seriesId: number;
    seasonNumber: number;
    episodes: Episode[];
}

export interface VODCategory {
  id: string; // Can be just the name
  name: string;
}

export interface WatchHistory {
    id: string; // composite key like 'movie-123' or 'episode-456'
    lastPlayedPosition: number; // in seconds
    isFinished: boolean;
    watchedAt: string; // ISO date string
}

export interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
  total: number;
}
