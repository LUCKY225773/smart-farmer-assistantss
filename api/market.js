// Proxies APIFarmer so the API key stays on the server.
const URL_BASE = "https://api.apifarmer.com/api/v0/commodities";

module.exports = async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed." });
    }

    const key = process.env.APIFARMER_API_KEY;
    if (!key) {
        return res.status(401).json({ error: "APIFARMER_API_KEY is not configured on the server." });
    }

    try {
        const url = new URL(URL_BASE);
        url.searchParams.set("api-key", key);
        const upstream = await fetch(url.toString());
        const data = await upstream.json().catch(() => ({}));
        res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
        return res.status(upstream.status).json(data);
    } catch (err) {
        console.error("Market proxy error:", err);
        return res.status(502).json({ error: "Market service unavailable." });
    }
};
