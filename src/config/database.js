const { Sequelize } = require('sequelize');
 
const sequelize = new Sequelize('postgres', 'postgres', 'vedant@9370', {
    host: 'localhost',
    dialect: 'postgres',
    port: 5432,
});
 
sequelize.authenticate()
    .then(() => console.log('Database connected successfully'))
    .catch(err => console.error('Error connecting to database:', err));
 
module.exports = sequelize;