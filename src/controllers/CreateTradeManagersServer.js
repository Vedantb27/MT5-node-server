import express from "express";
import dotenv from "dotenv";
import {
    EC2Client,
    RunInstancesCommand,
    CreateTagsCommand
} from "@aws-sdk/client-ec2";

dotenv.config();

const app = express();
app.use(express.json());

const REGION = process.env.AWS_REGION;


const ec2 = new EC2Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

function generateUserData({ userId, loginId, accountNumber, accountPassword, accountServer, redisHost}) {
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

const createAccount = async (req, res) => {
    try {
        const accountDetails = req.body;

        if (!accountDetails) {
            return res.status(400).json({ error: "user_login is required" });
        }

        const userDataScript = generateUserData({
            userId: accountDetails.userId,
            loginId: accountDetails.loginId,
            accountNumber: accountDetails.accountNumber,
            accountPassword: accountDetails.accountPassword,
            accountServer: accountDetails.accountServer,
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
};
