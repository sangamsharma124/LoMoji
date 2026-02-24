# Claude API Key Setup Guide

## Getting Your API Key

### 1. Visit Anthropic Console
- Go to: https://console.anthropic.com
- Sign up or log in to your account

### 2. Generate API Key
1. Click "API Keys" in the left sidebar
2. Click "Create Key" button
3. Name your key (e.g., "LoMoji Development")
4. **Copy the key immediately** - it won't be shown again!

### 3. Check Your Credits/Plan
- Free tier: Limited credits for testing
- View usage: Check "Usage" section in console
- Upgrade: Consider paid plan for production use

## Setting Up in Your Project

### 1. Create Your Local .env File
```bash
# In the frontend directory
cd frontend
cp .env.example .env
```

### 2. Add Your API Key
Edit `frontend/.env` and replace the placeholder:
```
VITE_ANTHROPIC_API_KEY=sk-ant-api03-YOUR-ACTUAL-KEY-HERE
```

### 3. Choose Your Model (Optional)
Available models with different capabilities and costs:
- `claude-3-opus-20240229` - Most capable, highest cost
- `claude-3-sonnet-20240229` - Balanced performance/cost
- `claude-3-haiku-20240307` - Fastest, lowest cost (default)

## Security Best Practices

### ⚠️ IMPORTANT
1. **Never commit .env to git** - It's already in .gitignore
2. **Never expose API keys in frontend code directly**
3. **For production:** Use a backend proxy to hide the key
4. **Monitor usage:** Check console.anthropic.com regularly

## Quick Test
After setup, restart your dev server:
```bash
npm run dev
```

## Troubleshooting

### API Key Not Working?
- Check for extra spaces or quotes
- Ensure key starts with `sk-ant-api03-`
- Verify credits/usage limits in console

### Rate Limits?
- Free tier: ~1000 requests/day
- Check current usage in Anthropic Console
- Consider upgrading for higher limits

## Need Help?
- Anthropic Docs: https://docs.anthropic.com
- API Reference: https://docs.anthropic.com/claude/reference
- Support: support@anthropic.com