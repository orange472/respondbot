const { App, ExpressReceiver } = require("@slack/bolt");
const serverlessExpress = require("@codegenie/serverless-express");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Initialize Firestore
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const serviceAccount = require(serviceAccountPath);
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://respondbot-4406f-default-rtdb.firebaseio.com",
});
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// Firebase Installation Store
class FirebaseInstallationStore {
  async storeInstallation(data) {
    try {
      // store org-wide installation
      if (data.isEnterpriseInstall && data.enterprise !== undefined) {
        const docRef = db.collection("installations").doc(data.enterprise.id);
        return await docRef.set(data);
      }

      // store single team installation
      if (data.team !== undefined) {
        const docRef = db.collection("installations").doc(data.team.id);
        return await docRef.set(data);
      }

      throw new Error("Failed to save installation data");
    } catch (error) {
      console.error(error);
    }
  }

  async fetchInstallation(query) {
    try {
      if (query.isEnterpriseInstall && query.enterpriseId !== undefined) {
        // handle org wide app installation lookup
        const docRef = db.collection("installations").doc(query.enterpriseId);
        const doc = await docRef.get();
        return doc.data();
      }

      if (query.teamId !== undefined) {
        // single team app installation lookup
        const docRef = db.collection("installations").doc(query.teamId);
        const doc = await docRef.get();
        return doc.data();
      }

      throw new Error("Failed to fetch installation");
    } catch (error) {
      console.error(error);
    }
  }

  async deleteInstallation(query) {
    try {
      if (query.isEnterpriseInstall && query.enterpriseId !== undefined) {
        // org wide app installation deletion
        return await db
          .collection("installations")
          .doc(query.enterpriseId)
          .delete();
      }

      if (query.teamId !== undefined) {
        // single team app installation deletion
        return await db.collection("installations").doc(query.teamId).delete();
      }

      throw new Error("Failed to delete installation");
    } catch (error) {
      console.error(error);
    }
  }
}

// Event listener
const expressReceiver = new ExpressReceiver({
  processBeforeResponse: true,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: "MONB1rbrVTqnOMDiKwQkNmOs3tDHCu1q",
  scopes: [
    "channels:history",
    "channels:read",
    "groups:read",
    "im:read",
    "mpim:read",
    "commands",
    "chat:write",
  ],
  installationStore: new FirebaseInstallationStore(),
  redirectUri:
    "https://k5yov2sr42.execute-api.us-east-1.amazonaws.com/dev/oauth/callback",
  installerOptions: { redirectUriPath: "/oauth/callback" },
});

// Slack app instance
const app = new App({
  receiver: expressReceiver,
  processBeforeResponse: true,
});

// Slack event: message
app.message(async ({ message, context }) => {
  setTimeout(() => {
    checkMessage(context.botToken, message.channel, message.ts);
  }, 24 * 60 * 60 * 1000);
});

// Slack command: /addping [@]
app.command("/addping", async ({ command, ack, respond }) => {
  await ack();

  const member = command.text.split(" ")[0];

  // Let the user know that we've received the command and avoid timeouts
  await respond({
    text: `Adding ${member} to be notified of upcoming unresponded messages...`,
  });

  const docRef = db.collection("mentions").doc(command.channel_id);
  const doc = await docRef.get();
  if (doc.exists) {
    docRef.update({ mentions: FieldValue.arrayUnion(member) });
  } else {
    docRef.set({ mentions: [member] });
  }

  await respond({
    replace_original: true,
    text: `Added ${member} to be notified of upcoming unresponded messages!`,
  });
});

// Slack command: /removeping [@]
app.command("/removeping", async ({ command, ack, respond }) => {
  await ack();

  const member = command.text.split(" ")[0];

  await respond({
    text: `Removing ${member} from being notified of upcoming unresponded messages...`,
  });

  const docRef = db.collection("mentions").doc(command.channel_id);
  const doc = await docRef.get();
  if (doc.exists) {
    docRef.update({ mentions: FieldValue.arrayRemove(member) });
  }

  await respond({
    replace_original: true,
    text: `Removed ${member} from being notified of upcoming unresponded messages!`,
  });
});

// Slack command: /viewpings
app.command("/viewpings", async ({ command, ack, respond }) => {
  await ack();

  await respond({ text: "Fetching..." });

  const mentions = await getMentions(command.channel_id);
  if (!mentions || typeof mentions !== "object" || !mentions.length) {
    await respond({ text: "No current pings." });
  } else {
    await respond({ text: "Current pings: " + mentions.join(", ") });
  }
});

/**
 *
 * @param {string} channelId the ID of the message channel
 * @returns a list of mentions that are currently active in the given channel
 */
async function getMentions(channelId) {
  const docRef = db.collection("mentions").doc(channelId);
  const doc = await docRef.get();
  const data = doc.data();
  return data === undefined ? [] : data["mentions"];
}

/**
 * Not used.
 *
 * @param {string} channelId the ID of message channel
 * @param {number} limit the maximum number of messages allowed
 * @returns a list of messages that have no reactions or replies
 */
async function getUnrespondedMessages(channelId, limit = 100) {
  const { messages } = await app.client.conversations.history({
    token: app.client.token,
    channel: channelId,
    limit: limit ?? 100,
  });

  return messages.filter((msg) => {
    return !msg.subtype && !msg.reactions?.length && !msg.reply_users_count;
  });
}

/**
 * Not used.
 *
 * @returns a list of channels which the app has been added to
 */
async function getJoinedChannels() {
  const { channels } = await app.client.conversations.list({
    token: app.client.token,
    exclude_archived: true,
  });

  return channels.filter(
    (channel) => channel.is_member && channel.id !== undefined
  );
}

/**
 *
 * @param {string} channelId the ID of the message channel
 * @returns a custom message with each mention at the beginning
 */
async function constructBotResponse(channelId) {
  const mentions = await getMentions(channelId);
  var result = "";
  if (mentions !== undefined && typeof mentions === "object") {
    mentions.forEach((mention) => (result += `<${mention}>`));
  }
  result += " Please check out when you have the chance!";
  return result;
}

/**
 * @param {string} botToke  the bot authorization token
 * @param {string} channelId the ID of the message channel
 * @param {string} messageTs the timestamp of the message to check
 */
async function checkMessage(botToken, channelId, messageTs) {
  try {
    const { channel } = await app.client.conversations.info({
      token: botToken,
      channel: channelId,
    });

    if (!channel.is_member) {
      throw `RespondBot is not part of channel ${channelId} anymore.`;
    }

    const result = await app.client.conversations.history({
      token: botToken,
      channel: channelId,
      latest: messageTs,
      inclusive: true,
      limit: 1,
    });
    const msg = result.messages[0];

    if (!msg.subtype && !msg.reactions?.length && !msg.reply_users_count) {
      const botResponse = await constructBotResponse(channelId);
      await app.client.chat.postMessage({
        token: botToken,
        channel: channelId,
        thread_ts: messageTs,
        text: botResponse,
      });
    }
  } catch (error) {
    console.error(error);
  }
}

(async () => {
  // Start your app
  await app.start();

  console.log("⚡️ Bolt app is running!");
})();

module.exports.handler = serverlessExpress({
  app: expressReceiver.app,
});
