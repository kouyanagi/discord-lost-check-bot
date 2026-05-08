type DiscordCommandData = {
  name?: string;
};

type DiscordInteraction = {
  type?: number;
  data?: DiscordCommandData;
  channel_id?: string;
  application_id?: string;
  token?: string;
};

type GasResponse = {
  ok?: boolean;
  message?: string;
};

type EdgeRuntimeLike = {
  waitUntil: (promise: Promise<void>) => void;
};

const GAS_WEB_APP_URL = Deno.env.get("GAS_WEB_APP_URL");

if (!GAS_WEB_APP_URL) {
  throw new Error("GAS_WEB_APP_URL がありません");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getEdgeRuntime(): EdgeRuntimeLike | undefined {
  const runtime = (globalThis as { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime;
  return runtime;
}

async function updateOriginalResponse(
  applicationId: string,
  interactionToken: string,
  content: string,
): Promise<void> {
  const url =
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`;

  await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
    }),
  });
}

async function handleLostCheck(body: DiscordInteraction): Promise<void> {
  const channelId = String(body.channel_id ?? "");
  const applicationId = String(body.application_id ?? "");
  const interactionToken = String(body.token ?? "");

  try {
    const gasUrl =
      `${GAS_WEB_APP_URL}?mode=lostCheck&channelId=${encodeURIComponent(channelId)}`;

    const gasRes = await fetch(gasUrl);
    const text = await gasRes.text();

    let gasData: GasResponse;

    try {
      gasData = JSON.parse(text) as GasResponse;
    } catch {
      await updateOriginalResponse(
        applicationId,
        interactionToken,
        `GASからJSON以外の返答がありました。\n\n${text.slice(0, 1000)}`,
      );
      return;
    }

    await updateOriginalResponse(
      applicationId,
      interactionToken,
      gasData.message || "落選者情報を取得できませんでした。",
    );
  } catch (error) {
    await updateOriginalResponse(
      applicationId,
      interactionToken,
      `エラーが発生しました：${getErrorMessage(error)}`,
    );
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("OK");
  }

  const body = await req.json() as DiscordInteraction;

  // DiscordのPING確認
  if (body.type === 1) {
    return Response.json({ type: 1 });
  }

  const commandName = body.data?.name ?? "";

  if (commandName === "落選確認") {
    const task = handleLostCheck(body);

    const edgeRuntime = getEdgeRuntime();

    if (edgeRuntime) {
      edgeRuntime.waitUntil(task);
    } else {
      task.catch((error) => {
        console.error("handleLostCheck error:", getErrorMessage(error));
      });
    }

    return Response.json({
      type: 5,
      data: {
        content: "落選者情報を確認中です…",
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