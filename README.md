# SmartFarm Assistant

An AI- and data-powered farmer assistant: dashboard, crop planner, irrigation,
weather, market prices, farm records and a Gemini-powered farming chatbot
(English / Telugu).

## Structure

```
public/          Static frontend (HTML, CSS, JS, images)
api/
  farmer-chat.js Gemini chatbot endpoint      POST /api/farmer-chat
  weather.js     OpenWeather proxy            GET  /api/weather
  market.js      APIFarmer proxy              GET  /api/market
  health.js      Config status check          GET  /api/health
vercel.json      Vercel config
```

API keys are kept server-side only and are never shipped to the browser.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New → Project → Import** the repo.
3. Leave the framework preset as **Other**. No build command is needed;
   Vercel serves `public/` and deploys `api/` as serverless functions.
4. Add environment variables (Settings → Environment Variables):
   | Name | Required | Purpose |
   |---|---|---|
   | `GEMINI_API_KEY` | yes | Chatbot |
   | `OPENWEATHER_API_KEY` | yes | Weather page |
   | `APIFARMER_API_KEY` | optional | Market prices page |
5. Deploy (or redeploy after adding variables). Visit `/api/health` to confirm.

## Local development

```bash
npm i -g vercel
npm install
cp .env.example .env.local   # fill in your keys
vercel dev
```
