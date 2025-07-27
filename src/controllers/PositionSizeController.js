const axios = require('axios');

const getSymbolData = async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ message: 'Symbol is required' });
    }

    const symbolForApi = `IC Markets:${symbol.replace('/', '')}`;
    const response = await axios.get(
      `https://fxverify.com/api/live-chart/datafeed/tool-symbols?symbol=${symbolForApi}&lang=en`,
      {
        headers: {
          accept: '*/*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          referer: 'https://fxverify.com/tools/position-size-calculator',
          'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        },
      }
    );

    return res.status(200).json(response.data);
  } catch (err) {
    console.error('Error fetching symbol data:', err.message);
    return res.status(500).json({ message: 'Failed to fetch symbol data', error: err.message });
  }
};

const getExchangeRate = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: 'Both from and to currencies are required' });
    }

    const response = await axios.get(
      `https://fxverify.com/api/widgets/currencies/exchange-rate?from=${from}&to=${to}`,
      {
        headers: {
          accept: '*/*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          referer: 'https://fxverify.com/tools/position-size-calculator',
          'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
          'x-requested-with': 'XMLHttpRequest',
        },
      }
    );

    return res.status(200).json(response.data);
  } catch (err) {
    console.error('Error fetching exchange rate:', err.message);
    return res.status(500).json({ message: 'Failed to fetch exchange rate', error: err.message });
  }
};

const calculatePositionSize = async (req, res) => {
  try {
    const { moneyToRisk, pipAtRisk, lotSize, onePipSize, rate } = req.body;
    if (!moneyToRisk || !pipAtRisk || !lotSize || !onePipSize || rate === undefined) {
      return res.status(400).json({ message: 'All parameters are required' });
    }

    const response = await axios.post(
      'https://fxverify.com/widgets/calculation/position-size',
      {
        moneyToRisk,
        pipAtRisk,
        lotSize,
        onePipSize,
        rate,
      },
      {
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          referer: 'https://fxverify.com/tools/position-size-calculator',
          'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );

    if (response.data.success) {
      return res.status(200).json({ success: true, lots: Math.round(response.data.lots * 100) / 100 });
    } else {
      return res.status(400).json({ message: 'Position size calculation failed', details: response.data });
    }
  } catch (err) {
    console.error('Error calculating position size:', err.message);
    return res.status(500).json({ message: 'Failed to calculate position size', error: err.message });
  }
};

module.exports = {
  getSymbolData,
  getExchangeRate,
  calculatePositionSize,
};