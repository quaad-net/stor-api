import express from "express";
import cors from "cors";
import apiRouter from "./routes/api.js"
import rootRouter from "./routes/root.js"

const PORT = process.env.PORT || 5050;
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);
app.use("/", rootRouter);

// start the Express server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
