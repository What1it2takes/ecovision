# Troubleshooting Vercel Deployment

## "Detection request failed" Error

### Common Causes:

1. **Model File Not Found**
   - Check if `backend/models/yolov8-waste.onnx` is committed to Git
   - File size might be too large for free tier
   - Check Vercel function logs for model path errors

2. **Serverless Function Timeout**
   - First request may timeout due to cold start (model loading)
   - Check function logs in Vercel dashboard
   - Model loading can take 10-30 seconds on first request

3. **Import Path Issues**
   - Verify all backend dependencies are in `package.json`
   - Check that `onnxruntime-node` is installed

4. **Memory Issues**
   - Model requires significant memory
   - Ensure memory is set to 2048 MB in vercel.json
   - May need Vercel Pro plan for larger models

### How to Debug:

1. **Check Vercel Function Logs**:
   - Go to Vercel Dashboard → Your Project → Functions
   - Click on `api/detect` function
   - Check "Logs" tab for errors

2. **Test Status Endpoint**:
   - Visit: `https://your-app.vercel.app/api/detect/status`
   - Should return model status

3. **Check Model File**:
   ```bash
   ls -lh backend/models/yolov8-waste.onnx
   ```
   - File should exist and be ~50MB

4. **Test Locally First**:
   ```bash
   cd backend
   npm start
   ```
   - Test API locally before deploying

### Quick Fixes:

1. **If model not found**:
   - Ensure model file is committed: `git add backend/models/yolov8-waste.onnx`
   - Check `.gitignore` doesn't exclude `.onnx` files

2. **If timeout errors**:
   - Increase timeout in vercel.json (max 30s for Hobby)
   - Consider using Pro plan for longer timeouts

3. **If import errors**:
   - Check `backend/package.json` has all dependencies
   - Ensure `onnxruntime-node` is listed

### Check Function Logs:

In Vercel Dashboard:
1. Go to your project
2. Click "Functions" tab
3. Click on `api/detect`
4. Check "Logs" for error messages
5. Look for:
   - `[WasteModel] Path: ...` - shows model path being used
   - `[WasteModel] File does NOT exist` - model not found
   - `[Detect] Unexpected error:` - shows actual error

### Environment Variables:

Ensure these are set in Vercel:
- `OPENAI_API_KEY` (optional, for high-accuracy mode)
- `NODE_ENV=production`

### Model Path Resolution:

The app tries multiple paths:
1. `backend/models/yolov8-waste.onnx` (standard)
2. `backend/models/yolov8-waste.onnx` (from process.cwd)
3. `models/yolov8-waste.onnx` (root level)

Check logs to see which path is being used.


