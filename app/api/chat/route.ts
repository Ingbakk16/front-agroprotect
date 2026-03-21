import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { google } from '@ai-sdk/google'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, locationData }: { messages: UIMessage[]; locationData: string } = await req.json()

  const systemPrompt = `You are AgroProtect AI, an expert assistant in agricultural risk analysis for Argentina.
You have access to real-time monitoring data from agricultural zones through our MCP integration.

CURRENT ZONE DATA:
${locationData}

You can query BigQuery for additional historical and real-time agricultural data through available tools.

Your role is:
- Analyze the risk data of the selected zone
- Query BigQuery when you need additional historical or comparative data
- Provide agricultural recommendations based on indicators
- Explain what risk levels, water stress, and rain probability mean
- Suggest preventive actions according to the zone status
- Answer questions about agriculture, climate, and crop management in Argentina

Keep responses concise but informative. Use specific data when available.
Always respond in English.`

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
    // MCP tools will be added here when the MCP server is set up
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
