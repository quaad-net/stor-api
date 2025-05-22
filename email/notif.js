import "dotenv/config";
import * as postmark from "postmark";
const serverToken = process.env.POSTMARK_TOKEN;
let client = new postmark.ServerClient(serverToken);

export default async function notif(html, sendTo, from){
    const emailNotif = await client.sendEmail(
        {
            From: from,
            To: "eukoh@quaad.net",  // replace "eukoh@quaad.net" with sendTo
            Subject: "Inventory Notification",
            HtmlBody: html.toString()
        }
    )
    return emailNotif.ErrorCode
}