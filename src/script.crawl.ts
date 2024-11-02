import mongoose from "mongoose";
import crawlAnime from "./crawl";

await mongoose.connect(process.env.DATABASE_URL as string);

await crawlAnime();
