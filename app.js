const express = require('express');
const axios = require('axios');
const {sequelize, Trades ,Users , MT5credentials} = require('./schema');

const app = express();
const PORT = 3000;

// middleware
app.use(express.json());

// Connect to database
sequelize.authenticate()
    .then(() => {
        console.log('Database connected successfully');
        return sequelize.sync();  // Sync models with the database
    })
    .then(() => {
        console.log('Database synced');
    })
    .catch((err) => {
        console.error('Error connecting to database:', err);
    });

app.get('/', (req ,res)=>{
    res.send('Hello server');
});


// to store trading history in database  from external api

app.post('/fetch-trades', async(req, res)=>{
    try{
        const response = await axios.get('http://localhost:5000/api/trading-history');
        const tradeData = response.data.completed_trades;
        console.log(tradeData); //for testing

        if(!tradeData || !Array.isArray(tradeData)){
            return res.status(400).json({error:'Invalid trade data recieved'});
        }
        for(const trade of tradeData){
            await Trades.create({
                position_id: trade.position_id,
                open_date: trade.opening_date,
                open_time: trade.opening_time,
                close_date: trade.closing_date,
                close_time: trade.closing_time,
                trade_duration: trade.duration_formatted,
                trade_duration_seconds: trade.duration_seconds,
                open_price: trade.open_price,
                close_price: trade.close_price,
                no_of_deals: trade.deals ? trade.deals.length : 0,
                profit: trade.profit,
                sl_price: trade.sl_price ? parseFloat(trade.sl_price) : null,
                tp_price: trade.tp_price ? parseFloat(trade.tp_price) : null,
                type: trade.type,
                symbol: trade.symbol,
                volume: trade.volume
            });
        }
         res.status(200).json({message:'Trade history stored successfully'});
        
    } catch(err){
        console.error('Error fetching or storing trade history:', err);
        res.status(500).json({error:'Internal server error'})
    }
})


// get the trading history from database 

app.get('/trade-history', async(req,res)=>{
    try{
        const trades = await Trades.findAll();  //fetch all trades from database 
        res.status(200).json(trades);
    } catch(err){
        console.log('Error fetching trade history:', err);
        res.status(500).json({error:'internal server error'})
    }
})


app.post('/mt5-login', async(req,res)=>{
    const {account , password , server} = req.body;
    if(!account || !password || !server){
        return res.status(400).json({error:'Invalid request body'});
    }
    
    try{
        const response = await axios.post('http://localhost:5000/api/mt5-login',{
            account,
            password,
            server
        });

        const mt5Data = response.data;
        if(!mt5Data.success){
            return res.status(401).json({error:'MT5 login failed',details:mt5Data.error});
        }

        return res.status(200).json({
            success: true,
            message: 'MT5 Credentials saved successfully',
            account_info: mt5Data.account_info
        });
        
    } catch(err){
        console.log('Error saving mt5 credintials:', err);
        res.status(500).json({error:'internal server error'})
    }
    
})




app.listen(PORT,()=>{
    console.log(`server is running on port ${PORT}`);
})
