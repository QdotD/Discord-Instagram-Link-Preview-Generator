const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const Discord = require('discord.js');
require('dotenv').config();

async function downloadVideo(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to the page containing the video
    try {
        await page.goto(url, { timeout: 30000 });
    } catch (e) {
        if (e instanceof puppeteer.errors.TimeoutError) {
            // Handle the timeout how you want (e.g., by skipping this URL, retrying, logging, etc.)
            console.log("Timeout error, skipping this URL...");
        } else {
            throw e;  // For non-timeout errors, still throw the error so you can see it
        }
    }

    // Wait for the video element to be loaded
    await page.waitForSelector('video');

    // Extract video URL from 'src' attribute
    const videoUrl = await page.evaluate(() => {
        return document.querySelector('video').getAttribute('src');
    });

    console.log(`Downloading video from: ${videoUrl}`);

    // Download the video
    const response = await axios({
        url: videoUrl,
        method: 'GET',
        responseType: 'stream'
    });

    // Create a write stream to save the video to a file
    const writer = fs.createWriteStream('video.mp4');

    // Pipe the video stream into the write stream
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });

    console.log('Video downloaded successfully. Now uploading to Discord.');

    await browser.close();
}

function extractInstagramUrl(text) {
    // a basic example that just finds the first URL in the text
    const words = text.split(' ');
    return words.find(word => word.startsWith('https://www.instagram.com/'));
}

// Initialize the client with your intents
const GUILDS_AND_GUILD_MESSAGES_INTENTS = 
    (1 << 0) +  // GUILDS
    (1 << 9) +   // GUILD_MESSAGES
    (1 << 15); // MESSAGE_CONTENT

const client = new Discord.Client({ intents: GUILDS_AND_GUILD_MESSAGES_INTENTS });

client.once('ready', () => {
    console.log('Discord bot is ready');
});

client.on('messageCreate', async message => {
    console.log(`Received a message from ${message.author.tag}: ${message.content}`);
    console.log('message: ' + message);

    // Check if the message is not from a bot and contains an Instagram URL
    if (!message.author.bot && message.content.includes('instagram.com')) {
        // Extract the Instagram URL
        const url = extractInstagramUrl(message.content);
        console.log(`Extracted URL: ${url}`);

        // Download the video
        await downloadVideo(url);

        // Then send the video to the same channel the message was in
        if (message.channel.type === 0) {
            await message.channel.send({
                content: `Can you believe ${message.author} just tried to make you click a link? Here's the video:`,
                files: [{
                    attachment: 'video.mp4',
                    name: 'video.mp4'
                }]
            });
            console.log('Video uploaded successfully to Discord.');
        } else {
            console.error('Target channel is not a text channel.');
        }
    } else {
        console.log(`Message "${message.content}" does not include an Instagram link`)
    }
});


client.login(process.env.DISCORD_BOT_TOKEN);