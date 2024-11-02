import anisync from "./request";
import fs from "node:fs/promises";
import chalk from "chalk";
import { getMappings } from "./mappings";
import { insertAnime } from "./db";
import winston from "winston";

// Configure logger
export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: "crawler-error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "crawler.log" }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Constants
const LAST_ID_FILE = "last_crawled_id.txt";
const DELAY_MS = 2000; // 2 seconds delay between requests

// Function to save last crawled ID
const saveLastId = async (id: string) => {
  try {
    await fs.writeFile(LAST_ID_FILE, id.toString());
    logger.info(`Saved last crawled ID: ${id}`);
  } catch (error) {
    logger.error(`Failed to save last ID: ${(error as Error).message}`);
  }
};

// Function to get last crawled ID
const getLastCrawledId = async () => {
  try {
    const lastId = await fs.readFile(LAST_ID_FILE, "utf-8");
    return lastId.trim();
  } catch (error) {
    logger.info("No previous crawl state found, starting fresh");
    return null;
  }
};

const getIds = async () => {
  try {
    const res = await anisync.get<string>(
      "https://raw.githubusercontent.com/5H4D0WILA/IDFetch/main/ids.txt"
    );
    const ids = res.data.split("\n");
    return ids;
  } catch (error) {
    logger.error(`Failed to fetch IDs: ${(error as Error).message}`);
    throw error;
  }
};

const crawlAnime = async () => {
  try {
    logger.info("Starting crawler...");
    const ids = await getIds();
    const lastCrawledId = await getLastCrawledId();

    let startIndex = 0;
    if (lastCrawledId) {
      startIndex = ids.findIndex((id) => id === lastCrawledId);
      if (startIndex === -1) {
        startIndex = 0;
        logger.warn(
          "Last crawled ID not found in current list, starting from beginning"
        );
      } else {
        startIndex += 1; // Start from next ID
        logger.info(`Resuming from ID after ${lastCrawledId}`);
      }
    }

    for (let i = startIndex; i < ids.length; i++) {
      const id = ids[i];
      try {
        logger.info(`Processing anime ID: ${id} (${i + 1}/${ids.length})`);

        // Get mappings for current ID
        const mappingData = await getMappings(id);

        const savingStatuses = ["FINISHED", "CANCELLED"];

        // Insert anime data
        if (mappingData) {
          if (
            (savingStatuses.includes(mappingData.status) ||
              mappingData.status !== null ||
              mappingData.status !== "") &&
            mappingData.title &&
            mappingData.id
          ) {
            await insertAnime(mappingData);
            // Save progress
            await saveLastId(id);

            // Log success
            logger.info(chalk.green(`Successfully processed anime ID: ${id}`));
          } else {
            logger.warn(
              `Skipping anime ID ${id} cause not enough data is available related to this anime.`
            );
          }
        } else {
          logger.warn(`Undefined data for ${id}, skipping...`);
        }
        await Bun.sleep(DELAY_MS);
      } catch (error) {
        logger.error(
          chalk.red(
            `Error processing anime ID ${id}: ${(error as Error).message}`
          )
        );
      }
    }

    logger.info(chalk.green("Crawling completed successfully!"));
  } catch (error) {
    logger.error(
      chalk.red(`Critical error in crawler: ${(error as Error).message}`)
    );
    process.exit(1);
  }
};

export default crawlAnime;
