const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const Discord = require('discord.js');
require('dotenv').config();

let videoUrl = null;

async function downloadVideo(url) {
    const browser = await puppeteer.launch({
        headless: "new",
        executablePath: '/usr/bin/google-chrome-stable',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setRequestInterception(true);

    const videoRequestPattern = 'https://scontent';

    page.on('request', interceptedRequest => {
        const requestUrl = interceptedRequest.url();

        console.log(`Request made to: ${requestUrl}`);

        if (requestUrl.startsWith(videoRequestPattern)) {
            videoUrl = requestUrl;
            interceptedRequest.abort();
            console.log(`Downloading video from: ${videoUrl}`);
            downloadAndUploadVideo(videoUrl);
        } else {
            interceptedRequest.continue();
        }
    });

    await page.goto(url, { timeout: 60000 }).catch(e => {
        if (e instanceof puppeteer.errors.TimeoutError) {
            console.log("Timeout error, skipping this URL...");
        } else {
            throw e;
        }
    });

    if (!videoUrl) {
        console.log('No video URL found');
        return;
    }

    await browser.close();
}

async function downloadAndUploadVideo(videoUrl) {
    const response = await axios({
        url: videoUrl,
        method: 'GET',
        responseType: 'stream'
    });

    const path = 'video.mp4';
    const writer = fs.createWriteStream(path);

    writer.on('error', (err) => {
        console.error(`Error occurred while writing to the file: ${err}`);
    });

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });

    console.log('Video downloaded successfully. Now uploading to Discord.');
}

function extractInstagramUrl(text) {
    const words = text.split(' ');
    return words.find(word => word.startsWith('https://www.instagram.com/'));
}

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
    console.log('Message: ' + message);

    if (!message.author.bot && message.content.includes('instagram.com')) {
        const url = extractInstagramUrl(message.content);
        console.log(`Extracted URL-: ${url}`);

        await downloadVideo(url);

        if (message.channel.type === 0) {
            try {
                await message.channel.send({
                    content: `Can you believe ${message.author} just tried to make you click a link? Here's the video:`,
                    files: [{
                        attachment: 'video.mp4',
                        name: 'video.mp4'
                    }]
                });
                console.log('Video uploaded successfully to Discord.');
            } catch (error) {
                console.error('Error occurred while reading from the file: ' + error);
            }

            if (fs.existsSync('video.mp4')) {
                try {
                    fs.unlinkSync('video.mp4');
                } catch (error) {
                    console.error('Error occurred while deleting the file: ' + error);
                }
            }
        } else {
            console.error('Target channel is not a text channel.');
        }
    } else {
        console.log(`Message "${message.content}" does not include an Instagram link`)
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);