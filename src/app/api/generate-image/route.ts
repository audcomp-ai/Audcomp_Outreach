import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!

// Try both model names — preview name first, fall back to experimental
const IMAGE_MODELS = [
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp',
]

export async function POST(req: NextRequest) {
  const { campaignId, businessName, industry, painPoints } = await req.json()

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })
  }

  const painSummary = Array.isArray(painPoints) && painPoints.length > 0
    ? painPoints.slice(0, 2).map((p: { pitch_angle: string }) => p.pitch_angle).join(', ')
    : `IT managed services for ${industry ?? 'a business'}`

  const imagePrompt = `Professional B2B marketing banner for an MSP company pitching IT services to a ${industry ?? 'business'} in Ontario, Canada.
Theme: ${painSummary}.
Style: clean, modern, corporate blue and white. Subtle technology/network imagery. No text overlays. 16:9 landscape. Photorealistic.`

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const errors: string[] = []

  for (const modelName of IMAGE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
        // @ts-expect-error responseModalities not yet in SDK types
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      })

      const parts = result.response.candidates?.[0]?.content?.parts ?? []

      for (const part of parts) {
        if ('inlineData' in part && part.inlineData) {
          const base64   = part.inlineData.data as string
          const mimeType = part.inlineData.mimeType as string
          const ext      = mimeType.includes('png') ? 'png' : 'jpg'
          const fileName = `campaign-${campaignId}-${Date.now()}.${ext}`

          const uploadResp = await fetch(
            `${SUPABASE_URL}/storage/v1/object/campaign-images/${fileName}`,
            {
              method: 'POST',
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': mimeType,
              },
              body: Buffer.from(base64, 'base64'),
            }
          )

          if (!uploadResp.ok) {
            errors.push(`Storage upload failed: ${await uploadResp.text()}`)
            continue
          }

          const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/${fileName}`

          await fetch(`${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`, {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image_url: imageUrl }),
          })

          return NextResponse.json({ imageUrl, model: modelName })
        }
      }

      // Model responded but returned no image parts — log and try next
      const textParts = parts.filter(p => 'text' in p).map(p => (p as { text: string }).text).join(' ')
      errors.push(`${modelName}: no image in response. Text: ${textParts.slice(0, 200)}`)

    } catch (err) {
      errors.push(`${modelName}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // All models failed — return full error detail so we can diagnose
  return NextResponse.json({ error: 'All image models failed', details: errors }, { status: 502 })
}
