require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 8080);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_API_KEY;

  if (!apiKey || !secretKey) {
    return res.status(503).json({ error: 'Pinata is not configured. Add credentials to the local .env file.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Choose a file to upload.' });
  }

  try {
    const form = new FormData();
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: apiKey,
        pinata_secret_api_key: secretKey
      },
      body: form
    });
    const responseText = await pinataResponse.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = {};
    }

    if (!pinataResponse.ok) {
      const detail = result.error?.details || result.error || result.message || pinataResponse.statusText;
      return res.status(pinataResponse.status).json({ error: `Pinata upload failed: ${detail}` });
    }
    if (!result.IpfsHash) {
      return res.status(502).json({ error: 'Pinata response did not include an IPFS hash.' });
    }

    return res.json({ IpfsHash: result.IpfsHash });
  } catch (error) {
    console.error('Pinata upload error:', error.message);
    return res.status(502).json({ error: 'Could not reach Pinata. Check your internet connection and try again.' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, '127.0.0.1', () => {
  console.log(`Evidence app running at http://localhost:${port}`);
});
