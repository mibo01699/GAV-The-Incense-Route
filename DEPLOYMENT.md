# Deployment Guide (Sandbox/Testnet)

## 🚀 Deploying to Vercel

1. Fork or clone the repository:
   ```bash
   git clone https://github.com/mibo01699/GAV-The-Incense-Route.git
```

2. Install dependencies:
   ```bash
   npm install
   ```
3. Deploy to Vercel:
   · Connect your GitHub repository to Vercel.
   · Set environment variables (see .env.example).
   · Click "Deploy".

💻 Local Development

```bash
npm start
```

Server will run on http://localhost:3000.

🧪 Testing

```bash
npm test
```

📋 Environment Variables

Create a .env file based on .env.example:

```env
AJYAL_API=http://localhost:3001/api
BIGISH_YER_API=http://localhost:5001/api
PORT=3000
NODE_ENV=development
```

⚠️ Important

This is a sandbox/testnet-only prototype. No mainnet deployment is claimed.

Note: All metrics and benchmarks mentioned elsewhere are aspirational and not currently implemented.

---

🦅 Developed by Arabian Eagle Technology Group
