import jwt from "jsonwebtoken";
import "dotenv/config";

async function auth(req, res, next){
    try{
        const secretKey = process.env.SECRET_KEY;
        const token = await req.headers.authorization.split(" ")[1];
        const decodedToken = await jwt.verify(
            token, secretKey
        );
        const user = await decodedToken;
        req.user = user;
        next();
    }
    catch(err){
        res.status(401).json({message: 'Could not authorize user!'})
    }
}

export default auth;