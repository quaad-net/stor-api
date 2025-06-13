import express from "express";
import cors from "cors";
import apiRouter from "./routes/api.js";
import notif from "./email/notif.js";
import "dotenv/config";
import User from "./db/userModel.js";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import jwt from 'jsonwebtoken';
const { createHmac } = await import('node:crypto');
import auth from "./auth.js";

const uri = process.env.ATLAS_URI;
const hAlgo = process.env.H_ALGO;
const hUpdate = process.env.H_UPDATE;
const hDigest = process.env.H_DIGEST;
const tAlgo = process.env.T_ALGO;

const client = new MongoClient(uri);

const PORT = process.env.PORT || 5050;
const app = express();

app.use(cors());
app.use(express.json());
app.use("/", apiRouter);
app.use(express.static('public'));

app.set('view engine', 'ejs');

app.post('/auth-endpoint', auth, (req, res)=>{
  res.status(200).json(req.user);
})

app.post("/currentuser", async(req, res)=>{
  try{
    await client.connect();
    const database = client.db('quaad');
    const coll = database.collection('users');
    const anyCaseEmail = new RegExp(req.body.email, 'i')
    const match = await coll.find({email: anyCaseEmail, employeeID: "_" + req.body.employeeID}).toArray();
    if(match.length > 0){
      res.status(403).json({message: 'This user already exists.'})
    }
    else{res.status(200).json({message: 'Account does not exist.'})}
    }
  catch{res.status(500).json({message: 'Something went wrong!'})}
})

app.post("/login", async(req, res)=>{

  try{
    await client.connect();
    const database = client.db('quaad');
    const coll = database.collection('users');
    const anyCaseEmail = new RegExp(req.body.email, 'i');
    const cursor = coll.find({email: anyCaseEmail}, {});
    const match = (await cursor.toArray());
    const storedPass = match[0].password;
    const institution = match[0].institution;

    const hash = createHmac(hAlgo, req.body.password)
    .update(hUpdate)
    .digest(hDigest)

    if(hash == storedPass){
      const secretKey = process.env.SECRET_KEY;
      const token = jwt.sign(
        {
          payload: req.body.email.toLowerCase(),
        }, 
        secretKey,
        { expiresIn: "12h" , algorithm: tAlgo}
      )

      const modMatch = {
        ...match[0], password: ''
      }

      res.status(200).send({
        message: "Login Successful",
        email: req.body.email.toLowerCase(),
        userData: JSON.stringify(modMatch),
        institution: institution,
        token,
      });
    }
    else{
      res.status(404).json({message: 'Entries do not exist'});
    }
  }
  catch{
    res.status(500).json({message: 'Login error'})
  }
})

app.post('/:institution/notif', auth, async (req, res) => {
    // Sends a confirmation notifcation to default receivers as well as 
    // the user.
  
  try{
    if(req?.access == process.env.RESTRICTED){throw new Error('Unauthorized')}
    const institution = req.params.institution;
    const details = {...req.body};
    await client.connect();
    const db = client.db('quaad');

    const institutions = db.collection('institutions');
    const findReceivers = await institutions.find({name: institution}).project({defaultNotifReceivers: 1, _id: 0}).toArray()
    const defaultReceivers = findReceivers[0].defaultNotifReceivers;

    const coll = db.collection(`${institution}_notification_receivers`);
    const match = await  coll.find({warehouseCode: defaultReceivers}).project({_id: 0, email: 1}).toArray()
    const emails = [];
    match.forEach((m)=>{emails.push(m.email.toString())});
    const sendTos = [];
    emails.forEach((email)=>{
      if(email != details.user){sendTos.push(email)}
    });
    sendTos.push(details.user);
    const from = `${institution}@quaad.net`;
    res.render('notif_template.ejs', {details}, (err, html) => {
      notif(html, sendTos, from).then((notifRes)=>{
        if(notifRes != 0){throw new Error()}
        else{res.status(200).json({message: 'Success'})}
      })
    })
  }
  catch(err){
    if(err.message == 'Unauthorized'){res.status(401).json({message: 'Unauthorized'})}
    else{res.status(500).json({message: 'Could not complete operation'})}
  }
});

app.post('/:institution/zero-stock-notif', auth, async (req, res) => {
    // Sends a zero-stock notifcation to default receivers,
    // other receivers based on the item's warehouseCode, and the user.
  
  try{
    if(req?.access == process.env.RESTRICTED){throw new Error('Unauthorized')}
    const institution = req.params.institution;
    const details = {...req.body};
    await client.connect();
    const db = client.db('quaad');

    const institutions = db.collection('institutions');
    const findReceivers = await institutions.find({name: institution}).project({defaultNotifReceivers: 1, _id: 0}).toArray()
    const defaultReceivers = findReceivers[0].defaultNotifReceivers;

    const coll = db.collection(`${institution}_notification_receivers`);
    const warehouseCodes = [defaultReceivers];
    if(defaultReceivers != details.warehouseCode){
      warehouseCodes.push(details.warehouseCode)
    }
    const match = await coll.find({warehouseCode: {$in: warehouseCodes}}).project({_id: 0, email: 1}).toArray()
    const emails = [];
    match.forEach((m)=>{emails.push(m.email.toString())});
    const sendTos = [];
    emails.forEach((email)=>{
      if(email != details.user){sendTos.push(email)}
    });
    sendTos.push(details.user);
    const from = `${institution}@quaad.net`;
    res.render('notif_template.ejs', {details}, (err, html) => {
      notif(html, sendTos, from).then((notifRes)=>{
        if(notifRes != 0){throw new Error()}
        else{res.status(200).json({message: 'Success'})}
      })
    })
  }
  catch(err){
    if(err.message == 'Unauthorized'){res.status(401).json({message: 'Unauthorized'})}
    else{res.status(500).json({message: 'Could not complete operation'})}
  }
});

app.post("/print/labels/", auth, async(req, res)=>{

  try{
    const size = req.body[1];
    res.render( size == '11pt' ? 'labels.ejs' : 'labelsX2.ejs', {
      records: req.body[0],
    })
  }
  catch(err){
    console.log(err)
    res.status(500).json({message: 'Failed!'})
  }

})

app.get("/proxy/fiscal/:path/:arg", async (req, res)=>{

  fetch(`${process.env.FISCAL_API}/${req.params.path}/${req.params.arg}`)
   .then((proxyRes)=>{
       if(proxyRes.status != 200){throw new Error()}
       return proxyRes.json()
   })
   .then((proxyRes)=>{
       res.status(200).json({data: proxyRes})
   })
   .catch(()=>{
    res.status(500).json({message: 'Failed operation'})
  })

})

app.post("/register", async (req, res) => {

    try {
      await client.connect();
      await mongoose.connect(uri, {dbName: 'quaad'});  

      // Query Institutions then create user.
      const database = client.db('quaad');
      let coll = database.collection('institutions');
      const institutionInput = new RegExp(req.body.institution, 'i')
      let match = await coll.findOne({name: institutionInput});
      if(match !== null){
        try{
          const emailInput = req.body.email.toLowerCase();
          const employeeIDinput = req.body.employeeID;
          coll = database.collection('authorized_accounts');
          const modEmployeeID = `_${employeeIDinput}` 
          match = await coll.findOne({employeeID: modEmployeeID, institution: institutionInput});
          if(match !==null){
            const hash = createHmac(hAlgo, req.body.password)
            .update(hUpdate)
            .digest(hDigest)
            
            const user = new User(
              {
                ...match,
                email: emailInput,
                password: hash,
              }
            )
            user.save()
            .then(()=>{
              res.status(201).json({
                message: "User created",
              });
            })
          }
          else{
            res.status(401).json({message: 'Unauthorized account'})
          }
        }
        catch{
          res.status(500).json({message: 'Error creating user'})
        }
      }
      else{
        res.status(404).json({message: 'Institution not found'})
      } 
    }
    catch(err){
      res.status(500).json({message: 'Something went wrong!'})
    }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});