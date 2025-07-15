const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

const db = new DynamoDBClient({ region: process.env.REGION });

function getKey(matchId, frameStart, frameEnd) {
    return {
        PK: { S: `replay#${matchId}` },
        SK: { S: `stub#${frameStart}#${frameEnd}` },
    };
}

async function setTag(matchId, frameStart, frameEnd, tag, value) {
    const attrName = `tag_${tag.replace(/[^a-zA-Z0-9_]/g, "_")}`; // sanitize tag names
    const input = {
      TableName: process.env.TAG_TABLE_NAME,
      Key: getKey(matchId, frameStart, frameEnd),
      UpdateExpression: `SET #attr = :val`,
      ExpressionAttributeNames: {
        "#attr": attrName
      },
      ExpressionAttributeValues: {
        ":val": { BOOL: value }
      },
      ReturnValues: "UPDATED_NEW"
    };

    const result = await db.send(new UpdateItemCommand(input));
    
    return result.Attributes.tag_bugged.BOOL;
  }
  
module.exports = {
  getKey,
  setTag
}; 