# 🚀 Quick Vercel Deployment Guide

## ⚡ Quick Start

1. **Push to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Optimized for Vercel deployment"
   git push
   ```

2. **Deploy to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Vercel will auto-detect settings from `vercel.json`

3. **Set Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add: `OPENAI_API_KEY` (your OpenAI API key)
   - Add: `NODE_ENV=production`

4. **Deploy!** 🎉

## 📋 What's Optimized

✅ **Frontend**:
- Code splitting for smaller bundles
- Asset optimization and caching
- PWA support with service worker
- Production-ready build config

✅ **Backend**:
- Serverless functions in `/api` folder
- Optimized for Vercel's serverless environment
- 30s timeout, 3GB memory allocation
- CORS configured

✅ **Performance**:
- Long-term caching for static assets
- Service worker for offline support
- Optimized bundle sizes

## 🔧 Manual Deployment (CLI)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Production deploy
vercel --prod
```

## ⚠️ Important Notes

1. **Model File**: Ensure `backend/models/yolov8-waste.onnx` is committed (may be large ~50MB)
2. **Environment Variables**: Set `OPENAI_API_KEY` in Vercel dashboard
3. **First Request**: May be slower due to cold start (model loading)
4. **File Size Limits**: API accepts up to 50MB per request

## 📊 Project Structure

```
.
├── api/              # Vercel serverless functions
│   ├── detect.js     # Waste detection endpoint
│   └── health.js     # Health check
├── frontend/         # React app (builds to dist/)
├── backend/          # Backend source code
└── vercel.json       # Vercel configuration
```

## 🐛 Troubleshooting

**Build fails?**
- Check Node.js version (18+)
- Verify all dependencies in package.json
- Check build logs in Vercel dashboard

**API not working?**
- Verify environment variables are set
- Check function logs in Vercel dashboard
- Ensure model file is in `backend/models/`

**CORS errors?**
- Set `FRONTEND_URL` environment variable
- Check API route CORS headers

## 📖 Full Documentation

See `DEPLOYMENT.md` for detailed deployment guide.

