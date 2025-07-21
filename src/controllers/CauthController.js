const express = require('express');
const axios = require('axios');
const router = express.Router();

const BASE_URL = 'http://localhost:9000'; // Flask server
let authenticatedAccountIds = []; //  store multiple authenticated accounts

router.post('/login', async (req, res) => {
    const { accessToken, ctidTraderAccountId } = req.body;

    try {
        const response = await axios.post(`${BASE_URL}/account-auth`, {
            accessToken,
            ctidTraderAccountId
        });

        const data = response.data;

        if (data.error == 'CH_ACCESS_TOKEN_INVALID') {
            return res.status(401).json({ error: ' Invalid acccess token' });
        }

        if (data.error === 'ALREADY_LOGGED_IN') {
            if (!authenticatedAccountIds.includes(ctidTraderAccountId)) {
                authenticatedAccountIds.push(ctidTraderAccountId); //store if not already
            }
            return res.status(200).json({ success: true, message: 'Already logged in', accountId: ctidTraderAccountId });
        }

        if (!authenticatedAccountIds.includes(ctidTraderAccountId)) {
            authenticatedAccountIds.push(ctidTraderAccountId);
        }
        res.status(200).json({ success: true, message: 'Login successful', accountId: ctidTraderAccountId });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error' })
    }
});

module.exports = { router, getAuthenticatedAccountIds: () => authenticatedAccountIds }