const {Sequelize , DataTypes} = require('sequelize');

// Intialize sequelize

const sequelize = new Sequelize('my_pgdb','postgres','vedant@9370',{
    host:'localhost',
    dialect:'postgres'
});

const Trades = sequelize.define('Trades',{
    sr_no:{
        type:DataTypes.INTEGER,
        allowNull:false,
        autoIncrement:true,
    },
    position_id:{
        type:DataTypes.INTEGER,
        primaryKey:true,
        unique:true,
        allowNull:false,
    },
    open_date:{
        type:DataTypes.DATEONLY, // Stores only date (yyyy-mm-dd)
        allowNull:false,
    },
    open_time:{
        type:DataTypes.TIME, // Stores only time (hh:mm:ss)     
        allowNull:false,
    },
    close_date:{
        type:DataTypes.DATEONLY, // Stores only date (yyyy-mm-dd)
        allowNull:false,
    },
    close_time:{
        type:DataTypes.TIME, // Stores only time (hh:mm:ss)     
        allowNull:false,
    },
    trade_duration:{
        type:DataTypes.STRING,
        allowNull:false,
    },
    trade_duration_seconds:{
        type:DataTypes.STRING,
        allowNull:false,
    },
    open_price:{
        type:DataTypes.FLOAT,
        allowNull:false,
    },
    close_price:{
        type:DataTypes.FLOAT,
        allowNull:false,
    },
    no_of_deals:{
        type:DataTypes.FLOAT,
        allowNull:false,
    },
    profit:{
        type:DataTypes.FLOAT,
        allowNull:false,
    },
    sl_price:{
        type:DataTypes.FLOAT,
        allowNull:true,    
    },
    tp_price:{
        type:DataTypes.FLOAT,
        allowNull:true,    
    },
    type:{
        type:DataTypes.STRING,
        allowNull:false,
    },
    symbol:{
        type:DataTypes.STRING, 
        allowNull:false,
    },
    volume:{
        type:DataTypes.FLOAT,
        allowNull:false,
    },
    history_from_date:{
        type:DataTypes.DATEONLY,
        allowNull:false,
    },
    history_to_date:{
        type:DataTypes.DATEONLY,
        allowNull:false,
    }
})

const Users = sequelize.define('Users',{
    sr_no:{
        type:DataTypes.INTEGER,
        allowNull:false,
        autoIncrement:true,
    },
    user_id:{
        type:DataTypes.STRING,
        primaryKey:true,
        unique:true,
        allowNull:false,
    },
    email_id:{
        type:DataTypes.STRING,
        unique:true,
        allowNull:false,
    },
    password:{
        type:DataTypes.STRING,
        primaryKey:true,
        unique:true,
        allowNull:false,
    }
})

const MT5credentials = sequelize.define('MT5credentials',{
    sr_no:{
        type:DataTypes.INTEGER,
        allowNull:false,
        autoIncrement:true,
        primaryKey:true
    },
    login:{
        type:DataTypes.FLOAT,
        unique:true,
        allowNull:false,
    },
    password:{
        type:DataTypes.STRING,
        allowNull:false,
    },
    server:{
        type:DataTypes.STRING,
        allowNull:false,
    }
})
module.exports = {sequelize, Trades , Users , MT5credentials};