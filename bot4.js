const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Client, GatewayIntentBits } = require('discord.js');

// ==========================================
// CẤU HÌNH DISCORD BOT
// ==========================================
const DISCORD_TOKEN = 'MTUzNDc3NTMzNTA0MjgxNDA5NA.GO1_5H.5vyo8eEcENG27mNFdkK87VzL-_NtrXezBxCpOY'; // Thay token chính xác của bạn vào đây nếu cần
const DISCORD_CHANNEL_ID = '1539530661101183019';

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Lưu trữ danh sách các instance bot Mineflayer để Discord có thể điều khiển
const activeBots = [];

// Hàm gửi thông báo lên Discord an toàn
function notifyDiscord(message) {
    try {
        const channel = discordClient.channels.cache.get(DISCORD_CHANNEL_ID);
        if (channel) {
            channel.send(message);
        }
    } catch (e) {}
}

discordClient.once('ready', () => {
    console.log(`[Discord] Bot Discord đã đăng nhập thành công với tên ${discordClient.user.tag}!`);
});

// Lắng nghe tin nhắn từ kênh Discord được chỉ định
discordClient.on('messageCreate', (message) => {
    if (message.channel.id !== DISCORD_CHANNEL_ID || message.author.bot) return;

    const fullContent = message.content.trim();
    console.log(`[Discord] Nhận lệnh từ ${message.author.tag}: ${fullContent}`);

    // Xử lý riêng cho lệnh !chat
    if (fullContent.startsWith('!chat')) {
        const args = fullContent.slice(5).trim().split(' ');
        const firstArg = args[0];

        const targetBotData = activeBots.find(b => b.username.toLowerCase() === firstArg?.toLowerCase());

        if (targetBotData) {
            const chatMessage = args.slice(1).join(' ');
            if (!chatMessage) {
                message.reply(`[!] Vui lòng nhập nội dung chat cho bot \`${targetBotData.username}\`!`);
                return;
            }
            targetBotData.bot.chat(chatMessage);
            message.reply(`[💬] Bot \`${targetBotData.username}\` đã chat: "${chatMessage}"`);
        } else {
            const chatMessage = args.join(' ');
            if (!chatMessage) {
                message.reply(`[!] Vui lòng nhập nội dung chat! Cú pháp: \`!chat [nội dung]\` hoặc \`!chat [tên_bot] [nội dung]\``);
                return;
            }

            let count = 0;
            activeBots.forEach((botData) => {
                if (botData && botData.bot) {
                    botData.bot.chat(chatMessage);
                    count++;
                }
            });

            message.reply(`[💬] Đã lệnh cho **${count} bot** chat: "${chatMessage}"`);
        }
        return;
    }

    const command = fullContent;
    activeBots.forEach((botData) => {
        if (!botData || !botData.bot) return;
        const bot = botData.bot;
        const username = botData.username;

        if (command === '!gopblock') {
            botData.isGopBlock = !botData.isGopBlock;
            if (botData.isGopBlock) {
                botData.isAutoTrade = false; 
                console.log(`[>>] [${username}] Bắt đầu Nạp Block từ Discord!`);
                setTimeout(botData.runGopBlockLoop, 100 + botData.botIndex * 150); 
            } else {
                bot.setControlState('sneak', false); 
                console.log(`[||] [${username}] Đã dừng GopBlock từ Discord!`);
            }
        }

        if (command === '!auto' || command === '!aotu') {
            botData.isAutoTrade = !botData.isAutoTrade;
            if (botData.isAutoTrade) {
                botData.isGopBlock = false; 
                bot.setControlState('sneak', false); 
                console.log(`[>>] [${username}] Bắt đầu Đúc Đồ (Auto) từ Discord!`);
                setTimeout(botData.runAutoTrade, 200 + botData.botIndex * 300); 
            } else {
                console.log(`[||] [${username}] Đã dừng Auto từ Discord!`);
            }
        }

        if (command === '!vutdo') {
            botData.trashAllItems(); 
        }

        if (command === '!dao' || command === '!is') {
            bot.chat('/is go');
        }

        if (command === '!dung') {
            bot.pathfinder.setGoal(null);
            botData.isAutoTrade = false;
            botData.isGopBlock = false;
            bot.setControlState('sneak', false); 
            console.log(`[||] [${username}] Đã dừng mọi hoạt động (Nhả Shift) từ Discord!`);
        }
    });

    message.reply(`Đã gửi lệnh \`${command}\` tới toàn bộ sư đoàn bot!`);
});

discordClient.login(DISCORD_TOKEN).catch(err => {
    console.log('[!] Lỗi đăng nhập Discord Bot:', err.message);
});

// ==========================================
// TRÌNH CHỐNG SẬP SCRIPT TOÀN CỤC
// ==========================================
process.on('uncaughtException', (err) => {
    console.log(`[!] [Crash Guard] Lỗi chưa xử lý: ${err.message}`);
});
process.on('unhandledRejection', (reason) => {
    console.log(`[!] [Crash Guard] Rejection chưa xử lý: ${reason?.message || reason}`);
});

// ==========================================
// CẤU HÌNH CƠ BẢN MINECRAFT
// ==========================================
const BOTS_CONFIG = [];
for (let i = 1; i <= 18; i++) {
    BOTS_CONFIG.push({ 
        username: `craftlo${i}`, 
        password: '12341234' 
    });
}

const SERVER_IP = 'mc.luckyvn.com'; 
const SERVER_PORT = 25565;
const VERSION = '1.12.2';

const ADMIN_NAME = '_Player001'; 
const SECRET_PASS = '6677'; 

const PROTECT_ITEMS = ['clock', 'diamond']; 

console.log(`[*] ĐANG KHỞI ĐỘNG SƯ ĐOÀN (${BOTS_CONFIG.length} BOTS)...`);

function createWorker(account, botIndex) {
    let loginStarted = false;
    let menuCount = 0;
    let hasReachedIsland = false;
    let isAutoTrade = false;
    let isGopBlock = false; 
    let isGopBlockRunning = false;
    let targetIds = null; 

    const bot = mineflayer.createBot({
        host: SERVER_IP,
        port: SERVER_PORT,
        username: account.username,
        version: VERSION
    });

    bot.loadPlugin(pathfinder);

    const chatQueue = [];
    let isSendingChat = false;

    function safeChat(msg) {
        chatQueue.push(msg);
        processChatQueue();
    }

    function processChatQueue() {
        if (isSendingChat || chatQueue.length === 0) return;
        isSendingChat = true;
        const msg = chatQueue.shift();
        try {
            bot.chat(msg);
        } catch (e) {}
        setTimeout(() => {
            isSendingChat = false;
            processChatQueue();
        }, 1200);
    }

    const botDataRef = {
        bot,
        username: account.username,
        botIndex,
        get isAutoTrade() { return isAutoTrade; },
        set isAutoTrade(val) { isAutoTrade = val; },
        get isGopBlock() { return isGopBlock; },
        set isGopBlock(val) { isGopBlock = val; },
        runGopBlockLoop: () => runGopBlockLoop(),
        runAutoTrade: () => runAutoTrade(),
        trashAllItems: () => trashAllItems()
    };
    activeBots.push(botDataRef);

    async function safeClickWindow(slot, mouseButton, mode) {
        if (!bot.currentWindow) return false;
        try {
            await bot.clickWindow(slot, mouseButton, mode);
            return true;
        } catch (err) {
            return false;
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function waitWindow(timeout = 1500) {
        return new Promise((resolve) => {
            if (bot.currentWindow) {
                return resolve(bot.currentWindow);
            }
            let resolved = false;
            const listener = (window) => {
                if (!resolved) {
                    resolved = true;
                    bot.removeListener('windowOpen', listener);
                    resolve(window);
                }
            };
            bot.once('windowOpen', listener);
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    bot.removeListener('windowOpen', listener);
                    resolve(null);
                }
            }, timeout);
        });
    }

    // ---------- 1. LOGIN & MỞ MENU VÀO ĐẢO ----------
    bot.on('spawn', () => {
        if (loginStarted) return;
        loginStarted = true;
        menuCount = 0;
        hasReachedIsland = false;

        bot.setControlState('sneak', false);
        console.log(`[🔐] [${account.username}] Vào sảnh spawn. Tiến hành gửi /login...`);

        setTimeout(() => {
            bot.chat(`/login ${account.password}`);
            setTimeout(() => {
                if (hasReachedIsland) return;
                bot.setControlState('forward', true);

                setTimeout(() => {
                    bot.setControlState('forward', false);
                    setTimeout(async () => {
                        try {
                            await bot.setQuickBarSlot(4);
                            setTimeout(() => {
                                bot.activateItem();
                                setTimeout(() => bot.activateItem(), 600);
                            }, 500);
                        } catch (err) {}
                    }, 500);
                }, 1200);
            }, 1500);
        }, 1500);
    });

    bot.on('windowOpen', async (window) => {
        if (hasReachedIsland) return;
        menuCount++;

        setTimeout(async () => {
            try {
                if (menuCount === 1) {
                    await bot.clickWindow(20, 0, 0);
                } else if (menuCount === 2) {
                    await bot.clickWindow(16, 0, 0);
                } else if (menuCount === 3) {
                    await bot.clickWindow(2, 0, 0);
                    setTimeout(() => {
                        safeChat('/is go');
                        hasReachedIsland = true;
                        console.log(`[🎉] [${account.username}] Vào cụm thành công!`);
                    }, 3500);
                }
            } catch (e) {}
        }, 1200);
    });

    bot.on('messagestr', (message) => {
        const msg = message.toLowerCase();
        const adminLower = ADMIN_NAME.toLowerCase(); 
        const isSystemMessage = !message.includes(':') && !message.includes('>');

        if (isSystemMessage && msg.includes(adminLower) && (msg.includes('mời') || msg.includes('invite') || msg.includes('vào đảo'))) {
            safeChat(`/is accept ${ADMIN_NAME}`);
            setTimeout(() => { safeChat('/is go'); hasReachedIsland = true; }, 2500);
        }

        if (isSystemMessage && msg.includes(adminLower) && (msg.includes('yêu cầu') || msg.includes('tpa') || msg.includes('tpaccept'))) {
            if (!msg.includes('!tpa')) safeChat('/tpaccept');
        }

        if (msg.includes('/register')) {
            bot.chat(`/register ${account.password} ${account.password}`);
        }
    });

    function countItem(itemName) {
        return bot.inventory.items().filter(i => i.name === itemName).reduce((a, b) => a + b.count, 0);
    }

    async function smartWaitWindow() {
        let windowOpened = false;
        const listener = () => { windowOpened = true; };
        bot.once('windowOpen', listener);
        for (let i = 0; i < 25; i++) { 
            if (windowOpened) break;
            await bot.waitForTicks(1);
        }
        bot.removeListener('windowOpen', listener);
    }

    async function waitForItemIncrease(itemName, previousCount, maxTicks = 40) {
        let ticksWaited = 0;
        while (ticksWaited < maxTicks && isGopBlock) {
            if (countItem(itemName) > previousCount) return true;
            await bot.waitForTicks(1);
            ticksWaited++;
        }
        return countItem(itemName) > previousCount;
    }

    async function trashAllItems() {
        const hasGarbage = bot.inventory.items().some(item => !PROTECT_ITEMS.includes(item.name));
        if (!hasGarbage) return;

        bot.chat('/trash');
        await smartWaitWindow();
        await bot.waitForTicks(4);

        if (bot.currentWindow) {
            const invStart = bot.currentWindow.inventoryStart;
            const totalSlots = bot.currentWindow.slots.length;
            for (let i = invStart; i < totalSlots; i++) {
                if (!bot.currentWindow) break;
                const item = bot.currentWindow.slots[i];
                if (item && !PROTECT_ITEMS.includes(item.name)) {
                    await safeClickWindow(i, 0, 1);
                    await bot.waitForTicks(3);
                }
            }
            if (bot.currentWindow) {
                try { bot.closeWindow(bot.currentWindow); } catch (e) {}
            }
            await bot.waitForTicks(4);
        }
    }

    async function dropDiamonds() {
        const diamonds = bot.inventory.items().filter(item => item.name === 'diamond');
        if (diamonds.length === 0) return;

        await bot.look(bot.entity.yaw, 0); 
        await bot.waitForTicks(4);
        for (const item of diamonds) {
            try { await bot.tossStack(item); await bot.waitForTicks(3); } catch (e) {}
        }
    }

    // ==========================================
    // TÍNH NĂNG GÓP BLOCK (GOPBLOCK) - DELAY 150MS
    // ==========================================
    const runGopBlockLoop = async () => {
        if (isGopBlockRunning) return;
        isGopBlockRunning = true;
        
        if (!targetIds) {
            const mcData = require('minecraft-data')(bot.version);
            targetIds = [mcData.blocksByName.diamond_block.id];
        }

        const safeMove = new Movements(bot, require('minecraft-data')(bot.version));
        safeMove.canDig = false;
        safeMove.allow1by1towers = false;
        safeMove.allowParkour = false;
        bot.pathfinder.setMovements(safeMove);

        let fetchFails = 0;
        let depositFails = 0;

        while (isGopBlock) {
            try {
                const targetBlock = bot.findBlock({ matching: targetIds, maxDistance: 8 });
                if (!targetBlock) { 
                    await delay(300); 
                    continue; 
                }

                bot.setControlState('sneak', false);
                try { 
                    await bot.pathfinder.goto(new goals.GoalNear(targetBlock.position.x, targetBlock.position.y, targetBlock.position.z, 2)); 
                } catch (e) { 
                    await delay(300); 
                    continue; 
                }
                bot.pathfinder.setGoal(null);

                let hasItems = countItem('diamond_block') > 0;
                if (!hasItems) {
                    const beforeFetch = countItem('diamond_block');
                    bot.chat('/kho lay diamond_block 2304');
                    hasItems = await waitForItemIncrease('diamond_block', beforeFetch, 55);
                }

                if (!hasItems) {
                    fetchFails++;
                    await trashAllItems();
                    if (fetchFails >= 3) {
                        isGopBlock = false;
                        notifyDiscord(`⚠️ \`${account.username}\` không rút được khoáng sản sau 3 lần. Đã dừng GOPBLOCK.`);
                        break;
                    }
                    await delay(400);
                    continue;
                }
                fetchFails = 0;

                bot.setControlState('sneak', true);
                await bot.lookAt(targetBlock.position.offset(0.5, 0.5, 0.5), true);
                const beforeDeposit = countItem('diamond_block');
                const windowPromise = waitWindow(1300);
                
                try { bot.activateBlock(targetBlock); } catch (e) {}
                
                const window = await windowPromise;
                if (!window) {
                    depositFails++;
                    bot.setControlState('sneak', false);
                    if (depositFails >= 5) {
                        isGopBlock = false;
                        notifyDiscord(`⚠️ \`${account.username}\` không mở được block góp. Đã dừng GOPBLOCK.`);
                    }
                    await delay(250);
                    continue;
                }

                window.requiresConfirmation = false;
                for (let i = window.inventoryStart; i < window.slots.length && isGopBlock; i++) {
                    const item = window.slots[i];
                    if (item && item.name === 'diamond_block') {
                        try { await bot.clickWindow(i, 0, 1); } catch (e) {}
                        // Tăng delay lên 150ms để ổn định tuyệt đối với server
                        await delay(150);
                    }
                }

                if (bot.currentWindow) bot.closeWindow(bot.currentWindow);
                await delay(200);

                if (countItem('diamond_block') < beforeDeposit) depositFails = 0;
                else depositFails++;

                if (depositFails >= 5) {
                    isGopBlock = false;
                    notifyDiscord(`⚠️ \`${account.username}\` không gửi được block vào máy. Đã dừng GOPBLOCK.`);
                }
            } catch (e) {
                if (bot.currentWindow) bot.closeWindow(bot.currentWindow);
                bot.setControlState('sneak', false);
                await delay(300);
            }
            await delay(100);
        }

        bot.setControlState('sneak', false);
        bot.pathfinder.setGoal(null);
        isGopBlockRunning = false;
    };

    // ==========================================
    // HÀM CHẾ ĐỒ - AUTO ĐÚC 
    // ==========================================
    async function craftSequence(blockName, amount, menuSlotId) {
        if (!isAutoTrade) return false; 
        let targetAmount = (blockName === 'iron_block') ? 2000 : 5; 

        if (countItem(blockName) < targetAmount) {
            let retryKho = 0;
            let lastCount = countItem(blockName);

            while (countItem(blockName) < targetAmount && retryKho < 10 && isAutoTrade) {
                bot.chat(`/kho lay ${blockName} ${amount}`);
                await bot.waitForTicks(8); 
                let currentCount = countItem(blockName);
                if (currentCount <= lastCount) retryKho++; else { retryKho = 0; lastCount = currentCount; }
            }
            
            let finalCount = countItem(blockName);
            if (blockName === 'iron_block' && finalCount < 2000) {
                await trashAllItems(); 
                return false; 
            } else if (blockName !== 'iron_block' && finalCount < 5) {
                await trashAllItems(); 
                return false; 
            }
        }

        let menuFails = 0;
        while (isAutoTrade && countItem(blockName) > 0) {
            if (countItem('diamond') >= 2) break;
            if (blockName === 'gold_block' && countItem('gold_ingot') >= 8) break;
            
            if (menuFails >= 3) {
                await trashAllItems();
                return false; 
            }

            bot.chat('/ecraft');
            await smartWaitWindow();
            await bot.waitForTicks(3);
            if (!bot.currentWindow) continue;

            await safeClickWindow(22, 0, 0);
            await smartWaitWindow();
            await bot.waitForTicks(3);
            if (!bot.currentWindow) continue;

            await safeClickWindow(menuSlotId, 0, 0);
            await smartWaitWindow();
            await bot.waitForTicks(3);
            if (!bot.currentWindow) continue;

            let stuckTicks = 0;
            let lastCount = countItem(blockName);

            while (isAutoTrade && bot.currentWindow) {
                if (countItem('diamond') >= 2) break;
                let currentCount = countItem(blockName);
                if (currentCount === 0) break;
                if (blockName === 'gold_block' && countItem('gold_ingot') >= 8) break;

                if (currentCount === lastCount) {
                    stuckTicks++;
                    if (stuckTicks > 15) { menuFails++; break; }
                } else {
                    lastCount = currentCount; stuckTicks = 0; menuFails = 0;
                }
                
                await safeClickWindow(41, 0, 0);
                await bot.waitForTicks(3); 
            }
            if (bot.currentWindow) try { bot.closeWindow(bot.currentWindow); } catch (e) {}
            await bot.waitForTicks(4); 
        }
        return true; 
    }

    async function runAutoTrade() {
        if (!isAutoTrade) return;
        try {
            if (countItem('diamond') >= 2) await dropDiamonds();
            await craftSequence('iron_block', 4000, 34);
            if (countItem('diamond') >= 2) await dropDiamonds(); 
            await craftSequence('gold_block', 512, 16);
            if (countItem('diamond') >= 2) await dropDiamonds(); 
            await craftSequence('diamond_block', 48, 19);
            
            await dropDiamonds();
            await trashAllItems();
        } catch (e) {
            if (bot.currentWindow) try { bot.closeWindow(bot.currentWindow); } catch (err) {}
        }
        if (isAutoTrade) setTimeout(runAutoTrade, 350); 
    }

    // ==========================================
    // ĐIỀU KHIỂN & LỆNH TRONG GAME (ADMIN)
    // ==========================================
    bot.on('chat', (username, message) => {
        if (username !== ADMIN_NAME) return;
        hasReachedIsland = true; 
        
        if (message.startsWith('!chat')) {
            const args = message.slice(5).trim().split(' ');
            const firstArg = args[0];

            if (firstArg && firstArg.toLowerCase() === account.username.toLowerCase()) {
                const chatMessage = args.slice(1).join(' ');
                if (chatMessage) bot.chat(chatMessage);
            } else if (!activeBots.some(b => b.username.toLowerCase() === firstArg?.toLowerCase())) {
                const chatMessage = args.join(' ');
                if (chatMessage) bot.chat(chatMessage);
            }
            return;
        }

        const isSecureCommand = message.includes(SECRET_PASS);

        if (message.includes('!gopblock')) {
            if (!isSecureCommand) return;
            isGopBlock = !isGopBlock;
            if (isGopBlock) {
                isAutoTrade = false; 
                console.log(`[>>] [${account.username}] Bắt đầu Nạp Block!`);
                setTimeout(runGopBlockLoop, 100 + botIndex * 150); 
            } else {
                bot.setControlState('sneak', false); 
                console.log(`[||] [${account.username}] Đã dừng GopBlock!`);
            }
        }

        if (message.includes('!auto') || message.includes('!aotu')) {
            if (!isSecureCommand) return;
            isAutoTrade = !isAutoTrade;
            if (isAutoTrade) {
                isGopBlock = false; 
                bot.setControlState('sneak', false); 
                console.log(`[>>] [${account.username}] Bắt đầu Đúc Đồ (Auto)!`);
                setTimeout(runAutoTrade, 200 + botIndex * 300); 
            } else {
                console.log(`[||] [${account.username}] Đã dừng Auto!`);
            }
        }

        if (message.includes('!vutdo')) {
            if (!isSecureCommand) return;
            trashAllItems(); 
        }

        if (message.includes('!dao') || message.includes('!is')) {
            if (!isSecureCommand) return;
            bot.chat('/is go');
        }

        if (message.includes('!kiemtra')) {
            const ironB = countItem('iron_block');
            const ironI = countItem('iron_ingot');
            const goldB = countItem('gold_block');
            const goldI = countItem('gold_ingot');
            const diaB = countItem('diamond_block');
            const diaI = countItem('diamond');
            console.log(`[TÚI ĐỒ] [${account.username}] Sắt: ${ironB}B-${ironI}I | Vàng: ${goldB}B-${goldI}I | KC: ${diaB}B-${diaI}I`);
        }

        if (message.includes('!theo')) {
            if (!isSecureCommand) return;
            const target = bot.players[username] ? bot.players[username].entity : null;
            if (target) {
                const mcData = require('minecraft-data')(bot.version);
                const move = new Movements(bot, mcData);
                move.canDig = false; 
                bot.pathfinder.setMovements(move);
                bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
            }
        }

        if (message.includes('!gianra')) {
            if (!isSecureCommand) return;
            const target = bot.players[username] ? bot.players[username].entity : null;
            if (target) {
                const mcData = require('minecraft-data')(bot.version);
                const move = new Movements(bot, mcData);
                move.canDig = false; 
                bot.pathfinder.setMovements(move);
                
                const id = parseInt(account.username.slice(-2)) || Math.floor(Math.random() * 10);
                const angle = id * (Math.PI * 2 / 11); 
                const radius = 1.5; 
                
                const targetX = target.position.x + Math.cos(angle) * radius;
                const targetZ = target.position.z + Math.sin(angle) * radius;
                
                bot.pathfinder.setGoal(new goals.GoalNear(targetX, target.position.y, targetZ, 0.2), true);
            }
        }

        if (message.includes('!dung')) {
            if (!isSecureCommand) return;
            bot.pathfinder.setGoal(null);
            isAutoTrade = false;
            isGopBlock = false;
            bot.setControlState('sneak', false); 
            console.log(`[||] [${account.username}] Đã dừng mọi hoạt động (Nhả Shift)!`);
        }
    });

    bot.on('end', (reason) => {
        isAutoTrade = false; 
        isGopBlock = false;
        const idx = activeBots.findIndex(b => b.bot === bot);
        if (idx !== -1) activeBots.splice(idx, 1);

        setTimeout(() => { createWorker(account, botIndex); }, 15000);
    });

    bot.on('kicked', (reason) => {
        try {
            console.log(`[-] [${account.username}] BỊ KICK:`, JSON.stringify(reason, null, 2));
        } catch (e) {}
    });
    bot.on('error', (err) => console.log(`[-] [${account.username}] Lỗi:`, err));
}

// Khởi chạy từng worker kèm thứ tự index
BOTS_CONFIG.forEach((account, index) => {
    setTimeout(() => { createWorker(account, index); }, index * 1000); 
});
