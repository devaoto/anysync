import mongoose from "mongoose";
import { Redis } from "ioredis";
import { deleteAllAnime, getAllAnime, getAnime, insertAnime } from "./db";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";
import { getMappings, type AnimeMapping } from "./mappings";
import { createLogger, format, transports } from "winston";
import Anime from "./db"; // Anime model

export const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({ filename: "server.log" }),
  ],
});

// Error handler to log uncaught exceptions or rejections
logger.exceptions.handle(new transports.File({ filename: "exceptions.log" }));

logger.info("Starting server...");
// Databases initialization
const redis = new Redis({
  password: process.env.REDIS_PASSWORD,
  host: process.env.REDIS_HOST,
});
await mongoose.connect(process.env.DATABASE_URL as string);
logger.info("Connected to databases (Redis, MongoDB)");

redis.on("error", (error) => {
  console.dir(error);
});

// CACHING
const CACHE_DURATION = {
  TEMPORARY: 60 * 60, // 1 hour
  PERMANENT: 30 * 24 * 60 * 60, // 30 days
};

const CACHE_PREFIX = "ani:";

const getCacheKey = (id: string) => `${CACHE_PREFIX}${id}`;

async function getCachedAnime(id: string) {
  try {
    const cachedData = await redis.get(getCacheKey(id));
    return cachedData ? JSON.parse(cachedData) : null;
  } catch (error) {
    logger.error(`Redis get error: ${(error as Error).message}`);
    return null;
  }
}

async function setCachedAnime<T extends AnimeMapping>(id: string, data: T) {
  try {
    const isCompleted = ["FINISHED", "RELEASED", "CANCELLED"].includes(
      data.status
    );
    const duration = isCompleted
      ? CACHE_DURATION.PERMANENT
      : CACHE_DURATION.TEMPORARY;

    await redis.setex(getCacheKey(id), duration, JSON.stringify(data));
  } catch (error) {
    logger.error(`Redis set error: ${(error as Error).message}`);
  }
}

logger.info("Initializing Hono server...");
const app = new Hono();
app.use(cors());
app.use(prettyJSON());

app.get("/", async (ctx) =>
  ctx.json({
    message: "API is working.",
    totalAnime: (await getAllAnime()).length,
  })
);

app.get("/info/:id", async (ctx) => {
  const id = ctx.req.param("id");
  try {
    if (!id) {
      throw new HTTPException(400, { message: "No ID provided." });
    }

    const cachedData = await getCachedAnime(id);
    if (cachedData) {
      return ctx.json(cachedData);
    }

    const anime = await getAnime(id).catch(() => null);

    if (!anime) {
      logger.info(
        `Anime ${id} not found in database, trying to get mappings...`
      );
      const mappings = await getMappings(id);

      if (mappings) {
        logger.info(`Mappings found for ${id}`);
        await setCachedAnime(id, mappings);

        if (
          mappings.status === "FINISHED" ||
          mappings.status === "RELEASED" ||
          mappings.status === "CANCELLED"
        ) {
          logger.info(`Inserting mappings for ${id}`);
          await insertAnime(mappings);
        }
        return ctx.json(mappings);
      }

      throw new HTTPException(404, { message: "Anime not found." });
    }

    await setCachedAnime(id, anime);
    return ctx.json(anime);
  } catch (error) {
    logger.error(
      `An error occurred on server with ${id}: `,
      (error as Error).message
    );
    throw new HTTPException(500, { message: (error as Error).message });
  }
});
async function searchAnime(ctx: Context) {
  const query = ctx.req.query();

  interface Filter {
    tags?: {
      $in: string[];
    };
    genres?: {
      $in: string[];
    };
    id?: string;
    idMal?: string;
    status?: string;
    season?: string;
    format?: string;
    "startDate.year"?: number;
    rating?: {
      $gte: number;
    };
    color?: string;
    synonyms?: {
      $regex: string;
      $options: string;
    };
    duration?: {
      $lte: number;
    };
    totalEpisodes?: {
      $gte: number;
    };
    sort?: string;
    page?: string;
    limit?: string;
  }

  const filter: Filter = {};

  if (query.tags) filter.tags = { $in: query.tags.split(",") };
  if (query.genres) filter.genres = { $in: query.genres.split(",") };
  if (query.id) filter.id = query.id;
  if (query.idMal) filter.idMal = query.idMal;
  if (query.status) filter.status = query.status;
  if (query.season) filter.season = query.season;
  if (query.format) filter.format = query.format;
  if (query.year) filter["startDate.year"] = Number(query.year);
  if (query.rating) filter.rating = { $gte: Number(query.rating) };
  if (query.color) filter.color = query.color;
  if (query.synonym) filter.synonyms = { $regex: query.synonym, $options: "i" };
  if (query.duration) filter.duration = { $lte: Number(query.duration) };
  if (query.totalEpisodes)
    filter.totalEpisodes = { $gte: Number(query.totalEpisodes) };

  const sortField =
    query.sort?.replace("_asc", "").replace("_desc", "") || "popularity";
  const sortOrder = query.sort?.includes("_desc") ? -1 : 1;

  const page = Number(query.page || "1");
  const limit = Number(query.limit || "10");
  const skip = (page - 1) * limit;

  const animeList = await Anime.find(filter)
    .sort({ [sortField]: sortOrder })
    .skip(skip)
    .limit(limit);

  const totalAnime = await Anime.countDocuments(filter);

  return ctx.json({
    page,
    limit,
    totalAnime,
    results: animeList,
  });
}

app.get("/search", searchAnime);

app.get("/delete_all", async (ctx) => {
  const secret = ctx.req.query("secret");

  if (!secret) {
    throw new HTTPException(400, { message: "No secret provided." });
  }

  if (secret === process.env.SECRET_KEY) {
    await deleteAllAnime();
    return ctx.json({ message: "All anime deleted." });
  }

  throw new HTTPException(401, { message: "Invalid secret." });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await redis.quit();
  await mongoose.disconnect();
  process.exit(0);
});

export default {
  fetch: app.fetch,
  port: process.env.PORT ?? 6969,
};

logger.info(`Server started on port ${process.env.PORT ?? 6969}`);
