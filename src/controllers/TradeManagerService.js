const dotenv = require('dotenv');
const { Accounts } = require('../models/Trades');
const {
    EC2Client,
    RunInstancesCommand,
    CreateTagsCommand
} = "@aws-sdk/client-ec2";

dotenv.config();

const REGION = process.env.AWS_REGION;

const ec2 = new EC2Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

function generateUserData({ userId, loginId, accountNumber, accountPassword, accountServer, redisHost }) {
    return `#!/bin/bash
set -e

# Log everything
exec > >(tee /var/log/user-data.log|logger -t user-data ) 2>&1

echo "Starting EC2 bootstrap at $(date)"

# Create app directory
mkdir -p /opt/mt5
cd /opt/mt5

# Create .env file
cat <<EOF > .env
USER_ID=${userId}
LOGIN_ID=${loginId}
# ---- BOT IDENTITY ----
BOT_USER_ID=${userId}
BOT_ACCOUNT_NUMBER=${accountNumber}

# ---- MT5 ----
MT5_ACCOUNT_NUMBER=${accountNumber}
MT5_PASSWORD=${accountPassword}
MT5_SERVER=${accountServer}

# ---- REDIS ----
REDIS_HOST=${redisHost}
REDIS_PORT=6379
REDIS_PASSWORD=Qazreg8796
REDIS_MAX_CONNECTIONS=200
REDIS_SOCKET_TIMEOUT=5
REDIS_CONNECT_TIMEOUT=5
EOF

# Start Docker
systemctl start docker
systemctl enable docker

sleep 5

# Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login \
  --username AWS \
  --password-stdin 125309500142.dkr.ecr.ap-south-1.amazonaws.com

# Pull image
docker pull 125309500142.dkr.ecr.ap-south-1.amazonaws.com/mt5trademanager:latest

# Run container
docker run -d \
  --name mt5trademanager \
  --env-file /opt/mt5/.env \
  --shm-size=1.5g \
  --ipc=host \
  -p 80:3000 \
  -p 5000:5000 \
  --restart unless-stopped \
  125309500142.dkr.ecr.ap-south-1.amazonaws.com/mt5trademanager:latest

echo "Bootstrap completed at $(date)"
`;
}

async function findInstancesByTags({ userId, loginId }) {
    const cmd = new DescribeInstancesCommand({
        Filters: [
            {
                Name: "tag:Name",
                Values: ["MT5TradeManager"]
            },
            {
                Name: "tag:user_id",
                Values: [String(userId)]
            },
            {
                Name: "tag:user_login",
                Values: [String(loginId)]
            },
            {
                Name: "instance-state-name",
                Values: ["pending", "running", "stopping", "stopped"]
            }
        ]
    });

    const result = await ec2.send(cmd);

    const instanceIds = [];

    for (const reservation of result.Reservations || []) {
        for (const instance of reservation.Instances || []) {
            instanceIds.push(instance.InstanceId);
        }
    }

    return instanceIds;
}

const deleteMT5TradeManager = async (userId, loginId) => {
    try {


        // 1️⃣ Find EC2 instances
        const instanceIds = await findInstancesByTags({
            userId,
            loginId
        });

        if (!instanceIds.length) {
            return {
                instanceDelete: false,
                reason: "NO_INSTANCE_FOUND"
            };
        }

        // 2️⃣ Terminate instances
        const terminateCmd = new TerminateInstancesCommand({
            InstanceIds: instanceIds
        });

        await ec2.send(terminateCmd);

        // 3️⃣ Update DB (optional but recommended)
        await Accounts.update(
            {
                isActive: false
            },
            {
                where: {
                    userId,
                    accountNumber: loginId
                }
            }
        );

        return {
            instanceDelete: true,
            terminatedInstances: instanceIds
        };

    } catch (err) {
        console.error("EC2 Termination Error:", err);
        return {
            instanceDelete: false,
            reason: "AWS_ERROR",
            error: err.message
        };
    }
};



const createMT5Manager = async (req, res) => {

    const data = req.body;
    const userid = data.user?.id;
    if (userid != req.user.id) {
        return res.status(401).json({ error: 'user is not authorized' });
    }
    if (!userid) {
        return res.status(400).json({ error: "user_login is required" });
    }

    if (!data.accountNumber && !data.accountPassword && !data.accountServer) {
        return res.status(400).json({ error: " acccount , password, server is missing" });
    }

    const redisHost = "34.229.194.70"; //later keep it dynamic based on increasing Traffic

    const accountExists = await Accounts.findOne({
        where: {
            userId: userid,
            accountNumber: data.accountNumber,
        },
        attributes:['accountPassword','accountServer']
    });

    if (accountExists) {

        try {
            const userDataScript = generateUserData({
                userId: data.userId,
                loginId: data.loginId,
                accountNumber: data.accountNumber,
                accountPassword: accountExists.accountPassword,
                accountServer: accountExists.accountServer,
                redisHost: redisHost,
            });

            // 1️⃣ Create EC2 from Launch Template
            const runCmd = new RunInstancesCommand({
                MinCount: 1,
                MaxCount: 1,
                LaunchTemplate: {
                    LaunchTemplateName: process.env.LAUNCH_TEMPLATE_NAME,
                    Version: process.env.LAUNCH_TEMPLATE_VERSION
                },
                UserData: Buffer.from(userDataScript).toString("base64")
            });

            const runResult = await ec2.send(runCmd);
            const instanceId = runResult.Instances[0].InstanceId;


            // 2️⃣ Tag EC2
            const tagCmd = new CreateTagsCommand({
                Resources: [instanceId],
                Tags: [
                    { Key: "Name", Value: "MT5TradeManager" },
                    { Key: "user_id", Value: accountDetails.userId },
                    { Key: "user_login", Value: accountDetails.loginId },
                    { Key: "service", Value: "mt5-trade-manager" },
                    { Key: "env", Value: "prod" },
                    { Key: "app", Value: "trading" }
                ]
            });

            await ec2.send(tagCmd);
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            let masterAccountID = '';
            if ('masterAccountID' in data) {
                masterAccountID = data.masterAccountID;
            }

            Accounts.update({
                isActive: true,
                creditExpiryTIme: creditExpiryTIme,
                masterAccountID: '',

            })

            return res.json({
                message: "EC2 instance created successfully",
                instanceId,
                tags: {
                    user_login: accountDetails.loginId,
                    user_id: accountDetails.userId,
                    service: "trade-manager"
                }
            });
        } catch (err) {
            console.error(err);
            return res.status(500).json({
                error: "Failed to create EC2 instance",
                details: err.message
            });
        }

    } else {
        return res.status(400).json({ message: 'Login MT5 account first' });
        // login mt5 account first 
    }
};

const replaceNewMT5Manager = async (req, res) => {
    const data = req.body;
    const userId = data.user?.id;
    if (userid != req.user.id) {
        return res.status(401).json({ error: 'user is not authorized' });
    }
    if (!userId) {
        return res.status(400).json({ error: "user_login is required" });
    }

    if (!data.accountNumber.oldAccountNumber && !data.newAccountNumber) {
        return res.status(400).json({ error: " acccountnumber is missing" });
    }

    const newAccountExists = await Accounts.findOne({
        where: {
            userId: userId,
            accountNumber: data.newAccountNumber,
        },
        attributes: ['password', 'server', 'isActive'],
    });

    const oldAccountExists = await Accounts.findOne({
        where: {
            userId: userId,
            accountNumber: data.oldAccountNumber,
        },
        attributes: ['password', 'server', 'isActive','creditExpiryTIme'],
    });

    // to replace master account select all the slave list and copied to the new master accounts redis, also in SQL database replace the old master id and add the new one in all its slave
    // to replace slave to slave In Database account remove the previos master id and add new master id In redis Database 
    // 

    if (newAccountExists) {
        try {

            try {
                //  DELETE OLD EC2
                const deleteResult = await deleteMT5TradeManager(
                    userId,
                    data.oldAccountNumber
                );
                if (deleteResult.instanceDelete) {
                    console.log("Old account server deleted:", deleteResult.terminatedInstances);
                } else {
                    console.warn("Old server not deleted:", deleteResult.reason);
                }
                console.log("Old server replaced successfully");
                console.log(deleteResult.instanceDelete);
            } catch (err) {
                console.error(err);
                console.log('Logic need to add to this account in Que for later deletion')
            }

            const userDataScript = generateUserData({
                userId: userId,
                loginId: data.newAccountNumber,
                accountNumber: newAccountExists.accountNumber,
                accountPassword: newAccountExists.accountPassword,
                accountServer: newAccountExists.accountServer,
                redisHost: oldAccountExists.redisHost,
            });

            // 1️⃣ Create EC2 from Launch Template
            const runCmd = new RunInstancesCommand({
                MinCount: 1,
                MaxCount: 1,
                LaunchTemplate: {
                    LaunchTemplateName: process.env.LAUNCH_TEMPLATE_NAME,
                    Version: process.env.LAUNCH_TEMPLATE_VERSION
                },
                UserData: Buffer.from(userDataScript).toString("base64")
            });


            const runResult = await ec2.send(runCmd);
            const instanceId = runResult.Instances[0].InstanceId;


            // 2️⃣ Tag EC2
            const tagCmd = new CreateTagsCommand({
                Resources: [instanceId],
                Tags: [
                    { Key: "Name", Value: "MT5TradeManager" },
                    { Key: "user_id", Value: accountDetails.userId },
                    { Key: "user_login", Value: accountDetails.loginId },
                    { Key: "service", Value: "mt5-trade-manager" },
                    { Key: "env", Value: "prod" },
                    { Key: "app", Value: "trading" }
                ]
            });

            await ec2.send(tagCmd);
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            let masterAccountID = '';
            if ('masterAccountID' in data) {
                masterAccountID = masterAccountID;

            }

            
            await Accounts.update(
                {
                    isActive: true,
                    creditExpiryTIme: oldAccountExists.creditExpiryTIme,
                    masterAccountID: masterAccountID,
                },
                {
                    where: {
                        userId: userId,
                        accountNumber: oldAccountExists.accountNumber,
                    }
                }
            )

            await Accounts.update(
                {
                    isActive: false,
                    creditExpiryTIme: null,
                    masterAccountID: '',
                },
                {
                    where: {
                        userId: userId,
                        accountNumber: newAccountExists.accountNumber,
                    }
                }
            )

            return res.json({
                message: "EC2 instance created successfully",
                instanceId,
                tags: {
                    user_login: accountDetails.loginId,
                    user_id: accountDetails.userId,
                    service: "trade-manager"
                }
            });
        } catch (err) {
            console.error(err);
            return res.status(500).json({
                error: "Failed to create EC2 instance",
                details: err.message
            });
        }

    } else {
        return res.status(400).json({ message: 'Login MT5 account first' });
        // login mt5 account first 
    }
}


module.exports = {
    createMT5Manager,
    replaceNewMT5Manager
}