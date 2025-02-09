import { MongoClient, ServerApiVersion } from "mongodb";
import "dotenv/config";

const uri = process.env.ATLAS_URI || "";
export const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

export const  db = client.db("quaad");