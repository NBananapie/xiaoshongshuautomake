import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { textRaw, dynamicPrompt } = body;

        const apiKey = process.env.VOLCENGINE_API_KEY;
        // Default model if not specified in env
        const modelEp = process.env.VOLCENGINE_MODEL_EP || "ep-20260311232904-4v8h6";

        if (!apiKey) {
            return NextResponse.json(
                { error: "API_KEY_MISSING: The server is missing the Volcengine API key in its environment variables." },
                { status: 500 }
            );
        }

        const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelEp,
                messages: [
                    { role: "system", content: dynamicPrompt },
                    { role: "user", content: textRaw },
                ],
                stream: true,
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            return new NextResponse(errorText, { status: res.status });
        }

        // Stream the readable stream directly back to the client
        return new Response(res.body, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
