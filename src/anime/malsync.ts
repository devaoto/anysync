import anisync from "../request";

interface Anime {
  id: number;
  type: string;
  title: string;
  url: string;
  total: number;
  image: string;
  malId: number;
  Sites: {
    [key: string]: Provider;
  };
}

interface Provider {
  [identifier: string]: SiteDetails;
}

interface SiteDetails {
  identifier: string | number;
  image: string;
  malId: number;
  aniId: number;
  page: string;
  title: string;
  type: string;
  url: string;
  external?: boolean;
}

interface ProviderData {
  id: string | number;
  coverImage: string;
  idMal: number;
  idAni: number;
  page: string;
  title: string;
  url: string;
}

interface AnimeMapping {
  providerId: string;
  data: ProviderData;
}

const getIdentifierFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.slice(1) || "unknown";
  } catch {
    return url || "unknown";
  }
};

export const getMal = async (id: string): Promise<AnimeMapping[]> => {
  try {
    const res = await anisync.get<Anime>(
      `https://api.malsync.moe/mal/anime/anilist:${id}`
    );

    const data = res?.data;
    if (!data) {
      console.warn("No data returned from API");
      return [];
    }

    const mappings: AnimeMapping[] = [];

    for (const siteKey in data.Sites || {}) {
      const site = (data.Sites[siteKey] as Provider) || {};

      for (const identifier in site) {
        const siteDetails = site[identifier];

        mappings.push({
          providerId: siteKey?.toLowerCase() || "unknown_provider",
          data: {
            id: getIdentifierFromUrl(siteDetails?.url || ""),
            coverImage: siteDetails?.image || "",
            idMal: siteDetails?.malId || 0,
            idAni: siteDetails?.aniId || 0,
            page: siteDetails?.page || "",
            title: siteDetails?.title || "Unknown Title",
            url: siteDetails?.url || "",
          },
        });
      }
    }

    return mappings;
  } catch (error) {
    console.error(`Error fetching malsync: ${(error as Error).message}`);
    return [];
  }
};
