const { Sequelize } = require('sequelize');
 
const sequelize = new Sequelize('postgres', 'postgres', 'ZBIvp33o9tr36AxD8yJB', {
    host: 'database-1.cd8e6mey05kq.ap-south-1.rds.amazonaws.com',
    dialect: 'postgres',
    port: 5432,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
});
 
sequelize.authenticate()
    .then(() => console.log('Database connected successfully'))
    .catch(err => console.error('Error connecting to database:', err));
 
module.exports = sequelize;