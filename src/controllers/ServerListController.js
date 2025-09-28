const axios = require('axios');
const fs = require('fs');
const path = require('path');

const fetchServerList = async () => {
    const response = await axios.get(`${process.env.MT5_URL}/server-list`);
    const servers = JSON.parse(response.data.servers_data);

    if (!servers || !Array.isArray(servers)) {
        throw new Error('Invalid server data received');
    }

    return servers;
};

const saveServerList = (servers) => {
    const filePath = path.join(__dirname, '../config/serverList.json');
    fs.writeFileSync(filePath, JSON.stringify(servers, null, 2));
};

const getServerList = async (req, res) => {
    try {
        const filePath = path.join(__dirname, '../config/serverList.json');
        let servers;

        if (fs.existsSync(filePath)) {
            servers = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } else {
            servers = await fetchServerList();
            saveServerList(servers);
        }
        servers = servers?.map((data) => {
            return { serverName: data?.serverInfoEx?.serverName }
        })
        res.status(200).json({
            message: 'Server list retrieved successfully',
            serverCount: servers.length,
            data: servers
        });
    } catch (err) {
        console.error('Error fetching server list:', err);
        res.status(500).json({
            error: 'Internal server error',
            details: err.message
        });
    }
};

module.exports = {
    getServerList,
    fetchServerList,
    saveServerList
};