import mongoose, { Schema, Types, type Document } from "mongoose";
import type { ITitle, FuzzyDate } from "@consumet/extensions";
import type { AnimeMapping, Episodes, Artwork } from "./mappings";

// Sub-schemas
const TitleSchema = new Schema<ITitle>({
  romaji: String,
  english: String,
  native: String,
  userPreferred: String,
});

const FuzzyDateSchema = new Schema<FuzzyDate>({
  year: Number,
  month: Number,
  day: Number,
});

const EpisodeSchema = new Schema({
  title: String,
  number: Number,
  id: { type: String, required: true },
  season: Number,
  isFiller: Boolean,
  thumbnail: String,
  description: String,
  airDate: String,
  duration: Number,
  rating: String,
});

const EpisodesSchema = new Schema<Episodes>({
  providerId: { type: String, required: true },
  data: [EpisodeSchema],
});

const ArtworkSchema = new Schema<Artwork>({
  type: { type: String, required: true },
  providerId: { type: String, required: true },
  image: { type: String, required: true },
});

// Main Anime Schema
const AnimeSchema = new Schema<AnimeMapping>({
  id: { type: String, required: true, unique: true },
  title: { type: TitleSchema, required: true },
  url: String,
  image: String,
  imageHash: String,
  cover: String,
  coverHash: String,
  status: {
    type: String,
    default: "UNKNOWN",
  },
  rating: Schema.Types.Mixed,
  type: {
    type: String,
  },
  releaseDate: String,
  malId: { type: Schema.Types.Mixed },
  genres: [String],
  description: String,
  totalEpisodes: Number,
  hasSub: Boolean,
  hasDub: Boolean,
  synonyms: [String],
  countryOfOrigin: String,
  isAdult: Boolean,
  isLicensed: Boolean,
  season: String,
  studios: [String],
  color: String,
  trailer: String,
  episodes: [EpisodesSchema],
  startDate: FuzzyDateSchema,
  endDate: FuzzyDateSchema,
  recommendations: [
    {
      type: Schema.Types.Mixed,
    },
  ],
  relations: [
    {
      type: Schema.Types.Mixed,
    },
  ],
  mappings: {
    type: Schema.Types.Mixed,
    default: {},
  },
});

// Create Model
const AnimeModel = mongoose.model<AnimeMapping & Document>(
  "Anime",
  AnimeSchema
);

// CRUD Functions

/**
 * Insert a new anime into the database
 * @param animeData AnimeMapping data to insert
 * @returns Promise with the inserted anime document
 */
export async function insertAnime(animeData: AnimeMapping) {
  try {
    const newAnime = new AnimeModel(animeData);
    return await newAnime.save();
  } catch (error) {
    console.error("Error inserting anime:", error);
    throw error;
  }
}

/**
 * Delete all anime entries from the database
 * @returns Promise with the deletion result
 */
export async function deleteAllAnime() {
  try {
    return await AnimeModel.deleteMany({});
  } catch (error) {
    console.error("Error deleting all anime:", error);
    throw error;
  }
}

/**
 * Delete a single anime by ID
 * @param id The ID of the anime to delete
 * @returns Promise with the deletion result
 */
export async function deleteOneAnime(id: string) {
  try {
    return await AnimeModel.findByIdAndDelete(id);
  } catch (error) {
    console.error("Error deleting anime:", error);
    throw error;
  }
}

/**
 * Get an anime by ID
 * @param id The ID of the anime to retrieve
 * @returns Promise with the found anime document or null if not found
 */
export async function getAnime(id: string) {
  try {
    return await AnimeModel.findById(id).select("-__v -_id");
  } catch (error) {
    console.error("Error getting anime:", error);
    throw error;
  }
}

/**
 * Get all anime
 *
 * @returns Promise with all anime documents
 */

export async function getAllAnime() {
  try {
    return await AnimeModel.find({}).select("-__v -_id");
  } catch (error) {
    console.error("Error getting all anime:", error);
    throw error;
  }
}

export default AnimeModel;
