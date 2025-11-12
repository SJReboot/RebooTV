import { Playlist, Category, Channel, EpgEntry, VODItem, VODCategory, Season, Episode, WatchHistory } from '../models/iptv.models';

// --- MOCK DATA GENERATION ---

// Helper to get dates for EPG
const getEpgTime = (offsetMinutes: number, durationMinutes: number): { start: string, end: string } => {
  const now = new Date();
  const startTime = new Date(now.getTime() + offsetMinutes * 60 * 1000);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  return { start: startTime.toISOString(), end: endTime.toISOString() };
};

// --- PLAYLISTS ---
export const MOCK_PLAYLISTS: Playlist[] = [
  {
    id: 1,
    name: 'PrimeStreams HD',
    url: 'http://primestreams.tv:826/player_api.php',
    type: 'xtream',
    isActive: true,
    status: 'active',
    username: 'Kinna1',
    password: '***',
    maxConnections: 3,
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Backup M3U',
    url: 'http://backup.provider/playlist.m3u',
    type: 'm3u',
    isActive: false,
    status: 'inactive',
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    name: 'Stalker Portal VIP',
    url: 'http://stalker-portal.net/c/',
    type: 'stalker',
    isActive: true,
    status: 'active',
    macAddress: '00:1A:79:AB:CD:EF',
    lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    name: 'Free World M3U',
    url: 'http://freeworld.tv/list.m3u',
    type: 'm3u',
    isActive: false,
    status: 'error',
    errorMessage: 'Failed to download playlist: Connection timed out.',
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 5,
    name: 'Sports Central',
    url: 'http://sportscentral.live:80/player_api.php',
    type: 'xtream',
    isActive: true,
    status: 'active',
    username: 'user-sports',
    password: '***',
    maxConnections: 1,
    expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdated: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
];

// --- CATEGORIES ---
export const MOCK_CATEGORIES: Category[] = [
  { id: 1, playlistId: 1, name: 'USA Entertainment', isHidden: false },
  { id: 2, playlistId: 1, name: 'UK News', isHidden: false },
  { id: 3, playlistId: 1, name: 'Sports', isHidden: false },
  { id: 4, playlistId: 1, name: 'Movies', isHidden: false },
  { id: 5, playlistId: 1, name: 'Kids', isHidden: false },
  { id: 6, playlistId: 1, name: 'Documentaries', isHidden: false },
  { id: 7, playlistId: 1, name: 'Music', isHidden: false },
  { id: 8, playlistId: 1, name: 'International', isHidden: true },
];

// --- CHANNELS ---
export const MOCK_CHANNELS: Channel[] = Array.from({ length: 150 }, (_, i) => {
  const categoryId = (i % 8) + 1;
  const category = MOCK_CATEGORIES.find(c => c.id === categoryId)!;
  const epg: EpgEntry[] = [
    { id: i * 3, title: 'Morning News', startTime: getEpgTime(-30, 60).start, endTime: getEpgTime(-30, 60).end, description: 'Live morning news coverage.' },
    { id: i * 3 + 1, title: 'The Mid-day Show', startTime: getEpgTime(30, 90).start, endTime: getEpgTime(30, 90).end, description: 'Talk show with celebrity guests.' },
    { id: i * 3 + 2, title: 'Evening Movie', startTime: getEpgTime(120, 120).start, endTime: getEpgTime(120, 120).end, description: 'Tonight\'s feature film.' },
  ];

  return {
    id: i + 1,
    playlistId: 1,
    name: `${category.name} Channel ${i + 1}`,
    logoUrl: `https://picsum.photos/seed/${i + 1}/64/64`,
    streamUrl: `http://mockstream.tv/live/${i + 1}.m3u8`,
    epg,
    category: category.name,
    categoryId,
    isFavorite: i % 10 === 0,
    isHidden: false,
  };
});


// --- VOD ---
export const MOCK_MOVIE_CATEGORIES: VODCategory[] = [
    { id: 'action', name: 'Action' },
    { id: 'comedy', name: 'Comedy' },
    { id: 'drama', name: 'Drama' },
    { id: 'scifi', name: 'Sci-Fi' },
    { id: 'thriller', name: 'Thriller' },
];

export const MOCK_SERIES_CATEGORIES: VODCategory[] = [
    { id: 'crime', name: 'Crime' },
    { id: 'sitcom', name: 'Sitcom' },
    { id: 'fantasy', name: 'Fantasy' },
    { id: 'animated', name: 'Animated' },
];

export const MOCK_MOVIES: VODItem[] = Array.from({ length: 120 }, (_, i) => ({
  id: 1000 + i,
  playlistId: 1,
  title: `Epic Movie Adventure ${i + 1}`,
  streamUrl: `http://mockstream.tv/movie/${1000 + i}.mp4`,
  imageUrl: `https://picsum.photos/seed/movie${i}/200/300`,
  type: 'movie',
  description: `An epic description for movie adventure number ${i + 1}. A journey of a thousand miles begins with a single step.`,
  releaseYear: 2023 - (i % 20),
  genres: [MOCK_MOVIE_CATEGORIES[i % MOCK_MOVIE_CATEGORIES.length].name],
  duration: 7200 + (i * 60), // 2 hours +
  isFavorite: i % 15 === 0,
  isOnWatchlist: i % 7 === 0,
}));

export const MOCK_SERIES: VODItem[] = Array.from({ length: 40 }, (_, i) => ({
  id: 2000 + i,
  playlistId: 1,
  title: `Gripping Series Chronicle ${i + 1}`,
  streamUrl: ``, // Series itself doesn't have a stream URL
  imageUrl: `https://picsum.photos/seed/series${i}/200/300`,
  type: 'series',
  description: `A gripping chronicle for series number ${i + 1}. Full of twists and turns that will keep you on the edge of your seat.`,
  releaseYear: 2024 - (i % 10),
  genres: [MOCK_SERIES_CATEGORIES[i % MOCK_SERIES_CATEGORIES.length].name],
  isFavorite: i % 8 === 0,
  isOnWatchlist: i % 5 === 0,
}));

export const MOCK_SEASONS_AND_EPISODES: Record<number, Season[]> = MOCK_SERIES.reduce((acc, series) => {
    acc[series.id] = Array.from({ length: Math.ceil(Math.random() * 5) + 1 }, (_, i) => {
        const seasonNumber = i + 1;
        const episodes: Episode[] = Array.from({ length: Math.ceil(Math.random() * 12) + 8 }, (_, j) => ({
            id: series.id * 1000 + seasonNumber * 100 + j + 1,
            seriesId: series.id,
            seasonNumber: seasonNumber,
            episodeNumber: j + 1,
            title: `Episode ${j + 1}: The Adventure Begins`,
            description: `The exciting description for Season ${seasonNumber}, Episode ${j + 1}.`,
            imageUrl: `https://picsum.photos/seed/ep${series.id}${seasonNumber}${j}/160/90`,
            streamUrl: `http://mockstream.tv/series/${series.id}/${seasonNumber}/${j+1}.mp4`,
            duration: 1800 + (j * 10) // ~30 mins
        }));
        return {
            id: series.id * 100 + seasonNumber,
            seriesId: series.id,
            seasonNumber: seasonNumber,
            episodes
        };
    });
    return acc;
}, {} as Record<number, Season[]>);

export const MOCK_WATCH_HISTORY: Record<string, WatchHistory> = {
    'movie-1001': { id: 'movie-1001', lastPlayedPosition: 3600, isFinished: false, watchedAt: new Date().toISOString() },
    'movie-1005': { id: 'movie-1005', lastPlayedPosition: 8000, isFinished: true, watchedAt: new Date().toISOString() },
};