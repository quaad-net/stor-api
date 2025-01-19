import express, { json } from "express";
import {db, client} from "../db/connection.js";

// This will help convert the id from string to ObjectId for the _id.
import { ObjectId } from "mongodb";

// The router will be added as a middleware and will take control of requests starting with path/api.
const router = express.Router();

// Test Connection.
router.get("/", async(req, res)=>{
    await client.connect();
    await client.close();
    res.send("Connection to stor.quaad/api established successfully.")
})

// Submit inventory pick.
router.post("/pick", async (req, res)=>{
    await client.connect();
    //fake submit
    const result = "Submitted successfully.";
    await client.close();
    res.send(result);
})

// Get records of all technicians.
router.get("/technicians", async (req, res)=>{
    await client.connect();
    const coll = db.collection("stor_technicians");
    const result = await coll.find({}).toArray();
    await client.close();
    res.json(result);
})

// Get record of techician by id.
router.get("/technicians/:technicianId", async (req, res)=>{ //test id: 11112222
    await client.connect();
    const coll = db.collection("stor_technicians");
    const result = await coll.findOne({ technicianId: req.params.technicianId}).toArray(); 
    await client.close();
    res.json(result)
})

//////Boilerplate///////// 
// // This section will help you get a list of all the records.
// router.get("/", async (req, res) => {
//   let collection = await db.collection("records");
//   let results = await collection.find({}).toArray();
//   res.send(results).status(200);
// });

// // This section will help you get a single record by id
// router.get("/:id", async (req, res) => {
//   let collection = await db.collection("records");
//   let query = { _id: new ObjectId(req.params.id) };
//   let result = await collection.findOne(query);

//   if (!result) res.send("Not found").status(404);
//   else res.send(result).status(200);
// });


// // This section will help you create a new record.
// router.post("/", async (req, res) => {
//   try {
//     let newDocument = {
//       name: req.body.name,
//       position: req.body.position,
//       level: req.body.level,
//     };
//     let collection = await db.collection("records");
//     let result = await collection.insertOne(newDocument);
//     res.send(result).status(204);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error adding record");
//   }
// });

// // This section will help you update a record by id.
// router.patch("/:id", async (req, res) => {
//   try {
//     const query = { _id: new ObjectId(req.params.id) };
//     const updates = {
//       $set: {
//         name: req.body.name,
//         position: req.body.position,
//         level: req.body.level,
//       },
//     };

//     let collection = await db.collection("records");
//     let result = await collection.updateOne(query, updates);
//     res.send(result).status(200);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error updating record");
//   }
// });

// // This section will help you delete a record
// router.delete("/:id", async (req, res) => {
//   try {
//     const query = { _id: new ObjectId(req.params.id) };

//     const collection = db.collection("records");
//     let result = await collection.deleteOne(query);

//     res.send(result).status(200);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error deleting record");
//   }
// });

export default router;