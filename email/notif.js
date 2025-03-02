import "dotenv/config";
import { response } from "express";
import * as postmark from "postmark";
const serverToken = process.env.POSTMARK_TOKEN;
let client = new postmark.ServerClient(serverToken);

export default async function pickNotif(html){
    await client.sendEmail(
        {
            From: "uwm@quaad.net",
            To: "eukoh@quaad.net",
            Subject: "Inventory Pick",
            HtmlBody: html.toString(),
        }
    )
}