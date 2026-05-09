import nacl from "npm:tweetnacl";

const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") ?? "";
const GAS_URL = Deno.env.get("GAS_URL") ?? "";

const encoder = new TextEncoder();

function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(
    hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
  );
}

async function verifyDiscordRequest(request: Request) {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");

  if (!signature || !timestamp || !DISCORD_PUBLIC_KEY) {
    return { ok: false, body: "" };
  }

  const body = await request.text();

  const isVerified = nacl.sign.detached.verify(
    encoder.encode(timestamp + body),
    hexToUint8Array(signature),
    hexToUint8Array(DISCORD_PUBLIC_KEY),
  );

  return { ok: isVerified, body };
}

Deno.serve(async (request) => {
  const { ok, body } = await verifyDiscordRequest(request);

  if (!ok) {
    return new Response("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body);

  // Discordの接続確認
  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

  // /落選確認
  const channelId = interaction.channel_id;

  const gasResponse = await fetch(
    `${GAS_URL}?mode=lostCheck&channelId=${channelId}`,
  );

  const data = await gasResponse.json();

  return Response.json({
    type: 4,
    data: {
      content: data.message ?? "取得できませんでした。",
      flags: 64,
    },
  });
});