import express from "express";
const router = express.Router();

router.get("/", async(req, res)=>{
    res.send("Add /api to route to connect to API.")
})

export default router;