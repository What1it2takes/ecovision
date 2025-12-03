# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI** (optional): `npm i -g vercel`
3. **Git Repository**: Push your code to GitHub/GitLab/Bitbucket

## Environment Variables

Set these in Vercel Dashboard → Project Settings → Environment Variables:

### Required:
- `OPENAI_API_KEY` - Your OpenAI API key (for high-accuracy mode)
- `NODE_ENV` - Set to `production`

### Optional:
- `FRONTEND_URL` - Your frontend URL (for CORS, defaults to `*`)

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Configure project:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (root of repo)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `npm install`
4. Add environment variables
5. Click **Deploy**

### Option 2: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

## Project Structure

```
.
├── api/              # Vercel serverless functions
│   ├── detect.js     # /api/detect endpoint
│   └── health.js     # /api/health endpoint
├── frontend/         # React frontend
│   ├── dist/         # Build output (generated)
│   └── ...
├── backend/          # Backend source code
│   ├── models/       # ONNX model files
│   └── src/          # Source code
└── vercel.json       # Vercel configuration
```

## Important Notes

### Model Files
- The ONNX model (`yolov8-waste.onnx`) must be uploaded to Vercel
- Ensure `backend/models/yolov8-waste.onnx` is committed to Git
- Model size: ~50MB (may require Vercel Pro plan for larger deployments)

### Serverless Function Limits
- **Max Duration**: 30 seconds (configured in vercel.json)
- **Memory**: 3008 MB (configured in vercel.json)
- **Request Size**: 50MB limit for API routes

### Performance Optimizations

1. **Frontend**:
   - Code splitting enabled
   - Assets cached with long TTL
   - Service Worker for offline support
   - PWA enabled

2. **Backend**:
   - Model loaded on cold start (first request may be slower)
   - Consider using Vercel Edge Functions for faster response times

## Troubleshooting

### Build Fails
- Check Node.js version (should be 18+)
- Ensure all dependencies are in package.json
- Check build logs in Vercel dashboard

### API Routes Not Working
- Verify `api/` folder structure
- Check function logs in Vercel dashboard
- Ensure environment variables are set

### Model Not Loading
- Verify model file path: `backend/models/yolov8-waste.onnx`
- Check file size limits
- Ensure model is committed to Git

### CORS Errors
- Set `FRONTEND_URL` environment variable
- Check API route CORS headers

## Post-Deployment

1. Test all endpoints:
   - `/api/health` - Should return `{ ok: true }`
   - `/api/detect` - Should process images
   - `/api/detect/status` - Should show model status

2. Verify PWA:
   - Check manifest.json
   - Test service worker
   - Verify offline functionality

3. Monitor:
   - Check Vercel Analytics
   - Monitor function execution times
   - Watch for errors in logs

## Cost Considerations

- **Free Tier**: 100GB bandwidth, 100 hours function execution
- **Pro Tier**: Recommended for production (unlimited bandwidth, better performance)
- **Model Size**: Large ONNX model may require Pro plan

## Support

For issues:
1. Check Vercel logs: Dashboard → Project → Functions
2. Review build logs: Dashboard → Project → Deployments
3. Check function metrics: Dashboard → Project → Analytics

