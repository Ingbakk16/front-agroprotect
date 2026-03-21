import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, locationData }: { messages: UIMessage[]; locationData: string } = await req.json()

  const systemPrompt = `You are AgroProtect AI, an expert assistant in agricultural risk analysis for Argentina.
You have access to real-time monitoring data from agricultural zones.

CURRENT ZONE DATA:
${locationData}

Your role is:
- Analyze the risk data of the selected zone
- Provide agricultural recommendations based on indicators
- Explain what risk levels, water stress, and rain probability mean
- Suggest preventive actions according to the zone status
- Answer questions about agriculture, climate, and crop management in Argentina

Keep responses concise but informative. Use specific data when available.
Always respond in English.`

  const result = streamText({
    model: 'openai/gpt-4o-mini',
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
