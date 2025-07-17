import { MongoClient } from "mongodb";
import 'dotenv/config';

const uri = process.env.ATLAS_URI;
const client = new MongoClient(uri);

export async function deletePartUsageRecords(){

  try{
    await client.connect();
    const clientDeletes = 
    [
      {
        namespace: "quaad.uwm_part_usage",
        name: "deleteMany",
        filter: {}
      }, 
      {
        namespace: "quaad.uwm_part_usage_122_28",
        name: "deleteMany",
        filter: {}
      }, 
      {
        namespace: "quaad.uwm_part_usage_122_90",
        name: "deleteMany",
        filter: {}
      }, 
      {
        namespace: "quaad.uwm_part_usage_91_59",
        name: "deleteMany",
        filter: {}
      }, 
      {
        namespace: "quaad.uwm_part_usage_60_28",
        name: "deleteMany",
        filter: {}
      }, 
    ]
    
    const clientDeleteRes = await client.bulkWrite(clientDeletes);
    console.log(`Deleted documents: ${clientDeleteRes.deletedCount}`);
  }
  catch(err){
    await client.close()
    console.log(err)
  }
  finally{
    await client.close()
  }
}

export async function updatePartUsageAnalysis(){
    try{
        await client.connect();
        const database = client.db('quaad');

        // Update leadTime

        const leadColl = database.collection('uwm_leadtime'); 
        const partLTs = await leadColl.find({}).toArray();
        const mainColl = database.collection('uwm_inventory');
        // Default leadTime: 30
        await mainColl.updateMany({}, {$set: {leadTime: 30}});
        
        // Update collection with actual lead times
        async function updateLeadTime(filter, updateDoc){
          const result = await mainColl.updateMany(filter, updateDoc);
        }
        partLTs.forEach((lead)=>{
          const updateDoc = {
            $set: {leadTime: lead.calcLT}
          }
          updateLeadTime({code: lead.PO_Item_Code}, updateDoc)
        })

        // Update Analsis 

        const inventoryColl = database.collection('uwm_inventory');
        const leadTimeColl = database.collection('uwm_leadtime');
        const usageColl = database.collection('uwm_part_usage');
        const analysisColl = database.collection('uwm_part_usage_analysis');
        const usageAnalysisMissed = database.collection('uwm_part_usage_analysis_missed');
        const usageP1Coll = database.collection('uwm_part_usage_122_90');
        const usageP2Coll = database.collection('uwm_part_usage_91_59');
        const usageP3Coll = database.collection('uwm_part_usage_60_28');

        await analysisColl.deleteMany({});
        await usageAnalysisMissed.deleteMany({});

        const distinctParts = await usageColl.distinct('materialPartCode', {})

        for await (const part of distinctParts){
          let total90DayUsage = 0;
          let p1Usage = 0; // -122 days < part usage date > -90 days
          let p2Usage = 0; // -91 days < part usage date > -59 days
          let p3Usage = 0; // -60 days < part usage date > -28 days
          let min = 0;
          let max = 0;
          let leadTime = 30;
          let avgDailyUsage = 0;
          const occurances =  await usageColl.find({materialPartCode: part}).project({_id: 0, materialQuantity: 1}).toArray();
          occurances.forEach((o)=>{
              total90DayUsage += o.materialQuantity
          })
          avgDailyUsage = total90DayUsage / 90; 

          const p1occurances = await usageP1Coll.find({materialPartCode: part}).project({_id: 0, materialQuantity: 1 }).toArray();
          p1occurances.forEach((o)=>{
            p1Usage += o.materialQuantity
          })

          const p2occurances = await usageP2Coll.find({materialPartCode: part}).project({_id: 0, materialQuantity: 1 }).toArray();
          p2occurances.forEach((o)=>{
            p2Usage += o.materialQuantity
          })

          const p3occurances = await usageP3Coll.find({materialPartCode: part}).project({_id: 0, materialQuantity: 1 }).toArray();
          p3occurances.forEach((o)=>{
            p3Usage += o.materialQuantity
          })

          const partArr = part.split('-');
          if(partArr.length == 3){
              const simpleCode = partArr[0] + '-' + partArr[1];
              let warehouseCode = partArr[2];
              // Allows for string/number db comparisons.
              if(Number(warehouseCode)){warehouseCode = Number(warehouseCode)};
              const inventoryRec = await inventoryColl.find({code: simpleCode, warehouseCode: warehouseCode}).toArray();
              if(inventoryRec.length == 1){
                  const partInventory  = inventoryRec[0];
                  min = partInventory.min
                  max = partInventory.max
                  const leadTimeRec = await leadTimeColl.find({PO_Item_Code: simpleCode}).toArray()
                  if(leadTimeRec.length == 1){
                      // If the part's actual lead time is less than 30 days, leadtime will remain at 30;
                      if(leadTimeRec[0].calcLT > leadTime){leadTime = leadTimeRec[0].calcLT}
                  }
              }
              else{
                usageAnalysisMissed.insertOne({_id: part});
                continue
              }
          }
          else{
            usageAnalysisMissed.insertOne({_id: part});
            continue
          }
          const suggestedMin =  ((leadTime * avgDailyUsage));
          const analysis = {
              code: part,
              leadTime,
              min,
              max,
              avgDailyUsage,
              total90DayUsage,
              p1Usage,
              p2Usage,
              p3Usage,
              increaseSchema: ((leadTime * avgDailyUsage) > Number(min) + 1),
              decreaseSchema: (2 * (leadTime * avgDailyUsage) < Number(min)),
              suggestedMin,
              analysisDate: new Date().toLocaleDateString()
          }
          await analysisColl.insertOne(analysis)
        }
    }
    catch(err){
      await client.close()
      console.log(err)
    }
    finally{
        await client.close();
    }
} 

export async function updatePODateField(){
  try{
    const db = client.db('quaad');
    const dateFieldAgg = 
    [ 
      {'$set':
        {
          'Order_Date': {
            '$dateFromString': {
              'dateString': '$Order_Date'
            }
          }
        }
      }
    ];

    let coll, aggRes, insertion;

    coll =  db.collection('uwm_purchase_orders_122_28');
    await coll.findOneAndDelete({Order_Date: ''})
    aggRes = await coll.aggregate(dateFieldAgg).toArray();
    await coll.deleteMany({});
    insertion = await coll.insertMany(aggRes);
    console.log(`Updated ${insertion.insertedCount} doc(s) @ uwm_purchase_orders_122_28`);
  }
  catch(err){
    await client.close();
    console.log(err)
  }
  finally{
    await client.close();
  }
}

export async function updateDateField(){
  try{
   await client.connect();
   const db = client.db('quaad');

    const dateFieldAgg = 
    [ 
      {'$set':
        {
          'materialPostDate': {
            '$dateFromString': {
              'dateString': '$materialPostDate'
            }
          }
        }
      }
    ];
    let coll, aggRes, collName, insertion;

    collName = 'uwm_part_usage'
    coll =  db.collection(collName);
    aggRes = await coll.aggregate(dateFieldAgg).toArray();
    await coll.deleteMany({});
    insertion = await coll.insertMany(aggRes);
    console.log(`Updated ${insertion.insertedCount} doc(s) @ ${collName}`);

    collName = 'uwm_part_usage_122_28'
    coll =  db.collection(collName);
    aggRes = await coll.aggregate(dateFieldAgg).toArray();
    await coll.deleteMany({});
    insertion = await coll.insertMany(aggRes);
    console.log(`Updated ${insertion.insertedCount} doc(s) @ ${collName}`);

    collName = 'uwm_part_usage_122_90'
    coll =  db.collection(collName);
    aggRes = await coll.aggregate(dateFieldAgg).toArray();
    await coll.deleteMany({});
    insertion = await coll.insertMany(aggRes);
    console.log(`Updated ${insertion.insertedCount} doc(s) @ ${collName}`);

    collName = 'uwm_part_usage_91_59'
    coll =  db.collection(collName);
    aggRes = await coll.aggregate(dateFieldAgg).toArray();
    await coll.deleteMany({});
    insertion = await coll.insertMany(aggRes);
    console.log(`Updated ${insertion.insertedCount} doc(s) @ ${collName}`);

    collName = 'uwm_part_usage_60_28'
    coll =  db.collection(collName);
    aggRes = await coll.aggregate(dateFieldAgg).toArray();
    await coll.deleteMany({});
    insertion = await coll.insertMany(aggRes);
    console.log(`Updated ${insertion.insertedCount} doc(s) @ ${collName}`);
  
    await client.close();
  }
  catch(err){
    await client.close();
    console.log(err)
  }
  finally{
      await client.close();
  }

}