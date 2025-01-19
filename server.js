import express from "express";
import cors from "cors";
import apiRouter from "./routes/api.js"

const ATLAS_PORT = process.env.ATLAS_PORT || 5050;
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);

// start the Express server
app.listen(ATLAS_PORT, () => {
  console.log(`Server listening on port ${ATLAS_PORT}`);
});
