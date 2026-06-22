import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, expectedDocumentType, language = "uz" } = await req.json();

    if (!imageBase64 || !expectedDocumentType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Document type descriptions for AI context
    const documentDescriptions: Record<string, { uz: string; en: string; ru: string }> = {
      // Current slot IDs (new format after document slot separation)
      applicant_id_card: {
        uz: "Topshiruvchining ID karta (mahalliy pasport)",
        en: "Applicant's ID card (national passport)",
        ru: "ID-карта заявителя (внутренний паспорт)"
      },
      foreign_passport: {
        uz: "Topshiruvchining xalqaro pasporti (zagran pasport)",
        en: "Applicant's foreign passport (international)",
        ru: "Загранпаспорт заявителя (международный)"
      },
      father_id_card: {
        uz: "Otaning ID karta (mahalliy pasport)",
        en: "Father's ID card (national passport)",
        ru: "ID-карта отца (внутренний паспорт)"
      },
      father_foreign_passport: {
        uz: "Otaning xalqaro pasporti (zagran pasport)",
        en: "Father's foreign passport (international)",
        ru: "Загранпаспорт отца (международный)"
      },
      mother_id_card: {
        uz: "Onaning ID karta (mahalliy pasport)",
        en: "Mother's ID card (national passport)",
        ru: "ID-карта матери (внутренний паспорт)"
      },
      mother_foreign_passport: {
        uz: "Onaning xalqaro pasporti (zagran pasport)",
        en: "Mother's foreign passport (international)",
        ru: "Загранпаспорт матери (международный)"
      },
      // Legacy slot IDs (kept for backwards compatibility)
      applicant_passport: {
        uz: "Topshiruvchining ID karta (pasport) yoki zagran pasporti",
        en: "Applicant's ID card (passport) or foreign passport",
        ru: "ID-карта (паспорт) или загранпаспорт заявителя"
      },
      parent_passport: {
        uz: "Ota-ona pasport yoki ID karta",
        en: "Parent's passport or ID card",
        ru: "Паспорт или ID-карта родителей"
      },
      birth_certificate: {
        uz: "Tug'ilganlik haqida guvohnoma (Metrka)",
        en: "Birth certificate",
        ru: "Свидетельство о рождении (Метрика)"
      },
      language_certificate: {
        uz: "Til sertifikati (IELTS, TOPIK)",
        en: "Language certificate (IELTS, TOPIK)",
        ru: "Языковой сертификат (IELTS, TOPIK)"
      },
      photo: {
        uz: "Hujjat uchun rasm (3.5x4.5)",
        en: "Document photo (3.5x4.5 cm)",
        ru: "Фото для документов (3.5x4.5 см)"
      },
      diploma: {
        uz: "Diplom yoki attestat",
        en: "Diploma or certificate",
        ru: "Диплом или аттестат"
      },
      bank_statement: {
        uz: "Bank ma'lumotnomasi",
        en: "Bank statement",
        ru: "Банковская справка"
      },
      recommendation: {
        uz: "Tavsiyanoma",
        en: "Recommendation letter",
        ru: "Рекомендательное письмо"
      },
      autobiography: {
        uz: "Avtobiografiya va o'qish reja",
        en: "Autobiography and study plan",
        ru: "Автобиография и план обучения"
      }
    };

    const docDesc = documentDescriptions[expectedDocumentType] || {
      uz: expectedDocumentType,
      en: expectedDocumentType,
      ru: expectedDocumentType
    };

    const systemPrompt = `You are a document validation AI for a Korean university application system. Your job is to:

1. Verify if the uploaded image matches the expected document type
2. Check if the document is properly scanned (not a phone photo of a document)
3. Check if the quality is acceptable (readable, not blurry, proper lighting)
4. Check if the document appears to be complete and not cropped

Expected document: ${docDesc.en}

IMPORTANT QUALITY CRITERIA:
- Document should be a SCAN, not a photo taken with a phone camera
- Signs of phone photo: visible shadows, uneven lighting, perspective distortion, visible fingers/hands, background visible, document edges at angles
- Signs of proper scan: even lighting, flat document, no shadows, document fills the frame properly, high contrast text
- Text should be clearly readable
- No blur or motion blur
- Document should not be cropped or cut off
- For photos (3.5x4.5): should be a professional ID photo, not a selfie

Respond in ${language === 'ru' ? 'Russian' : language === 'en' ? 'English' : 'Uzbek'} language.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this document image and determine:
1. Is this the correct document type (${docDesc.en})?
2. Is this a proper scan or a phone photo?
3. Is the quality acceptable?
4. Is the document complete and readable?

Provide your analysis using the validate_document function.`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "validate_document",
              description: "Validate document quality and type",
              parameters: {
                type: "object",
                properties: {
                  isValid: {
                    type: "boolean",
                    description: "Whether the document passes all validation checks"
                  },
                  isCorrectType: {
                    type: "boolean",
                    description: "Whether the document matches the expected type"
                  },
                  isProperScan: {
                    type: "boolean",
                    description: "Whether the document is a proper scan (not a phone photo)"
                  },
                  isGoodQuality: {
                    type: "boolean",
                    description: "Whether the document quality is acceptable"
                  },
                  isComplete: {
                    type: "boolean",
                    description: "Whether the document is complete and not cropped"
                  },
                  issues: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of specific issues found with the document"
                  },
                  suggestions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Suggestions for how to fix the issues"
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence score from 0 to 100"
                  }
                },
                required: ["isValid", "isCorrectType", "isProperScan", "isGoodQuality", "isComplete", "issues", "suggestions", "confidence"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "validate_document" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service quota exceeded." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI validation failed");
    }

    const data = await response.json();
    
    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "validate_document") {
      throw new Error("Invalid AI response format");
    }

    let validationResult;
    try {
      validationResult = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error("Failed to parse AI tool call arguments:", parseError);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI validation response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(validationResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Document validation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Validation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});