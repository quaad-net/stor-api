import express from "express";
import cors from "cors";
import apiRouter from "./routes/api.js";
import pickNotif from "./email/notif.js";
import "dotenv/config";
import User from "./db/userModel.js";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import jwt from 'jsonwebtoken';
const { createHmac } = await import('node:crypto');
import auth from "./auth.js";

const uri = process.env.ATLAS_URI;
const client = new MongoClient(uri);

const PORT = process.env.PORT || 5050;
const app = express();

app.use(cors());
app.use(express.json());
app.use("/", apiRouter);
app.use(express.static('public'));

app.set('view engine', 'ejs');

// Test auth 
app.post('/auth-endpoint', auth, (req, res)=>{
  res.status(200).json(req.user);
})

// Checks if user is trying to register with an account that already exists.
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

    const hash = createHmac('sha256', req.body.password)
    .update('QuaCartoon1!')
    .digest('hex')

    if(hash == storedPass){
      const secretKey = process.env.SECRET_KEY;
      const token = jwt.sign(
        {
          payload: req.body.email.toLowerCase(),
        }, 
        secretKey,
        { expiresIn: "12h" , algorithm: 'HS256'}
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

// Submit inventory pick with email notification.
// app.post('/pick', auth, async (req, res) => {
  
//   try{
//     const parts = [...req.body];
//     const technicianInfo = parts[0].technicianInfo;
//     res.render('notif_template.ejs', {parts: parts, technicianInfo: technicianInfo}, (err, html) => {
//       pickNotif(html).then(res.status(200).json({message: 'Submitted'}))
//     })
//   }
//   catch{
//     res.status(500).json({message: 'Failed to submit'})
//   }
// });

app.post("/print/labels/", auth, async(req, res)=>{

  try{
    res.render('labels.ejs', {
      records: req.body
    })
  }
  catch(err){
    res.status(500).json({message: 'Failed!'})
  }

})

// Register new user.
app.post("/register", async (req, res) => {

    try {
      await client.connect();
      
      // Using Mongoose for validations only
      // Note: Mongoose queries are not promises.
      await mongoose.connect(uri, {dbName: 'quaad'});  

      // Query Institution then create user.
      const database = client.db('quaad');
      let coll = database.collection('institutions');
      const institutionInput = new RegExp(req.body.institution, 'i')
      let match = await coll.findOne({name: institutionInput});
      if(match !== null){
        try{
          const emailInput = req.body.email.toLowerCase();
          const employeeIDinput = req.body.employeeID;
          coll = database.collection('authorized_accounts');
          // Note: Authorized users will already have an account in "authorized_accounts" collection in db.
          const modEmployeeID = `_${employeeIDinput}` // note _
          match = await coll.findOne({employeeID: modEmployeeID, institution: institutionInput});
          if(match !==null){
            const hash = createHmac('sha256', req.body.password)
            .update('QuaCartoon1!')
            .digest('hex')
            
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