const express = require('express');
const axios = require('axios');
const router = express.Router();

const BASE_URL = 'http://localhost:9000'; // Flask server
let authenticatedAccountIds = []; // Store multiple authenticated accounts

async function loginAccount({ accessToken, ctidTraderAccountId }) {
    console.log(accessToken,"accessToken")
    console.log(ctidTraderAccountId,"ctidTraderAccountId")
    try {
        const response = await axios.post(`${BASE_URL}/account-auth`, {
            accessToken,
            ctidTraderAccountId,
        });

        const data = response.data;

        if (data.error === 'CH_ACCESS_TOKEN_INVALID') {
            return { success: false, status: 401, error: 'Invalid access token' };
        }

        if (data.error === 'ALREADY_LOGGED_IN') {
            if (!authenticatedAccountIds.includes(ctidTraderAccountId)) {
                authenticatedAccountIds.push(ctidTraderAccountId);
            }
            return { success: true, status: 200, message: 'Already logged in', accountId: ctidTraderAccountId };
        }

        if (!authenticatedAccountIds.includes(ctidTraderAccountId)) {
            authenticatedAccountIds.push(ctidTraderAccountId);
        }

        return { success: true, status: 200, message: 'Login successful', accountId: ctidTraderAccountId };

    } catch (error) {
        console.error('Login error:', error);
        return { success: false, status: 500, error: 'Internal Server Error' };
    }
}

// Express route
router.post('/login', async (req, res) => {
    const { accessToken, ctidTraderAccountId } = req.body;
    const result = await loginAccount({ accessToken, ctidTraderAccountId });
    res.status(result.status).json(result);
});

module.exports = {
    router,
    loginAccount,
    getAuthenticatedAccountIds: () => authenticatedAccountIds
};
