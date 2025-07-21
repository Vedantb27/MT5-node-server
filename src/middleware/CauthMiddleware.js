const { getAuthenticatedAccountIds} = require('../controllers/CauthController');

function  isAuthenticated(req, res, next) {
    const requestAccountId = String(req.body.ctidTraderAccountId);
    if(!requestAccountId) {
        return res.status(400).json({ success: false, message: 'ctidTraderAccountId is required' });
    }
    
    const authenticatedIds = getAuthenticatedAccountIds().map(String);

    if(!authenticatedIds.includes(requestAccountId)){
        console.log('Account not authenticated:', requestAccountId);        return res.status(403).json({ success:false, message:'Account not authenticed'});
    }
    // Add it to request object for downstream use if needed
    req.accountId = requestAccountId;
    next();
}

module.exports = {isAuthenticated};