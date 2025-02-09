import jwt from "jsonwebtoken";

async function auth(req, res, next){

    try{
        const token = await req.headers.authorization.split(" ")[1];
        const decodedToken = await jwt.verify(
            token,
            "RANDOM-TOKEN"
        );
        const user = await decodedToken;
        req.user = user;
        next(); //passes to next handler
    }
    catch(err){
        res.status(401).send('Could not authenticate user');
    }

}

export default auth;