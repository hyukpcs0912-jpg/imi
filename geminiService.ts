import { GoogleGenAI, Type } from "@google/genai";
import { CopySuggestion } from "../types";

// Optimize image to reduce token usage (mitigate 429 errors)
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
            // Resize logic to limit token usage
            const MAX_DIMENSION = 1024;
            let width = img.width;
            let height = img.height;
            
            // Only resize if significantly larger
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                if (width > height) {
                    height = Math.round((height * MAX_DIMENSION) / width);
                    width = MAX_DIMENSION;
                } else {
                    width = Math.round((width * MAX_DIMENSION) / height);
                    height = MAX_DIMENSION;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                // Use JPEG with 0.8 quality for good balance of size/quality
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8); 
                resolve(dataUrl.split(',')[1]);
            } else {
                reject(new Error("Canvas context failed"));
            }
        };
        img.onerror = (e) => reject(e);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Helper: Wait function for delay
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper: Retry operation with exponential backoff
 * Default retries set to 0 as per user request (fail fast).
 */
async function retryOperation<T>(operation: () => Promise<T>, retries = 0, delay = 2000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const msg = error?.message || "";
    // Check for 429 or quota related errors
    const isQuotaError = msg.includes("429") || msg.includes("quota") || msg.includes("resource has been exhausted") || error.status === 429;
    
    if (retries > 0 && isQuotaError) {
      console.warn(`Gemini API Quota limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
      await wait(delay);
      return retryOperation(operation, retries - 1, delay * 2); // Double the delay for next retry
    }
    throw error;
  }
}

/**
 * Step 0: Validate API Key (Lightweight call)
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
    const ai = new GoogleGenAI({ apiKey });
    try {
        // Very minimal call just to check authentication and basic access
        await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: 'Hi' }] },
            config: { maxOutputTokens: 1 }
        });
        return true;
    } catch (error) {
        throw error;
    }
}

/**
 * Step 1: Analyze product and suggest background + copy
 */
export async function analyzeProductAndSuggest(apiKey: string, base64Image: string, specialRequest: string = ""): Promise<{ backgroundPrompts: string[]; copies: CopySuggestion[] }> {
  // Debug log to confirm which key is being used
  console.log(`[Gemini Service] Initializing analyzeProductAndSuggest with API Key starting: ${apiKey.substring(0, 8)}...`);
  
  const ai = new GoogleGenAI({ apiKey });
  
  const operation = async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', 
              data: base64Image
            }
          },
          {
            text: `
              이 제품 이미지를 분석해주세요.
              
              ${specialRequest ? `[사용자 특별 요청 사항]: "${specialRequest}"\n(이 요청을 최우선으로 반영하되, 4가지 서로 다른 스타일로 변주해주세요.)` : ''}

              Task 1. 배경 생성 프롬프트 4개 작성 (영어)
              이 제품이 가장 매력적으로 보일 수 있는 구매 전환율이 높은 배경(Context) 4가지를 각각 다르게 묘사해주세요.
              각 프롬프트는 1문장으로 작성하세요.
              
              1. Minimalist/Studio (깔끔하고 모던한 스튜디오 조명)
              2. Lifestyle/Context (실제 사용되는 자연스러운 환경)
              3. Nature/Organic (자연물이나 야외 분위기 활용)
              4. Creative/Luxury (고급스럽거나 창의적인 연출)
              
              ${specialRequest ? `단, 사용자의 요청("${specialRequest}")을 모든 컨셉에 반영하되 스타일을 다르게 해석하세요.` : ''}

              Task 2. 마케팅 카피 생성 (한국어)
              제품 상세페이지의 '히어로 이미지(메인 배너)'에 들어갈 아주 짧고 강렬한 카피를 작성해주세요.
              
              [필수 제약 조건]
              1. **모든 카피는 공백 포함 30자 이내**여야 합니다. (가독성 최우선)
              2. 설명문이 아니라, 즉시 클릭을 유도하는 'Hook'이어야 합니다.
              3. 다음 5명의 전설적인 카피라이터 페르소나를 완벽히 모사하세요.

              1) Donald Miller 스타일:
              - 핵심: 고객이 주인공이 되는 짧은 한 마디.
              - 예시: "당신의 피부, 오늘부터 다시 태어납니다."

              2) David Ogilvy 스타일:
              - 핵심: 구체적 수치나 팩트로 신뢰를 주는 헤드라인.
              - 예시: "소음은 90% 줄고, 집중은 2배로."

              3) Eugene Schwartz 스타일:
              - 핵심: 지금 당장 사야 할 욕구를 자극하는 긴박함.
              - 예시: "지금 놓치면 1년을 기다려야 합니다."

              4) Gary Halbert 스타일:
              - 핵심: 친구에게 말하듯 툭 던지는 도발적인 질문.
              - 예시: "아직도 비싼 돈 내고 배우시나요?"

              5) Claude Hopkins 스타일:
              - 핵심: "왜 좋은지"에 대한 가장 강력한 이유 하나.
              - 예시: "특허받은 공법으로 쓴맛을 잡았습니다."

              응답은 다음 JSON 스키마를 따라주세요:
              {
                "backgroundPrompts": ["prompt1", "prompt2", "prompt3", "prompt4"],
                "copies": [
                  { "style": "Donald Miller 스타일", "text": "30자 이내 카피" },
                  { "style": "David Ogilvy 스타일", "text": "30자 이내 카피" },
                  ...
                ]
              }
            `
          }
        ],
      },
      config: {
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            backgroundPrompts: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            copies: { 
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT,
                properties: {
                  style: { type: Type.STRING },
                  text: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No response text from Gemini");
  };

  try {
    // Wrap with retry logic
    return await retryOperation(operation);
  } catch (error) {
    console.error("Error analyzing product:", error);
    throw error;
  }
}

/**
 * Step 2: Generate background image preserving the product
 * Generates 4 variations based on provided prompts.
 */
export async function generateProductBackground(apiKey: string, base64Image: string, prompts: string[], aspectRatio: string = "1:1"): Promise<string[]> {
  // Debug log to confirm which key is being used
  console.log(`[Gemini Service] Initializing generateProductBackground with API Key starting: ${apiKey.substring(0, 8)}...`);
  
  const ai = new GoogleGenAI({ apiKey });

  const generateSingle = async (prompt: string) => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          },
          {
            text: `Keep the product in the foreground exactly as is. Change the background to: ${prompt}. Professional advertising photography, photorealistic, high quality, 4k.`
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio
        }
      }
    });

    // Check for image in response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image generated");
  };

  try {
    // Generate 4 images in parallel using the provided prompts
    // Ensure we have at least 4 prompts by cycling if necessary, though analyze step should provide 4
    const promises = Array(4).fill(null).map((_, i) => {
        const prompt = prompts[i % prompts.length];
        return retryOperation(() => generateSingle(prompt), 2);
    });
    return await Promise.all(promises);
  } catch (error) {
    console.error("Error generating backgrounds:", error);
    throw error;
  }
}