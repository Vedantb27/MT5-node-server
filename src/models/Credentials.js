const {DataTypes} = require('sequelize');   
const sequelize = require('../config/database');

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

const AccountCredentials = sequelize.define('AccountCredentials',{
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


module.exports ={Users, AccountCredentials}