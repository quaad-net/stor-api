import express, { json, Router } from "express";
import {db, client} from "../db/connection.js";
import auth from "../auth.js";
import { ObjectId } from "mongodb";

const router = express.Router();

// Test application.
router.get("/", auth, async(req, res)=>{
    try{
        await client.connect();
        res.send("Connection to api.stor.quaad established successfully.")     
    }
    catch(err){
        res.send("Unauthorized!")
    };
})

// Get part records for labels using warehouseBinLocation query.
router.post("/labels/:query", auth, async (req, res)=>{
    
    try{
        if(req.params.query == ""){throw new Error('Invalid query format')}
        const queryStr = req.params.query.trim().toUpperCase();
        const queryArr = [...queryStr];
        const active = /&ACTIVE/ // Returns only active parts if present in query
        const isActive = active.test(queryStr);
        let colonCount = 0;
        queryArr.map((str)=>{
            if(str==':'){
                colonCount += 1;
            }
        })
        if(colonCount == 1){
            const querySplit = queryStr.split(":");
            const startQryAt = querySplit[0];
            let endQryAt; 
            if(isActive){endQryAt =  querySplit[1].replace('&ACTIVE', '').trim()}
            else{ endQryAt = querySplit[1]}
            await client.connect();
            const coll = db.collection("uwm_stor_parts");
            const result = await coll.find( { warehouseBinLocation: { $gte: startQryAt, $lte: endQryAt }, ...(isActive ? { active: 'True' } : {}) } )
            .sort({warehouseBinLocation: 1, partCode: 1}).toArray();
            res.json(result);
        }
        else{
            if(colonCount == 0){
                await client.connect();
                const coll = db.collection("uwm_stor_parts");
                const result = await coll.find( { warehouseBinLocation: queryStr, ...(isActive ? { active: 'True' } : {})} )
                .sort({warehouseBinLocation: 1, partCode: 1}).toArray();
                res.json(result);
            }
            else{throw new Error('Invalid query format')}
        }

    }
    catch(err){
        if(err.message == 'Invalid query format'){
            res.status(400).json({message: "Invalid syntax"})
        }
        else{res.status(500).json({message:"Error fetching data"})}
    }
})

// Get part records for labels using partCode query.
router.post("/labels/partcode/:partcode", auth, async (req, res)=>{
 
    // Note: :partcode param can contain multiple parts seperated by " ".

    try{

        if(req.params.query == ""){throw new Error('Invalid query format')}

        const part = req.params.partcode.trim().toUpperCase();
        const partsArr = part.split(' ');
        await client.connect();
        const coll = db.collection("uwm_stor_parts");
        if(partsArr.length > 1){
            const RegExPartsArr=[];
            partsArr.forEach((p)=>{
                const reStr =  '^' + p;
                const re = new RegExp(reStr, 'i');
                RegExPartsArr.push(re);
            })
            const result = await coll.find( { partCode: { $in: RegExPartsArr } })
            .sort({warehouseBinLocation: 1, partCode: 1}).toArray();
            res.json(result);
            
        }
        else{
            const reStr = '^' + part;
            const re = new RegExp(reStr, 'i');
            const result = await coll.find( { partCode: { $in: [re]} } )
                .sort({warehouseBinLocation: 1, partCode: 1}).toArray();
            res.json(result)
        }
    }
    catch(err){
        if(err.message == 'Invalid query format'){
            res.status(400).json({message: "Invalid syntax"})
        }
        else{res.status(500).json({message:"Error fetching data"})}
    }
})

// Get part record
router.get("/parts/:partCode", async (req, res)=>{ 
    try{
        await client.connect();
        const coll = db.collection("uwm_stor_parts");
        const result = await coll.findOne({ partCode: req.params.partCode}); 
        if(result !== null){res.status(200).json(result)}
        else{
            throw new Error()
        }
    }
    catch{res.status(404).json({message: 'No matching record found'})}
})

// Get record of quaad user by email in request body.
router.post("/users", async (req, res)=>{
    try{
        await client.connect();
        const coll = db.collection("users");
        const result = await coll.find({email: req.body.email}).project({password: 0, _id: 0}).toArray();
        res.json(result);
    }
    catch(err){
        res.status(500).json({message:"Error fetching users"})
    }
})

// Get record of quaad user by email in url param.
router.get("/users/:email", async (req, res)=>{ 
    await client.connect();
    const coll = db.collection("users");
    const result = await coll.find({email: req.params.email}).project({password: 0, _id: 0}).toArray();
    res.json(result)
})

export default router;