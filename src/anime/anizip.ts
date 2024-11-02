import anisync from "../request";

interface Title {
  "x-jat": string;
  "zh-Hans": string;
  ja: string;
  en: string;
  ru: string;
  th: string;
}
enum CoverType {
  Poster = "Poster",
  Banner = "Banner",
  Fanart = "Fanart",
  ClearLogo = "Clearlogo",
}

interface EpisodeTitle {
  ja: string;
  en: string;
  "x-jat": string;
}

interface Episode {
  tvdbShowId: number;
  tvdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  absoluteEpisodeNumber: number;
  title: EpisodeTitle;
  airDate: string;
  airDateUtc: string;
  runtime: number;
  overview: string;
  image: string;
  episode: string;
  anidbEid: number;
  length: number;
  airdate: string;
  rating: string;
  summary?: string;
}

interface Episodes {
  [key: string]: Episode;
}

interface Image {
  coverType: string;
  url: string;
}

interface Mapping {
  animeplanet_id: string;
  kitsu_id: number;
  mal_id: number;
  type: string;
  anilist_id: number;
  anisearch_id: number;
  anidb_id: number;
  notifymoe_id: string;
  livechart_id: number;
  thetvdb_id: number;
  imdb_id: string;
  themoviedb_id: string;
}

interface SeriesData {
  titles: Title;
  episodes: Episodes;
  episodeCount: number;
  specialCount: number;
  images: Image[];
  mappings: Mapping;
}

interface EpisodeModified {
  title: string;
  number: number;
  id: string;
  season: number;
  thumbnail: string;
  description: string;
  airDate: string;
  duration: number;
  rating: string;
}

interface Artwork {
  type: string;
  image: string;
}

interface Anizip {
  id: string;
  title: string;
  synonyms: string[];
  coverImage: string | null;
  bannerImage: string | null;
  sliderImage: string | null;
  artworks: Artwork[];
  episodes: EpisodeModified[];
  mappings: Mapping;
}

const getEpisodeTitle = (episode: Episode): string => {
  return (
    episode?.title?.en ||
    episode?.title?.["x-jat"] ||
    episode?.title?.ja ||
    "Unknown Title"
  );
};

const findArtworkByType = (
  artworks: Artwork[],
  type: string
): string | null => {
  return artworks?.find((artwork) => artwork.type === type)?.image || null;
};

export const getAni = async (id: string): Promise<Anizip> => {
  try {
    const { data } = await anisync.get<SeriesData>(
      `https://api.ani.zip/mappings?anilist_id=${id}`
    );

    const artworks: Artwork[] =
      (data?.images || []).map((image) => ({
        type: image?.coverType || "Unknown",
        image: image?.url || "",
      })) || [];

    const synonyms = Object.values(data?.titles || {}) || [];

    const episodes: EpisodeModified[] =
      Object.values(data?.episodes || {}).map((episode, index) => ({
        id: String(episode?.tvdbId || "0"),
        title: getEpisodeTitle(episode),
        thumbnail: episode?.image || "",
        duration: episode?.runtime || 0,
        description:
          episode?.summary || episode?.overview || "No description available",
        number: episode?.episodeNumber || index + 1,
        season: episode?.seasonNumber || 1,
        airDate: episode?.airDateUtc || "",
        rating: episode?.rating || "Unrated",
      })) || [];

    return {
      id,
      title: synonyms[0] || "Unknown Title",
      synonyms,
      coverImage: findArtworkByType(artworks, CoverType.Poster),
      bannerImage: findArtworkByType(artworks, CoverType.Banner),
      sliderImage: findArtworkByType(artworks, CoverType.Fanart),
      episodes,
      artworks,
      mappings: data?.mappings || {},
    };
  } catch (error) {
    console.log(
      "There was an error fetching anizip data",
      (error as Error).message
    );

    return {
      id,
      title: "Unknown Title",
      synonyms: [],
      coverImage: null,
      bannerImage: null,
      sliderImage: null,
      episodes: [],
      artworks: [],
      mappings: {} as Mapping,
    };
  }
};
