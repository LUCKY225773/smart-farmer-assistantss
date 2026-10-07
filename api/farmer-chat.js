const { GoogleGenAI } = require("@google/genai");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error) {
    const status =
        error?.status ||
        error?.code ||
        error?.response?.status ||
        error?.cause?.status;

    // Gemini/API temporary errors
    if ([408, 429, 500, 502, 503, 504].includes(Number(status))) {
        return true;
    }

    const message = String(error?.message || "").toLowerCase();

    return (
        message.includes("timeout") ||
        message.includes("timed out") ||
        message.includes("temporarily unavailable") ||
        message.includes("service unavailable") ||
        message.includes("internal server error") ||
        message.includes("overloaded") ||
        message.includes("rate limit") ||
        message.includes("resource exhausted") ||
        message.includes("network")
    );
}

async function generateWithRetry(ai, contents, config) {
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Gemini request attempt ${attempt + 1}/${MAX_RETRIES + 1}`);

            const response = await ai.models.generateContent({
                model: MODEL,
                contents,
                config
            });

            return response;

        } catch (error) {
            lastError = error;

            console.error(`Gemini attempt ${attempt + 1} failed:`, {
                message: error?.message,
                status: error?.status,
                code: error?.code,
                name: error?.name
            });

            // Don't retry permanent errors
            if (!isRetryableError(error)) {
                throw error;
            }

            // No more retries
            if (attempt >= MAX_RETRIES) {
                break;
            }

            // Exponential backoff:
            // 1s → 2s → 4s
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);

            console.log(`Retrying Gemini request in ${delay}ms...`);

            await sleep(delay);
        }
    }

    throw lastError;
}

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");

        return res.status(405).json({
            success: false,
            error: "Method not allowed."
        });
    }

    try {
        const body =
            typeof req.body === "string"
                ? JSON.parse(req.body || "{}")
                : (req.body || {});

        const { question, language, crops } = body;

        // Validate question
        if (
            !question ||
            typeof question !== "string" ||
            !question.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: "Please enter a farming question."
            });
        }

        if (question.length > 1000) {
            return res.status(400).json({
                success: false,
                error: "Question is too long (max 1000 characters)."
            });
        }

        // Check API key
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error("GEMINI_API_KEY is missing.");

            return res.status(503).json({
                success: false,
                error: "GEMINI_API_KEY is not configured on the server."
            });
        }

        const ai = new GoogleGenAI({ apiKey });

        const responseLanguage =
            language === "te" ? "Telugu" : "English";

        const cropData = Array.isArray(crops)
            ? crops.slice(0, 50)
            : [];

        const systemInstruction = `
You are SmartFarm AI Farmer Assistant.

Your ONLY purpose is to help users with farming and agriculture-related questions.

Answer only in ${responseLanguage}, using simple farmer-friendly language.

ALLOWED TOPICS:
crop planning, crop selection, seeds, planting, crop growth, soil, irrigation,
water management, weather-related farming, fertilizers, manure, nutrients,
pests, crop diseases, weeds, harvesting, storage, post-harvest management,
farm records, agricultural markets, farm management, agricultural machinery,
greenhouse farming, organic farming, sustainable farming, crop rotation,
and general livestock/farm-animal management when directly related to farming.

STRICT OFF-TOPIC RULE:
If the user's actual question is NOT directly related to farming/agriculture,
DO NOT answer it. Reply EXACTLY:
"I can't help you with that. I can only help with farming and agriculture-related questions."

Do not answer programming, HTML, CSS, JavaScript, sports, movies, entertainment,
politics, gaming, shopping, travel, relationships, jokes, creative writing,
general technology, or other unrelated questions.

If farming words are present but the actual purpose is unrelated, treat it as off-topic.

For farming questions:
- Always respond in minimum possible lines like 3-4 lines.
- Give practical advice.
- Use numbered steps for processes.
- Do not invent information.
- Do not invent live weather, market prices, government announcements,
  agricultural alerts, rainfall, or current crop prices.
- If live information is requested without supplied live data, say:
"I don't have live data for this information. A live API or current data source is required."
- For crop diseases, do not give a definite diagnosis from text alone.
- For serious disease or chemical issues, recommend a qualified agricultural expert.
- Do not give unsafe pesticide/chemical mixing instructions or invented application rates.

CURRENT FARMER CROP DATA:
${JSON.stringify(cropData)}

USER QUESTION:
`;

        const contents =
            systemInstruction + "\n" + question.trim();

        const response = await generateWithRetry(
            ai,
            contents,
            {
                temperature: 0.2,
                maxOutputTokens: 500
            }
        );

        const answer = response?.text;

        console.log("Gemini response received.");

        if (!answer || !answer.trim()) {
            throw new Error("Gemini returned an empty response.");
        }

        return res.status(200).json({
            success: true,
            reply: answer.trim()
        });

    } catch (error) {
        console.error("Gemini Error:", {
            name: error?.name,
            message: error?.message,
            status: error?.status,
            code: error?.code,
            stack: error?.stack
        });

        const status =
            Number(error?.status) ||
            Number(error?.code);

        // Tell frontend that the AI service is temporarily unavailable
        // instead of pretending every problem is a generic server error.
        if ([408, 429, 500, 502, 503, 504].includes(status)) {
            return res.status(503).json({
                success: false,
                error: "The AI service is temporarily busy. Please try again in a moment."
            });
        }

        return res.status(500).json({
            success: false,
            error: "Server request failed. Please try again now."
        });
    }
};
