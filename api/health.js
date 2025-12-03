// Health check endpoint for Vercel
export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.json({
    ok: true,
    service: 'EcoVision API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
  });
};

