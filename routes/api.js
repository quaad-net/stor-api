import 'dotenv/config';
import express from "express";
import { ObjectId } from "mongodb";

import auth from "../auth.js";
import {client, db} from "../db/connection.js";

const router = express.Router();

router.get("/", auth, async(req, res)=>{
    try{
        await client.connect();
        res.send("api.stor.quaad")     
    }
    catch(err){
        res.send("Unauthorized!")
    };
})

router.post("/:institution/inventory/binLoc", auth, async (req, res)=>{
    
    try{
        if(req.body.query == ""){throw new Error('Invalid query format')}
        const queryStr = req.body.query.toString().trim().toUpperCase();
        const queryArr = [...queryStr];
        const active = /&ACTIVE/ // Returns only active parts if present in query
        const isActive = active.test(queryStr);
        let colonCount = 0;
        queryArr.map((str)=>{
            if(str==':'){
                colonCount += 1;
            }
        })
        if(colonCount == 1){ // Indicates a range of bin locations.
            const querySplit = queryStr.split(":");
            const startQryAt = querySplit[0];
            let endQryAt; 
            if(isActive){endQryAt =  querySplit[1].replace('&ACTIVE', '').trim()}
            else{ endQryAt = querySplit[1]}
            await client.connect();
            const coll = db.collection(`${req.params.institution}_inventory`);
            const result = await coll.find( { binLoc: { $gte: startQryAt, $lte: endQryAt }, ...(isActive ? { active: 'TRUE' } : {}) } )
            .project({_id: 0}).sort({binLoc: 1, code: 1}).toArray();
            res.json(result);
        }
        else{
            if(colonCount == 0){
                await client.connect();
                const coll = db.collection(`${req.params.institution}_inventory`);
                let getAllRecords = false;
                if(queryStr == 'ALL'){getAllRecords = true};
                let reQry;
                if(isActive){reQry = new RegExp(queryStr.toString().replace('&ACTIVE', '').trim(), 'i')}
                else{reQry = new RegExp(queryStr.toString().trim(), 'i')}
                const result = await coll.find( {...(getAllRecords ? {} : 
                    {binLoc: reQry, ...(isActive ? { active: 'TRUE' } : {})})} )
                .project({_id: 0}).sort({binLoc: 1, code: 1}).toArray();
                res.json(result);
            }
            else{throw new Error('Invalid query format')}
        }
    }
    catch(err){
        if(err.message == 'Invalid query format'){
            res.status(400).json({message: "Invalid syntax"})
        }
        else{
            res.status(500).json({message:"Error fetching data"}
        )}
    }
})

router.post("/:institution/inventory/descr", auth, async (req, res)=>{

    try{
        if(req.body.query == ""){throw new Error('Invalid query format')}
        let descr = req.body.query.toString().trim();
        await client.connect();
        const coll = db.collection(`${req.params.institution}_inventory`);
        const re = new RegExp(descr, 'i');
        let result = await coll.find( { description: { $in: [re]} } ).sort({binLoc: 1, code: 1}).toArray()
        res.json(result)
    }
    catch(err){
        if(err.message == 'Invalid query format'){
            res.status(400).json({message: "Invalid syntax"})
        }
        else{
            res.status(500).json({message:"Error fetching data"})
        }
    }

})

router.post("/:institution/inventory/locQR", auth, async (req, res)=>{

    try{
        await client.connect();
        const db = client.db('quaad');
        const coll = db.collection('uwm_inventory');

        const modifiedRes = [];
        const [warehouseCode, row] = req.body.query.split('/');
        const regExWare = warehouseCode + '$'
        const regExRow = '^' + row
        const agg = 
        [
            {
                '$addFields': {
                'warehouseCode': {
                    '$toString': '$warehouseCode'
                }
                }
            }, {
                '$match': {
                'warehouseCode': {
                    '$regex': `${regExWare}`
                },
                'binLoc': {
                    '$regex': `${regExRow}`,
                }
                }
            }
        ]

        const aggRes =  coll.aggregate(agg)
        for await(const doc of aggRes){
            if(doc.code.toString().substring(0, 1) == doc.warehouseCode.toString().substring(0, 1)){ 
                modifiedRes.push(doc)
            }
        }
        return res.json(modifiedRes)
    }
    catch(err){
        res.status(500).json({message:"Error fetching data"})
    }

})

router.post("/:institution/inventory/partCode", auth, async (req, res)=>{

    // Note: :partcode param can contain multiple parts seperated by a space.

    try{
        if(req.body.query == ""){throw new Error('Invalid query format')}
        const part = req.body.query.toString().trim();
        const partsArr = part.split(' ');
        await client.connect();
        const coll = db.collection(`${req.params.institution}_inventory`);
        if(partsArr.length > 1){
            const RegExPartsArr=[];
            partsArr.forEach((p)=>{
                const reStr =  '^' + p;
                const re = new RegExp(reStr, 'i');
                RegExPartsArr.push(re);
            })
            const result = await coll.find( { code: { $in: RegExPartsArr } })
            .sort({binLoc: 1, code: 1}).toArray();
            res.json(result);
        }
        else{
            const reStr = '^' + part;
            const re = new RegExp(reStr, 'i');
            const result = await coll.find( { code: { $in: [re]} } )
                .sort({binLoc: 1, code: 1}).toArray();
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

router.post("/:institution/inventory/ware", auth, async (req, res)=>{

    try{
        if(req.body.query == ""){throw new Error('Invalid query format')}
        let warehouseCode = req.body.query.toString().trim();
        await client.connect();
        const coll = db.collection(`${req.params.institution}_inventory`);
        if(Number(warehouseCode)){warehouseCode = Number(warehouseCode)};
        const result = await coll.find( { warehouseCode: warehouseCode })
        .sort({binLoc: 1, code: 1}).toArray();
        res.json(result);
    }
    catch(err){
        if(err.message == 'Invalid query format'){
            res.status(400).json({message: "Invalid syntax"})
        }
        else{res.status(500).json({message:"Error fetching data"})}
    }
})

router.get('/:institution/inventory/usage_analysis/:partcode', async(req, res)=>{
    try{
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection(`${req.params.institution}_part_usage_analysis`);
        const usage = await coll.find({code: req.params.partcode}).toArray();
        if(usage.length == 1){
            res.json(usage[0])
        }
        else{
            throw new Error('Not found')
        }
    }
    catch(err){
        if(err.message == 'Not found'){
            res.status(404).json({message: err.message})
        }
        else{res.status(500).json({message: 'Could not fetch usage'})}
    }
})

router.post('/:institution/inventory_count', auth, async(req, res)=>{
    try {
        if(req?.access == process.env.RESTRICTED){throw new Error('Unauthorized')}
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection(`${req.params.institution}_inventory_count`);
        const countDetails = {
            code: req.body.code,
            binLoc: req.body.binLoc,
            warehouseCode: req.body.warehouseCode,
            inventoryCount: Number(req.body.inventoryCount),
            comment: req.body.comment,
            description: req.body.description,
            user: req.body.user,
            date: new Date(req.body.date)
        };

        let warehouseCode;
        // Allows proper comparing of string/numeric vals in db.
        if(Number(countDetails.warehouseCode)){warehouseCode = Number(countDetails.warehouseCode)}
        else{warehouseCode = countDetails.warehouseCode}
        let reCode = '^' + req.body.code + '$';
        let reBinLoc = '^' + req.body.binLoc + '$';
        reCode = new RegExp(reCode, 'i');
        reBinLoc = new RegExp(reBinLoc, 'i');
        const query = {code: {$in: [reCode]}, binLoc: {$in: [reBinLoc]}, warehouseCode: warehouseCode};
        const result = await coll.replaceOne(query, {...countDetails, warehouseCode: warehouseCode}, {upsert: true})
        res.status(201).json({message: 'Count posted'})
    }
    catch(err){
        if(err.message == 'Unauthorized'){res.status(401).json({message: 'Unauthorized'})}
        else{res.status(500).json({message: 'Unable to post count'})}
    }
})

router.post('/:institution/inventory_tasks', auth, async(req, res)=>{
    try {
        if(req?.access == process.env.RESTRICTED){throw new Error('Unauthorized')}
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection(`${req.params.institution}_inventory_tasks`);
        const taskDetails = {
            code: req.body.code,
            binLoc: req.body.binLoc,
            warehouseCode: req.body.warehouseCode,
            taskType: req.body.taskType,
            taskValues: req.body.taskValues,
            comment: req.body.comment,
            description: req.body.description,
            user: req.body.user,
            date: new Date(req.body.date),
            completed: req.body.completed
        };
        const result = await coll.insertOne(taskDetails)
        if(result.acknowledged){
            res.status(201).json({message: 'Submitted'})
        }
        else throw new Error()
    }
    catch(err){
        if(err.message == 'Unauthorized'){res.status(401).json({message: 'Unauthorized'})}
        else{res.status(500).json({message: 'Unable to post task'})}
    }
})

router.post('/:institution/inventory_tasks_print', auth, async(req, res)=>{
    try {
        if(req?.access == process.env.RESTRICTED){throw new Error('Unauthorized')}
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection(`${req.params.institution}_inventory_tasks_print`);
        const printDetails = {
            code: req.body.code,
            binLoc: req.body.binLoc,
            min: req.body.min,
            max: req.body.max,
            description: req.body.description,
            comment: req.body.comment,
            user: req.body.user,
            date: new Date(req.body.date),
            completed: req.body.completed
        };
        const result = await coll.insertOne(printDetails)
        if(result.acknowledged){
            res.status(201).json({message: 'Submitted'})
        }
        else throw new Error()
    }
    catch(err){
        if(err.message == 'Unauthorized'){res.status(401).json({message: 'Unauthorized'})}
        else{res.status(500).json({message: 'Unable to add item'})}
    }
})

router.post('/:institution/inventory_tasks/delete/:objectId', auth, async(req, res)=>{
    try {
        if(req?.access == process.env.RESTRICTED){throw new Error('Unauthorized')}
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection(`${req.params.institution}_inventory_tasks`);
        const objectId = new ObjectId(req.params.objectId)
        const result = await coll.deleteOne({_id: objectId});
        if (result.deletedCount === 1) {
            res.status(200).json({message: 'Success'})
        } 
        else {
            throw new Error()
        }
    }
    catch(err){
        if(err.message == 'Unauthorized'){res.status(401).json({message: 'Unauthorized'})}
        else{res.status(500).json({message: 'Failed'})}
    }
})

router.post('/:institution/inventory_tasks/get-all', auth, async(req, res)=>{
    try {
        if(req?.access == process.env.RESTRICTED){throw new Error('Unauthorized')}
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection(`${req.params.institution}_inventory_tasks`);
        const result = await coll.find({}).sort({date: -1}).toArray();
        res.json(result);
    }
    catch(err){
        if(err.message == 'Unauthorized'){res.status(401).json({message: 'Unauthorized'})}
        else{res.status(500).json({message: 'Failed to fetch records'})}
    }
})

router.post('/:institution/inventory_tasks_print/delete/:objectId', auth, async(req, res)=>{
    try {
        if(req?.access == process.env.RESTRICTED){throw new Error('Unauthorized')}
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection(`${req.params.institution}_inventory_tasks_print`);
        const objectId = new ObjectId(req.params.objectId)
        const result = await coll.deleteOne({_id: objectId});
        if (result.deletedCount === 1) {
            res.status(200).json({message: 'Success'})
          } else {
            throw new Error()
        }
    }
    catch(err){
        if(err.message == 'Unauthorized'){res.status(401).json({message: 'Unauthorized'})}
        else{res.status(500).json({message: 'Failed'})}
    }
})

router.post('/:institution/inventory_tasks_print/delete-all', auth, async(req, res)=>{
    try {
        if(req?.access == process.env.RESTRICTED){throw new Error('Unauthorized')}
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection(`${req.params.institution}_inventory_tasks_print`);
        const idList = req.body.ids;
        const objIDList = [];
        idList.forEach((id)=>{objIDList.push(new ObjectId(id))});
        const result = await coll.deleteMany({_id: {$in: objIDList}});
        if (result.deletedCount > 0) {
            res.status(200).json({message: 'Success'})
        } 
        else {
            throw new Error()
        }
    }
    catch(err){
        if(err.message == 'Unauthorized'){res.status(401).json({message: 'Unauthorized'})}
        else{res.status(500).json({message: 'Failed'})}
    }
})

router.post('/:institution/inventory_tasks_print/get-all', auth, async(req, res)=>{
    try {
        if(req?.access == process.env.RESTRICTED){throw new Error('Unauthorized')}
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection(`${req.params.institution}_inventory_tasks_print`);
        const result = await coll.find({}).sort({date: -1}).toArray();
        res.json(result);
    }
    catch(err){
        if(err.message == 'Unauthorized'){res.status(401).json({message: 'Unauthorized'})}
        else{res.status(500).json({message: 'Failed to fetch records'})}
    }
})

export default router;