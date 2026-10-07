module.exports = function handler(req, res) {
    res.status(200).json({
        success: true,
        message: "SmartFarm API is running.",
        chatbotReady: Boolean(process.env.GEMINI_API_KEY),
        weatherReady: Boolean(process.env.OPENWEATHER_API_KEY),
        marketReady: Boolean(process.env.APIFARMER_API_KEY)
    });
};
