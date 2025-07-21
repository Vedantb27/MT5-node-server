const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('my_pgdb', 'postgres', 'qazplm@123', {
    host: 'localhost',
    dialect: 'postgres'
});

sequelize.authenticate()
    .then(() => console.log('Database connected successfully'))
    .catch(err => console.error('Error connecting to database:', err));

module.exports = sequelize;
