import { ImageResponse } from '@vercel/og'

export const runtime = 'edge'

/** Open Graph 2:1 — alineado con metadatos (1200×600). Cache 24h para crawlers. */
export async function GET() {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            backgroundColor: '#0f131c',
            padding: 56,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 76,
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: -3,
                lineHeight: 1,
              }}
            >
              Agro
            </span>
            <span
              style={{
                fontSize: 76,
                fontStyle: 'italic',
                fontWeight: 600,
                color: '#39ff14',
                letterSpacing: -2,
                lineHeight: 1,
              }}
            >
              Protect
            </span>
          </div>
          <p
            style={{
              marginTop: 28,
              fontSize: 30,
              color: '#baccb0',
              maxWidth: 920,
              lineHeight: 1.35,
              marginBottom: 0,
            }}
          >
            Observación terrestre, analítica de riesgo e IA para Argentina
          </p>
          <div
            style={{
              position: 'absolute',
              bottom: 56,
              left: 56,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 140,
                height: 4,
                backgroundColor: '#39ff14',
              }}
            />
            <span style={{ fontSize: 20, color: '#85967c', fontWeight: 600 }}>
              Precision Sentinel
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 600,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      }
    )
  } catch (err) {
    console.error('OG image generation failed:', err)
    return new Response('Image generation failed', { status: 500 })
  }
}
