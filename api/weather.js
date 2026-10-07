// Proxies OpenWeather so the API key stays on the server.
const BASE = "https://api.openweathermap.org/data/2.5";
const ALLOWED = new Set(["q", "lat", "lon", "units", "lang"]);

module.exports = async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed." });
    }

    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) {
        return res.status(401).json({ error: "OPENWEATHER_API_KEY is not configured on the server." });
    }

    const type = req.query.type === "forecast" ? "forecast" : "weather";
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
        if (ALLOWED.has(k) && typeof v === "string") params.set(k, v);
    }
    params.set("appid", key);

    try {
        const upstream = await fetch(`${BASE}/${type}?${params.toString()}`);
        const data = await upstream.json().catch(() => ({}));
        res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
        return res.status(upstream.status).json(data);
    } catch (err) {
        console.error("Weather proxy error:", err);
        return res.status(502).json({ error: "Weather service unavailable." });
    }
};
