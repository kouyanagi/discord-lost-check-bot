import "https://deno.land/std@0.224.0/dotenv/load.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const APPLICATION_ID = Deno.env.get("APPLICATION_ID");

if (!BOT_TOKEN) throw new Error("BOT_TOKEN がありません");
if (!APPLICATION_ID) throw new Error("APPLICATION_ID がありません");

const commands = [
  {
    name: "落選確認",
    description: "このチャンネルに紐づくキャストの落選者情報を確認します",
  },
];

const url =
  `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

const res = await fetch(url, {
  method: "PUT",
  headers: {
    "Authorization": `Bot ${BOT_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

console.log(await res.text());