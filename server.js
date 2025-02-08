require('dotenv').config();
const cors = require('cors');
const express = require('express');
const docusign = require('docusign-esign');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '150mb' }))
app.use(express.urlencoded({ extended: true, limit: '150mb' }))
app.use(cors({}));
// app.use(express.json());

// ✅ Authenticate with JWT
const authenticateWithJWT = async () => {
  const apiClient = new docusign.ApiClient({basePath:process.env.DOCUSIGN_BASE_URL});

  apiClient.setOAuthBasePath("account-d.docusign.com");

  const privateKey = fs.readFileSync('./private.pem','utf8').trim();

  try {
    const results = await apiClient.requestJWTUserToken(
        process.env.DOCUSIGN_CLIENT_ID,
        process.env.DOCUSIGN_USER_ID,
        ["signature"],
        privateKey,
        3600
      );
      console.log('inside auth')

    if (!results.body || !results.body.access_token) {
      throw new Error("Failed to obtain access token.");
    }


    apiClient.addDefaultHeader("Authorization", `Bearer ${results.body.access_token}`);
    return apiClient;
  } catch (error) {
    console.error("Authentication error:", error.response?.body || error.message);
    throw error;
  }
};

// ✅ **1. Create an Envelope**
app.post('/create-envelope', async (req, res) => {
  try {
    const apiClient = await authenticateWithJWT();
    console.log('here')
    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    const { documentBase64, email, name } = req.body;
    console.log("==>", req.body.email);
    console.log("==>", req.body.name);

    const envelopeBody = {
      documents: [
        { 
          documentBase64, 
          documentId: "1", 
          fileExtension: "pdf", 
          name: "Document" 
        }
      ],
      emailSubject: "Please sign this document",
      recipients: {
        signers: [{ email: "vishalkrmahatha362000@gmail.com", name: "Vishal Kumar", recipientId: "1" }]
      },
      status: "sent"
    };

    const envelopeSummary = await envelopesApi.createEnvelope(process.env.DOCUSIGN_ACCOUNT_ID, envelopeBody);
    res.json({ envelopeId: envelopeSummary.envelopeId });
  } catch (error) {
    console.error("Error creating envelope:", error.response?.body || error.message);
    res.status(500).json({ error });
  }
});

// ✅ **2. Get Envelope Status**
app.get('/envelope-status/:envelopeId', async (req, res) => {
  try {
    const apiClient = await authenticateWithJWT();
    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    const envelope = await envelopesApi.getEnvelope(process.env.DOCUSIGN_ACCOUNT_ID, req.params.envelopeId);
    res.json({ status: envelope.status });
  } catch (error) {
    console.error("Error getting envelope status:", error.response?.body || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ **3. Download Signed Document**
app.get('/download-document/:envelopeId/:documentId', async (req, res) => {
  try {
    const apiClient = await authenticateWithJWT();
    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    const documentBytes = await envelopesApi.getDocument(
      process.env.DOCUSIGN_ACCOUNT_ID,
      req.params.envelopeId,
      req.params.documentId
    );

    res.json({ documentBase64: documentBytes.toString('base64') });
  } catch (error) {
    console.error("Error downloading document:", error.response?.body || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ **Start Express Server**
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
