import anisync from "../request";

const infoQuery = `query ($id: Int) {
  Media(id: $id) {
    id
    idMal
    title {
      romaji
      english
      native
    }
    format
    status
    startDate {
      year
      month
      day
    }
    endDate {
      year
      month
      day
    }
    studios(isMain: true) {
      nodes {
        name
      }
    }
    genres
    averageScore
    episodes
  }
}`;

interface AnimeTitle {
  romaji: string;
  english: string;
  native: string;
}

interface Date {
  year: number;
  month: number;
  day: number;
}

interface Studio {
  name: string;
}

interface Media {
  idMal: number;
  id: number;
  title: AnimeTitle;
  format: string;
  status: string;
  startDate: Date;
  endDate: Date;
  studios: {
    nodes: Studio[];
  };
  genres: string[];
  averageScore: number;
  episodes: number;
}

interface AnimeInfoResponse {
  data: {
    Media: Media;
  };
}

export interface Title {
  native: string | null;
  romaji: string | null;
  english: string | null;
}

interface Mapping {
  id: string;
  providerId: string;
  similarity: number;
  providerType: "ANIFY" | "MANGA" | "META" | "INFORMATION";
}

interface Rating {
  mal: number | null;
  tvdb: number | null;
  kitsu: number | null;
  anilist: number | null;
  anidb: number | null;
  tmdb: number | null;
  comick: number | null;
  mangadex: number | null;
  novelupdates: number | null;
}

interface Popularity {
  mal: number | null;
  tvdb: number | null;
  kitsu: number | null;
  anilist: number | null;
  anidb: number | null;
  tmdb: number | null;
  comick: number | null;
  mangadex: number | null;
  novelupdates: number | null;
}

interface CoverImage {
  large: string;
}

interface RelationData {
  id: number;
  type: "ANIFY" | "MANGA";
  title: {
    userPreferred: string;
  };
  format:
    | "TV"
    | "TV_SHORT"
    | "MOVIE"
    | "SPECIAL"
    | "OVA"
    | "ONA"
    | "MUSIC"
    | "MANGA"
    | "NOVEL"
    | "ONE_SHOT"
    | "UNKNOWN";
  status:
    | "FINISHED"
    | "RELEASING"
    | "NOT_YET_RELEASED"
    | "CANCELLED"
    | "HIATUS";
  coverImage: CoverImage;
  bannerImage: string | null;
}

interface Relation {
  id: number;
  data: RelationData;
  type:
    | "ADAPTATION"
    | "PREQUEL"
    | "SEQUEL"
    | "PARENT"
    | "SIDE_STORY"
    | "CHARACTER"
    | "SUMMARY"
    | "ALTERNATIVE"
    | "SPIN_OFF"
    | "OTHER"
    | "SOURCE"
    | "COMPILATION"
    | "CONTAINS";
}

interface Character {
  name: string;
  image: string;
  voiceActor: {
    name: string;
    image: string;
  };
}

interface Episode {
  id: string;
  img: string | null;
  title: string;
  hasDub: boolean;
  description: string | null;
  rating: number | null;
  number: number;
  isFiller: boolean;
  updatedAt: number;
}

interface EpisodeData {
  episodes: Episode[];
  providerId: string;
}

interface Episodes {
  latest: {
    updatedAt: number;
    latestTitle: string;
    latestEpisode: number;
  };
  data: EpisodeData[];
}

interface Chapter {
  id: string;
  title: string;
  number: number;
  rating: number | null;
  updatedAt: number;
  mixdrop: string | null;
}

interface ChapterData {
  chapters: Chapter[];
  providerId: string;
}

interface Chapters {
  latest: {
    updatedAt: number;
    latestTitle: string;
    latestChapter: number;
  };
  data: ChapterData[];
}

interface Artwork {
  img: string;
  type: "banner" | "poster" | "clear_logo" | "top_banner";
  providerId: string;
}

interface Anify {
  id: string;
  slug: string;
  coverImage: string;
  bannerImage: string;
  trailer: string | null;
  status:
    | "FINISHED"
    | "RELEASING"
    | "NOT_YET_RELEASED"
    | "CANCELLED"
    | "HIATUS";
  season: "SUMMER" | "FALL" | "WINTER" | "SPRING";
  title: Title;
  currentEpisode: number | null;
  mappings: Mapping[];
  synonyms: string[];
  countryOfOrigin: string;
  description: string;
  duration: number | null;
  color: string | null;
  year: number | null;
  rating: Rating;
  popularity: Popularity;
  type: "ANIFY" | "MANGA";
  format:
    | "TV"
    | "TV_SHORT"
    | "MOVIE"
    | "SPECIAL"
    | "OVA"
    | "ONA"
    | "MUSIC"
    | "MANGA"
    | "NOVEL"
    | "ONE_SHOT"
    | "UNKNOWN";
  relations: Relation[];
  characters: Character[];
  totalEpisodes: number | null;
  totalVolumes: number | null;
  totalChapters: number | null;
  genres: string[];
  tags: string[];
  episodes: Episodes;
  chapters: Chapters;
  averageRating: number;
  averagePopularity: number;
  artwork: Artwork[];
  relationType: string;
}

// @ts-expect-error
export interface IAnimeInfo extends Media, Anify {}

export async function getAnimeInfo(id: number): Promise<IAnimeInfo | null> {
  try {
    const [anilistResponse, anifyResponse] = await Promise.all([
      anisync
        .post<AnimeInfoResponse>("https://graphql.anilist.co", {
          query: infoQuery,
          variables: { id },
        })
        .catch((error) => {
          console.error("AniList Error:", (error as Error).message);
          return null;
        }),
      anisync.get<Anify>(`https://anify.eltik.cc/info/${id}`).catch((error) => {
        console.error("Anify Error:", (error as Error).message);
        return null;
      }),
    ]);

    const anilistData = anilistResponse?.data.data.Media;
    const anifyData = anifyResponse?.data;

    const animeInfo: IAnimeInfo = {
      ...anilistData,
      ...anifyData,
      status: anilistData?.status ?? anifyData?.status ?? "",
      title: {
        ...anilistData?.title,
        romaji: anifyData?.title.romaji ?? anilistData?.title.romaji ?? "",
        english: anifyData?.title.english ?? anilistData?.title.english ?? "",
        native: anifyData?.title.native ?? anilistData?.title.native ?? "",
      },
      genres: [
        ...new Set([
          ...(anilistData?.genres ?? []),
          ...(anifyData?.genres ?? []),
        ]),
      ],
      episodes: anifyData?.totalEpisodes ?? anilistData?.episodes ?? 0,
      // @ts-expect-error
      studios: anilistData.studios.nodes.map(
        (studio) => studio.name
      ) as string[],
    };

    return animeInfo;
  } catch (error) {
    console.error("Failed to fetch anime info:", (error as Error).message);
    return null;
  }
}
