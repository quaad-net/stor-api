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
    client.close()
    console.log(err)
  }
  finally{
    client.close()
  }
}

export async function updatePartUsageAnalysis(){
    try{
        await client.connect();
        const database = client.db('quaad');

        //Update leadTime

        const leadColl = database.collection('uwm_high_lead_time_parts'); 
        const highLeads = await leadColl.find({}).toArray();
        const mainColl = database.collection('uwm_inventory');
        // Set default leadTime: 14
        await mainColl.updateMany({}, {$set: {leadTime: 14}});
        
        // Update collection with actual lead times
        async function updateLeadTime(filter, updateDoc){
          const result = await mainColl.updateMany(filter, updateDoc);
        }
        highLeads.forEach((lead)=>{
          const updateDoc = {
            $set: {leadTime: lead.est_lead_time_days}
          }
          updateLeadTime({code: lead.part_code}, updateDoc)
        })

        //Update Analsis 

        const inventoryColl = database.collection('uwm_inventory');
        const leadTimeColl = database.collection('uwm_high_lead_time_parts');
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
          let p1Usage = 0; // -122 days < part usage > -90 days
          let p2Usage = 0; // -91 days < part usage > -59 days
          let p3Usage = 0; // -60 days < part usage > -28 days
          let min = 0;
          let max = 0;
          let leadTime = 14;
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
              if(Number(warehouseCode)){warehouseCode = Number(warehouseCode)};
              const inventoryRec = await inventoryColl.find({code: simpleCode, warehouseCode: warehouseCode}).toArray();
              if(inventoryRec.length == 1){
                  const partInventory  = inventoryRec[0];
                  min = partInventory.min
                  max = partInventory.max
                  const leadTimeRec = await leadTimeColl.find({part_code: simpleCode}).toArray()
                  if(leadTimeRec == 1){
                      leadTime = leadTimeRec[0].est_lead_time_days
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
          const suggestedMin =  Number((leadTime * avgDailyUsage).toFixed(0));
          const analysis = {
              code: part,
              leadTime: leadTime,
              min: min,
              max: max,
              avgDailyUsage: avgDailyUsage.toFixed(2),
              total90DayUsage: total90DayUsage,
              p1Usage: p1Usage,
              p2Usage: p2Usage,
              p3Usage: p3Usage,
              increaseSchema: ((leadTime * avgDailyUsage) > Number(min) + 1), // prev: Number(min) != 0 ? ((leadTime * avgDailyUsage) > Number(min)) : false
              decreaseSchema: (2 * (leadTime * avgDailyUsage) < Number(min)), // Number(min) != 0 ? (2 * (leadTime * avgDailyUsage) < Number(min)) : false
              suggestedMin: suggestedMin,
              analysisDate: new Date().toLocaleDateString()
          }
          await analysisColl.insertOne(analysis)
        }
    }
    catch(err){
      client.close()
      console.log(err)
    }
    finally{
        await client.close();
    }
} 

