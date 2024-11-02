import {
  ANIME,
  META,
  type IAnimeEpisode,
  type IAnimeInfo,
} from "@consumet/extensions";
import { getMal } from "./anime/malsync";
import { getAni } from "./anime/anizip";
import { getAnimeInfo } from "./anime/anilist";
import { sortKeysByValueLength } from "./utils";

interface Episode {
  title: string;
  number: number;
  id: string;
  season: number;
  isFiller: boolean;
  thumbnail: string;
  description: string;
  airDate: string;
  duration: number;
  rating: string;
}

interface Episodes {
  providerId: string;
  data: Episode[];
}

interface Artwork {
  type: string;
  providerId: string;
  image: string;
}

interface AnimeMapping extends Omit<IAnimeInfo, "episodes"> {
  episodes: Episodes[];
  mappings: {
    gogoanime?: string;
    zoro?: string;
    mal?: string;
    anilist?: string;
    [key: string]: unknown;
  };
}

// Cache instances to avoid repeated initialization
const anilist = new META.Anilist();
const gogoanime = new ANIME.Gogoanime("https://anitaku.pe");
const hianime = new ANIME.Zoro();

/**
 * Process episodes from different providers and combine with AniZip data
 */
const processEpisodes = (
  providerEpisodes: IAnimeEpisode[],
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  aniEpisodes: Record<number, any>,
  providerId: string
): Episodes => ({
  providerId,
  data: providerEpisodes
    .map((episode: IAnimeEpisode, index: number) => {
      const aniEpisode = aniEpisodes[index];
      if (!aniEpisode) return null;

      return {
        title: aniEpisode?.title || episode?.title || "Untitled Episode",
        number: episode?.number || index + 1,
        id: episode?.id || "0",
        season: aniEpisode?.season || 1,
        isFiller: episode?.isFiller || false,
        thumbnail: aniEpisode?.thumbnail || episode?.image || "",
        description:
          aniEpisode?.description || episode?.description || "No description",
        airDate: aniEpisode?.airDate || episode?.releaseDate || "",
        duration: aniEpisode?.duration || 0,
        rating: aniEpisode?.rating || "0",
      };
    })
    .filter((episode): episode is Episode => episode !== null),
});

/**
 * Process and normalize artwork data
 */
const processArtwork = (
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  aniArtworks: any[],
  infoArtwork: { img: string; type: string; providerId: string }[]
): Artwork[] => {
  try {
    return [
      ...aniArtworks.map((art) => ({
        type: art?.type?.toLowerCase() || "unknown",
        image: art?.image || "",
        providerId: "anizip",
      })),
      ...infoArtwork.map((art) => ({
        type: art?.type || "unknown",
        providerId: art?.providerId || "unknown_provider",
        image: art?.img || "",
      })),
    ];
  } catch (error) {
    return [] as Artwork[];
  }
};

/**
 * Extract provider IDs from MAL mappings
 */
const extractProviderIds = (
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  mal: any[]
): { gogoId: string | null; zoroId: string | null } => {
  const gogoMapping = mal.find((mapping) => mapping.providerId === "gogoanime");
  const zoroMapping = mal.find((mapping) => mapping.providerId === "zoro");

  return {
    gogoId: gogoMapping?.data?.id?.toString().split("/")[1] || null,
    zoroId: zoroMapping?.data?.id?.toString() || null,
  };
};

/**
 * Fetch anime information from different providers
 */
const fetchProviderInfo = async (
  gogoId: string | null,
  zoroId: string | null
): Promise<{ gogo: IAnimeInfo; zoro: IAnimeInfo }> => {
  const [gogo, zoro] = await Promise.all([
    gogoId
      ? gogoanime.fetchAnimeInfo(gogoId).catch(() => ({} as IAnimeInfo))
      : Promise.resolve({} as IAnimeInfo),
    zoroId
      ? hianime.fetchAnimeInfo(zoroId).catch(() => ({} as IAnimeInfo))
      : Promise.resolve({} as IAnimeInfo),
  ]);

  return { gogo, zoro };
};

/**
 * Main function to get anime mappings
 */
const getMappings = async (id: string): Promise<AnimeMapping | undefined> => {
  try {
    const [info, mal, ani] = await Promise.all([
      getAnimeInfo(Number(id)),
      getMal(id),
      getAni(id),
    ]);

    const { gogoId, zoroId } = extractProviderIds(mal);
    const { gogo, zoro } = await fetchProviderInfo(gogoId, zoroId);

    const genres = Array.from(
      new Set([
        ...(info?.genres ?? []),
        ...(gogo.genres ?? []),
        ...(zoro.genres ?? []),
      ])
    );
    const synonyms = Array.from(
      new Set([
        ...(info?.synonyms ?? []),
        ...(ani.synonyms ?? []),
        ...(gogo.synonyms ?? []),
        ...(zoro.synonyms ?? []),
      ])
    );

    const episodes: Episodes[] = [
      ...(Array.isArray(gogo.episodes) && gogo.episodes.length > 0
        ? [processEpisodes(gogo.episodes, ani.episodes, "gogoanime")]
        : []),
      ...(Array.isArray(zoro.episodes) && zoro.episodes.length > 0
        ? [processEpisodes(zoro.episodes, ani.episodes, "zoro")]
        : []),
    ];

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const artworks = processArtwork(ani.artworks ?? [], info?.artwork as any);

    const finalInfo = {
      ...info,
      genres,
      synonyms,
      episodes,
      bannerImage: ani.bannerImage ?? info?.bannerImage,
      coverImage: ani.coverImage ?? info?.coverImage,
      sliderImage: ani.sliderImage,
      artwork: artworks,
      mappings: {
        ...Object.fromEntries(
          (info?.mappings || []).map((mapping) => [
            mapping.providerId,
            mapping.id,
          ])
        ),
        gogoanime: gogoId || undefined,
        zoro: zoroId || undefined,
        mal: info?.idMal?.toString(),
        anilist: id,
        ...ani.mappings,
      },
    };

    return sortKeysByValueLength(finalInfo as AnimeMapping);
  } catch (error) {
    console.error(`Error fetching anime mappings for ID ${id}:`, error);
  }
};

export {
  getMappings,
  type AnimeMapping,
  type Episode,
  type Episodes,
  type Artwork,
};
