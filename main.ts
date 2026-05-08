import "https://deno.land/std@0.224.0/dotenv/load.ts";
import nacl from "tweetnacl";

const GAS_WEB_APP_URL = Deno.env.get("GAS_WEB_APP_URL");
const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY");

if (!GAS_WEB_APP_URL) throw new Error("GAS_WEB_APP_URL がありません");
if (!DISCORD_PUBLIC_KEY) throw new Error("DISCORD_PUBLIC_KEY がありません");

function hexToUint8Array(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();

  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

async function verifyDiscordRequest(req: Request, rawBody: string): Promise<boolean> {
  const signature = req.headers.get("X-Signature-Ed25519");
  const timestamp = req.headers.get("X-Signature-Timestamp");

  if (!signature || !timestamp) {
    return false;
  }

  const message = new TextEncoder().encode(timestamp + rawBody);
  const signatureBytes = hexToUint8Array(signature);
  const publicKeyBytes = hexToUint8Array(DISCORD_PUBLIC_KEY);

  return nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK");
  }

  const rawBody = await req.text();

  const isValid = await verifyDiscordRequest(req, rawBody);

  if (!isValid) {
    return new Response("invalid request signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  if (body.type === 1) {
    return Response.json({ type: 1 });
  }

  const commandName = body.data?.name;

  if (commandName === "落選確認") {
    const channelId = body.channel_id;

    const gasUrl =
      `${GAS_WEB_APP_URL}?mode=lostCheck&channelId=${encodeURIComponent(channelId)}`;

    const gasRes = await fetch(gasUrl);
    const gasData = await gasRes.json();

    return Response.json({
      type: 4,
      data: {
        content: gasData.message || "落選者情報を取得できませんでした。",
      },
    });
  }

  return Response.json({
    type: 4,
    data: {
      content: "未対応のコマンドです。",
    },
  });
});