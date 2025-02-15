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


////////////////////////////////////// POSTS ////////////////////////////////////////////

// Test auth 
app.post('/auth-endpoint', auth, (req, res)=>{
  res.status(200).json(req.user);
})

app.post("/login", async(req, res)=>{

  try{
    await client.connect();
    const database = client.db('quaad');
    const coll = database.collection('users');
    const cursor = coll.find({email: req.body.email}, {});
    const match = (await cursor.toArray());
    const storedPass = match[0].password;

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
        { expiresIn: "8h" , algorithm: 'HS256'}
      )
      res.status(200).send({
        message: "Login Successful",
        email: req.body.email.toLowerCase(),
        token,
      });
    }
    else{
      res.status(404).json({message: 'Entries do not exist'});
    }
  }
  catch{
    res.status(500).send('Login error')
  }
})

// Submit inventory pick with email notification.
app.post('/pick', auth, async (req, res) => {
  try{
  const parts = [...req.body];
  const technicianInfo = parts[0].technicianInfo;
  res.render('notif_template.ejs', {parts: parts, technicianInfo: technicianInfo}, (err, html) => {
    pickNotif(html).then(res.status(200).json({message: 'Submitted'}))
  })
  }
  catch{
    res.status(500).json({message: 'Failed to submit'})
  }
});

// Register new user.
app.post("/register", async (req, res) => {

    try {
      // Using Mongo for quieries.
      await client.connect();
      
      // using Mongoose for validations...Mongoose queries are not promises.
      await mongoose.connect(uri, {dbName: 'quaad'});  

      // Query Institution then create user.
      const database = client.db('quaad');
      let coll = database.collection('institutions');
      const institutionInput = req.body.institution.toLowerCase();
      let cursor = await coll.find({name: institutionInput}, {});
      let match = (await cursor.toArray()).length;
      if(match>0){
        try{
          const emailInput = req.body.email.toLowerCase();
          coll = database.collection('authorized_accounts');
          //Note: Authorized users will already have an email account in db.
          match = await coll.findOne({email: emailInput});
          if(match !==null){
            if(match.email== emailInput){
              const hash = createHmac('sha256', req.body.password)
              .update('QuaCartoon1!')
              .digest('hex')
              
              const user = new User(
                {
                  email: emailInput,
                  password: hash,
                  institution: institutionInput,
                  firstName: req.body.firstName,
                  lastName: req.body.lastName,
                  employeeID: req.body.employeeID
                }
              )
              user.save()
              .then(()=>{res.status(201).send('New user created')})
            }
            else{
              res.status(401).send('Unauthorized account') // Shouldn't occur here!
            }
          }
          else{
            res.status(401).send('Unauthorized account')
          }
        }
        catch{
          res.status(500).send('Error creating user')
        }
      }
      else{
        res.status(404).send('Institution not found')
      } 
    }
    catch(err) {
      res.status(500).send('Something went wrong')
    }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});