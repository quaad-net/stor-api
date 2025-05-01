import express, { json, Router } from "express";
import {db, client} from "../db/connection.js";
import auth from "../auth.js";
import { ObjectId } from "mongodb";
import { connect } from "mongoose";

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

router.post("/inventory/binLoc", auth, async (req, res)=>{
    
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
            const coll = db.collection("uwm_inventory");
            const result = await coll.find( { binLoc: { $gte: startQryAt, $lte: endQryAt }, ...(isActive ? { active: 'True' } : {}) } )
            .project({_id: 0}).sort({binLoc: 1, code: 1}).toArray();
            res.json(result);
        }
        else{
            if(colonCount == 0){
                await client.connect();
                const coll = db.collection("uwm_inventory");
                let getAllRecords = false;
                if(queryStr == 'ALL'){getAllRecords = true};
                const regExpQueryStr = new RegExp(queryStr, 'i');
                const result = await coll.find( {...(getAllRecords ? {} : {binLoc: regExpQueryStr}), ...(isActive ? { active: 'True' } : {})} )
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

// router.post("/inventory/binLoc/:query", auth, async (req, res)=>{
    
//     try{
//         if(req.params.query == ""){throw new Error('Invalid query format')}
//         const queryStr = req.params.query.toString().trim().toUpperCase();
//         const queryArr = [...queryStr];
//         const active = /&ACTIVE/ // Returns only active parts if present in query
//         const isActive = active.test(queryStr);
//         let colonCount = 0;
//         queryArr.map((str)=>{
//             if(str==':'){
//                 colonCount += 1;
//             }
//         })
//         if(colonCount == 1){ // Indicates a range of bin locations.
//             const querySplit = queryStr.split(":");
//             const startQryAt = querySplit[0];
//             let endQryAt; 
//             if(isActive){endQryAt =  querySplit[1].replace('&ACTIVE', '').trim()}
//             else{ endQryAt = querySplit[1]}
//             await client.connect();
//             const coll = db.collection("uwm_inventory");
//             const result = await coll.find( { binLoc: { $gte: startQryAt, $lte: endQryAt }, ...(isActive ? { active: 'True' } : {}) } )
//             .project({_id: 0}).sort({binLoc: 1, code: 1}).toArray();
//             res.json(result);
//         }
//         else{
//             if(colonCount == 0){
//                 await client.connect();
//                 const coll = db.collection("uwm_inventory");
//                 let getAllRecords = false;
//                 if(queryStr == 'ALL'){getAllRecords = true};
//                 const regExpQueryStr = new RegExp(queryStr, 'i');
//                 const result = await coll.find( {...(getAllRecords ? {} : {binLoc: regExpQueryStr}), ...(isActive ? { active: 'True' } : {})} )
//                 .project({_id: 0}).sort({binLoc: 1, code: 1}).toArray();
//                 res.json(result);
//             }
//             else{throw new Error('Invalid query format')}
//         }

//     }
//     catch(err){
//         if(err.message == 'Invalid query format'){
//             res.status(400).json({message: "Invalid syntax"})
//         }
//         else{
//             res.status(500).json({message:"Error fetching data"}
//         )}
//     }
// })


router.post("/inventory/descr", auth, async (req, res)=>{

    try{
        if(req.body.query == ""){throw new Error('Invalid query format')}
        let descr = req.body.query.toString().trim();
        await client.connect();
        const coll = db.collection("uwm_inventory");
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

// router.post("/inventory/descr/:description", auth, async (req, res)=>{

//     try{
//         if(req.params.description == ""){throw new Error('Invalid query format')}
//         let descr = req.params.description.toString().trim();
//         descr = descr.replaceAll('/', '.');
//         await client.connect();
//         const coll = db.collection("uwm_inventory");
//         const re = new RegExp(descr, 'i');
//         let result = await coll.find( { description: { $in: [re]} } ).sort({binLoc: 1, code: 1}).toArray()
//         res.json(result)
//     }
//     catch(err){
//         if(err.message == 'Invalid query format'){
//             res.status(400).json({message: "Invalid syntax"})
//         }
//         else{
//             res.status(500).json({message:"Error fetching data"})
//         }
//     }

// })

router.post("/inventory/partCode", auth, async (req, res)=>{

    // Note: :partcode param can contain multiple parts seperated by " ".

    try{

        if(req.body.query == ""){throw new Error('Invalid query format')}

        const part = req.body.query.toString().trim();
        const partsArr = part.split(' ');
        await client.connect();
        const coll = db.collection("uwm_inventory");
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

// router.post("/inventory/partCode/:partcode", auth, async (req, res)=>{

//     // Note: :partcode param can contain multiple parts seperated by " ".

//     try{

//         if(req.params.partcode == ""){throw new Error('Invalid query format')}

//         const part = req.params.partcode.trim();
//         const partsArr = part.split(' ');
//         await client.connect();
//         const coll = db.collection("uwm_inventory");
//         if(partsArr.length > 1){
//             const RegExPartsArr=[];
//             partsArr.forEach((p)=>{
//                 const reStr =  '^' + p;
//                 const re = new RegExp(reStr, 'i');
//                 RegExPartsArr.push(re);
//             })
//             const result = await coll.find( { code: { $in: RegExPartsArr } })
//             .sort({binLoc: 1, code: 1}).toArray();
//             res.json(result);
//         }
//         else{
//             const reStr = '^' + part;
//             const re = new RegExp(reStr, 'i');
//             const result = await coll.find( { code: { $in: [re]} } )
//                 .sort({binLoc: 1, code: 1}).toArray();
//             res.json(result)
//         }
//     }
//     catch(err){
//         if(err.message == 'Invalid query format'){
//             res.status(400).json({message: "Invalid syntax"})
//         }
//         else{res.status(500).json({message:"Error fetching data"})}
//     }

// })

router.get('/inventory/usage_analysis/:institution/:partcode', async(req, res)=>{
    try{
        await client.connect();
        const database = client.db('quaad');
        const institution  = req.params.institution;
        const coll = database.collection(`${institution}_part_usage_analysis`);
        const partCode = req.params.partcode;
        const usage = await coll.find({code: partCode}).toArray();
        if(usage.length == 1){
            res.json(usage[0])
        }
        else{
            throw new Error('Not found')
        }
    }
    catch(err){
        res.status(500).json({message: 'Could not fetch usage'})
    }
})

router.post('/inventory_count', auth, async(req, res)=>{
    try {
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection('uwm_inventory_count');
        const countDetails = {
            code: req.body.code,
            binLoc: req.body.binLoc,
            inventoryCount: req.body.inventoryCount,
            comment: req.body.comment,
            description: req.body.description,
            user: req.body.user,
            date: new Date(req.body.date)
        };
        const reCode = new RegExp(countDetails.code, 'i');
        const reBinLoc = new RegExp(countDetails.binLoc,'i' );
        const query = { code: reCode, binLoc: reBinLoc };
        const result = await coll.replaceOne(query, countDetails, {upsert: true})
        if(result.acknowledged){
            res.status(201).json({message: 'Count posted'})
        }
        else throw new Error()
    }
    catch{
        res.status(500).json({message: 'Unable to post count'})
    }
})

router.post('/inventory_tasks', auth, async(req, res)=>{
    try {
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection('uwm_inventory_tasks');
        const taskDetails = {
            code: req.body.code,
            binLoc: req.body.binLoc,
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
        res.status(500).json({message: 'Unable to post task'})
    }
})

router.post('/inventory_tasks_print', auth, async(req, res)=>{
    try {
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection('uwm_inventory_tasks_print');
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
        res.status(500).json({message: 'Unable to add item'})
    }
})

router.post('/inventory_tasks/delete/:objectId', auth, async(req, res)=>{
    try {
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection('uwm_inventory_tasks');
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
        res.status(500).json({message: 'Failed'})
    }
})

router.post('/inventory_tasks_print/delete/:objectId', auth, async(req, res)=>{
    try {
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection('uwm_inventory_tasks_print');
        const objectId = new ObjectId(req.params.objectId)
        const result = await coll.deleteOne({_id: objectId});
        if (result.deletedCount === 1) {
            res.status(200).json({message: 'Success'})
          } else {
            throw new Error()
        }
    }
    catch(err){
        res.status(500).json({message: 'Failed'})
    }
})

router.post('/inventory_tasks_print/delete-all', auth, async(req, res)=>{
    try {
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection('uwm_inventory_tasks_print');
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
        res.status(500).json({message: 'Failed'})
    }
})

router.post('/inventory_tasks/get-all', auth, async(req, res)=>{
    try {
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection('uwm_inventory_tasks');
        const result = await coll.find({}).sort({date: -1}).toArray();
        res.json(result);
    }
    catch(err){
        res.status(500).json({message: 'Failed to fetch records'})
    }
})

router.post('/inventory_tasks_print/get-all', auth, async(req, res)=>{
    try {
        await client.connect();
        const database = client.db('quaad');
        const coll = database.collection('uwm_inventory_tasks_print');
        const result = await coll.find({}).sort({date: -1}).toArray();
        res.json(result);
    }
    catch(err){
        res.status(500).json({message: 'Failed to fetch records'})
    }
})


// // Get part records for labels using warehouseBinLocation query.
// router.post("/labels/:query", auth, async (req, res)=>{
    
//     try{
//         if(req.params.query == ""){throw new Error('Invalid query format')}
//         const queryStr = req.params.query.trim().toUpperCase();
//         const queryArr = [...queryStr];
//         const active = /&ACTIVE/ // Returns only active parts if present in query
//         const isActive = active.test(queryStr);
//         let colonCount = 0;
//         queryArr.map((str)=>{
//             if(str==':'){
//                 colonCount += 1;
//             }
//         })
//         if(colonCount == 1){ // Indicates a range of bin locations.
//             const querySplit = queryStr.split(":");
//             const startQryAt = querySplit[0];
//             let endQryAt; 
//             if(isActive){endQryAt =  querySplit[1].replace('&ACTIVE', '').trim()}
//             else{ endQryAt = querySplit[1]}
//             await client.connect();
//             const coll = db.collection("uwm_stor_parts");
//             const result = await coll.find( { warehouseBinLocation: { $gte: startQryAt, $lte: endQryAt }, ...(isActive ? { active: 'True' } : {}) } )
//             .sort({warehouseBinLocation: 1, partCode: 1}).toArray();
//             res.json(result);
//         }
//         else{
//             if(colonCount == 0){
//                 await client.connect();
//                 const coll = db.collection("uwm_stor_parts");
//                 const result = await coll.find( { warehouseBinLocation: queryStr, ...(isActive ? { active: 'True' } : {})} )
//                 .sort({warehouseBinLocation: 1, partCode: 1}).toArray();
//                 res.json(result);
//             }
//             else{throw new Error('Invalid query format')}
//         }

//     }
//     catch(err){
//         if(err.message == 'Invalid query format'){
//             res.status(400).json({message: "Invalid syntax"})
//         }
//         else{res.status(500).json({message:"Error fetching data"})}
//     }
// })

// // Get part records for labels using partCode query.
// router.post("/labels/partcode/:partcode", auth, async (req, res)=>{
 
//     // Note: :partcode param can contain multiple parts seperated by " ".

//     try{

//         if(req.params.partcode == ""){throw new Error('Invalid query format')}

//         const part = req.params.partcode.trim().toUpperCase();
//         const partsArr = part.split(' ');
//         await client.connect();
//         const coll = db.collection("uwm_stor_parts");
//         if(partsArr.length > 1){
//             const RegExPartsArr=[];
//             partsArr.forEach((p)=>{
//                 const reStr =  '^' + p;
//                 const re = new RegExp(reStr, 'i');
//                 RegExPartsArr.push(re);
//             })
//             const result = await coll.find( { partCode: { $in: RegExPartsArr } })
//             .sort({warehouseBinLocation: 1, partCode: 1}).toArray();
//             res.json(result);
            
//         }
//         else{
//             const reStr = '^' + part;
//             const re = new RegExp(reStr, 'i');
//             const result = await coll.find( { partCode: { $in: [re]} } )
//                 .sort({warehouseBinLocation: 1, partCode: 1}).toArray();
//             res.json(result)
//         }
//     }
//     catch(err){
//         if(err.message == 'Invalid query format'){
//             res.status(400).json({message: "Invalid syntax"})
//         }
//         else{res.status(500).json({message:"Error fetching data"})}
//     }
// })

// Get part record with no auth
router.get("/parts/:partCode", async (req, res)=>{ 
    try{
        await client.connect();
        const coll = db.collection("uwm_stor_parts");
        const result = await coll.findOne({ partCode: req.params.partCode}); 
        if(result !== null){res.status(200).json(result)}
        else{
            res.status(404).json({message: 'Record not found'})
        }
    }
    catch{res.status(500).json({message: 'Something went wrong'})}
})

// Get part record with auth
router.post("/parts/:partCode", auth, async (req, res)=>{ 
    try{
        await client.connect();
        const coll = db.collection("uwm_stor_parts");
        const result = await coll.findOne({ partCode: req.params.partCode}); 
        if(result !== null){res.status(200).json(result)}
        else{
            res.status(404).json({message: 'Record not found'})
        }
    }
    catch{res.status(500).json({message: 'Something went wrong'})}
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