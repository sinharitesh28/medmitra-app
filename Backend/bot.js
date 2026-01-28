const TelegramBot = require('node-telegram-bot-api');
const db = require('./DB/db');

let bot = null;
let botUsername = 'MedMitra_bot'; // Default fallback

function initBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (token && token !== 'demo_bot_token') {
        bot = new TelegramBot(token, { polling: true });
        
        // Log ANY message received
        bot.on('message', (msg) => {
            console.log(`[Bot] Received message from ${msg.chat.id}: ${msg.text}`);
        });

        bot.getMe().then(me => {
            botUsername = me.username;
            console.log(`MedMitra Bot Active: @${botUsername}`);
        }).catch(err => {
            console.error('Telegram Bot Error (using fallback):', err.message);
        });

        // Handle /start command
        bot.onText(/\/start (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const param = match[1]; // The parameter passed in start link

            // 1. Admin Link Logic
            if (param.startsWith('ADMIN_LINK_')) {
                const userId = param.replace('ADMIN_LINK_', '');
                try {
                    await db.query("UPDATE system_users SET telegram_chat_id = ? WHERE user_id = ?", [chatId, userId]);
                    bot.sendMessage(chatId, "✅ Admin Account Linked! You will now receive system alerts here.");
                    console.log(`[Bot] Admin User ${userId} linked to Chat ID ${chatId}`);
                } catch (e) {
                    console.error('[Bot] Admin Link Error:', e);
                    bot.sendMessage(chatId, "❌ Failed to link account.");
                }
                return;
            }

            // 2. Patient Registration Logic (Default)
            const opdNo = param;
            try {
                // Find patient by OPD No
                const [rows] = await db.query("SELECT patient_id FROM master_patient_index WHERE opd_no = ?", [opdNo]);
                if (rows.length > 0) {
                    const pid = rows[0].patient_id;
                    // Update Enrollment with Chat ID and Consent
                    await db.query("UPDATE medmitra_enrollments SET telegram_chat_id = ?, consent_status = 1 WHERE patient_id = ?", [chatId, pid]);
                    bot.sendMessage(chatId, "Welcome to MedMitra! You are now registered for medication reminders.");
                } else {
                    bot.sendMessage(chatId, "Error: Patient record not found.");
                }
            } catch (e) {
                console.error(e);
                bot.sendMessage(chatId, "System Error.");
            }
        });

        // Handle Callback Queries
        bot.on('callback_query', async (callbackQuery) => {
            const msg = callbackQuery.message;
            const data = callbackQuery.data;
            const chatId = msg.chat.id;
            const [action, logId] = data.split('_');

            try {
                // Update Log
                await db.query("UPDATE medmitra_logs SET response = ?, response_at = NOW() WHERE log_id = ?", [action, logId]);
                
                // Update Patient Last Interaction
                await db.query(`
                    UPDATE medmitra_enrollments e
                    JOIN medmitra_logs l ON e.patient_id = l.patient_id
                    SET e.last_interaction = NOW()
                    WHERE l.log_id = ?
                `, [logId]);

                // Answer Callback
                let replyText = "";
                if (action === 'TAKEN') replyText = "Great! Marked as Taken. ✅";
                if (action === 'FORGOT') replyText = "Marked as Missed. ❌";
                if (action === 'REACTION') replyText = "⚠️ Reaction Reported! Doctor notified.";

                await bot.answerCallbackQuery(callbackQuery.id, { text: replyText });

                // Edit Message
                await bot.editMessageText(`${msg.text}\n\nStatus: *${action}*`, {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    parse_mode: 'Markdown'
                });

            } catch (e) {
                console.error('Callback Error:', e);
            }
        });

    } else {
        console.error('MedMitra Bot: No valid token provided. Demo mode disabled.');
    }
}

function getBot() {
    return bot;
}

function getBotUsername() {
    return botUsername;
}

module.exports = { initBot, getBot, getBotUsername };
