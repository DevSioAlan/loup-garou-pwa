import { NextRequest, NextResponse } from "next/server";

function addWavHeader(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Uint8Array {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return new Uint8Array(Buffer.concat([header, pcmBuffer]));
}

function parseSampleRate(mimeType: string): number {
  const match = mimeType.match(/rate=(\d+)/i);
  if (match && match[1]) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed >= 8000 && parsed <= 48000) {
      return parsed;
    }
  }
  return 24000;
}

/**
 * Route API Next.js /api/tts :
 * - Utilise prioritairement GEMINI_API_KEY (gemini-2.5-flash-preview-tts, voix féminine naturelle Aoede)
 *   ou GOOGLE_CLOUD_TTS_API_KEY (fr-FR-Neural2-A / Studio) si configurée.
 * - Retourne { fallback: true } (200) si aucune clé n'est configurée ou en cas d'indisponibilité
 *   afin de basculer sans latence sur Web Speech API féminine.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      text?: unknown;
      voice?: unknown;
      tone?: unknown;
    } | null;
    const rawText = typeof body?.text === "string" ? body.text.trim() : "";

    if (!rawText) {
      return NextResponse.json({ fallback: true }, { status: 200 });
    }

    const text = rawText.slice(0, 600);
    const voiceName = body?.voice === "Kore" ? "Kore" : "Aoede";
    const tone =
      body?.tone === "day" || body?.tone === "victory" ? body.tone : "night";
    const styleDirective =
      tone === "victory"
        ? "Lis à voix haute en français avec une voix féminine naturelle, lumineuse, chaleureuse et solennelle, en marquant une belle pause finale :"
        : tone === "day"
          ? "Lis à voix haute en français avec une voix féminine naturelle, claire, posée et engageante, avec des intonations vivantes :"
          : "Lis à voix haute en français ce texte de Maître du Jeu de Loup-Garou avec une voix féminine naturelle, posée, calme et immersive, avec des pauses respirées :";
    const promptText = `${styleDirective}\n\n${text}`;
    const cloudTtsKey = process.env.GOOGLE_CLOUD_TTS_API_KEY?.trim();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();

    if (cloudTtsKey) {
      const cloudRes = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(cloudTtsKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(7000),
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: "fr-FR",
              name: "fr-FR-Neural2-A",
              ssmlGender: "FEMALE",
            },
            audioConfig: {
              audioEncoding: "MP3",
              speakingRate: 0.96,
              pitch: 0.0,
            },
          }),
        }
      );

      if (cloudRes.ok) {
        const payload = (await cloudRes.json()) as { audioContent?: string };
        if (payload.audioContent) {
          const mp3Bytes = new Uint8Array(
            Buffer.from(payload.audioContent, "base64")
          );
          return new NextResponse(mp3Bytes, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
      }
    }

    if (!geminiKey) {
      return NextResponse.json({ fallback: true }, { status: 200 });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(9000),
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      return NextResponse.json({ fallback: true }, { status: 200 });
    }

    const data = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { mimeType?: string; data?: string };
          }>;
        };
      }>;
    };

    const inlinePart = data.candidates?.[0]?.content?.parts?.find(
      (part) => Boolean(part.inlineData?.data)
    );
    const base64Audio = inlinePart?.inlineData?.data;
    const mimeType = inlinePart?.inlineData?.mimeType ?? "audio/L16;rate=24000";

    if (!base64Audio) {
      return NextResponse.json({ fallback: true }, { status: 200 });
    }

    const rawBytes = Buffer.from(base64Audio, "base64");
    const lowerMime = mimeType.toLowerCase();
    const isRawPcm =
      lowerMime.includes("pcm") ||
      lowerMime.includes("l16") ||
      !lowerMime.includes("wav");

    const responseBytes = isRawPcm
      ? addWavHeader(rawBytes, parseSampleRate(mimeType), 1, 16)
      : new Uint8Array(rawBytes);

    return new NextResponse(responseBytes.slice().buffer, {
      status: 200,
      headers: {
        "Content-Type": isRawPcm ? "audio/wav" : mimeType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
