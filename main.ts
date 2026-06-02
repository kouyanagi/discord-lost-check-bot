import nacl from "tweetnacl";

const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") ?? "";
const GAS_URL = Deno.env.get("GAS_WEB_APP_URL") ?? "";

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

async function updateOriginalResponse(
  applicationId: string,
  token: string,
  content: string,
) {
  await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
      }),
    },
  );
}

Deno.serve(async (request) => {
  const { ok, body } = await verifyDiscordRequest(request);

  if (!ok) {
    return new Response("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body);

  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

const applicationId = interaction.application_id;
const token = interaction.token;
const channelId = interaction.channel_id;

const commandName =
  interaction.data?.name ?? "";

  // 先にDiscordへ応答する
  setTimeout(async () => {
   try {

     let mode = "lostCheck";

     switch (commandName) {
       case "応募者一覧":
        mode = "applicantList";
        break;

       case "落選確認":
        default:
        mode = "lostCheck";
        break;
      }

     const gasResponse = await fetch(
       `${GAS_URL}?mode=${mode}&channelId=${channelId}`,
     );

     const data = await gasResponse.json();

     await updateOriginalResponse(
      applicationId,
      token,
      data.message ?? "取得できませんでした。",
    );

  } catch (e) {

    await updateOriginalResponse(
      applicationId,
      token,
      `エラーが発生しました：${
        e instanceof Error ? e.message : String(e)
      }`,
    );

  }
}, 0);

  // 3秒以内に「考え中」で返す
  return Response.json({
    type: 5,
    data: {
      flags: 64,
    },
  });
});